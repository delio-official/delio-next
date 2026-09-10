import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';
import { cancelScheduledSms } from '@/lib/sms-cancel';

/* 예약 문자 취소 (관리자 전용) — 공용 로직은 lib/sms-cancel */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc('is_current_user_admin');
  if (!isAdmin) return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });

  let logId = '';
  try { logId = (await req.json())?.logId || ''; } catch { /* noop */ }
  if (!logId) return NextResponse.json({ ok: false, error: 'logId 누락' }, { status: 400 });

  const result = await cancelScheduledSms(createAdminSupabaseClient(), logId);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
