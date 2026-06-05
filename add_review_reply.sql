-- 리뷰 판매자 답변
alter table public.reviews
  add column if not exists seller_reply text,
  add column if not exists seller_replied_at timestamptz;
