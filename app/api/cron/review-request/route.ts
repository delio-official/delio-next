import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';
import { notifyAlimtalk } from '@/lib/sms';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/*
  후기요청 알림톡 자동발송 크론 (Vercel Cron → 매일 1회).
  · 배송완료(delivered/confirmed) 후 REVIEW_DAYS일 지난 주문에 후기요청 알림톡 발송
  · orders.review_request_sent 플래그로 1회만 발송 (멱등)
  보안: Authorization: Bearer <CRON_SECRET>. ?force=1 이면 일수 무관 전체 대상(테스트용).
*/
const REVIEW_DAYS = 3;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const force = req.nextUrl.searchParams.get('force') === '1';
  const admin = createAdminSupabaseClient();

  // 토글 확인 (기본 on)
  const { data: st } = await admin.from('site_settings').select('value').eq('key', 'review_request_on').maybeSingle();
  if (st?.value === 'false') return NextResponse.json({ ok: true, skipped: 'toggle off' });

  const cutoff = new Date(Date.now() - REVIEW_DAYS * 86400000).toISOString();
  let q = admin.from('orders')
    .select('id, order_no, recipient, phone, delivered_at, order_items(product_name)')
    .in('status', ['delivered', 'confirmed'])
    .eq('review_request_sent', false)
    .not('phone', 'is', null)
    .limit(300);
  if (!force) q = q.lte('delivered_at', cutoff);

  const { data: orders, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  let sent = 0;
  for (const o of (orders || []) as Array<{ id: string; recipient: string | null; phone: string | null; order_items?: { product_name: string | null }[] }>) {
    if (!o.phone) continue;
    const productName = o.order_items?.[0]?.product_name || '구매하신 상품';
    try {
      await notifyAlimtalk('review_request', o.phone, { recipient: o.recipient || '고객', productName });
      await admin.from('orders').update({ review_request_sent: true }).eq('id', o.id);
      sent++;
    } catch { /* 개별 실패는 건너뜀 (플래그 미설정 → 다음 회차 재시도) */ }
  }

  return NextResponse.json({ ok: true, candidates: orders?.length || 0, sent });
}
