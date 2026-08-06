import { NextRequest, NextResponse } from 'next/server';

/* 포트원 V2 결제 취소(환불) — 관리자 환불 승인 시 호출 */
export async function POST(req: NextRequest) {
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

  const res = await fetch(
    `https://api.portone.io/payments/${encodeURIComponent(paymentId)}/cancel`,
    {
      method: 'POST',
      headers: {
        Authorization: `PortOne ${apiSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reason,
        ...(amount != null ? { amount } : {}),
      }),
    }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    /* 이미 취소된 결제 = 목표(취소) 이미 달성 → 성공으로 처리해 DB 동기화 진행.
       PG마다 '이미 취소' 응답 형태가 달라 모두 잡아야 함:
       - 포트원 표준: type === 'PAYMENT_ALREADY_CANCELLED' (예: 카카오페이)
       - 이니시스: pgCode 500626 / '기 취소 거래'
       - 기타: pgCode -784 / 'can not request cancel (status: CANCEL_PAYMENT)' 등 이미 취소상태 */
    const pgMsg = typeof data?.pgMessage === 'string' ? data.pgMessage : '';
    const pgCode = String(data?.pgCode ?? '');
    const alreadyCancelled =
      data?.type === 'PAYMENT_ALREADY_CANCELLED' ||
      pgCode === '500626' || pgCode === '-784' ||
      /기\s*취소|이미\s*취소|이미\s*환불|CANCEL_?PAYMENT|can\s*not\s*request\s*cancel|already\s*cancel/i.test(pgMsg);
    if (alreadyCancelled) {
      return NextResponse.json({ ok: true, alreadyCancelled: true });
    }
    return NextResponse.json({ error: '포트원 취소 실패', detail: data }, { status: 502 });
  }
  return NextResponse.json({ ok: true, cancellation: data.cancellation ?? data });
}
