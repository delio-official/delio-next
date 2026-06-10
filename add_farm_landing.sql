-- ══════════════════════════════════════════════════════════════
--  농가 상세페이지용 — 썸네일 + 랜딩 이미지(긴 이미지 여러 장)
--  ⚠️ Supabase SQL Editor 에서 1회 실행
-- ══════════════════════════════════════════════════════════════
alter table public.farms add column if not exists thumbnail_url  text;        -- 대표 썸네일 (상세 상단 우측)
alter table public.farms add column if not exists landing_images text[];      -- 랜딩(상세설명) 이미지 URL 목록, 위→아래 순서
