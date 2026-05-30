-- =====================================================
-- 친구 추천 시스템
-- Supabase SQL Editor에서 실행하세요
-- =====================================================

-- 1. profiles에 referral_code 컬럼 추가
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- 2. referrals 테이블
CREATE TABLE IF NOT EXISTS public.referrals (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID        REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id UUID        REFERENCES public.profiles(id) ON DELETE CASCADE,
  code        TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'pending', -- pending | rewarded
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referred_id) -- 한 사람은 한 번만 추천받을 수 있음
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referrals_read_own"
  ON public.referrals FOR SELECT
  USING (referrer_id = auth.uid() OR referred_id = auth.uid());

CREATE POLICY "referrals_insert"
  ON public.referrals FOR INSERT
  WITH CHECK (true);

CREATE POLICY "referrals_update"
  ON public.referrals FOR UPDATE
  USING (true);

GRANT ALL ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;

-- 3. 첫 주문 완료 시 보상 지급 함수
CREATE OR REPLACE FUNCTION handle_referral_reward()
RETURNS TRIGGER AS $$
DECLARE
  rec          RECORD;
  prior_orders INTEGER;
BEGIN
  -- 주문이 paid 상태로 생성/변경될 때만 실행
  IF NEW.status NOT IN ('paid', 'preparing') THEN
    RETURN NEW;
  END IF;

  -- 이미 이전에 완료된 주문이 있으면 첫 주문 아님
  SELECT COUNT(*) INTO prior_orders
  FROM public.orders
  WHERE user_id = NEW.user_id
    AND status IN ('paid', 'preparing', 'shipped', 'delivered')
    AND id != NEW.id;

  IF prior_orders > 0 THEN
    RETURN NEW;
  END IF;

  -- pending 상태 추천 레코드 찾기
  SELECT * INTO rec
  FROM public.referrals
  WHERE referred_id = NEW.user_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- 보상 지급
  UPDATE public.referrals SET status = 'rewarded' WHERE id = rec.id;
  UPDATE public.profiles SET point_balance = point_balance + 1000 WHERE id = rec.referrer_id;
  UPDATE public.profiles SET point_balance = point_balance + 1000 WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 트리거 등록
DROP TRIGGER IF EXISTS referral_reward_trigger ON public.orders;
CREATE TRIGGER referral_reward_trigger
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION handle_referral_reward();
