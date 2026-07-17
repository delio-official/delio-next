-- 상품 구매 지표 집계 함수 (상품페이지 "N명이 구매했어요" 용)
--
-- [왜 필요한가]
--  1) orders/order_items 는 RLS가 "본인 주문만" 이라 비로그인 방문자는 0건으로 보였다.
--     → 정작 설득이 필요한 손님에게 구매수가 아예 표시되지 않음(문구 자체가 숨겨짐).
--     → 그렇다고 orders 를 공개로 풀면 남의 주문·연락처가 전부 노출되므로 절대 불가.
--     → SECURITY DEFINER 로 서버에서 집계해 "숫자만" 돌려준다. 개인정보는 계속 잠긴 상태.
--  2) 관리자 리뷰는 주문이 없어 '후기 27개 / 구매 30명'처럼 후기가 구매를 넘어 어색해 보인다.
--     → 관리자 리뷰 1건 = 표시용 구매 1건으로 가산한다.
--
-- [정산 안전성]
--  이 함수는 읽기 전용(STABLE) 집계일 뿐 orders/order_items 에 아무것도 만들지 않는다.
--  따라서 농가 정산·매출 통계는 실제 주문만 보며 관리자 리뷰의 영향을 전혀 받지 않는다.
--  (예: 다잘커팜 방울토마토에 관리자가 후기를 10개 써도 정산액 139,500원 그대로)
--
-- [재구매율]
--  분모에 가산분을 넣으면 비율이 되레 떨어지므로 실제 구매자만 분모로 쓴다.

CREATE OR REPLACE FUNCTION public.get_product_buyer_stats(p_product_id uuid)
RETURNS TABLE (
  buyers            int,   -- 표시용 구매자 수 (실구매자 + 관리자리뷰)
  repurchase        int,   -- 재구매율 % (실제 구매자 기준)
  recent            int,   -- 최근 30일 구매자 (+ 관리자리뷰)
  repurchasers      int,   -- 재구매자 수 (실제)
  recent7buy        int,   -- 최근 7일 구매자 (+ 관리자리뷰)
  recent7repurchase int    -- 최근 7일 재구매자 (실제)
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_buyers      int := 0;
  v_repurchasers int := 0;
  v_recent30    int := 0;
  v_recent7     int := 0;
  v_recent7rep  int := 0;
  v_admin_all   int := 0;
  v_admin30     int := 0;
  v_admin7      int := 0;
BEGIN
  -- 실제 구매자 집계 (취소/환불 제외 — 클라이언트 기존 기준과 동일)
  WITH uo AS (
    SELECT DISTINCT o.user_id, oi.order_id, o.created_at
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE oi.product_id = p_product_id
      AND o.user_id IS NOT NULL
      AND o.status IN ('paid', 'delivered', 'confirmed')
  ),
  ranked AS (
    SELECT user_id, created_at,
           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) AS rn
    FROM uo
  ),
  per_user AS (
    SELECT user_id,
           COUNT(*)                                        AS order_cnt,
           MAX(created_at)                                 AS last_at,
           MAX(created_at) FILTER (WHERE rn >= 2)          AS last_repurchase_at
    FROM ranked
    GROUP BY user_id
  )
  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE order_cnt >= 2)::int,
    COUNT(*) FILTER (WHERE last_at            >= now() - interval '30 days')::int,
    COUNT(*) FILTER (WHERE last_at            >= now() - interval '7 days')::int,
    COUNT(*) FILTER (WHERE last_repurchase_at >= now() - interval '7 days')::int
  INTO v_buyers, v_repurchasers, v_recent30, v_recent7, v_recent7rep
  FROM per_user;

  -- 관리자 리뷰 = 표시용 구매 가산분 (실제 주문 아님)
  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE r.created_at >= now() - interval '30 days')::int,
    COUNT(*) FILTER (WHERE r.created_at >= now() - interval '7 days')::int
  INTO v_admin_all, v_admin30, v_admin7
  FROM reviews r
  JOIN profiles p ON p.id = r.user_id
  WHERE r.product_id = p_product_id
    AND p.is_admin = true;

  RETURN QUERY SELECT
    (v_buyers + v_admin_all),
    CASE WHEN v_buyers > 0
         THEN ROUND(v_repurchasers::numeric / v_buyers * 100)::int
         ELSE 0 END,
    (v_recent30 + v_admin30),
    v_repurchasers,
    (v_recent7 + v_admin7),
    v_recent7rep;
END;
$$;

-- 비로그인 방문자도 호출 가능 (숫자만 반환하므로 개인정보 노출 없음)
GRANT EXECUTE ON FUNCTION public.get_product_buyer_stats(uuid) TO anon, authenticated;

-- 확인용
-- SELECT p.name, s.* FROM products p,
--   LATERAL public.get_product_buyer_stats(p.id) s;
