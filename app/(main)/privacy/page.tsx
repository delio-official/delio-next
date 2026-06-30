import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '개인정보처리방침 | 델리오',
  description: '델리오 개인정보처리방침',
};

import { SECTIONS } from '@/lib/legal_privacy';


export default function PrivacyPage() {
  return (
    <main style={{ background: '#fff', minHeight: '100vh', paddingBottom: 80 }}>
      <div className="container" style={{ maxWidth: 780, paddingTop: 40 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>개인정보처리방침</h1>
        <p style={{ fontSize: 14, color: '#888', marginBottom: 32 }}>시행일: 2026년 06월 12일</p>

        <p style={{ fontSize: 14, color: '#555', lineHeight: 1.9, marginBottom: 36 }}>
          델리오(이하 “회사”)는 「개인정보 보호법」 및 「전자상거래 등에서의 소비자보호에 관한 법률」 등
          관련 법령을 준수하며, 이용자의 개인정보를 안전하게 보호하기 위해 다음과 같은 처리방침을 두고 있습니다.
        </p>

        {SECTIONS.map((sec) => (
          <section key={sec.title} style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid #1A1A1A' }}>
              {sec.title}
            </h2>
            <div style={{ fontSize: 14, lineHeight: 2, color: '#333' }}>
              {sec.lines.map((l, i) => (
                <p key={i} style={{ margin: '0 0 6px' }}>{l}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
