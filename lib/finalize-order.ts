import { createAdminSupabaseClient } from '@/lib/supabase-admin';
import { normalizeGrade, effectiveRate, DEFAULT_TIERS, type MembershipTier } from '@/lib/membership';
import { notifyAlimtalk } from '@/lib/sms';

export interface OrderData {
  userId: string;
  subtotal: number;
  totalAmount: number;
  couponDiscount?: number;
  pointUsed?: number;
  userCouponId?: string | null;
  ordererName?: string; ordererPhone?: string;
  recipient: string; phone: string; zipcode: string;
  addr1: string; addr2: string; memo: string;
  payMethod: string;
  items: { id: string; name: string; price: number; quantity: number; thumbnail?: string; options?: string; stockOptionId?: string | null }[];
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

  /* [보안] 포인트 중복 사용 불가 쿠폰인데 포인트를 함께 썼으면 거부.
     화면에서 막지만 클라이언트 조작으로 우회할 수 있어 서버에서도 확인한다.
     userCouponId(user_coupons.id) → coupon_id → coupons.allow_point */
  if (orderData.userCouponId && pointUsed > 0) {
    const { data: uc } = await supabase
      .from('user_coupons').select('coupons(allow_point)').eq('id', orderData.userCouponId).maybeSingle();
    const allowPoint = (uc?.coupons as { allow_point?: boolean } | null)?.allow_point;
    if (allowPoint === false) {
      return { success: false, error: '이 쿠폰은 포인트와 함께 사용할 수 없습니다.', status: 400 };
    }
  }
  const insertRow: Record<string, unknown> = {
    user_id:         orderData.userId,
    status:          'paid',
    total_amount:    orderData.subtotal,
    discount_amount: couponDiscount + pointUsed,
    coupon_discount: couponDiscount,
    point_used:      pointUsed,
    used_coupon_id:  orderData.userCouponId || null,
    final_amount:    orderData.totalAmount,
    recipient:       orderData.recipient,
    phone:           orderData.phone,
    orderer_name:    orderData.ordererName || null,
    orderer_phone:   orderData.ordererPhone || null,
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
    const oe = orderError as { message?: string; code?: string; details?: string; hint?: string } | null;
    console.error('[finalize] order insert error:', JSON.stringify(oe));
    return { success: false, error: `주문 저장 실패: ${oe?.message || ''}${oe?.code ? ` (${oe.code})` : ''}${oe?.details ? ` · ${oe.details}` : ''}`, status: 500 };
  }

