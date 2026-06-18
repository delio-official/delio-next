'use client';

import { useState } from 'react';
import Link from 'next/link';
import { sendPasswordReset } from '@/lib/auth';
import '@/styles/login.css';

export default function FindPasswordClient() {
  const [method, setMethod] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSend() {
    if (!email.trim()) { setError('가입하신 이메일을 입력해주세요.'); return; }
    setLoading(true); setError('');
    const { error: err } = await sendPasswordReset(email.trim());
    setLoading(false);
    if (err) { setError('메일 발송에 실패했습니다. 이메일을 확인해주세요.'); return; }
    setSent(true);
  }

  return (
    <div className="login-wrap" style={{ justifyContent:'flex-start', paddingTop:'10vh' }}>
      <div className="login-box">
        <h1 className="login-title">비밀번호 찾기</h1>

        {/* 방식 선택 탭 */}
        <div style={{ display:'flex', border:'1px solid #E5E5E5', borderRadius:10, overflow:'hidden', marginBottom:20 }}>
          {([['email','이메일로 찾기'],['phone','휴대폰 본인인증']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setMethod(k)}
              style={{ flex:1, padding:'12px 0', border:'none', cursor:'pointer', fontFamily:'inherit',
                fontSize:13, fontWeight:700,
                background: method===k ? '#1A1A1A' : '#fff',
                color: method===k ? '#fff' : '#999' }}>
              {label}
            </button>
          ))}
        </div>

        {method === 'email' ? (
          sent ? (
            <div style={{ textAlign:'center', padding:'12px 0 4px' }}>
              <div style={{ width:64, height:64, borderRadius:'50%', background:'#22C55E', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <p style={{ fontSize:14, color:'#444', lineHeight:1.7, marginBottom:24 }}>
                <strong>{email}</strong>으로<br />
                비밀번호 재설정 링크를 보냈습니다.<br />
                메일함을 확인해주세요.
              </p>
              <Link href="/login" className="login-btn login-btn-solid" style={{ textDecoration:'none', display:'block', textAlign:'center' }}>
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
              {error && <p style={{ color:'var(--color-error)', fontSize:13, marginBottom:8, marginTop:-2 }}>{error}</p>}
              <button className="login-btn login-btn-solid" onClick={handleSend} disabled={loading}>
                {loading ? '발송 중...' : '재설정 링크 받기'}
              </button>
            </>
          )
        ) : (
          /* 휴대폰 본인인증 — 준비중 */
          <div style={{ textAlign:'center', padding:'24px 0 8px' }}>
            <p style={{ fontSize:14, color:'#888', lineHeight:1.8 }}>
              휴대폰 본인인증을 통한 비밀번호 찾기는<br />
              <strong style={{ color:'#1A1A1A' }}>준비 중</strong>입니다.<br />
              현재는 이메일로 찾기를 이용해주세요.
            </p>
          </div>
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
