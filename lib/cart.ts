export interface CartItem {
  idx: number;
  id: string;
  name: string;
  price: number;
  originalPrice?: number;  // 할인 전 단가 (취소선 표시용)
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

/** 현재 장바구니에 없는 유니크한 idx 생성 (Date.now() 충돌 방지) */
let _idxSeq = 0;
function uniqueIdx(taken: Set<number>): number {
  let id = Date.now() * 1000 + (_idxSeq = (_idxSeq + 1) % 1000);
  while (taken.has(id)) id++;
  taken.add(id);
  return id;
}

/** 장바구니 배열에 대해 새 유니크 idx 발급 */
export function freshIdx(cart: CartItem[]): number {
  return uniqueIdx(new Set(cart.map(c => c.idx)));
}

export function getCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    const taken = new Set<number>();
    let changed = false;
    // qty -> quantity 마이그레이션 + idx 누락/충돌 보정 (깨진 장바구니 복구)
    const items: CartItem[] = raw.map((item: CartItem) => {
      let idx = item.idx;
      if (typeof idx !== 'number' || taken.has(idx)) { idx = uniqueIdx(taken); changed = true; }
      else taken.add(idx);
      return { ...item, idx, quantity: item.quantity ?? item.qty ?? 1 };
    });
    if (changed) localStorage.setItem(CART_KEY, JSON.stringify(items)); // 보정 결과 영구 저장(이벤트 미발생)
    return items;
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
    cart.push({ ...item, idx: freshIdx(cart) });
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
