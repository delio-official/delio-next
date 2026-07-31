/* 공용 로딩 스피너 — 스켈레톤 대체용. "불러오는 중..." 문구 포함 */
export default function Spinner({ text = '불러오는 중...', minHeight = 220 }: { text?: string; minHeight?: number }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 12, width: '100%', minHeight, color: '#9A9A9A',
    }}>
      <div className="delio-spinner" aria-hidden />
      <span style={{ fontSize: 13, fontWeight: 500 }}>{text}</span>
    </div>
  );
}
