'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from '@/lib/auth';
import '@/styles/login.css';

export default function LoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function doLogin() {
    if (!email.trim() || !pw) return;
    setLoading(true);
    setError('');
    const { error: err } = await signIn(email.trim(), pw);
    setLoading(false);
    if (err) {
      setError('이메일 또는 비밀번호를 확인해주세요.');
    } else {
      router.push('/');
      router.refresh();
    }
  }

  function handleSns(name: string) {
    alert(`${name} 로그인은 준비 중입니다.`);
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

        {error && (
          <p style={{ color: 'var(--color-error)', fontSize: 13, marginBottom: 8, marginTop: -2 }}>
            {error}
          </p>
        )}

        <div className="login-find-row">
          <a href="#" onClick={e => { e.preventDefault(); alert('아이디 찾기는 준비 중입니다.'); }}>아이디 찾기</a>
          <span className="login-find-sep">|</span>
          <a href="#" onClick={e => { e.preventDefault(); alert('비밀번호 찾기는 준비 중입니다.'); }}>비밀번호 찾기</a>
        </div>

        <button
          className="login-btn login-btn-solid"
          onClick={doLogin}
          disabled={loading}
        >
          {loading ? '로그인 중...' : '로그인'}
        </button>

        <Link href="/signup" className="login-btn login-btn-outline">
          회원가입
        </Link>

        <div className="login-divider"><span>간편 로그인</span></div>

        <button className="sns-full sns-naver-btn" onClick={() => handleSns('네이버')}>
          <span className="sns-icon-n">N</span>
          네이버로 계속하기
        </button>
        <button className="sns-full sns-kakao-btn" onClick={() => handleSns('카카오')}>
          <span className="sns-kakao-icon">💬</span>
          카카오로 계속하기
        </button>
      </div>
    </div>
  );
}
