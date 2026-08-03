'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase';

/* 추적(GA4·Meta·Clarity) 제외 판단 공통 훅.
   - /admin 경로: 제외
   - 관리자 계정으로 로그인한 사용자: 사이트 전체에서 제외
   관리자 판별은 서버 RPC(is_current_user_admin) 1회 조회 후 모듈 캐시 재사용. */
let adminCache: boolean | null = null;
let adminPromise: Promise<boolean> | null = null;

function checkAdmin(): Promise<boolean> {
  if (adminCache !== null) return Promise.resolve(adminCache);
  if (!adminPromise) {
    adminPromise = (async () => {
      try {
        const sb = createClient();
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return false;
        const { data } = await sb.rpc('is_current_user_admin');
        return data === true;
      } catch { return false; }
    })().then(v => { adminCache = v; return v; });
  }
  return adminPromise;
}

export function useTrackingBlocked(): boolean {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(adminCache === true);
  useEffect(() => {
    let on = true;
    checkAdmin().then(v => { if (on) setIsAdmin(v); });
    return () => { on = false; };
  }, []);
  return (pathname?.startsWith('/admin') ?? false) || isAdmin;
}
