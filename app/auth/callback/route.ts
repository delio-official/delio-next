import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';
import { maybeSendWelcome } from '@/lib/welcome';

/* OAuth 콜백 — 카카오 등 PKCE 코드를 세션으로 교환 후 신규회원 프로비저닝 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/';

  // Vercel 프록시 뒤에서도 올바른 도메인으로 리다이렉트
  const forwardedHost = request.headers.get('x-forwarded-host');
  const isLocal = process.env.NODE_ENV === 'development';
  const base = isLocal ? origin : (forwardedHost ? `https://${forwardedHost}` : origin);

  if (!code) return NextResponse.redirect(`${base}/login?error=oauth`);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${base}/login?error=oauth`);

  // OAuth 회원 프로비저닝 (추천코드·프로필사진·웰컴쿠폰) — 모두 멱등, 빈 값만 채움
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const meta = (user.user_metadata || {}) as Record<string, unknown>;
      const { data: prof } = await supabase
        .from('profiles')
        .select('referral_code, avatar_url')
        .eq('id', user.id)
        .maybeSingle();
      const patch: Record<string, unknown> = {};
      if (prof && !prof.referral_code) {
        patch.referral_code = `DELIO-${user.id.replace(/-/g, '').toUpperCase().slice(0, 8)}`;
      }
      // 카카오 등 소셜 프로필 사진 → avatar_url (사용자가 직접 올린 게 없을 때만)
      if (prof && !prof.avatar_url) {
        const social = (meta.avatar_url || meta.picture || meta.profile_image_url) as string | undefined;
        if (social) patch.avatar_url = social;
      }
      if (Object.keys(patch).length) {
        await supabase.from('profiles').update(patch).eq('id', user.id);
      }
      await supabase.rpc('grant_signup_coupons');
      await maybeSendWelcome(createAdminSupabaseClient(), user.id);
    }
  } catch { /* 프로비저닝 실패는 로그인 자체를 막지 않음 */ }

  return NextResponse.redirect(`${base}${next}`);
}
