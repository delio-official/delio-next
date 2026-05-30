'use client';

import Link from 'next/link';
import '@/styles/index.css';

export default function BrandIntroClient() {
  return (
    <main style={{ background: '#fff', minHeight: '100vh', paddingBottom: 80 }}>

      {/* 히어로 */}
      <div style={{
        background: 'linear-gradient(135deg,#F4EFE6 0%,#EDE8DC 100%)',
        padding: '56px 0 44px', borderBottom: '1px solid #E8E2D8',
        textAlign: 'center',
      }}>
        <div className="container">
          <p style={{ fontSize: 11, color: '#A08060', fontWeight: 700, letterSpacing: 3, marginBottom: 12 }}>
            DELI'O BRAND
          </p>
          <h1 style={{ fontSize: 'clamp(26px,4vw,38px)', fontWeight: 800, marginBottom: 14, lineHeight: 1.3 }}>
            브랜드 소개관
          </h1>
          <p style={{ fontSize: 15, color: '#666', lineHeight: 1.8, maxWidth: 420, margin: '0 auto' }}>
            델리오의 이야기와<br />
            함께하는 파트너 농가를 소개합니다.
          </p>
          <div style={{ fontSize: 12, color: '#aaa', marginTop: 20 }}>
            <Link href="/" style={{ color: '#aaa', textDecoration: 'none' }}>홈</Link>
            <span style={{ margin: '0 6px' }}>/</span>
            <span style={{ color: '#555' }}>브랜드 소개관</span>
          </div>
        </div>
      </div>

      {/* 두 카드 */}
      <section style={{ paddingTop: 56 }}>
        <div className="container" style={{ maxWidth: 800 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 24 }}>

            {/* 브랜드 소개 카드 */}
            <Link href="/brand" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{
                borderRadius: 20, overflow: 'hidden', border: '1.5px solid #E8E2D8',
                transition: 'box-shadow .2s, transform .2s', cursor: 'pointer',
              }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.1)';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                  (e.currentTarget as HTMLDivElement).style.transform = 'none';
                }}>
                {/* 이미지 영역 */}
                <div style={{ height: 200, background: 'linear-gradient(135deg,#1A1A1A 0%,#3A3A3A 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontSize: 56 }}>🍑</div>
                  <span style={{ fontSize: 11, letterSpacing: 3, color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>
                    DELIO BRAND STORY
                  </span>
                </div>
                {/* 텍스트 */}
                <div style={{ padding: '24px 28px 28px' }}>
                  <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>브랜드 소개</h2>
                  <p style={{ fontSize: 14, color: '#666', lineHeight: 1.7, marginBottom: 20 }}>
                    델리오가 과일을 대하는 방식,<br />
                    신선함에 대한 철학과 이야기를 담았습니다.
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>
                    브랜드 스토리 보기
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </div>
                </div>
              </div>
            </Link>

            {/* 파트너 농가 카드 */}
            <Link href="/farms" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{
                borderRadius: 20, overflow: 'hidden', border: '1.5px solid #E8E2D8',
                transition: 'box-shadow .2s, transform .2s', cursor: 'pointer',
              }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.1)';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                  (e.currentTarget as HTMLDivElement).style.transform = 'none';
                }}>
                {/* 이미지 영역 */}
                <div style={{ height: 200, background: 'linear-gradient(135deg,#F4EFE6 0%,#D4C9B0 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontSize: 56 }}>🌾</div>
                  <span style={{ fontSize: 11, letterSpacing: 3, color: '#A08060', fontWeight: 700 }}>
                    PARTNER FARM
                  </span>
                </div>
                {/* 텍스트 */}
                <div style={{ padding: '24px 28px 28px' }}>
                  <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>파트너 농가</h2>
                  <p style={{ fontSize: 14, color: '#666', lineHeight: 1.7, marginBottom: 20 }}>
                    델리오와 함께하는 믿을 수 있는 농가.<br />
                    각 농가의 이야기와 재배 철학을 소개합니다.
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>
                    파트너 농가 보기
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </div>
                </div>
              </div>
            </Link>

          </div>

          {/* 브랜드 직송관 배너 */}
          <Link href="/brand-direct" style={{ textDecoration: 'none', color: 'inherit', display: 'block', marginTop: 24 }}>
            <div style={{ borderRadius: 20, background: 'linear-gradient(135deg,#EEF5FF,#D8E9FF)',
              padding: '32px 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              border: '1.5px solid #C8DCF8', transition: 'box-shadow .2s' }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
              <div>
                <p style={{ fontSize: 11, letterSpacing: 2, color: '#3A6AB0', fontWeight: 700, marginBottom: 8 }}>
                  BRAND DIRECT SHOP
                </p>
                <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>브랜드 직송관</h3>
                <p style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}>
                  파트너 농가의 신선한 상품을 직접 만나보세요
                </p>
              </div>
              <div style={{ fontSize: 48, flexShrink: 0, marginLeft: 20 }}>🚚</div>
            </div>
          </Link>
        </div>
      </section>
    </main>
  );
}
