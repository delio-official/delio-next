'use client';

import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { getDownloadableCoupons, claimAllPublic, redeemCouponByCode, type PublicCoupon } from '@/lib/coupons';
import { DEFAULT_TIERS, GRADE_LABEL, GRADE_LABEL_EN, GRADE_COLOR, MEMBERSHIP_COUPON, normalizeGrade, effectiveRate, type MembershipTier } from '@/lib/membership';
import { signOut } from '@/lib/auth';
import { useAuth } from '@/hooks/useAuth';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { shareKakaoFeed } from '@/lib/kakao';
import { addToCart, showCartToast, openOptionDrawer } from '@/lib/cart';
import { ProductCard } from '@/components/ProductCard';
import { FarmCard } from '@/components/FarmCard';
import { TASTE_AXES, type ReviewTaste } from '@/lib/taste';
import TrackingModal from '@/components/TrackingModal/TrackingModal';
import { StarRating } from '@/components/StarRating';
import ReviewPhotoModal from '@/components/ReviewPhotoModal/ReviewPhotoModal';
import { imgThumb } from '@/lib/img';
import SurveyResultView from '@/components/SurveyResultView/SurveyResultView';
import '@/styles/mypage.css';
import '@/styles/category.css';

/* ─── Types ─── */
interface OrderItem {
  product_id?: string | null;
  product_name: string; quantity: number;
  unit_price: number; subtotal: number;
  thumbnail_url: string | null;
  option_label?: string | null;
  farm_name?: string | null;
  products?: { origin: string | null; category: string | null } | null;
}
const ORIGIN_LABEL: Record<string, string> = { domestic: '국산과일', import: '수입과일' };
const CAT_LABEL: Record<string, string> = {
  apple: '사과/배', citrus: '감귤류', berry: '베리류', melon: '멜론/참외',
  kiwi: '키위', mango: '망고', grape: '포도', gift: '선물세트',
};
interface Order {
  id: string; order_no: string; status: string;
  final_amount: number; created_at: string; delivered_at?: string | null; paid_at?: string | null; shipped_at?: string | null;
  courier: string | null; tracking_number: string | null;
  recipient?: string | null; phone?: string | null; zipcode?: string | null;
  address1?: string | null; address2?: string | null; delivery_memo?: string | null;
  payment_method?: string | null; total_amount?: number; discount_amount?: number;
  coupon_discount?: number; point_used?: number; earned_point?: number;
  order_items: OrderItem[];
}
interface Profile {
  name: string | null; email: string; point_balance: number; grade: string;
  avatar_url?: string | null;
  phone?: string | null; birth?: string | null;
  marketing_email?: boolean; marketing_sms?: boolean; push_enabled?: boolean;
}
interface WishItem {
  id: string;
  products: {
    id: string; name: string; price: number; discounted_price: number;
    discount_rate: number; thumbnail_url: string | null; category: string; badge: string | null;
    is_dawn: boolean; is_new: boolean; is_best: boolean; avg_rating: number; review_count: number;
    short_desc?: string | null;
  } | null;
}
interface MyReview {
  id: string; rating: number; content: string; created_at: string;
  image_urls: string[] | null; video_url: string | null;
  taste: ReviewTaste | null;
  products: { name: string; thumbnail_url: string | null; id: string } | null;
}
interface RecentProduct {
  id: string; name: string; price: number; discount_rate: number;
  thumbnail_url: string | null; avg_rating: number; category: string;
  discounted_price?: number | null; review_count?: number; is_dawn?: boolean; is_new?: boolean; is_best?: boolean; short_desc?: string | null;
}
interface Address {
  id: string; label: string; recipient: string; phone: string;
  zipcode: string; address1: string; address2: string; is_default: boolean;
  delivery_request?: string | null;
}
interface UserCoupon {
  id: string; used: boolean; issued_at: string; expires_at: string | null;
  coupon: {
    name: string; discount_type: 'percent' | 'fixed'; discount_value: number;
    min_order_amount: number; max_discount_amount: number | null; expires_at: string | null;
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
/* 상품 Q&A 카테고리 표시 라벨 */
const QNA_CAT_LABEL: Record<string, string> = {
  '문의': '상품문의', '상품': '상품문의', '배송관련': '배송문의',
  '취소/교환/반품': '취소/교환/반품', '기타': '기타문의',
};
const qnaCatLabel = (c: string) => QNA_CAT_LABEL[c] || (c || '상품문의');
interface CsInquiry {
  id: string; category: CsCategory; title: string; message: string;
  status: string; answer?: string; created_at: string;
  attachments?: string[];
}

const EMPTY_ADDR = { label:'', recipient:'', phone:'', zipcode:'', address1:'', address2:'', is_default:false, delivery_request:'' };
const DELIVERY_REQ_PRESETS = ['배송 전에 미리 연락주세요', '부재 시 전화 주시거나 문자 남겨주세요', '부재 시 경비실에 맡겨주세요'];

/* ─── Constants ─── */
const STATUS_LABEL: Record<string, string> = {
  pending:'결제대기', paid:'결제완료', preparing:'상품준비중',
  shipped:'배송중', delivered:'배송완료', cancelled:'취소됨',
  exchanging:'교환처리중', exchanged:'교환완료',
  refunding:'환불처리중', refunded:'환불완료',
};
/* 주문처리현황 단계 라벨 (필터 칩 표시용) */
const STATUS_GROUP_LABEL: Record<string, string> = {
  pending:'입금전', preparing:'배송준비중', shipped:'배송중', delivered:'배송완료',
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

/* 리뷰 남기기 별점 — hover 시 그 별까지 채워지고, 클릭하면 그 점수로 작성 이동 */
function WritableStars({ onPick }: { onPick: (s: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div onMouseLeave={() => setHover(0)} style={{ display:'inline-flex', gap:2, marginTop:7 }}>
      {[1,2,3,4,5].map(s => (
        <button key={s} aria-label={`별점 ${s}점으로 리뷰 작성`}
          onMouseEnter={() => setHover(s)}
          onClick={e => { e.stopPropagation(); onPick(s); }}
          style={{ background:'none', border:'none', padding:0, cursor:'pointer', lineHeight:0 }}>
          <svg viewBox="0 0 20 20" width="23" height="23"><polygon points="10,1.5 12.65,7.18 19,8.09 14.5,12.49 15.78,18.82 10,15.72 4.22,18.82 5.5,12.49 1,8.09 7.35,7.18" fill={s <= hover ? '#FFB400' : '#E0DFDB'} style={{ transition:'fill .1s' }} /></svg>
        </button>
      ))}
    </div>
  );
}

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
  const [tiers,          setTiers]          = useState<MembershipTier[]>(DEFAULT_TIERS);
  const [orderCount,     setOrderCount]     = useState(0);     // 전체 주문 건수(정확)
  const [orderSearch,    setOrderSearch]    = useState('');    // 주문내역 검색어
  const [orderStatusFilter, setOrderStatusFilter] = useState<string | null>(null); // 주문처리현황 단계 클릭 필터
  const orderListRef = useRef<HTMLDivElement>(null);          // 단계 클릭 시 목록으로 스크롤
  const [detailOrder, setDetailOrder] = useState<Order | null>(null); // 주문 상세보기 모달
  const [cancelDetail, setCancelDetail] = useState<Order | null>(null); // 취소/환불 상세 모달
  const [pointLogs,      setPointLogs]      = useState<{ id:string; amount:number; created_at:string; description:string|null }[]>([]);
  const [pointPeriod,    setPointPeriod]    = useState<3|6|12|36>(3); // 개월 단위 필터
  const [expandedOrder,  setExpandedOrder]  = useState<string | null>(null);
  const [trackingTarget, setTrackingTarget] = useState<{ carrierId: string; trackingNumber: string } | null>(null);
  const [wishlist,       setWishlist]       = useState<WishItem[]>([]);
  const [wishTab,        setWishTab]        = useState<'product'|'farm'>('product');
  const [farmWishlist,   setFarmWishlist]   = useState<{ id: string; farms: { id: string; slug: string; name: string; region: string|null; farm_type: string|null; intro: string|null; thumbnail_url: string|null; hero_image_url: string|null; logo_url: string|null } | null }[]>([]);
  const [myReviews,      setMyReviews]      = useState<MyReview[]>([]);
  const [reviewRewardPhoto, setReviewRewardPhoto] = useState(500); // 포토 리뷰 적립포인트(받을 수 있는 포인트 배너 계산용)
  const [reviewTab, setReviewTab] = useState<'writable' | 'written'>('writable'); // 나의 리뷰: 리뷰 남기기 / 내가 남긴 리뷰
  // 상품 문의 작성 모달(배송조회에서 바로 띄움) — 주문 내 상품 목록 + 선택된 상품
  const [askModal, setAskModal] = useState<{ items: { productId: string; productName: string; thumb: string | null }[]; selectedId: string } | null>(null);
  const [askCategory, setAskCategory] = useState('문의');
  const [askContent, setAskContent] = useState('');
  const [askPrivate, setAskPrivate] = useState(false);
  const [askSubmitting, setAskSubmitting] = useState(false);
  const [askCatOpen, setAskCatOpen] = useState(false);
  const [askProdOpen, setAskProdOpen] = useState(false);
  // 상품 선택 모달 (리뷰 쓰기 / 재구매 / 장바구니) — 주문 상품 2개 이상일 때
  type PickItem = { productId: string; productName: string; thumb: string | null; unitPrice: number };
  const [picker, setPicker] = useState<{ mode: 'review' | 'repurchase' | 'cart'; items: PickItem[]; selectedId: string } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingId,      setEditingId]      = useState<string | null>(null);
  const [editRating,     setEditRating]     = useState(5);
  const [editContent,    setEditContent]    = useState('');
  const [editSaving,     setEditSaving]     = useState(false);
  const [editImages,     setEditImages]     = useState<string[]>([]);   // 유지할 기존 이미지
  const [editVideo,      setEditVideo]      = useState<string | null>(null); // 유지할 기존 영상
  const [editNewImages,  setEditNewImages]  = useState<File[]>([]);     // 새로 추가한 이미지
  const [editNewVideo,   setEditNewVideo]   = useState<File | null>(null);
  const [editTaste,      setEditTaste]      = useState<Record<string, number>>({}); // 맛 평가 수정
  const [reviewPhotoModal, setReviewPhotoModal] = useState<MyReview | null>(null);
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
  /* 아르르 레이아웃 — 추가 필드 */
  const [editPhone,     setEditPhone]     = useState('');
  const [editBirth,     setEditBirth]     = useState('');
  const [mEmail,        setMEmail]        = useState(false);
  const [mSms,          setMSms]          = useState(false);
  const [mPush,         setMPush]         = useState(false);
  const [mktSaving,     setMktSaving]     = useState(false);

  /* 내 환불/취소 신청 내역 */
  interface MyRefundReq { id: string; order_id: string | null; reason: string; detail: string; status: string; reject_reason?: string | null; created_at: string; type?: string; orders: { order_no: string } | null; }
  const [myRefundReqs, setMyRefundReqs] = useState<MyRefundReq[]>([]);

  /* 취소/환불 신청 모달 */
  const [reqModal, setReqModal] = useState<{ order: Order; type: 'cancel' | 'refund' } | null>(null);
  const [reqReason, setReqReason] = useState('');
  const [reqDetail, setReqDetail] = useState('');
  const [reqSubmitting, setReqSubmitting] = useState(false);
  const CANCEL_REASONS = ['단순 변심', '상품 정보와 다름', '배송 지연', '중복 주문', '기타'];
  const REFUND_REASONS = ['상품 불량/파손', '오배송', '상품 누락', '품질 불만족', '기타'];

  /* 진행 중(접수/처리중)인 신청이 있는 주문 → order_id 맵 */
  const activeReqByOrder = new Map<string, MyRefundReq>();
  myRefundReqs.forEach(r => {
    if (r.order_id && (r.status === 'pending' || r.status === 'processing')) activeReqByOrder.set(r.order_id, r);
  });

  /* 즉시 취소 (결제완료 상태) — 승인 없이 바로 처리 */
  async function instantCancel(o: Order) {
    if (!confirm('주문을 취소할까요?\n결제가 즉시 취소되고, 사용한 쿠폰·포인트가 복원됩니다.')) return;
    try {
      const res = await fetch('/api/orders/cancel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: o.id }),
      });
      const j = await res.json().catch(() => ({}));
      if (j?.cancelled) {
        setOrders(prev => prev.map(x => x.id === o.id ? { ...x, status: 'cancelled' } : x));
        await loadMyRefundReqs();
        alert('주문이 취소됐습니다. 결제·쿠폰·포인트가 복원됩니다.');
      } else if (j?.needsRequest) {
        alert('이미 상품 준비가 시작돼 즉시취소가 어려워요.\n취소 신청으로 진행해주세요.');
        setReqModal({ order: o, type: 'cancel' }); setReqReason(''); setReqDetail('');
      } else {
        alert('취소 처리 중 오류가 발생했습니다.' + (j?.error ? `\n${j.error}` : ''));
      }
    } catch {
      alert('취소 처리 중 오류가 발생했습니다.');
    }
  }

  /* 반려/보류된 신청 → 같은 주문·유형으로 다시 신청 */
  function reapplyReq(r: MyRefundReq) {
    const o = orders.find(x => x.id === r.order_id);
    if (!o) { alert('주문 정보를 찾을 수 없습니다.'); return; }
    setReqModal({ order: o, type: (r.type === 'cancel' ? 'cancel' : 'refund') });
    setReqReason(''); setReqDetail('');
  }

  async function submitReq() {
    if (!user || !reqModal || !reqReason) { if (!reqReason) alert('사유를 선택해주세요.'); return; }
    setReqSubmitting(true);
    const { error } = await createClient().from('refund_requests').insert({
      order_id: reqModal.order.id, user_id: user.id,
      reason: reqReason, detail: reqDetail.trim(), type: reqModal.type,
    });
    setReqSubmitting(false);
    if (error) { alert('신청 중 오류가 발생했습니다.'); return; }
    setReqModal(null); setReqReason(''); setReqDetail('');
    await loadMyRefundReqs();
    alert(reqModal.type === 'cancel' ? '주문취소 신청이 접수됐습니다.' : '환불 신청이 접수됐습니다.');
  }

  /* 배송지 */
  const [addresses,    setAddresses]    = useState<Address[]>([]);
  const [addrLoading,  setAddrLoading]  = useState(false);
  const [addrFormOpen, setAddrFormOpen] = useState(false);
  const [addrEditing,  setAddrEditing]  = useState<Address | null>(null);
  const [addrForm,     setAddrForm]     = useState({ ...EMPTY_ADDR });
  const [addrReqOpen,   setAddrReqOpen]   = useState(false); // 배송 요청사항 드롭다운 열림
  const [addrReqCustom, setAddrReqCustom] = useState(false); // 직접 입력 모드
  const [addrSort,     setAddrSort]     = useState<'recent_use'|'recent_reg'|'name'>('recent_use');
  const [isMobileView, setIsMobileView] = useState(false);
  const [editQnaId, setEditQnaId] = useState<string | null>(null);
  const [editQnaText, setEditQnaText] = useState('');
  const [editCsId, setEditCsId] = useState<string | null>(null);
  const [editCsText, setEditCsText] = useState('');
  /* 모달 열림 동안 뒷 배경 스크롤 잠금 */
  useBodyScrollLock(!!detailOrder || !!cancelDetail || !!editingId || !!reviewPhotoModal || !!reqModal || addrFormOpen || !!askModal || !!picker);

  /* ── 상품 문의 작성 제출(배송조회 → 바로 모달) ── */
  async function submitAsk() {
    if (!askModal || !user) return;
    if (!askContent.trim()) { showToastMsg('문의 내용을 입력해주세요.'); return; }
    setAskSubmitting(true);
    const { error } = await createClient().from('product_inquiries').insert({
      product_id: askModal.selectedId,
      user_id: user.id,
      category: askCategory,
      content: askContent.trim(),
      is_private: askPrivate,
      password: null,
    });
    setAskSubmitting(false);
    if (error) { showToastMsg('문의 등록 실패: ' + error.message); return; }
    setAskModal(null);
    setAskContent('');
    setAskCategory('문의');
    setAskPrivate(false);
    showToastMsg('문의가 등록되었습니다.');
  }

  /* ── 리뷰 쓰기 / 재구매 / 장바구니 실행 (선택된 상품 대상) ── */
  function runItemAction(mode: 'review' | 'repurchase' | 'cart', it: PickItem) {
    if (mode === 'review') {
      router.push(`/product/${it.productId}?tab=review`);
      return;
    }
    addToCart({
      id: it.productId,
      name: it.productName,
      price: it.unitPrice,
      originalPrice: it.unitPrice,
      thumbnail: it.thumb || '',
      quantity: 1,
      deliveryType: '자사배송',
    });
    if (mode === 'cart') {
      showCartToast(it.productName);          // 담기만
    } else {
      router.push('/checkout');               // 재구매 → 담고 결제로
    }
  }

  /* 주문 카드 버튼에서 호출 — 상품 1개면 바로, 2개 이상이면 선택 모달 */
  function startItemAction(mode: 'review' | 'repurchase' | 'cart', o: Order) {
    const items: PickItem[] = (o.order_items || [])
      .filter(it => it.product_id)
      .map(it => ({ productId: it.product_id!, productName: it.product_name, thumb: it.thumbnail_url ?? null, unitPrice: it.unit_price }));
    if (items.length === 0) return;
    if (items.length === 1) { runItemAction(mode, items[0]); return; }
    setPicker({ mode, items, selectedId: items[0].productId });
    setPickerOpen(false);
  }
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobileView(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  /* 친구 추천 */
  const [referralCode,    setReferralCode]    = useState('');
  const [referralInvited, setReferralInvited] = useState(0);
  const [referralRewarded,setReferralRewarded]= useState(0);

  /* 문의 — 상위 탭 (상품 Q&A / 1:1 문의) */
  const [csMainTab,   setCsMainTab]   = useState<'qna'|'inquiry'>('qna');
  const [qnaFilter,   setQnaFilter]   = useState<'all'|'answered'|'waiting'>('all'); // 상품 Q&A 요약 클릭 필터
  const [inqFilter,   setInqFilter]   = useState<'all'|'answered'|'waiting'>('all'); // 1:1 문의 요약 클릭 필터
  interface MyQna { id: string; category: string; content: string; answer: string | null; created_at: string; products: { name: string | null } | null; }
  const [myQna,       setMyQna]       = useState<MyQna[]>([]);
  const [qnaLoading,  setQnaLoading]  = useState(false);
  const [qnaOpenId,   setQnaOpenId]   = useState<string | null>(null);

  /* 1:1 문의 */
  const [csFormOpen,  setCsFormOpen]  = useState(false);
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
  const [surveyShowRec, setSurveyShowRec] = useState(true); // 추천 상품 노출 설정
  const [surveyResult, setSurveyResult] = useState<{
    axis1: string; axis2: string; axis3: string;
    result_label: string; result_desc: string; created_at: string;
  } | null | 'none'>('none'); // 'none' = 아직 로드 전

  /* URL(?panel=) 기준으로 패널 동기화 → 뒤로/앞으로가기가 자연스럽게 동작 */
  useEffect(() => {
    const panel = searchParams.get('panel') as PanelType | null;
    setActivePanel(panel ?? 'order');
    setShowMobileMenu(!panel); // 패널 없으면 모바일 메뉴, 있으면 해당 패널
  }, [searchParams]);

  /* 패널/메뉴가 바뀌면 화면을 맨 위로 — 페인트 직전(useLayoutEffect)에 맞춰
     "메뉴가 최상단으로 튀었다가 전환"되는 점프가 눈에 보이지 않게 한다. */
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    window.scrollTo(0, 0);
  }, [activePanel, showMobileMenu]);

  /* 회원정보 수정 패널 진입 시 본인인증 게이트(verify)부터 시작.
     단, 최근 1시간 이내에 본인인증을 통과했으면 유예하고 바로 수정 폼(edit). */
  useEffect(() => {
    if (activePanel !== 'info') return;
    try {
      const at = Number(localStorage.getItem(`mp_reauth_at_${user?.id}`) || 0);
      if (at && Date.now() - at < 60 * 60 * 1000) { setInfoStep('edit'); return; }
    } catch { /* localStorage 접근 불가 시 무시 */ }
    setInfoStep('verify');
  }, [activePanel, user?.id]);

