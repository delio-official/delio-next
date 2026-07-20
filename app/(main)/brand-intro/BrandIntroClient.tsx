'use client';

import Link from 'next/link';
import Image from 'next/image';
import '@/styles/index.css';

/* 브랜드 소개 — 디자인 이미지 그대로 노출.
   이미지를 최적화(WebP 변환·리사이즈)하면 이미지 속 버튼 글자가 뭉개지므로,
   버튼만 CSS로 다시 그려서 원래 위치에 정확히 덮는다.
   좌표·색상·글자크기는 원본(1440x7479) 픽셀을 실측해 % / cqw 로 환산 →
   컨테이너 폭이 바뀌어도 항상 동일 비율로 겹친다. */
/* top = 각 이미지에서 버튼의 '세로 중심' 픽셀을 실측해 % 환산. CSS translateY(-50%)로 중앙 정렬.
   PC: 1440x7479 / 모바일: 768x4923 — 비율이 달라 버튼 위치도 각각 다름. */
const BUTTONS_PC = [
  { href: '/farms',   text: '파트너 농가 보기', top: '79.268%' },
  { href: '/inquiry', text: '입점 문의하기',   top: '87.852%' },
];
const BUTTONS_MOB = [
  { href: '/farms',   text: '파트너 농가 보기', top: '80.479%' },
  { href: '/inquiry', text: '입점 문의하기',   top: '88.239%' },
];

export default function BrandIntroClient() {
  return (
    <main style={{ background: '#fff' }}>
      {/* PC (>768px) — 데스크톱 이미지 */}
      <div
        className="brand-intro-wrap brand-intro-pc"
        style={{ position: 'relative', maxWidth: 1440, margin: '0 auto', lineHeight: 0, containerType: 'inline-size' }}
      >
        <Image
          src="/delio_brand.png"
          alt="델리오 브랜드 소개 — 맛에는 기준이 있어야 합니다"
          width={1440}
          height={7479}
          priority
          sizes="(max-width: 1440px) 100vw, 1440px"
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
        {BUTTONS_PC.map(b => (
          <Link key={b.href} href={b.href} className="brand-btn" style={{ top: b.top }}>
            {b.text}
            <span style={{ fontWeight: 400 }}>›</span>
          </Link>
        ))}
      </div>

      {/* 모바일 (≤768px) — 글자가 큰 전용 이미지 */}
      <div
        className="brand-intro-wrap brand-intro-mob"
        style={{ position: 'relative', maxWidth: 768, margin: '0 auto', lineHeight: 0, containerType: 'inline-size' }}
      >
        <Image
          src="/delio_brand_mobile.png"
          alt="델리오 브랜드 소개 — 맛에는 기준이 있어야 합니다"
          width={768}
          height={4923}
          sizes="100vw"
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
        {BUTTONS_MOB.map(b => (
          <Link key={b.href} href={b.href} className="brand-btn brand-btn-m" style={{ top: b.top }}>
            {b.text}
            <span style={{ fontWeight: 400 }}>›</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
