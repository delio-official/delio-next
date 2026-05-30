'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { signOut } from '@/lib/auth';
import { useAuth } from '@/hooks/useAuth';
import TrackingModal from '@/components/TrackingModal/TrackingModal';
import '@/styles/mypage.css';
import '@/styles/category.css';

/* ─── Types ─── */
interface OrderItem {
  product_name: string; quantity: number;
  unit_price: number; subtotal: number;
  thumbnail_url: string | null;
}
interface Order {
  id: string; order_no: string; status: string;
  final_amount: number; created_at: string;
  courier: string | null; tracking_number: string | null;
  order_items: OrderItem[];
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
  image_urls: string[] | null; video_url: string | null;
  products: { name: string; thumbnail_url: string | null; id: string } | null;
}
interface RecentProduct {
  id: string; name: string; price: number; discount_rate: number;
  thumbnail_url: string | null; avg_rating: number; category: string;
}
interface Address {
  id: string; label: string; recipient: string; phone: string;
  zipcode: string; address1: string; address2: string; is_default: boolean;
}
interface UserCoupon {
  id: string; used: boolean; issued_at: string;
  coupon: {
    title: string; discount_type: 'percent' | 'amount'; discount_value: number;
    min_order_amt: number; max_discount: number | null; expires_at: string | null;
  } | null;
}
type PanelType = 'order' | 'point' | 'coupon' | 'recent' | 'wish' | 'benefit' | 'info' | 'myreviews' | 'address' | 'grade' | 'csrefund' | 'cs' | 'survey';

/* 취향 진단 결과 요약 맵 */
const SURVEY_MAP: Record<string, { name:string; tagline:string; emoji:string; color:string; bg:string; fruitRec:string; wellness:string }> = {
  'routine-care-vitamin': { name:'새벽',  tagline:'매일 피어나는 에너지로 주변을 밝히는 사람',      emoji:'🌅', color:'#FF8C42', bg:'linear-gradient(135deg,#FFE0C4,#FFF4EC)', fruitRec:'달고 과즙 넘치는 과일',  wellness:'"루틴이 나를 만들고, 나는 주변을 밝혀요"' },
  'routine-care-healing': { name:'이슬',  tagline:'조용하고 세심하게 주변을 돌보는 사람',          emoji:'💧', color:'#5BA4CF', bg:'linear-gradient(135deg,#DDEEFF,#F0F8FF)', fruitRec:'담백하고 신선한 과일',  wellness:'"세심한 나의 루틴이 주변을 조용히 지켜요"' },
  'routine-self-vitamin': { name:'여름',  tagline:'철저한 루틴으로 스스로 활력을 만드는 사람',      emoji:'☀️', color:'#E8A000', bg:'linear-gradient(135deg,#FFF5CC,#FFFAE8)', fruitRec:'달고 에너지 넘치는 과일', wellness:'"나의 루틴이 나를 가장 강하게 만들어요"' },
  'routine-self-healing': { name:'가을',  tagline:'혼자만의 시간 속에서 깊이 성장하는 사람',        emoji:'🍂', color:'#A07040', bg:'linear-gradient(135deg,#F5ECD8,#FBF6EE)', fruitRec:'담백하고 깔끔한 과일',  wellness:'"고요함 속에서 나는 가장 단단하게 자라요"' },
  'free-care-vitamin':    { name:'봄',    tagline:'자유롭게 움직이며 주변에 활기를 주는 사람',      emoji:'🌸', color:'#E0558A', bg:'linear-gradient(135deg,#FFE0EE,#FFF5F9)', fruitRec:'달고 과즙 넘치는 과일',  wellness:'"계획 없이도 나는 주변을 밝혀요"' },
  'free-care-healing':    { name:'바람',  tagline:'흘러가듯 자연스럽게 온기를 나눠주는 사람',       emoji:'🌬️', color:'#4A9FD4', bg:'linear-gradient(135deg,#D8EEFF,#EEF7FF)', fruitRec:'은은하고 신선한 과일',  wellness:'"자연스럽게 흘러가는 나의 온기가 주변을 데워요"' },
  'free-self-vitamin':    { name:'불꽃',  tagline:'자신만의 취향으로 에너지 넘치게 사는 사람',      emoji:'🔥', color:'#E03030', bg:'linear-gradient(135deg,#FFE0E0,#FFF4F4)', fruitRec:'새콤달콤 강렬한 과일',  wellness:'"새로운 것을 향한 나의 탐험이 곧 나의 웰니스예요"' },
  'free-self-healing':    { name:'달빛',  tagline:'은은하게 자신만의 감각으로 살아가는 사람',       emoji:'🌙', color:'#7050C0', bg:'linear-gradient(135deg,#EDE0FF,#F8F4FF)', fruitRec:'은은하고 깊은 맛의 과일', wellness:'"나만의 감각이 곧 나의 언어예요"' },
};

type CsCategory = 'order' | 'return' | 'product' | 'member' | 'other';
const CS_CATEGORIES: { value: CsCategory; icon: string; name: string; sub: string }[] = [
  { value: 'order',   icon: '🚚', name: '주문/배송',      sub: '배송 조회 · 변경' },
  { value: 'return',  icon: '↩️', name: '취소/교환/반품', sub: '취소 · 반품 · 교환' },
  { value: 'product', icon: '🌿', name: '상품 문의',       sub: '정보 · 재고 · 품질' },
  { value: 'member',  icon: '👤', name: '회원/포인트',     sub: '계정 · 포인트 · 쿠폰' },
  { value: 'other',   icon: '💬', name: '기타',            sub: '그 외 문의' },
];
interface CsInquiry {
  id: string; category: CsCategory; title: string; message: string;
  status: string; answer?: string; created_at: string;
  attachments?: string[];
}

const EMPTY_ADDR = { label:'', recipient:'', phone:'', zipcode:'', address1:'', address2:'' };

