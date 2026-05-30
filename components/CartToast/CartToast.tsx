'use client';

import { useState, useEffect, useRef } from 'react';

export default function CartToast() {
  const [visible, setVisible]   = useState(false);
  const [animIn, setAnimIn]     = useState(false);
  const timerRef                = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animTimerRef            = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handler() {
      // 이미 표시 중이면 타이머 리셋
      if (timerRef.current)     clearTimeout(timerRef.current);
      if (animTimerRef.current) clearTimeout(animTimerRef.current);

      setVisible(true);
      // 다음 프레임에 animIn → 슬라이드업 시작
      animTimerRef.current = setTimeout(() => setAnimIn(true), 20);

      // 2초 후 슬라이드다운 → 숨김
      timerRef.current = setTimeout(() => {
        setAnimIn(false);
        setTimeout(() => setVisible(false), 280);
      }, 2000);
    }

    window.addEventListener('cartToast', handler);
    return () => {
      window.removeEventListener('cartToast', handler);
      if (timerRef.current)     clearTimeout(timerRef.current);
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position:        'fixed',
        left:            '50%',
        bottom:          animIn ? 76 : 52,
        transform:       'translateX(-50%)',
        zIndex:          9999,
        opacity:         animIn ? 1 : 0,
        transition:      'bottom 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.22s ease',
        pointerEvents:   'none',
        display:         'flex',
        alignItems:      'center',
        gap:             10,
        background:      '#1A1A1A',
        color:           '#fff',
        borderRadius:    12,
        padding:         '12px 20px',
        fontSize:        14,
        fontWeight:      600,
        whiteSpace:      'nowrap',
        boxShadow:       '0 6px 24px rgba(0,0,0,0.22)',
        letterSpacing:   '-0.01em',
      }}
    >
      장바구니에 담겼습니다

      {/* 장바구니 아이콘 */}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" width="17" height="17"
        style={{ opacity: 0.75 }}>
        <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>
        <path d="M2.05 2.05h2l2.66 12.42a2 2 0 001.95 1.53h9.58a2 2 0 001.95-1.53l1.54-8.42H5.05"/>
      </svg>
    </div>
  );
}
