import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';

/* 리뷰 작성 포인트 적립 — 멱등(reviews.point_rewarded 로 1회만).
   본인 리뷰만 적립. 사진/영상 첨부 시 review_point_photo, 아니면 review_point_text. */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, granted: 0 }, { status: 401 });

  let reviewId = '';
  try { reviewId = (await req.json())?.reviewId || ''; } catch { /* noop */ }
  if (!reviewId) return NextResponse.json({ ok: false, granted: 0 }, { status: 400 });

  const admin = createAdminSupabaseClient();

  const { data: review } = await admin
    .from('reviews').select('id, user_id, image_urls, video_url, point_rewarded')
    .eq('id', reviewId).maybeSingle();
  if (!review || review.user_id !== user.id || review.point_rewarded) {
    return NextResponse.json({ ok: true, granted: 0 });
  }

  /* 적립 금액 (site_settings, 기본 텍스트 100 / 사진·영상 500) */
  const { data: settings } = await admin
    .from('site_settings').select('key,value').in('key', ['review_point_text', 'review_point_photo']);
  const map: Record<string, string> = {};
  ((settings as { key: string; value: string }[]) || []).forEach(s => { map[s.key] = s.value; });
  const hasMedia = (review.image_urls && review.image_urls.length > 0) || !!review.video_url;
  const amount = Math.max(0, parseInt((hasMedia ? map.review_point_photo : map.review_point_text) || (hasMedia ? '500' : '100')) || 0);

  /* 멱등 마킹 먼저 (동시요청 방지) */
  const { data: marked } = await admin
    .from('reviews').update({ point_rewarded: true })
    .eq('id', reviewId).eq('point_rewarded', false).select('id').maybeSingle();
  if (!marked) return NextResponse.json({ ok: true, granted: 0 });

  if (amount > 0) {
    const { data: prof } = await admin.from('profiles').select('point_balance').eq('id', user.id).single();
    const newBalance = (prof?.point_balance || 0) + amount;
    await admin.from('profiles').update({ point_balance: newBalance }).eq('id', user.id);
    try {
      await admin.from('point_logs').insert({
        user_id: user.id, amount, description: hasMedia ? '포토 리뷰 작성 적립' : '리뷰 작성 적립',
      });
    } catch { /* 원장 기록 실패는 무시 */ }
  }

  return NextResponse.json({ ok: true, granted: amount });
}
