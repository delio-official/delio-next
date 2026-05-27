'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import '@/styles/event.css';

interface Event {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  thumbnail_url: string | null;
  badge: string | null;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
}

type FilterType = 'all' | 'ongoing' | 'ended';
type ViewType = 'grid' | 'list';

const ITEMS_PER_PAGE = 6;

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

const FILTERS: { value: FilterType; label: string }[] = [
  { value: 'all',     label: '전체' },
  { value: 'ongoing', label: '진행중 이벤트' },
  { value: 'ended',   label: '종료된 이벤트' },
];

/* 카테고리별 이모지/그라디언트 (썸네일 없을 때 폴백) */
const DECO: { emoji: string; bg: string; color: string }[] = [
  { emoji: '🎁', bg: 'linear-gradient(135deg,#6C9CF8 0%,#5A7FF0 100%)', color: '#fff' },
  { emoji: '🎀', bg: 'linear-gradient(135deg,#FFDEA0 0%,#FFB347 100%)', color: '#7A4800' },
  { emoji: '🍓', bg: 'linear-gradient(135deg,#FFB3C6 0%,#FF6B9D 100%)', color: '#fff' },
  { emoji: '🍎', bg: 'linear-gradient(135deg,#A8E6CF 0%,#4CAF84 100%)', color: '#fff' },
  { emoji: '🍊', bg: 'linear-gradient(135deg,#FFE0B2 0%,#FFA726 100%)', color: '#7A3800' },
  { emoji: '🍇', bg: 'linear-gradient(135deg,#F8BBD0 0%,#E91E63 100%)', color: '#fff' },
  { emoji: '🏆', bg: 'linear-gradient(135deg,#E1BEE7 0%,#9C27B0 100%)', color: '#fff' },
  { emoji: '🥝', bg: 'linear-gradient(135deg,#B3E5FC 0%,#0288D1 100%)', color: '#fff' },
];

function getEventStatus(ev: Event): 'ongoing' | 'ended' {
  const now = new Date();
  return new Date(ev.ends_at) >= now && ev.is_active ? 'ongoing' : 'ended';
}

export default function EventClient() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [view, setView]     = useState<ViewType>('grid');
  const [page, setPage]     = useState(0);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from('events')
        .select('*')
        .order('starts_at', { ascending: false });
      setEvents((data as Event[]) || []);
      setLoading(false);
    }
    load();
  }, []);

  /* 필터 바뀌면 첫 페이지로 리셋 */
  useEffect(() => { setPage(0); }, [filter]);

  const filtered = events.filter(ev => {
    if (filter === 'all') return true;
    return getEventStatus(ev) === filter;
  });
  const paged = filtered.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  return (
    <main className="event-page">
      <div className="container">

        {/* 필터 탭 */}
        <div className="event-filter-row">
          {FILTERS.map(f => (
            <button
              key={f.value}
              className={`event-filter-btn${filter === f.value ? ' active' : ''}`}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* 뷰 토글 */}
        <div className="event-view-row">
          <button
            className={`event-view-btn${view === 'grid' ? ' active' : ''}`}
            onClick={() => setView('grid')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
            </svg>
            이미지형
          </button>
          <button
            className={`event-view-btn${view === 'list' ? ' active' : ''}`}
            onClick={() => setView('list')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
            리스트형
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#bbb' }}>불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#bbb' }}>이벤트가 없습니다.</div>
        ) : (
          <>
            <div className={`event-content ${view === 'grid' ? 'view-grid' : 'view-list'}`}>

              {/* 이미지형 그리드 */}
              <div className="event-grid">
                {paged.map((ev, i) => {
                  const d = DECO[(page * ITEMS_PER_PAGE + i) % DECO.length];
                  const status = getEventStatus(ev);
                  const statusLabel = status === 'ongoing' ? '진행중 이벤트' : '종료된 이벤트';
                  return (
                    <Link key={ev.id} href={`/event/${ev.slug}`} className="event-card">
                      <div className="event-card-banner-wrap">
                        <div className="event-card-banner" style={{ background: d.bg, color: d.color }}>
                          <div className="event-card-text">
                            <div className="event-card-label">{statusLabel}</div>
                            <div className="event-card-title">{ev.title}</div>
                          </div>
                          <div className="event-card-deco">{d.emoji}</div>
                        </div>
                      </div>
                      <div className="event-card-info">
                        <div className="event-card-name">
                          {ev.title}
                          <span className="badge">{ev.badge || 'EVENT'}</span>
                        </div>
                        <div className="event-card-sub">{ev.subtitle || ''}</div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* 리스트형 */}
              <div className="event-list">
                {paged.map((ev, i) => {
                  const d = DECO[(page * ITEMS_PER_PAGE + i) % DECO.length];
                  return (
                    <Link key={ev.id} href={`/event/${ev.slug}`} className="event-list-item">
                      <div className="event-list-thumb" style={{ background: d.bg }}>
                        {d.emoji}
                      </div>
                      <div className="event-list-body">
                        <div className="event-list-name">
                          {ev.title}
                          <span style={{ background:'var(--color-accent)', color:'#fff', fontSize:11,
                            fontWeight:700, borderRadius:4, padding:'1px 5px', marginLeft:6,
                            verticalAlign:'middle', display:'inline-block' }}>
                            {ev.badge || 'EVENT'}
                          </span>
                        </div>
                        <div className="event-list-sub">{ev.subtitle || ''}</div>
                      </div>
                    </Link>
                  );
                })}
              </div>

            </div>
            <Pagination total={filtered.length} perPage={ITEMS_PER_PAGE} page={page} onChange={setPage} />
          </>
        )}
      </div>
    </main>
  );
}
