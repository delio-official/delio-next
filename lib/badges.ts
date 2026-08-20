/** 뱃지 텍스트를 쉼표(,) 기준으로 여러 개로 분리. (레거시 텍스트 표시용)
 *  "당일수확, 예약발송" → ['당일수확', '예약발송'] / 빈값 → []
 *  ※ JSON(개별 색상) 포맷이면 텍스트만 뽑아서 반환. */
export function splitBadges(badge?: string | null): string[] {
  return parseBadges(badge).map(b => b.t);
}

export type BadgeItem = { t: string; c: string };

const DEFAULT_BADGE_COLOR = '#1A1A1A';

/** 뱃지 값을 [{텍스트, 색상}] 배열로 파싱.
 *  - 신규 포맷: JSON 배열 [{"t":"당일수확","c":"#CB1D11"}, ...] → 각 뱃지 개별 색상
 *  - 레거시 포맷: 쉼표 구분 문자열 "당일수확, 한정" → fallbackColor(단일 색) 공통 적용
 *  둘 다 지원(하위호환). */
export function parseBadges(badge?: string | null, fallbackColor?: string | null): BadgeItem[] {
  const s = (badge || '').trim();
  if (!s) return [];
  if (s.startsWith('[')) {
    try {
      const arr = JSON.parse(s) as unknown;
      if (Array.isArray(arr)) {
        return arr
          .map(x => {
            const o = x as { t?: unknown; text?: unknown; c?: unknown; color?: unknown };
            const t = String(o.t ?? o.text ?? '').trim();
            const c = String(o.c ?? o.color ?? fallbackColor ?? DEFAULT_BADGE_COLOR);
            return { t, c };
          })
          .filter(b => b.t);
      }
    } catch { /* 파싱 실패 시 레거시로 처리 */ }
  }
  const color = fallbackColor || DEFAULT_BADGE_COLOR;
  return s.split(',').map(t => t.trim()).filter(Boolean).map(t => ({ t, c: color }));
}

/** [{텍스트,색상}] 배열을 저장용 문자열로 직렬화. 비면 빈 문자열. */
export function serializeBadges(items: BadgeItem[]): string {
  const clean = (items || []).map(b => ({ t: (b.t || '').trim(), c: b.c || DEFAULT_BADGE_COLOR })).filter(b => b.t);
  return clean.length ? JSON.stringify(clean) : '';
}
