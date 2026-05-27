-- =====================================================
-- 배송지 관리 테이블
-- Supabase SQL Editor에서 실행하세요
-- =====================================================

CREATE TABLE IF NOT EXISTS public.shipping_addresses (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  label       text        DEFAULT '',       -- 집, 회사 등 별칭
  recipient   text        NOT NULL,
  phone       text        NOT NULL,
  zipcode     text        DEFAULT '',
  address1    text        NOT NULL,
  address2    text        DEFAULT '',
  is_default  boolean     DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.shipping_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own addresses" ON public.shipping_addresses;
CREATE POLICY "Users can manage own addresses"
  ON public.shipping_addresses FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
