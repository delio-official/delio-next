-- 리뷰 중복 작성 방지 — "그 상품을 산 횟수만큼만 리뷰"
--
-- [규칙]
--   그 상품이 들어간 내 주문이 N건이면, 그 상품에 리뷰 N개까지.
--   · 수량 무관   — 한 주문에 3개 담아도 주문 1건 → 리뷰 1개
--   · 옵션 무관   — 유기농 + 무농약 같이 담아도 같은 상품 → 리뷰 1개
--   · 상품별 독립 — 블루베리 같이 샀다고 복숭아 리뷰가 늘지 않음
--   · 재구매 허용 — 두 번 사면 리뷰 2개 (단골 고객 후기를 막지 않기 위함)
--   · 취소/환불 주문은 산 횟수에서 제외 (클라이언트 hasPurchased 기준과 동일)
--   · 관리자는 예외 — 구매 없이 무제한 작성 가능
--
-- [왜 UNIQUE 인덱스가 아니라 트리거인가]
--   1) 관리자 예외가 필요한데, 관리자 여부는 profiles에 있어 partial index로 참조 불가
--   2) "산 횟수"라는 동적 조건은 인덱스로 표현 불가
--   3) 트리거는 신규 INSERT만 검사 → 기존 리뷰를 건드리지 않아도 됨
--
-- [부수 효과] 미구매자의 리뷰 작성도 DB에서 자동 차단됨
--   (산 횟수 0 → 허용 0개). 기존에는 클라이언트에서만 막아 API 우회가 가능했음.

CREATE OR REPLACE FUNCTION public.enforce_single_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  purchase_cnt int;
  review_cnt   int;
BEGIN
  -- 관리자는 예외: 구매 여부·중복 무관하게 작성 가능
  IF public.is_current_user_admin() THEN
    RETURN NEW;
  END IF;

  -- 이 상품이 들어간 내 주문 건수 (주문 단위로 중복 제거 → 수량·옵션 무관)
  SELECT COUNT(DISTINCT oi.order_id)
    INTO purchase_cnt
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE oi.product_id = NEW.product_id
    AND o.user_id     = NEW.user_id
    AND o.status IN ('paid', 'delivered', 'confirmed');   -- cancelled/refunded 제외

  -- 이 상품에 이미 쓴 리뷰 수
  SELECT COUNT(*)
    INTO review_cnt
  FROM public.reviews
  WHERE product_id = NEW.product_id
    AND user_id    = NEW.user_id;

  IF review_cnt >= purchase_cnt THEN
    -- 클라이언트가 이 코드로 안내 문구를 띄움
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
