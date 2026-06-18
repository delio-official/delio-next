import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';

/* 이메일 비밀번호 재설정 전 가입경로 확인 —
   카카오/네이버 등 SNS 간편로그인 계정은 델리오 비밀번호가 없으므로 메일 발송 대신 안내한다. */

const SNS_LABEL: Record<string, string> = { kakao: '카카오', naver: '네이버' };

export async function POST(req: Request) {
  let email = '';
  try { const b = await req.json(); email = (b?.email || '').trim(); } catch { /* noop */ }
  if (!email) return NextResponse.json({ ok: false, error: '이메일을 입력해주세요.' }, { status: 400 });

  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from('profiles').select('provider').ilike('email', email).limit(1).maybeSingle();

  const provider = (data?.provider || '') as string;
  if (SNS_LABEL[provider]) {
    return NextResponse.json({ ok: true, isSns: true, provider, label: SNS_LABEL[provider] });
  }
  return NextResponse.json({ ok: true, isSns: false });
}
