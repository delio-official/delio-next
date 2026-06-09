/* 필탭/카테고리 통합 로더 — filter_tabs 테이블 기반
 * 노출 위치: home(퀵 가이드) / category(카테고리 상단) / shortcut(하단바)
 */
import { createClient } from '@/lib/supabase';

export type TabType = 'category' | 'flag' | 'sort' | 'link';

export interface FilterTab {
  id: string;
  tab_type: TabType;
  tab_value: string;   // category:'apple' / flag:'is_best' / sort:'brix' / link:'/brand'
  label: string;
  emoji: string;
  bg: string;
  sort_order: number;
  is_active: boolean;
  show_in_home: boolean;
  show_in_category: boolean;
  show_in_shortcut: boolean;
  parent: string | null;   // category형: 상위 대분류의 tab_value (null=대분류)
}

const SELECT_COLS =
  'id, tab_type, tab_value, label, emoji, bg, sort_order, is_active, show_in_home, show_in_category, show_in_shortcut, parent';

/** 전체 필탭 (어드민용 — 비활성 포함) */
export async function loadAllTabs(): Promise<FilterTab[]> {
  const { data } = await createClient()
    .from('filter_tabs').select(SELECT_COLS).order('sort_order');
  return (data as FilterTab[]) || [];
}

/** 특정 노출 위치의 활성 필탭만 */
export async function loadTabsFor(
  surface: 'home' | 'category' | 'shortcut'
): Promise<FilterTab[]> {
  const col =
    surface === 'home' ? 'show_in_home'
    : surface === 'category' ? 'show_in_category'
    : 'show_in_shortcut';
  const { data } = await createClient()
    .from('filter_tabs').select(SELECT_COLS)
    .eq('is_active', true).eq(col, true).order('sort_order');
  return (data as FilterTab[]) || [];
}

/** 카테고리형 필탭만 (상품 폼 카테고리 드롭다운용) */
export async function loadCategoryTabs(): Promise<FilterTab[]> {
  const { data } = await createClient()
    .from('filter_tabs').select(SELECT_COLS)
    .eq('tab_type', 'category').eq('is_active', true).order('sort_order');
  return (data as FilterTab[]) || [];
}

/** 필탭 → 이동 경로 (퀵가이드 active 필터는 별도 처리) */
export function tabHref(t: FilterTab): string {
  switch (t.tab_type) {
    case 'category': return `/category?cat=${t.tab_value}`;
    case 'flag':
      if (t.tab_value === 'is_dawn') return '/category?delivery=dawn';
      if (t.tab_value === 'is_new')  return '/category?new=true';
      return '/category?sort=best'; // is_best
    case 'sort':     return `/category?sort=${t.tab_value}`;
    case 'link':     return t.tab_value;
    default:         return '/category';
  }
}
