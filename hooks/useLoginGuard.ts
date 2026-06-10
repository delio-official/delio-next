'use client';

import { useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

let toastTimer: ReturnType<typeof setTimeout> | undefined;
function loginToast() {
  if (typeof document === 'undefined') return;
  let el = document.getElementById('login-guard-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'login-guard-toast';
    el.style.cssText = 'position:fixed;left:50%;bottom:84px;transform:translateX(-50%);background:rgba(0,0,0,.85);color:#fff;padding:12px 22px;border-radius:24px;font-size:14px;font-weight:600;z-index:99999;box-shadow:0 6px 24px rgba(0,0,0,.25);pointer-events:none;transition:opacity .2s;';
    document.body.appendChild(el);
  }
  el.textContent = '로그인이 필요한 기능이에요';
  el.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { if (el) el.style.opacity = '0'; }, 1400);
}

/**
 * 회원 전용 동작(담기·찜·구매·쿠폰 등) 가드.
 * requireLogin() 호출 → 비회원이면 토스트 띄우고 로그인 페이지(next=현재경로)로 이동 후 false 반환.
 */
export function useLoginGuard() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  return useCallback((): boolean => {
    if (user) return true;
    loginToast();
    const next = encodeURIComponent(pathname || '/');
    setTimeout(() => router.push(`/login?next=${next}`), 600);
    return false;
  }, [user, router, pathname]);
}
