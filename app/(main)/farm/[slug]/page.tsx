import { cache } from 'react';
import type { Metadata } from 'next';
import FarmClient from './FarmClient';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';

const BASE = 'https://www.delio.co.kr';

/* 브랜드(농가) 정보 서버 조회 — 한글 slug 대응(디코드 우선, 실패 시 원본) */
const getFarm = cache(async (slug: string) => {
  try {
    const admin = createAdminSupabaseClient();
    const dec = (() => { try { return decodeURIComponent(slug); } catch { return slug; } })();
    const cols = 'name, thumbnail_url, logo_url';
    let { data } = await admin.from('farms').select(cols).eq('slug', dec).maybeSingle();
    if (!data && dec !== slug) {
      ({ data } = await admin.from('farms').select(cols).eq('slug', slug).maybeSingle());
    }
    return data as { name: string; thumbnail_url: string | null; logo_url: string | null } | null;
  } catch { return null; }
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const f = await getFarm(slug);
  if (!f) return { title: '브랜드 소개 — 델리오' };
  const title = `${f.name} — 델리오`;
  const desc = `${f.name}의 산지직송 제철 과일을 델리오에서 만나보세요. 농가에서 직접 받는 신선한 과일.`;
  const img = f.thumbnail_url || f.logo_url || '/KakaoThumbnail.png';
  return {
    title,
    description: desc,
    alternates: { canonical: `${BASE}/farm/${slug}` },
    openGraph: {
      title, description: desc, url: `${BASE}/farm/${slug}`,
      type: 'website', siteName: '델리오', locale: 'ko_KR',
      images: [{ url: img }],
    },
  };
}

export default function FarmPage() {
  return <FarmClient />;
}
