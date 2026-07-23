/* Meta(페이스북) 픽셀 표준 이벤트.
   GA(lib/gtag.ts)와 같은 자리에서 나란히 호출한다 — 같은 데이터로 짝을 맞춤.
   fbq 는 MetaPixel 컴포넌트가 로드하며, 없으면(로딩 전·차단 등) 조용히 넘어간다. */

type Fbq = (...args: unknown[]) => void;

function fbq(): Fbq | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { fbq?: Fbq };
  return typeof w.fbq === 'function' ? w.fbq : null;
}

type Item = { id: string; name: string; price: number; quantity?: number; category?: string };

/** 상품 상세 조회 → ViewContent */
export function fbViewContent(item: Item) {
  fbq()?.('track', 'ViewContent', {
    content_ids: [item.id],
    content_name: item.name,
    content_type: 'product',
    content_category: item.category,
    value: item.price,
    currency: 'KRW',
  });
}

/** 장바구니 담기 → AddToCart */
export function fbAddToCart(item: Item) {
  const qty = item.quantity ?? 1;
  fbq()?.('track', 'AddToCart', {
    content_ids: [item.id],
    content_name: item.name,
    content_type: 'product',
    contents: [{ id: item.id, quantity: qty }],
    value: item.price * qty,
    currency: 'KRW',
  });
}

/** 결제 시작 → InitiateCheckout */
export function fbInitiateCheckout(items: Item[], value: number) {
  fbq()?.('track', 'InitiateCheckout', {
    content_ids: items.map(i => i.id),
    content_type: 'product',
    contents: items.map(i => ({ id: i.id, quantity: i.quantity ?? 1 })),
    num_items: items.reduce((s, i) => s + (i.quantity ?? 1), 0),
    value,
    currency: 'KRW',
  });
}

/** 구매 완료 → Purchase (주문 금액 + KRW 전달) */
export function fbPurchase(orderNo: string, items: Item[], value: number) {
  fbq()?.('track', 'Purchase', {
    content_ids: items.map(i => i.id),
    content_type: 'product',
    contents: items.map(i => ({ id: i.id, quantity: i.quantity ?? 1 })),
    num_items: items.reduce((s, i) => s + (i.quantity ?? 1), 0),
    value,
    currency: 'KRW',
    order_id: orderNo,
  });
}
