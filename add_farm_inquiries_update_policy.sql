-- farm_inquiries: 관리자 상태 변경(수락/거절) 허용
-- 증상: 어드민에서 입점문의 수락/거절 처리해도 새로고침 시 '대기중'으로 되돌아감
-- 원인: UPDATE 정책 없으면 RLS가 변경을 막음(코드는 에러 무시했었음 → 이번에 에러 노출 추가)

DROP POLICY IF EXISTS "farm_inquiries admin update" ON farm_inquiries;
CREATE POLICY "farm_inquiries admin update"
  ON farm_inquiries FOR UPDATE
  TO authenticated
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());

-- 관리자 조회도 함께 보장(이미 보이면 무해)
DROP POLICY IF EXISTS "farm_inquiries admin select" ON farm_inquiries;
CREATE POLICY "farm_inquiries admin select"
  ON farm_inquiries FOR SELECT
  TO authenticated
  USING (is_current_user_admin());
