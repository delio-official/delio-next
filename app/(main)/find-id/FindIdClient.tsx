'use client';

import { useState } from 'react';
import Link from 'next/link';
import FindHelp from '@/components/FindHelp/FindHelp';
import '@/styles/login.css';

export default function FindIdClient() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<{ email: string; snsLabel: string | null }[] | null>(null);

  async function handleFind() {
    if (!name.trim() || !phone.trim()) { setError('이름과 휴대폰 번호를 입력해주세요.'); return; }
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/find-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });
      const j = await r.json();
      if (j.ok) {
        setResults(j.results as { email: string; snsLabel: string | null }[]);
      } else {
        setError(j.error || '일치하는 가입 정보가 없습니다.');
      }
    } catch {
      setError('조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap" style={{ justifyContent:'flex-start', paddingTop:'10vh' }}>
      <div className="login-box">
        <h1 className="login-title">아이디 찾기</h1>

        {results ? (
          /* 결과 화면 */
          <div style={{ textAlign:'center', padding:'8px 0 4px' }}>
            <div style={{ width:48, height:48, borderRadius:'50%', background:'#22C55E', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p style={{ fontSize:14, color:'#888', marginBottom:14 }}>입력하신 정보로 가입된 아이디입니다.</p>
            <div style={{ background:'#F6F7F6', borderRadius:10, padding:'16px', marginBottom:24 }}>
              {results.map(r => (
                <div key={r.email} style={{ padding:'4px 0' }}>
                  <span style={{ fontSize:16, fontWeight:700, color:'#1A1A1A' }}>{r.email}</span>
                  {r.snsLabel && (
                    <span style={{ display:'block', fontSize:12, color:'#E5793A', fontWeight:600, marginTop:2 }}>
                      {r.snsLabel} 간편로그인 계정 (비밀번호 없음 · {r.snsLabel} 로그인 이용)
                    </span>
                  )}
                </div>
              ))}
            </div>
            <Link href="/login" className="login-btn login-btn-solid">
              로그인하기
            </Link>
            <Link href="/find-password" className="login-btn" style={{ border:'1px solid #E5E5E5', background:'#fff', color:'#555' }}>
              비밀번호 찾기
            </Link>
          </div>
        ) : (
          <>
            <p style={{ fontSize:13, color:'#888', lineHeight:1.6, marginBottom:14 }}>
              가입 시 등록한 이름과 휴대폰 번호를 입력하시면<br />
              가입하신 아이디(이메일)를 알려드립니다.
            </p>
            <input type="text" className="login-input" placeholder="이름"
              value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleFind()} autoComplete="name" />
            <input type="tel" className="login-input" placeholder="휴대폰 번호 (- 없이 숫자만)"
              value={phone} onChange={e => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
              onKeyDown={e => e.key === 'Enter' && handleFind()} autoComplete="tel" inputMode="numeric" maxLength={11} />
            {error && <p style={{ color:'var(--color-error)', fontSize:13, marginBottom:8, marginTop:-2 }}>{error}</p>}
            <FindHelp title="아이디 찾기" />
            <button className="login-btn login-btn-solid" style={{ marginTop:16 }} onClick={handleFind} disabled={loading}>
              {loading ? '조회 중...' : '아이디 찾기'}
            </button>
          </>
        )}

        <div className="login-find-row" style={{ marginTop:16 }}>
          <Link href="/login">로그인</Link>
          <span className="login-find-sep">|</span>
          <Link href="/find-password">비밀번호 찾기</Link>
          <span className="login-find-sep">|</span>
          <Link href="/signup">회원가입</Link>
        </div>
      </div>
    </div>
  );
}
