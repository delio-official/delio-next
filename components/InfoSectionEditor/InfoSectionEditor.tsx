'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { CS_PHONE, CS_HOURS_LINE } from '@/lib/company';

interface Props {
  productId: string;              // '' = 신규 상품(버퍼) 모드 — DB 대신 부모 메모리에 보관
  productName: string;
  onClose: () => void;
  draftInfo?: InfoContent | null; // 버퍼 모드 초기값
  onCommitDraft?: (data: InfoContent) => void; // 버퍼 모드 저장 콜백
}

interface TableRow { k1: string; v1: string; k2: string; v2: string; }

export interface InfoContent {
  tableRows: TableRow[];
  shipping: string[];
  return_: string[];
  cs: string[];
}

export function makeDefault(productName: string): InfoContent {
  return {
    tableRows: [
      { k1: '제품명', v1: productName, k2: '식품의 유형', v2: '과일' },
      { k1: '생산자 및 소재지 (수입품의 경우 생산지, 수입자 및 제조국)', v1: '상품설명 및 이미지 참조', k2: '제조연월일, 소비기한 또는 품질유지기한', v2: '상품설명 및 이미지 참조' },
      { k1: '포장단위별 내용물의 용량(중량), 수량', v1: '상품설명 및 이미지 참조', k2: '원재료명 및 함량 (원산지 표시 포함)', v2: '상품설명 및 이미지 참조' },
      { k1: '영양성분 (영양성분 표시대상 식품에 한함)', v1: '상품설명 및 이미지 참조', k2: '유전자변형식품에 해당하는 경우의 표시', v2: '상품설명 및 이미지 참조' },
      { k1: '소비자 안전을 위한 주의사항', v1: '상품설명 및 이미지 참조', k2: '소비자 상담 관련 전화번호', v2: CS_PHONE },
    ],
    shipping: [
      '기상 악화 및 교통 상황에 따라 부득이하게 배송이 지연될 수 있습니다.',
      '당사는 CJ 대한통운을 이용하고 있으며, 상황에 따라 타 택배사를 통해 배송될 수 있습니다.',
      '신선 식품 특성 상 제주 및 도서 산간 지역은 배송이 불가합니다.',
      '주소 오기재 등으로 인한 반송·미배송 시에도 일정 기간 소요 시 자동 배송완료 처리됩니다.',
      '주말 및 공휴일은 상품을 출고하지 않습니다.',
      '단체 및 다량 주문 시 고객센터로 별도 문의 후 주문 바랍니다.',
    ],
    return_: [
      '신선 식품 특성 상 단순 변심 / 주문 착오 / 개인 정보 오기재 / 수취인 연락 부재의 경우 교환 및 반품이 불가합니다.',
      '품질 및 배송 관련 문제가 있는 경우 수령 후 1~2일 이내, 이미지를 첨부하여 고객센터로 문의바랍니다.',
      '교환 및 반품 희망 시 상담원에게 먼저 문의해 주세요.',
    ],
    cs: [
      `고객센터 전화: ${CS_PHONE}`,
      CS_HOURS_LINE,
      '상품 관련 문의는 수령 후 1~2일 이내에 접수해 주세요.',
      '이미지 첨부 시 보다 빠른 처리가 가능합니다.',
    ],
  };
}

/* 구형식 → 신형식 변환 */
function normalize(raw: any, productName: string): InfoContent {
  const def = makeDefault(productName);

  // 새 형식
  if (Array.isArray(raw.tableRows)) {
    return {
      tableRows: raw.tableRows,
      shipping: raw.shipping ?? def.shipping,
      return_:  raw.return_  ?? def.return_,
      cs:       raw.cs       ?? def.cs,
    };
  }

  // 구 형식 (tableValues + tableExtra)
  const FIXED_LABELS = [
    ['제품명', '식품의 유형'],
    ['생산자 및 소재지 (수입품의 경우 생산지, 수입자 및 제조국)', '제조연월일, 소비기한 또는 품질유지기한'],
    ['포장단위별 내용물의 용량(중량), 수량', '원재료명 및 함량 (원산지 표시 포함)'],
    ['영양성분 (영양성분 표시대상 식품에 한함)', '유전자변형식품에 해당하는 경우의 표시'],
    ['소비자 안전을 위한 주의사항', '소비자 상담 관련 전화번호'],
  ];
  const vals: string[][] = raw.tableValues ?? raw.table ?? [];
  const fixed: TableRow[] = FIXED_LABELS.map(([k1, k2], i) => ({
    k1, v1: vals[i]?.[0] ?? '', k2, v2: vals[i]?.[1] ?? '',
  }));
  const extra: TableRow[] = (raw.tableExtra ?? []).map((r: any) => ({
    k1: r.k1 ?? '', v1: r.v1 ?? '', k2: r.k2 ?? '', v2: r.v2 ?? '',
  }));

  return {
    tableRows: [...fixed, ...extra],
    shipping: raw.shipping ?? def.shipping,
    return_:  raw.return_  ?? def.return_,
    cs:       raw.cs       ?? def.cs,
  };
}

