'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { updatePassword } from '@/lib/auth';
import '@/styles/login.css';

export default function ResetPasswordClient() {
  const router = useRouter();
  const [ready, setReady] = useState(false);   // 재설정 세션 확인됨
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  /* 재설정 링크 진입 → Supabase가 복구 세션 설정 */
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleReset() {
    if (pw.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return; }
    if (pw !== pw2) { setError('비밀번호가 일치하지 않습니다.'); return; }
    setLoading(true); setError('');
    const { error: err } = await updatePassword(pw);
    setLoading(false);
    if (err) { setError('변경에 실패했습니다. 링크가 만료되었을 수 있어요.'); return; }
    setDone(true);
  }

  return (
    <div className="login-wrap">
      <div className="login-box">
        <h1 className="login-title">비밀번호 재설정</h1>

        {done ? (
          <div style={{ textAlign:'center', padding:'12px 0 4px' }}>
            <div style={{ width:64, height:64, borderRadius:'50%', background:'#22C55E', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p style={{ fontSize:14, color:'#444', lineHeight:1.7, marginBottom:24 }}>
              비밀번호가 변경되었습니다.<br />새 비밀번호로 로그인해주세요.
            </p>
            <button className="login-btn login-btn-solid" onClick={() => { router.push('/login'); router.refresh(); }}>
              로그인하러 가기
            </button>
          </div>
        ) : !ready ? (
          <p style={{ fontSize:14, color:'#888', textAlign:'center', padding:'24px 0', lineHeight:1.7 }}>
            재설정 링크를 확인하는 중입니다...<br />
            <span style={{ fontSize:12, color:'#bbb' }}>메일의 링크로 접속하지 않으셨다면 다시 시도해주세요.</span>
          </p>
        ) : (
          <>
            <p style={{ fontSize:13, color:'#888', lineHeight:1.6, marginBottom:14 }}>
              새로 사용할 비밀번호를 입력해주세요.
            </p>
            <input type="password" className="login-input" placeholder="새 비밀번호 (6자 이상)"
              value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" />
            <input type="password" className="login-input" placeholder="새 비밀번호 확인"
              value={pw2} onChange={e => setPw2(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleReset()} autoComplete="new-password" />
            {error && <p style={{ color:'var(--color-error)', fontSize:13, marginBottom:8, marginTop:-2 }}>{error}</p>}
            <button className="login-btn login-btn-solid" onClick={handleReset} disabled={loading}>
              {loading ? '변경 중...' : '비밀번호 변경'}
            </button>
          </>
        )}

        <div className="login-find-row" style={{ marginTop:16 }}>
          <Link href="/login">로그인으로 돌아가기</Link>
        </div>
      </div>
    </div>
  );
}
