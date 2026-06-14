-- 후기 작성자 표시명(마스킹) 저장 컬럼
-- 증상: 관리자 외(일반회원·비회원)에겐 후기 작성자가 전부 "익명"으로 뜸
-- 원인: profiles RLS가 남의 프로필 name 조회를 막아 profiles.name = null → 익명
-- 해결: 리뷰에 마스킹된 표시명을 직접 저장 → RLS 무관하게 표시

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS author_name text;

-- 기존 리뷰 백필: 작성자 이름 첫 글자 + **** (예: 김****)
UPDATE reviews r
SET author_name = left(p.name, 1) || '****'
FROM profiles p
WHERE p.id = r.user_id
  AND p.name IS NOT NULL
  AND (r.author_name IS NULL OR r.author_name = '');
