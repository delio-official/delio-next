'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { openOptionDrawer } from '@/lib/cart';
import { isWishlisted, toggleWishlist } from '@/lib/wishlist';
import '@/styles/category.css';
import { SingleStar } from '@/components/StarRating';

/* ── 타입 ── */
interface Product {
  id: string;
  name: string;
  origin: string;
  category: string;
  price: number;
  discount_rate: number;
  discounted_price: number;
  thumbnail_url: string | null;
  badge: string | null;
  short_desc: string | null;
  is_new: boolean;
  is_best: boolean;
  is_dawn: boolean;
  avg_rating: number;
  review_count: number;
  brix: number | null;
  farm_id: string | null;
}

/* ── 카테고리 탭 ── */
const CAT_TABS = [
  { value: '', label: '전체' },
  { value: 'apple',  label: '🍎 사과/배' },
  { value: 'citrus', label: '🍊 감귤' },
  { value: 'berry',  label: '🫐 베리류' },
  { value: 'melon',  label: '🍈 멜론/참외' },
  { value: 'kiwi',   label: '🥝 키위' },
  { value: 'mango',  label: '🥭 망고' },
  { value: 'grape',  label: '🍇 포도' },
  { value: 'gift',   label: '🎁 선물세트' },
];

const SORT_OPTS = [
  { value: '',           label: '추천순' },
  { value: 'best',       label: '베스트순' },
  { value: 'price_asc',  label: '낮은 가격순' },
  { value: 'price_desc', label: '높은 가격순' },
  { value: 'new',        label: '신상품순' },
  { value: 'review',     label: '리뷰 많은 순' },
];

const ITEMS_PER_PAGE = 12;

const EMOJI_MAP: Record<string, string> = {
  apple:'🍎', citrus:'🍊', berry:'🫐', melon:'🍈',
  kiwi:'🥝', mango:'🥭', grape:'🍇', gift:'🎁', default:'🍑',
};
const BG_MAP: Record<string, string> = {
  apple:'#FFE8E8', citrus:'#FFF3E0', berry:'#F3E5F5', melon:'#E8F5E9',
  kiwi:'#F1F8E9', mango:'#FFF9E6', grape:'#EDE7F6', gift:'#E8EAF6',
};

function fmtPrice(n: number) { return n.toLocaleString('ko-KR'); }

