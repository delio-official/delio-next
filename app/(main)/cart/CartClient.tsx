'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getCart, saveCart, removeFromCart, updateQty, type CartItem } from '@/lib/cart';
import '@/styles/cart.css';

function fmtPrice(n: number) { return n.toLocaleString('ko-KR'); }

function QtyControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:0, border:'1px solid #EBEBEB', borderRadius:6, overflow:'hidden' }}>
      <button onClick={() => onChange(Math.max(1, value - 1))}
        style={{ width:30, height:30, border:'none', background:'#F7F7F5', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>
        −
      </button>
      <span style={{ width:32, textAlign:'center', fontSize:13, fontWeight:700 }}>{value}</span>
      <button onClick={() => onChange(value + 1)}
        style={{ width:30, height:30, border:'none', background:'#F7F7F5', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>
        +
      </button>
    </div>
  );
}

export default function CartClient() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [couponCode, setCouponCode] = useState('');
  const [couponDisc, setCouponDisc] = useState(0);
  const [couponMsg, setCouponMsg] = useState('');

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

  /* 배송 타입별 그룹 */
  const farmItems    = items.filter(i => i.deliveryType === '산지직송');
  const companyItems = items.filter(i => i.deliveryType !== '산지직송');

  /* 금액 계산 */
  const selItems = items.filter(i => selected.has(i.idx));
  const subtotal = selItems.reduce((s, i) => s + i.price * (i.quantity ?? 1), 0);
  const total = subtotal - couponDisc;

  async function applyCoupon() {
    if (couponCode.toUpperCase() === 'WELCOME5000') {
      setCouponDisc(5000);
      setCouponMsg('5,000원 할인 적용!');
    } else {
      setCouponDisc(0);
      setCouponMsg('유효하지 않은 쿠폰입니다.');
    }
  }

  function handleCheckout() {
    if (selItems.length === 0) { alert('주문할 상품을 선택해주세요.'); return; }
    router.push('/checkout');
  }

  if (items.length === 0) {
    return (
      <div className="container cart-empty-box">
        <div className="cart-empty-icon-svg">
          <svg width="54" height="54" viewBox="0 0 54 54" fill="none">
            <circle cx="27" cy="27" r="26" stroke="#D8D8D8" strokeWidth="1.5"/>
            <path d="M18 24h18l-2 11H20L18 24z" stroke="#CACACA" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M22 24v-3a5 5 0 0 1 10 0v3" stroke="#CACACA" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="cart-empty-text">장바구니에 담으신 상품이 없습니다.</div>
        <Link href="/category" className="cart-empty-btn">
          할인상품 보러가기
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
            <button className="select-bar-delete-btn" onClick={handleRemoveSelected}>
              선택 삭제
            </button>
          </div>

          {/* 배송 그룹 렌더 함수 */}
          {(['산지직송', '자사배송'] as const).map(type => {
            const groupItems = type === '산지직송' ? farmItems : companyItems;
            if (groupItems.length === 0) return null;
            return (
              <div key={type} className="delivery-group">
                <div className="delivery-group-header">
                  <span className="delivery-group-badge">{type}</span>
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

            {/* 쿠폰 */}
            <div className="coupon-section">
              <div className="coupon-label">쿠폰 코드</div>
              <div className="coupon-row">
                <input type="text" className="coupon-input" placeholder="쿠폰 코드 입력"
                  value={couponCode} onChange={e => setCouponCode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && applyCoupon()} />
                <button className="select-bar-delete-btn coupon-apply-btn" onClick={applyCoupon}>적용</button>
              </div>
              {couponMsg && (
                <p style={{ fontSize:12, color: couponDisc > 0 ? '#2D7A4D' : '#C00',
                  marginTop:2 }}>{couponMsg}</p>
              )}
            </div>

            {/* 금액 */}
            <div className="summary-row"><span>상품 합계</span><span>{fmtPrice(subtotal)}원</span></div>
            {couponDisc > 0 && (
              <div className="summary-row"><span>쿠폰 할인</span><span className="sum-discount-val">−{fmtPrice(couponDisc)}원</span></div>
            )}
            <div className="summary-row"><span>배송비</span><span style={{ color:'#2D7A4D', fontWeight:600 }}>무료</span></div>
            <div className="summary-row total"><span>결제 예정금액</span><span>{fmtPrice(total)}원</span></div>

            <div className="cta-group">
              <button className="cart-checkout-all" onClick={handleCheckout}>
                전체 주문하기 ({fmtPrice(total)}원)
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
    </div>
  );
}
