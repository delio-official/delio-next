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

    /* [보안] 포인트 중복 사용 불가 쿠폰인데 포인트를 함께 썼으면 결제 진행 자체를 막는다.
       결제 후(finalize)에 막으면 돈은 빠지고 주문은 없는 상태가 되므로 결제 전 여기서 차단. */
    const od = body.orderData as { userCouponId?: string | null; pointUsed?: number };
    if (od?.userCouponId && (od.pointUsed || 0) > 0) {
      const { data: uc } = await supabase
        .from('user_coupons').select('coupons(allow_point)').eq('id', od.userCouponId).maybeSingle();
      const allowPoint = (uc?.coupons as { allow_point?: boolean } | null)?.allow_point;
      if (allowPoint === false) {
        return NextResponse.json({ error: '이 쿠폰은 포인트와 함께 사용할 수 없습니다.' }, { status: 400 });
      }
    }

    const { error } = await supabase
      .from('pending_payments')
      .upsert({ payment_id: body.paymentId, data: body.orderData });
    if (error) return NextResponse.json({ error: 'prepare 실패', detail: error }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: '서버 오류', detail: String(e) }, { status: 500 });
  }
}
