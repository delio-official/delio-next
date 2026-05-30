-- ══════════════════════════════════════════
--  쿠폰 시스템 테이블
-- ══════════════════════════════════════════

-- 1. 쿠폰 정의 테이블
create table if not exists coupons (
  id                    uuid primary key default gen_random_uuid(),
  code                  text unique,                          -- 쿠폰 코드 (입력용, 옵션)
  name                  text not null,                        -- 쿠폰명 (예: "신규회원 10% 할인")
  discount_type         text not null check (discount_type in ('percent', 'fixed')),
  discount_value        numeric not null,                     -- percent: 10 → 10%, fixed: 3000 → 3,000원
  min_order_amount      numeric not null default 0,           -- 최소 주문금액 (0 = 제한없음)
  max_discount_amount   numeric,                              -- 최대 할인금액 (null = 제한없음)
  applicable_categories text[],                              -- null = 전체 카테고리
  applicable_product_ids uuid[],                             -- null = 전체 상품
  starts_at             timestamptz not null default now(),
  expires_at            timestamptz,                          -- null = 만료 없음
  is_active             boolean not null default true,
  created_at            timestamptz not null default now()
);

alter table coupons enable row level security;
create policy "coupons_select_all" on coupons for select using (true);
grant select on coupons to anon, authenticated;

-- 2. 사용자 쿠폰 보유 테이블
create table if not exists user_coupons (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  coupon_id   uuid not null references coupons(id) on delete cascade,
  is_used     boolean not null default false,
  used_at     timestamptz,
  issued_at   timestamptz not null default now(),
  expires_at  timestamptz,   -- 개별 만료일 (coupons.expires_at 보다 우선)
  unique (user_id, coupon_id)
);

alter table user_coupons enable row level security;
create policy "user_coupons_own" on user_coupons for all using (auth.uid() = user_id);
grant select, insert, update on user_coupons to authenticated;

-- ══════════════════════════════════════════
--  샘플 쿠폰 데이터
-- ══════════════════════════════════════════
insert into coupons (code, name, discount_type, discount_value, min_order_amount, max_discount_amount, expires_at) values
  ('WELCOME10', '신규회원 10% 할인',   'percent', 10, 10000, 5000,  now() + interval '365 days'),
  ('SUMMER15',  '여름 특가 15% 할인',  'percent', 15, 20000, 8000,  now() + interval '30 days'),
  ('FLAT3000',  '3,000원 즉시 할인',   'fixed',   3000, 15000, null, now() + interval '60 days');
