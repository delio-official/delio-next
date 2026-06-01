import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';
import { fetchLastStatusCode, mapTrackerCodeToOrderStatus, ORDER_STATUS_RANK } from '@/lib/tracker';

/**
 * tracker.delivery 웹훅 수신.
 * 구독 등록 시 callbackUrl 에 ?carrierId=..&trackingNumber=.. 를 실어두므로,
 * 본문 형식에 의존하지 않고 쿼리값으로 운송장을 식별 → 권위 있는 상태를 재조회 → 주문 상태 갱신.
 */
async function handle(carrierId: string | null, trackingNumber: string | null) {
  if (!carrierId || !trackingNumber) {
    return NextResponse.json({ ok: false, error: 'carrierId / trackingNumber 누락' }, { status: 400 });
  }

  // 1. 최신 배송 상태 조회 → 우리 주문 상태로 매핑
  const code = await fetchLastStatusCode(carrierId, trackingNumber);
  const mapped = mapTrackerCodeToOrderStatus(code);
  if (!mapped) {
    return NextResponse.json({ ok: true, skipped: true, code }, { status: 202 });
  }

  // 2. 해당 운송장의 주문들 조회 (중복 가능성 대비, 단건 가정 X)
  const supabase = createAdminSupabaseClient();
  const { data: orders } = await supabase
    .from('orders')
    .select('id, status')
    .eq('tracking_number', trackingNumber);
  if (!orders || orders.length === 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: '주문 없음', code }, { status: 202 });
  }

  // 3. 취소/환불 제외 + 앞으로만 진행(역행 방지) → 갱신 (delivered 시 추천 보상 트리거 자동)
  const newRank = ORDER_STATUS_RANK[mapped] ?? 0;
  let updated = false;
  for (const o of orders) {
    const cur = o.status as string;
    if (['cancelled', 'refunding', 'refunded'].includes(cur)) continue;
    if ((ORDER_STATUS_RANK[cur] ?? 0) >= newRank) continue;
    await supabase.from('orders').update({ status: mapped }).eq('id', o.id);
    updated = true;
  }
  return NextResponse.json({ ok: true, updated: updated ? mapped : null, code }, { status: 202 });
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  let carrierId = searchParams.get('carrierId');
  let trackingNumber = searchParams.get('trackingNumber');

  // 쿼리에 없으면 본문에서 보조 추출 (방어적)
  if (!carrierId || !trackingNumber) {
    const body = await req.json().catch(() => null);
    carrierId = carrierId || body?.carrierId || body?.carrier?.id || null;
    trackingNumber = trackingNumber || body?.trackingNumber || null;
  }

  try {
    return await handle(carrierId, trackingNumber);
  } catch (e) {
    console.error('[tracking/webhook]', e);
    // 웹훅은 200으로 응답해 불필요한 재시도를 막되, 내부 오류만 로깅
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 });
  }
}

// 일부 웹훅은 GET 으로 헬스체크/검증을 보내므로 허용
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  return handle(searchParams.get('carrierId'), searchParams.get('trackingNumber'));
}
