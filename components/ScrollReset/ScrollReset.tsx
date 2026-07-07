'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/* 스크롤 위치 관리:
   - 새 페이지로 이동(링크 클릭 등) → 최상단
   - 뒤로/앞으로가기(popstate) → 그 페이지에서 보던 위치로 복원
   브라우저 기본 복원(뒤로가기 시 하단으로 튀는 문제)은 끄고 직접 제어한다. */
export default function ScrollReset() {
  const pathname = usePathname();
  const isPop = useRef(false);

  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    const onPop = () => { isPop.current = true; };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const key = `sy:${pathname}`;
    if (isPop.current) {
      // 뒤로/앞으로가기 → 저장된 위치로 복원 (콘텐츠 로드될 때까지 몇 프레임 재시도)
      isPop.current = false;
      const y = Number(sessionStorage.getItem(key) || 0);
      if (y > 0) {
        let tries = 0;
        const restore = () => {
          window.scrollTo(0, y);
          if (++tries < 12 && Math.abs(window.scrollY - y) > 2) requestAnimationFrame(restore);
        };
        requestAnimationFrame(restore);
      }
    } else {
      // 새 페이지 이동 → 최상단
      window.scrollTo(0, 0);
    }
    // 현재 페이지 스크롤 위치를 계속 저장 (이동 시 복원용)
    const onScroll = () => sessionStorage.setItem(key, String(window.scrollY));
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [pathname]);

  return null;
}
