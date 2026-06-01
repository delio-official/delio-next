'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import '@/styles/index.css';

interface Farm {
  id: string; slug: string; name: string; region: string;
  farm_type: string; intro: string | null; thumbnail_url: string | null;
}

const EMOJI_MAP: Record<string, string> = {
  apple: '🍎', citrus: '🍊', berry: '🫐', melon: '🍈',
  kiwi: '🥝', mango: '🥭', grape: '🍇', gift: '🎁', default: '🍑',
};
const TYPE_LABEL: Record<string, string> = {
  apple: '사과', citrus: '감귤류', berry: '베리류', melon: '참외/멜론',
  kiwi: '키위', mango: '망고', grape: '포도',
};

export default function FarmsClient() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from('farms')
        .select('id, slug, name, region, farm_type, intro, thumbnail_url')
        .order('name');
      setFarms((data as Farm[]) || []);
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
            PARTNER FARM
          </p>
          <h1 style={{ fontSize: 'clamp(24px,4vw,34px)', fontWeight: 800, marginBottom: 10 }}>
            파트너 농가
          </h1>
          <p style={{ fontSize: 14, color: '#666', lineHeight: 1.7 }}>
            델리오가 직접 계약한 믿을 수 있는 농가입니다.<br />
            각 농가의 이야기와 철학을 만나보세요.
          </p>
          <div style={{ fontSize: 12, color: '#aaa', marginTop: 16 }}>
            <Link href="/" style={{ color: '#aaa', textDecoration: 'none' }}>홈</Link>
            <span style={{ margin: '0 6px' }}>/</span>
            <Link href="/brand-intro" style={{ color: '#aaa', textDecoration: 'none' }}>브랜드 소개관</Link>
            <span style={{ margin: '0 6px' }}>/</span>
            <span style={{ color: '#555' }}>파트너 농가</span>
          </div>
        </div>
      </div>

      {/* 농가 목록 */}
      <section style={{ paddingTop: 40 }}>
        <div className="container">
          {loading ? (
            <div className="farms-grid">
              {[0,1,2,3].map(i => (
                <div key={i} style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #F0F0EE', opacity: 0.4 }}>
                  <div style={{ aspectRatio: '3 / 4', background: '#E8E8E6' }} />
                  <div style={{ padding: 20 }}>
                    <div style={{ height: 18, background: '#E8E8E6', borderRadius: 4, marginBottom: 10, width: '60%' }} />
                    <div style={{ height: 13, background: '#E8E8E6', borderRadius: 4 }} />
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
            <div className="farms-grid">
              {farms.map(farm => {
                const type = farm.farm_type?.toLowerCase() || 'default';
                const emoji = EMOJI_MAP[type] || EMOJI_MAP.default;
                const typeLabel = TYPE_LABEL[type] || '과일';

                return (
                  <Link key={farm.id} href={`/farm/${farm.slug}`}
                    style={{ textDecoration: 'none', color: 'inherit', display: 'block',
                      borderRadius: 16, overflow: 'hidden', border: '1px solid #F0F0EE',
                      transition: 'box-shadow .2s' }}
                    onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>

                    {/* 썸네일 — 세로형 (농부 얼굴 사진용) */}
                    <div style={{ aspectRatio: '3 / 4', background: 'linear-gradient(135deg,#F4EFE6,#EDE8DC)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      position: 'relative', overflow: 'hidden' }}>
                      {farm.thumbnail_url
                        ? <img src={farm.thumbnail_url} alt={farm.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: 56 }}>{emoji}</span>}
                      <span style={{ position: 'absolute', top: 12, left: 12,
                        fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,0.9)',
                        color: '#A06030', padding: '3px 9px', borderRadius: 20 }}>
                        {typeLabel}
                      </span>
                    </div>

                    {/* 정보 */}
                    <div style={{ padding: '18px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 16, fontWeight: 800 }}>{farm.name}</span>
                        {farm.region && (
                          <span style={{ fontSize: 11, color: '#888', background: '#F5F5F5',
                            padding: '2px 7px', borderRadius: 10 }}>📍 {farm.region}</span>
                        )}
                      </div>
                      {farm.intro && (
                        <p style={{ fontSize: 13, color: '#666', lineHeight: 1.6, margin: 0,
                          display: '-webkit-box', WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
                          {farm.intro}
                        </p>
                      )}
                      <div style={{ marginTop: 14, fontSize: 13, fontWeight: 700, color: '#1A1A1A',
                        display: 'flex', alignItems: 'center', gap: 4 }}>
                        농가 스토리 보기
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* 하단 CTA */}
          <div style={{ marginTop: 56, borderRadius: 20, padding: '40px 32px', textAlign: 'center',
            background: 'linear-gradient(135deg,#F4EFE6,#EDE8DC)' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>🌱</div>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>파트너 농가 입점 문의</h2>
            <p style={{ fontSize: 13, color: '#666', lineHeight: 1.7, marginBottom: 22 }}>
              좋은 농산물을 키우고 계신가요?<br />
              델리오와 함께 더 많은 소비자에게 소개해보세요.
            </p>
            <Link href="/inquiry" style={{ display: 'inline-block', padding: '12px 30px',
              background: '#1A1A1A', color: '#fff', borderRadius: 10, fontWeight: 700,
              fontSize: 14, textDecoration: 'none' }}>
              입점/협업 문의하기 →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
