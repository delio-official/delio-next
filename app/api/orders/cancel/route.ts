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

  let orderId = '', reason = '', detail = '';
  try {
    const b = await req.json();
    orderId = b?.orderId || '';
    reason  = (b?.reason  || '').toString().slice(0, 100);
    detail  = (b?.detail  || '').toString().slice(0, 500);
  } catch { /* noop */ }
  if (!orderId) return NextResponse.json({ ok: false, error: 'orderId 누락' }, { status: 400 });

  const admin = createAdminSupabaseClient();
  const { data: order } = await admin.from('orders')
    .select('id, user_id, status, point_used, earned_point, used_coupon_id, refund_restored, portone_payment_id, order_no, recipient, phone, final_amount')
    .eq('id', orderId).maybeSingle();
  if (!order) return NextResponse.json({ ok: false, error: '주문 없음' }, { status: 404 });
  if (order.user_id !== user.id) return NextResponse.json({ ok: false, error: '본인 주문이 아닙니다' }, { status: 403 });

  /* 즉시취소 = 결제완료(paid) 또는 입금대기(pending, 무통장). 그 외(준비중 등)는 신청 흐름으로 */
  if (order.status !== 'paid' && order.status !== 'pending') {
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

  /* 주문상태 → 취소됨 (여전히 paid/pending일 때만 = 동시성 가드) */
  const { data: upd } = await admin.from('orders')
    .update({ status: 'cancelled' }).eq('id', orderId).in('status', ['paid', 'pending']).select('id').maybeSingle();
  if (!upd) return NextResponse.json({ ok: false, needsRequest: true, status: 'changed' });

  /* 쿠폰·포인트 복원 (멱등) */
  if (!order.refund_restored) {
    const { data: marked } = await admin.from('orders')
      .update({ refund_restored: true }).eq('id', orderId).eq('refund_restored', false).select('id').maybeSingle();
    if (marked) {
      if (order.used_coupon_id) {
        /* 쿠폰 복원 — 이미 만료됐으면 복원일+7일로 되살림, 유효하면 원래 만료일 유지 */
        const { data: uc } = await admin.from('user_coupons').select('expires_at').eq('id', order.used_coupon_id).maybeSingle();
        const patch: Record<string, unknown> = { is_used: false, used_at: null };
        const exp = uc?.expires_at ? new Date(uc.expires_at as string) : null;
        if (exp && exp.getTime() < Date.now()) { patch.expires_at = new Date(Date.now() + 7 * 86400000).toISOString(); patch.expiry_notified = false; }
        await admin.from('user_coupons').update(patch).eq('id', order.used_coupon_id);
      }
      const pointUsed = order.point_used || 0;
      /* 미입금(무통장 pending) 취소는 적립이 아직 지급된 적 없으므로 회수하지 않는다.
         (적립은 입금확인 시 지급 설계 → 지급 전 취소인데 차감하면 손님 포인트만 잃음) */
      const earned = order.status === 'pending' ? 0 : (order.earned_point || 0);
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

  /* 기록용: 어드민 환불관리에 '취소완료(자동)'로 남김 — 고객이 고른 사유를 그대로 저장(클라 중복 insert 없음).
     단, 무통장 미입금(pending, 결제 안 됨) 취소는 돌려줄 돈이 없어 환불관리에 남기지 않음. */
  if (order.status === 'paid') {
    try {
      await admin.from('refund_requests').insert({
        order_id: orderId, user_id: user.id,
        reason: reason || '고객 즉시취소', detail, type: 'cancel', status: 'completed',
      });
    } catch { /* 기록 실패는 무시 */ }
  }

  /* 주문 취소 알림톡 — 부가 작업이므로 최대 3초만 대기(솔라피 지연이 취소 응답을 막지 않도록) */
  if (order.phone) {
    const notify = notifyAlimtalk('order_cancelled', order.phone, {
      recipient: order.recipient || '',
      orderNo: order.order_no || '',
      cancelledAt: new Date().toLocaleString('ko-KR'),
      refundAmount: `${(order.final_amount || 0).toLocaleString()}원`,
    }).catch(() => { /* noop */ });
    await Promise.race([notify, new Promise(r => setTimeout(r, 3000))]);
  }

  return NextResponse.json({ ok: true, cancelled: true });
}
