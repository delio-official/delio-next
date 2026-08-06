-- 라운지 글 뱃지 색상 — 상품/이벤트 뱃지처럼 색상 지정 가능하게
alter table public.lounge_posts
  add column if not exists badge_color text;

comment on column public.lounge_posts.badge_color is '뱃지 배경색(hex). 뱃지 텍스트 없으면 null';
