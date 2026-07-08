'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase';

interface Props {
  productId: string;
  productName: string;
  onClose: () => void;
}

export default function ProductDetailEditor({ productId, productName, onClose }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sectionId, setSectionId] = useState<string | null>(null);

  /* ── 기존 내용 불러오기 ── */
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from('product_detail_sections')
        .select('*')
        .eq('product_id', productId)
        .order('sort_order')
        .limit(1)
        .maybeSingle();

      if (data) {
        setSectionId(data.id);
        if (editorRef.current) editorRef.current.innerHTML = data.content || '';
      } else {
        if (editorRef.current) {
          editorRef.current.innerHTML = `
            <h2>상품 소개</h2>
            <p>여기에 상품 상세 설명을 입력하세요.</p>
            <h3>특징</h3>
            <ul><li>특징 1</li><li>특징 2</li><li>특징 3</li></ul>
          `;
        }
      }
      setLoading(false);
    }
    load();
  }, [productId]);

  /* ── 저장 ── */
  async function handleSave() {
    if (!editorRef.current) return;
    setSaving(true);
    const html = editorRef.current.innerHTML;
    const supabase = createClient();

    if (sectionId) {
      await supabase
        .from('product_detail_sections')
        .update({ content: html })
        .eq('id', sectionId);
    } else {
      const { data } = await supabase
        .from('product_detail_sections')
        .insert({ product_id: productId, section_type: 'html', content: html, sort_order: 0 })
        .select('id')
        .single();
      if (data) setSectionId(data.id);
    }

    setSaving(false);
    alert('저장됐습니다. 상품 상세페이지에서 확인해보세요.');
  }

  /* ── 이미지 업로드 ── */
  async function handleImage(file: File) {
    const supabase = createClient();
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `detail/${productId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('products').upload(path, file, { upsert: true });
    if (error) { alert('이미지 업로드 실패'); return; }
    const { data } = supabase.storage.from('products').getPublicUrl(path);
    document.execCommand('insertImage', false, data.publicUrl);
  }

  /* ── 툴바 명령 실행 ── */
  function cmd(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  }

  const Divider = () => (
    <div style={{ width: 1, height: 20, background: '#D8D8D8', margin: '0 2px', flexShrink: 0 }} />
  );

  function TBtn({
    label, title, onClick, active,
  }: { label: React.ReactNode; title: string; onClick: () => void; active?: boolean }) {
    return (
      <button
        type="button"
        title={title}
        onMouseDown={e => { e.preventDefault(); onClick(); }}
        style={{
          padding: '3px 8px', borderRadius: 4, border: 'none', cursor: 'pointer',
          background: active ? '#1A1A1A' : 'transparent',
          color: active ? '#fff' : '#333',
          fontSize: 13, fontWeight: 600, lineHeight: '22px', whiteSpace: 'nowrap',
        }}
      >{label}</button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 12,
          width: '100%', maxWidth: 900, maxHeight: '95vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >

        {/* ── 헤더 ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid #EBEBEB', flexShrink: 0,
          background: '#fff',
        }}>
          <div>
            <span style={{ fontSize: 15, fontWeight: 700 }}>상세설명 편집</span>
            <span style={{ fontSize: 12, color: '#999', marginLeft: 10 }}>{productName}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSave} disabled={saving} style={{
              padding: '8px 22px', background: '#1A1A1A', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1,
            }}>{saving ? '저장 중...' : '저장'}</button>
            <button onClick={onClose} style={{
              padding: '8px 16px', background: '#F0F0F0', color: '#555',
              border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>닫기</button>
          </div>
        </div>

        {/* ── 툴바 ── */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center',
          padding: '6px 12px', borderBottom: '1px solid #EBEBEB',
          background: '#F8F8F8', flexShrink: 0,
        }}>
          <TBtn label={<b>B</b>} title="굵게" onClick={() => cmd('bold')} />
          <TBtn label={<i>I</i>} title="기울임" onClick={() => cmd('italic')} />
          <TBtn label={<u>U</u>} title="밑줄" onClick={() => cmd('underline')} />
          <Divider />
          <TBtn label="H1" title="제목 1" onClick={() => cmd('formatBlock', '<h2>')} />
          <TBtn label="H2" title="제목 2" onClick={() => cmd('formatBlock', '<h3>')} />
          <TBtn label="본문" title="본문" onClick={() => cmd('formatBlock', '<p>')} />
          <Divider />
          <TBtn label="≡ 좌" title="왼쪽 정렬" onClick={() => cmd('justifyLeft')} />
          <TBtn label="≡ 중" title="가운데 정렬" onClick={() => cmd('justifyCenter')} />
          <TBtn label="≡ 우" title="오른쪽 정렬" onClick={() => cmd('justifyRight')} />
          <Divider />
          <TBtn label="• 목록" title="글머리 목록" onClick={() => cmd('insertUnorderedList')} />
          <TBtn label="1. 목록" title="번호 목록" onClick={() => cmd('insertOrderedList')} />
          <Divider />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#666' }}>색</span>
            <input type="color" defaultValue="#1A1A1A"
              onChange={e => cmd('foreColor', e.target.value)}
              style={{ width: 26, height: 24, border: '1px solid #DDD', borderRadius: 4, cursor: 'pointer', padding: 1 }}
              title="글자 색상"
            />
          </div>
          <Divider />
          <TBtn label="🖼 이미지" title="이미지 삽입" onClick={() => imgInputRef.current?.click()} />
          <TBtn label="─ 구분선" title="구분선" onClick={() => cmd('insertHorizontalRule')} />
          <input ref={imgInputRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImage(f); e.target.value = ''; }}
          />
        </div>

        {/* ── 에디터 본문 — 실제 상품 상세페이지 스타일 그대로 ── */}
        <div className="hide-scrollbar" style={{ flex: 1, overflowY: 'auto', background: '#fff' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#999', fontSize: 14 }}>
              불러오는 중...
            </div>
          ) : (
            <>
              {/* 안내 배너 */}
              <div style={{
                background: '#FFFBEA', borderBottom: '1px solid #F0E68C',
                padding: '8px 20px', fontSize: 12, color: '#7A6500',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                ✏️ 클릭해서 바로 편집 — 실제 상세페이지에서 보이는 모습 그대로입니다
              </div>

              {/* 실제 상세페이지와 동일한 레이아웃 */}
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                style={{
                  maxWidth: 800,
                  margin: '0 auto',
                  padding: '32px 24px 48px',
                  outline: 'none',
                  minHeight: 400,
                  fontSize: 14,
                  lineHeight: 1.85,
                  color: '#1A1A1A',
                  fontFamily: 'inherit',
                }}
                onPaste={e => {
                  const items = e.clipboardData?.items;
                  if (!items) return;
                  for (const item of Array.from(items)) {
                    if (item.type.startsWith('image/')) {
                      e.preventDefault();
                      const file = item.getAsFile();
                      if (file) handleImage(file);
                    }
                  }
                }}
              />
            </>
          )}
        </div>

        {/* ── 푸터 ── */}
        <div style={{
          padding: '8px 20px', borderTop: '1px solid #EBEBEB',
          fontSize: 11, color: '#BBB', flexShrink: 0, background: '#FAFAFA',
        }}>
          💡 이미지를 직접 붙여넣기(Ctrl+V)하거나 툴바의 이미지 버튼으로 삽입할 수 있습니다
        </div>
      </div>
    </div>
  );
}
