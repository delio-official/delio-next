import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';

/* 관리자 직접 부분환불 — 고객 환불신청 없이 주문관리에서 하자분만 부분취소.
   설계 원칙(실결제 = 진실):
   - 클라이언트는 '목표 누적 환불액(targetAmount)'을 보낸다(예: 10알 중 4알까지 = 13,520원).
   - 라우트는 PortOne '실제 취소 누계'를 조회해, (목표 - 실제)만큼만 이번에 취소한다.
     → 이전 취소 상황과 무관하게 항상 정확한 차액만 카드취소, 초과·중복취소 불가.
   - 취소 후 PortOne을 다시 조회해 '실제로 늘었는지' 확인하고, 그 실제값을 DB에 반영한다.
     실제 취소가 확인되지 않으면 절대 기록/반영하지 않는다(카드 미취소인데 DB만 환불완료 방지).
   호환: 구버전 클라이언트가 refundAmount(증분)만 보내면 targetAmount = already + refundAmount 로 해석. */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: '인증 필요' }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc('is_current_user_admin');
  if (!isAdmin) return NextResponse.json({ ok: false, error: '권한 없음' }, { status: 403 });

  let body: {
    orderId?: string;
    refundItems?: { name: string; total: number; defective: number; refund: number }[];
    refundAmount?: number;   // (구버전) 이번 증분
    targetAmount?: number;   // (신버전) 목표 누적 환불액
    reason?: string;
  } | null = null;
  try { body = await req.json(); } catch { /* noop */ }
  const orderId = body?.orderId || '';
  const refundItems = Array.isArray(body?.refundItems) ? body!.refundItems : [];
  const reqRefundAmount = Math.max(0, Math.round(Number(body?.refundAmount) || 0));
  const reqTargetAmount = body?.targetAmount != null ? Math.max(0, Math.round(Number(body.targetAmount))) : null;
  const reason = (body?.reason || '관리자 부분환불').slice(0, 200);
  if (!orderId) return NextResponse.json({ ok: false, error: '주문 누락' }, { status: 400 });

  const admin = createAdminSupabaseClient();
  const { data: order } = await admin
    .from('orders')
    .select('id, user_id, final_amount, partial_refund_amount, portone_payment_id, status')
    .eq('id', orderId).maybeSingle();
  if (!order) return NextResponse.json({ ok: false, error: '주문 없음' }, { status: 404 });
  if (['refunded', 'cancelled'].includes(order.status)) {
    return NextResponse.json({ ok: false, error: '이미 환불/취소된 주문이라 부분환불할 수 없습니다.' }, { status: 400 });
  }

  const final = order.final_amount || 0;
  const pid = order.portone_payment_id;
  const apiSecret = process.env.PORTONE_API_SECRET;
  const auth = { Authorization: `PortOne ${apiSecret}` };

  /* 실제 취소 누계 조회 헬퍼 — PortOne을 진실로 삼는다. */
  async function fetchCancelled(): Promise<number | null> {
    if (!pid || !apiSecret) return null;
    try {
      const r = await fetch(`https://api.portone.io/payments/${encodeURIComponent(pid)}`, { headers: auth });
      const d = await r.json().catch(() => ({}));
      const c = (d as { amount?: { cancelled?: number } })?.amount?.cancelled;
      return typeof c === 'number' ? c : null;
    } catch { return null; }
  }

  /* 기준 취소누계(already): 카드결제는 PortOne 실제값, 아니면 DB값. */
  const dbAlready = order.partial_refund_amount || 0;
  let already = dbAlready;
  if (pid) {
    if (!apiSecret) return NextResponse.json({ ok: false, error: '포트원 시크릿 미설정' }, { status: 503 });
    const actualBefore = await fetchCancelled();
    if (actualBefore == null) return NextResponse.json({ ok: false, error: 'PG 상태 조회 실패. 잠시 후 다시 시도하세요.' }, { status: 502 });
    already = actualBefore;   // 카드 실제 취소 누계를 기준으로
  }

  /* 목표 누적액 결정: 신버전 targetAmount 우선, 없으면 already + 증분. 결제액 상한으로 클램프. */
  const target = Math.min(final, reqTargetAmount != null ? reqTargetAmount : already + reqRefundAmount);
  const delta = target - already;   // 이번에 추가로 취소할 금액
  if (target <= 0 || delta <= 0) {
    return NextResponse.json({ ok: false, error: '추가로 환불할 금액이 없습니다. (이미 목표까지 환불됨)' }, { status: 400 });
  }
  /* 처음부터 전액을 부분환불로 넣는 건 차단 — 쿠폰·포인트 복원되는 '전액환불'을 쓰게. (이미 부분환불 이력 있으면 마무리 허용) */
  if (already === 0 && target >= final) {
    return NextResponse.json({ ok: false, error: `전액에 해당합니다. 부분환불이 아니라 '전액환불'(주문 상세 → 환불)을 사용하세요.` }, { status: 400 });
  }

  /* 카드 부분취소 — 딱 delta 만큼만. 성공/실패는 이어지는 재조회로 '실제 반영'을 확인한다(문구 추측 금지). */
  let pgErr: unknown = null;
  if (pid) {
    const res = await fetch(`https://api.portone.io/payments/${encodeURIComponent(pid)}/cancel`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, amount: delta }),
    });
    if (!res.ok) pgErr = await res.json().catch(() => ({}));
  }

  /* 반영값 = 취소 후 PortOne 실제 취소 누계. 실제로 늘지 않았으면 카드 미취소 → 실패(기록/반영 안 함). */
  let newTotal: number;
  if (pid) {
    const actualAfter = await fetchCancelled();
    if (actualAfter == null) {
      return NextResponse.json({ ok: false, error: '카드 취소 결과 확인 실패. PG 상태를 확인하세요.', detail: pgErr }, { status: 502 });
    }
    if (actualAfter <= already) {
      return NextResponse.json({ ok: false, error: '카드가 실제로 취소되지 않았습니다. (PG 상태 확인 필요)', detail: { already, target, delta, portoneAfter: actualAfter, pgError: pgErr } }, { status: 502 });
    }
    newTotal = actualAfter;
  } else {
    newTotal = target;   // 무통장 등 카드 없음
  }

  const fullyRefunded = newTotal >= final;
  const actualThis = Math.max(0, newTotal - already);

  await admin.from('orders').update({
    partial_refund_amount: newTotal,
    ...(fullyRefunded ? { status: 'refunded' } : {}),
  }).eq('id', orderId);

  const { error: insErr } = await admin.from('refund_requests').insert({
    order_id: orderId,
    user_id: order.user_id,
    type: 'refund',
    status: 'completed',
    reason,
    refund_items: refundItems,
    refund_amount: actualThis,   // 실제 취소된 금액
    resend_amount: null,
    resend_status: 'none',
  });
  if (insErr) {
    return NextResponse.json({ ok: true, pgCancelled: !!pid, refundAmount: actualThis, newTotal, fullyRefunded, warning: '카드 부분취소·금액반영은 완료됐으나 이력 기록 실패: ' + insErr.message });
  }
  return NextResponse.json({ ok: true, pgCancelled: !!pid, refundAmount: actualThis, newTotal, fullyRefunded });
}
