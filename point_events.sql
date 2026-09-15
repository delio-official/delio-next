-- ════════════════════════════════════════════════════════════════════
--  포인트 신규 기능 (2026-09-16) — 견적서 항목
--  실행 위치: Supabase → SQL Editor → 전체 붙여넣기 → Run (여러 번 실행해도 안전)
--
--  1) 적립 이벤트 표(point_events) — 구매 적립 이벤트 / 리뷰 적립 이벤트
--     · 기간(시작~끝, 끝 비우면 상시) · 방식(배수 / 적립률 지정 / 리뷰 금액 지정) · 대상(전체 / 선택 상품)
--     · 읽기는 누구나(상품 상세·결제 화면 표시), 쓰기는 관리자만
--     · 시작된 이벤트는 기록 보존: 삭제 불가, '끝나는 시각'만 수정 가능 (무통장 늦은 입금 계산에 필요)
--  2) 회원 개인 적립률(profiles.point_rate_override) · 설문 적립 받은 시각(profiles.survey_point_at)
--     · 회원이 브라우저에서 직접 바꿀 수 없게 기존 보호 규칙에 추가
--  3) 리뷰: 적립 당시 '일반 리뷰 금액' 기록(reviews.point_reward_text)
--     · 포토 리뷰에서 사진을 모두 지우면 이 금액을 남기고 차액 회수 (이벤트 중 받은 리뷰도 정확히)
--  4) 이미 취향 설문을 완료한 회원은 '설문 적립 받음' 처리 (소급 지급 안 함 — 다시 진단해도 미지급)
--  5) 설정 기본값: 설문 완료 적립 0P(꺼짐), 포인트 최소 사용 0P(제한 없음)
-- ════════════════════════════════════════════════════════════════════


-- ── 1) 적립 이벤트 ─────────────────────────────────────────────────────
create table if not exists public.point_events (
  id                  uuid primary key default gen_random_uuid(),
  kind                text not null check (kind in ('purchase', 'review')),
  name                text not null,
  starts_at           timestamptz not null,
  ends_at             timestamptz,                                  -- null = 상시
  mode                text not null check (mode in ('multiply', 'rate', 'amount')),
  multiplier          numeric check (multiplier is null or (multiplier > 0 and multiplier <= 20)),
  rate                numeric check (rate is null or (rate >= 0 and rate <= 100)),          -- 구매: 적립률 지정 %
  review_text_amount  integer check (review_text_amount is null or review_text_amount >= 0),   -- 리뷰: 일반 금액 지정
  review_photo_amount integer check (review_photo_amount is null or review_photo_amount >= 0), -- 리뷰: 포토 금액 지정
  target              text not null default 'all' check (target in ('all', 'products')),
  product_ids         uuid[] not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint point_events_mode_kind check (
    (kind = 'purchase' and mode in ('multiply', 'rate')) or
    (kind = 'review'   and mode in ('multiply', 'amount'))
  ),
  constraint point_events_mode_values check (
    (mode = 'multiply' and multiplier is not null) or
    (mode = 'rate'     and rate is not null) or
    (mode = 'amount'   and review_text_amount is not null and review_photo_amount is not null)
  ),
  constraint point_events_period check (ends_at is null or ends_at > starts_at)
);
create index if not exists point_events_kind_idx on public.point_events (kind, starts_at);

alter table public.point_events enable row level security;
drop policy if exists point_events_select_all on public.point_events;
create policy point_events_select_all on public.point_events for select using (true);
drop policy if exists point_events_admin_write on public.point_events;
create policy point_events_admin_write on public.point_events for all to authenticated
  using (public.is_current_user_admin()) with check (public.is_current_user_admin());
grant select on public.point_events to anon, authenticated;
grant insert, update, delete on public.point_events to authenticated;
grant all on public.point_events to service_role;