/* ── 상품 카드 ── */
function ProductCard({ p }: { p: Product }) {
  const emoji = EMOJI_MAP[p.category] || EMOJI_MAP.default;
  const bg    = BG_MAP[p.category]   || '#F4EFE6';
  const deliveryClass = p.is_dawn ? 'tag-dawn' : 'tag-regular';
  const deliveryLabel = p.is_dawn ? '산지직송' : '자사배송';
  const [wished, setWished] = useState(false);

  useEffect(() => {
    isWishlisted(p.id).then(setWished);
  }, [p.id]);

  function handleCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    openOptionDrawer(p.id);
  }

  async function handleWish(e: React.MouseEvent) {
    e.preventDefault();
    const next = await toggleWishlist(p.id);
    setWished(next);
  }

  const reviewCount = p.review_count > 9999
    ? (p.review_count / 10000).toFixed(1) + '만'
    : p.review_count.toLocaleString('ko-KR');

  return (
    <Link href={`/product/${p.id}`} className="product-card">
      {/* 이미지 영역 */}
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

      {/* 카드 본문 */}
      <div className="product-card-body">
        <div className="product-brix-wrap">
          {p.is_new  && <span className="product-badge badge-new">NEW</span>}
          {p.is_best && !p.is_new && <span className="product-badge badge-best">인기</span>}
        </div>
        <div className="product-card-name">{p.name}</div>
        {p.short_desc && <div className="product-card-desc">{p.short_desc}</div>}
        <div className="product-price-row">
          {p.discount_rate > 0 && <span className="price-discount">{p.discount_rate}%</span>}
          <span className="price-current">{fmtPrice(p.discounted_price ?? p.price)}원</span>
          {p.discount_rate > 0 && <span className="price-original">{fmtPrice(p.price)}원</span>}
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

/* ── 페이지네이션 ── */
function Pagination({ total, perPage, page, onChange }: {
  total: number; perPage: number; page: number; onChange: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / perPage);
  if (totalPages <= 1) return null;
  function go(p: number) {
    onChange(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  return (
    <div className="pagination">
      <button className="page-btn" disabled={page === 0} onClick={() => go(0)}>«</button>
      <button className="page-btn" disabled={page === 0} onClick={() => go(page - 1)}>‹</button>
      {Array.from({ length: totalPages }, (_, i) => (
        <button key={i} className={`page-num${page === i ? ' active' : ''}`} onClick={() => go(i)}>
          {i + 1}
        </button>
      ))}
      <button className="page-btn" disabled={page === totalPages - 1} onClick={() => go(page + 1)}>›</button>
      <button className="page-btn" disabled={page === totalPages - 1} onClick={() => go(totalPages - 1)}>»</button>
    </div>
  );
}

/* ── 메인 컴포넌트 ── */
export default function CategoryClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const catParam   = sp.get('cat') || '';
  const originParam = sp.get('origin') || '';
  const sortParam  = sp.get('sort') || '';
  const newParam   = sp.get('new') === 'true';

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOpen, setSortOpen] = useState(false);
  const [page, setPage] = useState(0);

  /* 현재 정렬 라벨 */
  const sortLabel = SORT_OPTS.find(o => o.value === sortParam)?.label || '정렬';

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    let q = supabase.from('products').select('*').eq('is_active', true);

    if (catParam)    q = q.eq('category', catParam);
    if (originParam) q = q.eq('origin', originParam);
    if (newParam)    q = q.eq('is_new', true);

    switch (sortParam) {
      case 'best':       q = q.order('is_best', { ascending: false }).order('sort_order'); break;
      case 'price_asc':  q = q.order('discounted_price', { ascending: true }); break;
      case 'price_desc': q = q.order('discounted_price', { ascending: false }); break;
      case 'new':        q = q.order('created_at', { ascending: false }); break;
      case 'review':     q = q.order('review_count', { ascending: false }); break;
      default:           q = q.order('sort_order');
    }

    const { data } = await q.limit(200);
    setProducts((data as Product[]) || []);
    setLoading(false);
  }, [catParam, originParam, sortParam, newParam]);

  useEffect(() => { loadProducts(); }, [loadProducts]);
  /* 필터/정렬 바뀌면 첫 페이지로 리셋 */
  useEffect(() => { setPage(0); }, [catParam, originParam, sortParam, newParam]);

  function setSort(val: string) {
    const p = new URLSearchParams(sp.toString());
    if (val) p.set('sort', val); else p.delete('sort');
    router.push(`/category?${p.toString()}`);
    setSortOpen(false);
  }

  /* 카테고리 변경 — origin(국산/수입) · new(신상품) 모두 유지 */
  function setCat(val: string) {
    const p = new URLSearchParams();
    if (val) p.set('cat', val);
    if (originParam) p.set('origin', originParam);
    if (newParam)    p.set('new', 'true');
    if (sortParam)   p.set('sort', sortParam);
    router.push(`/category?${p.toString()}`);
  }

  /* 신상품 전용 탭 — origin/cat 초기화 */
  function setNew() {
    const p = new URLSearchParams();
    p.set('new', 'true');
    if (sortParam) p.set('sort', sortParam);
    router.push(`/category?${p.toString()}`);
  }

  return (
    <>
      {/* ── 모바일 뷰 ── */}
      <div className="mob-product-view active">
        <div className="mob-pv-filter">
          {CAT_TABS.map(tab => (
            <button key={tab.value}
              className={`mob-pv-chip${catParam === tab.value ? ' active' : ''}`}
              onClick={() => setCat(tab.value)}>
              {tab.label}
            </button>
          ))}
          <button
            className={`mob-pv-chip mob-pv-chip-new${newParam ? ' active' : ''}`}
            onClick={() => setNew()}>
            ✨ 신상품
          </button>
        </div>

        <div className="mob-pv-result-bar">
          <span>총 {products.length}개</span>
          <select className="mob-pv-sort" value={sortParam}
            onChange={e => setSort(e.target.value)}>
            {SORT_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="mob-pv-grid">
          {loading
            ? Array(6).fill(0).map((_, i) => <div key={i} className="product-card product-card-skeleton" />)
            : products.map(p => <ProductCard key={p.id} p={p} />)
          }
        </div>
      </div>

      {/* ── PC 뷰 ── */}
      <div className="pc-product-view">
        <div className="container pc-cat-container">

          {/* 카테고리 탭 */}
          <div className="pc-cat-tabs">
            {CAT_TABS.map(tab => (
              <a key={tab.value}
                className={`pc-cat-tab${catParam === tab.value ? ' active' : ''}`}
                href="#" onClick={e => { e.preventDefault(); setCat(tab.value); }}>
                {tab.label}
              </a>
            ))}
            {/* 신상품 — 구분선 후 별도 배치 */}
            <span className="pc-cat-tab-sep" />
            <a
              className={`pc-cat-tab pc-cat-tab-new${newParam ? ' active' : ''}`}
              href="#" onClick={e => { e.preventDefault(); setNew(); }}>
              ✨ 신상품
            </a>
          </div>

          {/* 필터 바 */}
          <div className="pc-filter-bar">
            <span className="result-count">총 {products.length}개</span>

            <div className={`custom-select${sortOpen ? ' open' : ''}`} style={{ marginLeft: 'auto' }}>
              <button className="custom-select-btn" onClick={() => setSortOpen(v => !v)}>
                <span>{sortLabel}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              <ul className="custom-select-list">
                {SORT_OPTS.map(o => (
                  <li key={o.value}
                    className={`custom-select-item${sortParam === o.value ? ' selected' : ''}`}
                    onClick={() => setSort(o.value)}>
                    {o.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 상품 그리드 */}
          {(() => {
            const paged = products.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);
            return (
              <>
                <div className="product-grid">
                  {loading
                    ? Array(8).fill(0).map((_, i) => <div key={i} className="product-card product-card-skeleton" style={{ height: 320 }} />)
                    : products.length === 0
                      ? <p style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 0', color: '#999' }}>상품이 없습니다.</p>
                      : paged.map(p => <ProductCard key={p.id} p={p} />)
                  }
                </div>
                <Pagination total={products.length} perPage={ITEMS_PER_PAGE} page={page} onChange={setPage} />
              </>
            );
          })()}
        </div>
      </div>
    </>
  );
}
