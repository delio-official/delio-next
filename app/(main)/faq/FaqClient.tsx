'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import '@/styles/faq.css';

interface FaqItem {
  id: string; category: string; question: string; answer: string; sort_order: number;
}

const CATS = [
  { value: 'order',    label: '주문', emoji: '📦' },
  { value: 'delivery', label: '배송', emoji: '🚚' },
  { value: 'return',   label: '교환/환불', emoji: '↩️' },
  { value: 'product',  label: '상품', emoji: '🍎' },
  { value: 'member',   label: '회원', emoji: '👤' },
  { value: 'etc',      label: '기타', emoji: '❓' },
];

export default function FaqClient() {
  const sp = useSearchParams();

  const [items,   setItems]   = useState<FaqItem[]>([]);
  const [cat,     setCat]     = useState(sp.get('tab') || '');
  const [q,       setQ]       = useState('');
  const [open,    setOpen]    = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [catOpen, setCatOpen] = useState(false);
  const catRef = useRef<HTMLDivElement>(null);

  /* 드롭다운 외부 클릭 시 닫기 */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!catRef.current?.contains(e.target as Node)) setCatOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase.from('faq_items').select('*')
        .eq('is_active', true).order('category').order('sort_order');
      setItems((data as FaqItem[]) || []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = items.filter(i => {
    if (cat && i.category !== cat) return false;
    if (q.trim() && !i.question.includes(q.trim()) && !i.answer.includes(q.trim())) return false;
    return true;
  });

  return (
    <div>
      <div className="faq-search-section">
        <div className="container">
          <h1 className="faq-search-title">고객센터 · FAQ</h1>
          <div className="faq-search-row">
            {/* 커스텀 드롭다운 — 카테고리 페이지 정렬 드롭다운과 동일한 스타일 */}
            <div className={`faq-custom-select${catOpen ? ' open' : ''}`} ref={catRef}>
              <button type="button" className="faq-custom-select-btn" onClick={() => setCatOpen(v => !v)}>
                <span>
                  {cat
                    ? `${CATS.find(c => c.value === cat)?.emoji} ${CATS.find(c => c.value === cat)?.label}`
                    : '전체 카테고리'}
                </span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              <ul className="faq-custom-select-list">
                <li className={`faq-custom-select-item${cat === '' ? ' selected' : ''}`}
                  onClick={() => { setCat(''); setCatOpen(false); }}>
                  전체 카테고리
                </li>
                {CATS.map(c => (
                  <li key={c.value}
                    className={`faq-custom-select-item${cat === c.value ? ' selected' : ''}`}
                    onClick={() => { setCat(c.value); setCatOpen(false); }}>
                    {c.emoji} {c.label}
                  </li>
                ))}
              </ul>
            </div>
            <div className="faq-search-input-wrap">
              <input type="text" placeholder="궁금한 내용을 검색해보세요" value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <button className="faq-search-btn">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/>
              </svg>
            </button>
          </div>

          <div className="faq-cat-grid">
            {CATS.map(c => (
              <button key={c.value} className={`faq-cat-btn${cat === c.value ? ' active' : ''}`}
                onClick={() => setCat(prev => prev === c.value ? '' : c.value)}>
                <span style={{ fontSize:22 }}>{c.emoji}</span>
                <span style={{ fontSize:12, fontWeight:600 }}>{c.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop:24, paddingBottom:80 }}>
        {loading ? (
          <p style={{ textAlign:'center', color:'#999', padding:'40px 0' }}>불러오는 중...</p>
        ) : filtered.length === 0 ? (
          <p style={{ textAlign:'center', color:'#999', padding:'60px 0' }}>
            검색 결과가 없습니다.
          </p>
        ) : (
          <div style={{ maxWidth:720, margin:'0 auto' }}>
            {filtered.map(item => (
              <div key={item.id} style={{ borderBottom:'1px solid #F0F0EE' }}>
                <button
                  onClick={() => setOpen(prev => prev === item.id ? null : item.id)}
                  style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'18px 4px', background:'none', border:'none', cursor:'pointer',
                    textAlign:'left', gap:12 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:'#fff', background:'var(--color-accent)',
                      padding:'2px 8px', borderRadius:4, whiteSpace:'nowrap', flexShrink:0 }}>
                      Q
                    </span>
                    <span style={{ fontSize:14, fontWeight:600, color:'var(--color-ink)', lineHeight:1.5 }}>
                      {item.question}
                    </span>
                  </div>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2"
                    style={{ flexShrink:0, transform: open === item.id ? 'rotate(180deg)' : 'none', transition:'transform .2s' }}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                {open === item.id && (
                  <div style={{ padding:'0 4px 18px 34px', background:'#FAFAF8', borderRadius:8,
                    marginBottom:4 }}>
                    <p style={{ fontSize:14, lineHeight:1.8, color:'#444', whiteSpace:'pre-line' }}>
                      {item.answer}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 추가 문의 */}
        <div style={{ maxWidth:720, margin:'40px auto 0',
          background:'#F7F7F5', borderRadius:16, padding:'24px', textAlign:'center' }}>
          <h3 style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>원하는 답변을 찾지 못하셨나요?</h3>
          <p style={{ fontSize:13, color:'#666', marginBottom:16 }}>
            1:1 문의 또는 카카오 채널로 빠르게 도움 드립니다.
          </p>
          <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
            <a href="mailto:hello@delio.co.kr"
              style={{ padding:'10px 20px', border:'1.5px solid var(--color-accent)',
                borderRadius:8, color:'var(--color-accent)', textDecoration:'none',
                fontSize:13, fontWeight:700 }}>
              이메일 문의
            </a>
            <button onClick={() => alert('카카오 채널로 이동합니다.')}
              style={{ padding:'10px 20px', background:'#FEE500', border:'none',
                borderRadius:8, color:'#3C1E1E', fontSize:13, fontWeight:700, cursor:'pointer' }}>
              💬 카카오 채널
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
