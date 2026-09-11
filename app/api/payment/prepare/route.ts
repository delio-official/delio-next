import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { validateOrderInput, type OrderInput } from '@/lib/order-validate';

/* 결제창 호출 직전: 주문 데이터를 서버가 검증한 뒤 paymentId로 임시 저장.
   브라우저가 안 돌아와도 웹훅이 이 데이터로 주문을 확정할 수 있게 함.
   verify·webhook 은 여기 저장된 값만 사용한다(클라이언트 body 불신). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.paymentId || !body?.orderData) {
    return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });
  }
  try {
    /* [보안] 주문자는 로그인 세션으로 확정 — 남의 userId로 그 사람 쿠폰·포인트를 쓰는 조작 차단 */
    const authClient = await createServerSupabaseClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다. 다시 로그인 후 결제해주세요.' }, { status: 401 });
    const orderData = { ...body.orderData, userId: user.id } as OrderInput & Record<string, unknown>;

    /* [보안] 결제 금액 서버 재계산 검증 — 결제 전에 막아야 돈이 빠지고 주문이 없는 상황을 피함 */
    const supabase = createAdminSupabaseClient();
    const v = await validateOrderInput(supabase, orderData);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

    const { error } = await supabase
      .from('pending_payments')
      .upsert({ payment_id: body.paymentId, data: orderData });
    if (error) return NextResponse.json({ error: 'prepare 실패', detail: error }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: '서버 오류', detail: String(e) }, { status: 500 });
  }
}
