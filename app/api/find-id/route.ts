import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';

/* 아이디(이메일) 찾기 — 이름 + 휴대폰번호로 가입 이메일을 마스킹해서 반환.
   이메일 전체 노출은 보안상 위험하므로 일부만 보여준다. */

/** 숫자만 추출 + 국가코드(+82) → 0 정규화 */
function normPhone(v: string): string {
  let d = (v || '').replace(/\D/g, '');
  if (d.startsWith('82')) d = '0' + d.slice(2);
  return d;
}

/** 이메일 마스킹: ab***@gmail.com */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}${'*'.repeat(Math.max(2, local.length - head.length))}@${domain}`;
}

export async function POST(req: Request) {
  let name = '', phone = '';
  try {
    const b = await req.json();
    name = (b?.name || '').trim();
    phone = (b?.phone || '').trim();
  } catch { /* noop */ }

  if (!name || !phone) {
    return NextResponse.json({ ok: false, error: '이름과 휴대폰 번호를 모두 입력해주세요.' }, { status: 400 });
  }

  const target = normPhone(phone);
  if (target.length < 10) {
    return NextResponse.json({ ok: false, error: '휴대폰 번호를 정확히 입력해주세요.' }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('profiles')
    .select('email, phone, provider')
    .eq('name', name)
    .limit(50);

  if (error) {
    return NextResponse.json({ ok: false, error: '조회 중 오류가 발생했습니다.' }, { status: 500 });
  }

  const SNS_LABEL: Record<string, string> = { kakao: '카카오', naver: '네이버' };

  // 저장된 번호 형식이 제각각일 수 있어 숫자 정규화 후 비교
  const seen = new Set<string>();
  const results = (data || [])
    .filter(r => r.email && normPhone(r.phone || '') === target)
    .filter(r => { const e = r.email as string; if (seen.has(e)) return false; seen.add(e); return true; })
    .map(r => ({
      email: maskEmail(r.email as string),
      snsLabel: SNS_LABEL[(r.provider || '') as string] || null,
    }));

  if (results.length === 0) {
    return NextResponse.json({ ok: false, code: 'NOT_FOUND', error: '일치하는 가입 정보가 없습니다.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, results });
}