-- 시작된 이벤트 기록 보존 (관리자 화면에서 직접 고칠 때만 검사 — 서버·SQL 작업은 제외)
--   security invoker(기본값): current_user 로 '브라우저 직접 요청'을 판별해야 하므로 definer 로 만들지 않는다.
create or replace function public.protect_point_event_history()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    if old.starts_at <= now() then raise exception 'POINT_EVENT_STARTED'; end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    new.updated_at := now();
    if old.starts_at <= now() then
      -- 시작된 이벤트: 끝나는 시각만 바꿀 수 있고, 과거로 되돌릴 수 없다(이미 적용된 주문 보호)
      if new.kind is distinct from old.kind or new.name is distinct from old.name
         or new.starts_at is distinct from old.starts_at or new.mode is distinct from old.mode
         or new.multiplier is distinct from old.multiplier or new.rate is distinct from old.rate
         or new.review_text_amount is distinct from old.review_text_amount
         or new.review_photo_amount is distinct from old.review_photo_amount
         or new.target is distinct from old.target or new.product_ids is distinct from old.product_ids then
        raise exception 'POINT_EVENT_STARTED';
      end if;
      if new.ends_at is not null and new.ends_at < now() - interval '1 minute' then
        raise exception 'POINT_EVENT_END_PAST';
      end if;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_protect_point_event_history on public.point_events;
create trigger trg_protect_point_event_history
  before update or delete on public.point_events
  for each row execute function public.protect_point_event_history();


-- ── 2) 회원 개인 적립률 · 설문 적립 받은 시각 ─────────────────────────────
alter table public.profiles add column if not exists point_rate_override numeric
  check (point_rate_override is null or (point_rate_override >= 0 and point_rate_override <= 100));
alter table public.profiles add column if not exists survey_point_at timestamptz;

-- 기존 보호 규칙(security_phase2.sql)에 두 칸 추가 — 나머지는 그대로
create or replace function public.protect_profile_columns()
returns trigger language plpgsql as $$
begin
  if public.is_direct_non_admin() then
    if tg_op = 'INSERT' then
      new.is_admin := false;  new.is_blocked := false;
      new.grade := 'beginner'; new.grade_locked := false; new.grade_updated_at := null;
      new.point_balance := 0; new.memo := null;
      new.ci := null; new.di := null; new.verified_at := null;
      new.welcome_sent := false; new.signup_coupons_granted := false;
      new.point_rate_override := null; new.survey_point_at := null;
    else
      new.id := old.id; new.email := old.email; new.created_at := old.created_at;
      new.is_admin := old.is_admin;  new.is_blocked := old.is_blocked;
      new.grade := old.grade; new.grade_locked := old.grade_locked; new.grade_updated_at := old.grade_updated_at;
      new.point_balance := old.point_balance;
      new.memo := old.memo;
      new.ci := old.ci; new.di := old.di; new.verified_at := old.verified_at;
      new.welcome_sent := old.welcome_sent; new.signup_coupons_granted := old.signup_coupons_granted;
      new.point_rate_override := old.point_rate_override; new.survey_point_at := old.survey_point_at;
      if old.referral_code is not null then new.referral_code := old.referral_code; end if;
    end if;
  end if;
  return new;
end $$;


-- ── 3) 리뷰: 적립 당시 일반 리뷰 금액 기록 ────────────────────────────────
alter table public.reviews add column if not exists point_reward_text integer;   -- null = 기록 전(현재 설정값 사용)

-- 작성 보호(referral_review_fix2.sql, invoker) — 새 칸도 고객이 못 넣게
create or replace function public.enforce_review_insert_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if public.is_direct_non_admin() then
    new.created_at          := now();
    new.is_best             := false;
    new.likes_count         := 0;
    new.point_rewarded      := false;
    new.point_reward_amount := null;
    new.point_reward_max    := null;
    new.point_reward_text   := null;
    new.seller_reply        := null;
    new.seller_replied_at   := null;
  end if;
  return new;
end $$;

-- 수정 보호(referral_review_fix.sql 10-2) — 새 칸 보호 + 사진 삭제 회수 기준을 '적립 당시 일반 금액'으로
create or replace function public.enforce_review_update_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_admin   boolean := false;
  had_media boolean;
  has_media boolean;
  text_amt  integer;
  diff      integer;
  bal       integer;
  rec_amt   integer;
