import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '이용약관 | 델리오',
  description: '델리오 전자상거래 이용약관 (전자상거래 표준약관 제10023호)',
};

import { ARTICLES } from '@/lib/legal_terms';


export default function TermsPage() {
  return (
    <main style={{ background: '#fff', minHeight: '100vh', paddingBottom: 80 }}>
      <div className="container" style={{ maxWidth: 780, paddingTop: 40 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>이용약관</h1>
        <p style={{ fontSize: 13, color: '#aaa', marginBottom: 6 }}>전자상거래(인터넷사이버몰) 표준약관 (공정거래위원회 표준약관 제10023호) 기준</p>
        <p style={{ fontSize: 14, color: '#888', marginBottom: 32 }}>시행일: 2026년 06월 12일</p>

        <div style={{ background: '#F8F8F8', borderRadius: 10, padding: '16px 18px', marginBottom: 36, fontSize: 13.5, color: '#555', lineHeight: 1.9 }}>
          상호명 : 델리오 &nbsp;|&nbsp; 대표 : 송민창<br />
          주소 : 경기도 고양시 덕양구 권율대로 656, 13층 1329호 (원흥동, 클래시아 더 퍼스트)<br />
          사업자등록번호 : 288-12-02921 &nbsp;|&nbsp; 통신판매업신고 : 2026-고양덕양구-1612<br />
          개인정보관리책임자 : 송민창<br />
          고객센터 : 070-8064-3601 &nbsp;|&nbsp; 이메일 : deli_o@naver.com
        </div>

        {ARTICLES.map((art) => (
          <section key={art.title} style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid #1A1A1A' }}>
              {art.title}
            </h2>
            <ol style={{ fontSize: 14, lineHeight: 1.9, color: '#333', paddingLeft: 20, margin: 0 }}>
              {art.clauses.map((c, i) => (
                <li key={i} style={{ marginBottom: 8 }}>{c}</li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </main>
  );
}
