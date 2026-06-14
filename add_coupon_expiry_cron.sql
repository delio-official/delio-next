-- 쿠폰 소멸 임박 알림톡 자동발송용 — 중복 방지 플래그
-- 만료 N일 전 1회만 발송
ALTER TABLE user_coupons ADD COLUMN IF NOT EXISTS expiry_notified boolean NOT NULL DEFAULT false;

-- (선택) 쿠폰소멸 알림 on/off 토글 — 기본 on. 끄려면 value를 'false'로.
INSERT INTO site_settings (key, value)
VALUES ('coupon_expiry_on', 'true')
ON CONFLICT (key) DO NOTHING;
