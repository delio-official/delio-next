import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';

/* 회원 본인 탈퇴 — 하드 삭제.
   소프트 삭제는 auth.identities 잔여로 동일 이메일 재가입(특히 네이버/카카오)을 막으므로 하드 삭제.
   주문/리뷰는 FK(set null/cascade)로 정리됨. 재가입 어뷰징 차단은 B단계(본인인증 CI).
   탈퇴 이력은 withdrawn_users 에 기록(이메일/번호 → 향후 CI 연결). */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: '로그인이 필요합니다.' }, { status: 401 });

  let reason: string | null = null;
  let code = '', token = '';
  try { const b = await req.json(); reason = b?.reason ?? null; code = b?.code ?? ''; token = b?.token ?? ''; } catch { /* body 없을 수 있음 */ }

  const admin = createAdminSupabaseClient();
  const { data: pf } = await admin.from('profiles').select('phone').eq('id', user.id).maybeSingle();
  const phone = (pf as { phone?: string | null } | null)?.phone?.trim();

  // 휴대폰 번호가 있으면 SMS 인증번호 검증 (타인에 의한 삭제 방지)
  if (phone) {
    const [expStr, sig] = (token || '').split('.');
    const exp = Number(expStr);
    if (!code || !sig || !exp) return NextResponse.json({ ok: false, error: '휴대폰 인증이 필요합니다.' }, { status: 400 });
    if (Date.now() > exp) return NextResponse.json({ ok: false, error: '인증번호가 만료되었습니다. 다시 요청해주세요.' }, { status: 400 });
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const expect = crypto.createHmac('sha256', secret).update(`${user.id}.${code}.${exp}`).digest('hex');
    if (sig !== expect) return NextResponse.json({ ok: false, error: '인증번호가 올바르지 않습니다.' }, { status: 400 });
  }

  // 탈퇴 이력 기록 (테이블/컬럼 없거나 실패해도 탈퇴 자체는 진행)
  try {
    const base = {
      user_id: user.id,
      email: user.email ?? null,
      phone: phone ?? null,
    };
    const { error: insErr } = await admin.from('withdrawn_users').insert({ ...base, reason });
    if (insErr) await admin.from('withdrawn_users').insert(base); // reason 컬럼 없으면 빼고 재시도
  } catch { /* 기록 실패는 무시 */ }

  // 하드 삭제 (재로그인·동일 이메일 재가입 모두 깔끔히 정리)
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
