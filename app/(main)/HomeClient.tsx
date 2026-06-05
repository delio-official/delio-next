'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { openOptionDrawer } from '@/lib/cart';
import { getWishlistIds, toggleWishlist } from '@/lib/wishlist';
import '@/styles/index.css';
import { StarRating, SingleStar } from '@/components/StarRating';
import PopupOverlay from '@/components/PopupOverlay/PopupOverlay';

/* ===== 배너 인터페이스 ===== */
interface Banner {
  id: string;
  image_url: string | null;
  image_url_mobile: string | null;
  link_url: string;
  sort_order: number;
}

/* ===== 라운지 포스트 인터페이스 ===== */
interface LoungePost {
  id: number;
  bg: string;
  emoji: string;
  title: string;
  badge: string;
  date: string;
  thumbnail_url: string | null;
}

/* ===== 상품 인터페이스 ===== */
interface PickProduct {
  id: string; name: string; price: number; discounted_price: number;
  discount_rate: number; brix: number | null; is_dawn: boolean;
  is_new: boolean; is_best: boolean;
  avg_rating: number; review_count: number; short_desc: string | null;
  thumbnail_url: string | null; category: string;
}
interface QGProduct {
  id: string; name: string; price: number; discounted_price: number;
  discount_rate: number; brix: number | null; is_dawn: boolean;
  is_new: boolean; is_best: boolean;
  thumbnail_url: string | null; category: string;
}

const CAT_ICONS: Record<string, string> = { apple: '🍎', citrus: '🍊', berry: '🫐', melon: '🍈', kiwi: '🥝', mango: '🥭', grape: '🍇', gift: '🎁', best: '🌟', dawn: '🚚' };
const CAT_BG: Record<string, string> = { apple: '#FFE8E8', citrus: '#FFF3E0', berry: '#F3E5F5', melon: '#E8F5E9', kiwi: '#F1F8E9', mango: '#FFF9E6', grape: '#EDE7F6', gift: '#E8EAF6', best: '#FFF9E6', dawn: '#E8F5E9' };

/* ===== 픽 섹션 화살표 (BannerArrow와 동일 스타일) ===== */
function PickSectionArrow({ dir, visible, onClick }: { dir: 'prev'|'next'; visible: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      className="pick-section-arrow"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute', top: '35%', transform: 'translateY(-50%)',
        ...(dir === 'prev' ? { left: -22 } : { right: -22 }),
        zIndex: 10, width: 44, height: 44,
        background: hovered ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.32)',
        color: '#fff', border: 'none', borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        transition: 'opacity .4s, background .15s',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
      }}>
      {dir === 'prev'
        ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22" style={{ transform:'translateX(-1px)' }}><polyline points="15 18 9 12 15 6"/></svg>
        : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22" style={{ transform:'translateX(1px)' }}><polyline points="9 18 15 12 9 6"/></svg>}
    </button>
  );
}

/* ===== 배너 화살표 ===== */
function BannerArrow({ dir, visible, onClick }: { dir: 'prev' | 'next'; visible: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const style: React.CSSProperties = {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    zIndex: 100, width: 52, height: 52,
    background: hovered ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.32)',
    color: '#fff', border: 'none', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'opacity .4s, background .15s',
    opacity: visible ? 1 : 0,
    ...(dir === 'prev'
      ? { left: 'max(12px, calc((100vw - 1118px) / 2 - 42px))' }
      : { right: 'max(12px, calc((100vw - 1132px) / 2))' }),
  };
  return (
    <button style={style} onClick={onClick}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {dir === 'prev'
        ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="28" height="28" style={{ transform: 'translateX(-1px)' }}><polyline points="15 18 9 12 15 6" /></svg>
        : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="28" height="28" style={{ transform: 'translateX(1px)' }}><polyline points="9 18 15 12 9 6" /></svg>}
    </button>
  );
}

/* ===== 메인 배너 ===== */
/* 배너 노출/클릭 카운트 (조용히 실패 허용) */
function bumpBanner(id: string, kind: 'view' | 'click') {
  try { createClient().rpc('bump_banner_stat', { p_id: id, p_kind: kind }); } catch { /* noop */ }
}

