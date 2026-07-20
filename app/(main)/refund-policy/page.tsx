import type { Metadata } from 'next';
import { CS_PHONE, CS_HOURS, CS_LUNCH, CS_HOLIDAY } from '@/lib/company';

export const metadata: Metadata = {
  title: '취소/환불 정책 | 델리오',
  description: '델리오 취소 및 환불 정책 안내',
};

export default function RefundPolicyPage() {
  return (
    <main style={{ background: '#fff', minHeight: '100vh', paddingBottom: 80 }}>
      <div className="container" style={{ maxWidth: 780, paddingTop: 40 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>취소 / 환불 정책</h1>
        <p style={{ fontSize: 14, color: '#888', marginBottom: 40 }}>
          최종 수정일: 2026년 01월 01일
        </p>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid #1A1A1A' }}>
            1. 주문 취소
          </h2>
          <ul style={{ fontSize: 14, lineHeight: 2, color: '#333', paddingLeft: 20 }}>
            <li>주문 완료 후 <strong>출고 전</strong>까지 마이페이지 또는 고객센터를 통해 취소 가능합니다.</li>
            <li>상품이 <strong>출고된 이후</strong>에는 단순 변심에 의한 취소가 불가합니다.</li>
            <li>취소 요청 후 환불은 결제 수단에 따라 3~5 영업일 내 처리됩니다.</li>
          </ul>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid #1A1A1A' }}>
            2. 교환 / 반품 불가 사유
          </h2>
          <p style={{ fontSize: 14, color: '#555', lineHeight: 1.8, marginBottom: 12 }}>
            신선 식품 특성상 아래의 경우 교환 및 반품이 불가합니다.
          </p>
          <ul style={{ fontSize: 14, lineHeight: 2, color: '#333', paddingLeft: 20 }}>
            <li>단순 변심, 주문 착오, 개인 정보 오기재의 경우</li>
            <li>수취인 연락 부재로 인한 미수령 또는 반송의 경우</li>
            <li>소비자의 취급 부주의로 인한 상품 훼손의 경우</li>
            <li>냉장·냉동 보관 미준수로 인한 품질 저하의 경우</li>
            <li>상품 수령 후 2일이 경과한 경우</li>
          </ul>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid #1A1A1A' }}>
            3. 교환 / 환불 가능 사유
          </h2>
          <ul style={{ fontSize: 14, lineHeight: 2, color: '#333', paddingLeft: 20 }}>
            <li>배송 중 파손 또는 변질된 경우</li>
            <li>주문 상품과 다른 상품이 배송된 경우</li>
            <li>상품에 품질 이상이 확인된 경우</li>
          </ul>
          <div style={{ background: '#FFF9E6', border: '1px solid #FFE082', borderRadius: 8, padding: '12px 16px', marginTop: 16, fontSize: 13, color: '#92400E' }}>
            ⚠️ 교환·환불 요청 시 <strong>수령 후 1~2일 이내</strong>에 사진을 첨부하여 고객센터로 문의해 주세요.
          </div>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid #1A1A1A' }}>
            4. 환불 처리 기준
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#F8F8F8' }}>
                  <th style={{ padding: '10px 14px', border: '1px solid #E0E0E0', textAlign: 'left', fontWeight: 700 }}>결제 수단</th>
                  <th style={{ padding: '10px 14px', border: '1px solid #E0E0E0', textAlign: 'left', fontWeight: 700 }}>환불 방법</th>
                  <th style={{ padding: '10px 14px', border: '1px solid #E0E0E0', textAlign: 'left', fontWeight: 700 }}>처리 기간</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['신용카드', '카드 취소', '3~5 영업일'],
                  ['카카오페이', '카카오페이 환불', '3~5 영업일'],
                  ['네이버페이', '네이버페이 환불', '3~5 영업일'],
                  ['무통장입금', '계좌이체 환불', '3~5 영업일'],
                ].map(([method, way, days]) => (
                  <tr key={method}>
                    <td style={{ padding: '10px 14px', border: '1px solid #E0E0E0' }}>{method}</td>
                    <td style={{ padding: '10px 14px', border: '1px solid #E0E0E0' }}>{way}</td>
                    <td style={{ padding: '10px 14px', border: '1px solid #E0E0E0' }}>{days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid #1A1A1A' }}>
            5. 배송비 부담 기준
          </h2>
          <ul style={{ fontSize: 14, lineHeight: 2, color: '#333', paddingLeft: 20 }}>
            <li><strong>상품 하자·오배송</strong>: 왕복 배송비 당사 부담</li>
            <li><strong>단순 변심 (교환 가능 시)</strong>: 왕복 배송비 고객 부담</li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid #1A1A1A' }}>
            6. 고객센터
          </h2>
          <p style={{ fontSize: 14, lineHeight: 2, color: '#333' }}>
            취소·교환·환불 관련 문의는 아래로 연락 주세요.<br />
            고객센터: {CS_PHONE}<br />
            운영시간: {CS_HOURS} (점심시간 {CS_LUNCH} · {CS_HOLIDAY} 휴무)<br />
            이메일: help@delio.co.kr
          </p>
        </section>
      </div>
    </main>
  );
}
