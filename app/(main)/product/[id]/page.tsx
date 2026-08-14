import { cache } from 'react';
import type { Metadata } from 'next';
import ProductClient from './ProductClient';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';

const BASE = 'https://www.delio.co.kr';

/* 상품 정보 서버 조회 — generateMetadata와 페이지가 공유(React cache로 요청당 1회) */
const getProduct = cache(async (id: string) => {
  try {
    const admin = createAdminSupabaseClient();
    const { data } = await admin
      .from('products')
      .select('name, short_desc, thumbnail_url, price, discounted_price, avg_rating, review_count, is_active')
      .eq('id', id)
      .maybeSingle();
    return data as {
      name: string; short_desc: string | null; thumbnail_url: string | null;
      price: number; discounted_price: number | null;
      avg_rating: number | null; review_count: number | null; is_active: boolean;
    } | null;
  } catch { return null; }
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const p = await getProduct(id);
  if (!p) return { title: '상품 상세 — 델리오' };
  const title = `${p.name} — 델리오`;
  const desc = (p.short_desc || `${p.name} 산지직송 프리미엄 과일을 델리오에서 만나보세요.`).slice(0, 100);
  const img = p.thumbnail_url || '/KakaoThumbnail.png';
  return {
    title,
    description: desc,
    alternates: { canonical: `${BASE}/product/${id}` },
    openGraph: {
      title, description: desc, url: `${BASE}/product/${id}`,
      type: 'website', siteName: '델리오', locale: 'ko_KR',
      images: [{ url: img }],
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getProduct(id);
  const jsonLd = p ? {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    ...(p.thumbnail_url ? { image: p.thumbnail_url } : {}),
    ...(p.short_desc ? { description: p.short_desc } : {}),
    brand: { '@type': 'Brand', name: '델리오' },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'KRW',
      price: p.discounted_price ?? p.price,
      availability: p.is_active ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: `${BASE}/product/${id}`,
    },
    ...(p.review_count && p.avg_rating
      ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: p.avg_rating, reviewCount: p.review_count } }
      : {}),
  } : null;

  const breadcrumb = p ? {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: BASE },
      { '@type': 'ListItem', position: 2, name: p.name, item: `${BASE}/product/${id}` },
    ],
  } : null;

  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
      {breadcrumb && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />}
      <ProductClient />
    </>
  );
}
