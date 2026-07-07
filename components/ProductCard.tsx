'use client';

import { imgThumb } from '@/lib/img';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { openOptionDrawer } from '@/lib/cart';
import { isWishlisted, toggleWishlist } from '@/lib/wishlist';
import { useLoginGuard } from '@/hooks/useLoginGuard';
import { SingleStar } from '@/components/StarRating';
import '@/styles/category.css';

/* 상품 목록 공용 카드 (메인/카테고리/위시리스트 공통) */
export interface ProductCardItem {
  id: string;
  name: string;
  category: string;
  price: number;
  discount_rate: number;
  discounted_price: number;
  thumbnail_url: string | null;
  short_desc?: string | null;
  is_new: boolean;
  is_best: boolean;
  is_dawn: boolean;
  avg_rating: number;
  review_count: number;
  soldout?: boolean;
}

const EMOJI_MAP: Record<string, string> = {
  apple:'🍎', citrus:'🍊', berry:'🫐', melon:'🍈',
  kiwi:'🥝', mango:'🥭', grape:'🍇', gift:'🎁', default:'🍑',
};
const BG_MAP: Record<string, string> = {
  apple:'#FFE8E8', citrus:'#FFF3E0', berry:'#F3E5F5', melon:'#E8F5E9',
  kiwi:'#F1F8E9', mango:'#FFF9E6', grape:'#EDE7F6', gift:'#E8EAF6',
};
function fmtPrice(n: number) { return n.toLocaleString('ko-KR'); }

export function ProductCard({ p, onWishChange }: { p: ProductCardItem; onWishChange?: (wished: boolean) => void }) {
  const emoji = EMOJI_MAP[p.category] || EMOJI_MAP.default;
  const bg    = BG_MAP[p.category]   || '#F4EFE6';
  const deliveryClass = p.is_dawn ? 'tag-dawn' : 'tag-regular';
  const deliveryLabel = p.is_dawn ? '산지직송' : '자사배송';
  const [wished, setWished] = useState(false);
  const requireLogin = useLoginGuard();
  const router = useRouter();

  useEffect(() => {
    isWishlisted(p.id).then(setWished);
  }, [p.id]);

  function handleReviewClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/product/${p.id}?tab=review`);
  }

  function handleCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!requireLogin()) return;
    openOptionDrawer(p.id);
  }

  async function handleWish(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!requireLogin()) return;
    const next = await toggleWishlist(p.id);
    setWished(next);
    onWishChange?.(next);
  }

  const reviewCount = p.review_count > 9999
    ? (p.review_count / 10000).toFixed(1) + '만'
    : p.review_count.toLocaleString('ko-KR');

  return (
    <Link href={`/product/${p.id}`} className="product-card">
      {/* 이미지 영역 */}
      <div className="product-card-img">
        {p.thumbnail_url
          ? <img src={imgThumb(p.thumbnail_url, 400)} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          : <div className="fruit-emoji" style={{ background:`linear-gradient(135deg,${bg} 0%,#fff 100%)` }}>{emoji}</div>
        }
        {p.soldout && <div className="product-card-soldout">품절</div>}
        <span className={`product-card-delivery ${deliveryClass}`}>{deliveryLabel}</span>
        <div className="product-card-actions">
          <button className="product-card-wish" onClick={handleWish}>
            <span style={{ color: wished ? '#E53935' : undefined }}>{wished ? '♥' : '♡'}</span> 찜
          </button>
          <span className="product-card-actions-divider" />
          <button className="cart-btn" onClick={handleCart}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>
              <path d="M2.05 2.05h2l2.66 12.42a2 2 0 001.95 1.53h9.58a2 2 0 001.95-1.53l1.54-8.42H5.05"/>
            </svg>
            담기
          </button>
        </div>
        {/* 모바일 전용: 우하단 담기 버튼 */}
        <button className="product-card-cart-mob" onClick={handleCart} aria-label="담기">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>
            <path d="M2.05 2.05h2l2.66 12.42a2 2 0 001.95 1.53h9.58a2 2 0 001.95-1.53l1.54-8.42H5.05"/>
          </svg>
        </button>
      </div>

      {/* 카드 본문 */}
      <div className="product-card-body">
        <div className="product-brix-wrap">
          {p.is_new  && <span className="product-badge badge-new">NEW</span>}
          {p.is_best && !p.is_new && <span className="product-badge badge-best">인기</span>}
        </div>
        <div className="product-card-name">{p.name}</div>
        {p.short_desc && <div className="product-card-desc">{p.short_desc}</div>}
        <div className="price-block">
          {p.discount_rate > 0 && (
            <div className="price-top-row">
              <span className="price-original">{fmtPrice(p.price)}원</span>
            </div>
          )}
          <div className="product-price-row">
            {p.discount_rate > 0 && <span className="price-discount">{Math.round(p.discount_rate)}%</span>}
            <span className="price-current">{fmtPrice(p.discounted_price ?? p.price)}원</span>
          </div>
        </div>
        <div className="product-rating-row">
          {p.review_count > 0 && (
            <div className="rating-stars" onClick={handleReviewClick}
              role="link" title="후기 보기" style={{ cursor:'pointer' }}>
              <SingleStar size={13} />
              <span>{p.avg_rating.toFixed(1)}</span>
              <span style={{ color:'#bbb' }}>({reviewCount})</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
