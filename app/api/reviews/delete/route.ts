import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';

/* 리뷰 삭제 — 본인 또는 관리자만.
   클라이언트에서 직접 delete 하면 (1) 적립금이 회수되지 않아 작성→삭제→재작성으로
   포인트를 무한 수령할 수 있고 (2) products.review_count 가 어긋난다.
   그래서 삭제는 반드시 이 경로로 처리한다. */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });

  let reviewId = '';
  try { reviewId = (await req.json())?.reviewId || ''; } catch { /* noop */ }
  if (!reviewId) return NextResponse.json({ ok: false, error: 'BAD_REQUEST' }, { status: 400 });

  const admin = createAdminSupabaseClient();

  const { data: review } = await admin
    .from('reviews').select('id, user_id, product_id, image_urls, video_url, point_rewarded')
    .eq('id', reviewId).maybeSingle();
  if (!review) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });

  /* 권한: 본인 리뷰 or 관리자 */
  const { data: me } = await admin.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  const isAdmin = me?.is_admin === true;
  const isMine  = review.user_id === user.id;
  if (!isMine && !isAdmin) return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });

  /* 적립금 회수 — 지급된 리뷰만. 지급 당시와 동일한 규칙(미디어 유무 × 설정단가)으로 산정 */
  let recovered = 0;
  if (review.point_rewarded && review.user_id) {
    const { data: settings } = await admin
      .from('site_settings').select('key,value').in('key', ['review_point_text', 'review_point_photo']);
    const map: Record<string, string> = {};
    ((settings as { key: string; value: string }[]) || []).forEach(s => { map[s.key] = s.value; });
    const hasMedia = (review.image_urls && review.image_urls.length > 0) || !!review.video_url;
    const amount = Math.max(0, parseInt((hasMedia ? map.review_point_photo : map.review_point_text) || (hasMedia ? '150' : '50')) || 0);

    if (amount > 0) {
      const { data: prof } = await admin.from('profiles').select('point_balance').eq('id', review.user_id).single();
      const cur = prof?.point_balance || 0;
      recovered = Math.min(cur, amount);            // 잔액이 모자라면 있는 만큼만 (음수 방지)
      if (recovered > 0) {
        await admin.from('profiles').update({ point_balance: cur - recovered }).eq('id', review.user_id);
        try {
          await admin.from('point_logs').insert({
            user_id: review.user_id, amount: -recovered, description: '리뷰 삭제로 적립금 회수',
          });
        } catch { /* 원장 기록 실패는 무시 */ }
      }
    }
  }

  const { error: delErr } = await admin.from('reviews').delete().eq('id', reviewId);
  if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });

  /* products.review_count 보정 — DB 트리거는 avg_rating만 갱신하므로 여기서 맞춘다 */
  const { count } = await admin
    .from('reviews').select('id', { count: 'exact', head: true })
    .eq('product_id', review.product_id);
  await admin.from('products').update({ review_count: count ?? 0 }).eq('id', review.product_id);

  return NextResponse.json({ ok: true, recovered, reviewCount: count ?? 0 });
}
