'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { PRODUCT_PUBLIC_COLS } from '@/lib/productCols';
import { addToCart, showCartToast, openOptionDrawer } from '@/lib/cart';
import { getDownloadableCoupons, claimAllPublic, type PublicCoupon } from '@/lib/coupons';
import { gaViewItem, gaAddToCart } from '@/lib/gtag';
import { useAuth } from '@/hooks/useAuth';
import { useLoginGuard } from '@/hooks/useLoginGuard';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { Heart } from 'lucide-react';
import '@/styles/product.css';
import { StarRating, SingleStar } from '@/components/StarRating';
import ReviewPhotoModal from '@/components/ReviewPhotoModal/ReviewPhotoModal';
import { imgThumb } from '@/lib/img';
import { TASTE_AXES, SELLER_AXES, defaultSellerScore, toLevel, axisLevelLabel, agreePct, avgPct, TASTE_REVEAL_MIN, type ReviewTaste } from '@/lib/taste';
import { normalizeGrade, effectiveRate, DEFAULT_TIERS, type MembershipTier } from '@/lib/membership';

/* ── 타입 ── */
interface Product {
  id: string; sku: string; name: string;
  origin: string; category: string;
  price: number; discount_rate: number; discounted_price: number;
  thumbnail_url: string | null; image_urls: string[] | null;
  dispatch_cutoff: string | null; badge: string | null; badge_color: string | null;
  short_desc: string | null; brix: number | null;
  is_new: boolean; is_best: boolean; is_dawn: boolean;
  avg_rating: number; review_count: number;
  farm_id: string | null;
  seller_score?: Record<string, number> | null;
}
interface ProductOption {
  id: string; label: string; add_price: number; stock: number; is_default: boolean; group_name: string | null; is_required: boolean | null; parent_label?: string | null;
}
interface Farm {
  id: string; name: string; region: string; farm_type: string;
  intro: string | null; slug: string; thumbnail_url: string | null;
}
interface ProductInquiry {
  id: string;
  user_id: string | null;
  category: string;
  content: string;
  is_private: boolean;
  password?: string | null;
  answer: string | null;
  answered_at: string | null;
  created_at: string;
  profiles?: { name: string | null } | null;
}

interface Review {
  id: string; rating: number; content: string; created_at: string;
  image_urls: string[] | null; video_url: string | null;
  likes_count: number; is_best: boolean;
  seller_reply?: string | null;
  user_id?: string | null;
  taste?: ReviewTaste | null;
  author_name?: string | null;
  profiles: { name: string | null } | null;
}
interface DetailSection {
  id: string; section_type: string; content: string; sort_order: number;
}

const EMOJI_MAP: Record<string, string> = {
  apple:'🍎', citrus:'🍊', berry:'🫐', melon:'🍈',
  kiwi:'🥝', mango:'🥭', grape:'🍇', gift:'🎁', default:'🍑',
};
const BG_MAP: Record<string, string> = {
  apple:'#FFE8E8', citrus:'#FFF3E0', berry:'#F3E5F5', melon:'#E8F5E9',
  kiwi:'#F1F8E9', mango:'#FFF9E6', grape:'#EDE7F6', gift:'#E8EAF6', default:'#F4EFE6',
};

/* ── 맛 프로파일 설정 ── */
function fmtPrice(n: number) { return n.toLocaleString('ko-KR'); }
/* 문의 카테고리 표시 라벨 */
const INQ_CAT_LABEL: Record<string, string> = {
  '문의': '상품문의', '상품': '상품문의', '배송관련': '배송문의',
  '취소/교환/반품': '취소/교환/반품', '기타': '기타문의',
};
const inqCatLabel = (c: string) => INQ_CAT_LABEL[c] || (c ? `${c}` : '상품문의');

// Stars → StarRating 공유 컴포넌트 사용

type SortKey = 'latest' | 'helpful' | 'rating';

const INFO_KEYS = [
  ['제품명', '식품의 유형'],
  ['생산자 및 소재지 (수입품의 경우 생산지, 수입자 및 제조국)', '제조연월일, 소비기한 또는 품질유지기한'],
  ['포장단위별 내용물의 용량(중량), 수량', '원재료명 및 함량 (원산지 표시 포함)'],
  ['영양성분 (영양성분 표시대상 식품에 한함)', '유전자변형식품에 해당하는 경우의 표시'],
  ['소비자 안전을 위한 주의사항', '소비자 상담 관련 전화번호'],
] as const;

