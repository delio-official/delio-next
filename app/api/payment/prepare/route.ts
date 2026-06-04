import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';

/* 결제창 호출 직전: 주문 데이터를 paymentId로 임시 저장.
   브라우저가 안 돌아와도 웹훅이 이 데이터로 주문을 확정할 수 있게 함. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.paymentId || !body?.orderData) {
    return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });
  }
  try {
    const supabase = createAdminSupabaseClient();
    const { error } = await supabase
      .from('pending_payments')
      .upsert({ payment_id: body.paymentId, data: body.orderData });
    if (error) return NextResponse.json({ error: 'prepare 실패', detail: error }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: '서버 오류', detail: String(e) }, { status: 500 });
  }
}
