-- 쿠폰의 포인트 중복 사용 허용 여부
--
-- 쿠폰마다 "이 쿠폰을 포인트와 함께 쓸 수 있는가"를 정한다.
--   true(기본)  = 쿠폰 + 포인트 동시 사용 가능
--   false       = 이 쿠폰을 쓰면 포인트는 사용 불가(쿠폰만)
--
-- 결제 화면에서 allow_point=false 쿠폰을 고르면 포인트가 0으로 비워지고 안내가 뜬다.

alter table public.coupons
  add column if not exists allow_point boolean not null default true;

comment on column public.coupons.allow_point is
  '포인트 중복 사용 허용. false면 이 쿠폰 사용 시 포인트 불가.';

-- 기존 쿠폰은 모두 사용가능(true)로 이미 채워짐(default). 확인용:
-- select name, allow_point from public.coupons order by created_at desc;
