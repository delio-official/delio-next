-- ══════════════════════════════════════════
--  쿠폰 공개(회원 직접 다운로드) 플래그 추가
-- ══════════════════════════════════════════
-- is_public = true 인 쿠폰은 마이페이지/결제창의 '쿠폰 다운받기'에서
-- 회원이 직접 발급받을 수 있습니다.
alter table coupons add column if not exists is_public boolean not null default false;

-- 회원 본인 발급은 기존 user_coupons RLS(auth.uid() = user_id)로 이미 허용됨.
-- 별도 정책 불필요.
