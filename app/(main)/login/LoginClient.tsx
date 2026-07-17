'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, signInWithKakao, signInWithNaver } from '@/lib/auth';
import '@/styles/login.css';

/* 차단 회원 안내 — 이메일 로그인과 소셜 콜백 양쪽에서 동일 문구 사용 */
const BLOCKED_MSG = '이용이 제한된 계정입니다.\n자세한 내용은 고객센터(02-6925-2311)로 문의해주세요.';

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get('next') || '/';
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);   // 아이디 저장
  const [keepLogin, setKeepLogin] = useState(true);   // 로그인 유지

  /* 저장된 아이디 불러오기 */
  useEffect(() => {
    const saved = localStorage.getItem('delio_saved_email');
    if (saved) { setEmail(saved); setRemember(true); }
  }, []);

  /* 소셜 로그인 콜백에서 되돌아온 오류 (차단 회원 등) */
  useEffect(() => {
    const e = searchParams.get('error');
    if (e === 'blocked') setError(BLOCKED_MSG);
    else if (e === 'oauth') setError('소셜 로그인에 실패했습니다. 다시 시도해주세요.');
  }, [searchParams]);

  async function doLogin() {
    if (!email.trim() || !pw) return;
    setLoading(true);
    setError('');
    const { error: err } = await signIn(email.trim(), pw);
    setLoading(false);
    if (err) {
      setError(err.message === 'BLOCKED' ? BLOCKED_MSG : '이메일 또는 비밀번호를 확인해주세요.');
      return;
    }
    /* 아이디 저장 */
    if (remember) localStorage.setItem('delio_saved_email', email.trim());
    else localStorage.removeItem('delio_saved_email');
    /* 로그인 유지: 해제 시 브라우저 종료하면 자동 로그아웃 (세션 단위) */
    if (keepLogin) localStorage.removeItem('delio_session_only');
    else localStorage.setItem('delio_session_only', '1');
    sessionStorage.setItem('delio_session_active', '1');

    router.push(nextUrl);
    router.refresh();
  }

  return (
    <div className="login-wrap">
      <div className="login-box">
        <h1 className="login-title">로그인</h1>

        <input
          type="text"
          className="login-input"
          placeholder="이메일을 입력해주세요"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && document.getElementById('loginPw')?.focus()}
          autoComplete="email"
        />
        <input
          id="loginPw"
          type="password"
          className="login-input login-input-pw"
          placeholder="비밀번호를 입력해주세요"
          value={pw}
          onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doLogin()}
          autoComplete="current-password"
        />

        {/* 아이디 저장 / 로그인 유지 */}
        <div style={{ display:'flex', gap:18, margin:'2px 2px 10px', fontSize:14, color:'#555' }}>
          <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
            <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
              style={{ width:15, height:15, accentColor:'#1A1A1A', cursor:'pointer' }} />
            아이디 저장
          </label>
          <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
            <input type="checkbox" checked={keepLogin} onChange={e => setKeepLogin(e.target.checked)}
              style={{ width:15, height:15, accentColor:'#1A1A1A', cursor:'pointer' }} />
            로그인 유지
          </label>
        </div>

        {error && (
          <p style={{ color: 'var(--color-error)', fontSize: 13, marginBottom: 8, marginTop: -2, whiteSpace: 'pre-line' }}>
            {error}
          </p>
        )}

        <div className="login-find-row">
          <Link href="/find-id">아이디 찾기</Link>
          <span className="login-find-sep">|</span>
          <Link href="/find-password">비밀번호 찾기</Link>
        </div>

        <button
          className="login-btn login-btn-solid"
          onClick={doLogin}
          disabled={loading}
        >
          {loading ? '로그인 중...' : '로그인'}
        </button>

        <Link href={`/signup${nextUrl && nextUrl !== '/' ? `?next=${encodeURIComponent(nextUrl)}` : ''}`} className="login-btn login-btn-outline">
          회원가입
        </Link>

        <div className="login-divider"><span>간편 로그인</span></div>

        <div className="sns-icon-row">
          {/* 네이버 */}
          <button className="sns-circle sns-naver-btn" onClick={() => signInWithNaver(nextUrl)} title="네이버로 로그인">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none">
              <path d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z" fill="#ffffff"/>
            </svg>
          </button>
          {/* 카카오 */}
          <button className="sns-circle sns-kakao-btn" onClick={() => signInWithKakao(nextUrl)} title="카카오로 로그인">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
              <path d="M12 4C6.48 4 2 7.58 2 12c0 2.96 1.78 5.56 4.5 7.06l-.77 3.44 3.9-2.44c.75.14 1.53.22 2.37.22 5.52 0 10-3.58 10-8S17.52 4 12 4z" fill="#3C1E1E"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
