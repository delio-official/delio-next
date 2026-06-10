'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import '@/styles/review.css';

/* 작성일 표시: ISO datetime → "2026.05.30 14:30", 그 외(레거시)는 그대로 */
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
  image_url: string | null;
  content: string | null;
}

export default function LoungeDetailClient() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [post, setPost] = useState<LoungePost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from('lounge_posts')
        .select('*')
        .eq('id', Number(id))
        .single();
      if (!data) {
        router.push('/lounge');
        return;
      }
      setPost(data as LoungePost);
      try { supabase.rpc('bump_lounge_view', { p_id: Number(id) }); } catch { /* noop */ }
      setLoading(false);
    }
    load();
  }, [id, router]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0', color: '#bbb' }}>불러오는 중...</div>
    );
  }

  if (!post) return null;

  return (
    <main style={{ background: '#fff', minHeight: '60vh', paddingBottom: 80 }}>
      <div className="container" style={{ maxWidth: 780, paddingTop: 32 }}>

        {/* 브레드크럼 */}
        <div style={{ fontSize: 12, color: '#aaa', marginBottom: 24 }}>
          <Link href="/" style={{ color: '#aaa', textDecoration: 'none' }}>홈</Link>
          <span style={{ margin: '0 6px' }}>/</span>
          <Link href="/lounge" style={{ color: '#aaa', textDecoration: 'none' }}>라운지</Link>
          <span style={{ margin: '0 6px' }}>/</span>
          <span style={{ color: '#555' }}>{post.title}</span>
        </div>

        {/* 배지 */}
        <span style={{
          display: 'inline-block', marginBottom: 12,
          background: 'var(--color-accent-bg)', color: 'var(--color-accent)',
          fontSize: 11, fontWeight: 700, borderRadius: 4, padding: '2px 8px',
        }}>
          {post.badge}
        </span>

        {/* 제목 */}
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 12, lineHeight: 1.4 }}>
          {post.title}
        </h1>
        <div style={{ fontSize: 13, color: '#aaa', marginBottom: 32 }}>{fmtLoungeDate(post.date)}</div>

        {/* 헤더 배너 — 이미지 없으면 이모지 */}
        {!post.thumbnail_url && (
          <div style={{
            width: '100%', height: 220, borderRadius: 12, marginBottom: 32,
            background: post.bg ?? '#F4EFE6',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 80,
          }}>
            {post.emoji || '🍑'}
          </div>
        )}

        {/* 본문 이미지 (image_url) */}
        {post.image_url && (
          <img src={post.image_url} alt=""
            style={{ width: '100%', maxWidth: 960, display: 'block', margin: '0 auto 32px', borderRadius: 8 }} />
        )}

        {/* 본문 내용 */}
        {post.content && (
          <div
            style={{ fontSize: 15, lineHeight: 1.9, color: '#333' }}
            dangerouslySetInnerHTML={{ __html: post.content ?? '' }}
          />
        )}

        {/* 목록으로 */}
        <div style={{ marginTop: 48, textAlign: 'center' }}>
          <Link href="/lounge"
            style={{
              display: 'inline-block', padding: '12px 32px',
              border: '1.5px solid #1A1A1A', borderRadius: 8,
              color: '#1A1A1A', fontWeight: 700, fontSize: 14,
              textDecoration: 'none',
            }}
          >
            ← 라운지 목록
          </Link>
        </div>

      </div>
    </main>
  );
}
