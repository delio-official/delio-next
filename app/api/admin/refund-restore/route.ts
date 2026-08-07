import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';
import { restoreOrderCouponPoint } from '@/lib/refund-restore';

/* 취소/환불 승인 시 사용한 쿠폰·포인트·재고 복원 (관리자 전용, 멱등) — 공용 로직은 lib/refund-restore */
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
  const result = await restoreOrderCouponPoint(admin, orderId);
  return NextResponse.json(result, { status: result.ok ? 200 : 404 });
}
