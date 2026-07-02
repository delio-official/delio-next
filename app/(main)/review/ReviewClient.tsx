'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { StarRating, SingleStar } from '@/components/StarRating';
import ComingSoon from '@/components/ComingSoon/ComingSoon';
import ReviewPhotoModal from '@/components/ReviewPhotoModal/ReviewPhotoModal';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import '@/styles/review.css';

interface Review {
  id: string;
  rating: number;
  content: string;
  created_at: string;
  image_urls: string[];
  likes_count: number;
  is_best: boolean;
  author_name: string | null;
  video_url: string | null;
  products: {
    id: string; name: string; thumbnail_url: string | null;
    category: string; avg_rating: number; review_count: number;
    discounted_price: number; price: number; discount_rate: number; is_dawn: boolean;
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

const TEXT_PER_PAGE = 10;
const SEL = '*, products(id,name,thumbnail_url,category,avg_rating,review_count,discounted_price,price,discount_rate,is_dawn), profiles(name)';

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}
function fmtPrice(n: number) { return n.toLocaleString('ko-KR'); }

function Pagination({ total, perPage, page, onChange }: {
  total: number; perPage: number; page: number; onChange: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / perPage);
  if (totalPages <= 1) return null;
  return (
    <div className="pagination">
      <button className="page-btn" disabled={page === 0} onClick={() => onChange(0)}>«</button>
      <button className="page-btn" disabled={page === 0} onClick={() => onChange(page - 1)}>‹</button>
      {Array.from({ length: totalPages }, (_, i) => (
        <button key={i} className={`page-num${page === i ? ' active' : ''}`} onClick={() => onChange(i)}>{i + 1}</button>
      ))}
      <button className="page-btn" disabled={page === totalPages - 1} onClick={() => onChange(page + 1)}>›</button>
      <button className="page-btn" disabled={page === totalPages - 1} onClick={() => onChange(totalPages - 1)}>»</button>
    </div>
  );
}


export default function ReviewClient() {
  const [photoReviews, setPhotoReviews] = useState<Review[]>([]);
  const [textReviews,  setTextReviews]  = useState<Review[]>([]);
  const [photoTotal,   setPhotoTotal]   = useState(0);
  const [textTotal,    setTextTotal]    = useState(0);
  const [textPage,     setTextPage]     = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [galleryOpen,  setGalleryOpen]  = useState(false);
  const [galleryIdx,   setGalleryIdx]   = useState<number | null>(null);
  const [modalReview,  setModalReview]  = useState<Review | null>(null);
  useBodyScrollLock(!!modalReview || galleryIdx !== null);

  /* 페이지 진입 시 항상 최상단부터 (이미지 지연로드로 스크롤이 밀리는 것 방지) */
  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = createClient();

      const { data: pData, count: pCount } = await supabase
        .from('reviews').select(SEL, { count: 'exact' })
        .neq('image_urls', '{}')
        .order('is_best', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(20);
      setPhotoReviews((pData as Review[]) || []);
      setPhotoTotal(pCount || 0);

      const tFrom = textPage * TEXT_PER_PAGE;
      const { data: tData, count: tCount } = await supabase
        .from('reviews').select(SEL, { count: 'exact' })
        .order('is_best', { ascending: false })
        .order('created_at', { ascending: false })
        .range(tFrom, tFrom + TEXT_PER_PAGE - 1);
      setTextReviews((tData as Review[]) || []);
      setTextTotal(tCount || 0);

      setLoading(false);
    }
    load();
  }, [textPage]);

  const selPhotoReview = galleryIdx !== null ? photoReviews[galleryIdx] : null;
  const closeGallery = () => { setGalleryOpen(false); setGalleryIdx(null); };

  return (
    <>
      <div style={{ background: '#fff', minHeight: '100vh' }}>

        {/* 헤더 */}
        <div style={{ padding: '36px 0 28px', borderBottom: '1px solid #EBEBEB' }}>
          <div className="container">
            <small style={{ fontSize: 13, color: '#888', display: 'block', marginBottom: 6 }}>실제 구매 고객이 찍은 사진 리뷰</small>
            <h1 style={{ fontSize: 'clamp(20px,3vw,28px)', fontWeight: 800 }}>구매 리뷰</h1>
          </div>
        </div>

        <div className="container" style={{ paddingTop: 44, paddingBottom: 100 }}>

          {/* 포토&동영상 썸네일 스트립 */}
          <section style={{ marginBottom: 48 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>
                포토&amp;동영상 <span style={{ color: '#888', fontWeight: 500 }}>{photoTotal}</span>
              </span>
              <button onClick={() => { setGalleryOpen(true); setGalleryIdx(null); }}
                style={{ fontSize: 13, color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                전체보기 &gt;
              </button>
            </div>

            {loading ? (
              <div style={{ display: 'flex', gap: 6 }}>
                {Array(8).fill(0).map((_, i) => (
                  <div key={i} style={{ width: 120, height: 120, borderRadius: 8, background: '#F0F0EE', flexShrink: 0 }} />
                ))}
              </div>
            ) : photoReviews.length === 0 ? (
              <p style={{ color: '#bbb', fontSize: 13 }}>포토 리뷰가 없습니다.</p>
            ) : (
              <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 4 }}>
                {photoReviews.map((r, i) => {
                  const cat = r.products?.category || 'default';
                  const bg  = BG_MAP[cat] || '#F4EFE6';
                  const emoji = EMOJI_MAP[cat] || EMOJI_MAP.default;
                  return (
                    <div key={r.id} style={{ flexShrink: 0, cursor: 'pointer' }}
                      onClick={() => setModalReview(r)}>
                      <div style={{ width: 120, height: 120, borderRadius: 8, overflow: 'hidden', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>
                        {r.image_urls?.[0]
                          ? <img src={r.image_urls[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : emoji
                        }
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 전체 리뷰 목록 */}
          <section id="all-reviews">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 0, borderTop: '2px solid #1A1A1A', paddingTop: 32 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800 }}>전체 리뷰</h2>
              <span style={{ fontSize: 13, color: '#999', fontWeight: 500 }}>총 {textTotal.toLocaleString()}개</span>
            </div>

            {loading ? (
              <p style={{ textAlign: 'center', color: '#999', padding: '40px 0' }}>불러오는 중...</p>
            ) : textReviews.length === 0 ? (
              <ComingSoon
                compact
                title="등록된 리뷰가 없습니다."
                desc={['첫 구매 후기를 남겨주세요.']}
              />
            ) : (
              <div>
                {textReviews.map(r => {
                  const cat   = r.products?.category || 'default';
                  const emoji = EMOJI_MAP[cat] || EMOJI_MAP.default;
                  const bg    = BG_MAP[cat] || '#F4EFE6';
                  return (
                    <div key={r.id} style={{ display: 'flex', gap: 16, padding: '22px 0', borderBottom: '1px solid #F4F4F4', alignItems: 'flex-start', cursor: 'pointer' }}
                      onClick={() => setModalReview(r)}>
                      <div style={{ width: 72, height: 72, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, overflow: 'hidden', flexShrink: 0 }}>
                        {r.products?.thumbnail_url
                          ? <img src={r.products.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : emoji
                        }
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                          {r.is_best && (
                            <span style={{ fontSize: 10, fontWeight: 700, background: '#1A1A1A', color: '#fff', borderRadius: 4, padding: '2px 7px', flexShrink: 0 }}>BEST</span>
                          )}
                          {r.products && (
                            <span style={{ fontSize: 13, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                              {r.products.name}
                            </span>
                          )}
                        </div>
                        <StarRating rating={r.rating} size={13} />
                        <p style={{ fontSize: 14, color: '#333', lineHeight: 1.75, marginTop: 7, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {r.content}
                        </p>
                        {r.image_urls?.length > 0 && (
                          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                            {r.image_urls.slice(0, 4).map((url, i) => (
                              <img key={i} src={url} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, border: '1px solid #F0F0EE' }} />
                            ))}
                          </div>
                        )}
                      </div>

                      <div style={{ flexShrink: 0, textAlign: 'right', paddingTop: 2 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>{r.author_name || r.profiles?.name || '익명'}</div>
                        <div style={{ fontSize: 12, color: '#bbb', marginTop: 3 }}>{fmtDate(r.created_at)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <Pagination
              total={textTotal} perPage={TEXT_PER_PAGE} page={textPage}
              onChange={p => { setTextPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            />
          </section>

        </div>
      </div>

      {/* 포토 전체보기 그리드 모달 */}
      {galleryOpen && (
        <div onClick={closeGallery} style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 640, height: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.28)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #EBEBEB', flexShrink: 0 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>사진 후기 전체보기 ({photoTotal})</span>
              <button onClick={closeGallery} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#888', lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 6 }}>
                {photoReviews.map(r => {
                  const cat = r.products?.category || 'default';
                  const bg  = BG_MAP[cat] || '#F4EFE6';
                  const emoji = EMOJI_MAP[cat] || EMOJI_MAP.default;
                  return (
                    <div key={r.id} onClick={() => { closeGallery(); setModalReview(r); }}
                      style={{ aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: bg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>
                      {r.image_urls?.[0]
                        ? <img src={r.image_urls[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : emoji
                      }
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 리뷰 상세 모달 */}
      {modalReview && (() => {
        const list = photoReviews.some(r => r.id === modalReview.id) ? photoReviews : textReviews;
        const idx = list.findIndex(r => r.id === modalReview.id);
        const prod = modalReview.products;
        return (
          <ReviewPhotoModal
            review={{ id: modalReview.id, images: modalReview.image_urls || [], videoUrl: modalReview.video_url, rating: modalReview.rating, content: modalReview.content, authorName: modalReview.author_name || modalReview.profiles?.name || '익명', isBest: modalReview.is_best, createdAt: modalReview.created_at, likesCount: modalReview.likes_count }}
            product={prod ? { id: prod.id, name: prod.name, thumbnail: prod.thumbnail_url, discountRate: prod.discount_rate, price: prod.price, discountedPrice: prod.discounted_price, avgRating: prod.avg_rating, reviewCount: prod.review_count } : null}
            onClose={() => setModalReview(null)}
            onPrev={idx > 0 ? () => setModalReview(list[idx - 1]) : undefined}
            onNext={idx >= 0 && idx < list.length - 1 ? () => setModalReview(list[idx + 1]) : undefined}
            pos={idx >= 0 && list.length > 1 ? `${idx + 1} / ${list.length}` : undefined}
          />
        );
      })()}
    </>
  );
}
