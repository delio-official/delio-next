-- farms 신규 등록 실패 — 옛 스키마의 NOT NULL 제약 일괄 해제
--
-- 배경: farms 테이블은 초기 설계 때 농가 소개용 필드가 많았고 일부에 NOT NULL이 걸려 있음.
--       현재 브랜드 등록 폼은 name / slug / farmer_name / region / items / intro /
--       carrier / dispatch_cutoff / thumbnail_url / logo_url / landing_images 만 보냄.
--       폼이 보내지 않는(또는 비워둘 수 있는) 컬럼에 NOT NULL이 남아 있으면
--       "null value in column ... violates not-null constraint" 로 등록이 막힘.
--       실제로 farm_type → region 순으로 연달아 걸렸음.
--
-- 조치: 필수로 남겨야 하는 것(id, slug, name, 상태 플래그, 타임스탬프)만 두고
--       설명·이미지·옛 필드는 모두 nullable 로 변경.
--       이미 nullable 인 컬럼에 실행해도 아무 일도 일어나지 않음(안전, 재실행 가능).

alter table public.farms alter column region            drop not null;
alter table public.farms alter column farm_type         drop not null;
alter table public.farms alter column intro             drop not null;
alter table public.farms alter column story             drop not null;
alter table public.farms alter column thumbnail_url     drop not null;
alter table public.farms alter column hero_image_url    drop not null;
alter table public.farms alter column farmer_name       drop not null;
alter table public.farms alter column farmer_image_url  drop not null;
alter table public.farms alter column founded_year      drop not null;
alter table public.farms alter column altitude          drop not null;
alter table public.farms alter column soil_type         drop not null;
alter table public.farms alter column annual_output     drop not null;
alter table public.farms alter column carrier           drop not null;
alter table public.farms alter column logo_url          drop not null;
alter table public.farms alter column landing_images    drop not null;
alter table public.farms alter column items             drop not null;

-- 확인용: 아직 NOT NULL 인 컬럼 목록 (id, slug, name, is_partner, is_active,
--         is_own, created_at, updated_at 정도만 남아야 정상)
-- select column_name, is_nullable
--   from information_schema.columns
--  where table_schema='public' and table_name='farms' and is_nullable='NO'
--  order by ordinal_position;
