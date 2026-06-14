-- 탈퇴 사유 저장 (선택) — withdrawn_users에 reason 컬럼
-- 없어도 탈퇴는 정상 동작(사유만 미기록). 사유 통계를 보려면 실행.
ALTER TABLE withdrawn_users ADD COLUMN IF NOT EXISTS reason text;
