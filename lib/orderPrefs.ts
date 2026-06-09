/* 장바구니 ↔ 체크아웃 간 쿠폰/적립금 선택 공유 (localStorage) */
export interface OrderPrefs { couponUcId: string; pointUsed: number; }

const KEY = 'delio_order_prefs';

export function getOrderPrefs(): OrderPrefs {
  if (typeof window === 'undefined') return { couponUcId: '', pointUsed: 0 };
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { couponUcId: p.couponUcId || '', pointUsed: Number(p.pointUsed) || 0 };
  } catch { return { couponUcId: '', pointUsed: 0 }; }
}

export function setOrderPrefs(p: OrderPrefs) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(p));
}

export function clearOrderPrefs() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
}
