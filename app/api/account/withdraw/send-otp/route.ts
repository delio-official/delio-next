import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';
import { sendSMS } from '@/lib/sms';

/* 탈퇴 본인확인용 SMS 인증번호 발송.
   상태 없는 HMAC 토큰 방식: 코드 자체는 저장하지 않고, 서명 토큰만 클라이언트에 전달.
   탈퇴 시 코드+토큰을 함께 보내 서버에서 검증. (테이블 불필요) */
function maskPhone(p: string): string {
  const d = p.replace(/[^0-9]/g, '');
  if (d.length < 7) return p;
  return `${d.slice(0, 3)}****${d.slice(-4)}`;
}

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: '로그인이 필요합니다.' }, { status: 401 });

  const admin = createAdminSupabaseClient();
  const { data: prof } = await admin.from('profiles').select('phone').eq('id', user.id).maybeSingle();
  const phone = (prof as { phone?: string | null } | null)?.phone?.trim();
  if (!phone) return NextResponse.json({ ok: false, error: '등록된 휴대폰 번호가 없습니다. 회원정보에서 번호를 등록해주세요.' }, { status: 400 });

  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const exp = Date.now() + 5 * 60 * 1000; // 5분
  const sig = crypto.createHmac('sha256', secret).update(`${user.id}.${code}.${exp}`).digest('hex');
  const token = `${exp}.${sig}`;

  await sendSMS(phone, `[델리오] 회원탈퇴 인증번호 [${code}] 입니다. (5분 내 입력)`);

  return NextResponse.json({ ok: true, token, phoneMasked: maskPhone(phone) });
}
