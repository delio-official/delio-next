import type { MetadataRoute } from 'next';

/* /robots.txt 자동 생성 — 검색로봇 수집 허용(관리자·API 제외) + 사이트맵 위치 안내 */
const BASE = 'https://www.delio.co.kr';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/', '/mypage', '/checkout', '/order-complete', '/verify', '/reset-password'],
    },
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
