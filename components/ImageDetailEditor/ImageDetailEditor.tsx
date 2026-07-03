'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase';

interface Props {
  productId: string;
  productName: string;
  onClose: () => void;
}

export default function ImageDetailEditor({ productId, productName, onClose }: Props) {
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [images,    setImages]    = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── 로드 ── */
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: sec } = await supabase
        .from('product_detail_sections')
        .select('*')
        .eq('product_id', productId)
        .eq('section_type', 'detail_images')
        .maybeSingle();

      if (sec) {
        setSectionId((sec as any).id);
        try {
          const parsed = JSON.parse((sec as any).content);
          setImages(Array.isArray(parsed.images) ? parsed.images : []);
        } catch { /* 기본 빈 배열 */ }
      }
      setLoading(false);
    }
    load();
  }, [productId]);

  /* ── 이미지 업로드 ── */
  async function handleUpload(files: FileList) {
    setUploading(true);
    const supabase = createClient();
    const newUrls: string[] = [];

    for (const file of Array.from(files)) {
      /* 한글·특수문자 파일명은 스토리지 키로 못 쓰므로(Invalid key) 확장자만 사용 */
      const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `detail/${productId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('products').upload(path, file, { upsert: true });
      if (error) { alert(`업로드 실패: ${file.name} (${error.message})`); continue; }
      const { data } = supabase.storage.from('products').getPublicUrl(path);
      newUrls.push(data.publicUrl);
    }

    setImages(prev => [...prev, ...newUrls]);
    setUploading(false);
  }

  /* ── 저장 ── */
  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const content = JSON.stringify({ images });

    if (sectionId) {
      const { error } = await supabase
        .from('product_detail_sections')
        .update({ content })
        .eq('id', sectionId);
      if (error) { setSaving(false); alert(`저장 실패: ${error.message}`); return; }
    } else {
      const { data: ins, error } = await supabase
        .from('product_detail_sections')
        .insert({ product_id: productId, section_type: 'detail_images', content, sort_order: 0 })
        .select('id').single();
      if (error) { setSaving(false); alert(`저장 실패: ${error.message}`); return; }
      if (ins) setSectionId((ins as any).id);
    }

    setSaving(false);
    alert('저장됐습니다. 상품 상세페이지에서 확인해보세요.');
  }

  /* ── 이미지 삭제 ── */
  function removeImage(i: number) {
    setImages(prev => prev.filter((_, j) => j !== i));
  }

  /* ── 순서 이동 ── */
  function moveImage(i: number, dir: -1 | 1) {
    setImages(prev => {
      const next = [...prev];
      const target = i + dir;
      if (target < 0 || target >= next.length) return next;
      [next[i], next[target]] = [next[target], next[i]];
      return next;
    });
  }

  /* ── 드래그 앤 드롭 ── */
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files);
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 760,
          maxHeight: '95vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(0,0,0,0.28)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid #EBEBEB', flexShrink: 0 }}>
          <div>
            <span style={{ fontSize: 15, fontWeight: 700 }}>상세설명 이미지 관리</span>
            <span style={{ fontSize: 12, color: '#999', marginLeft: 10 }}>{productName}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              style={{ padding: '8px 22px', background: '#1A1A1A', color: '#fff',
                border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
                cursor: (saving || loading) ? 'not-allowed' : 'pointer',
                opacity: (saving || loading) ? 0.5 : 1 }}>
              {saving ? '저장 중...' : '저장'}
            </button>
            <button
              onClick={onClose}
              style={{ padding: '8px 16px', background: '#F0F0F0', color: '#555',
                border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              닫기
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: 200, color: '#999' }}>불러오는 중...</div>
          ) : (
            <>
              {/* 업로드 영역 */}
              <div
                onDragOver={onDragOver}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: '2px dashed #D0D0CC', borderRadius: 12,
                  padding: '32px 20px', textAlign: 'center',
                  cursor: 'pointer', marginBottom: 24,
                  background: uploading ? '#F8F8F8' : '#FAFAFA',
                  transition: 'background 0.15s',
                }}
              >
                {uploading ? (
                  <p style={{ fontSize: 14, color: '#999' }}>업로드 중...</p>
                ) : (
                  <>
                    <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
                      <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="#999" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#333', margin: '0 0 4px' }}>
                      클릭하거나 이미지를 여기에 드래그하세요
                    </p>
                    <p style={{ fontSize: 12, color: '#999', margin: 0 }}>
                      JPG, PNG, WebP 등 · 여러 장 동시 업로드 가능
                    </p>
                  </>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={e => { if (e.target.files) handleUpload(e.target.files); e.target.value = ''; }}
              />

              {/* 이미지 목록 */}
              {images.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#BBB', fontSize: 13, padding: '20px 0' }}>
                  등록된 이미지가 없습니다
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 4 }}>
                    이미지 순서 ({images.length}장) — 위에서 아래 순서로 표시됩니다
                  </div>
                  {images.map((url, i) => (
                    <div key={url + i} style={{ display: 'flex', alignItems: 'center',
                      gap: 12, background: '#F8F8F8', borderRadius: 10,
                      padding: '10px 14px', border: '1px solid #EBEBEB' }}>

                      {/* 썸네일 */}
                      <img
                        src={url}
                        alt=""
                        style={{ width: 80, height: 56, objectFit: 'cover',
                          borderRadius: 6, flexShrink: 0, border: '1px solid #E0DFDB' }}
                      />

                      {/* URL (축약) */}
                      <span style={{ flex: 1, fontSize: 11, color: '#999',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {url.split('/').pop()}
                      </span>

                      {/* 순서 버튼 */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                        <button
                          onClick={() => moveImage(i, -1)}
                          disabled={i === 0}
                          style={{ width: 24, height: 22, border: '1px solid #DDD', borderRadius: 4,
                            background: '#fff', cursor: i === 0 ? 'not-allowed' : 'pointer',
                            fontSize: 11, color: '#555', opacity: i === 0 ? 0.3 : 1, lineHeight: 1 }}>
                          ▲
                        </button>
                        <button
                          onClick={() => moveImage(i, 1)}
                          disabled={i === images.length - 1}
                          style={{ width: 24, height: 22, border: '1px solid #DDD', borderRadius: 4,
                            background: '#fff', cursor: i === images.length - 1 ? 'not-allowed' : 'pointer',
                            fontSize: 11, color: '#555', opacity: i === images.length - 1 ? 0.3 : 1, lineHeight: 1 }}>
                          ▼
                        </button>
                      </div>

                      {/* 삭제 버튼 */}
                      <button
                        onClick={() => removeImage(i)}
                        style={{ flexShrink: 0, background: 'none', border: 'none',
                          cursor: 'pointer', color: '#CCC', fontSize: 22,
                          padding: '0 4px', lineHeight: 1 }}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ padding: '8px 20px', borderTop: '1px solid #EBEBEB',
          fontSize: 11, color: '#BBB', flexShrink: 0, background: '#FAFAFA' }}>
          💡 이미지는 상품 상세페이지에서 전체 너비로 세로로 쭉 표시됩니다
        </div>
      </div>
    </div>
  );
}
