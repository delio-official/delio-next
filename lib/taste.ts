/* ───────────────────────────────────────────────────────────
   맛 프로파일 (상품상세 · 어드민 상품등록 · 리뷰 작성 공용)

   판매자 4축(당도·산도·과즙·식감): 등록 시 5단계 라벨 선택 → products.seller_score
   구매자 5축(+신선도): 리뷰 작성 시 1~5 평가 → reviews.taste → 동의율 산출
   ─────────────────────────────────────────────────────────── */

export type SellerAxis = 'sweet' | 'sour' | 'juice' | 'texture';
export type TasteAxis = SellerAxis | 'fresh';

export interface AxisDef {
  key: TasteAxis;
  label: string;          // 당도/산도/과즙/식감/신선도
  icon: string;
  hex: string;            // 바·강조색
  bg: string;             // 카드 배경
  levels: [string, string, string, string, string]; // 1→5단계 라벨
  sellerSet: boolean;     // 판매자가 등록 시 설정하는 축인지 (신선도는 false)
}

/* 5축 정의 (1=가장 약함 … 5=가장 강함) */
export const TASTE_AXES: AxisDef[] = [
  { key:'sweet',   label:'당도', icon:'🍯', hex:'#E8632B', bg:'#FFF3EC', sellerSet:true,
    levels:['거의 안 달아요','살짝 달아요','적당히 달아요','달아요','매우 달아요'] },
  { key:'sour',    label:'산도', icon:'🍋', hex:'#C99A06', bg:'#FBF6E3', sellerSet:true,
    levels:['거의 안 셔요','살짝 셔요','적당해요','새콤해요','많이 셔요'] },
  { key:'juice',   label:'과즙', icon:'💧', hex:'#2E8FD6', bg:'#EAF4FC', sellerSet:true,
    levels:['적은 편','약간 있어요','적당해요','풍부해요','매우 풍부해요'] },
  { key:'texture', label:'식감', icon:'🥗', hex:'#3E9B5F', bg:'#EDF7F0', sellerSet:true,
    levels:['부드러워요','약간 부드러워요','적당해요','아삭해요','매우 아삭해요'] },
  { key:'fresh',   label:'신선도', icon:'🌿', hex:'#1F9D55', bg:'#EAF7EF', sellerSet:false,
    levels:['아쉬워요','보통이에요','괜찮아요','신선해요','매우 신선해요'] },
];

export const SELLER_AXES = TASTE_AXES.filter(a => a.sellerSet);

export type SellerScore = Partial<Record<SellerAxis, number>>;
export type ReviewTaste = Partial<Record<TasteAxis, number>>;

/* 카테고리별 판매자 점수 기본값 (등록 시 미설정 폴백) */
export const DEFAULT_SELLER_SCORE: Record<string, Record<SellerAxis, number>> = {
  apple:  { sweet:4, sour:2, juice:4, texture:4 },
  citrus: { sweet:4, sour:3, juice:4, texture:3 },
  berry:  { sweet:3, sour:3, juice:4, texture:3 },
  melon:  { sweet:5, sour:1, juice:5, texture:4 },
  kiwi:   { sweet:4, sour:3, juice:4, texture:4 },
  mango:  { sweet:5, sour:1, juice:5, texture:2 },
  grape:  { sweet:4, sour:1, juice:4, texture:4 },
  gift:   { sweet:4, sour:2, juice:4, texture:3 },
  default:{ sweet:4, sour:2, juice:4, texture:3 },
};

/** 카테고리 기본 점수 (없으면 default) */
export function defaultSellerScore(category: string): Record<SellerAxis, number> {
  return DEFAULT_SELLER_SCORE[category] || DEFAULT_SELLER_SCORE.default;
}

/** 점수(1~5, 소수 가능) → 단계(1~5 정수) */
export function toLevel(v: number | undefined | null): number {
  if (!v) return 3;
  return Math.max(1, Math.min(5, Math.round(v)));
}

/** 축 + 단계 → 라벨 ("매우 달아요") */
export function axisLevelLabel(axis: AxisDef, level: number): string {
  return axis.levels[Math.max(1, Math.min(5, level)) - 1];
}

/** 구매자 동의율: 판매자 단계 기준 ±1 이내면 '동의'. (taste 있는 리뷰만 집계) */
export function agreePct(sellerLevel: number, buyerLevels: number[]): number {
  if (buyerLevels.length === 0) return 0;
  const agree = buyerLevels.filter(b => Math.abs(b - sellerLevel) <= 1).length;
  return Math.round(agree / buyerLevels.length * 100);
}

/** 신선도 등 판매자 기준 없는 축: 구매자 평균을 % 로 (avg/5*100) */
export function avgPct(buyerLevels: number[]): number {
  if (buyerLevels.length === 0) return 0;
  const avg = buyerLevels.reduce((s, v) => s + v, 0) / buyerLevels.length;
  return Math.round(avg / 5 * 100);
}

/** 공개 임계: 맛 평가가 담긴 리뷰 N개 이상이면 동의율 공개 */
export const TASTE_REVEAL_MIN = 5;
