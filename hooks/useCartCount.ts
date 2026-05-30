'use client';
import { useState, useEffect } from 'react';
import { getCartCount } from '@/lib/cart';

export function useCartCount() {
  // 서버/클라이언트 hydration 불일치 방지 → 초기값은 항상 0
  // 실제 값은 useEffect(마운트 후)에서 동기화
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(getCartCount());

    const update = () => setCount(getCartCount());
    window.addEventListener('cartUpdated', update);
    window.addEventListener('storage', update);

    return () => {
      window.removeEventListener('cartUpdated', update);
      window.removeEventListener('storage', update);
    };
  }, []);

  return count;
}
