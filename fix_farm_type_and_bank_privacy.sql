-- 두 가지 수정
--   1) 브랜드 등록 실패 — farms.farm_type NOT NULL 제약 해제
--   2) 계좌번호가 비로그인 고객에게 그대로 노출되는 문제 — 별도 테이블로 분리

------------------------------------------------------------------
-- 1) farm_type NOT NULL 해제
------------------------------------------------------------------
-- 배경: 농가 구분을 재배방식(노지/비닐하우스) → 취급 품목(items)으로 바꾸면서
--       화면에서 farm_type을 더 이상 입력받지 않는데 DB에 NOT NULL이 남아 있어
--       신규 브랜드 등록이 "null value in column farm_type ... violates not-null" 로 실패함.
-- 컬럼 자체는 과거 데이터 보존을 위해 남겨두고 제약만 푼다.

alter table public.farms alter column farm_type drop not null;

------------------------------------------------------------------
-- 2) 은행정보 분리 (중요)
------------------------------------------------------------------
-- 문제: farms 테이블은 농가 소개 페이지 때문에 anon(비로그인) 조회가 열려 있음.
--       여기에 bank_name / bank_account 컬럼을 얹으면 아무나 읽을 수 있음.
--       실제로 익명 키로 조회했을 때 HTTP 200으로 값이 내려오는 것을 확인함.
--
-- 조치: 은행정보를 관리자 전용 별도 테이블로 옮기고, farms에서는 컬럼을 제거한다.
--       (컬럼 단위 권한 제어는 관리자와 일반 회원이 똑같은 authenticated 역할이라 불가능)

create table if not exists public.farm_bank_info (
  farm_id      uuid primary key references public.farms(id) on delete cascade,
  bank_name    text,
  bank_account text,
  updated_at   timestamptz not null default now()
);

-- RLS: 관리자만. anon/일반 회원은 존재 자체를 읽을 수 없음
alter table public.farm_bank_info enable row level security;
drop policy if exists farm_bank_info_admin_all on public.farm_bank_info;
create policy farm_bank_info_admin_all on public.farm_bank_info
  for all using (public.is_current_user_admin()) with check (public.is_current_user_admin());
grant select, insert, update, delete on public.farm_bank_info to authenticated;
-- anon 에게는 아무 권한도 주지 않음 (grant 없음 = 접근 불가)

-- 혹시 이미 입력된 값이 있으면 옮기고, farms 쪽 컬럼은 삭제
insert into public.farm_bank_info (farm_id, bank_name, bank_account)
select id, bank_name, bank_account from public.farms
where bank_name is not null or bank_account is not null
on conflict (farm_id) do nothing;

alter table public.farms drop column if exists bank_name;
alter table public.farms drop column if exists bank_account;

------------------------------------------------------------------
-- 확인용
------------------------------------------------------------------
-- select column_name from information_schema.columns
--  where table_name='farms' and column_name in ('bank_name','bank_account');   -- 0건이어야 정상
-- select is_nullable from information_schema.columns
--  where table_name='farms' and column_name='farm_type';                        -- YES 여야 정상
