'use client';

import { useEffect } from 'react';

export default function FloatingButtons() {
  /* 스크롤 감지 → body에 scroll-active 클래스 토글 */
  useEffect(() => {
    function onScroll() {
      if (window.scrollY > 120) {
        document.body.classList.add('scroll-active');
      } else {
        document.body.classList.remove('scroll-active');
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <>
      {/* 상단 이동 버튼 */}
      <button
        className="scroll-top-btn"
        onClick={scrollToTop}
        title="맨 위로"
        aria-label="맨 위로 이동"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>

      {/* 카카오 플로팅 버튼 */}
      <button
        className="kakao-float"
        title="카카오 채널 상담"
        aria-label="카카오 채널 상담"
        onClick={() => window.open('https://pf.kakao.com/_RxnrxbX/chat', '_blank')}
      >
        <svg viewBox="0 0 24 24" width="26" height="26" xmlns="http://www.w3.org/2000/svg">
          <path fill="#3C1E1E" d="M12 3C6.48 3 2 6.48 2 10.8c0 2.74 1.6 5.15 4.02 6.62l-.97 3.63c-.08.3.23.55.5.38L9.8 18.9c.71.1 1.44.15 2.2.15 5.52 0 10-3.48 10-7.8S17.52 3 12 3z"/>
        </svg>
      </button>
    </>
  );
}
