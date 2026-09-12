-- ════════════════════════════════════════════════════════════════════
--  친구초대 보상 자동 회수 (2026-09-12)
--  실행 위치: Supabase → SQL Editor → 전체 붙여넣기 → Run
--
--  문제
--   추천인 보상(5,000원 쿠폰)은 피추천인의 '첫 주문 배송완료' 시 트리거로 지급되는데,
--   그 주문이 취소·환불돼도 회수되지 않았다. (배송완료 → 환불 → 쿠폰만 남김 반복 가능)
--
--  이 SQL이 하는 일
--   주문이 '취소(cancelled)' 또는 '환불완료(refunded)'로 바뀔 때:
--    1) 그 주문자가 추천으로 가입했고 추천인 보상이 이미 지급된 상태인지 확인
--    2) 그 주문자에게 '배송완료' 주문이 아직 남아 있으면 → 아무것도 안 함(보상 유지)
--    3) 남은 배송완료 주문이 없으면 → 추천인 쿠폰이 '미사용'일 때만 회수 + 보상이력 삭제
--       + 추천 상태를 미지급으로 되돌림 (나중에 다시 주문·배송완료되면 정상 재지급)
--    4) 추천인이 쿠폰을 이미 사용했으면 → 아무것도 건드리지 않음
--       (이력만 지우면 나중에 또 지급돼 5,000원이 두 번 나가므로 그대로 둔다)
--
--  건드리지 않는 것
--   · 피추천인 가입 쿠폰(주문과 무관한 가입 보상)
--   · 부분환불(주문이 배송완료·구매확정으로 유지되므로 보상 조건 그대로)
--   · 관리자 수동 철회 기능(추천 관리의 [철회] 버튼)은 그대로 동작
-- ════════════════════════════════════════════════════════════════════

create or replace function public.handle_referral_clawback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec        referrals%rowtype;
  uc_id      uuid;
  uc_used    boolean;
  remaining  integer;
begin
  /* 취소·환불로 '바뀌는 순간'만 처리 (같은 상태 재저장은 무시) */
  if new.status not in ('cancelled', 'refunded') then
    return new;
  end if;
  if old.status = new.status then
    return new;
  end if;
  if new.user_id is null then
    return new;
  end if;

  /* 이 주문자가 추천으로 가입했는가 + 추천인 보상이 지급된 상태인가 */
  select * into rec from referrals where referred_id = new.user_id;
  if not found or not coalesce(rec.rewarded, false) then
    return new;
  end if;

  /* 다른 '배송완료' 주문이 남아 있으면 보상 조건을 여전히 충족 → 유지 */
  select count(*) into remaining
    from orders
   where user_id = new.user_id
     and status = 'delivered'
     and id <> new.id;
  if remaining > 0 then
    return new;
  end if;

  /* 지급된 추천인 쿠폰 확인 */
  select user_coupon_id into uc_id
    from referral_rewards
   where referral_id = rec.id and reward_type = 'referrer';

  if uc_id is not null then
    select is_used into uc_used from user_coupons where id = uc_id;
    if uc_used is true then
      /* 이미 사용한 쿠폰 → 회수 불가. 이력도 그대로 둬야 중복 지급을 막는다 */
      return new;
    end if;
    if uc_used is false then
      delete from user_coupons where id = uc_id;   -- 미사용 쿠폰 회수
    end if;
    -- uc_used is null = 쿠폰 행이 이미 없음 → 회수할 것 없음
  end if;

  /* 보상 이력 삭제 + 추천 상태 되돌림 (다시 주문·배송완료되면 정상 재지급) */
  delete from referral_rewards where referral_id = rec.id and reward_type = 'referrer';
  update referrals set rewarded = false, rewarded_at = null where id = rec.id;

  return new;
end $$;

drop trigger if exists referral_clawback_trigger on public.orders;
create trigger referral_clawback_trigger
  after update of status on public.orders
  for each row execute function public.handle_referral_clawback();


-- ── 확인용 ──
-- ① 트리거 2개가 보이면 정상: referral_reward_trigger(지급) · referral_clawback_trigger(회수)
select tgname as 트리거, pg_get_triggerdef(t.oid) like '%INSERT%' as 지급용
from pg_trigger t
where tgrelid = 'public.orders'::regclass
  and tgname in ('referral_reward_trigger', 'referral_clawback_trigger')
order by tgname;

-- ② 현재 추천·보상 현황 (지금은 0건이 정상 — 추천 기록이 없음)
select
  (select count(*) from referrals)                                    as 추천건수,
  (select count(*) from referrals where rewarded)                     as 보상지급됨,
  (select count(*) from referral_rewards where reward_type='referrer') as 추천인보상이력,
  (select count(*) from user_coupons uc join coupons c on c.id = uc.coupon_id
    where c.code = 'REFERRAL5000')                                    as 친구초대쿠폰발급수;
