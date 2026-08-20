'use client';
import { useState } from 'react';
import { parseBadges, serializeBadges, type BadgeItem } from '@/lib/badges';

const DEFAULT_PRESETS = ['#CB1D11', '#E8830C', '#1F9D55', '#2563EB', '#7C3AED', '#1A1A1A'];

/** 뱃지 태그 입력 — 브랜드 취급품목처럼 Enter로 하나씩 추가, 각 뱃지마다 색상 개별 지정.
 *  value/onChange 는 저장용 문자열(신규는 JSON, 레거시 쉼표도 읽음). */
export default function BadgeTagsInput({
  value, onChange, presets = DEFAULT_PRESETS, placeholder = '직접 추가 후 Enter', fallbackColor,
}: {
  value?: string | null;
  onChange: (v: string) => void;
  presets?: string[];
  placeholder?: string;
  fallbackColor?: string | null;   // 레거시(단일색) 뱃지의 원래 색상 보존용
}) {
  const items = parseBadges(value, fallbackColor);
  const [draft, setDraft] = useState('');
  const [color, setColor] = useState(presets[0] || '#1A1A1A');
  const [sel, setSel] = useState<number | null>(null);

  const commit = (next: BadgeItem[]) => onChange(serializeBadges(next));

  const add = () => {
    const t = draft.trim();
    if (!t) return;
    commit([...items, { t, c: color }]);
    setDraft('');
  };
  const remove = (i: number) => { commit(items.filter((_, idx) => idx !== i)); if (sel === i) setSel(null); };
  const pickColor = (c: string) => {
    if (sel != null && items[sel]) { commit(items.map((b, idx) => (idx === sel ? { ...b, c } : b))); setColor(c); }
    else setColor(c);
  };

  return (
    <div>
      <input className="adm-input-text" style={{ width: '100%' }} value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }}
        placeholder={placeholder} />

      {/* 색상 선택 (다음 추가할 뱃지 / 선택한 뱃지) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        {presets.map(c => (
          <button key={c} type="button" onClick={() => pickColor(c)} aria-label={c}
            style={{ width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer', padding: 0,
              border: color === c ? '2px solid #1A1A1A' : '2px solid #fff', boxShadow: '0 0 0 1px #E5E7EB' }} />
        ))}
        <input type="color" value={/^#[0-9A-Fa-f]{6}$/.test(color) ? color : '#1A1A1A'} onChange={e => pickColor(e.target.value)}
          style={{ width: 26, height: 26, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} title="직접 색상" />
        <input className="adm-input-text" style={{ width: 92 }} value={color} onChange={e => pickColor(e.target.value)} />
      </div>

      {/* 추가된 뱃지 칩 (클릭=선택해서 색변경 · × 삭제) */}
      {items.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {items.map((b, i) => (
            <span key={i} onClick={() => { setSel(i); setColor(b.c); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: b.c, color: '#fff',
                fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
                outline: sel === i ? '2px solid #1A1A1A' : 'none', outlineOffset: 1 }}>
              {b.t}
              <button type="button" onClick={e => { e.stopPropagation(); remove(i); }}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
