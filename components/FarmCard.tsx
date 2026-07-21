'use client';

import Link from 'next/link';
import { imgThumb } from '@/lib/img';

/* 파트너 농가 공용 카드 (농가 목록 / 위시리스트 공통) */
export interface FarmCardItem {
  slug: string;
  name: string;
  region: string | null;
  farm_type: string | null;      // 사용 안 함(과거 노지/비닐하우스)
  items?: string[] | null;       // 취급 품목(복수)
  thumbnail_url: string | null;
  intro: string | null;
}

/* 품목명(한글) → 이모지. 부분일치로 찾음(예: '유기농 블루베리' → 🫐) */
const ITEM_EMOJI: Array<[string, string]> = [
  ['사과', '🍎'], ['감귤', '🍊'], ['귤', '🍊'], ['블루베리', '🫐'], ['베리', '🫐'],
  ['참외', '🍈'], ['멜론', '🍈'], ['키위', '🥝'], ['망고', '🥭'], ['포도', '🍇'],
  ['토마토', '🍅'], ['복숭아', '🍑'], ['배', '🍐'], ['수박', '🍉'], ['딸기', '🍓'],
];
function emojiOf(items: string[]): string {
  for (const it of items) {
    const hit = ITEM_EMOJI.find(([k]) => it.includes(k));
    if (hit) return hit[1];
  }
  return '🍑';
}

export function FarmCard({ farm, onRemove }: { farm: FarmCardItem; onRemove?: () => void }) {
  const items = farm.items || [];
  const emoji = emojiOf(items);
  const typeLabel = items.length ? items.join(' · ') : '과일';

  return (
    <Link href={`/farm/${farm.slug}`}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block',
        borderRadius: 16, overflow: 'hidden', border: '1px solid #F0F0EE',
        transition: 'box-shadow .2s' }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>

      {/* 썸네일 — 세로형 (농부 얼굴 사진용) */}
      <div style={{ aspectRatio: '4 / 5', background: 'linear-gradient(135deg,#F4EFE6,#EDE8DC)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden' }}>
        {farm.thumbnail_url
          ? <img src={imgThumb(farm.thumbnail_url, 400)} alt={farm.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: 56 }}>{emoji}</span>}
        <span style={{ position: 'absolute', top: 12, left: 12,
          fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,0.9)',
          color: '#A06030', padding: '3px 9px', borderRadius: 20 }}>
          {typeLabel}
        </span>
        {onRemove && (
          <button onClick={e => { e.preventDefault(); e.stopPropagation(); onRemove(); }}
            aria-label="찜 해제"
            style={{ position: 'absolute', top: 10, right: 10, width: 32, height: 32,
              borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.92)',
              color: '#E53935', fontSize: 16, cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', lineHeight: 1,
              boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}>♥</button>
        )}
      </div>

      {/* 정보 */}
      <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>{farm.name}</div>
          {farm.region && (
            <span style={{ display: 'inline-block', fontSize: 11, color: '#888', background: '#F5F5F5',
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
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A',
          display: 'flex', alignItems: 'center', gap: 4 }}>
          농가 스토리 보기
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>
    </Link>
  );
}
