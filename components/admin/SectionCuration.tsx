'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import { HOME_SECTIONS, MODE_LABEL, parseSectionConfig, parseBucketMap, type SectionMode } from '@/lib/homeSections';

export interface CurationItem { id: string; label: string; sub?: string; bucket?: string; }

/** 메인페이지 섹션 노출 설정 카드 (어드민 각 관리 탭에 삽입)
   - 노출 방식: 최신/인기/조회/직접 (섹션별 가능 목록)
   - 노출 개수
   - 직접 선택 시: 후보에서 골라 순서 지정 → site_settings 저장
   - buckets 전달 시(퀵가이드): 카테고리별로 직접선택, ids 는 JSON 맵으로 저장 */
export default function SectionCuration({ sec, items, buckets }: {
  sec: string; items: CurationItem[]; buckets?: { value: string; label: string }[];
}) {
  const meta = HOME_SECTIONS[sec];
  const hasBuckets = !!(buckets && buckets.length > 0);
  const [mode, setMode] = useState<SectionMode>(meta?.modes[0] ?? 'latest');
  const [count, setCount] = useState(meta?.defaultCount ?? 6);
  const [ids, setIds] = useState<string[]>([]);                       // 평면 (일반 섹션)
  const [idsMap, setIdsMap] = useState<Record<string, string[]>>({}); // 카테고리별 (퀵가이드)
  const [bucket, setBucket] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false); // 접기/펼치기 (기본 접힘)
  const dragIdx = useRef<number | null>(null); // 선택된 항목 드래그 순서변경

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const keys = [`${sec}_mode`, `${sec}_ids`, meta.countKey];
      const { data } = await supabase.from('site_settings').select('key,value').in('key', keys);
      const map: Record<string, string> = {};
      ((data as { key: string; value: string }[]) || []).forEach(r => { map[r.key] = r.value; });
      const cfg = parseSectionConfig(map, sec);
      setMode(cfg.mode); setCount(cfg.count);
      if (hasBuckets) setIdsMap(parseBucketMap(map[`${sec}_ids`] || ''));
      else setIds(cfg.ids);
      setLoaded(true);
    })();
  }, [sec]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (hasBuckets && !bucket && buckets) setBucket(buckets[0].value); }, [hasBuckets, buckets, bucket]);

  /* 현재 편집 중인 id 목록 (버킷이면 해당 카테고리, 아니면 평면) */
  const curIds = hasBuckets ? (idsMap[bucket] || []) : ids;
  const setCurIds = (fn: (prev: string[]) => string[]) => {
    if (hasBuckets) setIdsMap(prev => ({ ...prev, [bucket]: fn(prev[bucket] || []) }));
    else setIds(fn);
  };

  async function save() {
    setSaving(true);
    const supabase = createClient();
    const idsValue = hasBuckets ? JSON.stringify(idsMap) : ids.join(',');
    const rows = [
      { key: `${sec}_mode`, value: mode },
      { key: `${sec}_ids`, value: idsValue },
      { key: meta.countKey, value: String(count) },
    ];
    await supabase.from('site_settings').upsert(rows, { onConflict: 'key' });
    setSaving(false); setMsg('저장됐어요 ✓'); setTimeout(() => setMsg(''), 2500);
  }

  /* 버킷이면 후보를 현재 카테고리 상품으로 제한 */
  const candItems = hasBuckets ? items.filter(i => i.bucket === bucket) : items;
  const selected = curIds.map(id => candItems.find(i => i.id === id) || items.find(i => i.id === id)).filter((v): v is CurationItem => !!v);
  /* 이미 추가된 항목도 목록에 남겨 '추가됨' 흐릿 표시 (숨기지 않음) */
  const filtered = candItems.filter(i =>
    (q === '' || i.label.toLowerCase().includes(q.toLowerCase()) || (i.sub || '').toLowerCase().includes(q.toLowerCase())))
    .slice(0, 30);

  if (!loaded) return null;

  const box: React.CSSProperties = { border: '1px solid #E5E3DE', borderRadius: 8, background: '#fff' };

  return (
    <div className="adm-card" style={{ padding: '16px 18px', marginBottom: 16, border: '1px solid #EEF2F6', background: '#fff' }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: open ? 12 : 0, cursor: 'pointer', userSelect: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 12, color: '#94A3B8', display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>▶</span>
          <span style={{ fontWeight: 800, fontSize: 14, color: '#1A1A1A' }}>{meta?.label} <span style={{ fontWeight: 400, fontSize: 12, color: '#94A3B8' }}>· 메인 노출 설정</span></span>
          {!open && <span style={{ fontSize: 12, color: '#94A3B8' }}>· {MODE_LABEL[mode]} {count}개</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
          {msg && <span style={{ fontSize: 12, color: '#16A34A', fontWeight: 700 }}>{msg}</span>}
          {open && <button onClick={save} disabled={saving}
            style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: '#2563EB', border: 'none', borderRadius: 7, padding: '8px 16px', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? '저장 중…' : '저장'}
          </button>}
        </div>
      </div>

      {open && (<>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: mode === 'manual' ? 14 : 0 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#475569', fontWeight: 600 }}>
          노출 방식
          <select value={mode} onChange={e => setMode(e.target.value as SectionMode)}
            style={{ padding: '8px 10px', borderRadius: 7, border: '1px solid #CBD5E1', fontSize: 13, minWidth: 140, background: '#fff' }}>
            {meta?.modes.map(m => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#475569', fontWeight: 600 }}>
          노출 개수
          <input type="number" min={0} max={50} value={count}
            onChange={e => setCount(Math.max(0, parseInt(e.target.value) || 0))}
            style={{ padding: '8px 10px', borderRadius: 7, border: '1px solid #CBD5E1', fontSize: 13, width: 90, background: '#fff' }} />
        </label>
        <div style={{ fontSize: 11.5, color: count === 0 ? '#DC2626' : '#94A3B8', flex: '1 1 160px', lineHeight: 1.5 }}>
          {count === 0 ? "0개 → 메인에서 '준비중'으로 표시됩니다. (완전히 숨기려면 위쪽 ‘메인 섹션 노출’ 토글 OFF)"
            : mode === 'latest' ? '최근 등록순으로 자동 노출됩니다.'
            : mode === 'popular' ? '인기순(리뷰·좋아요·찜)으로 자동 노출됩니다.'
            : mode === 'views' ? '조회수 높은 순으로 자동 노출됩니다.'
            : hasBuckets ? '카테고리 탭마다 직접 고른 상품이 그 순서대로 노출됩니다. (플래그 탭은 자동 정렬)'
            : '아래에서 직접 고른 항목이 고른 순서대로 노출됩니다.'}
        </div>
      </div>

      {mode === 'manual' && hasBuckets && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: '#475569', fontWeight: 700 }}>카테고리</span>
          <select value={bucket} onChange={e => { setBucket(e.target.value); setQ(''); }}
            style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid #CBD5E1', fontSize: 13, background: '#fff' }}>
            {buckets!.map(b => <option key={b.value} value={b.value}>{b.label}{(idsMap[b.value]?.length ? ` (${idsMap[b.value].length})` : '')}</option>)}
          </select>
        </div>
      )}

      {mode === 'manual' && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* 선택됨 (드래그로 순서변경 · 삭제만) */}
          <div style={{ flex: '1 1 280px', minWidth: 0 }}>
            <div style={{ height: 36, display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>선택된 항목 ({selected.length}) <span style={{ fontWeight: 400, color: '#94A3B8', marginLeft: 6 }}>· 드래그로 순서변경</span></div>
            <div style={{ ...box, padding: 8, height: 260, overflowY: 'auto' }}>
              {selected.length === 0
                ? <div style={{ fontSize: 12, color: '#94A3B8', padding: '16px 0', textAlign: 'center' }}>오른쪽에서 항목을 추가하세요</div>
                : selected.map((it, idx) => (
                  <div key={it.id} draggable
                    onDragStart={() => { dragIdx.current = idx; }}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => { const from = dragIdx.current; dragIdx.current = null; if (from == null || from === idx) return; setCurIds(p => { const a = [...p]; const [m] = a.splice(from, 1); a.splice(idx, 0, m); return a; }); }}
                    onDragEnd={() => { dragIdx.current = null; }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderBottom: idx < selected.length - 1 ? '1px solid #F1F5F9' : 'none', cursor: 'grab' }}>
                    <span style={{ color: '#B8B8B8', fontSize: 14, letterSpacing: '-2px', flexShrink: 0, userSelect: 'none' }}>⠿⠿</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#1A1A1A', width: 18 }}>{idx + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</div>
                      {it.sub && <div style={{ fontSize: 11, color: '#94A3B8' }}>{it.sub}</div>}
                    </div>
                    <button onClick={() => setCurIds(p => p.filter(x => x !== it.id))} style={{ ...btnMini, color: '#DC2626', borderColor: '#FECACA' }}>×</button>
                  </div>
                ))}
            </div>
          </div>
          {/* 후보 검색/추가 (버튼) */}
          <div style={{ flex: '1 1 280px', minWidth: 0 }}>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="검색해서 추가…"
              style={{ width: '100%', height: 36, padding: '0 10px', borderRadius: 7, border: '1px solid #CBD5E1', fontSize: 13, marginBottom: 8, background: '#fff' }} />
            <div style={{ ...box, padding: 8, height: 260, overflowY: 'auto' }}>
              {filtered.length === 0
                ? <div style={{ fontSize: 12, color: '#94A3B8', padding: '16px 0', textAlign: 'center' }}>{items.length === 0 ? '항목을 불러오는 중…' : '검색 결과 없음'}</div>
                : filtered.map(it => {
                  const added = curIds.includes(it.id);
                  return (
                    <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, opacity: added ? 0.45 : 1 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</div>
                        {it.sub && <div style={{ fontSize: 11, color: '#94A3B8' }}>{it.sub}</div>}
                      </div>
                      {added
                        ? <span style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', flexShrink: 0 }}>추가됨</span>
                        : <button onClick={() => setCurIds(p => [...p, it.id])}
                            style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: '#fff', background: '#2563EB', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer' }}>추가</button>}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
      </>)}
    </div>
  );
}

const btnMini: React.CSSProperties = {
  width: 24, height: 24, fontSize: 11, border: '1px solid #CBD5E1', background: '#fff',
  borderRadius: 5, cursor: 'pointer', color: '#475569', flexShrink: 0,
};