/* ─── Constants ─── */
const STATUS_LABEL: Record<string, string> = {
  pending:'결제대기', paid:'결제완료', preparing:'상품준비중',
  shipped:'배송중', delivered:'배송완료', cancelled:'취소됨',
  exchanging:'교환처리중', exchanged:'교환완료',
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
  const [expandedOrder,  setExpandedOrder]  = useState<string | null>(null);
  const [trackingTarget, setTrackingTarget] = useState<{ carrierId: string; trackingNumber: string } | null>(null);
  const [wishlist,       setWishlist]       = useState<WishItem[]>([]);
  const [myReviews,      setMyReviews]      = useState<MyReview[]>([]);
  const [editingId,      setEditingId]      = useState<string | null>(null);
  const [editRating,     setEditRating]     = useState(5);
  const [editContent,    setEditContent]    = useState('');
  const [editSaving,     setEditSaving]     = useState(false);
  const [reviewPhotoModal, setReviewPhotoModal] = useState<MyReview | null>(null);
  const [reviewPhotoIdx,   setReviewPhotoIdx]   = useState(0);
  const [recentPage,       setRecentPage]       = useState(0);
  const [recentProducts, setRecentProducts] = useState<RecentProduct[]>([]);
  const [activePanel,    setActivePanel]    = useState<PanelType>('order');
  const [showMobileMenu, setShowMobileMenu] = useState(true);
  const [wishLoading,    setWishLoading]    = useState(false);
  const [toast,          setToast]          = useState('');
  const [showSurvey,     setShowSurvey]     = useState(false);
  const [surveyStep,     setSurveyStep]     = useState(0);
  const [surveyAnswers,  setSurveyAnswers]  = useState<Record<number, number>>({});

  /* 회원정보 수정 */
  const [infoStep,      setInfoStep]      = useState<'view'|'verify'|'edit'>('view');
  const [editName,      setEditName]      = useState('');
  const [verifyPw,      setVerifyPw]      = useState('');
  const [verifyError,   setVerifyError]   = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
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

  /* 친구 추천 */
  const [referralCode,    setReferralCode]    = useState('');
  const [referralInvited, setReferralInvited] = useState(0);
  const [referralRewarded,setReferralRewarded]= useState(0);

  /* 1:1 문의 */
  const [csTab,       setCsTab]       = useState<'write'|'history'>('write');
  const [csCategory,  setCsCategory]  = useState<CsCategory>('order');
  const [csTitle,     setCsTitle]     = useState('');
  const [csMessage,   setCsMessage]   = useState('');
  const [csLoading,   setCsLoading]   = useState(false);
  const [csDone,      setCsDone]      = useState(false);
  const [csInquiries, setCsInquiries] = useState<CsInquiry[]>([]);
  const [csOpenId,    setCsOpenId]    = useState<string | null>(null);
  const [csFiles,     setCsFiles]     = useState<File[]>([]);
  const [csUploading, setCsUploading] = useState(false);

  /* 취향 진단 결과 */
  const surveyCardRef = useRef<HTMLDivElement>(null);
  const [savingCard,  setSavingCard]  = useState(false);
  interface SurveyRecProduct {
    id: string; name: string; price: number; discounted_price: number;
    discount_rate: number; thumbnail_url: string | null; category: string;
  }
  const [surveyRecProducts, setSurveyRecProducts] = useState<SurveyRecProduct[]>([]);
  const [surveyResult, setSurveyResult] = useState<{
    axis1: string; axis2: string; axis3: string;
    result_label: string; result_desc: string; created_at: string;
  } | null | 'none'>('none'); // 'none' = 아직 로드 전

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
        supabase.from('profiles').select('name,email,point_balance,grade,referral_code').eq('id', user!.id).single(),
        supabase.from('orders')
          .select('id,order_no,status,final_amount,created_at,courier,tracking_number,order_items(product_name,quantity,unit_price,subtotal,thumbnail_url)')
          .eq('user_id', user!.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase.from('reviews')
          .select('id,rating,content,created_at,image_urls,video_url,products(id,name,thumbnail_url)')
          .eq('user_id', user!.id)
          .order('created_at', { ascending: false })
          .limit(30),
      ]);
      setProfile(prof as Profile);
      if ((prof as Profile & { referral_code?: string })?.referral_code) {
        setReferralCode((prof as Profile & { referral_code?: string }).referral_code!);
      }
      setOrders((ords as Order[]) || []);
      setMyReviews((revs as unknown as MyReview[]) || []);

      // 사용 가능 쿠폰 수 (요약 카드용)
      const { count } = await supabase
        .from('user_coupons')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('used', false);
      setAvailableCouponCount(count ?? 0);
    }

    // 최근 본 상품 — localStorage
    try {
      const raw = localStorage.getItem('delio_recent_products');
      setRecentProducts(raw ? JSON.parse(raw) : []);
    } catch { setRecentProducts([]); }

    load();
  }, [user, authLoading, router]);

  /* 친구 추천 — benefit 패널 열릴 때 로드 */
  useEffect(() => {
    if (activePanel !== 'benefit' || !user) return;
    async function loadReferrals() {
      const supabase = createClient();
      const { data } = await supabase
        .from('referrals')
        .select('id,status')
        .eq('referrer_id', user!.id);
      if (data) {
        setReferralInvited(data.length);
        setReferralRewarded(data.filter(r => r.status === 'rewarded').length);
      }
    }
    loadReferrals();
  }, [activePanel, user]);

  /* 1:1 문의 내역 — 패널·탭 열릴 때 로드 */
  useEffect(() => {
    if (activePanel !== 'cs' || csTab !== 'history' || !user) return;
    async function loadCsInquiries() {
      const supabase = createClient();
      const { data } = await supabase
        .from('cs_inquiries')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (data) setCsInquiries(data as CsInquiry[]);
    }
    loadCsInquiries();
  }, [activePanel, csTab, user]);

  /* 취향 진단 결과 카드 저장 */
  async function saveResultCard() {
    if (!surveyCardRef.current || savingCard) return;
    setSavingCard(true);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(surveyCardRef.current, { pixelRatio: 2, skipFonts: true, cacheBust: true });
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], 'delio-wellness.png', { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: 'DELI\'O 웰니스 유형' });
          setSavingCard(false); return;
        }
      }
      const a = document.createElement('a');
      a.href = dataUrl; a.download = 'delio-wellness.png'; a.click();
    } catch { showToastMsg('저장 중 오류가 발생했어요.'); }
    finally { setSavingCard(false); }
  }

  /* 취향 진단 맞춤 상품 로드 */
  useEffect(() => {
    if (activePanel !== 'survey' || !surveyResult || surveyResult === 'none' || surveyRecProducts.length > 0) return;
    async function loadSurveyRecs() {
      const supabase = createClient();
      const cats = (surveyResult as { axis3: string }).axis3 === 'vitamin'
        ? ['citrus', 'berry', 'apple']
        : ['melon', 'grape', 'kiwi'];
      const { data } = await supabase
        .from('products')
        .select('id,name,price,discounted_price,discount_rate,thumbnail_url,category')
        .in('category', cats)
        .eq('is_active', true)
        .order('is_best', { ascending: false })
        .limit(4);
      if (data) setSurveyRecProducts(data as SurveyRecProduct[]);
    }
    loadSurveyRecs();
  }, [activePanel, surveyResult]);

  /* 취향 진단 결과 — 패널 열릴 때 로드 */
  useEffect(() => {
    if (activePanel !== 'survey' || !user || surveyResult !== 'none') return;
    async function loadSurveyResult() {
      const supabase = createClient();
      const { data } = await supabase
        .from('survey_results')
        .select('axis1,axis2,axis3,result_label,result_desc,created_at')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setSurveyResult(data ?? null);
    }
    loadSurveyResult();
  }, [activePanel, user]);

  async function submitCsInquiry(e: React.FormEvent) {
    e.preventDefault();
    if (!csTitle.trim() || !csMessage.trim()) { showToastMsg('제목과 문의 내용을 입력해주세요.'); return; }
    setCsLoading(true);
    const supabase = createClient();

    /* 파일 업로드 */
    const attachmentUrls: string[] = [];
    if (csFiles.length > 0) {
      setCsUploading(true);
      const ts = Date.now();
      for (let i = 0; i < csFiles.length; i++) {
        const file = csFiles[i];
        const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
        /* 한글·공백·특수문자 → 안전한 ASCII 파일명으로 정규화 */
        const safeName = `${ts}_${i}.${ext}`;
        const path = `${user!.id}/${safeName}`;
        const { error: upErr } = await supabase.storage
          .from('cs-attachments')
          .upload(path, file, { upsert: true, contentType: file.type });
        if (upErr) {
          showToastMsg('파일 업로드 실패: ' + file.name + ' (' + upErr.message + ')');
          setCsLoading(false); setCsUploading(false); return;
        }
        const { data: urlData } = supabase.storage.from('cs-attachments').getPublicUrl(path);
        attachmentUrls.push(urlData.publicUrl);
      }
      setCsUploading(false);
    }

    const { error } = await supabase.from('cs_inquiries').insert({
      user_id: user!.id, category: csCategory,
      title: csTitle.trim(), message: csMessage.trim(), status: 'pending',
      attachments: attachmentUrls.length > 0 ? attachmentUrls : null,
    });
    setCsLoading(false);
    if (error) { showToastMsg('문의 등록 실패: ' + error.message); return; }
    setCsFiles([]);
    setCsDone(true);
  }

  /* 쿠폰 — 패널 열릴 때 로드 */
  const [userCoupons, setUserCoupons] = useState<UserCoupon[]>([]);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponTab, setCouponTab] = useState<'available'|'used'>('available');
  const [availableCouponCount, setAvailableCouponCount] = useState(0);
  useEffect(() => {
    if (activePanel !== 'coupon' || !user) return;
    async function loadCoupons() {
      setCouponLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from('user_coupons')
        .select(`id, used, issued_at, coupon:coupon_id(title,discount_type,discount_value,min_order_amt,max_discount,expires_at)`)
        .eq('user_id', user!.id)
        .order('issued_at', { ascending: false });
      setUserCoupons((data as unknown as UserCoupon[]) || []);
      setCouponLoading(false);
    }
    loadCoupons();
  }, [activePanel, user]);

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
  /* ── 리뷰 삭제 ── */
  async function handleDeleteReview(id: string) {
    if (!confirm('리뷰를 삭제할까요?')) return;
    const supabase = createClient();
    const { error } = await supabase.from('reviews').delete().eq('id', id);
    if (error) { alert('삭제 실패: ' + error.message); return; }
    setMyReviews(prev => prev.filter(r => r.id !== id));
  }

  /* ── 리뷰 수정 시작 ── */
  function startEdit(r: MyReview) {
    setEditingId(r.id);
    setEditRating(r.rating);
    setEditContent(r.content);
  }

  /* ── 리뷰 수정 저장 ── */
  async function handleUpdateReview(id: string) {
    if (!editContent.trim()) { alert('내용을 입력해주세요.'); return; }
    setEditSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('reviews')
      .update({ rating: editRating, content: editContent.trim() })
      .eq('id', id);
    setEditSaving(false);
    if (error) { alert('수정 실패: ' + error.message); return; }
    setMyReviews(prev => prev.map(r => r.id === id ? { ...r, rating: editRating, content: editContent.trim() } : r));
    setEditingId(null);
  }

  /* 최근 본 상품 삭제 */
  function removeRecentProduct(id: string) {
    const next = recentProducts.filter(p => p.id !== id);
    setRecentProducts(next);
    try { localStorage.setItem('delio_recent_products', JSON.stringify(next)); } catch {}
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
  async function verifyPassword() {
    if (!verifyPw) { setVerifyError('비밀번호를 입력해주세요.'); return; }
    setVerifyLoading(true);
    setVerifyError('');
    const supabase = createClient();
    const email = profile?.email || user!.email || '';
    const { error } = await supabase.auth.signInWithPassword({ email, password: verifyPw });
    setVerifyLoading(false);
    if (error) {
      setVerifyError('비밀번호가 올바르지 않습니다.');
    } else {
      setEditName(profile?.name || '');
      setEditPwNew(''); setEditPwNew2('');
      setVerifyPw('');
      setInfoStep('edit');
    }
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
    setInfoStep('view');
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
      const { error } = await supabase.from('shipping_addresses').update({ ...addrForm }).eq('id', addrEditing.id);
      if (error) { showToastMsg('저장 실패: ' + error.message); return; }
    } else {
      if (addresses.length >= 5) { showToastMsg('배송지는 최대 5개까지 저장 가능합니다.'); return; }
      const isFirst = addresses.length === 0;
      const { error } = await supabase.from('shipping_addresses').insert({ ...addrForm, user_id: user!.id, is_default: isFirst });
      if (error) { showToastMsg('저장 실패: ' + error.message); return; }
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
    cancelled: orders.filter(o => o.status === 'cancelled').length,
    exchange:  orders.filter(o => o.status === 'exchanging' || o.status === 'exchanged').length,
    refund:    orders.filter(o => o.status === 'refunding' || o.status === 'refunded').length,
  };
  const totalOrderAmount = orders.reduce((s, o) => s + o.final_amount, 0);
  const gradeLabel = ({ normal:'일반', vip:'VIP', vvip:'VVIP' } as Record<string,string>)[profile?.grade || 'normal'] || '일반';

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

      {/* 배송추적 모달 */}
      {trackingTarget && (
        <TrackingModal
          carrierId={trackingTarget.carrierId}
          trackingNumber={trackingTarget.trackingNumber}
          onClose={() => setTrackingTarget(null)}
        />
      )}

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
            <button className="mp-menu-item" onClick={() => goPanel('cs')}>
              <span>1:1 문의</span><IconArrowRight />
            </button>
          </div>

          {/* 나의 취향 */}
          <div className="mp-menu-section">
            <div className="mp-menu-section-title">나의 취향</div>
            <button className="mp-menu-item" onClick={() => goPanel('survey')}>
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
            <button className="mp-menu-item" onClick={() => goPanel('benefit')}>
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
                <button className={`mp-nav-link${activePanel==='cs'?' active':''}`} onClick={() => switchPanel('cs')}>1:1 문의</button>
              </div>
              <div className="mp-nav-section">
                <button className={`mp-nav-link${activePanel==='survey'?' active':''}`} onClick={() => switchPanel('survey')}>내 취향 프로필</button>
                <button className={`mp-nav-link${activePanel==='wish'?' active':''}`} onClick={() => switchPanel('wish')}>위시리스트</button>
                <button className={`mp-nav-link${activePanel==='recent'?' active':''}`} onClick={() => switchPanel('recent')}>최근 본 상품</button>
                <button className={`mp-nav-link${activePanel==='myreviews'?' active':''}`} onClick={() => switchPanel('myreviews')}>내가 쓴 리뷰</button>
              </div>
              <div className="mp-nav-section">
                <button className={`mp-nav-link${activePanel==='benefit'?' active':''}`} onClick={() => switchPanel('benefit')}>친구 초대</button>
                <button className={`mp-nav-link${activePanel==='grade'?' active':''}`} onClick={() => switchPanel('grade')}>회원 등급</button>
              </div>
              <div className="mp-nav-section">
                <button className={`mp-nav-link${activePanel==='info'?' active':''}`} onClick={() => switchPanel('info')}>회원정보 수정</button>
                <button className={`mp-nav-link${activePanel==='address'?' active':''}`} onClick={() => switchPanel('address')}>배송지 관리</button>
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
                  <div className="mp-stat-icon" style={{ fontSize:15, fontWeight:800 }}>₩</div>
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
                    <div className="mp-stat-value">{availableCouponCount}개</div>
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
                <div style={{ display:'flex', alignItems:'stretch', gap:12, paddingTop:4 }}>
                  {/* 왼쪽: 배송 흐름 */}
                  <div className="mp-order-flow" style={{ flex:1 }}>
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

                  {/* 구분선 */}
                  <div style={{ width:1, background:'#E8E8E8', flexShrink:0, margin:'8px 4px' }} />

                  {/* 오른쪽: 취소·교환·반품 */}
                  <div style={{ display:'flex', flexDirection:'column', justifyContent:'center', gap:6, minWidth:180 }}>
                    {[
                      { label:'취소', count: orderCounts.cancelled },
                      { label:'교환', count: orderCounts.exchange },
                      { label:'반품', count: orderCounts.refund },
                    ].map(item => (
                      <div key={item.label}
                        onClick={() => switchPanel('csrefund')}
                        style={{
                          display:'flex', alignItems:'center', justifyContent:'center',
                          padding:'7px 14px', border:'1px solid #E8E8E8', borderRadius:8,
                          cursor:'pointer', background:'#fff', gap:6,
                        }}>
                        <span style={{ fontSize:13, color:'#555' }}>{item.label}</span>
                        <span style={{ fontSize:13, fontWeight:700, color:'#111' }}>:{item.count}</span>
                      </div>
                    ))}
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
                  orders.map(o => {
                    const isExpanded = expandedOrder === o.id;
                    const displayItems = isExpanded ? o.order_items : o.order_items?.slice(0, 2);
                    const hiddenCount = (o.order_items?.length ?? 0) - 2;
                    return (
                      <div key={o.id} style={{ padding:'16px 0', borderBottom:'1px solid #f2f2f2' }}>
                        {/* 헤더 */}
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

                        {/* 상품 목록 */}
                        {displayItems?.map((item, i) => (
                          <div key={i} style={{ display:'flex', gap:12, alignItems:'center', marginBottom:8 }}>
                            <div style={{ width:52, height:52, borderRadius:8, background:'#F7F7F5',
                              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, overflow:'hidden' }}>
                              {item.thumbnail_url
                                ? <img src={item.thumbnail_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                : <span style={{ fontSize:22 }}>🍑</span>}
                            </div>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:13, fontWeight:600 }}>{item.product_name}</div>
                              <div style={{ fontSize:12, color:'#999' }}>
                                {item.quantity}개
                                {item.unit_price > 0 && (
                                  <span style={{ marginLeft:6 }}>· {fmtPrice(item.unit_price)}원</span>
                                )}
                              </div>
                            </div>
                            {item.subtotal > 0 && (
                              <div style={{ fontSize:13, fontWeight:700, color:'#1A1A1A', flexShrink:0 }}>
                                {fmtPrice(item.subtotal)}원
                              </div>
                            )}
                          </div>
                        ))}

                        {/* 더보기 / 접기 버튼 */}
                        {(o.order_items?.length ?? 0) > 2 && (
                          <button
                            onClick={() => setExpandedOrder(isExpanded ? null : o.id)}
                            style={{ fontSize:12, color:'#888', background:'none', border:'1px solid #E8E8E8',
                              borderRadius:6, padding:'5px 12px', cursor:'pointer',
                              fontFamily:'inherit', marginBottom:8, width:'100%' }}>
                            {isExpanded
                              ? '▲ 접기'
                              : `▼ 외 ${hiddenCount}개 상품 더보기`}
                          </button>
                        )}

                        {/* 하단: 금액 + 버튼 */}
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                          borderTop:'1px solid #f5f5f5', paddingTop:10, marginTop:4 }}>
                          <span style={{ fontSize:14, fontWeight:700 }}>{fmtPrice(o.final_amount)}원</span>
                          <div style={{ display:'flex', gap:6 }}>
                            {o.tracking_number && (
                              <button
                                onClick={() => setTrackingTarget({
                                  carrierId: o.courier || 'kr.cjlogistics',
                                  trackingNumber: o.tracking_number!,
                                })}
                                style={{ fontSize:12, padding:'6px 12px', border:'1.5px solid #1A1A1A',
                                  borderRadius:6, background:'#1A1A1A', color:'#fff',
                                  cursor:'pointer', fontWeight:600, fontFamily:'inherit' }}>
                                🚚 배송추적
                              </button>
                            )}
                            {o.status === 'delivered' && (
                              <button onClick={() => showToastMsg('리뷰 작성 기능은 준비 중입니다.')}
                                style={{ fontSize:12, padding:'6px 12px', border:'1.5px solid #EBEBEB',
                                  borderRadius:6, cursor:'pointer', background:'#fff', fontFamily:'inherit' }}>
                                리뷰 작성
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
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
                {couponLoading ? (
                  <div className="mp-empty">불러오는 중...</div>
                ) : (() => {
                  const now = new Date();
                  const available = userCoupons.filter(uc => {
                    if (uc.used) return false;
                    const exp = uc.coupon?.expires_at;
                    return !exp || new Date(exp) >= now;
                  });
                  const used = userCoupons.filter(uc => uc.used);
                  const tabList = couponTab === 'available' ? available : used;
                  return (
                    <>
                      {/* 탭 요약 카드 */}
                      <div style={{ display:'flex', gap:10, marginTop:16, marginBottom:4 }}>
                        {([
                          { key:'available', label:'사용 가능', count: available.length, color:'#1A1A1A' },
                          { key:'used',      label:'사용 완료', count: used.length,      color:'#999' },
                        ] as const).map(t => {
                          const isActive = couponTab === t.key;
                          return (
                            <button key={t.key} onClick={() => setCouponTab(t.key)} style={{
                              flex:1, padding:'14px 0', borderRadius:12, cursor:'pointer',
                              border: isActive ? `2px solid ${t.color}` : '2px solid #EBEBEB',
                              background: isActive ? (t.key==='available' ? '#1A1A1A' : '#F5F5F5') : '#fff',
                              transition:'all .15s', fontFamily:'inherit',
                            }}>
                              <div style={{
                                fontSize:22, fontWeight:800,
                                color: isActive ? (t.key==='available' ? '#fff' : '#555') : '#1A1A1A',
                                marginBottom:4,
                              }}>{t.count}</div>
                              <div style={{
                                fontSize:12,
                                color: isActive ? (t.key==='available' ? 'rgba(255,255,255,0.75)' : '#888') : '#aaa',
                              }}>{t.label}</div>
                            </button>
                          );
                        })}
                      </div>

                      {tabList.length === 0 ? (
                        <div className="mp-empty">
                          {couponTab === 'available' ? '사용 가능한 쿠폰이 없습니다.' : '사용 완료된 쿠폰이 없습니다.'}
                        </div>
                      ) : (
                        <div style={{ display:'flex', flexDirection:'column', gap:12, marginTop:12 }}>
                          {tabList.map(uc => {
                            const c = uc.coupon;
                            if (!c) return null;
                            const exp = c.expires_at;
                            const expired = exp ? new Date(exp) < now : false;
                            const inactive = uc.used || expired;
                            const isPercent = c.discount_type === 'percent';
                            const discLabel = isPercent
                              ? `${c.discount_value}% 할인`
                              : `${c.discount_value.toLocaleString()}원 즉시 할인`;
                            const leftBg = inactive ? '#C8C8C8' : '#1A1A1A';
                            return (
                              <div key={uc.id} style={{
                                display:'flex', borderRadius:14, overflow:'hidden',
                                border:`1.5px solid ${inactive ? '#E5E5E5' : '#D4D4D4'}`,
                                boxShadow: inactive ? 'none' : '0 2px 10px rgba(0,0,0,0.07)',
                                opacity: inactive ? 0.6 : 1,
                                background:'#fff',
                                position:'relative',
                              }}>
                                {/* 왼쪽 컬러 패널 */}
                                <div style={{
                                  width:150, flexShrink:0,
                                  background: leftBg,
                                  display:'flex', flexDirection:'column',
                                  alignItems:'center', justifyContent:'center',
                                  padding:'18px 6px', gap:2,
                                }}>
                                  {isPercent ? (
                                    <>
                                      <span style={{ fontSize:32, fontWeight:900, color:'#fff', lineHeight:1 }}>{c.discount_value}</span>
                                      <span style={{ fontSize:16, fontWeight:700, color:'rgba(255,255,255,0.85)', lineHeight:1 }}>%</span>
                                    </>
                                  ) : (
                                    <>
                                      <span style={{ fontSize:20, fontWeight:900, color:'#fff', lineHeight:1 }}>{c.discount_value.toLocaleString()}</span>
                                      <span style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.8)', lineHeight:1 }}>원</span>
                                    </>
                                  )}
                                  <span style={{ fontSize:9, color:'rgba(255,255,255,0.5)', marginTop:4, letterSpacing:'0.08em' }}>COUPON</span>
                                </div>

                                {/* 퍼포레이션 — 위아래 반원 + 점선 */}
                                <div style={{ position:'relative', width:0, flexShrink:0, zIndex:2 }}>
                                  {/* 위 반원 */}
                                  <div style={{
                                    position:'absolute', top:-1, left:-11,
                                    width:22, height:11, borderRadius:'0 0 11px 11px',
                                    background:'#F2F2F2', border:'1.5px solid #E0E0E0', borderTop:'none',
                                  }} />
                                  {/* 아래 반원 */}
                                  <div style={{
                                    position:'absolute', bottom:-1, left:-11,
                                    width:22, height:11, borderRadius:'11px 11px 0 0',
                                    background:'#F2F2F2', border:'1.5px solid #E0E0E0', borderBottom:'none',
                                  }} />
                                  {/* 점선 */}
                                  <div style={{ position:'absolute', top:10, bottom:10, left:0, borderLeft:'2px dashed #E0E0E0' }} />
                                </div>

                                {/* 오른쪽 내용 */}
                                <div style={{
                                  flex:1, padding:'16px 16px 16px 18px',
                                  display:'flex', justifyContent:'space-between', alignItems:'center', gap:10,
                                }}>
                                  <div style={{ flex:1, minWidth:0 }}>
                                    <div style={{ fontSize:14, fontWeight:700, color:'#1A1A1A', marginBottom:4,
                                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                      {c.title}
                                    </div>
                                    <div style={{ fontSize:12, color: inactive ? '#bbb' : '#CB1D11', fontWeight:600, marginBottom:3 }}>
                                      {discLabel}
                                    </div>
                                    <div style={{ fontSize:11, color:'#C0C0C0', display:'flex', flexWrap:'wrap', gap:'0 8px' }}>
                                      {c.min_order_amt > 0 && <span>{c.min_order_amt.toLocaleString()}원 이상</span>}
                                      {exp && <span>~{new Date(exp).toLocaleDateString('ko-KR')} 까지</span>}
                                    </div>
                                  </div>
                                  <div style={{
                                    flexShrink:0, fontSize:11, fontWeight:700,
                                    padding:'5px 10px', borderRadius:99,
                                    background: uc.used ? '#F3F3F3' : expired ? '#F3F3F3' : '#ECFDF5',
                                    color: uc.used ? '#aaa' : expired ? '#aaa' : '#16A34A',
                                    whiteSpace:'nowrap',
                                  }}>
                                    {uc.used ? '사용완료' : expired ? '만료됨' : '사용가능'}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()}
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
                ) : (() => {
                  const RECENT_PER_PAGE = 10;
                  const totalPages = Math.max(1, Math.ceil(recentProducts.length / RECENT_PER_PAGE));
                  const safePage = Math.min(recentPage, totalPages - 1);
                  const paged = recentProducts.slice(safePage * RECENT_PER_PAGE, (safePage + 1) * RECENT_PER_PAGE);
                  const pageNums = Array.from({ length: totalPages }, (_, i) => i);

                  return (
                    <>
                      <div className="mp-wish-grid">
                        {paged.map(p => (
                          <div key={p.id} className="mp-wish-item" style={{ position:'relative' }}>
                            <div className="mp-wish-img">
                              {p.thumbnail_url
                                ? <img src={p.thumbnail_url} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                : <span>{EMOJI_MAP[p.category] || EMOJI_MAP.default}</span>}
                              <button className="mp-wish-del"
                                onClick={e => { e.stopPropagation(); removeRecentProduct(p.id); }}>✕</button>
                            </div>
                            <Link href={`/product/${p.id}`} style={{ textDecoration:'none', color:'inherit' }}>
                              <div className="mp-wish-body">
                                <div className="mp-wish-name">{p.name}</div>
                                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                                  {p.discount_rate > 0 && (
                                    <span style={{ fontSize:11, fontWeight:700, color:'var(--color-accent)' }}>
                                      {p.discount_rate}%
                                    </span>
                                  )}
                                  <span className="mp-wish-price">{fmtPrice(p.price)}원</span>
                                </div>
                              </div>
                            </Link>
                          </div>
                        ))}
                      </div>

                      {/* 페이지네이션 */}
                      <div className="pagination" style={{ marginTop:24 }}>
                        <button className="page-btn" onClick={() => setRecentPage(0)} disabled={safePage === 0}>«</button>
                        <button className="page-btn" onClick={() => setRecentPage(p => Math.max(0, p - 1))} disabled={safePage === 0}>‹</button>
                        {pageNums.map(n => (
                          <button key={n} className={`page-btn page-num${safePage === n ? ' active' : ''}`}
                            onClick={() => setRecentPage(n)}>
                            {n + 1}
                          </button>
                        ))}
                        <button className="page-btn" onClick={() => setRecentPage(p => Math.min(totalPages - 1, p + 1))} disabled={safePage === totalPages - 1}>›</button>
                        <button className="page-btn" onClick={() => setRecentPage(totalPages - 1)} disabled={safePage === totalPages - 1}>»</button>
                      </div>
                    </>
                  );
                })()}
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
                            {/* 상품 제목 — 클릭 시 상품 상세페이지 */}
                            {r.products?.id ? (
                              <Link href={`/product/${r.products.id}`}
                                style={{ fontSize:12, color:'#555', marginBottom:3, display:'block',
                                  textDecoration:'none', fontWeight:500 }}
                                onClick={e => e.stopPropagation()}>
                                {r.products.name}
                              </Link>
                            ) : (
                              <div style={{ fontSize:12, color:'#999', marginBottom:3 }}>삭제된 상품</div>
                            )}

                            {editingId === r.id ? (
                              /* ── 수정 폼 ── */
                              <div>
                                {/* 별점 선택 */}
                                <div style={{ display:'flex', gap:3, marginBottom:8 }}>
                                  {[1,2,3,4,5].map(s => (
                                    <button key={s} onClick={() => setEditRating(s)}
                                      style={{ background:'none', border:'none', cursor:'pointer', padding:0 }}>
                                      <svg viewBox="0 0 20 20" width="20" height="20">
                                        <polygon points="10,1.5 12.65,7.18 19,8.09 14.5,12.49 15.78,18.82 10,15.72 4.22,18.82 5.5,12.49 1,8.09 7.35,7.18"
                                          fill={s <= editRating ? '#F5A623' : '#E0DFDB'} />
                                      </svg>
                                    </button>
                                  ))}
                                </div>
                                <textarea
                                  value={editContent}
                                  onChange={e => setEditContent(e.target.value)}
                                  rows={4}
                                  style={{ width:'100%', padding:'10px 12px', fontSize:13,
                                    border:'1.5px solid #E0DFDB', borderRadius:8, resize:'none',
                                    outline:'none', fontFamily:'inherit', lineHeight:1.6,
                                    boxSizing:'border-box' }}
                                />
                                <div style={{ display:'flex', gap:8, marginTop:8 }}>
                                  <button
                                    onClick={() => handleUpdateReview(r.id)}
                                    disabled={editSaving}
                                    style={{ flex:1, padding:'8px', background:'#1A1A1A', color:'#fff',
                                      border:'none', borderRadius:8, fontSize:13, fontWeight:700,
                                      cursor: editSaving ? 'not-allowed' : 'pointer',
                                      opacity: editSaving ? 0.6 : 1 }}>
                                    {editSaving ? '저장 중...' : '저장'}
                                  </button>
                                  <button
                                    onClick={() => setEditingId(null)}
                                    style={{ padding:'8px 16px', background:'#F0F0F0', color:'#555',
                                      border:'none', borderRadius:8, fontSize:13, cursor:'pointer' }}>
                                    취소
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* ── 일반 표시 ── */
                              <>
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
                                {/* 사진/영상 미리보기 — 클릭 시 해당 항목으로 모달 오픈 */}
                                {((r.image_urls && r.image_urls.length > 0) || r.video_url) && (
                                  <div style={{ display:'flex', gap:4, marginTop:8, flexWrap:'wrap' }}>
                                    {(r.image_urls || []).map((url, i) => (
                                      <img key={i} src={url} alt=""
                                        onClick={() => { setReviewPhotoModal(r); setReviewPhotoIdx(i); }}
                                        style={{ width:44, height:44, borderRadius:6, objectFit:'cover',
                                          border:'1px solid #EBEBEB', cursor:'pointer' }} />
                                    ))}
                                    {r.video_url && (
                                      <div
                                        onClick={() => { setReviewPhotoModal(r); setReviewPhotoIdx((r.image_urls?.length ?? 0)); }}
                                        style={{ width:44, height:44, borderRadius:6, background:'#222',
                                          display:'flex', alignItems:'center', justifyContent:'center',
                                          fontSize:16, color:'#fff', border:'1px solid #444', cursor:'pointer' }}>▶</div>
                                    )}
                                  </div>
                                )}
                                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:6 }}>
                                  <span style={{ fontSize:11, color:'#bbb' }}>
                                    {new Date(r.created_at).toLocaleDateString('ko-KR')}
                                  </span>
                                  <div style={{ display:'flex', gap:8 }}>
                                    <button onClick={() => startEdit(r)}
                                      style={{ background:'none', border:'1px solid #D8D8D8',
                                        borderRadius:6, padding:'4px 10px', fontSize:12,
                                        color:'#555', cursor:'pointer' }}>
                                      수정
                                    </button>
                                    <button onClick={() => handleDeleteReview(r.id)}
                                      style={{ background:'none', border:'1px solid #D8D8D8',
                                        borderRadius:6, padding:'4px 10px', fontSize:12,
                                        color:'#E53935', cursor:'pointer' }}>
                                      삭제
                                    </button>
                                  </div>
                                </div>
                              </>
                            )}
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

            {/* ═══ 친구 초대 ═══ */}
            <div className={`mp-panel${activePanel==='benefit'?' active':''}`}>
              <button className="mp-panel-back" onClick={goBackMenu}><IconArrowLeft /></button>
              <div className="mp-section">
                <div className="mp-section-header">
                  <span className="mp-section-title">친구 초대</span>
                </div>
                <div style={{ paddingTop:28, maxWidth:400, margin:'0 auto' }}>
                  {/* 헤더 텍스트 */}
                  <div style={{ textAlign:'center', marginBottom:24 }}>
                    <p style={{ fontSize:14, color:'#555', marginBottom:6 }}>지금 델리오에 친구를 초대하면</p>
                    <p style={{ fontSize:22, fontWeight:900, color:'#111', lineHeight:1.3 }}>친구도 나도 더블 할인!</p>
                  </div>

                  {/* 쿠폰 카드 */}
                  <div style={{ background:'#C8E63C', borderRadius:14, padding:'22px 24px',
                    marginBottom:20, position:'relative', overflow:'hidden' }}>
                    <div style={{ position:'absolute', left:-14, top:'50%', transform:'translateY(-50%)',
                      width:28, height:28, borderRadius:'50%', background:'#fff' }} />
                    <div style={{ position:'absolute', right:-14, top:'50%', transform:'translateY(-50%)',
                      width:28, height:28, borderRadius:'50%', background:'#fff' }} />
                    <div style={{ textAlign:'center' }}>
                      <p style={{ fontSize:13, fontWeight:700, color:'#555', marginBottom:6, letterSpacing:0.5 }}>
                        <span style={{ fontStyle:'italic', color:'#222' }}>DELI</span>
                        <span style={{ fontStyle:'italic', fontWeight:900, color:'#111' }}>'O</span>
                      </p>
                      <p style={{ fontSize:44, fontWeight:900, color:'#111', lineHeight:1, letterSpacing:-1 }}>1,000</p>
                      <p style={{ fontSize:13, color:'#555', marginTop:4, fontWeight:600 }}>적립금</p>
                    </div>
                  </div>

                  {/* 설명 */}
                  <p style={{ textAlign:'center', fontSize:13, color:'#666', lineHeight:1.7, marginBottom:24 }}>
                    초대 받은 친구의 첫 구매가 완료되면<br />
                    나와 친구 모두 적립금 1,000원을 받을 수 있어요.
                  </p>

                  {/* 내 추천 코드 */}
                  <div style={{ background:'#F7F7F5', borderRadius:12, padding:'16px 20px',
                    textAlign:'center', marginBottom:12 }}>
                    <div style={{ fontSize:11, color:'#aaa', marginBottom:6 }}>내 추천 코드</div>
                    <div style={{ fontSize:22, fontWeight:800, color:'#111', letterSpacing:2 }}>
                      {referralCode || '로딩 중...'}
                    </div>
                  </div>

                  {/* 통계 */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:20 }}>
                    <div style={{ background:'#F7F7F5', borderRadius:10, padding:'14px', textAlign:'center' }}>
                      <div style={{ fontSize:22, fontWeight:800, color:'#111' }}>{referralInvited}</div>
                      <div style={{ fontSize:11, color:'#aaa', marginTop:4 }}>초대한 친구</div>
                    </div>
                    <div style={{ background:'#F7F7F5', borderRadius:10, padding:'14px', textAlign:'center' }}>
                      <div style={{ fontSize:22, fontWeight:800, color:'#2D7A4D' }}>{referralRewarded}</div>
                      <div style={{ fontSize:11, color:'#aaa', marginTop:4 }}>적립금 지급 완료</div>
                    </div>
                  </div>

                  {/* 버튼들 */}
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    <button
                      onClick={() => showToastMsg('카카오톡 공유 기능은 SDK 연동 후 활성화됩니다.')}
                      style={{ width:'100%', padding:'16px', background:'#FEE500', color:'#3C1E1E',
                        border:'none', borderRadius:12, fontSize:15, fontWeight:800,
                        cursor:'pointer', fontFamily:'inherit', display:'flex',
                        alignItems:'center', justifyContent:'center', gap:8 }}>
                      카카오톡으로 초대하기
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(referralCode)
                          .then(() => showToastMsg(`코드가 복사되었습니다 📋  ${referralCode}`));
                      }}
                      style={{ width:'100%', padding:'16px', background:'#1A1A1A', color:'#fff',
                        border:'none', borderRadius:12, fontSize:15, fontWeight:800,
                        cursor:'pointer', fontFamily:'inherit', display:'flex',
                        alignItems:'center', justifyContent:'center', gap:8 }}>
                      코드 복사하기
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ═══ 회원정보 수정 ═══ */}
            <div className={`mp-panel${activePanel==='info'?' active':''}`}>
              <button className="mp-panel-back" onClick={goBackMenu}><IconArrowLeft /></button>
              <div className="mp-section">
                <div className="mp-section-header">
                  <span className="mp-section-title">회원정보 수정</span>
                  {infoStep === 'view' && (
                    <button onClick={() => { setVerifyPw(''); setVerifyError(''); setInfoStep('verify'); }}
                      style={{ marginLeft:'auto', fontSize:12, color:'#111', background:'none',
                        border:'1px solid #111', borderRadius:6, padding:'4px 10px',
                        cursor:'pointer', fontFamily:'inherit' }}>
                      수정하기
                    </button>
                  )}
                </div>
                <div style={{ paddingTop:16 }}>

                  {/* ── 보기 모드 ── */}
                  {infoStep === 'view' && (
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
                  )}

                  {/* ── 비밀번호 확인 단계 ── */}
                  {infoStep === 'verify' && (
                    <div style={{ maxWidth:400 }}>
                      <div style={{ fontSize:14, color:'#555', marginBottom:20, lineHeight:1.6 }}>
                        회원정보 수정을 위해<br />현재 비밀번호를 확인해주세요.
                      </div>
                      <div style={{ marginBottom:12 }}>
                        <label style={{ display:'block', fontSize:12, color:'#888', marginBottom:6 }}>현재 비밀번호</label>
                        <input type="password" value={verifyPw}
                          onChange={e => { setVerifyPw(e.target.value); setVerifyError(''); }}
                          onKeyDown={e => e.key === 'Enter' && verifyPassword()}
                          placeholder="비밀번호 입력"
                          style={{ width:'100%', height:46, padding:'0 12px',
                            border:`1.5px solid ${verifyError ? '#E55A4B' : '#EBEBEB'}`,
                            borderRadius:8, fontSize:14, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }} />
                        {verifyError && <p style={{ fontSize:12, color:'#E55A4B', marginTop:6 }}>{verifyError}</p>}
                      </div>
                      <div style={{ display:'flex', gap:10, marginTop:20 }}>
                        <button onClick={() => setInfoStep('view')}
                          style={{ flex:1, padding:'14px', border:'1.5px solid #EBEBEB', borderRadius:8,
                            background:'#fff', fontSize:14, fontWeight:600, cursor:'pointer',
                            color:'#888', fontFamily:'inherit' }}>
                          취소
                        </button>
                        <button onClick={verifyPassword} disabled={verifyLoading}
                          style={{ flex:2, padding:'14px', background:'#1A1A1A', color:'#fff',
                            border:'none', borderRadius:8, fontSize:14, fontWeight:700,
                            cursor:'pointer', opacity: verifyLoading ? 0.7 : 1, fontFamily:'inherit' }}>
                          {verifyLoading ? '확인 중...' : '확인'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── 편집 모드 ── */}
                  {infoStep === 'edit' && (
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
                        <button onClick={() => setInfoStep('view')}
                          style={{ flex:1, padding:'14px', border:'1.5px solid #EBEBEB', borderRadius:8,
                            background:'#fff', fontSize:14, fontWeight:600, cursor:'pointer',
                            color:'#888', fontFamily:'inherit' }}>
                          취소
                        </button>
                        <button onClick={saveInfo} disabled={infoSaving}
                          style={{ flex:2, padding:'14px', background:'#1A1A1A', color:'#fff',
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

                {/* 타이틀 */}
                <div style={{ textAlign:'center', padding:'8px 0 20px', borderBottom:'1px solid #E8E8E8', marginBottom:16 }}>
                  <div style={{ fontSize:16, fontWeight:700, color:'#111' }}>배송지 관리</div>
                </div>

                {addrLoading ? (
                  <div className="mp-empty">불러오는 중...</div>
                ) : (
                  <>
                    {/* 배송지 추가 버튼 (상단) */}
                    {!addrFormOpen && addresses.length < 5 && (
                      <div style={{ textAlign:'center', marginBottom:6 }}>
                        <button onClick={() => { setAddrEditing(null); setAddrForm({ ...EMPTY_ADDR }); setAddrFormOpen(true); }}
                          style={{ padding:'12px 40px', background:'#F2F2F2', border:'none',
                            borderRadius:999, fontSize:14, fontWeight:600, color:'#333',
                            cursor:'pointer', fontFamily:'inherit' }}>
                          배송지 추가 +
                        </button>
                      </div>
                    )}
                    <p style={{ textAlign:'center', fontSize:11, color:'#aaa', marginBottom:16 }}>
                      *입력하신 주소에 따라 주문 가능한 상품이 변경될 수 있습니다.
                    </p>

                    {/* 추가/수정 폼 */}
                    {addrFormOpen && (
                      <div style={{ background:'#F7F7F5', borderRadius:10, padding:'16px', marginBottom:16 }}>
                        <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>
                          {addrEditing ? '배송지 수정' : '새 배송지 추가'}
                        </div>
                        {[
                          ['배송지명', 'label', 'text', '예: 집, 회사 (선택)'],
                          ['받는 분 *', 'recipient', 'text', '이름 입력'],
                          ['전화번호 *', 'phone', 'tel', '숫자만 입력'],
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
                        <div style={{ marginBottom:10 }}>
                          <label style={{ display:'block', fontSize:12, color:'#888', marginBottom:5 }}>주소 *</label>
                          <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                            <input readOnly placeholder="우편번호" value={addrForm.zipcode}
                              style={{ flex:1, height:44, padding:'0 12px', border:'1.5px solid #EBEBEB',
                                borderRadius:8, fontSize:14, background:'#fff', fontFamily:'inherit', boxSizing:'border-box' }} />
                            <button type="button"
                              onClick={() => openAddressPost((zip, addr) => setAddrForm(f => ({ ...f, zipcode: zip, address1: addr })))}
                              style={{ height:44, padding:'0 14px', border:'1.5px solid #111',
                                borderRadius:8, background:'#fff', color:'#111',
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
                            style={{ flex:2, padding:'12px', background:'#1A1A1A', color:'#fff',
                              border:'none', borderRadius:8, fontSize:13, fontWeight:700,
                              cursor:'pointer', fontFamily:'inherit' }}>
                            저장
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 테이블 헤더 */}
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr 1fr 1fr',
                      borderTop:'1px solid #E8E8E8', borderBottom:'1px solid #E8E8E8',
                      padding:'10px 8px', marginBottom:0 }}>
                      {['배송지명','주소','받는분','전화번호'].map(h => (
                        <div key={h} style={{ fontSize:12, color:'#888', fontWeight:600, textAlign:'center' }}>{h}</div>
                      ))}
                    </div>

                    {/* 배송지 목록 */}
                    {addresses.length === 0 && !addrFormOpen ? (
                      <div className="mp-empty">배송지가 없습니다.</div>
                    ) : (
                      addresses.map(a => (
                        <div key={a.id} style={{ display:'grid', gridTemplateColumns:'1fr 2fr 1fr 1fr',
                          padding:'14px 8px', borderBottom:'1px solid #F2F2F2', alignItems:'center' }}>
                          {/* 배송지명 */}
                          <div style={{ textAlign:'center' }}>
                            <div style={{ fontSize:13, fontWeight:600, color:'#111' }}>{a.label || '-'}</div>
                            {a.is_default && (
                              <span style={{ fontSize:10, background:'#111', color:'#fff',
                                padding:'1px 6px', borderRadius:3, fontWeight:700, marginTop:3, display:'inline-block' }}>기본</span>
                            )}
                          </div>
                          {/* 주소 */}
                          <div style={{ fontSize:12, color:'#555', lineHeight:1.5, padding:'0 8px' }}>
                            {a.zipcode && <span style={{ color:'#aaa' }}>[{a.zipcode}] </span>}
                            {a.address1} {a.address2}
                          </div>
                          {/* 받는분 */}
                          <div style={{ fontSize:13, color:'#333', textAlign:'center', fontWeight:500 }}>{a.recipient}</div>
                          {/* 전화번호 */}
                          <div style={{ fontSize:12, color:'#555', textAlign:'center' }}>{a.phone}</div>

                          {/* 수정/삭제/기본설정 — 하단 행 */}
                          <div style={{ gridColumn:'1/-1', display:'flex', gap:8, justifyContent:'flex-end',
                            paddingTop:8, marginTop:4, borderTop:'1px solid #F7F7F7' }}>
                            {!a.is_default && (
                              <button onClick={() => setDefaultAddress(a.id)}
                                style={{ fontSize:11, color:'#555', background:'none', border:'1px solid #ddd',
                                  borderRadius:4, padding:'3px 8px', cursor:'pointer', fontFamily:'inherit' }}>
                                기본 설정
                              </button>
                            )}
                            <button onClick={() => { setAddrEditing(a); setAddrForm({ label:a.label, recipient:a.recipient, phone:a.phone, zipcode:a.zipcode, address1:a.address1, address2:a.address2 }); setAddrFormOpen(true); }}
                              style={{ fontSize:11, color:'#555', background:'none', border:'1px solid #ddd',
                                borderRadius:4, padding:'3px 8px', cursor:'pointer', fontFamily:'inherit' }}>
                              수정
                            </button>
                            <button onClick={() => deleteAddress(a.id)}
                              style={{ fontSize:11, color:'#E55A4B', background:'none', border:'1px solid #fcc',
                                borderRadius:4, padding:'3px 8px', cursor:'pointer', fontFamily:'inherit' }}>
                              삭제
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ═══ 회원 등급 ═══ */}
            <div className={`mp-panel${activePanel==='grade'?' active':''}`}>
              <button className="mp-panel-back" onClick={goBackMenu}><IconArrowLeft /></button>
              <div className="mp-section">
                {(() => {
                  const GRADES = [
                    {
                      key:'normal', letter:'N', label:'NORMAL', criteria:'5만원 미만',
                      badgeBg:'#888', textColor:'#888',
                      benefits:[
                        { text:'첫 구매 무료배송\nCOUPON', count:1 },
                        { text:'포인트 1% 적립', count:null },
                        { text:'생일 쿠폰 제공', count:null },
                      ],
                    },
                    {
                      key:'vip', letter:'V', label:'VIP', criteria:'5만원 이상',
                      badgeBg:'#C8841C', textColor:'#C8841C',
                      benefits:[
                        { text:'5만원 이상 구매시\n무료배송 COUPON', count:1 },
                        { text:'포인트 2% 적립', count:null },
                        { text:'생일 쿠폰 제공', count:null },
                        { text:'VIP 전용 특가 접근', count:null },
                        { text:'우선 CS 지원', count:null },
                      ],
                    },
                    {
                      key:'vvip', letter:'VV', label:'VVIP', criteria:'20만원 이상',
                      badgeBg:'#1A1A1A', textColor:'#1A1A1A',
                      benefits:[
                        { text:'5만원 이상 구매시\n무료배송 COUPON', count:1 },
                        { text:'10만원 이상 구매시\n무료배송 COUPON', count:1 },
                        { text:'포인트 3% 적립', count:null },
                        { text:'신제품 한정수량\n선구매 기회 제공', count:null, icon:'🎁' },
                        { text:'전담 CS 매니저', count:null },
                        { text:'생일 프리미엄 선물', count:null, icon:'🎀' },
                      ],
                    },
                  ];
                  const cur = profile?.grade ?? 'normal';
                  const curIdx = Math.max(0, GRADES.findIndex(g => g.key === cur));
                  const nextGrade = curIdx < GRADES.length - 1 ? GRADES[curIdx + 1] : null;
                  const targets = [0, 50000, 200000];
                  const pct = nextGrade ? Math.min(totalOrderAmount / targets[curIdx + 1] * 100, 100) : 100;

                  return (
                    <>
                      {/* 타이틀 */}
                      <div style={{ textAlign:'center', padding:'24px 0 18px' }}>
                        <div style={{ fontSize:20, fontWeight:700, color:'#111', marginBottom:8, fontFamily:'Georgia, serif' }}>
                          Delio Membership
                        </div>
                        <div style={{ fontSize:12, color:'#888' }}>
                          멤버십 등급은 누적 구매 금액을 기준으로 산정됩니다.
                        </div>
                      </div>
                      <div style={{ height:1, background:'#CFCFCF', marginBottom:28 }} />

                      {/* 등급 헤더 3열 */}
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', marginBottom:24 }}>
                        {GRADES.map((g) => {
                          const isActive = g.key === cur;
                          return (
                            <div key={g.key} style={{ textAlign:'center', padding:'0 4px 0' }}>
                              {/* 원형 뱃지 */}
                              <div style={{
                                width:60, height:60, borderRadius:'50%',
                                background: isActive ? g.badgeBg : '#D8D8D8',
                                color:'#fff', fontSize:isActive ? 16 : 13, fontWeight:800,
                                display:'flex', alignItems:'center', justifyContent:'center',
                                margin:'0 auto 12px',
                              }}>{g.letter}</div>
                              {/* 등급명 */}
                              <div style={{ fontSize:13, fontWeight:800, color: isActive ? '#111' : '#bbb', marginBottom:10, letterSpacing:0.5 }}>
                                {g.label}
                              </div>
                              {/* 기준 라벨 */}
                              <div style={{ fontSize:10, color:'#bbb', marginBottom:5, lineHeight:1.5 }}>
                                최근 3개월간<br />누적 구매 금액
                              </div>
                              {/* 기준 금액 */}
                              <div style={{ fontSize:15, fontWeight:800, color: isActive ? '#111' : '#bbb' }}>
                                {g.criteria}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* 진행 바 */}
                      <div style={{ background:'#F7F7F5', borderRadius:10, padding:'14px 16px', marginBottom:24 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:8 }}>
                          <span style={{ color:'#888' }}>누적 구매금액</span>
                          <span style={{ fontWeight:800, color:'#111' }}>{fmtPrice(totalOrderAmount)}원</span>
                        </div>
                        <div style={{ height:5, background:'#E4E4E4', borderRadius:3, overflow:'hidden', marginBottom:7 }}>
                          <div style={{ height:'100%', width:`${pct}%`, borderRadius:3, transition:'width .5s',
                            background: nextGrade
                              ? `linear-gradient(90deg,${GRADES[curIdx].badgeBg},${nextGrade.badgeBg})`
                              : GRADES[curIdx].badgeBg }} />
                        </div>
                        <div style={{ fontSize:11, textAlign:'right' }}>
                          {nextGrade
                            ? <span style={{ color: nextGrade.badgeBg, fontWeight:700 }}>
                                {nextGrade.label}까지 {fmtPrice(Math.max(targets[curIdx+1] - totalOrderAmount, 0))}원 남음
                              </span>
                            : <span style={{ color:'#555', fontWeight:700 }}>🎉 최고 등급 달성!</span>
                          }
                        </div>
                      </div>

                      {/* 혜택 카드 그리드 */}
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, alignItems:'start' }}>
                        {GRADES.map((g) => {
                          const isActive = g.key === cur;
                          const accentColor = isActive ? g.badgeBg : '#D0D0D0';
                          return (
                            <div key={g.key} style={{ display:'flex', flexDirection:'column', gap:8 }}>
                              {g.benefits.map((b, bi) => (
                                /* 쿠폰 카드 */
                                <div key={bi} style={{
                                  display:'flex',
                                  borderRadius:8,
                                  border:`1px solid ${isActive ? accentColor+'55' : '#E8E8E8'}`,
                                  overflow:'hidden',
                                  background:'#fff',
                                  minHeight:58,
                                }}>
                                  {/* 왼쪽 컬러 바 */}
                                  <div style={{ width:4, flexShrink:0, background: accentColor }} />

                                  {/* 텍스트 영역 */}
                                  <div style={{
                                    flex:1, padding:'11px 10px',
                                    display:'flex', alignItems:'center',
                                    fontSize:11, lineHeight:1.6,
                                    color: isActive ? '#222' : '#bbb',
                                    whiteSpace:'pre-line',
                                    fontWeight: isActive ? 500 : 400,
                                  }}>
                                    {b.text}
                                  </div>

                                  {/* 오른쪽 스텁 — 점선 구분 + 뱃지/아이콘 */}
                                  {(b.count || b.icon) && (
                                    <div style={{
                                      flexShrink:0, width:52,
                                      borderLeft:`1.5px dashed ${isActive ? accentColor+'88' : '#E0E0E0'}`,
                                      display:'flex', flexDirection:'column',
                                      alignItems:'center', justifyContent:'center',
                                      gap:2,
                                      background: isActive ? accentColor+'0D' : '#FAFAFA',
                                    }}>
                                      {b.count && (
                                        <div style={{
                                          fontSize:9, fontWeight:800,
                                          color: isActive ? accentColor : '#bbb',
                                          textAlign:'center', lineHeight:1.3,
                                        }}>×{b.count}</div>
                                      )}
                                      {b.icon && (
                                        <div style={{ fontSize:15 }}>{b.icon}</div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
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

            {/* ═══ 1:1 문의 ═══ */}
            <div className={`mp-panel${activePanel==='cs'?' active':''}`}>
              <button className="mp-panel-back" onClick={goBackMenu}><IconArrowLeft /></button>
              <div className="mp-section">
                <div className="mp-section-header">
                  <span className="mp-section-title">1:1 문의</span>
                </div>

                {/* 탭 */}
                <div style={{ display:'flex', borderRadius:'10px 10px 0 0', border:'1px solid #EBEBEB',
                  borderBottom:'none', overflow:'hidden', marginTop:16, marginBottom:0 }}>
                  {(['write','history'] as const).map(t => (
                    <div key={t}
                      onClick={() => { setCsTab(t); if(csDone && t==='write') { setCsDone(false); setCsTitle(''); setCsMessage(''); setCsCategory('order'); setCsFiles([]); } }}
                      style={{ flex:1, padding:'12px', textAlign:'center', fontSize:13, fontWeight:600,
                        cursor:'pointer', transition:'all .15s',
                        color: csTab===t ? '#1A1A1A' : '#aaa',
                        borderBottom: csTab===t ? '2px solid #1A1A1A' : '2px solid transparent',
                        background: csTab===t ? '#F7F7F5' : '#fff' }}>
                      {t==='write' ? '✏️ 문의하기' : '📋 문의 내역'}
                    </div>
                  ))}
                </div>

                {/* ── 문의하기 ── */}
                {csTab === 'write' && (
                  <div style={{ border:'1px solid #EBEBEB', borderRadius:'0 0 10px 10px', padding:'20px', marginBottom:12 }}>
                    {csDone ? (
                      /* 완료 메시지 */
                      <div style={{ textAlign:'center', padding:'32px 0' }}>
                        <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
                        <div style={{ fontSize:16, fontWeight:800, marginBottom:8 }}>문의가 접수되었습니다!</div>
                        <p style={{ fontSize:13, color:'#888', lineHeight:1.8, marginBottom:20 }}>
                          영업일 기준 1~2일 이내 답변드립니다.<br/>
                          문의 내역 탭에서 확인 가능합니다.
                        </p>
                        <div style={{ display:'flex', gap:8 }}>
                          <button onClick={() => setCsTab('history')}
                            style={{ flex:1, padding:'12px', border:'1.5px solid #EBEBEB', borderRadius:10,
                              background:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', color:'#555' }}>
                            내역 보기
                          </button>
                          <button onClick={() => { setCsDone(false); setCsTitle(''); setCsMessage(''); setCsCategory('order'); setCsFiles([]); }}
                            style={{ flex:1, padding:'12px', border:'none', borderRadius:10,
                              background:'#1A1A1A', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                            추가 문의
                          </button>
                        </div>
                      </div>
                    ) : (
                      <form onSubmit={submitCsInquiry}>
                        {/* 유형 선택 */}
                        <div style={{ marginBottom:16 }}>
                          <div style={{ fontSize:11, fontWeight:700, color:'#aaa', marginBottom:8,
                            textTransform:'uppercase', letterSpacing:'0.4px' }}>문의 유형</div>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                            {CS_CATEGORIES.map(c => (
                              <button type="button" key={c.value}
                                onClick={() => setCsCategory(c.value)}
                                style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px',
                                  borderRadius:10, border:`1.5px solid ${csCategory===c.value?'#1A1A1A':'#EBEBEB'}`,
                                  background: csCategory===c.value?'#F5F5F5':'#FAFAFA',
                                  fontSize:13, fontWeight:600, color: csCategory===c.value?'#1A1A1A':'#555',
                                  cursor:'pointer', transition:'all .15s', fontFamily:'inherit', textAlign:'left' }}>
                                <span style={{ fontSize:18 }}>{c.icon}</span>
                                <div>
                                  <div style={{ fontSize:12, fontWeight:700 }}>{c.name}</div>
                                  <div style={{ fontSize:10, color:'#aaa', fontWeight:400 }}>{c.sub}</div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 제목 */}
                        <div style={{ marginBottom:12 }}>
                          <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#aaa',
                            marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' }}>
                            제목 <span style={{ color:'#1A1A1A', fontSize:10 }}>필수</span>
                          </label>
                          <input type="text" value={csTitle} onChange={e => setCsTitle(e.target.value)}
                            placeholder="문의 제목을 입력해주세요"
                            style={{ width:'100%', padding:'11px 13px', border:'1.5px solid #EBEBEB',
                              borderRadius:10, fontSize:14, color:'#1A1A1A', background:'#FAFAFA',
                              outline:'none', boxSizing:'border-box', fontFamily:'inherit' }} />
                        </div>

                        {/* 내용 */}
                        <div style={{ marginBottom:16 }}>
                          <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#aaa',
                            marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' }}>
                            문의 내용 <span style={{ color:'#1A1A1A', fontSize:10 }}>필수</span>
                          </label>
                          <textarea value={csMessage} onChange={e => setCsMessage(e.target.value)} rows={5}
                            placeholder={
                              csCategory==='order'   ? '주문번호, 상품명, 배송 문의 내용을 입력해주세요.' :
                              csCategory==='return'  ? '주문번호, 취소·교환·반품 사유를 입력해주세요.' :
                              csCategory==='product' ? '상품명, 궁금한 점을 입력해주세요.' :
                              csCategory==='member'  ? '회원 정보, 포인트, 쿠폰 관련 내용을 입력해주세요.' :
                              '문의 내용을 자유롭게 입력해주세요.'
                            }
                            style={{ width:'100%', minHeight:120, padding:'12px 13px',
                              border:'1.5px solid #EBEBEB', borderRadius:10, fontSize:13,
                              color:'#1A1A1A', resize:'vertical', outline:'none', background:'#FAFAFA',
                              fontFamily:'inherit', boxSizing:'border-box', lineHeight:1.6 }} />
                          <div style={{ textAlign:'right', fontSize:11, color:'#aaa', marginTop:4 }}>
                            {csMessage.length} / 1000
                          </div>
                        </div>

                        {/* 파일 첨부 */}
                        <div style={{ marginBottom:16 }}>
                          <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#aaa',
                            marginBottom:8, textTransform:'uppercase', letterSpacing:'0.4px' }}>
                            파일 첨부 <span style={{ fontWeight:400, color:'#bbb', fontSize:10 }}>선택 · 최대 5개</span>
                          </label>
                          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'flex-start' }}>
                            {/* 파일 썸네일 목록 */}
                            {csFiles.map((f, i) => {
                              const isImg = f.type.startsWith('image/');
                              const isVid = f.type.startsWith('video/');
                              const isPdf = f.type === 'application/pdf';
                              const icon = isImg ? '🖼️' : isVid ? '🎬' : isPdf ? '📄' : '📎';
                              return (
                                <div key={i} style={{ width:68, position:'relative' }}>
                                  <div style={{ width:68, height:68, borderRadius:10, background:'#F0F0F0',
                                    border:'1px solid #E0E0E0', display:'flex', flexDirection:'column',
                                    alignItems:'center', justifyContent:'center', gap:2, overflow:'hidden' }}>
                                    {isImg ? (
                                      <img src={URL.createObjectURL(f)} alt=""
                                        style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                    ) : (
                                      <>
                                        <span style={{ fontSize:22 }}>{icon}</span>
                                        <span style={{ fontSize:9, color:'#888', textAlign:'center',
                                          padding:'0 4px', overflow:'hidden', textOverflow:'ellipsis',
                                          whiteSpace:'nowrap', width:'100%', paddingLeft:4, paddingRight:4 }}>
                                          {f.name.length > 10 ? f.name.slice(0,9)+'…' : f.name}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                  {/* 삭제 버튼 */}
                                  <button type="button"
                                    onClick={() => setCsFiles(prev => prev.filter((_,j) => j !== i))}
                                    style={{ position:'absolute', top:3, right:3, width:18, height:18,
                                      borderRadius:'50%', background:'rgba(0,0,0,0.55)', color:'#fff',
                                      border:'none', fontSize:11, cursor:'pointer', display:'flex',
                                      alignItems:'center', justifyContent:'center', padding:0, lineHeight:1 }}>
                                    ✕
                                  </button>
                                </div>
                              );
                            })}
                            {/* 추가 버튼 */}
                            {csFiles.length < 5 && (
                              <label style={{ width:68, height:68, borderRadius:10,
                                border:'2px dashed #D0D0D0', background:'#F7F7F5',
                                display:'flex', flexDirection:'column', alignItems:'center',
                                justifyContent:'center', cursor:'pointer', gap:3, flexShrink:0 }}>
                                <span style={{ fontSize:20, color:'#aaa' }}>＋</span>
                                <span style={{ fontSize:9, color:'#bbb' }}>파일추가</span>
                                <input type="file" multiple hidden
                                  accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx"
                                  onChange={e => {
                                    const picked = Array.from(e.target.files ?? []);
                                    setCsFiles(prev => {
                                      const merged = [...prev, ...picked];
                                      return merged.slice(0, 5);
                                    });
                                    e.target.value = '';
                                  }} />
                              </label>
                            )}
                          </div>
                          <div style={{ fontSize:11, color:'#bbb', marginTop:6 }}>
                            이미지(JPG·PNG·GIF)·영상(MP4·MOV)·PDF·문서(DOC·XLS) 지원 · 파일당 최대 20MB
                          </div>
                        </div>

                        <button type="submit" disabled={csLoading || csUploading}
                          style={{ width:'100%', padding:'13px', background:'#1A1A1A', color:'#fff',
                            border:'none', borderRadius:12, fontSize:14, fontWeight:700,
                            cursor: (csLoading||csUploading)?'default':'pointer',
                            opacity: (csLoading||csUploading)?0.7:1,
                            fontFamily:'inherit' }}>
                          {csUploading ? '📤 파일 업로드 중...' : csLoading ? '⏳ 접수 중...' : '문의 접수하기 →'}
                        </button>
                      </form>
                    )}
                  </div>
                )}

                {/* ── 문의 내역 ── */}
                {csTab === 'history' && (
                  <div style={{ border:'1px solid #EBEBEB', borderRadius:'0 0 10px 10px',
                    padding:'16px 20px', marginBottom:12 }}>
                    {csInquiries.length === 0 ? (
                      <div style={{ textAlign:'center', padding:'32px 0', color:'#aaa', fontSize:13 }}>
                        아직 문의 내역이 없습니다.
                      </div>
                    ) : (
                      csInquiries.map(inq => {
                        const cat = CS_CATEGORIES.find(c => c.value === inq.category);
                        const isOpen = csOpenId === inq.id;
                        return (
                          <div key={inq.id}
                            onClick={() => setCsOpenId(isOpen ? null : inq.id)}
                            style={{ padding:'14px 0', borderBottom:'1px solid #F4F4F4', cursor:'pointer' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:5 }}>
                              <div style={{ display:'flex', alignItems:'center', gap:6, flex:1, minWidth:0 }}>
                                <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:999,
                                  background:'#F0F0F0', color:'#666', flexShrink:0 }}>{cat?.name ?? inq.category}</span>
                                <span style={{ fontSize:13, fontWeight:600, overflow:'hidden',
                                  textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{inq.title}</span>
                              </div>
                              <span style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:999, flexShrink:0, marginLeft:6,
                                background: inq.status==='answered'?'#E8F5E9':'#FFF3E0',
                                color: inq.status==='answered'?'#2D7A4D':'#C8841C' }}>
                                {inq.status==='answered'?'답변완료':'답변대기'}
                              </span>
                            </div>
                            <div style={{ display:'flex', justifyContent:'space-between' }}>
                              <span style={{ fontSize:11, color:'#aaa' }}>
                                {new Date(inq.created_at).toLocaleDateString('ko-KR')}
                              </span>
                              <span style={{ fontSize:11, color:'#aaa' }}>
                                {inq.message.slice(0,30)}{inq.message.length>30?'...':''}
                              </span>
                            </div>
                            {isOpen && (
                              <div style={{ background:'#F7F7F5', borderRadius:10, padding:'12px 14px',
                                marginTop:10, fontSize:12, color:'#555', lineHeight:1.7 }}>
                                <div style={{ fontSize:11, fontWeight:700, color:'#1A1A1A', marginBottom:6 }}>📝 문의 내용</div>
                                <p style={{ margin:0, whiteSpace:'pre-wrap', marginBottom: inq.answer?12:0 }}>{inq.message}</p>
                                {inq.attachments && inq.attachments.length > 0 && (
                                  <div style={{ marginTop:10 }}>
                                    <div style={{ fontSize:11, fontWeight:700, color:'#1A1A1A', marginBottom:6 }}>📎 첨부파일</div>
                                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                                      {inq.attachments.map((url, ai) => {
                                        const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                                        const isVid = /\.(mp4|mov|webm)$/i.test(url);
                                        const filename = decodeURIComponent(url.split('/').pop() ?? `파일 ${ai+1}`);
                                        return isImg ? (
                                          <a key={ai} href={url} target="_blank" rel="noreferrer"
                                            style={{ display:'block', width:56, height:56, borderRadius:8, overflow:'hidden',
                                              border:'1px solid #E0E0E0', flexShrink:0 }}>
                                            <img src={url} alt={filename}
                                              style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                          </a>
                                        ) : (
                                          <a key={ai} href={url} target="_blank" rel="noreferrer"
                                            style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 10px',
                                              border:'1px solid #E0E0E0', borderRadius:8, background:'#fff',
                                              fontSize:11, color:'#444', textDecoration:'none', maxWidth:160,
                                              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                            <span>{isVid ? '🎬' : '📄'}</span>
                                            <span style={{ overflow:'hidden', textOverflow:'ellipsis' }}>{filename}</span>
                                          </a>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                                {inq.answer && (
                                  <>
                                    <div style={{ fontSize:11, fontWeight:700, color:'#1A1A1A', marginTop:12, marginBottom:6 }}>💬 답변</div>
                                    <p style={{ margin:0, whiteSpace:'pre-wrap' }}>{inq.answer}</p>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* 운영 안내 */}
                <div style={{ background:'#F7F7F5', borderRadius:10, padding:'14px 16px',
                  fontSize:12, color:'#888', lineHeight:2 }}>
                  📅 평일 09:00~18:00 운영 (점심 12~13시 제외)<br/>
                  📵 주말·공휴일 휴무 · 영업일 기준 1~2일 이내 답변
                </div>

              </div>
            </div>

            {/* ═══ 내 취향 프로필 ═══ */}
            <div className={`mp-panel${activePanel==='survey'?' active':''}`}>
              <button className="mp-panel-back" onClick={goBackMenu}><IconArrowLeft /></button>
              <div className="mp-section">
                <div className="mp-section-header">
                  <span className="mp-section-title">내 취향 프로필</span>
                </div>

                {/* 로딩 중 */}
                {surveyResult === 'none' && (
                  <div className="mp-empty">불러오는 중...</div>
                )}

                {/* 결과 없음 */}
                {surveyResult === null && (
                  <div style={{ textAlign:'center', paddingTop:48, paddingBottom:48 }}>
                    <div style={{ fontSize:52, marginBottom:16 }}>🍑</div>
                    <div style={{ fontSize:16, fontWeight:800, marginBottom:8, color:'#1A1A1A' }}>
                      아직 취향 진단을 하지 않았어요
                    </div>
                    <p style={{ fontSize:13, color:'#888', lineHeight:1.8, marginBottom:28 }}>
                      나만의 과일 취향을 분석하고<br />딱 맞는 상품을 추천받아보세요.
                    </p>
                    <button onClick={() => router.push('/survey')}
                      style={{ padding:'13px 32px', background:'#1A1A1A', color:'#fff',
                        border:'none', borderRadius:12, fontSize:14, fontWeight:700,
                        cursor:'pointer', fontFamily:'inherit' }}>
                      취향 진단 시작하기 →
                    </button>
                  </div>
                )}

                {/* 결과 있음 */}
                {surveyResult && surveyResult !== 'none' && (() => {
                  const key = `${surveyResult.axis1}-${surveyResult.axis2}-${surveyResult.axis3}`;
                  const info = SURVEY_MAP[key];
                  if (!info) return null;
                  return (
                    <div style={{ paddingTop:20 }}>

                      {/* 결과 카드 */}
                      <div style={{ background: info.bg, borderRadius:20, padding:'28px 24px', marginBottom:16, position:'relative', overflow:'hidden' }}>
                        {/* 배경 장식 원 */}
                        <div style={{ position:'absolute', right:-20, top:-20, width:100, height:100,
                          borderRadius:'50%', background:'rgba(255,255,255,0.25)' }} />
                        <div style={{ position:'absolute', right:20, bottom:-30, width:60, height:60,
                          borderRadius:'50%', background:'rgba(255,255,255,0.2)' }} />

                        <div style={{ position:'relative' }}>
                          <div style={{ fontSize:48, marginBottom:12 }}>{info.emoji}</div>
                          <div style={{ fontSize:11, fontWeight:700, letterSpacing:2, color: info.color, marginBottom:6 }}>
                            나의 취향 유형
                          </div>
                          <div style={{ fontSize:26, fontWeight:900, color:'#1A1A1A', marginBottom:8 }}>
                            {info.name}
                          </div>
                          <div style={{ fontSize:13, color:'#555', lineHeight:1.7, marginBottom:16 }}>
                            {info.tagline}
                          </div>
                          <div style={{ padding:'12px 14px', background:'rgba(255,255,255,0.6)',
                            borderRadius:10, fontSize:13, fontStyle:'italic', color: info.color,
                            fontWeight:700, lineHeight:1.6 }}>
                            {info.wellness}
                          </div>
                        </div>
                      </div>

                      {/* 추천 과일 칩 */}
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16,
                        padding:'12px 16px', background:'#F7F7F5', borderRadius:12 }}>
                        <span style={{ fontSize:20 }}>🍑</span>
                        <div>
                          <div style={{ fontSize:11, color:'#aaa', fontWeight:600, marginBottom:2 }}>추천 과일</div>
                          <div style={{ fontSize:13, fontWeight:700, color:'#1A1A1A' }}>{info.fruitRec}</div>
                        </div>
                      </div>

                      {/* 진단일 */}
                      <div style={{ fontSize:11, color:'#bbb', textAlign:'right', marginBottom:20 }}>
                        마지막 진단: {new Date(surveyResult.created_at).toLocaleDateString('ko-KR')}
                      </div>

                      {/* 버튼 */}
                      <div style={{ display:'flex', gap:8, marginBottom:10 }}>
                        <button onClick={saveResultCard} disabled={savingCard}
                          style={{ flex:1, padding:'13px', border:'1.5px solid #EBEBEB', borderRadius:12,
                            background:'#fff', fontSize:13, fontWeight:700, cursor:'pointer',
                            color:'#1A1A1A', fontFamily:'inherit', opacity: savingCard ? 0.6 : 1 }}>
                          {savingCard ? '저장 중...' : '📥 저장하기'}
                        </button>
                        <button onClick={() => router.push('/category')}
                          style={{ flex:1, padding:'13px', border:'1.5px solid #EBEBEB', borderRadius:12,
                            background:'#fff', fontSize:13, fontWeight:700, cursor:'pointer',
                            color:'#1A1A1A', fontFamily:'inherit' }}>
                          맞춤 상품
                        </button>
                      </div>
                      <button onClick={() => { setSurveyResult('none'); router.push('/survey'); }}
                        style={{ width:'100%', padding:'13px', border:'none', borderRadius:12,
                          background:'#1A1A1A', color:'#fff', fontSize:13, fontWeight:700,
                          cursor:'pointer', fontFamily:'inherit' }}>
                        재검사하기 🔄
                      </button>

                      {/* 맞춤 상품 추천 */}
                      {surveyRecProducts.length > 0 && (
                        <div style={{ marginTop:24 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                            <div style={{ fontSize:13, fontWeight:800, color:'#1A1A1A' }}>🛒 나를 위한 추천 상품</div>
                            <button onClick={() => router.push('/category')}
                              style={{ fontSize:11, color:'#888', background:'none', border:'none',
                                cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
                              전체보기 →
                            </button>
                          </div>
                          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(120px, 1fr))', gap:10 }}>
                            {surveyRecProducts.map(p => {
                              const EM: Record<string,string> = { apple:'🍎', citrus:'🍊', berry:'🫐', melon:'🍈', kiwi:'🥝', mango:'🥭', grape:'🍇', gift:'🎁', default:'🍑' };
                              const price = p.discounted_price ?? p.price;
                              return (
                                <Link key={p.id} href={`/product/${p.id}`}
                                  style={{ textDecoration:'none', color:'inherit' }}>
                                  <div style={{ borderRadius:14, border:'1px solid #EBEBEB', overflow:'hidden',
                                    background:'#fff', cursor:'pointer',
                                    display:'flex', flexDirection:'column', height:'100%',
                                    transition:'box-shadow .15s' }}
                                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow='0 4px 16px rgba(0,0,0,0.1)'}
                                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow='none'}>
                                    {/* 이미지 — 고정 높이 */}
                                    <div style={{ height:110, flexShrink:0, background:'#F7F7F5',
                                      display:'flex', alignItems:'center', justifyContent:'center',
                                      fontSize:36, overflow:'hidden' }}>
                                      {p.thumbnail_url
                                        ? <img src={p.thumbnail_url} alt={p.name}
                                            style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                        : (EM[p.category] || EM.default)}
                                    </div>
                                    {/* 텍스트 */}
                                    <div style={{ padding:'10px 12px 12px', flex:1,
                                      display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
                                      <div style={{ fontSize:12, fontWeight:600, color:'#1A1A1A',
                                        marginBottom:6, lineHeight:1.4, height:'2.8em', overflow:'hidden' }}>
                                        {p.name}
                                      </div>
                                      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                                        {p.discount_rate > 0 && (
                                          <span style={{ fontSize:11, fontWeight:700, color:'var(--color-accent)' }}>
                                            {p.discount_rate}%
                                          </span>
                                        )}
                                        <span style={{ fontSize:13, fontWeight:800, color:'#1A1A1A' }}>
                                          {price.toLocaleString('ko-KR')}원
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* ─ 숨김 캡처 카드 ─ */}
                      <div style={{ position:'fixed', top:0, left:0, width:0, height:0, overflow:'hidden', pointerEvents:'none' }} aria-hidden="true">
                        <div ref={surveyCardRef} style={{
                          width:360, height:640, background: info.bg,
                          position:'relative', overflow:'hidden', boxSizing:'border-box',
                          textAlign:'center',
                          fontFamily:"'-apple-system','Helvetica Neue','Apple SD Gothic Neo',sans-serif",
                        }}>
                          {/* 배경 장식 */}
                          <div style={{ position:'absolute', right:-30, top:-30, width:140, height:140, borderRadius:'50%', background:'rgba(255,255,255,0.18)' }} />
                          <div style={{ position:'absolute', left:-20, bottom:-20, width:100, height:100, borderRadius:'50%', background:'rgba(255,255,255,0.13)' }} />

                          <div style={{ paddingTop:40, marginBottom:24 }}>
                            <span style={{ fontSize:10, letterSpacing:3, color: info.color, fontWeight:800, opacity:0.8 }}>
                              DELI&apos;O WELLNESS
                            </span>
                          </div>
                          <div style={{ fontSize:80, lineHeight:'1', marginBottom:14 }}>{info.emoji}</div>
                          <div style={{ fontSize:52, fontWeight:900, color: info.color, lineHeight:'1.1', marginBottom:10, letterSpacing:-1 }}>
                            {info.name}
                          </div>
                          <div style={{ fontSize:12, color:'#555', fontWeight:600, lineHeight:'1.65', marginBottom:24, padding:'0 36px' }}>
                            {info.tagline}
                          </div>
                          <div style={{ width:40, height:2, background: info.color, margin:'0 auto 24px', opacity:0.4, borderRadius:2 }} />
                          <div style={{ marginBottom:24, padding:'0 20px', lineHeight:'2' }}>
                            {[
                              surveyResult.axis1 === 'routine' ? '루틴형' : '자유형',
                              surveyResult.axis2 === 'care'    ? '케어형' : '자기충전형',
                              surveyResult.axis3 === 'vitamin' ? '비타민형' : '힐링형',
                            ].map(tag => (
                              <span key={tag} style={{
                                display:'inline-block', marginRight:6, marginBottom:6,
                                fontSize:11, fontWeight:700,
                                background:'rgba(255,255,255,0.8)', color: info.color,
                                padding:'4px 13px', borderRadius:20,
                                border:`1.5px solid ${info.color}`,
                              }}>{tag}</span>
                            ))}
                          </div>
                          <div style={{ fontSize:13, fontStyle:'italic', color: info.color, fontWeight:700, lineHeight:'1.7', padding:'0 32px' }}>
                            {info.wellness}
                          </div>
                          <div style={{ position:'absolute', bottom:22, left:0, right:0, fontSize:10, color:'#BBB', letterSpacing:1 }}>
                            delio.co.kr/survey
                          </div>
                        </div>
                      </div>

                    </div>
                  );
                })()}

              </div>
            </div>

          </div>
          {/* /mp-content */}
        </div>
        {/* /mp-layout */}

      </div>
      {/* /container */}

      {/* ══════════════════════════════
          리뷰 사진/영상 모달
      ══════════════════════════════ */}
      {reviewPhotoModal && (() => {
        const r = reviewPhotoModal;
        const mediaItems: { url: string; isVideo: boolean }[] = [
          ...(r.image_urls || []).map(url => ({ url, isVideo: false })),
          ...(r.video_url ? [{ url: r.video_url, isVideo: true }] : []),
        ];
        const sel = mediaItems[reviewPhotoIdx] || mediaItems[0];
        return (
          <div onClick={() => setReviewPhotoModal(null)}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)',
              zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
            <div onClick={e => e.stopPropagation()}
              style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:560,
                maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column' }}>

              {/* 헤더 */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'14px 16px', borderBottom:'1px solid #f0f0f0', flexShrink:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:14, fontWeight:700 }}>내 리뷰 사진</span>
                  {r.products?.name && (
                    <span style={{ fontSize:12, color:'#999' }}>· {r.products.name}</span>
                  )}
                </div>
                <button onClick={() => setReviewPhotoModal(null)}
                  style={{ background:'none', border:'none', fontSize:20, cursor:'pointer',
                    color:'#888', lineHeight:1, padding:0 }}>✕</button>
              </div>

              {/* 메인 미디어 */}
              <div style={{ flex:1, minHeight:0, overflow:'hidden',
                background:'#111', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {sel?.isVideo ? (
                  <video src={sel.url} controls
                    style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain' }} />
                ) : sel ? (
                  <img src={sel.url} alt=""
                    style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain' }} />
                ) : null}
              </div>

              {/* 썸네일 + 리뷰 정보 */}
              <div style={{ flexShrink:0, borderTop:'1px solid #f0f0f0' }}>
                {/* 썸네일 행 */}
                {mediaItems.length > 1 && (
                  <div style={{ display:'flex', gap:6, padding:'10px 14px', overflowX:'auto' }}>
                    {mediaItems.map((m, i) => (
                      <div key={i} onClick={() => setReviewPhotoIdx(i)}
                        style={{ width:52, height:52, borderRadius:6, flexShrink:0, overflow:'hidden',
                          cursor:'pointer', border:`2px solid ${i === reviewPhotoIdx ? '#1A1A1A' : 'transparent'}`,
                          background:'#222', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {m.isVideo
                          ? <span style={{ color:'#fff', fontSize:18 }}>▶</span>
                          : <img src={m.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />}
                      </div>
                    ))}
                  </div>
                )}

                {/* 리뷰 텍스트 */}
                <div style={{ padding:'10px 16px 16px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                    <div style={{ display:'flex', gap:2 }}>
                      {[1,2,3,4,5].map(s => (
                        <svg key={s} viewBox="0 0 20 20" width="13" height="13">
                          <path d="M10,1.5 L11.8,6.5 L17,6.5 L12.9,9.8 L14.5,14.9 L10,11.8 L5.5,14.9 L7.1,9.8 L3,6.5 L8.2,6.5 Z"
                            fill={s <= r.rating ? '#F5A623' : '#E0DFDB'} />
                        </svg>
                      ))}
                    </div>
                    <span style={{ fontSize:11, color:'#aaa' }}>
                      {new Date(r.created_at).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                  <p style={{ fontSize:13, color:'#444', lineHeight:1.7, margin:0 }}>{r.content}</p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}


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
