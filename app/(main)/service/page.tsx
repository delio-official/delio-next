'use client';

import Link from 'next/link';

export default function ServicePage() {
  return (
    <div style={{ background: '#fff', minHeight: '100vh' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 20px 100px' }}>

        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A1A', marginBottom: 8 }}>어떤 서비스가 필요하신가요?</h1>
        <p style={{ fontSize: 14, color: '#888', marginBottom: 40 }}>원하시는 항목을 선택하세요.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            {
              href: '/shipping',
              icon: '🚚',
              title: '배송안내',
              desc: '배송 방식, 배송비, 배송 일정 등 배송 관련 정책을 안내합니다.',
            },
            {
              href: '/inquiry',
              icon: '🤝',
              title: '입점/협업 문의',
              desc: '농가 입점, 브랜드 협업, 파트너십 등 비즈니스 문의를 남겨주세요.',
            },
            {
              href: '/faq',
              icon: '💬',
              title: '고객센터',
              desc: '자주 묻는 질문 확인 및 1:1 문의로 빠른 답변을 받아보세요.',
            },
          ].map(item => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 20,
                padding: '24px 28px', borderRadius: 16,
                border: '1.5px solid #E8E8E8', background: '#fff',
                cursor: 'pointer', transition: 'all .15s',
              }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = '#1A1A1A';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = '#E8E8E8';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                }}
              >
                <div style={{
                  width: 56, height: 56, borderRadius: 14, flexShrink: 0,
                  background: '#F7F7F5', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 26,
                }}>
                  {item.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A', marginBottom: 5 }}>{item.title}</div>
                  <div style={{ fontSize: 13, color: '#888', lineHeight: 1.6 }}>{item.desc}</div>
                </div>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#C0C0C0" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
}
