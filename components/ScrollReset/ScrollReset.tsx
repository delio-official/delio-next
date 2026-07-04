'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/* 경로 이동(앞으로/뒤로가기 포함) 시 항상 최상단으로.
   브라우저 기본 스크롤 복원(뒤로가기 시 하단으로 튀는 문제)을 끄고 직접 제어한다. */
export default function ScrollReset() {
  const pathname = usePathname();

  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
