'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { addToCart, getCart, showCartToast } from '@/lib/cart';
import { useLoginGuard } from '@/hooks/useLoginGuard';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

interface Product {
  id: string; name: string; price: number; discounted_price: number | null;
  thumbnail_url: string | null; is_dawn: boolean;
}
interface Option {
  id: string; label: string; add_price: number; stock: number; manage_stock?: boolean | null; is_default: boolean; group_name: string | null; is_required: boolean | null; parent_label?: string | null;
}

const EMOJI = '🍑';

export default function OptionDrawer() {
  const router = useRouter();
  const requireLogin = useLoginGuard();
  const [open, setOpen]       = useState(false);
  const [closing, setClosing] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [selByGroup, setSelByGroup] = useState<Record<string, string>>({});
  const [picks, setPicks]     = useState<{ key: string; opts: Option[]; qty: number }[]>([]);
  const [qty, setQty]         = useState(1);
  const [loading, setLoading] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  // 열린 드롭다운 버튼의 화면상 위치 — 목록을 fixed 레이어로 띄워 드로어 밖으로 안 잘리게
  const [ddRect, setDdRect] = useState<{ left: number; top: number; bottom: number; width: number } | null>(null);
  useEffect(() => {
    if (!openGroup) { setDdRect(null); return; }
    const btn = document.querySelector(`[data-ddgroup="${CSS.escape(openGroup)}"]`);
    if (btn) { const r = btn.getBoundingClientRect(); setDdRect({ left: r.left, top: r.top, bottom: r.bottom, width: r.width }); }
  }, [openGroup]);

  useEffect(() => {
    async function handler(e: Event) {
      const { productId } = (e as CustomEvent).detail;
      setOpen(true);
      setClosing(false);
      setLoading(true);
      setSelByGroup({});
      setPicks([]);
      setQty(1);
      setOpenGroup(null);
      const supabase = createClient();
      const [{ data: prod }, { data: opts }] = await Promise.all([
        supabase.from('products').select('id,name,price,discounted_price,thumbnail_url,is_dawn').eq('id', productId).single(),
        supabase.from('product_options').select('id,label,add_price,stock,manage_stock,is_default,group_name,is_required,parent_label').eq('product_id', productId).order('sort_order'),
      ]);
      setProduct(prod as Product);
      setOptions((opts as Option[]) || []);
      setLoading(false);
    }
    window.addEventListener('openOptionDrawer', handler);
    return () => window.removeEventListener('openOptionDrawer', handler);
  }, []);

  /* 드로어 열려있는 동안 뒷 배경 스크롤 잠금 */
  useBodyScrollLock(open);

  function close() {
    setClosing(true);
    setTimeout(() => { setOpen(false); setClosing(false); }, 280);
  }

  if (!open) return null;

  const groupNames = [...new Set(options.map(o => o.group_name || '옵션'))];
  const requiredGroups = groupNames.filter(g => options.find(o => (o.group_name || '옵션') === g)?.is_required !== false);
  /* 2단(종속) 옵션: 첫 그룹=상위, 이후 하위는 parent_label로 필터 */
  const parentGroup = groupNames[0];
  const isCascade = options.some(o => !!(o.parent_label && o.parent_label.trim()));
  const hasOptionalGroup = groupNames.some(g => options.find(o => (o.group_name || '옵션') === g)?.is_required === false);
  const selectedParentLabel = options.find(o => o.id === selByGroup[parentGroup])?.label || '';
  const optsForGroup = (g: string): Option[] => {
    const inGroup = options.filter(o => (o.group_name || '옵션') === g);
    if (!isCascade || g === parentGroup) return inGroup;
    return inGroup.filter(o => !o.parent_label || o.parent_label === selectedParentLabel);
  };
  const hasOpts = options.length > 0;

  function getSelectedOpts(map: Record<string, string> = selByGroup): Option[] {
    return groupNames.map(g => options.find(o => o.id === map[g])).filter(Boolean) as Option[];
  }
  function allGroupsSelected(map: Record<string, string> = selByGroup): boolean {
    if (options.length === 0) return true;
    if (!isCascade) return requiredGroups.every(g => !!map[g]);
    const parentLabel = options.find(o => o.id === map[parentGroup])?.label || '';
    return requiredGroups.every(g => {
      if (map[g]) return true;
      if (groupNames.indexOf(g) > 0) {
        const avail = options.filter(o => (o.group_name || '옵션') === g && (!o.parent_label || o.parent_label === parentLabel));
        if (avail.length === 0) return true;
      }
      return false;
    });
  }
  /* 옵션 조합을 누적 목록에 추가 (같은 조합이면 수량 +1) */
  function addPick(opts: Option[]) {
    const key = opts.map(o => o.id).join(',');
    setPicks(prev => {
      const i = prev.findIndex(p => p.key === key);
      if (i >= 0) { const next = [...prev]; next[i] = { ...next[i], qty: next[i].qty + 1 }; return next; }
      return [...prev, { key, opts, qty: 1 }];
    });
  }
  const commitPick = () => { addPick(getSelectedOpts()); setSelByGroup({}); setOpenGroup(null); };

  const basePrice = product ? (product.discounted_price ?? product.price) : 0;
  const picksTotal = picks.reduce((s, p) => s + (basePrice + p.opts.reduce((a, o) => a + (o.add_price || 0), 0)) * p.qty, 0);
  const picksQty = picks.reduce((s, p) => s + p.qty, 0);
  const totalPrice = hasOpts ? picksTotal : basePrice * qty;
  const totalQty = hasOpts ? picksQty : qty;
  const canAdd = hasOpts ? picks.length > 0 : true;

  function addAll(): boolean {
    if (!product) return false;
    const list = hasOpts ? picks : [{ opts: [] as Option[], qty }];
    // 재고 차감 대상(leaf) = 선택 옵션 중 다른 옵션의 부모(parent_label)가 아닌 최하위
    const childParentLabels = new Set(options.filter(o => o.parent_label).map(o => o.parent_label));
    // 재고 초과 담기 방지 — 장바구니 기존 수량 + 이번 수량이 재고 초과면 차단
    const cart = getCart();
    for (const p of list) {
      const leaf = p.opts.find(o => !childParentLabels.has(o.label)) ?? p.opts[p.opts.length - 1];
      if (!leaf) continue;
      const already = cart.filter(c => c.stockOptionId === leaf.id).reduce((s, c) => s + (c.quantity || 0), 0);
      if (already + p.qty > leaf.stock) {
        alert(leaf.stock > 0
          ? `현재 구매 가능한 수량은 ${leaf.stock}개까지입니다.${already > 0 ? `\n(이미 장바구니에 ${already}개 담겨 있습니다)` : ''}`
          : '죄송합니다. 품절된 상품입니다.');
        return false;
      }
    }
    list.forEach(p => {
      const addP = p.opts.reduce((s, o) => s + (o.add_price || 0), 0);
      const leafOpt = p.opts.find(o => !childParentLabels.has(o.label)) ?? p.opts[p.opts.length - 1];
      addToCart({
        id: product.id,
        name: product.name,
        price: basePrice + addP,
        originalPrice: product.price + addP,
        thumbnail: product.thumbnail_url || '',
        quantity: p.qty,
        optionId: p.opts.map(o => o.id).join(',') || undefined,
        stockOptionId: leafOpt?.id,
        options: p.opts.map(o => o.label).join(' / ') || undefined,
        deliveryType: product.is_dawn ? '산지직송' : '자사배송' as '산지직송' | '자사배송',
      });
    });
    return true;
  }

  function handleAddCart() {
    if (!requireLogin()) { close(); return; }
    if (!canAdd) { alert('옵션을 선택해 주세요.'); return; }
    if (!addAll()) return;   // 재고 초과 등 실패 시 드로어 유지
    showCartToast(); close();
  }
  function handleBuyNow() {
    if (!requireLogin()) { close(); return; }
    if (!canAdd) { alert('옵션을 선택해 주세요.'); return; }
    if (!addAll()) return;   // 재고 초과면 이동하지 않음
    close(); router.push('/cart');
  }

  return (
    <>
      {/* 배경 오버레이 */}
      <div onClick={close} style={{
        position: 'fixed', inset: 0, zIndex: 4000,
        background: 'rgba(0,0,0,0.4)',
        opacity: closing ? 0 : 1, transition: 'opacity .28s',
      }} />

      {/* 드로어 (PC: 우측 사이드 / 모바일: 하단 시트) */}
      <div className="option-drawer" data-closing={closing}>
        {/* 헤더 */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 20px', borderBottom:'1px solid #F0F0F0' }}>
          <span style={{ fontSize:16, fontWeight:800 }}>옵션 선택</span>
          <button onClick={close} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#888', lineHeight:1 }}>✕</button>
        </div>

        {loading ? (
          <div style={{ padding:'60px 0', textAlign:'center', color:'#aaa', fontSize:14 }}>불러오는 중...</div>
        ) : product ? (
          <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div className="hide-scrollbar" style={{ flex:1, overflowY:'auto', overscrollBehavior:'contain', WebkitOverflowScrolling:'touch', padding:'18px 20px' }}>
              {/* 상품 정보 */}
              <div style={{ display:'flex', gap:12, marginBottom:22 }}>
                <div style={{ width:56, height:56, borderRadius:8, background:'#F7F7F5', flexShrink:0, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26 }}>
                  {product.thumbnail_url ? <img src={product.thumbnail_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : EMOJI}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:600, lineHeight:1.45, color:'#1A1A1A' }}>{product.name}</div>
                  <div style={{ fontSize:14, fontWeight:800, marginTop:4 }}>{basePrice.toLocaleString()}원</div>
                </div>
              </div>

              {/* 옵션 선택 (그룹별) */}
              {groupNames.map((g, gIdx) => {
                const gReq = options.find(o => (o.group_name || '옵션') === g)?.is_required !== false;
                const locked = gIdx > 0 && !selectedParentLabel;
                return (
                <div key={g} style={{ marginBottom:14 }}>
                  <label style={{ fontSize:13, fontWeight:600, color:'#555', display:'block', marginBottom:8 }}>{g === '옵션' ? '선택' : g}{gReq ? '' : ' (선택)'}</label>
                  {(() => {
                    const groupOpts = optsForGroup(g);
                    const selOpt = groupOpts.find(o => o.id === selByGroup[g]);
                    const isOpen = openGroup === g;
                    const choose = (val: string) => {
                      const next = { ...selByGroup, [g]: val };
                      if (isCascade && g === parentGroup) groupNames.slice(1).forEach(sub => { delete next[sub]; });
                      if (!hasOptionalGroup) {
                        // 필수 그룹만 있는 상품: 필수 다 차면 자동 누적 + 선택 초기화
                        if (allGroupsSelected(next)) { addPick(getSelectedOpts(next)); setSelByGroup({}); }
                        else setSelByGroup(next);
                        setOpenGroup(null);
                        return;
                      }
                      // 선택옵션 있는 상품: 자동 담기 X, 필수 완료 시 미선택 드롭다운 자동 오픈
                      setSelByGroup(next);
                      const unselected = groupNames.find(gn => !next[gn]);
                      setOpenGroup(allGroupsSelected(next) && unselected ? unselected : null);
                    };
                    return (
                      <div className="opt-dd">
                        <button type="button" data-ddgroup={g} className={`opt-dd-btn${isOpen ? ' open' : ''}`} disabled={locked}
                          onClick={() => setOpenGroup(isOpen ? null : g)}>
                          <span className={selOpt ? '' : 'ph'}>
                            {locked ? '상위 옵션을 먼저 선택'
                              : selOpt ? `${selOpt.label}${selOpt.add_price > 0 ? ` (+${selOpt.add_price.toLocaleString()}원)` : ''}`
                              : `${gReq ? '[필수]' : '[선택]'} 옵션 선택`}
                          </span>
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                        {isOpen && !locked && (
                          <>
                            <div className="opt-dd-backdrop" onClick={() => setOpenGroup(null)} />
                            <div className="opt-dd-list" style={ddRect ? (() => {
                              const below = window.innerHeight - ddRect.bottom;
                              const openUp = below < 260 && ddRect.top > below;
                              return openUp
                                ? { position: 'fixed' as const, left: ddRect.left, width: ddRect.width, bottom: window.innerHeight - ddRect.top + 6, top: 'auto' as const, maxHeight: Math.max(160, ddRect.top - 24) }
                                : { position: 'fixed' as const, left: ddRect.left, width: ddRect.width, top: ddRect.bottom + 6, maxHeight: Math.max(160, below - 24) };
                            })() : undefined}>
                              {groupOpts.map(o => {
                                const soldout = o.manage_stock !== false && !(isCascade && g === parentGroup) && o.stock === 0;
                                return (
                                  <button type="button" key={o.id} disabled={soldout}
                                    className={`opt-dd-item${selByGroup[g] === o.id ? ' sel' : ''}`}
                                    style={soldout ? { opacity:0.45, cursor:'not-allowed' } : undefined}
                                    onClick={() => { if (!soldout) choose(o.id); }}>
                                    {o.label}{o.add_price > 0 ? ` (+${o.add_price.toLocaleString()}원)` : ''}{soldout ? ' (품절)' : ''}
                                  </button>
                                );
                              })}
                              {groupOpts.length === 0 && <div className="opt-dd-empty">선택 가능한 옵션이 없습니다</div>}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>
                );
              })}

              {/* 선택옵션 있는 상품: 필수 완료 시 '이 옵션 담기' 버튼 */}
              {hasOpts && hasOptionalGroup && allGroupsSelected() && (
                <button type="button" onClick={commitPick}
                  style={{ width:'100%', padding:'11px', marginBottom:10, borderRadius:8,
                    border:'1.5px solid #1A1A1A', background:'#1A1A1A', color:'#fff',
                    fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                  이 옵션 담기
                </button>
              )}

              {/* 누적 선택된 옵션 목록 */}
              {picks.length > 0 && (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {picks.map((p, idx) => {
                    const addP = p.opts.reduce((s, o) => s + (o.add_price || 0), 0);
                    const unit = basePrice + addP;
                    return (
                      <div key={p.key} style={{ background:'#F7F7F5', borderRadius:10, padding:'14px 16px' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                          <span style={{ fontSize:13, fontWeight:600, flex:1, lineHeight:1.45 }}>
                            {p.opts.map(o => o.label).join(' / ') || product.name}
                            {addP > 0 && <span style={{ fontSize:12, color:'#1A1A1A', marginLeft:6, fontWeight:700 }}>+{addP.toLocaleString()}원</span>}
                          </span>
                          <button onClick={() => setPicks(prev => prev.filter((_, i) => i !== idx))}
                            style={{ background:'none', border:'none', cursor:'pointer', fontSize:15, color:'#AAA', padding:'0 0 0 10px', lineHeight:1, flexShrink:0 }}>✕</button>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                          <div style={{ display:'flex', alignItems:'center', border:'1px solid #DADADA', borderRadius:8, background:'#fff' }}>
                            <button onClick={() => setPicks(prev => prev.map((x, i) => i === idx ? { ...x, qty: Math.max(1, x.qty - 1) } : x))}
                              style={{ width:32, height:32, border:'none', background:'none', fontSize:16, cursor:'pointer', color:'#555' }}>−</button>
                            <span style={{ width:32, textAlign:'center', fontSize:14, fontWeight:600 }}>{p.qty}</span>
                            <button onClick={() => {
                              const childParentLabels = new Set(options.filter(o => o.parent_label).map(o => o.parent_label));
                              const leaf = p.opts.find(o => !childParentLabels.has(o.label)) ?? p.opts[p.opts.length - 1];
                              if (leaf && p.qty >= leaf.stock) {
                                alert(`현재 구매 가능한 수량은 ${leaf.stock}개까지입니다.`);
                                return;
                              }
                              setPicks(prev => prev.map((x, i) => i === idx ? { ...x, qty: x.qty + 1 } : x));
                            }}
                              style={{ width:32, height:32, border:'none', background:'none', fontSize:16, cursor:'pointer', color:'#555' }}>+</button>
                          </div>
                          <span style={{ fontSize:15, fontWeight:800 }}>{(unit * p.qty).toLocaleString()}원</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 옵션 없는 상품: 수량 직접 조절 */}
              {!hasOpts && (
                <div style={{ background:'#F7F7F5', borderRadius:10, padding:'14px 16px' }}>
                  <div style={{ fontSize:13, fontWeight:600, marginBottom:10 }}>{product.name}</div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ display:'flex', alignItems:'center', border:'1px solid #DADADA', borderRadius:8, background:'#fff' }}>
                      <button onClick={() => setQty(q => Math.max(1, q - 1))}
                        style={{ width:32, height:32, border:'none', background:'none', fontSize:16, cursor:'pointer', color:'#555' }}>−</button>
                      <span style={{ width:32, textAlign:'center', fontSize:14, fontWeight:600 }}>{qty}</span>
                      <button onClick={() => setQty(q => q + 1)}
                        style={{ width:32, height:32, border:'none', background:'none', fontSize:16, cursor:'pointer', color:'#555' }}>+</button>
                    </div>
                    <span style={{ fontSize:15, fontWeight:800 }}>{(basePrice * qty).toLocaleString()}원</span>
                  </div>
                </div>
              )}
            </div>

            {/* 하단 합계 + 버튼 */}
            <div style={{ borderTop:'1px solid #F0F0F0', padding:'16px 20px' }}>
              <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:14 }}>
                <span style={{ fontSize:14, color:'#555' }}>TOTAL <span style={{ color:'#888', fontSize:12 }}>({totalQty}개)</span></span>
                <span style={{ fontSize:20, fontWeight:800, color:'#1A1A1A' }}>{totalPrice.toLocaleString()}원</span>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={handleAddCart}
                  style={{ flex:1, height:48, border:'1.5px solid #1A1A1A', background:'#fff', color:'#1A1A1A', borderRadius:8, fontSize:14, fontWeight:700, cursor:'pointer' }}>
                  장바구니 담기
                </button>
                <button onClick={handleBuyNow}
                  style={{ flex:1, height:48, border:'none', background:'#1A1A1A', color:'#fff', borderRadius:8, fontSize:14, fontWeight:700, cursor:'pointer' }}>
                  바로구매
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <style jsx>{`
        /* 커스텀 옵션 드롭다운 (상품 상세페이지와 통일) */
        .opt-dd { position: relative; }
        .opt-dd-btn {
          width: 100%; padding: 12px 14px 12px 16px;
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
          border-radius: 8px; border: 1.5px solid #DDDDD9; background: #fff;
          font-size: 14px; color: #1A1A1A; cursor: pointer; font-family: inherit; text-align: left;
        }
        .opt-dd-btn:disabled { background: #F4F4F4; color: #AAA; cursor: not-allowed; }
        .opt-dd-btn.open { border-color: #1A1A1A; }
        .opt-dd-btn > span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .opt-dd-btn .ph { color: #9A9A9A; }
        .opt-dd-btn svg { color: #8B9389; flex-shrink: 0; transition: transform .15s; }
        .opt-dd-btn.open svg { transform: rotate(180deg); }
        .opt-dd-backdrop { position: fixed; inset: 0; z-index: 4002; }
        .opt-dd-list {
          position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 4003;
          background: #fff; border: 1px solid #E2E2E2; border-radius: 10px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.12); overflow: hidden; max-height: 240px; overflow-y: auto;
        }
        .opt-dd-item {
          display: block; width: 100%; text-align: left;
          padding: 13px 16px; background: #fff; border: none; cursor: pointer;
          font-size: 14px; color: #1A1A1A; font-family: inherit;
          border-bottom: 1px solid #F2F2F2;
        }
        .opt-dd-item:last-child { border-bottom: none; }
        .opt-dd-item:hover { background: #F7F7F5; }
        .opt-dd-item.sel { background: #F2F2F0; font-weight: 700; }
        .opt-dd-empty { padding: 16px; text-align: center; font-size: 13px; color: #AAA; }

        .option-drawer {
          position: fixed;
          z-index: 4001;
          background: #fff;
          display: flex;
          flex-direction: column;
          /* PC: 우측 사이드바 */
          top: 0; right: 0; bottom: 0;
          width: 380px; max-width: 90vw;
          box-shadow: -4px 0 24px rgba(0,0,0,0.12);
          animation: slideInRight .28s cubic-bezier(.4,0,.2,1);
        }
        .option-drawer[data-closing="true"] {
          animation: slideOutRight .28s cubic-bezier(.4,0,.2,1) forwards;
        }
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes slideOutRight { from { transform: translateX(0); } to { transform: translateX(100%); } }

        /* 모바일: 하단 시트 */
        @media (max-width: 768px) {
          .option-drawer {
            top: auto; right: 0; left: 0; bottom: 0;
            width: 100%; max-width: 100%;
            max-height: 90vh; height: 90vh;
            border-radius: 18px 18px 0 0;
            box-shadow: 0 -4px 24px rgba(0,0,0,0.15);
            animation: slideUp .28s cubic-bezier(.4,0,.2,1);
          }
          .option-drawer[data-closing="true"] {
            animation: slideDown .28s cubic-bezier(.4,0,.2,1) forwards;
          }
          @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
          @keyframes slideDown { from { transform: translateY(0); } to { transform: translateY(100%); } }
        }
      `}</style>
    </>
  );
}
