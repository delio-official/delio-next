'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import { imgThumb } from '@/lib/img';
import { TASTE_AXES } from '@/lib/taste';

/* 공용 리뷰 작성 모달 — 상품페이지·마이페이지 어디서든 그 자리에 띄운다.
   제출 성공 시 리뷰 insert + 사진/영상 업로드 + 포인트 적립 + 상품 평점 갱신까지 처리하고
   onSubmitted(적립포인트)로 부모에게 알린다. */
interface Props {
  product: { id: string; name: string; thumbnail?: string | null };
  userId: string;
  initialStar?: number;
  rewardText?: number;   // 리뷰 작성 적립
  rewardPhoto?: number;  // 사진·영상 첨부 적립
  isMobile?: boolean;
  onClose: () => void;
  onSubmitted?: (earnedPt: number) => void;
}

export default function ReviewWriteModal({
  product, userId, initialStar = 0, rewardText = 0, rewardPhoto = 0, isMobile = false, onClose, onSubmitted,
}: Props) {
  const [newRating, setNewRating] = useState(initialStar);
  const [newContent, setNewContent] = useState('');
  const [newTaste, setNewTaste] = useState<Record<string, number>>({});
  const [newImages, setNewImages] = useState<File[]>([]);
  const [newVideo, setNewVideo] = useState<File | null>(null);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const reviewDragSrc = useRef<number | null>(null);
  const reviewDropTarget = useRef<number | null>(null);
  const reviewPt = { text: rewardText, photo: rewardPhoto };

  function reorderReviewImages(to: number) {
    const from = reviewDragSrc.current;
    reviewDragSrc.current = null;
    if (from === null || from === to) return;
    setNewImages(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  async function handleSubmitReview() {
    if (newRating < 1) { alert('별점을 선택해주세요.'); return; }
    if (newContent.trim().length < 10) { alert('리뷰 내용을 10자 이상 입력해주세요.'); return; }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    const supabase = createClient();
    const safeName = (name: string) => `${Date.now()}.${name.split('.').pop() ?? ''}`;

    /* 이미지 업로드 */
    const uploadedImageUrls: string[] = [];
    if (newImages.length > 0) {
      setMediaUploading(true);
      for (const file of newImages) {
        const path = `reviews/${userId}/${safeName(file.name)}`;
        const { error: upErr } = await supabase.storage.from('products').upload(path, file, { upsert: true });
        if (upErr) { submittingRef.current = false; setSubmitting(false); setMediaUploading(false); alert(`사진 업로드 실패: ${upErr.message}`); return; }
        uploadedImageUrls.push(supabase.storage.from('products').getPublicUrl(path).data.publicUrl);
      }
      setMediaUploading(false);
    }
    /* 영상 업로드 */
    let uploadedVideoUrl: string | null = null;
    if (newVideo) {
      setMediaUploading(true);
      const path = `reviews/${userId}/${safeName(newVideo.name)}`;
      const { error: upErr } = await supabase.storage.from('products').upload(path, newVideo, { upsert: true });
      if (upErr) { submittingRef.current = false; setSubmitting(false); setMediaUploading(false); alert(`영상 업로드 실패: ${upErr.message}`); return; }
      uploadedVideoUrl = supabase.storage.from('products').getPublicUrl(path).data.publicUrl;
      setMediaUploading(false);
    }

    /* 작성자 표시명(마스킹) */
    let authorName: string | null = null;
    {
      const { data: me } = await supabase.from('profiles').select('name').eq('id', userId).maybeSingle();
      if (me?.name) authorName = me.name.charAt(0) + '****';
    }

    const reviewPayload: Record<string, unknown> = {
      product_id: product.id, user_id: userId, rating: newRating, content: newContent.trim(),
      image_urls: uploadedImageUrls.length > 0 ? uploadedImageUrls : null,
      video_url: uploadedVideoUrl,
      taste: Object.keys(newTaste).length > 0 ? newTaste : null,
      author_name: authorName, is_best: false,
    };
    let { data: inserted, error } = await supabase.from('reviews').insert(reviewPayload).select('id').single();
    if (error && /author_name|column/i.test(error.message)) {
      delete reviewPayload.author_name;
      ({ data: inserted, error } = await supabase.from('reviews').insert(reviewPayload).select('id').single());
    }
    if (error) { submittingRef.current = false; setSubmitting(false); alert('리뷰 등록 중 오류가 발생했습니다.'); return; }

    /* 포인트 적립(멱등) */
    let earnedPt = 0;
    if (inserted?.id) {
      try {
        const res = await fetch('/api/reviews/reward', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reviewId: inserted.id }),
        });
        earnedPt = (await res.json())?.granted || 0;
      } catch { /* 적립 실패는 등록에 영향 없음 */ }
    }

    /* 상품 평점·리뷰수 갱신 */
    const { data: rows } = await supabase.from('reviews').select('rating').eq('product_id', product.id);
    const list = (rows as { rating: number }[]) || [];
    const cnt = list.length;
    const avg = cnt > 0 ? Math.round(list.reduce((s, r) => s + r.rating, 0) / cnt * 10) / 10 : 0;
    await supabase.from('products').update({ review_count: cnt, avg_rating: avg }).eq('id', product.id);

    alert(earnedPt > 0 ? `리뷰가 등록됐습니다. ${earnedPt.toLocaleString()}P 적립! 감사합니다 🎉` : '리뷰가 등록됐습니다. 감사합니다!');
    submittingRef.current = false; setSubmitting(false);
    onSubmitted?.(earnedPt);
    onClose();
  }

  const blocked = submitting || mediaUploading || newRating < 1 || newContent.trim().length < 10;

  return (
    <div
      style={{ position:'fixed', inset:0, background: isMobile ? '#fff' : 'rgba(0,0,0,0.5)', zIndex:3300,
        display:'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent:'center', padding: isMobile ? 0 : 16 }}
      onClick={onClose}
    >
      <div
        style={{ background:'#fff', width:'100%', maxWidth: isMobile ? '100%' : 540,
          height: isMobile ? '100%' : 'auto', maxHeight: isMobile ? '100%' : '92vh',
          borderRadius: isMobile ? 0 : 16, display:'flex', flexDirection:'column', overflow:'hidden',
          boxShadow: isMobile ? 'none' : '0 24px 64px rgba(0,0,0,0.28)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div style={{ flexShrink:0, position:'relative', display:'flex', alignItems:'center', justifyContent:'center', padding:'15px 16px', borderBottom:'1px solid #EEE' }}>
          <button onClick={onClose} style={{ position:'absolute', right:12, background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#333', lineHeight:1, padding:'0 4px' }}>✕</button>
          <span style={{ fontSize:17, fontWeight:700 }}>리뷰 남기기</span>
        </div>

        {/* 스크롤 본문 */}
        <div className="hide-scrollbar" style={{ flex:1, overflowY:'auto', padding:'20px 18px 24px' }}>
          {/* 상품 정보 */}
          <div style={{ display:'flex', gap:12, alignItems:'center', paddingBottom:18, borderBottom:'1px solid #F0F0F0', marginBottom:20 }}>
            <div style={{ width:56, height:56, borderRadius:8, overflow:'hidden', flexShrink:0, background:'#F4F4F2', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26 }}>
              {product.thumbnail ? <img src={imgThumb(product.thumbnail, 200)} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : '🍑'}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13.5, fontWeight:600, color:'#222', lineHeight:1.4, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{product.name}</div>
              {Math.max(reviewPt.text, reviewPt.photo) > 0 && (
                <span style={{ display:'inline-block', marginTop:6, fontSize:11, fontWeight:700, color:'var(--color-accent)', background:'var(--color-accent-bg)', padding:'2px 8px', borderRadius:5 }}>
                  최대 {Math.max(reviewPt.text, reviewPt.photo).toLocaleString()}P
                </span>
              )}
            </div>
          </div>

          {/* 포인트 적립 안내 */}
          {(reviewPt.text > 0 || reviewPt.photo > 0) && (
            <div style={{ marginBottom:20, padding:'14px 16px', borderRadius:12, background:'var(--color-accent-bg)', border:'1px solid var(--color-accent-soft)', textAlign:'left' }}>
              <div style={{ fontSize:14, lineHeight:1.7, color:'var(--color-ink-soft)' }}>
                리뷰를 남기면 포인트를 드려요!<br />
                <b style={{ color:'var(--color-accent)' }}>일반 리뷰 {reviewPt.text.toLocaleString()}P</b>
                {reviewPt.photo > 0 && <>{' · '}<b style={{ color:'var(--color-accent)' }}>포토(사진·영상) 리뷰 {reviewPt.photo.toLocaleString()}P</b></>}
              </div>
            </div>
          )}

          {/* 별점 */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:15, fontWeight:700, marginBottom:12, color:'var(--color-ink)' }}>이 상품 어떠셨나요?</div>
            <div style={{ display:'flex', gap:4 }}>
              {[1,2,3,4,5].map(s => (
                <button key={s} onClick={() => setNewRating(s)} style={{ background:'none', border:'none', cursor:'pointer', padding:2, lineHeight:1 }}>
                  <svg width={32} height={32} viewBox="0 0 20 20" style={{ display:'block' }}>
                    <path d="M10 1L12.6 6.4L18.6 7.2L14.3 11.4L15.3 17.3L10 14.5L4.7 17.3L5.7 11.4L1.4 7.2L7.4 6.4Z"
                      fill={s <= newRating ? '#FFCA28' : '#E0E0E0'} stroke={s <= newRating ? '#FFCA28' : '#E0E0E0'} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" style={{ transition:'fill .1s' }} />
                  </svg>
                </button>
              ))}
              <span style={{ fontSize:14, fontWeight:700, color:'var(--color-ink-soft)', alignSelf:'center', marginLeft:4 }}>
                {['', '아쉬워요', '그냥 그래요', '괜찮아요', '정말 좋아요', '최고에요'][newRating]}
              </span>
            </div>
          </div>

          {/* 맛 평가 */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:10, color:'var(--color-ink-soft)' }}>
              맛 평가 <span style={{ fontSize:11, color:'#BBB', fontWeight:400 }}>선택 · 다른 구매자에게 도움돼요</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {TASTE_AXES.map(axis => (
                <div key={axis.key}>
                  <div style={{ fontSize:12, fontWeight:600, color:'#555', marginBottom:6 }}>
                    <span style={{ marginRight:4 }}>{axis.icon}</span>{axis.label}
                  </div>
                  <div style={{ display:'flex', gap:4 }}>
                    {axis.levels.map((lv, i) => {
                      const level = i + 1;
                      const on = newTaste[axis.key] === level;
                      return (
                        <button key={level} type="button" onClick={() => setNewTaste(prev => ({ ...prev, [axis.key]: level }))}
                          style={{ flex:1, padding:'7px 2px', borderRadius:8, cursor:'pointer', border:`1.5px solid ${on ? '#1A1A1A' : '#E5E5E5'}`, background:'#fff', color: on ? '#1A1A1A' : '#999', fontSize:11, fontWeight:on ? 700 : 500, fontFamily:'inherit', lineHeight:1.3, transition:'all .12s', whiteSpace:'pre-line', textAlign:'center' }}>
                          {lv.length >= 5 ? lv.replace(' ', '\n') : lv}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 사진/영상 첨부 */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:8, color:'var(--color-ink-soft)' }}>
              사진/영상 첨부 <span style={{ fontSize:11, color:'#BBB', fontWeight:400, marginLeft:6 }}>사진 최대 5장 + 영상 1개 (선택)</span>
            </div>
            {newImages.length > 1 && <div style={{ fontSize:11, color:'#999', marginBottom:8 }}>↔ 사진을 드래그해 순서를 변경할 수 있어요</div>}
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
              {newImages.map((file, i) => (
                <div key={i} data-rimg={i} draggable
                  onDragStart={() => { reviewDragSrc.current = i; }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => reorderReviewImages(i)}
                  onDragEnd={() => { reviewDragSrc.current = null; }}
                  onTouchStart={() => { reviewDragSrc.current = i; reviewDropTarget.current = i; }}
                  onTouchMove={e => { const t = e.touches[0]; const el = (document.elementFromPoint(t.clientX, t.clientY) as HTMLElement | null)?.closest('[data-rimg]'); if (el) reviewDropTarget.current = Number(el.getAttribute('data-rimg')); }}
                  onTouchEnd={() => { if (reviewDropTarget.current !== null) reorderReviewImages(reviewDropTarget.current); reviewDropTarget.current = null; }}
                  style={{ position:'relative', width:64, height:64, flexShrink:0, cursor:'grab', touchAction:'none' }}>
                  <img src={URL.createObjectURL(file)} alt="" draggable={false} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:8, border:'1px solid #E8E8E6', pointerEvents:'none' }} />
                  <button onClick={() => setNewImages(prev => prev.filter((_, j) => j !== i))} style={{ position:'absolute', top:3, right:3, width:18, height:18, borderRadius:'50%', background:'rgba(0,0,0,0.55)', color:'#fff', border:'none', fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0, lineHeight:1 }}>✕</button>
                </div>
              ))}
              {newVideo && (
                <div style={{ position:'relative', width:64, height:64, flexShrink:0, order:2 }}>
                  <video src={URL.createObjectURL(newVideo)} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:8, border:'1px solid #E8E8E6' }} />
                  <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.25)', borderRadius:8 }}><span style={{ fontSize:20 }}>▶</span></div>
                  <button onClick={() => setNewVideo(null)} style={{ position:'absolute', top:3, right:3, width:18, height:18, borderRadius:'50%', background:'rgba(0,0,0,0.55)', color:'#fff', border:'none', fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0, lineHeight:1 }}>✕</button>
                </div>
              )}
              {newImages.length < 5 && (() => {
                const imgRef = { current: null as HTMLInputElement | null };
                return (
                  <>
                    <button onClick={() => imgRef.current?.click()} style={{ width:64, height:64, flexShrink:0, borderRadius:8, border:'1px solid #DDD', background:'#fff', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, order:-1 }}>
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#333" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                      <span style={{ fontSize:11, color:'#999', fontWeight:600 }}>{newImages.length}/5</span>
                    </button>
                    <input ref={r => { imgRef.current = r; }} type="file" accept="image/*" multiple style={{ display:'none' }}
                      onChange={e => { if (!e.target.files) return; const files = Array.from(e.target.files).slice(0, 5 - newImages.length); setNewImages(prev => [...prev, ...files]); e.target.value = ''; }} />
                  </>
                );
              })()}
              {!newVideo && (() => {
                const vidRef = { current: null as HTMLInputElement | null };
                return (
                  <>
                    <button onClick={() => vidRef.current?.click()} style={{ width:64, height:64, flexShrink:0, borderRadius:8, border:'1px solid #DDD', background:'#fff', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, order:1 }}>
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#333" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                      <span style={{ fontSize:11, color:'#999', fontWeight:600 }}>{newVideo ? 1 : 0}/1</span>
                    </button>
                    <input ref={r => { vidRef.current = r; }} type="file" accept="video/*" style={{ display:'none' }}
                      onChange={e => { if (e.target.files?.[0]) { setNewVideo(e.target.files[0]); e.target.value = ''; } }} />
                  </>
                );
              })()}
            </div>
          </div>

          {/* 리뷰 내용 */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:8, color:'var(--color-ink-soft)' }}>
              리뷰 내용 <span style={{ fontSize:12, color:'var(--color-accent)', fontWeight:600, marginLeft:6 }}>* 최소 10자 이상 작성해 주세요</span>
            </div>
            <textarea value={newContent} onChange={e => setNewContent(e.target.value)}
              placeholder={"상품 품질, 맛, 배송 등 솔직한 후기를 남겨주세요.\n(최소 10자 이상 작성해야 등록할 수 있어요)"} rows={5}
              style={{ width:'100%', padding:'12px 14px', border:'1.5px solid #E8E8E6', borderRadius:10, fontSize:14, lineHeight:1.7, resize:'none', outline:'none', fontFamily:'inherit', boxSizing:'border-box', color:'var(--color-ink)' }} />
            <div style={{ fontSize:12, color:'#bbb', textAlign:'right', marginTop:4 }}>{newContent.length}자</div>
          </div>

        </div>

        {/* 하단 */}
        <div style={{ flexShrink:0, borderTop:'1px solid #EEE', padding:'10px 16px 14px', background:'#fff' }}>
          {Math.max(reviewPt.text, reviewPt.photo) > 0 && (
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:13, marginBottom:8 }}>
              <span style={{ color:'#888' }}>받을 수 있는 포인트</span>
              <span style={{ fontWeight:700 }}>
                <span style={{ color:'var(--color-accent)' }}>{((newImages.length > 0 || newVideo) ? reviewPt.photo : (newContent.trim().length >= 10 ? reviewPt.text : 0)).toLocaleString()}</span>
                <span style={{ color:'#bbb' }}> / {Math.max(reviewPt.text, reviewPt.photo).toLocaleString()}P</span>
              </span>
            </div>
          )}
          <button onClick={handleSubmitReview} disabled={blocked}
            style={{ width:'100%', height:50, background:'#1A1A1A', color:'#fff', border:'none', borderRadius:10, fontSize:15, fontWeight:700, cursor: blocked ? 'not-allowed' : 'pointer', opacity: blocked ? 0.5 : 1, transition:'opacity .15s' }}>
            {mediaUploading ? '파일 업로드 중...' : submitting ? '등록 중...' : '등록하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
