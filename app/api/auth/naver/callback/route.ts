import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';
import { maybeSendWelcome } from '@/lib/welcome';

/* 네이버 OAuth 콜백 — 코드교환·프로필조회 후 Supabase 세션 발급(매직링크) */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  const proto = request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '');
  const host = request.headers.get('x-forwarded-host') || url.host;
  const base = `${proto}://${host}`;
  const fail = (reason: string) => NextResponse.redirect(`${base}/login?error=${reason}`);

  const cookieStore = await cookies();
  const cookieState = cookieStore.get('naver_oauth_state')?.value;
  const next = cookieStore.get('naver_oauth_next')?.value || '/';

  if (!code || !state || !cookieState || state !== cookieState) return fail('naver_state');

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail('naver_config');

  try {
    // 1) 코드 → 액세스 토큰
    const tokenUrl = `https://nid.naver.com/oauth2.0/token?grant_type=authorization_code`
      + `&client_id=${clientId}&client_secret=${clientSecret}`
      + `&code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
    const tokenRes = await fetch(tokenUrl);
    const tokenJson = await tokenRes.json();
    const accessToken = tokenJson.access_token as string | undefined;
    if (!accessToken) return fail('naver_token');

    // 2) 네이버 프로필 조회
    const meRes = await fetch('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const meJson = await meRes.json();
    const r = meJson?.response;
    const email = r?.email as string | undefined;
    const name = (r?.name || r?.nickname) as string | undefined;
    const avatar = r?.profile_image as string | undefined;
    if (!email) return fail('naver_email');

    // 3) service-role로 유저 생성 (이미 있으면 무시) — provider=naver 기록
    const admin = createAdminSupabaseClient();
    await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { name: name || email.split('@')[0], avatar_url: avatar || null },
      app_metadata: { provider: 'naver', providers: ['naver'] },
    }); // 이미 가입된 이메일이면 에러 → 그대로 진행(같은 사람)

    // 4) 매직링크 토큰 발급 → 서버에서 검증해 세션 쿠키 설정
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    const tokenHash = linkData?.properties?.hashed_token;
    if (linkErr || !tokenHash) return fail('naver_session');

    const supabase = await createServerSupabaseClient();
    const { error: otpErr } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash });
    if (otpErr) return fail('naver_session');

    // 5) 신규/기존 회원 프로비저닝 (추천코드·프로필사진·웰컴쿠폰) — 빈 값만 채움
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // 프로필 갱신은 service-role(admin)로 — 유저 세션 클라이언트는 RLS로 provider 변경이 막혀 조용히 실패할 수 있음
      const { data: prof } = await admin
        .from('profiles').select('referral_code, avatar_url, provider').eq('id', user.id).maybeSingle();
      const patch: Record<string, unknown> = {};
      if (!prof?.referral_code) {
        patch.referral_code = `DELIO-${user.id.replace(/-/g, '').toUpperCase().slice(0, 8)}`;
      }
      if (!prof?.avatar_url && avatar) patch.avatar_url = avatar;
      // 최초 가입 경로 고정(B): 이미 카카오 등으로 가입한 계정은 덮어쓰지 않음.
      // provider가 비어있거나 기본값(email)일 때만 naver로 기록.
      if (!prof?.provider || prof.provider === 'email') patch.provider = 'naver';
      if (Object.keys(patch).length) await admin.from('profiles').update(patch).eq('id', user.id);
      await supabase.rpc('grant_signup_coupons');
      await maybeSendWelcome(admin, user.id);
    }
  } catch {
    return fail('naver');
  }

  const res = NextResponse.redirect(`${base}${next}`);
  res.cookies.set('naver_oauth_state', '', { maxAge: 0, path: '/' });
  res.cookies.set('naver_oauth_next', '', { maxAge: 0, path: '/' });
  return res;
}
