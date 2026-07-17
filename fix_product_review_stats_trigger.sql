-- products.review_count 도 트리거가 관리하도록 (기존엔 avg_rating 만 갱신)
--
-- [문제]
--  상품페이지는 리뷰를 최근 50개만 불러오는데, 리뷰 작성/수정 후 그 배열 길이로
--  products.review_count 와 avg_rating 을 덮어쓰고 있었다.
--    → 리뷰가 50개를 넘는 순간 review_count 가 50으로 깎이고,
--      트리거가 전체 리뷰로 정확히 계산해둔 avg_rating 까지 '최근 50개 평균'으로 클로버됨.
--  또 review_count 를 트리거가 관리하지 않아 리뷰 삭제 시 개수가 어긋났다
--  (실제로 골드키위에서 발생해 수동 보정한 이력 있음).
--
-- [해결]
--  INSERT/UPDATE/DELETE 시 트리거가 전체 리뷰를 세서 avg_rating + review_count 를 함께 갱신.
--  클라이언트는 더 이상 이 값들을 쓰지 않고 서버 값을 읽기만 한다.
--
-- 트리거(on_review_change)는 이미 존재하므로 함수만 교체하면 된다.

CREATE OR REPLACE FUNCTION public.update_product_avg_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid uuid := COALESCE(NEW.product_id, OLD.product_id);
BEGIN
  UPDATE public.products p
  SET avg_rating = COALESCE((
        SELECT ROUND(AVG(r.rating)::numeric, 1) FROM public.reviews r WHERE r.product_id = pid
      ), 0),
      review_count = (
        SELECT COUNT(*) FROM public.reviews r WHERE r.product_id = pid
      )
  WHERE p.id = pid;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS on_review_change ON public.reviews;
CREATE TRIGGER on_review_change
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_product_avg_rating();

-- 기존 데이터 정합성 재계산 (어긋난 것이 있으면 여기서 맞춰짐)
UPDATE public.products p
SET avg_rating = COALESCE((
      SELECT ROUND(AVG(r.rating)::numeric, 1) FROM public.reviews r WHERE r.product_id = p.id
    ), 0),
    review_count = (
      SELECT COUNT(*) FROM public.reviews r WHERE r.product_id = p.id
    );

-- 확인용
-- SELECT name, review_count, avg_rating FROM products ORDER BY review_count DESC;
