-- 중복 트리거 제거: trg_product_review_stats / sync_product_review_stats()
--
-- [상황]
--  reviews 테이블에 products.avg_rating + review_count 를 갱신하는 트리거가 2개 있었다.
--    1) on_review_change        → update_product_avg_rating()   (저장소 SQL로 관리, SECURITY DEFINER)
--    2) trg_product_review_stats → sync_product_review_stats()   (저장소에 없음 = 대시보드에서 직접 생성)
--  이름 순서상 2)가 나중에 실행되어 1)의 결과를 매번 덮어썼고,
--  리뷰 1건 쓸 때마다 products 를 두 번 UPDATE 하고 있었다.
--
-- [확인한 내용] sync_product_review_stats() 본문은 아래가 전부로, 1)과 하는 일이 완전히 동일하다.
--    UPDATE products SET
--      avg_rating   = COALESCE((SELECT AVG(rating) FROM reviews WHERE product_id = v_product_id), 0),
--      review_count = (SELECT COUNT(*) FROM reviews WHERE product_id = v_product_id)
--    WHERE id = v_product_id;
--  다른 컬럼을 건드리거나 부수 작업을 하지 않으므로 제거해도 잃는 기능이 없다.
--
-- [왜 1)을 남기는가]
--  · 저장소 SQL에 정의가 있어 코드로 추적·관리된다 (2)는 코드 어디에도 없어 존재를 알 수 없었음)
--  · SECURITY DEFINER 라 RLS와 무관하게 확실히 갱신된다.
--    2)는 SECURITY DEFINER가 없어 호출자 권한으로 도는데, products UPDATE가 RLS에 막히면
--    조용히 실패할 수 있다. 클라이언트의 직접 기록을 제거한 지금은 트리거가 유일한 갱신 경로라 중요.
--
-- [부수 효과] avg_rating 이 소수 1자리로 통일된다(기존 2)는 ROUND 없이 저장해 4.86 처럼 찍힘).
--  화면은 toFixed(1) 로 표시하므로 보이는 값은 동일하다. (4.86 → "4.9", 4.9 → "4.9")

DROP TRIGGER IF EXISTS trg_product_review_stats ON public.reviews;
DROP FUNCTION IF EXISTS public.sync_product_review_stats();

-- 남은 트리거로 전체 재계산 (자릿수 통일 + 정합성 확인)
UPDATE public.products p
SET avg_rating = COALESCE((
      SELECT ROUND(AVG(r.rating)::numeric, 1) FROM public.reviews r WHERE r.product_id = p.id
    ), 0),
    review_count = (
      SELECT COUNT(*) FROM public.reviews r WHERE r.product_id = p.id
    );

-- 확인용: reviews 트리거 목록 (trg_product_review_stats 가 사라졌는지)
-- SELECT tgname FROM pg_trigger
-- WHERE tgrelid = 'public.reviews'::regclass AND NOT tgisinternal;
