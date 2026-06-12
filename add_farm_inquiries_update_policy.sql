-- farm_inquiries 입점문의 수락/거절 처리 가능하게 정리
-- 증상: 거절 시 "violates check constraint farm_inquiries_status_check"
-- 원인: status 컬럼 CHECK 제약이 'pending','done'만 허용 → 'rejected' 거부
--        (수락은 코드에서 'done'으로 바꿔 SQL 없이도 동작. 거절만 이 SQL 필요)

-- 1) status 허용값에 'rejected' 추가 (기존 pending/done 유지 + 안전하게 answered/new 포함)
ALTER TABLE farm_inquiries DROP CONSTRAINT IF EXISTS farm_inquiries_status_check;
ALTER TABLE farm_inquiries ADD CONSTRAINT farm_inquiries_status_check
  CHECK (status IN ('pending', 'new', 'done', 'answered', 'rejected'));

-- 2) 관리자 UPDATE/SELECT 정책 (이미 통과했다면 무해 — 혹시 모를 RLS 대비)
DROP POLICY IF EXISTS "farm_inquiries admin update" ON farm_inquiries;
CREATE POLICY "farm_inquiries admin update"
  ON farm_inquiries FOR UPDATE
  TO authenticated
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());
