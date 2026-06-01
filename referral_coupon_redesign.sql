-- ══════════════════════════════════════════════════════════
--  친구초대 보상: 5,000원 쿠폰 지급 (멱등 발급 구조 포함)
-- ══════════════════════════════════════════════════════════
--  · 피추천인: 가입(추천코드 입력) 즉시 5,000원 쿠폰 1장
--  · 추천인  : 피추천인이 첫 구매 완료할 때마다 5,000원 쿠폰 1장 (추천 건별 누적)
--  · 쿠폰 사양: 5,000원 / 최소주문 20,000원 / 발급일로부터 30일
--  · 멱등성  : referral_rewards(referral_id, reward_type) 발급이력으로 추천 1건당 1장 보장
-- ══════════════════════════════════════════════════════════

-- A. 같은 쿠폰 여러 장 보유 허용 (추천인 다회 보상 위해 unique 제약 제거)
ALTER TABLE user_coupons DROP CONSTRAINT IF EXISTS user_coupons_user_id_coupon_id_key;

-- B. 친구초대 보상용 쿠폰 정의 (만료는 user_coupons.expires_at 으로 개별 관리)
INSERT INTO coupons (code, name, discount_type, discount_value, min_order_amount, max_discount_amount, starts_at, expires_at, is_active, is_public)
VALUES ('REFERRAL5000', '친구초대 5,000원 쿠폰', 'fixed', 5000, 20000, NULL, now(), NULL, true, false)
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name, discount_type = EXCLUDED.discount_type, discount_value = EXCLUDED.discount_value,
      min_order_amount = EXCLUDED.min_order_amount, is_active = true;

-- C. 발급 이력 테이블 (멱등키: referral 1건 + 보상유형 = 정확히 1회)
CREATE TABLE IF NOT EXISTS referral_rewards (
  referral_id    uuid        NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  reward_type    text        NOT NULL,              -- 'referrer' | 'referred'
  user_coupon_id uuid,                              -- 발급된 쿠폰 (환불 회수용)
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (referral_id, reward_type)            -- ← 멱등키
);
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;  -- 클라이언트 직접 접근 차단(함수는 DEFINER로 우회)

-- D. 피추천인 보상: referrals 등록(가입) 시 즉시 5,000원 쿠폰 1장 (30일)
CREATE OR REPLACE FUNCTION give_referred_coupon()
RETURNS TRIGGER AS $$
DECLARE cpn_id uuid; uc_id uuid;
BEGIN
  -- 멱등: 이미 이 추천 건의 referred 보상이 있으면 종료
  INSERT INTO referral_rewards (referral_id, reward_type) VALUES (NEW.id, 'referred')
  ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT id INTO cpn_id FROM coupons WHERE code = 'REFERRAL5000' LIMIT 1;
  IF cpn_id IS NOT NULL THEN
    INSERT INTO user_coupons (user_id, coupon_id, expires_at)
    VALUES (NEW.referred_id, cpn_id, now() + interval '30 days')
    RETURNING id INTO uc_id;
    UPDATE referral_rewards SET user_coupon_id = uc_id
     WHERE referral_id = NEW.id AND reward_type = 'referred';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS referred_coupon_trigger ON referrals;
CREATE TRIGGER referred_coupon_trigger
  AFTER INSERT ON referrals
  FOR EACH ROW EXECUTE FUNCTION give_referred_coupon();

-- E. 추천인 보상: 피추천인 첫 구매 완료 시 5,000원 쿠폰 1장
CREATE OR REPLACE FUNCTION handle_referral_reward()
RETURNS TRIGGER AS $$
DECLARE
  rec          RECORD;
  prior_orders INTEGER;
  cpn_id       uuid;
  uc_id        uuid;
