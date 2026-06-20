'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getCart, saveCart, removeFromCart, updateQty, type CartItem } from '@/lib/cart';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { getOrderPrefs, setOrderPrefs } from '@/lib/orderPrefs';
import '@/styles/cart.css';

function fmtPrice(n: number) { return n.toLocaleString('ko-KR'); }

interface ProductOption {
  id: string; label: string; add_price: number; group_name: string | null;
  is_required: boolean | null; parent_label?: string | null; sort_order?: number;
}
interface OptProduct { id: string; name: string; price: number; discounted_price: number | null; thumbnail_url: string | null; is_dawn: boolean | null; }

function QtyControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:0, border:'1px solid #EBEBEB', borderRadius:6, overflow:'hidden' }}>
      <button onClick={() => onChange(Math.max(1, value - 1))}
        style={{ width:30, height:30, border:'none', background:'#F7F7F5', cursor:'pointer', fontSize:16, color:'#1A1A1A', display:'flex', alignItems:'center', justifyContent:'center' }}>
        −
      </button>
      <span style={{ width:32, textAlign:'center', fontSize:13, fontWeight:700 }}>{value}</span>
      <button onClick={() => onChange(value + 1)}
        style={{ width:30, height:30, border:'none', background:'#F7F7F5', cursor:'pointer', fontSize:16, color:'#1A1A1A', display:'flex', alignItems:'center', justifyContent:'center' }}>
        +
      </button>
    </div>
  );
}

