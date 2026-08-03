'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';

/* Microsoft Clarity — 히트맵·세션 리코딩. env로 덮어쓸 수 있고 없으면 발급된 ID 사용 */
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID || 'xwdwk2nqdm';

export default function MicrosoftClarity() {
  const pathname = usePathname();
  if (!CLARITY_ID || pathname?.startsWith('/admin')) return null;  // 관리자 페이지 → 추적 제외
  return (
    <Script id="ms-clarity" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "${CLARITY_ID}");`}
    </Script>
  );
}