export default function InfoSectionEditor({ productId, productName, onClose, draftInfo, onCommitDraft }: Props) {
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [data,      setData]      = useState<InfoContent>(makeDefault(productName));

  useEffect(() => {
    // 신규 상품(버퍼 모드): DB 조회 없이 부모가 들고 있던 버퍼로 시작
    if (!productId) {
      setData(draftInfo || makeDefault(productName));
      setLoading(false);
      return;
    }
    async function load() {
      const supabase = createClient();
      const { data: sec } = await supabase
        .from('product_detail_sections')
        .select('*')
        .eq('product_id', productId)
        .eq('section_type', 'info_content')
        .maybeSingle();

      if (sec) {
        setSectionId((sec as any).id);
        try { setData(normalize(JSON.parse((sec as any).content), productName)); }
        catch { /* 파싱 실패 시 기본값 유지 */ }
      }
      setLoading(false);
    }
    load();
  }, [productId, productName]);

  async function handleSave() {
    // 버퍼 모드: DB에 쓰지 않고 부모 메모리에만 반영 후 닫기 (상품 등록 시 함께 저장)
    if (!productId) { onCommitDraft?.(data); onClose(); return; }
    setSaving(true);
    const supabase = createClient();
    const content = JSON.stringify(data);

    if (sectionId) {
      const { error } = await supabase
        .from('product_detail_sections')
        .update({ content })
        .eq('id', sectionId);
      if (error) { setSaving(false); alert(`저장 실패: ${error.message}`); return; }
    } else {
      const { data: ins, error } = await supabase
        .from('product_detail_sections')
        .insert({ product_id: productId, section_type: 'info_content', content, sort_order: 99 })
        .select('id').single();
      if (error) { setSaving(false); alert(`저장 실패: ${error.message}`); return; }
      if (ins) setSectionId((ins as any).id);
    }

    setSaving(false);
    alert('저장됐습니다. 상품 상세페이지에서 확인해보세요.');
  }

  /* ── 표 행 조작 ── */
  function setRow(i: number, key: keyof TableRow, val: string) {
    setData(d => ({ ...d, tableRows: d.tableRows.map((r, j) => j === i ? { ...r, [key]: val } : r) }));
  }
  function addRow() {
    setData(d => ({ ...d, tableRows: [...d.tableRows, { k1: '', v1: '', k2: '', v2: '' }] }));
  }
  function removeRow(i: number) {
    setData(d => ({ ...d, tableRows: d.tableRows.filter((_, j) => j !== i) }));
  }

  /* ── 리스트 조작 ── */
  function setItem(sec: 'shipping' | 'return_' | 'cs', i: number, val: string) {
    setData(d => ({ ...d, [sec]: d[sec].map((v, j) => j === i ? val : v) }));
  }
  function addItem(sec: 'shipping' | 'return_' | 'cs') {
    setData(d => ({ ...d, [sec]: [...d[sec], ''] }));
  }
  function removeItem(sec: 'shipping' | 'return_' | 'cs', i: number) {
    setData(d => ({ ...d, [sec]: d[sec].filter((_, j) => j !== i) }));
  }

  /* ── 공통 스타일 ── */
  const inp = (extra?: React.CSSProperties): React.CSSProperties => ({
    width: '100%', fontSize: 13, border: '1px solid #E0DFDB',
    borderRadius: 4, padding: '5px 8px', outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: 1.7,
    color: '#333', ...extra,
  });
  const td = (extra?: React.CSSProperties): React.CSSProperties => ({
    padding: '6px 8px', border: '1px solid #E4E2DE', verticalAlign: 'middle',
    ...extra,
  });

  function renderSection(title: string, sec: 'shipping' | 'return_' | 'cs') {
    return (
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 14, fontWeight: 700, paddingBottom: 12,
          borderBottom: '1.5px solid #1A1A1A', marginBottom: 16 }}>{title}</div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data[sec].map((txt, i) => (
            <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ flexShrink: 0, color: '#AAAAAA', fontSize: 16 }}>•</span>
              <input
                value={txt}
                onChange={e => setItem(sec, i, e.target.value)}
                style={inp({ flex: 1 })}
              />
              <button onClick={() => removeItem(sec, i)}
                style={{ flexShrink: 0, background: 'none', border: 'none',
                  cursor: 'pointer', color: '#CCC', fontSize: 20, padding: '0 4px', lineHeight: 1 }}>
                ×
              </button>
            </li>
          ))}
        </ul>
        <button onClick={() => addItem(sec)}
          style={{ marginTop: 10, padding: '5px 14px', border: '1px dashed #C0C0C0',
            borderRadius: 6, background: 'transparent', cursor: 'pointer',
            fontSize: 12, color: '#888', fontWeight: 600 }}>
          + 항목 추가
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 980,
        maxHeight: '95vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.28)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid #EBEBEB', flexShrink: 0 }}>
          <div>
            <span style={{ fontSize: 15, fontWeight: 700 }}>상세정보 편집</span>
            <span style={{ fontSize: 12, color: '#999', marginLeft: 10 }}>{productName}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSave} disabled={saving || loading}
              style={{ padding: '8px 22px', background: '#1A1A1A', color: '#fff',
                border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
                cursor: (saving || loading) ? 'not-allowed' : 'pointer',
                opacity: (saving || loading) ? 0.5 : 1 }}>
              {saving ? '저장 중...' : '저장'}
            </button>
            <button onClick={onClose}
              style={{ padding: '8px 16px', background: '#F0F0F0', color: '#555',
                border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              닫기
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div className="hide-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: 300, color: '#999', fontSize: 14 }}>불러오는 중...</div>
          ) : (
            <>
              {/* 상품고시정보 */}
              <div style={{ marginBottom: 40 }}>
                <div style={{ fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 24 }}>
                  상품고시정보
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13,
                  tableLayout: 'fixed', border: '1px solid #E4E2DE' }}>
                  <colgroup>
                    <col style={{ width: '22%' }} />
                    <col style={{ width: '26%' }} />
                    <col style={{ width: '22%' }} />
                    <col style={{ width: '26%' }} />
                    <col style={{ width: '36px' }} />
                  </colgroup>
                  <tbody>
                    {data.tableRows.map((row, i) => (
                      <tr key={i}>
                        <td style={td({ background: '#F8F8F6' })}>
                          <input value={row.k1} onChange={e => setRow(i, 'k1', e.target.value)}
                            placeholder="항목명" style={inp({ fontWeight: 600, background: 'transparent' })} />
                        </td>
                        <td style={td()}>
                          <input value={row.v1} onChange={e => setRow(i, 'v1', e.target.value)}
                            placeholder="내용" style={inp()} />
                        </td>
                        <td style={td({ background: '#F8F8F6' })}>
                          <input value={row.k2} onChange={e => setRow(i, 'k2', e.target.value)}
                            placeholder="항목명" style={inp({ fontWeight: 600, background: 'transparent' })} />
                        </td>
                        <td style={td()}>
                          <input value={row.v2} onChange={e => setRow(i, 'v2', e.target.value)}
                            placeholder="내용" style={inp()} />
                        </td>
                        <td style={td({ padding: '0 6px', textAlign: 'center', border: '1px solid #E4E2DE' })}>
                          <button onClick={() => removeRow(i)}
                            title="행 삭제"
                            style={{ background: 'none', border: 'none', cursor: 'pointer',
                              color: '#CCC', fontSize: 20, lineHeight: 1, padding: 0 }}>
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button onClick={addRow}
                  style={{ marginTop: 8, padding: '5px 14px', border: '1px dashed #C0C0C0',
                    borderRadius: 6, background: 'transparent', cursor: 'pointer',
                    fontSize: 12, color: '#888', fontWeight: 600 }}>
                  + 행 추가
                </button>
              </div>

              {renderSection('배송안내', 'shipping')}
              {renderSection('교환 및 반품정보', 'return_')}
              {renderSection('고객센터', 'cs')}
            </>
          )}
        </div>

        <div style={{ padding: '8px 20px', borderTop: '1px solid #EBEBEB',
          fontSize: 11, color: '#BBB', flexShrink: 0, background: '#FAFAFA' }}>
          💡 모든 행·항목을 자유롭게 수정·추가·삭제할 수 있습니다
        </div>
      </div>
    </div>
  );
}
