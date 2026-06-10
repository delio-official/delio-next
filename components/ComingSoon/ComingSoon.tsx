'use client';

import React from 'react';

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
      <svg width={compact ? 72 : 92} height={compact ? 72 : 92} viewBox="0 0 96 96" fill="none"
        style={{ marginBottom: 22 }} aria-hidden="true">
        {/* 모니터 화면 */}
        <rect x="13" y="15" width="70" height="49" rx="6" fill="#E8804C" />
        <rect x="13" y="15" width="70" height="49" rx="6" stroke="#2B3A55" strokeWidth="4.5" />
        {/* 받침대 */}
        <rect x="40" y="64" width="16" height="11" fill="#2B3A55" />
        <rect x="29" y="76" width="38" height="5.5" rx="2.75" fill="#2B3A55" />
        {/* 기어 (화면 중앙, 흰색) */}
        <g transform="translate(31.7,23.7) scale(1.36)" fill="#fff">
          <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
        </g>
      </svg>

      <h3 style={{
        fontSize: compact ? 17 : 20,
        fontWeight: 800,
        color: '#2B3A55',
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
