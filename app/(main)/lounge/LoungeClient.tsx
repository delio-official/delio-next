'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import '@/styles/review.css';

interface LoungePost {
  id: number;
  filter: string;
  bg: string;
  emoji: string;
  title: string;
  badge: string;
  date: string;
  content: string;
}

type FilterType = 'all' | 'recipe' | 'story' | 'farm' | 'health';
type ViewType = 'grid' | 'list';

const FILTERS: { value: FilterType; label: string }[] = [
  { value: 'all',    label: '전체' },
  { value: 'recipe', label: '레시피' },
  { value: 'story',  label: '과일이야기' },
  { value: 'farm',   label: '산지소식' },
  { value: 'health', label: '건강팁' },
];

const ITEMS_PER_PAGE = 9;

function Pagination({ total, perPage, page, onChange }: {
  total: number; perPage: number; page: number; onChange: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / perPage);
  if (totalPages <= 1) return null;
  function go(p: number) {
    onChange(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  return (
    <div className="pagination">
      <button className="page-btn" disabled={page === 0} onClick={() => go(0)}>«</button>
      <button className="page-btn" disabled={page === 0} onClick={() => go(page - 1)}>‹</button>
      {Array.from({ length: totalPages }, (_, i) => (
        <button key={i} className={`page-num${page === i ? ' active' : ''}`} onClick={() => go(i)}>
          {i + 1}
        </button>
      ))}
      <button className="page-btn" disabled={page === totalPages - 1} onClick={() => go(page + 1)}>›</button>
      <button className="page-btn" disabled={page === totalPages - 1} onClick={() => go(totalPages - 1)}>»</button>
    </div>
  );
}

export default function LoungeClient() {
  const [posts,   setPosts]   = useState<LoungePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState<FilterType>('all');
  const [view,    setView]    = useState<ViewType>('grid');
  const [page,    setPage]    = useState(0);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from('lounge_posts')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
        .order('created_at', { ascending: false });
      setPosts((data as LoungePost[]) || []);
      setLoading(false);
    }
    load();
  }, []);

  /* 필터 바뀌면 첫 페이지로 리셋 */
  useEffect(() => { setPage(0); }, [filter]);

  const filtered = filter === 'all' ? posts : posts.filter(p => p.filter === filter);
  const paged    = filtered.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  return (
    <main className="lounge-page">
      <div className="container">

        {/* 필터 탭 (중앙) */}
        <div className="lounge-filters-row">
          <div className="lounge-filters">
            {FILTERS.map(f => (
              <button
                key={f.value}
                className={`lounge-filter${filter === f.value ? ' active' : ''}`}
                onClick={() => setFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* 뷰 토글 (우측) */}
        <div className="lounge-view-row">
          <div className="lounge-view-toggle">
            <button
              className={`lounge-view-btn${view === 'grid' ? ' active' : ''}`}
              onClick={() => setView('grid')}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
              </svg>
              이미지형
            </button>
            <button
              className={`lounge-view-btn${view === 'list' ? ' active' : ''}`}
              onClick={() => setView('list')}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
              리스트형
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#bbb' }}>불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#bbb' }}>게시물이 없습니다.</div>
        ) : (
          <>
            {/* 그리드 뷰 */}
            <div className="lounge-grid" style={{ display: view === 'grid' ? 'grid' : 'none' }}>
              {paged.map(p => (
                <Link key={p.id} href={`/lounge/${p.id}`} className="lounge-card"
                  style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="lounge-card-banner-wrap">
                    <div className="lounge-card-banner" style={{ background: p.bg }}>
                      <span className="lounge-card-emoji">{p.emoji}</span>
                    </div>
                  </div>
                  <div className="lounge-card-info">
                    <div className="lounge-card-title">{p.title}</div>
                    <div className="lounge-card-meta">
                      <span className="lounge-badge">{p.badge}</span>
                      <span className="lounge-card-date">{p.date}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* 리스트 뷰 */}
            <div className="lounge-list" style={{ display: view === 'list' ? 'flex' : 'none' }}>
              {paged.map(p => (
                <Link key={p.id} href={`/lounge/${p.id}`} className="lounge-list-item"
                  style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="lounge-list-thumb" style={{ background: p.bg }}>
                    {p.emoji}
                  </div>
                  <div className="lounge-list-body">
                    <span className="lounge-badge">{p.badge}</span>
                    <div className="lounge-list-title">{p.title}</div>
                    <div className="lounge-card-date">{p.date}</div>
                  </div>
                </Link>
              ))}
            </div>

            <Pagination total={filtered.length} perPage={ITEMS_PER_PAGE} page={page} onChange={setPage} />
          </>
        )}

      </div>
    </main>
  );
}
