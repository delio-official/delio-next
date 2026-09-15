import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';

/* 취향 프로파일 결과 저장 — 동일 회원 재검사 시 기존 기록을 확실히 지우고 1건만 유지.
   클라이언트에서 직접 delete 하면 survey_results RLS(삭제 정책 유무 불확실)에 막혀
   조용히 실패 → 같은 회원 중복 누적 위험이 있어, 서버(service role)에서 처리한다.
   user_id는 클라이언트 값이 아니라 서버 세션에서 확정(위변조 방지). 비회원은 식별 불가라 누적. */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  let p: Record<string, unknown> = {};
  try { p = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'BAD_REQUEST' }, { status: 400 }); }

  const admin = createAdminSupabaseClient();
  const row = {
    user_id:            user?.id || null,
    gender:             (p.gender as string) ?? null,
    age_group:          (p.age_group as string) ?? null,
    family_size:        (p.family_size as string) ?? null,
    result_type:        (p.result_type as string) ?? null,
    axis1:              (p.axis1 as string) ?? null,
    axis2:              (p.axis2 as string) ?? null,
    axis3:              (p.axis3 as string) ?? null,
    purchase_frequency: (p.purchase_frequency as string) ?? null,
    purchase_purpose:   (p.purchase_purpose as string) ?? null,
    decision_factor:    (p.decision_factor as string) ?? null,
    texture_pref:       (p.texture_pref as string) ?? null,
    answers:            (p.answers as Record<string, unknown>) ?? null,
    result_category:    (p.result_category as string) ?? null,
    result_label:       (p.result_label as string) ?? null,
    result_desc:        (p.result_desc as string) ?? null,
  };

  /* 동일 회원 재검사 → 기존 기록 삭제 후 1건만 삽입(모든 지표 최신 반영) */
  if (user?.id) { await admin.from('survey_results').delete().eq('user_id', user.id); }
  const { error } = await admin.from('survey_results').insert(row);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const pointGranted = user?.id ? await grantSurveyPoint(admin, user.id) : 0;
  return NextResponse.json({ ok: true, pointGranted });
}

/* 취향 설문 완료 적립 — 로그인 회원이 처음 완료했을 때 1회 (설정 survey_point, 0이면 꺼짐)
   '받음' 표시(survey_point_at)를 먼저 조건부로 찍어 동시 요청에도 1번만 지급.
   다시 진단하거나 결과를 지워도 표시가 남아 다시 받지 못한다. 기존 완료 회원은 SQL로 미리 표시(소급 없음). */
async function grantSurveyPoint(admin: ReturnType<typeof createAdminSupabaseClient>, userId: string): Promise<number> {
  const { data: settings } = await admin.from('site_settings').select('key, value').in('key', ['survey_point', 'point_enabled']);
  const map: Record<string, string> = {};
  ((settings as { key: string; value: string }[]) || []).forEach(s => { map[s.key] = s.value; });
  const amount = Math.max(0, parseInt(map.survey_point || '0') || 0);
  if (amount <= 0 || map.point_enabled === 'false') return 0;

  const { data: marked, error } = await admin.from('profiles')
    .update({ survey_point_at: new Date().toISOString() })
    .eq('id', userId).is('survey_point_at', null).select('point_balance').maybeSingle();
  if (error || !marked) return 0;

  const { data: prof } = await admin.from('profiles').select('point_balance').eq('id', userId).single();
  await admin.from('profiles').update({ point_balance: (prof?.point_balance || 0) + amount }).eq('id', userId);
  try { await admin.from('point_logs').insert({ user_id: userId, amount, description: '취향 설문 완료 적립' }); } catch { /* 원장 기록 실패는 무시 */ }
  return amount;
}
