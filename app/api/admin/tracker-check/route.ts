import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';
import { getTrackerToken } from '@/lib/tracker';

export const dynamic = 'force-dynamic';

/* 배송추적 연동 만료 알림 즉시 재확인 (관리자 전용).
   알림(site_settings.tracker_alert)은 하루 4번 크론이 갱신해서, 자격증명을 새로 넣고 재배포해도
   다음 크론 전까지 알림이 남아 있었다. 알림이 떠 있을 때 대시보드가 이 API를 불러 지금 바로 확인한다.
   정상이면 알림을 내리고, 여전히 실패면 그대로 둔다. */
export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc('is_current_user_admin');
  if (!isAdmin) return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });

  const admin = createAdminSupabaseClient();
  const { data: row } = await admin.from('site_settings').select('value').eq('key', 'tracker_alert').maybeSingle();
  if (!row?.value) return NextResponse.json({ ok: true, alert: false });

  try {
    await getTrackerToken();
    await admin.from('site_settings').upsert({ key: 'tracker_alert', value: '' }, { onConflict: 'key' });
    return NextResponse.json({ ok: true, alert: false, cleared: true });
  } catch {
    return NextResponse.json({ ok: true, alert: true });
  }
}