function MainBanner() {
  const [slides, setSlides] = useState<Banner[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    createClient()
      .from('banners').select('id,image_url,image_url_mobile,link_url,sort_order')
      .eq('type', 'main').eq('is_active', true).order('sort_order')
      .then(({ data }) => { setSlides(data || []); setReady(true); (data || []).forEach((b: Banner) => bumpBanner(b.id, 'view')); });
  }, []);

  const CLONES = 2;
  const TOTAL = slides.length;
  const allSlides = TOTAL > 0 ? [...slides.slice(-CLONES), ...slides, ...slides.slice(0, CLONES)] : [];

  const trackRef = useRef<HTMLDivElement>(null);
  const clipRef  = useRef<HTMLDivElement>(null);
  const fillRef  = useRef<HTMLDivElement>(null);
  const curRef   = useRef(CLONES);
  const touchStartX = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transitioning = useRef(false);
  const [bannerHovered, setBannerHovered] = useState(false);
  const [glowUrl, setGlowUrl] = useState<string | null>(null);

  const getStep = useCallback(() => {
    if (!trackRef.current || !trackRef.current.children[0]) return 300;
    const gap = parseInt(window.getComputedStyle(trackRef.current).columnGap) || 0;
    return (trackRef.current.children[0] as HTMLElement).offsetWidth + gap;
  }, []);

  const setPos = useCallback((idx: number, animate: boolean) => {
    if (!trackRef.current) return;
    trackRef.current.style.transition = animate ? 'transform .35s cubic-bezier(.4,0,.2,1)' : 'none';
    trackRef.current.style.transform = `translate3d(-${idx * getStep()}px,0,0)`;
  }, [getStep]);

  const updateProgress = useCallback((cur: number) => {
    if (fillRef.current && TOTAL > 0) {
      const real = (cur - CLONES + TOTAL) % TOTAL;
      const pct = 100 / TOTAL;
      fillRef.current.style.left = `${real * pct}%`;
      fillRef.current.style.width = `${pct}%`;
      setGlowUrl(slides[real]?.image_url || null);
    }
    /* 활성 슬라이드 2장 밝게, 나머지 어둡게 */
    if (trackRef.current) {
      Array.from(trackRef.current.children).forEach((el, i) => {
        el.classList.toggle('slide-active', i === cur || i === cur + 1);
      });
    }
  }, [CLONES, TOTAL, slides]);

  const snapTo = useCallback((idx: number) => {
    curRef.current = idx;
    setPos(idx, false);
    updateProgress(idx);
  }, [setPos, updateProgress]);

  const go = useCallback((next: number) => {
    if (transitioning.current || TOTAL === 0) return;
    if (next >= TOTAL + CLONES) { snapTo(curRef.current - TOTAL); next = curRef.current + 1; }
    transitioning.current = true;
    curRef.current = next;
    setPos(next, true);
    updateProgress(next);
  }, [TOTAL, CLONES, snapTo, setPos, updateProgress]);

  const startTimer = useCallback(() => { timerRef.current = setInterval(() => go(curRef.current + 1), 4500); }, [go]);
  const stopTimer  = useCallback(() => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  useEffect(() => {
    if (!ready || TOTAL === 0) return;
    setPos(CLONES, false);
    /* 약간의 딜레이 후 활성 클래스 적용 (DOM 렌더 완료 후) */
    requestAnimationFrame(() => updateProgress(CLONES));
    startTimer();
    const track = trackRef.current;
    if (track) {
      const onEnd = (e: TransitionEvent) => {
        if (e.target !== track || e.propertyName !== 'transform') return;
        if (curRef.current < CLONES) snapTo(curRef.current + TOTAL);
        transitioning.current = false;
      };
      track.addEventListener('transitionend', onEnd);
      return () => { track.removeEventListener('transitionend', onEnd); stopTimer(); };
    }
    return () => stopTimer();
  }, [ready, TOTAL, CLONES, setPos, updateProgress, startTimer, stopTimer, snapTo]);

  useEffect(() => {
    const onResize = () => setPos(curRef.current, false);
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, [setPos]);

  if (!ready) return <div className="main-banner" style={{ background: '#F3F3F0' }} />;
  if (slides.length === 0) return null;

  return (
    <div className="main-banner" id="mainBanner">
      {/* 이미지 색상 후광 */}
      {glowUrl && <div className="banner-img-glow" style={{ backgroundImage: `url(${glowUrl})` }} />}
      <div className="main-banner-inner" onMouseEnter={() => setBannerHovered(true)} onMouseLeave={() => setBannerHovered(false)}>
        <div className="main-banner-clip" ref={clipRef}
          onTouchStart={e => { touchStartX.current = e.touches[0].clientX; stopTimer(); }}
          onTouchEnd={e => {
            const dx = e.changedTouches[0].clientX - touchStartX.current;
            if (Math.abs(dx) > 40) go(curRef.current + (dx < 0 ? 1 : -1));
            startTimer();
          }}>
          <div className="main-banner-track" ref={trackRef}>
            {allSlides.map((s, i) => (
              <div key={i} className="banner-slide-wrap">
                {/* 이미지 색상 후광 (모바일) */}
                {s.image_url && (
                  <div className="banner-slide-glow" style={{ backgroundImage: `url(${s.image_url})` }} />
                )}
                <Link href={s.link_url || '/'} onClick={() => bumpBanner(s.id, 'click')} className="main-banner-slide" style={{ display: 'block', overflow: 'hidden', padding: 0 }}>
                  {s.image_url ? (
                    s.image_url_mobile ? (
                      <>
                        <img src={s.image_url} alt="" className="bnr-img-pc-only" />
                        <img src={s.image_url_mobile} alt="" className="bnr-img-mob" />
                      </>
                    ) : (
                      <img src={s.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    )
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: '#F0F0EE' }} />
                  )}
                </Link>
              </div>
            ))}
          </div>
        </div>
        <BannerArrow dir="prev" visible={bannerHovered} onClick={() => { stopTimer(); go(curRef.current - 1); startTimer(); }} />
        <BannerArrow dir="next" visible={bannerHovered} onClick={() => { stopTimer(); go(curRef.current + 1); startTimer(); }} />
      </div>
      <div className="banner-progress-wrap">
        <div className="banner-progress">
          <div className="banner-progress-fill" ref={fillRef} />
        </div>
        <div className="banner-progress-nav">
          <button onClick={() => { stopTimer(); go(curRef.current - 1); startTimer(); }}>‹</button>
          <button onClick={() => { stopTimer(); go(curRef.current + 1); startTimer(); }}>›</button>
        </div>
      </div>
    </div>
  );
}

