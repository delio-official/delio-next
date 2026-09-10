import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';
import { confirmVbankPaidOrders, VBANK_PAID_STATUSES } from '@/lib/vbank-paid';

/* 무통장 입금확인 (관리자 전용, 멱등) — 상태전환·결제일·등급별 구매 적립. 공용 로직은 lib/vbank-paid */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: '인증 필요' }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc('is_current_user_admin');
  if (!isAdmin) return NextResponse.json({ ok: false, error: '권한 없음' }, { status: 403 });

  let orderIds: string[] = [];
  let status = '';
  try {
    const b = await req.json();
    orderIds = Array.isArray(b?.orderIds) ? b.orderIds.filter((x: unknown) => typeof x === 'string') : [];
    status = typeof b?.status === 'string' ? b.status : '';
  } catch { /* noop */ }
  if (orderIds.length === 0 || !VBANK_PAID_STATUSES.includes(status)) {
    return NextResponse.json({ ok: false, error: '잘못된 요청' }, { status: 400 });
  }

  const granted = await confirmVbankPaidOrders(createAdminSupabaseClient(), orderIds, status);
  return NextResponse.json({ ok: true, granted });
}
