-- =====================================================
-- 주문 / 주문상품 테이블
-- Supabase SQL Editor에서 실행하세요
-- =====================================================

-- ─────────────────────────────────────
-- orders
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orders (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  order_no        text        UNIQUE NOT NULL
                              DEFAULT ('ORD-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 8)),
  user_id         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  status          text        NOT NULL DEFAULT 'paid',
  -- 금액
  total_amount    integer     NOT NULL DEFAULT 0,
  discount_amount integer     NOT NULL DEFAULT 0,
  coupon_discount integer     NOT NULL DEFAULT 0,
  point_used      integer     NOT NULL DEFAULT 0,
  final_amount    integer     NOT NULL DEFAULT 0,
  -- 배송지
  recipient       text        NOT NULL DEFAULT '',
  phone           text        NOT NULL DEFAULT '',
  zipcode         text        DEFAULT '',
  address1        text        NOT NULL DEFAULT '',
  address2        text        DEFAULT '',
  delivery_type   text        DEFAULT 'parcel',
  delivery_memo   text        DEFAULT '',
  -- 결제
  payment_method  text        DEFAULT 'card',
  paid_at         timestamptz,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 본인 주문만 조회/수정 가능
CREATE POLICY "Users can read own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own orders"
  ON public.orders FOR UPDATE
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────
-- order_items
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_items (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id      uuid        REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  product_id    uuid        REFERENCES public.products(id) ON DELETE SET NULL,
  product_name  text        NOT NULL DEFAULT '',
  unit_price    integer     NOT NULL DEFAULT 0,
  quantity      integer     NOT NULL DEFAULT 1,
  subtotal      integer     NOT NULL DEFAULT 0,
  thumbnail_url text,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- 본인 주문의 상품만 조회 가능
CREATE POLICY "Users can read own order items"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
        AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own order items"
  ON public.order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
        AND orders.user_id = auth.uid()
    )
  );
