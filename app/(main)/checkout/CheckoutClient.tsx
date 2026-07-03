'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getCart, clearCart, type CartItem } from '@/lib/cart';
import { gaBeginCheckout, gaPurchase } from '@/lib/gtag';
import { getOrderPrefs, setOrderPrefs, clearOrderPrefs } from '@/lib/orderPrefs';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { getDownloadableCoupons, claimAllPublic } from '@/lib/coupons';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import '@/styles/checkout.css';

function fmtPrice(n: number) { return n.toLocaleString('ko-KR'); }

/* 접이식 섹션 (모듈 레벨 — 입력 포커스 유지) */
function Section({ title, sk, open, onToggle, right, children }: {
  title: string; sk: string; open: boolean; onToggle: (k: string) => void;
  right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div style={{ background: '#fff', marginBottom: 10, borderRadius: 0 }}>
      <button type="button" onClick={() => onToggle(sk)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '18px 18px 14px' }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#1A1A1A' }}>{title}</span>
          {right}
        </span>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#999" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'none' : 'rotate(180deg)', transition: 'transform .2s' }}>
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>
      {open && <div style={{ padding: '0 18px 20px' }}>{children}</div>}
    </div>
  );
}

/* ── 결제 수단 목록 ──
   enabled:false 인 수단은 주문서에 노출하지 않음.
   간편결제(카카오/네이버/토스)는 각 PG 심사·승인 완료 시 true 로 전환.
   (미승인 수단을 임의 노출하면 PG 입점 심사에서 반려됨) */
const PAYMENT_METHODS = [
  { value: 'card',   label: '신용카드',   payMethod: 'CARD',     easyPay: undefined,  enabled: true  },
  { value: 'kakao',  label: '카카오페이', payMethod: 'EASY_PAY', easyPay: 'KAKAOPAY', enabled: false },
  { value: 'naver',  label: '네이버페이', payMethod: 'EASY_PAY', easyPay: 'NAVERPAY', enabled: false },
  { value: 'toss',   label: '토스페이',   payMethod: 'EASY_PAY', easyPay: 'TOSSPAY',  enabled: false },
  { value: 'vbank',  label: '무통장입금', payMethod: 'VIRTUAL_ACCOUNT', easyPay: undefined, enabled: true  },
] as const;
const VISIBLE_PAYMENT_METHODS = PAYMENT_METHODS.filter(m => m.enabled);

/* 채널 키 — 결제수단별 분리. 카카오페이는 전용 채널(실연동) 사용.
   채널키는 공개키라 클라 노출 무방(결제 검증은 서버 시크릿으로 수행). */
