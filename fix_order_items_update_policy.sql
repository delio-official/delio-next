-- order_items 송장 저장(농가별 배송 처리)이 RLS에 막히는 문제 수정
-- 기존엔 SELECT 권한만 있어 order_items UPDATE 가 거부됨 → 송장 저장 안 됨.
-- Supabase SQL Editor에서 실행해주세요.

DROP POLICY IF EXISTS "Anyone can update order_items" ON public.order_items;

CREATE POLICY "Anyone can update order_items" ON public.order_items
  FOR UPDATE USING (true) WITH CHECK (true);

GRANT UPDATE ON public.order_items TO anon, authenticated;
