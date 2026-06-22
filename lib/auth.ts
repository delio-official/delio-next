import { createClient } from './supabase';
import { clearCart } from './cart';

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
  phone?: string,
  marketingSms?: boolean,
  marketingEmail?: boolean,
) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });

  if (!error && data.user) {
    const myCode = generateReferralCode(data.user.id);

    // profiles 생성 (referral_code·연락처 포함)
    await supabase.from('profiles').upsert({
      id: data.user.id,
      email,
      name,
      phone: phone?.trim() || null,
      grade: 'beginner',
      point_balance: 0,
      referral_code: myCode,
      marketing_sms: !!marketingSms,
      marketing_email: !!marketingEmail,
    }, { onConflict: 'id', ignoreDuplicates: true });

    // 추천인 코드 처리 — 서버 RPC로만 등록 (셀프/중복/잘못된 코드 차단, referred_id는 서버에서 auth.uid()로 확정)
    if (refCode?.trim()) {
      await supabase.rpc('register_referral', { p_code: refCode.trim() });
    }

    // 회원가입 웰컴 쿠폰팩 자동 지급 (signup_grant 쿠폰들, 멱등)
    await supabase.rpc('grant_signup_coupons');
    // 가입 환영 알림톡은 세션 확보(아래 자동로그인) 후 /api/auth/welcome 에서 1회 발송
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
  try { clearCart(); } catch { /* localStorage 없을 때 무시 */ } // 로그아웃 시 장바구니 비우기
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
