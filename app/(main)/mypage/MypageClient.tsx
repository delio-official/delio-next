'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { signOut } from '@/lib/auth';
import { useAuth } from '@/hooks/useAuth';
import '@/styles/mypage.css';

/* ─── Types ─── */
interface Order {
  id: string; order_no: string; status: string;
  final_amount: number; created_at: string;
  order_items: { product_name: string; quantity: number; thumbnail_url: string | null }[];
}
interface Profile {
  name: string | null; email: string; point_balance: number; grade: string;
}
interface WishItem {
  id: string;
  products: {
    id: string; name: string; price: number; discounted_price: number;
    discount_rate: number; thumbnail_url: string | null; category: string; badge: string | null;
  } | null;
}
interface MyReview {
  id: string; rating: number; content: string; created_at: string;
  products: { name: string; thumbnail_url: string | null } | null;
}
interface RecentProduct {
  id: string; name: string; price: number; discount_rate: number;
  thumbnail_url: string | null; avg_rating: number; category: string;
}
interface Address {
  id: string; label: string; recipient: string; phone: string;
  zipcode: string; address1: string; address2: string; is_default: boolean;
}
type PanelType = 'order' | 'point' | 'coupon' | 'recent' | 'wish' | 'benefit' | 'info' | 'myreviews' | 'address' | 'grade' | 'csrefund';

const EMPTY_ADDR = { label:'', recipient:'', phone:'', zipcode:'', address1:'', address2:'' };

/* ─── Constants ─── */
const STATUS_LABEL: Record<string, string> = {
  pending:'결제대기', paid:'결제완료', preparing:'상품준비중',
  shipped:'배송중', delivered:'배송완료', cancelled:'취소됨',
  refunding:'환불처리중', refunded:'환불완료',
};
const EMOJI_MAP: Record<string, string> = {
  apple:'🍎', citrus:'🍊', berry:'🫐', melon:'🍈',
  kiwi:'🥝', mango:'🥭', grape:'🍇', gift:'🎁', default:'🍑',
};
const SURVEYS = [
  { step:1, q:'얼마나 단 과일을 좋아하세요?', options:['매우 달아요 🍬','달아요 😊','보통이에요','안 달아도 돼요','전혀 안 달아도 돼요'] },
  { step:2, q:'신맛(산미)은 어떻게 좋아하세요?', options:['신맛이 강한 게 좋아요','약간의 신맛이 있으면 좋아요','보통이에요','신맛이 적은 게 좋아요','신맛은 싫어요'] },
  { step:3, q:'과일을 주로 어떤 용도로 구매하세요?', options:['직접 즐기기','선물용','간식용','주스·요리용','건강 관리'] },
  { step:4, q:'선호하는 과일 카테고리는?', options:['사과·배 같은 국내 과일','감귤·오렌지 같은 시트러스','베리류 (블루베리·딸기)','열대과일 (망고·키위)','골고루 다 좋아요'] },
];

function fmtPrice(n: number) { return n.toLocaleString('ko-KR'); }

/* ─── SVG Icons ─── */
const IconArrowRight = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const IconArrowLeft = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

