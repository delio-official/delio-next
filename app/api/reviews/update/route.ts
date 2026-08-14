import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';

/* 리뷰 수정 — 관리자 전용.
   reviews UPDATE 정책이 "본인 리뷰만"이라 관리자가 브라우저에서 남의(고객) 리뷰를 못 고친다.
   서버에서 관리자 확인 후 service_role로 갱신한다(판매자답변 라우트와 동일 패턴).
   ⚠️ created_at(작성일)은 body.reviewDate가 온 경우에만 갱신 — 사진 추가 등 일반 수정 시
      날짜/정렬이 바뀌지 않도록 클라이언트가 '날짜를 실제로 바꿨을 때만' reviewDate를 보낸다. */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const reviewId = (body?.reviewId as string) || '';
  if (!reviewId) return NextResponse.json({ ok: false, error: 'BAD_REQUEST' }, { status: 400 });

  const admin = createAdminSupabaseClient();
  const { data: me } = await admin.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (me?.is_admin !== true) return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });

  const payload: Record<string, unknown> = {};
  if (typeof body.content === 'string' && body.content.trim()) payload.content = body.content.trim();
  const r = Number(body.rating);
  if (r >= 1 && r <= 5) payload.rating = Math.round(r);
  /* 작성일: reviewDate가 온 경우에만 갱신(날짜 변경 시에만 클라가 전송) */
  if (typeof body.reviewDate === 'string' && body.reviewDate) {
    const d = new Date(body.reviewDate + 'T12:00:00');
    if (!isNaN(d.getTime())) payload.created_at = d.toISOString();
  }
  /* 미디어·표시명 — 키가 온 경우에만 갱신(부분수정 지원). 빈 배열/빈 값은 null로 저장 */
  if ('image_urls' in body) payload.image_urls = Array.isArray(body.image_urls) && body.image_urls.length ? body.image_urls : null;
  if ('video_url' in body)  payload.video_url  = (body.video_url as string) || null;
  if ('taste' in body)      payload.taste      = body.taste && Object.keys(body.taste as object).length ? body.taste : null;
  if (typeof body.author_name === 'string') payload.author_name = body.author_name || null;

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ ok: false, error: '변경할 내용이 없습니다.' }, { status: 400 });
  }

  const { error } = await admin.from('reviews').update(payload).eq('id', reviewId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
