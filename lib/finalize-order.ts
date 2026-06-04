import { createAdminSupabaseClient } from '@/lib/supabase-admin';

export interface OrderData {
  userId: string;
  subtotal: number;
  totalAmount: number;
  couponDiscount?: number;
  pointUsed?: number;
  userCouponId?: string | null;
  recipient: string; phone: string; zipcode: string;
  addr1: string; addr2: string; memo: string;
  payMethod: string;
  items: { id: string; name: string; price: number; quantity: number; thumbnail?: string; options?: string }[];
}

export interface FinalizeResult {
  success: boolean;
  orderNo?: string;
  earnedPoint?: number;
  alreadyDone?: boolean;
  error?: string;
  status?: number;
}

/**
 * 결제 확정 → 주문 생성 (verify 복귀 / webhook 양쪽 공용, 멱등).
 * 보안: bypass가 아니면 포트원 API로 직접 재조회해 PAID·금액 검증 (웹훅 본문을 신뢰하지 않음).
 */
export async function finalizeOrder(
  paymentId: string,
  orderData: OrderData,
  opts: { bypass?: boolean } = {}
): Promise<FinalizeResult> {
  const bypass = opts.bypass ?? false;
  const supabase = createAdminSupabaseClient();

  /* 멱등성: 이미 이 결제로 주문이 있으면 스킵 */
  if (!bypass && paymentId) {
    const { data: existing } = await supabase
      .from('orders').select('order_no').eq('portone_payment_id', paymentId).maybeSingle();
    if (existing) return { success: true, orderNo: existing.order_no, alreadyDone: true };
  }

  /* 포트원 재조회 검증 */
  if (!bypass) {
    const apiSecret = process.env.PORTONE_API_SECRET;
    if (!apiSecret) return { success: false, error: '포트원 API 시크릿 미설정', status: 503 };
    const portoneRes = await fetch(
      `https://api.portone.io/payments/${encodeURIComponent(paymentId)}`,
      { headers: { Authorization: `PortOne ${apiSecret}`, 'Content-Type': 'application/json' } }
    );
    if (!portoneRes.ok) {
      const errBody = await portoneRes.json().catch(() => ({}));
      console.error('[finalize] portone lookup failed:', portoneRes.status, JSON.stringify(errBody));
      return { success: false, error: `포트원 결제 조회 실패 (HTTP ${portoneRes.status}: ${errBody?.message || errBody?.type || ''})`, status: 502 };
    }
    const payment = await portoneRes.json();
    if (payment.status !== 'PAID') return { success: false, error: `결제 미완료 (status: ${payment.status})`, status: 400 };
    if (payment.amount?.total !== orderData.totalAmount) {
      return { success: false, error: `결제금액 불일치 (expected: ${orderData.totalAmount}, actual: ${payment.amount?.total})`, status: 400 };
    }
  }

  /* 주문 저장 */
  const couponDiscount = orderData.couponDiscount || 0;
  const pointUsed      = orderData.pointUsed || 0;
  const insertRow: Record<string, unknown> = {
    user_id:         orderData.userId,
    status:          'paid',
    total_amount:    orderData.subtotal,
    discount_amount: couponDiscount + pointUsed,
    coupon_discount: couponDiscount,
    point_used:      pointUsed,
    final_amount:    orderData.totalAmount,
    recipient:       orderData.recipient,
    phone:           orderData.phone,
    zipcode:         orderData.zipcode,
    address1:        orderData.addr1,
    address2:        orderData.addr2,
    delivery_type:   'parcel',
    delivery_memo:   orderData.memo,
    payment_method:  orderData.payMethod,
    paid_at:         new Date().toISOString(),
  };
  if (!bypass) insertRow.portone_payment_id = paymentId;

  const { data: order, error: orderError } = await supabase
    .from('orders').insert(insertRow).select().single();

  if (orderError || !order) {
    /* 유니크 위반 = 다른 경로(verify↔webhook)가 동시에 이미 생성 → 멱등 처리 */
    if (orderError && (orderError as { code?: string }).code === '23505') {
      const { data: existing } = await supabase
        .from('orders').select('order_no').eq('portone_payment_id', paymentId).maybeSingle();
      if (existing) return { success: true, orderNo: existing.order_no, alreadyDone: true };
    }
    return { success: false, error: '주문 저장 실패', status: 500 };
  }

  await supabase.from('order_items').insert(
    orderData.items.map(i => ({
      order_id:      order.id,
      product_id:    i.id,
      product_name:  i.name + (i.options ? ` (${i.options})` : ''),
      unit_price:    i.price,
      quantity:      i.quantity,
      subtotal:      i.price * i.quantity,
      thumbnail_url: i.thumbnail || null,
    }))
  );

  if (orderData.userCouponId) {
    await supabase.from('user_coupons')
      .update({ is_used: true, used_at: new Date().toISOString() })
      .eq('id', orderData.userCouponId);
  }

  const earned = Math.floor(orderData.totalAmount * 0.01);
  if (orderData.userId) {
    const { data: prof } = await supabase
      .from('profiles').select('point_balance').eq('id', orderData.userId).single();
    if (prof) {
      const newBalance = (prof.point_balance || 0) - pointUsed + earned;
      await supabase.from('profiles')
        .update({ point_balance: Math.max(0, newBalance) }).eq('id', orderData.userId);
    }
  }

  return { success: true, orderNo: order.order_no, earnedPoint: earned };
}
