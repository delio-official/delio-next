'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import ComingSoon from '@/components/ComingSoon/ComingSoon';
import '@/styles/event.css';

interface Event {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  thumbnail_url: string | null;
  badge: string | null;
  badge_color: string | null;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
}

type FilterType = 'ongoing' | 'ended';

const ITEMS_PER_PAGE = 9;

const FALLBACK_COLORS = [
  'linear-gradient(135deg,#A8E6CF,#4CAF84)',
  'linear-gradient(135deg,#FFE0B2,#FFA726)',
  'linear-gradient(135deg,#F8BBD0,#E91E63)',
  'linear-gradient(135deg,#B3E5FC,#0288D1)',
  'linear-gradient(135deg,#E1BEE7,#9C27B0)',
  'linear-gradient(135deg,#FFD180,#FF8F00)',
];
const FALLBACK_EMOJI = ['🎁', '🎀', '🍓', '🍊', '🍇', '🥝'];

function getEventStatus(ev: Event): 'ongoing' | 'ended' {
  return new Date(ev.ends_at) >= new Date() && ev.is_active ? 'ongoing' : 'ended';
}

function getDday(ends_at: string): string | null {
  const now = new Date();
  const end = new Date(ends_at);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endStart   = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const diff = Math.ceil((endStart.getTime() - todayStart.getTime()) / 86400000);
  if (diff < 0)  return null;
  if (diff === 0) return 'D-DAY';
  return `D-${diff}`;
}

function formatEventDate(starts: string, ends: string) {
  const KD = ['일', '월', '화', '수', '목', '금', '토'];
  function fmt(d: Date) {
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}(${KD[d.getDay()]})`;
  }
  const s = new Date(starts);
  const e = new Date(ends);
  const hasEnd = e.getFullYear() <= 2099;
  return hasEnd ? `${fmt(s)} ~ ${fmt(e)}` : `${fmt(s)} ~`;
}

function Pagination({ total, perPage, page, onChange }: {
  total: number; perPage: number; page: number; onChange: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / perPage);
  if (totalPages <= 1) return null;
  function go(p: number) { onChange(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  return (
    <div className="pagination">
      <button className="page-btn" disabled={page === 0} onClick={() => go(0)}>«</button>
      <button className="page-btn" disabled={page === 0} onClick={() => go(page - 1)}>‹</button>
      {Array.from({ length: totalPages }, (_, i) => (
        <button key={i} className={`page-num${page === i ? ' active' : ''}`} onClick={() => go(i)}>{i + 1}</button>
      ))}
      <button className="page-btn" disabled={page === totalPages - 1} onClick={() => go(page + 1)}>›</button>
      <button className="page-btn" disabled={page === totalPages - 1} onClick={() => go(totalPages - 1)}>»</button>
    </div>
  );
}

export default function EventClient() {
  const [events,  setEvents]  = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState<FilterType>('ongoing');
  const [page,    setPage]    = useState(0);

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

  useEffect(() => { setPage(0); }, [filter]);

  const filtered = events.filter(ev => getEventStatus(ev) === filter);
  const paged    = filtered.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  return (
    <main className="event-page">
      <div className="container">

        {/* ── 탭 ── */}
        <div className="event-tab-row">
          <button
            className={`event-tab-btn${filter === 'ongoing' ? ' active' : ''}`}
            onClick={() => setFilter('ongoing')}
          >
            진행중인 이벤트
          </button>
          <button
            className={`event-tab-btn${filter === 'ended' ? ' active' : ''}`}
            onClick={() => setFilter('ended')}
          >
            종료된 이벤트
          </button>
        </div>

        {loading ? (
          <div className="event-grid">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="event-card-skeleton" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <ComingSoon
            title={filter === 'ongoing' ? '진행중인 이벤트를 준비중입니다.' : '종료된 이벤트가 없습니다.'}
            desc={filter === 'ongoing'
              ? ['알찬 이벤트를 준비하고 있어요.', '빠른 시일 내에 찾아뵙겠습니다.']
              : ['아직 종료된 이벤트가 없습니다.']}
          />
        ) : (
          <>
            <div className="event-grid">
              {paged.map((ev, i) => {
                const idx    = (page * ITEMS_PER_PAGE + i) % FALLBACK_COLORS.length;
                const dday   = getEventStatus(ev) === 'ongoing' ? getDday(ev.ends_at) : null;
                const ended  = getEventStatus(ev) === 'ended';
                const dateStr = formatEventDate(ev.starts_at, ev.ends_at);

                return (
                  <Link key={ev.id} href={`/event/${ev.slug}`} className="event-card">
                    {/* 이미지 영역 */}
                    <div className={`event-card-img-wrap${ended ? ' is-ended' : ''}`}>
                      {ev.thumbnail_url
                        ? <img src={ev.thumbnail_url} alt={ev.title} />
                        : (
                          <div className="event-card-fallback" style={{ background: FALLBACK_COLORS[idx] }}>
                            <span>{FALLBACK_EMOJI[idx]}</span>
                          </div>
                        )
                      }
                      {/* 커스텀 배지 (관리자 지정 텍스트+색상) */}
                      {ev.badge && ev.badge !== 'EVENT' && (
                        <span style={{ position:'absolute', top:10, left:10, background: ev.badge_color || '#1A8A4C', color:'#fff', fontSize:11, fontWeight:700, borderRadius:4, padding:'3px 8px', zIndex:2 }}>{ev.badge}</span>
                      )}
                      {/* D-day 뱃지 */}
                      {dday && <span className="event-dday">{dday}</span>}
                      {/* 종료 오버레이 + 멘트 */}
                      {ended && <div className="event-ended-dim"><span className="event-ended-label">종료된 이벤트</span></div>}
                    </div>

                    {/* 텍스트 영역 */}
                    <div className="event-card-info">
                      <div className="event-card-title">{ev.title}</div>
                      <div className="event-card-date">{dateStr}</div>
                    </div>
                  </Link>
                );
              })}
            </div>

            <Pagination total={filtered.length} perPage={ITEMS_PER_PAGE} page={page} onChange={setPage} />
          </>
        )}

      </div>
    </main>
  );
}
