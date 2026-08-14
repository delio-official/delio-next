/** 뱃지 텍스트를 쉼표(,) 기준으로 여러 개로 분리.
 *  "당일수확, 예약발송" → ['당일수확', '예약발송'] / "당일수확" → ['당일수확'] / 빈값 → []
 *  기존처럼 한 개만 쓰면 배열 길이 1로 그대로 동작. */
export function splitBadges(badge?: string | null): string[] {
  return (badge || '').split(',').map(s => s.trim()).filter(Boolean);
}
