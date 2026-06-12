-- point_logs: 본인 포인트 원장 INSERT 허용 (0원/적립금 전액 결제 등 클라이언트 경로용)
-- 잔액(point_balance)은 별도 관리되므로 원장은 표시용. 본인 user_id 행만 기록 가능.

DROP POLICY IF EXISTS "point_logs self insert" ON point_logs;
CREATE POLICY "point_logs self insert"
  ON point_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
