'use client';

/**
 * 둥근 SVG 별 아이콘 공유 컴포넌트
 * 각 꼭짓점을 2차 베지에 곡선(Q)으로 처리 → 진짜 둥근 별
 *
 * exports:
 *   StarRating  — 5개 별 행 (소수점 지원)
 *   SingleStar  — 채워진 별 1개
 */

/**
 * 20×20 뷰박스, center=(10,10)
 * outer r=8.5, inner r=3.5, 꼭짓점 곡률 r=2.5
 *
 * 5각별 외곽꼭짓점:
 *   v1=(10,1.5)  v2=(18.09,7.37)  v3=(14.99,16.88)
 *   v4=(5.01,16.88)  v5=(1.91,7.37)
 * 내곽꼭짓점:
 *   u1=(12.06,7.17)  u2=(13.33,11.08)  u3=(10,13.5)
 *   u4=(6.67,11.08)  u5=(7.94,7.17)
 *
 * 각 외곽 꼭짓점에서 진입/진출 방향으로 r=2.5 만큼 물러선 뒤
 * Q 커맨드로 꼭짓점을 감싸는 부드러운 곡선 생성
 */
const STAR_PATH =
  'M 9.15,3.85 Q 10,1.5 10.85,3.85' +   // 꼭짓점1 (위)
  ' L 12.06,7.17' +                       // 내곽1
  ' L 15.59,7.29 Q 18.09,7.37 16.12,8.91' + // 꼭짓점2 (오른쪽위)
  ' L 13.33,11.08' +                      // 내곽2
  ' L 14.30,14.48 Q 14.99,16.88 12.92,15.48' + // 꼭짓점3 (오른쪽아래)
  ' L 10,13.5' +                          // 내곽3
  ' L 7.08,15.48 Q 5.01,16.88 5.70,14.48' + // 꼭짓점4 (왼쪽아래)
  ' L 6.67,11.08' +                       // 내곽4
  ' L 3.88,8.91 Q 1.91,7.37 4.41,7.29' + // 꼭짓점5 (왼쪽위)
  ' L 7.94,7.17 Z';                       // 내곽5 → 닫기

const FILLED       = '#F5A623';
const EMPTY        = '#E0DFDB';
const EMPTY_STROKE = '#CCCAC6';

/* ── 내부: 단일 별 SVG ─────────────────────── */
interface StarIconProps {
  fill?: 'full' | 'half' | 'empty';
  size?: number;
  fillColor?: string;
  idx?: number;
}

function StarIcon({ fill = 'empty', size = 16, fillColor, idx = 0 }: StarIconProps) {
  const fc  = fillColor ?? FILLED;
  const gid = `sg-${idx}`;

  if (fill === 'half') {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20"
        style={{ display:'inline-block', verticalAlign:'middle', flexShrink:0 }}>
        <defs>
          <linearGradient id={gid} x1="0" x2="1" y1="0" y2="0">
            <stop offset="50%" stopColor={fc} />
            <stop offset="50%" stopColor={EMPTY} />
          </linearGradient>
        </defs>
        {/* 빈 별 베이스 */}
        <path d={STAR_PATH} fill={EMPTY} stroke={EMPTY_STROKE} strokeWidth="0.5" />
        {/* 채워진 쪽 (왼쪽 50%) */}
        <path d={STAR_PATH} fill={`url(#${gid})`} stroke="none" />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 20 20"
      style={{ display:'inline-block', verticalAlign:'middle', flexShrink:0 }}>
      <path
        d={STAR_PATH}
        fill={fill === 'full' ? fc : EMPTY}
        stroke={fill === 'full' ? 'none' : EMPTY_STROKE}
        strokeWidth="0.5"
      />
    </svg>
  );
}

/* ── 5개 별 행 ─────────────────────────────── */
export function StarRating({
  rating,
  size = 14,
}: {
  rating: number;
  size?: number;
}) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:1 }}>
      {[1, 2, 3, 4, 5].map(i => {
        const fill: 'full' | 'half' | 'empty' =
          i <= Math.floor(rating)                          ? 'full'  :
          i <= Math.ceil(rating) && (rating % 1) >= 0.25  ? 'half'  :
          'empty';
        return <StarIcon key={i} fill={fill} size={size} idx={i} />;
      })}
    </span>
  );
}

/* ── 단일 채워진 별 (상품카드 아이콘용) ──────── */
export function SingleStar({
  size = 13,
  color,
}: {
  size?: number;
  color?: string;
}) {
  return <StarIcon fill="full" size={size} fillColor={color} />;
}
