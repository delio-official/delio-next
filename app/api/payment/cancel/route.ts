import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

/* 포트원 V2 결제 취소(환불) — 관리자 환불 승인 시 호출.
   중요: '취소 실패'를 응답 문구로 추측해서 성공 처리하지 않는다(카드 미취소인데 DB만 환불완료되는 사고 방지).
   실패 시 PortOne에서 결제를 '조회'해 실제 취소 상태/금액을 확인한 뒤에만 성공으로 처리한다. */
export async function POST(req: NextRequest) {
  /* 관리자 인증 — 임의 결제취소 방지 */
  const sb = await createServerSupabaseClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const { data: isAdmin } = await sb.rpc('is_current_user_admin');
  if (!isAdmin) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });

  const apiSecret = process.env.PORTONE_API_SECRET;
  if (!apiSecret) {
    return NextResponse.json({ error: '포트원 API 시크릿 미설정' }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const paymentId: string | undefined = body?.paymentId;
  const reason: string = body?.reason || '관리자 환불';
  // amount 생략 = 전액 취소. 부분 취소 필요 시 body.amount 전달
  const amount: number | undefined = body?.amount;

  if (!paymentId) {
    return NextResponse.json({ error: 'paymentId 누락' }, { status: 400 });
  }

  const auth = { Authorization: `PortOne ${apiSecret}` };

  const res = await fetch(
    `https://api.portone.io/payments/${encodeURIComponent(paymentId)}/cancel`,
    {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      // 관리자 취소/환불 → 요청자 = ADMIN(가맹점 관리자) → Npay cancelRequester=2
      body: JSON.stringify({ reason, requester: 'ADMIN', ...(amount != null ? { amount } : {}) }),
    }
  );

  const data = await res.json().catch(() => ({}));
  if (res.ok) {
    return NextResponse.json({ ok: true, cancellation: data.cancellation ?? data });
  }

  /* 취소 요청 실패 → PortOne 결제 조회로 '실제 취소 여부'를 검증한다(문구 추측 금지).
     - 전액취소 요청: 결제가 실제로 완전 취소(CANCELLED / 취소누계≥결제총액) 상태여야 성공.
     - 부분취소 요청: 취소누계가 요청액 이상이면 이미 반영된 것으로 보고 성공(멱등). */
  let verified: { status?: string; amount?: { total?: number; cancelled?: number } } | null = null;
  try {
    const vRes = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}`, { headers: auth });
    verified = await vRes.json().catch(() => null);
  } catch { /* 조회 실패 시 verified=null → 아래에서 실패 처리 */ }

  const total = Number(verified?.amount?.total) || 0;
  const cancelled = Number(verified?.amount?.cancelled) || 0;
  const st = String(verified?.status || '');

  if (amount == null) {
    // 전액취소 요청: 정말로 완전 취소된 상태일 때만 성공
    const fully = st === 'CANCELLED' || (total > 0 && cancelled >= total);
    if (fully) return NextResponse.json({ ok: true, alreadyCancelled: true, cancelled, total });
    return NextResponse.json({
      error: '카드 취소가 실제로 완료되지 않았습니다. (PG 상태 확인 필요)',
      detail: data, verified: { status: st, cancelled, total },
    }, { status: 502 });
  }
  // 부분취소 요청: 취소누계가 요청액 이상이면 성공으로 인정
  if (cancelled >= amount) return NextResponse.json({ ok: true, alreadyCancelled: true, cancelled, total });
  return NextResponse.json({
    error: '카드 부분취소가 실제로 완료되지 않았습니다. (PG 상태 확인 필요)',
    detail: data, verified: { status: st, cancelled, total },
  }, { status: 502 });
}