export default function CartClient() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [coupons, setCoupons] = useState<{ ucId:string; name:string; discount_type:'percent'|'fixed'; discount_value:number; min_order_amount:number; max_discount_amount:number|null; starts_at:string|null; expires_at:string|null }[]>([]);
  const [selCoupon, setSelCoupon] = useState('');
  const [couponModal, setCouponModal] = useState(false);
  const [modalSel, setModalSel] = useState('');
  const [pointBalance, setPointBalance] = useState(0);
  const [pointUsed, setPointUsed] = useState(0);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  /* 옵션변경 모달 */
  const [optItem, setOptItem] = useState<CartItem | null>(null);
  const [optProduct, setOptProduct] = useState<OptProduct | null>(null);
  const [optList, setOptList] = useState<ProductOption[]>([]);
  const [optSel, setOptSel] = useState<Record<string, string>>({}); // group_name -> option id
  const [optLoading, setOptLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const load = () => {
      const cart = getCart();
      setItems(cart);
      setSelected(new Set(cart.map(i => i.idx)));
    };
    load();
    window.addEventListener('cartUpdated', load);
    return () => window.removeEventListener('cartUpdated', load);
  }, []);

  /* 보유 쿠폰 + 적립금 로드 + 저장된 선택(prefs) 복원 */
  useEffect(() => {
    if (!user) return;
    const now = new Date().toISOString();
    createClient()
      .from('user_coupons')
      .select('id, expires_at, coupons:coupon_id(name, discount_type, discount_value, min_order_amount, max_discount_amount, is_active, starts_at, expires_at)')
      .eq('user_id', user.id).eq('is_used', false)
      .then(({ data }) => {
        const list = (data || [])
          .filter((r: Record<string, unknown>) => {
            const c = r.coupons as Record<string, unknown> | null;
            const exp = (r.expires_at as string) || (c?.expires_at as string);
            return c?.is_active && (!exp || exp > now);
          })
          .map((r: Record<string, unknown>) => {
            const c = r.coupons as Record<string, unknown>;
            return {
              ucId: r.id as string,
              name: c.name as string,
              discount_type: c.discount_type as 'percent'|'fixed',
              discount_value: c.discount_value as number,
              min_order_amount: (c.min_order_amount as number) ?? 0,
              max_discount_amount: (c.max_discount_amount as number) ?? null,
              starts_at: (c.starts_at as string) ?? null,
              expires_at: (r.expires_at as string) ?? (c.expires_at as string) ?? null,
            };
          });
        setCoupons(list);
        // 저장된 쿠폰 선택 복원 (보유 목록에 있을 때만)
        const prefs = getOrderPrefs();
        if (prefs.couponUcId && list.some(c => c.ucId === prefs.couponUcId)) setSelCoupon(prefs.couponUcId);
        if (prefs.pointUsed > 0) setPointUsed(prefs.pointUsed);
        setPrefsLoaded(true);
      });
    createClient().from('profiles').select('point_balance').eq('id', user.id).maybeSingle()
      .then(({ data }) => setPointBalance(data?.point_balance || 0));
  }, [user]);

  function toggleSelect(idx: number) {
    setSelected(prev => {
      const s = new Set(prev);
      if (s.has(idx)) s.delete(idx); else s.add(idx);
      return s;
    });
  }

  /* ── 옵션변경 모달 ── */
  async function openOptModal(item: CartItem) {
    setOptItem(item); setOptLoading(true); setOptList([]); setOptSel({}); setOptProduct(null);
    const supabase = createClient();
    const [{ data: prod }, { data: opts }] = await Promise.all([
      supabase.from('products').select('id,name,price,discounted_price,thumbnail_url,is_dawn').eq('id', item.id).single(),
      supabase.from('product_options').select('id,label,add_price,group_name,is_required,parent_label,sort_order').eq('product_id', item.id).order('sort_order'),
    ]);
    setOptProduct(prod as OptProduct);
    const list = (opts as ProductOption[]) || [];
    setOptList(list);
    // 현재 담긴 옵션 라벨로 초기 선택값 매칭
    const curLabels = (item.options || '').split(' / ').map(s => s.trim());
    const sel: Record<string, string> = {};
    [...new Set(list.map(o => o.group_name || '옵션'))].forEach(g => {
      const found = list.find(o => (o.group_name || '옵션') === g && curLabels.includes(o.label));
      if (found) sel[g] = found.id;
    });
    setOptSel(sel);
    setOptLoading(false);
  }
  function applyOpt(mode: 'change' | 'add') {
    if (!optItem || !optProduct) return;
    const groups = [...new Set(optList.map(o => o.group_name || '옵션'))];
    const parentGroup = groups[0];
    const parentLabel = optList.find(o => o.id === optSel[parentGroup])?.label || '';
    const chosen: ProductOption[] = [];
    for (const g of groups) {
      const avail = optList.filter(o => (o.group_name || '옵션') === g && (!o.parent_label || o.parent_label === parentLabel));
      const req = optList.find(o => (o.group_name || '옵션') === g)?.is_required !== false;
      const opt = avail.find(o => o.id === optSel[g]);
      if (req && !opt) { alert('필수 옵션을 모두 선택해 주세요.'); return; }
      if (opt) chosen.push(opt);
    }
    const base = optProduct.discounted_price ?? optProduct.price;
    const addP = chosen.reduce((s, o) => s + (o.add_price || 0), 0);
    const patch = {
      price: base + addP,
      originalPrice: optProduct.price + addP,
      optionId: chosen.map(o => o.id).join(',') || undefined,
      options: chosen.map(o => o.label).join(' / ') || undefined,
    };
    const cart = getCart();
    if (mode === 'change') {
      const it = cart.find(c => c.idx === optItem.idx);
      if (it) Object.assign(it, patch);
    } else {
      cart.push({ ...optItem, ...patch, idx: Date.now() });
    }
    saveCart(cart);
    setOptItem(null);
  }
  const allSelected = items.length > 0 && items.every(i => selected.has(i.idx));
  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(items.map(i => i.idx)));
  }

  function handleQtyChange(idx: number, qty: number) {
    updateQty(idx, qty);
    setItems(getCart());
  }
  function handleRemove(idx: number) {
    removeFromCart(idx);
    setItems(getCart());
    setSelected(prev => { const s = new Set(prev); s.delete(idx); return s; });
  }
  function handleRemoveSelected() {
    const cart = getCart().filter(i => !selected.has(i.idx));
    saveCart(cart);
    setItems(cart);
    setSelected(new Set());
  }
  function handleRemoveAll() {
    if (!confirm('장바구니를 전체 비우시겠습니까?')) return;
    saveCart([]);
    setItems([]);
    setSelected(new Set());
  }

  /* 배송 타입별 그룹 */
  const farmItems    = items.filter(i => i.deliveryType === '산지직송');
  const companyItems = items.filter(i => i.deliveryType !== '산지직송');

  /* 금액 계산 */
  const selItems = items.filter(i => selected.has(i.idx));
  const subtotal = selItems.reduce((s, i) => s + i.price * (i.quantity ?? 1), 0);
  /* 원가 합계 + 상품 할인 (원가 - 판매가) */
  const origSubtotal = selItems.reduce((s, i) => s + ((i.originalPrice ?? i.price) * (i.quantity ?? 1)), 0);
  const productDisc = Math.max(0, origSubtotal - subtotal);

  /* 선택 쿠폰 할인 + 적립금 → 결제 예정금액 (체크아웃과 동일 계산) */
  const coupon = coupons.find(c => c.ucId === selCoupon);
  let couponDisc = 0;
  if (coupon && subtotal >= coupon.min_order_amount) {
    couponDisc = coupon.discount_type === 'percent'
      ? Math.floor(subtotal * coupon.discount_value / 100)
      : coupon.discount_value;
    if (coupon.max_discount_amount) couponDisc = Math.min(couponDisc, coupon.max_discount_amount);
  }
  const afterCoupon = Math.max(0, subtotal - couponDisc);
  const maxPoint = Math.min(pointBalance, afterCoupon);
  const appliedPoint = Math.min(pointUsed, maxPoint);
  const total = Math.max(0, afterCoupon - appliedPoint);

  /* 선택을 localStorage에 저장 → 체크아웃으로 공유 */
  useEffect(() => {
    if (!prefsLoaded) return;
    setOrderPrefs({ couponUcId: selCoupon, pointUsed: appliedPoint });
  }, [selCoupon, appliedPoint, prefsLoaded]);

  function handleCheckout() {
    if (selItems.length === 0) { alert('주문할 상품을 선택해주세요.'); return; }
    router.push('/checkout');
  }

  if (items.length === 0) {
    return (
      <div className="container cart-empty-box">
        <div className="cart-empty-icon-svg">
          <div style={{ width:48, height:48, borderRadius:'50%', border:'1.5px solid #D8D8D8',
            display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ fontSize:22, fontWeight:300, color:'#B0B0B0' }}>!</span>
          </div>
        </div>
        <div className="cart-empty-text">장바구니에 담으신 상품이 없습니다.</div>
        <Link href="/category" className="cart-empty-btn">
          상품 보러가기
        </Link>
      </div>
    );
  }

  return (
    <div className="container">
      <h1 style={{ fontSize:22, fontWeight:700, padding:'24px 0 16px' }}>장바구니</h1>

      <div className="cart-layout">
        {/* ── 왼쪽: 상품 목록 ── */}
        <div className="cart-main">
          {/* 전체 선택 바 */}
          <div className="select-bar">
            <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
              <input type="checkbox" checked={allSelected} onChange={toggleAll}
                style={{ width:12, height:12, accentColor:'#1A1A1A', cursor:'pointer', flexShrink:0 }} />
              <span className="select-bar-label">전체 선택 ({selItems.length}/{items.length})</span>
            </label>
            <div style={{ display:'flex', gap:8 }}>
              <button className="select-bar-delete-btn" onClick={handleRemoveSelected}>
                선택 삭제
              </button>
              <button className="select-bar-delete-btn" onClick={handleRemoveAll}>
                전체 삭제
              </button>
            </div>
          </div>

          {/* 배송 그룹 렌더 함수 */}
          {(['산지직송', '자사배송'] as const).map(type => {
            const groupItems = type === '산지직송' ? farmItems : companyItems;
            if (groupItems.length === 0) return null;
            return (
              <div key={type} className="delivery-group">
                <div className="delivery-group-header">
                  <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
                    <input type="checkbox"
                      checked={groupItems.every(i => selected.has(i.idx))}
                      onChange={() => {
                        const allSel = groupItems.every(i => selected.has(i.idx));
                        setSelected(prev => { const next = new Set(prev); groupItems.forEach(i => allSel ? next.delete(i.idx) : next.add(i.idx)); return next; });
                      }}
                      style={{ width:16, height:16, accentColor:'#1A1A1A', flexShrink:0 }} />
                    <span className={`delivery-group-badge ${type === '산지직송' ? 'tag-dawn' : 'tag-regular'}`}>{type}</span>
                    <span className="delivery-group-title">전 상품 무료배송</span>
                  </label>
                </div>

                {groupItems.map(item => {
                  const qty = item.quantity ?? 1;
                  const showOrig = item.originalPrice != null && item.originalPrice > item.price;
                  return (
                  <div key={item.idx} className="cart-item-card">
                    {/* 상단: 이미지 + 상품명/뱃지 + X */}
                    <div className="cart-item-top">
                      <div className="cart-item-img" style={{ background:'#F7F7F5' }}>
                        {item.thumbnail
                          ? <img src={item.thumbnail} alt={item.name}
                              style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:10 }} />
                          : <span>🍑</span>}
                      </div>
                      <div className="cart-item-info">
                        <div className="cart-item-name">{item.name}</div>
                      </div>
                      <button onClick={() => handleRemove(item.idx)}
                        style={{ background:'none', border:'none', cursor:'pointer', color:'#bbb', padding:4, flexShrink:0, alignSelf:'flex-start' }}
                        onMouseEnter={e => (e.currentTarget.style.color='#555')}
                        onMouseLeave={e => (e.currentTarget.style.color='#bbb')}>
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>

                    {/* 옵션 + 옵션변경 */}
                    {item.options && (
                      <div className="cart-item-option-row">
                        <span className="cart-item-option-text">{item.options}</span>
                        <button type="button" className="cart-item-option-change" onClick={() => openOptModal(item)}
                          style={{ background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', padding:0 }}>옵션변경</button>
                      </div>
                    )}

                    {/* 수량 + 가격 */}
                    <div className="cart-item-bottom-row">
                      <QtyControl value={qty} onChange={v => handleQtyChange(item.idx, v)} />
                      <div className="cart-item-price-wrap">
                        {showOrig && <span className="cart-item-price-orig">{fmtPrice(item.originalPrice! * qty)}원</span>}
                        <span className="cart-item-price">{fmtPrice(item.price * qty)}원</span>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* ── 오른쪽: 주문 요약 ── */}
        <div className="cart-side">
          <div className="order-summary">
            <div className="summary-title">주문 요약</div>

            {/* 쿠폰 / 적립금 (로그인 시) */}
            {user && (
              <div style={{ padding:'4px 0 10px', borderBottom:'1px solid #F0F0F0', marginBottom:6 }}>
                {/* 쿠폰 — 버튼 + 모달 */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', gap:10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontSize:13, fontWeight:600 }}>쿠폰</span>
                    <button type="button" onClick={() => { setModalSel(selCoupon); setCouponModal(true); }}
                      style={{ padding:'6px 12px', border:'1px solid #1A1A1A', borderRadius:6, background:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                      쿠폰선택
                    </button>
                  </div>
                  <span style={{ fontSize:12, fontWeight:700, color: couponDisc > 0 ? '#CB1D11' : '#999' }}>
                    {coupon ? `−${fmtPrice(couponDisc)}원` : `${coupons.length}장 보유`}
                  </span>
                </div>
                {/* 적립금 — 전액 버튼 + 입력 */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', gap:8, flexWrap:'wrap' }}>
                  <span style={{ fontSize:13, fontWeight:600 }}>포인트 <span style={{ fontSize:11, color:'#999', fontWeight:400 }}>(보유 {fmtPrice(pointBalance)}P)</span></span>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <button onClick={() => setPointUsed(maxPoint)}
                      style={{ padding:'0 12px', height:36, border:'1px solid #1A1A1A', background:'#fff', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>전액 사용</button>
                    <input type="text" inputMode="numeric" value={pointUsed || ''}
                      onChange={e => setPointUsed(Math.max(0, Math.min(maxPoint, Number(e.target.value.replace(/[^0-9]/g, '')) || 0)))} placeholder="0"
                      style={{ width:80, height:36, padding:'0 10px', border:'1.5px solid #E2E8F0', borderRadius:6, fontSize:13, fontFamily:'inherit', outline:'none', textAlign:'right' }} />
                    <span style={{ fontSize:12, color:'#666' }}>원</span>
                  </div>
                </div>
              </div>
            )}

            {/* 금액 */}
            <div className="summary-row" style={{ borderBottom:'none' }}><span>상품 금액</span><span>{fmtPrice(origSubtotal)}원</span></div>
            {productDisc > 0 && (
              <div className="summary-row" style={{ borderBottom:'none' }}><span>상품 할인</span><span style={{ color:'var(--color-accent)' }}>-{fmtPrice(productDisc)}원</span></div>
            )}
            {couponDisc > 0 && (
              <div className="summary-row" style={{ borderBottom:'none' }}><span>쿠폰 할인</span><span style={{ color:'var(--color-accent)' }}>-{fmtPrice(couponDisc)}원</span></div>
            )}
            {appliedPoint > 0 && (
              <div className="summary-row" style={{ borderBottom:'none' }}><span>포인트 사용</span><span style={{ color:'var(--color-accent)' }}>-{fmtPrice(appliedPoint)}원</span></div>
            )}
            <div className="summary-row" style={{ borderBottom:'none' }}><span>배송비</span><span style={{ color:'#1A1A1A', fontWeight:600 }}>무료</span></div>
            <div className="summary-row total"><span>결제 예정금액</span><span>{fmtPrice(total)}원</span></div>

            <div className="cta-group">
              <button className="cart-checkout-all" onClick={handleCheckout}>
                주문하기 ({fmtPrice(total)}원)
              </button>
              <button className="cart-checkout-sel" onClick={handleCheckout}>
                선택 주문하기 ({selItems.length}개)
              </button>
            </div>

            {/* 배송 안내 */}
            <div className="cart-delivery-info">
              <div className="cart-delivery-title">배송 안내</div>
              <div className="cart-delivery-text">
                · 전 상품 무료배송<br/>
                · 주문 완료 후 1~3일 이내 배송
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 모바일 고정 CTA */}
      <div className="cta-sticky-mobile">
        <div className="mobile-cta-total-row">
          <span className="mobile-cta-total-label">결제 예정금액</span>
          <span className="mobile-cta-total-val">{fmtPrice(total)}원</span>
        </div>
        <div className="mobile-cta-btns">
          <button className="btn-purchase btn-purchase-flex" onClick={handleCheckout}>
            주문하기
          </button>
        </div>
      </div>

      {/* 옵션변경 모달 */}
      {optItem && (
        <div onClick={() => setOptItem(null)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:3100, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'#fff', borderRadius:14, width:'100%', maxWidth:480, maxHeight:'82vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 22px', borderBottom:'1px solid #F0F0F0' }}>
              <span style={{ fontSize:16, fontWeight:700 }}>옵션변경</span>
              <button onClick={() => setOptItem(null)} style={{ background:'none', border:'none', cursor:'pointer', padding:4, lineHeight:0 }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div style={{ overflowY:'auto', padding:'18px 22px 22px' }}>
              <div style={{ fontSize:14, color:'#888', paddingBottom:14, marginBottom:16, borderBottom:'1px solid #F2F2F2', lineHeight:1.5 }}>
                {optItem.name}
              </div>
              {optLoading ? (
                <div style={{ textAlign:'center', padding:'30px 0', color:'#aaa', fontSize:13 }}>불러오는 중...</div>
              ) : optList.length === 0 ? (
                <div style={{ textAlign:'center', padding:'30px 0', color:'#aaa', fontSize:13 }}>변경 가능한 옵션이 없습니다.</div>
              ) : (
                <>
                  <div style={{ fontSize:14, fontWeight:700, marginBottom:12 }}>상품옵션</div>
                  {(() => {
                    const groups = [...new Set(optList.map(o => o.group_name || '옵션'))];
                    const parentGroup = groups[0];
                    const parentLabel = optList.find(o => o.id === optSel[parentGroup])?.label || '';
                    return groups.map(g => {
                      const avail = optList.filter(o => (o.group_name || '옵션') === g && (!o.parent_label || o.parent_label === parentLabel));
                      const req = optList.find(o => (o.group_name || '옵션') === g)?.is_required !== false;
                      return (
                        <div key={g} style={{ display:'flex', alignItems:'center', gap:14, marginBottom:12 }}>
                          <span style={{ fontSize:14, color:'#555', minWidth:60, flexShrink:0 }}>{g}</span>
                          <select
                            value={optSel[g] || ''}
                            onChange={e => setOptSel(prev => ({ ...prev, [g]: e.target.value }))}
                            style={{ flex:1, padding:'11px 12px', fontSize:14, border:'1px solid #DADADA', borderRadius:8, background:'#fff', color: optSel[g] ? '#1A1A1A' : '#999', fontFamily:'inherit', cursor:'pointer', outline:'none' }}>
                            <option value="">- {req ? '[필수]' : '[선택]'} 옵션을 선택해 주세요 -</option>
                            {avail.map(o => (
                              <option key={o.id} value={o.id}>
                                {o.label}{o.add_price ? ` (+${fmtPrice(o.add_price)}원)` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    });
                  })()}
                  <div style={{ display:'flex', gap:10, marginTop:22 }}>
                    <button onClick={() => applyOpt('add')}
                      style={{ flex:1, padding:'13px', border:'1.5px solid #1A1A1A', borderRadius:10, background:'#fff', color:'#1A1A1A', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                      추가
                    </button>
                    <button onClick={() => applyOpt('change')}
                      style={{ flex:1, padding:'13px', border:'none', borderRadius:10, background:'#1A1A1A', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                      변경
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 쿠폰 선택 모달 (체크아웃과 동일) */}
      {couponModal && (
        <div onClick={() => setCouponModal(false)}
          style={{ position:'fixed', inset:0, background: isMobile ? '#fff' : 'rgba(0,0,0,0.45)', zIndex:3100,
            display:'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent:'center', padding: isMobile ? 0 : 16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'#fff', width:'100%',
              maxWidth: isMobile ? '100%' : 460,
              height: isMobile ? '100%' : 'auto',
              maxHeight: isMobile ? '100%' : '86vh',
              borderRadius: isMobile ? 0 : 14,
              display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ flexShrink:0, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid #F0F0F0' }}>
              <span style={{ fontSize:17, fontWeight:700 }}>장바구니 쿠폰 <span style={{ color:'#CB1D11', fontSize:15 }}>{coupons.length}장</span></span>
              <button onClick={() => setCouponModal(false)} style={{ background:'none', border:'none', cursor:'pointer', padding:4, lineHeight:0 }}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'16px 20px 20px' }}>
              <button onClick={() => setModalSel('')}
                style={{ width:'100%', textAlign:'center', padding:'13px 16px', marginBottom:14, border:`1.5px solid ${modalSel==='' ? '#1A1A1A' : '#EBEBEB'}`, borderRadius:10, background:'#fff', cursor:'pointer', fontSize:14, fontWeight:600, color: modalSel==='' ? '#1A1A1A' : '#888' }}>
                쿠폰 사용 안 함
              </button>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {coupons.map(c => {
                  const usable = subtotal >= c.min_order_amount;
                  const sel = modalSel === c.ucId;
                  const fmtD = (d: Date) => `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
                  const start = c.starts_at ? new Date(c.starts_at) : null;
                  const exp = c.expires_at ? new Date(c.expires_at) : null;
                  const periodStr = exp ? `${start ? fmtD(start) : ''} ~ ${fmtD(exp)}` : '상시 사용 가능';
                  let dday: number | null = null;
                  if (exp) { const t0 = new Date(); t0.setHours(0,0,0,0); const e0 = new Date(exp); e0.setHours(0,0,0,0); dday = Math.round((e0.getTime()-t0.getTime())/86400000); }
                  const imminent = dday !== null && dday >= 0 && dday <= 3;
                  const ddayStr = dday === 0 ? '오늘 마감' : `D-${dday}`;
                  return (
                    <button key={c.ucId} disabled={!usable} onClick={() => setModalSel(c.ucId)}
                      style={{ textAlign:'left', padding:'18px 16px', border:`1.5px solid ${sel ? '#1A1A1A' : '#EFEFEF'}`, borderRadius:10,
                        background: usable ? '#fff' : '#FAFAFA', cursor: usable ? 'pointer' : 'not-allowed', opacity: usable ? 1 : 0.55, position:'relative' }}>
                      <div style={{ position:'absolute', top:14, right:14, display:'flex', gap:5 }}>
                        {imminent && <span style={{ fontSize:10, color:'#fff', background:'#CB1D11', borderRadius:4, padding:'2px 6px', lineHeight:1, fontWeight:700 }}>{ddayStr}</span>}
                        <span style={{ fontSize:10, color:'#999', border:'1px solid #E2E2E2', borderRadius:4, padding:'2px 6px', lineHeight:1, fontWeight:500 }}>1장</span>
                      </div>
                      <div style={{ fontSize:22, fontWeight:800, color:'#1A1A1A', lineHeight:1.1 }}>
                        {c.discount_type === 'percent' ? `${c.discount_value}%` : `${fmtPrice(c.discount_value)}원`}
                      </div>
                      <div style={{ fontSize:14, fontWeight:600, color:'#1A1A1A', marginTop:6 }}>{c.name}</div>
                      {c.max_discount_amount ? <div style={{ fontSize:12, color:'#CB1D11', fontWeight:600, marginTop:4 }}>최대 {fmtPrice(c.max_discount_amount)}원 할인</div> : null}
                      <div style={{ fontSize:12, color:'#AAA', marginTop:10, lineHeight:1.6 }}>
                        {c.min_order_amount > 0 ? `${fmtPrice(c.min_order_amount)}원 이상 구매` : '0원 이상 구매'}<br/>{periodStr}
                      </div>
                      {!usable && <div style={{ fontSize:11, color:'#CB1D11', fontWeight:600, marginTop:6 }}>{fmtPrice(c.min_order_amount)}원 이상 구매 시 사용 가능</div>}
                    </button>
                  );
                })}
              </div>
              {coupons.length === 0 && <div style={{ textAlign:'center', color:'#AAA', fontSize:13, padding:'30px 0' }}>보유한 쿠폰이 없습니다</div>}
            </div>
            <div style={{ flexShrink:0, padding:'12px 20px 16px', borderTop:'1px solid #F0F0F0', background:'#fff' }}>
              {(() => {
                const selC = coupons.find(c => c.ucId === modalSel);
                const discAmt = selC ? (selC.discount_type === 'percent'
                  ? Math.min(Math.round(subtotal * selC.discount_value / 100), selC.max_discount_amount || Infinity)
                  : Math.min(selC.discount_value, subtotal)) : 0;
                return (
                  <button onClick={() => { setSelCoupon(modalSel); setCouponModal(false); }}
                    style={{ width:'100%', padding:'15px', background:'#1A1A1A', color:'#fff', border:'none', borderRadius:10, fontSize:15, fontWeight:700, cursor:'pointer' }}>
                    {modalSel === '' ? '쿠폰 미적용' : `${fmtPrice(discAmt)}원 할인 적용하기`}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
