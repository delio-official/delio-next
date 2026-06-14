import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServerSupabaseClient } from '@/lib/supabase-server';

/* 탈퇴 인증번호 검증 (삭제는 하지 않음) — send-otp의 HMAC 토큰과 입력 코드 대조 */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: '로그인이 필요합니다.' }, { status: 401 });

  let code = '', token = '';
  try { const b = await req.json(); code = b?.code ?? ''; token = b?.token ?? ''; } catch { /* noop */ }

  const [expStr, sig] = (token || '').split('.');
  const exp = Number(expStr);
  if (!code || !sig || !exp) return NextResponse.json({ ok: false, error: '인증번호를 입력해주세요.' }, { status: 400 });
  if (Date.now() > exp) return NextResponse.json({ ok: false, error: '인증번호가 만료되었습니다. 다시 요청해주세요.' }, { status: 400 });

  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const expect = crypto.createHmac('sha256', secret).update(`${user.id}.${code}.${exp}`).digest('hex');
  if (sig !== expect) return NextResponse.json({ ok: false, error: '인증번호가 올바르지 않습니다.' }, { status: 400 });

  return NextResponse.json({ ok: true });
}
