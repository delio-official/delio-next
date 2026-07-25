-- 팝업: 내부 관리용 이름 + '오늘 하루 보지 않기' 버튼 표시 여부
--
-- name             : 관리자 목록/카드 식별용 내부 이름(고객 비노출)
-- show_today_close : 팝업 하단 '오늘 하루 보지 않기' 버튼 표시 여부(기본 true)

alter table public.popups
  add column if not exists name             text,
  add column if not exists show_today_close boolean not null default true;

comment on column public.popups.name             is '내부 관리용 팝업명(고객 비노출)';
comment on column public.popups.show_today_close is '오늘 하루 보지 않기 버튼 표시(기본 true)';
