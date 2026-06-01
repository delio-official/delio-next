export interface CartItem {
  idx: number;
  id: string;
  name: string;
  price: number;
  quantity: number;
  thumbnail: string;
  deliveryType?: '산지직송' | '자사배송'; // 배송 구분
  optionId?: string;
  // 구 필드 (호환성 유지)
  qty?: number;
  icon?: string;
  options?: string;
}

const CART_KEY = 'delio_cart';

export function getCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    // qty -> quantity 마이그레이션
    return raw.map((item: CartItem) => ({
      ...item,
      quantity: item.quantity ?? item.qty ?? 1,
    }));
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]): void {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event('cartUpdated'));
}

export function addToCart(item: Omit<CartItem, 'idx'>): void {
  const cart = getCart();
  const existing = cart.find(
    c => c.id === item.id && c.optionId === item.optionId
  );
  if (existing) {
    existing.quantity = (existing.quantity ?? 1) + (item.quantity ?? 1);
  } else {
    cart.push({ ...item, idx: Date.now() });
  }
  saveCart(cart);
}

export function updateQty(idx: number, quantity: number): void {
  const cart = getCart();
  const found = cart.find(i => i.idx === idx);
  if (found) {
    found.quantity = quantity;
    saveCart(cart);
  }
}

export function removeFromCart(idx: number): void {
  saveCart(getCart().filter(i => i.idx !== idx));
}

export function clearCart(): void {
  localStorage.removeItem(CART_KEY);
  window.dispatchEvent(new Event('cartUpdated'));
}

export function getCartCount(): number {
  return getCart().reduce((sum, item) => sum + (item.quantity ?? item.qty ?? 1), 0);
}

export function showCartToast(name?: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('cartToast', { detail: { name } }));
}

/** 옵션 선택 드로어 열기 (상품 id 전달) */
export function openOptionDrawer(productId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('openOptionDrawer', { detail: { productId } }));
}
