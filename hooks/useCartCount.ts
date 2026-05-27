'use client';
import { useState, useEffect } from 'react';
import { getCartCount } from '@/lib/cart';

export function useCartCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(getCartCount());
    const update = () => setCount(getCartCount());
    window.addEventListener('cartUpdated', update);
    return () => window.removeEventListener('cartUpdated', update);
  }, []);

  return count;
}
