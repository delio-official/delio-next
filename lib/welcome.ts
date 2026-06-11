import type { SupabaseClient } from '@supabase/supabase-js';
import { notifyAlimtalk } from './sms';

/** 가입 환영 알림톡 — 계정당 1회만 (welcome_sent 플래그).
   전화번호가 없어도 플래그는 세팅해 재로그인 시 다시 시도하지 않음. */
export async function maybeSendWelcome(admin: SupabaseClient, userId: string): Promise<void> {
  const { data: prof } = await admin
    .from('profiles').select('name, phone, welcome_sent').eq('id', userId).maybeSingle();
  if (!prof || prof.welcome_sent) return;

  // 멱등: 플래그 먼저 (여전히 false일 때만) 세팅 → 동시 요청 방지
  const { data: marked } = await admin
    .from('profiles').update({ welcome_sent: true })
    .eq('id', userId).eq('welcome_sent', false).select('id').maybeSingle();
  if (!marked) return;

  if (prof.phone) {
    try { await notifyAlimtalk('signup_coupon', prof.phone, { recipient: prof.name || '고객' }); }
    catch { /* 발송 실패는 무시 */ }
  }
}
