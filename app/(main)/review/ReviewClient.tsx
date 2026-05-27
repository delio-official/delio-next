'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { StarRating } from '@/components/StarRating';

interface Review {
  id: string;
  rating: number;
  content: string;
  created_at: string;
  image_urls: string[];
  likes_count: number;
  is_best: boolean;
  products: { id: string; name: string; thumbnail_url: string | null; category: string } | null;
  profiles: { name: string | null } | null;
}

const EMOJI_MAP: Record<string, string> = {
  apple: '🍎', citrus: '🍊', berry: '🫐', melon: '🍈',
  kiwi: '🥝', mango: '🥭', grape: '🍇', gift: '🎁', default: '🍑',
};

type FilterType = 'all' | 'best' | 'photo';

// Stars → StarRating 공유 컴포넌트 사용

export default function ReviewClient() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');

  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = createClient();
      let q = supabase
        .from('reviews')
        .select('*, products(id, name, thumbnail_url, category), profiles(name)')
        .order('created_at', { ascending: false })
        .limit(30);
      if (filter === 'best')  q = q.eq('is_best', true);
      if (filter === 'photo') q = q.neq('image_urls', '{}');
      const { data } = await q;
      setReviews((data as Review[]) || []);
      setLoading(false);
    }
    load();
  }, [filter]);

  return (
    <div style={{ background: '#fff', minHeight: '100vh' }}>

      {/* 페이지 헤더 */}
      <div style={{ padding: '36px 0 32px', borderBottom: '1px solid #EBEBEB' }}>
        <div className="container">
          <h1 style={{ fontSize: 'clamp(20px,3vw,28px)', fontWeight: 700 }}>구매 리뷰</h1>
          <p style={{ fontSize: 14, color: '#888', marginTop: 6 }}>
            실제 구매 고객들의 생생한 리뷰를 확인해보세요
          </p>
        </div>
      </div>

      {/* 필터 탭 */}
      <div style={{ borderBottom: '1px solid #EBEBEB', position: 'sticky', top: 56, background: '#fff', zIndex: 50 }}>
        <div className="container" style={{ display: 'flex', gap: 0 }}>
          {([['all', '전체'], ['best', '베스트'], ['photo', '포토리뷰']] as const).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              style={{
                padding: '14px 20px',
                fontSize: 14, fontWeight: 600,
                border: 'none', background: 'none', cursor: 'pointer',
                borderBottom: filter === v ? '2px solid var(--color-accent)' : '2px solid transparent',
                color: filter === v ? 'var(--color-accent)' : '#999',
                transition: 'all .15s', marginBottom: '-1px',
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* 리뷰 목록 */}
      <div className="container" style={{ paddingTop: 28, paddingBottom: 80 }}>
        {loading ? (
          <p style={{ textAlign: 'center', color: '#999', padding: '60px 0' }}>불러오는 중...</p>
        ) : reviews.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#bbb', padding: '60px 0', fontSize: 15 }}>
            {filter === 'best' ? '베스트 리뷰가 없습니다.' : filter === 'photo' ? '포토 리뷰가 없습니다.' : '등록된 리뷰가 없습니다.'}
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {reviews.map(r => {
              const emoji = r.products ? (EMOJI_MAP[r.products.category] || EMOJI_MAP.default) : '🍑';
              return (
                <div
                  key={r.id}
                  style={{ border: '1px solid #EBEBEB', borderRadius: 16, overflow: 'hidden', background: '#fff' }}
                >
                  {/* 리뷰 사진 */}
                  {r.image_urls?.length > 0 && (
                    <div style={{ aspectRatio: '4/3', overflow: 'hidden' }}>
                      <img
                        src={r.image_urls[0]} alt="리뷰 사진"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                  )}

                  <div style={{ padding: '16px' }}>
                    {/* BEST 뱃지 */}
                    {r.is_best && (
                      <span style={{
                        fontSize: 11, background: '#FFF3CD', color: '#B8860B',
                        padding: '2px 8px', borderRadius: 4, fontWeight: 700,
                        marginBottom: 10, display: 'inline-block',
                      }}>
                        BEST
                      </span>
                    )}

                    {/* 상품 링크 */}
                    {r.products && (
                      <Link href={`/product/${r.products.id}`}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, textDecoration: 'none', color: 'inherit' }}
                      >
                        <div style={{
                          width: 36, height: 36, borderRadius: 8, background: '#F7F7F5', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                        }}>
                          {r.products.thumbnail_url
                            ? <img src={r.products.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
                            : emoji
                          }
                        </div>
                        <span style={{ fontSize: 12, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.products.name}
                        </span>
                      </Link>
                    )}

                    {/* 별점 + 작성자 + 날짜 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <StarRating rating={r.rating} size={14} />
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{r.profiles?.name || '익명'}</span>
                      <span style={{ fontSize: 12, color: '#bbb', marginLeft: 'auto' }}>
                        {new Date(r.created_at).toLocaleDateString('ko-KR')}
                      </span>
                    </div>

                    {/* 본문 */}
                    <p style={{
                      fontSize: 14, color: '#333', lineHeight: 1.7,
                      display: '-webkit-box', WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {r.content}
                    </p>

                    {r.likes_count > 0 && (
                      <p style={{ fontSize: 12, color: '#bbb', marginTop: 8 }}>♥ {r.likes_count}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
