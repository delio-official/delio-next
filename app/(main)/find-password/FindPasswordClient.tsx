'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { sendPasswordReset } from '@/lib/auth';
import { createClient } from '@/lib/supabase';
import FindHelp from '@/components/FindHelp/FindHelp';
import '@/styles/login.css';

export default function FindPasswordClient() {
  const router = useRouter();
  const [method, setMethod] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);

  async function handleSend() {
    if (!email.trim()) { setError('가입하신 이메일을 입력해주세요.'); return; }
    setLoading(true); setError('');
    // SNS 간편로그인 계정이면 메일 발송 대신 안내
    try {
      const c = await fetch('/api/find-password/check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const cj = await c.json();
      if (cj.isSns) {
        setLoading(false);
        setError(`${cj.label} 간편로그인으로 가입한 계정입니다.\n델리오 비밀번호가 없으니 ${cj.label} 로그인을 이용해주세요.`);
        return;
      }
    } catch { /* 확인 실패 시 그대로 진행 */ }
    const { error: err } = await sendPasswordReset(email.trim());
    setLoading(false);
    if (err) { setError('메일 발송에 실패했습니다. 이메일을 확인해주세요.'); return; }
    setSent(true);
  }

  /* 휴대폰 본인인증으로 비밀번호 재설정 */
  async function startPhoneVerify() {
    if (phoneLoading) return;
    const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
    const channelKey = process.env.NEXT_PUBLIC_PORTONE_IDENTITY_CHANNEL_KEY;
    if (!storeId || !channelKey) { setPhoneError('본인인증 설정이 없습니다. 관리자에게 문의해주세요.'); return; }
    setPhoneLoading(true); setPhoneError('');
    try {
      const PortOne = await import('@portone/browser-sdk/v2');
      const id = `pwreset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const response = await PortOne.requestIdentityVerification({ storeId, channelKey, identityVerificationId: id });
      if (!response || (response as { code?: string }).code !== undefined) {
        setPhoneError((response as { message?: string })?.message || '본인인증이 취소되었습니다.');
        setPhoneLoading(false);
        return;
      }
      // 1) 서버에서 본인인증 결과 확인 + 계정 조회 + 복구 토큰 발급
      const r = await fetch('/api/find-password/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identityVerificationId: id }),
      });
      const j = await r.json();
      if (!j.ok) {
        setPhoneError(j.error || '본인인증에 실패했습니다.');
        setPhoneLoading(false);
        return;
      }
      // 2) 복구 토큰으로 복구 세션 생성
      const { error: otpErr } = await createClient().auth.verifyOtp({ type: 'recovery', token_hash: j.tokenHash });
      if (otpErr) {
        setPhoneError('재설정 세션 생성에 실패했습니다. 잠시 후 다시 시도해주세요.');
        setPhoneLoading(false);
        return;
      }
      // 3) 비밀번호 재설정 화면으로 이동 (복구 세션 보유 → 새 비번 설정)
      router.push('/reset-password');
    } catch {
      setPhoneError('본인인증 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      setPhoneLoading(false);
    }
  }

  return (
    <div className="login-wrap" style={{ justifyContent:'flex-start', paddingTop:'10vh' }}>
      <div className="login-box">
        <h1 className="login-title">비밀번호 찾기</h1>

        {/* 방식 선택 탭 (밑줄형) */}
        <div style={{ display:'flex', borderBottom:'1px solid #E5E5E5', marginBottom:20 }}>
          {([['email','이메일로 찾기'],['phone','휴대폰 본인인증']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setMethod(k)}
              style={{ flex:1, padding:'14px 0', border:'none', background:'none', cursor:'pointer',
                fontFamily:'inherit', fontSize:14, fontWeight:700, marginBottom:'-1px',
                color: method===k ? '#1A1A1A' : '#bbb',
                borderBottom: method===k ? '2px solid #1A1A1A' : '2px solid transparent' }}>
              {label}
            </button>
          ))}
        </div>

        {method === 'email' ? (
          sent ? (
            <div style={{ textAlign:'center', padding:'12px 0 4px' }}>
              <div style={{ width:48, height:48, borderRadius:'50%', background:'#22C55E', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <p style={{ fontSize:14, color:'#444', lineHeight:1.7, marginBottom:24 }}>
                <strong>{email}</strong>으로<br />
                비밀번호 재설정 링크를 보냈습니다.<br />
                메일함을 확인해주세요.
              </p>
              <Link href="/login" className="login-btn" style={{ background:'#1A1A1A', color:'#fff' }}>
                로그인으로 돌아가기
              </Link>
            </div>
          ) : (
            <>
              <p style={{ fontSize:13, color:'#888', lineHeight:1.6, marginBottom:14 }}>
                가입하신 이메일로 비밀번호 재설정 링크를 보내드립니다.
              </p>
              <input type="email" className="login-input" placeholder="가입 이메일을 입력해주세요"
                value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()} autoComplete="email" />
              {error && <p style={{ color:'var(--color-error)', fontSize:13, marginBottom:8, marginTop:-2, whiteSpace:'pre-line' }}>{error}</p>}
              <FindHelp title="비밀번호 찾기" />
              <button className="login-btn" onClick={handleSend} disabled={loading || !email.trim()}
                style={{ marginTop:16, background: email.trim() && !loading ? '#1A1A1A' : '#D5D7DA', color:'#fff' }}>
                {loading ? '발송 중...' : '재설정 링크 받기'}
              </button>
            </>
          )
        ) : (
          /* 휴대폰 본인인증으로 재설정 */
          <>
            <p style={{ fontSize:13, color:'#888', lineHeight:1.6, marginBottom:14 }}>
              가입 시 등록한 휴대폰으로 본인인증을 진행하면 바로 새 비밀번호를 설정할 수 있습니다.<br />
              가입 시 본인인증을 하지 않은 계정은 이메일로 찾기를 이용해주세요.
            </p>
            {phoneError && <p style={{ color:'var(--color-error)', fontSize:13, marginBottom:8, whiteSpace:'pre-line' }}>{phoneError}</p>}
            <FindHelp title="비밀번호 찾기" />
            <button className="login-btn" onClick={startPhoneVerify} disabled={phoneLoading}
              style={{ marginTop:16, background: phoneLoading ? '#D5D7DA' : '#1A1A1A', color:'#fff' }}>
              {phoneLoading ? '인증 진행 중...' : '휴대폰 본인인증으로 재설정'}
            </button>
          </>
        )}

        <div className="login-find-row" style={{ marginTop:16 }}>
          <Link href="/login">로그인</Link>
          <span className="login-find-sep">|</span>
          <Link href="/signup">회원가입</Link>
        </div>
      </div>
    </div>
  );
}
