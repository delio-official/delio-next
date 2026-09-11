import { createClient } from '@/lib/supabase';
import { getCart, saveCart, type CartItem } from '@/lib/cart';

/* 장바구니 가격·상품명·사진을 현재 상품 정보로 갱신 (장바구니·결제 화면 진입 시).
   담은 뒤 가격(할인 종료·옵션 추가금 변경 등)이 바뀌어도 옛 가격으로 남지 않게 한다.
   → 결제 시 서버 가격 검증(lib/order-validate)과 같은 규칙:
     단가 = (할인가 또는 정상가) + 고른 옵션 추가금
     고른 옵션 목록(optionId)이 없는 옛 항목(마이페이지 재구매 등)은 재고 옵션 + 2단계면 상위 옵션 추가금.
   판매중지·삭제된 상품이나 옵션을 찾지 못한 항목은 건드리지 않는다(결제 시 서버가 안내하며 거부).
   바뀐 게 있으면 저장하고 갱신된 목록을 반환, 없으면 null. */
export async function refreshCartPrices(): Promise<CartItem[] | null> {
  const cart = getCart();
  if (cart.length === 0) return null;
  const ids = [...new Set(cart.map(i => i.id))];
  const sb = createClient();
  const [{ data: prods }, { data: opts }] = await Promise.all([
    sb.from('products').select('id, name, price, discounted_price, thumbnail_url, is_active').in('id', ids),
    sb.from('product_options').select('id, product_id, label, add_price, parent_label').in('product_id', ids),
  ]);
  if (!prods) return null;
  type P = { id: string; name: string; price: number; discounted_price: number | null; thumbnail_url: string | null; is_active: boolean };
  type O = { id: string; product_id: string; label: string; add_price: number | null; parent_label: string | null };
  const pmap = new Map((prods as P[]).map(p => [p.id, p]));
  const optList = (opts as O[] | null) || [];
  const optById = new Map(optList.map(o => [o.id, o]));

  let changed = false;
  const next = cart.map(it => {
    const p = pmap.get(it.id);
    if (!p) return it;
    const patch: Partial<CartItem> = {};
    if (p.thumbnail_url && p.thumbnail_url !== it.thumbnail) patch.thumbnail = p.thumbnail_url;
    if (p.name && p.name !== it.name) patch.name = p.name;

    if (p.is_active !== false) {
      const own = (oid?: string) => { const o = oid ? optById.get(oid) : undefined; return o && o.product_id === it.id ? o : undefined; };
      const picked = (it.optionId || '').split(',').map(s => s.trim()).filter(Boolean);
      let add: number | null = 0;
      if (picked.length > 0) {
        for (const oid of picked) { const o = own(oid); if (!o) { add = null; break; } add += o.add_price || 0; }
      } else if (it.stockOptionId) {
        const leaf = own(it.stockOptionId);
        if (!leaf) add = null;
        else {
          add = leaf.add_price || 0;
          if (leaf.parent_label) {
            const parent = optList.find(o => o.product_id === it.id && o.label === leaf.parent_label && !o.parent_label);
            add += parent?.add_price || 0;
          }
        }
      }
      if (add !== null) {
        const price = (p.discounted_price ?? p.price) + add;
        const originalPrice = p.price + add;
        if (price !== it.price) patch.price = price;
        if (originalPrice !== it.originalPrice) patch.originalPrice = originalPrice;
      }
    }
    if (Object.keys(patch).length) { changed = true; return { ...it, ...patch }; }
    return it;
  });
  if (!changed) return null;
  saveCart(next);
  return next;
}
