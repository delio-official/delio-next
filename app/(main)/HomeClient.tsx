'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { addToCart } from '@/lib/cart';
import '@/styles/index.css';
import { StarRating, SingleStar } from '@/components/StarRating';

/* ===== 메인 배너 데이터 ===== */
const MAIN_SLIDES = [
  { bg: 'linear-gradient(135deg,#FCE8E6,#F5C5C1)', color: '#3A1010', eyebrow: 'MAY SPECIAL', title: '5월 가정의 달\n선물 프로모션', sub: '선물세트 20% 기본할인 + 10% 추가쿠폰', deco: '🎁', href: '/category?cat=gift' },
  { bg: 'linear-gradient(135deg,#F5E8D0,#EDD9B8)', color: '#3A2810', eyebrow: "TODAY'S BRIX", title: '오늘의 당도 1위\n골드키위 18 brix', sub: '압도적 크기 · 47% 할인 · 새벽배송 가능', deco: '🥝', href: '/category?cat=kiwi' },
  { bg: 'linear-gradient(135deg,#F0E8FF,#DDD0F5)', color: '#2A1040', eyebrow: 'NEW MEMBER', title: '신규 회원\n5,000원 할인쿠폰', sub: '친구 추천 시 양쪽 모두 쿠폰 즉시 지급', deco: '🍊', href: '/signup' },
  { bg: 'linear-gradient(135deg,#E8F5E9,#C8E6C9)', color: '#1B3A20', eyebrow: 'FRESH PICK', title: '수확 당일 발송\n신선도 보장', sub: '산지 직계약 · 냉장 새벽배송 · 당일 컷', deco: '🍃', href: '/category' },
  { bg: 'linear-gradient(135deg,#EDE7F6,#D1C4E9)', color: '#2A1050', eyebrow: 'BRIX CERTIFIED', title: '당도 인증\n샤인머스캣', sub: '영천 직계약 농가 · 17.2 brix 보장', deco: '🍇', href: '/category?cat=grape' },
];

/* ===== 중간 배너 데이터 ===== */
const MID_SLIDES = [
  { bg: 'linear-gradient(to right,#F4F0E8,#EDE8DC)', color: '#1A1A1A', tag: "DELIO'S PICK · 이번 주 추천", title: '건강한 달콤함의 정점\n영천 샤인머스캣으로 가볍게', desc: '당도 17.2 brix 보장 · 씨없는 청포도의 왕 · 경북 직계약 농가', cta: '지금 구매하기 ›', href: '/category?cat=grape', emoji: '🍇' },
  { bg: 'linear-gradient(to right,#FFF8E7,#FFF0C0)', color: '#2A2000', tag: "BRIX CERTIFIED · 당도 보장", title: '제스프리 공식 수입\n골드키위 18 brix 보장', desc: '뉴질랜드 직수입 · 당도 미달 시 전액 환불', cta: '구매하러 가기 ›', href: '/category?cat=kiwi', emoji: '🥝' },
  { bg: 'linear-gradient(to right,#FEF0F0,#FDDEDE)', color: '#3A0000', tag: "MAY FESTIVAL · 가정의 달", title: '선물세트 최대 30% 할인\n예쁜 포장 + 새벽배송', desc: '어버이날 · 스승의 날 · 생일 선물 · 당일 발송', cta: '선물 고르기 ›', href: '/category?cat=gift', emoji: '🎁' },
  { bg: 'linear-gradient(to right,#EEF5FF,#D8E9FF)', color: '#0A1A40', tag: "PARTNER FARM · 직계약 농가", title: '산지에서 문 앞까지\n24시간 내 새벽배송', desc: '서귀포 감귤농원 · 영천포도원 · 고성블루팜', cta: '브랜드 직송관 ›', href: '/category?origin=direct', emoji: '🚚' },
];

/* ===== 상품 인터페이스 ===== */
interface PickProduct {
  id: string; name: string; price: number; discounted_price: number;
  discount_rate: number; brix: number | null; is_dawn: boolean;
  avg_rating: number; review_count: number; short_desc: string | null;
  thumbnail_url: string | null; category: string;
}
interface QGProduct {
  id: string; name: string; price: number; discounted_price: number;
  discount_rate: number; brix: number | null; is_dawn: boolean;
  thumbnail_url: string | null; category: string;
}

