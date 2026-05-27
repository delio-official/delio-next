-- =====================================================
-- 폼 제출 테이블: 입점문의 / 환불신청 / 취향설문
-- Supabase SQL Editor에서 실행하세요
-- =====================================================

-- ─────────────────────────────────────
-- farm_inquiries (입점/협업 문의)
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.farm_inquiries (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  inquiry_type text        NOT NULL DEFAULT 'listing',  -- listing | collab | other
  company      text        NOT NULL,
  contact      text        NOT NULL,
  email        text        NOT NULL,
  message      text        NOT NULL,
  status       text        DEFAULT 'pending',           -- pending | reviewed | replied
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.farm_inquiries ENABLE ROW LEVEL SECURITY;

-- 누구나 삽입 가능 (비로그인도 문의 가능)
CREATE POLICY "Anyone can insert farm inquiry"
  ON public.farm_inquiries FOR INSERT
  WITH CHECK (true);

-- 조회는 관리자만 (현재는 서비스롤로만 가능)
-- 일반 유저 조회 정책 없음 → 어드민에서 service_role key로 조회


-- ─────────────────────────────────────
-- refund_requests (환불/교환 신청)
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.refund_requests (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id   uuid        REFERENCES public.orders(id) ON DELETE SET NULL,
  user_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  reason     text        NOT NULL,
  detail     text        DEFAULT '',
  status     text        DEFAULT 'pending',             -- pending | processing | completed | rejected
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

-- 본인 환불 신청 조회/삽입
CREATE POLICY "Users can insert own refund requests"
  ON public.refund_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own refund requests"
  ON public.refund_requests FOR SELECT
  USING (auth.uid() = user_id);


-- ─────────────────────────────────────
-- survey_results (취향 설문 결과)
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.survey_results (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  answers         jsonb,                                -- { "1": 0, "2": 1, ... }
  result_category text,                                 -- apple | citrus | berry | ...
  result_label    text,
  result_desc     text,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.survey_results ENABLE ROW LEVEL SECURITY;

-- 비로그인도 설문 저장 가능 (user_id = null)
CREATE POLICY "Anyone can insert survey results"
  ON public.survey_results FOR INSERT
  WITH CHECK (true);

-- 본인 결과만 조회
CREATE POLICY "Users can read own survey results"
  ON public.survey_results FOR SELECT
  USING (user_id IS NULL OR auth.uid() = user_id);
