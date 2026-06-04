import { NextRequest, NextResponse } from 'next/server';
import { finalizeOrder, OrderData } from '@/lib/finalize-order';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';

/* 결제창 복귀 시 호출 — 공통 finalizeOrder로 주문 확정 (webhook과 멱등 공유) */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.paymentId) {
    return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });
  }

  /* orderData가 없으면(모바일 REDIRECTION 복귀 등) pending_payments에서 복구 */
  let orderData: OrderData | undefined = body.orderData;
  if (!orderData) {
    const supabase = createAdminSupabaseClient();
    const { data: pending } = await supabase
      .from('pending_payments').select('data').eq('payment_id', body.paymentId).maybeSingle();
    orderData = pending?.data as OrderData | undefined;
  }
  if (!orderData) {
    return NextResponse.json({ error: '주문 데이터를 찾을 수 없습니다.' }, { status: 400 });
  }

  /* bypass는 클라이언트 값이 아니라 서버 env로만 판단 (위변조 방지) */
  const bypass = process.env.PAYMENT_BYPASS === 'true';

  const r = await finalizeOrder(body.paymentId, orderData, { bypass });
  if (!r.success) {
    return NextResponse.json({ error: r.error }, { status: r.status || 500 });
  }
  return NextResponse.json({ success: true, orderNo: r.orderNo, earnedPoint: r.earnedPoint });
}
