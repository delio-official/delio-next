/* 포인트 적립 설정 해석 — 어드민 표시·주문 적립 공용
 * site_settings 키-값:
 *   point_enabled     'true'|'false'
 *   point_rate        현재 적용 중인 적립률(%)
 *   point_rate_next   예약된 새 적립률(%) — 적용일부터 발효
 *   point_apply_date  예약 적용일 'YYYY-MM-DD' (미래)
 */
export type PointSettings = Record<string, string | undefined>;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 지금 시점에 실제로 적용되는 적립률(%). 예약(point_rate_next)이 적용일을 지났으면 그 값. */
export function effectivePointRatePct(s: PointSettings): number {
  const next = s.point_rate_next;
  if (s.point_apply_date && next != null && next !== '' && today() >= s.point_apply_date) {
    return Number(next) || 0;
  }
  return Number(s.point_rate ?? '1') || 0;
}

/** 아직 발효 전인 예약 변경이 있으면 그 정보, 없으면 null */
export function pendingPointChange(s: PointSettings): { rate: number; applyDate: string } | null {
  const next = s.point_rate_next;
  if (s.point_apply_date && next != null && next !== '' && today() < s.point_apply_date) {
    return { rate: Number(next) || 0, applyDate: s.point_apply_date };
  }
  return null;
}

export function isPointEnabled(s: PointSettings): boolean {
  return s.point_enabled !== 'false';
}
