-- 브랜드(농가) 기본정보 확장 — 운영 메모 / 은행정보 / 출고마감시간
--
-- 1) farm_memos : 브랜드별 운영 메모(누적). 회원 메모(member_memos)와 같은 구조.
-- 2) farms      : 은행명·계좌번호(적어두고 보는 용도), 출고마감시간(상품 기본값으로 상속)
-- 3) products   : 출고마감 상속이 실제로 동작하도록 기존 데이터 정리 (아래 설명 꼭 읽어주세요)

------------------------------------------------------------------
-- 1) 브랜드 운영 메모
------------------------------------------------------------------
create table if not exists public.farm_memos (
  id          uuid primary key default gen_random_uuid(),
  farm_id     uuid not null references public.farms(id) on delete cascade,
  content     text not null,
  admin_name  text,
  created_at  timestamptz not null default now()
);
create index if not exists farm_memos_farm_idx on public.farm_memos(farm_id, created_at desc);

-- RLS: 관리자만 조회/작성/삭제
alter table public.farm_memos enable row level security;
drop policy if exists farm_memos_admin_all on public.farm_memos;
create policy farm_memos_admin_all on public.farm_memos
  for all using (public.is_current_user_admin()) with check (public.is_current_user_admin());
grant select, insert, update, delete on public.farm_memos to authenticated;

------------------------------------------------------------------
-- 2) 브랜드 은행정보 + 출고마감시간
------------------------------------------------------------------
-- 은행명/계좌번호: 정산 자동연동 아님. 관리자만 보는 기록용.
-- (RLS로 anon 차단되어 있어 고객 화면에는 절대 노출되지 않음)
alter table public.farms add column if not exists bank_name       text;
alter table public.farms add column if not exists bank_account    text;
alter table public.farms add column if not exists dispatch_cutoff text;

-- dispatch_cutoff 규칙
--   null  = 사이트 전체 설정을 따라감
--   '12:00' 등 = 이 브랜드만 그 시간으로 고정
comment on column public.farms.dispatch_cutoff is
  '출고마감시간. null이면 사이트 전체 설정을 따름. 값이 있으면 이 브랜드 상품의 기본값이 됨.';

------------------------------------------------------------------
-- 3) [중요] 기존 상품 출고마감 정리
------------------------------------------------------------------
-- 문제: 사이트 전체 설정은 이미 12:00인데, 상품 11개에 '11:00'이 값으로 박혀 있어
--       전체 설정을 바꿔도 그 상품들이 따라오지 않는 상태입니다.
--       상품 등록폼의 기본값이 '11:00' 하드코딩이라 저장할 때 자동으로 박힌 값입니다
--       (사장님이 상품마다 일부러 11시로 고른 게 아님).
--
-- 요청하신 규칙 = "전체를 바꾸면 다 바뀌고, 따로 정한 것만 그 값을 유지"
-- 이 규칙이 성립하려면 자동으로 박힌 '11:00'을 비워서 상속 상태로 되돌려야 합니다.
--
-- 아래는 '11:00'만 비웁니다. 10:30으로 따로 지정된 1건은 의도적 설정으로 보고 그대로 둡니다.
-- ※ 혹시 11시가 일부러 지정한 값이라면 이 UPDATE는 실행하지 마세요.
--   (실행 안 해도 나머지 기능은 정상 동작합니다. 대신 전체 설정 변경이 그 11개엔 반영되지 않습니다.)

update public.products set dispatch_cutoff = null where dispatch_cutoff = '11:00';

------------------------------------------------------------------
-- 확인용
------------------------------------------------------------------
-- select name, region, bank_name, bank_account, dispatch_cutoff from public.farms order by name;
-- select dispatch_cutoff, count(*) from public.products group by 1;
