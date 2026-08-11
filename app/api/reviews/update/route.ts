import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';

/* 리뷰 수정 — 관리자 전용.
   reviews UPDATE 정책이 "본인 리뷰만"이라 관리자가 브라우저에서 남의 리뷰를 못 고친다.
   서버에서 관리자 확인 후 작성일/별점/내용만 갱신한다(판매자답변 라우트와 동일 패턴). */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });

  let reviewId = '', content: unknown, rating: unknown, reviewDate = '';
  try {
    const body = await req.json();
    reviewId   = body?.reviewId || '';
    content    = body?.content;
    rating     = body?.rating;
    reviewDate = typeof body?.reviewDate === 'string' ? body.reviewDate : '';
  } catch { /* noop */ }
  if (!reviewId) return NextResponse.json({ ok: false, error: 'BAD_REQUEST' }, { status: 400 });

  const admin = createAdminSupabaseClient();
  const { data: me } = await admin.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (me?.is_admin !== true) return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });

  const payload: Record<string, unknown> = {};
  if (typeof content === 'string' && content.trim()) payload.content = content.trim();
  const r = Number(rating);
  if (r >= 1 && r <= 5) payload.rating = Math.round(r);
  if (reviewDate) {
    const d = new Date(reviewDate + 'T12:00:00');
    if (!isNaN(d.getTime())) payload.created_at = d.toISOString();
  }
  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ ok: false, error: '변경할 내용이 없습니다.' }, { status: 400 });
  }

  const { error } = await admin.from('reviews').update(payload).eq('id', reviewId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, ...payload });
}
