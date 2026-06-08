/* Google Analytics 4 (gtag) 헬퍼 */

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID || '';

type GtagParams = Record<string, unknown>;

declare global {
  interface Window {
    gtag?: (command: string, ...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

/** GA 활성 여부 (측정 ID 있고, 브라우저) */
export function gaEnabled(): boolean {
  return typeof window !== 'undefined' && !!GA_ID && typeof window.gtag === 'function';
}

/** 페이지뷰 (App Router는 라우트 변경 시 수동 전송) */
export function pageview(url: string) {
  if (!gaEnabled()) return;
  window.gtag!('event', 'page_view', { page_path: url, page_location: window.location.href });
}

/** 일반 이벤트 */
export function gaEvent(name: string, params: GtagParams = {}) {
  if (!gaEnabled()) return;
  window.gtag!('event', name, params);
}

/* ── 전자상거래 표준 이벤트 ──────────────── */
type Item = { id: string; name: string; price: number; quantity?: number; category?: string };

function toGaItem(i: Item) {
  return {
    item_id: i.id,
    item_name: i.name,
    item_category: i.category,
    price: i.price,
    quantity: i.quantity ?? 1,
  };
}

/** 상품 조회 */
export function gaViewItem(item: Item) {
  gaEvent('view_item', { currency: 'KRW', value: item.price, items: [toGaItem(item)] });
}

/** 장바구니 담기 */
export function gaAddToCart(item: Item) {
  const qty = item.quantity ?? 1;
  gaEvent('add_to_cart', { currency: 'KRW', value: item.price * qty, items: [toGaItem(item)] });
}

/** 결제 시작 */
export function gaBeginCheckout(items: Item[], value: number) {
  gaEvent('begin_checkout', { currency: 'KRW', value, items: items.map(toGaItem) });
}

/** 결제 완료 */
export function gaPurchase(transactionId: string, items: Item[], value: number) {
  gaEvent('purchase', { transaction_id: transactionId, currency: 'KRW', value, items: items.map(toGaItem) });
}