  /* 재고 차감 (동시성 안전 RPC). 재고 부족이면 결제취소(자동 환불) + 주문 롤백 */
  {
    const stockItems = orderData.items.map(i => ({ optionId: i.stockOptionId || null, qty: i.quantity }));
    const { error: decErr } = await supabase.rpc('decrement_stocks', { p_items: stockItems });
    if (decErr) {
      // 이미 승인된 결제면 자동 환불
      if (!bypass && paymentId) {
        const apiSecret = process.env.PORTONE_API_SECRET;
        if (apiSecret) {
          await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}/cancel`, {
            method: 'POST',
            headers: { Authorization: `PortOne ${apiSecret}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: '재고 부족으로 인한 자동 취소' }),
          }).catch(() => {});
        }
      }
      // 쿠폰/포인트는 아직 미처리(아래에서 처리 전)이므로 주문만 삭제하면 됨
      await supabase.from('orders').delete().eq('id', order.id);
      console.error('[finalize] out of stock, order rolled back:', decErr.message);
      return { success: false, error: '죄송합니다. 방금 재고가 소진되어 주문이 취소되었습니다. 결제하신 금액은 자동으로 환불됩니다.', status: 409 };
    }
  }

  /* 농가 정산용: 판매 시점 공급가 스냅샷 — 옵션 공급가 우선, 없으면 상품 공급가 폴백 */
  const productIds = [...new Set(orderData.items.map(i => i.id).filter(Boolean))];
  const supplyMap: Record<string, number> = {};
  if (productIds.length > 0) {
    const { data: sp } = await supabase.from('products').select('id, supply_price').in('id', productIds);
    (sp || []).forEach((p: { id: string; supply_price: number | null }) => { supplyMap[p.id] = p.supply_price ?? 0; });
  }
  const optSupplyMap: Record<string, number> = {};
  {
    const optIds = [...new Set(orderData.items.map(i => i.stockOptionId).filter(Boolean))] as string[];
    if (optIds.length > 0) {
      const { data: os } = await supabase.from('product_options').select('id, supply_price').in('id', optIds);
      (os || []).forEach((o: { id: string; supply_price: number | null }) => { if (o.supply_price) optSupplyMap[o.id] = o.supply_price; });
    }
  }
  const supplyOf = (i: { id: string; stockOptionId?: string | null }) =>
    (i.stockOptionId && optSupplyMap[i.stockOptionId]) || supplyMap[i.id] || 0;

  await supabase.from('order_items').insert(
    orderData.items.map(i => ({
      order_id:      order.id,
      product_id:    i.id,
      product_name:  i.name + (i.options ? ` (${i.options})` : ''),
      option_label:  i.options || null,
      option_id:     i.stockOptionId || null,
      unit_price:    i.price,
      quantity:      i.quantity,
      subtotal:      i.price * i.quantity,
      supply_price:  supplyOf(i),
      thumbnail_url: i.thumbnail || null,
    }))
  );

  if (orderData.userCouponId) {
    await supabase.from('user_coupons')
      .update({ is_used: true, used_at: new Date().toISOString() })
      .eq('id', orderData.userCouponId);
  }

  /* 포인트 적립: 회원 등급별 적립률(membership_tiers, 적용일 스케줄링 포함). 글로벌 on/off 존중 */
  let pointEnabled = true;
  {
    const { data: pe } = await supabase
      .from('site_settings').select('value').eq('key', 'point_enabled').maybeSingle();
    pointEnabled = !pe || pe.value !== 'false';
  }
  let earned = 0;
  if (orderData.userId) {
    const { data: prof } = await supabase
      .from('profiles').select('point_balance, grade').eq('id', orderData.userId).single();
    if (prof) {
      const grade = normalizeGrade(prof.grade);
      const { data: tierRow } = await supabase
        .from('membership_tiers').select('*').eq('grade', grade).maybeSingle();
      const tier = (tierRow as MembershipTier | null) ?? DEFAULT_TIERS.find(t => t.grade === grade)!;
      const ratePct = effectiveRate(tier);
      earned = pointEnabled ? Math.floor(orderData.totalAmount * ratePct / 100) : 0;
      const newBalance = (prof.point_balance || 0) - pointUsed + earned;
      await supabase.from('profiles')
        .update({ point_balance: Math.max(0, newBalance) }).eq('id', orderData.userId);
      if (earned > 0) await supabase.from('orders').update({ earned_point: earned }).eq('id', order.id);
      /* 포인트 원장(point_logs) 기록 — 사용분 차감 + 적립분 */
      try {
        const logs: { user_id: string; amount: number; description: string }[] = [];
        if (pointUsed > 0) logs.push({ user_id: orderData.userId, amount: -pointUsed, description: '주문 사용' });
        if (earned > 0)    logs.push({ user_id: orderData.userId, amount: earned,    description: '구매 적립' });
        if (logs.length) await supabase.from('point_logs').insert(logs);
      } catch { /* 원장 기록 실패는 무시 */ }
    }
  }

  /* 주문 완료 알림톡 (실패해도 주문은 정상) — 결제 관련이므로 주문자(계정)에게 발송 */
  const ordererPhone = orderData.ordererPhone || orderData.phone;
  if (ordererPhone) {
    const first = orderData.items[0];
    const productName = first ? first.name + (orderData.items.length > 1 ? ` 외 ${orderData.items.length - 1}건` : '') : '';
    try {
      await notifyAlimtalk('order_complete', ordererPhone, {
        recipient: orderData.recipient,
        orderNo: order.order_no,
        orderDate: new Date().toLocaleDateString('ko-KR'),
        productName,
        amount: `${orderData.totalAmount.toLocaleString()}원`,
      });
    } catch { /* noop */ }
  }

  return { success: true, orderNo: order.order_no, earnedPoint: earned };
}
