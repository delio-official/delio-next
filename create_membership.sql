-- ══════════════════════════════════════════════════════════════
--  델리오 멤버십 개편 (4단계: 비기너/테이스터/바이어/마스터)
--  분기 자동 산정 + 등급별 적립률 + 월 쿠폰팩/생일쿠폰 자동발급
--  ⚠️ Supabase SQL Editor 에서 1회 실행
-- ══════════════════════════════════════════════════════════════

-- ── 1. 등급 정의/설정 테이블 (어드민에서 수정) ──────────────────
create table if not exists membership_tiers (
  grade           text primary key,                 -- beginner/taster/buyer/master
  sort            int  not null,
  label           text not null,
  point_rate      numeric not null default 1,       -- 현재 적립률(%)
  point_rate_next numeric,                           -- 예약 적립률
  apply_date      date,                              -- 예약 적용일
  min_amount      numeric not null default 0,        -- 분기 누적 금액 임계
  min_count       int     not null default 0,        -- 분기 구매횟수 임계
  coupon_codes    text[]  not null default '{}',     -- 월 발급 쿠폰(coupons.code)
  monthly_active  boolean not null default true,     -- 월 쿠폰팩 발급 on/off
  updated_at      timestamptz not null default now()
);

insert into membership_tiers (grade, sort, label, point_rate, min_amount, min_count, coupon_codes, monthly_active) values
  ('beginner', 0, '비기너',  1, 0,        0, '{}',                                        false),
  ('taster',   1, '테이스터', 1, 100000,   0, '{MBR_THOUSAND,MBR_PERCENT10}',              true),
  ('buyer',    2, '바이어',  2, 300000,   3, '{MBR_THOUSAND,MBR_PERCENT10,MBR_FIVE}',     true),
  ('master',   3, '마스터',  2, 1500000,  5, '{MBR_THOUSAND,MBR_PERCENT10,MBR_FIVE}',     true)
on conflict (grade) do nothing;

alter table membership_tiers enable row level security;
drop policy if exists "mt_select_all" on membership_tiers;
create policy "mt_select_all" on membership_tiers for select using (true);
drop policy if exists "mt_admin_write" on membership_tiers;
create policy "mt_admin_write" on membership_tiers for all
  using (public.is_current_user_admin()) with check (public.is_current_user_admin());
grant select on membership_tiers to anon, authenticated;
grant all on membership_tiers to service_role;

-- ── 2. 자동발급 멱등 로그 (월 쿠폰팩/생일/재산정) ───────────────
create table if not exists membership_grants (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  grant_type text not null,                          -- monthly | birthday | recalc
  period     text not null,                          -- '2026-06' | '2026' | '2026-Q2'
  detail     text,
  created_at timestamptz not null default now(),
  unique (user_id, grant_type, period)
);

alter table membership_grants enable row level security;
drop policy if exists "mg_admin_select" on membership_grants;
create policy "mg_admin_select" on membership_grants for select
  using (public.is_current_user_admin());
grant all on membership_grants to service_role;

-- ── 3. profiles: 등급 메타 + 신규 등급키 마이그레이션 ───────────
alter table profiles add column if not exists grade_updated_at timestamptz;
alter table profiles add column if not exists grade_locked boolean not null default false;

-- 기존 CHECK 제약(normal~vvip만 허용)을 먼저 제거해야 신규 키로 갱신 가능
alter table profiles drop constraint if exists profiles_grade_check;

update profiles set grade = 'beginner' where grade is null or grade in ('normal');
update profiles set grade = 'taster'   where grade = 'silver';
update profiles set grade = 'buyer'    where grade in ('gold','vip');
update profiles set grade = 'master'   where grade = 'vvip';
-- 혹시 남은 알 수 없는 값도 비기너로 정규화
update profiles set grade = 'beginner' where grade not in ('beginner','taster','buyer','master');

-- 신규 등급키로 CHECK 제약 재설정 + 기본값
alter table profiles add constraint profiles_grade_check check (grade in ('beginner','taster','buyer','master'));
alter table profiles alter column grade set default 'beginner';

-- ── 4. user_coupons: 월 반복발급 위해 기간 컬럼 + 유니크 완화 ───
-- 같은 멤버십 쿠폰을 매월 재발급하려면 (user, coupon, 기간)으로 풀어야 함.
alter table user_coupons add column if not exists grant_period text not null default '';
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'user_coupons_user_id_coupon_id_key') then
    alter table user_coupons drop constraint user_coupons_user_id_coupon_id_key;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'user_coupons_user_coupon_period_key') then
    alter table user_coupons add constraint user_coupons_user_coupon_period_key unique (user_id, coupon_id, grant_period);
  end if;
end $$;

-- ── 5. 멤버십 전용 쿠폰 4종 (is_public=false: 자동발급 전용) ────
insert into coupons (code, name, discount_type, discount_value, min_order_amount, max_discount_amount, valid_days, is_active, is_public, description) values
  ('MBR_THOUSAND', '멤버십 1,000원 쿠폰', 'fixed',   1000, 10000, null, 30, true, false, '멤버십 등급 월 혜택'),
  ('MBR_PERCENT10','멤버십 10% 쿠폰',     'percent', 10,   0,     3000, 30, true, false, '멤버십 등급 월 혜택 (최대 3,000원)'),
  ('MBR_FIVE',     '멤버십 5,000원 쿠폰', 'fixed',   5000, 30000, null, 30, true, false, '멤버십 등급 월 혜택'),
  ('MBR_BIRTHDAY', '생일 축하 5,000원 쿠폰','fixed', 5000, 0,     null, 60, true, false, '생일월 자동 지급')
on conflict (code) do nothing;

-- ── 6. 멤버십 운영 토글 (site_settings) ───────────────────────
insert into site_settings (key, value) values
  ('membership_auto_recalc', 'true'),     -- 분기 자동 재산정 on/off
  ('membership_monthly_on',  'true'),     -- 월 쿠폰팩 발급 on/off
  ('membership_birthday_on', 'true'),     -- 생일쿠폰 on/off
  ('membership_last_recalc', '')          -- 마지막 재산정 일시
on conflict (key) do nothing;
