'use client';

import Script from 'next/script';
import { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { GA_ID, pageview, gaScroll } from '@/lib/gtag';
import { useTrackingBlocked } from '@/lib/useTrackingBlocked';

/* 라우트 변경 시 page_view 전송 (App Router는 수동) */
function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    if (!GA_ID) return;
    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
    pageview(url);
  }, [pathname, searchParams]);
  return null;
}

/* 스크롤 깊이 추적 — SPA라 GA4 자동측정이 안 잡혀 직접 감지. 페이지(경로)마다 25/50/75/90% 도달 시 1회씩 전송 */
function ScrollDepthTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (!GA_ID) return;
    const thresholds = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const fired = new Set<number>();
    let ticking = false;
    const check = () => {
      ticking = false;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const pct = (window.scrollY / scrollable) * 100;
      for (const t of thresholds) {
        if (pct >= t && !fired.has(t)) { fired.add(t); gaScroll(t); }
      }
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(check); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    check(); // 짧은 페이지(이미 하단)면 진입 즉시 체크
    return () => window.removeEventListener('scroll', onScroll);
  }, [pathname]);
  return null;
}

export default function GoogleAnalytics() {
  const blocked = useTrackingBlocked();
  if (!GA_ID || blocked) return null;  // 측정 ID 미설정 or 관리자 페이지/계정 → 추적 제외
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}', { send_page_view: false });
        `}
      </Script>
      <Suspense fallback={null}><PageviewTracker /></Suspense>
      <ScrollDepthTracker />
    </>
  );
}
