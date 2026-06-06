-- 쿠폰 유효기간(발급일로부터 N일) — 자동발급/다운로드 시 각 사용자별 만료일 계산용
-- valid_days 가 NULL 이면 기존처럼 절대 만료일(expires_at) 사용.
alter table public.coupons
  add column if not exists valid_days integer;

-- 회원가입 자동지급: 발급 시점 + valid_days 로 user_coupons.expires_at 설정
create or replace function public.grant_signup_coupons()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_count   integer := 0;
  v_expires timestamptz;
  c         record;
begin
  if v_uid is null then return 0; end if;
  for c in
    select id, expires_at, valid_days from public.coupons
    where signup_grant = true and is_active = true
  loop
    if not exists (select 1 from public.user_coupons where user_id = v_uid and coupon_id = c.id) then
      v_expires := case when c.valid_days is not null
                        then now() + (c.valid_days || ' days')::interval
                        else c.expires_at end;
      insert into public.user_coupons (user_id, coupon_id, is_used, expires_at)
      values (v_uid, c.id, false, v_expires);
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end; $$;
grant execute on function public.grant_signup_coupons() to authenticated;
