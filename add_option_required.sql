-- 옵션 그룹별 필수/선택 여부
-- Supabase SQL Editor에서 실행
ALTER TABLE product_options ADD COLUMN IF NOT EXISTS is_required boolean DEFAULT true;
