'use client';

import Link from 'next/link';

const SECTIONS = [
  {
    icon: '🚚',
    title: '배송 방식',
    items: [
      {
        label: '산지직송',
        desc: '파트너 농가에서 고객님 댁으로 직접 배송합니다. 중간 유통 단계 없이 가장 신선한 상태로 도착합니다.',
        badge: '산지직송',
        badgeColor: '#2D7A4D',
        badgeBg: '#E8F5E9',
      },
      {
        label: '자사배송',
        desc: '델리오 물류센터에서 출발하는 배송입니다. 당일 오후 2시 이전 주문 시 익일 배송됩니다.',
        badge: '자사배송',
        badgeColor: '#1565C0',
        badgeBg: '#E3F2FD',
      },
    ],
  },
  {
    icon: '💰',
    title: '배송비 안내',
    items: [
      { label: '기본 배송비', desc: '3,000원 (주문금액 50,000원 이상 무료배송)' },
      { label: '제주 · 도서산간', desc: '추가 배송비 3,000원이 부과됩니다.' },
      { label: '무료배송 상품', desc: '일부 상품은 개별 무료배송이 적용됩니다. 상품 페이지에서 확인하세요.' },
    ],
  },
  {
    icon: '📅',
    title: '배송 일정',
    items: [
      { label: '주문 마감', desc: '평일 오후 2시 이전 주문 → 당일 출발 (영업일 기준)' },
      { label: '평균 배송일', desc: '출발 후 1~2일 이내 도착 (산지직송은 1~3일 소요)' },
      { label: '최대 배송기간', desc: '결제 완료 후 최대 5일 이내(주말·공휴일 등 비영업일 포함) 배송이 완료됩니다.' },
      { label: '주말·공휴일', desc: '주말 및 공휴일에는 출고가 불가합니다. 익일 영업일에 처리됩니다.' },
    ],
  },
  {
    icon: '📦',
    title: '포장 안내',
    items: [
      { label: '보냉 포장', desc: '여름철(6~9월)에는 아이스팩과 보냉 박스로 안전하게 포장됩니다.' },
      { label: '선물 포장', desc: '선물세트 상품은 프리미엄 포장이 기본 포함됩니다.' },
      { label: '친환경 포장', desc: '델리오는 재활용 가능한 친환경 포장재를 사용합니다.' },
    ],
  },
  {
    icon: '⚠️',
    title: '배송 불가 지역 및 주의사항',
    items: [
      { label: '배송 불가', desc: '군부대, 선박, 해외 주소는 배송이 불가합니다.' },
      { label: '부재 시', desc: '부재 시 문 앞 또는 경비실에 보관되며, 고객 요청 시 안전 장소에 배송됩니다.' },
      { label: '신선도 보장', desc: '배송 중 신선도 문제 발생 시 수령 후 24시간 이내 고객센터로 연락해 주세요.' },
    ],
  },
];

export default function ShippingClient() {
  return (
    <div style={{ background: '#fff', minHeight: '100vh' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px 100px' }}>

        {/* 헤더 */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 12, color: '#aaa', marginBottom: 8 }}>
            <Link href="/" style={{ color: '#aaa', textDecoration: 'none' }}>홈</Link>
            {' › '}배송안내
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A1A', marginBottom: 8 }}>배송안내</h1>
          <p style={{ fontSize: 14, color: '#888', lineHeight: 1.7 }}>
            델리오는 산지에서 고객님 댁까지 가장 신선한 과일을 빠르게 배송합니다.
          </p>
        </div>

        {/* 빠른 요약 카드 */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 40,
        }}>
          {[
            { icon: '⚡', label: '최단 배송', value: '익일 도착' },
            { icon: '🎁', label: '무료배송', value: '5만원 이상' },
            { icon: '📞', label: '고객센터', value: '평일 09~18시 (점심 12~13시 제외)' },
          ].map(c => (
            <div key={c.label} style={{
              background: '#F7F7F5', borderRadius: 12, padding: '16px 12px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>{c.icon}</div>
              <div style={{ fontSize: 11, color: '#999', marginBottom: 3 }}>{c.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* 섹션들 */}
        {SECTIONS.map((sec, si) => (
          <div key={si} style={{ marginBottom: 36 }}>
            {/* 섹션 헤더 */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              paddingBottom: 12, borderBottom: '1.5px solid #1A1A1A', marginBottom: 16,
            }}>
              <span style={{ fontSize: 18 }}>{sec.icon}</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#1A1A1A' }}>{sec.title}</span>
            </div>

            {/* 아이템들 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sec.items.map((item, ii) => (
                <div key={ii} style={{
                  display: 'flex', gap: 14, padding: '14px 16px',
                  background: '#FAFAFA', borderRadius: 10, alignItems: 'flex-start',
                }}>
                  <div style={{
                    width: 4, flexShrink: 0, alignSelf: 'stretch',
                    background: '#1A1A1A', borderRadius: 2, marginTop: 2,
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>{item.label}</span>
                      {'badge' in item && (
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          padding: '2px 7px', borderRadius: 99,
                          background: (item as { badgeBg: string }).badgeBg,
                          color: (item as { badgeColor: string }).badgeColor,
                        }}>
                          {(item as { badge: string }).badge}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 13, color: '#666', lineHeight: 1.7, margin: 0 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* 문의 유도 */}
        <div style={{
          marginTop: 48, background: '#F7F7F5', borderRadius: 16,
          padding: '28px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>배송 관련 추가 문의</div>
          <p style={{ fontSize: 13, color: '#888', lineHeight: 1.7, marginBottom: 20 }}>
            배송 지연 또는 파손 등 문제가 발생하면 빠르게 도와드립니다.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <Link href="/mypage?panel=cs" style={{
              padding: '11px 22px', background: '#1A1A1A', border: 'none',
              borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', textDecoration: 'none', display: 'inline-block',
            }}>
              1:1 문의하기
            </Link>
            <Link href="/faq" style={{
              padding: '11px 22px', background: '#fff', border: '1.5px solid #E0E0E0',
              borderRadius: 10, color: '#1A1A1A', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', textDecoration: 'none', display: 'inline-block',
            }}>
              자주 묻는 질문
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
