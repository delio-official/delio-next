import { createClient } from '@supabase/supabase-js';

/**
 * 서버 전용 Supabase 클라이언트 (service role).
 * RLS를 우회하므로 시스템 작업(웹훅 수신 등)에서만 사용.
 * 절대 클라이언트 번들에 노출되면 안 됨.
 */
export function createAdminSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 미설정');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
