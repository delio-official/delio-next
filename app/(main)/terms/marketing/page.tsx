import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '마케팅 정보 수신 동의 | 델리오',
  description: '델리오 마케팅 광고 활용을 위한 개인정보 수집·이용 및 광고성 정보 수신 동의 안내',
};

import { SECTIONS } from '@/lib/legal_marketing';


export default function MarketingConsentPage() {
  return (
    <main style={{ background: '#fff', minHeight: '100vh', paddingBottom: 80 }}>
      <div className="container" style={{ maxWidth: 780, paddingTop: 40 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>마케팅 정보 수신 동의</h1>
        <p style={{ fontSize: 14, color: '#888', marginBottom: 32 }}>
          마케팅 광고 활용을 위한 개인정보 수집·이용 및 광고성 정보 수신에 대한 안내입니다. (선택)
        </p>

        {SECTIONS.map((sec) => (
          <section key={sec.title} style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid #1A1A1A' }}>
              {sec.title}
            </h2>
            <ul style={{ fontSize: 14, lineHeight: 1.9, color: '#333', paddingLeft: 20, margin: 0 }}>
              {sec.clauses.map((c, i) => (
                <li key={i} style={{ marginBottom: 8 }}>{c}</li>
              ))}
            </ul>
          </section>
        ))}

        <p style={{ fontSize: 13, color: '#aaa', marginTop: 8 }}>시행일: 2026년 06월 16일</p>
      </div>
    </main>
  );
}
