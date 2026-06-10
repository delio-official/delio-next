'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { PRODUCT_PUBLIC_COLS } from '@/lib/productCols';
import { openOptionDrawer } from '@/lib/cart';
import { isWishlisted, toggleWishlist } from '@/lib/wishlist';
import { useLoginGuard } from '@/hooks/useLoginGuard';
import { SingleStar } from '@/components/StarRating';
import '@/styles/category.css';

interface Farm {
  id: string; slug: string; name: string; region: string; farm_type: string;
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
  discounted_price: number; thumbnail_url: string | null; badge: string | null;
  avg_rating: number; review_count: number; category: string;
  is_dawn: boolean; is_new: boolean; is_best: boolean; short_desc: string | null;
}

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
  useEffect(() => { isWishlisted(p.id).then(setWished); }, [p.id]);

  const reviewCount = p.review_count > 9999
    ? (p.review_count / 10000).toFixed(1) + '만'
    : p.review_count.toLocaleString('ko-KR');

  return (
    <Link href={`/product/${p.id}`} className="product-card">
      <div className="product-card-img">
        {p.thumbnail_url
          ? <img src={p.thumbnail_url} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          : <div className="fruit-emoji" style={{ background:`linear-gradient(135deg,${bg} 0%,#fff 100%)` }}>{emoji}</div>
        }
        <span className={`product-card-delivery ${deliveryClass}`}>{deliveryLabel}</span>
        <div className="product-card-actions">
          <button className="product-card-wish" onClick={async e => { e.preventDefault(); if (!requireLogin()) return; setWished(await toggleWishlist(p.id)); }}>
            <span style={{ color: wished ? '#E53935' : undefined }}>{wished ? '♥' : '♡'}</span> 찜
          </button>
          <span className="product-card-actions-divider" />
          <button className="cart-btn" onClick={e => { e.preventDefault(); e.stopPropagation(); if (!requireLogin()) return; openOptionDrawer(p.id); }}>
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

  const [farm, setFarm] = useState<Farm | null>(null);
  const [certs, setCerts] = useState<Certification[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [prodPage, setProdPage] = useState(0);
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
        supabase.from('products').select(PRODUCT_PUBLIC_COLS).eq('farm_id', farmData.id).eq('is_active', true).limit(60),
      ]);

      setCerts((certData as Certification[]) || []);
      setGallery((gallData as GalleryItem[]) || []);
      setProducts((prodData as unknown as Product[]) || []);
      setLoading(false);
    }
    load();
  }, [slug, router]);

  if (loading || !farm) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:300 }}>
        <p style={{ color:'#999' }}>불러오는 중...</p>
      </div>
    );
  }

  const emoji = EMOJI_MAP[farm.farm_type?.toLowerCase()] || EMOJI_MAP.default;

  return (
    <div style={{ background:'#fff', minHeight:'100vh' }}>
      {/* ── 상단: 좌 농가명·설명 / 우 썸네일 (카드) ── */}
      <div className="container" style={{ paddingTop:36, paddingBottom:28 }}>
        <div style={{ display:'flex', gap:28, flexWrap:'wrap', alignItems:'center',
          border:'1px solid #EEECE7', borderRadius:18, padding:'24px 26px', background:'#fff' }}>
          <div style={{ flex:'1 1 300px', minWidth:0 }}>
            <p style={{ fontSize:12.5, color:'#9A8F7E', fontWeight:600, marginBottom:10 }}>{farm.region ? `${farm.region} · ` : ''}파트너 농가</p>
            <h1 style={{ fontSize:'clamp(22px,2.6vw,30px)', fontWeight:800, marginBottom:16, lineHeight:1.3 }}>{farm.name}</h1>
            {farm.intro && (
              <p style={{ fontSize:14.5, lineHeight:1.85, color:'#555', whiteSpace:'pre-line' }}>{farm.intro}</p>
            )}
            {farm.farmer_name && (
              <p style={{ fontSize:13, color:'#999', marginTop:16 }}>농부 · {farm.farmer_name}</p>
            )}
          </div>
          <div style={{ flex:'1.3 1 360px', minWidth:0 }}>
            {farm.thumbnail_url ? (
              <img src={farm.thumbnail_url} alt={farm.name}
                style={{ width:'100%', aspectRatio:'16/10', objectFit:'cover', borderRadius:14, display:'block' }} />
            ) : (
              <div style={{ width:'100%', aspectRatio:'16/10', borderRadius:14, background:'linear-gradient(135deg,#2d5a27,#3d7a35)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:72 }}>{emoji}</div>
            )}
          </div>
        </div>
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

      {/* ── 농가 정보 요약 ── */}
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
                    ? <img src={g.image_url} alt={g.caption || ''} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
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
            <h2 style={{ fontSize:20, fontWeight:700, marginBottom:16, borderLeft:'3px solid #1A1A1A', paddingLeft:12 }}>
              {farm.name} 상품
            </h2>
            <div className="product-grid">
              {products.slice(prodPage * PROD_PER_PAGE, (prodPage + 1) * PROD_PER_PAGE).map(p => (
                <FarmProductCard key={p.id} p={p} />
              ))}
            </div>
            <Pagination total={products.length} perPage={PROD_PER_PAGE} page={prodPage} onChange={setProdPage} />
          </section>
        )}

        {/* ── 입점 문의 ── */}
        <section style={{
          background:'#F7F7F5', borderRadius:16, padding:'28px 24px', textAlign:'center',
        }}>
          <h3 style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>이 농가에 관심이 있으신가요?</h3>
          <p style={{ fontSize:14, color:'#666', marginBottom:20 }}>
            파트너 농가 협업 및 입점 문의는 아래 버튼을 통해 접수해주세요.
          </p>
          <Link href="/inquiry"
            style={{ display:'inline-block', padding:'12px 28px',
              background:'#1A1A1A', color:'#fff', borderRadius:8,
              fontWeight:700, textDecoration:'none', fontSize:14 }}>
            협업 문의하기
          </Link>
        </section>
      </div>
    </div>
  );
}
