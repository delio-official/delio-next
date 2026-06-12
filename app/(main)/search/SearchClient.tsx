'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { PRODUCT_PUBLIC_COLS } from '@/lib/productCols';
import { openOptionDrawer } from '@/lib/cart';
import { isWishlisted, toggleWishlist } from '@/lib/wishlist';
import { useLoginGuard } from '@/hooks/useLoginGuard';
import '@/styles/category.css';
import '@/styles/search.css';
import { SingleStar } from '@/components/StarRating';

interface Product {
  id: string; name: string; category: string;
  price: number; discount_rate: number; discounted_price: number;
  thumbnail_url: string | null; badge: string | null;
  is_dawn: boolean; is_best: boolean; avg_rating: number; review_count: number;
  brix: number | null;
}

const EMOJI_MAP: Record<string, string> = {
  apple: '🍎', citrus: '🍊', berry: '🫐', melon: '🍈',
  kiwi: '🥝', mango: '🥭', grape: '🍇', gift: '🎁', default: '🍑',
};
const BG_MAP: Record<string, string> = {
  apple: '#FFE8E8', citrus: '#FFF3E0', berry: '#F3E5F5', melon: '#E8F5E9',
  kiwi: '#F1F8E9', mango: '#FFF9E6', grape: '#EDE7F6', gift: '#E8EAF6',
};

const POPULAR_FALLBACK = ['한라봉', '샤인머스캣', '골드키위', '블루베리', '참외'];
const RECENT_KEY = 'delio_recent_searches';

const SORT_OPTIONS = [
  { id: '',           label: '추천순' },
  { id: 'sales',      label: '판매량순' },
  { id: 'new',        label: '신상품순' },
  { id: 'rating',     label: '평점 높은순' },
  { id: 'price_asc',  label: '가격 낮은순' },
  { id: 'price_desc', label: '가격 높은순' },
  { id: 'sweet_desc', label: '당도 높은순' },
  { id: 'sweet_asc',  label: '당도 낮은순' },
  { id: 'sour_desc',  label: '산도 높은순' },
  { id: 'sour_asc',   label: '산도 낮은순' },
];

function fmtPrice(n: number) { return n.toLocaleString('ko-KR'); }