/* ══════════════════════════════════════════ */
export default function MypageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const [profile,        setProfile]        = useState<Profile | null>(null);
  const [orders,         setOrders]         = useState<Order[]>([]);
  const [wishlist,       setWishlist]       = useState<WishItem[]>([]);
  const [myReviews,      setMyReviews]      = useState<MyReview[]>([]);
  const [recentProducts, setRecentProducts] = useState<RecentProduct[]>([]);
  const [activePanel,    setActivePanel]    = useState<PanelType>('order');
  const [showMobileMenu, setShowMobileMenu] = useState(true);
  const [wishLoading,    setWishLoading]    = useState(false);
  const [toast,          setToast]          = useState('');
  const [showReferral,   setShowReferral]   = useState(false);
  const [showSurvey,     setShowSurvey]     = useState(false);
  const [surveyStep,     setSurveyStep]     = useState(0);
  const [surveyAnswers,  setSurveyAnswers]  = useState<Record<number, number>>({});

  /* 회원정보 수정 */
  const [infoEditMode,  setInfoEditMode]  = useState(false);
  const [editName,      setEditName]      = useState('');
  const [editPwCur,     setEditPwCur]     = useState('');
  const [editPwNew,     setEditPwNew]     = useState('');
  const [editPwNew2,    setEditPwNew2]    = useState('');
  const [infoSaving,    setInfoSaving]    = useState(false);

  /* 배송지 */
  const [addresses,    setAddresses]    = useState<Address[]>([]);
  const [addrLoading,  setAddrLoading]  = useState(false);
  const [addrFormOpen, setAddrFormOpen] = useState(false);
  const [addrEditing,  setAddrEditing]  = useState<Address | null>(null);
  const [addrForm,     setAddrForm]     = useState({ ...EMPTY_ADDR });

  /* URL 파라미터로 패널 초기화 (?panel=wish 등) */
  useEffect(() => {
    const panel = searchParams.get('panel') as PanelType | null;
    if (panel) {
      setActivePanel(panel);
      setShowMobileMenu(false);
    }
  }, [searchParams]);

  /* toast helper */
  function showToastMsg(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  /* 로그인 체크 + 데이터 로드 */
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }

    async function load() {
      const supabase = createClient();
      const [{ data: prof }, { data: ords }, { data: revs }] = await Promise.all([
        supabase.from('profiles').select('name,email,point_balance,grade').eq('id', user!.id).single(),
        supabase.from('orders')
          .select('id,order_no,status,final_amount,created_at,order_items(product_name,quantity,thumbnail_url)')
          .eq('user_id', user!.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase.from('reviews')
          .select('id,rating,content,created_at,products(name,thumbnail_url)')
          .eq('user_id', user!.id)
          .order('created_at', { ascending: false })
          .limit(30),
      ]);
      setProfile(prof as Profile);
      setOrders((ords as Order[]) || []);
      setMyReviews((revs as unknown as MyReview[]) || []);
    }

    // 최근 본 상품 — localStorage
    try {
      const raw = localStorage.getItem('delio_recent_products');
      setRecentProducts(raw ? JSON.parse(raw) : []);
    } catch { setRecentProducts([]); }

    load();
  }, [user, authLoading, router]);

  /* 배송지 — 패널 열릴 때 로드 */
  useEffect(() => {
    if (activePanel === 'address' && user) loadAddresses();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePanel, user]);

  /* 위시리스트 — 패널 열릴 때 로드 */
  useEffect(() => {
    if (activePanel !== 'wish' || !user) return;
    async function loadWish() {
      setWishLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from('wishlist')
        .select('id, products(id,name,price,discounted_price,discount_rate,thumbnail_url,category,badge)')
        .eq('user_id', user!.id)
        .limit(40);
      setWishlist((data as unknown as WishItem[]) || []);
      setWishLoading(false);
    }
    loadWish();
  }, [activePanel, user]);

  /* 로그아웃 */
  async function handleLogout() {
    await signOut();
    router.push('/');
    router.refresh();
  }

  /* 찜 삭제 */
  async function removeWish(wishId: string) {
    const supabase = createClient();
    await supabase.from('wishlist').delete().eq('id', wishId);
    setWishlist(prev => prev.filter(w => w.id !== wishId));
    showToastMsg('찜 목록에서 삭제했습니다');
  }

  /* 패널 전환 (모바일: 메뉴 → 패널) */
  function goPanel(panel: PanelType) {
    setActivePanel(panel);
    setShowMobileMenu(false);
    window.scrollTo(0, 0);
  }
  /* 패널 → 메뉴 복귀 (모바일) */
  function goBackMenu() {
    setShowMobileMenu(true);
    window.scrollTo(0, 0);
  }
  /* PC용 패널 전환 (사이드바 클릭) */
  function switchPanel(panel: PanelType) {
    setActivePanel(panel);
  }

  /* ── 회원정보 수정 ── */
  function startInfoEdit() {
    setEditName(profile?.name || '');
    setEditPwCur(''); setEditPwNew(''); setEditPwNew2('');
    setInfoEditMode(true);
  }
  async function saveInfo() {
    if (!editName.trim()) { showToastMsg('이름을 입력해주세요.'); return; }
    setInfoSaving(true);
    const supabase = createClient();
    await supabase.from('profiles').update({ name: editName.trim() }).eq('id', user!.id);
    setProfile(prev => prev ? { ...prev, name: editName.trim() } : prev);

    if (editPwNew) {
      if (editPwNew !== editPwNew2) { showToastMsg('새 비밀번호가 일치하지 않습니다.'); setInfoSaving(false); return; }
      if (editPwNew.length < 8) { showToastMsg('비밀번호는 8자 이상이어야 합니다.'); setInfoSaving(false); return; }
      const { error } = await supabase.auth.updateUser({ password: editPwNew });
      if (error) { showToastMsg('비밀번호 변경 실패: ' + error.message); setInfoSaving(false); return; }
    }

    setInfoSaving(false);
    setInfoEditMode(false);
    showToastMsg('회원정보가 저장되었습니다 ✓');
  }

  /* ── 배송지 관리 ── */
  async function loadAddresses() {
    if (!user) return;
    setAddrLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('shipping_addresses')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    setAddresses((data as Address[]) || []);
    setAddrLoading(false);
  }
  function openAddressPost(onComplete: (zip: string, addr: string) => void) {
    const load = () => {
      new (window as any).daum.Postcode({
        oncomplete: (d: any) => onComplete(d.zonecode, d.roadAddress || d.jibunAddress),
      }).open();
    };
    if ((window as any).daum?.Postcode) { load(); }
    else {
      const s = document.createElement('script');
      s.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
      s.onload = load;
      document.head.appendChild(s);
    }
  }
  async function saveAddress() {
    if (!addrForm.recipient.trim() || !addrForm.phone.trim() || !addrForm.address1.trim()) {
      showToastMsg('필수 항목을 모두 입력해주세요.'); return;
    }
    const supabase = createClient();
    if (addrEditing) {
      await supabase.from('shipping_addresses').update({ ...addrForm }).eq('id', addrEditing.id);
    } else {
      if (addresses.length >= 5) { showToastMsg('배송지는 최대 5개까지 저장 가능합니다.'); return; }
      const isFirst = addresses.length === 0;
      await supabase.from('shipping_addresses').insert({ ...addrForm, user_id: user!.id, is_default: isFirst });
    }
    setAddrFormOpen(false);
    setAddrEditing(null);
    setAddrForm({ ...EMPTY_ADDR });
    loadAddresses();
    showToastMsg('배송지가 저장되었습니다 ✓');
  }
  async function deleteAddress(id: string) {
    if (!confirm('이 배송지를 삭제하시겠습니까?')) return;
    const supabase = createClient();
    await supabase.from('shipping_addresses').delete().eq('id', id);
    setAddresses(prev => prev.filter(a => a.id !== id));
    showToastMsg('배송지가 삭제되었습니다.');
  }
  async function setDefaultAddress(id: string) {
    const supabase = createClient();
    await supabase.from('shipping_addresses').update({ is_default: false }).eq('user_id', user!.id);
    await supabase.from('shipping_addresses').update({ is_default: true }).eq('id', id);
    setAddresses(prev => prev.map(a => ({ ...a, is_default: a.id === id })));
    showToastMsg('기본 배송지가 변경되었습니다 ✓');
  }

  /* 파생 값 */
  const orderCounts = {
    pending:   orders.filter(o => o.status === 'pending').length,
    preparing: orders.filter(o => o.status === 'preparing' || o.status === 'paid').length,
    shipped:   orders.filter(o => o.status === 'shipped').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
  };
  const totalOrderAmount = orders.reduce((s, o) => s + o.final_amount, 0);
  const gradeLabel = ({ normal:'일반', vip:'VIP', vvip:'VVIP' } as Record<string,string>)[profile?.grade || 'normal'] || '일반';
  const referralCode = `DELIO-${(user?.email?.split('@')[0] || 'USER').toUpperCase().slice(0, 8)}`;

  /* ─── Loading ─── */
  if (authLoading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:300 }}>
      <p style={{ color:'#999' }}>불러오는 중...</p>
    </div>
  );
  if (!user) return null;

  /* ════════════════════════════════════════
     RENDER
  ════════════════════════════════════════ */
  return (
    <div style={{ background:'#fff', minHeight:'100vh' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position:'fixed', bottom:90, left:'50%', transform:'translateX(-50%)',
          background:'rgba(0,0,0,0.75)', color:'#fff', padding:'10px 20px',
          borderRadius:20, fontSize:13, zIndex:9999, whiteSpace:'nowrap', pointerEvents:'none',
        }}>{toast}</div>
      )}

      <div className="container">

        {/* ── 브레드크럼 (PC) ── */}
        <div className="mp-breadcrumb">
          <Link href="/">Home</Link> / <span>마이페이지</span>
        </div>

        {/* ── 모바일 탑바 ── */}
        <div className="mp-mobile-topbar">
          <span className="mp-mobile-topbar-title">마이페이지</span>
          <div className="mp-mobile-topbar-icons">
            <Link href="/cart" className="mp-cart-link" title="장바구니">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>
                <path d="M2.05 2.05h2l2.66 12.42a2 2 0 001.95 1.53h9.58a2 2 0 001.95-1.53l1.54-8.42H5.05"/>
              </svg>
            </Link>
          </div>
        </div>

        {/* ── 모바일 메뉴 ── */}
        <div className="mp-mobile-menu" style={{ display: showMobileMenu ? undefined : 'none' }}>

          {/* 유저 요약 */}
          <div style={{ padding:'20px', borderBottom:'8px solid #F2F2F2',
            display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:50, height:50, borderRadius:'50%', background:'#F2F2F2',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>
              👤
            </div>
            <div>
              <div style={{ fontSize:16, fontWeight:700 }}>
                {profile?.name || user.email?.split('@')[0]}님
              </div>
              <div style={{ fontSize:12, color:'#888', marginTop:3 }}>
                <span style={{ background:'#F2F2F2', padding:'2px 8px', borderRadius:4, fontWeight:600, fontSize:11 }}>
                  {gradeLabel}
                </span>
                <span style={{ marginLeft:8 }}>{fmtPrice(profile?.point_balance||0)}P 보유</span>
              </div>
            </div>
          </div>

          {/* 쇼핑 정보 */}
          <div className="mp-menu-section">
            <div className="mp-menu-section-title">쇼핑 정보</div>
            <button className="mp-menu-item" onClick={() => goPanel('order')}>
              <span>주문/배송 내역</span><IconArrowRight />
            </button>
            <button className="mp-menu-item" onClick={() => goPanel('point')}>
              <span>적립금 내역</span><IconArrowRight />
            </button>
            <button className="mp-menu-item" onClick={() => goPanel('coupon')}>
              <span>쿠폰 내역</span><IconArrowRight />
            </button>
            <button className="mp-menu-item" onClick={() => goPanel('csrefund')}>
              <span>CS/환불 내역</span><IconArrowRight />
            </button>
            <button className="mp-menu-item" onClick={() => router.push('/inquiry')}>
              <span>1:1 문의</span><IconArrowRight />
            </button>
          </div>

          {/* 나의 취향 */}
          <div className="mp-menu-section">
            <div className="mp-menu-section-title">나의 취향</div>
            <button className="mp-menu-item" onClick={() => router.push('/survey')}>
              <span>내 취향 프로필</span><IconArrowRight />
            </button>
            <button className="mp-menu-item" onClick={() => goPanel('wish')}>
              <span>위시리스트</span><IconArrowRight />
            </button>
            <button className="mp-menu-item" onClick={() => goPanel('recent')}>
              <span>최근 본 상품</span><IconArrowRight />
            </button>
            <button className="mp-menu-item" onClick={() => goPanel('myreviews')}>
              <span>내가 쓴 리뷰</span><IconArrowRight />
            </button>
          </div>

          {/* 혜택 */}
          <div className="mp-menu-section">
            <div className="mp-menu-section-title">혜택</div>
            <button className="mp-menu-item" onClick={() => setShowReferral(true)}>
              <span>친구 초대</span>
              <div className="mp-menu-item-right">
                <span className="mp-menu-badge">1,000원 적립</span>
                <IconArrowRight />
              </div>
            </button>
            <button className="mp-menu-item" onClick={() => showToastMsg('회원 등급 정보를 불러옵니다')}>
              <span>회원 등급</span><IconArrowRight />
            </button>
          </div>

          {/* 나의 정보 */}
          <div className="mp-menu-section">
            <div className="mp-menu-section-title">나의 정보</div>
            <button className="mp-menu-item" onClick={() => goPanel('info')}>
              <span>회원정보 수정</span><IconArrowRight />
            </button>
            <button className="mp-menu-item" onClick={() => goPanel('address')}>
              <span>배송지 관리</span><IconArrowRight />
            </button>
            <button className="mp-menu-item" onClick={() => goPanel('grade')}>
              <span>회원 등급</span><IconArrowRight />
            </button>
            <button className="mp-menu-item mp-menu-item-logout" onClick={handleLogout}>
              <span>로그아웃</span><IconArrowRight />
            </button>
          </div>
        </div>
        {/* /mp-mobile-menu */}

        {/* ── PC 레이아웃: 사이드바 + 콘텐츠 ── */}
        <div className="mp-layout" style={!showMobileMenu ? { display:'flex' } : undefined}>

          {/* ── 사이드바 ── */}
          <aside className="mp-sidebar">
            <div className="mp-sidebar-title">마이페이지</div>
            <nav>
              <div className="mp-nav-section">
                <button className={`mp-nav-link${activePanel==='order'?' active':''}`} onClick={() => switchPanel('order')}>주문/배송 내역</button>
                <button className={`mp-nav-link${activePanel==='point'?' active':''}`} onClick={() => switchPanel('point')}>적립금 내역</button>
                <button className={`mp-nav-link${activePanel==='coupon'?' active':''}`} onClick={() => switchPanel('coupon')}>쿠폰 내역</button>
                <button className={`mp-nav-link${activePanel==='csrefund'?' active':''}`} onClick={() => switchPanel('csrefund')}>CS/환불 내역</button>
                <button className="mp-nav-link" onClick={() => router.push('/inquiry')}>1:1 문의</button>
              </div>
              <div className="mp-nav-section">
                <button className="mp-nav-link" onClick={() => router.push('/survey')}>내 취향 프로필</button>
                <button className={`mp-nav-link${activePanel==='wish'?' active':''}`} onClick={() => switchPanel('wish')}>위시리스트</button>
                <button className={`mp-nav-link${activePanel==='recent'?' active':''}`} onClick={() => switchPanel('recent')}>최근 본 상품</button>
                <button className={`mp-nav-link${activePanel==='myreviews'?' active':''}`} onClick={() => switchPanel('myreviews')}>내가 쓴 리뷰</button>
              </div>
              <div className="mp-nav-section">
                <button className="mp-nav-link" onClick={() => setShowReferral(true)}>친구 초대</button>
                <button className="mp-nav-link" onClick={() => showToastMsg('회원 등급 정보를 불러옵니다')}>회원 등급</button>
              </div>
              <div className="mp-nav-section">
                <button className={`mp-nav-link${activePanel==='info'?' active':''}`} onClick={() => switchPanel('info')}>회원정보 수정</button>
                <button className={`mp-nav-link${activePanel==='address'?' active':''}`} onClick={() => switchPanel('address')}>배송지 관리</button>
                <button className={`mp-nav-link${activePanel==='grade'?' active':''}`} onClick={() => switchPanel('grade')}>회원 등급</button>
                <button className="mp-nav-link" onClick={handleLogout}>로그아웃</button>
              </div>
            </nav>
          </aside>

          {/* ── 콘텐츠 ── */}
          <div className="mp-content">

            {/* ═══ 주문/배송 내역 ═══ */}
            <div className={`mp-panel${activePanel==='order'?' active':''}`}>
              <button className="mp-panel-back" onClick={goBackMenu}><IconArrowLeft /></button>

              {/* 요약 통계 */}
              <div className="mp-stats">
                <div className="mp-stat">
                  <div className="mp-stat-icon">W</div>
                  <div>
                    <div className="mp-stat-value">{fmtPrice(profile?.point_balance||0)}원</div>
                    <div className="mp-stat-label">총적립금</div>
                  </div>
                </div>
                <div className="mp-stat-divider" />
                <div className="mp-stat">
                  <div className="mp-stat-icon">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20"/><path d="M6 14h4"/>
                    </svg>
                  </div>
                  <div>
                    <div className="mp-stat-value">0개</div>
                    <div className="mp-stat-label">쿠폰</div>
                  </div>
                </div>
                <div className="mp-stat-divider" />
                <div className="mp-stat">
                  <div className="mp-stat-icon">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                  <div>
                    <div className="mp-stat-value">{fmtPrice(totalOrderAmount)}원({orders.length}회)</div>
                    <div className="mp-stat-label">총주문</div>
                  </div>
                </div>
              </div>

              {/* 주문처리 현황 */}
              <div className="mp-section">
                <div className="mp-section-header">
                  <span className="mp-section-title">나의 주문처리 현황</span>
                  <span className="mp-section-sub">(최근 3개월 기준)</span>
                </div>
                <div className="mp-order-flow">
                  <div className="mp-order-step"
                    onClick={() => showToastMsg(orderCounts.pending>0 ? `입금전 ${orderCounts.pending}건` : '입금전 주문이 없습니다')}>
                    <div className="mp-order-num">{orderCounts.pending}</div>
                    <div className="mp-order-label">입금전</div>
                  </div>
                  <div className="mp-order-arrow">›</div>
                  <div className="mp-order-step"
                    onClick={() => showToastMsg(orderCounts.preparing>0 ? `배송준비 중 ${orderCounts.preparing}건` : '배송준비 중인 주문이 없습니다')}>
                    <div className="mp-order-num">{orderCounts.preparing}</div>
                    <div className="mp-order-label">배송준비중</div>
                  </div>
                  <div className="mp-order-arrow">›</div>
                  <div className="mp-order-step"
                    onClick={() => showToastMsg(orderCounts.shipped>0 ? `배송 중 ${orderCounts.shipped}건` : '배송 중인 주문이 없습니다')}>
                    <div className="mp-order-num">{orderCounts.shipped}</div>
                    <div className="mp-order-label">배송중</div>
                  </div>
                  <div className="mp-order-arrow">›</div>
                  <div className="mp-order-step"
                    onClick={() => showToastMsg('배송 완료 내역을 확인합니다')}>
                    <div className="mp-order-num">{orderCounts.delivered}</div>
                    <div className="mp-order-label">배송완료</div>
                  </div>
                </div>
              </div>

              {/* 주문내역 목록 */}
              <div className="mp-section">
                <div className="mp-section-header">
                  <span className="mp-section-title">주문내역 조회</span>
                </div>
                {orders.length === 0 ? (
                  <div className="mp-empty">주문 내역이 없습니다.</div>
                ) : (
                  orders.map(o => (
                    <div key={o.id} style={{ padding:'16px 0', borderBottom:'1px solid #f2f2f2' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                        <span style={{ fontSize:12, color:'#aaa' }}>
                          {new Date(o.created_at).toLocaleDateString('ko-KR')} · {o.order_no}
                        </span>
                        <span style={{
                          fontSize:11, fontWeight:700,
                          color:  o.status==='delivered'?'#2D7A4D': o.status==='cancelled'?'#e00':'var(--color-accent)',
                          background: o.status==='delivered'?'#E8F5E9': o.status==='cancelled'?'#FEE':'var(--color-accent-bg)',
                          padding:'4px 10px', borderRadius:999,
                        }}>
                          {STATUS_LABEL[o.status] || o.status}
                        </span>
                      </div>
                      {o.order_items?.slice(0, 2).map((item, i) => (
                        <div key={i} style={{ display:'flex', gap:12, alignItems:'center', marginBottom:8 }}>
                          <div style={{ width:52, height:52, borderRadius:8, background:'#F7F7F5',
                            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, overflow:'hidden' }}>
                            {item.thumbnail_url
                              ? <img src={item.thumbnail_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                              : <span style={{ fontSize:22 }}>🍑</span>}
                          </div>
                          <div>
                            <div style={{ fontSize:13, fontWeight:600 }}>{item.product_name}</div>
                            <div style={{ fontSize:12, color:'#999' }}>{item.quantity}개</div>
                          </div>
                        </div>
                      ))}
                      {(o.order_items?.length ?? 0) > 2 && (
                        <p style={{ fontSize:12, color:'#bbb', marginBottom:6 }}>외 {o.order_items.length-2}개 상품</p>
                      )}
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                        borderTop:'1px solid #f5f5f5', paddingTop:10, marginTop:4 }}>
                        <span style={{ fontSize:14, fontWeight:700 }}>{fmtPrice(o.final_amount)}원</span>
                        {o.status === 'delivered' && (
                          <button onClick={() => showToastMsg('리뷰 작성 기능은 준비 중입니다.')}
                            style={{ fontSize:12, padding:'6px 12px', border:'1.5px solid #EBEBEB',
                              borderRadius:6, cursor:'pointer', background:'#fff', fontFamily:'inherit' }}>
                            리뷰 작성
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            {/* /주문내역 */}

            {/* ═══ 적립금 내역 ═══ */}
            <div className={`mp-panel${activePanel==='point'?' active':''}`}>
              <button className="mp-panel-back" onClick={goBackMenu}><IconArrowLeft /></button>
              <div className="mp-section">
                <div className="mp-section-header">
                  <span className="mp-section-title">적립금 내역</span>
                </div>
                <div className="mp-benefit-row mp-benefit-row-top">
                  <div className="mp-benefit-item">
                    <div className="mp-benefit-num">{fmtPrice(profile?.point_balance||0)}</div>
                    <div className="mp-benefit-label">보유 적립금 (원)</div>
                  </div>
                  <div className="mp-benefit-item">
                    <div className="mp-benefit-num">0</div>
                    <div className="mp-benefit-label">소멸 예정 (원)</div>
                  </div>
                </div>
                <div className="mp-empty">적립금 내역이 없습니다.</div>
              </div>
            </div>

            {/* ═══ 쿠폰 내역 ═══ */}
            <div className={`mp-panel${activePanel==='coupon'?' active':''}`}>
              <button className="mp-panel-back" onClick={goBackMenu}><IconArrowLeft /></button>
              <div className="mp-section">
                <div className="mp-section-header">
                  <span className="mp-section-title">쿠폰 내역</span>
                </div>
                <div className="mp-benefit-row mp-benefit-row-top">
                  <div className="mp-benefit-item">
                    <div className="mp-benefit-num">0</div>
                    <div className="mp-benefit-label">사용 가능 쿠폰</div>
                  </div>
                  <div className="mp-benefit-item">
                    <div className="mp-benefit-num">0</div>
                    <div className="mp-benefit-label">사용 완료</div>
                  </div>
                </div>
                <div className="mp-empty">사용 가능한 쿠폰이 없습니다.</div>
              </div>
            </div>

            {/* ═══ 최근 본 상품 ═══ */}
            <div className={`mp-panel${activePanel==='recent'?' active':''}`}>
              <button className="mp-panel-back" onClick={goBackMenu}><IconArrowLeft /></button>
              <div className="mp-section">
                <div className="mp-section-header">
                  <span className="mp-section-title">최근 본 상품</span>
                  {recentProducts.length > 0 && (
                    <span className="mp-section-sub mp-wish-count">{recentProducts.length}개</span>
                  )}
                </div>
                {recentProducts.length === 0 ? (
                  <div className="mp-empty">최근 본 상품이 없습니다.</div>
                ) : (
                  <div className="mp-wish-grid">
                    {recentProducts.map(p => (
                      <Link key={p.id} href={`/product/${p.id}`} style={{ textDecoration:'none', color:'inherit' }}>
                        <div className="mp-wish-item">
                          <div className="mp-wish-img">
                            {p.thumbnail_url
                              ? <img src={p.thumbnail_url} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                              : (EMOJI_MAP[p.category] || EMOJI_MAP.default)}
                          </div>
                          <div className="mp-wish-body">
                            <div className="mp-wish-name">{p.name}</div>
                            <div style={{ display:'flex', alignItems:'baseline', gap:4 }}>
                              {p.discount_rate > 0 && (
                                <span style={{ fontSize:11, color:'var(--color-accent)', fontWeight:700 }}>{p.discount_rate}%</span>
                              )}
                              <span className="mp-wish-price">{fmtPrice(p.price)}원</span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ═══ 내가 쓴 리뷰 ═══ */}
            <div className={`mp-panel${activePanel==='myreviews'?' active':''}`}>
              <button className="mp-panel-back" onClick={goBackMenu}><IconArrowLeft /></button>
              <div className="mp-section">
                <div className="mp-section-header">
                  <span className="mp-section-title">내가 쓴 리뷰</span>
                  {myReviews.length > 0 && (
                    <span className="mp-section-sub mp-wish-count">{myReviews.length}개</span>
                  )}
                </div>
                {myReviews.length === 0 ? (
                  <div className="mp-empty">작성한 리뷰가 없습니다.</div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                    {myReviews.map(r => (
                      <div key={r.id} style={{ padding:'16px 0', borderBottom:'1px solid #f2f2f2' }}>
                        <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                          {/* 상품 썸네일 */}
                          <div style={{ width:52, height:52, borderRadius:8, background:'#F7F7F5',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            flexShrink:0, overflow:'hidden' }}>
                            {r.products?.thumbnail_url
                              ? <img src={r.products.thumbnail_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                              : <span style={{ fontSize:22 }}>🍑</span>}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:12, color:'#999', marginBottom:3 }}>
                              {r.products?.name || '삭제된 상품'}
                            </div>
                            {/* 별점 */}
                            <div style={{ display:'flex', gap:2, marginBottom:5 }}>
                              {[1,2,3,4,5].map(s => (
                                <svg key={s} viewBox="0 0 20 20" width="13" height="13">
                                  <path d="M10,1.5 L11.8,6.5 L17,6.5 L12.9,9.8 L14.5,14.9 L10,11.8 L5.5,14.9 L7.1,9.8 L3,6.5 L8.2,6.5 Z"
                                    fill={s <= r.rating ? '#F5A623' : '#E0DFDB'} />
                                </svg>
                              ))}
                              <span style={{ fontSize:11, color:'#aaa', marginLeft:4 }}>{r.rating}.0</span>
                            </div>
                            <p style={{ fontSize:13, color:'#444', lineHeight:1.6, margin:0,
                              overflow:'hidden', display:'-webkit-box',
                              WebkitLineClamp:2, WebkitBoxOrient:'vertical' as const }}>
                              {r.content}
                            </p>
                            <div style={{ fontSize:11, color:'#bbb', marginTop:5 }}>
                              {new Date(r.created_at).toLocaleDateString('ko-KR')}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ═══ 위시리스트 ═══ */}
            <div className={`mp-panel${activePanel==='wish'?' active':''}`}>
              <button className="mp-panel-back" onClick={goBackMenu}><IconArrowLeft /></button>
              <div className="mp-section">
                <div className="mp-section-header">
                  <span className="mp-section-title">나의 위시리스트</span>
                  {wishlist.length > 0 && (
                    <span className="mp-section-sub mp-wish-count">{wishlist.length}개</span>
                  )}
                </div>
                {wishLoading ? (
                  <div className="mp-empty">불러오는 중...</div>
                ) : wishlist.length === 0 ? (
                  <div className="mp-empty">찜한 상품이 없습니다.</div>
                ) : (
                  <div className="mp-wish-grid">
                    {wishlist.map(w => {
                      const p = w.products;
                      if (!p) return null;
                      const emoji = EMOJI_MAP[p.category] || EMOJI_MAP.default;
                      const price = p.discounted_price ?? p.price;
                      return (
                        <div key={w.id} className="mp-wish-item">
                          <div className="mp-wish-img">
                            {p.thumbnail_url
                              ? <img src={p.thumbnail_url} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                              : emoji}
                            <button className="mp-wish-del"
                              onClick={e => { e.stopPropagation(); removeWish(w.id); }}>♥</button>
                          </div>
                          <Link href={`/product/${p.id}`} style={{ textDecoration:'none', color:'inherit' }}>
                            <div className="mp-wish-body">
                              <div className="mp-wish-name">{p.name}</div>
                              <div className="mp-wish-price">{fmtPrice(price)}원</div>
                            </div>
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ═══ 혜택 (친구 초대) ═══ */}
            <div className={`mp-panel${activePanel==='benefit'?' active':''}`}>
              <button className="mp-panel-back" onClick={goBackMenu}><IconArrowLeft /></button>
              <div className="mp-section">
                <div className="mp-section-header">
                  <span className="mp-section-title">친구 추천 프로그램</span>
                </div>
                <div className="mp-panel-benefit-body">
                  <div className="referral-code-box">
                    <div className="referral-code-label">내 추천 코드</div>
                    <div className="referral-code">{referralCode}</div>
                  </div>
                  <button
                    onClick={() => setShowReferral(true)}
                    style={{ width:'100%', padding:'14px', background:'var(--color-accent)', color:'#fff',
                      border:'none', borderRadius:8, fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                    🤝 친구 추천하기
                  </button>
                </div>
              </div>
            </div>

            {/* ═══ 회원정보 수정 ═══ */}
            <div className={`mp-panel${activePanel==='info'?' active':''}`}>
              <button className="mp-panel-back" onClick={goBackMenu}><IconArrowLeft /></button>
              <div className="mp-section">
                <div className="mp-section-header">
                  <span className="mp-section-title">회원정보 수정</span>
                  {!infoEditMode && (
                    <button onClick={startInfoEdit}
                      style={{ marginLeft:'auto', fontSize:12, color:'var(--color-accent)', background:'none',
                        border:'1px solid var(--color-accent)', borderRadius:6, padding:'4px 10px',
                        cursor:'pointer', fontFamily:'inherit' }}>
                      수정하기
                    </button>
                  )}
                </div>
                <div style={{ paddingTop:16 }}>
                  {!infoEditMode ? (
                    /* ── 보기 모드 ── */
                    <>
                      {([
                        ['이름',       profile?.name || '-'],
                        ['이메일',     profile?.email || user.email || '-'],
                        ['회원등급',   gradeLabel],
                        ['보유포인트', `${fmtPrice(profile?.point_balance||0)}P`],
                      ] as [string, string][]).map(([k, v]) => (
                        <div key={k} style={{ display:'flex', padding:'14px 0', borderBottom:'1px solid #f0f0f0' }}>
                          <span style={{ width:100, fontSize:13, color:'#888', flexShrink:0 }}>{k}</span>
                          <span style={{ fontSize:14, fontWeight:600 }}>{v}</span>
                        </div>
                      ))}
                      <button onClick={handleLogout}
                        style={{ width:'100%', marginTop:24, padding:'14px', border:'1.5px solid #EBEBEB',
                          borderRadius:8, background:'#fff', fontSize:14, fontWeight:600,
                          cursor:'pointer', color:'#888', fontFamily:'inherit' }}>
                        로그아웃
                      </button>
                    </>
                  ) : (
                    /* ── 편집 모드 ── */
                    <>
                      {/* 이름 */}
                      <div style={{ marginBottom:16 }}>
                        <label style={{ display:'block', fontSize:12, color:'#888', marginBottom:6 }}>이름</label>
                        <input value={editName} onChange={e => setEditName(e.target.value)}
                          style={{ width:'100%', height:46, padding:'0 12px', border:'1.5px solid #EBEBEB',
                            borderRadius:8, fontSize:14, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }} />
                      </div>
                      {/* 이메일 (읽기 전용) */}
                      <div style={{ marginBottom:20 }}>
                        <label style={{ display:'block', fontSize:12, color:'#888', marginBottom:6 }}>이메일 (변경 불가)</label>
                        <input value={profile?.email || user.email || ''} readOnly
                          style={{ width:'100%', height:46, padding:'0 12px', border:'1.5px solid #EBEBEB',
                            borderRadius:8, fontSize:14, background:'#F7F7F5', color:'#aaa',
                            outline:'none', fontFamily:'inherit', boxSizing:'border-box' }} />
                      </div>
                      {/* 비밀번호 변경 */}
                      <div style={{ background:'#F7F7F5', borderRadius:10, padding:'16px', marginBottom:20 }}>
                        <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>비밀번호 변경 (선택)</div>
                        {[
                          ['새 비밀번호', editPwNew, setEditPwNew],
                          ['새 비밀번호 확인', editPwNew2, setEditPwNew2],
                        ].map(([label, val, setter]) => (
                          <div key={label as string} style={{ marginBottom:10 }}>
                            <label style={{ display:'block', fontSize:12, color:'#888', marginBottom:5 }}>{label as string}</label>
                            <input type="password" value={val as string}
                              onChange={e => (setter as (v:string)=>void)(e.target.value)}
                              placeholder="8자 이상"
                              style={{ width:'100%', height:44, padding:'0 12px', border:'1.5px solid #EBEBEB',
                                borderRadius:8, fontSize:14, outline:'none', fontFamily:'inherit',
                                background:'#fff', boxSizing:'border-box' }} />
                          </div>
                        ))}
                        {editPwNew && editPwNew2 && editPwNew !== editPwNew2 && (
                          <p style={{ fontSize:12, color:'#E55A4B', margin:'4px 0 0' }}>비밀번호가 일치하지 않습니다.</p>
                        )}
                      </div>
                      {/* 버튼 */}
                      <div style={{ display:'flex', gap:10 }}>
                        <button onClick={() => setInfoEditMode(false)}
                          style={{ flex:1, padding:'14px', border:'1.5px solid #EBEBEB', borderRadius:8,
                            background:'#fff', fontSize:14, fontWeight:600, cursor:'pointer',
                            color:'#888', fontFamily:'inherit' }}>
                          취소
                        </button>
                        <button onClick={saveInfo} disabled={infoSaving}
                          style={{ flex:2, padding:'14px', background:'var(--color-accent)', color:'#fff',
                            border:'none', borderRadius:8, fontSize:14, fontWeight:700,
                            cursor:'pointer', opacity: infoSaving ? 0.7 : 1, fontFamily:'inherit' }}>
                          {infoSaving ? '저장 중...' : '저장하기'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* ═══ 배송지 관리 ═══ */}
            <div className={`mp-panel${activePanel==='address'?' active':''}`}>
              <button className="mp-panel-back" onClick={goBackMenu}><IconArrowLeft /></button>
              <div className="mp-section">
                <div className="mp-section-header">
                  <span className="mp-section-title">배송지 관리</span>
                  <span className="mp-section-sub" style={{ marginLeft:'auto' }}>{addresses.length}/5</span>
                </div>

                {addrLoading ? (
                  <div className="mp-empty">불러오는 중...</div>
                ) : (
                  <>
                    {/* 배송지 목록 */}
                    {addresses.length === 0 && !addrFormOpen && (
                      <div className="mp-empty">저장된 배송지가 없습니다.</div>
                    )}
                    {addresses.map(a => (
                      <div key={a.id} style={{ padding:'16px 0', borderBottom:'1px solid #f2f2f2' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            {a.label && <span style={{ fontSize:11, background:'#F2F2F2', padding:'2px 7px', borderRadius:4, fontWeight:600 }}>{a.label}</span>}
                            {a.is_default && <span style={{ fontSize:11, background:'var(--color-accent)', color:'#fff', padding:'2px 7px', borderRadius:4, fontWeight:700 }}>기본</span>}
                            <span style={{ fontSize:14, fontWeight:700 }}>{a.recipient}</span>
                          </div>
                          <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                            <button onClick={() => { setAddrEditing(a); setAddrForm({ label:a.label, recipient:a.recipient, phone:a.phone, zipcode:a.zipcode, address1:a.address1, address2:a.address2 }); setAddrFormOpen(true); }}
                              style={{ fontSize:12, color:'#555', background:'none', border:'1px solid #ddd', borderRadius:5, padding:'3px 8px', cursor:'pointer', fontFamily:'inherit' }}>
                              수정
                            </button>
                            <button onClick={() => deleteAddress(a.id)}
                              style={{ fontSize:12, color:'#E55A4B', background:'none', border:'1px solid #fcc', borderRadius:5, padding:'3px 8px', cursor:'pointer', fontFamily:'inherit' }}>
                              삭제
                            </button>
                          </div>
                        </div>
                        <div style={{ fontSize:13, color:'#555', marginBottom:3 }}>{a.phone}</div>
                        <div style={{ fontSize:13, color:'#555' }}>
                          {a.zipcode && <span style={{ color:'#aaa', marginRight:6 }}>[{a.zipcode}]</span>}
                          {a.address1} {a.address2}
                        </div>
                        {!a.is_default && (
                          <button onClick={() => setDefaultAddress(a.id)}
                            style={{ marginTop:8, fontSize:12, color:'#888', background:'none',
                              border:'1px solid #ddd', borderRadius:5, padding:'4px 10px',
                              cursor:'pointer', fontFamily:'inherit' }}>
                            기본 배송지로 설정
                          </button>
                        )}
                      </div>
                    ))}

                    {/* 배송지 추가/수정 폼 */}
                    {addrFormOpen && (
                      <div style={{ background:'#F7F7F5', borderRadius:10, padding:'16px', marginTop:12 }}>
                        <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>
                          {addrEditing ? '배송지 수정' : '새 배송지 추가'}
                        </div>
                        {[
                          ['배송지 별칭', 'label', 'text', '예: 집, 회사 (선택)'],
                          ['받는 분 *', 'recipient', 'text', '이름 입력'],
                          ['연락처 *', 'phone', 'tel', '숫자만 입력'],
                        ].map(([label, key, type, ph]) => (
                          <div key={key} style={{ marginBottom:10 }}>
                            <label style={{ display:'block', fontSize:12, color:'#888', marginBottom:5 }}>{label}</label>
                            <input type={type} placeholder={ph}
                              value={(addrForm as Record<string,string>)[key]}
                              onChange={e => setAddrForm(f => ({ ...f, [key]: e.target.value }))}
                              style={{ width:'100%', height:44, padding:'0 12px', border:'1.5px solid #EBEBEB',
                                borderRadius:8, fontSize:14, outline:'none', fontFamily:'inherit',
                                background:'#fff', boxSizing:'border-box' }} />
                          </div>
                        ))}
                        {/* 주소 검색 */}
                        <div style={{ marginBottom:10 }}>
                          <label style={{ display:'block', fontSize:12, color:'#888', marginBottom:5 }}>주소 *</label>
                          <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                            <input readOnly placeholder="우편번호" value={addrForm.zipcode}
                              style={{ flex:1, height:44, padding:'0 12px', border:'1.5px solid #EBEBEB',
                                borderRadius:8, fontSize:14, background:'#fff', fontFamily:'inherit', boxSizing:'border-box' }} />
                            <button type="button"
                              onClick={() => openAddressPost((zip, addr) => setAddrForm(f => ({ ...f, zipcode: zip, address1: addr })))}
                              style={{ height:44, padding:'0 14px', border:'1.5px solid var(--color-accent)',
                                borderRadius:8, background:'#fff', color:'var(--color-accent)',
                                fontSize:13, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', fontFamily:'inherit' }}>
                              주소 검색
                            </button>
                          </div>
                          <input readOnly placeholder="기본 주소" value={addrForm.address1}
                            style={{ width:'100%', height:44, padding:'0 12px', border:'1.5px solid #EBEBEB',
                              borderRadius:8, fontSize:14, background:'#fff', fontFamily:'inherit',
                              marginBottom:8, boxSizing:'border-box' }} />
                          <input placeholder="상세 주소" value={addrForm.address2}
                            onChange={e => setAddrForm(f => ({ ...f, address2: e.target.value }))}
                            style={{ width:'100%', height:44, padding:'0 12px', border:'1.5px solid #EBEBEB',
                              borderRadius:8, fontSize:14, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }} />
                        </div>
                        <div style={{ display:'flex', gap:10, marginTop:4 }}>
                          <button onClick={() => { setAddrFormOpen(false); setAddrEditing(null); setAddrForm({ ...EMPTY_ADDR }); }}
                            style={{ flex:1, padding:'12px', border:'1.5px solid #ddd', borderRadius:8,
                              background:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                            취소
                          </button>
                          <button onClick={saveAddress}
                            style={{ flex:2, padding:'12px', background:'var(--color-accent)', color:'#fff',
                              border:'none', borderRadius:8, fontSize:13, fontWeight:700,
                              cursor:'pointer', fontFamily:'inherit' }}>
                            저장
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 배송지 추가 버튼 */}
                    {!addrFormOpen && addresses.length < 5 && (
                      <button onClick={() => { setAddrEditing(null); setAddrForm({ ...EMPTY_ADDR }); setAddrFormOpen(true); }}
                        style={{ width:'100%', marginTop:16, padding:'14px', border:'1.5px dashed #ccc',
                          borderRadius:8, background:'#fff', fontSize:14, fontWeight:600,
                          cursor:'pointer', color:'#888', fontFamily:'inherit' }}>
                        + 새 배송지 추가
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ═══ 회원 등급 ═══ */}
            <div className={`mp-panel${activePanel==='grade'?' active':''}`}>
              <button className="mp-panel-back" onClick={goBackMenu}><IconArrowLeft /></button>
              <div className="mp-section">
                <div className="mp-section-header">
                  <span className="mp-section-title">회원 등급 안내</span>
                </div>
                {/* 현재 등급 */}
                <div style={{ background:'linear-gradient(135deg,#2d5a27,#4a8a3f)', borderRadius:12,
                  padding:'20px 24px', marginTop:16, marginBottom:24, color:'#fff' }}>
                  <div style={{ fontSize:12, opacity:0.8, marginBottom:4 }}>현재 등급</div>
                  <div style={{ fontSize:24, fontWeight:800 }}>{gradeLabel}</div>
                  <div style={{ fontSize:13, opacity:0.8, marginTop:4 }}>
                    누적 구매금액 {fmtPrice(totalOrderAmount)}원
                  </div>
                  {/* 다음 등급 진행도 */}
                  {profile?.grade !== 'vvip' && (() => {
                    const next = profile?.grade === 'normal' ? { label:'VIP', target:50000 } : { label:'VVIP', target:200000 };
                    const pct = Math.min(totalOrderAmount / next.target * 100, 100);
                    return (
                      <div style={{ marginTop:12 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, opacity:0.8, marginBottom:5 }}>
                          <span>{next.label}까지 {fmtPrice(Math.max(next.target - totalOrderAmount, 0))}원 남음</span>
                          <span>{Math.floor(pct)}%</span>
                        </div>
                        <div style={{ background:'rgba(255,255,255,0.25)', borderRadius:4, height:6, overflow:'hidden' }}>
                          <div style={{ background:'#fff', height:'100%', width:`${pct}%`, borderRadius:4, transition:'width .4s' }} />
                        </div>
                      </div>
                    );
                  })()}
                </div>
                {/* 등급별 혜택 표 */}
                {[
                  {
                    grade:'normal', label:'일반', color:'#888', bg:'#F5F5F5',
                    criteria:'누적 구매 5만원 미만',
                    benefits:['기본 포인트 적립 1%', '생일 쿠폰 지급', '신규 가입 쿠폰 제공'],
                  },
                  {
                    grade:'vip', label:'VIP', color:'#C8841C', bg:'#FFF3E0',
                    criteria:'누적 구매 5만원 이상',
                    benefits:['포인트 적립 2%', '무료배송 쿠폰 월 1회', 'VIP 전용 특가 상품 접근', '우선 CS 지원'],
                  },
                  {
                    grade:'vvip', label:'VVIP', color:'#2D5A27', bg:'#E8F5E9',
                    criteria:'누적 구매 20만원 이상',
                    benefits:['포인트 적립 3%', '무료배송 쿠폰 월 3회', 'VVIP 전용 한정 상품', '전담 CS 매니저', '생일 프리미엄 선물'],
                  },
                ].map(g => (
                  <div key={g.grade}
                    style={{ border:`2px solid ${profile?.grade===g.grade ? g.color : '#EBEBEB'}`,
                      borderRadius:12, padding:'16px', marginBottom:12,
                      background: profile?.grade===g.grade ? g.bg : '#fff' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                      <span style={{ fontSize:15, fontWeight:800, color:g.color }}>{g.label}</span>
                      {profile?.grade===g.grade && (
                        <span style={{ fontSize:11, background:g.color, color:'#fff',
                          padding:'2px 8px', borderRadius:4, fontWeight:700 }}>현재</span>
                      )}
                      <span style={{ fontSize:12, color:'#aaa', marginLeft:'auto' }}>{g.criteria}</span>
                    </div>
                    <ul style={{ margin:0, padding:'0 0 0 16px', listStyle:'disc' }}>
                      {g.benefits.map(b => (
                        <li key={b} style={{ fontSize:13, color:'#555', lineHeight:1.8 }}>{b}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* ═══ CS/환불 내역 ═══ */}
            <div className={`mp-panel${activePanel==='csrefund'?' active':''}`}>
              <button className="mp-panel-back" onClick={goBackMenu}><IconArrowLeft /></button>
              <div className="mp-section">
                <div className="mp-section-header">
                  <span className="mp-section-title">CS/환불 내역</span>
                </div>
                {/* 환불 가능 주문 */}
                <div style={{ paddingTop:16 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#111', marginBottom:12 }}>환불 신청 가능한 주문</div>
                  {orders.filter(o => o.status === 'delivered').length === 0 ? (
                    <div style={{ textAlign:'center', padding:'24px 0', fontSize:13, color:'#aaa',
                      background:'#F7F7F5', borderRadius:10 }}>
                      환불 신청 가능한 주문이 없습니다.
                    </div>
                  ) : (
                    orders.filter(o => o.status === 'delivered').map(o => (
                      <div key={o.id} style={{ padding:'14px', border:'1px solid #EBEBEB',
                        borderRadius:10, marginBottom:10 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                          <span style={{ fontSize:12, color:'#aaa' }}>
                            {new Date(o.created_at).toLocaleDateString('ko-KR')} · {o.order_no}
                          </span>
                          <span style={{ fontSize:11, fontWeight:700, background:'#E8F5E9',
                            color:'#2D7A4D', padding:'3px 8px', borderRadius:4 }}>배송완료</span>
                        </div>
                        <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>
                          {o.order_items?.[0]?.product_name}
                          {(o.order_items?.length ?? 0) > 1 && ` 외 ${o.order_items.length-1}건`}
                        </div>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <span style={{ fontSize:14, fontWeight:700 }}>{fmtPrice(o.final_amount)}원</span>
                          <button
                            onClick={() => router.push(`/refund?order=${o.id}`)}
                            style={{ fontSize:12, padding:'6px 14px',
                              background:'var(--color-accent)', color:'#fff',
                              border:'none', borderRadius:6, cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>
                            환불 신청
                          </button>
                        </div>
                      </div>
                    ))
                  )}

                  {/* 처리 중/완료 환불 내역 */}
                  {orders.filter(o => ['cancelled','refunding','refunded'].includes(o.status)).length > 0 && (
                    <div style={{ marginTop:24 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'#111', marginBottom:12 }}>처리 내역</div>
                      {orders.filter(o => ['cancelled','refunding','refunded'].includes(o.status)).map(o => (
                        <div key={o.id} style={{ padding:'14px', border:'1px solid #EBEBEB',
                          borderRadius:10, marginBottom:10, background:'#FAFAFA' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                            <span style={{ fontSize:12, color:'#aaa' }}>
                              {new Date(o.created_at).toLocaleDateString('ko-KR')} · {o.order_no}
                            </span>
                            <span style={{ fontSize:11, fontWeight:700,
                              color: o.status==='refunded'?'#888': o.status==='refunding'?'#C8841C':'#E55A4B',
                              background: o.status==='refunded'?'#F2F2F2': o.status==='refunding'?'#FFF3E0':'#FEE',
                              padding:'3px 8px', borderRadius:4 }}>
                              {STATUS_LABEL[o.status]}
                            </span>
                          </div>
                          <div style={{ fontSize:13, color:'#555' }}>
                            {o.order_items?.[0]?.product_name}
                            {(o.order_items?.length ?? 0) > 1 && ` 외 ${o.order_items.length-1}건`}
                          </div>
                          <div style={{ fontSize:14, fontWeight:700, marginTop:6 }}>{fmtPrice(o.final_amount)}원</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 고객센터 안내 */}
                  <div style={{ marginTop:24, background:'#F7F7F5', borderRadius:10, padding:'16px' }}>
                    <div style={{ fontSize:13, fontWeight:700, marginBottom:8 }}>📞 고객센터 문의</div>
                    <p style={{ fontSize:13, color:'#666', lineHeight:1.8, margin:0 }}>
                      · 전화: 1588-0000 (평일 09~18시)<br/>
                      · 이메일: help@delio.co.kr<br/>
                      · 카카오 채널: @델리오<br/>
                      · 환불은 배송완료 후 7일 이내 신청 가능합니다.
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>
          {/* /mp-content */}
        </div>
        {/* /mp-layout */}

      </div>
      {/* /container */}

      {/* ══════════════════════════════
          친구 추천 모달
      ══════════════════════════════ */}
      <div className={`modal-overlay${showReferral?' open':''}`}
        onClick={e => { if (e.target === e.currentTarget) setShowReferral(false); }}>
        <div className="modal-panel">
          <div className="modal-header-row">
            <h2 className="modal-title">🤝 친구 추천</h2>
            <button onClick={() => setShowReferral(false)} className="modal-close-btn">✕</button>
          </div>
          <div className="referral-code-box">
            <div className="referral-code-label">내 추천 코드</div>
            <div className="referral-code">{referralCode}</div>
          </div>
          <button
            className="mp-copy-btn"
            onClick={() => showToastMsg('추천 링크가 복사되었습니다 📋')}
            style={{ width:'100%', padding:'14px', background:'var(--color-accent)', color:'#fff',
              border:'none', borderRadius:8, fontSize:14, fontWeight:700, cursor:'pointer',
              marginBottom:12, fontFamily:'inherit' }}>
            🔗 추천 링크 복사
          </button>
          <div className="referral-stats-grid">
            <div className="referral-stat-box">
              <div className="referral-stat-num">0</div>
              <div className="referral-stat-label">추천한 친구 수</div>
            </div>
            <div className="referral-stat-box">
              <div className="referral-stat-num">0</div>
              <div className="referral-stat-label">받은 쿠폰 수</div>
            </div>
          </div>
          <div className="referral-info-box">
            ✓ 추천받은 분이 가입 시 <strong>즉시 쿠폰 지급</strong><br/>
            ✓ 첫 구매 완료 시 <strong>5,000원 쿠폰</strong> 자동 지급<br/>
            ✓ 양쪽 모두 혜택 적용
          </div>
        </div>
      </div>

      {/* ══════════════════════════════
          취향 설문 모달
      ══════════════════════════════ */}
      <div className={`modal-overlay${showSurvey?' open':''}`}
        onClick={e => { if (e.target === e.currentTarget) setShowSurvey(false); }}>
        <div className="modal-panel">
          <div className="modal-header-row">
            <h2 className="modal-title">🍑 취향 설문</h2>
            <button onClick={() => setShowSurvey(false)} className="modal-close-btn">✕</button>
          </div>
          {/* 진행바 */}
          <div style={{ background:'#f2f2f2', height:4, borderRadius:2, marginBottom:20, overflow:'hidden' }}>
            <div style={{ background:'var(--color-accent)', height:'100%', borderRadius:2,
              width:`${(surveyStep+1)/SURVEYS.length*100}%`, transition:'width .3s' }} />
          </div>
          {(() => {
            const s = SURVEYS[surveyStep];
            return (
              <>
                <div style={{ fontSize:11, color:'#aaa', marginBottom:8 }}>{s.step}/{SURVEYS.length}</div>
                <div style={{ fontSize:15, fontWeight:700, marginBottom:20 }}>{s.q}</div>
                {s.options.map((opt, i) => (
                  <div key={i}
                    className={`survey-option${surveyAnswers[s.step]===i?' selected':''}`}
                    onClick={() => setSurveyAnswers(prev => ({ ...prev, [s.step]: i }))}>
                    {opt}
                  </div>
                ))}
                <div style={{ display:'flex', gap:12, marginTop:20 }}>
                  {surveyStep > 0 && (
                    <button
                      onClick={() => setSurveyStep(n => n-1)}
                      style={{ flex:1, padding:'14px', border:'1.5px solid #EBEBEB', borderRadius:8,
                        background:'#fff', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                      이전
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (surveyStep < SURVEYS.length-1) setSurveyStep(n => n+1);
                      else { setShowSurvey(false); showToastMsg('취향 설문이 저장되었습니다 🎉 +300P 적립!'); }
                    }}
                    style={{ flex:2, padding:'14px', background:'var(--color-accent)', color:'#fff',
                      border:'none', borderRadius:8, fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                    {surveyStep === SURVEYS.length-1 ? '완료' : '다음'}
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      </div>

    </div>
  );
}
