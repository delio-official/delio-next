'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCart, clearCart, type CartItem } from '@/lib/cart';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import '@/styles/checkout.css';

function fmtPrice(n: number) { return n.toLocaleString('ko-KR'); }

/* ── 결제 수단 목록 ── */
const PAYMENT_METHODS = [
  { value: 'card',   label: '신용카드',   payMethod: 'CARD',     easyPay: undefined },
  { value: 'kakao',  label: '카카오페이', payMethod: 'EASY_PAY', easyPay: 'KAKAOPAY' },
  { value: 'naver',  label: '네이버페이', payMethod: 'EASY_PAY', easyPay: 'NAVERPAY' },
  { value: 'toss',   label: '토스페이',   payMethod: 'EASY_PAY', easyPay: 'TOSSPAY'  },
  { value: 'vbank',  label: '무통장입금', payMethod: 'VIRTUAL_ACCOUNT', easyPay: undefined },
] as const;

/* 채널 키 — 현재는 단일 채널 사용 (결제 수단별 계약 후 분리 가능) */
function getChannelKey(): string {
  return process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY || '';
}

export default function CheckoutClient() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems]         = useState<CartItem[]>([]);
  const [recipient, setRecipient] = useState('');
  const [phone, setPhone]         = useState('');
  const [zipcode, setZipcode]     = useState('');
  const [addr1, setAddr1]         = useState('');
  const [addr2, setAddr2]         = useState('');
  const [memo, setMemo]           = useState('');
  const [payMethod, setPayMethod] = useState('card');
  const [loading, setLoading]     = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<{id:string; label:string; recipient:string; phone:string; zipcode:string; address1:string; address2:string|null; is_default:boolean}[]>([]);
  const [showAddrList, setShowAddrList] = useState(false);

  /* 주소 검색 */
  function openDaumPostcode() {
    const open = () => new (window as any).daum.Postcode({
      oncomplete: (d: any) => {
        setZipcode(d.zonecode);
        setAddr1(d.roadAddress || d.jibunAddress);
      },
    }).open();
    if ((window as any).daum?.Postcode) { open(); return; }
    const s = document.createElement('script');
    s.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    s.onload = open;
    document.head.appendChild(s);
  }

  useEffect(() => {
    const cart = getCart();
    if (cart.length === 0) { router.push('/cart'); return; }
    setItems(cart);
  }, [router]);

  useEffect(() => {
    if (!user) return;
    createClient()
      .from('shipping_addresses')
      .select('id, label, recipient, phone, zipcode, address1, address2, is_default')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .then(({ data }) => {
        if (!data?.length) return;
        setSavedAddresses(data);
        const def = data.find(a => a.is_default) || data[0];
        setRecipient(def.recipient);
        setPhone(def.phone);
        setZipcode(def.zipcode || '');
        setAddr1(def.address1);
        setAddr2(def.address2 || '');
      });
  }, [user]); // eslint-disable-line

  const subtotal = items.reduce((s, i) => s + i.price * (i.quantity ?? 1), 0);
  const total    = subtotal;

  /* ── 결제 처리 ── */
  async function handleOrder() {
    if (!user) { router.push('/login'); return; }
    if (!recipient.trim() || !phone.trim() || !addr1.trim()) {
      alert('배송지 정보를 모두 입력해주세요.'); return;
    }

    setLoading(true);

    try {
      const bypass = process.env.NEXT_PUBLIC_PAYMENT_BYPASS === 'true';

      let paymentId: string;

      if (bypass) {
        /* ── 개발 bypass: 결제창 스킵, 클라이언트에서 직접 저장 ── */
        const supabase = createClient();
        const { data: order, error: orderErr } = await supabase
          .from('orders')
          .insert({
            user_id: user.id, status: 'paid',
            total_amount: subtotal, discount_amount: 0,
            coupon_discount: 0, point_used: 0, final_amount: total,
            recipient, phone, zipcode, address1: addr1, address2: addr2,
            delivery_type: 'parcel', delivery_memo: memo,
            payment_method: payMethod, paid_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (orderErr || !order) {
          alert(`주문 저장 실패: ${orderErr?.message || '알 수 없는 오류'}`);
          setLoading(false);
          return;
        }

        await supabase.from('order_items').insert(
          items.map(i => ({
            order_id: order.id, product_id: i.id,
            product_name: i.name, unit_price: i.price,
            quantity: i.quantity ?? 1,
            subtotal: i.price * (i.quantity ?? 1),
            thumbnail_url: i.thumbnail || null,
          }))
        );

        const earned = Math.floor(total * 0.01);
        if (earned > 0) {
          const { data: prof } = await supabase.from('profiles').select('point_balance').eq('id', user.id).single();
          if (prof) await supabase.from('profiles').update({ point_balance: (prof.point_balance || 0) + earned }).eq('id', user.id);
        }

        clearCart();
        // 주문 완료 SMS 발송 (비동기, 실패해도 주문은 정상 처리)
        fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'order_complete',
            phone: phone.trim(),
            recipient: recipient.trim(),
            orderNo: order.order_no,
            amount: String(total),
          }),
        }).catch(() => {});
        router.push(`/order-complete?order=${order.order_no}&point=${Math.floor(total * 0.01)}`);
        return;
      } else {
        /* ── 포트원 결제창 호출 ── */
        const storeId    = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
        const channelKey = getChannelKey();
        if (!storeId || !channelKey) {
          alert('포트원 설정이 없습니다.\n.env.local에 NEXT_PUBLIC_PORTONE_STORE_ID, NEXT_PUBLIC_PORTONE_CHANNEL_KEY를 입력해주세요.');
          setLoading(false);
          return;
        }

        const PortOne = await import('@portone/browser-sdk/v2');
        const selectedMethod = PAYMENT_METHODS.find(m => m.value === payMethod)!;
        const pid = `delio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        const response = await PortOne.requestPayment({
          storeId,
          channelKey,
          paymentId:   pid,
          orderName:   items.length === 1 ? items[0].name : `${items[0].name} 외 ${items.length - 1}건`,
          totalAmount: total,
          currency:    'CURRENCY_KRW',
          payMethod:   selectedMethod.payMethod as any,
          ...(selectedMethod.easyPay && {
            easyPay: { easyPayProvider: selectedMethod.easyPay as any },
          }),
          customer: {
            fullName:    recipient,
            phoneNumber: phone,
            email:       user.email ?? undefined,
          },
          windowType: { pc: 'IFRAME', mobile: 'REDIRECTION' },
        });

        if (!response || (response as any).code !== undefined) {
          alert((response as any)?.message || '결제가 취소되었습니다.');
          setLoading(false);
          return;
        }
        paymentId = (response as any).paymentId;
      }

      /* ── 서버 검증 (bypass면 검증 스킵하고 바로 저장) ── */
      const verifyRes = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId,
          bypass,
          orderData: {
            userId:      user.id,
            subtotal,
            totalAmount: total,
            recipient, phone, zipcode,
            addr1, addr2, memo,
            payMethod,
            items: items.map(i => ({
              id:        i.id,
              name:      i.name,
              price:     i.price,
              quantity:  i.quantity ?? 1,
              thumbnail: i.thumbnail,
            })),
          },
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.success) {
        alert(`주문 처리 실패: ${verifyData.error || '알 수 없는 오류'}`);
        setLoading(false);
        return;
      }

      clearCart();
      router.push(`/order-complete?order=${verifyData.orderNo}&point=${verifyData.earnedPoint}`);

    } catch (err) {
      console.error('결제 오류:', err);
      alert('결제 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
      setLoading(false);
    }
  }

  return (
    <div className="container" style={{ paddingTop:24, paddingBottom:100 }}>
      <h1 style={{ fontSize:22, fontWeight:700, marginBottom:24 }}>주문/결제</h1>

      <div style={{ display:'flex', gap:24, alignItems:'flex-start', flexWrap:'wrap' }}>
        {/* 왼쪽 */}
        <div style={{ flex:1, minWidth:280 }}>

          {/* 배송지 */}
          <div style={{ border:'1px solid #EBEBEB', borderRadius:12, padding:'20px', marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h2 style={{ fontSize:16, fontWeight:700 }}>배송지 정보</h2>
              {savedAddresses.length > 0 && (
                <button type="button" onClick={() => setShowAddrList(v => !v)}
                  style={{ fontSize:13, fontWeight:600, color:'#2563EB', background:'none', border:'1.5px solid #DBEAFE', borderRadius:8, padding:'5px 12px', cursor:'pointer' }}>
                  배송지 선택 ({savedAddresses.length})
                </button>
              )}
            </div>

            {/* 저장된 배송지 목록 */}
            {showAddrList && savedAddresses.length > 0 && (
              <div style={{ marginBottom:16, border:'1px solid #E2E8F0', borderRadius:10, overflow:'hidden' }}>
                {savedAddresses.map(a => (
                  <div key={a.id}
                    onClick={() => {
                      setRecipient(a.recipient);
                      setPhone(a.phone);
                      setZipcode(a.zipcode || '');
                      setAddr1(a.address1);
                      setAddr2(a.address2 || '');
                      setShowAddrList(false);
                    }}
                    style={{ padding:'12px 16px', borderBottom:'1px solid #F1F5F9', cursor:'pointer', background:'#fff',
                      transition:'background .1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                      <span style={{ fontSize:13, fontWeight:700 }}>{a.recipient}</span>
                      {a.is_default && <span style={{ fontSize:10, fontWeight:700, background:'#1A1A1A', color:'#fff', borderRadius:4, padding:'1px 6px' }}>기본</span>}
                      {a.label && <span style={{ fontSize:11, color:'#94A3B8' }}>{a.label}</span>}
                    </div>
                    <div style={{ fontSize:12, color:'#64748B' }}>{a.address1} {a.address2 || ''}</div>
                    <div style={{ fontSize:12, color:'#94A3B8', marginTop:1 }}>{a.phone}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <input placeholder="받는 분 이름 *" value={recipient} onChange={e => setRecipient(e.target.value)}
                style={{ height:46, padding:'0 12px', border:'1.5px solid #EBEBEB', borderRadius:8, fontSize:14, outline:'none', fontFamily:'inherit' }} />
              <input placeholder="연락처 *" value={phone} onChange={e => setPhone(e.target.value)}
                style={{ height:46, padding:'0 12px', border:'1.5px solid #EBEBEB', borderRadius:8, fontSize:14, outline:'none', fontFamily:'inherit' }} />
              <div style={{ display:'flex', gap:8 }}>
                <input placeholder="우편번호" value={zipcode} readOnly
                  style={{ flex:1, height:46, padding:'0 12px', border:'1.5px solid #EBEBEB', borderRadius:8, fontSize:14, outline:'none', fontFamily:'inherit', background:'#FAFAFA' }} />
                <button type="button" onClick={openDaumPostcode}
                  style={{ height:46, padding:'0 14px', border:'1.5px solid #1A1A1A',
                    borderRadius:8, background:'#fff', color:'#1A1A1A',
                    fontSize:13, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
                  주소 검색
                </button>
              </div>
              <input placeholder="기본 주소 *" value={addr1} readOnly
                style={{ height:46, padding:'0 12px', border:'1.5px solid #EBEBEB', borderRadius:8, fontSize:14, outline:'none', fontFamily:'inherit', background:'#FAFAFA' }} />
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
                  style={{ padding:'10px 16px',
                    border:`1.5px solid ${payMethod===m.value?'#1A1A1A':'#EBEBEB'}`,
                    borderRadius:8, cursor:'pointer', fontSize:13,
                    fontWeight:payMethod===m.value?700:500,
                    color:payMethod===m.value?'#1A1A1A':'#555',
                    background:payMethod===m.value?'#F5F5F5':'#fff' }}>
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
                  {i.thumbnail
                    ? <img src={i.thumbnail} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:8 }} />
                    : '🍑'}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600, lineHeight:1.4 }}>{i.name}</div>
                  <div style={{ fontSize:12, color:'#888' }}>{fmtPrice(i.price)}원 × {i.quantity??1}개</div>
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
              <span>배송비</span><span style={{ color:'#2D7A4D', fontWeight:600 }}>무료</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #f0f0f0', fontSize:13, color:'#666' }}>
              <span>포인트 적립 예정</span>
              <span style={{ color:'#1A1A1A', fontWeight:600 }}>+{fmtPrice(Math.floor(total*0.01))}P</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', padding:'14px 0', fontSize:16, fontWeight:800 }}>
              <span>최종 결제금액</span>
              <span>{fmtPrice(total)}원</span>
            </div>
            <button onClick={handleOrder} disabled={loading}
              style={{ width:'100%', padding:'16px', background: loading ? '#ccc' : '#1A1A1A',
                color:'#fff', border:'none', borderRadius:8, fontSize:16, fontWeight:700,
                cursor: loading ? 'not-allowed' : 'pointer', transition:'background .2s' }}>
              {loading ? '결제창 열리는 중...' : `${fmtPrice(total)}원 결제하기`}
            </button>
            <p style={{ fontSize:11, color:'#AAA', textAlign:'center', marginTop:10, lineHeight:1.6 }}>
              결제 완료 후 결제금액의 1%가<br />포인트로 적립됩니다
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