/* ── 검색 결과 상품 카드 ── */
function SearchProductCard({ p }: { p: Product }) {
  const emoji = EMOJI_MAP[p.category] || EMOJI_MAP.default;
  const bg    = BG_MAP[p.category]   || '#F4EFE6';
  const deliveryClass = p.is_dawn ? 'tag-dawn' : 'tag-regular';
  const deliveryLabel = p.is_dawn ? '산지직송' : '자사배송';
  const [wished, setWished] = useState(false);
  const requireLogin = useLoginGuard();

  useEffect(() => {
    isWishlisted(p.id).then(setWished);
  }, [p.id]);

  const reviewCount = p.review_count > 9999
    ? (p.review_count / 10000).toFixed(1) + '만'
    : p.review_count.toLocaleString('ko-KR');

  function handleCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!requireLogin()) return;
    openOptionDrawer(p.id);
  }

  async function handleWish(e: React.MouseEvent) {
    e.preventDefault();
    if (!requireLogin()) return;
    const next = await toggleWishlist(p.id);
    setWished(next);
  }

  return (
    <Link href={`/product/${p.id}`} className="product-card">
      <div className="product-card-img">
        {p.thumbnail_url
          ? <img src={p.thumbnail_url} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          : <div className="fruit-emoji" style={{ background:`linear-gradient(135deg,${bg} 0%,#fff 100%)` }}>{emoji}</div>
        }
        <span className={`product-card-delivery ${deliveryClass}`}>{deliveryLabel}</span>
        <div className="product-card-actions">
          <button className="product-card-wish" onClick={handleWish}>
            <span style={{ color: wished ? '#E53935' : undefined }}>{wished ? '♥' : '♡'}</span> 찜
          </button>
          <span className="product-card-actions-divider" />
          <button className="cart-btn" onClick={handleCart}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>
              <path d="M2.05 2.05h2l2.66 12.42a2 2 0 001.95 1.53h9.58a2 2 0 001.95-1.53l1.54-8.42H5.05"/>
            </svg>
            담기
          </button>
        </div>
      </div>
      <div className="product-card-body">
        <div className="product-brix-wrap">
          {p.is_best && <span className="product-badge badge-best">인기</span>}
        </div>
        <div className="product-card-name">{p.name}</div>
        <div className="product-price-row">
          {p.discount_rate > 0 && <span className="price-discount">{p.discount_rate}%</span>}
          <span className="price-current">{fmtPrice(p.discounted_price ?? p.price)}원</span>
          {p.discount_rate > 0 && <span className="price-original">{fmtPrice(p.price)}원</span>}
        </div>
        <div>
          <span className={`product-delivery-tag${p.is_dawn ? ' farm' : ''}`}>
            {p.is_dawn ? '산지직송' : '자사배송'}
          </span>
        </div>
        {p.review_count > 0 && (
          <div className="product-rating-row">
            <div className="rating-stars">
              <SingleStar size={13} />
              <span>{p.avg_rating.toFixed(1)}</span>
              <span style={{ color:'#bbb' }}>({reviewCount})</span>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}

function getRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}
function saveRecentKey(q: string): string[] {
  const list = [q, ...getRecent().filter(x => x !== q)].slice(0, 10);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  return list;
}

export default function SearchClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const urlQ = sp.get('q') || '';

  /* ── 검색 전 화면 상태 ── */
  const [inputVal, setInputVal] = useState(urlQ);
  const [autocomplete, setAutocomplete] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const loggedQRef = useRef('');

  /* ── 결과 화면 상태 ── */
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  /* ── 정렬 / 필터 상태 ── */
  const [sortOpen, setSortOpen] = useState(false);
  const [fruitOpen, setFruitOpen] = useState(false);
  const [currentSort, setCurrentSort] = useState('');
  const [filters, setFilters] = useState({
    delivery: false, best: false, discount: false, highRating: false,
  });
  const [fruitFilter, setFruitFilter] = useState({
    brix: 0, sour: 0, priceMin: '', priceMax: '', delivery: 'all',
  });
  const [pendingFruit, setPendingFruit] = useState({
    brix: 0, sour: 0, priceMin: '', priceMax: '', delivery: 'all',
  });

  /* ── 인기 검색어 ── */
  const [popularKeywords, setPopularKeywords] = useState<string[]>(POPULAR_FALLBACK);

  useEffect(() => {
    createClient()
      .from('site_settings').select('value').eq('key', 'popular_keywords').single()
      .then(({ data }) => {
        if (data?.value) {
          const kws = data.value.split(',').map((s: string) => s.trim()).filter(Boolean);
          if (kws.length > 0) setPopularKeywords(kws);
        }
      });
  }, []);

  /* ── 최근검색어 로드 ── */
  useEffect(() => { setRecent(getRecent()); }, []);

  /* ── 검색 실행 ── */
  const doSearch = useCallback(async (
    q: string,
    sort: string,
    f: typeof filters,
    ff: typeof fruitFilter,
    shouldLog = false,
  ) => {
    if (!q.trim()) return;
    setLoading(true);
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let req: any = supabase.from('products').select(PRODUCT_PUBLIC_COLS)
      .eq('is_active', true)
      .ilike('name', `%${q.trim()}%`);

    if (f.delivery)   req = req.eq('is_dawn', true);
    if (f.best)       req = req.eq('is_best', true);
    if (f.discount)   req = req.gt('discount_rate', 0);
    if (f.highRating) req = req.gte('avg_rating', 4.8);
    if (ff.brix > 0)  req = req.gte('seller_score->>sweet', String(ff.brix)); // 당도 N단계 이상 (맛 프로파일)
    if (ff.sour > 0)  req = req.lte('seller_score->>sour',  String(ff.sour)); // 신맛 N단계 이하
    if (ff.priceMin)  req = req.gte('discounted_price', parseInt(ff.priceMin));
    if (ff.priceMax)  req = req.lte('discounted_price', parseInt(ff.priceMax));
    if (ff.delivery === 'dawn')   req = req.eq('is_dawn', true);
    if (ff.delivery === 'normal') req = req.eq('is_dawn', false);

    switch (sort) {
      case 'sales':      req = req.order('review_count',      { ascending: false }); break;
      case 'new':        req = req.order('created_at',        { ascending: false }); break;
      case 'rating':     req = req.order('avg_rating',        { ascending: false }); break;
      case 'price_asc':  req = req.order('discounted_price',  { ascending: true  }); break;
      case 'price_desc': req = req.order('discounted_price',  { ascending: false }); break;
      case 'sweet_desc': req = req.order('seller_score->>sweet', { ascending: false, nullsFirst: false }); break;
      case 'sweet_asc':  req = req.order('seller_score->>sweet', { ascending: true,  nullsFirst: false }); break;
      case 'sour_desc':  req = req.order('seller_score->>sour',  { ascending: false, nullsFirst: false }); break;
      case 'sour_asc':   req = req.order('seller_score->>sour',  { ascending: true,  nullsFirst: false }); break;
      default:           req = req.order('sort_order');
    }

    const { data } = await req.limit(40);
    const results = (data as unknown as Product[]) || [];
    setProducts(results);
    setLoading(false);

    // 새 검색어일 때만 로그 기록 (정렬/필터 변경은 제외)
    if (shouldLog) {
      createClient()
        .from('search_logs')
        .insert({ keyword: q.trim(), result_count: results.length })
        .then(() => {});
    }
  }, []);

  useEffect(() => {
    if (urlQ) {
      setInputVal(urlQ);
      const isNewQuery = urlQ !== loggedQRef.current;
      if (isNewQuery) loggedQRef.current = urlQ;
      doSearch(urlQ, currentSort, filters, fruitFilter, isNewQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlQ, currentSort, filters, fruitFilter]);

  /* ── 자동완성 ── */
  const handleInputChange = useCallback(async (val: string) => {
    setInputVal(val);
    if (!val.trim()) { setAutocomplete([]); return; }
    const supabase = createClient();
    const { data } = await supabase.from('products')
      .select('name').eq('is_active', true)
      .ilike('name', `%${val.trim()}%`).limit(6);
    setAutocomplete((data || []).map((d: { name: string }) => d.name));
  }, []);

  function handleSearch(q: string) {
    if (!q.trim()) return;
    const list = saveRecentKey(q.trim());
    setRecent(list);
    setAutocomplete([]);
    router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  function removeRecent(i: number) {
    const arr = getRecent();
    arr.splice(i, 1);
    localStorage.setItem(RECENT_KEY, JSON.stringify(arr));
    setRecent([...arr]);
  }
  function clearRecent() {
    localStorage.setItem(RECENT_KEY, JSON.stringify([]));
    setRecent([]);
  }

  function toggleFilter(key: keyof typeof filters) {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function openFruitFilter() {
    setPendingFruit({ ...fruitFilter });
    setFruitOpen(true);
  }
  function applyFruitFilter() {
    setFruitFilter({ ...pendingFruit });
    setFruitOpen(false);
  }
  function resetFruitFilter() {
    setPendingFruit({ brix: 0, sour: 0, priceMin: '', priceMax: '', delivery: 'all' });
  }

  const hasFruitFilter =
    fruitFilter.brix > 0 || fruitFilter.sour > 0 ||
    fruitFilter.priceMin !== '' || fruitFilter.priceMax !== '' ||
    fruitFilter.delivery !== 'all';

  const sortLabel = SORT_OPTIONS.find(o => o.id === currentSort)?.label || '추천순';

  /* ════════════════════════════════════════
     검색 전 화면 (pre-search page)
  ════════════════════════════════════════ */
  if (!urlQ) {
    return (
      <main className="search-pre-page">
        <div className="container search-pre-container">

          {/* 히어로 */}
          <div className="search-hero">
            <h1 className="search-hero-title">SEARCH</h1>

            <div className="search-input-wrap">
              <input
                ref={inputRef}
                type="text"
                className="search-main-input"
                placeholder="과일, 산지, 브랜드를 검색해보세요"
                value={inputVal}
                onChange={e => handleInputChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSearch(inputVal); }}
                autoComplete="off"
              />
              {inputVal && (
                <button
                  className="search-clear-btn"
                  style={{ display: 'block' }}
                  onClick={() => { setInputVal(''); setAutocomplete([]); inputRef.current?.focus(); }}
                >×</button>
              )}
              <button className="search-submit-btn" onClick={() => handleSearch(inputVal)}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="22" y2="22" />
                </svg>
              </button>

              {/* 자동완성 */}
              {autocomplete.length > 0 && (
                <div className="search-autocomplete" style={{ display: 'block' }}>
                  <ul className="search-autocomplete-list">
                    {autocomplete.map((item, i) => (
                      <li
                        key={i}
                        onClick={() => handleSearch(item)}
                        style={{ padding: '10px 16px', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--color-ink)', transition: 'background .12s' }}
                        onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = '#F7F6F4'; }}
                        onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = ''; }}
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#AAA" strokeWidth="2" style={{ flexShrink: 0 }}>
                          <circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="22" y2="22" />
                        </svg>
                        <span dangerouslySetInnerHTML={{
                          __html: item.replace(
                            new RegExp(inputVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
                            m => `<strong style="color:var(--color-accent)">${m}</strong>`
                          )
                        }} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* 인기검색어 — 헤더 드롭다운과 동일한 1~10위 순위 목록 */}
            <div className="search-popular-section">
              <div className="search-popular-label">인기검색어</div>
              <div className="search-popular-grid">
                {popularKeywords.map((kw, i) => (
                  <div key={i} className="search-popular-item" onClick={() => handleSearch(kw)}>
                    <span className="search-popular-num" style={{ color: i < 3 ? 'var(--color-accent)' : '#1A1A1A', fontWeight: i < 3 ? 800 : 600 }}>{i + 1}</span>
                    <span className="search-popular-text" style={{ color: '#1A1A1A' }}>{kw}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 최근 검색어 */}
          {recent.length > 0 && (
            <div className="search-recent-section" style={{ display: 'block' }}>
              <div className="search-recent-header">
                <h3 className="search-recent-title">최근 검색어</h3>
                <button onClick={clearRecent} className="search-recent-clear-btn">전체 삭제</button>
              </div>
              <div className="search-recent-pills-wrap">
                {recent.map((kw, i) => (
                  <span
                    key={i}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 999, border: '1px solid #E0DEDB', background: '#fff', fontSize: 13, cursor: 'pointer' }}
                  >
                    <span onClick={() => handleSearch(kw)}>{kw}</span>
                    <span
                      onClick={() => removeRecent(i)}
                      style={{ color: '#AAA', fontSize: 14, marginLeft: 2, cursor: 'pointer' }}
                    >✕</span>
                  </span>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>
    );
  }

  /* ════════════════════════════════════════
     검색 결과 화면 (result page)
  ════════════════════════════════════════ */
  return (
    <>
      <main className="search-result-page" style={{ display: 'block' }}>
        <div className="container search-result-container">

          {/* 결과 헤더 */}
          <div className="search-result-header">
            <p className="search-result-count">
              <strong>&quot;{urlQ}&quot;</strong> 검색결과
              {!loading && <> · <strong>{products.length}</strong>개</>}
            </p>
            <div className="search-filter-wrap">
              <button
                className={`filter-chip-sm${currentSort ? ' active' : ''}`}
                onClick={() => setSortOpen(true)}
              >
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="6" x2="21" y2="6" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="11" y1="18" x2="13" y2="18" />
                </svg>
                {sortLabel}
              </button>
              <button className={`filter-chip-sm${hasFruitFilter ? ' active' : ''}`} onClick={openFruitFilter}>🍊 과일 필터</button>
              <button className={`filter-chip-sm${filters.best ? ' active' : ''}`} onClick={() => toggleFilter('best')}>베스트</button>
              <button className={`filter-chip-sm${filters.discount ? ' active' : ''}`} onClick={() => toggleFilter('discount')}>할인중</button>
              <button className={`filter-chip-sm${filters.highRating ? ' active' : ''}`} onClick={() => toggleFilter('highRating')}>평점 4.8+</button>
            </div>
          </div>

          {/* 상품 그리드 */}
          {loading ? (
            <div className="result-grid">
              {Array(8).fill(0).map((_, i) => (
                <div key={i} style={{ aspectRatio: '0.8', background: '#F0F0EE', borderRadius: 12, animation: 'skeleton-pulse 1.2s ease-in-out infinite alternate' }} />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'70px 0' }}>
              <div style={{ width:48, height:48, borderRadius:'50%', border:'1.5px solid #D8D8D8',
                display:'flex', alignItems:'center', justifyContent:'center', marginBottom:18 }}>
                <span style={{ fontSize:22, fontWeight:300, color:'#B0B0B0' }}>!</span>
              </div>
              <p style={{ fontSize:15, color:'#555', fontWeight:500, lineHeight:1.7, textAlign:'center', margin:0 }}>
                검색결과가 없습니다.<br />
                이용에 불편을 드려 죄송합니다.
              </p>
              <p style={{ color:'#AAA', fontSize:14, marginTop:10 }}>다른 키워드로 검색해보세요</p>
              <div style={{ marginTop: 18, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                {popularKeywords.map(kw => (
                  <button key={kw}
                    onClick={() => handleSearch(kw)}
                    style={{ padding: '6px 12px', border: '1.5px solid var(--color-line)', borderRadius: 999, fontSize: 13, cursor: 'pointer', background: '#fff', color: 'var(--color-ink)' }}
                  >{kw}</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="result-grid">
              {products.map(p => <SearchProductCard key={p.id} p={p} />)}
            </div>
          )}
        </div>
      </main>

      {/* ── 정렬 드로어 ── */}
      <div className={`overlay-bg${sortOpen ? ' show' : ''}`} onClick={() => setSortOpen(false)} />
      <div className={`sort-sheet${sortOpen ? ' open' : ''}`}>
        <div className="sort-sheet-handle" />
        <h3 className="sort-sheet-title">정렬</h3>
        {SORT_OPTIONS.map(o => (
          <div
            key={o.id}
            className={`sort-option${currentSort === o.id ? ' selected' : ''}`}
            onClick={() => { setCurrentSort(o.id); setSortOpen(false); }}
          >
            {o.label}
          </div>
        ))}
      </div>

      {/* ── 과일 특화 필터 드로어 ── */}
      <div className={`overlay-bg${fruitOpen ? ' show' : ''}`} onClick={() => setFruitOpen(false)} />
      <div className={`fruit-filter-sheet${fruitOpen ? ' open' : ''}`}>
        <div className="sort-sheet-handle" />
        <h3 className="fruit-filter-title">🍊 과일 특화 필터</h3>

        <p className="filter-section-title">🍯 당도 최소 단계 <span style={{ fontWeight:400, color:'#94A3B8', fontSize:12 }}>(맛 프로파일)</span></p>
        <div className="filter-range">
          <span className="filter-range-mute">무관</span>
          <input
            type="range" min="0" max="5" step="1"
            value={pendingFruit.brix}
            onChange={e => setPendingFruit(prev => ({ ...prev, brix: parseInt(e.target.value) }))}
          />
          <span className="filter-range-val">
            {pendingFruit.brix === 0 ? '무관' : `${pendingFruit.brix}단계 이상`}
          </span>
        </div>

        <p className="filter-section-title">😌 신맛 낮은 상품만</p>
        <div className="filter-sour-wrap">
          {[{ v: 0, l: '전체' }, { v: 1, l: '신맛 거의 없음' }, { v: 2, l: '신맛 적음' }].map(({ v, l }) => (
            <button
              key={v}
              className={`filter-chip-sm${pendingFruit.sour === v ? ' active' : ''}`}
              onClick={() => setPendingFruit(prev => ({ ...prev, sour: v }))}
            >{l}</button>
          ))}
        </div>

        <p className="filter-section-title">💰 가격 범위</p>
        <div className="price-range-row">
          <input type="number" className="price-input" placeholder="최솟값"
            value={pendingFruit.priceMin}
            onChange={e => setPendingFruit(prev => ({ ...prev, priceMin: e.target.value }))}
          />
          <span className="price-range-sep">~</span>
          <input type="number" className="price-input" placeholder="최댓값"
            value={pendingFruit.priceMax}
            onChange={e => setPendingFruit(prev => ({ ...prev, priceMax: e.target.value }))}
          />
          <span className="price-range-unit">원</span>
        </div>

        <p className="filter-section-title">🚀 배송 방법</p>
        <div className="fruit-filter-chips fruit-filter-chips-mb">
          {[{ v: 'all', l: '전체' }, { v: 'dawn', l: '새벽배송' }, { v: 'normal', l: '일반배송' }].map(({ v, l }) => (
            <button
              key={v}
              className={`filter-chip-sm${pendingFruit.delivery === v ? ' active' : ''}`}
              onClick={() => setPendingFruit(prev => ({ ...prev, delivery: v }))}
            >{l}</button>
          ))}
        </div>

        <div className="filter-action-wrap">
          <button onClick={resetFruitFilter} className="filter-reset-btn">초기화</button>
          <button onClick={applyFruitFilter} className="filter-apply-btn">적용하기</button>
        </div>
      </div>
    </>
  );
}
