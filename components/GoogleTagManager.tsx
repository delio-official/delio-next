'use client';

import Script from 'next/script';
import { useTrackingBlocked } from '@/lib/useTrackingBlocked';

/* 구글 태그매니저 — NEXT_PUBLIC_GTM_ID(GTM-XXXXXXX) 설정 시에만 로드.
   관리자 페이지/계정은 추적 제외(useTrackingBlocked). ID 미설정이면 아무것도 안 함. */
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || 'GTM-T5HXZV7K';

export default function GoogleTagManager() {
  const blocked = useTrackingBlocked();
  if (!GTM_ID || blocked) return null;
  return (
    <>
      <Script id="gtm-init" strategy="afterInteractive">
        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
      </Script>
      <noscript>
        <iframe src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
          height="0" width="0" style={{ display: 'none', visibility: 'hidden' }} />
      </noscript>
    </>
  );
}
