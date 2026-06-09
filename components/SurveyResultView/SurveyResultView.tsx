'use client';

import Link from 'next/link';
import './SurveyResultView.css';

export interface SurveyInfo {
  name: string; emoji: string; bg: string; color: string;
  tagline: string; fruitRec: string; fruitTime?: string; wellness: string;
}
export interface SurveyTypeBrief { key: string; name: string; emoji: string; }
export interface SurveyRecProduct {
  id: string; name: string; price: number; discounted_price?: number | null;
  thumbnail_url: string | null; category: string;
}

/* 3축 (좌/우 라벨 + 키) */
const AXES = [
  { l: '루틴형',  r: '자유형',     lk: 'routine', rk: 'free' },
  { l: '케어형',  r: '자기충전형', lk: 'care',    rk: 'self' },
  { l: '비타민형', r: '힐링형',     lk: 'vitamin', rk: 'healing' },
];
const EMOJI: Record<string, string> = { apple:'🍎', citrus:'🍊', berry:'🫐', melon:'🍈', kiwi:'🥝', mango:'🥭', grape:'🍇', gift:'🎁', default:'🍑' };
const fmt = (n: number) => n.toLocaleString('ko-KR');

export default function SurveyResultView({
  info, currentKey, userName, allTypes, recProducts, showRec = true, onShop,
}: {
  info: SurveyInfo;
  currentKey: string;
  userName?: string;
  allTypes?: SurveyTypeBrief[];
  recProducts?: SurveyRecProduct[];
  showRec?: boolean;
  onShop?: () => void;
}) {
  const parts = currentKey.split('-'); // [axis1, axis2, axis3]

  return (
    <div className="srv">
      {/* ① 히어로 카드 */}
      <div className="srv-hero" style={{ background: info.bg }}>
        <div className="srv-hero-deco srv-hero-deco1" />
        <div className="srv-hero-deco srv-hero-deco2" />
        <div className="srv-hero-emoji">{info.emoji}</div>
        <div className="srv-hero-body">
          <div className="srv-hero-label" style={{ color: info.color }}>현재 나의 취향 유형은</div>
          <div className="srv-hero-name">{info.name}</div>
          <div className="srv-hero-tagline">
            {userName ? `${userName}님, ` : ''}{info.tagline}
          </div>
        </div>
      </div>

      {/* ② 3축 취향 지표 바 */}
      <div className="srv-axes">
        <div className="srv-card-title">나의 취향 지표</div>
        {AXES.map((ax, i) => {
          const leftActive = parts[i] === ax.lk;
          return (
            <div key={i} className="srv-axis">
              <div className="srv-axis-labels">
                <span className={`srv-axis-label${leftActive ? ' on' : ''}`}>{ax.l}</span>
                <span className={`srv-axis-label${!leftActive ? ' on' : ''}`}>{ax.r}</span>
              </div>
              <div className="srv-axis-track">
                <div className="srv-axis-fill"
                  style={{ background: info.color, width: '70%', ...(leftActive ? { left: 0 } : { right: 0 }) }} />
                <div className="srv-axis-dot"
                  style={{ borderColor: info.color, left: leftActive ? '70%' : '30%' }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ③ 추천 과일 + CTA (회색카드 + 다크버튼) */}
      <div className="srv-cta">
        <div className="srv-cta-row">
          <span className="srv-cta-emoji">🍑</span>
          <div>
            <div className="srv-cta-cap">내 취향 추천 과일</div>
            <div className="srv-cta-fruit">{info.fruitRec}</div>
          </div>
        </div>
        {info.fruitTime && <div className="srv-cta-time">· {info.fruitTime}</div>}
        <button className="srv-cta-btn" onClick={onShop}>내 취향 맞춤 상품 보기</button>
      </div>

      {/* ④ 취향 유형별 쇼케이스 */}
      {allTypes && allTypes.length > 0 && (
        <div className="srv-types">
          <div className="srv-types-head">취향 유형별 보기</div>
          <p className="srv-types-sub">총 {allTypes.length}가지 유형 중 내 유형을 확인해보세요</p>
          <div className="srv-types-scroll">
            {allTypes.map(t => {
              const cur = t.key === currentKey;
              return (
                <div key={t.key} className={`srv-type-chip${cur ? ' cur' : ''}`}
                  style={cur ? { borderColor: info.color, background: info.bg } : undefined}>
                  <span className="srv-type-emoji">{t.emoji}</span>
                  <span className="srv-type-name">{t.name}</span>
                  {cur && <span className="srv-type-badge" style={{ background: info.color }}>나의 유형</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ⑤ 맞춤 추천 상품 */}
      {showRec && recProducts && recProducts.length > 0 && (
        <div className="srv-recs">
          <div className="srv-recs-head">
            <span>나를 위한 추천 상품</span>
            {onShop && <button onClick={onShop}>전체보기 ›</button>}
          </div>
          <div className="srv-recs-grid">
            {recProducts.map(p => {
              const price = p.discounted_price ?? p.price;
              return (
                <Link key={p.id} href={`/product/${p.id}`} className="srv-rec">
                  <div className="srv-rec-img">
                    {p.thumbnail_url
                      ? <img src={p.thumbnail_url} alt={p.name} />
                      : <span>{EMOJI[p.category] || EMOJI.default}</span>}
                  </div>
                  <div className="srv-rec-name">{p.name}</div>
                  <div className="srv-rec-price">{fmt(price)}원</div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
