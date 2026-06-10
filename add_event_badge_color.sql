-- 이벤트 배지 색상 컬럼 추가 (배지 텍스트별 색상 지정)
-- 실행: Supabase SQL Editor 1회.

alter table public.events
  add column if not exists badge_color text;

-- 기존 배지 있는 이벤트 기본색(초록) 채우기(선택)
update public.events set badge_color = '#1A8A4C'
  where badge is not null and badge <> '' and badge_color is null;
