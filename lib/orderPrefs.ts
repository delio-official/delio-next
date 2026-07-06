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

/** 장바구니에서 쿠폰/적립금 선택을 저장한 적이 있는지(=장바구니를 거쳐 왔는지) */
export function hasOrderPrefs(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(KEY) !== null;
}
