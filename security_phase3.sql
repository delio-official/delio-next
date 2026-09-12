-- ════════════════════════════════════════════════════════════════════
--  델리오 보안 수정 3단계 (2026-09-12)
--  실행 위치: Supabase → SQL Editor → 전체 붙여넣기 → Run
--  전제: 아래 코드 배포 완료 — 관리자 포인트 지급·쿠폰 일괄지급·추천 보상 철회가
--        서버 API(/api/admin/points, /api/admin/coupons/give, /api/admin/referral/revoke)를 거치도록 변경
--
--  막는 것
--   1) 포인트 지급 함수(add_points) 를 회원·비로그인이 직접 호출해 포인트를 만들어내는 것
--      → 현재 누구나 호출 가능(권한검사 없는 SECURITY DEFINER). 2단계에서 잠근 '포인트 잔액 직접수정'을 이 경로가 우회함
--   2) 쿠폰 일괄지급 함수(give_coupon_to_users) 로 아무 쿠폰이나 스스로 발급하는 것
--   3) 추천 보상 철회 함수(revoke_referral_reward) 를 회원이 호출하는 것
--   4) 쿠폰 '코드등록'(마이페이지)으로 비공개 쿠폰(가입·멤버십·생일·친구초대)을 받아가는 것
--      → 쿠폰 code 는 고객도 조회할 수 있으므로, '코드등록 허용'을 켠 쿠폰만 등록되게 함
--  고치는 것
--   5) 관리자 화면의 친구추천 목록·추천 쿠폰 내역이 비어 보이는 문제(테이블 읽기 권한 없음)
--
--  영향 없음: 관리자 화면 작업(서버 API 경유), 서버(service_role) 작업, 가입쿠폰·멤버십·생일쿠폰 자동지급(트리거/크론)
-- ════════════════════════════════════════════════════════════════════

-- 1) 관리자 전용 함수 3개 — 서버(service_role)만 호출 가능하게
do $$
declare f record; n int := 0;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
      and p.proname in ('add_points', 'give_coupon_to_users', 'revoke_referral_reward')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
    n := n + 1;
    raise notice '잠금: %', f.sig;
  end loop;
  if n = 0 then
    raise exception '대상 함수를 찾지 못했습니다 — 함수 이름을 확인하세요(add_points / give_coupon_to_users / revoke_referral_reward)';
  end if;
end $$;


-- 2) 쿠폰 코드등록 — '코드등록 허용'을 켠 쿠폰만 (기존 쿠폰은 모두 꺼진 상태로 시작)
alter table public.coupons add column if not exists code_redeemable boolean not null default false;

create or replace function public.redeem_coupon_code(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coupon coupons%rowtype;
  v_uid uuid := auth.uid();
  v_exp timestamptz;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'message', '로그인이 필요합니다.');
  end if;

  select * into v_coupon from coupons where code = p_code limit 1;
  if not found then
    return json_build_object('ok', false, 'message', '유효하지 않은 쿠폰 코드입니다.');
  end if;
  /* [보안] 코드등록 허용 쿠폰만 — 가입·멤버십·생일·친구초대 쿠폰은 코드로 받을 수 없음 */
  if not coalesce(v_coupon.code_redeemable, false)
     or coalesce(v_coupon.signup_grant, false)
     or coalesce(v_coupon.is_membership, false) then
    return json_build_object('ok', false, 'message', '유효하지 않은 쿠폰 코드입니다.');
  end if;
  if not v_coupon.is_active then
    return json_build_object('ok', false, 'message', '사용할 수 없는 쿠폰입니다.');
  end if;
  if v_coupon.starts_at is not null and v_coupon.starts_at > now() then
    return json_build_object('ok', false, 'message', '아직 사용 기간이 아닙니다.');
  end if;
  if v_coupon.expires_at is not null and v_coupon.expires_at <= now() then
    return json_build_object('ok', false, 'message', '기간이 만료된 쿠폰입니다.');
  end if;
  if exists (select 1 from user_coupons where user_id = v_uid and coupon_id = v_coupon.id) then
    return json_build_object('ok', false, 'message', '이미 등록된 쿠폰입니다.');
  end if;

  v_exp := case
    when v_coupon.valid_days is not null then now() + (v_coupon.valid_days || ' days')::interval
    else v_coupon.expires_at
  end;
  insert into user_coupons (user_id, coupon_id, expires_at) values (v_uid, v_coupon.id, v_exp);

  return json_build_object('ok', true, 'message', v_coupon.name || ' 쿠폰이 등록되었습니다.');
end;
$$;
revoke execute on function public.redeem_coupon_code(text) from public, anon;
grant execute on function public.redeem_coupon_code(text) to authenticated, service_role;


-- 3) 관리자 화면이 친구추천 목록·추천 쿠폰 내역을 읽을 수 있게 (읽기만, 변경은 서버 API)
drop policy if exists referrals_admin_read on public.referrals;
create policy referrals_admin_read on public.referrals for select to authenticated
  using (public.is_current_user_admin());

alter table public.referral_rewards enable row level security;
drop policy if exists referral_rewards_admin_read on public.referral_rewards;
create policy referral_rewards_admin_read on public.referral_rewards for select to authenticated
  using (public.is_current_user_admin());
grant select on public.referral_rewards to authenticated;


-- ── 확인용 ──
-- ① 함수 권한: add_points / give_coupon_to_users / revoke_referral_reward 는 service_role 만,
--    redeem_coupon_code 는 authenticated + service_role 이어야 정상
select p.proname,
       coalesce(string_agg(a.grantee, ', ' order by a.grantee), '(없음)') as 실행권한
from pg_proc p
join pg_namespace ns on ns.oid = p.pronamespace
left join lateral (
  select (aclexplode(p.proacl)).grantee::regrole::text as grantee
) a on true
where ns.nspname = 'public'
  and p.proname in ('add_points', 'give_coupon_to_users', 'revoke_referral_reward', 'redeem_coupon_code')
group by p.proname
order by p.proname;

-- ② 코드등록 허용 쿠폰 (처음엔 0건이 정상 — 관리자 화면 쿠폰 수정에서 켤 수 있음)
select count(*) as 코드등록_허용_쿠폰수 from public.coupons where code_redeemable;

-- ③ 새 정책 2개 확인
select tablename, policyname, cmd from pg_policies
where schemaname = 'public' and policyname in ('referrals_admin_read', 'referral_rewards_admin_read')
order by tablename;
