import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';
import { reviewAmountsFor } from '@/lib/point-earn';
import { loadPointEvents } from '@/lib/point-earn-server';

/* 리뷰 작성 포인트 적립 — 멱등(reviews.point_rewarded 로 1회만).
   본인 리뷰만 적립. 사진/영상 첨부 시 포토 금액, 아니면 일반 금액 (리뷰 적립 이벤트 반영). */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, granted: 0 }, { status: 401 });

  let reviewId = '';
  try { reviewId = (await req.json())?.reviewId || ''; } catch { /* noop */ }
  if (!reviewId) return NextResponse.json({ ok: false, granted: 0 }, { status: 400 });

  const admin = createAdminSupabaseClient();

  /* 관리자 리뷰는 적립 제외 — 홍보용으로 무제한 작성하므로 포인트가 쌓이면 안 됨.
     point_rewarded 는 건드리지 않는다(false 유지). 마킹해두면 나중에 그 리뷰를 지울 때
     삭제 API가 '지급됨'으로 보고 받은 적 없는 포인트를 회수해버림. */
  const { data: me } = await admin.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (me?.is_admin === true) return NextResponse.json({ ok: true, granted: 0 });

  /* 포인트 시스템 OFF → 새 적립(구매·리뷰) 중지. 지급하지 않았으니 point_rewarded 도 표시하지 않음 */
  const { data: pe } = await admin.from('site_settings').select('value').eq('key', 'point_enabled').maybeSingle();
  if ((pe as { value?: string } | null)?.value === 'false') return NextResponse.json({ ok: true, granted: 0, disabled: true });

  const { data: review } = await admin
    .from('reviews').select('id, user_id, product_id, image_urls, video_url, point_rewarded, created_at')
    .eq('id', reviewId).maybeSingle();
  if (!review || review.user_id !== user.id || review.point_rewarded) {
    return NextResponse.json({ ok: true, granted: 0 });
  }

  /* 적립 금액 = 기본 설정(일반 50 / 포토 150)과 '리뷰 작성 시각'에 진행 중인 리뷰 적립 이벤트 중 큰 금액 */
  const { data: settings } = await admin
    .from('site_settings').select('key,value').in('key', ['review_point_text', 'review_point_photo']);
  const map: Record<string, string> = {};
  ((settings as { key: string; value: string }[]) || []).forEach(s => { map[s.key] = s.value; });
  const hasMedia = (review.image_urls && review.image_urls.length > 0) || !!review.video_url;
  const base = {
    text:  Math.max(0, parseInt(map.review_point_text  || '50')  || 0),
    photo: Math.max(0, parseInt(map.review_point_photo || '150') || 0),
  };
  const amounts = reviewAmountsFor(review.product_id, base, await loadPointEvents(admin, 'review'), new Date(review.created_at || Date.now()));
  const amount = hasMedia ? amounts.photo : amounts.text;

  /* 멱등 마킹 먼저 (동시요청 방지) */
  const reward = { point_rewarded: true, point_reward_amount: amount, point_reward_max: amount };
  let { data: marked, error: markErr } = await admin
    /* 지급액을 함께 기록 — 삭제 시 이 금액을 회수, 사진을 모두 지우면 DB 트리거가 '적립 당시 일반 금액'(point_reward_text)을 남기고 차액 회수 */
    .from('reviews').update({ ...reward, point_reward_text: amounts.text })
    .eq('id', reviewId).eq('point_rewarded', false).select('id').maybeSingle();
  if (markErr && /point_reward_text/.test(markErr.message)) {
    // 칸 추가 SQL 실행 전 — 기존 방식으로 기록
    ({ data: marked } = await admin.from('reviews').update(reward)
      .eq('id', reviewId).eq('point_rewarded', false).select('id').maybeSingle());
  }
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