begin
  if v_uid is not null then
    v_admin := coalesce(public.is_current_user_admin(), false);

    if not v_admin
       and (new.seller_reply      is distinct from old.seller_reply
         or new.seller_replied_at is distinct from old.seller_replied_at) then
      raise exception 'REPLY_ADMIN_ONLY';
    end if;

    if v_uid is distinct from old.user_id
       and (new.rating     is distinct from old.rating
         or new.content    is distinct from old.content
         or new.image_urls is distinct from old.image_urls
         or new.video_url  is distinct from old.video_url
         or new.taste      is distinct from old.taste) then
      raise exception 'CONTENT_OWNER_ONLY';
    end if;

    if not v_admin then
      new.user_id             := old.user_id;
      new.product_id          := old.product_id;
      new.order_item_id       := old.order_item_id;
      new.created_at          := old.created_at;
      new.is_best             := old.is_best;
      new.likes_count         := old.likes_count;
      new.point_rewarded      := old.point_rewarded;
      new.point_reward_amount := old.point_reward_amount;
      new.point_reward_max    := old.point_reward_max;
      new.point_reward_text   := old.point_reward_text;
    end if;
  end if;

  if coalesce(old.point_rewarded, false) and coalesce(new.point_rewarded, false)
     and old.point_reward_amount is not null and old.user_id is not null then
    had_media := coalesce(array_length(old.image_urls, 1), 0) > 0 or coalesce(old.video_url, '') <> '';
    has_media := coalesce(array_length(new.image_urls, 1), 0) > 0 or coalesce(new.video_url, '') <> '';

    if had_media and not has_media then
      text_amt := coalesce(old.point_reward_text,
                           (select nullif(value, '')::int from site_settings where key = 'review_point_text'), 50);
      diff := old.point_reward_amount - text_amt;
      if diff > 0 then
        select point_balance into bal from profiles where id = old.user_id for update;
        rec_amt := least(greatest(coalesce(bal, 0), 0), diff);
        if rec_amt > 0 then
          update profiles set point_balance = bal - rec_amt where id = old.user_id;
          insert into point_logs (user_id, amount, description)
          values (old.user_id, -rec_amt, '리뷰 사진 삭제로 적립금 차액 회수');
        end if;
        new.point_reward_amount := old.point_reward_amount - rec_amt;
      end if;

    elsif not had_media and has_media then
      diff := coalesce(old.point_reward_max, old.point_reward_amount) - old.point_reward_amount;
      if diff > 0 then
        update profiles set point_balance = coalesce(point_balance, 0) + diff where id = old.user_id;
        insert into point_logs (user_id, amount, description)
        values (old.user_id, diff, '리뷰 사진 재등록으로 적립금 복원');
        new.point_reward_amount := old.point_reward_amount + diff;
      end if;
    end if;
  end if;

  return new;
end $$;


-- ── 4) 이미 설문을 완료한 회원: 설문 적립 받음 처리 (소급 지급 안 함) ──────────
update public.profiles p
   set survey_point_at = now()
 where p.survey_point_at is null
   and exists (select 1 from public.survey_results s where s.user_id = p.id);


-- ── 5) 설정 기본값 (이미 있으면 그대로) ─────────────────────────────────
insert into public.site_settings (key, value) values ('survey_point', '0')   on conflict (key) do nothing;
insert into public.site_settings (key, value) values ('point_min_use', '0')  on conflict (key) do nothing;


-- ── 확인 ──
select
  (select count(*) from information_schema.tables  where table_name = 'point_events')                                   as 이벤트표_1이어야정상,
  (select count(*) from information_schema.columns where table_name = 'profiles' and column_name in ('point_rate_override', 'survey_point_at')) as 회원칸_2이어야정상,
  (select count(*) from information_schema.columns where table_name = 'reviews'  and column_name = 'point_reward_text')  as 리뷰칸_1이어야정상,
  (select count(*) from public.profiles where survey_point_at is not null)                                               as 설문받음처리_17이어야정상,
  (select string_agg(key || '=' || value, ', ') from public.site_settings where key in ('survey_point', 'point_min_use')) as 설정기본값;
