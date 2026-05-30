'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { StarRating, SingleStar } from '@/components/StarRating';

interface Review {
  id: string;
  rating: number;
  content: string;
  created_at: string;
  image_urls: string[];
  likes_count: number;
  is_best: boolean;
  products: {
    id: string;
    name: string;
    thumbnail_url: string | null;
    category: string;
    avg_rating: number;
    review_count: number;
    discounted_price: number;
    price: number;
    discount_rate: number;
    is_dawn: boolean;
  } | null;
  profiles: { name: string | null } | null;
}

const EMOJI_MAP: Record<string, string> = {
  apple: '🍎', citrus: '🍊', berry: '🫐', melon: '🍈',
  kiwi: '🥝', mango: '🥭', grape: '🍇', gift: '🎁', default: '🍑',
};
const BG_MAP: Record<string, string> = {
  apple: '#FFE8E8', citrus: '#FFF3E0', berry: '#F3E5F5', melon: '#E8F5E9',
  kiwi: '#F1F8E9', mango: '#FFF9E6', grape: '#EDE7F6', gift: '#E8EAF6',
};

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}
function fmtPrice(n: number) { return n.toLocaleString('ko-KR'); }

export default function ReviewDetailClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from('reviews')
        .select(`
          *,
          products(id,name,thumbnail_url,category,avg_rating,review_count,discounted_price,price,discount_rate,is_dawn),
          profiles(name)
        `)
        .eq('id', id)
        .single();
      if (data) {
        setReview(data as Review);
        setLikeCount((data as Review).likes_count || 0);
      }
      setLoading(false);
    }
    if (id) load();
  }, [id]);

  if (loading) {
    return (
      <div style={{ background: '#fff', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#bbb', fontSize: 15 }}>불러오는 중...</div>
      </div>
    );
  }

  if (!review) {
    return (
      <div style={{ background: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div style={{ fontSize: 48 }}>🔍</div>
        <div style={{ fontSize: 16, color: '#666' }}>리뷰를 찾을 수 없습니다.</div>
        <Link href="/review" style={{ fontSize: 14, color: '#888', textDecoration: 'underline' }}>리뷰 목록으로</Link>
      </div>
    );
  }

  const cat   = review.products?.category || 'default';
  const emoji = EMOJI_MAP[cat] || EMOJI_MAP.default;
  const bg    = BG_MAP[cat] || '#F4EFE6';
  const images = review.image_urls || [];
  const prod  = review.products;

  function handleLike() {
    setLiked(v => !v);
    setLikeCount(v => liked ? v - 1 : v + 1);
  }

  return (
    <div style={{ background: '#f9f9f7', minHeight: '100vh' }}>

      {/* 헤더 */}
      <div style={{ background: '#fff', borderBottom: '1px solid #EBEBEB', padding: '20px 0' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => router.back()}
            style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', cursor: 'pointer', color: '#444', fontSize: 20, borderRadius: 8 }}
          >
            ‹
          </button>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: '#1A1A1A' }}>리뷰 상세</h1>
        </div>
      </div>

      <div className="container" style={{ paddingTop: 32, paddingBottom: 80, maxWidth: 720 }}>

        {/* ── 작성자 + 별점 ── */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '24px 28px', marginBottom: 16, border: '1px solid #F0F0EE' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            {/* 아바타 */}
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: bg, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 22, flexShrink: 0,
            }}>{emoji}</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>
                {review.profiles?.name || '익명'}
              </div>
              <div style={{ fontSize: 12, color: '#bbb', marginTop: 2 }}>{fmtDate(review.created_at)}</div>
            </div>
            {review.is_best && (
              <span style={{
                marginLeft: 'auto', fontSize: 11, fontWeight: 700,
                padding: '3px 8px', borderRadius: 4,
                background: '#FFF3E0', color: '#E65100', border: '1px solid #FFCC80',
              }}>BEST</span>
            )}
          </div>

          <StarRating rating={review.rating} size={16} />

          {/* 사진 */}
          {images.length > 0 && (
            <div style={{ marginTop: 20 }}>
              {/* 메인 이미지 */}
              <div style={{
                width: '100%', aspectRatio: '16/10', borderRadius: 12, overflow: 'hidden',
                background: bg, marginBottom: 10,
              }}>
                <img
                  src={images[activeImg]}
                  alt={`리뷰 사진 ${activeImg + 1}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              {/* 썸네일 목록 */}
              {images.length > 1 && (
                <div style={{ display: 'flex', gap: 8 }}>
                  {images.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImg(i)}
                      style={{
                        width: 64, height: 64, borderRadius: 8, overflow: 'hidden',
                        border: i === activeImg ? '2px solid #1A1A1A' : '2px solid transparent',
                        padding: 0, cursor: 'pointer', flexShrink: 0,
                      }}
                    >
                      <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 본문 */}
          <p style={{ fontSize: 15, color: '#333', lineHeight: 1.85, marginTop: 20, whiteSpace: 'pre-wrap' }}>
            {review.content}
          </p>

          {/* 좋아요 */}
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #F4F4F4', display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={handleLike}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 18px', borderRadius: 999,
                border: `1.5px solid ${liked ? '#E53935' : '#E0E0E0'}`,
                background: liked ? '#FFF5F5' : '#fff',
                color: liked ? '#E53935' : '#888',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                transition: 'all .15s',
              }}
            >
              <span style={{ fontSize: 16 }}>{liked ? '♥' : '♡'}</span>
              도움됐어요 {likeCount > 0 && likeCount}
            </button>
          </div>
        </div>

        {/* ── 연결 상품 ── */}
        {prod && (
          <Link
            href={`/product/${prod.id}`}
            style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
          >
            <div style={{
              background: '#fff', borderRadius: 16, padding: '18px 20px',
              border: '1px solid #F0F0EE', display: 'flex', gap: 14, alignItems: 'center',
              transition: 'box-shadow .15s',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,.08)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
            >
              {/* 상품 이미지 */}
              <div style={{
                width: 72, height: 72, borderRadius: 10, flexShrink: 0,
                background: bg, overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
              }}>
                {prod.thumbnail_url
                  ? <img src={prod.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : emoji
                }
              </div>

              {/* 상품 정보 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: '#bbb', marginBottom: 4, fontWeight: 500 }}>구매 상품</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {prod.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                  {prod.discount_rate > 0 && (
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#E53E3E' }}>{prod.discount_rate}%</span>
                  )}
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#1A1A1A' }}>
                    {fmtPrice(prod.discounted_price || prod.price)}원
                  </span>
                  {prod.discount_rate > 0 && (
                    <span style={{ fontSize: 12, color: '#bbb', textDecoration: 'line-through' }}>{fmtPrice(prod.price)}원</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: '#888' }}>
                    <SingleStar size={12} />
                    <span>{prod.avg_rating?.toFixed(1)}</span>
                    <span style={{ color: '#bbb' }}>({prod.review_count?.toLocaleString()})</span>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                    ...(prod.is_dawn
                      ? { background: '#F0FBF4', color: '#1E8A4C', border: '1px solid #7BD4A0' }
                      : { background: '#FFF6EE', color: '#D9600A', border: '1px solid #F4A96A' })
                  }}>
                    {prod.is_dawn ? '산지직송' : '자사배송'}
                  </span>
                </div>
              </div>

              {/* 화살표 */}
              <div style={{ fontSize: 18, color: '#ccc', flexShrink: 0 }}>›</div>
            </div>
          </Link>
        )}

        {/* ── 하단 버튼 ── */}
        <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
          <Link href="/review" style={{
            flex: 1, height: 46,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1.5px solid #E0E0E0', borderRadius: 10,
            fontSize: 14, fontWeight: 600, color: '#555',
            textDecoration: 'none', background: '#fff',
            transition: 'background .15s',
          }}>
            목록으로
          </Link>
          {prod && (
            <Link href={`/product/${prod.id}`} style={{
              flex: 2, height: 46,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#1A1A1A', borderRadius: 10,
              fontSize: 14, fontWeight: 700, color: '#fff',
              textDecoration: 'none',
              transition: 'background .15s',
            }}>
              상품 보러가기
            </Link>
          )}
        </div>

      </div>
    </div>
  );
}
