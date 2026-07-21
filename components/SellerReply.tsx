/* 판매자 답변 표시 — 리뷰가 보이는 모든 화면에서 같은 모양으로 쓰기 위한 공용 컴포넌트.
   (상품상세 / 리뷰 모아보기 / 리뷰 상세 / 리뷰 사진 모달 / 홈 리뷰 하이라이트)
   상품상세는 관리자 수정 버튼이 붙어 있어 자체 마크업을 그대로 둔다. */
export function SellerReply({ reply, compact }: { reply?: string | null; compact?: boolean }) {
  if (!reply) return null;
  return (
    <div style={{
      marginTop: compact ? 8 : 12,
      padding: compact ? '9px 11px' : '12px 14px',
      background: '#F7F7F5', borderRadius: 8, textAlign: 'left',
    }}>
      <div style={{ fontSize: compact ? 11 : 12, fontWeight: 700, color: '#555', marginBottom: 4 }}>
        판매자 답변
      </div>
      <p style={{
        fontSize: compact ? 12 : 13, color: '#555', lineHeight: 1.7,
        whiteSpace: 'pre-wrap', margin: 0,
        ...(compact ? { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' } : {}),
      }}>
        {reply}
      </p>
    </div>
  );
}
