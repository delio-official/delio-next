'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

interface FaqItem {
  id: string; category: string; question: string; answer: string; sort_order: number;
}

const CATS = [
  { value: '',        label: '자주 묻는 질문' },
  { value: 'delivery',label: '배송' },
  { value: 'return',  label: '취소/교환/반품' },
  { value: 'order',   label: '결제/주문' },
  { value: 'product', label: '상품' },
  { value: 'member',  label: '회원관련' },
  { value: 'etc',     label: '기타' },
];

/* 카테고리값 → 표시 레이블 */
const CAT_LABEL: Record<string, string> = {
  delivery:'배송', return:'취소/교환/반품', order:'결제/주문',
  product:'상품', member:'회원관련', etc:'기타',
};

export default function FaqClient() {
  const router = useRouter();
  const [items,   setItems]   = useState<FaqItem[]>([]);
  const [cat,     setCat]     = useState('');
  const [q,       setQ]       = useState('');
  const [open,    setOpen]    = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  /* 필터 */
  const filtered = items.filter(i => {
    if (cat && i.category !== cat) return false;
    if (q.trim() && !i.question.includes(q.trim()) && !i.answer.includes(q.trim())) return false;
    return true;
  });

  /* 전체 탭일 때 카테고리별 그룹핑 */
  const grouped: { cat: string; items: FaqItem[] }[] = [];
  if (!cat) {
    const order = ['delivery','return','order','product','member','etc'];
    order.forEach(c => {
      const list = filtered.filter(i => i.category === c);
      if (list.length) grouped.push({ cat: c, items: list });
    });
  }

  return (
    <div style={{ background:'#fff', minHeight:'100vh' }}>
      <div style={{ maxWidth:720, margin:'0 auto', padding:'32px 20px 100px' }}>

        {/* 검색창 */}
        <div style={{ position:'relative', marginBottom:20 }}>
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="검색어를 입력해 보세요."
            style={{
              width:'100%', padding:'14px 48px 14px 18px',
              border:'1.5px solid #E0E0E0', borderRadius:12,
              fontSize:14, color:'#1A1A1A', outline:'none',
              background:'#fff', boxSizing:'border-box',
              fontFamily:'inherit',
            }}
            onFocus={e => (e.target.style.borderColor = '#1A1A1A')}
            onBlur={e  => (e.target.style.borderColor = '#E0E0E0')}
          />
          <div style={{ position:'absolute', right:16, top:'50%', transform:'translateY(-50%)', color:'#888', pointerEvents:'none', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ display:'block' }}>
              <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/>
            </svg>
          </div>
        </div>

        {/* 카테고리 pill 탭 */}
        <div style={{ display:'flex', gap:8, overflowX:'auto', marginBottom:32,
          paddingBottom:4, scrollbarWidth:'none' }}>
          {CATS.map(c => {
            const isActive = cat === c.value;
            return (
              <button key={c.value} onClick={() => { setCat(c.value); setOpen(null); }}
                style={{
                  flexShrink:0, padding:'8px 16px',
                  borderRadius:999, border:'1.5px solid #E0E0E0',
                  background: isActive ? '#1A1A1A' : '#fff',
                  color: isActive ? '#fff' : '#444',
                  fontSize:13, fontWeight: isActive ? 700 : 500,
                  cursor:'pointer', transition:'all .15s', fontFamily:'inherit',
                  whiteSpace:'nowrap',
                }}>
                {c.label}
              </button>
            );
          })}
        </div>

        {/* 콘텐츠 */}
        {loading ? (
          <p style={{ textAlign:'center', color:'#aaa', padding:'60px 0', fontSize:14 }}>불러오는 중...</p>
        ) : filtered.length === 0 ? (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'70px 0' }}>
            <div style={{ width:48, height:48, borderRadius:'50%', border:'1.5px solid #D8D8D8',
              display:'flex', alignItems:'center', justifyContent:'center', marginBottom:18 }}>
              <span style={{ fontSize:22, fontWeight:300, color:'#B0B0B0' }}>!</span>
            </div>
            <p style={{ fontSize:15, color:'#555', fontWeight:500, lineHeight:1.7, textAlign:'center', margin:0 }}>
              검색결과가 없습니다.<br />
              이용에 불편을 드려 죄송합니다.
            </p>
          </div>
        ) : cat ? (
          /* ── 특정 카테고리 선택 ── */
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <span style={{ fontSize:16, fontWeight:800, color:'#1A1A1A' }}>
                {CATS.find(c2 => c2.value === cat)?.label}
              </span>
              <span style={{ fontSize:13, color:'#888' }}>{filtered.length}건</span>
            </div>
            <FaqList items={filtered} open={open} setOpen={setOpen} />
          </>
        ) : (
          /* ── 전체 — 카테고리별 그룹 ── */
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <span style={{ fontSize:16, fontWeight:800, color:'#1A1A1A' }}>자주 묻는 질문</span>
              <span style={{ fontSize:13, color:'#888' }}>{filtered.length}건</span>
            </div>
            {grouped.map(g => (
              <div key={g.cat} style={{ marginBottom:8 }}>
                {/* 카테고리 섹션 헤더 */}
                <div style={{ fontSize:12, fontWeight:700, color:'#888',
                  padding:'10px 0 6px', borderBottom:'1px solid #F0F0F0', marginBottom:0 }}>
                  {CAT_LABEL[g.cat] ?? g.cat}
                </div>
                <FaqList items={g.items} open={open} setOpen={setOpen} />
              </div>
            ))}
          </>
        )}

        {/* 추가 문의 */}
        <div style={{ marginTop:48, background:'#F7F7F5', borderRadius:16,
          padding:'28px 24px', textAlign:'center' }}>
          <div style={{ fontSize:15, fontWeight:700, marginBottom:6 }}>원하는 답변을 찾지 못하셨나요?</div>
          <p style={{ fontSize:13, color:'#888', lineHeight:1.7, marginBottom:20 }}>
            1:1 문의 또는 카카오 채널로 빠르게 도움 드립니다.
          </p>
          <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
            <button onClick={() => router.push('/mypage?panel=cs')}
              style={{ padding:'11px 22px', background:'#1A1A1A', border:'none',
                borderRadius:10, color:'#fff', fontSize:13, fontWeight:700,
                cursor:'pointer', fontFamily:'inherit' }}>
              1:1 문의하기
            </button>
            <button onClick={() => window.open('https://pf.kakao.com/_RxnrxbX/chat', '_blank')}
              style={{ padding:'11px 22px', background:'#FEE500', border:'none',
                borderRadius:10, color:'#3C1E1E', fontSize:13, fontWeight:700,
                cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="#3C1E1E" d="M12 3C6.48 3 2 6.48 2 10.8c0 2.74 1.6 5.15 4.02 6.62l-.97 3.63c-.08.3.23.55.5.38L9.8 18.9c.71.1 1.44.15 2.2.15 5.52 0 10-3.48 10-7.8S17.52 3 12 3z"/>
              </svg>
              카카오 채널
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

/* ── 아코디언 리스트 컴포넌트 ── */
function FaqList({ items, open, setOpen }: {
  items: FaqItem[];
  open: string | null;
  setOpen: (id: string | null) => void;
}) {
  return (
    <div>
      {items.map(item => {
        const isOpen = open === item.id;
        return (
          <div key={item.id} style={{ borderBottom:'1px solid #F4F4F4' }}>
            <button
              onClick={() => setOpen(isOpen ? null : item.id)}
              style={{
                width:'100%', display:'flex', alignItems:'center',
                justifyContent:'space-between', padding:'16px 0',
                background:'none', border:'none', cursor:'pointer',
                textAlign:'left', gap:12, fontFamily:'inherit',
              }}>
              <span style={{
                display:'inline-flex', alignItems:'center', justifyContent:'center',
                width:24, height:24, borderRadius:6,
                background:'#1A1A1A', color:'#fff',
                fontSize:12, fontWeight:600, flexShrink:0,
                letterSpacing:'-0.5px',
              }}>Q</span>
              <span style={{ fontSize:14, fontWeight:500, color:'#1A1A1A', lineHeight:1.5, flex:1 }}>
                {item.question}
              </span>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
                stroke="#888" strokeWidth="2.2" style={{ flexShrink:0,
                  transform: isOpen ? 'rotate(180deg)' : 'none', transition:'transform .2s' }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {isOpen && (
              <div style={{ padding:'0 0 18px 0' }}>
                <p style={{ fontSize:13, lineHeight:1.9, color:'#555',
                  whiteSpace:'pre-line', margin:0,
                  padding:'14px 16px', background:'#F7F7F5', borderRadius:10 }}>
                  {item.answer}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
