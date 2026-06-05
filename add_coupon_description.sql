-- 쿠폰 설명 필드
alter table public.coupons
  add column if not exists description text;
