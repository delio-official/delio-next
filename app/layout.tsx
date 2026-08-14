import type { Metadata, Viewport } from 'next';
import './globals.css';
import GoogleAnalytics from '@/components/GoogleAnalytics';
import GoogleTagManager from '@/components/GoogleTagManager';
import MetaPixel from '@/components/MetaPixel';
import MicrosoftClarity from '@/components/MicrosoftClarity';

export const metadata: Metadata = {
  title: '델리오 — 프리미엄 과일 전문 쇼핑몰',
  description: '산지 직송 프리미엄 과일 전문 쇼핑몰 델리오. 농가에서 직접 받는 신선한 제철 과일.',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
  },
  openGraph: {
    title: '델리오 — 프리미엄 과일 전문 쇼핑몰',
    description: '산지 직송 프리미엄 과일 전문 쇼핑몰',
    type: 'website',
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
        <GoogleTagManager />
        <GoogleAnalytics />
        <MetaPixel />
        <MicrosoftClarity />
        {children}
      </body>
    </html>
  );
}
