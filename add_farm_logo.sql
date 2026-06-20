-- 농가 로고 (메인 브랜드 직송관 카드 농가명 좌측 동그라미용)
-- Supabase SQL Editor에서 1회 실행
ALTER TABLE farms ADD COLUMN IF NOT EXISTS logo_url text;
