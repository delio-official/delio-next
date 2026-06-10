import { createClient } from './supabase';

/** 유저 ID(UUID) 기반 고유 추천 코드 생성 */
function generateReferralCode(userId: string): string {
  const clean = userId.replace(/-/g, '').toUpperCase();
  return `DELIO-${clean.slice(0, 8)}`;
}

export async function signUp(
  email: string,
  password: string,
  name: string,
  refCode?: string,
) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });

  if (!error && data.user) {
    const myCode = generateReferralCode(data.user.id);

    // profiles 생성 (referral_code 포함)
    await supabase.from('profiles').upsert({
      id: data.user.id,
      email,
      name,
      grade: 'beginner',
      point_balance: 0,
      referral_code: myCode,
    }, { onConflict: 'id', ignoreDuplicates: true });

    // 추천인 코드 처리 — 서버 RPC로만 등록 (셀프/중복/잘못된 코드 차단, referred_id는 서버에서 auth.uid()로 확정)
    if (refCode?.trim()) {
      await supabase.rpc('register_referral', { p_code: refCode.trim() });
    }

    // 회원가입 웰컴 쿠폰팩 자동 지급 (signup_grant 쿠폰들, 멱등)
    await supabase.rpc('grant_signup_coupons');
  }

  return { data, error };
}

export async function signIn(email: string, password: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
}

/** 카카오 OAuth 로그인 (Supabase 기본 provider) */
export async function signInWithKakao(next: string = '/') {
  const supabase = createClient();
  return supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
}

/** 네이버 OAuth 로그인 (커스텀 서버 플로우) */
export function signInWithNaver(next: string = '/') {
  window.location.href = `/api/auth/naver/start?next=${encodeURIComponent(next)}`;
}

export async function getUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/** 비밀번호 재설정 메일 발송 */
export async function sendPasswordReset(email: string) {
  const supabase = createClient();
  const redirectTo = `${window.location.origin}/reset-password`;
  return supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
}

/** 새 비밀번호로 변경 (재설정 링크 진입 후) */
export async function updatePassword(newPassword: string) {
  const supabase = createClient();
  return supabase.auth.updateUser({ password: newPassword });
}
