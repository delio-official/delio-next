-- 신규가입 쿠폰: "계정당 딱 1번만" 지급되도록 수정
-- 기존 버그: 소셜(카카오/네이버) 로그인은 로그인할 때마다 grant_signup_coupons()가 돌아,
--            나중에 새 signup_grant 쿠폰을 켜면 기존 회원도 다음 로그인 때 받아버림.
-- 해결: profiles.signup_coupons_granted 플래그로 계정당 1회만 지급. 기존 회원은 '지급완료'로 백필.

-- 1) '지급 완료' 플래그 추가 (기존 행은 default false)
alter table public.profiles
  add column if not exists signup_coupons_granted boolean not null default false;

-- 2) 기존 회원은 이미 가입 시 지급받았으므로 '지급 완료'로 표시 → 앞으로 새 쿠폰을 켜도 재지급 안 됨
update public.profiles set signup_coupons_granted = true;

-- 3) 발급 함수: 이미 지급받은 계정이면 아무것도 안 하고 종료
create or replace function public.grant_signup_coupons()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_done  boolean;
  v_count integer := 0;
  c       record;
begin
  if v_uid is null then
    return 0;
  end if;

  -- 계정당 1회만: 이미 지급 완료면 재지급하지 않음 (재로그인·쿠폰 추가 시 재지급 방지)
  select signup_coupons_granted into v_done from public.profiles where id = v_uid;
  if coalesce(v_done, false) then
    return 0;
  end if;

  for c in
    select id, expires_at
    from public.coupons
    where signup_grant = true and is_active = true
  loop
    -- 혹시 이미 보유한 쿠폰은 건너뜀(안전)
    if not exists (
      select 1 from public.user_coupons
      where user_id = v_uid and coupon_id = c.id
    ) then
      insert into public.user_coupons (user_id, coupon_id, is_used, expires_at)
      values (v_uid, c.id, false, c.expires_at);
      v_count := v_count + 1;
    end if;
  end loop;

  -- 지급 완료 표시
  update public.profiles set signup_coupons_granted = true where id = v_uid;
  return v_count;
end;
$$;

grant execute on function public.grant_signup_coupons() to authenticated;