  /* toast helper */
  function showToastMsg(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  /* 본인이 쓴 상품 Q&A 삭제 */
  async function deleteMyQna(id: string) {
    if (!confirm('이 문의를 삭제하시겠습니까?')) return;
    const { error } = await createClient().from('product_inquiries').delete().eq('id', id);
    if (error) { showToastMsg('삭제 실패: ' + error.message); return; }
    setMyQna(prev => prev.filter(x => x.id !== id));
    showToastMsg('문의가 삭제되었습니다.');
  }
  /* 본인이 쓴 1:1 문의 삭제 */
  async function deleteMyCs(id: string) {
    if (!confirm('이 문의를 삭제하시겠습니까?')) return;
    const { error } = await createClient().from('cs_inquiries').delete().eq('id', id);
    if (error) { showToastMsg('삭제 실패: ' + error.message); return; }
    setCsInquiries(prev => prev.filter(x => x.id !== id));
    showToastMsg('문의가 삭제되었습니다.');
  }
  /* 본인 상품 Q&A 수정 (인라인) */
  async function updateMyQna(id: string) {
    const text = editQnaText.trim();
    if (!text) { showToastMsg('내용을 입력해주세요.'); return; }
    const { error } = await createClient().from('product_inquiries').update({ content: text }).eq('id', id);
    if (error) { showToastMsg('수정 실패: ' + error.message); return; }
    setMyQna(prev => prev.map(x => x.id === id ? { ...x, content: text } : x));
    setEditQnaId(null);
    showToastMsg('문의가 수정되었습니다.');
  }
  /* 본인 1:1 문의 수정 (인라인) */
  async function updateMyCs(id: string) {
    const text = editCsText.trim();
    if (!text) { showToastMsg('내용을 입력해주세요.'); return; }
    const { error } = await createClient().from('cs_inquiries').update({ message: text }).eq('id', id);
    if (error) { showToastMsg('수정 실패: ' + error.message); return; }
    setCsInquiries(prev => prev.map(x => x.id === id ? { ...x, message: text } : x));
    setEditCsId(null);
    showToastMsg('문의가 수정되었습니다.');
  }

  /* 프로필 이미지 업로드 (cs-attachments 버킷 재사용) */
  const [avatarUploading, setAvatarUploading] = useState(false);
  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일 다시 선택 가능하게 리셋
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) { showToastMsg('이미지 파일만 업로드할 수 있어요.'); return; }
    setAvatarUploading(true);
    const supabase = createClient();
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const path = `${user.id}/avatar_${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('cs-attachments')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { showToastMsg('업로드 실패: ' + upErr.message); setAvatarUploading(false); return; }
    const { data: urlData } = supabase.storage.from('cs-attachments').getPublicUrl(path);
    const url = urlData.publicUrl;
    const { error: updErr } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);
    if (updErr) { showToastMsg('저장 실패: ' + updErr.message); setAvatarUploading(false); return; }
    setProfile(prev => prev ? { ...prev, avatar_url: url } : prev);
    showToastMsg('프로필 사진이 변경되었어요.');
    setAvatarUploading(false);
  }

  /* 로그인 체크 + 데이터 로드 */
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }

    async function load() {
      const supabase = createClient();
      const [{ data: prof }, { data: ords }, { data: revs }, { data: rpSettings }] = await Promise.all([
        supabase.from('profiles').select('name,email,point_balance,grade,referral_code,avatar_url,phone,birth,marketing_email,marketing_sms,push_enabled').eq('id', user!.id).single(),
        supabase.from('orders')
          .select('id,order_no,status,final_amount,created_at,delivered_at,paid_at,shipped_at,courier,tracking_number,recipient,phone,zipcode,address1,address2,delivery_memo,payment_method,total_amount,discount_amount,coupon_discount,point_used,earned_point,order_items(product_id,product_name,quantity,unit_price,subtotal,thumbnail_url,option_label,farm_name,products(origin,category))')
          .eq('user_id', user!.id)
          .order('created_at', { ascending: false })
          .limit(200),
        supabase.from('reviews')
          .select('id,product_id,rating,content,created_at,image_urls,video_url,taste,products(id,name,thumbnail_url)')
          .eq('user_id', user!.id)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase.from('site_settings').select('key,value').in('key', ['review_point_photo']),
      ]);
      { const rp = ((rpSettings as { key: string; value: string }[]) || []).find(s => s.key === 'review_point_photo'); if (rp?.value) setReviewRewardPhoto(Number(rp.value) || 500); }
      setProfile(prof as Profile);
      if ((prof as Profile & { referral_code?: string })?.referral_code) {
        setReferralCode((prof as Profile & { referral_code?: string }).referral_code!);
      }
      // 회원정보 수정 폼 초기값
      const pf = prof as Profile;
      if (pf) {
        setEditName(pf.name || '');
        setEditPhone(pf.phone || '');
        setEditBirth(pf.birth || '');
        setMEmail(!!pf.marketing_email);
        setMSms(!!pf.marketing_sms);
        setMPush(!!pf.push_enabled);
      }
      setOrders((ords as unknown as Order[]) || []);
      setMyReviews((revs as unknown as MyReview[]) || []);

      // 멤버십 등급 설정 로드 (없으면 기본값 유지)
      supabase.from('membership_tiers').select('*').order('sort').then(({ data }) => {
        if (data && data.length) setTiers(data as MembershipTier[]);
      });

      // 전체 주문 건수 (정확한 카운트)
      const { count: ordCnt } = await supabase
        .from('orders').select('id', { count: 'exact', head: true }).eq('user_id', user!.id);
      setOrderCount(ordCnt ?? 0);

      // 사용 가능 쿠폰 수 (요약 카드용) — 미사용 + 미만료만
      const { count } = await supabase
        .from('user_coupons')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('is_used', false)
        .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`);
      setAvailableCouponCount(count ?? 0);

      // 관심상품 미리보기용 위시리스트 프리로드 (모바일 메뉴 하단)
      const { data: wishData } = await supabase.from('wishlist')
        .select('id, products(id,name,price,discounted_price,discount_rate,thumbnail_url,category,badge,is_dawn,is_new,is_best,avg_rating,review_count,short_desc)')
        .eq('user_id', user!.id).limit(20);
      setWishlist((wishData as unknown as WishItem[]) || []);
    }

    // 최근 본 상품 — localStorage의 id 순서로 상품 풀데이터 재조회(정가·배송·후기수 등)
    (async () => {
      try {
        const raw = localStorage.getItem('delio_recent_products');
        const stored: { id: string }[] = raw ? JSON.parse(raw) : [];
        const ids = stored.map(p => p.id);
        if (!ids.length) { setRecentProducts([]); return; }
        const { data } = await createClient()
          .from('products')
          .select('id,name,price,discounted_price,discount_rate,thumbnail_url,avg_rating,review_count,category,is_dawn,is_new,is_best,short_desc')
          .in('id', ids);
        const map = new Map(((data || []) as unknown as RecentProduct[]).map(d => [d.id, d]));
        setRecentProducts(ids.map(id => map.get(id)).filter(Boolean) as RecentProduct[]);
      } catch { setRecentProducts([]); }
    })();

    load();
  }, [user, authLoading, router]);

  /* 친구 추천 — benefit 패널 열릴 때 로드 */
  useEffect(() => {
    if (activePanel !== 'benefit' || !user) return;
    async function loadReferrals() {
      const supabase = createClient();
      const { data } = await supabase
        .from('referrals')
        .select('id,rewarded')
        .eq('referrer_id', user!.id);
      if (data) {
        setReferralInvited(data.length);
        setReferralRewarded(data.filter(r => r.rewarded).length);
      }
    }
    loadReferrals();
  }, [activePanel, user]);

  /* 1:1 문의 내역 로드 (제출 후에도 재호출) */
  async function loadCsInquiries() {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('cs_inquiries')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setCsInquiries(data as CsInquiry[]);
  }
  useEffect(() => {
    if (activePanel === 'cs' && user) loadCsInquiries();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePanel, user]);

  /* 상품 Q&A 내역 — 패널·탭 열릴 때 로드 */
  useEffect(() => {
    if (activePanel !== 'cs' || csMainTab !== 'qna' || !user) return;
    async function loadMyQna() {
      setQnaLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from('product_inquiries')
        .select('id, category, content, answer, created_at, products:product_id(name)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      setMyQna((data as unknown as MyQna[]) || []);
      setQnaLoading(false);
    }
    loadMyQna();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePanel, csMainTab, user]);

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

  /* 취향진단 결과 카카오 공유 (취향진단 페이지와 동일 — ?r=key 링크) */
  function shareSurveyKakao() {
    if (!surveyResult || surveyResult === 'none') return;
    const key = `${surveyResult.axis1}-${surveyResult.axis2}-${surveyResult.axis3}`;
    const info = SURVEY_MAP[key];
    const url = `${window.location.origin}/survey?r=${encodeURIComponent(key)}`;
    const ok = shareKakaoFeed({
      title: `내 과일 취향유형 · ${info?.name ?? '취향진단'}`,
      description: info?.tagline ?? '델리오 취향진단으로 내 과일 유형을 확인해보세요!',
      imageUrl: `${window.location.origin}/DelioLogo.png`,
      linkUrl: url,
      buttonTitle: '내 결과 보기',
    });
    if (!ok) { navigator.clipboard.writeText(url).then(() => showToastMsg('결과 링크를 복사했어요')); }
  }

  /* 취향 진단 맞춤 상품 로드 */
  useEffect(() => {
    if (activePanel !== 'survey' || !surveyResult || surveyResult === 'none' || surveyRecProducts.length > 0) return;
    async function loadSurveyRecs() {
      const supabase = createClient();
      /* 추천 상품 노출 설정 확인 */
      const { data: setting } = await supabase
        .from('site_settings').select('value').eq('key', 'survey_show_products').maybeSingle();
      const show = setting?.value !== 'false';
      setSurveyShowRec(show);
      if (!show) { setSurveyRecProducts([]); return; }
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
    loadCsInquiries(); // 항상 보이는 문의 내역 갱신
  }

  /* 쿠폰 — 패널 열릴 때 로드 */
  const [userCoupons, setUserCoupons] = useState<UserCoupon[]>([]);
  const [couponLoading, setCouponLoading] = useState(false);
  const [availableCouponCount, setAvailableCouponCount] = useState(0);
  const [dlCount, setDlCount] = useState(0);          // 다운가능 쿠폰 수
  const [downloadables, setDownloadables] = useState<PublicCoupon[]>([]); // 다운가능 쿠폰 목록
  const [claimingCoupon, setClaimingCoupon] = useState(false);
  const [couponCode, setCouponCode] = useState('');   // 쿠폰 등록 코드
  const [redeemingCode, setRedeemingCode] = useState(false);

  async function handleRedeemCode() {
    if (redeemingCode || !couponCode.trim()) return;
    setRedeemingCode(true);
    const res = await redeemCouponByCode(couponCode);
    showToastMsg(res.message);
    if (res.ok) {
      setCouponCode('');
      await loadUserCoupons();
      await refreshDownloadable();
    }
    setRedeemingCode(false);
  }

  async function loadUserCoupons() {
    if (!user) return;
    setCouponLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('user_coupons')
      .select(`id, used:is_used, issued_at, expires_at, coupon:coupon_id(name,discount_type,discount_value,min_order_amount,max_discount_amount,expires_at)`)
      .eq('user_id', user.id)
      .order('issued_at', { ascending: false });
    setUserCoupons((data as unknown as UserCoupon[]) || []);
    setCouponLoading(false);
  }
  async function refreshDownloadable() {
    if (!user) { setDlCount(0); setDownloadables([]); return; }
    const list = await getDownloadableCoupons(user.id);
    setDownloadables(list);
    setDlCount(list.length);
  }
  async function handleClaimCoupons() {
    if (!user || claimingCoupon) return;
    setClaimingCoupon(true);
    const n = await claimAllPublic(user.id);
    await loadUserCoupons();
    await refreshDownloadable();
    setClaimingCoupon(false);
    alert(n > 0 ? `${n}장의 쿠폰을 받았습니다.` : '받을 수 있는 쿠폰이 없습니다.');
  }
  /* 다운가능 쿠폰 1장만 받기 */
  async function claimOneCoupon(c: PublicCoupon) {
    if (!user || claimingCoupon) return;
    setClaimingCoupon(true);
    const supabase = createClient();
    const expires_at = c.valid_days != null
      ? new Date(Date.now() + c.valid_days * 86400000).toISOString()
      : c.expires_at;
    const { error } = await supabase.from('user_coupons').insert({ user_id: user.id, coupon_id: c.id, expires_at });
    showToastMsg(error ? '쿠폰 받기 실패: ' + error.message : '쿠폰을 받았습니다.');
    await loadUserCoupons();
    await refreshDownloadable();
    setClaimingCoupon(false);
  }

  /* 내 취소/환불 신청 내역 로드 */
  async function loadMyRefundReqs() {
    if (!user) return;
    const { data } = await createClient()
      .from('refund_requests')
      .select('id, order_id, reason, detail, status, reject_reason, created_at, type, orders ( order_no )')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setMyRefundReqs((data as unknown as MyRefundReq[]) || []);
  }
  /* 주문/환불 패널 열릴 때 로드 */
  useEffect(() => {
    if ((activePanel !== 'csrefund' && activePanel !== 'order') || !user) return;
    loadMyRefundReqs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePanel, user]);

  useEffect(() => {
    if (activePanel !== 'coupon' || !user) return;
    loadUserCoupons();
    refreshDownloadable();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePanel, user]);

  /* 배송지 — 패널 열릴 때 로드 */
  useEffect(() => {
    if (activePanel === 'address' && user) loadAddresses();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePanel, user]);

  /* 포인트 내역 — 패널 열릴 때 / 기간 바뀔 때 로드 */
  useEffect(() => {
    if (activePanel !== 'point' || !user) return;
    const from = new Date();
    from.setMonth(from.getMonth() - pointPeriod);
    createClient().from('point_logs')
      .select('id, amount, created_at, description')
      .eq('user_id', user.id)
      .gte('created_at', from.toISOString())
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => setPointLogs((data as typeof pointLogs) || []));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePanel, user, pointPeriod]);

  /* 위시리스트 — 패널 열릴 때 로드 */
  useEffect(() => {
    if (activePanel !== 'wish' || !user) return;
    async function loadWish() {
      setWishLoading(true);
      const supabase = createClient();
      const [{ data }, { data: farmData }] = await Promise.all([
        supabase.from('wishlist')
          .select('id, products(id,name,price,discounted_price,discount_rate,thumbnail_url,category,badge,is_dawn,is_new,is_best,avg_rating,review_count,short_desc)')
          .eq('user_id', user!.id).limit(40),
        supabase.from('farm_wishlist')
          .select('id, farms(id,slug,name,region,farm_type,intro,thumbnail_url,hero_image_url,logo_url)')
          .eq('user_id', user!.id).limit(40),
      ]);
      setWishlist((data as unknown as WishItem[]) || []);
      setFarmWishlist((farmData as unknown as typeof farmWishlist) || []);
      setWishLoading(false);
    }
    loadWish();
  }, [activePanel, user]);

  /* 농가 찜 삭제 */
  async function removeFarmWish(rowId: string) {
    const supabase = createClient();
    await supabase.from('farm_wishlist').delete().eq('id', rowId);
    setFarmWishlist(prev => prev.filter(f => f.id !== rowId));
    showToastMsg('농가 찜을 해제했습니다');
  }

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

  /* 패널 전환 (모바일: 메뉴 → 패널) — URL 변경으로 히스토리 기록 */
  function goPanel(panel: PanelType) {
    router.push(`/mypage?panel=${panel}`, { scroll: false });
  }
  /* 주문처리현황 단계 클릭 → 해당 상태로 필터 + 목록으로 스크롤 (같은 단계 재클릭 시 해제) */
  function selectStatusFilter(key: string) {
    setOrderStatusFilter(prev => (prev === key ? null : key));
    setOrderSearch('');
    setTimeout(() => orderListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
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
    setEditImages(r.image_urls || []);
    setEditVideo(r.video_url || null);
    setEditNewImages([]);
    setEditNewVideo(null);
    setEditTaste((r.taste as Record<string, number>) || {});
  }

  /* ── 리뷰 수정 저장 (이미지/영상 편집 포함) ── */
  async function handleUpdateReview(id: string) {
    if (!editContent.trim()) { alert('내용을 입력해주세요.'); return; }
    setEditSaving(true);
    const supabase = createClient();
    const safeName = (n: string) => `${Date.now()}_${Math.random().toString(36).slice(2,8)}_${n.replace(/[^a-zA-Z0-9._-]/g, '')}`;

    // 새 이미지 업로드
    const uploadedImgs: string[] = [];
    for (const f of editNewImages) {
      const path = `reviews/${user!.id}/${safeName(f.name)}`;
      const { error: upErr } = await supabase.storage.from('products').upload(path, f, { upsert: true });
      if (upErr) { setEditSaving(false); alert('사진 업로드 실패: ' + upErr.message); return; }
      uploadedImgs.push(supabase.storage.from('products').getPublicUrl(path).data.publicUrl);
    }
    // 새 영상 업로드 (있으면 기존 영상 대체)
    let finalVideo: string | null = editVideo;
    if (editNewVideo) {
      const path = `reviews/${user!.id}/${safeName(editNewVideo.name)}`;
      const { error: upErr } = await supabase.storage.from('products').upload(path, editNewVideo, { upsert: true });
      if (upErr) { setEditSaving(false); alert('영상 업로드 실패: ' + upErr.message); return; }
      finalVideo = supabase.storage.from('products').getPublicUrl(path).data.publicUrl;
    }
    const finalImages = [...editImages, ...uploadedImgs];

    const tasteVal = Object.keys(editTaste).length ? (editTaste as ReviewTaste) : null;
    const { error } = await supabase.from('reviews')
      .update({
        rating: editRating, content: editContent.trim(),
        image_urls: finalImages.length ? finalImages : null,
        video_url: finalVideo,
        taste: tasteVal,
      })
      .eq('id', id);
    setEditSaving(false);
    if (error) { alert('수정 실패: ' + error.message); return; }
    setMyReviews(prev => prev.map(r => r.id === id
      ? { ...r, rating: editRating, content: editContent.trim(), image_urls: finalImages.length ? finalImages : null, video_url: finalVideo, taste: tasteVal }
      : r));
    setEditingId(null);
  }

  /* 최근 본 상품 삭제 */
  function removeRecentProduct(id: string) {
    const next = recentProducts.filter(p => p.id !== id);
    setRecentProducts(next);
    try { localStorage.setItem('delio_recent_products', JSON.stringify(next)); } catch {}
  }

  /* 상품 찜하기(최근 본 상품 카드용) */
  async function addProductWish(id: string) {
    if (!user) { router.push('/login?next=/mypage'); return; }
    const { error } = await createClient().from('wishlist').insert({ user_id: user.id, product_id: id });
    if (error && !/duplicate|unique/i.test(error.message)) { showToastMsg('찜 실패: ' + error.message); return; }
    showToastMsg('찜 목록에 담았어요 ♥');
  }

  /* 패널 → 메뉴 복귀 (모바일) */
  function goBackMenu() {
    router.push('/mypage', { scroll: false });
  }
  /* PC용 패널 전환 (사이드바 클릭) — URL 변경으로 히스토리 기록 */
  function switchPanel(panel: PanelType) {
    router.push(`/mypage?panel=${panel}`, { scroll: false });
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
    /* 변경 항목 산출 (알림톡용) */
    const changed: string[] = [];
    if ((profile?.name || '') !== editName.trim()) changed.push('이름');
    if ((profile?.phone || '') !== editPhone.trim()) changed.push('연락처');
    if ((profile?.birth || '') !== editBirth.trim()) changed.push('생년월일');
    const payload = { name: editName.trim(), phone: editPhone.trim() || null, birth: editBirth.trim() || null };
    const { error } = await supabase.from('profiles').update(payload).eq('id', user!.id);
    setInfoSaving(false);
    if (error) { showToastMsg('저장 실패: ' + error.message); return; }
    setProfile(prev => prev ? { ...prev, ...payload } : prev);
    showToastMsg('회원정보가 저장되었습니다');
    /* 회원정보 변경 알림톡 (변경 항목 있고 연락처 있을 때) */
    if (changed.length > 0 && editPhone.trim()) {
      fetch('/api/notify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'profile_changed', phone: editPhone.trim(), recipient: editName.trim(),
          changedAt: new Date().toLocaleString('ko-KR'), changedFields: changed.join(', '),
        }),
      }).catch(() => {});
    }
  }
  /* 마케팅 수신동의 — 토글 켜고 끌 때 즉시 저장 */
  async function saveMktField(field: 'marketing_email' | 'marketing_sms' | 'push_enabled', value: boolean) {
    const supabase = createClient();
    const { error } = await supabase.from('profiles').update({ [field]: value }).eq('id', user!.id);
    if (error) { showToastMsg('저장 실패: ' + error.message); return; }
    setProfile(prev => prev ? { ...prev, [field]: value } : prev);
    showToastMsg('수신 설정이 변경되었습니다');
  }

  /* 휴대폰 본인인증 (등록/변경) — 버튼 클릭에서 바로 다날 인증창 호출 (팝업차단 회피) */
  /* PortOne(다날) 본인인증 공통 실행 — 성공 시 { ok: true } */
  async function runIdentityVerification(): Promise<boolean> {
    if (!user) { showToastMsg('로그인이 필요합니다.'); return false; }
    const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
    const channelKey = process.env.NEXT_PUBLIC_PORTONE_IDENTITY_CHANNEL_KEY;
    if (!storeId || !channelKey) { showToastMsg('본인인증 설정이 없습니다. 관리자에게 문의해주세요.'); return false; }
    try {
      const PortOne = await import('@portone/browser-sdk/v2');
      const id = `verify-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const response = await PortOne.requestIdentityVerification({ storeId, channelKey, identityVerificationId: id });
      if (!response || (response as { code?: string }).code !== undefined) {
        showToastMsg((response as { message?: string })?.message || '본인인증이 취소되었습니다.');
        return false;
      }
      const r = await fetch('/api/verify/confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identityVerificationId: id }),
      });
      const j = await r.json();
      if (j.code === 'DUP' || j.code === 'REJOIN') {
        alert(j.error || '이미 가입된 본인인증 정보입니다.');
        await createClient().auth.signOut();
        router.replace('/login');
        return false;
      }
      if (!j.ok) { showToastMsg(j.error || '본인인증에 실패했습니다.'); return false; }
      return true;
    } catch { showToastMsg('본인인증 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'); return false; }
  }
  /* 휴대폰번호 변경/등록용 본인인증 — 성공 시 갱신된 번호 반영 */
  async function startPhoneVerify() {
    const ok = await runIdentityVerification();
    if (!ok) return;
    const { data: prof } = await createClient().from('profiles').select('phone, birth, gender').eq('id', user!.id).maybeSingle();
    if (prof) { setProfile(prev => prev ? { ...prev, ...(prof as Partial<Profile>) } : prev); setEditPhone((prof as { phone?: string | null }).phone || ''); }
    showToastMsg('본인인증이 완료되었습니다.');
  }
  /* 회원정보 수정 진입 게이트 — 본인인증 성공 시 수정 폼(edit)으로 */
  const [reauthLoading, setReauthLoading] = useState(false);
  async function reauthForEdit() {
    if (reauthLoading) return;
    setReauthLoading(true);
    const ok = await runIdentityVerification();
    setReauthLoading(false);
    if (ok) {
      try { localStorage.setItem(`mp_reauth_at_${user?.id}`, String(Date.now())); } catch { /* noop */ }
      setInfoStep('edit'); showToastMsg('본인인증이 완료되었습니다 ✓');
    }
  }
  /* 회원 탈퇴 → 사유 선택 → 혜택소멸 안내·동의 → 소프트 탈퇴 처리 */
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawStep, setWithdrawStep] = useState<0 | 1 | 2>(0); // 0=닫힘 1=사유 2=동의
  const [withdrawReason, setWithdrawReason] = useState('');
  const [withdrawDetail, setWithdrawDetail] = useState('');
  const [withdrawAgree, setWithdrawAgree] = useState(false);
  /* 탈퇴 휴대폰 인증(OTP) */
  const [otpToken, setOtpToken] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpPhoneMasked, setOtpPhoneMasked] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  async function verifyWithdrawOtp() {
    if (otpVerifying || otpInput.length !== 6) return;
    setOtpVerifying(true);
    try {
      const res = await fetch('/api/account/withdraw/verify-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: otpInput.trim(), token: otpToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) { showToastMsg(data.error || '인증 실패'); setOtpVerifying(false); return; }
      setOtpVerified(true);
      showToastMsg('휴대폰 인증이 완료되었습니다 ✓');
    } catch { showToastMsg('인증 중 오류'); }
    setOtpVerifying(false);
  }
  async function sendWithdrawOtp() {
    if (otpSending) return;
    setOtpSending(true);
    try {
      const res = await fetch('/api/account/withdraw/send-otp', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) { showToastMsg(data.error || '인증번호 발송 실패'); setOtpSending(false); return; }
      setOtpToken(data.token); setOtpPhoneMasked(data.phoneMasked || ''); setOtpInput('');
      showToastMsg('인증번호를 발송했어요 (5분 내 입력)');
    } catch { showToastMsg('인증번호 발송 중 오류'); }
    setOtpSending(false);
  }
  async function submitWithdraw() {
    if (withdrawing) return;
    setWithdrawing(true);
    try {
      const reason = withdrawReason === '기타' ? `기타: ${withdrawDetail.trim()}` : withdrawDetail.trim() ? `${withdrawReason} — ${withdrawDetail.trim()}` : withdrawReason;
      const res = await fetch('/api/account/withdraw', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, code: otpInput.trim(), token: otpToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) { alert('탈퇴 처리 중 오류가 발생했습니다.\n' + (data.error || '')); setWithdrawing(false); return; }
      await signOut();
      alert('탈퇴가 완료되었습니다.\n그동안 델리오를 이용해 주셔서 감사합니다.');
      router.replace('/');
    } catch (e) {
      alert('탈퇴 처리 중 오류가 발생했습니다.\n' + (e as Error).message);
      setWithdrawing(false);
    }
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
    const makeDefault = addrForm.is_default || addresses.length === 0;
    const payload = {
      label: addrForm.label, recipient: addrForm.recipient, phone: addrForm.phone,
      zipcode: addrForm.zipcode, address1: addrForm.address1, address2: addrForm.address2,
      delivery_request: addrForm.delivery_request?.trim() || null,
    };
    // 기본 배송지로 지정 시 기존 기본 해제
    if (makeDefault) {
      await supabase.from('shipping_addresses').update({ is_default: false }).eq('user_id', user!.id);
    }
    if (addrEditing) {
      const { error } = await supabase.from('shipping_addresses').update({ ...payload, is_default: makeDefault }).eq('id', addrEditing.id);
      if (error) { showToastMsg('저장 실패: ' + error.message); return; }
    } else {
      if (addresses.length >= 5) { showToastMsg('배송지는 최대 5개까지 저장 가능합니다.'); return; }
      const { error } = await supabase.from('shipping_addresses').insert({ ...payload, user_id: user!.id, is_default: makeDefault });
      if (error) { showToastMsg('저장 실패: ' + error.message); return; }
    }
    setAddrFormOpen(false);
    setAddrEditing(null);
    setAddrForm({ ...EMPTY_ADDR });
    setAddrReqCustom(false);
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
  /* 주문내역 검색 (주문번호 · 상품명 · 날짜) */
  /* 주문처리현황 단계 → 주문 상태 그룹 */
  const STATUS_GROUPS: Record<string, string[]> = {
    pending:   ['pending'],
    preparing: ['paid', 'preparing'],
    shipped:   ['shipped'],
    delivered: ['delivered', 'confirmed'],
  };
  const filteredOrders = (() => {
    let list = orders;
    if (orderStatusFilter && STATUS_GROUPS[orderStatusFilter]) {
      const allow = STATUS_GROUPS[orderStatusFilter];
      list = list.filter(o => allow.includes(o.status));
    }
    const q = orderSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(o => {
      const dateStr = new Date(o.created_at).toLocaleDateString('ko-KR'); // 2026. 3. 10.
      const dateCompact = dateStr.replace(/[\s.]/g, ''); // 2026310 형태
      return (
        (o.order_no || '').toLowerCase().includes(q) ||
        dateStr.includes(q) || dateCompact.includes(q.replace(/[\s.]/g, '')) ||
        (o.order_items || []).some(it => (it.product_name || '').toLowerCase().includes(q))
      );
    });
  })();
  /* 작성 가능한 리뷰 = 배송완료(delivered/confirmed) 주문 중 아직 리뷰 안 쓴 상품 (상품별 1건) */
  const writableReviews = (() => {
    const reviewedPids = new Set(myReviews.map(r => r.products?.id).filter(Boolean) as string[]);
    const seen = new Set<string>();
    const list: { id: string; name: string; thumb: string | null }[] = [];
    orders.forEach(o => {
      if (o.status === 'delivered' || o.status === 'confirmed') {
        o.order_items?.forEach(it => {
          if (it.product_id && !reviewedPids.has(it.product_id) && !seen.has(it.product_id)) {
            seen.add(it.product_id);
            list.push({ id: it.product_id, name: it.product_name, thumb: it.thumbnail_url ?? null });
          }
        });
      }
    });
    return list;
  })();
  const gradeLabel = GRADE_LABEL[normalizeGrade(profile?.grade)];

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

      {/* 상품 문의 작성 모달 (배송조회에서 바로) */}
      {askModal && (
        <div onClick={() => setAskModal(null)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:3100, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width:'100%', maxWidth:440, background:'#fff', borderRadius:'16px 16px 0 0', padding:'22px 20px calc(24px + env(safe-area-inset-bottom))', maxHeight:'85vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
              <span style={{ fontSize:17, fontWeight:700 }}>상품 문의</span>
              <button onClick={() => setAskModal(null)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:22, color:'#999', lineHeight:1, padding:0 }}>×</button>
            </div>
            {askModal.items.length > 1 ? (
              <div style={{ marginTop:14, marginBottom:18 }}>
                <label style={{ display:'block', fontSize:13.5, fontWeight:700, color:'#1A1A1A', marginBottom:8 }}>문의할 상품 선택</label>
                {(() => {
                  const cur = askModal.items.find(it => it.productId === askModal.selectedId);
                  return (
                    <div className="opt-dd">
                      <button type="button" className={`opt-dd-btn${askProdOpen ? ' open' : ''}`} onClick={() => setAskProdOpen(o => !o)}>
                        <span>{cur?.productName}</span>
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                      </button>
                      {askProdOpen && (
                        <>
                          <div className="opt-dd-backdrop" style={{ zIndex: 3101 }} onClick={() => setAskProdOpen(false)} />
                          <div className="opt-dd-list" style={{ zIndex: 3102 }}>
                            {askModal.items.map(it => (
                              <button type="button" key={it.productId}
                                className={`opt-dd-item${it.productId === askModal.selectedId ? ' sel' : ''}`}
                                onClick={() => { setAskModal(m => m ? { ...m, selectedId: it.productId } : m); setAskProdOpen(false); }}>{it.productName}</button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div style={{ fontSize:13, color:'#888', marginBottom:18, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{askModal.items[0]?.productName}</div>
            )}

            <label style={{ display:'block', fontSize:13.5, fontWeight:700, color:'#1A1A1A', marginBottom:8 }}>카테고리</label>
            {(() => {
              const CATS = [['문의','문의 유형 선택하기'],['배송관련','배송관련'],['취소/교환/반품','취소/교환/반품'],['상품','상품 문의'],['기타','기타']] as const;
              const curLabel = CATS.find(([v]) => v === askCategory)?.[1] ?? '문의 유형 선택하기';
              return (
                <div className="opt-dd" style={{ marginBottom:18 }}>
                  <button type="button" className={`opt-dd-btn${askCatOpen ? ' open' : ''}`} onClick={() => setAskCatOpen(o => !o)}>
                    <span className={askCategory === '문의' ? 'ph' : ''}>{curLabel}</span>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  {askCatOpen && (
                    <>
                      <div className="opt-dd-backdrop" style={{ zIndex: 3101 }} onClick={() => setAskCatOpen(false)} />
                      <div className="opt-dd-list" style={{ zIndex: 3102 }}>
                        {CATS.map(([v, l]) => (
                          <button type="button" key={v}
                            className={`opt-dd-item${askCategory === v ? ' sel' : ''}`}
                            onClick={() => { setAskCategory(v); setAskCatOpen(false); }}>{l}</button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            <label style={{ display:'block', fontSize:13.5, fontWeight:700, color:'#1A1A1A', marginBottom:8 }}>문의 내용 <span style={{ color:'var(--color-accent)' }}>*</span></label>
            <textarea value={askContent} onChange={e => setAskContent(e.target.value)} placeholder="문의 내용을 입력해주세요."
              style={{ width:'100%', minHeight:120, padding:'12px 14px', border:'1px solid #E0E0DC', borderRadius:10, fontSize:14, color:'#333', fontFamily:'inherit', resize:'vertical', boxSizing:'border-box', marginBottom:16 }} />

            <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13.5, color:'#555', marginBottom:20, cursor:'pointer' }}>
              <input type="checkbox" checked={askPrivate} onChange={e => setAskPrivate(e.target.checked)} style={{ width:16, height:16 }} />
              비밀 문의로 등록
            </label>

            <button onClick={submitAsk} disabled={askSubmitting}
              style={{ width:'100%', padding:'14px 0', border:'none', borderRadius:10, background:'#1A1A1A', color:'#fff', fontSize:15, fontWeight:700, fontFamily:'inherit', cursor: askSubmitting ? 'default' : 'pointer', opacity: askSubmitting ? 0.6 : 1 }}>
              {askSubmitting ? '등록 중...' : '등록하기'}
            </button>
          </div>
        </div>
      )}

      {/* 상품 선택 모달 (리뷰 쓰기 / 재구매 / 장바구니 — 상품 2개 이상) */}
      {picker && (() => {
        const title = picker.mode === 'review' ? '리뷰 쓸 상품 선택' : picker.mode === 'repurchase' ? '재구매할 상품 선택' : '장바구니에 담을 상품 선택';
        const cta = picker.mode === 'review' ? '리뷰 쓰기' : picker.mode === 'repurchase' ? '재구매' : '장바구니 담기';
        const cur = picker.items.find(it => it.productId === picker.selectedId);
        return (
          <div onClick={() => { setPicker(null); setPickerOpen(false); }}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:3100, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
            <div onClick={e => e.stopPropagation()}
              style={{ width:'100%', maxWidth:440, background:'#fff', borderRadius:'16px 16px 0 0', padding:'22px 20px calc(24px + env(safe-area-inset-bottom))', maxHeight:'85vh', overflowY:'auto' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
                <span style={{ fontSize:17, fontWeight:700 }}>{title}</span>
                <button onClick={() => { setPicker(null); setPickerOpen(false); }} style={{ background:'none', border:'none', cursor:'pointer', fontSize:22, color:'#999', lineHeight:1, padding:0 }}>×</button>
              </div>
              <div className="opt-dd" style={{ marginBottom:20 }}>
                <button type="button" className={`opt-dd-btn${pickerOpen ? ' open' : ''}`} onClick={() => setPickerOpen(o => !o)}>
                  <span>{cur?.productName}</span>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                {pickerOpen && (
                  <>
                    <div className="opt-dd-backdrop" style={{ zIndex: 3101 }} onClick={() => setPickerOpen(false)} />
                    <div className="opt-dd-list" style={{ zIndex: 3102 }}>
                      {picker.items.map(it => (
                        <button type="button" key={it.productId}
                          className={`opt-dd-item${it.productId === picker.selectedId ? ' sel' : ''}`}
                          onClick={() => { setPicker(m => m ? { ...m, selectedId: it.productId } : m); setPickerOpen(false); }}>{it.productName}</button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <button onClick={() => { if (cur) runItemAction(picker.mode, cur); setPicker(null); setPickerOpen(false); }}
                style={{ width:'100%', padding:'14px 0', border:'none', borderRadius:10, background:'#1A1A1A', color:'#fff', fontSize:15, fontWeight:700, fontFamily:'inherit', cursor:'pointer' }}>
                {cta}
              </button>
            </div>
          </div>
        );
      })()}

      {/* 배송추적 모달 */}
      {trackingTarget && (
        <TrackingModal
          carrierId={trackingTarget.carrierId}
          trackingNumber={trackingTarget.trackingNumber}
          onClose={() => setTrackingTarget(null)}
        />
      )}

      {/* 주문 상세보기 모달 */}
      {detailOrder && (() => {
        const o = detailOrder;
        const PM: Record<string, string> = { card:'카드', kakao:'카카오페이', naver:'네이버페이', toss:'토스페이', vbank:'무통장입금', bank:'무통장입금', transfer:'계좌이체' };
        const wd = (d: string) => new Date(d).toLocaleDateString('ko-KR',{ month:'numeric', day:'numeric', weekday:'short' });
        let statusSuffix = '';
        if (o.status==='shipped' && (o.shipped_at || o.created_at)) statusSuffix = ` · ${wd(o.shipped_at || o.created_at)} 배송 시작`;
        else if (o.status==='delivered' && o.delivered_at) statusSuffix = ` · ${wd(o.delivered_at)} 도착`;
        else if (o.status==='cancelled' || o.status==='refunded') statusSuffix = ' · 7영업일 이내 환불';
        const statusColor = o.status==='delivered'?'#1A1A1A': (o.status==='cancelled'||o.status==='refunded')?'#e00':'var(--color-accent)';
        const sellers = [...new Set((o.order_items || []).map(it => it.farm_name).filter(Boolean))].join(', ');
        // 라벨|값 (배송지)
        const rowL = (label: string, value: React.ReactNode) => (
          <div style={{ display:'flex', fontSize:13.5, padding:'5px 0', alignItems:'flex-start' }}>
            <span style={{ width:76, flexShrink:0, color:'#999' }}>{label}</span>
            <span style={{ flex:1, color:'#333', wordBreak:'keep-all' }}>{value}</span>
          </div>
        );
        // 양끝 정렬 (결제)
        const rowR = (label: React.ReactNode, value: React.ReactNode, accent = false) => (
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:13.5, padding:'5px 0' }}>
            <span style={{ color:'#999' }}>{label}</span>
            <span style={{ fontWeight: accent ? 800 : 500, color: accent ? '#1A1A1A' : '#333', fontSize: accent ? 15 : 13.5 }}>{value}</span>
          </div>
        );
        const secTitle: React.CSSProperties = { fontSize:14, fontWeight:800, color:'#1A1A1A', marginBottom:12 };
        const sec: React.CSSProperties = { paddingBottom:18, marginBottom:18, borderBottom:'8px solid #F4F4F2' };
        return (
          <div style={{ position:'fixed', inset:0, background:'#fff', zIndex:3100, overflowY:'auto' }}>
            <div style={{ maxWidth:480, margin:'0 auto', minHeight:'100%', background:'#fff', paddingBottom:'calc(24px + env(safe-area-inset-bottom))' }}>
              {/* 헤더 */}
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'14px 16px', position:'sticky', top:0, background:'#fff', zIndex:2, borderBottom:'1px solid #F0F0F0' }}>
                <button onClick={() => setDetailOrder(null)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'#333', lineHeight:1, padding:0 }}>✕</button>
                <span style={{ flex:1, textAlign:'center', fontSize:16, fontWeight:700, marginRight:20 }}>주문상세</span>
              </div>
              <div style={{ fontSize:12.5, color:'#999', padding:'0 20px 16px' }}>
                {new Date(o.created_at).toLocaleDateString('ko-KR')} 주문 · 주문번호 {o.order_no}
              </div>

              <div style={{ padding:'0 20px' }}>
                {/* 배송지 정보 */}
                <div style={sec}>
                  <div style={secTitle}>배송지 정보</div>
                  {rowL('받는 사람', o.recipient || '-')}
                  {rowL('연락처', o.phone || '-')}
                  {rowL('주소', `${o.zipcode ? `(${o.zipcode}) ` : ''}${o.address1 || ''} ${o.address2 || ''}`.trim() || '-')}
                  {o.delivery_memo && rowL('배송메모', o.delivery_memo)}
                </div>

                {/* 주문 상품 */}
                <div style={sec}>
                  <div style={secTitle}>주문 상품</div>
                  <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>
                    <span style={{ color:statusColor }}>{STATUS_LABEL[o.status] || o.status}</span>
                    {statusSuffix && <span style={{ color:'#555', fontWeight:600 }}>{statusSuffix}</span>}
                  </div>
                  {o.order_items?.map((item, i) => (
                    <div key={i} style={{ display:'flex', gap:12, alignItems:'flex-start', marginBottom:12 }}>
                      <div style={{ width:56, height:56, borderRadius:8, background:'#F7F7F5', flexShrink:0, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {item.thumbnail_url ? <img src={imgThumb(item.thumbnail_url, 200)} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <span style={{ fontSize:24 }}>🍑</span>}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13.5, fontWeight:600, color:'#1A1A1A', lineHeight:1.4 }}>{item.product_name}</div>
                        {item.option_label && <div style={{ fontSize:12.5, color:'#999', marginTop:3 }}>{item.option_label}</div>}
                        <div style={{ fontSize:13, color:'#555', marginTop:5 }}>{fmtPrice(item.unit_price)}원 · {item.quantity}개</div>
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid #F0F0F0' }}>
                    {rowL('배송비', '무료 (일반택배)')}
                    {sellers && rowL('판매자', sellers)}
                  </div>
                </div>

                {/* 결제 정보 */}
                <div style={{ paddingBottom:8 }}>
                  <div style={secTitle}>결제 정보</div>
                  {rowR('상품금액', `${fmtPrice(o.total_amount ?? o.final_amount)}원`)}
                  {rowR('배송비', '0원')}
                  {(o.coupon_discount ?? 0) > 0 && rowR('쿠폰할인', `−${fmtPrice(o.coupon_discount!)}원`)}
                  {(o.point_used ?? 0) > 0 && rowR('적립금 사용', `−${fmtPrice(o.point_used!)}원`)}
                  <div style={{ borderTop:'1px solid #EEE', marginTop:8, paddingTop:8 }}>
                    {rowR('주문금액', `${fmtPrice(o.final_amount)}원`, true)}
                  </div>
                  <div style={{ marginTop:8 }}>
                    {rowR(`${PM[o.payment_method || ''] || o.payment_method || '결제'}`, `${fmtPrice(o.final_amount)}원`)}
                  </div>
                  {(o.earned_point ?? 0) > 0 && (
                    <div style={{ fontSize:12, color:'var(--color-accent)', textAlign:'right', marginTop:6 }}>적립 {fmtPrice(o.earned_point!)}P</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 취소/환불 상세 모달 (오늘의집 스타일) */}
      {cancelDetail && (() => {
        const o = cancelDetail;
        const PM: Record<string, string> = { card:'카드', kakao:'카카오페이', naver:'네이버페이', toss:'토스페이', vbank:'무통장입금', bank:'무통장입금', transfer:'계좌이체' };
        const isRefund = o.status === 'refunded';
        const req = myRefundReqs.find(r => r.order_id === o.id) || null;
        const rowR = (label: React.ReactNode, value: React.ReactNode, accent = false) => (
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:13.5, padding:'5px 0' }}>
            <span style={{ color:'#999' }}>{label}</span>
            <span style={{ fontWeight: accent ? 800 : 500, color: accent ? '#1A1A1A' : '#333', fontSize: accent ? 15 : 13.5 }}>{value}</span>
          </div>
        );
        const secTitle: React.CSSProperties = { fontSize:14, fontWeight:800, color:'#1A1A1A', marginBottom:12 };
        const sec: React.CSSProperties = { paddingBottom:18, marginBottom:18, borderBottom:'8px solid #F4F4F2' };
        return (
          <div style={{ position:'fixed', inset:0, background:'#fff', zIndex:3100, overflowY:'auto' }}>
            <div style={{ maxWidth:480, margin:'0 auto', minHeight:'100%', background:'#fff', paddingBottom:'calc(24px + env(safe-area-inset-bottom))' }}>
              {/* 헤더 */}
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'14px 16px', position:'sticky', top:0, background:'#fff', zIndex:2, borderBottom:'1px solid #F0F0F0' }}>
                <button onClick={() => setCancelDetail(null)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'#333', lineHeight:1, padding:0 }}>✕</button>
                <span style={{ flex:1, textAlign:'center', fontSize:16, fontWeight:700, marginRight:20 }}>{isRefund ? '환불상세' : '취소상세'}</span>
              </div>
              <div style={{ fontSize:12.5, color:'#999', padding:'0 20px 16px' }}>
                {new Date(req?.created_at || o.created_at).toLocaleDateString('ko-KR')} {isRefund ? '환불요청' : '취소요청'}
              </div>

              <div style={{ padding:'0 20px' }}>
                {/* 취소 상품 */}
                <div style={sec}>
                  <div style={secTitle}>{isRefund ? '환불 상품' : '취소 상품'}</div>
                  {o.order_items?.map((item, i) => (
                    <div key={i} style={{ display:'flex', gap:12, alignItems:'flex-start', marginBottom:12 }}>
                      <div style={{ width:56, height:56, borderRadius:8, background:'#F7F7F5', flexShrink:0, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {item.thumbnail_url ? <img src={imgThumb(item.thumbnail_url, 200)} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <span style={{ fontSize:24 }}>🍑</span>}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13.5, fontWeight:600, color:'#1A1A1A', lineHeight:1.4 }}>{item.product_name}</div>
                        {item.option_label && <div style={{ fontSize:12.5, color:'#999', marginTop:3 }}>{item.option_label}</div>}
                        <div style={{ fontSize:13, color:'#555', marginTop:5 }}>{fmtPrice(item.unit_price)}원 · {item.quantity}개</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 환불 정보 */}
                <div style={sec}>
                  <div style={secTitle}>환불 정보</div>
                  {rowR('주문금액', `${fmtPrice(o.final_amount)}원`)}
                  {rowR('차감금액', '0원')}
                  <div style={{ borderTop:'1px solid #EEE', marginTop:8, paddingTop:8 }}>
                    {rowR('환불금액', `${fmtPrice(o.final_amount)}원`, true)}
                  </div>
                  <div style={{ marginTop:8 }}>
                    {rowR(`${PM[o.payment_method || ''] || o.payment_method || '결제'}`, `${fmtPrice(o.final_amount)}원`)}
                  </div>
                  {rowR('환불예정일', '환불 승인 후 최대 7영업일 소요')}
                </div>

                {/* 취소 이유 */}
                {req && (
                  <div style={{ paddingBottom:8 }}>
                    <div style={secTitle}>{isRefund ? '환불 이유' : '취소 이유'}</div>
                    <div style={{ fontSize:13.5, color:'#333', lineHeight:1.6 }}>{req.reason}</div>
                    {req.detail && <div style={{ fontSize:13, color:'#777', marginTop:6, lineHeight:1.6 }}>{req.detail}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 회원 탈퇴 모달 (1.사유 → 2.혜택소멸·동의) */}
      {withdrawStep > 0 && (() => {
        const REASONS = ['앱 사용이 불편해요','상품 탐색이 어려워요','상품 배송이 느려요','구매할 만한 상품이 없어요','광고성 알림이 너무 많이 와요','상품의 질이 좋지 않아요','쓰지 않는 앱이에요','재가입할 거예요','기타'];
        return (
          <div onClick={() => setWithdrawStep(0)}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:3100, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
            <div onClick={e => e.stopPropagation()}
              style={{ background:'#fff', borderRadius:14, width:'100%', maxWidth:440, maxHeight:'88vh', overflowY:'auto', padding:'24px 22px 22px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18 }}>
                <h3 style={{ fontSize:17, fontWeight:800, lineHeight:1.4 }}>
                  {withdrawStep === 1 ? '탈퇴하는 이유를 알려주세요' : `${profile?.name || '회원'}님의 혜택이 모두 사라져요!`}
                </h3>
                <button onClick={() => setWithdrawStep(0)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color:'#999', lineHeight:1 }}>✕</button>
              </div>

              {withdrawStep === 1 ? (
                <>
                  <div>
                    {REASONS.map(rs => (
                      <div key={rs} style={{ borderBottom:'1px solid #F2F2F2' }}>
                        <button type="button" onClick={() => setWithdrawReason(rs)}
                          style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'14px 2px', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
                          <span style={{ width:18, height:18, borderRadius:'50%', border:`2px solid ${withdrawReason===rs ? 'var(--color-accent)' : '#CFCFCF'}`, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                            {withdrawReason===rs && <span style={{ width:8, height:8, borderRadius:'50%', background:'var(--color-accent)' }} />}
                          </span>
                          <span style={{ fontSize:14, color:'#333', fontWeight: withdrawReason===rs ? 700 : 500 }}>{rs}</span>
                        </button>
                        {withdrawReason===rs && (
                          <textarea value={withdrawDetail} onChange={e => setWithdrawDetail(e.target.value)} rows={3}
                            placeholder="구체적으로 알려주시면 빠르게 개선해볼게요"
                            style={{ width:'100%', padding:'10px 12px', margin:'0 0 12px', fontSize:13, border:'1.5px solid #E5E5E5', borderRadius:8, resize:'none', outline:'none', fontFamily:'inherit', lineHeight:1.6, boxSizing:'border-box' }} />
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ display:'flex', gap:10, marginTop:20 }}>
                    <button onClick={() => setWithdrawStep(0)} style={{ flex:1, padding:'13px', border:'1.5px solid #E5E5E5', borderRadius:10, background:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>계속 사용하기</button>
                    <button onClick={() => setWithdrawStep(2)} disabled={!withdrawReason}
                      style={{ flex:1, padding:'13px', border:'none', borderRadius:10, background: withdrawReason ? 'var(--color-accent)' : '#E5E5E5', color:'#fff', fontSize:14, fontWeight:700, cursor: withdrawReason ? 'pointer' : 'not-allowed', fontFamily:'inherit' }}>다음 단계로</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ background:'#F7F7F5', borderRadius:10, padding:'4px 14px', marginBottom:18 }}>
                    {[['잔여 포인트', `${fmtPrice(profile?.point_balance || 0)} P`], ['잔여 쿠폰', `${availableCouponCount} 개`]].map(([l, v]) => (
                      <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'12px 0', fontSize:14, borderBottom:'1px solid #ECECEC' }}>
                        <span style={{ color:'#555' }}>{l}</span><span style={{ fontWeight:800, color:'#5B7FE0' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ background:'#F8FAFC', border:'1px solid #EEF2F6', borderRadius:10, padding:'14px 16px', fontSize:12.5, color:'#555', lineHeight:1.8, marginBottom:18 }}>
                    <div style={{ fontWeight:700, color:'#1A1A1A', marginBottom:6 }}>ⓘ 꼭 확인해주세요!</div>
                    · 탈퇴 시 계정과 관련된 정보는 복구가 불가능합니다.<br />
                    · 보유 중인 쿠폰·포인트는 모두 소멸되며 재가입 후에도 복구할 수 없습니다.<br />
                    · 유·무상 포인트는 탈퇴 시 소멸되니 미리 사용하시기 바랍니다.
                  </div>
                  <label style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16, cursor:'pointer', userSelect:'none' }}>
                    <input type="checkbox" checked={withdrawAgree} onChange={e => setWithdrawAgree(e.target.checked)} style={{ width:16, height:16, accentColor:'var(--color-accent)' }} />
                    <span style={{ fontSize:13, color:'#333' }}>위 안내사항을 확인했으며 탈퇴에 동의합니다.</span>
                  </label>

                  {/* 휴대폰 본인확인 (번호 등록된 경우) */}
                  {editPhone.trim() && (
                    <div style={{ marginBottom:16 }}>
                      <div style={{ fontSize:13, fontWeight:700, marginBottom:2 }}>휴대폰 본인확인</div>
                      <div style={{ fontSize:12, color:'#999', marginBottom:8 }}>타인에 의한 계정 삭제를 방지하기 위해 본인인증이 필요합니다.</div>
                      <div style={{ display:'flex', gap:8 }}>
                        <input value={otpInput} disabled={otpVerified}
                          onChange={e => setOtpInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                          inputMode="numeric" placeholder={otpToken ? `${otpPhoneMasked} 로 발송된 인증번호` : '인증번호 6자리'}
                          style={{ flex:1, height:42, padding:'0 12px', border:`1.5px solid ${otpVerified ? '#2D7A4D' : '#E2E8F0'}`, borderRadius:8, fontSize:13, fontFamily:'inherit', outline:'none', background: otpVerified ? '#F1F8F4' : '#fff' }} />
                        <button onClick={() => { setOtpVerified(false); sendWithdrawOtp(); }} disabled={otpSending}
                          style={{ height:42, padding:'0 14px', borderRadius:8, border:'1.5px solid #1A1A1A', background:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                          {otpSending ? '발송 중' : otpToken ? '재발송' : '인증요청'}
                        </button>
                      </div>
                      {otpToken && (
                        otpVerified ? (
                          <div style={{ fontSize:13, color:'#2D7A4D', fontWeight:700, marginTop:8 }}>✓ 인증이 완료되었습니다.</div>
                        ) : (
                          <button onClick={verifyWithdrawOtp} disabled={otpInput.length !== 6 || otpVerifying}
                            style={{ width:'100%', marginTop:8, height:42, borderRadius:8, border:'none',
                              background: otpInput.length === 6 ? '#1A1A1A' : '#E5E5E5', color:'#fff', fontSize:13, fontWeight:700,
                              cursor: otpInput.length === 6 ? 'pointer' : 'not-allowed', fontFamily:'inherit' }}>
                            {otpVerifying ? '확인 중...' : '인증확인'}
                          </button>
                        )
                      )}
                    </div>
                  )}

                  {(() => {
                    const phoneOk = !editPhone.trim() || otpVerified;
                    const canSubmit = withdrawAgree && phoneOk && !withdrawing;
                    return (
                      <div style={{ display:'flex', gap:10 }}>
                        <button onClick={() => setWithdrawStep(0)} style={{ flex:1, padding:'13px', border:'1.5px solid #E5E5E5', borderRadius:10, background:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>계속 사용하기</button>
                        <button onClick={submitWithdraw} disabled={!canSubmit}
                          style={{ flex:1, padding:'13px', border:'none', borderRadius:10, background: canSubmit ? 'var(--color-accent)' : '#E5E5E5', color:'#fff', fontSize:14, fontWeight:700, cursor: canSubmit ? 'pointer' : 'not-allowed', fontFamily:'inherit' }}>
                          {withdrawing ? '처리 중...' : '탈퇴하기'}
                        </button>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* Toast */}
      {toast && (
        <div style={{
          position:'fixed', bottom:90, left:'50%', transform:'translateX(-50%)',
          background:'rgba(0,0,0,0.75)', color:'#fff', padding:'10px 20px',
          borderRadius:20, fontSize:13, zIndex:9999, whiteSpace:'nowrap', pointerEvents:'none',
        }}>{toast}</div>
      )}

      <div className="container">

        {/* ── 모바일 메뉴 ── */}
        <div className="mp-mobile-menu" style={{ display: showMobileMenu ? undefined : 'none' }}>

          {/* 프로필 헤더 */}
          <div className="mp-mb-profile">
            <label className="mp-mb-avatar-wrap">
              <input type="file" accept="image/*" onChange={handleAvatarUpload} hidden disabled={avatarUploading} />
              <div className={`mp-mb-avatar${profile?.avatar_url ? ' has-img' : ''}`}>
                {profile?.avatar_url
                  ? <img src={imgThumb(profile.avatar_url, 120)} alt="프로필" />
                  : (profile?.name || user.email || '?').trim().charAt(0).toUpperCase()}
              </div>
              <span className="mp-mb-avatar-cam">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
                </svg>
              </span>
            </label>
            <button className="mp-mb-profile-main" onClick={() => goPanel('info')}>
              <div className="mp-mb-name">
                {profile?.name || user.email?.split('@')[0]}님 <IconArrowRight />
              </div>
              <div className="mp-mb-grade">현재 {gradeLabel} 등급입니다.</div>
            </button>
            <button className="mp-mb-membership" onClick={() => goPanel('grade')}>
              멤버십 혜택 보기
            </button>
          </div>

          {/* 통계 3열 카드 */}
          <div className="mp-mb-stats">
            <button className="mp-mb-stat" onClick={() => goPanel('myreviews')}>
              <span className="mp-mb-stat-label">상품 후기</span>
              <span className="mp-mb-stat-val">{myReviews.length}</span>
            </button>
            <button className="mp-mb-stat" onClick={() => goPanel('point')}>
              <span className="mp-mb-stat-label">포인트</span>
              <span className="mp-mb-stat-val">{fmtPrice(profile?.point_balance || 0)}</span>
            </button>
            <button className="mp-mb-stat" onClick={() => goPanel('coupon')}>
              <span className="mp-mb-stat-label">쿠폰</span>
              <span className="mp-mb-stat-val">{availableCouponCount}</span>
            </button>
          </div>

          {/* 쇼핑 정보 */}
          <div className="mp-menu-section">
            <div className="mp-menu-section-title">쇼핑 정보</div>
            <button className="mp-menu-item" onClick={() => goPanel('order')}>
              <span>주문/배송 내역</span><IconArrowRight />
            </button>
            <button className="mp-menu-item" onClick={() => goPanel('point')}>
              <span>포인트 내역</span><IconArrowRight />
            </button>
            <button className="mp-menu-item" onClick={() => goPanel('coupon')}>
              <span>쿠폰 내역</span><IconArrowRight />
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
            <button className="mp-menu-item" onClick={() => goPanel('grade')}>
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
            <button className="mp-menu-item mp-menu-item-logout" onClick={handleLogout}>
              <span>로그아웃</span><IconArrowRight />
            </button>
          </div>

          {/* 관심상품 미리보기 */}
          {wishlist.filter(w => w.products).length > 0 && (
            <div className="mp-mb-wishprev">
              <div className="mp-mb-wishprev-head">
                <span>관심상품</span>
                <button onClick={() => goPanel('wish')}>전체보기 <IconArrowRight /></button>
              </div>
              <div className="mp-mb-wishprev-scroll">
                {wishlist.filter(w => w.products).slice(0, 12).map(w => (
                  <button key={w.id} className="mp-mb-wishprev-item" onClick={() => router.push(`/product/${w.products!.id}`)}>
                    <div className="mp-mb-wishprev-thumb">
                      {w.products!.thumbnail_url
                        ? <img src={imgThumb(w.products!.thumbnail_url, 150)} alt={w.products!.name} />
                        : <div className="mp-mb-wishprev-noimg">🍎</div>}
                    </div>
                    <span className="mp-mb-wishprev-name">{w.products!.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
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
                <button className={`mp-nav-link${activePanel==='point'?' active':''}`} onClick={() => switchPanel('point')}>포인트 내역</button>
                <button className={`mp-nav-link${activePanel==='coupon'?' active':''}`} onClick={() => switchPanel('coupon')}>쿠폰 내역</button>
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
                <button type="button" className="mp-stat mp-stat-btn" onClick={() => switchPanel('point')}>
                  <div className="mp-stat-icon" style={{ fontSize:15, fontWeight:800 }}>₩</div>
                  <div>
                    <div className="mp-stat-value">{fmtPrice(profile?.point_balance||0)}원</div>
                    <div className="mp-stat-label">총 포인트</div>
                  </div>
                </button>
                <div className="mp-stat-divider" />
                <button type="button" className="mp-stat mp-stat-btn" onClick={() => switchPanel('coupon')}>
                  <div className="mp-stat-icon">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20"/><path d="M6 14h4"/>
                    </svg>
                  </div>
                  <div>
                    <div className="mp-stat-value">{availableCouponCount}개</div>
                    <div className="mp-stat-label">쿠폰</div>
                  </div>
                </button>
                <div className="mp-stat-divider" />
                <button type="button" className="mp-stat mp-stat-btn" onClick={() => { setOrderStatusFilter(null); setOrderSearch(''); orderListRef.current?.scrollIntoView({ behavior:'smooth', block:'start' }); }}>
                  <div className="mp-stat-icon">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>
                      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 001.95 1.53h9.58a2 2 0 001.95-1.53l1.54-8.42H5.05"/>
                    </svg>
                  </div>
                  <div>
                    <div className="mp-stat-value">{fmtPrice(totalOrderAmount)}원</div>
                    <div className="mp-stat-label">총주문</div>
                  </div>
                </button>
              </div>

              {/* 주문처리 현황 */}
              <div className="mp-section">
                <div className="mp-section-header">
                  <span className="mp-section-title">나의 주문처리 현황</span>
                  <span className="mp-section-sub">(최근 3개월 기준)</span>
                </div>
                <div className="mp-order-flow">
                  <button type="button" className={`mp-flow-step${orderStatusFilter==='pending'?' active':''}`} onClick={() => selectStatusFilter('pending')}>
                    <div className="mp-flow-num">{orderCounts.pending}</div>
                    <div className="mp-flow-label">입금전</div>
                  </button>
                  <div className="mp-flow-arrow">›</div>
                  <button type="button" className={`mp-flow-step${orderStatusFilter==='preparing'?' active':''}`} onClick={() => selectStatusFilter('preparing')}>
                    <div className="mp-flow-num">{orderCounts.preparing}</div>
                    <div className="mp-flow-label">배송준비중</div>
                  </button>
                  <div className="mp-flow-arrow">›</div>
                  <button type="button" className={`mp-flow-step${orderStatusFilter==='shipped'?' active':''}`} onClick={() => selectStatusFilter('shipped')}>
                    <div className="mp-flow-num">{orderCounts.shipped}</div>
                    <div className="mp-flow-label">배송중</div>
                  </button>
                  <div className="mp-flow-arrow">›</div>
                  <button type="button" className={`mp-flow-step${orderStatusFilter==='delivered'?' active':''}`} onClick={() => selectStatusFilter('delivered')}>
                    <div className="mp-flow-num">{orders.filter(o => o.status === 'delivered' || o.status === 'confirmed').length}</div>
                    <div className="mp-flow-label">배송완료</div>
                  </button>
                </div>
              </div>

              {/* 환불 신청 내역 (상태·거부사유) */}
              {myRefundReqs.length > 0 && (
                <div className="mp-section">
                  <div className="mp-section-header">
                    <span className="mp-section-title">취소 · 환불 신청 내역</span>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    {myRefundReqs.map(r => {
                      const isCancel = r.type === 'cancel';
                      const w = isCancel ? '취소' : '환불';
                      const stMap: Record<string, { t:string; c:string; bg:string }> = {
                        pending:    { t:`${w}요청 접수`, c:'#C8841C', bg:'#FFF3E0' },
                        processing: { t:`${w} 진행중`,   c:'#2563EB', bg:'#EFF6FF' },
                        completed:  { t:`${w} 완료`,     c:'#2D7A4D', bg:'#E8F5E9' },
                        rejected:   { t:`${w} 불가`,     c:'#DC2626', bg:'#FEF2F2' },
                        hold:       { t:`${w} 보류`,     c:'#64748B', bg:'#F1F5F9' },
                      };
                      const st = stMap[r.status] || { t:r.status, c:'#64748B', bg:'#F1F5F9' };
                      return (
                        <div key={r.id} style={{ border:'1px solid #EEE', borderRadius:12, padding:'14px 16px' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, marginBottom:6 }}>
                            <span style={{ fontSize:13, color:'#888' }}>{r.orders?.order_no ? `주문 ${r.orders.order_no}` : '주문번호 미연결'} · {new Date(r.created_at).toLocaleDateString('ko-KR')}</span>
                            <span style={{ fontSize:12, fontWeight:700, color:st.c, background:st.bg, borderRadius:6, padding:'3px 10px', whiteSpace:'nowrap' }}>{st.t}</span>
                          </div>
                          <div style={{ fontSize:14, color:'#333' }}>신청 사유: {r.reason}{r.detail ? ` — ${r.detail}` : ''}</div>
                          {r.status === 'rejected' && r.reject_reason && (
                            <div style={{ marginTop:10, padding:'11px 13px', background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, fontSize:13, color:'#991B1B', lineHeight:1.65 }}>
                              <strong>{w} 불가 사유</strong><br />{r.reject_reason}
                            </div>
                          )}
                          {(() => {
                            /* 반려·보류 + 진행중 신청 없음 + 주문이 아직 해당 유형 신청 가능 상태 → 다시 신청 */
                            if (r.status !== 'rejected' && r.status !== 'hold') return null;
                            if (r.order_id && activeReqByOrder.has(r.order_id)) return null;
                            const o = orders.find(x => x.id === r.order_id);
                            const eligible = o && (
                              (isCancel && o.status === 'preparing') ||
                              (!isCancel && ['shipped','delivered','confirmed'].includes(o.status))
                            );
                            if (!eligible) return null;
                            return (
                              <button onClick={() => reapplyReq(r)}
                                style={{ marginTop:12, fontSize:13, fontWeight:700, padding:'9px 16px', border:'1.5px solid var(--color-accent)', color:'var(--color-accent)', background:'#fff', borderRadius:8, cursor:'pointer', fontFamily:'inherit' }}>
                                다시 신청하기
                              </button>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 주문내역 목록 */}
              <div className="mp-section" ref={orderListRef}>
                <div className="mp-section-header">
                  <span className="mp-section-title">주문내역 조회</span>
                  {orderStatusFilter && (
                    <button type="button" className="mp-order-filter-chip" onClick={() => setOrderStatusFilter(null)}>
                      {STATUS_GROUP_LABEL[orderStatusFilter]} ✕
                    </button>
                  )}
                  {orderCount > 0 && (
                    <span className="mp-section-sub" style={{ marginLeft:'auto' }}>{orderCount}건</span>
                  )}
                </div>
                {/* 주문내역 검색 */}
                <div className="mp-order-search">
                  <input
                    value={orderSearch}
                    onChange={e => setOrderSearch(e.target.value)}
                    placeholder="주문번호 · 상품명 · 날짜로 검색" />
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                </div>

                {/* 리뷰 남기고 받을 수 있는 포인트 배너 (배송완료·미작성 상품 × 포토리뷰 적립) */}
                {(() => {
                  const reviewedPids = new Set(myReviews.map(r => r.products?.id).filter(Boolean) as string[]);
                  const pids = new Set<string>();
                  orders.forEach(o => {
                    if (o.status === 'delivered' || o.status === 'confirmed') {
                      o.order_items?.forEach(it => { if (it.product_id && !reviewedPids.has(it.product_id)) pids.add(it.product_id); });
                    }
                  });
                  const pts = pids.size * reviewRewardPhoto;
                  if (pts <= 0) return null;
                  return (
                    <button type="button" onClick={() => switchPanel('myreviews')}
                      style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', gap:10,
                        background:'#F7F7F5', border:'none', borderRadius:12, padding:'14px 16px', margin:'4px 0 16px',
                        cursor:'pointer', fontFamily:'inherit' }}>
                      <span style={{ display:'flex', alignItems:'center', gap:9, minWidth:0 }}>
                        <span style={{ width:22, height:22, borderRadius:'50%', background:'var(--color-accent)', color:'#fff',
                          fontSize:13, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>P</span>
                        <span style={{ fontSize:14, fontWeight:600, color:'#1A1A1A' }}>리뷰 남기고 받을 수 있는 포인트</span>
                      </span>
                      <span style={{ display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
                        <span style={{ fontSize:15, fontWeight:800, color:'#1A1A1A' }}>총 {fmtPrice(pts)}P</span>
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                      </span>
                    </button>
                  );
                })()}

                {orders.length === 0 ? (
                  <div className="mp-empty">주문 내역이 없습니다.</div>
                ) : filteredOrders.length === 0 ? (
                  <div className="mp-empty">검색 결과가 없습니다.</div>
                ) : (
                  filteredOrders.map(o => {
                    const isExpanded = expandedOrder === o.id;
                    const displayItems = isExpanded ? o.order_items : o.order_items?.slice(0, 2);
                    const hiddenCount = (o.order_items?.length ?? 0) - 2;
                    return (
                      <div key={o.id} style={{ padding:'16px 0', borderBottom:'1px solid #f2f2f2' }}>
                        {/* 날짜 헤더 → 주문상세 */}
                        <button onClick={() => setDetailOrder(o)}
                          style={{ display:'flex', justifyContent:'space-between', alignItems:'center', width:'100%', marginBottom:12, background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'inherit' }}>
                          <span style={{ fontSize:15, fontWeight:800, color:'#1A1A1A' }}>
                            {new Date(o.created_at).toLocaleDateString('ko-KR')}
                          </span>
                          <span style={{ display:'flex', alignItems:'center', gap:1, fontSize:13, color:'#999', fontWeight:600 }}>
                            주문상세
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#bbb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                          </span>
                        </button>

                        {/* 상품 목록 — 클릭 시 상품상세 (사진 레이아웃: 위쪽 정렬·큰 썸네일·상태 2색) */}
                        {displayItems?.map((item, i) => {
                          const statusColor = o.status==='delivered'?'#1A1A1A': o.status==='cancelled'?'#e00':'var(--color-accent)';
                          const wd = (d: string) => new Date(d).toLocaleDateString('ko-KR',{ month:'numeric', day:'numeric', weekday:'short' });
                          let statusSuffix = '';
                          if (o.status==='shipped' && (o.shipped_at || o.created_at)) statusSuffix = ` · ${wd(o.shipped_at || o.created_at)} 배송 시작`;
                          else if (o.status==='delivered' && o.delivered_at) statusSuffix = ` · ${wd(o.delivered_at)} 도착`;
                          const body = (
                            <>
                              <div style={{ width:100, height:100, borderRadius:10, background:'#F7F7F5', flexShrink:0, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
                                {item.thumbnail_url
                                  ? <img src={imgThumb(item.thumbnail_url, 200)} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                  : <span style={{ fontSize:34 }}>🍑</span>}
                              </div>
                              <div style={{ flex:1, minWidth:0, paddingTop:2 }}>
                                <div style={{ fontSize:13.5, fontWeight:700, marginBottom:7 }}>
                                  <span style={{ color:statusColor }}>{STATUS_LABEL[o.status] || o.status}</span>
                                  {statusSuffix && <span style={{ color:'#555', fontWeight:600 }}>{statusSuffix}</span>}
                                </div>
                                <div style={{ fontSize:14, fontWeight:700, color:'#1A1A1A', lineHeight:1.4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.product_name}</div>
                                {(() => {
                                  const major = item.products?.origin ? (ORIGIN_LABEL[item.products.origin] || item.products.origin) : '';
                                  const minor = item.products?.category ? (CAT_LABEL[item.products.category] || '') : '';
                                  const catText = [major, minor].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' · ');
                                  return catText ? <div style={{ fontSize:12, color:'#999', marginTop:4 }}>{catText}</div> : null;
                                })()}
                                <div style={{ fontSize:15, fontWeight:800, color:'#1A1A1A', marginTop:8 }}>
                                  {fmtPrice(item.unit_price)}원
                                  {item.quantity > 1 && <span style={{ fontSize:12, fontWeight:600, color:'#999', marginLeft:6 }}>· {item.quantity}개</span>}
                                </div>
                              </div>
                            </>
                          );
                          return (
                            <div key={i}
                              onClick={() => { if (item.product_id) router.push(`/product/${item.product_id}`); }}
                              style={{ display:'flex', gap:14, alignItems:'flex-start', marginBottom:18, cursor: item.product_id ? 'pointer' : 'default' }}>
                              {body}
                            </div>
                          );
                        })}

                        {/* 더보기 / 접기 버튼 */}
                        {(o.order_items?.length ?? 0) > 2 && (
                          <button
                            onClick={() => setExpandedOrder(isExpanded ? null : o.id)}
                            style={{ fontSize:12, color:'#888', background:'none', border:'1px solid #E8E8E8',
                              borderRadius:6, padding:'5px 12px', cursor:'pointer',
                              fontFamily:'inherit', marginBottom:8, width:'100%',
                              display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
                              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                              style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition:'transform .15s' }}>
                              <polyline points="6 9 12 15 18 9"/>
                            </svg>
                            {isExpanded ? '접기' : `외 ${hiddenCount}개 상품 더보기`}
                          </button>
                        )}

                        {/* 하단: 상태별 버튼 (오늘의집 플로우) */}
                        <div style={{ paddingTop:12, marginTop:4 }}>
                          {(() => {
                            const active = activeReqByOrder.get(o.id);
                            const btnBig: React.CSSProperties = { flex:1, minWidth:0, fontSize:13, padding:'11px 4px', textAlign:'center', border:'1px solid #DDDDD9', borderRadius:8, cursor:'pointer', background:'#fff', color:'#333', fontWeight:600, fontFamily:'inherit', whiteSpace:'nowrap' };

                            // 상품 문의 모달 열기
                            const openAsk = () => {
                              const askItems = (o.order_items || [])
                                .filter(it => it.product_id)
                                .map(it => ({ productId: it.product_id!, productName: it.product_name, thumb: it.thumbnail_url ?? null }));
                              if (askItems.length) {
                                setAskModal({ items: askItems, selectedId: askItems[0].productId });
                                setAskCategory('문의'); setAskContent(''); setAskPrivate(false);
                              } else { goPanel('cs'); }
                            };

                            type Btn = { key: string; label: string; onClick?: () => void; muted?: boolean };
                            const btns: Btn[] = [];
                            const askBtn: Btn = { key:'ask', label:'상품문의', onClick: openAsk };
                            const trackBtn: Btn | null = o.tracking_number
                              ? { key:'track', label:'배송조회', onClick: () => setTrackingTarget({ carrierId: o.courier || 'kr.cjlogistics', trackingNumber: o.tracking_number! }) }
                              : null;
                            const cartBtn: Btn = { key:'cart', label:'장바구니', onClick: () => startItemAction('cart', o) };

                            if (o.status === 'paid' || o.status === 'preparing') {
                              btns.push(askBtn);
                              if (active) btns.push({ key:'reqst', label:`${active.type === 'cancel' ? '취소' : '환불'} 신청 ${active.status === 'processing' ? '처리중' : '접수'}`, muted:true });
                              else if (o.status === 'paid') btns.push({ key:'cancel', label:'주문취소', onClick: () => instantCancel(o) });
                              else btns.push({ key:'cancel', label:'주문취소', onClick: () => { setReqModal({ order:o, type:'cancel' }); setReqReason(''); setReqDetail(''); } });
                            } else if (o.status === 'shipped') {
                              if (trackBtn) btns.push(trackBtn);
                              btns.push(askBtn, cartBtn);
                            } else if (o.status === 'delivered') {
                              if (trackBtn) btns.push(trackBtn);
                              btns.push(askBtn);
                              if (active) btns.push({ key:'reqst', label:`환불 신청 ${active.status === 'processing' ? '처리중' : '접수'}`, muted:true });
                              else btns.push({ key:'refund', label:'환불신청', onClick: () => { setReqModal({ order:o, type:'refund' }); setReqReason(''); setReqDetail(''); } });
                              btns.push(cartBtn);
                            } else if (o.status === 'confirmed') {
                              btns.push({ key:'review', label:'리뷰 쓰기', onClick: () => startItemAction('review', o) });
                              btns.push(askBtn);
                              btns.push({ key:'repurchase', label:'재구매', onClick: () => startItemAction('repurchase', o) });
                              btns.push(cartBtn);
                            } else if (o.status === 'cancelled' || o.status === 'refunded') {
                              btns.push(askBtn);
                              btns.push({ key:'detail', label: o.status === 'cancelled' ? '취소상세' : '환불상세', onClick: () => setCancelDetail(o) });
                            } else {
                              btns.push(askBtn);
                            }

                            return (
                              <div style={{ display:'flex', gap:6 }}>
                                {btns.map(b => b.muted
                                  ? <span key={b.key} style={{ ...btnBig, color:'#999', cursor:'default', display:'flex', alignItems:'center', justifyContent:'center' }}>{b.label}</span>
                                  : <button key={b.key} onClick={b.onClick} style={btnBig}>{b.label}</button>
                                )}
                              </div>
                            );
                          })()}
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
                {/* 사용 가능 포인트 */}
                <div className="mp-pt-top">
                  <div className="mp-pt-top-label">사용 가능 포인트</div>
                  <div className="mp-pt-top-value">{fmtPrice(profile?.point_balance||0)}원</div>
                </div>
                {/* 적립예정 / 소멸예정 카드 */}
                <div className="mp-pt-card">
                  <div className="mp-pt-card-col">
                    <div className="mp-pt-card-label">적립 예정</div>
                    <div className="mp-pt-card-num">0 원</div>
                  </div>
                  <div className="mp-pt-card-col">
                    <div className="mp-pt-card-label">30일 이내 소멸예정</div>
                    <div className="mp-pt-card-num">0 원</div>
                  </div>
                </div>
                {/* 기간 필터 */}
                <div className="mp-pt-periods">
                  {([[3,'3개월'],[6,'6개월'],[12,'1년'],[36,'3년']] as const).map(([m, label]) => (
                    <button key={m}
                      className={`mp-pt-period${pointPeriod===m?' active':''}`}
                      onClick={() => setPointPeriod(m)}>
                      {label}
                    </button>
                  ))}
                </div>
                {/* 내역 리스트 */}
                {pointLogs.length === 0 ? (
                  <div className="mp-empty">포인트 내역이 없습니다.</div>
                ) : (
                  <div className="mp-pt-list">
                    {pointLogs.map(log => {
                      const earned = log.amount >= 0;
                      return (
                        <div key={log.id} className="mp-pt-item">
                          <div className="mp-pt-item-left">
                            <span className={`mp-pt-tag${earned?'':' use'}`}>{earned?'적립':'사용'}</span>
                            <span className="mp-pt-item-date">
                              {new Date(log.created_at).toLocaleDateString('ko-KR')}
                            </span>
                          </div>
                          <div className="mp-pt-item-body">
                            <div className="mp-pt-item-main">
                              <span className="mp-pt-item-desc">{log.description || (earned?'포인트 적립':'포인트 사용')}</span>
                              <span className={`mp-pt-item-amt${earned?'':' use'}`}>
                                {earned?'+':'−'}{fmtPrice(Math.abs(log.amount))}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ═══ 쿠폰 내역 ═══ */}
            <div className={`mp-panel${activePanel==='coupon'?' active':''}`}>
              <button className="mp-panel-back" onClick={goBackMenu}><IconArrowLeft /></button>
              <div className="mp-section">
                {couponLoading ? (
                  <div className="mp-empty">불러오는 중...</div>
                ) : (() => {
                  const now = new Date();
                  const available = userCoupons.filter(uc => {
                    if (uc.used) return false;
                    const exp = uc.expires_at ?? uc.coupon?.expires_at; // 개별 만료 우선
                    return !exp || new Date(exp) >= now;
                  }).sort((a, b) => {
                    // 유효기간 임박순(가까운 만료일 먼저). 만료일 없는 쿠폰은 맨 뒤
                    const ea = a.expires_at ?? a.coupon?.expires_at;
                    const eb = b.expires_at ?? b.coupon?.expires_at;
                    if (!ea && !eb) return 0;
                    if (!ea) return 1;
                    if (!eb) return -1;
                    return new Date(ea).getTime() - new Date(eb).getTime();
                  });
                  const used = userCoupons.filter(uc => uc.used);
                  const fmtDate = (s: string) => {
                    const d = new Date(s);
                    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
                  };
                  const renderCard = (uc: UserCoupon, dim: boolean) => {
                    const c = uc.coupon;
                    if (!c) return null;
                    const isPercent = c.discount_type === 'percent';
                    const expRaw = uc.expires_at ?? c.expires_at;
                    const daysLeft = expRaw ? Math.ceil((new Date(expRaw).getTime() - now.getTime()) / 86400000) : null;
                    const soon = !dim && daysLeft !== null && daysLeft >= 0 && daysLeft <= 14;
                    return (
                      <div key={uc.id} className={`mp-cp-card${dim ? ' dim' : ''}`}>
                        <div className="mp-cp-main">
                          <div className="mp-cp-toprow">
                            <span className="mp-cp-badge">할인쿠폰</span>
                          </div>
                          <div className="mp-cp-value">
                            {isPercent ? `${c.discount_value}%` : `${c.discount_value.toLocaleString()}원`}
                          </div>
                          <div className="mp-cp-name">{c.name}</div>
                          <div className="mp-cp-meta">
                            {c.min_order_amount > 0 && <div>최소주문 {c.min_order_amount.toLocaleString()}원</div>}
                            {c.max_discount_amount ? <div>최대할인 {c.max_discount_amount.toLocaleString()}원</div> : null}
                            {expRaw && <div>사용기간 {fmtDate(expRaw)}까지</div>}
                          </div>
                        </div>
                        <div className="mp-cp-side">
                          {!dim && daysLeft !== null && daysLeft >= 0 && (
                            <span className={`mp-cp-side-exp${soon ? ' soon' : ''}`}>
                              {daysLeft === 0 ? '오늘 소멸' : `${daysLeft}일 후 소멸`}
                            </span>
                          )}
                          {dim && <span className="mp-cp-side-done">사용완료</span>}
                        </div>
                      </div>
                    );
                  };
                  const renderDownloadCard = (c: PublicCoupon) => {
                    const isPercent = c.discount_type === 'percent';
                    const daysLeft = c.expires_at ? Math.ceil((new Date(c.expires_at).getTime() - now.getTime()) / 86400000) : null;
                    return (
                      <div key={c.id} className="mp-cp-card">
                        <div className="mp-cp-main">
                          <div className="mp-cp-toprow">
                            <span className="mp-cp-badge">할인쿠폰</span>
                          </div>
                          <div className="mp-cp-value">{isPercent ? `${c.discount_value}%` : `${c.discount_value.toLocaleString()}원`}</div>
                          <div className="mp-cp-name">{c.name}</div>
                          <div className="mp-cp-meta">
                            {c.min_order_amount > 0 && <div>최소주문 {c.min_order_amount.toLocaleString()}원</div>}
                            {c.expires_at && <div>사용기간 {fmtDate(c.expires_at)}까지</div>}
                          </div>
                        </div>
                        <div className="mp-cp-side">
                          {daysLeft !== null && daysLeft >= 0 && (
                            <span className={`mp-cp-side-exp${daysLeft <= 14 ? ' soon' : ''}`}>
                              {daysLeft === 0 ? '오늘까지' : `${daysLeft}일 남음`}
                            </span>
                          )}
                          <button className="mp-dlcp-dl" onClick={() => claimOneCoupon(c)} disabled={claimingCoupon} aria-label="쿠폰 받기">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 3v12" /><polyline points="7 11 12 16 17 11" /><path d="M5 20h14" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  };
                  return (
                    <>
                      {/* 쿠폰등록 (상단) */}
                      <div className="mp-cp-register" style={{ marginTop: 0 }}>
                        <div className="mp-cp-register-title">쿠폰등록</div>
                        <div className="mp-cp-register-row">
                          <input
                            value={couponCode}
                            onChange={e => setCouponCode(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleRedeemCode(); }}
                            placeholder="'-'제외한 쿠폰번호" />
                          <button onClick={handleRedeemCode} disabled={redeemingCode || !couponCode.trim()}>
                            {redeemingCode ? '등록 중...' : '등록'}
                          </button>
                        </div>
                      </div>

                      {/* 내 쿠폰 (N) */}
                      <div className="mp-cp-sec-head" style={{ marginTop: 28 }}>
                        <span className="mp-cp-sec-title">내 쿠폰 ({available.length})</span>
                      </div>
                      {available.length === 0 ? (
                        <div className="mp-cp-empty">
                          <svg viewBox="0 0 48 48" width="56" height="56" fill="none" stroke="#DADADA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="5" y="13" width="38" height="22" rx="4" />
                            <path d="M5 21a3 3 0 0 0 0 6M43 21a3 3 0 0 1 0 6" />
                            <line x1="19" y1="20" x2="29" y2="28" /><circle cx="19.5" cy="20.5" r="0.6" /><circle cx="28.5" cy="27.5" r="0.6" />
                          </svg>
                          <div>사용 가능한 쿠폰이 없습니다.</div>
                        </div>
                      ) : (
                        <div className="mp-cp-list">
                          {available.map(uc => renderCard(uc, false))}
                        </div>
                      )}

                      {/* 다운로드 가능한 쿠폰 (N) */}
                      {downloadables.length > 0 && (
                        <>
                          <div className="mp-cp-sec-head" style={{ marginTop: 32 }}>
                            <span className="mp-cp-sec-title">다운로드 가능한 쿠폰 ({downloadables.length})</span>
                            <button className="mp-cp-claimall" onClick={handleClaimCoupons} disabled={claimingCoupon}>
                              {claimingCoupon ? '받는 중...' : '전체 받기'}
                            </button>
                          </div>
                          <div className="mp-cp-list">
                            {downloadables.map(renderDownloadCard)}
                          </div>
                        </>
                      )}

                      {/* 사용 완료 쿠폰 */}
                      {used.length > 0 && (
                        <>
                          <div className="mp-cp-sec-head" style={{ marginTop: 32 }}>
                            <span className="mp-cp-sec-title" style={{ color:'#888' }}>사용 완료 쿠폰</span>
                          </div>
                          <div className="mp-cp-list">
                            {used.map(uc => renderCard(uc, true))}
                          </div>
                        </>
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
                        {paged.map(p => {
                          const sell = p.discounted_price ?? p.price;
                          return (
                          <div key={p.id} className="mp-wish-item mp-recent-card" style={{ position:'relative', display:'flex', flexDirection:'column', border:'none', overflow:'visible' }}>
                            <div className="mp-wish-img">
                              {/* 배송 배지 */}
                              <span className={`product-card-delivery ${p.is_dawn ? 'tag-dawn' : 'tag-regular'}`}
                                style={{ position:'absolute', top:8, left:8, zIndex:2 }}>
                                {p.is_dawn ? '산지직송' : '자사배송'}
                              </span>
                              {p.thumbnail_url
                                ? <img src={imgThumb(p.thumbnail_url, 200)} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                : <span>{EMOJI_MAP[p.category] || EMOJI_MAP.default}</span>}
                              <button className="mp-wish-del" style={{ color:'#1A1A1A' }}
                                onClick={e => { e.stopPropagation(); removeRecentProduct(p.id); }}>✕</button>
                            </div>
                            {/* 담기 버튼 — 썸네일 바로 아래 전체폭 (퀵가이드 모바일과 동일) */}
                            <button onClick={() => openOptionDrawer(p.id)}
                              style={{ margin:'10px 0 0', padding:'9px 0', border:'1px solid #DDDDD9', borderRadius:8, background:'#fff', fontSize:13, fontWeight:600, color:'#1A1A1A', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5, fontFamily:'inherit' }}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 001.95 1.53h9.58a2 2 0 001.95-1.53l1.54-8.42H5.05"/></svg>
                              담기
                            </button>
                            <Link href={`/product/${p.id}`} style={{ textDecoration:'none', color:'inherit', flex:1 }}>
                              <div className="mp-wish-body" style={{ padding:'8px 2px 4px' }}>
                                {p.short_desc && <div style={{ fontSize:12, color:'#999', marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.short_desc}</div>}
                                <div className="mp-wish-name">{p.name}</div>
                                {p.discount_rate > 0 && (
                                  <div style={{ display:'flex', alignItems:'baseline', gap:4, marginBottom:1 }}>
                                    <span style={{ fontSize:14, fontWeight:800, color:'#E53E3E' }}>{Math.round(p.discount_rate)}%</span>
                                    <span style={{ fontSize:12, color:'#bbb', textDecoration:'line-through' }}>{fmtPrice(p.price)}원</span>
                                  </div>
                                )}
                                <div className="mp-wish-price" style={{ fontSize:18 }}>{fmtPrice(sell)}원</div>
                                {p.avg_rating > 0 && (
                                  <div style={{ display:'flex', alignItems:'center', gap:3, marginTop:5, fontSize:13, color:'#888' }}>
                                    <span style={{ color:'#FFB400' }}>★</span>{p.avg_rating.toFixed(1)}
                                    {p.review_count != null && <span style={{ color:'#bbb' }}>({p.review_count.toLocaleString()})</span>}
                                  </div>
                                )}
                              </div>
                            </Link>
                          </div>
                          );
                        })}
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
                  <span className="mp-section-title">나의 리뷰</span>
                </div>

                {/* 탭: 리뷰 남기기 / 내가 남긴 리뷰 */}
                <div style={{ display:'flex', borderBottom:'1px solid #EEE', marginBottom:8 }}>
                  <button type="button" onClick={() => setReviewTab('writable')}
                    style={{ flex:1, padding:'12px 0', background:'none', border:'none', borderBottom:`2px solid ${reviewTab==='writable'?'#1A1A1A':'transparent'}`, cursor:'pointer', fontFamily:'inherit', fontSize:15, fontWeight: reviewTab==='writable'?800:500, color: reviewTab==='writable'?'#1A1A1A':'#999' }}>
                    리뷰 남기기 {writableReviews.length}
                  </button>
                  <button type="button" onClick={() => setReviewTab('written')}
                    style={{ flex:1, padding:'12px 0', background:'none', border:'none', borderBottom:`2px solid ${reviewTab==='written'?'#1A1A1A':'transparent'}`, cursor:'pointer', fontFamily:'inherit', fontSize:15, fontWeight: reviewTab==='written'?800:500, color: reviewTab==='written'?'#1A1A1A':'#999' }}>
                    내가 남긴 리뷰 {myReviews.length}
                  </button>
                </div>

                {/* ── 리뷰 남기기(작성 가능) ── */}
                {reviewTab === 'writable' && (
                  writableReviews.length === 0 ? (
                    <div className="mp-empty">작성 가능한 리뷰가 없습니다.</div>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                      {writableReviews.map(w => (
                        <div key={w.id} style={{ padding:'16px 0', borderBottom:'1px solid #f2f2f2' }}>
                          {/* 사진·제목·배경 클릭 → 상품 상세 */}
                          <div onClick={() => router.push(`/product/${w.id}`)}
                            style={{ display:'flex', gap:12, alignItems:'center', marginBottom:12, cursor:'pointer' }}>
                            <div style={{ width:52, height:52, borderRadius:8, background:'#F7F7F5', flexShrink:0, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
                              {w.thumb ? <img src={imgThumb(w.thumb, 150)} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <span style={{ fontSize:22 }}>🍑</span>}
                            </div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:13.5, fontWeight:600, color:'#1A1A1A', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{w.name}</div>
                              {/* 별: hover 시 채워지고, 클릭하면 그 별점 반영된 리뷰 작성 창 */}
                              <WritableStars onPick={s => router.push(`/product/${w.id}?tab=review&star=${s}`)} />
                            </div>
                          </div>
                          {/* 리뷰 작성 버튼 → 작성 모달 */}
                          <button onClick={() => router.push(`/product/${w.id}?tab=review&review=1`)}
                            style={{ display:'block', width:'100%', textAlign:'center', padding:'12px', border:'1px solid #DDD', borderRadius:8, fontSize:13.5, fontWeight:700, color:'#1A1A1A', background:'#fff', cursor:'pointer', fontFamily:'inherit' }}>
                            리뷰 작성하고 최대 {fmtPrice(reviewRewardPhoto)}P 받기
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                )}

                {/* ── 내가 남긴 리뷰 ── */}
                {reviewTab === 'written' && (myReviews.length === 0 ? (
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
                              ? <img src={imgThumb(r.products.thumbnail_url, 150)} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
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

                                {/* 사진/영상 편집 */}
                                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:10 }}>
                                  {/* 기존 이미지 */}
                                  {editImages.map((url, i) => (
                                    <div key={'ei'+i} style={{ position:'relative', width:64, height:64, flexShrink:0 }}>
                                      <img src={url} alt="" style={{ width:64, height:64, objectFit:'cover', borderRadius:8, border:'1px solid #eee' }} />
                                      <button type="button" onClick={() => setEditImages(prev => prev.filter((_, j) => j !== i))}
                                        style={{ position:'absolute', top:-6, right:-6, width:20, height:20, borderRadius:'50%', background:'#1A1A1A', color:'#fff', border:'none', fontSize:12, cursor:'pointer', lineHeight:1 }}>×</button>
                                    </div>
                                  ))}
                                  {/* 새 이미지 */}
                                  {editNewImages.map((f, i) => (
                                    <div key={'ni'+i} style={{ position:'relative', width:64, height:64, flexShrink:0 }}>
                                      <img src={URL.createObjectURL(f)} alt="" style={{ width:64, height:64, objectFit:'cover', borderRadius:8, border:'1px solid #eee' }} />
                                      <button type="button" onClick={() => setEditNewImages(prev => prev.filter((_, j) => j !== i))}
                                        style={{ position:'absolute', top:-6, right:-6, width:20, height:20, borderRadius:'50%', background:'#1A1A1A', color:'#fff', border:'none', fontSize:12, cursor:'pointer', lineHeight:1 }}>×</button>
                                    </div>
                                  ))}
                                  {/* 기존 영상 */}
                                  {editVideo && (
                                    <div style={{ position:'relative', width:64, height:64, flexShrink:0 }}>
                                      <video src={editVideo} style={{ width:64, height:64, objectFit:'cover', borderRadius:8, border:'1px solid #eee', background:'#000' }} />
                                      <button type="button" onClick={() => setEditVideo(null)}
                                        style={{ position:'absolute', top:-6, right:-6, width:20, height:20, borderRadius:'50%', background:'#1A1A1A', color:'#fff', border:'none', fontSize:12, cursor:'pointer', lineHeight:1 }}>×</button>
                                    </div>
                                  )}
                                  {/* 새 영상 */}
                                  {editNewVideo && (
                                    <div style={{ position:'relative', width:64, height:64, flexShrink:0 }}>
                                      <video src={URL.createObjectURL(editNewVideo)} style={{ width:64, height:64, objectFit:'cover', borderRadius:8, border:'1px solid #eee', background:'#000' }} />
                                      <button type="button" onClick={() => setEditNewVideo(null)}
                                        style={{ position:'absolute', top:-6, right:-6, width:20, height:20, borderRadius:'50%', background:'#1A1A1A', color:'#fff', border:'none', fontSize:12, cursor:'pointer', lineHeight:1 }}>×</button>
                                    </div>
                                  )}
                                  {/* 사진 추가 (최대 5장) */}
                                  {(editImages.length + editNewImages.length) < 5 && (
                                    <label style={{ width:64, height:64, flexShrink:0, borderRadius:8, border:'1.5px dashed #D0D0CC', background:'#FAFAFA', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:10, color:'#aaa', fontWeight:600 }}>
                                      ＋사진
                                      <input type="file" accept="image/*" multiple hidden
                                        onChange={e => { if (!e.target.files) return; const files = Array.from(e.target.files).slice(0, 5 - editImages.length - editNewImages.length); setEditNewImages(prev => [...prev, ...files]); e.target.value=''; }} />
                                    </label>
                                  )}
                                  {/* 영상 추가 */}
                                  {!editVideo && !editNewVideo && (
                                    <label style={{ width:64, height:64, flexShrink:0, borderRadius:8, border:'1.5px dashed #D0D0CC', background:'#FAFAFA', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:10, color:'#aaa', fontWeight:600 }}>
                                      ＋영상
                                      <input type="file" accept="video/*" hidden
                                        onChange={e => { const f = e.target.files?.[0]; if (f) setEditNewVideo(f); e.target.value=''; }} />
                                    </label>
                                  )}
                                </div>

                                {/* 맛 평가 (5축) — 작성과 동일 */}
                                <div style={{ marginTop:14 }}>
                                  <div style={{ fontSize:12, fontWeight:600, marginBottom:8, color:'#555' }}>
                                    맛 평가 <span style={{ fontSize:10, color:'#BBB', fontWeight:400 }}>선택 · 다른 구매자에게 도움돼요</span>
                                  </div>
                                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                                    {TASTE_AXES.map(axis => (
                                      <div key={axis.key}>
                                        <div style={{ fontSize:11, fontWeight:600, color:'#666', marginBottom:5 }}>
                                          <span style={{ marginRight:3 }}>{axis.icon}</span>{axis.label}
                                        </div>
                                        <div style={{ display:'flex', gap:4 }}>
                                          {axis.levels.map((lv, i) => {
                                            const level = i + 1;
                                            const on = editTaste[axis.key] === level;
                                            return (
                                              <button key={level} type="button"
                                                onClick={() => setEditTaste(prev => ({ ...prev, [axis.key]: level }))}
                                                style={{ flex:1, padding:'6px 2px', borderRadius:7, cursor:'pointer',
                                                  border:`1.5px solid ${on ? '#1A1A1A' : '#E5E5E5'}`,
                                                  background: '#fff', color: on ? '#1A1A1A' : '#999',
                                                  fontSize:10.5, fontWeight:on ? 700 : 500, fontFamily:'inherit',
                                                  lineHeight:1.3, transition:'all .12s' }}>
                                                {lv}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div style={{ display:'flex', gap:8, marginTop:12 }}>
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
                                <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:5, lineHeight:1 }}>
                                  <StarRating rating={r.rating} size={14} />
                                  <span style={{ fontSize:12, fontWeight:600, color:'#1A1A1A', lineHeight:1, position:'relative', top:1 }}>{r.rating.toFixed(1)}</span>
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
                                        onClick={() => setReviewPhotoModal(r)}
                                        style={{ width:44, height:44, borderRadius:6, objectFit:'cover',
                                          border:'1px solid #EBEBEB', cursor:'pointer' }} />
                                    ))}
                                    {r.video_url && (
                                      <div
                                        onClick={() => setReviewPhotoModal(r)}
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
                ))}
              </div>
            </div>

            {/* ═══ 위시리스트 ═══ */}
            <div className={`mp-panel${activePanel==='wish'?' active':''}`}>
              <button className="mp-panel-back" onClick={goBackMenu}><IconArrowLeft /></button>
              <div className="mp-section">
                <div className="mp-section-header" style={{ marginTop:-3 }}>
                  <span className="mp-section-title" style={{ fontSize:16 }}>나의 위시리스트</span>
                </div>
                {/* 상품 / 농가 탭 */}
                <div style={{ display:'flex', gap:8, marginBottom:16 }}>
                  {([['product', '상품'], ['farm', '농가']] as const).map(([id, label]) => (
                    <button key={id} onClick={() => setWishTab(id)}
                      style={{ padding:'8px 18px', borderRadius:99, border:'1.5px solid', fontSize:14, fontWeight:600, cursor:'pointer',
                        borderColor: wishTab===id ? '#1A1A1A' : '#E2E2E0',
                        background: wishTab===id ? '#1A1A1A' : '#fff',
                        color: wishTab===id ? '#fff' : '#888' }}>
                      {label}
                    </button>
                  ))}
                </div>
                {wishLoading ? (
                  <div className="mp-empty">불러오는 중...</div>
                ) : wishTab === 'farm' ? (
                  farmWishlist.length === 0 ? (
                    <div className="mp-empty">찜한 농가가 없습니다.</div>
                  ) : (
                    <div className="mob-pv-grid">
                      {farmWishlist.map(fw => fw.farms ? (
                        <FarmCard key={fw.id} farm={fw.farms} onRemove={() => removeFarmWish(fw.id)} />
                      ) : null)}
                    </div>
                  )
                ) : wishlist.length === 0 ? (
                  <div className="mp-empty">찜한 상품이 없습니다.</div>
                ) : (
                  <div className="mob-pv-grid">
                    {wishlist.map(w => w.products ? (
                      <ProductCard key={w.id} p={w.products}
                        onWishChange={(wished) => { if (!wished) setWishlist(prev => prev.filter(x => x.id !== w.id)); }} />
                    ) : null)}
                  </div>
                )}
              </div>
            </div>

            {/* ═══ 친구 초대 ═══ */}
            <div className={`mp-panel${activePanel==='benefit'?' active':''}`}>
              <button className="mp-panel-back" onClick={goBackMenu}><IconArrowLeft /></button>
              <div className="mp-section">
                <div className="mp-section-header">
                  <span className="mp-section-title" style={{ fontSize:16 }}>친구 초대</span>
                </div>
                <div style={{ paddingTop:28, maxWidth:400, margin:'0 auto' }}>
                  {/* 헤더 텍스트 */}
                  <div style={{ textAlign:'center', marginBottom:24 }}>
                    <p style={{ fontSize:14, color:'#555', marginBottom:6 }}>지금 델리오에 친구를 초대하면</p>
                    <p style={{ fontSize:22, fontWeight:900, color:'#111', lineHeight:1.3 }}>친구도 나도 5천원 할인!</p>
                  </div>

                  {/* 쿠폰 카드 */}
                  <div style={{ background:'#1A1A1A', borderRadius:14, padding:'24px 24px',
                    maxWidth:270, margin:'0 auto 20px', position:'relative', overflow:'hidden', textAlign:'center' }}>
                    {/* 좌우 삼각형 노치 */}
                    <div style={{ position:'absolute', left:0, top:'50%', transform:'translateY(-50%)',
                      width:0, height:0, borderTop:'16px solid transparent', borderBottom:'16px solid transparent',
                      borderLeft:'14px solid #fff' }} />
                    <div style={{ position:'absolute', right:0, top:'50%', transform:'translateY(-50%)',
                      width:0, height:0, borderTop:'16px solid transparent', borderBottom:'16px solid transparent',
                      borderRight:'14px solid #fff' }} />
                    <p style={{ fontSize:12, fontWeight:600, color:'#fff', letterSpacing:3, marginBottom:8 }}>COUPON</p>
                    <p style={{ fontSize:38, fontWeight:700, color:'#fff', lineHeight:1, letterSpacing:-1 }}>5,000</p>
                  </div>

                  {/* 설명 */}
                  <p style={{ textAlign:'center', fontSize:13, color:'#666', lineHeight:1.7, marginBottom:24 }}>
                    친구는 초대코드로 가입하면 <b style={{ color:'#1A1A1A' }}>즉시 5,000원 쿠폰</b>,<br />
                    친구가 첫 구매를 완료하면 <b style={{ color:'#1A1A1A' }}>나도 5,000원 쿠폰</b>을 받아요!<br />
                    <span style={{ fontSize:11, color:'#aaa' }}>(2만원 이상 구매 시 사용 · 발급일로부터 30일)</span>
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
                      <div style={{ fontSize:22, fontWeight:800, color:'#111' }}>{referralInvited}<span style={{ fontSize:13, fontWeight:600 }}>명</span></div>
                      <div style={{ fontSize:11, color:'#aaa', marginTop:4 }}>초대한 친구</div>
                    </div>
                    <div style={{ background:'#F7F7F5', borderRadius:10, padding:'14px', textAlign:'center' }}>
                      <div style={{ fontSize:22, fontWeight:800, color:'var(--color-accent)' }}>{fmtPrice(referralRewarded * 5000)}<span style={{ fontSize:13, fontWeight:600 }}>원</span></div>
                      <div style={{ fontSize:11, color:'#aaa', marginTop:4 }}>누적 쿠폰 금액</div>
                    </div>
                  </div>

                  {/* 버튼들 */}
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/signup?ref=${encodeURIComponent(referralCode)}`;
                        const ok = shareKakaoFeed({
                          title: '델리오 초대 — 친구 추천 혜택',
                          description: `추천코드 ${referralCode} · 가입하면 둘 다 5,000원 쿠폰을 받아요!`,
                          imageUrl: `${window.location.origin}/DelioLogo.png`,
                          linkUrl: url,
                          buttonTitle: '델리오 가입하기',
                        });
                        if (!ok) { navigator.clipboard.writeText(url).then(() => showToastMsg('초대 링크를 복사했어요')); }
                      }}
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
                          .then(() => showToastMsg('코드가 복사되었습니다'));
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
                </div>
                <div style={{ paddingTop:16 }} data-info-body>
                  {infoStep !== 'edit' ? (
                    <div className="mp-reauth">
                      <p className="mp-reauth-greet"><b>{profile?.name || (user.email || '').split('@')[0]}</b> 고객님</p>
                      <p className="mp-reauth-desc">개인 정보 보호를 위한 확인 절차이오니<br />회원 인증을 한번 더 진행해주시기 바랍니다.</p>
                      <button className="mp-reauth-card" onClick={reauthForEdit} disabled={reauthLoading}>
                        <span className="mp-reauth-ic" aria-hidden>📱</span>
                        <span className="mp-reauth-label">휴대폰 본인인증</span>
                        <span className="mp-reauth-go">{reauthLoading ? '진행 중…' : '인증하기'} <IconArrowRight /></span>
                      </button>
                      <p className="mp-reauth-note">중복 계정 차단을 위해 현재는 휴대폰 본인인증만 지원하고 있습니다.</p>
                    </div>
                  ) : (() => {
                    const email = profile?.email || user.email || '';
                    const [emLocal, emDomain] = email.includes('@') ? email.split('@') : [email, ''];
                    return (
                      <>
                        {/* 정보 테이블 */}
                        <div className="mp-info-table">
                          <div className="mp-info-row">
                            <div className="mp-info-label"><span className="req">*</span> 이름</div>
                            <div className="mp-info-value">
                              <input className="mp-info-input" value={editName} onChange={e => setEditName(e.target.value)} placeholder="이름" />
                            </div>
                          </div>
                          <div className="mp-info-row">
                            <div className="mp-info-label"><span className="req">*</span> 회원아이디</div>
                            <div className="mp-info-value"><b style={{ fontSize:14 }}>{email}</b></div>
                          </div>
                          <div className="mp-info-row">
                            <div className="mp-info-label"><span className="req">*</span> E-mail</div>
                            <div className="mp-info-value mp-info-email">
                              <input className="mp-info-input" value={emLocal} readOnly />
                              <span className="mp-info-at">@</span>
                              <input className="mp-info-input" value={emDomain} readOnly />
                            </div>
                          </div>
                          <div className="mp-info-row">
                            <div className="mp-info-label"><span className="req">*</span> 휴대폰번호</div>
                            <div className="mp-info-value">
                              <div className="mp-info-phone">
                                <span>{profile?.phone || '미등록'}</span>
                                <button className="mp-info-btn"
                                  onClick={startPhoneVerify}>
                                  {profile?.phone ? '재인증' : '인증하기'}
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="mp-info-row">
                            <div className="mp-info-label"><span className="req">*</span> 생년월일</div>
                            <div className="mp-info-value">
                              <input className="mp-info-input" value={editBirth}
                                onChange={e => setEditBirth(e.target.value)} placeholder="1998.06.27" />
                            </div>
                          </div>
                        </div>

                        {/* 탈퇴 / 저장 */}
                        <div className="mp-info-actions">
                          <button className="mp-info-withdraw" onClick={() => { setWithdrawReason(''); setWithdrawDetail(''); setWithdrawAgree(false); setOtpToken(''); setOtpInput(''); setOtpVerified(false); setOtpPhoneMasked(''); setWithdrawStep(1); }} disabled={withdrawing}>{withdrawing ? '처리 중...' : '탈퇴하기'}</button>
                          <button className="mp-info-save" onClick={saveInfo} disabled={infoSaving}>
                            {infoSaving ? '변경 중...' : '변경하기'}
                          </button>
                        </div>

                        {/* 마케팅 수신동의 */}
                        <div className="mp-mkt">
                          <div className="mp-mkt-title">마케팅 수신동의 설정</div>
                          <p className="mp-mkt-desc">이벤트 및 혜택에 대한 다양한 정보를<br />받으실 수 있어요</p>
                          {([
                            ['메일 수신동의', mEmail, setMEmail, 'marketing_email'],
                            ['SMS 수신 동의', mSms, setMSms, 'marketing_sms'],
                          ] as [string, boolean, (v:(p:boolean)=>boolean)=>void, 'marketing_email'|'marketing_sms'|'push_enabled'][]).map(([label, on, set, field]) => (
                            <div key={label} className="mp-mkt-row">
                              <span>{label}</span>
                              <span className={`mp-toggle${on ? ' on' : ''}`} onClick={() => { const nv = !on; set(() => nv); saveMktField(field, nv); }}>
                                <span className="mp-toggle-knob" />
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* ═══ 배송지 관리 ═══ */}
            <div className={`mp-panel${activePanel==='address'?' active':''}`}>
              <button className="mp-panel-back" onClick={goBackMenu}><IconArrowLeft /></button>
              <div className="mp-section mp-addr-section">

                {/* 타이틀 */}
                <div style={{ fontSize:18, fontWeight:800, color:'#111', marginBottom:18 }}>배송지 관리</div>

                {addrLoading ? (
                  <div className="mp-empty">불러오는 중...</div>
                ) : addrFormOpen ? (
                  /* ════ 추가/수정 폼 (풀스크린 모달) ════ */
                  <div className="addr-modal">
                    <div className="addr-modal-header">
                      <span>{addrEditing ? '배송지 수정' : '배송지 추가'}</span>
                      <button type="button" onClick={() => { setAddrFormOpen(false); setAddrEditing(null); setAddrForm({ ...EMPTY_ADDR }); setAddrReqCustom(false); }} aria-label="닫기">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
                      </button>
                    </div>
                    <div className="addr-modal-body">
                    {/* 배송명 */}
                    <div style={{ marginBottom:16 }}>
                      <label style={{ display:'block', fontSize:13, fontWeight:600, marginBottom:7 }}>배송지명 <span style={{ color:'#CB1D11' }}>*</span></label>
                      <input maxLength={6} placeholder="최대 6자" value={addrForm.label}
                        onChange={e => setAddrForm(f => ({ ...f, label: e.target.value }))}
                        style={{ width:'100%', height:46, padding:'0 13px', border:'1px solid #DDD', borderRadius:6, fontSize:14, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }} />
                    </div>
                    {/* 받으시는분 */}
                    <div style={{ marginBottom:16 }}>
                      <label style={{ display:'block', fontSize:13, fontWeight:600, marginBottom:7 }}>받으시는분 <span style={{ color:'#CB1D11' }}>*</span></label>
                      <input maxLength={25} placeholder="최대 25자" value={addrForm.recipient}
                        onChange={e => setAddrForm(f => ({ ...f, recipient: e.target.value }))}
                        style={{ width:'100%', height:46, padding:'0 13px', border:'1px solid #DDD', borderRadius:6, fontSize:14, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }} />
                    </div>
                    {/* 휴대폰 */}
                    <div style={{ marginBottom:16 }}>
                      <label style={{ display:'block', fontSize:13, fontWeight:600, marginBottom:7 }}>휴대폰 <span style={{ color:'#CB1D11' }}>*</span></label>
                      <input type="tel" placeholder="-없이 휴대폰 번호를 입력해주세요." value={addrForm.phone}
                        onChange={e => setAddrForm(f => ({ ...f, phone: e.target.value.replace(/[^0-9]/g, '') }))}
                        style={{ width:'100%', height:46, padding:'0 13px', border:'1px solid #DDD', borderRadius:6, fontSize:14, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }} />
                    </div>
                    {/* 주소 */}
                    <div style={{ marginBottom:18 }}>
                      <label style={{ display:'block', fontSize:13, fontWeight:600, marginBottom:7 }}>주소 <span style={{ color:'#CB1D11' }}>*</span></label>
                      <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                        <input readOnly placeholder="우편번호" value={addrForm.zipcode}
                          onClick={() => openAddressPost((zip, addr) => setAddrForm(f => ({ ...f, zipcode: zip, address1: addr })))}
                          style={{ flex:1, height:46, padding:'0 13px', border:'1px solid #DDD', borderRadius:6, fontSize:14, background:'#fff', fontFamily:'inherit', boxSizing:'border-box', cursor:'pointer' }} />
                        <button type="button"
                          onClick={() => openAddressPost((zip, addr) => setAddrForm(f => ({ ...f, zipcode: zip, address1: addr })))}
                          style={{ height:46, padding:'0 16px', border:'none', borderRadius:6, background:'#1A1A1A', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', fontFamily:'inherit' }}>
                          우편번호 찾기
                        </button>
                      </div>
                      <input readOnly placeholder="기본 주소" value={addrForm.address1}
                        style={{ width:'100%', height:46, padding:'0 13px', border:'1px solid #DDD', borderRadius:6, fontSize:14, background:'#fff', fontFamily:'inherit', marginBottom:8, boxSizing:'border-box' }} />
                      <input placeholder="건물, 아파트, 동/호수 입력" value={addrForm.address2}
                        onChange={e => setAddrForm(f => ({ ...f, address2: e.target.value }))}
                        style={{ width:'100%', height:46, padding:'0 13px', border:'1px solid #DDD', borderRadius:6, fontSize:14, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }} />
                    </div>
                    {/* 배송 요청사항 */}
                    <div style={{ marginBottom:18 }}>
                      <label style={{ display:'block', fontSize:13, fontWeight:600, marginBottom:7 }}>배송 요청사항</label>
                      <button type="button" className="req-box" onClick={() => setAddrReqOpen(true)}>
                        <span className="req-box-tag">일반</span>
                        <span className={`req-box-val${(!addrReqCustom && !addrForm.delivery_request) ? ' ph' : ''}`}>{addrForm.delivery_request || '배송요청사항 없음'}</span>
                        <span className="req-box-change">변경</span>
                      </button>
                    </div>
                    {/* 배송 요청사항 선택 모달 (풀스크린) */}
                    {addrReqOpen && (
                      <div className="req-modal">
                        <div className="req-modal-header">
                          <span>배송요청사항</span>
                          <button type="button" onClick={() => setAddrReqOpen(false)} aria-label="닫기">
                            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
                          </button>
                        </div>
                        <div className="req-modal-body">
                          <div className="req-modal-subtitle">일반배송 요청사항</div>
                          {DELIVERY_REQ_PRESETS.map(p => (
                            <button type="button" key={p} className="req-radio" onClick={() => { setAddrForm(f => ({ ...f, delivery_request:p })); setAddrReqCustom(false); }}>
                              <span className={`req-radio-dot${!addrReqCustom && addrForm.delivery_request === p ? ' on' : ''}`} />
                              {p}
                            </button>
                          ))}
                          <button type="button" className="req-radio" onClick={() => { setAddrReqCustom(true); setAddrForm(f => ({ ...f, delivery_request:'' })); }}>
                            <span className={`req-radio-dot${addrReqCustom ? ' on' : ''}`} />
                            직접입력
                          </button>
                          {addrReqCustom && (
                            <input maxLength={50} autoFocus placeholder="요청사항을 입력해주세요 (최대 50자)" value={addrForm.delivery_request}
                              onChange={e => setAddrForm(f => ({ ...f, delivery_request: e.target.value }))}
                              className="req-modal-input" />
                          )}
                        </div>
                        <button type="button" className="req-modal-save" onClick={() => setAddrReqOpen(false)}>저장</button>
                      </div>
                    )}
                    {/* 기본 배송지 체크 */}
                    <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#444', cursor:'pointer', marginBottom:22 }}>
                      <input type="checkbox" checked={addrForm.is_default}
                        onChange={e => setAddrForm(f => ({ ...f, is_default: e.target.checked }))}
                        style={{ width:16, height:16, accentColor:'#1A1A1A', cursor:'pointer' }} />
                      기본 배송지로 저장
                    </label>
                    </div>
                    {/* 하단 고정 등록 버튼 */}
                    <button type="button" className="addr-modal-save" onClick={saveAddress}>등록</button>
                  </div>
                ) : (
                  /* ════ 배송지 목록 ════ */
                  <>
                    {/* 전체 N건 + 정렬 드롭다운 */}
                    <div className="mp-addr-top">
                      <span>전체 <b>{addresses.length}</b>건</span>
                      <select className="mp-addr-sort" value={addrSort}
                        onChange={e => setAddrSort(e.target.value as 'recent_use'|'recent_reg'|'name')}>
                        <option value="recent_use">최근 사용 순</option>
                        <option value="recent_reg">최근 등록 순</option>
                        <option value="name">가나다 순</option>
                      </select>
                    </div>

                    {addresses.length === 0 ? (
                      <div className="mp-empty">배송지가 없습니다.</div>
                    ) : (
                      [...addresses].sort((a, b) => {
                        if (addrSort === 'name') return (a.label || '').localeCompare(b.label || '', 'ko');
                        if (addrSort === 'recent_reg') return 0; // 이미 created_at desc 로 로드됨
                        // 최근 사용순 = 기본배송지 우선 (로드 시 is_default desc)
                        return (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0);
                      }).map(a => (
                        <div key={a.id} className={`mp-addr-card${a.is_default ? ' selected' : ''}`}>
                          <div className="mp-addr-head">
                            <div className="mp-addr-name">
                              <span className="t">{a.label || '배송지'}</span>
                              {a.is_default && <span className="badge">기본배송지</span>}
                            </div>
                            {a.is_default ? (
                              <span className="mp-addr-selected">
                                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                선택됨
                              </span>
                            ) : (
                              <button className="mp-addr-select" onClick={() => setDefaultAddress(a.id)}>선택</button>
                            )}
                          </div>
                          <div className="mp-addr-recipient">{a.recipient}  {a.phone}</div>
                          <div className="mp-addr-addr">
                            {a.zipcode && <span className="zip">[{a.zipcode}] </span>}{a.address1}{a.address2 ? ` ${a.address2}` : ''}
                          </div>
                          <div className="mp-addr-actions">
                            <button className="mp-addr-btn" onClick={() => { const dr = a.delivery_request || ''; setAddrEditing(a); setAddrForm({ label:a.label, recipient:a.recipient, phone:a.phone, zipcode:a.zipcode, address1:a.address1, address2:a.address2, is_default:a.is_default, delivery_request:dr }); setAddrReqCustom(!!dr && !DELIVERY_REQ_PRESETS.includes(dr)); setAddrFormOpen(true); }}>수정</button>
                            <button className="mp-addr-btn" onClick={() => deleteAddress(a.id)}>삭제</button>
                          </div>
                        </div>
                      ))
                    )}

                    {/* + 배송지 추가 (PC·모바일 하단 알약) */}
                    {addresses.length < 5 && (
                      <div className="mp-addr-add-wrap">
                        <button className="mp-addr-add" onClick={() => { setAddrEditing(null); setAddrForm({ ...EMPTY_ADDR }); setAddrReqCustom(false); setAddrFormOpen(true); }}>
                          + 배송지 추가
                        </button>
                      </div>
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
                  const cur = normalizeGrade(profile?.grade);
                  const sorted = [...tiers].sort((a, b) => a.sort - b.sort);
                  const curIdx = Math.max(0, sorted.findIndex(t => t.grade === cur));
                  const curTier = sorted[curIdx] ?? sorted[0];
                  const nextTier = curIdx < sorted.length - 1 ? sorted[curIdx + 1] : null;
                  // 분기(최근 90일) 누적 실적
                  const since = Date.now() - 90 * 86400000;
                  const qOrders = orders.filter(o => ['delivered', 'confirmed'].includes(o.status) && new Date(o.created_at).getTime() >= since);
                  const qAmount = qOrders.reduce((s, o) => s + (o.final_amount || 0), 0);
                  const qCount = qOrders.length;
                  const amtPct = nextTier && nextTier.min_amount > 0 ? Math.min(qAmount / nextTier.min_amount * 100, 100) : (nextTier ? 0 : 100);
                  const couponLabel = (code: string) => (({
                    [MEMBERSHIP_COUPON.THOUSAND]: '1,000원 쿠폰 (1만원 이상)',
                    [MEMBERSHIP_COUPON.PERCENT10]: '10% 쿠폰 (최대 3,000원)',
                    [MEMBERSHIP_COUPON.FIVE]: '5,000원 쿠폰 (3만원 이상)',
                  }) as Record<string, string>)[code] || code;
                  const curBenefits = [
                    `구매액 ${effectiveRate(curTier)}% 포인트 적립`,
                    ...curTier.coupon_codes.map(c => `매월 ${couponLabel(c)}`),
                    '생일월 5,000원 쿠폰 증정',
                    ...(cur === 'master' ? ['델리오 선별 선물세트 (연 2회 · 등급 유지 시)'] : []),
                  ];

                  return (
                    <>
                      {/* 타이틀 + 등급헤더4열: 멤버십 이미지 상단(막대그래프)과 중복되어 비활성화.
                          나중에 부활하려면 아래 false 를 true 로만 바꾸면 됨. */}
                      {false && (
                      <>
                      {/* 타이틀 */}
                      <div style={{ textAlign:'center', padding:'24px 0 18px' }}>
                        <div style={{ fontSize:20, fontWeight:700, color:'#111', marginBottom:8, fontFamily:'Georgia, serif' }}>
                          Delio Membership
                        </div>
                        <div style={{ fontSize:12, color:'#888' }}>
                          최근 3개월(분기) 누적 구매를 기준으로 산정됩니다.
                        </div>
                      </div>
                      <div style={{ height:1, background:'#CFCFCF', marginBottom:24 }} />

                      {/* 등급 헤더 4열 */}
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', marginBottom:24, gap:4 }}>
                        {sorted.map((t) => {
                          const isActive = t.grade === cur;
                          const color = GRADE_COLOR[t.grade];
                          return (
                            <div key={t.grade} style={{ textAlign:'center' }}>
                              <div style={{
                                width:54, height:54, borderRadius:'50%',
                                background: isActive ? color : '#D8D8D8',
                                color:'#fff', fontSize:isActive ? 13 : 11, fontWeight:800,
                                display:'flex', alignItems:'center', justifyContent:'center',
                                margin:'0 auto 10px', letterSpacing:0.5,
                              }}>{GRADE_LABEL_EN[t.grade].slice(0, 2)}</div>
                              <div style={{ fontSize:12.5, fontWeight:800, color: isActive ? '#111' : '#bbb', marginBottom:6 }}>
                                {t.label}
                              </div>
                              <div style={{ fontSize:10, color: isActive ? color : '#bbb', fontWeight:700, lineHeight:1.4 }}>
                                {t.min_amount === 0 ? '기본' : `${(t.min_amount / 10000).toLocaleString()}만원${t.min_count > 0 ? `·${t.min_count}회` : ''}↑`}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      </>
                      )}

                      {/* 진행 바 */}
                      <div style={{ background:'#F7F7F5', borderRadius:10, padding:'14px 16px', marginBottom:22 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:8 }}>
                          <span style={{ color:'#888' }}>최근 3개월 누적 ({qCount}회)</span>
                          <span style={{ fontWeight:800, color:'#111' }}>{fmtPrice(qAmount)}원</span>
                        </div>
                        <div style={{ height:5, background:'#E4E4E4', borderRadius:3, overflow:'hidden', marginBottom:7 }}>
                          <div style={{ height:'100%', width:`${amtPct}%`, borderRadius:3, transition:'width .5s',
                            background: 'linear-gradient(90deg, #F0603A, #CB1D11)' }} />
                        </div>
                        <div style={{ fontSize:11, textAlign:'right' }}>
                          {nextTier
                            ? <span style={{ color: 'var(--color-accent)', fontWeight:700 }}>
                                {nextTier.label}까지 {fmtPrice(Math.max(nextTier.min_amount - qAmount, 0))}원{nextTier.min_count > qCount ? ` · ${nextTier.min_count - qCount}회` : ''} 남음
                              </span>
                            : <span style={{ color:'#555', fontWeight:700 }}>최고 등급 달성!</span>
                          }
                        </div>
                      </div>

                      {/* 현재 등급 혜택 */}
                      <div style={{ border:`1.5px solid ${GRADE_COLOR[cur]}33`, borderRadius:12, overflow:'hidden', marginBottom:16 }}>
                        <div style={{ background:'#1A1A1A', color:'#fff', padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                          <span style={{ fontWeight:800, fontSize:15 }}>{curTier.label} 혜택</span>
                          <span style={{ fontSize:12, fontWeight:700, opacity:0.95 }}>포인트 {effectiveRate(curTier)}% 적립</span>
                        </div>
                        <div style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:9 }}>
                          {curBenefits.map((txt, i) => (
                            <div key={i} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#333' }}>
                              <span style={{ color:'#1A1A1A', fontWeight:800, flexShrink:0 }}>✓</span>{txt}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 등급별 혜택 안내 (디자인 이미지) — 혜택01 표 · 혜택02 생일쿠폰 · 유의사항 */}
                      <img
                        src="/delio_membership_v2.png"
                        alt="델리오 멤버십 등급별 혜택 안내"
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        style={{ width:'100%', height:'auto', display:'block', borderRadius:12, marginTop:4 }}
                      />
                    </>
                  );
                })()}
              </div>
            </div>

            {/* ═══ 1:1 문의 ═══ */}
            <div className={`mp-panel${activePanel==='cs'?' active':''}`}>
              <button className="mp-panel-back" onClick={goBackMenu}><IconArrowLeft /></button>
              <div className="mp-section">
                {/* 상위 탭: 상품 Q&A / 1:1 문의 */}
                <div style={{ display:'flex', borderBottom:'1px solid #E5E5E5', marginTop:4 }}>
                  {([
                    { key:'qna',     label:'상품 Q&A' },
                    { key:'inquiry', label:'1:1 문의' },
                  ] as const).map(t => (
                    <button key={t.key} onClick={() => setCsMainTab(t.key)}
                      style={{ flex:1, textAlign:'center', padding:'14px 0', background:'none', border:'none',
                        fontFamily:'inherit', cursor:'pointer', fontSize:15,
                        fontWeight: csMainTab===t.key ? 700 : 500,
                        color: csMainTab===t.key ? '#1A1A1A' : '#999',
                        borderBottom: csMainTab===t.key ? '2px solid #1A1A1A' : '2px solid transparent',
                        marginBottom:-1, transition:'color .15s' }}>
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* ── 상품 Q&A ── */}
                {csMainTab === 'qna' && (
                  <>
                  {/* 상품 Q&A 요약 3열 (클릭 시 필터) */}
                  <div className="mp-cs-summary">
                    <button type="button" className={`mp-cs-sum-col${qnaFilter==='all'?' active':''}`} onClick={() => setQnaFilter('all')}><span className="mp-cs-sum-label">전체문의</span><span className="mp-cs-sum-num">{myQna.length}<span className="mp-cs-sum-unit">개</span></span></button>
                    <button type="button" className={`mp-cs-sum-col${qnaFilter==='answered'?' active':''}`} onClick={() => setQnaFilter(f => f==='answered'?'all':'answered')}><span className="mp-cs-sum-label">답변완료</span><span className="mp-cs-sum-num">{myQna.filter(q => q.answer).length}<span className="mp-cs-sum-unit">개</span></span></button>
                    <button type="button" className={`mp-cs-sum-col${qnaFilter==='waiting'?' active':''}`} onClick={() => setQnaFilter(f => f==='waiting'?'all':'waiting')}><span className="mp-cs-sum-label">답변대기</span><span className="mp-cs-sum-num">{myQna.filter(q => !q.answer).length}<span className="mp-cs-sum-unit">개</span></span></button>
                  </div>
                  <div style={{ marginTop:20 }}>
                    <div>
                      {qnaLoading ? (
                        <div style={{ textAlign:'center', padding:'40px 0', color:'#aaa', fontSize:13, borderBottom:'1px solid #EEE' }}>불러오는 중...</div>
                      ) : (() => {
                        const view = qnaFilter === 'all' ? myQna : myQna.filter(q => qnaFilter === 'answered' ? !!q.answer : !q.answer);
                        if (myQna.length === 0) return <div style={{ textAlign:'center', padding:'40px 0', color:'#888', fontSize:13, borderBottom:'1px solid #EEE' }}>등록된 상품 Q&A가 없습니다.</div>;
                        if (view.length === 0) return <div style={{ textAlign:'center', padding:'40px 0', color:'#888', fontSize:13, borderBottom:'1px solid #EEE' }}>해당 상태의 문의가 없습니다.</div>;
                        return view.map((q, i) => {
                          const isOpen = qnaOpenId === q.id;
                          return (
                          <div key={q.id} style={{ borderBottom:'1px solid #F0F0F0' }}>
                            <div onClick={() => setQnaOpenId(isOpen ? null : q.id)}
                              style={{ display:'flex', flexDirection:'column', gap:7,
                                padding:'16px 2px', cursor:'pointer',
                                background: isOpen ? '#FAFAFA' : 'transparent' }}>
                              <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', columnGap:8, rowGap:4 }}>
                                <span style={{ fontSize:13.5, fontWeight:800, color:'#1A1A1A' }}>{qnaCatLabel(q.category)}</span>
                                <span style={{ fontSize:12.5, color:'#888', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'40%' }}>{q.products?.name ?? '-'}</span>
                                <span style={{ fontSize:12, color:'#aaa' }}>{new Date(q.created_at).toLocaleDateString('ko-KR')}</span>
                                <span style={{ marginLeft:'auto', fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:999,
                                  background: q.answer ? '#E8F5E9' : '#FFF3E0', color: q.answer ? '#2D7A4D' : '#C8841C' }}>
                                  {q.answer ? '답변완료' : '답변대기'}
                                </span>
                              </div>
                              <div style={{ fontSize:14, color:'#333', lineHeight:1.5,
                                display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{q.content}</div>
                            </div>
                            {isOpen && (
                              <div style={{ background:'#F7F7F5', padding:'16px 0' }}>
                                {/* 문의 */}
                                <div style={{ display:'flex', alignItems:'flex-start', marginBottom: q.answer ? 14 : 0 }}>
                                  <span style={{ width:70, flexShrink:0, textAlign:'center', fontSize:12, fontWeight:800, color:'#1A1A1A' }}>Q</span>
                                  <div style={{ flex:1, paddingRight:8, fontSize:13, color:'#333', lineHeight:1.7, whiteSpace:'pre-wrap' }}>
                                    {editQnaId === q.id
                                      ? <textarea value={editQnaText} onChange={e => setEditQnaText(e.target.value)}
                                          style={{ width:'100%', minHeight:72, padding:'8px 10px', border:'1.5px solid #DDD', borderRadius:8, fontSize:13, fontFamily:'inherit', lineHeight:1.6, outline:'none', boxSizing:'border-box', resize:'vertical' }} />
                                      : q.content}
                                  </div>
                                </div>
                                {/* 답변 */}
                                <div style={{ display:'flex', alignItems:'flex-start', borderTop:'1px solid #ECECEC', paddingTop:14 }}>
                                  <span style={{ width:70, flexShrink:0, textAlign:'center', fontSize:12, fontWeight:800, color:'#CB1D11' }}>A</span>
                                  <div style={{ flex:1, paddingRight:8, fontSize:13, color: q.answer ? '#333' : '#aaa', lineHeight:1.7, whiteSpace:'pre-wrap' }}>
                                    {q.answer || '아직 답변이 등록되지 않았습니다.'}
                                  </div>
                                </div>
                                <div style={{ display:'flex', justifyContent:'flex-end', paddingRight:16, marginTop:12, gap:8 }}>
                                  {editQnaId === q.id ? (
                                    <>
                                      <button onClick={() => setEditQnaId(null)}
                                        style={{ fontSize:12, color:'#666', background:'#fff', border:'1px solid #D8D8D8', borderRadius:6, padding:'6px 14px', cursor:'pointer', fontWeight:600 }}>취소</button>
                                      <button onClick={() => updateMyQna(q.id)}
                                        style={{ fontSize:12, color:'#fff', background:'#1A1A1A', border:'none', borderRadius:6, padding:'6px 16px', cursor:'pointer', fontWeight:600 }}>저장</button>
                                    </>
                                  ) : (
                                    <>
                                      {!q.answer && (
                                        <button onClick={() => { setEditQnaId(q.id); setEditQnaText(q.content); }}
                                          style={{ fontSize:12, color:'#666', background:'#fff', border:'1px solid #D8D8D8', borderRadius:6, padding:'6px 14px', cursor:'pointer', fontWeight:600 }}>수정</button>
                                      )}
                                      <button onClick={() => deleteMyQna(q.id)}
                                        style={{ fontSize:12, color:'#666', background:'#fff', border:'1px solid #D8D8D8', borderRadius:6, padding:'6px 14px', cursor:'pointer', fontWeight:600 }}>삭제</button>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                  </>
                )}

                {/* ── 1:1 문의 ── */}
                {csMainTab === 'inquiry' && (
                <>
                {/* 문의 요약 3열 */}
                <div className="mp-cs-summary">
                  <button type="button" className={`mp-cs-sum-col${inqFilter==='all'?' active':''}`} onClick={() => setInqFilter('all')}>
                    <span className="mp-cs-sum-label">전체문의</span>
                    <span className="mp-cs-sum-num">{csInquiries.length}개</span>
                  </button>
                  <button type="button" className={`mp-cs-sum-col${inqFilter==='answered'?' active':''}`} onClick={() => setInqFilter(f => f==='answered'?'all':'answered')}>
                    <span className="mp-cs-sum-label">답변완료</span>
                    <span className="mp-cs-sum-num">{csInquiries.filter(q => q.status === 'answered').length}개</span>
                  </button>
                  <button type="button" className={`mp-cs-sum-col${inqFilter==='waiting'?' active':''}`} onClick={() => setInqFilter(f => f==='waiting'?'all':'waiting')}>
                    <span className="mp-cs-sum-label">답변대기</span>
                    <span className="mp-cs-sum-num">{csInquiries.filter(q => q.status !== 'answered').length}개</span>
                  </button>
                </div>
                {/* 문의하기 토글 버튼 */}
                <button className="mp-cs-ask"
                  onClick={() => { setCsFormOpen(v => !v); if (csDone) { setCsDone(false); setCsTitle(''); setCsMessage(''); setCsCategory('order'); setCsFiles([]); } }}>
                  문의하기
                </button>

                {/* ── 문의하기 폼 (토글) ── */}
                {csFormOpen && (
                  <div style={{ padding:'20px 0', marginBottom:12 }}>
                    {csDone ? (
                      /* 완료 메시지 */
                      <div style={{ textAlign:'center', padding:'32px 0' }}>
                        <div style={{ width:56, height:56, borderRadius:'50%', background:'#22C55E',
                          display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
                          <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#fff"
                            strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        </div>
                        <div style={{ fontSize:16, fontWeight:800, marginBottom:8 }}>문의가 접수되었습니다!</div>
                        <p style={{ fontSize:13, color:'#888', lineHeight:1.8, marginBottom:20 }}>
                          영업일 기준 1~2일 이내 답변드립니다.<br/>
                          아래 문의 내역에서 확인 가능합니다.
                        </p>
                        <div style={{ display:'flex', gap:8 }}>
                          <button onClick={() => setCsFormOpen(false)}
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
                        {/* 유형 선택 — 필 탭 */}
                        <div style={{ marginBottom:16 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:'#aaa', marginBottom:10,
                            textTransform:'uppercase', letterSpacing:'0.4px' }}>문의 유형</div>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                            {CS_CATEGORIES.map(c => {
                              const on = csCategory===c.value;
                              return (
                                <button type="button" key={c.value}
                                  onClick={() => setCsCategory(c.value)}
                                  style={{ padding:'9px 18px', borderRadius:999,
                                    border:`1px solid ${on ? '#1A1A1A' : '#E5E5E5'}`,
                                    background: on ? '#1A1A1A' : '#F4F4F4',
                                    fontSize:13, fontWeight:700, color: on ? '#fff' : '#888',
                                    cursor:'pointer', transition:'all .15s', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                                  {c.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* 제목 */}
                        <div style={{ marginBottom:12 }}>
                          <label style={{ display:'block', fontSize:13, fontWeight:700, color:'#aaa',
                            marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' }}>
                            제목 <span style={{ color:'#1A1A1A', fontSize:11.5 }}><span style={{ color:'#CB1D11' }}>*</span>필수</span>
                          </label>
                          <input type="text" value={csTitle} onChange={e => setCsTitle(e.target.value)}
                            placeholder="문의 제목을 입력해주세요"
                            style={{ width:'100%', padding:'12px 14px', border:'1.5px solid #EBEBEB',
                              borderRadius:10, fontSize:15, color:'#1A1A1A', background:'#FAFAFA',
                              outline:'none', boxSizing:'border-box', fontFamily:'inherit' }} />
                        </div>

                        {/* 내용 */}
                        <div style={{ marginBottom:16 }}>
                          <label style={{ display:'block', fontSize:13, fontWeight:700, color:'#aaa',
                            marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' }}>
                            문의 내용 <span style={{ color:'#1A1A1A', fontSize:11.5 }}><span style={{ color:'#CB1D11' }}>*</span>필수</span>
                          </label>
                          <textarea value={csMessage} onChange={e => setCsMessage(e.target.value)} rows={5}
                            placeholder={
                              csCategory==='order'   ? '주문번호, 상품명, 배송 문의 내용을 입력해주세요.' :
                              csCategory==='return'  ? '주문번호, 취소·교환·반품 사유를 입력해주세요.' :
                              csCategory==='product' ? '상품명, 궁금한 점을 입력해주세요.' :
                              csCategory==='member'  ? '회원 정보, 포인트, 쿠폰 관련 내용을 입력해주세요.' :
                              '문의 내용을 자유롭게 입력해주세요.'
                            }
                            style={{ width:'100%', minHeight:130, padding:'13px 14px',
                              border:'1.5px solid #EBEBEB', borderRadius:10, fontSize:14.5,
                              color:'#1A1A1A', resize:'vertical', outline:'none', background:'#FAFAFA',
                              fontFamily:'inherit', boxSizing:'border-box', lineHeight:1.6 }} />
                          <div style={{ textAlign:'right', fontSize:12, color:'#aaa', marginTop:4 }}>
                            {csMessage.length} / 1000
                          </div>
                        </div>

                        {/* 파일 첨부 */}
                        <div style={{ marginBottom:16 }}>
                          <label style={{ display:'block', fontSize:13, fontWeight:700, color:'#aaa',
                            marginBottom:8, textTransform:'uppercase', letterSpacing:'0.4px' }}>
                            파일 첨부 <span style={{ fontWeight:400, color:'#bbb', fontSize:11.5 }}>선택 · 최대 5개</span>
                          </label>
                          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'flex-start' }}>
                            {/* 파일 썸네일 목록 */}
                            {csFiles.map((f, i) => {
                              const isImg = f.type.startsWith('image/');
                              const isVid = f.type.startsWith('video/');
                              const isPdf = f.type === 'application/pdf';
                              const icon = isImg ? '🖼️' : isVid ? '🎬' : isPdf ? '📄' : '📎';
                              return (
                                <div key={i} style={{ width:82, position:'relative' }}>
                                  <div style={{ width:82, height:82, borderRadius:10, background:'#F0F0F0',
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
                              <label style={{ width:82, height:82, borderRadius:10,
                                border:'1px dashed #D0D0D0', background:'#F7F7F5',
                                display:'flex', flexDirection:'column', alignItems:'center',
                                justifyContent:'center', cursor:'pointer', gap:3, flexShrink:0 }}>
                                <span style={{ fontSize:28, color:'#aaa', lineHeight:1 }}>＋</span>
                                <span style={{ fontSize:11, color:'#bbb' }}>파일추가</span>
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
                          <div style={{ fontSize:12, color:'#bbb', marginTop:8 }}>
                            이미지(JPG·PNG·GIF)·영상(MP4·MOV)·PDF·문서(DOC·XLS) 지원 · 파일당 최대 20MB
                          </div>
                        </div>

                        <button type="submit" disabled={csLoading || csUploading}
                          style={{ width:'100%', padding:'13px', background:'#1A1A1A', color:'#fff',
                            border:'none', borderRadius:12, fontSize:14, fontWeight:700,
                            cursor: (csLoading||csUploading)?'default':'pointer',
                            opacity: (csLoading||csUploading)?0.7:1,
                            fontFamily:'inherit' }}>
                          {csUploading ? '📤 파일 업로드 중...' : csLoading ? '등록 중...' : '문의 등록하기'}
                        </button>
                      </form>
                    )}
                  </div>
                )}

                {/* ── 문의 내역 (문의 작성 중에는 숨김) ── */}
                <div style={{ padding:'8px 0 16px', marginBottom:12, display: csFormOpen ? 'none' : 'block' }}>
                  <div style={{ fontSize:16, fontWeight:800, margin:'8px 0 10px' }}>문의 내역</div>
                    {csInquiries.length === 0 ? (
                      <div style={{ textAlign:'center', padding:'32px 0', color:'#aaa', fontSize:13 }}>
                        아직 문의 내역이 없습니다.
                      </div>
                    ) : (() => {
                      const view = inqFilter === 'all' ? csInquiries : csInquiries.filter(q => inqFilter === 'answered' ? q.status === 'answered' : q.status !== 'answered');
                      if (view.length === 0) return (
                        <div style={{ textAlign:'center', padding:'32px 0', color:'#aaa', fontSize:13 }}>해당 상태의 문의가 없습니다.</div>
                      );
                      return view.map(inq => {
                        const cat = CS_CATEGORIES.find(c => c.value === inq.category);
                        const isOpen = csOpenId === inq.id;
                        return (
                          <div key={inq.id}
                            onClick={() => setCsOpenId(isOpen ? null : inq.id)}
                            style={{ padding:'14px 0', borderBottom:'1px solid #F4F4F4', cursor:'pointer' }}>
                            <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', columnGap:8, rowGap:4, marginBottom:7 }}>
                              <span style={{ fontSize:13.5, fontWeight:800, color:'#1A1A1A' }}>{cat?.name ?? inq.category}</span>
                              <span style={{ fontSize:12, color:'#aaa' }}>{new Date(inq.created_at).toLocaleDateString('ko-KR')}</span>
                              <span style={{ marginLeft:'auto', fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:999, flexShrink:0,
                                background: inq.status==='answered'?'#E8F5E9':'#FFF3E0',
                                color: inq.status==='answered'?'#2D7A4D':'#C8841C' }}>
                                {inq.status==='answered'?'답변완료':'답변대기'}
                              </span>
                            </div>
                            <div style={{ fontSize:14, color:'#333', lineHeight:1.5,
                              display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{inq.title}</div>
                            {isOpen && (
                              <div style={{ background:'#F7F7F5', borderRadius:10, padding:'12px 14px',
                                marginTop:10, fontSize:12, color:'#555', lineHeight:1.7 }}>
                                <div style={{ fontSize:11, fontWeight:700, color:'#1A1A1A', marginBottom:6 }}>📝 문의 내용</div>
                                {editCsId === inq.id
                                  ? <textarea value={editCsText} onClick={e => e.stopPropagation()} onChange={e => setEditCsText(e.target.value)}
                                      style={{ width:'100%', minHeight:84, padding:'8px 10px', border:'1.5px solid #DDD', borderRadius:8, fontSize:12, fontFamily:'inherit', lineHeight:1.6, outline:'none', boxSizing:'border-box', resize:'vertical', marginBottom: inq.answer?12:0 }} />
                                  : <p style={{ margin:0, whiteSpace:'pre-wrap', marginBottom: inq.answer?12:0 }}>{inq.message}</p>}
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
                                <div style={{ display:'flex', justifyContent:'flex-end', marginTop:12, gap:8 }}>
                                  {editCsId === inq.id ? (
                                    <>
                                      <button onClick={e => { e.stopPropagation(); setEditCsId(null); }}
                                        style={{ fontSize:12, color:'#666', background:'#fff', border:'1px solid #D8D8D8', borderRadius:6, padding:'6px 14px', cursor:'pointer', fontWeight:600 }}>취소</button>
                                      <button onClick={e => { e.stopPropagation(); updateMyCs(inq.id); }}
                                        style={{ fontSize:12, color:'#fff', background:'#1A1A1A', border:'none', borderRadius:6, padding:'6px 16px', cursor:'pointer', fontWeight:600 }}>저장</button>
                                    </>
                                  ) : (
                                    <>
                                      {inq.status !== 'answered' && (
                                        <button onClick={e => { e.stopPropagation(); setEditCsId(inq.id); setEditCsText(inq.message || ''); }}
                                          style={{ fontSize:12, color:'#666', background:'#fff', border:'1px solid #D8D8D8', borderRadius:6, padding:'6px 14px', cursor:'pointer', fontWeight:600 }}>수정</button>
                                      )}
                                      <button onClick={e => { e.stopPropagation(); deleteMyCs(inq.id); }}
                                        style={{ fontSize:12, color:'#666', background:'#fff', border:'1px solid #D8D8D8', borderRadius:6, padding:'6px 14px', cursor:'pointer', fontWeight:600 }}>삭제</button>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>

                {/* 운영 안내 */}
                <div style={{ background:'#F7F7F5', borderRadius:10, padding:'14px 16px',
                  fontSize:12, color:'#888', lineHeight:2 }}>
                  평일 09:00~18:00 운영 (점심 12:00~13:00 제외)<br/>
                  주말·공휴일 휴무 · 영업일 기준 1~2일 이내 답변
                </div>
                </>
                )}

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

                      {/* 결과 — 포스텔러 무드 (공유 컴포넌트) */}
                      <SurveyResultView
                        info={info}
                        currentKey={key}
                        userName={profile?.name || undefined}
                        allTypes={Object.entries(SURVEY_MAP).map(([k, v]) => ({ key: k, name: v.name, emoji: v.emoji }))}
                        recProducts={surveyRecProducts}
                        showRec={surveyShowRec}
                        onShop={() => router.push('/category')}
                      />

                      {/* 진단일 */}
                      <div style={{ marginTop:16 }} />
                      <div style={{ fontSize:11, color:'#bbb', textAlign:'right', marginBottom:20 }}>
                        마지막 진단: {new Date(surveyResult.created_at).toLocaleDateString('ko-KR')}
                      </div>

                      {/* 공유 버튼 (취향진단 페이지와 동일하게 카카오·인스타) */}
                      <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                        <button onClick={shareSurveyKakao}
                          style={{ flex:1, padding:'13px', border:'none', borderRadius:12,
                            background:'#FEE500', color:'#3C1E1E', fontSize:13, fontWeight:700, cursor:'pointer',
                            fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                          <svg viewBox="0 0 24 24" width="15" height="15"><path fill="#3C1E1E" d="M12 3C6.48 3 2 6.48 2 10.8c0 2.74 1.6 5.15 4.02 6.62l-.97 3.63c-.08.3.23.55.5.38L9.8 18.9c.71.1 1.44.15 2.2.15 5.52 0 10-3.48 10-7.8S17.52 3 12 3z"/></svg>
                          카카오 공유
                        </button>
                        <button onClick={saveResultCard} disabled={savingCard}
                          style={{ flex:1, padding:'13px', border:'none', borderRadius:12,
                            background:'linear-gradient(135deg,#F58529,#DD2A7B,#8134AF)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer',
                            fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:6, opacity: savingCard ? 0.6 : 1 }}>
                          📸 {savingCard ? '준비 중...' : '인스타 공유'}
                        </button>
                      </div>
                      {/* 맞춤상품 / 재검사 */}
                      <div style={{ display:'flex', gap:8, marginBottom:10 }}>
                        <button onClick={() => router.push('/category')}
                          style={{ flex:1, padding:'13px', border:'1.5px solid #EBEBEB', borderRadius:12,
                            background:'#fff', fontSize:13, fontWeight:700, cursor:'pointer',
                            color:'#1A1A1A', fontFamily:'inherit' }}>
                          맞춤 상품
                        </button>
                        <button onClick={() => { setSurveyResult('none'); router.push('/survey'); }}
                          style={{ flex:1, padding:'13px', border:'none', borderRadius:12,
                            background:'#1A1A1A', color:'#fff', fontSize:13, fontWeight:700,
                            cursor:'pointer', fontFamily:'inherit' }}>
                          재검사하기
                        </button>
                      </div>

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
        const idx = myReviews.findIndex(x => x.id === r.id);
        return (
          <ReviewPhotoModal
            review={{ id: r.id, images: r.image_urls || [], videoUrl: r.video_url, rating: r.rating, content: r.content, createdAt: r.created_at }}
            product={r.products ? { id: r.products.id, name: r.products.name, thumbnail: r.products.thumbnail_url } : null}
            onClose={() => setReviewPhotoModal(null)}
            onPrev={idx > 0 ? () => setReviewPhotoModal(myReviews[idx - 1]) : undefined}
            onNext={idx >= 0 && idx < myReviews.length - 1 ? () => setReviewPhotoModal(myReviews[idx + 1]) : undefined}
            pos={idx >= 0 && myReviews.length > 1 ? `${idx + 1} / ${myReviews.length}` : undefined}
            footerNode={
              <div style={{ flexShrink: 0, borderTop: '1px solid #EBEBEB', padding: '10px 12px calc(10px + env(safe-area-inset-bottom))', display: 'flex', gap: 10, background: '#fff' }}>
                <button onClick={() => { setReviewPhotoModal(null); startEdit(r); }} style={{ flex: 1, padding: '14px 0', borderRadius: 10, border: '1.5px solid #DDD', background: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>수정</button>
                <button onClick={() => { handleDeleteReview(r.id); setReviewPhotoModal(null); }} style={{ flex: 1, padding: '14px 0', borderRadius: 10, border: '1.5px solid #F0C9C9', background: '#fff', color: '#E53935', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>삭제</button>
              </div>
            }
          />
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

      {/* ── 주문취소 / 환불 신청 모달 ── */}
      {reqModal && (
        <div onClick={() => setReqModal(null)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'#fff', borderRadius:16, padding:'24px 22px', width:'100%', maxWidth:460, maxHeight:'88vh', overflowY:'auto' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
              <span style={{ fontSize:17, fontWeight:800 }}>{reqModal.type === 'cancel' ? '주문취소 신청' : '환불 신청'}</span>
              <button onClick={() => setReqModal(null)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#999', lineHeight:1 }}>✕</button>
            </div>
            <p style={{ fontSize:13, color:'#888', marginBottom:18 }}>주문 {reqModal.order.order_no} · {fmtPrice(reqModal.order.final_amount)}원</p>

            <div style={{ fontSize:13, fontWeight:700, marginBottom:8 }}>{reqModal.type === 'cancel' ? '취소' : '환불/교환'} 사유 *</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:18 }}>
              {(reqModal.type === 'cancel' ? CANCEL_REASONS : REFUND_REASONS).map(r => (
                <label key={r} style={{ display:'flex', alignItems:'center', gap:8, padding:'11px 13px', cursor:'pointer',
                  border:`1.5px solid ${reqReason===r ? 'var(--color-accent)' : '#EBEBEB'}`, borderRadius:8,
                  background:reqReason===r ? 'var(--color-accent-bg)' : '#fff',
                  fontSize:14, fontWeight:reqReason===r ? 700 : 400, color:reqReason===r ? 'var(--color-accent)' : '#333' }}>
                  <input type="radio" name="reqReason" checked={reqReason===r} onChange={() => setReqReason(r)} style={{ display:'none' }} />
                  {r}
                </label>
              ))}
            </div>

            <div style={{ fontSize:13, fontWeight:700, marginBottom:8 }}>상세 내용 <span style={{ color:'#aaa', fontWeight:400 }}>(선택)</span></div>
            <textarea value={reqDetail} onChange={e => setReqDetail(e.target.value)} rows={3}
              placeholder="자세한 사유를 적어주시면 처리에 도움이 됩니다."
              style={{ width:'100%', border:'1px solid #DDD', borderRadius:8, padding:'10px 12px', fontSize:14, fontFamily:'inherit', resize:'vertical', boxSizing:'border-box', marginBottom:18 }} />

            <p style={{ fontSize:12, color:'#999', lineHeight:1.6, marginBottom:16 }}>
              신청 후 관리자 확인을 거쳐 처리됩니다. 승인 시 결제 수단으로 자동 환불되며, 진행 상황은 마이페이지에서 확인하실 수 있어요.
            </p>
            <button onClick={submitReq} disabled={reqSubmitting || !reqReason}
              style={{ width:'100%', padding:'14px', background: reqReason ? 'var(--color-ink)' : '#CCC', color:'#fff',
                border:'none', borderRadius:8, fontSize:15, fontWeight:700, cursor: reqReason ? 'pointer' : 'default' }}>
              {reqSubmitting ? '접수 중…' : (reqModal.type === 'cancel' ? '주문취소 신청하기' : '환불 신청하기')}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
