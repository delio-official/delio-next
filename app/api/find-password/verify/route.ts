import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';

/* 휴대폰 본인인증으로 비밀번호 재설정 — 1단계.
   포트원(다날) 본인인증 결과를 서버에서 재조회 → CI로 가입계정 확인 →
   Supabase 복구(recovery) 토큰을 발급해 클라이언트에 전달.
   클라이언트는 이 토큰으로 복구 세션을 만든 뒤 /reset-password 에서 새 비번을 설정한다. */

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}${'*'.repeat(Math.max(2, local.length - head.length))}@${domain}`;
}

export async function POST(req: Request) {
  let id = '';
  try { const b = await req.json(); id = b?.identityVerificationId || ''; } catch { /* noop */ }
  if (!id) return NextResponse.json({ ok: false, error: '인증 정보가 없습니다.' }, { status: 400 });

  // 1) 포트원에서 본인인증 결과 재조회
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

  // 2) CI로 가입 계정 조회
  const { data: prof } = await admin
    .from('profiles').select('email').eq('ci', ci).limit(1).maybeSingle();
  if (!prof?.email) {
    return NextResponse.json({ ok: false, code: 'NOT_FOUND',
      error: '본인인증 정보로 가입된 계정을 찾을 수 없습니다.\n(가입 시 본인인증을 하지 않은 계정은 이메일 링크로 찾아주세요.)' }, { status: 404 });
  }

  // 3) 복구(recovery) 토큰 발급 → 클라이언트가 복구 세션 생성에 사용
  const { data: link, error } = await admin.auth.admin.generateLink({ type: 'recovery', email: prof.email });
  const tokenHash = link?.properties?.hashed_token;
  if (error || !tokenHash) {
    return NextResponse.json({ ok: false, error: '재설정 준비에 실패했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tokenHash, email: maskEmail(prof.email) });
}
