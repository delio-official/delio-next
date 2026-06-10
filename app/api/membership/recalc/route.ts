import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { recalcAllGrades } from '@/lib/membership-server';

/* 어드민 전용 — 전체 회원 등급 즉시 재산정 (분기 누적 기준, 잠금 제외) */
export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: isAdmin } = await supabase.rpc('is_current_user_admin');
  if (!isAdmin) return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 403 });

  try {
    const { updated } = await recalcAllGrades();
    return NextResponse.json({ ok: true, updated });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
