-- 배너: 내부 관리용 이름 + 노출 기간(선택)
--
-- name       : 관리자 목록/카드에서 식별하기 위한 내부 이름(고객에게 안 보임)
-- starts_at  : 노출 시작일(비우면 즉시)
-- ends_at    : 노출 종료일(비우면 상시)
--
-- 기간이 지정된 배너는 프론트에서 기간 내에만 노출하도록 처리(추후). 지금은 관리 표기용.

alter table public.banners
  add column if not exists name       text,
  add column if not exists starts_at  timestamptz,
  add column if not exists ends_at     timestamptz;

comment on column public.banners.name      is '내부 관리용 배너명(고객 비노출)';
comment on column public.banners.starts_at is '노출 시작일(비우면 즉시)';
comment on column public.banners.ends_at   is '노출 종료일(비우면 상시)';
