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
  return NextResponse.json({ ok: true });
}
