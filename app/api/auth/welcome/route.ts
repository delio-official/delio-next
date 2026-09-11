import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';
import { maybeSendWelcome } from '@/lib/welcome';
import { applyCouponValidity } from '@/lib/coupon-validity';

/* 가입 환영 알림톡 1회 발송 — 로그인 직후(가입 직후) 호출.
   welcome_sent 플래그로 계정당 1회만, 재로그인 시 재발송 없음. */
export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const admin = createAdminSupabaseClient();
  /* 이메일 가입: 브라우저에서 grant_signup_coupons 직후 호출됨 → 가입쿠폰 유효기간(일)을 만료일로 채움 */
  await applyCouponValidity(admin, user.id);
  await maybeSendWelcome(admin, user.id);
  return NextResponse.json({ ok: true });
}
