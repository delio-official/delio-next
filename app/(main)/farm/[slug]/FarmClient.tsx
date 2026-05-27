'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { addToCart } from '@/lib/cart';

interface Farm {
  id: string; slug: string; name: string; region: string; farm_type: string;
  intro: string | null; story: string | null;
  thumbnail_url: string | null; hero_image_url: string | null;
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
}

const EMOJI_MAP: Record<string, string> = {
  apple:'🍎', citrus:'🍊', berry:'🫐', melon:'🍈',
  kiwi:'🥝', mango:'🥭', grape:'🍇', gift:'🎁', default:'🍑',
};
function fmtPrice(n: number) { return n.toLocaleString('ko-KR'); }

export default function FarmClient() {
  const { slug } = useParams() as { slug: string };
  const router = useRouter();

  const [farm, setFarm] = useState<Farm | null>(null);
  const [certs, setCerts] = useState<Certification[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!slug) return;
      const supabase = createClient();

      const { data: farmData } = await supabase
        .from('farms').select('*').eq('slug', slug).single();
      if (!farmData) { router.push('/category?origin=domestic'); return; }
      setFarm(farmData as Farm);

      const [{ data: certData }, { data: gallData }, { data: prodData }] = await Promise.all([
        supabase.from('farm_certifications').select('*').eq('farm_id', farmData.id).order('sort_order'),
        supabase.from('farm_gallery').select('*').eq('farm_id', farmData.id).order('sort_order'),
        supabase.from('products').select('*').eq('farm_id', farmData.id).eq('is_active', true).limit(8),
      ]);

      setCerts((certData as Certification[]) || []);
      setGallery((gallData as GalleryItem[]) || []);
      setProducts((prodData as Product[]) || []);
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
      {/* ── 히어로 ── */}
      <div style={{
        background: farm.hero_image_url
          ? `url(${farm.hero_image_url}) center/cover`
          : 'linear-gradient(135deg, #2d5a27, #3d7a35)',
        minHeight: 320, display:'flex', alignItems:'flex-end', position:'relative',
      }}>
        <div style={{
          position:'absolute', inset:0,
          background:'linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.1) 60%)',
        }} />
        <div className="container" style={{ position:'relative', paddingBottom:36, paddingTop:36 }}>
          <button onClick={() => router.back()}
            style={{ background:'rgba(255,255,255,0.2)', border:'1.5px solid rgba(255,255,255,0.4)',
              borderRadius:8, color:'#fff', padding:'8px 14px', fontSize:13, cursor:'pointer',
              marginBottom:20, display:'flex', alignItems:'center', gap:6 }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            뒤로
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <div style={{
              width:72, height:72, borderRadius:16, background:'rgba(255,255,255,0.15)',
              border:'2px solid rgba(255,255,255,0.3)',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:36,
            }}>{emoji}</div>
            <div>
              <p style={{ color:'rgba(255,255,255,0.75)', fontSize:13, marginBottom:4 }}>
                {farm.region} · 파트너 농가
              </p>
              <h1 style={{ color:'#fff', fontSize:'clamp(22px,4vw,34px)', fontWeight:800, marginBottom:4 }}>
                {farm.name}
              </h1>
              {farm.intro && (
                <p style={{ color:'rgba(255,255,255,0.85)', fontSize:14, lineHeight:1.6 }}>{farm.intro}</p>
              )}
            </div>
          </div>
        </div>
      </div>

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
            <h2 style={{ fontSize:20, fontWeight:700, marginBottom:16, borderLeft:'3px solid var(--color-accent)', paddingLeft:12 }}>
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
            <h2 style={{ fontSize:20, fontWeight:700, marginBottom:16, borderLeft:'3px solid var(--color-accent)', paddingLeft:12 }}>
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
            <h2 style={{ fontSize:20, fontWeight:700, marginBottom:16, borderLeft:'3px solid var(--color-accent)', paddingLeft:12 }}>
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
            <h2 style={{ fontSize:20, fontWeight:700, marginBottom:16, borderLeft:'3px solid var(--color-accent)', paddingLeft:12 }}>
              {farm.name} 상품
            </h2>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:16 }}>
              {products.map(p => {
                const pEmoji = EMOJI_MAP[p.category] || EMOJI_MAP.default;
                return (
                  <Link key={p.id} href={`/product/${p.id}`}
                    style={{ textDecoration:'none', color:'inherit' }}>
                    <div style={{
                      borderRadius:12, overflow:'hidden',
                      border:'1px solid #EBEBEB', transition:'transform .15s, box-shadow .15s',
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform='translateY(-3px)'; (e.currentTarget as HTMLDivElement).style.boxShadow='0 6px 20px rgba(0,0,0,.08)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform='none'; (e.currentTarget as HTMLDivElement).style.boxShadow='none'; }}
                    >
                      <div style={{ aspectRatio:'1', background:'#F7F7F5',
                        display:'flex', alignItems:'center', justifyContent:'center', fontSize:48 }}>
                        {p.thumbnail_url
                          ? <img src={p.thumbnail_url} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                          : pEmoji
                        }
                      </div>
                      <div style={{ padding:'10px 12px' }}>
                        {p.badge && (
                          <span style={{ fontSize:11, background:'var(--color-accent)', color:'#fff',
                            padding:'2px 6px', borderRadius:4, marginBottom:4, display:'inline-block' }}>
                            {p.badge}
                          </span>
                        )}
                        <div style={{ fontSize:13, fontWeight:600, lineHeight:1.4, marginBottom:4 }}>{p.name}</div>
                        <div style={{ display:'flex', alignItems:'baseline', gap:4 }}>
                          {p.discount_rate > 0 && (
                            <span style={{ fontSize:12, fontWeight:700, color:'var(--color-accent)' }}>{p.discount_rate}%</span>
                          )}
                          <span style={{ fontSize:15, fontWeight:800 }}>{fmtPrice(p.discounted_price ?? p.price)}원</span>
                        </div>
                        <button
                          onClick={e => {
                            e.preventDefault();
                            addToCart({ id:p.id, name:p.name, price:p.discounted_price??p.price, quantity:1, thumbnail:p.thumbnail_url||'' });
                            alert('장바구니에 담겼습니다!');
                          }}
                          style={{ marginTop:8, width:'100%', padding:'7px', border:'1.5px solid var(--color-accent)',
                            borderRadius:6, color:'var(--color-accent)', background:'#fff',
                            fontSize:12, fontWeight:700, cursor:'pointer' }}>
                          담기
                        </button>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
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
              background:'var(--color-accent)', color:'#fff', borderRadius:8,
              fontWeight:700, textDecoration:'none', fontSize:14 }}>
            협업 문의하기
          </Link>
        </section>
      </div>
    </div>
  );
}
