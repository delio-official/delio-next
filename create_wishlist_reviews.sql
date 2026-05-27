-- =====================================================
-- 찜(위시리스트) / 리뷰 테이블
-- Supabase SQL Editor에서 실행하세요
-- =====================================================

-- ─────────────────────────────────────
-- wishlist
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wishlist (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id uuid        REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, product_id)
);

ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own wishlist"
  ON public.wishlist FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────
-- reviews
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id  uuid        REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id    uuid        REFERENCES public.orders(id) ON DELETE SET NULL,
  rating      integer     NOT NULL CHECK (rating >= 1 AND rating <= 5),
  content     text        NOT NULL DEFAULT '',
  image_urls  text[]      DEFAULT '{}',
  likes_count integer     DEFAULT 0,
  is_best     boolean     DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- 전체 공개 읽기
CREATE POLICY "Anyone can read reviews"
  ON public.reviews FOR SELECT
  USING (true);

-- 로그인 유저만 작성
CREATE POLICY "Authenticated users can insert reviews"
  ON public.reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 본인 리뷰만 수정/삭제
CREATE POLICY "Users can update own reviews"
  ON public.reviews FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reviews"
  ON public.reviews FOR DELETE
  USING (auth.uid() = user_id);

-- avg_rating 자동 업데이트 트리거 (선택사항)
-- reviews가 insert/update/delete될 때 products.avg_rating 갱신
CREATE OR REPLACE FUNCTION public.update_product_avg_rating()
RETURNS trigger AS $$
BEGIN
  UPDATE public.products
  SET avg_rating = (
    SELECT ROUND(AVG(rating)::numeric, 1)
    FROM public.reviews
    WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
  )
  WHERE id = COALESCE(NEW.product_id, OLD.product_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_review_change ON public.reviews;
CREATE TRIGGER on_review_change
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE PROCEDURE public.update_product_avg_rating();
