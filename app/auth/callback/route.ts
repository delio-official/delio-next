import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

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

  // 신규 OAuth 회원 프로비저닝 (추천코드 부여 + 웰컴 쿠폰 지급) — 모두 멱등
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const refCode = `DELIO-${user.id.replace(/-/g, '').toUpperCase().slice(0, 8)}`;
      await supabase.from('profiles').update({ referral_code: refCode }).eq('id', user.id).is('referral_code', null);
      await supabase.rpc('grant_signup_coupons');
    }
  } catch { /* 프로비저닝 실패는 로그인 자체를 막지 않음 */ }

  return NextResponse.redirect(`${base}${next}`);
}
