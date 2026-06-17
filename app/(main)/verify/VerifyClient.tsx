'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

export default function VerifyClient() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/';
  const { user, loggedIn } = useAuth();
  const [loading, setLoading] = useState(false);

  async function startVerify() {
    if (loading) return;
    const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
    const channelKey = process.env.NEXT_PUBLIC_PORTONE_IDENTITY_CHANNEL_KEY;
    if (!storeId || !channelKey) { alert('본인인증 설정이 없습니다. 관리자에게 문의해주세요.'); return; }
    setLoading(true);
    try {
      const PortOne = await import('@portone/browser-sdk/v2');
      const id = `verify-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const response = await PortOne.requestIdentityVerification({
        storeId,
        channelKey,
        identityVerificationId: id,
      });
      // code 가 있으면 실패/취소
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
        router.replace(next);
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
        <div style={{ fontSize: 44, marginBottom: 18 }}>🔒</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A1A', marginBottom: 10 }}>휴대폰 본인인증</h1>
        <p style={{ fontSize: 14, color: '#888', lineHeight: 1.7, marginBottom: 32 }}>
          안전한 서비스 이용을 위해 휴대폰 본인인증이 필요합니다.<br />
          1인 1계정 확인 및 정확한 정보 확보를 위한 절차입니다.
        </p>

        {loggedIn ? (
          <button
            onClick={startVerify}
            disabled={loading}
            style={{
              width: '100%', padding: '16px 0', borderRadius: 10, border: 'none',
              background: loading ? '#C8C8C8' : '#1A1A1A', color: '#fff',
              fontSize: 16, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
            }}>
            {loading ? '인증 진행 중...' : '휴대폰 본인인증 하기'}
          </button>
        ) : (
          <Link href={`/login?next=${encodeURIComponent(`/verify?next=${next}`)}`}
            style={{ display: 'block', width: '100%', padding: '16px 0', borderRadius: 10,
              background: '#1A1A1A', color: '#fff', fontSize: 16, fontWeight: 700, textDecoration: 'none' }}>
            로그인 후 진행하기
          </Link>
        )}

        <p style={{ fontSize: 12, color: '#bbb', marginTop: 20, lineHeight: 1.6 }}>
          본인인증 정보(이름·생년월일·성별·연계정보)는 본인확인 목적으로만 사용되며,<br />
          안전하게 보관됩니다.
        </p>
      </div>
    </main>
  );
}
