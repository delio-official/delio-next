'use client';

import { imgThumb } from '@/lib/img';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { PRODUCT_PUBLIC_COLS_STOCK, withSoldout } from '@/lib/productCols';
import { openOptionDrawer } from '@/lib/cart';
import { isWishlisted, toggleWishlist } from '@/lib/wishlist';
import { useLoginGuard } from '@/hooks/useLoginGuard';
import { useAuth } from '@/hooks/useAuth';
import { SingleStar } from '@/components/StarRating';
import '@/styles/category.css';

interface Farm {
  id: string; slug: string; name: string; region: string; farm_type: string; items?: string[] | null;
  intro: string | null; story: string | null;
  thumbnail_url: string | null; hero_image_url: string | null;
  landing_images: string[] | null;
  farmer_name: string | null; farmer_image_url: string | null;
  founded_year: number | null; altitude: string | null;
  annual_output: string | null;
}
interface Certification { id: string; name: string; issued_by: string | null; issued_date: string | null; }
interface GalleryItem { id: string; image_url: string; caption: string | null; sort_order: number; }
interface Product {
  id: string; name: string; price: number; discount_rate: number;
  discounted_price: number; thumbnail_url: string | null; badge: string | null; badge_color: string | null;
  avg_rating: number; review_count: number; category: string;
  is_dawn: boolean; is_new: boolean; is_best: boolean; short_desc: string | null;
  sort_order: number | null; created_at: string | null;
  sales_count: number | null; sweet_sort: number | null; sour_sort: number | null;
  soldout?: boolean;
}

const FARM_SORT_OPTS = [
  { value: '',           label: '추천순' },
  { value: 'popular',    label: '인기순' },
  { value: 'new',        label: '신상품순' },
  { value: 'price_asc',  label: '낮은 가격순' },
  { value: 'price_desc', label: '높은 가격순' },
  { value: 'sweet_desc', label: '당도 높은순' },
  { value: 'sour_desc',  label: '산도 높은순' },
];

const EMOJI_MAP: Record<string, string> = {
  apple:'🍎', citrus:'🍊', berry:'🫐', melon:'🍈',
  kiwi:'🥝', mango:'🥭', grape:'🍇', gift:'🎁', default:'🍑',
};
function fmtPrice(n: number) { return n.toLocaleString('ko-KR'); }

const BG_MAP: Record<string, string> = {
  apple:'#FFE8E8', citrus:'#FFF3E0', berry:'#F3E5F5', melon:'#E8F5E9',
  kiwi:'#F1F8E9', mango:'#FFF9E6', grape:'#EDE7F6', gift:'#E8EAF6',
};

