-- ══════════════════════════════════════════════════════════════
--  리뷰 평점 트리거 보강 — 리뷰 0개여도 안전(avg null 방지) + review_count 동기화
--  기존: avg_rating = AVG(rating) → 리뷰 0개면 null → NOT NULL 위반(삭제 막힘)
--  수정: COALESCE(...,0) + review_count = COUNT(*)
--  ⚠️ Supabase SQL Editor 에서 1회 실행
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.update_product_avg_rating()
RETURNS trigger AS $$
BEGIN
  UPDATE public.products
  SET avg_rating = COALESCE((
        SELECT ROUND(AVG(rating)::numeric, 1)
        FROM public.reviews
        WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
      ), 0),
      review_count = (
        SELECT COUNT(*)
        FROM public.reviews
        WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
      )
  WHERE id = COALESCE(NEW.product_id, OLD.product_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
