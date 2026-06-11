-- ════════════════════════════════════════════════════════════════
-- 리뷰 작성 포인트 적립
--   review_point_text  : 일반(텍스트) 리뷰 적립 포인트
--   review_point_photo : 사진/영상 첨부 리뷰 적립 포인트
--   reviews.point_rewarded : 중복 적립 방지 플래그
-- ════════════════════════════════════════════════════════════════

alter table public.reviews
  add column if not exists point_rewarded boolean not null default false;

insert into public.site_settings (key, value) values
  ('review_point_text', '100'),
  ('review_point_photo', '500')
on conflict (key) do nothing;
