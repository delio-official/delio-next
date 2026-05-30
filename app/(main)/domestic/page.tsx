'use client';

import Link from 'next/link';
import '@/styles/index.css';

const CATS = [
  { href: '/category?origin=domestic&cat=apple',  emoji: '🍎', label: '사과 · 배',        gradient: 'linear-gradient(135deg,#FFE5E5,#FFB8B8)', sub: 'APPLE & PEAR' },
  { href: '/category?origin=domestic&cat=citrus', emoji: '🍊', label: '감귤 · 한라봉',    gradient: 'linear-gradient(135deg,#FFF3E0,#FFD08A)', sub: 'CITRUS' },
  { href: '/category?origin=domestic&cat=grape',  emoji: '🍇', label: '포도 · 샤인머스캣', gradient: 'linear-gradient(135deg,#F3E5FF,#D9B8FF)', sub: 'GRAPE' },
  { href: '/category?origin=domestic&cat=berry',  emoji: '🫐', label: '베리류 · 딸기',    gradient: 'linear-gradient(135deg,#E8F0FF,#B8CCFF)', sub: 'BERRY' },
  { href: '/category?origin=domestic&cat=melon',  emoji: '🍈', label: '멜론 · 참외',      gradient: 'linear-gradient(135deg,#E8FFE8,#A8E8A8)', sub: 'MELON' },
  { href: '/category?origin=domestic&cat=gift',   emoji: '🎁', label: '선물세트',          gradient: 'linear-gradient(135deg,#1A1A1A,#3A3A3A)',  sub: 'GIFT SET', dark: true },
];

export default function DomesticPage() {
  return (
    <main style={{ background: '#fff', minHeight: '100vh', paddingBottom: 80 }}>

      {/* 히어로 */}
      <div style={{
        background: 'linear-gradient(135deg,#F0F7E6 0%,#E4F0D4 100%)',
        padding: '56px 0 44px', borderBottom: '1px solid #D8EAC8',
        textAlign: 'center',
      }}>
        <div className="container">
          <p style={{ fontSize: 11, color: '#6A9040', fontWeight: 700, letterSpacing: 3, marginBottom: 12 }}>
            DOMESTIC FRUIT
          </p>
          <h1 style={{ fontSize: 'clamp(26px,4vw,38px)', fontWeight: 800, marginBottom: 14, lineHeight: 1.3 }}>
            국산과일
          </h1>
          <p style={{ fontSize: 15, color: '#666', lineHeight: 1.8, maxWidth: 400, margin: '0 auto' }}>
            전국 파트너 농가에서 수확한<br />신선한 국산 과일을 산지 직송으로 만나보세요.
          </p>
          <div style={{ fontSize: 12, color: '#aaa', marginTop: 20 }}>
            <Link href="/" style={{ color: '#aaa', textDecoration: 'none' }}>홈</Link>
            <span style={{ margin: '0 6px' }}>/</span>
            <span style={{ color: '#555' }}>국산과일</span>
          </div>
        </div>
      </div>

      {/* 전체보기 배너 */}
      <div className="container" style={{ maxWidth: 860, paddingTop: 40 }}>
        <Link href="/category?origin=domestic" style={{ textDecoration: 'none', color: 'inherit', display: 'block', marginBottom: 28 }}>
          <div style={{
            borderRadius: 20, background: 'linear-gradient(135deg,#E8F5E9,#C8E6C9)',
            padding: '28px 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            border: '1.5px solid #A5D6A7', transition: 'box-shadow .2s',
          }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
          >
            <div>
              <p style={{ fontSize: 11, letterSpacing: 2, color: '#4CAF50', fontWeight: 700, marginBottom: 8 }}>ALL DOMESTIC</p>
              <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>국산과일 전체보기</h3>
              <p style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}>모든 국산 과일을 한눈에 확인하세요</p>
            </div>
            <div style={{ fontSize: 48, flexShrink: 0, marginLeft: 20 }}>🍎</div>
          </div>
        </Link>

        {/* 카테고리 카드 그리드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 20 }}>
          {CATS.map(c => (
            <Link key={c.href} href={c.href} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{
                borderRadius: 20, overflow: 'hidden', border: '1.5px solid #E8E8E8',
                transition: 'box-shadow .2s, transform .2s', cursor: 'pointer',
              }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.1)';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                  (e.currentTarget as HTMLDivElement).style.transform = 'none';
                }}
              >
                <div style={{
                  height: 160, background: c.gradient,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'column', gap: 10,
                }}>
                  <div style={{ fontSize: 52 }}>{c.emoji}</div>
                  <span style={{
                    fontSize: 10, letterSpacing: 3, fontWeight: 700,
                    color: c.dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.3)',
                  }}>
                    {c.sub}
                  </span>
                </div>
                <div style={{ padding: '20px 22px 22px' }}>
                  <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>{c.label}</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>
                    바로가기
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

    </main>
  );
}
