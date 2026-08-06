import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

/* 관리자용 — PortOne 결제의 '실제 취소 누계'를 조회한다.
   환불 승인 후 DB(partial_refund_amount)를 카드 실제 취소액과 일치시키는 데 사용(문구 추측 금지). */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: '인증 필요' }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc('is_current_user_admin');
  if (!isAdmin) return NextResponse.json({ ok: false, error: '권한 없음' }, { status: 403 });

  const apiSecret = process.env.PORTONE_API_SECRET;
  if (!apiSecret) return NextResponse.json({ ok: false, error: '포트원 시크릿 미설정' }, { status: 503 });

  const body = await req.json().catch(() => null);
  const paymentId: string | undefined = body?.paymentId;
  if (!paymentId) return NextResponse.json({ ok: false, error: 'paymentId 누락' }, { status: 400 });

  try {
    const res = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `PortOne ${apiSecret}` },
    });
    const data = await res.json().catch(() => ({}));
    const amount = (data as { amount?: { total?: number; cancelled?: number }; status?: string })?.amount || {};
    const cancelled = Number(amount.cancelled) || 0;
    const total = Number(amount.total) || 0;
    const status = String((data as { status?: string })?.status || '');
    return NextResponse.json({ ok: res.ok, cancelled, total, status });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
  }
}
