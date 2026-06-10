/* ───────────────────────────────────────────────────────────
   델리오 멤버십 등급 모델 (단일 출처)
   어드민 · 마이페이지 · 적립률 · 쿠폰 자동발급 공용.

   4단계: 비기너 → 테이스터 → 바이어 → 마스터
   산정: 분기(직전 3개월) 누적 구매금액 + 구매 횟수, 매 분기 자동 재산정.
   설정값(적립률·임계값·쿠폰)은 membership_tiers 테이블에서 로드(하드코딩 아님).
   ─────────────────────────────────────────────────────────── */

export type GradeKey = 'beginner' | 'taster' | 'buyer' | 'master';

export const GRADE_ORDER: GradeKey[] = ['beginner', 'taster', 'buyer', 'master'];

export const GRADE_LABEL: Record<GradeKey, string> = {
  beginner: '비기너', taster: '테이스터', buyer: '바이어', master: '마스터',
};
export const GRADE_LABEL_EN: Record<GradeKey, string> = {
  beginner: 'BEGINNER', taster: 'TASTER', buyer: 'BUYER', master: 'MASTER',
};
export const GRADE_BADGE_CLS: Record<GradeKey, string> = {
  beginner: 'badge-normal', taster: 'badge-silver', buyer: 'badge-gold', master: 'badge-gold',
};
export const GRADE_COLOR: Record<GradeKey, string> = {
  beginner: '#9AA3AE', taster: '#5B8A72', buyer: '#C8841C', master: '#1A1A1A',
};

/** 멤버십 자동발급 쿠폰 코드 (coupons.code 와 매칭) */
export const MEMBERSHIP_COUPON = {
  THOUSAND: 'MBR_THOUSAND',
  PERCENT10: 'MBR_PERCENT10',
  FIVE: 'MBR_FIVE',
  BIRTHDAY: 'MBR_BIRTHDAY',
} as const;

export interface MembershipTier {
  grade: GradeKey;
  sort: number;
  label: string;
  point_rate: number;
  point_rate_next: number | null;
  apply_date: string | null;   // YYYY-MM-DD
  min_amount: number;
  min_count: number;
  coupon_codes: string[];
  monthly_active: boolean;
}

/** DB 비어있을 때 폴백 기본값 (create_membership.sql seed 와 동일) */
export const DEFAULT_TIERS: MembershipTier[] = [
  { grade: 'beginner', sort: 0, label: '비기너',  point_rate: 1, point_rate_next: null, apply_date: null, min_amount: 0,       min_count: 0, coupon_codes: [], monthly_active: false },
  { grade: 'taster',   sort: 1, label: '테이스터', point_rate: 1, point_rate_next: null, apply_date: null, min_amount: 100000,  min_count: 0, coupon_codes: [MEMBERSHIP_COUPON.THOUSAND, MEMBERSHIP_COUPON.PERCENT10], monthly_active: true },
  { grade: 'buyer',    sort: 2, label: '바이어',  point_rate: 2, point_rate_next: null, apply_date: null, min_amount: 300000,  min_count: 3, coupon_codes: [MEMBERSHIP_COUPON.THOUSAND, MEMBERSHIP_COUPON.PERCENT10, MEMBERSHIP_COUPON.FIVE], monthly_active: true },
  { grade: 'master',   sort: 3, label: '마스터',  point_rate: 2, point_rate_next: null, apply_date: null, min_amount: 1500000, min_count: 5, coupon_codes: [MEMBERSHIP_COUPON.THOUSAND, MEMBERSHIP_COUPON.PERCENT10, MEMBERSHIP_COUPON.FIVE], monthly_active: true },
];

/** 분기 누적 실적(금액·횟수)으로 등급 산정 — 위 등급부터 검사 */
export function computeGrade(amount: number, count: number, tiers: MembershipTier[] = DEFAULT_TIERS): GradeKey {
  const desc = [...tiers].sort((a, b) => b.sort - a.sort);
  for (const t of desc) {
    if (amount >= t.min_amount && count >= t.min_count) return t.grade;
  }
  return 'beginner';
}

/** 예약 적용일이 지난 적립률을 반영한 현재 유효 적립률(%) */
export function effectiveRate(t: MembershipTier, today: string = new Date().toISOString().slice(0, 10)): number {
  if (t.point_rate_next != null && t.apply_date && t.apply_date <= today) return t.point_rate_next;
  return t.point_rate;
}

/** 레거시 등급키 → 신규 등급키 (마이그레이션·방어용) */
export function normalizeGrade(raw: string | null | undefined): GradeKey {
  switch (raw) {
    case 'beginner': case 'taster': case 'buyer': case 'master': return raw;
    case 'vvip': return 'master';
    case 'vip': case 'gold': return 'buyer';
    case 'silver': return 'taster';
    default: return 'beginner';
  }
}

export function gradeLabel(raw: string | null | undefined): string {
  return GRADE_LABEL[normalizeGrade(raw)];
}

/** 분기 키: 2026-Q2 형태 */
export function quarterKey(d: Date = new Date()): string {
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()}-Q${q}`;
}

/** 해당 시점이 속한 분기의 시작/끝(직전 3개월 산정 구간) */
export function quarterRange(d: Date = new Date()): { start: Date; end: Date } {
  const q = Math.floor(d.getMonth() / 3);
  const start = new Date(d.getFullYear(), q * 3, 1, 0, 0, 0);
  const end = new Date(d.getFullYear(), q * 3 + 3, 1, 0, 0, 0);
  return { start, end };
}
