/* 메인페이지 섹션 큐레이션 설정 (site_settings 기반)
   - 델리오 픽 / 퀵가이드 / 브랜드 직송관 / 리뷰 하이라이트 / 라운지
   - 노출 방식(mode): 최신순 / 인기순 / 조회순 / 직접 선택
   - 직접 선택 시 ids(순서 보존) 사용 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type SectionMode = 'latest' | 'popular' | 'views' | 'manual';

export interface SectionMeta {
  key: string;
  label: string;
  modes: SectionMode[];   // 이 섹션에서 고를 수 있는 방식
  defaultCount: number;
  countKey: string;       // 개수 저장 키 (픽은 기존 pick_count)
}

export const HOME_SECTIONS: Record<string, SectionMeta> = {
  pick:     { key:'pick',     label:'델리오 픽',      modes:['popular','latest','manual'], defaultCount:6,  countKey:'pick_count' },
  qg:       { key:'qg',       label:'퀵 가이드',      modes:['latest','popular','manual'], defaultCount:8,  countKey:'qg_count' },
  brand:    { key:'brand',    label:'브랜드 직송관',  modes:['latest','popular','manual'], defaultCount:4, countKey:'brand_count' },
  reviewhl: { key:'reviewhl', label:'리뷰 하이라이트', modes:['latest','popular','manual'], defaultCount:6,  countKey:'reviewhl_count' },
  lounge:   { key:'lounge',   label:'델리오 라운지',  modes:['manual','latest'],           defaultCount:3,  countKey:'lounge_count' },
};

export const MODE_LABEL: Record<SectionMode, string> = {
  latest: '최신순', popular: '인기순', views: '조회순', manual: '직접 선택',
};

export interface SectionConfig { mode: SectionMode; ids: string[]; count: number; }

export function parseSectionConfig(settings: Record<string, string>, sec: string): SectionConfig {
  const meta = HOME_SECTIONS[sec];
  const defCount = meta?.defaultCount ?? 6;
  const countKey = meta?.countKey ?? `${sec}_count`;
  const rawMode = settings[`${sec}_mode`] as SectionMode | undefined;
  const mode: SectionMode = (rawMode && meta?.modes.includes(rawMode)) ? rawMode : (meta?.modes[0] ?? 'latest');
  const ids = (settings[`${sec}_ids`] || '').split(',').map(s => s.trim()).filter(Boolean);
  const rawCount = settings[countKey];
  const count = rawCount === '0' ? 0 : Math.max(0, parseInt(rawCount || String(defCount)) || defCount);
  return { mode, ids, count };
}

/** 섹션 설정에 필요한 키만 모아서 읽기 */
export async function fetchSectionConfig(
  supabase: SupabaseClient, sec: string,
): Promise<SectionConfig> {
  const meta = HOME_SECTIONS[sec];
  const keys = [`${sec}_mode`, `${sec}_ids`, meta?.countKey ?? `${sec}_count`];
  const { data } = await supabase.from('site_settings').select('key,value').in('key', keys);
  const map: Record<string, string> = {};
  (data || []).forEach((r: { key: string; value: string }) => { map[r.key] = r.value; });
  return parseSectionConfig(map, sec);
}

/** mode → 정렬 컬럼 (manual/popular-farms 는 별도 처리) */
export function orderColumn(sec: string, mode: SectionMode): { col: string; asc: boolean } {
  if (mode === 'latest') return { col: 'created_at', asc: false };
  if (mode === 'views')  return { col: 'view_count', asc: false };
  if (mode === 'popular') {
    // 리뷰 하이라이트는 '도움돼요'를 없앴으므로 평점 높은 순으로 대체
    if (sec === 'reviewhl') return { col: 'rating', asc: false };
    return { col: 'review_count', asc: false }; // 상품
  }
  return { col: 'created_at', asc: false };
}

/** 퀵가이드 직접선택: 카테고리별 id 목록 맵 (JSON) 파싱 */
export function parseBucketMap(s: string): Record<string, string[]> {
  if (!s) return {};
  try {
    const o = JSON.parse(s);
    if (o && typeof o === 'object' && !Array.isArray(o)) {
      const out: Record<string, string[]> = {};
      for (const k of Object.keys(o)) if (Array.isArray(o[k])) out[k] = o[k].map(String);
      return out;
    }
  } catch { /* noop */ }
  return {};
}

/** 가져온 행을 ids 순서대로 재정렬 (manual) */
export function orderByIds<T extends { id: string | number }>(rows: T[], ids: string[]): T[] {
  const map = new Map(rows.map(r => [String(r.id), r]));
  return ids.map(id => map.get(id)).filter((v): v is T => !!v);
}
