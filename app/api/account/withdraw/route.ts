import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';

/* 회원 본인 탈퇴 — 소프트 삭제(재로그인·동일 이메일 재가입 차단).
   주문/리뷰 기록은 FK 보존 위해 남기고, 개인정보는 최소화.
   탈퇴 이력을 withdrawn_users 에 기록(재가입 어뷰징 방어 데이터). */
export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: '로그인이 필요합니다.' }, { status: 401 });

  try {
    const admin = createAdminSupabaseClient();

    // 번호 확보(있으면) → 탈퇴 이력 기록
    const { data: prof } = await admin.from('profiles').select('phone').eq('id', user.id).maybeSingle();
    await admin.from('withdrawn_users').insert({
      user_id: user.id,
      email: user.email ?? null,
      phone: (prof as { phone?: string | null } | null)?.phone ?? null,
    });

    // 개인정보 최소화
    await admin.from('profiles')
      .update({ name: '탈퇴회원', phone: null, birth: null, marketing_email: false, marketing_sms: false, push_enabled: false })
      .eq('id', user.id);

    // auth 유저 소프트 삭제(= 재로그인 불가, 동일 이메일 재가입 차단). 2번째 인자 true = shouldSoftDelete
    const { error } = await admin.auth.admin.deleteUser(user.id, true);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
