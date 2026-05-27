import { createClient } from './supabase';

export async function signUp(email: string, password: string, name: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });

  // 가입 성공 시 profiles 테이블에도 즉시 생성
  if (!error && data.user) {
    await supabase.from('profiles').upsert({
      id: data.user.id,
      email,
      name,
      grade: 'normal',
      point_balance: 0,
    }, { onConflict: 'id', ignoreDuplicates: true });
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
