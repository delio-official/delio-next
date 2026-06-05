-- 회원가입 자동 지급 쿠폰(웰컴 쿠폰팩)
-- 1) coupons에 signup_grant 플래그: true면 회원가입 시 자동 발급 대상
alter table public.coupons
  add column if not exists signup_grant boolean not null default false;

-- 2) 회원가입 시 호출되는 발급 함수 (SECURITY DEFINER — 본인에게만, 멱등)
create or replace function public.grant_signup_coupons()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_count integer := 0;
  c       record;
begin
  if v_uid is null then
    return 0;
  end if;

  for c in
    select id, expires_at
    from public.coupons
    where signup_grant = true and is_active = true
  loop
    -- 이미 보유한 쿠폰은 건너뜀 (멱등)
    if not exists (
      select 1 from public.user_coupons
      where user_id = v_uid and coupon_id = c.id
    ) then
      insert into public.user_coupons (user_id, coupon_id, is_used, expires_at)
      values (v_uid, c.id, false, c.expires_at);
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.grant_signup_coupons() to authenticated;
