'use client';

import Script from 'next/script';
import { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/* Meta(Facebook) 픽셀.
   픽셀 ID는 브라우저에 어차피 노출되는 공개값이라 코드에 직접 둔다.
   App Router는 페이지 전환 시 <head> 스크립트가 다시 안 도므로 PageView 를 수동 전송한다. */
const PIXEL_ID = '1573647507665281';

function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    // 첫 로드는 아래 init 스크립트가 track 하므로, 여기서는 라우트 변경분만 잡는다
    const w = window as unknown as { fbq?: (...a: unknown[]) => void };
    if (typeof w.fbq === 'function') w.fbq('track', 'PageView');
  }, [pathname, searchParams]);
  return null;
}

export default function MetaPixel() {
  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${PIXEL_ID}');
          fbq('track', 'PageView');
        `}
      </Script>
      <noscript>
        <img height="1" width="1" style={{ display: 'none' }} alt=""
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`} />
      </noscript>
      <Suspense fallback={null}><PageviewTracker /></Suspense>
    </>
  );
}
