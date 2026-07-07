'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/* 기본: 경로 이동 시 항상 최상단(뒤로가기 시 하단으로 튀는 문제 방지).
   예외: 홈 하단 푸터 링크(약관·개인정보·환불·FAQ)에서 홈으로 '뒤로가기'한 경우에만
   보던 위치로 복원 → 푸터에서 링크 눌렀다 돌아오면 그 자리(하단) 유지.
   상품 등 다른 페이지에서 홈으로 뒤로가기는 최상단으로 간다. */
const FOOTER_PAGES = ['/privacy', '/terms', '/refund-policy', '/faq'];

export default function ScrollReset() {
  const pathname = usePathname();
  const isPop = useRef(false);
  const prevPath = useRef(pathname);

  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    const onPop = () => { isPop.current = true; };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const pop = isPop.current;
    isPop.current = false;
    const from = prevPath.current;
    prevPath.current = pathname;

    // 홈 푸터 링크 페이지 → 홈으로 뒤로가기한 경우만 위치 복원
    if (pop && pathname === '/' && FOOTER_PAGES.includes(from)) {
      const y = Number(sessionStorage.getItem('sy:/') || 0);
      if (y > 0) {
        let tries = 0;
        const restore = () => {
          window.scrollTo(0, y);
          if (++tries < 12 && Math.abs(window.scrollY - y) > 2) requestAnimationFrame(restore);
        };
        requestAnimationFrame(restore);
        return;
      }
    }
    // 그 외 모든 이동 → 최상단 (기존 동작 그대로)
    window.scrollTo(0, 0);
  }, [pathname]);

  // 홈 스크롤 위치만 저장 (복원용)
  useEffect(() => {
    if (pathname !== '/') return;
    const onScroll = () => sessionStorage.setItem('sy:/', String(window.scrollY));
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [pathname]);

  return null;
}
