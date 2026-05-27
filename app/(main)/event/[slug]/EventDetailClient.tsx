'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import '@/styles/event.css';

interface Event {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  thumbnail_url: string | null;
  content: string | null;
  badge: string | null;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function getStatus(ev: Event) {
  const now = new Date();
  return new Date(ev.ends_at) >= now && ev.is_active ? 'ongoing' : 'ended';
}

export default function EventDetailClient() {
  const { slug } = useParams() as { slug: string };
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('slug', slug)
        .single();
      if (!data) { router.push('/event'); return; }
      setEvent(data as Event);
      setLoading(false);
    }
    load();
  }, [slug, router]);

  if (loading) {
    return <div style={{ padding: '80px', textAlign: 'center', color: '#bbb' }}>불러오는 중...</div>;
  }
  if (!event) return null;

  const status = getStatus(event);

  return (
    <main style={{ background: '#fff', minHeight: '60vh', paddingBottom: 80 }}>
      <div className="container" style={{ maxWidth: 780, paddingTop: 32 }}>

        {/* 브레드크럼 */}
        <div style={{ fontSize: 12, color: '#aaa', marginBottom: 24 }}>
          <Link href="/" style={{ color: '#aaa', textDecoration: 'none' }}>홈</Link>
          <span style={{ margin: '0 6px' }}>/</span>
          <Link href="/event" style={{ color: '#aaa', textDecoration: 'none' }}>이벤트</Link>
          <span style={{ margin: '0 6px' }}>/</span>
          <span style={{ color: '#555' }}>{event.title}</span>
        </div>

        {/* 배지 + 제목 */}
        <div style={{ marginBottom: 8 }}>
          <span style={{
            display: 'inline-block',
            background: status === 'ongoing' ? 'var(--color-accent)' : '#bbb',
            color: '#fff', fontSize: 11, fontWeight: 700,
            borderRadius: 4, padding: '2px 8px', marginBottom: 12,
          }}>
            {status === 'ongoing' ? '진행중' : '종료'}
          </span>
          {event.badge && event.badge !== 'EVENT' && (
            <span style={{
              display: 'inline-block', marginLeft: 6,
              background: '#F4EFE6', color: 'var(--color-accent)',
              fontSize: 11, fontWeight: 700, borderRadius: 4, padding: '2px 8px',
            }}>
              {event.badge}
            </span>
          )}
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8, lineHeight: 1.4 }}>{event.title}</h1>
        {event.subtitle && (
          <p style={{ fontSize: 15, color: '#666', marginBottom: 16 }}>{event.subtitle}</p>
        )}

        {/* 기간 */}
        <div style={{ fontSize: 13, color: '#aaa', marginBottom: 32, display: 'flex', gap: 16 }}>
          <span>📅 {fmtDate(event.starts_at)} ~ {fmtDate(event.ends_at)}</span>
        </div>

        {/* 썸네일 */}
        {event.thumbnail_url ? (
          <img
            src={event.thumbnail_url}
            alt={event.title}
            style={{ width: '100%', borderRadius: 12, marginBottom: 32, objectFit: 'cover', maxHeight: 360 }}
          />
        ) : (
          <div style={{
            width: '100%', height: 240, borderRadius: 12, marginBottom: 32,
            background: 'linear-gradient(135deg,#F4EFE6 0%,#fff 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 72,
          }}>🎁</div>
        )}

        {/* 본문 */}
        {event.content ? (
          <div
            style={{ fontSize: 15, lineHeight: 1.9, color: '#333' }}
            dangerouslySetInnerHTML={{ __html: event.content }}
          />
        ) : (
          <p style={{ fontSize: 15, color: '#999', textAlign: 'center', padding: '40px 0' }}>
            이벤트 내용이 없습니다.
          </p>
        )}

        {/* 목록으로 */}
        <div style={{ marginTop: 48, textAlign: 'center' }}>
          <Link href="/event"
            style={{
              display: 'inline-block', padding: '12px 32px',
              border: '1.5px solid var(--color-accent)', borderRadius: 8,
              color: 'var(--color-accent)', fontWeight: 700, fontSize: 14,
              textDecoration: 'none',
            }}
          >
            ← 이벤트 목록
          </Link>
        </div>
      </div>
    </main>
  );
}
