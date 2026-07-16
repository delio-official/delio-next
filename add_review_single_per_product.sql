-- 1상품 = 1리뷰 강제 (관리자는 중복 허용)
--
-- 증상: 같은 사람이 한 상품에 리뷰를 여러 개 작성 가능 → 리뷰 적립금 반복 수령 악용 가능
-- 원인: 상품페이지 작성 경로가 '구매 여부'만 검사하고 '이미 작성했는지'는 안 봄.
--       reviews 테이블에도 제약이 없음. (같은 파일의 wishlist엔 UNIQUE(user_id, product_id)가 있음)
--
-- 왜 UNIQUE 인덱스가 아니라 트리거인가:
--   1) 관리자만 중복 허용해야 하는데, 관리자 여부는 profiles에 있어
--      partial unique index의 WHERE 절로는 참조할 수 없음.
--   2) 트리거는 신규 INSERT만 막으므로 이미 쌓인 중복 리뷰를 지우지 않아도 됨.
--      (UNIQUE 인덱스는 기존 중복이 있으면 생성 자체가 실패)
--
-- 기존 중복 리뷰는 그대로 남습니다. 정리가 필요하면 관리자 페이지에서 개별 삭제하세요.

CREATE OR REPLACE FUNCTION public.enforce_single_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 관리자는 예외: 작성자명을 바꿔가며 여러 리뷰 작성 가능
  IF public.is_current_user_admin() THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.reviews
    WHERE product_id = NEW.product_id
      AND user_id    = NEW.user_id
  ) THEN
    -- 클라이언트에서 이 코드로 안내 문구를 띄움
    RAISE EXCEPTION 'ALREADY_REVIEWED';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_single_review ON public.reviews;

-- INSERT에만 검사 (본인 리뷰 수정은 자유)
CREATE TRIGGER trg_enforce_single_review
BEFORE INSERT ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.enforce_single_review();

-- 확인용: 현재 남아있는 중복 리뷰 조회
-- SELECT user_id, product_id, count(*)
-- FROM public.reviews
-- WHERE user_id IS NOT NULL
-- GROUP BY user_id, product_id
-- HAVING count(*) > 1;
