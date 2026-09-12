import type { SupabaseClient } from '@supabase/supabase-js';

/* ───────── 주문 금액 서버 검증 (카드 prepare · 무통장/0원 주문 생성 공용) ─────────
   브라우저가 보낸 가격·쿠폰·포인트를 그대로 믿지 않고 DB로 다시 확인한다.
   라이브 결제이므로 정당한 주문을 막지 않도록 '확실한 위반'만 거부한다(단가는 하한만 검사, ±1원 허용).
   - 단가 ≥ (할인가 또는 정상가) + 고른 옵션 추가금  (옵션 추가금을 빼고 싸게 결제하는 조작 차단)
   - 재고 옵션(stockOptionId)은 반드시 그 상품의 옵션 (다른 상품 재고를 깎는 조작 차단)
   - 쿠폰: 본인 소유·미사용·유효·최소주문, 할인액 재계산
   - 포인트: 보유 잔액 이내, 포인트 불가 쿠폰과 동시 사용 금지
   - 합계 = 소계 − 쿠폰 − 포인트 */

export interface OrderItemInput {
  id: string;
  price: number;
  quantity: number;
  name?: string;
  options?: string;
  thumbnail?: string;
  stockOptionId?: string | null;
  optionIds?: string[] | null;   // 고른 옵션 전체(장바구니 optionId). 옛 장바구니는 없을 수 있음
}
export interface OrderInput {
  userId: string;
  subtotal: number;
  totalAmount: number;
  couponDiscount?: number;
  pointUsed?: number;
  userCouponId?: string | null;
  items: OrderItemInput[];
}

type Result = { ok: true } | { ok: false; error: string };
const bad = (error: string): Result => ({ ok: false, error });