BEGIN
  -- 보상 시점: 배송 완료(delivered)
  IF NEW.status <> 'delivered' THEN
    RETURN NEW;
  END IF;

  -- 첫 구매 판별: 이번 주문 말고 '배송완료된 주문'이 이미 있으면 첫 구매 아님
  SELECT COUNT(*) INTO prior_orders
  FROM orders
  WHERE user_id = NEW.user_id
    AND status = 'delivered'
    AND id != NEW.id;
  IF prior_orders > 0 THEN
    RETURN NEW;
  END IF;

  -- 이 사용자를 추천한 레코드
  SELECT * INTO rec FROM referrals WHERE referred_id = NEW.user_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- 멱등: 이 추천 건의 referrer 보상이 이미 있으면 종료 (트리거 중복 실행/경합 방지)
  INSERT INTO referral_rewards (referral_id, reward_type) VALUES (rec.id, 'referrer')
  ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  UPDATE referrals SET rewarded = true, rewarded_at = now() WHERE id = rec.id;

  SELECT id INTO cpn_id FROM coupons WHERE code = 'REFERRAL5000' LIMIT 1;
  IF cpn_id IS NOT NULL THEN
    INSERT INTO user_coupons (user_id, coupon_id, expires_at)
    VALUES (rec.referrer_id, cpn_id, now() + interval '30 days')
    RETURNING id INTO uc_id;
    UPDATE referral_rewards SET user_coupon_id = uc_id
     WHERE referral_id = rec.id AND reward_type = 'referrer';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS referral_reward_trigger ON orders;
CREATE TRIGGER referral_reward_trigger
  AFTER INSERT OR UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION handle_referral_reward();

-- F. 어드민 쿠폰 일괄 지급 함수도 unique 제약 비의존으로 갱신 (이미 보유(미사용) 시 건너뜀)
CREATE OR REPLACE FUNCTION give_coupon_to_users(p_coupon_id uuid, p_user_ids uuid[], p_expires_at timestamptz)
RETURNS INTEGER AS $$
DECLARE uid uuid; cnt integer := 0;
BEGIN
  FOREACH uid IN ARRAY p_user_ids LOOP
    IF NOT EXISTS (SELECT 1 FROM user_coupons WHERE user_id = uid AND coupon_id = p_coupon_id AND is_used = false) THEN
      INSERT INTO user_coupons (user_id, coupon_id, expires_at) VALUES (uid, p_coupon_id, p_expires_at);
      cnt := cnt + 1;
    END IF;
  END LOOP;
  RETURN cnt;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION give_coupon_to_users(uuid, uuid[], timestamptz) TO authenticated;

-- G. 추천 리워드 철회 (어드민): 미사용 쿠폰 회수 + 발급이력 삭제 + 추천 상태 초기화
CREATE OR REPLACE FUNCTION revoke_referral_reward(p_referral_id uuid)
RETURNS void AS $$
BEGIN
  -- 미사용 쿠폰만 회수 (이미 사용한 쿠폰은 회수 불가)
  DELETE FROM user_coupons uc
   USING referral_rewards rr
   WHERE rr.referral_id = p_referral_id
     AND uc.id = rr.user_coupon_id
     AND uc.is_used = false;
  -- 발급 이력 삭제 (재지급 가능하도록)
  DELETE FROM referral_rewards WHERE referral_id = p_referral_id;
  -- 추천 상태 초기화
  UPDATE referrals SET rewarded = false, rewarded_at = NULL WHERE id = p_referral_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION revoke_referral_reward(uuid) TO authenticated;

-- ══════════════════════════════════════════════════════════
--  H. referrals 보안 잠금: 가입 시 RPC로만 추천 등록 (공짜 쿠폰 발급 구멍 차단)
-- ══════════════════════════════════════════════════════════
-- 추천 등록 RPC: 피추천인 = 본인(auth.uid()), 셀프/중복/잘못된 코드 차단
CREATE OR REPLACE FUNCTION register_referral(p_code text)
RETURNS void AS $$
DECLARE
  v_me       uuid := auth.uid();
  v_referrer uuid;
BEGIN
  IF v_me IS NULL OR p_code IS NULL OR btrim(p_code) = '' THEN
    RETURN;
  END IF;
  -- 추천 코드 → 추천인 (대소문자 무시 매칭)
  SELECT id INTO v_referrer FROM profiles WHERE lower(referral_code) = lower(btrim(p_code)) LIMIT 1;
  IF v_referrer IS NULL THEN RETURN; END IF;        -- 잘못된 코드
  IF v_referrer = v_me THEN RETURN; END IF;         -- 셀프 추천 차단
  IF EXISTS (SELECT 1 FROM referrals WHERE referred_id = v_me) THEN RETURN; END IF;  -- 이미 추천받음
  INSERT INTO referrals (referrer_id, referred_id, rewarded)
  VALUES (v_referrer, v_me, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION register_referral(text) TO authenticated;

-- 일반 클라이언트의 직접 INSERT/UPDATE 차단 (정책 제거 = 불가, SECURITY DEFINER 함수/트리거는 우회)
DROP POLICY IF EXISTS "referrals_insert" ON referrals;
DROP POLICY IF EXISTS "referrals_update" ON referrals;
