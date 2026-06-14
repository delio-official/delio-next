-- 후기요청 알림톡 자동발송용 — 중복 방지 플래그
-- 배송완료 N일 후 후기요청 알림톡을 1회만 보내기 위함
ALTER TABLE orders ADD COLUMN IF NOT EXISTS review_request_sent boolean NOT NULL DEFAULT false;

-- (선택) 후기요청 자동발송 on/off 토글 — 기본 on. 끄려면 value를 'false'로.
INSERT INTO site_settings (key, value)
VALUES ('review_request_on', 'true')
ON CONFLICT (key) DO NOTHING;
