import { NextRequest, NextResponse } from 'next/server';
import { finalizeOrder, OrderData } from '@/lib/finalize-order';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';

/* 결제창 복귀 시 호출 — 공통 finalizeOrder로 주문 확정 (webhook과 멱등 공유) */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.paymentId) {
    return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });
  }

  /* [보안] 주문 금액·내역은 반드시 서버가 prepare 단계에서 DB로 검증·저장한
     pending_payments 값만 사용한다. 클라이언트가 보낸 body.orderData 는 신뢰하지 않는다
     (손님이 금액을 조작해 싸게 결제하는 것을 차단). 데스크톱·모바일 동일 경로.
     prepare가 반드시 결제 전에 성공하므로 이 값은 항상 존재한다. */
  const supabase = createAdminSupabaseClient();
  const { data: pending } = await supabase
    .from('pending_payments').select('data').eq('payment_id', body.paymentId).maybeSingle();
  const orderData = pending?.data as OrderData | undefined;
  if (!orderData) {
    return NextResponse.json({ error: '주문 데이터를 찾을 수 없습니다. 다시 시도해주세요.' }, { status: 400 });
  }

  /* bypass는 클라이언트 값이 아니라 서버 env로만 판단 (위변조 방지) */
  const bypass = process.env.PAYMENT_BYPASS === 'true';

  const r = await finalizeOrder(body.paymentId, orderData, { bypass });
  if (!r.success) {
    return NextResponse.json({ error: r.error }, { status: r.status || 500 });
  }
  return NextResponse.json({ success: true, orderNo: r.orderNo, earnedPoint: r.earnedPoint });
}
