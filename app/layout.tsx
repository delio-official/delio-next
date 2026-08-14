import type { Metadata, Viewport } from 'next';
import './globals.css';
import GoogleAnalytics from '@/components/GoogleAnalytics';
import GoogleTagManager from '@/components/GoogleTagManager';
import MetaPixel from '@/components/MetaPixel';
import MicrosoftClarity from '@/components/MicrosoftClarity';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.delio.co.kr'),
  title: '델리오 — 산지직송 프리미엄 과일 전문 쇼핑몰',
  description: '산지 직송 프리미엄 과일 전문 쇼핑몰 델리오. 엄선한 농가에서 직접 받는 신선한 제철 과일을 합리적인 가격에 만나보세요. 황도·백도 복숭아, 샤인머스캣, 블루베리 등 제철 과일 선물.',
  keywords: ['산지직송 과일', '제철 과일', '프리미엄 과일', '과일 선물', '농가 직송', '과일 쇼핑몰', '복숭아', '샤인머스캣', '델리오'],
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
  },
  alternates: { canonical: 'https://www.delio.co.kr' },
  openGraph: {
    title: '델리오 — 산지직송 프리미엄 과일 전문 쇼핑몰',
    description: '엄선한 농가에서 직접 받는 신선한 제철 과일. 델리오에서 만나보세요.',
    url: 'https://www.delio.co.kr',
    siteName: '델리오',
    type: 'website',
    locale: 'ko_KR',
    images: [{ url: '/KakaoThumbnail.png', width: 1200, height: 630, alt: '델리오 — 산지직송 프리미엄 과일' }],
  },
};

/* 사이트 전체 조직(Organization) 구조화 데이터 — 브랜드 인식·리치결과용 */
const ORG_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: '델리오',
  alternateName: 'Delio',
  url: 'https://www.delio.co.kr',
  logo: 'https://www.delio.co.kr/DelioLogo.png',
  description: '산지직송 프리미엄 과일 전문 쇼핑몰',
};

/* 사이트 검색박스(구글 sitelinks searchbox) 구조화 데이터 */
const WEBSITE_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: '델리오',
  url: 'https://www.delio.co.kr',
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: 'https://www.delio.co.kr/search?q={search_term_string}' },
    'query-input': 'required name=search_term_string',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* 네이버 서치어드바이저 사이트 소유확인 */}
        <meta name="naver-site-verification" content="4268ef787e61a171d9ad3abffcd9f1f493228a18" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSONLD) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_JSONLD) }} />
        <GoogleTagManager />
        <GoogleAnalytics />
        <MetaPixel />
        <MicrosoftClarity />
        {children}
      </body>
    </html>
  );
}
