import type { SupabaseClient } from '@supabase/supabase-js';

/* 전액 환불 확정된 주문의 쿠폰·포인트·재고 복원 (멱등).
   - 사용 포인트(point_used) 환급 · 적립 포인트(earned_point) 회수
   - 사용 쿠폰(used_coupon_id) 미사용 상태로 복원
   - orders.refund_restored 로 1회만 (동시/중복 호출 안전)
   admin = service-role Supabase client. 부분환불이 누적되어 100% 도달한 경우에도 호출된다. */
export async function restoreOrderCouponPoint(
  admin: SupabaseClient,
  orderId: string,
): Promise<{ ok: boolean; restored: boolean; already?: boolean; error?: string; refundedPoint?: number; clawback?: number; couponRestored?: boolean }> {
  const { data: order } = await admin
    .from('orders')
    .select('id, user_id, point_used, earned_point, used_coupon_id, refund_restored')
    .eq('id', orderId).maybeSingle();
  if (!order) return { ok: false, restored: false, error: '주문 없음' };
  if (order.refund_restored) return { ok: true, restored: false, already: true };

  /* 멱등 마킹 먼저 (동시 승인 방지) */
  const { data: marked } = await admin
    .from('orders').update({ refund_restored: true })
    .eq('id', orderId).eq('refund_restored', false).select('id').maybeSingle();
  if (!marked) return { ok: true, restored: false, already: true };

  const pointUsed = order.point_used || 0;
  const earned = order.earned_point || 0;
  let couponRestored = false;

  /* 쿠폰 복원 — 이미 만료된 쿠폰이면 복원일+7일로 되살림, 아직 유효하면 원래 만료일 유지.
     (환불했더니 그새 쿠폰이 만료돼 못 쓰는 상황 방지) */
  if (order.used_coupon_id) {
    const { data: uc } = await admin.from('user_coupons').select('expires_at').eq('id', order.used_coupon_id).maybeSingle();
    const patch: Record<string, unknown> = { is_used: false, used_at: null };
    const exp = uc?.expires_at ? new Date(uc.expires_at as string) : null;
    if (exp && exp.getTime() < Date.now()) {
      patch.expires_at = new Date(Date.now() + 7 * 86400000).toISOString();
      patch.expiry_notified = false;   // 만료 재연장 → 만료 임박 알림 다시 받도록 리셋
    }
    await admin.from('user_coupons').update(patch).eq('id', order.used_coupon_id);
    couponRestored = true;
  }

  /* 포인트: 사용분 환급 − 적립분 회수 */
  if (order.user_id && (pointUsed > 0 || earned > 0)) {
    const { data: prof } = await admin.from('profiles').select('point_balance').eq('id', order.user_id).single();
    const newBalance = Math.max(0, (prof?.point_balance || 0) + pointUsed - earned);
    await admin.from('profiles').update({ point_balance: newBalance }).eq('id', order.user_id);
    try {
      const logs: { user_id: string; amount: number; description: string }[] = [];
      if (pointUsed > 0) logs.push({ user_id: order.user_id, amount: pointUsed, description: '주문 취소/환불 — 사용 포인트 환급' });
      if (earned > 0) logs.push({ user_id: order.user_id, amount: -earned, description: '주문 취소/환불 — 적립 포인트 회수' });
      if (logs.length) await admin.from('point_logs').insert(logs);
    } catch { /* 원장 실패 무시 */ }
  }

  /* 재고 복원 (멱등: orders.stock_restored 가드, refund_restored와 독립) */
  try { await admin.rpc('restore_order_stock', { p_order_id: orderId }); } catch { /* 복원 실패는 무시(관리자 확인) */ }

  return { ok: true, restored: true, refundedPoint: pointUsed, clawback: earned, couponRestored };
}
