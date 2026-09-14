-- ════════════════════════════════════════════════════════════════════
--  referral_review_fix.sql 보정 (2026-09-14) — 즉시 실행
--  문제: 리뷰 '작성' 보호 함수를 security definer 로 만들어, 함수 안에서 현재 역할이 소유자(postgres)로 바뀌어
--        '브라우저에서 직접 쓰는 일반 회원인가' 판별(is_direct_non_admin)이 항상 false → 보호가 동작하지 않았음.
--        (수정 보호는 auth.uid() 로 판별해서 정상)
--  해결: 작성 보호 함수는 호출한 사람 권한으로 실행(security invoker). 칸 값만 바꾸므로 높은 권한이 필요 없음.
-- ════════════════════════════════════════════════════════════════════

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
    new.seller_reply        := null;
    new.seller_replied_at   := null;
  end if;
  return new;
end $$;

-- 확인: 적립 안 됐는데 금액이 들어가 있거나, 보유액이 최대치를 넘는 리뷰 (0이어야 정상)
select
  (select count(*) from public.reviews where not point_rewarded and (point_reward_amount is not null or point_reward_max is not null)) as 이상_미적립인데금액,
  (select count(*) from public.reviews where point_reward_amount > point_reward_max)                                                  as 이상_보유액초과,
  (select count(*) from public.reviews where point_reward_max > 1000)                                                                 as 이상_1000원초과;
