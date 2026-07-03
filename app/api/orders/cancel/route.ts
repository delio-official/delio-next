import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';
import { notifyAlimtalk } from '@/lib/sms';

/* 고객 즉시 주문취소 — 결제완료(paid) 상태(=판매자가 상품준비중으로 바꾸기 전)에서만.
   포트원 결제취소 + 쿠폰·포인트 복원 + 주문 cancelled + 기록용 refund_requests(완료).
   준비중 이후로 바뀌었으면 needsRequest=true → 클라가 취소 '신청' 흐름으로 전환. */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: '인증 필요' }, { status: 401 });

  let orderId = '';
  try { orderId = (await req.json())?.orderId || ''; } catch { /* noop */ }
  if (!orderId) return NextResponse.json({ ok: false, error: 'orderId 누락' }, { status: 400 });

  const admin = createAdminSupabaseClient();
  const { data: order } = await admin.from('orders')
    .select('id, user_id, status, point_used, earned_point, used_coupon_id, refund_restored, portone_payment_id, order_no, recipient, phone, final_amount')
    .eq('id', orderId).maybeSingle();
  if (!order) return NextResponse.json({ ok: false, error: '주문 없음' }, { status: 404 });
  if (order.user_id !== user.id) return NextResponse.json({ ok: false, error: '본인 주문이 아닙니다' }, { status: 403 });

  /* 즉시취소는 결제완료(paid)에서만. 그 사이 준비중 등으로 바뀌었으면 신청 흐름으로 */
  if (order.status !== 'paid') {
    return NextResponse.json({ ok: false, needsRequest: true, status: order.status });
  }

  /* 포트원 결제취소 (결제 ID 있을 때) */
  if (order.portone_payment_id) {
    const apiSecret = process.env.PORTONE_API_SECRET;
    if (!apiSecret) return NextResponse.json({ ok: false, error: '결제취소 설정 오류(시크릿 없음)' }, { status: 503 });
    const pres = await fetch(`https://api.portone.io/payments/${encodeURIComponent(order.portone_payment_id)}/cancel`, {
      method: 'POST',
      headers: { Authorization: `PortOne ${apiSecret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: '고객 주문취소' }),
    });
    const pj = await pres.json().catch(() => ({}));
    if (!pres.ok && pj?.type !== 'PAYMENT_ALREADY_CANCELLED') {
      return NextResponse.json({ ok: false, error: '결제취소 실패', detail: pj }, { status: 502 });
    }
  }

  /* 주문상태 → 취소됨 (여전히 paid일 때만 = 동시성 가드) */
  const { data: upd } = await admin.from('orders')
    .update({ status: 'cancelled' }).eq('id', orderId).eq('status', 'paid').select('id').maybeSingle();
  if (!upd) return NextResponse.json({ ok: false, needsRequest: true, status: 'changed' });

  /* 쿠폰·포인트 복원 (멱등) */
  if (!order.refund_restored) {
    const { data: marked } = await admin.from('orders')
      .update({ refund_restored: true }).eq('id', orderId).eq('refund_restored', false).select('id').maybeSingle();
    if (marked) {
      if (order.used_coupon_id) {
        await admin.from('user_coupons').update({ is_used: false, used_at: null }).eq('id', order.used_coupon_id);
      }
      const pointUsed = order.point_used || 0;
      const earned = order.earned_point || 0;
      if (pointUsed > 0 || earned > 0) {
        const { data: prof } = await admin.from('profiles').select('point_balance').eq('id', user.id).single();
        const newBal = Math.max(0, (prof?.point_balance || 0) + pointUsed - earned);
        await admin.from('profiles').update({ point_balance: newBal }).eq('id', user.id);
        try {
          const logs: { user_id: string; amount: number; description: string }[] = [];
          if (pointUsed > 0) logs.push({ user_id: user.id, amount: pointUsed, description: '주문취소 — 사용 포인트 환급' });
          if (earned > 0) logs.push({ user_id: user.id, amount: -earned, description: '주문취소 — 적립 포인트 회수' });
          if (logs.length) await admin.from('point_logs').insert(logs);
        } catch { /* 원장 실패 무시 */ }
      }
    }
  }

  /* 재고 복원 (멱등: stock_restored 가드) */
  try { await admin.rpc('restore_order_stock', { p_order_id: orderId }); } catch { /* 복원 실패는 무시(관리자 확인) */ }

  /* 기록용: 어드민 환불관리에 '취소완료(자동)'로 남김 */
  try {
    await admin.from('refund_requests').insert({
      order_id: orderId, user_id: user.id, reason: '고객 즉시취소', detail: '', type: 'cancel', status: 'completed',
    });
  } catch { /* 기록 실패는 무시 */ }

  /* 주문 취소 알림톡 */
  if (order.phone) {
    try {
      await notifyAlimtalk('order_cancelled', order.phone, {
        recipient: order.recipient || '',
        orderNo: order.order_no || '',
        cancelledAt: new Date().toLocaleString('ko-KR'),
        refundAmount: `${(order.final_amount || 0).toLocaleString()}원`,
      });
    } catch { /* noop */ }
  }

  return NextResponse.json({ ok: true, cancelled: true });
}
