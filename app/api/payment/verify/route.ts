import { NextRequest, NextResponse } from 'next/server';
import { finalizeOrder } from '@/lib/finalize-order';

/* 결제창 복귀 시 호출 — 공통 finalizeOrder로 주문 확정 (webhook과 멱등 공유) */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.paymentId || !body?.orderData) {
    return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });
  }

  /* bypass는 클라이언트 값이 아니라 서버 env로만 판단 (위변조 방지) */
  const bypass = process.env.PAYMENT_BYPASS === 'true';

  const r = await finalizeOrder(body.paymentId, body.orderData, { bypass });
  if (!r.success) {
    return NextResponse.json({ error: r.error }, { status: r.status || 500 });
  }
  return NextResponse.json({ success: true, orderNo: r.orderNo, earnedPoint: r.earnedPoint });
}
