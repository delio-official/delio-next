'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import '@/styles/index.css';

interface Farm {
  id: string; slug: string; name: string; region: string;
  farm_type: string; intro: string | null; thumbnail_url: string | null;
}
interface Product {
  id: string; name: string; price: number; discounted_price: number;
  discount_rate: number; thumbnail_url: string | null; category: string;
  farm_id: string;
}

const EMOJI_MAP: Record<string, string> = {
  apple: '🍎', citrus: '🍊', berry: '🫐', melon: '🍈',
  kiwi: '🥝', mango: '🥭', grape: '🍇', gift: '🎁', default: '🍑',
};

const BANNER_MAP: Record<string, string> = {
  citrus: 'bdc-banner-citrus', grape: 'bdc-banner-grape',
  berry:  'bdc-banner-berry',  apple:  'bdc-banner-apple',
};
const LOGO_MAP: Record<string, string> = {
  citrus: 'bdc-logo-citrus', grape: 'bdc-logo-grape',
  berry:  'bdc-logo-berry',  apple:  'bdc-logo-apple',
};
const THUMB_MAP: Record<string, string> = {
  citrus: 'bdc-thumb-citrus', grape: 'bdc-thumb-grape',
  berry:  'bdc-thumb-berry',  apple:  'bdc-thumb-apple',
};

function getBannerClass(type: string) { return BANNER_MAP[type] || 'bdc-banner-citrus'; }
function getLogoClass(type: string)   { return LOGO_MAP[type]   || 'bdc-logo-citrus';   }
function getThumbClass(type: string)  { return THUMB_MAP[type]  || 'bdc-thumb-citrus';  }

