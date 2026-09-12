-- ════════════════════════════════════════════════════════════════════
--  쿠폰 '등록용 코드'를 관리자 전용 테이블로 분리 (2026-09-12)
--  실행 위치: Supabase → SQL Editor → 전체 붙여넣기 → Run
--  전제: 아래 관리자 화면 코드 배포 완료 (쿠폰 수정 창의 '등록용 코드' 칸)
--
--  문제
--   coupons 테이블은 고객도 조회할 수 있어(다운로드 쿠폰 목록 표시용) code 값이 그대로 노출된다.
--   화면에서 감춰도 누구나 DB API로 직접 읽을 수 있어, 코드로 쿠폰을 받아가는 경로가 열린다.
--   (컬럼 단위 권한 제어는 관리자와 일반 회원이 똑같은 authenticated 역할이라 불가능
--    → 정산 계좌를 farm_bank_info 로 분리한 것과 같은 방식으로 처리한다)
--
--  조치
--   · 고객이 입력하는 '등록용 코드'는 관리자 전용 테이블(coupon_redeem_codes)에 보관
--   · coupons.code 는 내부 연결용으로 유지 (등급별 월 발급·생일 쿠폰이 이 코드로 연결됨)
--     → 고객이 읽어도 등록에 쓸 수 없으므로 무해
--   · redeem_coupon_code() 는 새 테이블만 조회 (SECURITY DEFINER = 고객 권한과 무관하게 동작)
-- ════════════════════════════════════════════════════════════════════

-- 1) 관리자 전용 등록코드 테이블
create table if not exists public.coupon_redeem_codes (
  coupon_id  uuid primary key references public.coupons(id) on delete cascade,
  code       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists coupon_redeem_codes_code_uq on public.coupon_redeem_codes (upper(code));

-- RLS: 관리자만. anon·일반 회원은 존재 자체를 읽을 수 없음
alter table public.coupon_redeem_codes enable row level security;
drop policy if exists coupon_redeem_codes_admin_all on public.coupon_redeem_codes;
create policy coupon_redeem_codes_admin_all on public.coupon_redeem_codes
  for all to authenticated using (public.is_current_user_admin()) with check (public.is_current_user_admin());
grant select, insert, update, delete on public.coupon_redeem_codes to authenticated;
-- anon 에게는 아무 권한도 주지 않음 (grant 없음 = 접근 불가)


-- 2) 쿠폰 코드 등록 — 관리자 전용 테이블의 코드만 인정
create or replace function public.redeem_coupon_code(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coupon coupons%rowtype;
  v_uid    uuid := auth.uid();
  v_cid    uuid;
  v_exp    timestamptz;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'message', '로그인이 필요합니다.');
  end if;

  /* 등록용 코드는 관리자 전용 테이블에서만 찾는다 (대소문자 무시).
     coupons.code(내부 연결용)로는 등록되지 않는다 — 그 값은 고객도 조회할 수 있기 때문. */
  select coupon_id into v_cid
    from coupon_redeem_codes
   where upper(code) = upper(btrim(p_code))
   limit 1;
  if v_cid is null then
    return json_build_object('ok', false, 'message', '유효하지 않은 쿠폰 코드입니다.');
  end if;

  select * into v_coupon from coupons where id = v_cid;
  if not found then
    return json_build_object('ok', false, 'message', '유효하지 않은 쿠폰 코드입니다.');
  end if;
  /* 자동 지급 쿠폰(가입·멤버십)은 코드로 받을 수 없음 */
  if coalesce(v_coupon.signup_grant, false) or coalesce(v_coupon.is_membership, false) then
    return json_build_object('ok', false, 'message', '유효하지 않은 쿠폰 코드입니다.');
  end if;
  if not coalesce(v_coupon.code_redeemable, false) then
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
end $$;
revoke execute on function public.redeem_coupon_code(text) from public, anon;
grant execute on function public.redeem_coupon_code(text) to authenticated, service_role;


-- ── 확인용 ──
-- ① 새 테이블 권한: 정책 1개(coupon_redeem_codes_admin_all)만 있고 anon 권한이 없어야 정상
select policyname, cmd, roles::text from pg_policies
where schemaname = 'public' and tablename = 'coupon_redeem_codes';
select grantee, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'coupon_redeem_codes' order by grantee, privilege_type;

-- ② 등록용 코드가 등록된 쿠폰 (처음엔 0건이 정상)
select count(*) as 등록용코드_보유쿠폰수 from public.coupon_redeem_codes;
