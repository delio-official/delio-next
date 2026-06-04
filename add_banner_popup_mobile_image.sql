-- 메인배너/중간배너(banners) + 팝업(popups)에 모바일 전용 이미지 컬럼 추가
-- Supabase SQL Editor에서 실행

ALTER TABLE banners ADD COLUMN IF NOT EXISTS image_url_mobile text;
ALTER TABLE popups  ADD COLUMN IF NOT EXISTS image_url_mobile text;
