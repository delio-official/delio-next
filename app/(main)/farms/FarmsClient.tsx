'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import ComingSoon from '@/components/ComingSoon/ComingSoon';
import { FarmCard } from '@/components/FarmCard';
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
        .eq('is_own', false) // 자사센터(델리오) 제외 — 파트너농가만 노출
        .order('name');
      setFarms((data as Farm[]) || []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <main style={{ background: '#fff', minHeight: '100vh', paddingBottom: 80 }}>

      {/* 히어로 — nav(카테고리~취향진단)와 동일 너비 박스 */}
      <div className="container" style={{ paddingTop: 24 }}>
        <div style={{
          background: 'linear-gradient(135deg,#F4EFE6 0%,#EDE8DC 100%)',
          padding: '40px 28px 32px', borderRadius: 16, border: '1px solid #E8E2D8',
        }}>
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
                  <div style={{ aspectRatio: '4 / 5', background: '#E8E8E6' }} />
                  <div style={{ padding: 20 }}>
                    <div style={{ height: 18, background: '#E8E8E6', borderRadius: 4, marginBottom: 10, width: '60%' }} />
                    <div style={{ height: 13, background: '#E8E8E6', borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : farms.length === 0 ? (
            <ComingSoon
              title="파트너 농가를 준비중입니다."
              desc={['좋은 농가를 모시고 있어요.', '빠른 시일 내에 찾아뵙겠습니다.']}
            />
          ) : (
            <div className="farms-grid">
              {farms.map(farm => <FarmCard key={farm.id} farm={farm} />)}
            </div>
          )}

          {/* 하단 CTA — 입점 문의 */}
          <div style={{ marginTop: 64, paddingTop: 48, borderTop: '1px solid #EEE', textAlign: 'center' }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>파트너 농가 입점 문의</h2>
            <p style={{ fontSize: 14, color: '#666', lineHeight: 1.8, marginBottom: 26 }}>
              좋은 농산물을 키우고 계신가요?<br />
              델리오와 함께 더 많은 소비자에게 소개해보세요.
            </p>
            <Link href="/inquiry" style={{ display: 'inline-block', padding: '13px 40px',
              background: '#fff', color: '#1A1A1A', border: '1px solid #1A1A1A', borderRadius: 8,
              fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
              입점/협업 문의하기
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
