import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';

/* 회원 포인트 지급·차감 (관리자 전용).
   예전엔 브라우저가 add_points 함수를 직접 호출했는데, 그 함수에 권한검사가 없어
   회원·비로그인도 호출할 수 있었다(자기 포인트 무제한 충전). 이제 서버만 호출한다. */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: '인증 필요' }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc('is_current_user_admin');
  if (!isAdmin) return NextResponse.json({ ok: false, error: '권한 없음' }, { status: 403 });

  const b = await req.json().catch(() => null);
  const userId = typeof b?.userId === 'string' ? b.userId : '';
  const amount = Math.trunc(Number(b?.amount));
  const desc = (typeof b?.desc === 'string' ? b.desc : '').trim().slice(0, 100) || '관리자 지급';
  if (!userId || !Number.isFinite(amount) || amount === 0) {
    return NextResponse.json({ ok: false, error: '잘못된 요청' }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  const { error } = await admin.rpc('add_points', { p_user_id: userId, p_amount: amount, p_desc: desc });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
