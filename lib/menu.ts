/* 상단 메뉴 (menu_items) — 메가메뉴 컬럼 / 상단 nav / 모바일 단축 */
import { createClient } from '@/lib/supabase';

export interface MenuItem {
  id: string;
  label: string;
  href: string;
  emoji: string;
  parent: string | null;       // null=그룹/단독, 값=그 그룹의 하위 링크
  sort_order: number;
  is_active: boolean;
  show_in_mega: boolean;       // 메가메뉴 컬럼
  show_in_header: boolean;     // PC 상단 nav 단독 링크
  show_in_shortcut: boolean;   // 모바일 단축
}

const COLS = 'id, label, href, emoji, parent, sort_order, is_active, show_in_mega, show_in_header, show_in_shortcut';

/** 활성 메뉴 전체 (사이트용) */
export async function loadMenuItems(): Promise<MenuItem[]> {
  const { data } = await createClient()
    .from('menu_items').select(COLS).eq('is_active', true).order('sort_order');
  return (data as MenuItem[]) || [];
}

/** 메가메뉴 컬럼: 그룹(parent=null & show_in_mega) + 그 하위 링크 */
export function megaColumns(items: MenuItem[]) {
  return items.filter(m => !m.parent && m.show_in_mega).sort((a, b) => a.sort_order - b.sort_order)
    .map(g => ({ group: g, links: items.filter(m => m.parent === g.id).sort((a, b) => a.sort_order - b.sort_order) }));
}

/** PC 상단 nav 단독 링크 */
export function topNav(items: MenuItem[]) {
  return items.filter(m => !m.parent && m.show_in_header).sort((a, b) => a.sort_order - b.sort_order);
}
