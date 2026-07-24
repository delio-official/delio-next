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

    /* ───────── [보안] 결제 금액 서버 재계산 검증 ─────────
       결제 후(finalize)에 막으면 돈은 빠지고 주문은 없는 상태가 되므로 '결제 전' 여기서 차단.
       라이브 결제이므로 정당한 주문을 막지 않도록, 확실한 위반만 거부(경계값은 관대하게). */
    const od = body.orderData as {
      userId?: string; userCouponId?: string | null;
      subtotal?: number; totalAmount?: number; couponDiscount?: number; pointUsed?: number;
      items?: { id: string; price: number; quantity: number }[];
    };
    const bad = (msg: string) => NextResponse.json({ error: msg }, { status: 400 });
    const items = od?.items || [];
    const pointUsed = od?.pointUsed || 0;
    const couponDiscount = od?.couponDiscount || 0;

    if (items.length > 0 && od?.userId) {
      /* 1) 상품 실가격 조회 — 클라이언트가 보낸 단가가 DB 기본가보다 낮으면 조작(옵션은 더하기만 함) */
      const ids = [...new Set(items.map(i => i.id))];
      const { data: prods } = await supabase
        .from('products').select('id, price, discounted_price, is_active').in('id', ids);
      const pmap = new Map((prods || []).map(p => [p.id, p]));
      let subtotalServer = 0;
      for (const it of items) {
        const p = pmap.get(it.id);
        if (!p) return bad('존재하지 않는 상품이 포함되어 있습니다.');
        if (p.is_active === false) return bad('판매 중지된 상품이 포함되어 있습니다.');
        const base = (p.discounted_price ?? p.price) as number;      // 옵션 추가금은 +만 되므로 단가는 base 이상이어야 정당
        if ((it.price || 0) < base - 1) return bad('상품 가격이 올바르지 않습니다. 장바구니를 다시 확인해주세요.');
        subtotalServer += (it.price || 0) * (it.quantity || 1);
      }
      /* 2) subtotal 일치(클라이언트 내부 정합성) */
      if (Math.abs(subtotalServer - (od.subtotal || 0)) > 1) return bad('주문 금액이 올바르지 않습니다.');

      /* 3) 쿠폰 — 소유·유효·최소주문 확인 후 할인액 재계산. 청구 할인이 서버 계산보다 크면 거부 */
      if (od.userCouponId) {
        const { data: uc } = await supabase
          .from('user_coupons')
          .select('user_id, is_used, expires_at, coupons(discount_type, discount_value, min_order_amount, max_discount_amount, is_active, allow_point, expires_at)')
          .eq('id', od.userCouponId).maybeSingle();
        if (!uc) return bad('쿠폰 정보를 확인할 수 없습니다.');
        if (uc.user_id !== od.userId) return bad('본인 쿠폰이 아닙니다.');
        if (uc.is_used) return bad('이미 사용한 쿠폰입니다.');
        const c = (Array.isArray(uc.coupons) ? uc.coupons[0] : uc.coupons) as unknown as {
          discount_type: 'percent'|'fixed'; discount_value: number; min_order_amount: number;
          max_discount_amount: number | null; is_active: boolean; allow_point?: boolean; expires_at?: string | null;
        } | null;
        if (!c || c.is_active === false) return bad('사용할 수 없는 쿠폰입니다.');
        const exp = (uc.expires_at as string) || c.expires_at;
        if (exp) {
          const now = new Date();
          const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
          if (exp.slice(0,10) < today) return bad('만료된 쿠폰입니다.');
        }
        if (pointUsed > 0 && c.allow_point === false) return bad('이 쿠폰은 포인트와 함께 사용할 수 없습니다.');
        let discServer = 0;
        if ((od.subtotal || 0) >= (c.min_order_amount || 0)) {
          discServer = c.discount_type === 'percent'
            ? Math.floor((od.subtotal || 0) * c.discount_value / 100)
            : c.discount_value;
          if (c.max_discount_amount) discServer = Math.min(discServer, c.max_discount_amount);
        }
        if (couponDiscount > discServer + 1) return bad('쿠폰 할인 금액이 올바르지 않습니다.');
      } else if (couponDiscount > 0) {
        return bad('쿠폰 없이 할인이 적용되어 있습니다.');
      }

      /* 4) 포인트 — 보유 잔액 이내 */
      if (pointUsed > 0) {
        const { data: prof } = await supabase.from('profiles').select('point_balance').eq('id', od.userId).maybeSingle();
        if (pointUsed > (prof?.point_balance || 0) + 1) return bad('보유 포인트를 초과했습니다.');
      }

      /* 5) 최종금액 = 소계 − 쿠폰 − 포인트 (산술 정합성). 포트원 실결제액과의 대조는 finalize 에서 */
      const expectTotal = Math.max(0, (od.subtotal || 0) - couponDiscount - pointUsed);
      if (Math.abs(expectTotal - (od.totalAmount || 0)) > 1) return bad('결제 금액 계산이 올바르지 않습니다.');
    }
    /* ─────────────────────────────────────────────────── */

    const { error } = await supabase
      .from('pending_payments')
      .upsert({ payment_id: body.paymentId, data: body.orderData });
    if (error) return NextResponse.json({ error: 'prepare 실패', detail: error }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: '서버 오류', detail: String(e) }, { status: 500 });
  }
}
