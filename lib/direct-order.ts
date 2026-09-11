import type { SupabaseClient } from '@supabase/supabase-js';
import { validateOrderInput, type OrderInput } from '@/lib/order-validate';
import { notifyAlimtalk, kstDate } from '@/lib/sms';

/* 결제창 없는 주문 생성 (서버 전용) — 무통장입금(입금대기) · 0원 결제(쿠폰·포인트 전액).
   예전엔 브라우저가 재고 차감·주문 저장·쿠폰 사용·포인트 차감을 직접 했으나(조작 가능),
   이제 서버가 금액을 검증(lib/order-validate)한 뒤 전부 처리한다.
   - vbank: status 'pending', 적립은 입금확인 때(lib/vbank-paid)
   - free : 서버 계산 합계가 0원일 때만, status 'paid'
   admin = service-role client, userId 는 로그인 세션에서 온 값이어야 함 */

export interface DirectOrderData extends OrderInput {
  recipient: string; phone: string; zipcode?: string;
  addr1: string; addr2?: string; memo?: string;
  ordererName?: string; ordererPhone?: string;
  payMethod?: string;
}
export type DirectOrderResult =
  | { ok: true; orderNo: string; orderId: string }
  | { ok: false; error: string; status: number };

export async function createDirectOrder(
  admin: SupabaseClient,
  od: DirectOrderData,
  mode: 'vbank' | 'free',
  opts: { bypass?: boolean } = {},
): Promise<DirectOrderResult> {
  const v = await validateOrderInput(admin, od);
  if (!v.ok) return { ok: false, error: v.error, status: 400 };
  if (!od.recipient?.trim() || !od.phone?.trim() || !od.addr1?.trim()) return { ok: false, error: '배송지 정보를 모두 입력해주세요.', status: 400 };
  if (mode === 'free' && od.totalAmount > 0 && !opts.bypass) {
    return { ok: false, error: '결제할 금액이 있는 주문입니다. 결제수단을 선택해 결제해주세요.', status: 400 };
  }
  const pointUsed = Number(od.pointUsed || 0);
  const couponDiscount = Number(od.couponDiscount || 0);

  /* 1) 재고 선점(원자적 RPC) — 부족하면 주문을 만들지 않음 */
  const stockItems = od.items.map(i => ({ optionId: i.stockOptionId || null, qty: i.quantity }));
  const { error: decErr } = await admin.rpc('decrement_stocks', { p_items: stockItems });
  if (decErr) return { ok: false, error: '죄송합니다. 방금 재고가 소진되어 주문할 수 없습니다.', status: 409 };

  /* 2) 쿠폰 선점 — 동시에 두 주문에 쓰이지 않도록 '미사용일 때만' 사용 처리 */
  if (od.userCouponId) {
    const { data: took } = await admin.from('user_coupons')
      .update({ is_used: true, used_at: new Date().toISOString() })
      .eq('id', od.userCouponId).eq('user_id', od.userId).eq('is_used', false)
      .select('id').maybeSingle();
    if (!took) {
      await admin.rpc('restore_stocks', { p_items: stockItems });
      return { ok: false, error: '이미 사용한 쿠폰입니다. 쿠폰을 다시 선택해주세요.', status: 409 };
    }
  }
  const releaseCoupon = async () => {
    if (od.userCouponId) await admin.from('user_coupons').update({ is_used: false, used_at: null }).eq('id', od.userCouponId);
  };

  /* 3) 주문 저장 */
  let buyerGrade: string | null = null;
  try {
    const { data: pf } = await admin.from('profiles').select('grade').eq('id', od.userId).maybeSingle();
    buyerGrade = (pf as { grade?: string | null } | null)?.grade ?? null;
  } catch { /* 무시 */ }
  const { data: order, error: orderErr } = await admin.from('orders').insert({
    user_id: od.userId,
    status: mode === 'vbank' ? 'pending' : 'paid',
    buyer_grade: buyerGrade,
    total_amount: od.subtotal,
    discount_amount: couponDiscount + pointUsed,
    coupon_discount: couponDiscount,
    point_used: pointUsed,
    used_coupon_id: od.userCouponId || null,
    final_amount: od.totalAmount,
    earned_point: 0,                        // 무통장: 입금확인 때 지급 / 0원: 적립 대상 금액 없음
    recipient: od.recipient.trim(), phone: od.phone.trim(), zipcode: od.zipcode || '',
    address1: od.addr1.trim(), address2: od.addr2 || '',
    orderer_name: od.ordererName?.trim() || null, orderer_phone: od.ordererPhone?.trim() || null,
    delivery_type: 'parcel', delivery_memo: od.memo || '',
    payment_method: mode === 'vbank' ? 'vbank' : (od.payMethod || 'point'),
    paid_at: mode === 'vbank' ? null : new Date().toISOString(),
  }).select('id, order_no').single();
  if (orderErr || !order) {
    await admin.rpc('restore_stocks', { p_items: stockItems });
    await releaseCoupon();
    return { ok: false, error: `주문 저장에 실패했습니다. 잠시 후 다시 시도해주세요.${orderErr?.message ? ` (${orderErr.message})` : ''}`, status: 500 };
  }

  /* 4) 주문 상품 — 정산용 공급가 스냅샷(옵션 공급가 우선, 없으면 상품 공급가), 카드 결제(finalize-order)와 동일 */
  const productIds = [...new Set(od.items.map(i => i.id))];
  const optIds = [...new Set(od.items.map(i => i.stockOptionId).filter(Boolean))] as string[];
  const [{ data: sp }, { data: os }] = await Promise.all([
    admin.from('products').select('id, supply_price').in('id', productIds),
    optIds.length ? admin.from('product_options').select('id, supply_price').in('id', optIds) : Promise.resolve({ data: [] as { id: string; supply_price: number | null }[] }),
  ]);
  const supplyMap = new Map(((sp || []) as { id: string; supply_price: number | null }[]).map(p => [p.id, p.supply_price ?? 0]));
  const optSupplyMap = new Map(((os || []) as { id: string; supply_price: number | null }[]).filter(o => o.supply_price).map(o => [o.id, o.supply_price as number]));
  const { error: itemsErr } = await admin.from('order_items').insert(od.items.map(i => ({
    order_id: order.id,
    product_id: i.id,
    product_name: (i.name || '') + (i.options ? ` (${i.options})` : ''),
    option_label: i.options || null,
    option_id: i.stockOptionId || null,
    unit_price: i.price,
    quantity: i.quantity,
    subtotal: i.price * i.quantity,
    supply_price: (i.stockOptionId && optSupplyMap.get(i.stockOptionId)) || supplyMap.get(i.id) || 0,
    thumbnail_url: i.thumbnail || null,
  })));
  if (itemsErr) {
    await admin.from('orders').delete().eq('id', order.id);
    await admin.rpc('restore_stocks', { p_items: stockItems });
    await releaseCoupon();
    return { ok: false, error: `주문 저장에 실패했습니다. 잠시 후 다시 시도해주세요. (${itemsErr.message})`, status: 500 };
  }

  /* 5) 포인트 차감 (검증 시 잔액 이내 확인됨) + 원장 */
  if (pointUsed > 0) {
    const { data: prof } = await admin.from('profiles').select('point_balance').eq('id', od.userId).single();
    const bal = (prof as { point_balance?: number } | null)?.point_balance || 0;
    await admin.from('profiles').update({ point_balance: Math.max(0, bal - pointUsed) }).eq('id', od.userId);
    try { await admin.from('point_logs').insert({ user_id: od.userId, amount: -pointUsed, description: '주문 사용' }); } catch { /* 원장 실패 무시 */ }
  }

  /* 6) 0원 결제 = 결제 완료 → 주문 완료 알림톡(주문자에게, 주문자 이름) */
  if (mode === 'free') {
    const to = od.ordererPhone?.trim() || od.phone.trim();
    if (to) {
      const first = od.items[0];
      try {
        await notifyAlimtalk('order_complete', to, {
          recipient: od.ordererName?.trim() || od.recipient.trim(),
          orderNo: order.order_no,
          orderDate: kstDate(),
          productName: (first?.name || '') + (od.items.length > 1 ? ` 외 ${od.items.length - 1}건` : ''),
          amount: `${od.totalAmount.toLocaleString()}원`,
        });
      } catch { /* 알림 실패는 주문에 영향 없음 */ }
    }
  }

  return { ok: true, orderNo: order.order_no as string, orderId: order.id as string };
}
