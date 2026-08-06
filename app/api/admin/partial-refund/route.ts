import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';

/* 관리자 직접 부분환불 — 고객 환불신청 없이 주문관리에서 하자분만 부분취소.
   1) 포트원 부분취소(amount) → 카드로 하자분만 환불
   2) refund_requests에 완료 기록(정산/이력 반영)
   3) orders.partial_refund_amount 누적. 주문 상태는 유지(구매확정 등).
   쿠폰·포인트는 복구하지 않음(대부분 결제 유지되므로). */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: '인증 필요' }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc('is_current_user_admin');
  if (!isAdmin) return NextResponse.json({ ok: false, error: '권한 없음' }, { status: 403 });

  let body: {
    orderId?: string;
    refundItems?: { name: string; total: number; defective: number; refund: number }[];
    refundAmount?: number;
    reason?: string;
  } | null = null;
  try { body = await req.json(); } catch { /* noop */ }
  const orderId = body?.orderId || '';
  const refundItems = Array.isArray(body?.refundItems) ? body!.refundItems : [];
  const refundAmount = Math.max(0, Math.round(Number(body?.refundAmount) || 0));
  const reason = (body?.reason || '관리자 부분환불').slice(0, 200);
  if (!orderId || refundAmount <= 0) return NextResponse.json({ ok: false, error: '주문/금액 누락' }, { status: 400 });

  const admin = createAdminSupabaseClient();
  const { data: order } = await admin
    .from('orders')
    .select('id, user_id, final_amount, partial_refund_amount, portone_payment_id, status')
    .eq('id', orderId).maybeSingle();
  if (!order) return NextResponse.json({ ok: false, error: '주문 없음' }, { status: 404 });

  /* 이미 전액 환불/취소된 주문이면 부분환불 불가 (중복·데이터 꼬임 방지) */
  if (['refunded', 'cancelled'].includes(order.status)) {
    return NextResponse.json({ ok: false, error: '이미 환불/취소된 주문이라 부분환불할 수 없습니다.' }, { status: 400 });
  }
  const already = order.partial_refund_amount || 0;
  const remaining = (order.final_amount || 0) - already;
  if (refundAmount > remaining) {
    return NextResponse.json({ ok: false, error: `부분환불 가능액(${remaining.toLocaleString()}원)을 초과했습니다.` }, { status: 400 });
  }
  /* 처음부터 전액을 부분환불로 넣는 건 차단 — 그건 쿠폰·포인트 복원이 되는 '전액환불'을 써야 함.
     단, 이미 부분환불한 내역이 있으면(already>0) 나머지를 마저 환불하는 건 허용(2→6→나머지 식). */
  if (already === 0 && refundAmount >= (order.final_amount || 0)) {
    return NextResponse.json({ ok: false, error: `전액에 해당합니다. 부분환불이 아니라 '전액환불'(주문 상세 → 환불)을 사용하세요.` }, { status: 400 });
  }

  /* 1) 포트원 부분취소 (결제ID 있을 때만; 무통장 등은 카드취소 없이 기록만) */
  let pgCancelled = false;
  if (order.portone_payment_id) {
    const apiSecret = process.env.PORTONE_API_SECRET;
    if (!apiSecret) return NextResponse.json({ ok: false, error: '포트원 시크릿 미설정' }, { status: 503 });
    const res = await fetch(`https://api.portone.io/payments/${encodeURIComponent(order.portone_payment_id)}/cancel`, {
      method: 'POST',
      headers: { Authorization: `PortOne ${apiSecret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, amount: refundAmount }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      /* 이미 PG에서 취소된 건도 성공 처리(카카오페이=PAYMENT_ALREADY_CANCELLED / 이니시스=기 취소 거래 500626) */
      const pgMsg = typeof (data as { pgMessage?: string })?.pgMessage === 'string' ? (data as { pgMessage: string }).pgMessage : '';
      const pgCode = String((data as { pgCode?: string })?.pgCode ?? '');
      const alreadyCancelled =
        (data as { type?: string })?.type === 'PAYMENT_ALREADY_CANCELLED' ||
        pgCode === '500626' || pgCode === '-784' ||
        /기\s*취소|이미\s*취소|이미\s*환불|CANCEL_?PAYMENT|can\s*not\s*request\s*cancel|already\s*cancel/i.test(pgMsg);
      if (!alreadyCancelled) return NextResponse.json({ ok: false, error: '포트원 취소 실패', detail: data }, { status: 502 });
    }
    pgCancelled = true;
  }

  /* 반영 금액은 PortOne의 '실제 취소 총액'을 진실로 삼는다 — 요청액과 실제 취소액이 어긋나도(레이스·중복호출·부분실패)
     DB의 partial_refund_amount가 항상 카드 실제 취소와 일치하게. (결제ID 없는 무통장 등은 요청액 기준) */
  let newTotal = already + refundAmount;
  if (order.portone_payment_id && process.env.PORTONE_API_SECRET) {
    try {
      const pRes = await fetch(`https://api.portone.io/payments/${encodeURIComponent(order.portone_payment_id)}`, {
        headers: { Authorization: `PortOne ${process.env.PORTONE_API_SECRET}` },
      });
      const pData = await pRes.json().catch(() => ({}));
      const c = (pData as { amount?: { cancelled?: number } })?.amount?.cancelled;
      if (typeof c === 'number' && c > 0) newTotal = c;
    } catch { /* 조회 실패 시 요청액 기준 유지 */ }
  }
  const fullyRefunded = newTotal >= (order.final_amount || 0);
  const actualThis = Math.max(0, newTotal - already);   // 이번에 실제로 취소된 금액

  /* 2) 부분환불액 누적을 '먼저' 반영 — PG는 이미 취소됨이라 한도 보호가 최우선(이중환불 방지).
     누적이 전액에 도달하면 주문을 refunded로 전환(활성/유효주문에서 제외). */
  await admin.from('orders').update({
    partial_refund_amount: newTotal,
    ...(fullyRefunded ? { status: 'refunded' } : {}),
  }).eq('id', orderId);

  /* 3) 환불 요청을 '완료'로 기록 (정산 하자분 차감·이력 노출용).
     여기서 실패해도 위 금액은 이미 반영됐으므로 카드 이중취소는 발생하지 않음 → 경고만 반환. */
  const { error: insErr } = await admin.from('refund_requests').insert({
    order_id: orderId,
    user_id: order.user_id,
    type: 'refund',
    status: 'completed',
    reason,
    refund_items: refundItems,
    refund_amount: actualThis,   // 실제 취소된 금액으로 기록(요청액과 어긋나도 카드와 일치)
    resend_amount: null,
    resend_status: 'none',
  });
  if (insErr) {
    return NextResponse.json({ ok: true, pgCancelled, refundAmount: actualThis, fullyRefunded, warning: '카드 부분취소·금액반영은 완료됐으나 환불 이력 기록에 실패했습니다: ' + insErr.message });
  }

  return NextResponse.json({ ok: true, pgCancelled, refundAmount: actualThis, fullyRefunded });
}
