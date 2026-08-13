'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase';

/* 본인인증 게이트 — 로그인했지만 미인증(profiles.ci 없음) 회원을 /verify 로 강제 라우팅.
   NEXT_PUBLIC_IDENTITY_GATE === '1' 일 때만 동작 (운영 중 즉시 끄고 켜기 위한 스위치). */
const ALLOW = ['/verify', '/login', '/signup', '/auth', '/find-password', '/reset-password'];

export default function IdentityGate() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [verifiedId, setVerifiedId] = useState<string | null>(null);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_IDENTITY_GATE !== '1') return;
    if (loading || !user) return;
    if (verifiedId === user.id) return; // 이미 인증 확인된 계정
    if (ALLOW.some(p => pathname === p || pathname.startsWith(p + '/'))) return;

    let cancelled = false;
    createClient().from('profiles').select('ci, provider').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        /* 소셜 로그인(카카오/네이버)은 번호인증 면제 — 로그인 후 바로 이용,
           번호는 첫 주문(결제창)에서 확보한다. 이메일 가입은 기존대로 인증 필요. */
        const social = data?.provider === 'kakao' || data?.provider === 'naver';
        if (data?.ci || social) {
          setVerifiedId(user.id); // 인증 완료 or 소셜 → 이후 재조회 안 함
        } else {
          router.replace(`/verify?next=${encodeURIComponent(pathname)}`);
        }
      });
    return () => { cancelled = true; };
  }, [user, loading, pathname, router, verifiedId]);

  return null;
}
