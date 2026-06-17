import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';

/* 포트원(다날) 본인인증 결과 확인 → CI 중복/재가입 차단 → profiles 저장.
   클라이언트가 requestIdentityVerification 성공 후 identityVerificationId 를 보내면,
   서버가 포트원 API로 권위있는 결과를 재조회해 검증한다. */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: '로그인이 필요합니다.' }, { status: 401 });

  let id = '';
  try { const b = await req.json(); id = b?.identityVerificationId || ''; } catch { /* noop */ }
  if (!id) return NextResponse.json({ ok: false, error: '인증 정보가 없습니다.' }, { status: 400 });

  // 1) 포트원에서 본인인증 결과 조회
  const apiSecret = process.env.PORTONE_API_SECRET;
  const res = await fetch(`https://api.portone.io/identity-verifications/${encodeURIComponent(id)}`, {
    headers: { Authorization: `PortOne ${apiSecret}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) return NextResponse.json({ ok: false, error: '본인인증 결과 조회에 실패했습니다.' }, { status: 400 });
  const data = await res.json();
  if (data?.status !== 'VERIFIED') return NextResponse.json({ ok: false, error: '본인인증이 완료되지 않았습니다.' }, { status: 400 });

  const vc = data.verifiedCustomer || {};
  const ci: string | undefined = vc.ci;
  if (!ci) return NextResponse.json({ ok: false, error: '본인확인 정보(CI)를 가져올 수 없습니다.' }, { status: 400 });

  const admin = createAdminSupabaseClient();

  // 2) CI 중복가입 차단 — 다른 계정이 이미 이 CI로 인증됨
  const { data: dup } = await admin.from('profiles').select('id').eq('ci', ci).neq('id', user.id).maybeSingle();
  if (dup) return NextResponse.json({ ok: false, code: 'DUP', error: '이미 가입된 본인인증 정보입니다. 기존 계정으로 로그인해 주세요.' }, { status: 409 });

  // 3) 탈퇴 후 30일 재가입 제한 (withdrawn_users.ci)
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data: wd } = await admin.from('withdrawn_users')
    .select('withdrawn_at').eq('ci', ci).gte('withdrawn_at', since)
    .order('withdrawn_at', { ascending: false }).maybeSingle();
  if (wd) return NextResponse.json({ ok: false, code: 'REJOIN', error: '탈퇴 후 30일 이내에는 재가입(본인인증)이 제한됩니다.' }, { status: 409 });

  // 4) profiles 저장 (CI/DI/성별/생일/번호/인증시각)
  const gender = vc.gender === 'MALE' ? 'male' : vc.gender === 'FEMALE' ? 'female' : null;
  const update: Record<string, unknown> = { ci, di: vc.di ?? null, gender, verified_at: new Date().toISOString() };
  if (vc.birthDate) update.birth = vc.birthDate;       // YYYY-MM-DD
  if (vc.phoneNumber) update.phone = vc.phoneNumber;   // 인증된 번호로 갱신

  const { error } = await admin.from('profiles').update(update).eq('id', user.id);
  if (error) return NextResponse.json({ ok: false, error: '저장 실패: ' + error.message + ' (add_phone_verification_columns.sql 실행 여부 확인)' }, { status: 500 });

  return NextResponse.json({ ok: true });
}
