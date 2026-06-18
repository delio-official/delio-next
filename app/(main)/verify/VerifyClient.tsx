'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase';

export default function VerifyClient() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/';
  const { user, loggedIn, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'checking' | 'verified' | 'unverified'>('checking');

  // 현재 계정 인증 여부 확인
  useEffect(() => {
    if (authLoading) return;
    if (!user) { setStatus('unverified'); return; }
    let cancelled = false;
    createClient().from('profiles').select('ci').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setStatus(data?.ci ? 'verified' : 'unverified');
      });
    return () => { cancelled = true; };
  }, [user, authLoading]);

  async function startVerify() {
    if (loading) return;
    const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
    const channelKey = process.env.NEXT_PUBLIC_PORTONE_IDENTITY_CHANNEL_KEY;
    if (!storeId || !channelKey) { alert('본인인증 설정이 없습니다. 관리자에게 문의해주세요.'); return; }
    setLoading(true);
    try {
      const PortOne = await import('@portone/browser-sdk/v2');
      const id = `verify-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const response = await PortOne.requestIdentityVerification({ storeId, channelKey, identityVerificationId: id });
      if (!response || (response as { code?: string }).code !== undefined) {
        alert((response as { message?: string })?.message || '본인인증이 취소되었습니다.');
        setLoading(false);
        return;
      }
      const r = await fetch('/api/verify/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identityVerificationId: id }),
      });
      const j = await r.json();
      if (j.ok) {
        alert('본인인증이 완료되었습니다.');
        setStatus('verified');
        router.replace(next);
      } else if (j.code === 'DUP' || j.code === 'REJOIN') {
        // 중복가입/재가입 차단 → 이 계정은 사용 불가 → 로그아웃 후 로그인 화면으로
        alert(j.error || '이미 가입된 본인인증 정보입니다.');
        await createClient().auth.signOut();
        router.replace('/login');
      } else {
        alert(j.error || '본인인증에 실패했습니다.');
      }
    } catch {
      alert('본인인증 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ background: '#fff', minHeight: '70vh' }}>
      <div className="container" style={{ maxWidth: 460, padding: '64px 20px', textAlign: 'center' }}>

        {/* 미로그인 */}
        {!authLoading && !loggedIn && (
          <>
            <div style={{ fontSize: 44, marginBottom: 18 }}>🔒</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A1A', marginBottom: 10 }}>휴대폰 본인인증</h1>
            <p style={{ fontSize: 14, color: '#888', lineHeight: 1.7, marginBottom: 32 }}>
              본인인증을 진행하려면 먼저 로그인이 필요합니다.
            </p>
            <Link href={`/login?next=${encodeURIComponent(`/verify?next=${next}`)}`}
              style={{ display: 'block', width: '100%', padding: '16px 0', borderRadius: 10,
                background: '#1A1A1A', color: '#fff', fontSize: 16, fontWeight: 700, textDecoration: 'none' }}>
              로그인 후 진행하기
            </Link>
          </>
        )}

        {/* 인증 여부 확인 중 */}
        {loggedIn && status === 'checking' && (
          <div style={{ padding: '80px 0', color: '#bbb', fontSize: 14 }}>확인 중...</div>
        )}

        {/* 이미 인증 완료 */}
        {loggedIn && status === 'verified' && (
          <>
            <div style={{ fontSize: 44, marginBottom: 18 }}>✅</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A1A', marginBottom: 10 }}>본인인증 완료</h1>
            <p style={{ fontSize: 14, color: '#888', lineHeight: 1.7, marginBottom: 32 }}>
              이미 휴대폰 본인인증이 완료된 계정입니다.<br />
              델리오의 모든 서비스를 이용하실 수 있어요.
            </p>
            <Link href="/" style={{ display: 'block', width: '100%', padding: '16px 0', borderRadius: 10,
              background: '#1A1A1A', color: '#fff', fontSize: 16, fontWeight: 700, textDecoration: 'none', marginBottom: 12 }}>
              홈으로 가기
            </Link>
            <button onClick={startVerify} disabled={loading}
              style={{ width: '100%', padding: '14px 0', borderRadius: 10, border: '1.5px solid #DDD',
                background: '#fff', color: loading ? '#bbb' : '#555', fontSize: 14, fontWeight: 600, cursor: loading ? 'default' : 'pointer' }}>
              {loading ? '인증 진행 중...' : '재인증하기'}
            </button>
            <p style={{ fontSize: 12, color: '#bbb', marginTop: 14, lineHeight: 1.6 }}>
              번호 변경 등으로 정보를 갱신하려면 재인증하세요.
            </p>
          </>
        )}

        {/* 미인증 */}
        {loggedIn && status === 'unverified' && (
          <>
            <div style={{ fontSize: 44, marginBottom: 18 }}>🔒</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A1A', marginBottom: 10 }}>휴대폰 본인인증</h1>
            <p style={{ fontSize: 14, color: '#888', lineHeight: 1.7, marginBottom: 32 }}>
              안전한 서비스 이용을 위해 휴대폰 본인인증이 필요합니다.<br />
              1인 1계정 확인 및 정확한 정보 확보를 위한 절차입니다.
            </p>
            <button onClick={startVerify} disabled={loading}
              style={{ width: '100%', padding: '16px 0', borderRadius: 10, border: 'none',
                background: loading ? '#C8C8C8' : '#1A1A1A', color: '#fff', fontSize: 16, fontWeight: 700,
                cursor: loading ? 'default' : 'pointer' }}>
              {loading ? '인증 진행 중...' : '휴대폰 본인인증 하기'}
            </button>
            <p style={{ fontSize: 12, color: '#bbb', marginTop: 20, lineHeight: 1.6 }}>
              본인인증 정보(이름·생년월일·성별·연계정보)는 본인확인 목적으로만 사용되며,<br />
              안전하게 보관됩니다.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
