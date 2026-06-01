'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCartCount } from '@/hooks/useCartCount';
import { useAuth } from '@/hooks/useAuth';
import { signOut } from '@/lib/auth';
import { createClient } from '@/lib/supabase';

const POPULAR_FALLBACK = [
  '한라봉', '샤인머스캣', '제스프리 골드키위', '충주 사과', '블루베리',
  '제주 감귤', '거봉 포도', '국산 딸기', '망고', '키위',
];
const RECENT_KEY = 'delio_recent_searches';

function getRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}
function saveRecent(arr: string[]) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(arr));
}

export default function Header() {
  const router = useRouter();
  const cartCount = useCartCount();
  const { user } = useAuth();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const [popular, setPopular] = useState<string[]>(POPULAR_FALLBACK);

  const searchWrapRef = useRef<HTMLDivElement>(null);
  const popularLoadedRef = useRef(false);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!searchWrapRef.current?.contains(e.target as Node)) setDropOpen(false);
      if (megaOpen) setMegaOpen(false);
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [megaOpen]);

  // 인기 검색어 DB에서 로드 (최초 1회)
  useEffect(() => {
    async function loadPopular() {
      const supabase = createClient();
      const { data } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'popular_keywords')
        .single();
      if (data?.value) {
        const kws = data.value.split(',').map((s: string) => s.trim()).filter(Boolean);
        if (kws.length > 0) setPopular(kws);
      }
    }
    loadPopular();
  }, []);

  const openDrop = useCallback(() => {
    setRecent(getRecent());
    setDropOpen(true);
    // 드롭다운 열릴 때 아직 안 로드됐으면 재시도 (fallback으로 이미 채워져 있음)
    if (!popularLoadedRef.current) popularLoadedRef.current = true;
  }, []);

  function handleSearch(e: { preventDefault(): void }) {
    e.preventDefault();
    const q = query.trim();
    if (q) {
      const arr = [q, ...getRecent().filter(x => x !== q)].slice(0, 10);
      saveRecent(arr);
      router.push(`/search?q=${encodeURIComponent(q)}`);
    } else {
      router.push('/search');
    }
    setDropOpen(false);
  }

  function removeRecent(i: number) {
    const arr = getRecent();
    arr.splice(i, 1);
    saveRecent(arr);
    setRecent([...arr]);
  }

  function clearAllRecent() {
    saveRecent([]);
    setRecent([]);
  }

  async function handleLogout() {
    await signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <>
      <header className="site-header">
        {/* 유틸리티 바 */}
        <div className="header-utility">
          <div className="container">
            <div className="utility-links">
              {user ? (
                <>
                  <Link href="/mypage">마이페이지</Link>
                  <span className="utility-sep">|</span>
                  <button onClick={handleLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'inherit', color: 'inherit' }}>로그아웃</button>
                </>
              ) : (
                <>
                  <Link href="/signup">회원가입</Link>
                  <span className="utility-sep">|</span>
                  <Link href="/login">로그인</Link>
                </>
              )}
              <span className="utility-sep">|</span>
              <Link href="/faq">고객센터</Link>
            </div>
          </div>
        </div>

        {/* 메인 바 */}
        <div className="header-main-row">
          <div className="container">
            <div className="header-main-inner">
              <button className="hamburger-btn" onClick={() => setDrawerOpen(true)}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </button>

              <Link href="/" className="header-logo">
                <img src="/DelioLogo.png" alt="Delio" style={{ height:52, width:'auto', display:'block', objectFit:'contain' }} />
              </Link>

              {/* 검색 */}
              <div className="search-wrap" ref={searchWrapRef}>
                <form className="header-search" onSubmit={handleSearch}>
                  <input
                    type="text"
                    className="header-search-input"
                    placeholder="과일, 산지, 브랜드를 검색해보세요"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onFocus={openDrop}
                    autoComplete="off"
                  />
                  <button type="submit" className="header-search-btn">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/>
                    </svg>
                  </button>
                </form>
                {dropOpen && (
                  <div className="search-dropdown open">
                    <div className="search-drop-section">
                      <div className="search-drop-header">
                        <span className="search-drop-title">최근 검색어</span>
                        <button className="search-drop-clear" onClick={clearAllRecent}>전체삭제</button>
                      </div>
                      <div className="search-recent-list">
                        {recent.length === 0
                          ? <span className="search-recent-empty">최근 검색어가 없습니다</span>
                          : recent.map((q, i) => (
                            <div key={i} className="search-recent-pill">
                              <span onClick={() => { setQuery(q); router.push(`/search?q=${encodeURIComponent(q)}`); }}>{q}</span>
                              <button className="search-recent-pill-x" onClick={() => removeRecent(i)}>×</button>
                            </div>
                          ))
                        }
                      </div>
                    </div>
                    <hr className="search-drop-divider" />
                    <div className="search-drop-section">
                      <div className="search-drop-title search-drop-title-mb">인기 검색어</div>
                      <div className="search-popular-grid">
                        {popular.map((kw, i) => (
                          <div key={i} className="search-popular-item" onClick={() => { router.push(`/search?q=${encodeURIComponent(kw)}`); setDropOpen(false); }}>
                            <span className="search-popular-num" style={{ color: i < 3 ? 'var(--color-accent)' : '#1A1A1A' }}>{i + 1}</span>
                            <span className="search-popular-text" style={{ color: i < 3 ? 'var(--color-accent)' : undefined }}>{kw}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Link href="/shipping" className="header-delivery-btn">배송안내</Link>

              <div className="header-actions">
                <button className="mob-search-btn" onClick={() => router.push('/search')} title="검색">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/>
                  </svg>
                </button>
                <Link href="/cart" className="cart-icon-wrap header-icon-btn" title="장바구니">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>
                    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 001.95 1.53h9.58a2 2 0 001.95-1.53l1.54-8.42H5.05"/>
                  </svg>
                  {cartCount > 0 && <span className="cart-count cart-badge">{cartCount}</span>}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 네비게이션 바 */}
      <div className="header-nav-row">
        <div className="container">
          <nav className="header-nav">
            <div className="mega-nav-wrap">
              <a href="#" className={`mega-btn${megaOpen ? ' open' : ''}`} onClick={e => { e.preventDefault(); setMegaOpen(v => !v); }}>
                <svg className="mega-icon-open" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
                <svg className="mega-icon-close" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                카테고리
              </a>
              <div className={`mega-dropdown${megaOpen ? ' open' : ''}`}>
                <div className="container mega-dropdown-inner-container">
                  <div className="mega-card">
                    <div className="mega-inner">
                      <div className="mega-col">
                        <div className="mega-col-title"><Link href="/domestic">국산과일</Link></div>
                        <Link href="/category?origin=domestic" className="mega-link">전체보기</Link>
                      </div>
                      <div className="mega-col">
                        <div className="mega-col-title"><Link href="/import">수입과일</Link></div>
                        <Link href="/category?origin=import" className="mega-link">전체보기</Link>
                      </div>
                      <div className="mega-col">
                        <div className="mega-col-title"><Link href="/brand-intro">브랜드 소개관</Link></div>
                        <Link href="/brand" className="mega-link">브랜드 소개</Link>
                        <Link href="/farms" className="mega-link">파트너 농가</Link>
                      </div>
                      <div className="mega-col mega-col-last">
                        <div className="mega-col-title"><Link href="/service">서비스</Link></div>
                        <Link href="/shipping" className="mega-link">배송안내</Link>
                        <Link href="/inquiry" className="mega-link">입점/협업문의</Link>
                        <Link href="/faq" className="mega-link">고객센터</Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <Link href="/category?new=true" className="header-nav-link">신상품</Link>
            <Link href="/brand-intro" className="header-nav-link">브랜드소개관</Link>
            <Link href="/event" className="header-nav-link">이벤트</Link>
            <Link href="/lounge" className="header-nav-link">라운지</Link>
            <Link href="/survey" className="header-nav-link">취향진단</Link>
          </nav>
        </div>
      </div>

      {/* 모바일 드로어 */}
      <div className={`mobile-drawer${drawerOpen ? ' open' : ''}`}>
        <div className="drawer-overlay" onClick={() => setDrawerOpen(false)} />
        <div className="drawer-panel">
          <button className="drawer-close" onClick={() => setDrawerOpen(false)}>✕</button>
          <div className="drawer-logo">
            <img src="/DelioLogo.png" alt="Delio" style={{ height:26, width:'auto', display:'block', objectFit:'contain' }} />
          </div>
          <nav className="drawer-nav">
            <Link href="/" onClick={() => setDrawerOpen(false)}>홈</Link>
            <Link href="/category" onClick={() => setDrawerOpen(false)}>카테고리</Link>
            <Link href="/category?sort=best" onClick={() => setDrawerOpen(false)}>베스트</Link>
            <Link href="/event" onClick={() => setDrawerOpen(false)}>이벤트</Link>
            <Link href="/search" onClick={() => setDrawerOpen(false)}>검색</Link>
            <Link href="/mypage" onClick={() => setDrawerOpen(false)}>마이페이지</Link>
            <Link href="/cart" onClick={() => setDrawerOpen(false)}>장바구니</Link>
            <Link href="/faq" onClick={() => setDrawerOpen(false)}>FAQ</Link>
          </nav>
        </div>
      </div>
    </>
  );
}
