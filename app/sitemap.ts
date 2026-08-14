import type { MetadataRoute } from 'next';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';

/* /sitemap.xml 자동 생성 — 정적 페이지 + DB의 상품·브랜드·이벤트·라운지를 모두 수록.
   네이버/구글이 전체 페이지를 수집하도록 안내. 하루 1회 갱신. */
const BASE = 'https://www.delio.co.kr';
export const revalidate = 86400; // 24h

const STATIC_PATHS = [
  '', '/category', '/farms', '/event', '/lounge', '/survey',
  '/faq', '/service', '/shipping', '/refund-policy', '/terms', '/privacy',
  '/login', '/signup',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map(p => ({
    url: `${BASE}${p}`,
    changeFrequency: p === '' ? 'daily' : 'weekly',
    priority: p === '' ? 1 : 0.7,
  }));

  try {
    const admin = createAdminSupabaseClient();
    const [prod, farm, ev, lounge] = await Promise.all([
      admin.from('products').select('id, created_at').eq('is_active', true).limit(3000),
      admin.from('farms').select('slug').not('slug', 'is', null).limit(500),
      admin.from('events').select('slug').eq('is_active', true).not('slug', 'is', null).limit(500),
      admin.from('lounge_posts').select('id').limit(1000),
    ]);
    (prod.data || []).forEach((p: { id: string; created_at: string | null }) =>
      entries.push({ url: `${BASE}/product/${p.id}`, lastModified: p.created_at || undefined, changeFrequency: 'weekly', priority: 0.8 }));
    (farm.data || []).forEach((f: { slug: string | null }) =>
      f.slug && entries.push({ url: `${BASE}/farm/${f.slug}`, changeFrequency: 'weekly', priority: 0.6 }));
    (ev.data || []).forEach((e: { slug: string | null }) =>
      e.slug && entries.push({ url: `${BASE}/event/${e.slug}`, changeFrequency: 'weekly', priority: 0.5 }));
    (lounge.data || []).forEach((l: { id: string }) =>
      entries.push({ url: `${BASE}/lounge/${l.id}`, changeFrequency: 'monthly', priority: 0.4 }));
  } catch { /* DB 조회 실패해도 정적 페이지 사이트맵은 제공 */ }

  return entries;
}
