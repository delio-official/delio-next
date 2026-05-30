'use client';

import Link from 'next/link';
import '@/styles/index.css';

const VALUES = [
  { emoji: '🌱', title: '산지 직계약', desc: '중간 유통 없이 농가와 직접 계약합니다. 농부의 정성이 그대로 식탁에 전해져요.' },
  { emoji: '🔬', title: '당도 검수 시스템', desc: '모든 상품은 출하 전 당도 측정을 거칩니다. 기준 미달 시 전량 반품합니다.' },
  { emoji: '❄️', title: '콜드체인 배송', desc: '수확부터 배송까지 저온을 유지합니다. 신선함을 문 앞까지 그대로 보냅니다.' },
  { emoji: '♻️', title: '지속가능한 농업', desc: '친환경 재배 농가를 우선 선정합니다. 맛있는 과일과 환경, 모두 지킵니다.' },
];

const TIMELINE = [
  { year: '2020', title: '델리오 창업', desc: '제주 감귤 직거래로 시작, 농가와 소비자 사이의 거리를 줄이겠다는 다짐' },
  { year: '2021', title: '파트너 농가 10곳 돌파', desc: '사과, 포도, 베리류로 카테고리 확장. 당도 보장 시스템 도입' },
  { year: '2022', title: '새벽배송 서비스 시작', desc: '콜드체인 배송망 구축. 전국 익일 새벽 배송 가능' },
  { year: '2023', title: '누적 주문 10만 건 달성', desc: '회원 기반 구독 서비스 출시. VIP/VVIP 멤버십 운영' },
  { year: '2024', title: '글로벌 파트너십', desc: '뉴질랜드 제스프리, 칠레 포도 산지와 직수입 계약 체결' },
  { year: '2025', title: '지금 이 순간', desc: '여러분의 식탁에 신선한 과일을 전하기 위해 오늘도 달립니다' },
];

export default function BrandClient() {
  return (
    <main style={{ background: '#fff', minHeight: '100vh', paddingBottom: 80 }}>

      {/* 히어로 */}
      <div style={{ background: 'linear-gradient(135deg,#1A1A1A 0%,#2D2D2D 100%)',
        padding: '72px 0 60px', textAlign: 'center', color: '#fff' }}>
        <div className="container">
          <p style={{ fontSize: 11, letterSpacing: 4, color: 'rgba(255,255,255,0.5)',
            fontWeight: 700, marginBottom: 16 }}>DELI'O BRAND STORY</p>
          <div style={{ fontSize: 64, marginBottom: 20 }}>🍑</div>
          <h1 style={{ fontSize: 'clamp(28px,5vw,44px)', fontWeight: 900, marginBottom: 16,
            lineHeight: 1.25, letterSpacing: -0.5 }}>
            과일을 대하는<br />우리의 방식
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.65)', lineHeight: 1.8,
            maxWidth: 440, margin: '0 auto 28px' }}>
            맛있는 과일이 제철에, 신선하게,<br />
            합리적인 가격으로 식탁에 올라야 한다고 믿습니다.
          </p>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
            <Link href="/" style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>홈</Link>
            <span style={{ margin: '0 6px' }}>/</span>
            <Link href="/brand-intro" style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>브랜드 소개관</Link>
            <span style={{ margin: '0 6px' }}>/</span>
            <span style={{ color: 'rgba(255,255,255,0.6)' }}>브랜드 소개</span>
          </div>
        </div>
      </div>

      <div className="container" style={{ maxWidth: 780 }}>

        {/* 브랜드 철학 */}
        <section style={{ padding: '64px 0 48px', textAlign: 'center', borderBottom: '1px solid #F0F0EE' }}>
          <p style={{ fontSize: 11, letterSpacing: 3, color: '#A08060', fontWeight: 700, marginBottom: 16 }}>
            OUR PHILOSOPHY
          </p>
          <h2 style={{ fontSize: 'clamp(20px,3vw,28px)', fontWeight: 800, lineHeight: 1.4, marginBottom: 20 }}>
            &ldquo;좋은 과일은 좋은 땅에서,<br />좋은 관계에서 옵니다&rdquo;
          </h2>
          <p style={{ fontSize: 15, color: '#555', lineHeight: 1.9, maxWidth: 540, margin: '0 auto' }}>
            델리오는 단순히 과일을 파는 게 아니라<br />
            농부의 이야기와 땅의 가치를 전달합니다.<br />
            소비자가 과일 하나를 고를 때,<br />
            그 뒤에 있는 농가와 계절을 느낄 수 있도록.
          </p>
        </section>

        {/* 핵심 가치 */}
        <section style={{ padding: '56px 0', borderBottom: '1px solid #F0F0EE' }}>
          <p style={{ fontSize: 11, letterSpacing: 3, color: '#A08060', fontWeight: 700,
            marginBottom: 8, textAlign: 'center' }}>OUR VALUES</p>
          <h2 style={{ fontSize: 22, fontWeight: 800, textAlign: 'center', marginBottom: 36 }}>
            델리오가 지키는 것들
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 20 }}>
            {VALUES.map(v => (
              <div key={v.title} style={{ padding: '28px 24px', borderRadius: 16,
                border: '1.5px solid #F0F0EE', background: '#FAFAF8' }}>
                <div style={{ fontSize: 36, marginBottom: 14 }}>{v.emoji}</div>
                <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>{v.title}</h3>
                <p style={{ fontSize: 13, color: '#666', lineHeight: 1.7 }}>{v.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 타임라인 */}
        <section style={{ padding: '56px 0', borderBottom: '1px solid #F0F0EE' }}>
          <p style={{ fontSize: 11, letterSpacing: 3, color: '#A08060', fontWeight: 700,
            marginBottom: 8, textAlign: 'center' }}>OUR JOURNEY</p>
          <h2 style={{ fontSize: 22, fontWeight: 800, textAlign: 'center', marginBottom: 40 }}>
            델리오의 걸어온 길
          </h2>
          <div style={{ position: 'relative', paddingLeft: 28 }}>
            {/* 세로 라인 */}
            <div style={{ position: 'absolute', left: 8, top: 0, bottom: 0,
              width: 2, background: '#E8E8E6', borderRadius: 2 }} />
            {TIMELINE.map((t, i) => (
              <div key={t.year} style={{ position: 'relative', marginBottom: i < TIMELINE.length - 1 ? 36 : 0 }}>
                {/* 점 */}
                <div style={{ position: 'absolute', left: -24, top: 4, width: 12, height: 12,
                  borderRadius: '50%', background: i === TIMELINE.length - 1 ? '#1A1A1A' : '#D4C9B0',
                  border: '2px solid #fff', boxShadow: '0 0 0 2px #E8E8E6' }} />
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#A08060', minWidth: 36 }}>
                    {t.year}
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 800 }}>{t.title}</span>
                </div>
                <p style={{ fontSize: 13, color: '#666', lineHeight: 1.6, marginLeft: 48 }}>
                  {t.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section style={{ padding: '56px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🤝</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>함께 만들어가요</h2>
          <p style={{ fontSize: 14, color: '#666', lineHeight: 1.7, marginBottom: 28 }}>
            좋은 농산물을 키우는 농가,<br />
            신선한 과일을 찾는 소비자와 함께 성장합니다.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/farms" style={{ padding: '13px 28px', background: '#1A1A1A', color: '#fff',
              borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
              파트너 농가 보기 →
            </Link>
            <Link href="/inquiry" style={{ padding: '13px 28px', border: '1.5px solid #1A1A1A',
              color: '#1A1A1A', borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: 'none',
              background: '#fff' }}>
              입점 문의하기
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
