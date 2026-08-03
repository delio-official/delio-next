'use client';

import Script from 'next/script';
import { useEffect } from 'react';
import { useTrackingBlocked } from '@/lib/useTrackingBlocked';

/* Microsoft Clarity — 히트맵·세션 리코딩. env로 덮어쓸 수 있고 없으면 발급된 ID 사용 */
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID || 'xwdwk2nqdm';

export default function MicrosoftClarity() {
  const blocked = useTrackingBlocked();  // 관리자 페이지/계정이면 true
  /* 이미 로드된 세션이 관리자(페이지·계정)로 넘어가도 녹화 안 되게: 차단 시 정지, 해제 시 재개 */
  useEffect(() => {
    const c = (window as unknown as { clarity?: (cmd: string) => void }).clarity;
    if (typeof c !== 'function') return;
    if (blocked) c('stop'); else c('start');
  }, [blocked]);
  if (!CLARITY_ID || blocked) return null;  // 관리자 페이지/계정 → 스크립트 미로드(직접 진입 시)
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
