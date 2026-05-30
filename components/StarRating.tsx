'use client';

/**
 * 표준 5각별 컴포넌트
 * exports:
 *   StarRating  — 5개 별 행 (소수점 지원)
 *   SingleStar  — 채워진 별 1개
 */

/* 20×20 viewBox 기준 — outer R=9, inner r=4.5 (통통한 비율) */
const STAR_PATH =
  'M10 1L12.6 6.4L18.6 7.2L14.3 11.4L15.3 17.3L10 14.5L4.7 17.3L5.7 11.4L1.4 7.2L7.4 6.4Z';

const FILLED = '#FFCA28';
const EMPTY  = '#E0E0E0';

interface StarIconProps {
  fill?: 'full' | 'half' | 'empty';
  size?: number;
  fillColor?: string;
  idx?: number;
}

function StarIcon({ fill = 'empty', size = 16, fillColor, idx = 0 }: StarIconProps) {
  const fc  = fillColor ?? FILLED;
  const gid = `sg-${idx}`;

  const strokeProps = {
    stroke: fill === 'full' ? fc : fill === 'half' ? fc : EMPTY,
    strokeWidth: 1.5,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
  };

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
        <path d={STAR_PATH} fill={`url(#${gid})`} {...strokeProps} />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 20 20"
      style={{ display:'inline-block', verticalAlign:'middle', flexShrink:0 }}>
      <path d={STAR_PATH} fill={fill === 'full' ? fc : EMPTY} {...strokeProps} />
    </svg>
  );
}

/* ── 5개 별 행 */
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
          i <= Math.floor(rating)                         ? 'full'  :
          i <= Math.ceil(rating) && (rating % 1) >= 0.25 ? 'half'  :
          'empty';
        return <StarIcon key={i} fill={fill} size={size} idx={i} />;
      })}
    </span>
  );
}

/* ── 단일 채워진 별 */
export function SingleStar({
  size = 13,
  color,
}: {
  size?: number;
  color?: string;
}) {
  return <StarIcon fill="full" size={size} fillColor={color ?? FILLED} />;
}
