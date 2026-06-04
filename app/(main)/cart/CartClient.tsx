'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getCart, saveCart, removeFromCart, updateQty, type CartItem } from '@/lib/cart';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import '@/styles/cart.css';

function fmtPrice(n: number) { return n.toLocaleString('ko-KR'); }

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
  const [coupons, setCoupons] = useState<{ discount_type:'percent'|'fixed'; discount_value:number; min_order_amount:number; max_discount_amount:number|null }[]>([]);

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

  /* 보유 쿠폰 로드 (최대 할인 계산용) */
  useEffect(() => {
    if (!user) return;
    const now = new Date().toISOString();
    createClient()
      .from('user_coupons')
      .select('coupons:coupon_id(discount_type, discount_value, min_order_amount, max_discount_amount, is_active, expires_at)')
      .eq('user_id', user.id).eq('is_used', false)
      .then(({ data }) => {
        const list = (data || [])
          .map((r: Record<string, unknown>) => r.coupons as Record<string, unknown>)
          .filter((c) => c?.is_active && (!c.expires_at || (c.expires_at as string) > now))
          .map((c) => ({
            discount_type: c.discount_type as 'percent'|'fixed',
            discount_value: c.discount_value as number,
            min_order_amount: (c.min_order_amount as number) ?? 0,
            max_discount_amount: (c.max_discount_amount as number) ?? null,
          }));
        setCoupons(list);
      });
  }, [user]);

  function toggleSelect(idx: number) {
    setSelected(prev => {
      const s = new Set(prev);
      if (s.has(idx)) s.delete(idx); else s.add(idx);
      return s;
    });
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

  /* 보유 쿠폰 중 최대 할인액 (주문금액 기준) */
  let bestCouponDisc = 0;
  for (const c of coupons) {
    if (subtotal < c.min_order_amount) continue;
    let d = c.discount_type === 'percent'
      ? Math.floor(subtotal * c.discount_value / 100)
      : c.discount_value;
    if (c.max_discount_amount) d = Math.min(d, c.max_discount_amount);
    bestCouponDisc = Math.max(bestCouponDisc, d);
  }
  const total = subtotal;                          // 결제 예정금액 (쿠폰 미적용)
  const couponFinal = Math.max(0, subtotal - bestCouponDisc); // 쿠폰 적용가

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
                  <span className={`delivery-group-badge ${type === '산지직송' ? 'tag-dawn' : 'tag-regular'}`}>{type}</span>
                  <span className="delivery-group-title">전 상품 무료배송</span>
                </div>

                {groupItems.map(item => (
                  <div key={item.idx} className="cart-item">
                    {/* 체크박스 + 이미지 + 상품정보 */}
                    <label style={{ display:'flex', alignItems:'center', gap:12, flex:1, cursor:'pointer', minWidth:0 }}>
                      <input type="checkbox" checked={selected.has(item.idx)}
                        onChange={() => toggleSelect(item.idx)}
                        style={{ width:12, height:12, accentColor:'#1A1A1A', flexShrink:0 }} />

                      <div className="cart-item-img" style={{ background:'#F7F7F5' }}>
                        {item.thumbnail
                          ? <img src={item.thumbnail} alt={item.name}
                              style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:10 }} />
                          : <span>🍑</span>
                        }
                      </div>

                      <div className="cart-item-info">
                        <div className="cart-item-name">{item.name}</div>
                        {item.options && (
                          <div style={{ fontSize:12, color:'#888', marginTop:3, display:'flex', alignItems:'center', gap:4 }}>
                            <span style={{ color:'#bbb' }}>ㄴ</span>{item.options}
                          </div>
                        )}
                        <div className="cart-item-bottom">
                          <QtyControl value={item.quantity ?? 1}
                            onChange={v => handleQtyChange(item.idx, v)} />
                        </div>
                      </div>
                    </label>

                    {/* 가격 + X — 같은 높이로 정렬 */}
                    <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
                      <span className="cart-item-price">
                        {fmtPrice(item.price * (item.quantity ?? 1))}원
                      </span>
                      <button onClick={() => handleRemove(item.idx)}
                        style={{ background:'none', border:'none', cursor:'pointer', color:'#bbb',
                          padding:6, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
                          borderRadius:4, transition:'color .15s' }}
                        onMouseEnter={e => (e.currentTarget.style.color='#555')}
                        onMouseLeave={e => (e.currentTarget.style.color='#bbb')}>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* ── 오른쪽: 주문 요약 ── */}
        <div className="cart-side">
          <div className="order-summary">
            <div className="summary-title">주문 요약</div>

            {/* 금액 */}
            <div className="summary-row" style={{ borderBottom:'none' }}><span>상품 합계</span><span>{fmtPrice(subtotal)}원</span></div>
            <div className="summary-row" style={{ borderBottom:'none' }}><span>배송비</span><span style={{ color:'#1A1A1A', fontWeight:600 }}>무료</span></div>
            <div className="summary-row total"><span>결제 예정금액</span><span>{fmtPrice(total)}원</span></div>
            {bestCouponDisc > 0 && (
              <div className="summary-row total" style={{ borderTop:'none', marginTop:0, paddingTop:4 }}>
                <span style={{ color:'var(--color-accent)' }}>쿠폰 적용 금액</span>
                <span style={{ color:'var(--color-accent)' }}>{fmtPrice(couponFinal)}원</span>
              </div>
            )}

            <div className="cta-group">
              <button className="cart-checkout-all" onClick={handleCheckout}>
                전체 주문하기 ({fmtPrice(bestCouponDisc > 0 ? couponFinal : total)}원)
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
          <span className="mobile-cta-total-val">{fmtPrice(bestCouponDisc > 0 ? couponFinal : total)}원</span>
        </div>
        <div className="mobile-cta-btns">
          <button className="btn-purchase btn-purchase-flex" onClick={handleCheckout}>
            주문하기
          </button>
        </div>
      </div>
    </div>
  );
}
