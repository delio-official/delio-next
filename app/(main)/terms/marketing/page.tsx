import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '마케팅 정보 수신 동의 | 델리오',
  description: '델리오 마케팅 광고 활용을 위한 개인정보 수집·이용 및 광고성 정보 수신 동의 안내',
};

const SECTIONS: { title: string; clauses: string[] }[] = [
  {
    title: '1. 수집·이용 목적',
    clauses: [
      '신상품 소식, 이벤트·프로모션·할인쿠폰 등 혜택 정보의 안내 및 제공',
      '고객 맞춤형 상품 추천 및 광고성 정보 전송',
      '사은 행사, 고객 만족도 조사 등 마케팅 활용',
    ],
  },
  {
    title: '2. 수집하는 항목',
    clauses: [
      '이름, 휴대전화번호, 이메일 주소',
      '서비스 이용 기록, 구매 및 관심 상품 정보(맞춤형 추천 목적)',
    ],
  },
  {
    title: '3. 전송 방법',
    clauses: [
      '문자(SMS/MMS/알림톡), 이메일 등 회원이 동의한 채널을 통해 발송됩니다.',
      '광고성 정보 전송 시「정보통신망 이용촉진 및 정보보호 등에 관한 법률」에 따라 (광고) 표기 및 수신거부 방법을 함께 안내합니다.',
    ],
  },
  {
    title: '4. 보유·이용 기간',
    clauses: [
      '회원 탈퇴 시 또는 마케팅 수신 동의 철회 시까지 보유·이용합니다.',
      '동의 철회 또는 탈퇴 시 해당 정보는 지체 없이 파기합니다.',
    ],
  },
  {
    title: '5. 동의를 거부할 권리 및 불이익',
    clauses: [
      '본 마케팅 정보 수신 동의는 선택 사항으로, 동의하지 않아도 회원가입 및 일반적인 서비스 이용에는 제한이 없습니다.',
      '다만 동의하지 않으실 경우 할인쿠폰·이벤트 등 혜택 정보 안내를 받지 못할 수 있습니다.',
    ],
  },
  {
    title: '6. 동의 철회 방법',
    clauses: [
      '마이페이지 > 회원정보 수정 > 마케팅 수신 설정에서 언제든지 동의를 철회할 수 있습니다.',
      '수신한 메시지 내 수신거부 안내 또는 고객센터(070-8064-3601)를 통해서도 철회가 가능합니다.',
    ],
  },
];

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
