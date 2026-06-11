import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';

/* 취소/환불 승인 시 사용한 쿠폰·포인트 복원 (관리자 전용, 멱등)
   - 사용 포인트(point_used) 환급 · 적립 포인트(earned_point) 회수
   - 사용 쿠폰(used_coupon_id) 미사용 상태로 복원
   - orders.refund_restored 로 1회만 */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: '인증 필요' }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc('is_current_user_admin');
  if (!isAdmin) return NextResponse.json({ ok: false, error: '권한 없음' }, { status: 403 });

  let orderId = '';
  try { orderId = (await req.json())?.orderId || ''; } catch { /* noop */ }
  if (!orderId) return NextResponse.json({ ok: false, error: 'orderId 누락' }, { status: 400 });

  const admin = createAdminSupabaseClient();

  const { data: order } = await admin
    .from('orders')
    .select('id, user_id, point_used, earned_point, used_coupon_id, refund_restored')
    .eq('id', orderId).maybeSingle();
  if (!order) return NextResponse.json({ ok: false, error: '주문 없음' }, { status: 404 });
  if (order.refund_restored) return NextResponse.json({ ok: true, restored: false, already: true });

  /* 멱등 마킹 먼저 (동시 승인 방지) */
  const { data: marked } = await admin
    .from('orders').update({ refund_restored: true })
    .eq('id', orderId).eq('refund_restored', false).select('id').maybeSingle();
  if (!marked) return NextResponse.json({ ok: true, restored: false, already: true });

  const pointUsed = order.point_used || 0;
  const earned = order.earned_point || 0;
  let couponRestored = false;

  /* 쿠폰 복원 */
  if (order.used_coupon_id) {
    await admin.from('user_coupons')
      .update({ is_used: false, used_at: null })
      .eq('id', order.used_coupon_id);
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

  return NextResponse.json({ ok: true, restored: true, refundedPoint: pointUsed, clawback: earned, couponRestored });
}
