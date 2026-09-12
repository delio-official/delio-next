import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';

/* 친구추천 보상 철회 (관리자 전용) — 미사용 쿠폰 회수 + 발급이력 삭제 + 추천 상태 초기화.
   예전엔 브라우저가 revoke_referral_reward 함수를 직접 호출했고 권한검사가 없었다. 이제 서버만 호출한다. */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: '인증 필요' }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc('is_current_user_admin');
  if (!isAdmin) return NextResponse.json({ ok: false, error: '권한 없음' }, { status: 403 });

  const b = await req.json().catch(() => null);
  const referralId = typeof b?.referralId === 'string' ? b.referralId : '';
  if (!referralId) return NextResponse.json({ ok: false, error: '잘못된 요청' }, { status: 400 });

  const admin = createAdminSupabaseClient();
  const { error } = await admin.rpc('revoke_referral_reward', { p_referral_id: referralId });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
