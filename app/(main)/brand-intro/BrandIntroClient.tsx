'use client';

import Link from 'next/link';
import Image from 'next/image';
import '@/styles/index.css';

/* 브랜드 소개 — 디자인 이미지 그대로 노출.
   이미지를 최적화(WebP 변환·리사이즈)하면 이미지 속 버튼 글자가 뭉개지므로,
   버튼만 CSS로 다시 그려서 원래 위치에 정확히 덮는다.
   좌표·색상·글자크기는 원본(1440x7479) 픽셀을 실측해 % / cqw 로 환산 →
   컨테이너 폭이 바뀌어도 항상 동일 비율로 겹친다. */
const BTN_RED = '#F00000';

const BUTTONS = [
  { href: '/farms',   text: '파트너 농가 보기', top: '78.914%' },
  { href: '/inquiry', text: '입점 문의하기',   top: '87.498%' },
];

export default function BrandIntroClient() {
  return (
    <main style={{ background: '#fff' }}>
      <div
        className="brand-intro-wrap"
        style={{ position: 'relative', maxWidth: 1440, margin: '0 auto', lineHeight: 0, containerType: 'inline-size' }}
      >
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

        {/* 이미지 속 버튼 위에 덮는 실제 버튼 (원본: x 752~945 / w194 · h54) */}
        {BUTTONS.map(b => (
          <Link
            key={b.href}
            href={b.href}
            style={{
              position: 'absolute',
              left: '52.22%', top: b.top,
              width: '13.47%', height: '0.722%',
              background: BTN_RED,
              color: '#fff',
              borderRadius: 999,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5cqw',
              fontSize: '1.35cqw',
              fontWeight: 700,
              lineHeight: 1,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {b.text}
            <span style={{ fontWeight: 400 }}>›</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
