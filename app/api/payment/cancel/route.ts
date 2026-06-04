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
    return NextResponse.json({ error: '포트원 취소 실패', detail: data }, { status: 502 });
  }
  return NextResponse.json({ ok: true, cancellation: data.cancellation ?? data });
}
