-- 후기 신고 사유 저장용 컬럼 추가
ALTER TABLE review_reports ADD COLUMN IF NOT EXISTS reason text;