export default function BrandClient() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [prodMap, setProdMap] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      // 전체 농가 조회
      const { data: farmData } = await supabase
        .from('farms')
        .select('id, slug, name, region, farm_type, intro, thumbnail_url')
        .order('name');

      if (!farmData || farmData.length === 0) {
        setLoading(false);
        return;
      }

      const farms = farmData as Farm[];
      setFarms(farms);

      // 각 농가의 대표 상품 1개씩 조회
      const farmIds = farms.map(f => f.id);
      const { data: prodData } = await supabase
        .from('products')
        .select('id, name, price, discounted_price, discount_rate, thumbnail_url, category, farm_id')
        .in('farm_id', farmIds)
        .eq('is_active', true)
        .order('discount_rate', { ascending: false });

      // farm_id별 첫 번째 상품만 map으로 저장
      const map: Record<string, Product> = {};
      (prodData as Product[] || []).forEach(p => {
        if (!map[p.farm_id]) map[p.farm_id] = p;
      });
      setProdMap(map);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <main style={{ background: '#fff', minHeight: '100vh', paddingBottom: 80 }}>

      {/* 히어로 */}
      <div style={{
        background: 'linear-gradient(135deg,#F4EFE6 0%,#EDE8DC 100%)',
        padding: '48px 0 36px', borderBottom: '1px solid #E8E2D8',
      }}>
        <div className="container">
          <p style={{ fontSize: 11, color: '#A08060', fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>
            BRAND DIRECT SHOP
          </p>
          <h1 style={{ fontSize: 'clamp(24px,4vw,34px)', fontWeight: 800, marginBottom: 10 }}>
            브랜드 소개관
          </h1>
          <p style={{ fontSize: 14, color: '#666', lineHeight: 1.7 }}>
            델리오 파트너 농가가 직접 보내는 신선한 과일.<br />
            산지에서 내 식탁까지, 믿을 수 있는 브랜드를 소개합니다.
          </p>
          <div style={{ fontSize: 12, color: '#aaa', marginTop: 16 }}>
            <Link href="/" style={{ color: '#aaa', textDecoration: 'none' }}>홈</Link>
            <span style={{ margin: '0 6px' }}>/</span>
            <span style={{ color: '#555' }}>브랜드 소개관</span>
          </div>
        </div>
      </div>

      {/* 카드 그리드 */}
      <section className="brand-direct-section" style={{ paddingTop: 40 }}>
        <div className="container">

          {loading ? (
            /* 스켈레톤 */
            <div className="brand-direct-grid">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="brand-direct-card" style={{ opacity: 0.35 }}>
                  <div className="bdc-banner-wrap">
                    <div className="bdc-banner" style={{ background: '#E8E8E6' }} />
                  </div>
                  <div className="bdc-body">
                    <div style={{ height: 14, background: '#E8E8E6', borderRadius: 4, marginBottom: 10 }} />
                    <div style={{ height: 40, background: '#E8E8E6', borderRadius: 8 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : farms.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: '#bbb' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🌱</div>
              <p>등록된 파트너 농가가 없습니다.</p>
            </div>
          ) : (
            <div className="brand-direct-grid">
              {farms.map(farm => {
                const type    = farm.farm_type?.toLowerCase() || 'default';
                const emoji   = EMOJI_MAP[type] || EMOJI_MAP.default;
                const banner  = getBannerClass(type);
                const logo    = getLogoClass(type);
                const thumb   = getThumbClass(type);
                const repProd = prodMap[farm.id];

                return (
                  <div key={farm.id} className="brand-direct-card">
                    {/* 배너 */}
                    <div className="bdc-banner-wrap">
                      <div className={`bdc-banner ${banner}`}>
                        {farm.thumbnail_url
                          ? <img src={farm.thumbnail_url} alt={farm.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />
                          : <span className="bdc-emoji">{emoji}</span>
                        }
                      </div>
                    </div>

                    {/* 바디 */}
                    <div className="bdc-body">
                      {/* 브랜드 행 */}
                      <Link href={`/farm/${farm.slug}`} className="bdc-brand-row">
                        <div className={`bdc-brand-logo ${logo}`}><span>{emoji}</span></div>
                        <span className="bdc-brand-name">{farm.name}</span>
                        <svg className="bdc-arrow" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      </Link>

                      {/* 한 줄 설명 */}
                      {farm.intro && (
                        <p style={{ fontSize: 12, color: '#888', lineHeight: 1.6, margin: '8px 0 12px',
                          display: '-webkit-box', WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {farm.intro}
                        </p>
                      )}

                      {/* 지역 태그 */}
                      {farm.region && (
                        <div style={{ marginBottom: 12 }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700,
                            background: '#F4EFE6', color: '#A06030',
                            padding: '2px 8px', borderRadius: 20,
                          }}>
                            📍 {farm.region}
                          </span>
                        </div>
                      )}

                      {/* 대표 상품 행 */}
                      {repProd ? (
                        <Link href={`/product/${repProd.id}`} className="bdc-product-row">
                          <div className={`bdc-product-thumb ${thumb}`}>
                            {repProd.thumbnail_url
                              ? <img src={repProd.thumbnail_url} alt={repProd.name}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
                              : (EMOJI_MAP[repProd.category] || emoji)
                            }
                          </div>
                          <div className="bdc-product-info">
                            <div className="bdc-product-name">{repProd.name}</div>
                            <div className="bdc-product-price">
                              {repProd.discount_rate > 0 && (
                                <span className="bdc-discount">{repProd.discount_rate}%</span>
                              )}
                              {(repProd.discounted_price ?? repProd.price).toLocaleString()}원
                            </div>
                          </div>
                        </Link>
                      ) : (
                        <div className="bdc-product-row" style={{ opacity: 0.4, pointerEvents: 'none' }}>
                          <div className={`bdc-product-thumb ${thumb}`}>{emoji}</div>
                          <div className="bdc-product-info">
                            <div className="bdc-product-name">상품 준비 중</div>
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 하단 CTA */}
          <div style={{
            marginTop: 56, borderRadius: 20, padding: '40px 32px', textAlign: 'center',
            background: 'linear-gradient(135deg,#F4EFE6,#EDE8DC)',
          }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>🌱</div>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>파트너 농가 입점 문의</h2>
            <p style={{ fontSize: 13, color: '#666', lineHeight: 1.7, marginBottom: 22 }}>
              좋은 농산물을 키우고 계신가요?<br />
              델리오와 함께 더 많은 소비자에게 소개해보세요.
            </p>
            <Link href="/inquiry" style={{
              display: 'inline-block', padding: '12px 30px',
              background: 'var(--color-accent)', color: '#fff',
              borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: 'none',
            }}>
              입점/협업 문의하기 →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