const KAKAO_CHANNEL_KEY = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_KAKAO || 'channel-key-f7a8c262-8438-4a74-9a68-a532cbb1a2f4';
function getChannelKey(method?: string): string {
  if (method === 'kakao') return KAKAO_CHANNEL_KEY;
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
  const [isMobile, setIsMobile]   = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check, { passive: true });
    return () => window.removeEventListener('resize', check);
  }, []);
  interface Addr { id:string; label:string; recipient:string; phone:string; zipcode:string; address1:string; address2:string|null; is_default:boolean; created_at?:string; }
  const [savedAddresses, setSavedAddresses] = useState<Addr[]>([]);
  const [selectedAddrId, setSelectedAddrId] = useState<string | null>(null);
  /* 주문하시는 분(계정) */
  const [ordererName, setOrdererName] = useState('');
  const [ordererPhone, setOrdererPhone] = useState('');
  const [ordererEmail, setOrdererEmail] = useState('');
  const [payAgree, setPayAgree] = useState(false);
  /* 섹션 접기/펼치기 (기본 모두 펼침) */
  const [openSec, setOpenSec] = useState<Record<string, boolean>>({});
  const isOpen = (k: string) => openSec[k] !== false;
  const toggleSec = (k: string) => setOpenSec(p => ({ ...p, [k]: p[k] === false ? true : false }));
  /* 배송지 모달 */
  const EMPTY_ADDR = { label:'', recipient:'', phone:'', zipcode:'', address1:'', address2:'', is_default:false };
  const [addrListModal, setAddrListModal] = useState(false);
  const [addrFormModal, setAddrFormModal] = useState(false);
  const [addrEditing, setAddrEditing] = useState<Addr | null>(null);
  const [addrForm, setAddrForm] = useState({ ...EMPTY_ADDR });
  const [addrSort, setAddrSort] = useState<'recent_use'|'recent_reg'|'name'>('recent_use');
  const [addrSortOpen, setAddrSortOpen] = useState(false);

  /* 쿠폰 / 적립금 */
  interface UserCoupon { ucId: string; couponId: string; name: string; discount_type: 'percent'|'fixed'; discount_value: number; min_order_amount: number; max_discount_amount: number | null; starts_at: string | null; expires_at: string | null; }
  const [coupons, setCoupons]       = useState<UserCoupon[]>([]);
  const [selCoupon, setSelCoupon]   = useState('');
  const [couponModal, setCouponModal] = useState(false);
  /* 모달 열림 동안 뒷 배경 스크롤 잠금 */
  useBodyScrollLock(addrListModal || addrFormModal || couponModal);
  const [modalSel, setModalSel]     = useState(''); // 모달 내 임시 선택
  const [dlCount, setDlCount]       = useState(0);  // 다운가능 쿠폰 수
  const [claiming, setClaiming]     = useState(false);
  const [pointBalance, setPointBalance] = useState(0);
  const [pointUsed, setPointUsed]   = useState(0);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  /* 배송지 모달 폼용 주소검색 */
  function openAddrFormPost() {
    const open = () => new (window as any).daum.Postcode({
      oncomplete: (d: any) => setAddrForm(f => ({ ...f, zipcode: d.zonecode, address1: d.roadAddress || d.jibunAddress })),
    }).open();
    if ((window as any).daum?.Postcode) { open(); return; }
    const s = document.createElement('script');
    s.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    s.onload = open;
    document.head.appendChild(s);
  }
  function openAddAddr() { setAddrEditing(null); setAddrForm({ ...EMPTY_ADDR }); setAddrFormModal(true); }
  function openEditAddr(a: Addr) { setAddrEditing(a); setAddrForm({ label:a.label, recipient:a.recipient, phone:a.phone, zipcode:a.zipcode, address1:a.address1, address2:a.address2 || '', is_default:a.is_default }); setAddrFormModal(true); }
  async function saveAddr() {
    if (!addrForm.recipient.trim() || !addrForm.phone.trim() || !addrForm.address1.trim()) { alert('필수 항목을 입력해주세요.'); return; }
    const supabase = createClient();
    const makeDefault = addrForm.is_default || savedAddresses.length === 0;
    const payload = { label:addrForm.label, recipient:addrForm.recipient, phone:addrForm.phone, zipcode:addrForm.zipcode, address1:addrForm.address1, address2:addrForm.address2 };
    if (makeDefault) await supabase.from('shipping_addresses').update({ is_default:false }).eq('user_id', user!.id);
    let savedId = addrEditing?.id;
    if (addrEditing) {
      await supabase.from('shipping_addresses').update({ ...payload, is_default: makeDefault }).eq('id', addrEditing.id);
    } else {
      const { data } = await supabase.from('shipping_addresses').insert({ ...payload, user_id:user!.id, is_default:makeDefault }).select('id').single();
      savedId = data?.id as string | undefined;
    }
    setAddrFormModal(false); setAddrEditing(null); setAddrForm({ ...EMPTY_ADDR });
    await loadAddresses(savedId);
  }
  async function deleteAddr(id: string) {
    if (!confirm('이 배송지를 삭제하시겠습니까?')) return;
    await createClient().from('shipping_addresses').delete().eq('id', id);
    if (selectedAddrId === id) setSelectedAddrId(null);
    await loadAddresses();
  }

  useEffect(() => {
    const cart = getCart();
    if (cart.length === 0) { router.push('/cart'); return; }
    setItems(cart);
  }, [router]);

  /* 배송지 선택 → 주문 배송정보 반영 */
  function applyAddr(a: Addr) {
    setSelectedAddrId(a.id);
    setRecipient(a.recipient);
    setPhone(a.phone);
    setZipcode(a.zipcode || '');
    setAddr1(a.address1);
    setAddr2(a.address2 || '');
  }

  async function loadAddresses(selectId?: string) {
    if (!user) return;
    const { data } = await createClient()
      .from('shipping_addresses')
      .select('id, label, recipient, phone, zipcode, address1, address2, is_default, created_at')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    const list = (data as Addr[]) || [];
    setSavedAddresses(list);
    if (list.length) {
      const target = (selectId && list.find(a => a.id === selectId)) || list.find(a => a.id === selectedAddrId) || list.find(a => a.is_default) || list[0];
      applyAddr(target);
    }
  }

  useEffect(() => {
    if (!user) return;
    loadAddresses();
    // 주문하시는 분(계정 정보)
    createClient().from('profiles').select('name, phone').eq('id', user.id).maybeSingle()
      .then(({ data }) => { setOrdererName(data?.name || ''); setOrdererPhone(data?.phone || ''); });
    setOrdererEmail(prev => prev || user.email || '');
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
    // 장바구니에서 고른 쿠폰(prefs)이 보유 목록에 있으면 그걸 우선 적용
    const prefs = getOrderPrefs();
    if (prefs.couponUcId && list.some(c => c.ucId === prefs.couponUcId)) {
      setSelCoupon(prefs.couponUcId);
    } else if (autoSelect) {
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

  /* 쿠폰 + 포인트 로드 (prefs 복원 끝난 뒤에만 동기화 허용) */
  useEffect(() => {
    if (!user) return;
    (async () => {
      await loadHeldCoupons(true);
      refreshDownloadable();
      const { data } = await createClient().from('profiles').select('point_balance').eq('id', user.id).maybeSingle();
      const bal = data?.point_balance || 0;
      setPointBalance(bal);
      // 장바구니에서 입력한 적립금(prefs) 복원
      const prefs = getOrderPrefs();
      if (prefs.pointUsed > 0) setPointUsed(Math.min(prefs.pointUsed, bal));
      // 복원이 모두 끝난 뒤에야 동기화 허용 → 마운트 시 빈 값으로 prefs 덮어쓰기 방지
      setPrefsLoaded(true);
    })();
  }, [user]); // eslint-disable-line

  /* 체크아웃에서 바꾼 선택도 prefs에 동기화 (장바구니로 돌아가도 유지) */
  useEffect(() => {
    if (!prefsLoaded) return;
    setOrderPrefs({ couponUcId: selCoupon, pointUsed });
  }, [selCoupon, pointUsed, prefsLoaded]);

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

  /* 최대할인 쿠폰 ID 계산 (자동적용 체크박스용) */
  let bestCouponId = ''; let bestCouponDisc = 0;
  for (const c of coupons) {
    if (subtotal < c.min_order_amount) continue;
    let d = c.discount_type === 'percent' ? Math.floor(subtotal * c.discount_value / 100) : c.discount_value;
    if (c.max_discount_amount) d = Math.min(d, c.max_discount_amount);
    if (d > bestCouponDisc) { bestCouponDisc = d; bestCouponId = c.ucId; }
  }

  /* GA4: 결제 시작 (장바구니 항목 로드되면 1회) */
  const beganCheckoutRef = useRef(false);
  const submittingRef = useRef(false); // 결제 이중 제출 동기 락(state 지연 없이 즉시 차단)
  useEffect(() => {
    if (!beganCheckoutRef.current && items.length > 0) {
      beganCheckoutRef.current = true;
      gaBeginCheckout(items.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity ?? 1 })), subtotal);
    }
  }, [items, subtotal]);

  /* ── 결제 처리 ── */
  async function handleOrder() {
    if (!user) { router.push('/login'); return; }
    if (!recipient.trim() || !phone.trim() || !addr1.trim()) {
      alert('배송지 정보를 모두 입력해주세요.'); return;
    }

    /* 총액 검증 — 0/NaN이 결제창에 넘어가 400 나는 것 방지 */
    if (!Number.isFinite(subtotal) || subtotal <= 0) {
      alert('주문 금액을 확인해주세요. 장바구니를 다시 확인해 주세요.');
      return;
    }

    /* 이중 제출 방지 — state는 리렌더 후 반영되어 빠른 더블클릭을 못 막으므로 ref로 즉시 잠금.
       (검증 실패 return은 이 락 위에서 처리 → 락이 걸린 채 남지 않음) */
    if (submittingRef.current) return;
    submittingRef.current = true;

    setLoading(true);

    try {
      const bypass = process.env.NEXT_PUBLIC_PAYMENT_BYPASS === 'true';

      let paymentId: string;

      /* 결제 전/검증 공용 주문 데이터 */
      const orderData = {
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
          stockOptionId: i.stockOptionId,
        })),
      };

      /* total이 0(적립금·쿠폰으로 전액 차감)이면 결제창 없이 바로 주문 완료 */
      if (bypass || total <= 0) {
        /* ── 개발 bypass: 결제창 스킵, 클라이언트에서 직접 저장 ── */
        const supabase = createClient();
        const { data: order, error: orderErr } = await supabase
          .from('orders')
          .insert({
            user_id: user.id, status: 'paid',
            total_amount: subtotal, discount_amount: couponDisc + appliedPoint,
            coupon_discount: couponDisc, point_used: appliedPoint, final_amount: total,
            used_coupon_id: coupon?.ucId || null, earned_point: Math.floor(total * 0.01),
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

        /* 재고 차감(동시성 안전). 부족 시 주문 롤백 + 차단 (전액할인이라 결제취소 불필요) */
        {
          const stockItems = items.map(i => ({ optionId: i.stockOptionId || null, qty: i.quantity ?? 1 }));
          const { error: decErr } = await supabase.rpc('decrement_stocks', { p_items: stockItems });
          if (decErr) {
            await supabase.from('orders').delete().eq('id', order.id);
            alert('죄송합니다. 방금 재고가 소진되어 주문할 수 없습니다.');
            setLoading(false);
            return;
          }
        }

        await supabase.from('order_items').insert(
          items.map(i => ({
            order_id: order.id, product_id: i.id,
            product_name: i.name + (i.options ? ` (${i.options})` : ''), unit_price: i.price,
            option_label: i.options || null, option_id: i.stockOptionId || null,
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
          /* 포인트 원장(point_logs) 기록 */
          try {
            const logs: { user_id: string; amount: number; description: string }[] = [];
            if (appliedPoint > 0) logs.push({ user_id: user.id, amount: -appliedPoint, description: '주문 사용' });
            if (earned > 0)       logs.push({ user_id: user.id, amount: earned,        description: '구매 적립' });
            if (logs.length) await supabase.from('point_logs').insert(logs);
          } catch { /* 원장 기록 실패는 무시 */ }
        }

        clearCart(); clearOrderPrefs();
        // 주문 완료 알림톡 발송 (비동기, 실패해도 주문은 정상 처리)
        fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'order_complete',
            phone: phone.trim(),
            recipient: recipient.trim(),
            orderNo: order.order_no,
            orderDate: new Date().toLocaleDateString('ko-KR'),
            productName: items[0].name + (items.length > 1 ? ` 외 ${items.length - 1}건` : ''),
            amount: `${total.toLocaleString()}원`,
          }),
        }).catch(() => {});
        gaPurchase(order.order_no, items.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity ?? 1 })), total);
        router.push(`/order-complete?order=${order.order_no}&point=${Math.floor(total * 0.01)}`);
        return;
      } else if (payMethod === 'vbank') {
        /* ── 무통장입금: 결제창 없이 '입금대기(pending)' 주문 생성 + 계좌 안내 (관리자 수동 입금확인) ── */
        const supabase = createClient();
        const { data: order, error: orderErr } = await supabase
          .from('orders')
          .insert({
            user_id: user.id, status: 'pending',
            total_amount: subtotal, discount_amount: couponDisc + appliedPoint,
            coupon_discount: couponDisc, point_used: appliedPoint, final_amount: total,
            used_coupon_id: coupon?.ucId || null, earned_point: Math.floor(total * 0.01),
            recipient, phone, zipcode, address1: addr1, address2: addr2,
            delivery_type: 'parcel', delivery_memo: memo,
            payment_method: 'vbank', paid_at: null,
          })
          .select()
          .single();
        if (orderErr || !order) { alert(`주문 저장 실패: ${orderErr?.message || '알 수 없는 오류'}`); setLoading(false); return; }
        /* 재고 차감(무통장도 주문 즉시 선점). 부족 시 주문 롤백 + 차단 */
        {
          const stockItems = items.map(i => ({ optionId: i.stockOptionId || null, qty: i.quantity ?? 1 }));
          const { error: decErr } = await supabase.rpc('decrement_stocks', { p_items: stockItems });
          if (decErr) {
            await supabase.from('orders').delete().eq('id', order.id);
            alert('죄송합니다. 방금 재고가 소진되어 주문할 수 없습니다.');
            setLoading(false);
            return;
          }
        }
        await supabase.from('order_items').insert(
          items.map(i => ({
            order_id: order.id, product_id: i.id,
            product_name: i.name + (i.options ? ` (${i.options})` : ''), unit_price: i.price,
            option_label: i.options || null, option_id: i.stockOptionId || null,
            quantity: i.quantity ?? 1, subtotal: i.price * (i.quantity ?? 1),
            thumbnail_url: i.thumbnail || null,
          }))
        );
        // 쿠폰·포인트 선점 (입금 미완료 취소 시 기존 취소 로직이 복원). 적립은 입금확인(결제완료) 시 지급.
        if (coupon) await supabase.from('user_coupons').update({ is_used: true, used_at: new Date().toISOString() }).eq('id', coupon.ucId);
        if (appliedPoint > 0) {
          const { data: prof } = await supabase.from('profiles').select('point_balance').eq('id', user.id).single();
          if (prof) {
            await supabase.from('profiles').update({ point_balance: Math.max(0, (prof.point_balance || 0) - appliedPoint) }).eq('id', user.id);
            try { await supabase.from('point_logs').insert([{ user_id: user.id, amount: -appliedPoint, description: '주문 사용' }]); } catch { /* 무시 */ }
          }
        }
        clearCart(); clearOrderPrefs();
        router.push(`/order-complete?order=${order.order_no}&vbank=1`);
        return;
      } else {
        /* ── 포트원 결제창 호출 ── */
        const storeId    = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
        const channelKey = getChannelKey(payMethod);
        if (!storeId || !channelKey) {
          alert('포트원 설정이 없습니다.\n.env.local에 NEXT_PUBLIC_PORTONE_STORE_ID, NEXT_PUBLIC_PORTONE_CHANNEL_KEY를 입력해주세요.');
          setLoading(false);
          return;
        }

        const PortOne = await import('@portone/browser-sdk/v2');
        const selectedMethod = PAYMENT_METHODS.find(m => m.value === payMethod)!;
        const pid = `delio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        /* 결제창 호출 전, 주문 데이터를 서버에 임시 저장 (웹훅이 브라우저 없이도 주문 확정 가능) */
        await fetch('/api/payment/prepare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId: pid, orderData }),
        }).catch(() => {});

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
            ...(recipient.trim() ? { fullName: recipient.trim() } : {}),
            ...(phone.trim()     ? { phoneNumber: phone.trim() } : {}),
            ...(user.email       ? { email: user.email } : {}),
          },
          windowType: { pc: 'IFRAME', mobile: 'REDIRECTION' },
          // 모바일 REDIRECTION: 결제 후 이 URL로 복귀 → 핸들러가 주문 확정
          redirectUrl: `${window.location.origin}/payment/redirect`,
        });

        if (!response || (response as any).code !== undefined) {
          const failMsg = (response as any)?.message || '';
          alert(failMsg || '결제가 취소되었습니다.');
          /* 결제 실패 알림톡 — 단순 사용자 취소는 제외 */
          const isCancel = !failMsg || /취소|cancel/i.test(failMsg);
          if (!isCancel && phone.trim()) {
            fetch('/api/notify', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'payment_failed', phone: phone.trim(),
                recipient: recipient.trim() || '고객', reason: failMsg, amount: `${total.toLocaleString()}원` }),
            }).catch(() => {});
          }
          setLoading(false);
          return;
        }
        paymentId = (response as any).paymentId;
      }

      /* ── 서버 검증 (복귀 시) — 공용 orderData 사용 ── */
      const verifyRes = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId, orderData }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.success) {
        alert(`주문 처리 실패: ${verifyData.error || '알 수 없는 오류'}`);
        setLoading(false);
        return;
      }

      clearCart(); clearOrderPrefs();
      gaPurchase(verifyData.orderNo, items.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity ?? 1 })), total);
      router.push(`/order-complete?order=${verifyData.orderNo}&point=${verifyData.earnedPoint}`);

    } catch (err) {
      console.error('결제 오류:', err);
      alert('결제 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
      setLoading(false);
    } finally {
      /* 락 해제 — 실패/취소 시 재시도 허용. 성공 경로는 clearCart+이동되어 재진입해도 금액검증에서 막힘 */
      submittingRef.current = false;
    }
  }

  return (
    <div className="container" style={{ paddingTop:24, paddingBottom:100 }}>
      <h1 style={{ fontSize:22, fontWeight:700, marginBottom:24 }}>주문/결제</h1>

      {(() => {
        const inS: React.CSSProperties = { width:'100%', height:46, padding:'0 14px', border:'1.5px solid #E2E8F0', borderRadius:8, fontSize:14, fontFamily:'inherit', outline:'none', boxSizing:'border-box' };
        const selAddr = savedAddresses.find(a => a.id === selectedAddrId);
        const totalDisc = couponDisc + appliedPoint;
        return (
        <div style={{ background:'#F1F1F1', margin:'0 -16px' }}>

          {/* ① 주문상품 */}
          <Section title="주문상품" sk="items" open={isOpen('items')} onToggle={toggleSec}
            right={<span style={{ fontSize:14, color:'#888', fontWeight:600 }}>{items.length}건</span>}>
            <div style={{ fontSize:14, fontWeight:700, color:'#555', marginBottom:8 }}>일반 배송</div>
            {items.map(i => (
              <div key={i.idx} style={{ display:'flex', gap:12, alignItems:'center', padding:'10px 0' }}>
                <div style={{ width:64, height:64, borderRadius:8, background:'#F7F7F5', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:28, overflow:'hidden', border:'1px solid #EEE' }}>
                  {i.thumbnail ? <img src={i.thumbnail} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : '🍑'}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:600, lineHeight:1.4 }}>{i.name}</div>
                  {i.options && <div style={{ fontSize:12, color:'#888', marginTop:2 }}>ㄴ {i.options}</div>}
                  <div style={{ fontSize:14, color:'#555', marginTop:4, fontWeight:600 }}>{fmtPrice(i.price*(i.quantity??1))}원 / {i.quantity??1}개</div>
                </div>
              </div>
            ))}
          </Section>

          {/* ② 주문자 */}
          <Section title="주문자" sk="orderer" open={isOpen('orderer')} onToggle={toggleSec}>
            <input value={ordererName} onChange={e => setOrdererName(e.target.value)} placeholder="주문자 이름" style={inS} />
            <input value={ordererPhone} onChange={e => setOrdererPhone(e.target.value.replace(/[^0-9-]/g,''))} placeholder="연락처" inputMode="tel" style={{ ...inS, marginTop:10 }} />
            <input value={ordererEmail} onChange={e => setOrdererEmail(e.target.value)} placeholder="이메일" inputMode="email" style={{ ...inS, marginTop:10 }} />
            <p style={{ fontSize:12, color:'#94A3B8', margin:'10px 0 0' }}>카카오 알림톡이 발송되지 않을 경우 입력하신 이메일로 주문 안내를 보내드려요.</p>
          </Section>

          {/* ③ 배송지 */}
          <Section title="배송지" sk="addr" open={isOpen('addr')} onToggle={toggleSec}>
            {selAddr ? (
              <div style={{ border:'1px solid #E8E8E8', borderRadius:10, padding:'14px 16px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:15, fontWeight:700 }}>{selAddr.label || '배송지'}</span>
                    {selAddr.is_default && <span style={{ fontSize:12, color:'#888', border:'1px solid #DADADA', borderRadius:4, padding:'2px 7px' }}>기본배송지</span>}
                  </div>
                  <button type="button" onClick={() => setAddrListModal(true)}
                    style={{ background:'none', border:'none', fontSize:14, color:'#555', textDecoration:'underline', cursor:'pointer', fontFamily:'inherit' }}>변경</button>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:12, fontSize:15, color:'#555', marginBottom:6 }}>
                  <span>{selAddr.recipient}  {selAddr.phone}</span>
                </div>
                <div style={{ fontSize:15, color:'#555', lineHeight:1.5 }}>
                  {selAddr.zipcode && <span style={{ color:'#aaa' }}>[{selAddr.zipcode}] </span>}{selAddr.address1}
                  {selAddr.address2 && <div>{selAddr.address2}</div>}
                </div>
              </div>
            ) : (
              <p style={{ fontSize:14, color:'#94A3B8', padding:'4px 0 12px' }}>배송지를 추가해주세요.</p>
            )}
            <button type="button" onClick={openAddAddr}
              style={{ width:'100%', marginTop:10, padding:'12px', background:'#fff', color:'#1A1A1A', border:'1.5px solid #DADADA', borderRadius:8, fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              + 배송지 {selAddr ? '추가' : '등록'}
            </button>
          </Section>

          {/* ④ 배송요청사항 */}
          <Section title="배송요청사항" sk="memo" open={isOpen('memo')} onToggle={toggleSec}>
            <select value={memo} onChange={e => setMemo(e.target.value)}
              style={{ width:'100%', height:46, padding:'0 40px 0 12px', border:'1.5px solid #EBEBEB', borderRadius:8, fontSize:14, outline:'none', fontFamily:'inherit', color: memo ? '#1A1A1A' : '#94A3B8',
                appearance:'none', WebkitAppearance:'none', MozAppearance:'none', backgroundColor:'#fff',
                backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
                backgroundRepeat:'no-repeat', backgroundPosition:'right 16px center' }}>
              <option value="">배송 요청사항을 선택해주세요</option>
              <option value="문 앞에 놓아주세요">문 앞에 놓아주세요</option>
              <option value="부재 시 문 앞에 놓아주세요">부재 시 문 앞에 놓아주세요</option>
              <option value="경비실에 맡겨주세요">경비실에 맡겨주세요</option>
              <option value="배송 전 연락 바랍니다">배송 전 연락 바랍니다</option>
              <option value="파손 주의 부탁드립니다">파손 주의 부탁드립니다</option>
            </select>
          </Section>

          {/* ⑤ 할인혜택 */}
          <Section title="할인혜택" sk="discount" open={isOpen('discount')} onToggle={toggleSec}>
            <label style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14, cursor: bestCouponId ? 'pointer' : 'not-allowed', opacity: bestCouponId ? 1 : 0.45 }}>
              <input type="checkbox" disabled={!bestCouponId}
                checked={!!bestCouponId && selCoupon === bestCouponId}
                onChange={e => setSelCoupon(e.target.checked ? bestCouponId : '')}
                style={{ width:16, height:16, accentColor:'#1A1A1A' }} />
              <span style={{ fontSize:14, color:'#333', fontWeight:600 }}>최대할인 자동적용</span>
            </label>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
              <span style={{ fontSize:14, fontWeight:600 }}>장바구니 쿠폰</span>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:14, fontWeight:700, color: couponDisc > 0 ? '#CB1D11' : '#888' }}>
                  {coupon ? `−${fmtPrice(couponDisc)}원` : `${coupons.length}장`}
                </span>
                <button type="button" onClick={() => { setModalSel(selCoupon); setCouponModal(true); }}
                  style={{ padding:'8px 14px', background:'#1A1A1A', color:'#fff', border:'none', borderRadius:6, fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                  쿠폰선택
                </button>
              </div>
            </div>
          </Section>

          {/* ⑥ 포인트 */}
          <Section title="포인트" sk="point" open={isOpen('point')} onToggle={toggleSec}>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <input type="number" min={0} max={maxPoint} value={pointUsed || ''}
                onChange={e => setPointUsed(Math.min(Number(e.target.value) || 0, maxPoint))} placeholder="0"
                style={{ ...inS, flex:1, textAlign:'right' }} />
              <button onClick={() => setPointUsed(maxPoint)}
                style={{ padding:'0 16px', height:46, border:'1.5px solid #1A1A1A', background:'#fff', borderRadius:8, fontSize:14, fontWeight:700, color:'#1A1A1A', cursor:'pointer', whiteSpace:'nowrap' }}>전액사용</button>
            </div>
            <p style={{ fontSize:12, color:'#94A3B8', margin:'8px 0 0', textAlign:'right' }}>사용 가능 {fmtPrice(pointBalance)}원</p>
          </Section>

          {/* ⑦ 결제 예정금액 */}
          <Section title="결제 예정금액" sk="amount" open={isOpen('amount')} onToggle={toggleSec}>
            <div style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', fontSize:14, color:'#444' }}>
              <span>상품금액</span><span>{fmtPrice(subtotal)}원</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', fontSize:14, color:'#444' }}>
              <span>배송비</span><span style={{ color:'#2D7A4D', fontWeight:600 }}>무료</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', fontSize:14, color:'#444' }}>
              <span>할인금액</span><span style={{ color: totalDisc > 0 ? '#CB1D11' : '#888', fontWeight:600 }}>{totalDisc > 0 ? `- ${fmtPrice(totalDisc)}원` : '0원'}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 0 4px', marginTop:6, borderTop:'1.5px solid #1A1A1A', fontWeight:800 }}>
              <span style={{ fontSize:15 }}>총 결제 예정금액</span><span style={{ fontSize:18 }}>{fmtPrice(total)}원</span>
            </div>
            <div style={{ fontSize:12, color:'#888', textAlign:'right', marginTop:4 }}>적립 예정 +{fmtPrice(Math.floor(total*0.01))}P</div>
          </Section>

          {/* ⑧ 결제수단 */}
          <Section title="결제수단" sk="pay" open={isOpen('pay')} onToggle={toggleSec}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10 }}>
              {VISIBLE_PAYMENT_METHODS.map(m => (
                <button type="button" key={m.value} onClick={() => setPayMethod(m.value)}
                  style={{ padding:'16px 8px', borderRadius:8, cursor:'pointer', fontSize:14, fontFamily:'inherit',
                    border:`1.5px solid ${payMethod===m.value?'#1A1A1A':'#E2E2E2'}`,
                    fontWeight:payMethod===m.value?700:500, color:payMethod===m.value?'#1A1A1A':'#666',
                    background:payMethod===m.value?'#F7F7F5':'#fff' }}>
                  {m.label}
                </button>
              ))}
            </div>
          </Section>

          {/* ⑨ 결제 동의 */}
          <div style={{ background:'#fff', padding:'16px 18px 18px' }}>
            <div style={{ fontSize:14, fontWeight:700, color:'#1A1A1A', marginBottom:10 }}>결제수단 안내 ⓘ</div>
            <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:14, color:'#333' }}>
              <input type="checkbox" checked={payAgree} onChange={e => setPayAgree(e.target.checked)} style={{ width:16, height:16, accentColor:'#1A1A1A' }} />
              주문 내용을 확인하였으며, 결제에 동의합니다.
            </label>
          </div>
        </div>
        );
      })()}

      {/* ── 하단 고정 결제 버튼 ── */}
      <div style={{ position:'fixed', left:0, right:0, bottom:0, zIndex:3100, background:'#fff',
        borderTop:'1px solid #EEE', padding:'10px 16px calc(10px + env(safe-area-inset-bottom))' }}>
        <button onClick={handleOrder} disabled={loading || !payAgree}
          style={{ width:'100%', height:52, background: (loading || !payAgree) ? '#999' : '#1A1A1A',
            color:'#fff', border:'none', borderRadius:8, fontSize:16, fontWeight:700,
            cursor: (loading || !payAgree) ? 'not-allowed' : 'pointer', transition:'background .2s' }}>
          {loading ? '결제창 열리는 중...' : `${fmtPrice(total)}원 결제하기`}
        </button>
      </div>

      {/* 배송지 목록 모달 */}
      {addrListModal && (
        <div onClick={() => { setAddrListModal(false); setAddrSortOpen(false); }}
          style={{ position:'fixed', inset:0, background: isMobile ? '#fff' : 'rgba(0,0,0,0.45)', zIndex:3200, display:'flex',
            alignItems: isMobile ? 'stretch' : 'center', justifyContent:'center', padding: isMobile ? 0 : 16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'#fff', width:'100%',
              maxWidth: isMobile ? '100%' : 560,
              height: isMobile ? '100%' : 'auto',
              maxHeight: isMobile ? '100%' : '82vh',
              borderRadius: isMobile ? 0 : 14, display:'flex', flexDirection:'column', overflow:'hidden' }}>
            {/* 헤더 */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', position:'relative', padding:'18px 22px', borderBottom:'1px solid #F0F0F0' }}>
              <span style={{ fontSize:16, fontWeight:700 }}>배송지 목록</span>
              <button onClick={() => { setAddrListModal(false); setAddrSortOpen(false); }} style={{ position:'absolute', right:18, background:'none', border:'none', cursor:'pointer', padding:4, lineHeight:0 }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            {/* 전체 N건 + 정렬 드롭다운 */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 22px 12px' }}>
              <span style={{ fontSize:14, color:'#333' }}>전체 <b style={{ fontWeight:700 }}>{savedAddresses.length}</b>건</span>
              <div style={{ position:'relative' }}>
                <button onClick={() => setAddrSortOpen(v => !v)}
                  style={{ display:'flex', alignItems:'center', gap:5, background:'none', border:'none', fontSize:14, color:'#888', cursor:'pointer', fontFamily:'inherit' }}>
                  {({ recent_use:'최근 사용순', recent_reg:'최근 등록순', name:'가나다순' } as const)[addrSort]}
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transform: addrSortOpen ? 'rotate(180deg)' : 'none', transition:'transform .2s' }}><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                {addrSortOpen && (
                  <ul style={{ position:'absolute', right:0, top:'100%', marginTop:6, background:'#fff', border:'1px solid #E5E5E5', borderRadius:8, boxShadow:'0 6px 20px rgba(0,0,0,0.12)', zIndex:10, minWidth:120, listStyle:'none', padding:4, margin:0 }}>
                    {([['recent_use','최근 사용순'],['recent_reg','최근 등록순'],['name','가나다순']] as const).map(([k, l]) => (
                      <li key={k} onClick={() => { setAddrSort(k); setAddrSortOpen(false); }}
                        style={{ padding:'10px 12px', fontSize:14, cursor:'pointer', borderRadius:6, fontWeight: addrSort===k?700:400, color: addrSort===k?'#111':'#666' }}>{l}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            {/* 목록 (스크롤) */}
            <div style={{ flex:1, overflowY:'auto', padding:'0 22px 20px' }}>
              {savedAddresses.length === 0 ? (
                <div style={{ textAlign:'center', color:'#aaa', fontSize:14, padding:'40px 0' }}>저장된 배송지가 없습니다.</div>
              ) : (
                [...savedAddresses].sort((a, b) => {
                  if (addrSort === 'name') return (a.label || '').localeCompare(b.label || '', 'ko');
                  if (addrSort === 'recent_reg') return (b.created_at || '').localeCompare(a.created_at || '');
                  return (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0);
                }).map(a => {
                  const sel = a.id === selectedAddrId;
                  return (
                    <div key={a.id} style={{ border:'1px solid #E5E5E5', borderRadius:10, padding:'16px', marginBottom:12 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8, gap:8 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
                          <span style={{ fontSize:14, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.label || '배송지'}</span>
                          {a.is_default && <span style={{ fontSize:12, color:'#888', border:'1px solid #DADADA', borderRadius:4, padding:'2px 7px', flexShrink:0 }}>기본배송지</span>}
                        </div>
                        {sel ? (
                          <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:14, color:'#111', fontWeight:600, flexShrink:0 }}>
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            선택됨
                          </span>
                        ) : (
                          <button onClick={() => { applyAddr(a); setAddrListModal(false); }}
                            style={{ fontSize:14, color:'#aaa', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>선택</button>
                        )}
                      </div>
                      <div style={{ fontSize:14, color:'#333', marginBottom:4 }}>{a.recipient}  {a.phone}</div>
                      <div style={{ fontSize:14, color:'#777', lineHeight:1.5, marginBottom:12 }}>
                        {a.zipcode && <span style={{ color:'#aaa' }}>[{a.zipcode}] </span>}{a.address1}{a.address2 ? ` ${a.address2}` : ''}
                      </div>
                      <div style={{ display:'flex', gap:12, fontSize:14, color:'#888' }}>
                        <span onClick={() => { setAddrListModal(false); openEditAddr(a); }} style={{ cursor:'pointer' }}>수정</span>
                        <span style={{ color:'#E0E0E0' }}>|</span>
                        <span onClick={() => deleteAddr(a.id)} style={{ cursor:'pointer' }}>삭제</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {/* 하단 고정: 배송지 추가 */}
            <div style={{ padding:'14px 22px calc(14px + env(safe-area-inset-bottom))', borderTop:'1px solid #F0F0F0', display:'flex', justifyContent:'center' }}>
              <button onClick={() => { setAddrListModal(false); openAddAddr(); }}
                style={{ padding:'14px 40px', background:'#1A1A1A', color:'#fff', border:'none', borderRadius:999, fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                + 배송지 추가
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 배송지 추가/수정 모달 */}
      {addrFormModal && (
        <div onClick={() => setAddrFormModal(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1001, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'#fff', borderRadius:14, width:'100%', maxWidth:460, maxHeight:'88vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', position:'relative', padding:'18px 22px', borderBottom:'1px solid #F0F0F0' }}>
              <span style={{ fontSize:16, fontWeight:700 }}>{addrEditing ? '배송지 수정' : '배송지 추가'}</span>
              <button onClick={() => setAddrFormModal(false)} style={{ position:'absolute', right:18, background:'none', border:'none', cursor:'pointer', padding:4, lineHeight:0 }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div style={{ overflowY:'auto', padding:'22px' }}>
              <div style={{ marginBottom:16 }}>
                <label style={{ display:'block', fontSize:14, fontWeight:600, marginBottom:7 }}>배송명 <span style={{ color:'#CB1D11' }}>*</span></label>
                <input maxLength={6} placeholder="최대 6자" value={addrForm.label} onChange={e => setAddrForm(f => ({ ...f, label: e.target.value }))}
                  style={{ width:'100%', height:46, padding:'0 13px', border:'1px solid #DDD', borderRadius:6, fontSize:14, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }} />
              </div>
              <div style={{ marginBottom:16 }}>
                <label style={{ display:'block', fontSize:14, fontWeight:600, marginBottom:7 }}>받으시는분 <span style={{ color:'#CB1D11' }}>*</span></label>
                <input maxLength={25} placeholder="최대 25자" value={addrForm.recipient} onChange={e => setAddrForm(f => ({ ...f, recipient: e.target.value }))}
                  style={{ width:'100%', height:46, padding:'0 13px', border:'1px solid #DDD', borderRadius:6, fontSize:14, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }} />
              </div>
              <div style={{ marginBottom:16 }}>
                <label style={{ display:'block', fontSize:14, fontWeight:600, marginBottom:7 }}>휴대폰 <span style={{ color:'#CB1D11' }}>*</span></label>
                <input type="tel" placeholder="-없이 휴대폰 번호를 입력해주세요." value={addrForm.phone} onChange={e => setAddrForm(f => ({ ...f, phone: e.target.value.replace(/[^0-9]/g, '') }))}
                  style={{ width:'100%', height:46, padding:'0 13px', border:'1px solid #DDD', borderRadius:6, fontSize:14, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }} />
              </div>
              <div style={{ marginBottom:18 }}>
                <label style={{ display:'block', fontSize:14, fontWeight:600, marginBottom:7 }}>주소 <span style={{ color:'#CB1D11' }}>*</span></label>
                <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                  <input readOnly placeholder="우편번호" value={addrForm.zipcode} onClick={openAddrFormPost}
                    style={{ flex:1, height:46, padding:'0 13px', border:'1px solid #DDD', borderRadius:6, fontSize:14, background:'#fff', fontFamily:'inherit', boxSizing:'border-box', cursor:'pointer' }} />
                  <button type="button" onClick={openAddrFormPost}
                    style={{ height:46, padding:'0 16px', border:'none', borderRadius:6, background:'#1A1A1A', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', fontFamily:'inherit' }}>우편번호 찾기</button>
                </div>
                <input readOnly placeholder="기본 주소" value={addrForm.address1}
                  style={{ width:'100%', height:46, padding:'0 13px', border:'1px solid #DDD', borderRadius:6, fontSize:14, background:'#fff', fontFamily:'inherit', marginBottom:8, boxSizing:'border-box' }} />
                <input placeholder="건물, 아파트, 동/호수 입력" value={addrForm.address2} onChange={e => setAddrForm(f => ({ ...f, address2: e.target.value }))}
                  style={{ width:'100%', height:46, padding:'0 13px', border:'1px solid #DDD', borderRadius:6, fontSize:14, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }} />
              </div>
              <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:14, color:'#444', cursor:'pointer', marginBottom:22 }}>
                <input type="checkbox" checked={addrForm.is_default} onChange={e => setAddrForm(f => ({ ...f, is_default: e.target.checked }))}
                  style={{ width:16, height:16, accentColor:'#1A1A1A', cursor:'pointer' }} />
                기본 배송지로 저장
              </label>
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={() => { setAddrFormModal(false); setAddrEditing(null); setAddrForm({ ...EMPTY_ADDR }); }}
                  style={{ flex:1, padding:'15px', border:'1px solid #DDD', borderRadius:8, background:'#fff', fontSize:15, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>취소</button>
                <button onClick={saveAddr}
                  style={{ flex:2, padding:'15px', background:'#1A1A1A', color:'#fff', border:'none', borderRadius:8, fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>확인</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 쿠폰 선택 모달 */}
      {couponModal && (
        <div onClick={() => setCouponModal(false)}
          style={{ position:'fixed', inset:0, background: isMobile ? '#fff' : 'rgba(0,0,0,0.45)', zIndex:3100, display:'flex',
            alignItems: isMobile ? 'stretch' : 'center', justifyContent:'center', padding: isMobile ? 0 : 16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'#fff', width:'100%',
              maxWidth: isMobile ? '100%' : 460,
              height: isMobile ? '100%' : 'auto',
              maxHeight: isMobile ? '100%' : '86vh',
              borderRadius: isMobile ? 0 : 14, display:'flex', flexDirection:'column', overflow:'hidden' }}>
            {/* 헤더 */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 22px', borderBottom:'1px solid #F0F0F0' }}>
              <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                <span style={{ fontSize:16, fontWeight:700 }}>사용 가능 쿠폰 <span style={{ color:'#CB1D11' }}>{coupons.length}</span>장</span>
                {dlCount > 0 && (
                  <button onClick={handleClaimCoupons} disabled={claiming}
                    style={{ display:'flex', alignItems:'center', gap:6, fontSize:14, fontWeight:600, color:'#1A1A1A', background:'#F3F4F6', border:'none', borderRadius:8, padding:'7px 12px', cursor: claiming ? 'default' : 'pointer' }}>
                    {claiming ? '받는 중...' : <>다운가능 <span style={{ color:'#CB1D11' }}>{dlCount}</span>장 받기</>}
                  </button>
                )}
              </div>
              <button onClick={() => setCouponModal(false)} style={{ background:'none', border:'none', cursor:'pointer', padding:4, lineHeight:0 }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            {/* 리스트 */}
            <div style={{ flex:1, overflowY:'auto', padding:'16px 20px 20px' }}>
              {/* 적용 안 함 */}
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
                        <div style={{ fontSize:12, color:'#CB1D11', fontWeight:600, marginTop:6 }}>
                          {fmtPrice(c.min_order_amount)}원 이상 구매 시 사용 가능
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              {coupons.length === 0 && (
                <div style={{ textAlign:'center', color:'#AAA', fontSize:14, padding:'30px 0' }}>보유한 쿠폰이 없습니다</div>
              )}
            </div>
            {/* 하단 적용 버튼 */}
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
