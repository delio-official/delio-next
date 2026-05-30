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

    // 추천인 코드 처리
    if (refCode?.trim()) {
      const code = refCode.trim().toUpperCase();
      const { data: referrer } = await supabase
        .from('profiles')
        .select('id')
        .eq('referral_code', code)
        .single();

      if (referrer) {
        await supabase.from('referrals').insert({
          referrer_id: referrer.id,
          referred_id: data.user.id,
          code,
          status: 'pending',
        });
      }
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
