import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';

/* 리뷰 판매자 답변 — 관리자 전용.
   reviews 의 UPDATE 정책이 "본인 리뷰만"(auth.uid() = user_id)이라
   관리자가 브라우저에서 남의 리뷰에 답변을 달면 RLS에 막혀 0행 갱신 = 조용히 실패했다.
   (실제로 전체 리뷰 중 답변이 하나도 저장돼 있지 않았음)
   RLS를 푸는 대신(관리자가 남의 리뷰 본문까지 고칠 수 있게 되므로) 서버에서
   관리자를 확인하고 seller_reply 필드만 갱신한다. */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });

  let reviewId = '', reply = '';
  try {
    const body = await req.json();
    reviewId = body?.reviewId || '';
    reply    = typeof body?.reply === 'string' ? body.reply : '';
  } catch { /* noop */ }
  if (!reviewId) return NextResponse.json({ ok: false, error: 'BAD_REQUEST' }, { status: 400 });

  const admin = createAdminSupabaseClient();

  const { data: me } = await admin.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (me?.is_admin !== true) return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });

  const text = reply.trim();
  const payload = {
    seller_reply:      text || null,                              // 빈 값이면 답변 삭제
    seller_replied_at: text ? new Date().toISOString() : null,
  };
  const { error } = await admin.from('reviews').update(payload).eq('id', reviewId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, ...payload });
}