const CAT_ICONS: Record<string, string> = { apple: '🍎', citrus: '🍊', berry: '🫐', melon: '🍈', kiwi: '🥝', mango: '🥭', grape: '🍇', gift: '🎁', best: '🌟', dawn: '🚚' };
const CAT_BG: Record<string, string> = { apple: '#FFE8E8', citrus: '#FFF3E0', berry: '#F3E5F5', melon: '#E8F5E9', kiwi: '#F1F8E9', mango: '#FFF9E6', grape: '#EDE7F6', gift: '#E8EAF6', best: '#FFF9E6', dawn: '#E8F5E9' };

/* ===== 배너 화살표 ===== */
function BannerArrow({ dir, visible, onClick }: { dir: 'prev' | 'next'; visible: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const style: React.CSSProperties = {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    zIndex: 100, width: 55, height: 55,
    background: hovered ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.3)',
    color: '#fff', border: 'none', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'opacity .5s, background .15s',
    opacity: visible ? 1 : 0,
    ...(dir === 'prev'
      ? { left: 'max(8px, calc((100vw - 1200px)/2 + 8px))' }
      : { right: 'max(8px, calc((100vw - 1200px)/2 + 8px))' }),
  };
  return (
    <button style={style} onClick={onClick}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {dir === 'prev'
        ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="24" height="24"><polyline points="15 18 9 12 15 6" /></svg>
        : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="24" height="24"><polyline points="9 18 15 12 9 6" /></svg>}
    </button>
  );
}

