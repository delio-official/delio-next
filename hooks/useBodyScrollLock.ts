import { useEffect } from 'react';

/* 잠금해제 시 스크롤 복원을 1회 건너뛰기 위한 플래그.
   드로어에서 다른 페이지로 이동할 때(예: 바로구매→장바구니) 이전 스크롤 복원이
   새 페이지의 최상단 이동을 덮어쓰는 문제를 막는다. */
let skipRestoreOnce = false;
export function skipNextScrollRestore() { skipRestoreOnce = true; }

/**
 * active 가 true인 동안 body 스크롤을 잠근다 (모달·드로어 뒷 배경 스크롤 방지).
 * iOS 사파리 대응을 위해 position:fixed 방식 사용 + 닫힐 때 스크롤 위치 복원.
 */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const scrollY = window.scrollY;
    const body = document.body;
    const prev = {
      position: body.style.position, top: body.style.top,
      left: body.style.left, right: body.style.right,
      width: body.style.width, overflow: body.style.overflow,
    };
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      /* 이동 중이면 복원 생략 → position:fixed 해제로 화면이 최상단(0)에 남음 */
      if (skipRestoreOnce) { skipRestoreOnce = false; }
      else { window.scrollTo(0, scrollY); }
    };
  }, [active]);
}
