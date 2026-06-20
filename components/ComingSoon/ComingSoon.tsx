'use client';

/**
 * 콘텐츠가 아직 없는 영역에 보여주는 "준비중" 플레이스홀더.
 * 모니터+기어 아이콘 + 안내 문구. title/desc 로 문구 커스텀 가능.
 */
export default function ComingSoon({
  title = '페이지 준비중입니다.',
  desc = ['현재 콘텐츠 준비중입니다.', '빠른 시일 내에 준비하여 찾아뵙겠습니다.'],
  compact = false,
}: {
  title?: string;
  desc?: string | string[];
  compact?: boolean;
}) {
  const lines = Array.isArray(desc) ? desc : [desc];
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: compact ? '48px 16px' : '88px 16px',
        width: '100%',
      }}
    >
      <img src="/DelioLogo.png" alt="델리오"
        style={{ height: compact ? 40 : 52, width: 'auto', marginBottom: 20, opacity: 0.85 }} />

      <h3 style={{
        fontSize: compact ? 17 : 20,
        fontWeight: 800,
        color: '#1A1A1A',
        margin: 0,
        letterSpacing: '-0.01em',
      }}>
        {title}
      </h3>

      <div style={{ marginTop: 10, color: '#9A958E', fontSize: 13.5, lineHeight: 1.7 }}>
        {lines.map((line, i) => (
          <p key={i} style={{ margin: 0 }}>{line}</p>
        ))}
      </div>
    </div>
  );
}
