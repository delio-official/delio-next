'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCart, clearCart, type CartItem } from '@/lib/cart';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import '@/styles/checkout.css';

function fmtPrice(n: number) { return n.toLocaleString('ko-KR'); }

const PAYMENT_METHODS = [
  { value:'card',   label:'신용카드' },
  { value:'kakao',  label:'카카오페이' },
  { value:'naver',  label:'네이버페이' },
  { value:'toss',   label:'토스페이' },
  { value:'vbank',  label:'무통장입금' },
];

export default function CheckoutClient() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [recipient, setRecipient] = useState('');
  const [phone, setPhone] = useState('');
  const [zipcode, setZipcode] = useState('');
  const [addr1, setAddr1] = useState('');
  const [addr2, setAddr2] = useState('');
  const [memo, setMemo] = useState('');
  const [payMethod, setPayMethod] = useState('card');
  const [loading, setLoading] = useState(false);

  function openDaumPostcode() {
    const loadAndOpen = () => {
      new (window as any).daum.Postcode({
        oncomplete: (data: any) => {
          setZipcode(data.zonecode);
          setAddr1(data.roadAddress || data.jibunAddress);
        },
      }).open();
    };
    if ((window as any).daum?.Postcode) {
      loadAndOpen();
    } else {
      const script = document.createElement('script');
      script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
      script.onload = loadAndOpen;
      document.head.appendChild(script);
    }
  }

  useEffect(() => {
    const cart = getCart();
    if (cart.length === 0) { router.push('/cart'); return; }
    setItems(cart);
  }, [router]);

  const subtotal = items.reduce((s, i) => s + i.price * (i.quantity ?? 1), 0);
  const shippingFee = subtotal >= 30000 ? 0 : 3000;
  const total = subtotal + shippingFee;

  async function handleOrder() {
    if (!user) { router.push('/login'); return; }
    if (!recipient.trim() || !phone.trim() || !addr1.trim()) {
      alert('배송지 정보를 모두 입력해주세요.'); return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data: order, error } = await supabase.from('orders').insert({
      user_id: user.id,
      status: 'paid',
      total_amount: subtotal,
      discount_amount: 0,
      coupon_discount: 0,
      point_used: 0,
      final_amount: total,
      recipient, phone, zipcode, address1: addr1, address2: addr2,
      delivery_type: 'parcel',
      delivery_memo: memo,
      payment_method: payMethod,
      paid_at: new Date().toISOString(),
    }).select().single();

    if (error || !order) {
      setLoading(false);
      alert('주문 처리 중 오류가 발생했습니다.');
      return;
    }

    // 주문 아이템 삽입
    await supabase.from('order_items').insert(
      items.map(i => ({
        order_id: order.id,
        product_id: i.id,
        product_name: i.name,
        unit_price: i.price,
        quantity: i.quantity ?? 1,
        subtotal: i.price * (i.quantity ?? 1),
        thumbnail_url: i.thumbnail,
      }))
    );

    // 포인트 적립 (결제금액의 1%) — profiles.point_balance 직접 UPDATE
    const earnedPoint = Math.floor(total * 0.01);
    if (earnedPoint > 0) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('point_balance')
        .eq('id', user.id)
        .single();
      if (prof) {
        await supabase.from('profiles').update({
          point_balance: (prof.point_balance || 0) + earnedPoint,
        }).eq('id', user.id);
      }
    }

    clearCart();
    router.push(`/order-complete?order=${order.order_no}&point=${earnedPoint}`);
  }

  return (
    <div className="container" style={{ paddingTop:24, paddingBottom:100 }}>
      <h1 style={{ fontSize:22, fontWeight:700, marginBottom:24 }}>주문/결제</h1>

      <div style={{ display:'flex', gap:24, alignItems:'flex-start', flexWrap:'wrap' }}>
        {/* 왼쪽 */}
        <div style={{ flex:1, minWidth:280 }}>

          {/* 배송지 */}
          <div style={{ border:'1px solid #EBEBEB', borderRadius:12, padding:'20px', marginBottom:16 }}>
            <h2 style={{ fontSize:16, fontWeight:700, marginBottom:16 }}>배송지 정보</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <input placeholder="받는 분 이름 *" value={recipient} onChange={e => setRecipient(e.target.value)}
                style={{ height:46, padding:'0 12px', border:'1.5px solid #EBEBEB', borderRadius:8, fontSize:14, outline:'none', fontFamily:'inherit' }} />
              <input placeholder="연락처 *" value={phone} onChange={e => setPhone(e.target.value)}
                style={{ height:46, padding:'0 12px', border:'1.5px solid #EBEBEB', borderRadius:8, fontSize:14, outline:'none', fontFamily:'inherit' }} />
              <div style={{ display:'flex', gap:8 }}>
                <input placeholder="우편번호" value={zipcode} onChange={e => setZipcode(e.target.value)}
                  style={{ flex:1, height:46, padding:'0 12px', border:'1.5px solid #EBEBEB', borderRadius:8, fontSize:14, outline:'none', fontFamily:'inherit' }} />
                <button type="button" onClick={openDaumPostcode}
                  style={{ height:46, padding:'0 14px', border:'1.5px solid var(--color-accent)',
                    borderRadius:8, background:'#fff', color:'var(--color-accent)',
                    fontSize:13, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
                  주소 검색
                </button>
              </div>
              <input placeholder="기본 주소 *" value={addr1} onChange={e => setAddr1(e.target.value)}
                style={{ height:46, padding:'0 12px', border:'1.5px solid #EBEBEB', borderRadius:8, fontSize:14, outline:'none', fontFamily:'inherit' }} />
              <input placeholder="상세 주소" value={addr2} onChange={e => setAddr2(e.target.value)}
                style={{ height:46, padding:'0 12px', border:'1.5px solid #EBEBEB', borderRadius:8, fontSize:14, outline:'none', fontFamily:'inherit' }} />
              <input placeholder="배송 메모 (예: 문 앞에 놓아주세요)" value={memo} onChange={e => setMemo(e.target.value)}
                style={{ height:46, padding:'0 12px', border:'1.5px solid #EBEBEB', borderRadius:8, fontSize:14, outline:'none', fontFamily:'inherit' }} />
            </div>
          </div>

          {/* 결제 수단 */}
          <div style={{ border:'1px solid #EBEBEB', borderRadius:12, padding:'20px', marginBottom:16 }}>
            <h2 style={{ fontSize:16, fontWeight:700, marginBottom:16 }}>결제 수단</h2>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {PAYMENT_METHODS.map(m => (
                <label key={m.value}
                  style={{ padding:'10px 16px', border:`1.5px solid ${payMethod===m.value?'var(--color-accent)':'#EBEBEB'}`,
                    borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:payMethod===m.value?700:500,
                    color:payMethod===m.value?'var(--color-accent)':'#555',
                    background:payMethod===m.value?'var(--color-accent-bg)':'#fff' }}>
                  <input type="radio" name="pay" value={m.value} checked={payMethod===m.value}
                    onChange={() => setPayMethod(m.value)} style={{ display:'none' }} />
                  {m.label}
                </label>
              ))}
            </div>
          </div>

          {/* 주문 상품 */}
          <div style={{ border:'1px solid #EBEBEB', borderRadius:12, padding:'20px' }}>
            <h2 style={{ fontSize:16, fontWeight:700, marginBottom:16 }}>주문 상품 ({items.length})</h2>
            {items.map(i => (
              <div key={i.idx} style={{ display:'flex', gap:10, marginBottom:12 }}>
                <div style={{ width:52, height:52, borderRadius:8, background:'#F7F7F5',
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:22 }}>
                  {i.thumbnail ? <img src={i.thumbnail} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:8 }} /> : '🍑'}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600, lineHeight:1.4 }}>{i.name}</div>
                  <div style={{ fontSize:12, color:'#888' }}>{fmtPrice(i.price)}원 × {i.quantity ?? 1}개</div>
                </div>
                <div style={{ fontSize:14, fontWeight:700 }}>{fmtPrice(i.price*(i.quantity??1))}원</div>
              </div>
            ))}
          </div>
        </div>

        {/* 오른쪽: 결제 요약 */}
        <div style={{ width:300, flexShrink:0, position:'sticky', top:80 }}>
          <div style={{ border:'1px solid #EBEBEB', borderRadius:12, padding:'20px' }}>
            <h2 style={{ fontSize:16, fontWeight:700, marginBottom:16 }}>결제 요약</h2>
            <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #f0f0f0', fontSize:13, color:'#666' }}>
              <span>상품 합계</span><span>{fmtPrice(subtotal)}원</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #f0f0f0', fontSize:13, color:'#666' }}>
              <span>배송비</span><span>{shippingFee === 0 ? '무료' : `${fmtPrice(shippingFee)}원`}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', padding:'14px 0', fontSize:16, fontWeight:800 }}>
              <span>최종 결제금액</span>
              <span style={{ color:'var(--color-accent)' }}>{fmtPrice(total)}원</span>
            </div>
            <button onClick={handleOrder} disabled={loading}
              style={{ width:'100%', padding:'16px', background:'var(--color-accent)', color:'#fff',
                border:'none', borderRadius:8, fontSize:16, fontWeight:700, cursor:'pointer',
                opacity: loading ? 0.7 : 1 }}>
              {loading ? '처리 중...' : `${fmtPrice(total)}원 결제하기`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
