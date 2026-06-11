'use client';

import Script from 'next/script';

/* 카카오 JS SDK 로드 + 초기화. NEXT_PUBLIC_KAKAO_JS_KEY 없으면 아무것도 안 함. */
export default function KakaoInit() {
  const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
  if (!key) return null;
  return (
    <Script
      src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js"
      crossOrigin="anonymous"
      strategy="afterInteractive"
      onLoad={() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const K = (window as any).Kakao;
        if (K && !K.isInitialized()) {
          try { K.init(key); } catch { /* noop */ }
        }
      }}
    />
  );
}