/* ===== 퀵 가이드 (Supabase 연결) ===== */
function QuickGuide() {
  const router = useRouter();
  const [activeCat, setActiveCat] = useState('apple');
  const [items, setItems] = useState<QGProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [wishedIds, setWishedIds] = useState<Set<string>>(new Set());
  const qgScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchQG() {
      setLoading(true);
      const supabase = createClient();
      let q = supabase
        .from('products')
        .select('id,name,price,discounted_price,discount_rate,brix,is_dawn,is_new,is_best,thumbnail_url,category')
        .eq('is_active', true);
      if      (activeCat === 'best') q = (q as any).eq('is_best', true);
      else if (activeCat === 'dawn') q = (q as any).eq('is_dawn', true);
      else                           q = (q as any).eq('category', activeCat);
      const { data } = await (q as any).limit(8);
      if (!cancelled) {
        setItems((data as QGProduct[]) || []);
        setLoading(false);
      }
    }
    fetchQG();
    return () => { cancelled = true; };
  }, [activeCat]);

  useEffect(() => {
    getWishlistIds().then(ids => setWishedIds(new Set(ids)));
  }, [activeCat]);

  async function handleQGWish(e: React.MouseEvent, productId: string) {
    e.stopPropagation();
    const next = await toggleWishlist(productId);
    setWishedIds(prev => {
      const s = new Set(prev);
      if (next) s.add(productId); else s.delete(productId);
      return s;
    });
  }

  const tags = [
    { cat: 'apple',  icon: '🍎', label: '사과/배' },
    { cat: 'citrus', icon: '🍊', label: '감귤류' },
    { cat: 'berry',  icon: '🫐', label: '베리류' },
    { cat: 'melon',  icon: '🍈', label: '멜론/참외' },
    { cat: 'kiwi',   icon: '🥝', label: '키위' },
    { cat: 'mango',  icon: '🥭', label: '망고' },
    { cat: 'grape',  icon: '🍇', label: '포도' },
    { cat: 'gift',   icon: '🎁', label: '선물세트' },
    { cat: 'best',   icon: '🌟', label: '베스트' },
    { cat: 'dawn',   icon: '🚚', label: '새벽배송' },
  ];

  return (
    <section className="quick-guide-section" id="section-guide">
      <div className="container">
        <div className="g-section-head">
          <h2 className="g-section-title">
            <small>원하는 과일을 태그로 빠르게 찾아보세요</small>
            <div className="g-title-main">
              <span>퀵 가이드</span>
              <Link href="/category" className="g-section-link">전체보기</Link>
            </div>
          </h2>
        </div>
        <div className="qg-tags">
          {tags.map(t => (
            <a key={t.cat} href={`/category?cat=${t.cat}`}
              className={`qg-tag${activeCat === t.cat ? ' active' : ''}`}
              onClick={e => { e.preventDefault(); setActiveCat(t.cat); }}>
              <span className="qg-icon">{t.icon}</span>
              <span className="qg-label">{t.label}</span>
              <span className="qg-inline">{t.icon} {t.label}</span>
            </a>
          ))}
        </div>
        <div className="qg-scroll-wrap" style={{ position:'relative' }}>
          <button className="qg-nav-btn prev" onClick={() => qgScrollRef.current && smoothScroll(qgScrollRef.current, -494)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22" style={{ transform:'translateX(-1px)' }}><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button className="qg-nav-btn next" onClick={() => qgScrollRef.current && smoothScroll(qgScrollRef.current, 494)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22" style={{ transform:'translateX(1px)' }}><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        <div className="qg-products" ref={qgScrollRef}>
          {loading
            ? [0,1,2,3].map(i => (
                <div key={i} className="qg-card" style={{ opacity:0.35 }}>
                  <div className="qg-card-img" style={{ background:'#F0F0EE' }} />
                  <div className="qg-card-body">
                    <div style={{ height:12, background:'#E8E8E6', borderRadius:4, marginBottom:8 }} />
                    <div style={{ height:16, background:'#E8E8E6', borderRadius:4, marginBottom:6, width:'80%' }} />
                    <div style={{ height:18, background:'#E8E8E6', borderRadius:4, width:'60%' }} />
                  </div>
                </div>
              ))
            : items.length === 0
              ? <p style={{ textAlign:'center', color:'#bbb', padding:'40px 0' }}>해당 카테고리 상품이 없습니다.</p>
              : items.map(p => {
                  const catKey = (activeCat === 'best' || activeCat === 'dawn') ? p.category : activeCat;
                  const icon = CAT_ICONS[catKey] || '🍑';
                  const bg   = CAT_BG[catKey]   || '#F4EFE6';
                  const displayPrice = p.discounted_price ?? p.price;
                  return (
                    <div key={p.id} className="qg-card" onClick={() => router.push(`/product/${p.id}`)}>
                      <div className="qg-card-img" style={{ background: bg, position:'relative' }}>
                        {/* 배송 배지 (썸네일 좌상단) */}
                        <span className={`qg-card-delivery ${p.is_dawn ? 'tag-dawn' : 'tag-regular'}`}
                          style={{ position:'absolute', top:10, left:10, zIndex:2 }}>
                          {p.is_dawn ? '산지직송' : '자사배송'}
                        </span>
                        {p.thumbnail_url
                          ? <img src={p.thumbnail_url} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                          : <span className="qg-card-img-inner">{icon}</span>
                        }
                      </div>
                      <div className="qg-card-body">
                        {(p.is_new || p.is_best) ? (
                          <span className="qg-card-tag" style={{ background:'#1A1A1A', color:'#fff' }}>
                            {p.is_new ? 'NEW' : '인기'}
                          </span>
                        ) : (
                          <span className="qg-card-tag" style={{ visibility:'hidden' }}>·</span>
                        )}
                        <div className="qg-card-name">{p.name}</div>
                        {p.discount_rate > 0
                          ? <div className="qg-card-original">{p.price.toLocaleString()}원</div>
                          : <div className="qg-card-original" style={{ visibility:'hidden' }}>&nbsp;</div>
                        }
                        <div className="qg-card-price-row">
                          {p.discount_rate > 0 && <span className="qg-card-discount">{p.discount_rate}%</span>}
                          <span className="qg-card-price">{displayPrice.toLocaleString()}원</span>
                        </div>
                        <div className="qg-body-actions">
                          <button className="qg-body-wish" onClick={e => handleQGWish(e, p.id)}>
                            <span style={{ color: wishedIds.has(p.id) ? '#E53935' : undefined }}>{wishedIds.has(p.id) ? '♥' : '♡'}</span> 찜
                          </button>
                          <span className="qg-body-actions-divider" />
                          <button className="qg-body-cart" onClick={e => {
                            e.stopPropagation();
                            openOptionDrawer(p.id);
                          }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                              <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>
                              <path d="M2.05 2.05h2l2.66 12.42a2 2 0 001.95 1.53h9.58a2 2 0 001.95-1.53l1.54-8.42H5.05"/>
                            </svg> 담기
                          </button>
                        </div>
                      </div>
                      <div className="qg-card-img qg-card-img-r" style={{ background: bg }}>
                        <span className="qg-card-img-inner">{icon}</span>
                      </div>
                    </div>
                  );
                })
          }
        </div>
        </div>
      </div>
    </section>
  );
}

/* ===== 중간 배너 ===== */
function MidBanner() {
  const [slides, setSlides] = useState<Banner[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    createClient()
      .from('banners').select('id,image_url,image_url_mobile,link_url,sort_order')
      .eq('type', 'mid').eq('is_active', true).order('sort_order')
      .then(({ data }) => { setSlides(data || []); setReady(true); (data || []).forEach((b: Banner) => bumpBanner(b.id, 'view')); });
  }, []);

  const CLONES = 2;
  const TOTAL  = slides.length;
  const allSlides = TOTAL > 0 ? [...slides.slice(-CLONES), ...slides, ...slides.slice(0, CLONES)] : [];

  const trackRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const curRef   = useRef(CLONES);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transitioning = useRef(false);
  const [activeDot, setActiveDot] = useState(0);

  const getStep = useCallback(() => {
    if (!pagesRef.current) return 300;
    return window.innerWidth <= 640
      ? pagesRef.current.offsetWidth + 16
      : (pagesRef.current.offsetWidth + 16) / 2;
  }, []);

  const setPos = useCallback((idx: number, animate: boolean) => {
    if (!trackRef.current) return;
    trackRef.current.style.transition = animate ? 'transform .5s cubic-bezier(.4,0,.2,1)' : 'none';
    trackRef.current.style.transform = `translateX(-${idx * getStep()}px)`;
  }, [getStep]);

  const snapTo = useCallback((idx: number) => {
    if (!trackRef.current) return;
    trackRef.current.style.transition = 'none';
    void trackRef.current.offsetWidth;
    curRef.current = idx;
    trackRef.current.style.transform = `translateX(-${idx * getStep()}px)`;
    if (TOTAL > 0) setActiveDot((idx - CLONES + TOTAL) % TOTAL);
    void trackRef.current.offsetWidth;
  }, [getStep, CLONES, TOTAL]);

  const go = useCallback((next: number) => {
    if (transitioning.current || TOTAL === 0) return;
    if (next >= TOTAL + CLONES) { snapTo(curRef.current - TOTAL); next = curRef.current + 1; }
    if (next < CLONES) { snapTo(curRef.current + TOTAL); next = curRef.current - 1; }
    transitioning.current = true;
    curRef.current = next;
    setPos(next, true);
    setActiveDot((next - CLONES + TOTAL) % TOTAL);
  }, [TOTAL, CLONES, snapTo, setPos]);

  const startTimer = useCallback(() => { timerRef.current = setInterval(() => go(curRef.current + 1), 5000); }, [go]);
  const stopTimer  = useCallback(() => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  useEffect(() => {
    if (!ready || TOTAL === 0) return;
    setPos(CLONES, false); startTimer();
    const track = trackRef.current;
    if (track) {
      const onEnd = (e: TransitionEvent) => {
        if (e.target !== track || e.propertyName !== 'transform') return;
        if (curRef.current < CLONES) snapTo(curRef.current + TOTAL);
        transitioning.current = false;
      };
      track.addEventListener('transitionend', onEnd);
      return () => { track.removeEventListener('transitionend', onEnd); stopTimer(); };
    }
    return () => stopTimer();
  }, [ready, CLONES, TOTAL, setPos, startTimer, stopTimer, snapTo]);

  useEffect(() => {
    const onResize = () => setPos(curRef.current, false);
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, [setPos]);

  if (!ready || slides.length === 0) return null;

  return (
    <section className="mid-banner-section">
      <div className="container">
        <div className="mid-banner-carousel" id="midBannerCarousel">
          <div className="mid-banner-nav-row">
            <button className="mid-banner-arrow prev" onClick={() => { stopTimer(); go(curRef.current - 1); startTimer(); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ transform:'translateX(-1px)' }}><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div className="mid-banner-pages" ref={pagesRef}>
              <div className="mid-banner-track" ref={trackRef}>
                {allSlides.map((s, i) => (
                  <Link key={i} href={s.link_url || '/'} onClick={() => bumpBanner(s.id, 'click')} className="mid-banner-card" style={{ padding: 0, overflow: 'hidden' }}>
                    {s.image_url ? (
                      s.image_url_mobile ? (
                        <>
                          <img src={s.image_url} alt="" className="bnr-img-pc-only" />
                          <img src={s.image_url_mobile} alt="" className="bnr-img-mob" />
                        </>
                      ) : (
                        <img src={s.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      )
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: '#F0F0EE' }} />
                    )}
                  </Link>
                ))}
              </div>
            </div>
            <button className="mid-banner-arrow next" onClick={() => { stopTimer(); go(curRef.current + 1); startTimer(); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ transform:'translateX(1px)' }}><polyline points="9 6 15 12 9 18"/></svg>
            </button>
          </div>
          <div className="mid-banner-dots">
            {slides.map((_: Banner, i: number) => (
              <button key={i}
                className={`mid-banner-dot${activeDot === i ? ' active' : ''}`}
                onClick={() => { stopTimer(); snapTo(i + CLONES); startTimer(); }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ===== 리뷰 스크롤 유틸 ===== */
function smoothScroll(el: HTMLElement, dx: number) {
  const start = el.scrollLeft, end = start + dx, duration = 350, startTime = performance.now();
  function step(now: number) {
    const elapsed = now - startTime, progress = Math.min(elapsed / duration, 1);
    const ease = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
    el.scrollLeft = start + (end - start) * ease;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ===== 메인 컴포넌트 ===== */
export default function HomeClient() {
  const router = useRouter();
  const reviewScrollRef = useRef<HTMLDivElement>(null);
  const [pickProds, setPickProds] = useState<PickProduct[]>([]);
  const [loungePosts, setLoungePosts] = useState<LoungePost[]>([]);

  /* 픽 캐러셀 */
  const pickWrapRef = useRef<HTMLDivElement>(null);
  const [pickIndex, setPickIndex] = useState(0);
  const [pickWishedIds, setPickWishedIds] = useState<Set<string>>(new Set());

  /* 리사이즈 시 재렌더 트리거 */
  const [, pickForce] = useState(0);
  useEffect(() => {
    const onResize = () => pickForce(n => n + 1);
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    async function loadLounge() {
      const supabase = createClient();
      const { data } = await supabase
        .from('lounge_posts')
        .select('id,bg,emoji,title,badge,date,thumbnail_url')
        .eq('is_active', true)
        .order('sort_order')
        .order('created_at', { ascending: false })
        .limit(3);
      setLoungePosts((data as LoungePost[]) || []);
    }
    loadLounge();
  }, []);

  useEffect(() => {
    async function loadPicks() {
      const supabase = createClient();
      /* 어드민 설정값 읽기 (없으면 기본 6) */
      const { data: settingRow } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'pick_count')
        .single();
      const pickCount = Math.max(3, parseInt(settingRow?.value || '6'));

      const { data } = await supabase
        .from('products')
        .select('id,name,price,discounted_price,discount_rate,brix,is_dawn,is_new,is_best,avg_rating,review_count,short_desc,thumbnail_url,category')
        .eq('is_active', true)
        .order('review_count', { ascending: false })
        .limit(pickCount);
      setPickProds((data as PickProduct[]) || []);
    }
    loadPicks();
  }, []);

  useEffect(() => {
    getWishlistIds().then(ids => setPickWishedIds(new Set(ids)));
  }, []);

  async function handlePickWish(e: React.MouseEvent, productId: string) {
    e.stopPropagation();
    const next = await toggleWishlist(productId);
    setPickWishedIds(prev => {
      const s = new Set(prev);
      if (next) s.add(productId); else s.delete(productId);
      return s;
    });
  }

  /* 리뷰 카드 상품 ID 조회 (상품명 → id, 카테고리 → 대표 상품 id 매핑) */
  const [reviewProdMap, setReviewProdMap] = useState<Record<string, string>>({});
  const [catProdMap, setCatProdMap] = useState<Record<string, string>>({});
  useEffect(() => {
    async function fetchReviewProds() {
      const supabase = createClient();
      const { data } = await supabase
        .from('products')
        .select('id, name, category')
        .eq('is_active', true);
      if (data) {
        const map: Record<string, string> = {};
        const cmap: Record<string, string> = {};
        data.forEach((p: { id: string; name: string; category: string }) => {
          map[p.name] = p.id;
          if (p.category && !cmap[p.category]) cmap[p.category] = p.id; // 카테고리별 대표 상품
        });
        setReviewProdMap(map);
        setCatProdMap(cmap);
      }
    }
    fetchReviewProds();
  }, []);

  /* category= 쿼리에서 카테고리 추출 → 실제 상품 링크 (없으면 원래 링크) */
  const productHref = (fallbackHref: string, prodName?: string) => {
    if (prodName && reviewProdMap[prodName]) return `/product/${reviewProdMap[prodName]}`;
    const cat = fallbackHref.includes('cat=') ? fallbackHref.split('cat=')[1].split('&')[0] : '';
    if (cat && catProdMap[cat]) return `/product/${catProdMap[cat]}`;
    return fallbackHref;
  };

  const reviews = [
    { photo: 'review-photo-orange', emoji: '🍊', stars: 5, text: '정말 달아요. 이렇게 달콤한 한라봉은 처음 먹어봐요. 당도가 기대 이상이라 가족들이 다 좋아해요.', prodName: '제주 황금 한라봉', prodRating: '4.9 (2,847)', prodHref: '/category?cat=citrus', reviewHref: '/review' },
    { photo: 'review-photo-grape',  emoji: '🍇', stars: 5, text: '씨도 없고 달기도 너무 달아서 계속 손이 가요. 17.2 brix 보장이라고 했는데 그 이상인 것 같아요.', prodName: '영천 샤인머스캣', prodRating: '4.8 (1,019)', prodHref: '/category?cat=grape', reviewHref: '/review' },
    { photo: 'review-photo-kiwi',   emoji: '🥝', stars: 5, text: '골드키위 처음 먹어봤는데 완전 다른 식감이에요. 그린키위보다 훨씬 달고 부드럽네요.', prodName: '제스프리 골드키위', prodRating: '4.9 (1,857)', prodHref: '/category?cat=kiwi', reviewHref: '/review' },
    { photo: 'review-photo-apple',  emoji: '🍎', stars: 5, text: '충주 사과 맞나요? 이렇게 아삭하고 달수가. 매년 이맘때면 꼭 주문하게 될 것 같아요.', prodName: '충주 고당도 부사사과', prodRating: '4.7 (3,204)', prodHref: '/category?cat=apple', reviewHref: '/review' },
    { photo: 'review-photo-mango',  emoji: '🥭', stars: 5, text: '태국 애플망고 직수입이라 그런지 신선도가 다르네요. 향도 너무 좋고 당도도 최상입니다.', prodName: '애플망고 (태국산)', prodRating: '4.6 (11)', prodHref: '/category?cat=mango', reviewHref: '/review' },
    { photo: 'review-photo-berry',  emoji: '🫐', stars: 4, text: '블루베리가 알도 크고 터질때 달달해요. 냉동으로 먹어도 맛있어서 또 살게요.', prodName: '고성 친환경 블루베리', prodRating: '4.5 (628)', prodHref: '/category?cat=berry', reviewHref: '/review' },
    { photo: 'review-photo-melon',  emoji: '🍈', stars: 5, text: '성주 참외 먹고 다른 데 참외는 못 먹겠어요. 아삭한 식감에 과즙이 넘쳐서 정말 맛있어요.', prodName: '성주 황토 참외', prodRating: '4.8 (492)', prodHref: '/category?cat=melon', reviewHref: '/review' },
  ];

  const brandCards = [
    { banner:'bdc-banner-citrus', logo:'bdc-logo-citrus', emoji:'🍊', brand:'서귀포 감귤농원', farmSlug:'seogwipo-citrus',   brandHref:'/farm/seogwipo-citrus',   catHref:'/category?cat=citrus', prodName:'당도 보장 한라봉 3kg',         prodPrice:'38,000원', discount:20 },
    { banner:'bdc-banner-grape',  logo:'bdc-logo-grape',  emoji:'🍇', brand:'영천포도원',     farmSlug:'yeongcheon-grape',   brandHref:'/farm/yeongcheon-grape',   catHref:'/category?cat=grape',  prodName:'샤인머스캣 GAP인증 2kg',       prodPrice:'42,000원', discount:10 },
    { banner:'bdc-banner-berry',  logo:'bdc-logo-berry',  emoji:'🫐', brand:'고성 블루팜',    farmSlug:'goseong-bluefarm',   brandHref:'/farm/goseong-bluefarm',   catHref:'/category?cat=berry',  prodName:'무농약 블루베리 500g',          prodPrice:'16,000원', discount:10 },
    { banner:'bdc-banner-apple',  logo:'bdc-logo-apple',  emoji:'🍎', brand:'충주사과마을',   farmSlug:'chungju-apple',       brandHref:'/farm/chungju-apple',     catHref:'/category?cat=apple',  prodName:'[수율보장] 부사사과 프리미엄 5kg', prodPrice:'38,000원', discount:10 },
  ];

  return (
    <>
      {/* 팝업 오버레이 */}
      <PopupOverlay />

      {/* 메인 배너 */}
      <MainBanner />

      {/* ── 델리오 픽 ── */}
      <section className="curation-section" id="section-pick">
        <div className="container">
          <div className="g-section-head">
            <h2 className="g-section-title">
              <small>델리오가 엄선한 이번 주 추천 상품</small>
              <div className="g-title-main">
                <span>델리오 픽</span>
                <Link href="/category" className="g-section-link">전체보기</Link>
              </div>
            </h2>
          </div>
          <div style={{ position: 'relative' }}>
            <div id="pickGrid" ref={pickWrapRef}>
              <div className="pick-track" style={{
                transition: 'transform 0.4s cubic-bezier(0.4,0,0.2,1)',
                transform: `translateX(-${pickIndex * (pickWrapRef.current ? Math.floor((pickWrapRef.current.offsetWidth - 60) / 4) + 20 : 0)}px)`,
                willChange: 'transform',
              }}>
                {pickProds.length === 0
                  ? /* 로딩 스켈레톤 */
                    [0,1,2,3].map(i => (
                      <div key={i} className="product-card" style={{ opacity:0.35 }}>
                        <div className="product-card-img" style={{ background:'#F0F0EE' }} />
                        <div className="product-card-body">
                          <div style={{ height:14, background:'#E8E8E6', borderRadius:4, marginBottom:10 }} />
                          <div style={{ height:18, background:'#E8E8E6', borderRadius:4, marginBottom:8, width:'80%' }} />
                          <div style={{ height:20, background:'#E8E8E6', borderRadius:4, width:'60%' }} />
                        </div>
                      </div>
                    ))
                  : Array.from({ length: Math.ceil(pickProds.length / 3) }, (_, pi) => (
                      <div key={pi} className="pick-page">
                        {pickProds.slice(pi * 3, pi * 3 + 3).map(p => {
                          const icon      = CAT_ICONS[p.category] || '🍑';
                          const bg        = CAT_BG[p.category]    || '#F4EFE6';
                          const basePrice = p.discounted_price ?? p.price;
                          return (
                            <div key={p.id} className="product-card"
                              onClick={() => router.push(`/product/${p.id}`)}>
                              <div className="product-card-img" style={{ background: bg }}>
                                {p.thumbnail_url
                                  ? <img src={p.thumbnail_url} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                  : <div className="fruit-emoji">{icon}</div>
                                }
                                <span className={`product-card-delivery ${p.is_dawn ? 'tag-dawn' : 'tag-regular'}`}>
                                  {p.is_dawn ? '산지직송' : '자사배송'}
                                </span>
                                <button className="pick-mob-cart" aria-label="담기" onClick={e => {
                                  e.stopPropagation();
                                  openOptionDrawer(p.id);
                                }}>
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                                    <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>
                                    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 001.95 1.53h9.58a2 2 0 001.95-1.53l1.54-8.42H5.05"/>
                                  </svg>
                                </button>
                                <div className="product-card-actions">
                                  <button className="product-card-wish" onClick={e => handlePickWish(e, p.id)}>
                                    <span className="wish-icon" style={{ color: pickWishedIds.has(p.id) ? '#E53935' : undefined }}>{pickWishedIds.has(p.id) ? '♥' : '♡'}</span> 찜
                                  </button>
                                  <span className="product-card-actions-divider" />
                                  <button className="cart-btn" onClick={e => {
                                    e.stopPropagation();
                                    openOptionDrawer(p.id);
                                  }}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                                      <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>
                                      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 001.95 1.53h9.58a2 2 0 001.95-1.53l1.54-8.42H5.05"/>
                                    </svg> 담기
                                  </button>
                                </div>
                              </div>
                              <div className="product-card-body">
                                <span className={`pick-mob-badge ${p.is_dawn ? 'tag-dawn' : 'tag-regular'}`}>
                                  {p.is_dawn ? '산지직송' : '자사배송'}
                                </span>
                                <div className="product-brix-wrap">
                                  {p.is_new  && <span className="product-badge badge-new">NEW</span>}
                                  {p.is_best && !p.is_new && <span className="product-badge badge-best">인기</span>}
                                </div>
                                <div className="product-card-name">{p.name}</div>
                                {p.short_desc && <div className="product-card-desc">{p.short_desc}</div>}
                                <div className="product-price-row">
                                  {p.discount_rate > 0 && <span className="price-discount">{p.discount_rate}%</span>}
                                  <span className="price-current">{basePrice.toLocaleString()}원</span>
                                  {p.discount_rate > 0 && <span className="price-original">{p.price.toLocaleString()}원</span>}
                                </div>
                                {p.avg_rating > 0 && (
                                  <div className="product-rating-row">
                                    <div className="rating-stars">
                                      <StarRating rating={p.avg_rating} size={12} />
                                      <span>{p.avg_rating.toFixed(1)} ({p.review_count.toLocaleString()})</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))
                }
              </div>
            </div>
            {/* 좌우 화살표 — 상품 5개 이상일 때만 */}
            {pickProds.length > 4 && (
              <>
                <PickSectionArrow dir="prev" visible={pickIndex > 0}
                  onClick={() => setPickIndex(i => Math.max(0, i - 1))} />
                <PickSectionArrow dir="next" visible={pickIndex < pickProds.length - 4}
                  onClick={() => setPickIndex(i => Math.min(pickProds.length - 4, i + 1))} />
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── 퀵 가이드 ── */}
      <QuickGuide />

      {/* ── 브랜드 직송관 ── */}
      <section className="brand-direct-section" id="section-brand">
        <div className="container">
          <div className="g-section-head">
            <h2 className="g-section-title">
              <small>믿을 수 있는 농가에서 직접 보냅니다</small>
              <div className="g-title-main">
                <Link href="/brand-intro" style={{ textDecoration:'none', color:'inherit' }}>브랜드 직송관</Link>
                <Link href="/brand-intro" className="g-section-link">전체보기</Link>
              </div>
            </h2>
          </div>
          <div className="brand-direct-grid">
            {brandCards.map((b, i) => (
              <div key={i} className="brand-direct-card">
                <div className="bdc-banner-wrap">
                  <div className={`bdc-banner ${b.banner}`}>
                    <span className="bdc-emoji">{b.emoji}</span>
                  </div>
                </div>
                <div className="bdc-body">
                  <Link href={b.brandHref} className="bdc-brand-row">
                    <div className={`bdc-brand-logo ${b.logo}`}><span>{b.emoji}</span></div>
                    <span className="bdc-brand-name">{b.brand}</span>
                    <svg className="bdc-arrow" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </Link>
                  <Link href={productHref(b.catHref, b.prodName)} className="bdc-product-row">
                    <div className={`bdc-product-thumb ${b.logo.replace('logo','thumb')}`}>{b.emoji}</div>
                    <div className="bdc-product-info">
                      <div className="bdc-product-name">{b.prodName}</div>
                      <div className="bdc-product-price"><span className="bdc-discount">{b.discount}%</span> {b.prodPrice}</div>
                    </div>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 중간 배너 ── */}
      <MidBanner />

      {/* ── 리뷰 하이라이트 ── */}
      <section className="review-section" id="section-review">
        <div className="container">
          <div className="g-section-head">
            <h2 className="g-section-title">
              <small>실제 구매 고객이 찍은 사진 리뷰</small>
              <div className="g-title-main">
                <span>리뷰 하이라이트</span>
                <Link href="/review" className="g-section-link">전체 리뷰</Link>
              </div>
            </h2>
          </div>
          <div className="review-scroll-wrap">
            <button className="review-nav-btn prev" onClick={() => reviewScrollRef.current && smoothScroll(reviewScrollRef.current, -265)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22" style={{ transform:'translateX(-1px)' }}><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button className="review-nav-btn next" onClick={() => reviewScrollRef.current && smoothScroll(reviewScrollRef.current, 265)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22" style={{ transform:'translateX(1px)' }}><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <div className="review-scroll" ref={reviewScrollRef}>
              {reviews.map((r, i) => (
                <div key={i} className="review-card">
                  {/* 이미지 + 리뷰 텍스트 → 리뷰 상세 */}
                  <Link href={r.reviewHref} className="review-card-top" style={{ textDecoration:'none', color:'inherit', display:'flex', flexDirection:'column', flex:1, minHeight:0 }}>
                    <div className={`review-photo ${r.photo}`}>{r.emoji}</div>
                    <div className="review-body">
                      <div className="review-stars"><StarRating rating={r.stars} size={14} /></div>
                      <div className="review-text">{r.text}</div>
                    </div>
                  </Link>
                  {/* 상품 정보 → 상품 상세 페이지 */}
                  <Link href={productHref(r.prodHref, r.prodName)} className="review-footer review-footer-link" style={{ textDecoration:'none', color:'inherit' }}>
                    <div className={`review-prod-icon ${r.photo}`}>{r.emoji}</div>
                    <div className="review-prod-info">
                      <div className="review-prod-name">{r.prodName}</div>
                      <div className="review-prod-rating"><SingleStar size={12} />{r.prodRating}</div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 델리오 라운지 ── */}
      <section className="lounge-section" id="section-lounge">
        <div className="container">
          <div className="g-section-head">
            <h2 className="g-section-title">
              <small>이번 주 주목할 만한 소식</small>
              <div className="g-title-main"><span>델리오 라운지</span></div>
            </h2>
          </div>
          <div className="lounge-grid">
            {loungePosts.length === 0
              ? /* 로딩 스켈레톤 */
                [0, 1, 2].map(i => (
                  <div key={i} className="lounge-card" style={{ pointerEvents: 'none' }}>
                    <div className="lounge-card-img" style={{ background: '#F0F0EE', opacity: 0.4 }} />
                    <div style={{ height: 22, background: '#E8E8E6', borderRadius: 4, marginBottom: 8, opacity: 0.4 }} />
                    <div style={{ height: 16, background: '#E8E8E6', borderRadius: 4, width: '60%', opacity: 0.4 }} />
                  </div>
                ))
              : loungePosts.map(post => (
                  <Link key={post.id} href={`/lounge/${post.id}`} className="lounge-card">
                    <div className="lounge-card-img" style={{ background: post.bg }}>
                      {post.thumbnail_url
                        ? <img src={post.thumbnail_url} alt={post.title} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                        : post.emoji}
                    </div>
                    <div className="lounge-card-title">{post.title}</div>
                    <div className="lounge-card-desc">{post.badge}</div>
                  </Link>
                ))
            }
          </div>
          <Link href="/lounge" className="lounge-more-btn">라운지 전체보기 &nbsp;›</Link>
        </div>
      </section>

      {/* ── 취향찾기 CTA ── */}
      <section className="survey-cta-section">
        <div className="container">
          <div className="survey-cta-inner">
            <div className="survey-cta-icon">🍑</div>
            <h2 className="survey-cta-title">
              내 취향찾기<br />
              <span className="survey-cta-sub">과일을 찾아보세요</span>
            </h2>
            <p className="survey-cta-desc">짧은 설문으로 당신의 입맛을 분석하고<br />델리오가 직접 과일을 추천해드립니다.</p>
            <div className="survey-cta-btns">
              <Link href="/survey" className="btn btn-primary survey-cta-btn">취향 설문 시작하기</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── 푸터 ── */}
      <footer className="site-footer">
        <div className="container">
          {/* 로고 (맨 위 단독) */}
          <div className="footer-logo" style={{ marginBottom:28 }}>
            <img src="/DelioLogo.png" alt="Delio" style={{ height:48, width:'auto', display:'block', objectFit:'contain' }} />
          </div>

          {/* 사업자정보 | 고객센터 | 입금계좌 (같은 높이 박스, 내용 위아래 꽉) */}
          <div className="footer-top" style={{ display:'grid', gridTemplateColumns:'1.9fr 1fr 1fr', gap:48, paddingBottom:40, alignItems:'stretch' }}>
            {/* 사업자 정보 */}
            <div className="footer-biz" style={{ display:'flex', flexDirection:'column', justifyContent:'space-between', fontSize:13.5, color:'#888', lineHeight:1.9 }}>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <div>상호명 : 델리오 &nbsp;&nbsp;|&nbsp;&nbsp; 대표 : 송민창</div>
                <div>주소 : 경기도 고양시 덕양구 용현로3, 714호</div>
                <div>사업자등록번호 : 288-12-02921 &nbsp;&nbsp;|&nbsp;&nbsp; 통신판매업신고 : 신청 중</div>
                <div>개인정보보호책임자 : 송민창 (deli_o@naver.com)</div>
              </div>
              <div style={{ color:'#c0c0c0', fontSize:13 }}>© 델리오. All rights reserved.</div>
            </div>

            {/* 고객센터 */}
            <div style={{ display:'flex', flexDirection:'column', justifyContent:'space-between', fontSize:13.5, color:'#999', lineHeight:1.9 }}>
              <div style={{ fontWeight:700, color:'#1A1A1A', fontSize:15 }}>고객센터</div>
              <div className="footer-cs-tel" style={{ fontSize:28, fontWeight:800, color:'#1A1A1A', letterSpacing:'-0.5px' }}>031-987-0825</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <div>운영시간 : 평일 09:00 ~ 18:00</div>
                <div>토·일·공휴일은 운영하지 않습니다.</div>
                <div>이메일 : deli_o@naver.com</div>
              </div>
            </div>

            {/* 입금 계좌 */}
            <div style={{ display:'flex', flexDirection:'column', justifyContent:'space-between', fontSize:13.5, color:'#999', lineHeight:1.9 }}>
              <div style={{ fontWeight:700, color:'#1A1A1A', fontSize:15 }}>입금 계좌안내</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <div>국민은행 253401-04-398102</div>
                <div>예금주 : (주)델리오 송민창</div>
              </div>
              <div style={{ display:'inline-block', alignSelf:'flex-start', background:'#F3F3F1', color:'#666', fontSize:13, padding:'9px 16px', borderRadius:6 }}>
                입금 시 주문자 성함 기재
              </div>
            </div>
          </div>

          {/* 하단: 정책 링크 + SNS */}
          <div className="footer-bottom-bar" style={{ borderTop:'1px solid #EBEBEB', paddingTop:26, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div className="footer-policy-links" style={{ display:'flex', gap:28, fontSize:13.5, fontWeight:500, color:'#444' }}>
              <a href="#" style={{ color:'#444', textDecoration:'none' }}>개인정보처리방침</a>
              <a href="#" style={{ color:'#444', textDecoration:'none' }}>이용약관</a>
              <Link href="/refund-policy" style={{ color:'#444', textDecoration:'none' }}>취소/환불정책</Link>
              <Link href="/faq" style={{ color:'#444', textDecoration:'none' }}>자주 묻는 질문</Link>
            </div>
            <div className="footer-sns" style={{ display:'flex', gap:16, alignItems:'center', color:'#bbb' }}>
              <a href="#" style={{ color:'#bbb' }} title="인스타그램">
                <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
              </a>
              <a href="#" style={{ color:'#bbb' }} title="유튜브">
                <svg viewBox="0 0 24 24" width="23" height="23" fill="currentColor"><path d="M23 12s0-3.5-.45-5.16a2.6 2.6 0 00-1.83-1.84C19.06 4.55 12 4.55 12 4.55s-7.06 0-8.72.45A2.6 2.6 0 001.45 6.84C1 8.5 1 12 1 12s0 3.5.45 5.16a2.6 2.6 0 001.83 1.84c1.66.45 8.72.45 8.72.45s7.06 0 8.72-.45a2.6 2.6 0 001.83-1.84C23 15.5 23 12 23 12zM9.75 15.27V8.73L15.5 12z"/></svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
