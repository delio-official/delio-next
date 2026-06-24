'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { StarRating, SingleStar } from '@/components/StarRating';

/* 정규화된 리뷰/상품 데이터 — 세 곳(메인·리뷰페이지·상품상세)에서 이 형태로 맞춰 넘긴다 */
export interface RPReview {
  id: string;
  images: string[];
  rating: number;
  content: string;
  authorName?: string | null;
  isBest?: boolean;
  createdAt?: string | null;
  likesCount?: number;
}
export interface RPProduct {
  id: string;
  name: string;
  thumbnail?: string | null;
  discountRate?: number;
  price?: number;
  discountedPrice?: number;
  avgRating?: number;
  reviewCount?: number;
  ratingText?: string; // 평점 숫자를 못 가져오는 경우(메인) 문자열로
  emoji?: string;
  bg?: string;
}

const fmtPrice = (n: number) => n.toLocaleString('ko-KR');
const fmtDate = (s: string) => { const d = new Date(s); return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`; };

const navMobile = (side: 'left' | 'right'): React.CSSProperties => ({
  position: 'fixed', top: '50%', transform: 'translateY(-50%)', [side]: 8,
  width: 42, height: 42, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', color: '#fff', border: 'none',
  cursor: 'pointer', fontSize: 26, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3600,
});
const navPC = (side: 'left' | 'right'): React.CSSProperties => ({
  position: 'absolute', top: '50%', transform: 'translateY(-50%)', zIndex: 3600,
  width: 52, height: 52, background: 'rgba(0,0,0,0.32)', color: '#fff', border: 'none', borderRadius: '50%',
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  [side]: 'max(8px, calc((100% - 880px) / 2 - 30px))',
});

export default function ReviewPhotoModal({
  review, product, onClose, onPrev, onNext, pos, breakpoint = 500, onBuy, onWish, wished, footerNode,
}: {
  review: RPReview;
  product?: RPProduct | null;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  pos?: string;
  breakpoint?: number;
  onBuy?: () => void;   // 있으면 구매하기 버튼이 이 콜백 호출(없으면 상품페이지 링크)
  onWish?: () => void;  // 있으면 찜 버튼이 이 콜백 호출
  wished?: boolean;
  footerNode?: React.ReactNode; // 있으면 기본 푸터(찜·구매하기) 대신 이걸 렌더 (예: 내 리뷰 수정/삭제)
}) {
  const [activeImg, setActiveImg] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(review.likesCount || 0);
  const [isMobile, setIsMobile] = useState(false);
  const [photoHover, setPhotoHover] = useState(false);
  const touchStartX = useRef(0);
  useEffect(() => {
    const f = () => setIsMobile(window.innerWidth <= breakpoint);
    f(); window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, [breakpoint]);
  useEffect(() => { setActiveImg(0); setLiked(false); setLikeCount(review.likesCount || 0); }, [review.id, review.likesCount]);

  const bg = product?.bg || '#F4EFE6';
  const emoji = product?.emoji || '🍑';
  const images = review.images || [];
  const hasPrice = !!product && (product.price != null || product.discountedPrice != null);

  const multi = images.length > 1;
  const photoArrow = (side: 'left' | 'right'): React.CSSProperties => ({
    position: 'absolute', top: '50%', transform: 'translateY(-50%)', [side]: 8,
    width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,0.42)', color: '#fff', border: 'none',
    cursor: 'pointer', fontSize: 18, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    opacity: photoHover ? 1 : 0, transition: 'opacity .15s', zIndex: 2,
  });
  const photo = (
    <div
      onMouseEnter={() => setPhotoHover(true)}
      onMouseLeave={() => setPhotoHover(false)}
      onTouchStart={multi ? (e) => { touchStartX.current = e.touches[0].clientX; } : undefined}
      onTouchEnd={multi ? (e) => {
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        if (dx < -40 && activeImg < images.length - 1) setActiveImg(activeImg + 1);
        else if (dx > 40 && activeImg > 0) setActiveImg(activeImg - 1);
      } : undefined}
      style={{ position: 'relative', width: '100%', aspectRatio: '1', background: bg, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {images.length > 0
        ? <img src={images[activeImg]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ fontSize: 72 }}>{emoji}</span>}
      {/* 사진 넘기기 — PC는 hover 시 사진 내부 화살표, 모바일은 스와이프 */}
      {multi && !isMobile && activeImg > 0 && (
        <button onClick={e => { e.stopPropagation(); setActiveImg(activeImg - 1); }} aria-label="이전 사진" style={photoArrow('left')}>‹</button>
      )}
      {multi && !isMobile && activeImg < images.length - 1 && (
        <button onClick={e => { e.stopPropagation(); setActiveImg(activeImg + 1); }} aria-label="다음 사진" style={photoArrow('right')}>›</button>
      )}
      {/* 사진 위치 점 인디케이터 */}
      {multi && (
        <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 5, zIndex: 2 }}>
          {images.map((_, i) => (
            <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i === activeImg ? '#fff' : 'rgba(255,255,255,0.5)', transition: 'background .15s' }} />
          ))}
        </div>
      )}
    </div>
  );
  const thumbs = images.length > 1 && (
    <div style={{ display: 'flex', gap: 6, padding: '10px 12px', overflowX: 'auto' }}>
      {images.map((url, i) => (
        <button key={i} onClick={() => setActiveImg(i)} style={{ width: 56, height: 56, borderRadius: 7, overflow: 'hidden', border: `2px solid ${i === activeImg ? '#1A1A1A' : 'transparent'}`, padding: 0, cursor: 'pointer', flexShrink: 0 }}>
          <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </button>
      ))}
    </div>
  );
  const productCard = product && (
    <Link href={`/product/${product.id}`} onClick={onClose} style={{ textDecoration: 'none', color: 'inherit', display: 'block', margin: '12px 16px 4px' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', border: '1px solid #EEE', display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ width: 54, height: 54, borderRadius: 9, flexShrink: 0, background: bg, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
          {product.thumbnail ? <img src={product.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>{product.name}</div>
          {hasPrice && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              {!!product.discountRate && product.discountRate > 0 && <span style={{ fontSize: 12.5, fontWeight: 800, color: '#E53E3E' }}>{Math.round(product.discountRate)}%</span>}
              <span style={{ fontSize: 14.5, fontWeight: 800 }}>{fmtPrice(product.discountedPrice ?? product.price ?? 0)}원</span>
              {!!product.discountRate && product.discountRate > 0 && product.price != null && <span style={{ fontSize: 11, color: '#bbb', textDecoration: 'line-through' }}>{fmtPrice(product.price)}원</span>}
            </div>
          )}
          {(product.avgRating != null || product.ratingText) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 3, fontSize: 11.5, color: '#888' }}>
              <SingleStar size={11} /><span>{product.avgRating != null ? product.avgRating.toFixed(1) : product.ratingText}</span>
              {product.reviewCount != null && <span style={{ color: '#bbb' }}>({product.reviewCount.toLocaleString()})</span>}
            </div>
          )}
        </div>
        <span style={{ fontSize: 18, color: '#ccc', flexShrink: 0 }}>›</span>
      </div>
    </Link>
  );
  const info = (
    <div style={{ padding: '16px 18px 20px' }}>
      {review.authorName && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{emoji}</div>
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>{review.authorName}</div></div>
          {review.isBest && <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: '#FFF3E0', color: '#E65100', border: '1px solid #FFCC80' }}>BEST</span>}
        </div>
      )}
      <div style={{ marginBottom: 14 }}><StarRating rating={review.rating} size={15} /></div>
      <p style={{ fontSize: 14, color: '#333', lineHeight: 1.85, margin: 0, whiteSpace: 'pre-wrap' }}>{review.content}</p>
      {(review.createdAt || review.likesCount != null) && (
        <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12.5, color: '#bbb' }}>{review.createdAt ? fmtDate(review.createdAt) : ''}</span>
          <button onClick={() => { setLiked(v => !v); setLikeCount(v => liked ? v - 1 : v + 1); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 999, border: `1.5px solid ${liked ? '#E53935' : '#E0E0E0'}`, background: liked ? '#FFF5F5' : '#fff', color: liked ? '#E53935' : '#888', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <span>{liked ? '♥' : '♡'}</span>
            도움돼요 {likeCount > 0 && likeCount}
          </button>
        </div>
      )}
    </div>
  );
  const wishStyle: React.CSSProperties = { width: 48, height: 48, borderRadius: 10, border: '1.5px solid #E5E5E5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: wished ? '#E53935' : '#888', fontSize: 22, textDecoration: 'none', background: '#fff', cursor: 'pointer' };
  const buyStyle: React.CSSProperties = { flex: 1, textAlign: 'center', padding: '14px 0', borderRadius: 10, background: 'var(--color-accent)', color: '#fff', fontSize: 15, fontWeight: 700, textDecoration: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' };
  const footer = product && (
    <div style={{ flexShrink: 0, borderTop: '1px solid #EBEBEB', padding: '10px 12px calc(10px + env(safe-area-inset-bottom))', display: 'flex', gap: 10, alignItems: 'center', background: '#fff' }}>
      {onWish
        ? <button onClick={onWish} aria-label="찜" style={wishStyle}>{wished ? '♥' : '♡'}</button>
        : <Link href={`/product/${product.id}`} onClick={onClose} aria-label="찜" style={wishStyle}>♡</Link>}
      {onBuy
        ? <button onClick={onBuy} style={buyStyle}>구매하기</button>
        : <Link href={`/product/${product.id}`} onClick={onClose} style={buyStyle}>구매하기</Link>}
    </div>
  );
  const header = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 12px', borderBottom: '1px solid #EBEBEB', flexShrink: 0 }}>
      {isMobile
        ? <button onClick={onClose} aria-label="뒤로" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 0, color: '#1A1A1A' }}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
        : <span style={{ width: 24 }} />}
      <span style={{ fontSize: 16, fontWeight: 700 }}>사진 후기{pos && <small style={{ fontSize: 13, color: '#aaa', fontWeight: 600, marginLeft: 7 }}>{pos}</small>}</span>
      <button onClick={onClose} aria-label="닫기" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#888', lineHeight: 1, padding: '0 6px' }}>✕</button>
    </div>
  );

  /* 모바일: 세로 풀스크린 + 화면 중앙 좌우 화살표 */
  if (isMobile) {
    return (
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 3500, background: 'rgba(0,0,0,0.6)', display: 'flex' }}>
        <div onClick={e => e.stopPropagation()} style={{ background: '#fff', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {header}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>{photo}{thumbs}{info}{productCard}</div>
          {footerNode ?? footer}
        </div>
        {onPrev && <button onClick={e => { e.stopPropagation(); onPrev(); }} aria-label="이전 리뷰" style={navMobile('left')}>‹</button>}
        {onNext && <button onClick={e => { e.stopPropagation(); onNext(); }} aria-label="다음 리뷰" style={navMobile('right')}>›</button>}
      </div>
    );
  }

  /* PC: 좌우 분할(사진+상품 | 내용) + 모달 밖 배너 화살표 */
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 3500, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 880, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.28)' }}>
        {header}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <div style={{ width: '50%', borderRight: '1px solid #EEE', display: 'flex', flexDirection: 'column', overflowY: 'auto', paddingBottom: 20 }}>{photo}{thumbs}{productCard}</div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ flex: 1, overflowY: 'auto' }}>{info}</div>
            {footerNode ?? footer}
          </div>
        </div>
      </div>
      {onPrev && (
        <button onClick={e => { e.stopPropagation(); onPrev(); }} aria-label="이전 리뷰" style={navPC('left')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="28" height="28" style={{ transform: 'translateX(-1px)' }}><polyline points="15 18 9 12 15 6" /></svg>
        </button>
      )}
      {onNext && (
        <button onClick={e => { e.stopPropagation(); onNext(); }} aria-label="다음 리뷰" style={navPC('right')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="28" height="28" style={{ transform: 'translateX(1px)' }}><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      )}
    </div>
  );
}
