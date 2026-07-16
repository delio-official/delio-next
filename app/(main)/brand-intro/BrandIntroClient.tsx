'use client';

import Link from 'next/link';
import Image from 'next/image';
import '@/styles/index.css';

/* 브랜드 소개 — 디자인 이미지 그대로 노출 + 이미지 내 버튼 2개에 클릭 영역(핫스팟) 연결.
   좌표는 원본(1440x7479)에서 빨간 버튼 픽셀을 측정해 % 로 환산 → 화면 폭이 바뀌어도 항상 정확히 겹침. */
const HOTSPOTS = [
  { href: '/farms',   label: '파트너 농가 보기', left: '52.22%', top: '78.914%', width: '13.47%', height: '0.722%' },
  { href: '/inquiry', label: '입점 문의하기',   left: '52.22%', top: '87.498%', width: '13.47%', height: '0.722%' },
];

export default function BrandIntroClient() {
  return (
    <main style={{ background: '#fff' }}>
      <div style={{ position: 'relative', maxWidth: 1440, margin: '0 auto', lineHeight: 0 }}>
        {/* 원본 6MB PNG → next/image 로 WebP 변환·리사이즈 (로딩 속도) */}
        <Image
          src="/delio_brand.png"
          alt="델리오 브랜드 소개 — 맛에는 기준이 있어야 합니다"
          width={1440}
          height={7479}
          priority
          sizes="(max-width: 1440px) 100vw, 1440px"
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
        {HOTSPOTS.map(h => (
          <Link
            key={h.href}
            href={h.href}
            aria-label={h.label}
            title={h.label}
            style={{
              position: 'absolute',
              left: h.left, top: h.top, width: h.width, height: h.height,
              display: 'block', borderRadius: 999,
            }}
          />
        ))}
      </div>
    </main>
  );
}
