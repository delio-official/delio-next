/* 포인트 적립 계산 — 서버(적립 지급)와 화면(상품 상세·결제 화면 표시)이 같은 규칙을 쓰도록 한 곳에 모은다.
 *
 * 구매 적립: 상품마다 후보 중 가장 높은 적립률 하나
 *   · 기준 적립률 = 개인 적립률(있으면) 또는 등급 적립률
 *   · 구매 이벤트(배수)      = 기준 적립률 × 배수
 *   · 구매 이벤트(적립률 지정) = 지정 %
 *   → 이벤트 때문에 적립이 낮아지는 경우는 없다. 구매 이벤트끼리 겹치면 가장 유리한 것 1개.
 * 금액 기준: 실제 결제금액(쿠폰·포인트 할인 후)을 상품 금액 비율로 나눠 계산하고, 마지막에 한 번만 버림
 *   → 이벤트가 없으면(모든 상품 같은 적립률) 예전 계산 floor(결제금액 × 적립률 / 100) 과 같다.
 *
 * 리뷰 적립: 일반·포토 각각 후보 중 가장 큰 금액 (기본 설정 / 배수 이벤트 / 금액 지정 이벤트)
 * 구매 이벤트와 리뷰 이벤트는 서로 따로 적용된다.
 */
import { effectiveRate, type MembershipTier } from './membership';

export type PointEventKind = 'purchase' | 'review';
export type PointEventMode = 'multiply' | 'rate' | 'amount';

export interface PointEvent {
  id: string;
  kind: PointEventKind;
  name: string;
  starts_at: string;
  ends_at: string | null;          // null = 상시
  mode: PointEventMode;
  multiplier: number | null;
  rate: number | null;
  review_text_amount: number | null;
  review_photo_amount: number | null;
  target: 'all' | 'products';
  product_ids: string[] | null;
}

export const POINT_EVENT_COLS =
  'id, kind, name, starts_at, ends_at, mode, multiplier, rate, review_text_amount, review_photo_amount, target, product_ids';

/** 그 시각에 진행 중인 이벤트인가 (시작 ≤ 시각 < 끝) */
export function isEventActive(e: PointEvent, at: Date = new Date()): boolean {
  const t = at.getTime();
  if (new Date(e.starts_at).getTime() > t) return false;
  if (e.ends_at && new Date(e.ends_at).getTime() <= t) return false;
  return true;
}

function appliesTo(e: PointEvent, productId: string | null | undefined): boolean {
  if (e.target === 'all') return true;
  return !!productId && (e.product_ids || []).includes(productId);
}

/** 적립률 소수 오차 정리 (1 × 1.5 = 1.5 같은 값이 1.4999… 로 보이지 않게) */
const tidy = (n: number) => Math.round(n * 10000) / 10000;

/** 기준 적립률(%) — 개인 적립률이 있으면 그 값, 없으면 등급 적립률(예약 적용 포함) */
export function baseRatePct(tier: MembershipTier, override: number | string | null | undefined): number {
  if (override !== null && override !== undefined && override !== '' && Number.isFinite(Number(override))) {
    return Math.max(0, Number(override));
  }
  return effectiveRate(tier);
}

/** 한 상품에 적용되는 구매 적립률(%)과 그 이벤트(기준 적립률이면 null) */
export function purchaseRateFor(
  productId: string | null | undefined, baseRate: number, events: PointEvent[], at: Date = new Date(),
): { rate: number; event: PointEvent | null } {
  let best = { rate: baseRate, event: null as PointEvent | null };
  for (const e of events) {
    if (e.kind !== 'purchase' || !isEventActive(e, at) || !appliesTo(e, productId)) continue;
    const r = e.mode === 'multiply' ? tidy(baseRate * Number(e.multiplier || 0))
            : e.mode === 'rate'     ? Number(e.rate || 0)
            : -1;
    if (r > best.rate) best = { rate: r, event: e };
  }
  return best;
}

/** 주문 적립 포인트 — items 금액 비율로 결제금액을 나눠 상품별 적립률을 곱한다 */
export function computePurchaseEarn(
  items: { productId: string | null | undefined; amount: number }[],
  finalAmount: number, baseRate: number, events: PointEvent[], at: Date = new Date(),
): number {
  const pay = Math.max(0, Number(finalAmount) || 0);
  if (pay <= 0) return 0;
  const total = items.reduce((s, i) => s + Math.max(0, Number(i.amount) || 0), 0);
  if (total <= 0) return Math.floor(pay * baseRate / 100 + 1e-6);
  let raw = 0;
  for (const i of items) {
    const share = pay * Math.max(0, Number(i.amount) || 0) / total;
    raw += share * purchaseRateFor(i.productId, baseRate, events, at).rate / 100;
  }
  return Math.floor(raw + 1e-6);
}

/** 리뷰 적립 금액 — 일반·포토 각각 가장 큰 금액과, 그 금액을 만든 이벤트 */
export function reviewAmountsFor(
  productId: string | null | undefined, base: { text: number; photo: number }, events: PointEvent[], at: Date = new Date(),
): { text: number; photo: number; textEvent: PointEvent | null; photoEvent: PointEvent | null } {
  const out = { text: base.text, photo: base.photo, textEvent: null as PointEvent | null, photoEvent: null as PointEvent | null };
  for (const e of events) {
    if (e.kind !== 'review' || !isEventActive(e, at) || !appliesTo(e, productId)) continue;
    const t = e.mode === 'multiply' ? Math.round(base.text * Number(e.multiplier || 0))
            : e.mode === 'amount'   ? Number(e.review_text_amount || 0) : -1;
    const p = e.mode === 'multiply' ? Math.round(base.photo * Number(e.multiplier || 0))
            : e.mode === 'amount'   ? Number(e.review_photo_amount || 0) : -1;
    if (t > out.text)  { out.text = t;  out.textEvent = e; }
    if (p > out.photo) { out.photo = p; out.photoEvent = e; }
  }
  return out;
}

/** 이벤트 방식 한 줄 표기 — 관리자 목록·고객 뱃지 공용 */
export function describeEvent(e: PointEvent): string {
  if (e.mode === 'multiply') return `${tidy(Number(e.multiplier || 0))}배`;
  if (e.mode === 'rate') return `${tidy(Number(e.rate || 0))}% 적립`;
  return `일반 ${Number(e.review_text_amount || 0).toLocaleString()}P · 포토 ${Number(e.review_photo_amount || 0).toLocaleString()}P`;
}