/* ── 상품 카드 (메인 델리오 픽 / 카테고리와 동일 디자인) ── */
function FarmProductCard({ p }: { p: Product }) {
  const emoji = EMOJI_MAP[p.category] || EMOJI_MAP.default;
  const bg    = BG_MAP[p.category]    || '#F4EFE6';
  const deliveryClass = p.is_dawn ? 'tag-dawn' : 'tag-regular';
  const deliveryLabel = p.is_dawn ? '산지직송' : '자사배송';
  const [wished, setWished] = useState(false);
  const requireLogin = useLoginGuard();
  const router = useRouter();
  useEffect(() => { isWishlisted(p.id).then(setWished); }, [p.id]);

  function handleReviewClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/product/${p.id}?tab=review`);
  }

  const reviewCount = p.review_count > 9999
    ? (p.review_count / 10000).toFixed(1) + '만'
    : p.review_count.toLocaleString('ko-KR');

  return (
    <Link href={`/product/${p.id}`} className="product-card">
      <div className="product-card-img">
        {p.thumbnail_url
          ? <img src={imgThumb(p.thumbnail_url, 400)} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          : <div className="fruit-emoji" style={{ background:`linear-gradient(135deg,${bg} 0%,#fff 100%)` }}>{emoji}</div>
        }
        {p.soldout && <div className="product-card-soldout">품절</div>}
        <span className={`product-card-delivery ${deliveryClass}`}>{deliveryLabel}</span>
        <div className="product-card-actions">
          <button className="product-card-wish" onClick={async e => { e.preventDefault(); if (!requireLogin()) return; setWished(await toggleWishlist(p.id)); }}>
            <span style={{ color: wished ? '#E53935' : undefined }}>{wished ? '♥' : '♡'}</span> 찜
          </button>
          <span className="product-card-actions-divider" />
          <button className="cart-btn" style={p.soldout ? { opacity:0.5, cursor:'not-allowed' } : undefined} onClick={e => { e.preventDefault(); e.stopPropagation(); if (p.soldout) { alert('품절 상품입니다.'); return; } if (!requireLogin()) return; openOptionDrawer(p.id); }}>
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
          {/* NEW · 인기 · 직접 입력 뱃지 — 켠 것은 모두 표시 */}
          {p.is_new  && <span className="product-badge badge-new">NEW</span>}
          {p.is_best && <span className="product-badge badge-best">인기</span>}
          {p.badge && (
            <span className="product-badge" style={{ background: p.badge_color || '#1A1A1A', color: '#fff' }}>{p.badge}</span>
          )}
        </div>
        <div className="product-card-name">{p.name}</div>
        {p.short_desc && <div className="product-card-desc">{p.short_desc}</div>}
        <div className="price-block">
          {p.discount_rate > 0 && (
            <div className="price-top-row"><span className="price-original">{fmtPrice(p.price)}원</span></div>
          )}
          <div className="product-price-row">
            {p.discount_rate > 0 && <span className="price-discount">{Math.round(p.discount_rate)}%</span>}
            <span className="price-current">{fmtPrice(p.discounted_price ?? p.price)}원</span>
          </div>
        </div>
        {p.review_count > 0 && (
          <div className="product-rating-row">
            <div className="rating-stars" onClick={handleReviewClick}
              role="link" title="후기 보기" style={{ cursor:'pointer' }}>
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

/* ── 페이지네이션 (상품목록과 동일) ── */
function Pagination({ total, perPage, page, onChange }: {
  total: number; perPage: number; page: number; onChange: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / perPage);
  if (totalPages <= 1) return null;
  function go(p: number) { onChange(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }
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

export default function FarmClient() {
  const { slug } = useParams() as { slug: string };
  const router = useRouter();
  const { user } = useAuth();

  const [farm, setFarm] = useState<Farm | null>(null);
  const [farmWished, setFarmWished] = useState(false);
  const [farmWishCount, setFarmWishCount] = useState(0);
  const [certs, setCerts] = useState<Certification[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [prodPage, setProdPage] = useState(0);
  const prodScrollRef = useRef<HTMLDivElement>(null);
  const [farmSort, setFarmSort] = useState('');
  const [sortOpen, setSortOpen] = useState(false);
  const farmSortLabel = FARM_SORT_OPTS.find(o => o.value === farmSort)?.label || '정렬';

  /* 농가 상품 정렬 (클라이언트, 동점 시 추천 진열순) */
  const sortedProducts = useMemo(() => {
    const byOrder = (a: Product, b: Product) => (a.sort_order ?? 0) - (b.sort_order ?? 0);
    const descNullsLast = (av: number | null, bv: number | null) => {
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return bv - av;
    };
    const arr = [...products];
    switch (farmSort) {
      case 'popular':    arr.sort((a, b) => descNullsLast(a.sales_count, b.sales_count) || byOrder(a, b)); break;
      case 'new':        arr.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '') || byOrder(a, b)); break;
      case 'price_asc':  arr.sort((a, b) => (a.discounted_price - b.discounted_price) || byOrder(a, b)); break;
      case 'price_desc': arr.sort((a, b) => (b.discounted_price - a.discounted_price) || byOrder(a, b)); break;
      case 'sweet_desc': arr.sort((a, b) => descNullsLast(a.sweet_sort, b.sweet_sort) || byOrder(a, b)); break;
      case 'sour_desc':  arr.sort((a, b) => descNullsLast(a.sour_sort, b.sour_sort) || byOrder(a, b)); break;
      default:           arr.sort(byOrder);
    }
    return arr;
  }, [products, farmSort]);
  const PROD_PER_PAGE = 8;

  useEffect(() => {
    async function load() {
      if (!slug) return;
      const supabase = createClient();

      // 슬러그가 한글이면 URL 인코딩될 수 있어 디코딩해서 조회 (없으면 원본으로도 재시도)
      let decoded = slug;
      try { decoded = decodeURIComponent(slug); } catch { /* keep raw */ }
      let { data: farmData } = await supabase.from('farms').select('*').eq('slug', decoded).maybeSingle();
      if (!farmData && decoded !== slug) {
        ({ data: farmData } = await supabase.from('farms').select('*').eq('slug', slug).maybeSingle());
      }
      if (!farmData) { router.push('/category?origin=domestic'); return; }
      setFarm(farmData as Farm);
      try { supabase.rpc('bump_farm_view', { p_id: farmData.id }); } catch { /* noop */ }

      const [{ data: certData }, { data: gallData }, { data: prodData }] = await Promise.all([
        supabase.from('farm_certifications').select('*').eq('farm_id', farmData.id).order('sort_order'),
        supabase.from('farm_gallery').select('*').eq('farm_id', farmData.id).order('sort_order'),
        supabase.from('products').select(PRODUCT_PUBLIC_COLS_STOCK + ', sort_order, created_at, sales_count, sweet_sort, sour_sort').eq('farm_id', farmData.id).eq('is_active', true).order('sort_order').limit(60),
      ]);

      setCerts((certData as Certification[]) || []);
      setGallery((gallData as GalleryItem[]) || []);
      setProducts(((prodData as unknown as Record<string, unknown>[]) || []).map(withSoldout) as unknown as Product[]);
      setLoading(false);
    }
    load();
  }, [slug, router]);

  /* 농가 찜 상태/카운트 */
  useEffect(() => {
    if (!farm) return;
    const supabase = createClient();
    supabase.from('farm_wishlist').select('id', { count: 'exact', head: true }).eq('farm_id', farm.id)
      .then(({ count }) => setFarmWishCount(count || 0));
    if (user) {
      supabase.from('farm_wishlist').select('id').eq('farm_id', farm.id).eq('user_id', user.id).maybeSingle()
        .then(({ data }) => setFarmWished(!!data));
    } else { setFarmWished(false); }
  }, [farm, user]);

  async function toggleFarmWish() {
    if (!user) { router.push('/login'); return; }
    if (!farm) return;
    const supabase = createClient();
    if (farmWished) {
      await supabase.from('farm_wishlist').delete().eq('farm_id', farm.id).eq('user_id', user.id);
      setFarmWished(false); setFarmWishCount(c => Math.max(0, c - 1));
    } else {
      await supabase.from('farm_wishlist').insert({ farm_id: farm.id, user_id: user.id });
      setFarmWished(true); setFarmWishCount(c => c + 1);
    }
  }

  if (loading || !farm) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:300 }}>
        <p style={{ color:'#999' }}>불러오는 중...</p>
      </div>
    );
  }

  /* 취급 품목(한글) 기준 이모지 — 예: 블루베리 🫐 / 토마토 🍅 */
  const ITEM_EMOJI: Array<[string, string]> = [
    ['사과','🍎'], ['감귤','🍊'], ['귤','🍊'], ['블루베리','🫐'], ['베리','🫐'],
    ['참외','🍈'], ['멜론','🍈'], ['키위','🥝'], ['망고','🥭'], ['포도','🍇'],
    ['토마토','🍅'], ['복숭아','🍑'], ['배','🍐'], ['수박','🍉'], ['딸기','🍓'],
  ];
  const emoji = (farm.items || []).reduce<string | null>((acc, it) =>
    acc || (ITEM_EMOJI.find(([k]) => it.includes(k))?.[1] ?? null), null) || EMOJI_MAP.default;

  return (
    <div style={{ background:'#fff', minHeight:'100vh' }}>
      {/* ── 상단: 히어로 사진 (모바일 풀폭 / PC는 container 폭) ── */}
      {(() => {
        const heroImg = farm.hero_image_url || farm.farmer_image_url || farm.thumbnail_url;
        return heroImg ? (
          <div className="farm-hero">
            <img src={imgThumb(heroImg, 1400)} alt={farm.name} />
          </div>
        ) : (
          <div className="farm-hero farm-hero-empty"><span>{emoji}</span></div>
        );
      })()}

      {/* ── 위치 배지 · 하트 / 농가명 / 소개 ── */}
      <div className="container" style={{ paddingTop:24, paddingBottom:28 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:18 }}>
          {farm.region ? (
            <span style={{ display:'inline-flex', alignItems:'center', gap:5,
              background:'#E53935', color:'#fff', fontSize:13, fontWeight:600,
              padding:'6px 14px', borderRadius:999 }}>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="#fff" aria-hidden>
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/>
              </svg>
              {farm.region}</span>
          ) : <span />}
          <button onClick={toggleFarmWish} aria-label="농가 찜"
            style={{ display:'inline-flex', alignItems:'center', gap:6, background:'none',
              border:'none', cursor:'pointer', fontSize:15, color:'#666', fontFamily:'inherit' }}>
            <span style={{ fontSize:23, lineHeight:1, color: farmWished ? '#E53935' : '#CFCFCF' }}>{farmWished ? '♥' : '♡'}</span>
            {farmWishCount}
          </button>
        </div>
        <h1 style={{ fontSize:'clamp(24px,3vw,32px)', fontWeight:800, marginBottom:16, lineHeight:1.3 }}>{farm.name}</h1>
        {farm.intro && (
          <p style={{ fontSize:15, lineHeight:1.85, color:'#555', whiteSpace:'pre-line' }}>{farm.intro}</p>
        )}
        {farm.farmer_name && (
          <p style={{ fontSize:13, color:'#999', marginTop:16 }}>농부 · {farm.farmer_name}</p>
        )}
      </div>

      {/* ── 랜딩 이미지 (상세설명 · 긴 이미지) ── */}
      {farm.landing_images && farm.landing_images.length > 0 && (
        <div className="container" style={{ paddingBottom:32 }}>
          <div style={{ maxWidth:860, margin:'0 auto', display:'flex', flexDirection:'column' }}>
            {farm.landing_images.map((url, i) => (
              <img key={i} src={url} alt="" style={{ width:'100%', display:'block' }} />
            ))}
          </div>
        </div>
      )}

      {/* ── 농가 정보 요약 (표시할 값이 있을 때만 — 빈 회색 띠 방지) ── */}
      {(farm.founded_year || farm.altitude || farm.annual_output || certs.length > 0) && (
      <div style={{ background:'#F7F7F5', borderBottom:'1px solid #EBEBEB' }}>
        <div className="container" style={{ padding:'20px 0' }}>
          <div style={{ display:'flex', gap:24, flexWrap:'wrap' }}>
            {farm.founded_year && (
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:20, fontWeight:800 }}>{new Date().getFullYear() - farm.founded_year}년</div>
                <div style={{ fontSize:12, color:'#888' }}>재배 경력</div>
              </div>
            )}
            {farm.altitude && (
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:20, fontWeight:800 }}>{farm.altitude}</div>
                <div style={{ fontSize:12, color:'#888' }}>재배 고도</div>
              </div>
            )}
            {farm.annual_output && (
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:20, fontWeight:800 }}>{farm.annual_output}</div>
                <div style={{ fontSize:12, color:'#888' }}>연간 생산량</div>
              </div>
            )}
            {certs.length > 0 && (
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:20, fontWeight:800 }}>{certs.length}종</div>
                <div style={{ fontSize:12, color:'#888' }}>보유 인증</div>
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      <div className="container" style={{ paddingTop:32, paddingBottom:80 }}>

        {/* ── 농부 스토리 ── */}
        {farm.story && (
          <section style={{ marginBottom:40 }}>
            <h2 style={{ fontSize:20, fontWeight:700, marginBottom:16, borderLeft:'3px solid #1A1A1A', paddingLeft:12 }}>
              농가 이야기
            </h2>
            {farm.farmer_name && (
              <p style={{ fontSize:13, color:'#888', marginBottom:12 }}>
                농부 {farm.farmer_name} · {farm.founded_year && `${farm.founded_year}년 창업`}
              </p>
            )}
            <p style={{ fontSize:15, lineHeight:1.9, color:'#444', whiteSpace:'pre-line' }}>
              {farm.story}
            </p>
          </section>
        )}

        {/* ── 인증 ── */}
        {certs.length > 0 && (
          <section style={{ marginBottom:40 }}>
            <h2 style={{ fontSize:20, fontWeight:700, marginBottom:16, borderLeft:'3px solid #1A1A1A', paddingLeft:12 }}>
              품질 인증
            </h2>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
              {certs.map(c => (
                <div key={c.id} style={{
                  display:'flex', alignItems:'center', gap:10,
                  background:'#F0FAF3', border:'1px solid #B2DFCC',
                  borderRadius:10, padding:'10px 16px',
                }}>
                  <span style={{ fontSize:22 }}>✅</span>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:'#1B5E20' }}>{c.name}</div>
                    {c.issued_by && <div style={{ fontSize:12, color:'#555' }}>{c.issued_by}</div>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── 갤러리 ── */}
        {gallery.length > 0 && (
          <section style={{ marginBottom:40 }}>
            <h2 style={{ fontSize:20, fontWeight:700, marginBottom:16, borderLeft:'3px solid #1A1A1A', paddingLeft:12 }}>
              농장 갤러리
            </h2>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:8 }}>
              {gallery.map(g => (
                <div key={g.id} style={{
                  aspectRatio:'1', borderRadius:12, overflow:'hidden',
                  background:'#F7F7F5', display:'flex', alignItems:'center', justifyContent:'center',
                }}>
                  {g.image_url
                    ? <img src={imgThumb(g.image_url, 500)} alt={g.caption || ''} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    : <span style={{ fontSize:40 }}>{emoji}</span>
                  }
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── 농가 상품 ── */}
        {products.length > 0 && (
          <section style={{ marginBottom:40 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:16, flexWrap:'wrap' }}>
              <h2 style={{ fontSize:20, fontWeight:700, borderLeft:'3px solid #1A1A1A', paddingLeft:12 }}>
                {farm.name} 상품
              </h2>
              <div className={`custom-select${sortOpen ? ' open' : ''}`}>
                <button className="custom-select-btn" onClick={() => setSortOpen(v => !v)}>
                  <span>{farmSortLabel}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                <ul className="custom-select-list">
                  {FARM_SORT_OPTS.map(o => (
                    <li key={o.value}
                      className={`custom-select-item${farmSort === o.value ? ' selected' : ''}`}
                      onClick={() => { setFarmSort(o.value); setProdPage(0); setSortOpen(false); }}>
                      {o.label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="farm-prod-wrap">
              <button className="farm-prod-arrow prev" aria-label="이전"
                onClick={() => prodScrollRef.current?.scrollBy({ left: -prodScrollRef.current.clientWidth * 0.8, behavior: 'smooth' })}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <div className="farm-prod-carousel" ref={prodScrollRef}>
                {sortedProducts.map(p => (
                  <FarmProductCard key={p.id} p={p} />
                ))}
              </div>
              <button className="farm-prod-arrow next" aria-label="다음"
                onClick={() => prodScrollRef.current?.scrollBy({ left: prodScrollRef.current.clientWidth * 0.8, behavior: 'smooth' })}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