export async function validateOrderInput(admin: SupabaseClient, od: OrderInput): Promise<Result> {
  const items = od?.items || [];
  const pointUsed = Number(od?.pointUsed || 0);
  const couponDiscount = Number(od?.couponDiscount || 0);
  if (!od?.userId) return bad('로그인이 필요합니다.');
  if (items.length === 0) return bad('주문 상품이 없습니다.');
  if (![od.subtotal, od.totalAmount, pointUsed, couponDiscount].every(n => Number.isFinite(Number(n)) && Number(n) >= 0)) {
    return bad('주문 금액이 올바르지 않습니다.');
  }
  for (const it of items) {
    if (!it?.id || !Number.isInteger(it.quantity) || it.quantity < 1 || it.quantity > 999 || !Number.isFinite(it.price)) {
      return bad('주문 상품 정보가 올바르지 않습니다. 장바구니를 다시 확인해주세요.');
    }
  }

  /* 1) 상품·옵션 실가격 */
  const ids = [...new Set(items.map(i => i.id))];
  const [{ data: prods }, { data: opts }] = await Promise.all([
    admin.from('products').select('id, price, discounted_price, is_active, deleted_at').in('id', ids),
    admin.from('product_options').select('id, product_id, label, add_price, parent_label').in('product_id', ids),
  ]);
  const pmap = new Map((prods || []).map((p: { id: string }) => [p.id, p as { id: string; price: number; discounted_price: number | null; is_active: boolean; deleted_at: string | null }]));
  const optById = new Map((opts || []).map((o: { id: string }) => [o.id, o as { id: string; product_id: string; label: string; add_price: number | null; parent_label: string | null }]));
  let subtotalServer = 0;
  for (const it of items) {
    const p = pmap.get(it.id);
    if (!p || p.deleted_at) return bad('존재하지 않는 상품이 포함되어 있습니다.');
    if (p.is_active === false) return bad('판매 중지된 상품이 포함되어 있습니다.');
    const base = (p.discounted_price ?? p.price) as number;
    let lower = base;
    const ofThis = (oid?: string | null) => { const o = oid ? optById.get(oid) : undefined; return o && o.product_id === it.id ? o : undefined; };
    if (it.stockOptionId && !ofThis(it.stockOptionId)) return bad('상품 옵션 정보가 올바르지 않습니다. 장바구니를 다시 담아주세요.');
    const picked = (it.optionIds || []).filter(Boolean);
    if (picked.length > 0) {
      for (const oid of picked) {
        const o = ofThis(oid);
        if (!o) return bad('상품 옵션 정보가 올바르지 않습니다. 장바구니를 다시 담아주세요.');
        lower += o.add_price || 0;
      }
    } else if (it.stockOptionId) {
      /* 옛 장바구니(선택 옵션 목록 없음): 재고 옵션 + (2단계면) 그 상위 옵션 추가금으로 하한 계산 */
      const leaf = ofThis(it.stockOptionId)!;
      lower += leaf.add_price || 0;
      if (leaf.parent_label) {
        const parent = (opts || []).find((o: { product_id: string; label: string; parent_label: string | null }) =>
          o.product_id === it.id && o.label === leaf.parent_label && !o.parent_label) as { add_price: number | null } | undefined;
        lower += parent?.add_price || 0;
      }
    }
    if (it.price < lower - 1) return bad('상품 가격이 변경되었거나 올바르지 않습니다. 장바구니를 다시 확인해주세요.');
    subtotalServer += it.price * it.quantity;
  }
  /* 2) 소계 정합성 */
  if (Math.abs(subtotalServer - od.subtotal) > 1) return bad('주문 금액이 올바르지 않습니다.');

  /* 3) 쿠폰 */
  if (od.userCouponId) {
    const { data: uc } = await admin
      .from('user_coupons')
      .select('user_id, is_used, expires_at, coupons(discount_type, discount_value, min_order_amount, max_discount_amount, is_active, allow_point, starts_at, expires_at)')
      .eq('id', od.userCouponId).maybeSingle();
    if (!uc) return bad('쿠폰 정보를 확인할 수 없습니다.');
    if (uc.user_id !== od.userId) return bad('본인 쿠폰이 아닙니다.');
    if (uc.is_used) return bad('이미 사용한 쿠폰입니다.');
    const c = (Array.isArray(uc.coupons) ? uc.coupons[0] : uc.coupons) as unknown as {
      discount_type: 'percent' | 'fixed'; discount_value: number; min_order_amount: number;
      max_discount_amount: number | null; is_active: boolean; allow_point?: boolean; starts_at?: string | null; expires_at?: string | null;
    } | null;
    if (!c || c.is_active === false) return bad('사용할 수 없는 쿠폰입니다.');
    /* 사용 시작일 전에는 쓸 수 없다 — 예전엔 다운로드·코드등록에서만 확인해, 관리자 지급·가입 쿠폰은 시작 전에도 결제에 쓰였다 */
    if (c.starts_at && new Date(c.starts_at).getTime() > Date.now()) return bad('아직 사용 기간이 아닌 쿠폰입니다.');
    const exp = (uc.expires_at as string) || c.expires_at;
    if (exp) {
      /* 만료일 '당일'까지 유효(화면과 동일, 한국 날짜 기준) */
      const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
      const expDay = new Date(new Date(exp).getTime() + 9 * 3600000).toISOString().slice(0, 10);
      if (expDay < today) return bad('만료된 쿠폰입니다.');
    }
    if (pointUsed > 0 && c.allow_point === false) return bad('이 쿠폰은 포인트와 함께 사용할 수 없습니다.');
    let discServer = 0;
    if (od.subtotal >= (c.min_order_amount || 0)) {
      discServer = c.discount_type === 'percent' ? Math.floor(od.subtotal * c.discount_value / 100) : c.discount_value;
      if (c.max_discount_amount) discServer = Math.min(discServer, c.max_discount_amount);
    }
    if (couponDiscount > discServer + 1) return bad('쿠폰 할인 금액이 올바르지 않습니다.');
  } else if (couponDiscount > 0) {
    return bad('쿠폰 없이 할인이 적용되어 있습니다.');
  }

  /* 4) 포인트 */
  if (pointUsed > 0) {
    const { data: prof } = await admin.from('profiles').select('point_balance').eq('id', od.userId).maybeSingle();
    if (pointUsed > ((prof as { point_balance?: number } | null)?.point_balance || 0) + 1) return bad('보유 포인트를 초과했습니다.');
  }

  /* 5) 합계 = 소계 − 쿠폰 − 포인트 */
  const expectTotal = Math.max(0, od.subtotal - couponDiscount - pointUsed);
  if (Math.abs(expectTotal - od.totalAmount) > 1) return bad('결제 금액 계산이 올바르지 않습니다.');
  return { ok: true };
}
