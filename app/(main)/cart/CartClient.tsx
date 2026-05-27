'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getCart, saveCart, removeFromCart, updateQty, type CartItem } from '@/lib/cart';
import '@/styles/cart.css';

const EMOJI_MAP: Record<string, string> = {
  '🍎':1,'🍊':1,'🫐':1,'🥝':1,'🥭':1,'🍇':1,'🎁':1
} as unknown as Record<string, string>;

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

  /* 금액 계산 */
  const selItems = items.filter(i => selected.has(i.idx));
  const subtotal = selItems.reduce((s, i) => s + i.price * (i.quantity ?? 1), 0);
  const shippingFee = subtotal >= 30000 || subtotal === 0 ? 0 : 3000;
  const total = subtotal - couponDisc + shippingFee;

  async function applyCoupon() {
    if (couponCode.toUpperCase() === 'WELCOME5000') {
      setCouponDisc(5000);
      setCouponMsg('5,000원 할인 적용!');
    } else if (couponCode.toUpperCase() === 'FREESHIP') {
      setCouponDisc(shippingFee);
      setCouponMsg('무료배송 쿠폰 적용!');
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
        <div className="cart-empty-icon">🛒</div>
        <div className="cart-empty-text">장바구니가 비어있습니다.</div>
        <Link href="/category"
          style={{ display:'inline-block', padding:'12px 28px', background:'var(--color-accent)',
            color:'#fff', borderRadius:8, fontWeight:700, textDecoration:'none', fontSize:14 }}>
          쇼핑하러 가기
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
                style={{ width:17, height:17, accentColor:'var(--color-accent)', cursor:'pointer' }} />
              <span className="select-bar-label">전체 선택 ({selItems.length}/{items.length})</span>
            </label>
            <button className="select-bar-delete-btn" onClick={handleRemoveSelected}>
              선택 삭제
            </button>
          </div>

          {/* 상품 그룹 */}
          <div className="delivery-group">
            <div className="delivery-group-header">
              <span className="delivery-group-badge">택배</span>
              <span className="delivery-group-title">일반 택배 배송</span>
              <span className="delivery-group-sub">
                {subtotal >= 30000 ? '무료배송' : `${fmtPrice(30000 - subtotal)}원 더 담으면 무료`}
              </span>
            </div>

            {items.map(item => (
              <div key={item.idx} className="cart-item">
                <label style={{ display:'flex', alignItems:'flex-start', gap:12, width:'100%', cursor:'pointer' }}>
                  <input type="checkbox" checked={selected.has(item.idx)}
                    onChange={() => toggleSelect(item.idx)}
                    style={{ width:17, height:17, accentColor:'var(--color-accent)', marginTop:32, flexShrink:0 }} />

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
                      <span className="cart-item-price">
                        {fmtPrice(item.price * (item.quantity ?? 1))}원
                      </span>
                    </div>
                  </div>

                  <button onClick={e => { e.preventDefault(); handleRemove(item.idx); }}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'#ccc',
                      fontSize:18, padding:4, flexShrink:0 }}>
                    ✕
                  </button>
                </label>
              </div>
            ))}
          </div>
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
                <p style={{ fontSize:12, color: couponDisc > 0 ? 'var(--color-accent)' : '#e00',
                  marginTop:2 }}>{couponMsg}</p>
              )}
            </div>

            {/* 금액 */}
            <div className="summary-row"><span>상품 합계</span><span>{fmtPrice(subtotal)}원</span></div>
            {couponDisc > 0 && (
              <div className="summary-row"><span>쿠폰 할인</span><span className="sum-discount-val">−{fmtPrice(couponDisc)}원</span></div>
            )}
            <div className="summary-row"><span>배송비</span><span>{shippingFee === 0 ? '무료' : `${fmtPrice(shippingFee)}원`}</span></div>
            <div className="summary-row total"><span>결제 예정금액</span><span>{fmtPrice(total)}원</span></div>

            {shippingFee > 0 && (
              <p className="free-shipping-notice">
                {fmtPrice(30000 - subtotal)}원 더 담으면 무료배송!
              </p>
            )}

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
                · 오후 11시 이전 주문 시 새벽 배송 가능<br/>
                · 30,000원 이상 무료배송<br/>
                · 도서/산간 지역 추가 배송비 발생
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
