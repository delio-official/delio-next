import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';
import { maybeSendWelcome } from '@/lib/welcome';

/* 가입 환영 알림톡 1회 발송 — 로그인 직후(가입 직후) 호출.
   welcome_sent 플래그로 계정당 1회만, 재로그인 시 재발송 없음. */
export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  await maybeSendWelcome(createAdminSupabaseClient(), user.id);
  return NextResponse.json({ ok: true });
}
