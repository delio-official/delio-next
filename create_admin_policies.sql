-- =====================================================
-- 어드민 패널용 RLS 정책 추가
-- Supabase SQL Editor에서 실행하세요
-- =====================================================

-- ─────────────────────────────────────
-- orders 테이블 (공개 읽기 + 업데이트)
-- ─────────────────────────────────────
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 기존 정책 제거 후 재생성 (중복 방지)
DROP POLICY IF EXISTS "Anyone can read orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can update order status" ON public.orders;

CREATE POLICY "Anyone can read orders" ON public.orders
  FOR SELECT USING (true);

CREATE POLICY "Anyone can update order status" ON public.orders
  FOR UPDATE USING (true) WITH CHECK (true);

GRANT SELECT, UPDATE ON public.orders TO anon, authenticated;

-- ─────────────────────────────────────
-- order_items 테이블
-- ─────────────────────────────────────
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read order_items" ON public.order_items;

CREATE POLICY "Anyone can read order_items" ON public.order_items
  FOR SELECT USING (true);

GRANT SELECT ON public.order_items TO anon, authenticated;

-- ─────────────────────────────────────
-- profiles 테이블 (공개 읽기)
-- ─────────────────────────────────────
DROP POLICY IF EXISTS "Admin can read all profiles" ON public.profiles;

CREATE POLICY "Admin can read all profiles" ON public.profiles
  FOR SELECT USING (true);

GRANT SELECT ON public.profiles TO anon, authenticated;

-- ─────────────────────────────────────
-- reviews 테이블 (이미 public read 정책 있지만 GRANT 추가)
-- ─────────────────────────────────────
GRANT SELECT ON public.reviews TO anon, authenticated;

-- ─────────────────────────────────────
-- farm_inquiries 테이블 (공개 읽기 + 상태 업데이트)
-- ─────────────────────────────────────
DROP POLICY IF EXISTS "Admin can read farm_inquiries" ON public.farm_inquiries;
DROP POLICY IF EXISTS "Admin can update farm_inquiries" ON public.farm_inquiries;

CREATE POLICY "Admin can read farm_inquiries" ON public.farm_inquiries
  FOR SELECT USING (true);

CREATE POLICY "Admin can update farm_inquiries" ON public.farm_inquiries
  FOR UPDATE USING (true) WITH CHECK (true);

GRANT SELECT, UPDATE ON public.farm_inquiries TO anon, authenticated;

-- ─────────────────────────────────────
-- lounge_posts 테이블 (업데이트 권한 추가)
-- ─────────────────────────────────────
DROP POLICY IF EXISTS "Admin can update lounge_posts" ON public.lounge_posts;

CREATE POLICY "Admin can update lounge_posts" ON public.lounge_posts
  FOR UPDATE USING (true) WITH CHECK (true);

GRANT UPDATE ON public.lounge_posts TO anon, authenticated;

-- ─────────────────────────────────────
-- events 테이블 (업데이트 권한 추가)
-- ─────────────────────────────────────
DROP POLICY IF EXISTS "Admin can update events" ON public.events;

CREATE POLICY "Admin can update events" ON public.events
  FOR UPDATE USING (true) WITH CHECK (true);

GRANT UPDATE ON public.events TO anon, authenticated;
