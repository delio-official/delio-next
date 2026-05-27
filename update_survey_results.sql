-- =====================================================
-- survey_results 테이블 컬럼 추가
-- 웰니스 라이프 유형 진단 (v2) 대응
-- Supabase SQL Editor에서 실행하세요
-- =====================================================

ALTER TABLE public.survey_results
  ADD COLUMN IF NOT EXISTS gender            text,   -- male | female | none
  ADD COLUMN IF NOT EXISTS age_group         text,   -- 10s | 20s | 30s | 40s | 50s | 60plus
  ADD COLUMN IF NOT EXISTS family_size       text,   -- 1 | 2 | 3-4 | 5plus
  ADD COLUMN IF NOT EXISTS result_type       text,   -- 새벽 | 이슬 | 여름 | 가을 | 봄 | 바람 | 불꽃 | 달빛
  ADD COLUMN IF NOT EXISTS axis1             text,   -- routine | free
  ADD COLUMN IF NOT EXISTS axis2             text,   -- care | self
  ADD COLUMN IF NOT EXISTS axis3             text,   -- vitamin | healing
  ADD COLUMN IF NOT EXISTS purchase_frequency text,  -- Q9 마케팅
  ADD COLUMN IF NOT EXISTS purchase_purpose  text,   -- Q10 마케팅
  ADD COLUMN IF NOT EXISTS decision_factor   text,   -- Q11 마케팅
  ADD COLUMN IF NOT EXISTS texture_pref      text;   -- Q8 식감 (동수 보조)
