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
      grade: 'normal',
      point_balance: 0,
      referral_code: myCode,
    }, { onConflict: 'id', ignoreDuplicates: true });

    // 추천인 코드 처리 — 서버 RPC로만 등록 (셀프/중복/잘못된 코드 차단, referred_id는 서버에서 auth.uid()로 확정)
    if (refCode?.trim()) {
      await supabase.rpc('register_referral', { p_code: refCode.trim() });
    }
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

export async function getUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
