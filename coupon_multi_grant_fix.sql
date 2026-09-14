-- ════════════════════════════════════════════════════════════════════
--  같은 쿠폰 여러 장 지급 오류 수정 (2026-09-15)
--  실행 위치: Supabase → SQL Editor → 전체 붙여넣기 → Run (여러 번 실행해도 안전)
--
--  문제
--   user_coupons 에는 (회원, 쿠폰, 발급구분 grant_period) 이 같으면 1장만 들어가는 규칙이 있다.
--   친구초대 보상·관리자 지급은 발급구분을 빈칸('')으로 넣어서, 같은 쿠폰 두 번째 장이 거부됐다.
--    · 추천인이 두 번째 친구 보상을 받는 순간 쿠폰 넣기가 실패 → 같은 묶음인 '배송완료 저장'까지 실패
--    · 초대받아 가입(초대 쿠폰 보유)한 사람이 친구를 초대하면 첫 보상부터 실패
--    · 관리자 [전체 지급] 중 그 쿠폰을 이미 쓴 회원이 한 명이라도 있으면 전체 지급 취소
--  해결
--   1) 친구초대 보상: 발급구분 = 'ref-<추천번호>-<지급시각>' (추천인) / 'refd-<추천번호>' (초대받은 사람)
--   2) 쿠폰 넣기가 어떤 이유로 실패해도 주문 상태 저장·추천 등록은 막지 않음(보상만 건너뛰고 경고)
--   3) 관리자 지급: 발급구분 = 'admin-<지급시각>', 안 쓴 같은 쿠폰 보유자는 지금처럼 건너뜀, 겹치면 그 회원만 건너뜀
--  그대로 두는 것
--   고객 [쿠폰 받기]·코드등록은 발급구분이 계속 빈칸 → 같은 쿠폰 1인 1장 규칙 유지
-- ════════════════════════════════════════════════════════════════════


-- ── 1) 초대받은 사람 쿠폰 (추천 등록 시) ──────────────────────────────
create or replace function public.give_referred_coupon()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare cpn_id uuid; uc_id uuid;
begin
  begin
    insert into referral_rewards (referral_id, reward_type) values (new.id, 'referred')
    on conflict do nothing;
    if not found then
      return new;
    end if;

    select id into cpn_id from coupons where code = 'REFERRAL5000' limit 1;
    if cpn_id is not null then
      insert into user_coupons (user_id, coupon_id, expires_at, grant_period)
      values (new.referred_id, cpn_id, now() + interval '30 days', 'refd-' || new.id)
      returning id into uc_id;
      update referral_rewards set user_coupon_id = uc_id
       where referral_id = new.id and reward_type = 'referred';
    end if;
  exception when others then
    /* 이 블록 안의 변경(보상 기록 포함)은 모두 되돌아가고, 추천 등록 자체는 유지 */
    raise warning '[give_referred_coupon] 초대 쿠폰 지급 실패(추천 %): %', new.id, sqlerrm;
  end;
  return new;
end $$;


-- ── 2) 추천인 보상 (피추천인 첫 주문 배송완료 시) ──────────────────────
create or replace function public.handle_referral_reward()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec          record;
  prior_orders integer;
  cpn_id       uuid;
  uc_id        uuid;
begin
  if new.status <> 'delivered' then
    return new;
  end if;

  /* 이번 주문 말고 배송완료·구매확정 주문이 이미 있으면 첫 구매 아님 */
  select count(*) into prior_orders
    from orders
   where user_id = new.user_id
     and status in ('delivered', 'confirmed')
     and id <> new.id;
  if prior_orders > 0 then
    return new;
  end if;

  select * into rec from referrals where referred_id = new.user_id;
  if not found then
    return new;
  end if;

  begin
    insert into referral_rewards (referral_id, reward_type) values (rec.id, 'referrer')
    on conflict do nothing;
    if not found then
      return new;
    end if;

    update referrals set rewarded = true, rewarded_at = now() where id = rec.id;

    select id into cpn_id from coupons where code = 'REFERRAL5000' limit 1;
    if cpn_id is not null then
      insert into user_coupons (user_id, coupon_id, expires_at, grant_period)
      values (rec.referrer_id, cpn_id, now() + interval '30 days',
              'ref-' || rec.id || '-' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint)
      returning id into uc_id;
      update referral_rewards set user_coupon_id = uc_id
       where referral_id = rec.id and reward_type = 'referrer';
    end if;
  exception when others then
    /* 보상 기록·지급 표시·쿠폰 넣기는 모두 되돌아가고(다음 배송완료 때 다시 시도 가능), 주문 상태 저장은 그대로 진행 */
    raise warning '[handle_referral_reward] 추천인 보상 지급 실패(추천 %, 주문 %): %', rec.id, new.id, sqlerrm;
  end;

  return new;
end $$;


-- ── 3) 관리자 쿠폰 일괄 지급 ─────────────────────────────────────────
create or replace function public.give_coupon_to_users(p_coupon_id uuid, p_user_ids uuid[], p_expires_at timestamptz)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid      uuid;
  cnt      integer := 0;
  v_period text := 'admin-' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  foreach uid in array p_user_ids loop
    /* 안 쓴 같은 쿠폰이 이미 있으면 건너뜀 (기존 동작) */
    if exists (select 1 from user_coupons where user_id = uid and coupon_id = p_coupon_id and is_used = false) then
      continue;
    end if;
    /* 이미 쓴 회원에게는 한 장 더. 혹시 겹치면 그 회원만 건너뛰고 나머지는 계속 지급 */
    insert into user_coupons (user_id, coupon_id, expires_at, grant_period)
    values (uid, p_coupon_id, p_expires_at, v_period)
    on conflict do nothing;
    if found then
      cnt := cnt + 1;
    end if;
  end loop;
  return cnt;
end $$;

/* 서버(service_role)만 호출 — security_phase3 잠금 유지 */
revoke execute on function public.give_coupon_to_users(uuid, uuid[], timestamptz) from public, anon, authenticated;
grant execute on function public.give_coupon_to_users(uuid, uuid[], timestamptz) to service_role;


-- ── 확인 ──
select
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('give_referred_coupon', 'handle_referral_reward', 'give_coupon_to_users')) as 함수_3이어야정상,
  (select count(*) from pg_trigger where tgname in ('referred_coupon_trigger', 'referral_reward_trigger', 'referral_clawback_trigger')) as 추천트리거_3이어야정상,
  has_function_privilege('authenticated', 'public.give_coupon_to_users(uuid, uuid[], timestamptz)', 'execute') as 회원실행권한_false여야정상;