/* ===== 메인 배너 ===== */
function MainBanner() {
  const CLONES = 2;
  const TOTAL = MAIN_SLIDES.length;
  const allSlides = [...MAIN_SLIDES.slice(-CLONES), ...MAIN_SLIDES, ...MAIN_SLIDES.slice(0, CLONES)];

  const trackRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const curRef = useRef(CLONES);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transitioning = useRef(false);
  const [curIdx, setCurIdx] = useState(CLONES);
  const [bannerHovered, setBannerHovered] = useState(false);

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
    const real = (cur - CLONES + TOTAL) % TOTAL;
    setCurIdx(cur);
    if (fillRef.current) {
      const pct = 100 / TOTAL;
      fillRef.current.style.left = `${real * pct}%`;
      fillRef.current.style.width = `${pct}%`;
    }
  }, [CLONES, TOTAL]);

  const snapTo = useCallback((idx: number) => {
    curRef.current = idx;
    setPos(idx, false);
    updateProgress(idx);
  }, [setPos, updateProgress]);

  const go = useCallback((next: number) => {
    if (transitioning.current) return;
    if (next >= TOTAL + CLONES) { snapTo(curRef.current - TOTAL); next = curRef.current + 1; }
    transitioning.current = true;
    curRef.current = next;
    setPos(next, true);
    updateProgress(next);
  }, [TOTAL, CLONES, snapTo, setPos, updateProgress]);

  const startTimer = useCallback(() => { timerRef.current = setInterval(() => go(curRef.current + 1), 4500); }, [go]);
  const stopTimer  = useCallback(() => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  useEffect(() => {
    setPos(CLONES, false); updateProgress(CLONES); startTimer();
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
  }, [CLONES, TOTAL, setPos, updateProgress, startTimer, stopTimer, snapTo]);

  useEffect(() => {
    const onResize = () => setPos(curRef.current, false);
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, [setPos]);

  return (
    <div className="main-banner" id="mainBanner">
      <div className="main-banner-inner" onMouseEnter={() => setBannerHovered(true)} onMouseLeave={() => setBannerHovered(false)}>
        <div className="main-banner-clip">
          <div className="main-banner-track" ref={trackRef}>
            {allSlides.map((s, i) => (
              <div key={i}
                className={`main-banner-slide${(i === curIdx || i === curIdx + 1) ? ' slide-active' : ''}`}
                style={{ background: s.bg, color: s.color }}>
                <div className="bs-content">
                  <div className="bs-eyebrow">{s.eyebrow}</div>
                  <div className="bs-title">{s.title.split('\n').map((line, j) => (
                    <span key={j}>{line}{j < s.title.split('\n').length - 1 && <br />}</span>
                  ))}</div>
                  <div className="bs-sub">{s.sub}</div>
                  <Link href={s.href} className="bs-btn" style={{ background: s.color, color: '#fff' }}>지금 보기 →</Link>
                </div>
                <div className="bs-deco">{s.deco}</div>
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

  useEffect(() => {
    let cancelled = false;
    async function fetchQG() {
      setLoading(true);
      const supabase = createClient();
      let q = supabase
        .from('products')
        .select('id,name,price,discounted_price,discount_rate,brix,is_dawn,thumbnail_url,category')
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
        <div className="qg-products">
          {loading ? (
            [0,1,2,3].map(i => (
              <div key={i} className="qg-card" style={{ opacity: 0.35 }}>
                <div className="qg-card-img" style={{ background: '#F0F0EE' }} />
                <div className="qg-card-body">
                  <div style={{ height:12, background:'#E8E8E6', borderRadius:4, marginBottom:8 }} />
                  <div style={{ height:16, background:'#E8E8E6', borderRadius:4, marginBottom:6, width:'80%' }} />
                  <div style={{ height:18, background:'#E8E8E6', borderRadius:4, width:'60%' }} />
                </div>
              </div>
            ))
          ) : items.length === 0 ? (
            <p style={{ gridColumn:'1/-1', textAlign:'center', color:'#bbb', padding:'40px 0' }}>
              해당 카테고리 상품이 없습니다.
            </p>
          ) : items.map(p => {
            const catKey = (activeCat === 'best' || activeCat === 'dawn') ? p.category : activeCat;
            const icon = CAT_ICONS[catKey] || '🍑';
            const bg   = CAT_BG[catKey]   || '#F4EFE6';
            const displayPrice = p.discounted_price ?? p.price;
            return (
              <div key={p.id} className="qg-card" onClick={() => router.push(`/product/${p.id}`)}>
                <div className="qg-card-img" style={{ background: bg }}>
                  {p.thumbnail_url
                    ? <img src={p.thumbnail_url} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    : <span className="qg-card-img-inner">{icon}</span>
                  }
                  <div className="qg-card-actions">
                    <button className="qg-card-wish" onClick={e => e.stopPropagation()}>
                      <span className="wish-icon">♡</span> 찜
                    </button>
                    <span className="qg-card-actions-divider" />
                    <button className="qg-card-cart" onClick={e => {
                      e.stopPropagation();
                      addToCart({ id: p.id, name: p.name, price: displayPrice, quantity: 1, thumbnail: p.thumbnail_url || icon });
                      alert('장바구니에 담겼습니다!');
                    }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                        <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>
                        <path d="M2.05 2.05h2l2.66 12.42a2 2 0 001.95 1.53h9.58a2 2 0 001.95-1.53l1.54-8.42H5.05"/>
                      </svg> 담기
                    </button>
                  </div>
                </div>
                <div className="qg-card-body">
                  <span className="qg-card-tag">{p.is_dawn ? '새벽배송' : '택배배송'}</span>
                  <div className="qg-card-name">{p.name}</div>
                  {p.discount_rate > 0 && (
                    <div className="qg-card-original">{p.price.toLocaleString()}원</div>
                  )}
                  <div className="qg-card-price-row">
                    {p.discount_rate > 0 && <span className="qg-card-discount">{p.discount_rate}%</span>}
                    <span className="qg-card-price">{displayPrice.toLocaleString()}원</span>
                  </div>
                  {p.brix != null && p.brix > 0 && (
                    <div style={{ fontSize:11, color:'var(--color-accent)', fontWeight:700, marginTop:3 }}>
                      🍬 {p.brix} brix
                    </div>
                  )}
                  <div className="qg-card-inline-actions">
                    <button className="qg-card-wish-inline" onClick={e => e.stopPropagation()}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                      </svg>
                    </button>
                    <button className="qg-card-cart-inline" onClick={e => {
                      e.stopPropagation();
                      addToCart({ id: p.id, name: p.name, price: displayPrice, quantity: 1, thumbnail: p.thumbnail_url || icon });
                      alert('장바구니에 담겼습니다!');
                    }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                        <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>
                        <path d="M2.05 2.05h2l2.66 12.42a2 2 0 001.95 1.53h9.58a2 2 0 001.95-1.53l1.54-8.42H5.05"/>
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="qg-card-img qg-card-img-r" style={{ background: bg }}>
                  <span className="qg-card-img-inner">{icon}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ===== 중간 배너 ===== */
function MidBanner() {
  const TOTAL  = MID_SLIDES.length;
  const CLONES = 2;
  const allSlides = [...MID_SLIDES.slice(-CLONES), ...MID_SLIDES, ...MID_SLIDES.slice(0, CLONES)];

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
    setActiveDot((idx - CLONES + TOTAL) % TOTAL);
    void trackRef.current.offsetWidth;
  }, [getStep, CLONES, TOTAL]);

  const go = useCallback((next: number) => {
    if (transitioning.current) return;
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
  }, [CLONES, TOTAL, setPos, startTimer, stopTimer, snapTo]);

  useEffect(() => {
    const onResize = () => setPos(curRef.current, false);
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, [setPos]);

  return (
    <section className="mid-banner-section">
      <div className="container">
        <div className="mid-banner-carousel" id="midBannerCarousel">
          <div className="mid-banner-nav-row">
            <button className="mid-banner-arrow prev" onClick={() => { stopTimer(); go(curRef.current - 1); startTimer(); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div className="mid-banner-pages" ref={pagesRef}>
              <div className="mid-banner-track" ref={trackRef}>
                {allSlides.map((s, i) => (
                  <Link key={i} href={s.href} className="mid-banner-card" style={{ background: s.bg, color: s.color }}>
                    <div className="mid-banner-body">
                      <div className="mid-banner-tag">{s.tag}</div>
                      <div className="mid-banner-title">{s.title.split('\n').map((line, j) => (
                        <span key={j}>{line}{j < s.title.split('\n').length - 1 && <br />}</span>
                      ))}</div>
                      <div className="mid-banner-desc">{s.desc}</div>
                      <span className="mid-banner-cta" style={{ color: s.color }}>{s.cta}</span>
                    </div>
                    <div className="mid-banner-img">{s.emoji}</div>
                  </Link>
                ))}
              </div>
            </div>
            <button className="mid-banner-arrow next" onClick={() => { stopTimer(); go(curRef.current + 1); startTimer(); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18"/></svg>
            </button>
          </div>
          <div className="mid-banner-dots">
            {MID_SLIDES.map((_, i) => (
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

  useEffect(() => {
    async function loadPicks() {
      const supabase = createClient();
      const { data } = await supabase
        .from('products')
        .select('id,name,price,discounted_price,discount_rate,brix,is_dawn,avg_rating,review_count,short_desc,thumbnail_url,category')
        .eq('is_best', true)
        .eq('is_active', true)
        .order('review_count', { ascending: false })
        .limit(4);
      setPickProds((data as PickProduct[]) || []);
    }
    loadPicks();
  }, []);

  const reviews = [
    { photo: 'review-photo-orange', emoji: '🍊', stars: 5, text: '정말 달아요. 이렇게 달콤한 한라봉은 처음 먹어봐요. 당도가 기대 이상이라 가족들이 다 좋아해요.', prodName: '제주 황금 한라봉', prodRating: '4.9 (2,847)' },
    { photo: 'review-photo-grape',  emoji: '🍇', stars: 5, text: '씨도 없고 달기도 너무 달아서 계속 손이 가요. 17.2 brix 보장이라고 했는데 그 이상인 것 같아요.', prodName: '영천 샤인머스캣', prodRating: '4.8 (1,019)' },
    { photo: 'review-photo-kiwi',   emoji: '🥝', stars: 5, text: '골드키위 처음 먹어봤는데 완전 다른 식감이에요. 그린키위보다 훨씬 달고 부드럽네요.', prodName: '제스프리 골드키위', prodRating: '4.9 (1,857)' },
    { photo: 'review-photo-apple',  emoji: '🍎', stars: 5, text: '충주 사과 맞나요? 이렇게 아삭하고 달수가. 매년 이맘때면 꼭 주문하게 될 것 같아요.', prodName: '충주 고당도 부사사과', prodRating: '4.7 (3,204)' },
    { photo: 'review-photo-mango',  emoji: '🥭', stars: 5, text: '태국 애플망고 직수입이라 그런지 신선도가 다르네요. 향도 너무 좋고 당도도 최상입니다.', prodName: '애플망고 (태국산)', prodRating: '4.6 (11)' },
    { photo: 'review-photo-berry',  emoji: '🫐', stars: 4, text: '블루베리가 알도 크고 터질때 달달해요. 냉동으로 먹어도 맛있어서 또 살게요.', prodName: '고성 친환경 블루베리', prodRating: '4.5 (628)' },
    { photo: 'review-photo-melon',  emoji: '🍈', stars: 5, text: '성주 참외 먹고 다른 데 참외는 못 먹겠어요. 아삭한 식감에 과즙이 넘쳐서 정말 맛있어요.', prodName: '성주 황토 참외', prodRating: '4.8 (492)' },
  ];

  const brandCards = [
    { banner:'bdc-banner-citrus', logo:'bdc-logo-citrus', emoji:'🍊', brand:'서귀포 감귤농원', farmSlug:'seogwipo-citrus',   brandHref:'/farm/seogwipo-citrus',   catHref:'/category?cat=citrus', prodName:'당도 보장 한라봉 3kg',         prodPrice:'38,000원', discount:20 },
    { banner:'bdc-banner-grape',  logo:'bdc-logo-grape',  emoji:'🍇', brand:'영천포도원',     farmSlug:'yeongcheon-grape',   brandHref:'/farm/yeongcheon-grape',   catHref:'/category?cat=grape',  prodName:'샤인머스캣 GAP인증 2kg',       prodPrice:'42,000원', discount:10 },
    { banner:'bdc-banner-berry',  logo:'bdc-logo-berry',  emoji:'🫐', brand:'고성 블루팜',    farmSlug:'goseong-bluefarm',   brandHref:'/farm/goseong-bluefarm',   catHref:'/category?cat=berry',  prodName:'무농약 블루베리 500g',          prodPrice:'16,000원', discount:10 },
    { banner:'bdc-banner-apple',  logo:'bdc-logo-apple',  emoji:'🍎', brand:'충주사과마을',   farmSlug:'chungju-apple',       brandHref:'/farm/chungju-apple',     catHref:'/category?cat=apple',  prodName:'[수율보장] 부사사과 프리미엄 5kg', prodPrice:'38,000원', discount:10 },
  ];

  return (
    <>
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
          <div id="pickGrid">
            {pickProds.length === 0 ? (
              /* 로딩 스켈레톤 */
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
            ) : pickProds.map(p => {
              const icon       = CAT_ICONS[p.category] || '🍑';
              const bg         = CAT_BG[p.category]    || '#F4EFE6';
              const basePrice  = p.discounted_price ?? p.price;
              return (
                <div key={p.id} className="product-card" onClick={() => router.push(`/product/${p.id}`)}>
                  <div className="product-card-img" style={{ background: bg }}>
                    {p.thumbnail_url
                      ? <img src={p.thumbnail_url} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      : <div className="fruit-emoji">{icon}</div>
                    }
                    <span className={`product-card-delivery${p.is_dawn ? ' tag-dawn' : ''}`}>
                      {p.is_dawn ? '새벽배송' : '택배배송'}
                    </span>
                    <div className="product-card-actions">
                      <button className="product-card-wish" onClick={e => e.stopPropagation()}>
                        <span className="wish-icon">♡</span> 찜
                      </button>
                      <span className="product-card-actions-divider" />
                      <button className="cart-btn" onClick={e => {
                        e.stopPropagation();
                        addToCart({ id:p.id, name:p.name, price:basePrice, quantity:1, thumbnail:p.thumbnail_url||icon });
                        alert('장바구니에 담겼습니다!');
                      }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                          <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>
                          <path d="M2.05 2.05h2l2.66 12.42a2 2 0 001.95 1.53h9.58a2 2 0 001.95-1.53l1.54-8.42H5.05"/>
                        </svg> 담기
                      </button>
                    </div>
                  </div>
                  <div className="product-card-body">
                    {p.brix != null && p.brix > 0 && (
                      <div className="product-brix-wrap">
                        <span className="product-brix">🍬 {p.brix} brix · {p.is_dawn ? '새벽배송' : '택배배송'}</span>
                      </div>
                    )}
                    <div className="product-card-name">{p.name}</div>
                    {p.short_desc && <div className="product-card-desc">{p.short_desc}</div>}
                    <div className="product-price-row">
                      {p.discount_rate > 0 && <span className="price-original">{p.price.toLocaleString()}원</span>}
                      {p.discount_rate > 0 && <span className="price-discount">{p.discount_rate}%</span>}
                      <span className="price-current">{basePrice.toLocaleString()}원</span>
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
                <span>브랜드 직송관</span>
                <Link href="/category?origin=direct" className="g-section-link">전체보기</Link>
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
                  <Link href={b.catHref} className="bdc-product-row">
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
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button className="review-nav-btn next" onClick={() => reviewScrollRef.current && smoothScroll(reviewScrollRef.current, 265)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <div className="review-scroll" ref={reviewScrollRef}>
              {reviews.map((r, i) => (
                <div key={i} className="review-card">
                  <div className={`review-photo ${r.photo}`}>{r.emoji}</div>
                  <div className="review-body">
                    <div className="review-stars"><StarRating rating={r.stars} size={14} /></div>
                    <div className="review-text">{r.text}</div>
                  </div>
                  <div className="review-footer">
                    <div className={`review-prod-icon ${r.photo}`}>{r.emoji}</div>
                    <div className="review-prod-info">
                      <div className="review-prod-name">{r.prodName}</div>
                      <div className="review-prod-rating"><SingleStar size={12} />{r.prodRating}</div>
                    </div>
                  </div>
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
            <Link href="/lounge?filter=recipe" className="lounge-card">
              <div className="lounge-card-img lounge-img-green">🌿</div>
              <div className="lounge-card-title">2026년 제철 과일 월별 달력</div>
              <div className="lounge-card-desc">지금 먹어야 할 제철 과일 한눈에 확인</div>
            </Link>
            <Link href="/event" className="lounge-card">
              <div className="lounge-card-img lounge-img-red">🎁</div>
              <div className="lounge-card-title">가정의 달, 마음을 전하는 과일 선물 가이드</div>
              <div className="lounge-card-desc">최대 10% 적립 &amp; 추가 할인 쿠폰 증정</div>
            </Link>
            <Link href="/event" className="lounge-card">
              <div className="lounge-card-img lounge-img-orange">🍊</div>
              <div className="lounge-card-title">이벤트 &amp; 쿠폰</div>
              <div className="lounge-card-desc">놓칠 수 없는 알뜰한 소식</div>
            </Link>
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
              <Link href="/category" className="btn btn-secondary survey-cta-btn">전체 상품 보기</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── 푸터 ── */}
      <footer className="site-footer">
        <div className="container">
          <div className="footer-inner">
            <div>
              <div className="footer-logo">Delio</div>
              <p className="footer-desc">
                (주)델리오 · 대표자: 송민창<br />
                사업자등록번호: 123-45-67890<br />
                주소: 서울특별시 강남구 테헤란로 123<br />
                고객센터: 1588-0000 (평일 09~18시)<br />
                이메일: hello@delio.co.kr
              </p>
            </div>
            <div className="footer-links">
              <a href="#">이용약관</a>
              <a href="#">개인정보처리방침</a>
              <Link href="/faq">자주 묻는 질문</Link>
              <a href="#">카카오 채널</a>
              <a href="#">공지사항</a>
            </div>
          </div>
          <div className="footer-bottom">
            © 2026 Delio. All rights reserved. · 통신판매업신고번호: 제2025-서울강남-00000호
          </div>
        </div>
      </footer>
    </>
  );
}
