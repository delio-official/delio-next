import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';

/* 회원가입 전 본인인증 사전검사 — 로그인 세션 없이 CI 중복/재가입만 검사(저장은 하지 않음).
   가입 플로우: PASS 인증 → 이 precheck로 중복 차단 → 통과 시에만 계정 생성 → confirm 으로 CI 저장.
   CI 자체는 응답에 노출하지 않는다(서버 내부 검사만). */
export async function POST(req: Request) {
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

  const ci: string | undefined = data.verifiedCustomer?.ci;
  if (!ci) return NextResponse.json({ ok: false, error: '본인확인 정보(CI)를 가져올 수 없습니다.' }, { status: 400 });

  const admin = createAdminSupabaseClient();

  // 2) CI 중복가입 차단 — 이미 이 CI로 가입한 계정이 있으면 가입 불가
  const { data: dup } = await admin.from('profiles').select('id').eq('ci', ci).maybeSingle();
  if (dup) return NextResponse.json({ ok: false, code: 'DUP', error: '이미 가입된 본인인증 정보입니다. 기존 계정으로 로그인해 주세요.' }, { status: 409 });

  // 3) 탈퇴 후 30일 재가입 제한
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data: wd } = await admin.from('withdrawn_users')
    .select('withdrawn_at').eq('ci', ci).gte('withdrawn_at', since).maybeSingle();
  if (wd) return NextResponse.json({ ok: false, code: 'REJOIN', error: '탈퇴 후 30일 이내에는 재가입(본인인증)이 제한됩니다.' }, { status: 409 });

  return NextResponse.json({ ok: true });
}
