import { createClient } from '@/lib/supabase';

const WISH_KEY = 'delio_wishlist';

/* ── localStorage helpers (비로그인 fallback) ── */
export function getLocalWishlist(): string[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(WISH_KEY) || '[]'); } catch { return []; }
}

function saveLocalWishlist(ids: string[]) {
  localStorage.setItem(WISH_KEY, JSON.stringify(ids));
  window.dispatchEvent(new CustomEvent('wishlistUpdated'));
}

/* ── 현재 로그인 유저 ID 가져오기 ── */
async function getUserId(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/* ── 찜 여부 확인 ── */
export async function isWishlisted(productId: string): Promise<boolean> {
  const uid = await getUserId();
  if (uid) {
    const supabase = createClient();
    const { data } = await supabase
      .from('wishlist')
      .select('id')
      .eq('user_id', uid)
      .eq('product_id', productId)
      .maybeSingle();
    return !!data;
  }
  return getLocalWishlist().includes(productId);
}

/* ── 찜 토글 (추가 / 제거) ── */
export async function toggleWishlist(productId: string): Promise<boolean> {
  const uid = await getUserId();

  if (uid) {
    const supabase = createClient();
    const { data: existing } = await supabase
      .from('wishlist')
      .select('id')
      .eq('user_id', uid)
      .eq('product_id', productId)
      .maybeSingle();

    if (existing) {
      await supabase.from('wishlist').delete().eq('id', existing.id);
      window.dispatchEvent(new CustomEvent('wishlistUpdated'));
      return false; // 제거됨
    } else {
      await supabase.from('wishlist').insert({ user_id: uid, product_id: productId });
      window.dispatchEvent(new CustomEvent('wishlistUpdated'));
      return true; // 추가됨
    }
  } else {
    // 비로그인: localStorage
    const list = getLocalWishlist();
    const idx = list.indexOf(productId);
    if (idx >= 0) {
      list.splice(idx, 1);
      saveLocalWishlist(list);
      return false;
    } else {
      list.push(productId);
      saveLocalWishlist(list);
      return true;
    }
  }
}

/* ── 전체 찜 목록 (product_id 배열) ── */
export async function getWishlistIds(): Promise<string[]> {
  const uid = await getUserId();
  if (uid) {
    const supabase = createClient();
    const { data } = await supabase
      .from('wishlist')
      .select('product_id')
      .eq('user_id', uid);
    return (data || []).map((r: { product_id: string }) => r.product_id);
  }
  return getLocalWishlist();
}
