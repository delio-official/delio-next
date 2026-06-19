/* 고객(공개) 페이지에서 products 조회 시 쓰는 컬럼 목록.
 * 내부 전용 컬럼(supply_price=농가 공급가/정산가)은 응답에 포함하지 않는다.
 * 새 컬럼을 추가하면 여기에도 더해줘야 고객 화면에 반영된다. */
export const PRODUCT_PUBLIC_COLS =
  'id, name, category, price, discount_rate, discounted_price, is_active, farm_id, ' +
  'sort_order, created_at, sku, origin, origin_region, short_desc, ' +
  'thumbnail_url, image_urls, dispatch_cutoff, brix, badge, badge_color, ' +
  'is_new, is_best, is_dawn, avg_rating, review_count, seller_score, show_stat_pill';
