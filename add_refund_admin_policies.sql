-- ══════════════════════════════════════════
--  환불 신청(refund_requests) 어드민 조회/처리 정책
-- ══════════════════════════════════════════
-- 어드민 패널이 모든 환불 신청을 조회/상태변경할 수 있도록
-- (기존 패턴과 동일: 공개 읽기/업데이트 + GRANT. 어드민 접근은 앱단에서 통제)

DROP POLICY IF EXISTS "Admin read refund_requests" ON public.refund_requests;
DROP POLICY IF EXISTS "Admin update refund_requests" ON public.refund_requests;

CREATE POLICY "Admin read refund_requests" ON public.refund_requests
  FOR SELECT USING (true);

CREATE POLICY "Admin update refund_requests" ON public.refund_requests
  FOR UPDATE USING (true) WITH CHECK (true);

GRANT SELECT, UPDATE ON public.refund_requests TO anon, authenticated;
