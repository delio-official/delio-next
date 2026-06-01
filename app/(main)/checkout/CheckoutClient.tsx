'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCart, clearCart, type CartItem } from '@/lib/cart';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { getDownloadableCoupons, claimAllPublic } from '@/lib/coupons';
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

  /* 쿠폰 / 적립금 */
  interface UserCoupon { ucId: string; couponId: string; name: string; discount_type: 'percent'|'fixed'; discount_value: number; min_order_amount: number; max_discount_amount: number | null; starts_at: string | null; expires_at: string | null; }
  const [coupons, setCoupons]       = useState<UserCoupon[]>([]);
  const [selCoupon, setSelCoupon]   = useState('');
  const [couponModal, setCouponModal] = useState(false);
  const [modalSel, setModalSel]     = useState(''); // 모달 내 임시 선택
  const [dlCount, setDlCount]       = useState(0);  // 다운가능 쿠폰 수
  const [claiming, setClaiming]     = useState(false);
  const [pointBalance, setPointBalance] = useState(0);
  const [pointUsed, setPointUsed]   = useState(0);

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

  /* 보유 쿠폰 로드 (+최대할인 자동선택) */
  async function loadHeldCoupons(autoSelect: boolean) {
    if (!user) return;
    const { data } = await createClient().from('user_coupons')
      .select('id, coupon_id, expires_at, coupons(name, discount_type, discount_value, min_order_amount, max_discount_amount, is_active, starts_at, expires_at)')
      .eq('user_id', user.id).eq('is_used', false);
    const now = new Date().toISOString();
    const list: UserCoupon[] = (data || [])
      .filter((r: Record<string, unknown>) => {
        const c = r.coupons as Record<string, unknown> | null;
        // 개별 만료일(user_coupons.expires_at) 우선, 없으면 쿠폰 기본 만료일
        const exp = (r.expires_at as string) || (c?.expires_at as string);
        return c?.is_active && (!exp || exp > now);
      })
      .map((r: Record<string, unknown>) => {
        const c = r.coupons as Record<string, unknown>;
        return { ucId: r.id as string, couponId: r.coupon_id as string,
          name: c.name as string, discount_type: c.discount_type as 'percent'|'fixed',
          discount_value: c.discount_value as number, min_order_amount: c.min_order_amount as number,
          max_discount_amount: (c.max_discount_amount as number) ?? null,
          starts_at: (c.starts_at as string) ?? null,
          expires_at: (r.expires_at as string) ?? (c.expires_at as string) ?? null };
      });
    setCoupons(list);
    if (autoSelect) {
      const st = items.reduce((s, i) => s + i.price * (i.quantity ?? 1), 0);
      let best = ''; let bestDisc = 0;
      for (const c of list) {
        if (st < c.min_order_amount) continue;
        let d = c.discount_type === 'percent' ? Math.floor(st * c.discount_value / 100) : c.discount_value;
        if (c.max_discount_amount) d = Math.min(d, c.max_discount_amount);
        if (d > bestDisc) { bestDisc = d; best = c.ucId; }
      }
      if (best) setSelCoupon(best);
    }
  }

  async function refreshDownloadable() {
    if (!user) { setDlCount(0); return; }
    const list = await getDownloadableCoupons(user.id);
    setDlCount(list.length);
  }

  /* 쿠폰 + 포인트 로드 */
  useEffect(() => {
    if (!user) return;
    loadHeldCoupons(true);
    refreshDownloadable();
    createClient().from('profiles').select('point_balance').eq('id', user.id).maybeSingle()
      .then(({ data }) => setPointBalance(data?.point_balance || 0));
  }, [user]); // eslint-disable-line

  /* 쿠폰 다운받기 */
  async function handleClaimCoupons() {
    if (!user || claiming) return;
    setClaiming(true);
    const n = await claimAllPublic(user.id);
    await loadHeldCoupons(false);
    await refreshDownloadable();
    setClaiming(false);
    alert(n > 0 ? `${n}장의 쿠폰을 받았습니다.` : '받을 수 있는 쿠폰이 없습니다.');
  }

  const subtotal = items.reduce((s, i) => s + i.price * (i.quantity ?? 1), 0);

  /* 쿠폰 할인 계산 */
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
            total_amount: subtotal, discount_amount: couponDisc + appliedPoint,
            coupon_discount: couponDisc, point_used: appliedPoint, final_amount: total,
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
            product_name: i.name + (i.options ? ` (${i.options})` : ''), unit_price: i.price,
            quantity: i.quantity ?? 1,
            subtotal: i.price * (i.quantity ?? 1),
            thumbnail_url: i.thumbnail || null,
          }))
        );

        // 쿠폰 사용 처리
        if (coupon) {
          await supabase.from('user_coupons').update({ is_used: true, used_at: new Date().toISOString() }).eq('id', coupon.ucId);
        }
        // 포인트: 사용분 차감 + 적립분 추가
        const earned = Math.floor(total * 0.01);
        const { data: prof } = await supabase.from('profiles').select('point_balance').eq('id', user.id).single();
        if (prof) {
          const newBalance = (prof.point_balance || 0) - appliedPoint + earned;
          await supabase.from('profiles').update({ point_balance: Math.max(0, newBalance) }).eq('id', user.id);
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
            couponDiscount: couponDisc,
            pointUsed:   appliedPoint,
            userCouponId: coupon?.ucId || null,
            recipient, phone, zipcode,
            addr1, addr2, memo,
            payMethod,
            items: items.map(i => ({
              id:        i.id,
              name:      i.name,
              price:     i.price,
              quantity:  i.quantity ?? 1,
              thumbnail: i.thumbnail,
              options:   i.options,
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
                  {i.options && <div style={{ fontSize:12, color:'#888', marginTop:2 }}>ㄴ {i.options}</div>}
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

            {/* 쿠폰 선택 */}
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:12, fontWeight:600, color:'#555', display:'block', marginBottom:6 }}>쿠폰</label>
              <button type="button" onClick={() => { setModalSel(selCoupon); setCouponModal(true); }}
                style={{ width:'100%', minHeight:40, padding:'8px 12px', border:'1.5px solid #E2E8F0', borderRadius:8, fontSize:13, fontFamily:'inherit', outline:'none', background:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, textAlign:'left' }}>
                {coupon ? (
                  <span style={{ fontWeight:600, color:'#1A1A1A' }}>
                    {coupon.name} <span style={{ color:'#CB1D11' }}>−{fmtPrice(couponDisc)}원</span>
                  </span>
                ) : (
                  <span style={{ color:'#94A3B8' }}>쿠폰 선택하기 ({coupons.length}장 보유)</span>
                )}
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>

            {/* 적립금 사용 */}
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:12, fontWeight:600, color:'#555', display:'block', marginBottom:6 }}>
                적립금 <span style={{ color:'#94A3B8', fontWeight:400 }}>(보유 {fmtPrice(pointBalance)}P)</span>
              </label>
              <div style={{ display:'flex', gap:6 }}>
                <input type="number" min={0} max={maxPoint} value={pointUsed || ''}
                  onChange={e => setPointUsed(Math.min(Number(e.target.value) || 0, maxPoint))}
                  placeholder="0"
                  style={{ flex:1, height:40, padding:'0 10px', border:'1.5px solid #E2E8F0', borderRadius:8, fontSize:13, fontFamily:'inherit', outline:'none' }} />
                <button onClick={() => setPointUsed(maxPoint)}
                  style={{ padding:'0 14px', border:'1.5px solid #1A1A1A', background:'#fff', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
                  전액 사용
                </button>
              </div>
            </div>

            <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #f0f0f0', fontSize:13, color:'#666' }}>
              <span>상품 합계</span><span>{fmtPrice(subtotal)}원</span>
            </div>
            {couponDisc > 0 && (
              <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #f0f0f0', fontSize:13, color:'#666' }}>
                <span>쿠폰 할인</span><span style={{ color:'#CB1D11', fontWeight:600 }}>−{fmtPrice(couponDisc)}원</span>
              </div>
            )}
            {appliedPoint > 0 && (
              <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #f0f0f0', fontSize:13, color:'#666' }}>
                <span>적립금 사용</span><span style={{ color:'#CB1D11', fontWeight:600 }}>−{fmtPrice(appliedPoint)}원</span>
              </div>
            )}
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

      {/* 쿠폰 선택 모달 */}
      {couponModal && (
        <div onClick={() => setCouponModal(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'#fff', borderRadius:14, width:'100%', maxWidth:600, maxHeight:'82vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
            {/* 헤더 */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 22px', borderBottom:'1px solid #F0F0F0' }}>
              <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                <span style={{ fontSize:16, fontWeight:700 }}>사용 가능 쿠폰 <span style={{ color:'#CB1D11' }}>{coupons.length}</span>장</span>
                {dlCount > 0 && (
                  <button onClick={handleClaimCoupons} disabled={claiming}
                    style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, fontWeight:600, color:'#1A1A1A', background:'#F3F4F6', border:'none', borderRadius:8, padding:'7px 12px', cursor: claiming ? 'default' : 'pointer' }}>
                    {claiming ? '받는 중...' : <>다운가능 <span style={{ color:'#CB1D11' }}>{dlCount}</span>장 받기</>}
                  </button>
                )}
              </div>
              <button onClick={() => setCouponModal(false)} style={{ background:'none', border:'none', cursor:'pointer', padding:4, lineHeight:0 }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            {/* 리스트 */}
            <div style={{ overflowY:'auto', padding:'18px 22px 22px' }}>
              {/* 적용 안 함 */}
              <button onClick={() => setModalSel('')}
                style={{ width:'100%', textAlign:'center', padding:'12px 16px', marginBottom:14, border:`1.5px solid ${modalSel==='' ? '#1A1A1A' : '#EBEBEB'}`, borderRadius:10, background:'#fff', cursor:'pointer', fontSize:13, fontWeight:600, color: modalSel==='' ? '#1A1A1A' : '#888' }}>
                쿠폰 사용 안 함
              </button>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:12 }}>
                {coupons.map(c => {
                  const usable = subtotal >= c.min_order_amount;
                  const sel = modalSel === c.ucId;
                  const fmtD = (d: Date) => `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
                  const start = c.starts_at ? new Date(c.starts_at) : null;
                  const exp = c.expires_at ? new Date(c.expires_at) : null;
                  // 4번: 기간 표시 / 1번: 무제한 → 상시 사용 가능
                  const periodStr = exp
                    ? `${start ? fmtD(start) : ''} ~ ${fmtD(exp)}`
                    : '상시 사용 가능';
                  // 3번: 만료 임박 D-day (3일 이내)
                  let dday: number | null = null;
                  if (exp) {
                    const t0 = new Date(); t0.setHours(0,0,0,0);
                    const e0 = new Date(exp); e0.setHours(0,0,0,0);
                    dday = Math.round((e0.getTime() - t0.getTime()) / 86400000);
                  }
                  const imminent = dday !== null && dday >= 0 && dday <= 3;
                  const ddayStr = dday === 0 ? '오늘 마감' : `D-${dday}`;
                  return (
                    <button key={c.ucId} disabled={!usable}
                      onClick={() => setModalSel(c.ucId)}
                      style={{ textAlign:'left', padding:'18px 16px', border:`1.5px solid ${sel ? '#1A1A1A' : '#EFEFEF'}`, borderRadius:10,
                        background: usable ? '#fff' : '#FAFAFA', cursor: usable ? 'pointer' : 'not-allowed', opacity: usable ? 1 : 0.55, position:'relative' }}>
                      {/* 우측 상단 뱃지 (만료 임박 + 카운트) */}
                      <div style={{ position:'absolute', top:14, right:14, display:'flex', gap:5 }}>
                        {imminent && (
                          <span style={{ fontSize:10, color:'#fff', background:'#CB1D11', borderRadius:4, padding:'2px 6px', lineHeight:1, fontWeight:700 }}>{ddayStr}</span>
                        )}
                        <span style={{ fontSize:10, color:'#999', border:'1px solid #E2E2E2', borderRadius:4, padding:'2px 6px', lineHeight:1, fontWeight:500 }}>1장</span>
                      </div>
                      <div style={{ fontSize:22, fontWeight:800, color:'#1A1A1A', lineHeight:1.1 }}>
                        {c.discount_type === 'percent' ? `${c.discount_value}%` : `${fmtPrice(c.discount_value)}원`}
                      </div>
                      <div style={{ fontSize:14, fontWeight:600, color:'#1A1A1A', marginTop:6 }}>{c.name}</div>
                      {c.max_discount_amount ? (
                        <div style={{ fontSize:12, color:'#CB1D11', fontWeight:600, marginTop:4 }}>최대 {fmtPrice(c.max_discount_amount)}원 할인</div>
                      ) : null}
                      <div style={{ fontSize:12, color:'#AAA', marginTop:10, lineHeight:1.6 }}>
                        {c.min_order_amount > 0 ? `${fmtPrice(c.min_order_amount)}원 이상 구매` : '0원 이상 구매'}
                        <br/>{periodStr}
                      </div>
                      {!usable && (
                        <div style={{ fontSize:11, color:'#CB1D11', fontWeight:600, marginTop:6 }}>
                          {fmtPrice(c.min_order_amount)}원 이상 구매 시 사용 가능
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              {coupons.length === 0 && (
                <div style={{ textAlign:'center', color:'#AAA', fontSize:13, padding:'30px 0' }}>보유한 쿠폰이 없습니다</div>
              )}
            </div>
            {/* 하단 적용 버튼 */}
            <div style={{ padding:'14px 22px', borderTop:'1px solid #F0F0F0' }}>
              <button onClick={() => { setSelCoupon(modalSel); setCouponModal(false); }}
                style={{ width:'100%', padding:'14px', background:'#1A1A1A', color:'#fff', border:'none', borderRadius:10, fontSize:15, fontWeight:700, cursor:'pointer' }}>
                {modalSel === '' ? '쿠폰 미적용' : '쿠폰 사용하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
