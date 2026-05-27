'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { addToCart } from '@/lib/cart';
import { useAuth } from '@/hooks/useAuth';
import '@/styles/product.css';
import { StarRating, SingleStar } from '@/components/StarRating';

/* ── 타입 ── */
interface Product {
  id: string; sku: string; name: string;
  origin: string; category: string;
  price: number; discount_rate: number; discounted_price: number;
  thumbnail_url: string | null; badge: string | null;
  short_desc: string | null; brix: number | null;
  is_new: boolean; is_best: boolean; is_dawn: boolean;
  avg_rating: number; review_count: number;
  farm_id: string | null;
  seller_score?: { sweet: number; sour: number; texture: number; fresh: number } | null;
}
interface ProductOption {
  id: string; label: string; add_price: number; stock: number; is_default: boolean;
}
interface Farm {
  id: string; name: string; region: string; farm_type: string;
  intro: string | null; slug: string;
}
interface Review {
  id: string; rating: number; content: string; created_at: string;
  image_urls: string[] | null; likes_count: number; is_best: boolean;
  profiles: { name: string | null } | null;
}
interface DetailSection {
  id: string; section_type: string; content: string; sort_order: number;
}

const EMOJI_MAP: Record<string, string> = {
  apple:'🍎', citrus:'🍊', berry:'🫐', melon:'🍈',
  kiwi:'🥝', mango:'🥭', grape:'🍇', gift:'🎁', default:'🍑',
};
const BG_MAP: Record<string, string> = {
  apple:'#FFE8E8', citrus:'#FFF3E0', berry:'#F3E5F5', melon:'#E8F5E9',
  kiwi:'#F1F8E9', mango:'#FFF9E6', grape:'#EDE7F6', gift:'#E8EAF6', default:'#F4EFE6',
};
const CAT_NAME: Record<string, string> = {
  apple:'사과/배', citrus:'감귤', berry:'베리류', melon:'멜론/참외',
  kiwi:'키위', mango:'망고', grape:'포도', gift:'선물세트',
};

/* ── 맛 프로파일 설정 ── */
const TASTE_ATTRS = [
  { key:'sweet',   label:'단맛',   icon:'🍭', dotColor:'red',    bg:'#FFF0EE' },
  { key:'sour',    label:'산미',   icon:'🍋', dotColor:'gray',   bg:'#F5F5F5' },
  { key:'texture', label:'아삭함', icon:'🥢', dotColor:'red',    bg:'#F5F5F5' },
  { key:'fresh',   label:'과즙',   icon:'💧', dotColor:'orange', bg:'#FFF9E6' },
] as const;

type TasteKey = 'sweet' | 'sour' | 'texture' | 'fresh';

const DEFAULT_SELLER_SCORE: Record<string, Record<TasteKey, number>> = {
  apple:   { sweet:4, sour:2, texture:4, fresh:4 },
  citrus:  { sweet:4, sour:3, texture:3, fresh:4 },
  berry:   { sweet:3, sour:3, texture:3, fresh:4 },
  melon:   { sweet:5, sour:1, texture:4, fresh:5 },
  kiwi:    { sweet:4, sour:3, texture:4, fresh:4 },
  mango:   { sweet:5, sour:1, texture:2, fresh:5 },
  grape:   { sweet:4, sour:1, texture:4, fresh:4 },
  gift:    { sweet:4, sour:2, texture:3, fresh:4 },
  default: { sweet:4, sour:2, texture:3, fresh:4 },
};

const DOT_COLOR_HEX: Record<string, string> = {
  red: '#CB1D11', gray: '#9E9E9E', orange: '#F5A623',
};

function scoreLabel(v: number) {
  if (v >= 4.5) return '매우 강함';
  if (v >= 3.5) return '강함';
  if (v >= 2.5) return '보통';
  if (v >= 1.5) return '약함';
  return '매우 약함';
}

/* 원본 calcAgreePct: avgDiff=0 (userScore 없음) */
function calcAgreePct(sk: number) {
  const base = 68 + (5 - sk) * 2 + 5 * 5;
  return Math.min(99, Math.max(60, Math.round(base)));
}

function fmtPrice(n: number) { return n.toLocaleString('ko-KR'); }

function ratingLabel(r: number) {
  if (r >= 5) return '최고에요';
  if (r >= 4) return '정말 좋아요';
  if (r >= 3) return '괜찮아요';
  if (r >= 2) return '그냥 그래요';
  return '아쉬워요';
}

// Stars → StarRating 공유 컴포넌트 사용

type SortKey = 'latest' | 'helpful' | 'rating';

