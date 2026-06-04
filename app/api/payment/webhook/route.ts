import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';
import { finalizeOrder, OrderData } from '@/lib/finalize-order';

/* 포트원 V2 결제 웹훅 수신.
   ⚠️ 웹훅 본문을 신뢰하지 않고, paymentId로 포트원 API를 직접 재조회해
   실제 상태(PAID/CANCELLED)로만 처리 → 위조 웹훅으로 주문 생성 불가. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const paymentId: string | undefined = body?.data?.paymentId || body?.paymentId;
  console.log('[webhook] received:', JSON.stringify({ type: body?.type, paymentId }));
  if (!paymentId) return NextResponse.json({ ok: true, skipped: 'no paymentId' });

  const apiSecret = process.env.PORTONE_API_SECRET;
  if (!apiSecret) return NextResponse.json({ ok: true, skipped: 'no secret' });

  /* 포트원 API로 실제 결제 상태 재조회 */
  const res = await fetch(
    `https://api.portone.io/payments/${encodeURIComponent(paymentId)}`,
    { headers: { Authorization: `PortOne ${apiSecret}`, 'Content-Type': 'application/json' } }
  );
  if (!res.ok) {
    // 404 등 = 존재하지 않는 결제(콘솔 "호출 테스트" 포함) → ack(200). 5xx 일시오류만 재전송 유도.
    console.log('[webhook] payment fetch not ok:', res.status);
    return NextResponse.json(
      { ok: true, skipped: 'payment not found or fetch error', code: res.status },
      { status: res.status >= 500 ? 500 : 200 }
    );
  }
  const payment = await res.json();
  const status: string = payment.status;
  console.log('[webhook] payment status:', paymentId, status);

  const supabase = createAdminSupabaseClient();

  /* 결제 완료 / 가상계좌 입금 완료 → 주문 확정 (pending 데이터 사용, 멱등) */
  if (status === 'PAID') {
    const { data: pending } = await supabase
      .from('pending_payments').select('data').eq('payment_id', paymentId).maybeSingle();
    if (!pending?.data) {
      // 우리가 만든 결제가 아니거나 데이터 유실 → 무시(재전송 불필요)
      return NextResponse.json({ ok: true, skipped: 'no pending data' });
    }
    const r = await finalizeOrder(paymentId, pending.data as OrderData, { bypass: false });
    if (!r.success) return NextResponse.json({ error: r.error }, { status: 500 });
    return NextResponse.json({ ok: true, orderNo: r.orderNo });
  }

  /* 취소/부분취소 → 주문 상태 동기화 (콘솔 취소 등 대비) */
  if (status === 'CANCELLED' || status === 'PARTIAL_CANCELLED') {
    await supabase.from('orders').update({ status: 'refunded' }).eq('portone_payment_id', paymentId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true, status });
}
