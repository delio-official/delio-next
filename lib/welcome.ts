import type { SupabaseClient } from '@supabase/supabase-js';
import { notifyAlimtalk } from './sms';

/* 가입 30일이 지나면 환영 알림톡을 보내지 않는다(늦게 가면 어색하고 가입 쿠폰도 끝났을 수 있음) */
const WELCOME_WINDOW_MS = 30 * 86400000;

/** 가입 환영 알림톡 — 계정당 1회만 (welcome_sent 플래그).
   · 번호가 있으면 발송 후 표시
   · 번호가 없으면 표시하지 않고 보류 → 번호가 생기는 순간(첫 주문 완료·본인인증) 다시 호출돼 발송
     (예전엔 번호가 없어도 표시부터 해서, 번호를 받지 않는 카카오·네이버 가입자는 끝내 받지 못했다)
   · 가입 30일이 지났으면 보내지 않고 표시만
   opts.phone/name = 주문자 번호·이름 (프로필에 아직 번호가 없을 때 사용) */
export async function maybeSendWelcome(
  admin: SupabaseClient,
  userId: string,
  opts: { phone?: string | null; name?: string | null } = {},
): Promise<void> {
  const { data: prof } = await admin
    .from('profiles').select('name, phone, welcome_sent, created_at').eq('id', userId).maybeSingle();
  if (!prof || prof.welcome_sent) return;

  const phone = (prof.phone as string | null) || opts.phone?.trim() || '';
  const joined = prof.created_at ? new Date(prof.created_at as string).getTime() : Date.now();
  const withinWindow = Date.now() - joined <= WELCOME_WINDOW_MS;
  if (withinWindow && !phone) return;   // 번호 생길 때까지 보류

  // 멱등: 플래그 먼저 (여전히 false일 때만) 세팅 → 동시 요청(결제 확인·웹훅 등) 중복 발송 방지
  const { data: marked } = await admin
    .from('profiles').update({ welcome_sent: true })
    .eq('id', userId).eq('welcome_sent', false).select('id').maybeSingle();
  if (!marked || !withinWindow) return;

  try { await notifyAlimtalk('signup_coupon', phone, { recipient: (prof.name as string | null) || opts.name || '고객' }); }
  catch { /* 발송 실패는 무시 */ }
}