export default function ProductClient() {
  const { id }    = useParams() as { id: string };
  const router    = useRouter();
  const { user }  = useAuth();

  const [product,    setProduct]    = useState<Product | null>(null);
  const [options,    setOptions]    = useState<ProductOption[]>([]);
  const [farm,       setFarm]       = useState<Farm | null>(null);
  const [reviews,    setReviews]    = useState<Review[]>([]);
  const [sections,   setSections]   = useState<DetailSection[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [selThumb,   setSelThumb]   = useState(0);
  const [selOption,  setSelOption]  = useState('');
  const [selOption2, setSelOption2] = useState('');
  const [qty,        setQty]        = useState(1);
  const [activeTab,  setActiveTab]  = useState(0);
  const [wishlisted,       setWishlisted]       = useState(false);
  const [reviewSort,       setReviewSort]       = useState<SortKey>('latest');
  const [reviewModalOpen,  setReviewModalOpen]  = useState(false);
  const [newRating,        setNewRating]        = useState(5);
  const [newContent,       setNewContent]       = useState('');
  const [submitting,       setSubmitting]       = useState(false);
  const [tastePanelActive, setTastePanelActive] = useState<'delio' | 'buyers'>('delio');
  const [photoFilterOn,    setPhotoFilterOn]    = useState(false);

  useEffect(() => {
    async function load() {
      if (!id) return;
      setLoading(true);
      const supabase = createClient();

      const [{ data: prod }, { data: opts }, { data: revs }, { data: secs }] =
        await Promise.all([
          supabase.from('products').select('*').eq('id', id).single(),
          supabase.from('product_options').select('*').eq('product_id', id).order('sort_order'),
          supabase.from('reviews')
            .select('*, profiles(name)')
            .eq('product_id', id)
            .order('created_at', { ascending: false })
            .limit(50),
          supabase.from('product_detail_sections')
            .select('*').eq('product_id', id).order('sort_order'),
        ]);

      if (!prod) { router.push('/'); return; }
      setProduct(prod as Product);
      setOptions((opts as ProductOption[]) || []);
      setReviews((revs as Review[]) || []);
      setSections((secs as DetailSection[]) || []);

      const def = (opts as ProductOption[])?.find(o => o.is_default);
      if (def) setSelOption(def.id);

      // 최근 본 상품 저장 (localStorage)
      try {
        const RECENT_KEY = 'delio_recent_products';
        const existing: {id:string}[] = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
        const filtered = existing.filter(p => p.id !== (prod as Product).id);
        const item = {
          id: (prod as Product).id,
          name: (prod as Product).name,
          price: (prod as Product).discounted_price ?? (prod as Product).price,
          discount_rate: (prod as Product).discount_rate,
          thumbnail_url: (prod as Product).thumbnail_url,
          avg_rating: (prod as Product).avg_rating,
          category: (prod as Product).category,
        };
        localStorage.setItem(RECENT_KEY, JSON.stringify([item, ...filtered].slice(0, 20)));
      } catch { /* ignore */ }

      if (prod.farm_id) {
        const { data: farmData } = await supabase
          .from('farms').select('*').eq('id', prod.farm_id).single();
        setFarm(farmData as Farm);
      }

      if (user) {
        const { data: wl } = await supabase.from('wishlist')
          .select('id').eq('product_id', id).eq('user_id', user.id).maybeSingle();
        setWishlisted(!!wl);
      }
      setLoading(false);
    }
    load();
  }, [id, user, router]);

  async function toggleWishlist() {
    if (!user) { router.push('/login'); return; }
    const supabase = createClient();
    if (wishlisted) {
      await supabase.from('wishlist').delete().eq('product_id', id).eq('user_id', user.id);
      setWishlisted(false);
    } else {
      await supabase.from('wishlist').insert({ product_id: id, user_id: user.id });
      setWishlisted(true);
    }
  }

  function handleAddCart() {
    if (!product) return;
    const opt = options.find(o => o.id === selOption);
    addToCart({
      id: product.id,
      name: product.name + (opt ? ` (${opt.label})` : ''),
      price: (product.discounted_price ?? product.price) + (opt?.add_price ?? 0),
      thumbnail: product.thumbnail_url || '',
      quantity: qty,
      optionId: selOption || undefined,
    });
    alert('장바구니에 담겼습니다!');
  }
  function handleBuyNow() { handleAddCart(); router.push('/cart'); }

  async function handleSubmitReview() {
    if (!user) { router.push('/login'); return; }
    if (!newContent.trim()) { alert('리뷰 내용을 입력해주세요.'); return; }
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from('reviews').insert({
      product_id: product!.id,
      user_id: user.id,
      rating: newRating,
      content: newContent.trim(),
      is_best: false,
    });
    setSubmitting(false);
    if (error) { alert('리뷰 등록 중 오류가 발생했습니다.'); return; }

    // 리뷰 새로 불러오기
    const { data: refreshed } = await supabase
      .from('reviews').select('*, profiles(name)')
      .eq('product_id', product!.id)
      .order('created_at', { ascending: false }).limit(50);
    const updatedReviews = (refreshed as Review[]) || [];
    setReviews(updatedReviews);

    // products.avg_rating + review_count 실시간 반영
    const newCount = updatedReviews.length;
    const newAvg   = newCount > 0
      ? Math.round(updatedReviews.reduce((s, r) => s + r.rating, 0) / newCount * 10) / 10
      : 0;
    await supabase.from('products').update({
      review_count: newCount,
      avg_rating:   newAvg,
    }).eq('id', product!.id);
    setProduct(prev => prev ? { ...prev, review_count: newCount, avg_rating: newAvg } : prev);

    alert('리뷰가 등록됐습니다. 감사합니다!');
    setReviewModalOpen(false);
    setNewRating(5);
    setNewContent('');
  }

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:300 }}>
        <p style={{ color:'#999' }}>불러오는 중...</p>
      </div>
    );
  }
  if (!product) return null;

  const emoji      = EMOJI_MAP[product.category] || EMOJI_MAP.default;
  const bg         = BG_MAP[product.category]    || BG_MAP.default;
  const basePrice  = product.discounted_price    ?? product.price;
  const optObj     = options.find(o => o.id === selOption);
  const totalPrice = (basePrice + (optObj?.add_price ?? 0)) * qty;

  /* 맛 프로파일 점수 (DB seller_score 우선, 없으면 카테고리 기본값) */
  const sellerScore: Record<TasteKey, number> =
    (product.seller_score as Record<TasteKey, number> | null | undefined) ||
    (DEFAULT_SELLER_SCORE[product.category] as Record<TasteKey, number>) ||
    DEFAULT_SELLER_SCORE.default as Record<TasteKey, number>;

  /* 리뷰 정렬 */
  const sortedReviews = [...reviews].sort((a, b) => {
    if (reviewSort === 'rating')  return b.rating - a.rating;
    if (reviewSort === 'helpful') return (b.likes_count || 0) - (a.likes_count || 0);
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  /* 평점 분포 */
  const ratingDist = [
    { label:'최고에요',    star:5 },
    { label:'정말 좋아요', star:4 },
    { label:'괜찮아요',   star:3 },
    { label:'그냥 그래요', star:2 },
    { label:'아쉬워요',   star:1 },
  ].map(({ label, star }) => ({
    label, count: reviews.filter(r => r.rating === star).length,
  }));
  const maxDist = Math.max(...ratingDist.map(r => r.count), 1);

  const TABS = [
    '상품설명',
    '상세정보',
    `후기 ${product.review_count > 0 ? product.review_count + '+' : '0'}`,
    '문의 17',
  ];

  const thumbIcons = [emoji, '🌿', '📦', '🌾', '✨', '🎁'];

  /* 포토리뷰 수 (원본 기준) */
  const photoReviewCount = Math.round(product.review_count * 0.27);
  const photoColors = [bg, '#E8F0E8', '#FFF3E0', '#F0E8FF', '#E8F4FF', '#FFE8E8', '#F0F8E8', bg];

  return (
    <>
      {/* ══ 상단: 이미지 + 정보 ══ */}
      <div className="pd-above">
        <div className="container">
          <div className="pd-layout">

            {/* ────────────────── pd-left ────────────────── */}
            <div className="pd-left">

              {/* 메인 이미지 */}
              <div className="img-main"
                style={{ background:`linear-gradient(135deg,${bg} 0%,#fff 65%)` }}>
                {product.thumbnail_url
                  ? <img src={product.thumbnail_url} alt={product.name}
                      style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:16 }} />
                  : <span>{thumbIcons[selThumb] ?? emoji}</span>
                }
                <div className="trust-overlay">
                  {farm            && <span className="trust-pill">🌿 산지직송</span>}
                  {product.is_dawn && <span className="trust-pill">🌙 새벽배송</span>}
                  {product.is_best && <span className="trust-pill">⭐ 베스트</span>}
                </div>
              </div>

              {/* 썸네일 6개 */}
              <div className="thumb-row">
                {thumbIcons.map((t, i) => (
                  <div key={i}
                    className={`thumb${selThumb === i ? ' active' : ''}`}
                    onClick={() => setSelThumb(i)}
                    style={{ background:`linear-gradient(135deg,${bg},#fff)` }}>
                    {t}
                  </div>
                ))}
              </div>

              {/* 농가 카드 */}
              {farm && (
                <Link href={`/farm/${farm.slug}`} className="brand-card">
                  <div className="brand-card-logo">{emoji}</div>
                  <div className="brand-card-body">
                    <div className="brand-card-name">
                      {farm.name}
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </div>
                    <div className="brand-card-desc">{farm.region} · {farm.farm_type}</div>
                    {farm.intro && <div className="brand-card-sub">{farm.intro}</div>}
                  </div>
                  <div className="brand-card-wish">
                    <button className="brand-card-wish-btn"
                      onClick={e => { e.preventDefault(); e.stopPropagation(); toggleWishlist(); }}
                      style={{ color: wishlisted ? '#E55A4B' : undefined }}>
                      {wishlisted ? '♥' : '♡'}
                    </button>
                    <span className="brand-card-wish-count">319</span>
                  </div>
                </Link>
              )}
            </div>

            {/* ────────────────── pd-right ────────────────── */}
            <div className="pd-right">

              {/* 브레드크럼 */}
              <div className="breadcrumb">
                <Link href="/">홈</Link> ›{' '}
                <Link href={`/category?cat=${product.category}`}>
                  {CAT_NAME[product.category] || product.category}
                </Link>{' '}
                › {product.name}
              </div>

              <h1 className="product-name">{product.name}</h1>

              {/* 메타: brix + 배송타입 + 별점 */}
              <div className="product-meta">
                {product.brix != null && (
                  <span style={{ fontSize:12, fontWeight:700, padding:'3px 8px',
                    background:'var(--color-accent-bg)', color:'var(--color-accent)',
                    borderRadius:6 }}>
                    🍬 {product.brix} brix
                  </span>
                )}
                {product.badge && (
                  <span style={{ fontSize:12, fontWeight:600, padding:'3px 8px',
                    background:'var(--color-bg)', borderRadius:6,
                    color:'var(--color-ink-soft)' }}>
                    {product.badge}
                  </span>
                )}
                <span style={{ fontSize:12, fontWeight:700, padding:'3px 8px', borderRadius:6,
                  background: product.is_dawn ? '#FFF9E0' : '#FFF0EE',
                  color:      product.is_dawn ? '#7A5C2E' : '#CB1D11' }}>
                  {product.is_dawn ? '새벽배송' : '택배배송'}
                </span>
                {product.avg_rating > 0 && (
                  <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:4 }}>
                    <SingleStar size={13} />
                    <button onClick={() => setActiveTab(2)}
                      style={{ fontSize:12, color:'var(--color-ink-mute)',
                        background:'none', border:'none', cursor:'pointer', padding:0 }}>
                      {product.avg_rating.toFixed(1)} ({product.review_count.toLocaleString()})
                    </button>
                  </div>
                )}
              </div>

              {/* 가격 */}
              <div className="price-block">
                {product.discount_rate > 0 ? (
                  <>
                    <div style={{ fontSize:14, color:'var(--color-ink-mute)',
                      textDecoration:'line-through', marginBottom:4 }}>
                      {fmtPrice(product.price)}원
                    </div>
                    <div className="price-line" style={{ marginBottom:4 }}>
                      <span className="price-discount-rate">{product.discount_rate}%</span>
                      <span className="price-discount-val">{fmtPrice(basePrice)}원~</span>
                    </div>
                    <div className="price-line">
                      <span className="price-coupon-rate">
                        {Math.round(product.discount_rate + 15)}%
                      </span>
                      <span className="price-coupon-val">
                        {fmtPrice(Math.round(basePrice * 0.85))}원~
                      </span>
                      <span className="price-coupon-tag">쿠폰 최대혜택가 ∨</span>
                    </div>
                  </>
                ) : (
                  <div className="price-line">
                    <span className="price-discount-val">{fmtPrice(basePrice)}원</span>
                  </div>
                )}
              </div>

              {/* 회원가입 쿠폰 배너 */}
              <Link href="/signup" className="signup-coupon-banner">
                <div className="signup-coupon-banner-left">
                  <span className="signup-coupon-icon">🎁</span>
                  <span className="signup-coupon-text">
                    회원가입하고 <span>5,000원 쿠폰</span> 받기
                  </span>
                </div>
                <span className="signup-coupon-arrow">›</span>
              </Link>

              {/* 배송 정보 테이블 */}
              <table className="pd-info-table">
                <tbody>
                  <tr>
                    <th>배송방법</th>
                    <td>{product.is_dawn ? '새벽배송' : '택배'}</td>
                  </tr>
                  <tr>
                    <th>배송비</th>
                    <td>
                      무료{' '}
                      <span style={{ color:'var(--color-ink-mute)', fontSize:12 }}>
                        (30,000원 이상)
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <th>적립금</th>
                    <td style={{ color:'var(--color-accent)' }}>
                      1% ({fmtPrice(Math.round(basePrice * 0.01))}원)
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* 옵션 & 수량 & 출발안내 & 총금액 & CTA */}
              <div className="option-section">
                {options.length > 0 && (
                  <>
                    {/* ── 옵션 선택 1 ── */}
                    <div className="option-label">옵션 선택 1</div>
                    <select className="option-select" value={selOption}
                      onChange={e => { setSelOption(e.target.value); setQty(1); }}>
                      <option value="">- [필수] 옵션을 선택해 주세요 -</option>
                      {options.map(o => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                          {o.add_price > 0 ? ` (+${fmtPrice(o.add_price)}원)` : ''}
                        </option>
                      ))}
                    </select>

                    {/* ── 옵션 선택 2 ── */}
                    <div className="option-label">옵션 선택 2</div>
                    <select className="option-select" value={selOption2}
                      onChange={e => setSelOption2(e.target.value)}>
                      <option value="">- [필수] 옵션을 선택해 주세요 -</option>
                      {options.map(o => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                          {o.add_price > 0 ? ` (+${fmtPrice(o.add_price)}원)` : ''}
                        </option>
                      ))}
                    </select>

                    {/* ── 선택된 옵션 박스 (옵션 선택 후 표시) ── */}
                    {selOption && optObj && (
                      <div style={{
                        border:'1px solid #E4E2DE', borderRadius:8,
                        padding:'14px 16px', marginBottom:4,
                        background:'#FAFAF8',
                      }}>
                        {/* 옵션명 + 닫기 */}
                        <div style={{ display:'flex', justifyContent:'space-between',
                          alignItems:'flex-start', marginBottom:12 }}>
                          <span style={{ fontSize:13, fontWeight:600,
                            color:'var(--color-ink)', flex:1, lineHeight:1.45 }}>
                            {optObj.label}
                            {optObj.add_price > 0 && (
                              <span style={{ fontSize:12, color:'var(--color-accent)',
                                marginLeft:6, fontWeight:700 }}>
                                +{fmtPrice(optObj.add_price)}원
                              </span>
                            )}
                          </span>
                          <button
                            onClick={() => { setSelOption(''); setQty(1); }}
                            style={{ background:'none', border:'none', cursor:'pointer',
                              fontSize:15, color:'#AAAAAA', padding:'0 0 0 10px',
                              lineHeight:1, flexShrink:0 }}>
                            ✕
                          </button>
                        </div>

                        {/* 수량 +/- + 소계 */}
                        <div style={{ display:'flex', alignItems:'center',
                          justifyContent:'space-between' }}>
                          <div style={{ display:'inline-flex', alignItems:'center',
                            border:'1.5px solid #DDDDD9', borderRadius:6,
                            overflow:'hidden', background:'#fff' }}>
                            <button
                              onClick={() => setQty(q => Math.max(1, q - 1))}
                              style={{ width:32, height:32, border:'none',
                                borderRight:'1px solid #DDDDD9', background:'transparent',
                                cursor:'pointer', fontSize:16, color:'var(--color-ink)',
                                display:'flex', alignItems:'center', justifyContent:'center',
                                lineHeight:1 }}>
                              −
                            </button>
                            <span style={{ minWidth:36, textAlign:'center', fontSize:14,
                              fontWeight:700, padding:'0 4px',
                              lineHeight:'32px', display:'inline-block',
                              color:'var(--color-ink)' }}>
                              {qty}
                            </span>
                            <button
                              onClick={() => setQty(q => q + 1)}
                              style={{ width:32, height:32, border:'none',
                                borderLeft:'1px solid #DDDDD9', background:'transparent',
                                cursor:'pointer', fontSize:16, color:'var(--color-ink)',
                                display:'flex', alignItems:'center', justifyContent:'center',
                                lineHeight:1 }}>
                              +
                            </button>
                          </div>
                          <span style={{ fontSize:16, fontWeight:800,
                            color:'var(--color-accent)' }}>
                            {fmtPrice((basePrice + (optObj.add_price ?? 0)) * qty)}원
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* 옵션 없는 상품: 수량 직접 조절 */}
                {options.length === 0 && (
                  <>
                    <div className="option-label">수량</div>
                    <div style={{ display:'inline-flex', alignItems:'center',
                      border:'1.5px solid #DDDDD9', borderRadius:6,
                      overflow:'hidden', marginBottom:16, background:'#fff' }}>
                      <button onClick={() => setQty(q => Math.max(1, q - 1))}
                        style={{ width:36, height:36, border:'none',
                          borderRight:'1px solid #DDDDD9', background:'transparent',
                          cursor:'pointer', fontSize:18, color:'var(--color-ink)',
                          display:'flex', alignItems:'center', justifyContent:'center' }}>
                        −
                      </button>
                      <span style={{ minWidth:44, textAlign:'center', fontSize:15,
                        fontWeight:700, padding:'0 8px',
                        lineHeight:'36px', display:'inline-block' }}>
                        {qty}
                      </span>
                      <button onClick={() => setQty(q => q + 1)}
                        style={{ width:36, height:36, border:'none',
                          borderLeft:'1px solid #DDDDD9', background:'transparent',
                          cursor:'pointer', fontSize:18, color:'var(--color-ink)',
                          display:'flex', alignItems:'center', justifyContent:'center' }}>
                        +
                      </button>
                    </div>
                  </>
                )}

                {/* 출발 안내 */}
                <div className="pd-dispatch-notice">
                  <svg viewBox="0 0 24 24" width="18" height="18"
                    fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="1" y="3" width="15" height="13" rx="1"/>
                    <path d="M16 8h4l3 5v4h-7V8z"/>
                    <circle cx="5.5" cy="18.5" r="2.5"/>
                    <circle cx="18.5" cy="18.5" r="2.5"/>
                  </svg>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600 }}>오늘 출발 14:00 마감</div>
                    <div style={{ fontSize:12, color:'var(--color-ink-mute)' }}>
                      지금 주문 시 내일 발송됩니다
                    </div>
                  </div>
                </div>

                {/* 총 상품금액 */}
                <div className="total-row">
                  <span style={{ fontSize:14, color:'var(--color-ink-soft)' }}>총 상품금액</span>
                  <span>
                    <span style={{ fontSize:13, color:'var(--color-ink-mute)', marginRight:6 }}>
                      {qty}개
                    </span>
                    <span style={{ fontSize:22, fontWeight:700, color:'var(--color-accent)' }}>
                      {fmtPrice(totalPrice)}원
                    </span>
                  </span>
                </div>

                {/* PC CTA */}
                <div className="cta-bar-pc">
                  <button className="btn btn-secondary btn-flex-1" onClick={handleAddCart}>
                    장바구니
                  </button>
                  <button className="btn btn-primary btn-flex-2" onClick={handleBuyNow}>
                    바로 구매
                  </button>
                </div>
                <button onClick={() => alert('선물하기 준비 중입니다 🎁')}
                  style={{ width:'100%', marginTop:8, border:'1.5px solid #DDDDD9',
                    background:'#fff', color:'var(--color-ink)', borderRadius:8,
                    padding:'13px 0', fontSize:14, fontWeight:600, cursor:'pointer' }}>
                  🎁 선물하기
                </button>

                {/* ✅ 네이버페이 (원본과 동일) */}
                <div style={{ marginTop:16, borderTop:'1px solid #EBEBEB', paddingTop:14 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:11, fontWeight:800, color:'#03C75A',
                        letterSpacing:'0.04em', marginBottom:2 }}>NAVER</div>
                      <div style={{ fontSize:11, color:'#555', lineHeight:1.5 }}>
                        네이버ID로 간편구매<br/>네이버페이
                      </div>
                    </div>
                    <button onClick={() => alert('네이버페이로 연결합니다')}
                      style={{ display:'flex', alignItems:'center', gap:7,
                        background:'#03C75A', color:'#fff', border:'none',
                        borderRadius:6, padding:'13px 22px', fontSize:15, fontWeight:700,
                        cursor:'pointer', whiteSpace:'nowrap' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="12" fill="#fff"/>
                        <text x="12" y="17" textAnchor="middle" fontSize="13"
                          fontWeight="900" fill="#03C75A" fontFamily="Arial,sans-serif">N</text>
                      </svg>
                      pay 구매
                    </button>
                  </div>
                  <div style={{ marginTop:8, display:'flex', alignItems:'center',
                    justifyContent:'space-between', fontSize:11, color:'#03C75A' }}>
                    <span>
                      <b>이벤트</b>{' '}
                      <span style={{ color:'#555' }}>결제 최대혜택 10% 추가…</span>
                    </span>
                    <span style={{ display:'flex', gap:2 }}>
                      <button style={{ background:'none', border:'1px solid #DDD', borderRadius:3,
                        width:18, height:18, fontSize:10, cursor:'pointer', color:'#888', padding:0 }}>‹</button>
                      <button style={{ background:'none', border:'1px solid #DDD', borderRadius:3,
                        width:18, height:18, fontSize:10, cursor:'pointer', color:'#888', padding:0 }}>›</button>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ 맛 프로파일 VS (원본과 동일: pd-above 아래, 탭 위에 배치) ══ */}
      <div className="taste-profile-vs">
        <div className="container">
          <div className="taste-profile-card">
            <div className="taste-vs-header">
              <span className="taste-vs-title">맛 프로파일</span>
              <a href="#" className="taste-vs-curation"
                onClick={e => e.preventDefault()}>델리오 큐레이션</a>
            </div>
            <div className="taste-vs-tabs-wrap">
              <div className="taste-vs-tabs">
                <div className={`taste-vs-tab-slider${tastePanelActive === 'buyers' ? ' right' : ''}`} />
                <button
                  className={`taste-vs-tab${tastePanelActive === 'delio' ? ' active' : ''}`}
                  onClick={() => setTastePanelActive('delio')}>
                  델리오가 분석한 맛
                </button>
                <button
                  className={`taste-vs-tab${tastePanelActive === 'buyers' ? ' active' : ''}`}
                  onClick={() => setTastePanelActive('buyers')}>
                  구매자도 동의해요
                </button>
              </div>
            </div>

            {/* 패널1: 델리오 분석 */}
            {tastePanelActive === 'delio' && (
              <div className="taste-panel">
                <div className="taste-grid">
                  {TASTE_ATTRS.map(a => {
                    const v = sellerScore[a.key] || 3;
                    const filled = Math.max(1, Math.min(5, Math.round(v)));
                    return (
                      <div key={a.key} className="taste-card" style={{ background: a.bg }}>
                        <span className="taste-card-icon">{a.icon}</span>
                        <div className="taste-card-body">
                          <div className="taste-card-label">{a.label}</div>
                          <div className="taste-card-intensity">{scoreLabel(v)}</div>
                          <div className="taste-dots">
                            {[1,2,3,4,5].map(i => (
                              <span key={i}
                                className={`taste-dot ${i <= filled ? `filled-${a.dotColor}` : 'empty'}`} />
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 패널2: 구매자 동의 */}
            {tastePanelActive === 'buyers' && (
              <div className="taste-panel">
                {product.review_count >= 10 ? (
                  <>
                    <div className="buyer-agree-header">
                      구매자도 동의해요
                      <span className="buyer-agree-badge">
                        리뷰 {product.review_count.toLocaleString()}개 기준
                      </span>
                    </div>
                    {TASTE_ATTRS.map(a => {
                      const sk = sellerScore[a.key] || 3;
                      const pct = calcAgreePct(sk);
                      const hex = DOT_COLOR_HEX[a.dotColor];
                      return (
                        <div key={a.key} className="buyer-bar-row">
                          <span className="buyer-bar-icon">{a.icon}</span>
                          <span className="buyer-bar-label">{a.label}</span>
                          <div className="buyer-bar-track">
                            <div className="buyer-bar-fill"
                              style={{ width:`${pct}%`, background: hex }} />
                          </div>
                          <span className="buyer-bar-pct" style={{ color: hex }}>{pct}%</span>
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div className="taste-locked">
                    <div className="taste-locked-header">
                      🔒 구매자 동의율 — 리뷰 10개 이상 시 공개
                    </div>
                    {TASTE_ATTRS.map(a => (
                      <div key={a.key} className="taste-locked-bar">
                        <span className="buyer-bar-icon" style={{ opacity:0.35 }}>{a.icon}</span>
                        <span className="buyer-bar-label" style={{ opacity:0.35 }}>{a.label}</span>
                        <div className="buyer-bar-track" style={{ flex:1, opacity:0.3 }} />
                        <span className="taste-locked-pct">--%</span>
                      </div>
                    ))}
                    <div className="taste-locked-msg">
                      첫 구매자가 되어 맛 평가에 참여해보세요 👋
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══ 탭 ══ */}
      <div className="pd-tabs-section">
        <div className="pd-tab-bar" id="productTabs">
          {TABS.map((t, i) => (
            <div key={t} className={`pd-tab${activeTab === i ? ' active' : ''}`}
              onClick={() => setActiveTab(i)}>
              {t}
            </div>
          ))}
        </div>

        {/* ① 상품설명 */}
        {activeTab === 0 && (
          <div id="tabDesc" className="tab-content container">
            {sections.length > 0 ? (
              sections.map(s => (
                <div key={s.id}
                  dangerouslySetInnerHTML={{ __html: s.content }}
                  style={{ marginBottom:20 }} />
              ))
            ) : (
              <>
                <div style={{ background:'var(--color-bg)', borderRadius:12,
                  padding:20, marginBottom:16 }}>
                  <div style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>🌿 농가 정보</div>
                  <p style={{ fontSize:13, color:'var(--color-ink-soft)', lineHeight:1.85 }}>
                    {farm
                      ? `${farm.region}의 신뢰할 수 있는 파트너 농가에서 직접 수확하여 산지직송으로 보내드립니다. `
                      : '산지 파트너 농가에서 직접 수확하여 신선도를 최대한 유지합니다. '}
                    {product.short_desc ||
                      '친환경 인증을 받은 농가에서 당도를 보장한 프리미엄 과일입니다.'}
                  </p>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr',
                  gap:12, marginBottom:20 }}>
                  <div style={{ background:'var(--color-bg)', borderRadius:12, padding:16 }}>
                    <div style={{ fontSize:12, fontWeight:700, marginBottom:8 }}>📦 보관법</div>
                    <p style={{ fontSize:12, color:'var(--color-ink-soft)', lineHeight:1.7 }}>
                      냉장 보관(0~4℃) 권장. 비닐봉지에 넣어 1주일 이내 섭취.
                    </p>
                  </div>
                  <div style={{ background:'var(--color-bg)', borderRadius:12, padding:16 }}>
                    <div style={{ fontSize:12, fontWeight:700, marginBottom:8 }}>🔪 손질법</div>
                    <p style={{ fontSize:12, color:'var(--color-ink-soft)', lineHeight:1.7 }}>
                      흐르는 물에 깨끗이 씻어 드세요. 껍질에 영양이 풍부합니다.
                    </p>
                  </div>
                </div>
              </>
            )}
            {/* 이모지 배경 */}
            <div style={{ fontSize:72, textAlign:'center', lineHeight:1,
              opacity:0.3, padding:'12px 0 4px' }}>
              {emoji}{emoji}{emoji}
            </div>
          </div>
        )}

        {/* ② 상세정보 */}
        {activeTab === 1 && (
          <div id="tabInfo" className="tab-content container">
            <div style={{ marginBottom:40 }}>
              <div style={{ fontSize:18, fontWeight:700, textAlign:'center', marginBottom:24 }}>
                상품고시정보
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse',
                fontSize:13, tableLayout:'fixed' }}>
                <tbody>
                  {[
                    ['제품명', product.name, '식품의 유형', '과일'],
                    ['생산자 및 소재지 (수입품의 경우 생산지, 수입자 및 제조국)',
                     '상품설명 및 이미지 참조',
                     '제조연월일, 소비기한 또는 품질유지기한',
                     '상품설명 및 이미지 참조'],
                    ['포장단위별 내용물의 용량(중량), 수량',
                     '상품설명 및 이미지 참조',
                     '원재료명 및 함량 (원산지 표시 포함)',
                     '상품설명 및 이미지 참조'],
                    ['영양성분 (영양성분 표시대상 식품에 한함)',
                     '상품설명 및 이미지 참조',
                     '유전자변형식품에 해당하는 경우의 표시',
                     '상품설명 및 이미지 참조'],
                    ['소비자 안전을 위한 주의사항',
                     '상품설명 및 이미지 참조',
                     '소비자 상담 관련 전화번호',
                     '02-6925-2311'],
                  ].map(([k1,v1,k2,v2], i) => (
                    <tr key={i}>
                      <td style={{ background:'#F8F8F6', padding:'12px 14px', fontWeight:600,
                        color:'var(--color-ink-soft)', width:'20%', verticalAlign:'top',
                        lineHeight:1.6 }}>{k1}</td>
                      <td style={{ padding:'12px 14px', color:'var(--color-ink-soft)',
                        width:'30%', verticalAlign:'top', lineHeight:1.6 }}>{v1}</td>
                      <td style={{ background:'#F8F8F6', padding:'12px 14px', fontWeight:600,
                        color:'var(--color-ink-soft)', width:'20%', verticalAlign:'top',
                        lineHeight:1.6 }}>{k2}</td>
                      <td style={{ padding:'12px 14px', color:'var(--color-ink-soft)',
                        width:'30%', verticalAlign:'top', lineHeight:1.6 }}>{v2}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginBottom:32 }}>
              <div style={{ fontSize:14, fontWeight:700, paddingBottom:12,
                borderBottom:'1.5px solid var(--color-ink)', marginBottom:16 }}>
                배송안내
              </div>
              <p style={{ fontSize:13, color:'var(--color-ink-soft)', lineHeight:1.9 }}>
                기상 악화 및 교통 상황에 따라 부득이하게 배송이 지연될 수 있습니다.<br/>
                당사는 CJ 대한통운을 이용하고 있으며, 상황에 따라 타 택배사를 통해 배송될 수 있습니다.<br/>
                신선 식품 특성 상 제주 및 도서 산간 지역은 배송이 불가합니다.<br/>
                주소 오기재 등으로 인한 반송·미배송 시에도 일정 기간 소요 시 자동 배송완료 처리됩니다.<br/>
                주말 및 공휴일은 상품을 출고하지 않습니다.<br/>
                단체 및 다량 주문 시 고객센터로 별도 문의 후 주문 바랍니다.
              </p>
            </div>

            <div style={{ marginBottom:32 }}>
              <div style={{ fontSize:14, fontWeight:700, paddingBottom:12,
                borderBottom:'1.5px solid var(--color-ink)', marginBottom:16 }}>
                교환 및 반품정보
              </div>
              <p style={{ fontSize:13, color:'var(--color-ink-soft)', lineHeight:1.9 }}>
                신선 식품 특성 상 단순 변심 / 주문 착오 / 개인 정보 오기재 / 수취인 연락 부재의 경우
                교환 및 반품이 불가합니다.<br/>
                품질 및 배송 관련 문제가 있는 경우 수령 후 1~2일 이내, 이미지를 첨부하여
                고객센터로 문의바랍니다.<br/>
                교환 및 반품 희망 시 상담원에게 먼저 문의해 주세요.
              </p>
            </div>

            <div style={{ background:'var(--color-bg)', borderRadius:12,
              padding:16, textAlign:'center' }}>
              <div style={{ fontSize:13, fontWeight:700, marginBottom:6 }}>고객센터</div>
              <div style={{ fontSize:12, color:'var(--color-ink-mute)' }}>
                02-6925-2311 · 평일 09:00~18:00
              </div>
            </div>
          </div>
        )}

        {/* ③ 후기 */}
        {activeTab === 2 && (
          <div id="tabReviews" className="tab-content container">
            <a id="reviews" />

            {/* 헤더 */}
            <div style={{ display:'flex', alignItems:'center',
              justifyContent:'space-between', marginBottom:20 }}>
              <span style={{ fontSize:18, fontWeight:700 }}>리뷰</span>
              <button
                onClick={() => { if (!user) { router.push('/login'); return; } setReviewModalOpen(true); }}
                style={{ padding:'8px 16px', border:'1.5px solid #D0D0CC', borderRadius:8,
                  background:'#fff', fontSize:13, fontWeight:600, cursor:'pointer',
                  color:'var(--color-ink)' }}>
                리뷰 작성하기
              </button>
            </div>

            {/* 평점 요약 박스 */}
            {product.review_count > 0 && (
              <div style={{ display:'flex', border:'1px solid #E8E8E6', borderRadius:12,
                overflow:'hidden', marginBottom:20 }}>

                {/* 좌: 평점 수치 — 총평점 | 전체리뷰 좌우 2열 */}
                <div style={{ width:'28%', flexShrink:0, padding:'18px 16px',
                  borderRight:'1px solid #E8E8E6',
                  display:'flex', flexDirection:'column', alignSelf:'stretch' }}>
                  {/* 레이블 행 */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr',
                    gap:'0 8px' }}>
                    <div style={{ textAlign:'center', fontSize:11,
                      color:'var(--color-ink-mute)', fontWeight:600 }}>총 평점</div>
                    <div style={{ textAlign:'center', fontSize:11,
                      color:'var(--color-ink-mute)', fontWeight:600 }}>전체 리뷰 수</div>
                  </div>
                  {/* 수치 행 */}
                  <div style={{ flex:1, display:'flex', alignItems:'center',
                    justifyContent:'center', marginTop:8 }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr',
                      gap:'0 8px', width:'100%' }}>
                      <div style={{ textAlign:'center' }}>
                        <div style={{ display:'flex', alignItems:'baseline',
                          justifyContent:'center', gap:2 }}>
                          <SingleStar size={18} color="#CB1D11" />
                          <span style={{ fontSize:26, fontWeight:800, lineHeight:1,
                            color:'var(--color-ink)' }}>
                            {product.avg_rating.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <div style={{ textAlign:'center' }}>
                        <span style={{ fontSize:24, fontWeight:700, lineHeight:1,
                          color:'var(--color-ink)' }}>
                          {product.review_count.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 우: 바 차트 */}
                <div style={{ flex:1, minWidth:0, padding:'16px 20px',
                  display:'flex', flexDirection:'column',
                  justifyContent:'center', gap:7 }}>
                  {ratingDist.map(r => {
                    const pct = product.review_count > 0
                      ? Math.round(r.count / product.review_count * 100) : 0;
                    return (
                      <div key={r.label}
                        style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:12, color:'var(--color-ink-mute)',
                          width:62, flexShrink:0 }}>{r.label}</span>
                        <div style={{ flex:1, minWidth:0, height:7, background:'#EBEBEB',
                          borderRadius:99, overflow:'hidden' }}>
                          <div style={{
                            width:`${pct}%`, height:'100%', borderRadius:99,
                            background: pct > 50 ? '#CB1D11' : '#C8C8C4',
                          }} />
                        </div>
                        <span style={{ fontSize:12, color:'var(--color-ink-mute)',
                          width:40, textAlign:'right', flexShrink:0 }}>
                          {r.count.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 정렬 탭 */}
            <div style={{ display:'flex', justifyContent:'flex-end', gap:4,
              marginBottom:16, borderBottom:'1px solid #EBEBEB', paddingBottom:12 }}>
              {(['최신순','추천순','평점순'] as const).map((label, i) => {
                const val: SortKey = (['latest','helpful','rating'] as SortKey[])[i];
                const active = reviewSort === val;
                return (
                  <button key={label} onClick={() => setReviewSort(val)}
                    style={{ padding:'5px 12px', borderRadius:99,
                      border:`1px solid ${active ? 'var(--color-ink)' : '#DDDDD9'}`,
                      background: active ? 'var(--color-ink)' : '#fff',
                      color: active ? '#fff' : 'var(--color-ink-mute)',
                      fontSize:12, fontWeight:600, cursor:'pointer' }}>
                    {label}
                  </button>
                );
              })}
            </div>

            {/* ✅ 포토/영상 리뷰 그리드 (원본 구조 그대로) */}
            {product.review_count > 0 && (
              <div style={{ marginBottom:20 }}>
                <div style={{ display:'flex', alignItems:'center',
                  justifyContent:'space-between', marginBottom:12 }}>
                  <span style={{ fontSize:13, fontWeight:700 }}>
                    고객님들의 포토/영상 리뷰 ({photoReviewCount.toLocaleString()})
                  </span>
                  <button onClick={() => alert('전체보기')}
                    style={{ fontSize:12, color:'var(--color-ink-mute)',
                      background:'none', border:'none', cursor:'pointer', padding:0,
                      textDecoration:'none' }}>
                    전체보기
                  </button>
                </div>
                <div style={{ display:'flex', gap:4, width:'100%' }}>
                  {photoColors.slice(0, 7).map((c, i) => (
                    <div key={i}
                      onClick={() => alert('사진 미리보기')}
                      style={{ flex:1, aspectRatio:'1', borderRadius:6, cursor:'pointer',
                        background:`linear-gradient(135deg,${c},#fff)`,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:'clamp(18px,3vw,28px)',
                        border:'1px solid rgba(0,0,0,0.06)', overflow:'hidden' }}>
                      {emoji}
                    </div>
                  ))}
                  {photoReviewCount > 8 && (
                    <div onClick={() => alert('전체보기')}
                      style={{ flex:1, aspectRatio:'1', position:'relative',
                        borderRadius:6, overflow:'hidden', cursor:'pointer' }}>
                      <div style={{ width:'100%', height:'100%',
                        background:`linear-gradient(135deg,${bg},#fff)`,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:'clamp(18px,3vw,28px)' }}>
                        {emoji}
                      </div>
                      <div style={{ position:'absolute', inset:0,
                        background:'rgba(0,0,0,0.45)',
                        display:'flex', flexDirection:'column',
                        alignItems:'center', justifyContent:'center', gap:3 }}>
                        <span style={{ fontSize:'clamp(13px,2vw,18px)',
                          fontWeight:700, color:'#fff' }}>+더보기</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ✅ 리뷰 수 + 포토 필터 (원본 구조 그대로) */}
            <div style={{ display:'flex', alignItems:'center',
              justifyContent:'space-between', padding:'12px 0',
              borderTop:'1px solid #EBEBEB', borderBottom:'1px solid #EBEBEB',
              marginBottom:4 }}>
              <span style={{ fontSize:14, fontWeight:700 }}>
                리뷰 {product.review_count.toLocaleString()}건
              </span>
              <label style={{ display:'flex', alignItems:'center', gap:6,
                fontSize:13, color:'var(--color-ink-mute)', cursor:'pointer' }}>
                <span
                  onClick={() => setPhotoFilterOn(v => !v)}
                  style={{ display:'inline-flex', alignItems:'center', justifyContent:'center',
                    width:18, height:18, borderRadius:'50%',
                    border: photoFilterOn ? 'none' : '1.5px solid #D0D0CC',
                    background: photoFilterOn ? 'var(--color-ink)' : '#fff',
                    fontSize:10,
                    color: photoFilterOn ? '#fff' : 'var(--color-ink-mute)',
                    cursor:'pointer' }}>
                  ✓
                </span>
                포토 리뷰 먼저 보기
              </label>
            </div>

            {/* 리뷰 카드 */}
            {reviews.length === 0 ? (
              <p style={{ color:'#999', textAlign:'center', padding:'40px 0' }}>
                아직 리뷰가 없습니다.
              </p>
            ) : (
              sortedReviews.map(r => (
                <div key={r.id} style={{ padding:'20px 0', borderBottom:'1px solid #EBEBEB' }}>
                  <div style={{ display:'flex', alignItems:'flex-start',
                    justifyContent:'space-between', marginBottom:6 }}>
                    <div>
                      <StarRating rating={r.rating} size={15} />
                      <span style={{ fontSize:14, fontWeight:700, marginLeft:6 }}>
                        {ratingLabel(r.rating)}
                      </span>
                    </div>
                    <span style={{ fontSize:12, color:'var(--color-ink-mute)',
                      textAlign:'right', flexShrink:0, marginLeft:8 }}>
                      {r.profiles?.name
                        ? `${r.profiles.name.charAt(0)}**** 님이 작성`
                        : '익명 님이 작성'
                      }{' '}|{' '}
                      {new Date(r.created_at).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                  {r.is_best && (
                    <span style={{ display:'inline-block', marginBottom:8,
                      fontSize:11, fontWeight:700, background:'var(--color-accent)',
                      color:'#fff', borderRadius:4, padding:'2px 8px' }}>
                      BEST
                    </span>
                  )}
                  <p style={{ fontSize:14, color:'var(--color-ink)',
                    lineHeight:1.75, marginBottom:10 }}>
                    {r.content}
                  </p>
                  <div style={{ display:'flex', alignItems:'center',
                    justifyContent:'space-between' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                      <button onClick={() => alert('도움이 됐어요!')}
                        style={{ display:'flex', alignItems:'center', gap:5,
                          background:'none', border:'1px solid #DDDDD9',
                          borderRadius:99, padding:'5px 12px',
                          fontSize:12, color:'var(--color-ink-mute)', cursor:'pointer' }}>
                        <svg viewBox="0 0 24 24" width="13" height="13"
                          fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/>
                          <path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/>
                        </svg>
                        리뷰가 도움 됐어요 {r.likes_count || 0}
                      </button>
                      <button onClick={() => alert('댓글 기능 준비 중')}
                        style={{ background:'none', border:'none', fontSize:12,
                          color:'var(--color-ink-mute)', cursor:'pointer' }}>
                        댓글 0 ∨
                      </button>
                    </div>
                    <div style={{ display:'flex', gap:12 }}>
                      <button onClick={() => alert('신고 완료')}
                        style={{ background:'none', border:'none', fontSize:12,
                          color:'var(--color-ink-mute)', cursor:'pointer' }}>신고</button>
                      <button onClick={() => alert('차단 완료')}
                        style={{ background:'none', border:'none', fontSize:12,
                          color:'var(--color-ink-mute)', cursor:'pointer' }}>차단</button>
                    </div>
                  </div>
                </div>
              ))
            )}

            <div className="pd-pagination">
              {[1,2,3,4,5].map(n => (
                <button key={n}
                  className={`pd-page-btn${n === 1 ? ' active' : ''}`}>{n}</button>
              ))}
            </div>
          </div>
        )}

        {/* ④ 문의 */}
        {activeTab === 3 && (
          <div id="tabQna" className="tab-content container">
            <div className="qna-header">
              <div className="qna-header-title">Q&A</div>
              <div className="qna-header-sub">상품의 궁금한 점을 해결해 드립니다.</div>
            </div>

            {/* Q&A 목록 (원본 테이블 구조) */}
            {[
              { no:26, answered:false, category:'배송관련', user:'이****', date:'2026-04-29', time:'14:21:22', count:1 },
              { no:25, answered:true,  category:'배송관련', user:'뉴지트',  date:'2026-04-29', time:'17:43:25', count:0 },
              { no:24, answered:false, category:'문의',     user:'이****', date:'2026-04-03', time:'04:54:21', count:4 },
              { no:23, answered:true,  category:'문의',     user:'뉴지트',  date:'2026-04-03', time:'09:07:55', count:1 },
              { no:22, answered:false, category:'리뷰 🔒', user:'윤****', date:'2026-03-28', time:'07:43:58', count:2 },
            ].map(q => (
              <div key={q.no} className="qna-row">
                <div className="qna-no">{q.no}</div>
                <div className="qna-content">
                  {q.answered && <span className="qna-badge-ans">답변</span>}
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none"
                    stroke="currentColor" strokeWidth="2"
                    style={{ flexShrink:0, color:'var(--color-ink-soft)' }}>
                    <rect x="3" y="11" width="18" height="11" rx="2"/>
                    <path d="M7 11V7a5 5 0 0110 0v4"/>
                  </svg>
                  <span className="qna-category">{q.category}</span>
                </div>
                <div className="qna-user">{q.user}</div>
                <div className="qna-datetime">{q.date}<br/>{q.time}</div>
                <div className="qna-count">{q.count}</div>
              </div>
            ))}

            <div className="qna-actions">
              <button className="qna-btn-filled"
                onClick={() => { if (!user) { router.push('/login'); return; }
                  alert('문의 기능은 준비 중입니다.'); }}>
                상품문의하기
              </button>
            </div>

            <div className="pd-pagination">
              <button className="pd-page-btn arrow">«</button>
              <button className="pd-page-btn arrow">‹</button>
              {[1,2,3,4,5].map(n => (
                <button key={n}
                  className={`pd-page-btn${n === 1 ? ' active' : ''}`}>{n}</button>
              ))}
              <button className="pd-page-btn arrow">›</button>
              <button className="pd-page-btn arrow">»</button>
            </div>
          </div>
        )}
      </div>

      {/* ── 리뷰 작성 모달 ── */}
      {reviewModalOpen && (
        <div
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000,
            display:'flex', alignItems:'flex-end', justifyContent:'center' }}
          onClick={() => setReviewModalOpen(false)}
        >
          <div
            style={{ background:'#fff', width:'100%', maxWidth:600,
              borderRadius:'20px 20px 0 0',
              padding:'28px 24px 40px', boxShadow:'0 -8px 40px rgba(0,0,0,.15)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display:'flex', alignItems:'center',
              justifyContent:'space-between', marginBottom:20 }}>
              <span style={{ fontSize:16, fontWeight:700 }}>리뷰 작성</span>
              <button onClick={() => setReviewModalOpen(false)}
                style={{ background:'none', border:'none', fontSize:22, cursor:'pointer',
                  color:'var(--color-ink-mute)', lineHeight:1, padding:'0 4px' }}>
                ✕
              </button>
            </div>

            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:10,
                color:'var(--color-ink-soft)' }}>
                별점 선택
              </div>
              <div style={{ display:'flex', gap:4 }}>
                {[1,2,3,4,5].map(s => (
                  <button key={s} onClick={() => setNewRating(s)}
                    style={{ background:'none', border:'none', cursor:'pointer',
                      padding:2, lineHeight:1, transition:'opacity .1s' }}>
                    <svg width={32} height={32} viewBox="0 0 20 20"
                      style={{ display:'block' }}>
                      <polygon
                        points="10,1.5 12.65,7.18 19,8.09 14.5,12.49 15.78,18.82 10,15.72 4.22,18.82 5.5,12.49 1,8.09 7.35,7.18"
                        fill={s <= newRating ? '#F5A623' : '#E0DFDB'}
                        strokeLinejoin="round" strokeLinecap="round"
                        style={{ transition:'fill .1s' }}
                      />
                    </svg>
                  </button>
                ))}
                <span style={{ fontSize:14, fontWeight:700, color:'var(--color-ink-soft)',
                  alignSelf:'center', marginLeft:4 }}>
                  {['', '아쉬워요', '그냥 그래요', '괜찮아요', '정말 좋아요', '최고에요'][newRating]}
                </span>
              </div>
            </div>

            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:8,
                color:'var(--color-ink-soft)' }}>
                리뷰 내용
              </div>
              <textarea
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                placeholder="상품 품질, 맛, 배송 등 솔직한 후기를 남겨주세요. (최소 10자)"
                rows={5}
                style={{ width:'100%', padding:'12px 14px', border:'1.5px solid #E8E8E6',
                  borderRadius:10, fontSize:14, lineHeight:1.7, resize:'none', outline:'none',
                  fontFamily:'inherit', boxSizing:'border-box', color:'var(--color-ink)' }}
              />
              <div style={{ fontSize:12, color:'#bbb', textAlign:'right', marginTop:4 }}>
                {newContent.length}자
              </div>
            </div>

            <button
              onClick={handleSubmitReview}
              disabled={submitting || newContent.trim().length < 10}
              style={{ width:'100%', padding:'15px', background:'var(--color-accent)',
                color:'#fff', border:'none', borderRadius:10, fontSize:15, fontWeight:700,
                cursor: (submitting || newContent.trim().length < 10) ? 'not-allowed' : 'pointer',
                opacity: (submitting || newContent.trim().length < 10) ? 0.6 : 1,
                transition:'opacity .15s' }}>
              {submitting ? '등록 중...' : '리뷰 등록하기'}
            </button>
          </div>
        </div>
      )}

      {/* ── 모바일 고정 CTA ── */}
      <div className="mobile-cta-bar">
        <button className="btn btn-secondary btn-flex-1" onClick={handleAddCart}>
          장바구니
        </button>
        <button className="btn btn-primary btn-flex-2" onClick={handleBuyNow}>
          바로 구매하기
        </button>
      </div>
    </>
  );
}
