-- 보안 1단계 보정 (2026-09-12) — 고객 쿠폰 다운로드 실패 수정
-- 원인: 받은 쿠폰의 grant_period 칸은 비울 수 없는데(기본값 ''), 1단계에서 null 로 넣어 다운로드가 거부됨
-- 실행 위치: Supabase → SQL Editor → 전체 붙여넣기 → Run
create or replace function public.protect_user_coupon_columns()
returns trigger language plpgsql as $$
declare c record;
begin
  if public.is_direct_non_admin() then
    if tg_op = 'INSERT' then
      select valid_days, expires_at into c from public.coupons where id = new.coupon_id;
      new.is_used := false; new.used_at := null; new.grant_period := ''; new.expiry_notified := false;
      new.issued_at := now();
      new.expires_at := case when c.valid_days is not null then now() + make_interval(days => c.valid_days)
                             else c.expires_at end;
    else
      new.user_id := old.user_id; new.coupon_id := old.coupon_id; new.issued_at := old.issued_at;
      new.expires_at := old.expires_at; new.grant_period := old.grant_period; new.expiry_notified := old.expiry_notified;
      if old.is_used then new.is_used := true; new.used_at := old.used_at; end if;   -- 쓴 쿠폰 되살리기 금지
    end if;
  end if;
  return new;
end $$;

select 'OK — 쿠폰 다운로드 보정 완료' as result;
