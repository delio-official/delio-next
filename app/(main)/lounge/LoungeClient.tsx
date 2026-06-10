'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import '@/styles/review.css';

/* 작성일 표시: ISO datetime → "2026.05.30 14:30", 그 외(레거시 문자열)는 그대로 */
function fmtLoungeDate(s: string | null | undefined): string {
  if (!s) return '';
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? `${m[1]}.${m[2]}.${m[3]} ${m[4]}:${m[5]}` : s;
}

interface LoungePost {
  id: number;
  filter: string;
  bg: string | null;
  emoji: string | null;
  title: string;
  badge: string | null;
  date: string | null;
  thumbnail_url: string | null;
  content: string | null;
}

type FilterType = 'all' | 'recipe' | 'story' | 'farm' | 'health';

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

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#bbb' }}>불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#bbb' }}>게시물이 없습니다.</div>
        ) : (
          <>
            <div className="lounge-grid">
              {paged.map(p => (
                <Link key={p.id} href={`/lounge/${p.id}`} className="lounge-card"
                  style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="lounge-card-banner-wrap">
                    {p.thumbnail_url ? (
                      <div className="lounge-card-banner" style={{ background: '#F4EFE6', padding: 0, overflow: 'hidden' }}>
                        <img src={p.thumbnail_url} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ) : (
                      <div className="lounge-card-banner" style={{ background: p.bg ?? '#F4EFE6' } as React.CSSProperties}>
                        <span className="lounge-card-emoji">{p.emoji ?? '🍑'}</span>
                      </div>
                    )}
                  </div>
                  <div className="lounge-card-info">
                    <div className="lounge-card-title">{p.title}</div>
                    <div className="lounge-card-meta">
                      <span className="lounge-badge">{p.badge}</span>
                      <span className="lounge-card-date">{fmtLoungeDate(p.date)}</span>
                    </div>
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
