import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';
import { fetchLastStatusCode, mapTrackerCodeToOrderStatus, ORDER_STATUS_RANK } from '@/lib/tracker';
import { notifyAlimtalk } from '@/lib/sms';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/*
  배송상태 동기화 크론 (웹훅 보조).
  · tracker.delivery 웹훅 구독은 최대 47시간만 유효 → 그보다 늦게 배송완료되면
    DELIVERED 이벤트를 못 받아 주문이 '배송중'에 멈춤(수동 변경 필요).
  · 이 크론이 아직 배송완료 전인 운송장들을 직접 폴링해 권위있는 상태로 따라잡음.
  · 웹훅 핸들러와 동일한 규칙: 취소/환불 제외, 역행 방지, delivered 시 알림톡.
  보안: Authorization: Bearer <CRON_SECRET>. ?force=1 은 의미 없음(전부 폴링).
*/
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminSupabaseClient();

  // 운송장이 있고 아직 배송완료/취소 전인 주문만 (paid/preparing/shipped).
  // 최근 30일 이내 주문으로 한정 — 영영 미완료인 오래된/테스트 건 무한 폴링 방지(Rate Limit 절약).
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data: orders, error } = await admin
    .from('orders')
    .select('id, status, courier, tracking_number, phone, recipient, order_no, order_items(product_name)')
    .in('status', ['paid', 'preparing', 'shipped'])
    .not('courier', 'is', null)
    .not('tracking_number', 'is', null)
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(300);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  let advanced = 0, delivered = 0, checked = 0;
  for (const o of (orders || []) as Array<{
    id: string; status: string; courier: string | null; tracking_number: string | null;
    phone: string | null; recipient: string | null; order_no: string | null;
    order_items?: { product_name: string | null }[];
  }>) {
    if (!o.courier || !o.tracking_number) continue;
    checked++;
    let mapped: ReturnType<typeof mapTrackerCodeToOrderStatus> = null;
    try {
      const code = await fetchLastStatusCode(o.courier, o.tracking_number);
      mapped = mapTrackerCodeToOrderStatus(code);
    } catch { continue; /* 개별 조회 실패는 건너뜀 */ }
    if (!mapped) continue;

    const newRank = ORDER_STATUS_RANK[mapped] ?? 0;
    if (['cancelled', 'refunding', 'refunded'].includes(o.status)) continue;
    if ((ORDER_STATUS_RANK[o.status] ?? 0) >= newRank) continue; // 역행/동급 방지

    await admin.from('orders')
      .update({ status: mapped, ...(mapped === 'delivered' ? { delivered_at: new Date().toISOString() } : {}) })
      .eq('id', o.id);
    advanced++;

    if (mapped === 'delivered') {
      delivered++;
      if (o.phone) {
        const productName = o.order_items?.[0]?.product_name || '주문 상품';
        try {
          await notifyAlimtalk('delivery_complete', o.phone, {
            recipient: o.recipient || '고객',
            orderNo: o.order_no || '',
            productName,
            completedAt: new Date().toLocaleString('ko-KR'),
          });
        } catch { /* 알림 실패는 상태 갱신에 영향 없음 */ }
      }
    }
  }

  return NextResponse.json({ ok: true, candidates: orders?.length || 0, checked, advanced, delivered });
}
