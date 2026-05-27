'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  activeTab?: string;
}

export default function BottomNav({ activeTab }: Props) {
  const pathname = usePathname();
  const { loggedIn } = useAuth();

  function isActive(path: string) {
    if (activeTab) return activeTab === path;
    return pathname === path || pathname.startsWith(path + '/');
  }

  return (
    <>
      <nav className="bottom-nav">
        <div className="bottom-nav-inner">
          <Link href="/category" className={`bottom-nav-item${isActive('/category') ? ' active' : ''}`}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
            <span>카테고리</span>
          </Link>
          <Link href="/mypage" className={`bottom-nav-item${isActive('/mypage') ? ' active' : ''}`}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="1" y="3" width="15" height="13" rx="1"/>
              <path d="M16 8h4l3 5v4h-7V8z"/>
              <circle cx="5.5" cy="18.5" r="2.5"/>
              <circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
            <span>배송조회</span>
          </Link>
          <Link href="/" className={`bottom-nav-item nav-home${pathname === '/' ? ' active' : ''}`}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12L12 3l9 9"/><path d="M9 21V12h6v9"/>
            </svg>
            <span>홈</span>
          </Link>
          <Link href="/mypage?panel=wish" className={`bottom-nav-item${isActive('/mypage?panel=wish') ? ' active' : ''}`}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
            <span>찜</span>
          </Link>
          <Link href={loggedIn ? '/mypage' : '/login'} className={`bottom-nav-item${isActive('/login') ? ' active' : ''}`}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
            <span>{loggedIn ? '마이' : '로그인'}</span>
          </Link>
        </div>
      </nav>

      {/* 카카오 플로팅 */}
      <button className="kakao-float" title="카카오 채널 상담" onClick={() => alert('카카오 채널로 이동합니다 💬')}>
        <svg viewBox="0 0 24 24" width="26" height="26" xmlns="http://www.w3.org/2000/svg">
          <path fill="#3C1E1E" d="M12 3C6.48 3 2 6.48 2 10.8c0 2.74 1.6 5.15 4.02 6.62l-.97 3.63c-.08.3.23.55.5.38L9.8 18.9c.71.1 1.44.15 2.2.15 5.52 0 10-3.48 10-7.8S17.52 3 12 3z"/>
        </svg>
      </button>
    </>
  );
}
