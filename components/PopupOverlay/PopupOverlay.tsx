'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';

interface Popup {
  id: string;
  title: string | null;
  image_url: string | null;
  link_url: string;
  width: number;
  position: string;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

function getTodayKey(id: string) {
  const today = new Date().toISOString().slice(0, 10);
  return `popup_hide_${id}_${today}`;
}
function isHiddenToday(id: string) {
  try { return localStorage.getItem(getTodayKey(id)) === '1'; } catch { return false; }
}
function hideToday(id: string) {
  try { localStorage.setItem(getTodayKey(id), '1'); } catch { /* ignore */ }
}

export default function PopupOverlay() {
  const [queue, setQueue] = useState<Popup[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const now = new Date().toISOString();
      const { data } = await supabase
        .from('popups')
        .select('id,title,image_url,link_url,width,position,is_active,starts_at,ends_at')
        .eq('is_active', true)
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .or(`ends_at.is.null,ends_at.gte.${now}`)
        .order('created_at', { ascending: false });

      const visible = ((data || []) as Popup[]).filter(p => !isHiddenToday(p.id));
      setQueue(visible);
    }
    load();
  }, []);

  const current = queue[0];
  if (!current) return null;

  function close() {
    setQueue(prev => prev.slice(1));
  }
  function handleHideToday() {
    hideToday(current.id);
    close();
  }

  const imgEl = current.image_url ? (
    <img
      src={current.image_url}
      alt={current.title || '팝업'}
      style={{ width: '100%', display: 'block', objectFit: 'cover' }}
    />
  ) : null;

  return (
    <div
      style={{
        position: 'fixed',
        /* 헤더(유틸리티+메인+네비) 높이 아래서 시작 */
        top: 162,
        left: 60,
        zIndex: 9000,
        width: current.width,
        maxWidth: 'calc(100vw - 40px)',
        background: '#fff',
        borderRadius: 8,   /* 상단은 viewport에 붙어있으므로 하단만 radius */
        boxShadow: '4px 4px 20px rgba(0,0,0,0.16)',
        overflow: 'hidden',
      }}
    >
      {/* 이미지 */}
      {imgEl && (
        current.link_url && current.link_url !== '/'
          ? <Link href={current.link_url} onClick={close} style={{ display: 'block' }}>{imgEl}</Link>
          : imgEl
      )}


      {/* 푸터 버튼 2개 */}
      <div style={{ display: 'flex', borderTop: '1px solid #E2E8F0' }}>
        <button
          onClick={handleHideToday}
          style={{
            flex: 1, padding: '12px 0',
            background: '#fff', border: 'none',
            borderRight: '1px solid #E2E8F0',
            fontSize: 12, color: '#64748B', cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          오늘 하루 보지 않기
        </button>
        <button
          onClick={close}
          style={{
            flex: 1, padding: '12px 0',
            background: '#fff', border: 'none',
            fontSize: 12, color: '#1A1A1A', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          닫기
        </button>
      </div>
    </div>
  );
}
