-- product_detail_sections 테이블 RLS + 정책 설정
-- Supabase 대시보드 > SQL Editor에서 실행하세요

-- 1. 테이블이 없으면 생성
CREATE TABLE IF NOT EXISTS product_detail_sections (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id   uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  section_type text NOT NULL DEFAULT 'html',
  content      text,
  sort_order   int  NOT NULL DEFAULT 0,
  created_at   timestamptz DEFAULT now()
);

-- 2. RLS 활성화
ALTER TABLE product_detail_sections ENABLE ROW LEVEL SECURITY;

-- 3. 기존 정책 제거 (있을 경우)
DROP POLICY IF EXISTS "sections_select" ON product_detail_sections;
DROP POLICY IF EXISTS "sections_insert" ON product_detail_sections;
DROP POLICY IF EXISTS "sections_update" ON product_detail_sections;
DROP POLICY IF EXISTS "sections_delete" ON product_detail_sections;

-- 4. 정책 생성 (전체 허용 — 어드민 전용 앱이므로)
CREATE POLICY "sections_select" ON product_detail_sections FOR SELECT USING (true);
CREATE POLICY "sections_insert" ON product_detail_sections FOR INSERT WITH CHECK (true);
CREATE POLICY "sections_update" ON product_detail_sections FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "sections_delete" ON product_detail_sections FOR DELETE USING (true);

-- 5. 권한 부여
GRANT ALL ON product_detail_sections TO authenticated, anon;
