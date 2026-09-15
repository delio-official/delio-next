import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeGrade, DEFAULT_TIERS, type MembershipTier } from './membership';
import { baseRatePct, computePurchaseEarn, POINT_EVENT_COLS, type PointEvent, type PointEventKind } from './point-earn';

/** 적립 이벤트 목록 (종류별). 표가 아직 없거나 조회 실패면 빈 목록 → 기존 적립 그대로 */
export async function loadPointEvents(admin: SupabaseClient, kind: PointEventKind): Promise<PointEvent[]> {
  const { data, error } = await admin.from('point_events').select(POINT_EVENT_COLS).eq('kind', kind);
  if (error) return [];
  return (data as PointEvent[] | null) || [];
}

/** 회원 기준 적립률(%) — 개인 적립률 우선, 없으면 등급 적립률 */
export async function loadBaseRate(admin: SupabaseClient, userId: string): Promise<number> {
  let prof: { grade?: string | null; point_rate_override?: number | null } | null = null;
  const withOverride = await admin.from('profiles').select('grade, point_rate_override').eq('id', userId).maybeSingle();
  if (withOverride.error) {
    // 칸 추가 SQL 실행 전이면 등급만으로 계산
    const { data } = await admin.from('profiles').select('grade').eq('id', userId).maybeSingle();
    prof = data as { grade?: string | null } | null;
  } else {
    prof = withOverride.data as { grade?: string | null; point_rate_override?: number | null } | null;
  }
  const grade = normalizeGrade(prof?.grade);
  const { data: tierRow } = await admin.from('membership_tiers').select('*').eq('grade', grade).maybeSingle();
  const tier = (tierRow as MembershipTier | null) ?? DEFAULT_TIERS.find(t => t.grade === grade)!;
  return baseRatePct(tier, prof?.point_rate_override);
}

/** 주문 적립 포인트 계산 (지급은 호출한 쪽에서) */
export async function computeOrderEarn(
  admin: SupabaseClient,
  o: { userId: string; finalAmount: number; items: { productId: string | null | undefined; amount: number }[]; at: Date },
): Promise<number> {
  const [baseRate, events] = await Promise.all([loadBaseRate(admin, o.userId), loadPointEvents(admin, 'purchase')]);
  return computePurchaseEarn(o.items, o.finalAmount, baseRate, events, o.at);
}