export default function ProductClient() {
  const { id }    = useParams() as { id: string };
  const router    = useRouter();
  const { user }  = useAuth();
  const requireLogin = useLoginGuard();

  const [product,    setProduct]    = useState<Product | null>(null);
  const [options,    setOptions]    = useState<ProductOption[]>([]);
  const [farm,       setFarm]       = useState<Farm | null>(null);
  const [farmWishCount, setFarmWishCount] = useState(0);
  const [farmWished, setFarmWished] = useState(false);
  const [reviews,    setReviews]    = useState<Review[]>([]);
  const [inquiries,  setInquiries]  = useState<ProductInquiry[]>([]);
  const [inqPage,    setInqPage]    = useState(0);
  const [inqModal,   setInqModal]   = useState(false);
  const [inqContent, setInqContent] = useState('');
  const [inqCategory, setInqCategory] = useState('문의');
  const [inqCatOpen, setInqCatOpen] = useState(false);
  const [inqPrivate, setInqPrivate] = useState(false);
  const [inqSubmitting, setInqSubmitting] = useState(false);
  const [inqPassword, setInqPassword] = useState('');
  const [expandedInq, setExpandedInq] = useState<string | null>(null);
  const [pwInput, setPwInput] = useState<Record<string, string>>({});
  const [unlockedInq, setUnlockedInq] = useState<Set<string>>(new Set());
  const [editInqId, setEditInqId] = useState<string | null>(null);
  const [editInqText, setEditInqText] = useState('');
  const [sections,      setSections]      = useState<DetailSection[]>([]);
  const [detailImages,  setDetailImages]  = useState<string[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [selThumb,   setSelThumb]   = useState(0);
  const touchStartX = useRef<number | null>(null);
  const [selByGroup, setSelByGroup] = useState<Record<string, string>>({});
  const [openOptGroup, setOpenOptGroup] = useState<string | null>(null);
  const [qty,        setQty]        = useState(1);
  /* 누적 선택된 옵션 조합 목록 (각 조합 = 옵션들 + 수량) */
  const [picks, setPicks] = useState<{ key: string; opts: ProductOption[]; qty: number }[]>([]);
  const [activeTab,  setActiveTab]  = useState(0);
  const [wishlisted,       setWishlisted]       = useState(false);
  const [reviewSort,       setReviewSort]       = useState<SortKey>('latest');
  const [reviewPage,       setReviewPage]       = useState(0);
  const [reviewModalOpen,  setReviewModalOpen]  = useState(false);
  /* 후기 신고 모달 */
  const [reportTarget,     setReportTarget]     = useState<string | null>(null); // 신고할 리뷰 id
  const [reportReason,     setReportReason]     = useState('');
  const [reportDetail,     setReportDetail]     = useState('');
  const [reportSaving,     setReportSaving]     = useState(false);
  const [newRating,        setNewRating]        = useState(5);
  const [newContent,       setNewContent]       = useState('');
  const [reviewPolicyAgree, setReviewPolicyAgree] = useState(false);
  const [reviewPolicyOpen,  setReviewPolicyOpen]  = useState(false);
  const [newTaste,         setNewTaste]         = useState<Record<string, number>>({});
  const [newImages,        setNewImages]        = useState<File[]>([]);
  const [newVideo,         setNewVideo]         = useState<File | null>(null);
  const [mediaUploading,   setMediaUploading]   = useState(false);
  /* 리뷰 사진 드래그 재정렬 (PC 마우스 + 모바일 터치) */
  const reviewDragSrc = useRef<number | null>(null);
  const reviewDropTarget = useRef<number | null>(null);

  /* 후기 신고 제출 */
  const REPORT_REASONS = ['욕설·비방', '광고·홍보성', '허위·부적절한 내용', '음란·혐오', '기타'];
  async function submitReport() {
    if (!reportTarget || !user) return;
    if (!reportReason) { showToast('신고 사유를 선택해 주세요.'); return; }
    if (reportReason === '기타' && !reportDetail.trim()) { showToast('기타 사유를 입력해 주세요.'); return; }
    setReportSaving(true);
    const reason = reportReason === '기타' ? `기타: ${reportDetail.trim()}` : reportReason;
    const { error } = await createClient().from('review_reports')
      .insert({ review_id: reportTarget, reporter_id: user.id, reason });
    setReportSaving(false);
    setReportTarget(null);
    showToast(error?.code === '23505' ? '이미 신고한 리뷰입니다.' : error ? '오류가 발생했습니다.' : '신고가 접수되었습니다.');
  }
  function reorderReviewImages(to: number) {
    const from = reviewDragSrc.current;
    reviewDragSrc.current = null;
    if (from === null || from === to) return;
    setNewImages(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }
  const [submitting,       setSubmitting]       = useState(false);
  const submittingRef = useRef(false); // 연타 동시 제출 방지 (state는 비동기라 ref로 동기 차단)
  const [reviewPt,         setReviewPt]         = useState({ text: 100, photo: 500 });
  const [hasPurchased,     setHasPurchased]     = useState(false);
  const [tasteMore,           setTasteMore]           = useState(false);
  const [buyerStats,          setBuyerStats]          = useState({ buyers: 0, repurchase: 0, recent: 0 });
  const [photoFilterOn,       setPhotoFilterOn]       = useState(false);
  const [photoGalleryOpen,    setPhotoGalleryOpen]    = useState(false);
  const [selectedGalleryIdx,  setSelectedGalleryIdx]  = useState<number | null>(null);
  const [galleryFromReview,   setGalleryFromReview]   = useState(false); // 리뷰 사진에서 진입했는지(뒤로가기 동작 구분)
  const [isMobile,            setIsMobile]            = useState(false);
  const [siteDispatchCutoff,  setSiteDispatchCutoff]  = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [likedReviews, setLikedReviews] = useState<Set<string>>(new Set());
  const [couponDownOpen,      setCouponDownOpen]      = useState(false);
  /* 모달/풀스크린 열림 동안 뒷 배경 스크롤 잠금 */
  useBodyScrollLock(inqModal || reviewModalOpen || reviewPolicyOpen || photoGalleryOpen || couponDownOpen);
  const [isAdmin, setIsAdmin] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }
  const [csPhone,             setCsPhone]             = useState('02-6925-2311');
  const [signupCoupon,        setSignupCoupon]        = useState(5000);
  const [signupBest,          setSignupBest]          = useState<{ discountAmt: number; finalPrice: number; totalRate: number; fromSignup: boolean } | null>(null);
  const [downCoupons,         setDownCoupons]         = useState<PublicCoupon[]>([]);
  const [claiming,            setClaiming]            = useState(false);
  const [couponRefresh,       setCouponRefresh]       = useState(0);
  const [pointRate,           setPointRate]           = useState(1);
  const [bestCoupon,       setBestCoupon]       = useState<{
    name: string; discountAmt: number; finalPrice: number; totalRate: number; held: boolean;
  } | null | 'loading'>('loading');

  /* ── 상세정보 표시용 데이터 ── */
  const [infoData, setInfoData] = useState<{
    tableRows?: { k1: string; v1: string; k2: string; v2: string }[];
    tableValues?: string[][];
    table?: string[][];
    tableExtra?: { k1: string; v1: string; k2: string; v2: string }[];
    shipping: string[];
    return_: string[];
    cs: string[];
  } | null>(null);

  /* 모바일 감지 */
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  /* Q&A 탭 진입 시 최신 데이터 로드 */
  const refreshInquiries = useCallback(async () => {
    const { data } = await createClient()
      .from('product_inquiries')
      .select('id, category, content, is_private, password, answer, answered_at, created_at, user_id')
      .eq('product_id', id)
      .order('created_at', { ascending: true })
      .limit(100);
    if (data) setInquiries(data as unknown as ProductInquiry[]);
  }, [id]); // eslint-disable-line

  useEffect(() => {
    if (activeTab === 3) refreshInquiries();
  }, [activeTab, refreshInquiries]);

  /* 같은 페이지에서 상단 별점(후기) 클릭 → 후기 탭 전환 + 탭 위치로 스크롤 */
  function goReviewTab() {
    setActiveTab(2);
    const jump = () => {
      const el = document.getElementById('productTabsAnchor');
      if (!el) return;
      // scrollIntoView (anchor의 scroll-margin-top:60 으로 헤더 보정) — 모바일에서 안정적
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    [60, 220, 450].forEach(d => setTimeout(jump, d));
  }

  /* 상품카드 별점(후기) 클릭으로 진입(?tab=review) → 후기 탭으로 이동 + 스크롤 */
  const didJumpReviewRef = useRef(false);
  useEffect(() => {
    if (didJumpReviewRef.current || !product) return;
    const sp = new URLSearchParams(window.location.search);
    const tabParam = sp.get('tab');
    if (tabParam !== 'review' && tabParam !== 'qna') return;
    didJumpReviewRef.current = true;
    setActiveTab(tabParam === 'qna' ? 3 : 2);
    // 문의 작성 의도로 진입(?ask=1) → 상품 문의 작성 모달 바로 열기
    if (tabParam === 'qna' && sp.get('ask') === '1') setInqModal(true);
    // 리뷰 작성 의도로 진입 — ?star=N(별점 반영) 또는 ?review=1(작성만) → 리뷰 작성 모달 열기
    if (tabParam === 'review') {
      const star = Number(sp.get('star'));
      if (star >= 1 && star <= 5) { setNewRating(star); setReviewModalOpen(true); }
      else if (sp.get('review') === '1') setReviewModalOpen(true);
    }
    /* 비-sticky 부모 섹션으로 스크롤(sticky 탭바는 사파리 scrollIntoView 버그).
       모바일 사파리는 behavior:'instant'를 무시하고 CSS scroll-behavior:smooth로 처리하므로,
       매 프레임 호출하면 smooth가 매번 재시작돼 멈춘다 → 띄엄띄엄 한 번씩만 호출해 각 스크롤이 완료될 시간을 준다.
       이미지 로드/Next 진입 scroll-top 경쟁 대비해 여러 시점 재시도. 사용자가 스크롤하면 중단. */
    let userInterrupted = false;
    const onUser = () => { userInterrupted = true; };
    window.addEventListener('wheel', onUser, { passive: true });
    window.addEventListener('touchmove', onUser, { passive: true });
    window.addEventListener('keydown', onUser);
    const jump = () => {
      if (userInterrupted) return;
      const el = document.getElementById('productTabsAnchor');
      if (!el) return;
      // 전역 scroll-behavior:smooth를 일시 무력화 → 즉시 점프(애니메이션 취소 이슈 없이 모든 브라우저 동일 동작)
      const html = document.documentElement;
      const prevBehavior = html.style.scrollBehavior;
      html.style.scrollBehavior = 'auto';
      const y = el.getBoundingClientRect().top + window.scrollY - 60; // 헤더 보정
      window.scrollTo(0, Math.max(0, y));
      html.style.scrollBehavior = prevBehavior;
    };
    const timers = [60, 250, 500, 850, 1300].map(d => window.setTimeout(jump, d));
    const cleanup = () => {
      timers.forEach(clearTimeout);
      window.removeEventListener('wheel', onUser);
      window.removeEventListener('touchmove', onUser);
      window.removeEventListener('keydown', onUser);
    };
    const finalTimer = window.setTimeout(cleanup, 1700);
    return () => { cleanup(); clearTimeout(finalTimer); };
  }, [product]);

  /* 어드민 여부 */
  useEffect(() => {
    if (!user) return;
    createClient().rpc('is_current_user_admin').then(({ data }) => setIsAdmin(data === true));
  }, [user]);

  useEffect(() => {
    async function load() {
      if (!id) return;
      setLoading(true);
      const supabase = createClient();

      const [{ data: prod }, { data: opts }, { data: revs }, { data: secs }, { data: infoSec }, { data: inqs }] =
        await Promise.all([
          supabase.from('products').select(PRODUCT_PUBLIC_COLS).eq('id', id).single(),
          supabase.from('product_options').select('*').eq('product_id', id).order('sort_order'),
          supabase.from('reviews')
            .select('*, profiles(name)')
            .eq('product_id', id)
            .order('is_best', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(50),
          supabase.from('product_detail_sections')
            .select('*').eq('product_id', id).order('sort_order'),
          supabase.from('product_detail_sections')
            .select('*').eq('product_id', id).eq('section_type', 'info_content').maybeSingle(),
          supabase.from('product_inquiries')
            .select('id, category, content, is_private, password, answer, answered_at, created_at, user_id')
            .eq('product_id', id)
            .order('created_at', { ascending: true })
            .limit(100),
        ]);

      if (!prod) { router.push('/'); return; }
      const prodT = prod as unknown as Product;
      setProduct(prodT);
      setOptions((opts as ProductOption[]) || []);
      setReviews((revs as Review[]) || []);
      setInquiries((inqs as unknown as ProductInquiry[]) || []);
      const allSecs = (secs as DetailSection[]) || [];
      setSections(allSecs.filter(s => s.section_type !== 'info_content' && s.section_type !== 'detail_images'));

      /* 상품설명 이미지 */
      const imgSec = allSecs.find(s => s.section_type === 'detail_images');
      if (imgSec) {
        try {
          const parsed = JSON.parse(imgSec.content);
          setDetailImages(Array.isArray(parsed.images) ? parsed.images : []);
        } catch { /* 파싱 실패 무시 */ }
      }

      /* 상세정보 편집 데이터 */
      const defaultInfoData = {
        table: [
          [(prod as unknown as Product).name, '과일'],
          ['상품설명 및 이미지 참조', '상품설명 및 이미지 참조'],
          ['상품설명 및 이미지 참조', '상품설명 및 이미지 참조'],
          ['상품설명 및 이미지 참조', '상품설명 및 이미지 참조'],
          ['상품설명 및 이미지 참조', csPhone || '고객센터 문의'],
        ],
        shipping: [
          '기상 악화 및 교통 상황에 따라 부득이하게 배송이 지연될 수 있습니다.',
          '당사는 CJ 대한통운을 이용하고 있으며, 상황에 따라 타 택배사를 통해 배송될 수 있습니다.',
          '신선 식품 특성 상 제주 및 도서 산간 지역은 배송이 불가합니다.',
          '주소 오기재 등으로 인한 반송·미배송 시에도 일정 기간 소요 시 자동 배송완료 처리됩니다.',
          '주말 및 공휴일은 상품을 출고하지 않습니다.',
          '단체 및 다량 주문 시 고객센터로 별도 문의 후 주문 바랍니다.',
        ],
        return_: [
          '신선 식품 특성 상 단순 변심 / 주문 착오 / 개인 정보 오기재 / 수취인 연락 부재의 경우 교환 및 반품이 불가합니다.',
          '품질 및 배송 관련 문제가 있는 경우 수령 후 1~2일 이내, 이미지를 첨부하여 고객센터로 문의바랍니다.',
          '교환 및 반품 희망 시 상담원에게 먼저 문의해 주세요.',
        ],
        cs: [
          `고객센터 전화: ${csPhone}`,
          '운영시간: 평일 09:00~18:00 (주말·공휴일 휴무)',
          '상품 관련 문의는 수령 후 1~2일 이내에 접수해 주세요.',
          '이미지 첨부 시 보다 빠른 처리가 가능합니다.',
        ],
      };
      if (infoSec) {
        try { setInfoData(JSON.parse((infoSec as any).content)); }
        catch { setInfoData(defaultInfoData); }
      } else {
        setInfoData(defaultInfoData);
      }

      // 옵션은 기본 선택 없이 '[필수] 옵션 선택'으로 시작 (사용자가 직접 선택)

      // 최근 본 상품 저장 (localStorage)
      try {
        const RECENT_KEY = 'delio_recent_products';
        const existing: {id:string}[] = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
        const filtered = existing.filter(p => p.id !== (prod as unknown as Product).id);
        const item = {
          id: (prod as unknown as Product).id,
          name: (prod as unknown as Product).name,
          price: (prod as unknown as Product).discounted_price ?? (prod as unknown as Product).price,
          discount_rate: (prod as unknown as Product).discount_rate,
          thumbnail_url: (prod as unknown as Product).thumbnail_url,
          avg_rating: (prod as unknown as Product).avg_rating,
          category: (prod as unknown as Product).category,
        };
        localStorage.setItem(RECENT_KEY, JSON.stringify([item, ...filtered].slice(0, 20)));
      } catch { /* ignore */ }

      // site_settings 한번에 로드
      const { data: settingRows } = await supabase
        .from('site_settings')
        .select('key, value')
        .in('key', ['dispatch_cutoff', 'cs_phone', 'signup_coupon', 'point_rate']);
      (settingRows || []).forEach((s: { key: string; value: string }) => {
        if (s.key === 'dispatch_cutoff' && s.value) setSiteDispatchCutoff(s.value);
        if (s.key === 'cs_phone'        && s.value) setCsPhone(s.value);
        if (s.key === 'signup_coupon'   && s.value) setSignupCoupon(Number(s.value));
      });

      if (prodT.farm_id) {
        const { data: farmData } = await supabase
          .from('farms').select('*').eq('id', prodT.farm_id).single();
        setFarm(farmData as Farm);

        // 농장 팔로워 수 (farm_wishlist)
        const { count: wishCount } = await supabase
          .from('farm_wishlist')
          .select('id', { count: 'exact', head: true })
          .eq('farm_id', prodT.farm_id);
        setFarmWishCount(wishCount || 0);
        // 내가 이 농장을 팔로우 중인지
        const fid = prodT.farm_id;
        const { data: { user: u } } = await supabase.auth.getUser();
        if (u) {
          const { data: ff } = await supabase.from('farm_wishlist')
            .select('id').eq('farm_id', fid).eq('user_id', u.id).maybeSingle();
          setFarmWished(!!ff);
        }
      }

      if (user) {
        const { data: wl } = await supabase.from('wishlist')
          .select('id').eq('product_id', id).eq('user_id', user.id).maybeSingle();
        setWishlisted(!!wl);
      }
      setLoading(false);
    }
    load();
  }, [id, user, router]);

  /* ── 쿠폰 연동: 로그인 사용자의 최대 적용 가능 쿠폰 계산 ── */
  useEffect(() => {
    if (!product) return;
    if (!user) { setBestCoupon(null); return; }

    async function loadCoupons() {
      const supabase = createClient();
      // 보유 쿠폰 + 다운로드 가능(공개) 이벤트 쿠폰을 모두 후보로
      const [{ data: heldData }, { data: pubData }] = await Promise.all([
        supabase.from('user_coupons').select('id, coupons:coupon_id (*)').eq('user_id', user!.id).eq('is_used', false),
        supabase.from('coupons').select('*').eq('is_public', true).eq('is_active', true),
      ]);

      const now = new Date();
      const bp  = product!.discounted_price ?? product!.price;
      let best: { name: string; discountAmt: number; finalPrice: number; totalRate: number; held: boolean } | null = null;

      const seen = new Set<string>();
      const heldSet = new Set<string>();
      const candidates: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
      for (const uc of (heldData as any[]) || []) { const cc = uc.coupons; if (cc?.id) { heldSet.add(cc.id); if (!seen.has(cc.id)) { seen.add(cc.id); candidates.push(cc); } } } // eslint-disable-line @typescript-eslint/no-explicit-any
      for (const cc of (pubData as any[]) || []) { if (cc?.id && !seen.has(cc.id)) { seen.add(cc.id); candidates.push(cc); } } // eslint-disable-line @typescript-eslint/no-explicit-any

      for (const c of candidates) {
        if (!c || !c.discount_value || !c.is_active) continue;

        // 만료 체크
        if (c.expires_at && new Date(c.expires_at) < now) continue;

        // 최소 주문금액
        if ((c.min_order_amount ?? 0) > bp) continue;

        // 적용 대상 제한 (카테고리/상품)
        if (c.applicable_categories?.length && !c.applicable_categories.includes(product!.category)) continue;
        if (c.applicable_product_ids?.length && !c.applicable_product_ids.includes(product!.id)) continue;

        // 할인 금액 계산
        let discountAmt = 0;
        if (c.discount_type === 'percent') {
          discountAmt = Math.round(bp * c.discount_value / 100);
          if (c.max_discount_amount) discountAmt = Math.min(discountAmt, c.max_discount_amount);
        } else { // fixed
          discountAmt = Math.min(c.discount_value, bp);
        }

        if (!best || discountAmt > best.discountAmt) {
          best = {
            name:       c.name,
            discountAmt,
            finalPrice: bp - discountAmt,
            totalRate:  Math.round((1 - (bp - discountAmt) / product!.price) * 100),
            held:       heldSet.has(c.id),   // 이미 보유 중인 쿠폰인지(아니면 다운로드 필요)
          };
        }
      }

      setBestCoupon(best);
    }

    loadCoupons();
  }, [product, user, couponRefresh]);

  /* ── 비로그인: 신규가입 웰컴 쿠폰(signup_grant) 중 이 상품에 적용 가능한 최대 할인 계산 (min_order_amount 준수) ── */
  useEffect(() => {
    if (!product) return;
    if (user) { setSignupBest(null); return; }
    (async () => {
      const supabase = createClient();
      // 신규가입 웰컴 쿠폰 + 다운로드 가능(공개) 이벤트 쿠폰 모두 후보로
      const { data } = await supabase.from('coupons').select('*').or('signup_grant.eq.true,is_public.eq.true').eq('is_active', true);
      if (!data || data.length === 0) { setSignupBest(null); return; }
      const now = new Date();
      const bp = product.discounted_price ?? product.price;
      let best: { discountAmt: number; finalPrice: number; totalRate: number; fromSignup: boolean } | null = null;
      for (const c of data as any[]) { // eslint-disable-line @typescript-eslint/no-explicit-any
        if (!c.discount_value) continue;
        if (c.expires_at && new Date(c.expires_at) < now) continue;
        if ((c.min_order_amount ?? 0) > bp) continue;                 // 최소주문금액 미달 → 제외
        if (c.applicable_categories?.length && !c.applicable_categories.includes(product.category)) continue;
        if (c.applicable_product_ids?.length && !c.applicable_product_ids.includes(product.id)) continue;
        let discountAmt = 0;
        if (c.discount_type === 'percent') {
          discountAmt = Math.round(bp * c.discount_value / 100);
          if (c.max_discount_amount) discountAmt = Math.min(discountAmt, c.max_discount_amount);
        } else {
          discountAmt = Math.min(c.discount_value, bp);
        }
        if (!best || discountAmt > best.discountAmt) {
          best = { discountAmt, finalPrice: bp - discountAmt, totalRate: Math.round((1 - (bp - discountAmt) / product.price) * 100), fromSignup: !!c.signup_grant };
        }
      }
      setSignupBest(best);
    })();
  }, [product, user]);

  /* ── 쿠폰 다운로드 모달 ── */
  async function openCouponDownload() {
    setCouponDownOpen(true);
    if (user) {
      setDownCoupons(await getDownloadableCoupons(user.id));
    } else {
      const { data } = await createClient().from('coupons')
        .select('id,name,discount_type,discount_value,min_order_amount,max_discount_amount,starts_at,expires_at,valid_days')
        .eq('is_public', true).eq('is_active', true);
      setDownCoupons((data as PublicCoupon[]) || []);
    }
  }
  async function claimCoupons() {
    if (!user) { setCouponDownOpen(false); router.push('/login'); return; }
    setClaiming(true);
    const n = await claimAllPublic(user.id);
    setClaiming(false);
    setCouponDownOpen(false);
    if (n > 0) { showToast(`${n}장의 쿠폰을 받았어요! 🎉`); setCouponRefresh(x => x + 1); }
    else showToast('받을 수 있는 쿠폰이 없습니다.');
  }

  async function toggleWishlist() {
    if (!requireLogin() || !user) return;
    const supabase = createClient();
    if (wishlisted) {
      await supabase.from('wishlist').delete().eq('product_id', id).eq('user_id', user.id);
      setWishlisted(false);
    } else {
      await supabase.from('wishlist').insert({ product_id: id, user_id: user.id });
      setWishlisted(true);
    }
  }

  /* 농장 찜(팔로우) — 상품 찜과 별개 */
  async function toggleFarmWish() {
    if (!user) { router.push('/login'); return; }
    if (!farm) return;
    const supabase = createClient();
    if (farmWished) {
      await supabase.from('farm_wishlist').delete().eq('farm_id', farm.id).eq('user_id', user.id);
      setFarmWished(false);
      setFarmWishCount(c => Math.max(0, c - 1));
    } else {
      await supabase.from('farm_wishlist').insert({ farm_id: farm.id, user_id: user.id });
      setFarmWished(true);
      setFarmWishCount(c => c + 1);
    }
  }

  /* 그룹별 선택된 옵션들 (덧셈식) */
  function getSelectedOpts(map: Record<string, string> = selByGroup): ProductOption[] {
    const gNames = [...new Set(options.map(o => o.group_name || '옵션'))];
    return gNames.map(g => options.find(o => o.id === map[g])).filter(Boolean) as ProductOption[];
  }
  function allGroupsSelected(map: Record<string, string> = selByGroup): boolean {
    if (options.length === 0) return true;
    const gNames = [...new Set(options.map(o => o.group_name || '옵션'))];
    const requiredGroups = gNames.filter(g => options.find(o => (o.group_name || '옵션') === g)?.is_required !== false);
    // 독립 그룹: 필수인 모든 그룹이 실제 선택돼야 완성
    if (!isCascade) return requiredGroups.every(g => !!map[g]);
    // 종속(2단계): 상위 선택 + 그 상위에 하위가 있으면 하위도 선택돼야 완성
    const parentG = gNames[0];
    const parentLabel = options.find(o => o.id === map[parentG])?.label || '';
    return requiredGroups.every(g => {
      if (map[g]) return true;
      if (gNames.indexOf(g) > 0) {
        const avail = options.filter(o => (o.group_name || '옵션') === g && (!o.parent_label || o.parent_label === parentLabel));
        if (avail.length === 0) return true;
      }
      return false;
    });
  }
  /* 옵션 조합을 누적 목록에 추가 (같은 조합이면 수량 +1) */
  function addPick(opts: ProductOption[]) {
    const key = opts.map(o => o.id).join(',');
    setPicks(prev => {
      const i = prev.findIndex(p => p.key === key);
      if (i >= 0) { const next = [...prev]; next[i] = { ...next[i], qty: next[i].qty + 1 }; return next; }
      return [...prev, { key, opts, qty: 1 }];
    });
  }
  function addCartItem() {
    if (!product) return;
    const base = product.discounted_price ?? product.price;
    // 옵션 상품: 누적 목록(picks) 각각을 담음 / 옵션 없는 상품: 단일 수량
    const list = options.length > 0 ? picks : [{ opts: [] as ProductOption[], qty }];
    list.forEach(p => {
      const addP = p.opts.reduce((s, o) => s + (o.add_price || 0), 0);
      const unitPrice = base + addP;
      addToCart({
        id: product.id,
        name: product.name,
        price: unitPrice,
        originalPrice: product.price + addP,
        thumbnail: product.thumbnail_url || '',
        quantity: p.qty,
        optionId: p.opts.map(o => o.id).join(',') || undefined,
        options: p.opts.map(o => o.label).join(' / ') || undefined,
        deliveryType: product.is_dawn ? '산지직송' : '자사배송',
      });
    });
    const totalQ = list.reduce((s, p) => s + p.qty, 0);
    gaAddToCart({ id: product.id, name: product.name, price: base, quantity: totalQ, category: product.category });
  }
  /* GA4: 상품 조회 */
  useEffect(() => {
    if (product) {
      gaViewItem({ id: product.id, name: product.name, price: product.discounted_price ?? product.price, category: product.category });
      try { createClient().rpc('bump_product_view', { p_id: product.id }); } catch { /* noop */ }
    }
  }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* 모바일 하단 구매 CTA바가 있는 페이지 → 플로팅 버튼(카카오·맨위로)을 그 위로 올림 */
  useEffect(() => {
    document.body.classList.add('has-mobile-cta');
    return () => document.body.classList.remove('has-mobile-cta');
  }, []);

  /* 이 상품 구매 여부 (리뷰 작성 권한) — 결제완료/배송/구매확정 주문에 포함 */
  useEffect(() => {
    if (!user || !product?.id) { setHasPurchased(false); return; }
    (async () => {
      const { data } = await createClient()
        .from('order_items')
        .select('order_id, orders!inner(user_id, status)')
        .eq('product_id', product.id)
        .eq('orders.user_id', user.id)
        .in('orders.status', ['paid', 'delivered', 'confirmed'])
        .limit(1);
      setHasPurchased(!!data && data.length > 0);
    })();
  }, [user, product?.id]);

  /* 리뷰 작성 적립 포인트 (안내용) */
  useEffect(() => {
    createClient().from('site_settings').select('key,value')
      .in('key', ['review_point_text', 'review_point_photo'])
      .then(({ data }) => {
        const m: Record<string, string> = {};
        ((data as { key: string; value: string }[]) || []).forEach(s => { m[s.key] = s.value; });
        setReviewPt({
          text: parseInt(m.review_point_text || '50') || 0,
          photo: parseInt(m.review_point_photo || '150') || 0,
        });
      });
  }, []);

  /* 적립률: 로그인 회원 등급별(membership_tiers) — 비로그인은 비기너 기준 */
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      let grade = 'beginner';
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('grade').eq('id', user.id).maybeSingle();
        grade = normalizeGrade((prof as { grade?: string } | null)?.grade);
      }
      const { data: tier } = await supabase.from('membership_tiers').select('*').eq('grade', grade).maybeSingle();
      const t = (tier as MembershipTier | null) ?? DEFAULT_TIERS.find(x => x.grade === grade)!;
      setPointRate(effectiveRate(t));
    })();
  }, [user]);

  /* 구매 지표: 재구매율(2회+ 구매자 비율) · 최근 30일 구매자 수 */
  useEffect(() => {
    if (!product?.id) return;
    (async () => {
      const { data: items } = await createClient()
        .from('order_items')
        .select('order_id, orders!inner(user_id, created_at, status)')
        .eq('product_id', product.id)
        .limit(5000);
      if (!items) return;
      const since = Date.now() - 30 * 86400000;
      const userOrders: Record<string, Set<string>> = {};
      const recent = new Set<string>();
      (items as unknown as { order_id: string; orders: { user_id: string | null; created_at: string; status: string } }[]).forEach(it => {
        const o = it.orders;
        if (!o?.user_id || !['paid', 'delivered', 'confirmed'].includes(o.status)) return;
        (userOrders[o.user_id] ||= new Set<string>()).add(it.order_id);
        if (new Date(o.created_at).getTime() >= since) recent.add(o.user_id);
      });
      const buyers = Object.keys(userOrders);
      const repurchasers = buyers.filter(u => userOrders[u].size >= 2).length;
      setBuyerStats({
        buyers: buyers.length,
        repurchase: buyers.length > 0 ? Math.round(repurchasers / buyers.length * 100) : 0,
        recent: recent.size,
      });
    })();
  }, [product?.id]);

  function handleAddCart() {
    if (!requireLogin()) return;
    if (options.length > 0 && picks.length === 0) { showToast('옵션을 선택해 주세요.'); return; }
    addCartItem();
    showCartToast();
    setPicks([]);
  }
  function handleBuyNow() {
    if (!requireLogin()) return;
    if (options.length > 0 && picks.length === 0) { showToast('옵션을 선택해 주세요.'); return; }
    addCartItem(); router.push('/cart');
  }

  async function handleSubmitReview() {
    if (!user) { router.push('/login'); return; }
    if (!hasPurchased) { alert('구매하신 상품만 리뷰를 작성할 수 있어요.'); return; }
    if (!newContent.trim()) { alert('리뷰 내용을 입력해주세요.'); return; }
    if (submittingRef.current) return;   // 이미 제출 중이면 무시 (연타 차단)
    submittingRef.current = true;
    setSubmitting(true);
    const supabase = createClient();

    /* ── 파일명 안전하게 변환 ── */
    const safeName = (name: string) => {
      const ext = name.split('.').pop() ?? '';
      return `${Date.now()}.${ext}`;
    };

    /* ── 이미지 업로드 ── */
    const uploadedImageUrls: string[] = [];
    if (newImages.length > 0) {
      setMediaUploading(true);
      for (const file of newImages) {
        const path = `reviews/${user.id}/${safeName(file.name)}`;
        const { error: upErr } = await supabase.storage.from('products').upload(path, file, { upsert: true });
        if (upErr) { submittingRef.current = false; setSubmitting(false); setMediaUploading(false); alert(`사진 업로드 실패: ${upErr.message}`); return; }
        const { data } = supabase.storage.from('products').getPublicUrl(path);
        uploadedImageUrls.push(data.publicUrl);
      }
      setMediaUploading(false);
    }

    /* ── 영상 업로드 ── */
    let uploadedVideoUrl: string | null = null;
    if (newVideo) {
      setMediaUploading(true);
      const path = `reviews/${user.id}/${safeName(newVideo.name)}`;
      const { error: upErr } = await supabase.storage.from('products').upload(path, newVideo, { upsert: true });
      if (upErr) { submittingRef.current = false; setSubmitting(false); setMediaUploading(false); alert(`영상 업로드 실패: ${upErr.message}`); return; }
      const { data } = supabase.storage.from('products').getPublicUrl(path);
      uploadedVideoUrl = data.publicUrl;
      setMediaUploading(false);
    }

    /* 작성자 표시명(마스킹) — profiles RLS 무관하게 직접 저장해 모두에게 보이도록 */
    let authorName: string | null = null;
    {
      const { data: me } = await supabase.from('profiles').select('name').eq('id', user.id).maybeSingle();
      const nm = me?.name || (user.user_metadata as { name?: string } | undefined)?.name;
      if (nm) authorName = nm.charAt(0) + '****';
    }

    const reviewPayload: Record<string, unknown> = {
      product_id: product!.id,
      user_id: user.id,
      rating: newRating,
      content: newContent.trim(),
      image_urls: uploadedImageUrls.length > 0 ? uploadedImageUrls : null,
      video_url: uploadedVideoUrl,
      taste: Object.keys(newTaste).length > 0 ? newTaste : null,
      author_name: authorName,
      is_best: false,
    };
    let { data: inserted, error } = await supabase.from('reviews').insert(reviewPayload).select('id').single();
    /* author_name 컬럼이 아직 없으면(SQL 미실행) 제외하고 재시도 */
    if (error && /author_name|column/i.test(error.message)) {
      delete reviewPayload.author_name;
      ({ data: inserted, error } = await supabase.from('reviews').insert(reviewPayload).select('id').single());
    }
    if (error) { submittingRef.current = false; setSubmitting(false); alert('리뷰 등록 중 오류가 발생했습니다.'); return; }
    /* 성공: 모달 닫을 때까지 submitting 유지 → 중복 제출(다중 클릭) 방지 */

    /* 리뷰 작성 포인트 적립 (멱등) */
    let earnedPt = 0;
    if (inserted?.id) {
      try {
        const res = await fetch('/api/reviews/reward', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reviewId: inserted.id }),
        });
        earnedPt = (await res.json())?.granted || 0;
      } catch { /* 적립 실패는 리뷰 등록에 영향 없음 */ }
    }

    // 리뷰 새로 불러오기
    const { data: refreshed } = await supabase
      .from('reviews').select('*, profiles(name)')
      .eq('product_id', product!.id)
      .order('created_at', { ascending: false }).limit(50);
    const updatedReviews = (refreshed as Review[]) || [];
    setReviews(updatedReviews);

    // products.avg_rating + review_count 실시간 반영
    const newCount = updatedReviews.length;
    const newAvg   = newCount > 0
      ? Math.round(updatedReviews.reduce((s, r) => s + r.rating, 0) / newCount * 10) / 10
      : 0;
    await supabase.from('products').update({
      review_count: newCount,
      avg_rating:   newAvg,
    }).eq('id', product!.id);
    setProduct(prev => prev ? { ...prev, review_count: newCount, avg_rating: newAvg } : prev);

    alert(earnedPt > 0 ? `리뷰가 등록됐습니다. ${earnedPt.toLocaleString()}P 적립! 감사합니다 🎉` : '리뷰가 등록됐습니다. 감사합니다!');
    setReviewModalOpen(false);
    setNewRating(5);
    setNewContent('');
    setNewTaste({});
    setNewImages([]);
    setNewVideo(null);
    submittingRef.current = false; setSubmitting(false);
  }

  /* ── 리뷰 도움됐어요 ── */
  async function toggleReviewLike(reviewId: string, currentCount: number) {
    const already = likedReviews.has(reviewId);
    const newCount = already ? Math.max(0, currentCount - 1) : currentCount + 1;
    setLikedReviews(prev => {
      const next = new Set(prev);
      already ? next.delete(reviewId) : next.add(reviewId);
      return next;
    });
    setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, likes_count: newCount } : r));
    const supabase = createClient();
    await supabase.from('reviews').update({ likes_count: newCount }).eq('id', reviewId);
    showToast(already ? '취소되었습니다.' : '도움이 됐어요! 👍');
  }

  /* ── 상품 문의 제출 ── */
  async function submitInquiry() {
    if (!user) { router.push('/login'); return; }
    if (!inqContent.trim()) { alert('문의 내용을 입력해주세요.'); return; }
    setInqSubmitting(true);
    const supabase = createClient();
    if (inqPrivate && !inqPassword.trim()) { alert('비밀 문의는 비밀번호를 설정해야 합니다.'); setInqSubmitting(false); return; }
    const { data, error } = await supabase.from('product_inquiries').insert({
      product_id: product!.id,
      user_id: user.id,
      category: inqCategory,
      content: inqContent.trim(),
      is_private: inqPrivate,
      password: inqPrivate ? inqPassword.trim() : null,
    }).select('id, category, content, is_private, answer, answered_at, created_at').single();
    setInqSubmitting(false);
    if (error) { alert('문의 등록 실패: ' + error.message); return; }
    const newInquiry: ProductInquiry = { ...(data as unknown as ProductInquiry), profiles: { name: user.user_metadata?.name || null } };
    setInquiries(prev => [newInquiry, ...prev]);
    setInqModal(false);
    setInqContent('');
    setInqCategory('문의');
    setInqPrivate(false);
    setInqPassword('');
    alert('문의가 등록되었습니다.');
  }

  /* ── 본인 문의 삭제 ── */
  async function deleteInquiry(id: string) {
    if (!confirm('이 문의를 삭제하시겠습니까?')) return;
    const supabase = createClient();
    const { error } = await supabase.from('product_inquiries').delete().eq('id', id);
    if (error) { showToast('삭제 실패: ' + error.message); return; }
    setInquiries(prev => prev.filter(x => x.id !== id));
    setExpandedInq(null);
    showToast('문의가 삭제되었습니다.');
  }

  /* ── 본인 문의 수정 (인라인) ── */
  async function updateInquiry(id: string) {
    const text = editInqText.trim();
    if (!text) { showToast('내용을 입력해주세요.'); return; }
    const supabase = createClient();
    const { error } = await supabase.from('product_inquiries').update({ content: text }).eq('id', id);
    if (error) { showToast('수정 실패: ' + error.message); return; }
    setInquiries(prev => prev.map(x => x.id === id ? { ...x, content: text } : x));
    setEditInqId(null);
    showToast('문의가 수정되었습니다.');
  }

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:300 }}>
        <p style={{ color:'#999' }}>불러오는 중...</p>
      </div>
    );
  }
  if (!product) return null;

  const emoji      = EMOJI_MAP[product.category] || EMOJI_MAP.default;
  const bg         = BG_MAP[product.category]    || BG_MAP.default;
  const basePrice  = product.discounted_price    ?? product.price;
  const optGroupNames = [...new Set(options.map(o => o.group_name || '옵션'))];
  /* 종속(2단계) 여부: parent_label이 있으면 종속(분류→옵션), 없으면 독립 다중 그룹 */
  const isCascade = options.some(o => !!(o.parent_label && o.parent_label.trim()));
  const parentGroup = optGroupNames[0];
  const selectedParentLabel = options.find(o => o.id === selByGroup[parentGroup])?.label || '';
  const optsForGroup = (g: string): ProductOption[] => {
    const inGroup = options.filter(o => (o.group_name || '옵션') === g);
    if (!isCascade || g === parentGroup) return inGroup;
    return inGroup.filter(o => !o.parent_label || o.parent_label === selectedParentLabel);
  };
  /* 선택(비필수) 그룹 존재 여부 — 있으면 필수 완료 후 '담기' 버튼으로 확정 */
  const hasOptionalGroup = optGroupNames.some(g => options.find(o => (o.group_name || '옵션') === g)?.is_required === false);
  const commitPick = () => { addPick(getSelectedOpts()); setSelByGroup({}); setOpenOptGroup(null); };
  const picksTotal    = picks.reduce((s, p) => s + (basePrice + p.opts.reduce((a, o) => a + (o.add_price || 0), 0)) * p.qty, 0);
  const totalQty      = options.length > 0 ? picks.reduce((s, p) => s + p.qty, 0) : qty;
  const totalPrice    = options.length > 0 ? picksTotal : basePrice * qty;

  /* 맛 프로파일: 판매자 점수(DB 우선, 없으면 카테고리 기본값) */
  const sellerScore: Record<string, number> =
    (product.seller_score && Object.keys(product.seller_score).length > 0)
      ? product.seller_score
      : defaultSellerScore(product.category);

  /* 구매자 맛 평가 집계 (reviews.taste) → 축별 동의율 */
  const tasteReviews = reviews.filter(r => r.taste && Object.keys(r.taste).length > 0);
  const tasteRevealed = tasteReviews.length >= TASTE_REVEAL_MIN;
  const buyerLevelsOf = (axisKey: string): number[] =>
    tasteReviews.map(r => r.taste?.[axisKey as keyof ReviewTaste]).filter((v): v is number => typeof v === 'number');

  /* 리뷰 필터 + 정렬 + 페이지네이션 */
  const REVIEWS_PER_PAGE = 5;
  const filteredReviews = photoFilterOn
    ? reviews.filter(r => r.image_urls && r.image_urls.length > 0)
    : reviews;
  const sortedReviews = [...filteredReviews].sort((a, b) => {
    if (reviewSort === 'rating')  return b.rating - a.rating;
    if (reviewSort === 'helpful') return (b.likes_count || 0) - (a.likes_count || 0);
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  /* 내가 쓴 리뷰는 정렬과 무관하게 항상 최상단 고정 (안정 정렬) */
  if (user) {
    sortedReviews.sort((a, b) =>
      (a.user_id === user.id ? 0 : 1) - (b.user_id === user.id ? 0 : 1));
  }
  const reviewTotalPages = Math.max(1, Math.ceil(sortedReviews.length / REVIEWS_PER_PAGE));
  const safeReviewPage = Math.min(Math.max(0, reviewPage), reviewTotalPages - 1);
  const pagedReviews = sortedReviews.slice(safeReviewPage * REVIEWS_PER_PAGE, (safeReviewPage + 1) * REVIEWS_PER_PAGE);

  /* 평점 분포 */
  const ratingDist = [
    { label:'최고에요',    star:5 },
    { label:'정말 좋아요', star:4 },
    { label:'괜찮아요',   star:3 },
    { label:'그냥 그래요', star:2 },
    { label:'아쉬워요',   star:1 },
  ].map(({ label, star }) => ({
    label, count: reviews.filter(r => r.rating === star).length,
  }));
  const TABS = [
    '상품설명',
    '상세정보',
    `후기 ${product.review_count > 0 ? product.review_count + '+' : '0'}`,
    `문의 ${inquiries.length > 0 ? inquiries.length : ''}`,
  ];

  // 상품 이미지 6슬롯: 0번 = thumbnail_url, 1~5번 = image_urls[0..4]
  const extraUrls = product.image_urls ?? [];
  const productImages: (string | null)[] = [
    product.thumbnail_url ?? null,
    extraUrls[0] ?? null,
    extraUrls[1] ?? null,
    extraUrls[2] ?? null,
    extraUrls[3] ?? null,
    extraUrls[4] ?? null,
  ];
  /* 메인 이미지 좌우 스와이프 (유효 이미지 슬롯만 순환 이동) */
  const validImgIdx = productImages.map((u, i) => (u ? i : -1)).filter(i => i >= 0);
  function swipeImage(dir: 1 | -1) {
    if (validImgIdx.length < 2) return;
    const pos = validImgIdx.indexOf(selThumb);
    const next = (pos + dir + validImgIdx.length) % validImgIdx.length;
    setSelThumb(validImgIdx[next]);
  }
  function onImgTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX; }
  function onImgTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 40) return;
    swipeImage(dx < 0 ? 1 : -1); // 왼쪽으로 밀면 다음, 오른쪽이면 이전
  }

  /* 모바일 상단 신뢰 pill: 만족도·재구매율·구매자수 중 가장 좋은(인상적인) 값 1개 */
  const bestStat: { text: string } | null = (() => {
    // 어드민에서 끈 상품은 pill 숨김
    if ((product as { show_stat_pill?: boolean }).show_stat_pill === false) return null;
    const satRate = product.review_count > 0
      ? Math.round(reviews.filter(r => r.rating >= 4).length / product.review_count * 100) : 0;
    const cands: { score: number; text: string }[] = [];
    // 만족도·재구매율(둘 다 %)은 충분한 표본일 때만 후보로
    if (product.review_count >= TASTE_REVEAL_MIN && satRate > 0)
      cands.push({ score: satRate, text: `구매 고객 ${satRate}%가 만족했어요` });
    if (buyerStats.buyers >= 5 && buyerStats.repurchase > 0)
      cands.push({ score: buyerStats.repurchase, text: `구매 고객 ${buyerStats.repurchase}%가 재구매했어요` });
    if (cands.length) return cands.sort((a, b) => b.score - a.score)[0]; // 더 좋은 값 우선
    // %지표 표본 부족 시 구매자수로 폴백
    if (buyerStats.buyers > 0) return { text: `지금까지 ${buyerStats.buyers.toLocaleString()}명이 구매했어요` };
    return null;
  })();

  /* 포토리뷰 수 (실제 이미지 있는 리뷰) */
  const photoReviewCount = reviews.filter(r => r.image_urls && r.image_urls.length > 0).length;
  const photoColors = [bg, '#E8F0E8', '#FFF3E0', '#F0E8FF', '#E8F4FF', '#FFE8E8', '#F0F8E8', bg];

  /* 포토/영상 갤러리 아이템 */
  type GalleryItem = {
    url: string | null;          // 이미지 URL (영상이면 null)
    videoUrl: string | null;     // 영상 URL (이미지면 null)
    isVideo: boolean;
    color: string;
    review: Review | null;
    photoIdx: number;
    siblingUrls: (string | null)[];  // 같은 리뷰 이미지들
    siblingVideoUrl: string | null;  // 같은 리뷰 영상
  };
  const allPhotoItems: GalleryItem[] = (() => {
    const fromReviews: GalleryItem[] = [];
    for (const r of reviews) {
      const imgs = r.image_urls ?? [];
      const vid  = r.video_url ?? null;
      if (imgs.length === 0 && !vid) continue;
      const siblingUrls = imgs as (string | null)[];
      imgs.forEach((url, photoIdx) => {
        fromReviews.push({
          url, videoUrl: null, isVideo: false,
          color: photoColors[photoIdx % photoColors.length],
          review: r, photoIdx, siblingUrls, siblingVideoUrl: vid,
        });
      });
      if (vid) {
        fromReviews.push({
          url: null, videoUrl: vid, isVideo: true,
          color: photoColors[fromReviews.length % photoColors.length],
          review: r, photoIdx: imgs.length, siblingUrls, siblingVideoUrl: vid,
        });
      }
    }
    if (fromReviews.length > 0) return fromReviews;
    /* 더미 */
    return Array.from({ length: photoReviewCount }, (_, i) => ({
      url: null, videoUrl: null, isVideo: false,
      color: photoColors[i % photoColors.length],
      review: null, photoIdx: 0, siblingUrls: [null], siblingVideoUrl: null,
    }));
  })();

  return (
    <>
      {/* ══ 포토 후기 갤러리 모달 ══ */}
      {photoGalleryOpen && (() => {
        const closeAll = () => { setPhotoGalleryOpen(false); setSelectedGalleryIdx(null); };
        const selItem  = selectedGalleryIdx !== null ? allPhotoItems[selectedGalleryIdx] : null;

        /* 사진 선택됨 → 공통 ReviewPhotoModal (리뷰 단위 넘기기 + 사진 넘기기) */
        if (selItem && selItem.review) {
          const rv = selItem.review;
          const reviewReps = allPhotoItems.filter(p => p.photoIdx === 0);
          const curRevIdx = reviewReps.findIndex(p => p.review?.id === rv.id);
          const goRev = (ri: number) => {
            const rep = reviewReps[ri];
            setSelectedGalleryIdx(allPhotoItems.findIndex(p => p.review?.id === rep.review?.id && p.photoIdx === 0));
          };
          const author = rv.author_name ? `${rv.author_name.charAt(0)}**` : rv.profiles?.name ? `${rv.profiles.name.charAt(0)}**` : '익명';
          return (
            <ReviewPhotoModal
              review={{ id: rv.id, images: selItem.siblingUrls.filter(Boolean) as string[], videoUrl: rv.video_url, rating: rv.rating, content: rv.content, authorName: author, isBest: rv.is_best, createdAt: rv.created_at, likesCount: rv.likes_count || 0 }}
              product={{ id: product.id, name: product.name, thumbnail: product.thumbnail_url, discountRate: product.discount_rate, price: product.price, discountedPrice: product.discounted_price, avgRating: product.avg_rating, reviewCount: product.review_count }}
              onClose={() => { if (galleryFromReview) closeAll(); else setSelectedGalleryIdx(null); }}
              onPrev={curRevIdx > 0 ? () => goRev(curRevIdx - 1) : undefined}
              onNext={curRevIdx >= 0 && curRevIdx < reviewReps.length - 1 ? () => goRev(curRevIdx + 1) : undefined}
              pos={reviewReps.length > 1 && curRevIdx >= 0 ? `${curRevIdx + 1} / ${reviewReps.length}` : undefined}
              breakpoint={500}
              onBuy={() => { closeAll(); openOptionDrawer(product.id); }}
              onWish={toggleWishlist}
              wished={wishlisted}
            />
          );
        }

        return (
          <div onClick={closeAll} style={{
            position: 'fixed', inset: 0, zIndex: 3500,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: isMobile ? 0 : 16,
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              background: '#fff', borderRadius: isMobile ? 0 : 12,
              width: '100%', maxWidth: isMobile ? '100%' : 880,
              height: isMobile ? '100%' : '88vh',
              boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}>

              {/* ── 공통 헤더 ── */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', borderBottom: '1px solid #EBEBEB', flexShrink: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {selItem && (
                    <button onClick={() => { if (galleryFromReview) closeAll(); else setSelectedGalleryIdx(null); }} aria-label="뒤로가기" style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      display: 'flex', alignItems: 'center', color: '#1A1A1A', lineHeight: 0,
                    }}>
                      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    </button>
                  )}
                  <span style={{ fontSize: 16, fontWeight: 700 }}>
                    {selItem ? '사진 후기' : '사진 후기 전체보기'}
                  </span>
                </div>
                <button onClick={closeAll} aria-label="닫기" style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 22, color: '#888', lineHeight: 1, padding: '0 4px',
                }}>✕</button>
              </div>

              {selItem ? (
                /* ────── 상세 뷰 ────── */
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                  {/* 본문: 모바일=세로 스크롤 / PC=좌우 분할 */}
                  <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: isMobile ? 'column' : 'row', overflowY: isMobile ? 'auto' : 'hidden' }}>

                    {/* ── 큰 사진 + 썸네일 ── */}
                    <div style={{ width: isMobile ? '100%' : '50%', flexShrink: 0, display: 'flex', flexDirection: 'column', ...(isMobile ? {} : { overflowY: 'auto', borderRight: '1px solid #EEE' }) }}>
                      {/* 큰 사진 (정사각 — 사진 크기 통일) */}
                      <div style={{
                        position: 'relative', width: '100%', aspectRatio: '1', background: '#F4F4F2',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden',
                      }}>
                        {selItem.isVideo && selItem.videoUrl ? (
                          <video src={selItem.videoUrl} controls
                            style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }} />
                        ) : selItem.url ? (
                          <img src={imgThumb(selItem.url, 800)} alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{
                            width: '100%', height: '100%',
                            background: `linear-gradient(135deg,${selItem.color},#fff)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 72,
                          }}>{emoji}</div>
                        )}
                        {/* 이전 */}
                        {selectedGalleryIdx! > 0 && (
                          <button onClick={() => setSelectedGalleryIdx(i => i! - 1)} aria-label="이전 사진" style={{
                            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                            width: 34, height: 34, borderRadius: '50%',
                            background: 'rgba(0,0,0,0.55)', border: 'none', cursor: 'pointer', padding: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                          }}>
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                          </button>
                        )}
                        {/* 다음 */}
                        {selectedGalleryIdx! < allPhotoItems.length - 1 && (
                          <button onClick={() => setSelectedGalleryIdx(i => i! + 1)} aria-label="다음 사진" style={{
                            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                            width: 34, height: 34, borderRadius: '50%',
                            background: 'rgba(0,0,0,0.55)', border: 'none', cursor: 'pointer', padding: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                          }}>
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                          </button>
                        )}
                      </div>

                      {/* 썸네일 스트립 (이 리뷰의 다른 사진들) */}
                      <div style={{
                        flexShrink: 0, padding: '8px 10px',
                        display: 'flex', gap: 6, overflowX: 'auto',
                        borderTop: '1px solid #EBEBEB', minHeight: 68,
                        alignItems: 'center',
                      }}>
                        {selItem.siblingUrls.map((thumbUrl, ti) => {
                          const gIdx = allPhotoItems.findIndex(
                            p => p.review?.id === selItem.review?.id && p.photoIdx === ti
                          );
                          const isActive = selItem.photoIdx === ti;
                          return (
                            <div key={ti}
                              onClick={() => gIdx >= 0 && setSelectedGalleryIdx(gIdx)}
                              style={{
                                width: 50, height: 50, flexShrink: 0, borderRadius: 6,
                                overflow: 'hidden', cursor: 'pointer',
                                outline: isActive ? '2px solid #1A1A1A' : '2px solid transparent',
                                outlineOffset: 1,
                                background: thumbUrl ? '#EEE' : `linear-gradient(135deg,${selItem.color},#fff)`,
                              }}>
                              {thumbUrl
                                ? <img src={imgThumb(thumbUrl, 120)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{emoji}</div>
                              }
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* ── 리뷰 정보 ── */}
                    <div style={{ minWidth: 0, ...(isMobile ? {} : { flex: 1, overflowY: 'auto' }) }}>
                      {selItem.review ? (
                        <>
                          {/* ① 상단 배지 행: BEST | 이름 | 평점텍스트 */}
                          <div style={{
                            flexShrink: 0, padding: '14px 16px 10px',
                            display: 'flex', alignItems: 'center', gap: 8,
                            borderBottom: '1px solid #F0F0F0',
                          }}>
                            {selItem.review.is_best && (
                              <span style={{
                                fontSize: 11, fontWeight: 700, padding: '4px 10px',
                                background: '#1A1A1A', color: '#fff', borderRadius: 4,
                                flexShrink: 0,
                              }}>BEST</span>
                            )}
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#222', flexShrink: 0 }}>
                              {selItem.review.author_name
                                ? `${selItem.review.author_name.charAt(0)}**`
                                : selItem.review.profiles?.name
                                ? `${selItem.review.profiles.name.charAt(0)}**`
                                : '익명'}
                            </span>
                            <span style={{ fontSize: 13, color: '#888', flexShrink: 0 }}>
                              {['', '아쉬워요', '그냥 그래요', '괜찮아요', '정말 좋아요', '최고에요'][selItem.review.rating]}
                            </span>
                          </div>

                          {/* ② 구매 상품명 */}
                          <div style={{
                            flexShrink: 0, padding: '10px 16px',
                            borderBottom: '1px solid #F0F0F0',
                            fontSize: 12, color: '#888',
                          }}>
                            구매상품 : <span style={{ color: '#444', fontWeight: 600 }}>{product.name}</span>
                          </div>

                          {/* ③ 리뷰 내용 */}
                          <div style={{ padding: '14px 16px' }}>
                            <p style={{
                              fontSize: 13, color: '#333', lineHeight: 1.85,
                              whiteSpace: 'pre-wrap', margin: 0,
                            }}>{selItem.review.content}</p>
                          </div>

                          {/* ④ 날짜 + 도움돼요 */}
                          <div style={{
                            flexShrink: 0, padding: '10px 16px',
                            borderTop: '1px solid #F0F0F0',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          }}>
                            <span style={{
                              fontSize: 12, color: '#AAA',
                              padding: '5px 10px', border: '1px solid #EBEBEB',
                              borderRadius: 4,
                            }}>
                              {new Date(selItem.review.created_at).toLocaleDateString('ko-KR')}
                            </span>
                            <button onClick={() => toggleReviewLike(selItem.review!.id, selItem.review!.likes_count || 0)} style={{
                              display: 'flex', alignItems: 'center', gap: 5,
                              background: likedReviews.has(selItem.review!.id) ? '#FFF5F5' : '#fff',
                              border: `1px solid ${likedReviews.has(selItem.review!.id) ? '#E53935' : '#D8D8D8'}`,
                              borderRadius: 99, padding: '6px 14px',
                              fontSize: 12, color: likedReviews.has(selItem.review!.id) ? '#E53935' : '#555', cursor: 'pointer', fontWeight: 600,
                            }}>
                              {likedReviews.has(selItem.review!.id) ? '♥' : '👍'} 도움돼요 {selItem.review.likes_count || 0}
                            </button>
                          </div>
                        </>
                      ) : (
                        <div style={{ color: '#BBB', fontSize: 13, textAlign: 'center', padding: '40px 20px' }}>
                          리뷰 정보 없음
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── 하단 구매하기 CTA (상품 상세 하단바와 동일) ── */}
                  <div style={{
                    flexShrink: 0, display: 'flex', gap: 8,
                    padding: '10px 16px', borderTop: '1px solid #EBEBEB', background: '#fff',
                  }}>
                    <button onClick={toggleWishlist} aria-label="찜하기" style={{
                      flexShrink: 0, width: 46, border: '1.5px solid #DDDDD9', background: '#fff',
                      borderRadius: 8, cursor: 'pointer', color: wishlisted ? '#E53935' : '#1A1A1A',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Heart size={20} strokeWidth={1.8} fill={wishlisted ? '#E53935' : 'none'} />
                    </button>
                    <button onClick={() => { closeAll(); openOptionDrawer(product.id); }} style={{
                      flex: 1, height: 48, border: 'none', borderRadius: 8,
                      background: '#1A1A1A', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                    }}>
                      구매하기
                    </button>
                  </div>
                </div>

              ) : (
                /* ────── 그리드 뷰 ────── */
                <div style={{ overflowY: 'auto', padding: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isMobile ? 3 : 6}, 1fr)`, gap: 4 }}>
                    {allPhotoItems.map((item, i) => (
                      <div key={i}
                        onClick={() => setSelectedGalleryIdx(i)}
                        style={{
                          position: 'relative', aspectRatio: '1',
                          borderRadius: 4, overflow: 'hidden', cursor: 'pointer',
                          background: item.url ? '#F0F0F0' : `linear-gradient(135deg,${item.color},#fff)`,
                        }}>
                        {item.isVideo && item.videoUrl ? (
                          <>
                            <video src={item.videoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.28)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ fontSize: 22, color: '#fff', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }}>▶</span>
                            </div>
                          </>
                        ) : item.url ? (
                          <img src={imgThumb(item.url, 250)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(14px,3vw,24px)' }}>{emoji}</div>
                        )}
                        {item.photoIdx === 0 && item.siblingUrls.length > 1 && (
                          <span style={{
                            position: 'absolute', bottom: 5, right: 5,
                            background: 'rgba(0,0,0,0.55)', color: '#fff',
                            fontSize: 11, fontWeight: 700, borderRadius: 4,
                            padding: '1px 5px', lineHeight: 1.5,
                          }}>{item.siblingUrls.length}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  {allPhotoItems.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '60px 0', color: '#BBB', fontSize: 14 }}>
                      포토 리뷰가 없습니다
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        );
      })()}

      {/* ══ 상단: 이미지 + 정보 ══ */}
      <div className="pd-above">
        <div className="container">
          <div className="pd-layout">

            {/* ────────────────── pd-left ────────────────── */}
            <div className="pd-left">

              {/* 메인 이미지 */}
              <div className="img-main"
                onTouchStart={onImgTouchStart} onTouchEnd={onImgTouchEnd}
                style={{ background:`linear-gradient(135deg,${bg} 0%,#fff 65%)` }}>
                {productImages[selThumb]
                  ? <img src={imgThumb(productImages[selThumb]!, 800)} alt={product.name}
                      style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:16 }} />
                  : <span>{emoji}</span>
                }
                <div className="trust-overlay">
                  {farm            && <span className="trust-pill">🌿 산지직송</span>}
                  {product.is_dawn && <span className="trust-pill">🌙 새벽배송</span>}
                  {product.is_best && <span className="trust-pill">⭐ 베스트</span>}
                </div>
                {/* 이미지 카운터 (현재 | 전체) */}
                {validImgIdx.length >= 1 && (
                  <div style={{ position:'absolute', right:12, bottom:12, zIndex:2,
                    background:'rgba(60,60,60,0.5)', fontSize:14, fontWeight:500,
                    padding:'4px 13px', borderRadius:20, letterSpacing:'0.5px',
                    fontVariantNumeric:'tabular-nums',
                    backdropFilter:'blur(3px)', WebkitBackdropFilter:'blur(3px)' }}>
                    <span style={{ color:'#fff' }}>{String(Math.max(0, validImgIdx.indexOf(selThumb)) + 1).padStart(2, '0')}</span>
                    <span style={{ color:'rgba(255,255,255,0.5)', margin:'0 6px' }}>|</span>
                    <span style={{ color:'rgba(255,255,255,0.65)' }}>{String(validImgIdx.length).padStart(2, '0')}</span>
                  </div>
                )}
                {/* PC: 이미지 위 오버레이 pill (모바일은 하단 플로팅) */}
                {bestStat && (
                  <div className="pd-beststat-pc">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                    </svg>
                    <span>{bestStat.text}</span>
                  </div>
                )}
              </div>

              {/* 썸네일 행: 추가 사진(image_urls)이 있을 때만 노출 */}
              {extraUrls.some(Boolean) && (
                <div className="thumb-row">
                  {productImages.map((imgUrl, i) => (
                    <div key={i}
                      className={`thumb${selThumb === i ? ' active' : ''}`}
                      onClick={() => { if (imgUrl) setSelThumb(i); }}
                      style={{
                        background: '#fff',
                        cursor: imgUrl ? 'pointer' : 'default',
                        opacity: 1,
                      }}>
                      {imgUrl
                        ? <img src={imgThumb(imgUrl, 300)} alt=""
                            style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:4 }} />
                        : null}
                    </div>
                  ))}
                </div>
              )}

              {/* 농가 카드 (파트너 농가) */}
              {farm && (
                <div className="brand-section">
                  <div className="brand-section-title">파트너 농가</div>
                  <Link href={`/farm/${farm.slug}`} className="brand-card">
                    <div className="brand-card-logo">
                      {farm.thumbnail_url
                        ? <img src={imgThumb(farm.thumbnail_url, 250)} alt={farm.name} />
                        : emoji}
                    </div>
                    <div className="brand-card-body">
                      <div className="brand-card-name">
                        {farm.name}
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      </div>
                      <div className="brand-card-sub">{farm.region} · {farm.farm_type}</div>
                      {farm.intro && <div className="brand-card-desc">{farm.intro}</div>}
                    </div>
                    <div className="brand-card-wish">
                      <button className="brand-card-wish-btn"
                        onClick={e => { e.preventDefault(); e.stopPropagation(); toggleFarmWish(); }}
                        aria-label="농가 찜">
                        <svg viewBox="0 0 24 24" width="22" height="22"
                          fill={farmWished ? '#E55A4B' : 'none'}
                          stroke={farmWished ? '#E55A4B' : '#B5B5B5'} strokeWidth="1.8"
                          strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                      </button>
                      <span className="brand-card-wish-count">{farmWishCount.toLocaleString()}</span>
                    </div>
                  </Link>
                </div>
              )}
            </div>

            {/* ────────────────── pd-right ────────────────── */}
            <div className="pd-right">

              {/* 브레드크럼 */}
              <h1 className="product-name">{product.name}</h1>

              {/* 메타: 배송타입 → badge → 별점 */}
              <div className="product-meta">
                <span style={{ fontSize:13, fontWeight:700, padding:'3px 9px', borderRadius:6,
                  background: product.is_dawn ? '#FFF9E0' : '#FFF0EE',
                  color:      product.is_dawn ? '#7A5C2E' : '#CB1D11' }}>
                  {product.is_dawn ? '산지직송' : '자사배송'}
                </span>
                {product.badge && (
                  <span style={{ fontSize:13, fontWeight:700, padding:'3px 9px', borderRadius:6,
                    background: product.badge_color || 'var(--color-bg)',
                    color: product.badge_color ? '#fff' : 'var(--color-ink-soft)' }}>
                    {product.badge}
                  </span>
                )}
                {product.avg_rating > 0 && (
                  <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:4 }}>
                    <SingleStar size={13} />
                    <button type="button" onClick={goReviewTab}
                      style={{ fontSize:12, color:'var(--color-ink-mute)',
                        background:'none', border:'none', cursor:'pointer', padding:0 }}>
                      {product.avg_rating.toFixed(1)} ({product.review_count.toLocaleString()})
                    </button>
                  </div>
                )}
              </div>

              {/* 가격 */}
              <div className="price-block">
                <div className="price-line" style={{ marginBottom:4, alignItems:'center' }}>
                  {product.discount_rate > 0 && (
                    <span className="price-discount-rate">{Math.round(product.discount_rate)}%</span>
                  )}
                  <span className="price-discount-val">
                    {fmtPrice(basePrice)}<span className="price-won-suffix">원</span>
                  </span>
                  {product.discount_rate > 0 && (
                    <span style={{ fontSize:14, color:'var(--color-ink-mute)', textDecoration:'line-through', marginLeft:4 }}>
                      {fmtPrice(product.price)}원
                    </span>
                  )}
                </div>
                {/* 쿠폰 최대혜택가 — 실제 보유 쿠폰 기반 */}
                {bestCoupon === 'loading' ? null
                : bestCoupon ? (
                  <div className="price-line" style={{ alignItems:'center' }}>
                    <span className="price-coupon-rate">{bestCoupon.totalRate}%</span>
                    <span className="price-coupon-val">
                      {fmtPrice(bestCoupon.finalPrice)}<span className="price-won-suffix">원</span>
                    </span>
                    {bestCoupon.held
                      ? <span className="price-coupon-tag">쿠폰 적용 최대할인가</span>
                      : <button type="button" onClick={openCouponDownload}
                          style={{ border:'none', background:'#1A1A1A', color:'#fff', fontSize:11.5, fontWeight:700, padding:'4px 11px', borderRadius:999, cursor:'pointer', fontFamily:'inherit', display:'inline-flex', alignItems:'center', gap:4 }}>
                          🎟️ 쿠폰 다운받기
                        </button>}
                  </div>
                ) : (!user && signupBest) ? (
                  /* 비로그인/비회원: 신규가입 웰컴 쿠폰 중 이 상품에 적용 가능한 최대할인가 (최소주문금액 미달이면 미표시) */
                  <div className="price-line" style={{ alignItems:'center' }}>
                    <span className="price-coupon-rate">{signupBest.totalRate}%</span>
                    <span className="price-coupon-val">
                      {fmtPrice(signupBest.finalPrice)}<span className="price-won-suffix">원</span>
                    </span>
                    {signupBest.fromSignup
                      ? <span className="price-coupon-tag">신규가입 시 최대할인가</span>
                      : <button type="button" onClick={openCouponDownload}
                          style={{ border:'none', background:'#1A1A1A', color:'#fff', fontSize:11.5, fontWeight:700, padding:'4px 11px', borderRadius:999, cursor:'pointer', fontFamily:'inherit', display:'inline-flex', alignItems:'center', gap:4 }}>
                          🎟️ 쿠폰 다운받기
                        </button>}
                  </div>
                ) : null}
              </div>

              {/* 회원가입 쿠폰 배너 — 비로그인 시만 표시 */}
              {!user && (
                <Link href="/login" className="signup-coupon-banner">
                  <div className="signup-coupon-banner-left">
                    <span className="signup-coupon-icon">🎁</span>
                    <span className="signup-coupon-text">
                      회원가입하고 <span>{fmtPrice(signupCoupon)}원 쿠폰</span> 받기
                    </span>
                  </div>
                  <span className="signup-coupon-arrow">›</span>
                </Link>
              )}

              {/* 가격 ↔ 배송정보 구분선 (모바일은 화면 끝까지) */}
              <div className="pd-price-divider" />

              {/* 배송 정보 테이블 */}
              <table className="pd-info-table">
                <tbody>
                  <tr>
                    <th>배송방법</th>
                    <td>{product.is_dawn ? '산지직송' : '자사배송'}</td>
                  </tr>
                  <tr>
                    <th>배송비</th>
                    <td>무료</td>
                  </tr>
                  <tr>
                    <th>포인트</th>
                    <td style={{ color:'#1A1A1A', fontWeight:700 }}>
                      {pointRate}% ({fmtPrice(Math.round(basePrice * pointRate / 100))}원)
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* 옵션 & 수량 & 출발안내 & 총금액 & CTA */}
              <div className="option-section">
                {/* 모바일: 옵션/수량·총금액·결제는 하단 CTA → 슬라이드업 드로어로 처리 (여기선 숨김) */}
                <div className="pd-mob-hide">
                {options.length > 0 && (
                  <>
                    {/* ── 그룹별 옵션 드롭다운 (덧셈식) ── */}
                    {optGroupNames.map((g, gIdx) => {
                      const gReq = options.find(o => (o.group_name || '옵션') === g)?.is_required !== false;
                      const groupOpts = optsForGroup(g);
                      // 종속(2단계) 하위인데 상위 미선택이면 잠금 (독립 그룹은 잠금 없음)
                      const locked = isCascade && gIdx > 0 && !selectedParentLabel;
                      return (
                      <div key={g}>
                        <div className="option-label">{g === '옵션' ? '옵션 선택' : g}{gReq ? '' : ' (선택)'}</div>
                        {(() => {
                          const selOpt = groupOpts.find(o => o.id === selByGroup[g]);
                          const open = openOptGroup === g;
                          const choose = (val: string) => {
                            const next = { ...selByGroup, [g]: val };
                            // 종속: 상위를 바꾸면 하위 선택 초기화
                            if (isCascade && g === parentGroup) optGroupNames.slice(1).forEach(sub => { delete next[sub]; });
                            if (!hasOptionalGroup) {
                              // 필수 그룹만 있는 상품: 필수 다 차면 자동 담기
                              if (allGroupsSelected(next)) { addPick(getSelectedOpts(next)); setSelByGroup({}); }
                              else setSelByGroup(next);
                              setOpenOptGroup(null);
                              return;
                            }
                            // 선택옵션 있는 상품: 자동 담기 X. 필수 완료 시 미선택(선택옵션) 드롭다운 자동 오픈
                            setSelByGroup(next);
                            const unselected = optGroupNames.find(gn => !next[gn]);
                            setOpenOptGroup(allGroupsSelected(next) && unselected ? unselected : null);
                          };
                          return (
                            <div className="opt-dd">
                              <button type="button" className={`opt-dd-btn${open ? ' open' : ''}`} disabled={locked}
                                onClick={() => setOpenOptGroup(open ? null : g)}>
                                <span className={selOpt ? '' : 'ph'}>
                                  {locked ? '상위 옵션을 먼저 선택'
                                    : selOpt ? `${selOpt.label}${selOpt.add_price > 0 ? ` (+${fmtPrice(selOpt.add_price)}원)` : ''}`
                                    : `${gReq ? '[필수]' : '[선택]'} 옵션 선택`}
                                </span>
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                              </button>
                              {open && !locked && (
                                <>
                                  <div className="opt-dd-backdrop" onClick={() => setOpenOptGroup(null)} />
                                  <div className="opt-dd-list">
                                    {groupOpts.map(o => {
                                      // 분류(상위 품종)는 재고 개념 없음 → 하위 옵션만 품절 판정
                                      const soldout = !(isCascade && g === parentGroup) && o.stock === 0;
                                      return (
                                        <button type="button" key={o.id} disabled={soldout}
                                          className={`opt-dd-item${selByGroup[g] === o.id ? ' sel' : ''}`}
                                          style={soldout ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
                                          onClick={() => { if (!soldout) choose(o.id); }}>
                                          {o.label}{o.add_price > 0 ? ` (+${fmtPrice(o.add_price)}원)` : ''}{soldout ? ' (품절)' : ''}
                                        </button>
                                      );
                                    })}
                                    {groupOpts.length === 0 && <div className="opt-dd-empty">선택 가능한 옵션이 없습니다</div>}
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                      );
                    })}

                    {/* 선택옵션 있는 상품: 필수 완료 시 '담기' 버튼 (선택옵션 고르거나 건너뛰고 확정) */}
                    {hasOptionalGroup && allGroupsSelected() && (
                      <button type="button" onClick={commitPick}
                        style={{ width:'100%', padding:'11px', marginBottom:8, borderRadius:8,
                          border:'1.5px solid #1A1A1A', background:'#1A1A1A', color:'#fff',
                          fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                        이 옵션 담기
                      </button>
                    )}

                    {/* ── 선택된 옵션 목록 (누적) ── */}
                    {picks.length > 0 && (
                      <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:4 }}>
                        {picks.map((p, idx) => {
                          const addP = p.opts.reduce((s, o) => s + (o.add_price || 0), 0);
                          const unit = basePrice + addP;
                          return (
                            <div key={p.key} style={{ border:'1px solid #DDDDD9', borderRadius:8, padding:'14px 16px', background:'#FAFAF8' }}>
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                                <span style={{ fontSize:13, fontWeight:600, color:'var(--color-ink)', flex:1, lineHeight:1.45 }}>
                                  {p.opts.map(o => o.label).join(' / ') || product.name}
                                  {addP > 0 && (
                                    <span style={{ fontSize:12, color:'#1A1A1A', marginLeft:6, fontWeight:700 }}>+{fmtPrice(addP)}원</span>
                                  )}
                                </span>
                                <button onClick={() => setPicks(prev => prev.filter((_, i) => i !== idx))}
                                  style={{ background:'none', border:'none', cursor:'pointer', fontSize:15, color:'#AAAAAA', padding:'0 0 0 10px', lineHeight:1, flexShrink:0 }}>✕</button>
                              </div>
                              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                                <div style={{ display:'inline-flex', alignItems:'center', border:'1.5px solid #DDDDD9', borderRadius:6, overflow:'hidden', background:'#fff' }}>
                                  <button onClick={() => setPicks(prev => prev.map((x, i) => i === idx ? { ...x, qty: Math.max(1, x.qty - 1) } : x))}
                                    style={{ width:32, height:32, border:'none', borderRight:'1px solid #DDDDD9', background:'transparent', cursor:'pointer', fontSize:16, color:'var(--color-ink)', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>−</button>
                                  <span style={{ minWidth:36, textAlign:'center', fontSize:14, fontWeight:700, padding:'0 4px', lineHeight:'32px', display:'inline-block', color:'var(--color-ink)' }}>{p.qty}</span>
                                  <button onClick={() => setPicks(prev => prev.map((x, i) => i === idx ? { ...x, qty: x.qty + 1 } : x))}
                                    style={{ width:32, height:32, border:'none', borderLeft:'1px solid #DDDDD9', background:'transparent', cursor:'pointer', fontSize:16, color:'var(--color-ink)', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>+</button>
                                </div>
                                <span style={{ fontSize:16, fontWeight:800, color:'#1A1A1A' }}>{fmtPrice(unit * p.qty)}원</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

                {/* 옵션 없는 상품: 수량 직접 조절 */}
                {options.length === 0 && (
                  <>
                    <div className="option-label">수량</div>
                    <div style={{ display:'inline-flex', alignItems:'center',
                      border:'1.5px solid #DDDDD9', borderRadius:6,
                      overflow:'hidden', marginBottom:16, background:'#fff' }}>
                      <button onClick={() => setQty(q => Math.max(1, q - 1))}
                        style={{ width:36, height:36, border:'none',
                          borderRight:'1px solid #DDDDD9', background:'transparent',
                          cursor:'pointer', fontSize:18, color:'var(--color-ink)',
                          display:'flex', alignItems:'center', justifyContent:'center' }}>
                        −
                      </button>
                      <span style={{ minWidth:44, textAlign:'center', fontSize:15,
                        fontWeight:700, padding:'0 8px',
                        lineHeight:'36px', display:'inline-block' }}>
                        {qty}
                      </span>
                      <button onClick={() => setQty(q => q + 1)}
                        style={{ width:36, height:36, border:'none',
                          borderLeft:'1px solid #DDDDD9', background:'transparent',
                          cursor:'pointer', fontSize:18, color:'var(--color-ink)',
                          display:'flex', alignItems:'center', justifyContent:'center' }}>
                        +
                      </button>
                    </div>
                  </>
                )}
                </div>{/* /pd-mob-hide (옵션·수량) */}

                {/* 출발 안내 — 상품별 설정 우선, 없으면 전체 설정, 둘 다 없으면 숨김 */}
                {(product.dispatch_cutoff || siteDispatchCutoff) && (
                  <div className="pd-dispatch-notice">
                    <svg viewBox="0 0 24 24" width="18" height="18"
                      fill="none" stroke="currentColor" strokeWidth="1.8">
                      <rect x="1" y="3" width="15" height="13" rx="1"/>
                      <path d="M16 8h4l3 5v4h-7V8z"/>
                      <circle cx="5.5" cy="18.5" r="2.5"/>
                      <circle cx="18.5" cy="18.5" r="2.5"/>
                    </svg>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600 }}>
                        오늘 출발 {product.dispatch_cutoff || siteDispatchCutoff} 마감
                      </div>
                      <div style={{ fontSize:12, color:'var(--color-ink-mute)' }}>
                        지금 주문 시 내일 발송됩니다
                      </div>
                    </div>
                  </div>
                )}

                <div className="pd-mob-hide">
                {/* 총 상품금액 */}
                <div className="total-row">
                  <span style={{ fontSize:14, color:'var(--color-ink-soft)' }}>총 상품금액</span>
                  <span>
                    <span style={{ fontSize:13, color:'var(--color-ink-mute)', marginRight:6 }}>
                      {totalQty}개
                    </span>
                    <span style={{ fontSize:22, fontWeight:700, color:'#1A1A1A' }}>
                      {fmtPrice(totalPrice)}원
                    </span>
                  </span>
                </div>

                {/* PC CTA */}
                <div className="cta-bar-pc" style={{ alignItems:'stretch' }}>
                  <button onClick={() => showToast('선물하기 기능은 준비 중입니다.')}
                    style={{ flexShrink:0, width:50, border:'1.5px solid #DDDDD9',
                      background:'#fff', borderRadius:8, cursor:'pointer', color:'var(--color-accent)',
                      display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                      <polyline points="20 12 20 22 4 22 4 12"/>
                      <rect x="2" y="7" width="20" height="5"/>
                      <line x1="12" y1="22" x2="12" y2="7"/>
                      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 3 12 7 12 7z"/>
                      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 3 12 7 12 7z"/>
                    </svg>
                  </button>
                  <button className="btn btn-secondary btn-flex-1" onClick={handleAddCart}>
                    장바구니
                  </button>
                  <button className="btn btn-primary btn-flex-2" onClick={handleBuyNow}>
                    바로 구매
                  </button>
                </div>

                {/* ✅ 네이버페이 */}
                <div style={{ marginTop:16, paddingTop:14 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:11, fontWeight:800, color:'#03C75A',
                        letterSpacing:'0.04em', marginBottom:2 }}>NAVER</div>
                      <div style={{ fontSize:11, color:'#555', lineHeight:1.5 }}>
                        네이버ID로 간편구매<br/>네이버페이
                      </div>
                    </div>
                    <button onClick={() => showToast('네이버페이 연동은 준비 중입니다.')}
                      style={{ display:'flex', alignItems:'center', gap:7,
                        background:'#03C75A', color:'#fff', border:'none',
                        borderRadius:6, padding:'13px 22px', fontSize:15, fontWeight:700,
                        cursor:'pointer', whiteSpace:'nowrap' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="12" fill="#fff"/>
                        <text x="12" y="17" textAnchor="middle" fontSize="13"
                          fontWeight="900" fill="#03C75A" fontFamily="Arial,sans-serif">N</text>
                      </svg>
                      pay 구매
                    </button>
                  </div>
                  <div style={{ marginTop:8, display:'flex', alignItems:'center',
                    justifyContent:'space-between', fontSize:11, color:'#03C75A' }}>
                    <span>
                      <b>이벤트</b>{' '}
                      <span style={{ color:'#555' }}>결제 최대혜택 10% 추가…</span>
                    </span>
                    <span style={{ display:'flex', gap:2 }}>
                      <button style={{ background:'none', border:'1px solid #DDD', borderRadius:3,
                        width:18, height:18, fontSize:10, cursor:'pointer', color:'#888', padding:0 }}>‹</button>
                      <button style={{ background:'none', border:'1px solid #DDD', borderRadius:3,
                        width:18, height:18, fontSize:10, cursor:'pointer', color:'#888', padding:0 }}>›</button>
                    </span>
                  </div>
                </div>
                </div>{/* /pd-mob-hide (총금액·결제) */}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ 맛 프로파일 (상단 지표 + 구매자 동의율 5축) ══ */}
      <div className="taste-profile-vs">
        <div className="container">
          <div className="taste-profile-card">

            {/* ── 상단 요약: 평점 | 만족도·재구매율·구매자수 (리뷰 5개 이상에서만 지표 공개) ── */}
            {(() => {
              const satisfiedPct = product.review_count > 0
                ? Math.round(reviews.filter(r => r.rating >= 4).length / product.review_count * 100) : 0;
              const statsRevealed = product.review_count >= TASTE_REVEAL_MIN;
              return (
                <div className="tp-summary">
                  <div className="tp-summary-rating">
                    <div className="tp-summary-star"><SingleStar size={20} /><b>{product.avg_rating.toFixed(1)}</b></div>
                    <span className="tp-summary-rcount">리뷰 {product.review_count.toLocaleString()}개</span>
                  </div>
                  {statsRevealed ? (
                    <div className="tp-summary-metrics">
                      <div className="tp-metric">
                        <span className="tp-metric-label">만족도</span>
                        <div className="tp-metric-track"><div className="tp-metric-fill" style={{ width:`${satisfiedPct}%`, background:'#1A1A1A' }} /></div>
                        <span className="tp-metric-val">{satisfiedPct}%</span>
                      </div>
                      <div className="tp-metric">
                        <span className="tp-metric-label">재구매율</span>
                        <div className="tp-metric-track"><div className="tp-metric-fill" style={{ width:`${buyerStats.repurchase}%`, background:'#1A1A1A' }} /></div>
                        <span className="tp-metric-val">{buyerStats.repurchase}%</span>
                      </div>
                      <div className="tp-metric tp-metric-badge">
                        <span className="tp-metric-label">최근 구매자</span>
                        <span className="tp-buyer-badge">{buyerStats.recent.toLocaleString()}명</span>
                      </div>
                    </div>
                  ) : (
                    <div className="tp-summary-wait">만족도·재구매율은 리뷰 {TASTE_REVEAL_MIN}개 이상 모이면 공개돼요</div>
                  )}
                </div>
              );
            })()}

            <div className="tp-axis-head">맛 프로파일 <span>· {tasteRevealed ? '구매자 동의율' : '판매자 제공 정보'}</span></div>

            {/* 판매자 4축은 항상 노출(등록 시 입력한 맛 정보). 구매자 동의율·신선도는 리뷰 5개 이상에서만 */}
            <div className={`taste5-grid${tasteMore ? ' expanded' : ' collapsed'}`}>
              {SELLER_AXES.map((axis, idx) => {
                const sLevel = toLevel(sellerScore[axis.key]);
                const pct = agreePct(sLevel, buyerLevelsOf(axis.key));
                const fillPct = tasteRevealed ? pct : sLevel / 5 * 100;
                return (
                  <div key={axis.key} className={`taste5-card${idx >= 2 ? ' taste5-extra' : ''}`} style={{ background: '#F4F4F4' }}>
                    <div className="taste5-top">
                      <span className="taste5-name"><span className="taste5-icon">{axis.icon}</span>{axis.label}</span>
                      <span className="taste5-claim" style={{ color: '#666' }}>{axisLevelLabel(axis, sLevel)}</span>
                    </div>
                    <div className="taste5-bar"><div className="taste5-fill" style={{ width:`${fillPct}%`, background: '#CB1D11' }} /></div>
                    {tasteRevealed
                      ? <div className="taste5-agree">구매자 <b style={{ color: '#1A1A1A', fontWeight: 800 }}>{pct}%</b> 동의</div>
                      : <div className="taste5-agree taste5-agree-wait">판매자 제공 · 구매자 동의율은 리뷰 {TASTE_REVEAL_MIN}개 이상 공개</div>}
                  </div>
                );
              })}
              {/* 신선도 — 구매자 전용 (리뷰 5개 이상에서만 노출) */}
              {tasteRevealed && (() => {
                const fresh = TASTE_AXES.find(a => a.key === 'fresh')!;
                const pct = avgPct(buyerLevelsOf('fresh'));
                return (
                  <div className="taste5-card taste5-fresh taste5-extra" style={{ background: '#F4F4F4' }}>
                    <div className="taste5-top">
                      <span className="taste5-name"><span className="taste5-icon">{fresh.icon}</span>{fresh.label}<span className="taste5-only">구매자 전용</span></span>
                      <span className="taste5-claim" style={{ color: '#1A1A1A', fontWeight: 800 }}>{pct}%</span>
                    </div>
                    <div className="taste5-bar"><div className="taste5-fill" style={{ width:`${pct}%`, background: '#CB1D11' }} /></div>
                  </div>
                );
              })()}
              <button className="taste-more-btn" onClick={() => setTasteMore(v => !v)}
                style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                <span>{tasteMore ? '접기' : (tasteRevealed ? '식감·과즙·신선도 더 보기' : '과즙·식감 더 보기')}</span>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: tasteMore ? 'rotate(180deg)' : 'none', transition:'transform .2s' }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ══ 탭 ══ */}
      <div className="pd-tabs-section" id="productTabsAnchor" style={{ scrollMarginTop: 60 }}>
        <div className="pd-tab-bar" id="productTabs">
          {TABS.map((t, i) => (
            <div key={t} className={`pd-tab${activeTab === i ? ' active' : ''}`}
              onClick={() => setActiveTab(i)}>
              <span className="pd-tab-label">{t}</span>
            </div>
          ))}
        </div>

        {/* ① 상품설명 */}
        {activeTab === 0 && (
          <div id="tabDesc" className="tab-content container">
            {detailImages.length > 0 ? (
              /* 어드민에서 업로드한 상품설명 이미지 */
              <div style={{ width:'100%' }}>
                {detailImages.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt=""
                    style={{ display:'block', width:'100%', height:'auto' }}
                  />
                ))}
              </div>
            ) : sections.length > 0 ? (
              /* 기존 HTML 섹션 */
              <div className="container">
                {sections.map(s => (
                  <div key={s.id}
                    dangerouslySetInnerHTML={{ __html: s.content }}
                    style={{ marginBottom:20 }} />
                ))}
              </div>
            ) : (
              /* 기본 fallback */
              <div className="container">
                <div style={{ background:'var(--color-bg)', borderRadius:12,
                  padding:20, marginBottom:16 }}>
                  <div style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>🌿 농가 정보</div>
                  <p style={{ fontSize:13, color:'var(--color-ink-soft)', lineHeight:1.85 }}>
                    {farm
                      ? `${farm.region}의 신뢰할 수 있는 파트너 농가에서 직접 수확하여 산지직송으로 보내드립니다. `
                      : '산지 파트너 농가에서 직접 수확하여 신선도를 최대한 유지합니다. '}
                    {product.short_desc ||
                      '친환경 인증을 받은 농가에서 당도를 보장한 프리미엄 과일입니다.'}
                  </p>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr',
                  gap:12, marginBottom:20 }}>
                  <div style={{ background:'var(--color-bg)', borderRadius:12, padding:16 }}>
                    <div style={{ fontSize:12, fontWeight:700, marginBottom:8 }}>📦 보관법</div>
                    <p style={{ fontSize:12, color:'var(--color-ink-soft)', lineHeight:1.7 }}>
                      냉장 보관(0~4℃) 권장. 비닐봉지에 넣어 1주일 이내 섭취.
                    </p>
                  </div>
                  <div style={{ background:'var(--color-bg)', borderRadius:12, padding:16 }}>
                    <div style={{ fontSize:12, fontWeight:700, marginBottom:8 }}>🔪 손질법</div>
                    <p style={{ fontSize:12, color:'var(--color-ink-soft)', lineHeight:1.7 }}>
                      흐르는 물에 깨끗이 씻어 드세요. 껍질에 영양이 풍부합니다.
                    </p>
                  </div>
                </div>
                {/* 이모지 배경 */}
                <div style={{ fontSize:72, textAlign:'center', lineHeight:1,
                  opacity:0.3, padding:'12px 0 4px' }}>
                  {emoji}{emoji}{emoji}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ② 상세정보 */}
        {activeTab === 1 && (
          <div id="tabInfo" className="tab-content container">

            {/* 상품고시정보 */}
            <div style={{ marginBottom:40 }}>
              <div style={{ fontSize:18, fontWeight:700, textAlign:'center', marginBottom:24 }}>
                상품고시정보
              </div>
              {infoData && (() => {
                /* 새 형식(tableRows) 우선, 구 형식 fallback */
                const rows: { k1: string; v1: string; k2: string; v2: string }[] =
                  infoData.tableRows
                    ? infoData.tableRows
                    : [
                        ...INFO_KEYS.map(([k1, k2], ri) => {
                          const vals = infoData.tableValues ?? infoData.table ?? [];
                          return { k1, v1: vals[ri]?.[0] ?? '', k2, v2: vals[ri]?.[1] ?? '' };
                        }),
                        ...(infoData.tableExtra ?? []),
                      ];
                /* 모바일용: 4열 → 2열(항목|값) 1개씩 평탄화 */
                const flat: { k: string; v: string }[] = [];
                rows.forEach(r => { if (r.k1) flat.push({ k: r.k1, v: r.v1 }); if (r.k2) flat.push({ k: r.k2, v: r.v2 }); });
                return (
                  <>
                  {/* PC: 4열 */}
                  <table className="info-gosi-pc" style={{ width:'100%', borderCollapse:'collapse',
                    fontSize:13, tableLayout:'fixed', border:'1px solid #E4E2DE' }}>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={i}>
                          <td style={{ background:'#F8F8F6', padding:'12px 14px', fontWeight:600,
                            color:'var(--color-ink-soft)', width:'20%', verticalAlign:'top',
                            lineHeight:1.8, border:'1px solid #E4E2DE' }}>{row.k1}</td>
                          <td style={{ padding:'12px 14px', color:'var(--color-ink-soft)',
                            width:'30%', verticalAlign:'top', lineHeight:1.8,
                            border:'1px solid #E4E2DE' }}>{row.v1}</td>
                          <td style={{ background:'#F8F8F6', padding:'12px 14px', fontWeight:600,
                            color:'var(--color-ink-soft)', width:'20%', verticalAlign:'top',
                            lineHeight:1.8, border:'1px solid #E4E2DE' }}>{row.k2}</td>
                          <td style={{ padding:'12px 14px', color:'var(--color-ink-soft)',
                            width:'30%', verticalAlign:'top', lineHeight:1.8,
                            border:'1px solid #E4E2DE' }}>{row.v2}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* 모바일: 2열(항목 | 값) */}
                  <table className="info-gosi-mob" style={{ width:'100%', borderCollapse:'collapse', fontSize:13.5 }}>
                    <tbody>
                      {flat.map((r, i) => (
                        <tr key={i} style={{ borderBottom:'1px solid #EFEFEC' }}>
                          <th style={{ textAlign:'left', fontWeight:600, color:'#8A8A8A',
                            padding:'13px 12px 13px 0', width:'50%', verticalAlign:'top', lineHeight:1.6,
                            wordBreak:'keep-all' }}>{r.k}</th>
                          <td style={{ padding:'13px 0 13px 10px', color:'#333', verticalAlign:'top', lineHeight:1.6,
                            textAlign:'left', wordBreak:'keep-all' }}>{r.v || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </>
                );
              })()}
            </div>

            {/* 배송안내 */}
            {infoData && (
              <div style={{ marginBottom:32 }}>
                <div style={{ fontSize:14, fontWeight:700, paddingBottom:12,
                  borderBottom:'1.5px solid var(--color-ink)', marginBottom:16 }}>
                  배송안내
                </div>
                <ul style={{ fontSize:13, color:'var(--color-ink-soft)', lineHeight:1.9,
                  listStyle:'none', padding:0, margin:0, display:'flex', flexDirection:'column', gap:6 }}>
                  {infoData.shipping.map((txt, i) => (
                    <li key={i} style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                      <span style={{ flexShrink:0, marginTop:2, color:'var(--color-ink-mute)' }}>•</span>
                      <span style={{ flex:1 }}>{txt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 교환 및 반품정보 */}
            {infoData && (
              <div style={{ marginBottom:32 }}>
                <div style={{ fontSize:14, fontWeight:700, paddingBottom:12,
                  borderBottom:'1.5px solid var(--color-ink)', marginBottom:16 }}>
                  교환 및 반품정보
                </div>
                <ul style={{ fontSize:13, color:'var(--color-ink-soft)', lineHeight:1.9,
                  listStyle:'none', padding:0, margin:0, display:'flex', flexDirection:'column', gap:6 }}>
                  {infoData.return_.map((txt, i) => (
                    <li key={i} style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                      <span style={{ flexShrink:0, marginTop:2, color:'var(--color-ink-mute)' }}>•</span>
                      <span style={{ flex:1 }}>{txt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 고객센터 */}
            {infoData && (
              <div style={{ marginBottom:32 }}>
                <div style={{ fontSize:14, fontWeight:700, paddingBottom:12,
                  borderBottom:'1.5px solid var(--color-ink)', marginBottom:16 }}>
                  고객센터
                </div>
                <ul style={{ fontSize:13, color:'var(--color-ink-soft)', lineHeight:1.9,
                  listStyle:'none', padding:0, margin:0, display:'flex', flexDirection:'column', gap:6 }}>
                  {infoData.cs.map((txt, i) => (
                    <li key={i} style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                      <span style={{ flexShrink:0, marginTop:2, color:'var(--color-ink-mute)' }}>•</span>
                      <span style={{ flex:1 }}>{txt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ③ 후기 */}
        {activeTab === 2 && (
          <div id="tabReviews" className="tab-content container">
            <a id="reviews" />

            {/* 헤더 */}
            <div style={{ display:'flex', alignItems:'center',
              justifyContent:'space-between', marginBottom:20 }}>
              <span style={{ fontSize:18, fontWeight:700 }}>리뷰 <span style={{ fontSize:15, color:'var(--color-ink-mute)', fontWeight:500 }}>({product.review_count})</span></span>
              <button
                onClick={() => {
                  if (!user) { router.push('/login'); return; }
                  if (!hasPurchased && !isAdmin) { alert('구매하신 상품만 리뷰를 작성할 수 있어요.'); return; }
                  setReviewPolicyAgree(false); setReviewPolicyOpen(false);
                  setReviewModalOpen(true);
                }}
                style={{ padding:'8px 16px', border:'1px solid #D0D0CC', borderRadius:8,
                  background:'#fff', fontSize:13, fontWeight:600, cursor:'pointer',
                  color:'var(--color-ink)' }}>
                리뷰 작성하기
              </button>
            </div>

            {/* 평점 요약 박스 */}
            {product.review_count > 0 && (
              <div style={{ display:'flex', border:'1px solid #E8E8E6', borderRadius:12,
                overflow:'hidden', marginBottom:20 }}>

                {/* 좌: 평점 + 만족도 */}
                {(() => {
                  const satisfiedCount = reviews.filter(r => r.rating >= 4).length;
                  const satisfiedPct = product.review_count > 0
                    ? Math.round(satisfiedCount / product.review_count * 100) : 0;
                  return (
                    <div style={{ width:'32%', flexShrink:0, padding:'18px 14px',
                      borderRight:'1px solid #E8E8E6',
                      display:'flex', flexDirection:'column', alignItems:'center',
                      justifyContent:'center', gap:8 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                        <SingleStar size={22} />
                        <span style={{ fontSize:30, fontWeight:800, lineHeight:1, color:'var(--color-ink)' }}>
                          {product.avg_rating.toFixed(1)}
                        </span>
                      </div>
                      <p style={{ fontSize:11, color:'var(--color-ink-mute)', textAlign:'center', lineHeight:1.5, margin:0, wordBreak:'keep-all' }}>
                        구매자의 <strong style={{ color:'var(--color-ink)', fontSize:12 }}>{satisfiedPct}%</strong>가<br />만족했어요
                      </p>
                    </div>
                  );
                })()}

                {/* 우: 바 차트 */}
                <div style={{ flex:1, minWidth:0, padding:'16px 20px',
                  display:'flex', flexDirection:'column',
                  justifyContent:'center', gap:7 }}>
                  {ratingDist.map(r => {
                    const pct = product.review_count > 0
                      ? Math.round(r.count / product.review_count * 100) : 0;
                    return (
                      <div key={r.label}
                        style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:12, color:'var(--color-ink-mute)',
                          width:62, flexShrink:0 }}>{r.label}</span>
                        <div style={{ flex:1, minWidth:0, height:7, background:'#EBEBEB',
                          borderRadius:99, overflow:'hidden' }}>
                          <div style={{
                            width:`${pct}%`, height:'100%', borderRadius:99,
                            background: '#1A1A1A',
                          }} />
                        </div>
                        <span style={{ fontSize:12, color:'var(--color-ink-mute)',
                          width:40, textAlign:'right', flexShrink:0 }}>
                          {r.count.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 정렬 탭 */}
            <div style={{ display:'flex', justifyContent:'flex-end', gap:4,
              marginBottom:16 }}>
              {(['최신순','추천순','평점순'] as const).map((label, i) => {
                const val: SortKey = (['latest','helpful','rating'] as SortKey[])[i];
                const active = reviewSort === val;
                return (
                  <button key={label} onClick={() => { setReviewSort(val); setReviewPage(0); }}
                    style={{ padding:'5px 12px', borderRadius:99,
                      border:`1px solid ${active ? 'var(--color-ink)' : '#DDDDD9'}`,
                      background: active ? 'var(--color-ink)' : '#fff',
                      color: active ? '#fff' : 'var(--color-ink-mute)',
                      fontSize:12, fontWeight:600, cursor:'pointer' }}>
                    {label}
                  </button>
                );
              })}
            </div>

            {/* ✅ 포토/영상 리뷰 그리드 (원본 구조 그대로) */}
            {product.review_count > 0 && (
              <div style={{ marginBottom:20 }}>
                <div style={{ marginBottom:12 }}>
                  <span style={{ fontSize:13, fontWeight:700 }}>
                    포토/영상리뷰 ({photoReviewCount.toLocaleString()})
                  </span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8 }}>
                  {allPhotoItems.slice(0, 4).map((item, i) => {
                    const isLastMore = allPhotoItems.length > 4 && i === 3;
                    return (
                      <div key={i}
                        onClick={() => { setGalleryFromReview(!isLastMore); setPhotoGalleryOpen(true); setSelectedGalleryIdx(isLastMore ? null : i); }}
                        style={{ aspectRatio:'1', position:'relative', borderRadius:6, cursor:'pointer',
                          background: item.url ? '#F0F0F0' : `linear-gradient(135deg,${item.color},#fff)`,
                          display:'flex', alignItems:'center', justifyContent:'center', fontSize:28,
                          border:'1px solid rgba(0,0,0,0.06)', overflow:'hidden' }}>
                        {item.url
                          ? <img src={imgThumb(item.url, 250)} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                          : emoji}
                        {isLastMore && (
                          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.55)',
                            display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <span style={{ fontSize:13, fontWeight:700, color:'#fff' }}>+더보기</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ✅ 리뷰 수 + 포토 필터 (원본 구조 그대로) */}
            <div style={{ display:'flex', alignItems:'center',
              justifyContent:'space-between', padding:'12px 0',
              borderBottom:'1px solid #EBEBEB',
              marginBottom:4 }}>
              <span style={{ fontSize:17, fontWeight:700 }}>
                리뷰 {product.review_count.toLocaleString()}건
              </span>
              <label
                onClick={() => { setPhotoFilterOn(v => !v); setReviewPage(0); }}
                style={{ display:'flex', alignItems:'center', gap:6,
                fontSize:13, color:'var(--color-ink-mute)', cursor:'pointer' }}>
                <span
                  style={{ display:'inline-flex', alignItems:'center', justifyContent:'center',
                    width:18, height:18, borderRadius:'50%',
                    border: photoFilterOn ? 'none' : '1.5px solid #D0D0CC',
                    background: photoFilterOn ? 'var(--color-ink)' : '#fff',
                    fontSize:10,
                    color: photoFilterOn ? '#fff' : 'var(--color-ink-mute)' }}>
                  ✓
                </span>
                포토 리뷰만 보기
              </label>
            </div>

            {/* 리뷰 카드 */}
            {reviews.length === 0 ? (
              <p style={{ color:'#999', textAlign:'center', padding:'40px 0' }}>
                아직 리뷰가 없습니다.
              </p>
            ) : (
              pagedReviews.map(r => (
                <div key={r.id} style={{ padding:'20px 0', borderBottom:'1px solid #EBEBEB' }}>
                  <div style={{ display:'flex', alignItems:'flex-start',
                    justifyContent:'space-between', marginBottom:6 }}>
                    <div>
                      <StarRating rating={r.rating} size={15} />
                    </div>
                    <span style={{ fontSize:12, color:'var(--color-ink-mute)',
                      textAlign:'right', flexShrink:0, marginLeft:8 }}>
                      {r.author_name
                        ? `${r.author_name} 님이 작성`
                        : r.profiles?.name
                        ? `${r.profiles.name.charAt(0)}**** 님이 작성`
                        : '익명 님이 작성'
                      }{' '}|{' '}
                      {new Date(r.created_at).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                  {r.is_best && (
                    <span style={{ display:'inline-block', marginBottom:8,
                      fontSize:11, fontWeight:700, background:'#1A1A1A',
                      color:'#fff', borderRadius:4, padding:'2px 8px' }}>
                      BEST
                    </span>
                  )}
                  <p style={{ fontSize:14, color:'var(--color-ink)',
                    lineHeight:1.75, marginBottom:10 }}>
                    {r.content}
                  </p>
                  {/* 리뷰 첨부 사진/영상 */}
                  {((r.image_urls && r.image_urls.length > 0) || r.video_url) && (
                    <div className="review-photo-scroll" style={{ display:'flex', gap:8, flexWrap:'nowrap',
                      marginBottom:12, overflowX:'auto', WebkitOverflowScrolling:'touch', paddingBottom:2 }}>
                      {(r.image_urls ?? []).map((url, ii) => (
                        <img key={ii} src={url} alt="" loading="lazy"
                          onClick={() => {
                            const gIdx = allPhotoItems.findIndex(p => p.review?.id === r.id && p.photoIdx === ii);
                            setGalleryFromReview(true);
                            setSelectedGalleryIdx(gIdx >= 0 ? gIdx : null);
                            setPhotoGalleryOpen(true);
                          }}
                          style={{ width:92, height:92, flexShrink:0, objectFit:'cover', borderRadius:8,
                            border:'1px solid #EEE', cursor:'pointer' }} />
                      ))}
                      {r.video_url && (
                        <video src={r.video_url} controls preload="metadata"
                          style={{ width:92, height:92, flexShrink:0, objectFit:'cover', borderRadius:8,
                            border:'1px solid #EEE', background:'#000' }} />
                      )}
                    </div>
                  )}
                  <div style={{ display:'flex', alignItems:'center',
                    justifyContent:'space-between' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                      <button onClick={() => toggleReviewLike(r.id, r.likes_count || 0)}
                        style={{ display:'flex', alignItems:'center', gap:5,
                          background: likedReviews.has(r.id) ? '#FFF5F5' : 'none',
                          border:`1px solid ${likedReviews.has(r.id) ? '#E53935' : '#DDDDD9'}`,
                          borderRadius:99, padding:'5px 12px',
                          fontSize:12, color: likedReviews.has(r.id) ? '#E53935' : 'var(--color-ink-mute)', cursor:'pointer' }}>
                        <svg viewBox="0 0 24 24" width="13" height="13"
                          fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/>
                          <path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/>
                        </svg>
                        리뷰가 도움 됐어요 {r.likes_count || 0}
                      </button>
                    </div>
                    <div style={{ display:'flex', gap:12 }}>
                      <button onClick={() => {
                          if (!user) { router.push('/login'); return; }
                          setReportReason(''); setReportDetail(''); setReportTarget(r.id);
                        }}
                        style={{ background:'none', border:'none', fontSize:12,
                          color:'var(--color-ink-mute)', cursor:'pointer' }}>신고</button>
                      {isAdmin && r.user_id && (
                        <button onClick={async () => {
                            if (!confirm('이 회원을 차단하시겠습니까?')) return;
                            const supabase = createClient();
                            const { error } = await supabase.from('profiles').update({ is_blocked: true }).eq('id', r.user_id);
                            showToast(error ? '차단 실패: ' + error.message : '해당 회원을 블랙리스트에 추가했습니다.');
                          }}
                          style={{ background:'none', border:'none', fontSize:12,
                            color:'#DC2626', cursor:'pointer' }}>차단</button>
                      )}
                    </div>
                  </div>
                  {/* 판매자 답변 */}
                  {r.seller_reply && (
                    <div style={{ marginTop:12, padding:'12px 14px', background:'#F7F7F5',
                      borderRadius:8 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:'#555', marginBottom:4 }}>
                        🏪 판매자 답변
                      </div>
                      <p style={{ fontSize:13, color:'#555', lineHeight:1.7, whiteSpace:'pre-wrap', margin:0 }}>
                        {r.seller_reply}
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}

            <div className="pagination">
                <button className="page-btn"
                  disabled={reviewPage === 0}
                  onClick={() => setReviewPage(0)}>«</button>
                <button className="page-btn"
                  disabled={reviewPage === 0}
                  onClick={() => setReviewPage(p => p - 1)}>‹</button>
                {Array.from({ length: reviewTotalPages }, (_, i) => (
                  <button key={i}
                    className={`page-num${reviewPage === i ? ' active' : ''}`}
                    onClick={() => setReviewPage(i)}>
                    {i + 1}
                  </button>
                ))}
                <button className="page-btn"
                  disabled={reviewPage === reviewTotalPages - 1}
                  onClick={() => setReviewPage(p => p + 1)}>›</button>
                <button className="page-btn"
                  disabled={reviewPage === reviewTotalPages - 1}
                  onClick={() => setReviewPage(reviewTotalPages - 1)}>»</button>
              </div>
          </div>
        )}

        {/* ④ 문의 */}
        {activeTab === 3 && (
          <div id="tabQna" className="tab-content container">
            <div className="qna-header">
              <div>
                <div className="qna-header-title">Q&A</div>
                <div className="qna-header-sub">상품의 궁금한 점을 해결해 드립니다.</div>
              </div>
              <button className="qna-btn-filled"
                onClick={() => { if (!user) { router.push('/login'); return; } setInqModal(true); }}>
                상품문의하기
              </button>
            </div>

            {/* Q&A 목록 */}
            {inquiries.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px 0', color:'#aaa', fontSize:14 }}>
                아직 등록된 문의가 없습니다.
              </div>
            ) : (() => {
              const INQ_PER = 10;
              const totalPages = Math.ceil(inquiries.length / INQ_PER);
              const paged = inquiries.slice(inqPage * INQ_PER, (inqPage + 1) * INQ_PER);
              return (
                <>
                  {paged.map((q, i) => {
                    const isMe = user?.id === q.user_id;
                    const maskedName = q.profiles?.name
                      ? q.profiles.name.charAt(0) + '****'
                      : isMe ? (user?.user_metadata?.name?.charAt(0) || '나') + '****' : '익명';
                    const isLocked = q.is_private;
                    const isExpanded = expandedInq === q.id;
                    const isUnlocked = unlockedInq.has(q.id);
                    const canView = !q.is_private || isUnlocked || isAdmin || isMe || (q.is_private && !q.password);
                    return (
                      <div key={q.id}>
                        <div className="qna-row" style={{ cursor: 'pointer' }}
                          onClick={() => setExpandedInq(isExpanded ? null : q.id)}>
                          <div className="qna-line1">
                            <span className="qna-cat">{inqCatLabel(q.category)}</span>
                            <span className="qna-user">{maskedName}</span>
                            <span className="qna-datetime">{q.created_at.slice(0,10)}</span>
                            <span className={`qna-count ${q.answer ? 'done' : 'wait'}`}>{q.answer ? '답변완료' : '답변대기'}</span>
                          </div>
                          <div className="qna-content">
                            {q.is_private && (
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
                                stroke="currentColor" strokeWidth="2"
                                style={{ flexShrink:0, color:'var(--color-ink-soft)' }}>
                                <rect x="3" y="11" width="18" height="11" rx="2"/>
                                <path d="M7 11V7a5 5 0 0110 0v4"/>
                              </svg>
                            )}
                            <span className="qna-category">
                              {isLocked ? '비밀글입니다.' : q.content.slice(0, 60) + (q.content.length > 60 ? '...' : '')}
                            </span>
                          </div>
                        </div>
                        {isExpanded && isLocked && !isUnlocked && q.password && !isMe && !isAdmin && (
                          <div style={{ background:'#FAFAF8', borderBottom:'1px solid #E8E8E6', padding:'16px 20px' }}>
                            <div style={{ fontSize:13, color:'#555', marginBottom:10 }}>🔒 비밀 문의입니다. 비밀번호를 입력하세요.</div>
                            <div style={{ display:'flex', gap:8 }}>
                              <input type="password" placeholder="비밀번호" maxLength={20}
                                value={pwInput[q.id] || ''}
                                onChange={e => setPwInput(prev => ({ ...prev, [q.id]: e.target.value }))}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    if (pwInput[q.id] === q.password) {
                                      setUnlockedInq(prev => new Set([...prev, q.id]));
                                    } else {
                                      alert('비밀번호가 틀렸습니다.');
                                    }
                                  }
                                }}
                                style={{ flex:1, minWidth:0, height:36, padding:'0 10px', border:'1.5px solid #E2E8F0', borderRadius:8, fontSize:14, fontFamily:'inherit', outline:'none' }} />
                              <button
                                style={{ flexShrink:0, whiteSpace:'nowrap', height:36, padding:'0 16px', background:'#1A1A1A', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}
                                onClick={() => {
                                  if (pwInput[q.id] === q.password) {
                                    setUnlockedInq(prev => new Set([...prev, q.id]));
                                  } else {
                                    alert('비밀번호가 틀렸습니다.');
                                  }
                                }}>확인</button>
                            </div>
                          </div>
                        )}
                        {isExpanded && canView && (
                          <div style={{ background:'#FAFAF8', borderBottom:'1px solid #E8E8E6', padding:'16px 20px' }}>
                            {/* 문의 전문 (편집 중이면 textarea) */}
                            {editInqId === q.id ? (
                              <div style={{ marginBottom: q.answer ? 16 : 0 }}>
                                <textarea value={editInqText} onChange={e => setEditInqText(e.target.value)}
                                  style={{ width:'100%', minHeight:80, padding:'10px 12px', border:'1.5px solid #DDD', borderRadius:8, fontSize:13, fontFamily:'inherit', lineHeight:1.7, outline:'none', boxSizing:'border-box', resize:'vertical' }} />
                                <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:8 }}>
                                  <button onClick={() => setEditInqId(null)}
                                    style={{ fontSize:12, color:'#666', background:'#fff', border:'1px solid #D8D8D8', borderRadius:6, padding:'6px 14px', cursor:'pointer', fontWeight:600 }}>취소</button>
                                  <button onClick={() => updateInquiry(q.id)}
                                    style={{ fontSize:12, color:'#fff', background:'#1A1A1A', border:'none', borderRadius:6, padding:'6px 16px', cursor:'pointer', fontWeight:600 }}>저장</button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ fontSize:13, color:'#333', lineHeight:1.8, marginBottom: q.answer ? 16 : 0, whiteSpace:'pre-wrap' }}>
                                {q.content}
                              </div>
                            )}
                            {/* 답변 */}
                            {q.answer && (
                              <div style={{ borderTop:'1px solid #E8E8E6', paddingTop:14 }}>
                                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                                  <span style={{ fontSize:12, fontWeight:700, background:'#1A1A1A', color:'#fff', borderRadius:4, padding:'2px 8px' }}>답변</span>
                                  {q.answered_at && (
                                    <span style={{ fontSize:11, color:'#94A3B8' }}>{q.answered_at.slice(0,10)}</span>
                                  )}
                                </div>
                                <div style={{ fontSize:13, color:'#444', lineHeight:1.8, whiteSpace:'pre-wrap' }}>
                                  {q.answer}
                                </div>
                              </div>
                            )}
                            {/* 본인 문의 수정/삭제 (편집 중 아닐 때) */}
                            {isMe && editInqId !== q.id && (
                              <div style={{ marginTop:14, display:'flex', justifyContent:'flex-end', gap:8 }}>
                                {!q.answer && (
                                  <button onClick={() => { setEditInqId(q.id); setEditInqText(q.content); }}
                                    style={{ fontSize:12, color:'#666', background:'#fff', border:'1px solid #D8D8D8', borderRadius:6, padding:'6px 14px', cursor:'pointer', fontWeight:600 }}>
                                    수정
                                  </button>
                                )}
                                <button onClick={() => deleteInquiry(q.id)}
                                  style={{ fontSize:12, color:'#666', background:'#fff', border:'1px solid #D8D8D8', borderRadius:6, padding:'6px 14px', cursor:'pointer', fontWeight:600 }}>
                                  삭제
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="pd-pagination">
                    <button className="pd-page-btn arrow" disabled={inqPage === 0} onClick={() => setInqPage(0)}>«</button>
                    <button className="pd-page-btn arrow" disabled={inqPage === 0} onClick={() => setInqPage(p => p - 1)}>‹</button>
                    {Array.from({ length: totalPages }, (_, n) => (
                      <button key={n} className={`pd-page-btn${inqPage === n ? ' active' : ''}`}
                        onClick={() => { setInqPage(n); setExpandedInq(null); }}>{n + 1}</button>
                    ))}
                    <button className="pd-page-btn arrow" disabled={inqPage === totalPages - 1} onClick={() => setInqPage(p => p + 1)}>›</button>
                    <button className="pd-page-btn arrow" disabled={inqPage === totalPages - 1} onClick={() => setInqPage(totalPages - 1)}>»</button>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* ── 상품 문의 모달 ── */}
      {inqModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:3100,
          display:'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent:'center',
          padding: isMobile ? 0 : 16 }}
          onClick={() => setInqModal(false)}>
          <div style={{ background:'#fff', width:'100%', maxWidth:480,
            borderRadius: isMobile ? '16px 16px 0 0' : 16, padding:24, maxHeight:'80vh', overflowY:'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
              <span style={{ fontSize:17, fontWeight:700 }}>상품 문의</span>
              <button onClick={() => setInqModal(false)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#94A3B8' }}>✕</button>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:12, fontWeight:700, color:'#64748B', display:'block', marginBottom:6 }}>카테고리</label>
              {(() => {
                const CATS = [['문의','문의 유형 선택하기'],['배송관련','배송관련'],['취소/교환/반품','취소/교환/반품'],['상품','상품 문의'],['기타','기타']] as const;
                const curLabel = CATS.find(([v]) => v === inqCategory)?.[1] ?? '문의 유형 선택하기';
                return (
                  <div className="opt-dd">
                    <button type="button" className={`opt-dd-btn${inqCatOpen ? ' open' : ''}`}
                      onClick={() => setInqCatOpen(o => !o)}>
                      <span className={inqCategory === '문의' ? 'ph' : ''}>{curLabel}</span>
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    {inqCatOpen && (
                      <>
                        <div className="opt-dd-backdrop" style={{ zIndex: 3101 }} onClick={() => setInqCatOpen(false)} />
                        <div className="opt-dd-list" style={{ zIndex: 3102 }}>
                          {CATS.map(([v, l]) => (
                            <button type="button" key={v}
                              className={`opt-dd-item${inqCategory === v ? ' sel' : ''}`}
                              onClick={() => { setInqCategory(v); setInqCatOpen(false); }}>{l}</button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:12, fontWeight:700, color:'#64748B', display:'block', marginBottom:6 }}>문의 내용 *</label>
              <textarea rows={5} value={inqContent} onChange={e => setInqContent(e.target.value)}
                placeholder="문의 내용을 입력해주세요."
                style={{ width:'100%', padding:'10px 12px', border:'1.5px solid #E2E8F0', borderRadius:8,
                  fontSize:14, fontFamily:'inherit', resize:'vertical', outline:'none', boxSizing:'border-box' }} />
            </div>
            <div style={{ marginBottom:18 }}>
              <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:14, cursor:'pointer', marginBottom: inqPrivate ? 10 : 0 }}>
                <input type="checkbox" checked={inqPrivate} onChange={e => { setInqPrivate(e.target.checked); if (!e.target.checked) setInqPassword(''); }} />
                비밀 문의로 등록
              </label>
              {inqPrivate && (
                <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8 }}>
                  <span style={{ fontSize:13, color:'#64748B', flexShrink:0 }}>비밀번호</span>
                  <input type="password" maxLength={20} placeholder="비밀번호 설정 (필수)"
                    value={inqPassword} onChange={e => setInqPassword(e.target.value)}
                    style={{ flex:1, height:36, padding:'0 10px', border:'1.5px solid #E2E8F0', borderRadius:8, fontSize:14, fontFamily:'inherit', outline:'none' }} />
                </div>
              )}
            </div>
            <button onClick={submitInquiry} disabled={inqSubmitting}
              style={{ width:'100%', height:46, border:'none', borderRadius:8, background:'#1A1A1A', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>
              {inqSubmitting ? '등록 중...' : '등록하기'}
            </button>
          </div>
        </div>
      )}

      {/* ── 후기 신고 모달 ── */}
      {reportTarget && (
        <div onClick={() => setReportTarget(null)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:3100, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'#fff', borderRadius:14, width:'100%', maxWidth:380, padding:'22px 22px 20px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <span style={{ fontSize:16, fontWeight:700 }}>후기 신고</span>
              <button onClick={() => setReportTarget(null)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color:'#999', lineHeight:1 }}>×</button>
            </div>
            <div style={{ fontSize:12, color:'#888', marginBottom:12 }}>신고 사유를 선택해 주세요.</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:14 }}>
              {REPORT_REASONS.map(rs => (
                <button key={rs} type="button" onClick={() => setReportReason(rs)}
                  style={{ textAlign:'left', padding:'11px 14px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', fontSize:13.5,
                    border:`1.5px solid ${reportReason === rs ? '#1A1A1A' : '#E5E5E5'}`,
                    background: '#fff', color: reportReason === rs ? '#1A1A1A' : '#444', fontWeight: reportReason === rs ? 700 : 500 }}>
                  {rs}
                </button>
              ))}
            </div>
            {reportReason === '기타' && (
              <textarea value={reportDetail} onChange={e => setReportDetail(e.target.value)} rows={3}
                placeholder="신고 사유를 입력해 주세요."
                style={{ width:'100%', padding:'10px 12px', fontSize:13, border:'1.5px solid #E0DFDB', borderRadius:8, resize:'none', outline:'none', fontFamily:'inherit', lineHeight:1.6, boxSizing:'border-box', marginBottom:14 }} />
            )}
            <button onClick={submitReport} disabled={reportSaving}
              style={{ width:'100%', padding:'13px', background:'#1A1A1A', color:'#fff', border:'none', borderRadius:10, fontSize:14, fontWeight:700, cursor: reportSaving ? 'default' : 'pointer', opacity: reportSaving ? 0.6 : 1, fontFamily:'inherit' }}>
              {reportSaving ? '접수 중...' : '신고 접수'}
            </button>
          </div>
        </div>
      )}

      {/* ── 리뷰 작성 모달 ── */}
      {reviewModalOpen && (
        <div
          style={{ position:'fixed', inset:0, background: isMobile ? '#fff' : 'rgba(0,0,0,0.5)', zIndex:3100,
            display:'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent:'center',
            padding: isMobile ? 0 : 16 }}
          onClick={() => setReviewModalOpen(false)}
        >
          <div
            style={{ background:'#fff', width:'100%',
              maxWidth: isMobile ? '100%' : 540,
              height: isMobile ? '100%' : 'auto',
              maxHeight: isMobile ? '100%' : '92vh',
              borderRadius: isMobile ? 0 : 16,
              display:'flex', flexDirection:'column', overflow:'hidden',
              boxShadow: isMobile ? 'none' : '0 24px 64px rgba(0,0,0,0.28)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div style={{ flexShrink:0, position:'relative', display:'flex', alignItems:'center',
              justifyContent:'center', padding:'15px 16px', borderBottom:'1px solid #EEE' }}>
              <button onClick={() => setReviewModalOpen(false)}
                style={{ position:'absolute', left:12, background:'none', border:'none', fontSize:22,
                  cursor:'pointer', color:'#333', lineHeight:1, padding:'0 4px' }}>✕</button>
              <span style={{ fontSize:17, fontWeight:700 }}>리뷰 남기기</span>
            </div>

            {/* 스크롤 본문 */}
            <div style={{ flex:1, overflowY:'auto', padding:'20px 18px 24px' }}>

            {/* 상품 정보 */}
            <div style={{ display:'flex', gap:12, alignItems:'center', paddingBottom:18,
              borderBottom:'1px solid #F0F0F0', marginBottom:20 }}>
              <div style={{ width:56, height:56, borderRadius:8, overflow:'hidden', flexShrink:0,
                background:'#F4F4F2', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26 }}>
                {product.thumbnail_url ? <img src={imgThumb(product.thumbnail_url, 200)} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : emoji}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13.5, fontWeight:600, color:'#222', lineHeight:1.4,
                  display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{product.name}</div>
                {(reviewPt.text + reviewPt.photo) > 0 && (
                  <span style={{ display:'inline-block', marginTop:6, fontSize:11, fontWeight:700,
                    color:'var(--color-accent)', background:'var(--color-accent-bg)', padding:'2px 8px', borderRadius:5 }}>
                    최대 {(reviewPt.text + reviewPt.photo).toLocaleString()}P
                  </span>
                )}
              </div>
            </div>

            {/* 포인트 적립 안내 */}
            {(reviewPt.text > 0 || reviewPt.photo > 0) && (
              <div style={{
                display:'flex', alignItems:'center', gap:10, marginBottom:20,
                padding:'12px 14px', borderRadius:12,
                background:'var(--color-accent-bg)', border:'1px solid var(--color-accent-soft)',
              }}>
                <span style={{ fontSize:18, lineHeight:1 }}>✨</span>
                <div style={{ fontSize:12.5, lineHeight:1.6, color:'var(--color-ink-soft)' }}>
                  리뷰를 남기면 포인트를 드려요!{' '}
                  <b style={{ color:'var(--color-accent)' }}>리뷰 작성 +{reviewPt.text.toLocaleString()}P</b>
                  {reviewPt.photo > 0 && <>{' · '}<b style={{ color:'var(--color-accent)' }}>사진·영상 첨부 시 +{reviewPt.photo.toLocaleString()}P</b></>}
                </div>
              </div>
            )}

            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:15, fontWeight:700, marginBottom:12, color:'var(--color-ink)' }}>
                이 상품 어떠셨나요?
              </div>
              <div style={{ display:'flex', gap:4 }}>
                {[1,2,3,4,5].map(s => (
                  <button key={s} onClick={() => setNewRating(s)}
                    style={{ background:'none', border:'none', cursor:'pointer',
                      padding:2, lineHeight:1, transition:'opacity .1s' }}>
                    <svg width={32} height={32} viewBox="0 0 20 20"
                      style={{ display:'block' }}>
                      <path
                        d="M10 1L12.6 6.4L18.6 7.2L14.3 11.4L15.3 17.3L10 14.5L4.7 17.3L5.7 11.4L1.4 7.2L7.4 6.4Z"
                        fill={s <= newRating ? '#FFCA28' : '#E0E0E0'}
                        stroke={s <= newRating ? '#FFCA28' : '#E0E0E0'} strokeWidth={1.5}
                        strokeLinejoin="round" strokeLinecap="round"
                        style={{ transition:'fill .1s' }}
                      />
                    </svg>
                  </button>
                ))}
                <span style={{ fontSize:14, fontWeight:700, color:'var(--color-ink-soft)',
                  alignSelf:'center', marginLeft:4 }}>
                  {['', '아쉬워요', '그냥 그래요', '괜찮아요', '정말 좋아요', '최고에요'][newRating]}
                </span>
              </div>
            </div>

            {/* 맛 평가 (5축) — 구매자 동의율에 반영 */}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:10, color:'var(--color-ink-soft)' }}>
                맛 평가 <span style={{ fontSize:11, color:'#BBB', fontWeight:400 }}>선택 · 다른 구매자에게 도움돼요</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {TASTE_AXES.map(axis => (
                  <div key={axis.key}>
                    <div style={{ fontSize:12, fontWeight:600, color:'#555', marginBottom:6 }}>
                      <span style={{ marginRight:4 }}>{axis.icon}</span>{axis.label}
                    </div>
                    <div style={{ display:'flex', gap:4 }}>
                      {axis.levels.map((lv, i) => {
                        const level = i + 1;
                        const on = newTaste[axis.key] === level;
                        return (
                          <button key={level} type="button"
                            onClick={() => setNewTaste(prev => ({ ...prev, [axis.key]: level }))}
                            style={{ flex:1, padding:'7px 2px', borderRadius:8, cursor:'pointer',
                              border:`1.5px solid ${on ? '#1A1A1A' : '#E5E5E5'}`,
                              background: '#fff', color: on ? '#1A1A1A' : '#999',
                              fontSize:11, fontWeight:on ? 700 : 500, fontFamily:'inherit',
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

            {/* 사진/영상 첨부 */}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:8,
                color:'var(--color-ink-soft)' }}>
                사진/영상 첨부
                <span style={{ fontSize:11, color:'#BBB', fontWeight:400, marginLeft:6 }}>
                  사진 최대 5장 + 영상 1개 (선택)
                </span>
              </div>
              {newImages.length > 1 && (
                <div style={{ fontSize:11, color:'#999', marginBottom:8 }}>↔ 사진을 드래그해 순서를 변경할 수 있어요</div>
              )}
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                {/* 이미지 프리뷰 */}
                {newImages.map((file, i) => (
                  <div key={i}
                    data-rimg={i}
                    draggable
                    onDragStart={() => { reviewDragSrc.current = i; }}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => reorderReviewImages(i)}
                    onDragEnd={() => { reviewDragSrc.current = null; }}
                    onTouchStart={() => { reviewDragSrc.current = i; reviewDropTarget.current = i; }}
                    onTouchMove={e => {
                      const t = e.touches[0];
                      const el = (document.elementFromPoint(t.clientX, t.clientY) as HTMLElement | null)?.closest('[data-rimg]');
                      if (el) reviewDropTarget.current = Number(el.getAttribute('data-rimg'));
                    }}
                    onTouchEnd={() => { if (reviewDropTarget.current !== null) reorderReviewImages(reviewDropTarget.current); reviewDropTarget.current = null; }}
                    style={{ position:'relative', width:64, height:64, flexShrink:0, cursor:'grab', touchAction:'none' }}>
                    <img
                      src={URL.createObjectURL(file)}
                      alt=""
                      draggable={false}
                      style={{ width:'100%', height:'100%', objectFit:'cover',
                        borderRadius:8, border:'1px solid #E8E8E6', pointerEvents:'none' }}
                    />
                    <button
                      onClick={() => setNewImages(prev => prev.filter((_, j) => j !== i))}
                      style={{ position:'absolute', top:-6, right:-6,
                        width:20, height:20, borderRadius:'50%',
                        background:'#1A1A1A', color:'#fff', border:'none',
                        fontSize:12, cursor:'pointer', display:'flex',
                        alignItems:'center', justifyContent:'center', lineHeight:1 }}>
                      ×
                    </button>
                  </div>
                ))}
                {/* 영상 프리뷰 */}
                {newVideo && (
                  <div style={{ position:'relative', width:64, height:64, flexShrink:0 }}>
                    <video
                      src={URL.createObjectURL(newVideo)}
                      style={{ width:'100%', height:'100%', objectFit:'cover',
                        borderRadius:8, border:'1px solid #E8E8E6' }}
                    />
                    <div style={{ position:'absolute', inset:0, display:'flex',
                      alignItems:'center', justifyContent:'center',
                      background:'rgba(0,0,0,0.25)', borderRadius:8 }}>
                      <span style={{ fontSize:20 }}>▶</span>
                    </div>
                    <button
                      onClick={() => setNewVideo(null)}
                      style={{ position:'absolute', top:-6, right:-6,
                        width:20, height:20, borderRadius:'50%',
                        background:'#1A1A1A', color:'#fff', border:'none',
                        fontSize:12, cursor:'pointer', display:'flex',
                        alignItems:'center', justifyContent:'center', lineHeight:1 }}>
                      ×
                    </button>
                  </div>
                )}
                {/* 사진 추가 버튼 */}
                {newImages.length < 5 && (() => {
                  const imgRef = { current: null as HTMLInputElement | null };
                  return (
                    <>
                      <button
                        onClick={() => imgRef.current?.click()}
                        style={{ width:64, height:64, flexShrink:0, borderRadius:8,
                          border:'1.5px dashed #D0D0CC', background:'#FAFAFA',
                          cursor:'pointer', display:'flex', flexDirection:'column',
                          alignItems:'center', justifyContent:'center', gap:3,
                          fontSize:10, color:'#AAA', fontWeight:600 }}>
                        사진
                      </button>
                      <input
                        ref={imgRef}
                        type="file" accept="image/*" multiple style={{ display:'none' }}
                        onChange={e => {
                          if (!e.target.files) return;
                          const files = Array.from(e.target.files).slice(0, 5 - newImages.length);
                          setNewImages(prev => [...prev, ...files]);
                          e.target.value = '';
                        }}
                      />
                    </>
                  );
                })()}
                {/* 영상 추가 버튼 */}
                {!newVideo && (() => {
                  const vidRef = { current: null as HTMLInputElement | null };
                  return (
                    <>
                      <button
                        onClick={() => vidRef.current?.click()}
                        style={{ width:64, height:64, flexShrink:0, borderRadius:8,
                          border:'1.5px dashed #D0D0CC', background:'#FAFAFA',
                          cursor:'pointer', display:'flex', flexDirection:'column',
                          alignItems:'center', justifyContent:'center', gap:3,
                          fontSize:10, color:'#AAA', fontWeight:600 }}>
                        영상
                      </button>
                      <input
                        ref={vidRef}
                        type="file" accept="video/*" style={{ display:'none' }}
                        onChange={e => {
                          if (e.target.files?.[0]) { setNewVideo(e.target.files[0]); e.target.value = ''; }
                        }}
                      />
                    </>
                  );
                })()}
              </div>
            </div>

            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:8,
                color:'var(--color-ink-soft)' }}>
                리뷰 내용
                <span style={{ fontSize:12, color:'var(--color-accent)', fontWeight:600, marginLeft:6 }}>* 최소 10자 이상 작성해 주세요</span>
              </div>
              <textarea
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                placeholder="상품 품질, 맛, 배송 등 솔직한 후기를 남겨주세요. (최소 10자 이상 작성해야 등록할 수 있어요)"
                rows={5}
                style={{ width:'100%', padding:'12px 14px', border:'1.5px solid #E8E8E6',
                  borderRadius:10, fontSize:14, lineHeight:1.7, resize:'none', outline:'none',
                  fontFamily:'inherit', boxSizing:'border-box', color:'var(--color-ink)' }}
              />
              <div style={{ fontSize:12, color:'#bbb', textAlign:'right', marginTop:4 }}>
                {newContent.length}자
              </div>
            </div>

            {/* 리뷰 정책 동의 */}
            <div style={{ borderTop:'1px solid #F0F0F0', paddingTop:14 }}>
              <button type="button" onClick={() => setReviewPolicyOpen(o => !o)}
                style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
                  background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', padding:0 }}>
                <span style={{ fontSize:14, fontWeight:600, color:'#333' }}>델리오 리뷰 정책</span>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#999" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: reviewPolicyOpen ? 'rotate(90deg)' : 'none', transition:'transform .2s' }}>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
              <p style={{ fontSize:12, color:'#999', lineHeight:1.6, margin:'8px 0 0' }}>
                상품과 관련 없는 사진이나 내용, 동일 문자 반복 등 부적합한 내용은 삭제될 수 있습니다.
              </p>
              {reviewPolicyOpen && (
                <ul style={{ fontSize:12, color:'#888', lineHeight:1.8, margin:'8px 0 0', paddingLeft:16 }}>
                  <li>상품과 무관한 내용·사진, 광고/홍보성 후기는 삭제될 수 있어요.</li>
                  <li>욕설·비방, 동일 문구 반복 등은 삭제될 수 있어요.</li>
                  <li>타인의 개인정보가 포함된 후기는 삭제될 수 있어요.</li>
                </ul>
              )}
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer',
                fontSize:13.5, color:'#333', marginTop:14 }}>
                <input type="checkbox" checked={reviewPolicyAgree}
                  onChange={e => setReviewPolicyAgree(e.target.checked)} />
                델리오 리뷰 정책에 동의합니다
              </label>
            </div>

            </div>{/* /스크롤 본문 */}

            {/* 하단: 받을 수 있는 포인트 + 등록하기 */}
            <div style={{ flexShrink:0, borderTop:'1px solid #EEE', padding:'10px 16px 14px', background:'#fff' }}>
              {(reviewPt.text + reviewPt.photo) > 0 && (
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:13, marginBottom:8 }}>
                  <span style={{ color:'#888' }}>받을 수 있는 포인트</span>
                  <span style={{ fontWeight:700 }}>
                    <span style={{ color:'var(--color-accent)' }}>{((newContent.trim().length >= 10 ? reviewPt.text : 0) + ((newImages.length > 0 || newVideo) ? reviewPt.photo : 0)).toLocaleString()}</span>
                    <span style={{ color:'#bbb' }}> / {(reviewPt.text + reviewPt.photo).toLocaleString()}P</span>
                  </span>
                </div>
              )}
              {(() => {
                const blocked = submitting || mediaUploading || newContent.trim().length < 10 || !reviewPolicyAgree;
                return (
                  <button onClick={handleSubmitReview} disabled={blocked}
                    style={{ width:'100%', height:50, background:'#1A1A1A',
                      color:'#fff', border:'none', borderRadius:10, fontSize:15, fontWeight:700,
                      cursor: blocked ? 'not-allowed' : 'pointer',
                      opacity: blocked ? 0.5 : 1, transition:'opacity .15s' }}>
                    {mediaUploading ? '파일 업로드 중...' : submitting ? '등록 중...'
                      : !reviewPolicyAgree ? '리뷰 정책에 동의해 주세요' : '등록하기'}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── 모바일 고정 CTA ── */}
      {/* 만족/재구매 플로팅 필 (하단 구매바 위) — 모바일 전용 */}
      {bestStat && (
        <div className="pd-beststat">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
          </svg>
          <span>{bestStat.text}</span>
        </div>
      )}

      <div className="mobile-cta-bar">
        <button onClick={toggleWishlist} aria-label="찜하기"
          style={{ flexShrink:0, width:46, border:'1.5px solid #DDDDD9',
            background:'#fff', borderRadius:8, cursor:'pointer', color: wishlisted ? '#E53935' : '#1A1A1A',
            display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Heart size={20} strokeWidth={1.8} fill={wishlisted ? '#E53935' : 'none'} />
        </button>
        <button onClick={() => showToast('선물하기 기능은 준비 중입니다.')}
          style={{ flexShrink:0, width:46, border:'1.5px solid #DDDDD9',
            background:'#fff', borderRadius:8, cursor:'pointer', color:'var(--color-accent)',
            display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
            <polyline points="20 12 20 22 4 22 4 12"/>
            <rect x="2" y="7" width="20" height="5"/>
            <line x1="12" y1="22" x2="12" y2="7"/>
            <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 3 12 7 12 7z"/>
            <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 3 12 7 12 7z"/>
          </svg>
        </button>
        <button className="btn btn-secondary btn-flex-1" onClick={() => openOptionDrawer(product.id)}>
          장바구니
        </button>
        <button className="btn btn-primary btn-flex-2" onClick={() => openOptionDrawer(product.id)}>
          바로 구매하기
        </button>
      </div>
      {/* ── 토스트 알림 ── */}
      {/* ── 쿠폰 다운로드 모달 ── */}
      {couponDownOpen && (
        <div onClick={() => setCouponDownOpen(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:3500, display:'flex',
            alignItems: isMobile ? 'flex-end' : 'center', justifyContent:'center', padding: isMobile ? 0 : 16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'#fff', borderRadius: isMobile ? '16px 16px 0 0' : 16, width:'100%', maxWidth:440, maxHeight:'80vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 18px', borderBottom:'1px solid #F0F0F0' }}>
              <span style={{ fontSize:16, fontWeight:800 }}>🎟️ 쿠폰 다운받기</span>
              <button onClick={() => setCouponDownOpen(false)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#888', lineHeight:1 }}>✕</button>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'14px 18px' }}>
              {downCoupons.length === 0 ? (
                <div style={{ textAlign:'center', color:'#aaa', fontSize:14, padding:'30px 0' }}>받을 수 있는 쿠폰이 없습니다.</div>
              ) : downCoupons.map(c => (
                <div key={c.id} style={{ border:'1px solid #EEE', borderRadius:10, padding:'14px 16px', marginBottom:10, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:18, fontWeight:800, color:'#CB1D11' }}>
                      {c.discount_type === 'percent' ? `${c.discount_value}%` : `${c.discount_value.toLocaleString()}원`}
                    </div>
                    <div style={{ fontSize:13, fontWeight:600, color:'#1A1A1A', marginTop:2 }}>{c.name}</div>
                    <div style={{ fontSize:12, color:'#888', marginTop:3 }}>
                      {c.min_order_amount > 0 ? `${c.min_order_amount.toLocaleString()}원 이상 구매 시` : '구매 금액 제한 없음'}
                      {c.max_discount_amount ? ` · 최대 ${c.max_discount_amount.toLocaleString()}원` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding:'12px 18px calc(12px + env(safe-area-inset-bottom))', borderTop:'1px solid #F0F0F0' }}>
              <button onClick={claimCoupons} disabled={claiming || downCoupons.length === 0}
                style={{ width:'100%', height:50, border:'none', borderRadius:10, fontSize:15, fontWeight:700, cursor: (claiming || downCoupons.length===0) ? 'default' : 'pointer',
                  background: (claiming || downCoupons.length===0) ? '#bbb' : '#1A1A1A', color:'#fff' }}>
                {claiming ? '받는 중...' : !user ? '로그인하고 받기' : `쿠폰 ${downCoupons.length}장 모두 받기`}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(26,26,26,0.92)', color: '#fff',
          padding: '10px 20px', borderRadius: 99,
          fontSize: 13, fontWeight: 600, zIndex: 9999,
          pointerEvents: 'none', whiteSpace: 'nowrap',
          animation: 'fadeInUp .2s ease',
        }}>
          {toast}
        </div>
      )}
    </>
  );
}
