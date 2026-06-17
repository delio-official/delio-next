'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { addToCart, showCartToast } from '@/lib/cart';
import { useLoginGuard } from '@/hooks/useLoginGuard';

interface Product {
  id: string; name: string; price: number; discounted_price: number | null;
  thumbnail_url: string | null; is_dawn: boolean;
}
interface Option {
  id: string; label: string; add_price: number; stock: number; is_default: boolean; group_name: string | null; is_required: boolean | null; parent_label?: string | null;
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
  const [qty, setQty]         = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function handler(e: Event) {
      const { productId } = (e as CustomEvent).detail;
      setOpen(true);
      setClosing(false);
      setLoading(true);
      setSelByGroup({});
      setQty(1);
      const supabase = createClient();
      const [{ data: prod }, { data: opts }] = await Promise.all([
        supabase.from('products').select('id,name,price,discounted_price,thumbnail_url,is_dawn').eq('id', productId).single(),
        supabase.from('product_options').select('id,label,add_price,stock,is_default,group_name,is_required,parent_label').eq('product_id', productId).order('sort_order'),
      ]);
      let optionList = (opts as Option[]) || [];
      // 옵션이 없는 기존 상품 → "기본" 가상 옵션으로 통일
      if (optionList.length === 0) {
        optionList = [{ id: '__default__', label: '기본', add_price: 0, stock: 999, is_default: true, group_name: '옵션', is_required: true }];
      }
      setProduct(prod as Product);
      setOptions(optionList);
      const def = optionList.find(o => o.is_default) || optionList[0];
      if (def) setSelByGroup({ [def.group_name || '옵션']: def.id });
      setLoading(false);
    }
    window.addEventListener('openOptionDrawer', handler);
    return () => window.removeEventListener('openOptionDrawer', handler);
  }, []);

  function close() {
    setClosing(true);
    setTimeout(() => { setOpen(false); setClosing(false); }, 280);
  }

  if (!open) return null;

  const groupNames = [...new Set(options.map(o => o.group_name || '옵션'))];
  const selectedOpts = groupNames.map(g => options.find(o => o.id === selByGroup[g])).filter(Boolean) as Option[];
  const requiredGroups = groupNames.filter(g => options.find(o => (o.group_name || '옵션') === g)?.is_required !== false);
  /* 2단(종속) 옵션: 첫 그룹=상위, 이후 하위는 parent_label로 필터 */
  const parentGroup = groupNames[0];
  const selectedParentLabel = options.find(o => o.id === selByGroup[parentGroup])?.label || '';
  const optsForGroup = (g: string): Option[] => {
    const inGroup = options.filter(o => (o.group_name || '옵션') === g);
    if (g === parentGroup) return inGroup;
    return inGroup.filter(o => !o.parent_label || o.parent_label === selectedParentLabel);
  };
  const allSel = options.length === 0 || requiredGroups.every(g => {
    if (selByGroup[g]) return true;
    if (groupNames.indexOf(g) > 0 && optsForGroup(g).length === 0) return true;
    return false;
  });
  const basePrice = product ? (product.discounted_price ?? product.price) : 0;
  const totalAddPrice = selectedOpts.reduce((s, o) => s + (o.add_price || 0), 0);
  const unitPrice = basePrice + totalAddPrice;
  const totalPrice = unitPrice * qty;

  function buildItem() {
    if (!product) return null;
    const isDefault = selectedOpts.length === 1 && selectedOpts[0].id === '__default__';
    return {
      id: product.id,
      name: product.name,
      price: unitPrice,
      originalPrice: product.price + totalAddPrice,
      thumbnail: product.thumbnail_url || '',
      quantity: qty,
      optionId: isDefault ? undefined : (selectedOpts.map(o => o.id).join(',') || undefined),
      options: isDefault ? undefined : (selectedOpts.map(o => o.label).join(' / ') || undefined),
      deliveryType: product.is_dawn ? '산지직송' : '자사배송' as '산지직송' | '자사배송',
    };
  }

  function handleAddCart() {
    if (!requireLogin()) { close(); return; }
    if (!allSel) { alert('옵션을 모두 선택해 주세요.'); return; }
    const item = buildItem();
    if (item) { addToCart(item); showCartToast(); close(); }
  }
  function handleBuyNow() {
    if (!requireLogin()) { close(); return; }
    if (!allSel) { alert('옵션을 모두 선택해 주세요.'); return; }
    const item = buildItem();
    if (item) { addToCart(item); close(); router.push('/cart'); }
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
            <div style={{ flex:1, overflowY:'auto', padding:'18px 20px' }}>
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
                  <select value={selByGroup[g] || ''} disabled={locked}
                    onChange={e => {
                      const val = e.target.value;
                      setSelByGroup(prev => { const next = { ...prev, [g]: val }; if (g === parentGroup) groupNames.slice(1).forEach(sub => { delete next[sub]; }); return next; });
                      setQty(1);
                    }}
                    style={{ width:'100%', height:46, padding:'0 14px', border:'1.5px solid #DADADA', borderRadius:8, fontSize:14, fontFamily:'inherit', outline:'none', background: locked ? '#F4F4F4' : '#fff', cursor: locked ? 'not-allowed' : 'pointer' }}>
                    <option value="">{locked ? '상위 옵션을 먼저 선택' : `${gReq ? '[필수]' : '[선택]'} 옵션 선택`}</option>
                    {optsForGroup(g).map(o => (
                      <option key={o.id} value={o.id}>
                        {o.label}{o.add_price > 0 ? ` (+${o.add_price.toLocaleString()}원)` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                );
              })}

              {/* 수량 + 선택된 옵션 카드 */}
              {allSel && selectedOpts.length > 0 && (
                <div style={{ background:'#F7F7F5', borderRadius:10, padding:'14px 16px' }}>
                  <div style={{ fontSize:13, fontWeight:600, marginBottom:10 }}>
                    {product.name}{selectedOpts.some(o => o.id !== '__default__') ? ` (${selectedOpts.filter(o => o.id !== '__default__').map(o => o.label).join(' / ')})` : ''}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ display:'flex', alignItems:'center', border:'1px solid #DADADA', borderRadius:8, background:'#fff' }}>
                      <button onClick={() => setQty(q => Math.max(1, q - 1))}
                        style={{ width:32, height:32, border:'none', background:'none', fontSize:16, cursor:'pointer', color:'#555' }}>−</button>
                      <span style={{ width:32, textAlign:'center', fontSize:14, fontWeight:600 }}>{qty}</span>
                      <button onClick={() => setQty(q => q + 1)}
                        style={{ width:32, height:32, border:'none', background:'none', fontSize:16, cursor:'pointer', color:'#555' }}>+</button>
                    </div>
                    <span style={{ fontSize:15, fontWeight:800 }}>{(unitPrice * qty).toLocaleString()}원</span>
                  </div>
                </div>
              )}
            </div>

            {/* 하단 합계 + 버튼 */}
            <div style={{ borderTop:'1px solid #F0F0F0', padding:'16px 20px' }}>
              <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:14 }}>
                <span style={{ fontSize:14, color:'#555' }}>TOTAL <span style={{ color:'#888', fontSize:12 }}>({qty}개)</span></span>
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
            max-height: 85vh;
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
