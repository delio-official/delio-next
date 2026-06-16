'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Menu, Truck, Home, Heart, User } from 'lucide-react';
import { loadTabsFor, loadCategoryTabs, tabHref, type FilterTab } from '@/lib/filterTabs';
import { loadMenuItems, megaColumns } from '@/lib/menu';
import { createClient } from '@/lib/supabase';

type AccItem = { icon: string; bg: string; name: string; subs: { label: string; href: string }[] };

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

const SHORTCUTS_FALLBACK = [
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
  return (
    <Suspense fallback={null}>
      <BottomNavInner />
    </Suspense>
  );
}

function BottomNavInner() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const panel = searchParams.get('panel');
  const onMypage = pathname === '/mypage' || pathname.startsWith('/mypage/');
  const { loggedIn } = useAuth();

  const [catOpen, setCatOpen] = useState(false);
  const [openAcc, setOpenAcc] = useState<number | null>(null);
  const [shortcuts, setShortcuts] = useState(SHORTCUTS_FALLBACK);
  const [catItems, setCatItems] = useState<AccItem[]>([]);

  /* 하단바 바로가기 로드 (filter_tabs.show_in_shortcut) */
  useEffect(() => {
    loadTabsFor('shortcut').then((rows: FilterTab[]) => {
      if (rows.length) setShortcuts(rows.map(t => ({ icon: t.emoji, bg: t.bg || '#F5F5F5', label: t.label, href: tabHref(t) })));
    });
  }, []);

  /* 카테고리 대분류→소분류 아코디언 로드 */
  useEffect(() => {
    loadCategoryTabs().then(tabs => {
      const majors = tabs.filter(t => !t.parent).sort((a, b) => a.sort_order - b.sort_order);
      setCatItems(majors.map(m => ({
        icon: m.emoji || '🍎', bg: m.bg || '#FFE8E8', name: m.label,
        subs: [{ label: '전체보기', href: `/category?cat=${m.tab_value}` },
          ...tabs.filter(t => t.parent === m.tab_value).sort((a, b) => a.sort_order - b.sort_order)
            .map(s => ({ label: s.label, href: `/category?cat=${s.tab_value}` }))],
      })));
    });
  }, []);

  /* 카테고리 프로모 배너(cat_promo) 로드 — 등록·활성 시 이미지로 교체, 없으면 기본 CSS 배너 */
  const [catPromo, setCatPromo] = useState<{ image: string; link: string } | null>(null);
  useEffect(() => {
    createClient()
      .from('banners')
      .select('image_url, image_url_mobile, link_url, sort_order')
      .eq('type', 'cat_promo').eq('is_active', true)
      .order('sort_order').limit(1)
      .then(({ data }) => {
        const b = data?.[0] as { image_url: string | null; image_url_mobile: string | null; link_url: string } | undefined;
        const img = b?.image_url_mobile || b?.image_url;
        if (img) setCatPromo({ image: img, link: b!.link_url || '/' });
      });
  }, []);

  const [menuAccItems, setMenuAccItems] = useState<AccItem[]>([]);
  /* 메뉴(브랜드/서비스 등) 아코디언 로드 */
  useEffect(() => {
    loadMenuItems().then(items => {
      setMenuAccItems(megaColumns(items).map(({ group, links }) => ({
        icon: group.emoji || '🏪', bg: '#E8EAF6', name: group.label,
        subs: links.map(l => ({ label: l.label, href: l.href })),
      })));
    }).catch(() => {});
  }, []);

  /* 동적 카테고리 + 동적 메뉴 (없으면 하드코딩 폴백) */
  const cats: AccItem[] = catItems.length > 0 ? catItems : CAT_DATA.slice(0, 2);
  const menus: AccItem[] = menuAccItems.length > 0 ? menuAccItems : CAT_DATA.slice(2);
  const accData: AccItem[] = [...cats, ...menus];

  /* history.state 기준으로 드로어 표시 동기화 */
  const syncFromHistory = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.state?.catDrawer) {
      setCatOpen(true);
      document.body.style.overflow = 'hidden';
    } else {
      setCatOpen(false);
      setOpenAcc(null);
      document.body.style.overflow = '';
    }
  }, []);

  function openCat() {
    setCatOpen(true);
    document.body.style.overflow = 'hidden';
    // 드로어 열림을 히스토리 항목으로 기록 → 항목 클릭 후 뒤로가기 시 카테고리로 복귀
    window.history.pushState({ ...window.history.state, catDrawer: true }, '');
  }
  function closeCat() {
    // 드로어 항목이 히스토리에 있으면 back으로 제거(popstate가 닫음), 아니면 직접 닫기
    if (typeof window !== 'undefined' && window.history.state?.catDrawer) {
      window.history.back();
    } else {
      setCatOpen(false);
      setOpenAcc(null);
      document.body.style.overflow = '';
    }
  }
  function toggleAcc(i: number) {
    setOpenAcc(prev => prev === i ? null : i);
  }
  function goAndClose(href: string) {
    // 카테고리 항목 클릭 → 앞으로 이동(드로어 항목은 히스토리에 남겨 뒤로가기로 복귀 가능)
    setCatOpen(false);
    setOpenAcc(null);
    document.body.style.overflow = '';
    router.push(href);
  }
  /* 하단 탭(홈/찜/마이/배송조회) 클릭 → 경로 변화 여부와 무관하게 드로어 즉시 닫기 */
  function closeCatForNav() {
    if (!catOpen) return;
    setCatOpen(false);
    setOpenAcc(null);
    document.body.style.overflow = '';
    // 현재 히스토리 항목의 드로어 플래그 제거 → 탭 이동 후 뒤로가기로 재오픈 안 되게
    if (typeof window !== 'undefined' && window.history.state?.catDrawer) {
      window.history.replaceState({ ...window.history.state, catDrawer: false }, '');
    }
  }

  function isActive(path: string) {
    return pathname === path || pathname.startsWith(path + '/');
  }

  /* 뒤로/앞으로 가기 → history.state 기준 동기화 (뒤로가기로 카테고리 복귀) */
  useEffect(() => {
    window.addEventListener('popstate', syncFromHistory);
    return () => window.removeEventListener('popstate', syncFromHistory);
  }, [syncFromHistory]);

  /* 경로 변경 시에도 동기화 (다른 탭 이동 시 닫힘, 뒤로 복귀 시 열림) */
  useEffect(() => {
    syncFromHistory();
  }, [pathname, syncFromHistory]);

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
            {/* 프로모 배너 — 관리자 등록 이미지(cat_promo) 우선, 없으면 기본 CSS 배너 */}
            {catPromo ? (
              <div className="cd-promo-img" onClick={() => goAndClose(catPromo.link)}>
                <img src={catPromo.image} alt="" />
              </div>
            ) : (
              <div className="cd-promo" onClick={() => goAndClose('/category?sort=brix')}>
                <div className="cd-promo-text">
                  <span className="cd-promo-tag">TODAY&apos;S BRIX</span>
                  <div className="cd-promo-title">오늘의 당도 TOP 6 공개!</div>
                  <div className="cd-promo-sub">매일 오전 6시 기준 직접 측정</div>
                </div>
                <div className="cd-promo-icon">🍬</div>
              </div>
            )}

            {/* 바로가기 그리드 */}
            <div className="cd-sc-grid">
              {shortcuts.map(sc => (
                <div key={sc.label} className="cd-sc-item" onClick={() => goAndClose(sc.href)}>
                  <span className="cd-sc-label">{sc.label}</span>
                </div>
              ))}
            </div>

            {/* 카테고리 아코디언 */}
            <div className="cd-acc-wrap">
              {accData.map((cat, i) => (
                <div key={`${cat.name}-${i}`} className={`cat-drawer-acc-item${openAcc === i ? ' open' : ''}`}>
                  <div className="cat-drawer-acc-header" onClick={() => toggleAcc(i)}>
                    <span className="cat-drawer-name">{cat.name}</span>
                    <svg className="cat-drawer-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </div>
                  <div className="cat-drawer-sub-grid" style={{ height: openAcc === i ? 'auto' : 0 }}>
                    {cat.subs.map((sub, j) => (
                      <div
                        key={`${sub.label}-${j}`}
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
          <button className={`bottom-nav-item${catOpen ? ' active' : ''}`} onClick={() => catOpen ? closeCat() : openCat()}>
            <Menu size={23} strokeWidth={1.7} />
            <span>카테고리</span>
          </button>

          {/* 배송조회 */}
          <Link href="/mypage?panel=order" onClick={closeCatForNav} className={`bottom-nav-item${!catOpen && onMypage && panel === 'order' ? ' active' : ''}`}>
            <Truck size={23} strokeWidth={1.7} />
            <span>배송조회</span>
          </Link>

          {/* 홈 */}
          <Link href="/" onClick={closeCatForNav} className={`bottom-nav-item nav-home${!catOpen && pathname === '/' ? ' active' : ''}`}>
            <Home size={23} strokeWidth={1.7} />
            <span>홈</span>
          </Link>

          {/* 찜 */}
          <Link href="/mypage?panel=wish" onClick={closeCatForNav} className={`bottom-nav-item${!catOpen && onMypage && panel === 'wish' ? ' active' : ''}`}>
            <Heart size={23} strokeWidth={1.7} />
            <span>찜</span>
          </Link>

          {/* 마이/로그인 */}
          <Link href={loggedIn ? '/mypage' : '/login'} onClick={closeCatForNav} className={`bottom-nav-item${!catOpen && ((onMypage && panel !== 'order' && panel !== 'wish') || isActive('/login')) ? ' active' : ''}`}>
            <User size={23} strokeWidth={1.7} />
            <span>{loggedIn ? '마이' : '로그인'}</span>
          </Link>
        </div>
      </nav>

      {/* 카카오 플로팅 */}
      <button className="kakao-float" title="카카오 채널 상담" onClick={() => window.open('https://pf.kakao.com/_RxnrxbX/chat', '_blank')}>
        <svg viewBox="0 0 24 24" width="26" height="26" xmlns="http://www.w3.org/2000/svg">
          <path fill="#3C1E1E" d="M12 3C6.48 3 2 6.48 2 10.8c0 2.74 1.6 5.15 4.02 6.62l-.97 3.63c-.08.3.23.55.5.38L9.8 18.9c.71.1 1.44.15 2.2.15 5.52 0 10-3.48 10-7.8S17.52 3 12 3z"/>
        </svg>
      </button>
    </>
  );
}
