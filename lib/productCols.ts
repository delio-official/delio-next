/* 고객(공개) 페이지에서 products 조회 시 쓰는 컬럼 목록.
 * 내부 전용 컬럼(supply_price=농가 공급가/정산가)은 응답에 포함하지 않는다.
 * 새 컬럼을 추가하면 여기에도 더해줘야 고객 화면에 반영된다. */
export const PRODUCT_PUBLIC_COLS =
  'id, name, category, price, discount_rate, discounted_price, is_active, farm_id, ' +
  'sort_order, created_at, sku, origin, origin_region, short_desc, ' +
  'thumbnail_url, image_urls, dispatch_cutoff, brix, badge, badge_color, ' +
  'is_new, is_best, is_dawn, avg_rating, review_count, seller_score, show_stat_pill';

/* 위 컬럼 + 재고(옵션 stock) 조인. 품절 표시가 필요한 목록 조회에 사용. */
export const PRODUCT_PUBLIC_COLS_STOCK = PRODUCT_PUBLIC_COLS + ', product_options(stock, manage_stock)';

/* 옵션 stock 합으로 품절 판정 (관리자와 동일 로직).
   · 옵션이 0개인 단품 → 재고 미관리(null) → 품절 아님
   · manage_stock=false(재고 무한) 옵션이 하나라도 있으면 → 품절 아님
   · 나머지는 재고 관리 옵션들의 합이 0 이하일 때만 품절
   product_options 필드를 제거하고 soldout 불리언을 붙인 객체를 반환한다. */
export function withSoldout<T extends Record<string, unknown>>(row: T): T & { soldout: boolean } {
  const opts = (row.product_options as { stock: number; manage_stock?: boolean | null }[] | undefined) || [];
  const managed = opts.filter(o => o.manage_stock !== false);
  const hasUnlimited = opts.length > managed.length; // 무한 옵션 존재 → 절대 품절 아님
  const total = managed.length > 0 ? managed.reduce((s, o) => s + (o.stock || 0), 0) : null;
  const rest = { ...row };
  delete (rest as Record<string, unknown>).product_options;
  return { ...(rest as T), soldout: !hasUnlimited && total != null && total <= 0 };
}
