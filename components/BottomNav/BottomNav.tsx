'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Menu, Truck, Home, Heart, User } from 'lucide-react';

const CAT_DATA = [
  {
    icon: '🍎', bg: '#FFE8E8', name: '국산과일',
    subs: [{ label: '전체보기', href: '/category?origin=domestic' }],
  },
  {
    icon: '🌍', bg: '#E8F5E9', name: '수입과일',
    subs: [{ label: '전체보기', href: '/category?origin=import' }],
  },
  {
    icon: '🏪', bg: '#E8EAF6', name: '브랜드 소개관',
    subs: [
      { label: '브랜드 소개', href: '/brand' },
      { label: '파트너농가', href: '/brand' },
    ],
  },
  {
    icon: '💬', bg: '#FFF3E0', name: '서비스',
    subs: [
      { label: '배송안내', href: '/faq' },
      { label: '입점/협업문의', href: '/inquiry' },
      { label: '고객센터', href: '/faq' },
    ],
  },
];

const SHORTCUTS = [
  { icon: '✨', bg: '#F5F0FF', label: '신상품',     href: '/category?new=true' },
  { icon: '🏪', bg: '#E8EAF6', label: '브랜드소개관', href: '/brand' },
  { icon: '🎉', bg: '#FFF0F5', label: '이벤트',     href: '/event' },
  { icon: '📖', bg: '#EEF4FF', label: '라운지',     href: '/lounge' },
  { icon: '🔍', bg: '#F0FFF4', label: '취향진단',   href: '/survey' },
  { icon: '⭐', bg: '#FFF9EE', label: '당도순',     href: '/category?sort=brix' },
  { icon: '🔥', bg: '#FFF3EE', label: '베스트',     href: '/category?sort=best' },
  { icon: '💰', bg: '#FFFAEE', label: '할인특가',   href: '/category?sort=price_asc' },
  { icon: '🚚', bg: '#EEF4FF', label: '새벽배송',   href: '/category?delivery=dawn' },
  { icon: '🎁', bg: '#FFEEF0', label: '선물세트',   href: '/category?cat=gift' },
  { icon: '🍇', bg: '#F3EEFF', label: '포도',       href: '/category?cat=grape' },
  { icon: '🥝', bg: '#EDFFF0', label: '키위',       href: '/category?cat=kiwi' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { loggedIn } = useAuth();

  const [catOpen, setCatOpen] = useState(false);
  const [openAcc, setOpenAcc] = useState<number | null>(null);

  function openCat() {
    setCatOpen(true);
    document.body.style.overflow = 'hidden';
  }
  function closeCat() {
    setCatOpen(false);
    document.body.style.overflow = '';
    setOpenAcc(null);
  }
  function toggleAcc(i: number) {
    setOpenAcc(prev => prev === i ? null : i);
  }
  function goAndClose(href: string) {
    closeCat();
    router.push(href);
  }

  function isActive(path: string) {
    return pathname === path || pathname.startsWith(path + '/');
  }

  /* 경로 변경 시 카테고리 드로어 자동 닫기 (다른 탭 눌러도 페이지가 가려지던 버그 수정) */
  useEffect(() => {
    setCatOpen(false);
    setOpenAcc(null);
    document.body.style.overflow = '';
  }, [pathname]);

  return (
    <>
      {/* ===== 카테고리 드로어 ===== */}
      <div className={`cat-drawer${catOpen ? ' open' : ''}`} onClick={closeCat}>
        <div className="cat-drawer-panel" onClick={e => e.stopPropagation()}>
          <div className="cat-drawer-header">
            <span className="cat-drawer-title">카테고리</span>
            <button className="cat-drawer-close" onClick={closeCat}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div className="cat-drawer-body">
            {/* 프로모 배너 */}
            <div className="cd-promo" onClick={() => goAndClose('/category?sort=brix')}>
              <div className="cd-promo-text">
                <span className="cd-promo-tag">TODAY&apos;S BRIX</span>
                <div className="cd-promo-title">오늘의 당도 TOP 6 공개!</div>
                <div className="cd-promo-sub">매일 오전 6시 기준 직접 측정</div>
              </div>
              <div className="cd-promo-icon">🍬</div>
            </div>

            {/* 바로가기 그리드 */}
            <div className="cd-sc-grid">
              {SHORTCUTS.map(sc => (
                <div key={sc.label} className="cd-sc-item" onClick={() => goAndClose(sc.href)}>
                  <div className="cd-sc-icon" style={{ background: sc.bg }}>{sc.icon}</div>
                  <span className="cd-sc-label">{sc.label}</span>
                </div>
              ))}
            </div>

            {/* 카테고리 아코디언 */}
            <div className="cd-acc-wrap">
              {CAT_DATA.map((cat, i) => (
                <div key={cat.name} className={`cat-drawer-acc-item${openAcc === i ? ' open' : ''}`}>
                  <div className="cat-drawer-acc-header" onClick={() => toggleAcc(i)}>
                    <div className="cat-drawer-thumb" style={{ background: cat.bg }}>{cat.icon}</div>
                    <span className="cat-drawer-name">{cat.name}</span>
                    <svg className="cat-drawer-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </div>
                  <div className="cat-drawer-sub-grid" style={{ height: openAcc === i ? 'auto' : 0 }}>
                    {cat.subs.map((sub, j) => (
                      <div
                        key={sub.label}
                        className={`cat-drawer-sub2${j === 0 ? ' full-view' : ''}`}
                        onClick={() => goAndClose(sub.href)}
                      >
                        {sub.label}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ===== 하단 네비게이션 ===== */}
      <nav className="bottom-nav">
        <div className="bottom-nav-inner">
          {/* 카테고리 */}
          <button className={`bottom-nav-item${catOpen ? ' active' : ''}`} onClick={openCat}>
            <Menu size={21} strokeWidth={1.8} />
            <span>카테고리</span>
          </button>

          {/* 배송조회 */}
          <Link href="/mypage?panel=order" className={`bottom-nav-item${isActive('/mypage') && pathname.includes('order') ? ' active' : ''}`}>
            <Truck size={21} strokeWidth={1.8} />
            <span>배송조회</span>
          </Link>

          {/* 홈 */}
          <Link href="/" className={`bottom-nav-item nav-home${pathname === '/' ? ' active' : ''}`}>
            <Home size={21} strokeWidth={1.8} />
            <span>홈</span>
          </Link>

          {/* 찜 */}
          <Link href="/mypage?panel=wish" className="bottom-nav-item">
            <Heart size={21} strokeWidth={1.8} />
            <span>찜</span>
          </Link>

          {/* 마이/로그인 */}
          <Link href={loggedIn ? '/mypage' : '/login'} className={`bottom-nav-item${isActive('/mypage') || isActive('/login') ? ' active' : ''}`}>
            <User size={21} strokeWidth={1.8} />
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
