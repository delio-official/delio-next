-- ============================================================
-- 쿠폰 코드 등록 기능
--  · coupons.code : 사용자가 직접 입력해 등록하는 쿠폰 코드 (대/소문자 구분)
--  · redeem_coupon_code(text) : 코드로 본인 계정에 쿠폰 발급 (SECURITY DEFINER)
-- ============================================================

alter table coupons add column if not exists code text;
create unique index if not exists coupons_code_uq on coupons(code) where code is not null;

create or replace function redeem_coupon_code(p_code text)
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

grant execute on function redeem_coupon_code(text) to authenticated;
