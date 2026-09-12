import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';

/* 쿠폰 일괄 지급 (관리자 전용) — 이미 보유(미사용)한 회원은 건너뜀.
   예전엔 브라우저가 give_coupon_to_users 함수를 직접 호출했고, 그 함수에 권한검사가 없어
   회원·비로그인도 아무 쿠폰이나 자기에게 발급할 수 있었다. 이제 서버만 호출한다. */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: '인증 필요' }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc('is_current_user_admin');
  if (!isAdmin) return NextResponse.json({ ok: false, error: '권한 없음' }, { status: 403 });

  const b = await req.json().catch(() => null);
  const couponId = typeof b?.couponId === 'string' ? b.couponId : '';
  const userIds = Array.isArray(b?.userIds) ? b.userIds.filter((x: unknown) => typeof x === 'string') as string[] : [];
  const expiresAt = typeof b?.expiresAt === 'string' && b.expiresAt ? b.expiresAt : null;
  if (!couponId || userIds.length === 0) {
    return NextResponse.json({ ok: false, error: '잘못된 요청' }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.rpc('give_coupon_to_users', {
    p_coupon_id: couponId, p_user_ids: userIds, p_expires_at: expiresAt,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, granted: Number(data) || 0 });
}
