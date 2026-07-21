'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import '@/styles/admin.css';
import '@/styles/login.css';
import { StarRating } from '@/components/StarRating';
import TrackingModal from '@/components/TrackingModal/TrackingModal';
import { loadAllTabs, type FilterTab, type TabType } from '@/lib/filterTabs';
import { effectivePointRatePct, pendingPointChange } from '@/lib/points';
import { DEFAULT_TIERS, type MembershipTier } from '@/lib/membership';
import { SELLER_AXES } from '@/lib/taste';
import SectionCuration from '@/components/admin/SectionCuration';
import dynamic from 'next/dynamic';

const ImageDetailEditor = dynamic(
  () => import('@/components/ImageDetailEditor/ImageDetailEditor'),
  { ssr: false }
);
const InfoSectionEditor = dynamic(
  () => import('@/components/InfoSectionEditor/InfoSectionEditor'),
  { ssr: false }
);
import type { InfoContent } from '@/components/InfoSectionEditor/InfoSectionEditor';

/* ===== 상품 카드 미리보기 (스토어프론트 카드와 동일 스타일) ===== */
const PREVIEW_EMOJI: Record<string, string> = {
  apple:'🍎', citrus:'🍊', berry:'🫐', melon:'🍈',
  kiwi:'🥝', mango:'🥭', grape:'🍇', gift:'🎁', default:'🍑',
};
const PREVIEW_BG: Record<string, string> = {
  apple:'#FFE8E8', citrus:'#FFF3E0', berry:'#F3E5F5', melon:'#E8F5E9',
  kiwi:'#F1F8E9', mango:'#FFF9E6', grape:'#EDE7F6', gift:'#E8EAF6',
};
interface PreviewProps {
  name: string; shortDesc: string; price: number; discountRate: number;
  thumbnailUrl: string; category: string; isDawn: boolean;
  isNew: boolean; isBest: boolean; badge: string; badgeColor: string;
  mode: 'pc' | 'mobile';
}
function ProductPreviewCard(p: PreviewProps) {
  const mob = p.mode === 'mobile';
  const emoji = PREVIEW_EMOJI[p.category] || PREVIEW_EMOJI.default;
  const bg    = PREVIEW_BG[p.category]    || '#F4EFE6';
  const rate  = Math.max(0, Math.min(99, Math.round(p.discountRate || 0)));
  const discounted = rate > 0 ? Math.round(p.price * (1 - rate / 100)) : p.price;
  const fmt = (n: number) => (n || 0).toLocaleString('ko-KR');
  const deliveryStyle: React.CSSProperties = p.isDawn
    ? { background:'#F0FBF4', color:'#1E8A4C', border:'1px solid #7BD4A0' }
    : { background:'#FFF6EE', color:'#D9600A', border:'1px solid #F4A96A' };
  return (
    <div style={{ width: mob ? 172 : 230, display:'flex', flexDirection:'column' }}>
      {/* 이미지 영역 */}
      <div style={{ position:'relative', aspectRatio:'1', borderRadius:8, background:'#fff',
        boxShadow:'0 2px 8px rgba(0,0,0,.06)', overflow:'hidden' }}>
        {p.thumbnailUrl
          ? <img src={p.thumbnailUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center',
              fontSize: mob ? 46 : 60, background:`linear-gradient(135deg,${bg} 0%,#fff 100%)` }}>{emoji}</div>}
        <span style={{ position:'absolute', top:8, left:8, fontSize:12, fontWeight:700,
          padding:'3px 7px', borderRadius:4, letterSpacing:'0.3px', ...deliveryStyle }}>
          {p.isDawn ? '산지직송' : '자사배송'}
        </span>
        {/* 모바일: 우하단 담기 버튼 */}
        {mob && (
          <span style={{ position:'absolute', right:8, bottom:8, width:34, height:34, borderRadius:'50%',
            background:'#fff', boxShadow:'0 1px 4px rgba(0,0,0,.18)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>
              <path d="M2.05 2.05h2l2.66 12.42a2 2 0 001.95 1.53h9.58a2 2 0 001.95-1.53l1.54-8.42H5.05"/>
            </svg>
          </span>
        )}
      </div>
      {/* 본문 */}
      <div style={{ padding:'10px 6px 12px', display:'flex', flexDirection:'column', flex:1 }}>
        {/* 뱃지 — 모바일 카드는 스토어에서 숨김 */}
        {!mob && (
          <div style={{ height:22, display:'flex', alignItems:'center', gap:4, marginBottom:6 }}>
            {p.isNew  && <span style={{ fontSize:11, fontWeight:700, padding:'2px 6px', borderRadius:4, background:'#1A1A1A', color:'#fff' }}>NEW</span>}
            {p.isBest && <span style={{ fontSize:11, fontWeight:800, padding:'2px 6px', borderRadius:4, background:'#1A1A1A', color:'#fff' }}>인기</span>}
            {p.badge  && <span style={{ fontSize:11, fontWeight:700, padding:'2px 6px', borderRadius:4, background:p.badgeColor || '#1A1A1A', color:'#fff' }}>{p.badge}</span>}
          </div>
        )}
        <div style={{ fontSize: mob ? 14 : 17, fontWeight:600, color:'#1A1A1A', lineHeight:1.4,
          marginBottom:2, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical',
          overflow:'hidden', minHeight:'2.8em' }}>
          {p.name || '상품명을 입력하세요'}
        </div>
        {p.shortDesc && (
          <div style={{ fontSize: mob ? 12 : 13, color:'#8A8A8A', marginBottom:6,
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', lineHeight:1.5 }}>{p.shortDesc}</div>
        )}
        <div style={{ marginTop:'auto', display:'flex', flexDirection:'column' }}>
          {rate > 0 && (
            <div style={{ marginBottom:1 }}>
              <span style={{ fontSize: mob ? 12 : 14, color:'#bbb', textDecoration:'line-through' }}>{fmt(p.price)}원</span>
            </div>
          )}
          <div style={{ display:'flex', alignItems:'baseline', gap:4, flexWrap:'wrap' }}>
            {rate > 0 && <span style={{ fontSize: mob ? 15 : 19, fontWeight:800, color:'#E53E3E' }}>{rate}%</span>}
            <span style={{ fontSize: mob ? 15 : 19, fontWeight:800, color:'#1A1A1A' }}>{fmt(discounted)}원</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* 토글 스위치 (마케팅 동의 버튼식) — 켜짐=검정 */
function AdmToggle({ on, onChange, title }: { on: boolean; onChange: (v: boolean) => void; title?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} title={title} onClick={() => onChange(!on)}
      style={{ width: 38, height: 22, borderRadius: 999, border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0,
        background: on ? '#1A1A1A' : '#D1D5DB', position: 'relative', transition: 'background .15s' }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 18, height: 18, borderRadius: '50%',
        background: '#fff', transition: 'left .15s', boxShadow: '0 1px 2px rgba(0,0,0,0.25)' }} />
    </button>
  );
}

/* 드래그 핸들(순서변경 그립) */
function DragHandle() {
  return (
    <span aria-hidden style={{ cursor: 'grab', color: '#B8B8B8', fontSize: 15, lineHeight: 1, flexShrink: 0, userSelect: 'none', letterSpacing: '-2px' }}>⠿⠿</span>
  );
}

/* ===== 타입 ===== */
type PanelKey = 'dashboard'|'orders'|'products'|'menu'|'farms'|'reviews'|'coupon'|'banner'|'events'|'lounge'|'homesections'|'members'|'referral'|'sms'|'inquiry'|'faq'|'cs'|'productinquiry'|'refund'|'settlement'|'farmsettle'|'tasteprofile'|'analytics'|'settings';

interface DashboardStats {
  monthRevenue: number;
  todayRevenue: number;
  monthOrders: number;
  todayOrders: number;
  totalMembers: number;
}

interface OrderItem {
  id?: string;
  product_name: string;
  option_label?: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  thumbnail_url: string | null;
  farm_id?: string | null;
  farm_name?: string | null;
  carrier?: string | null;          // 농가 지정 택배사
  courier?: string | null;          // 등록된 택배사 코드
  tracking_number?: string | null;  // 송장번호
  ship_status?: string | null;      // preparing | shipped | delivered
}
interface Order {
  id: string;
  order_no: string;
  user_id: string | null;
  status: string;
  final_amount: number;
  total_amount?: number | null;
  coupon_discount?: number | null;
  point_used?: number | null;
  recipient: string;
  phone: string;
  orderer_name?: string | null;
  orderer_phone?: string | null;
  zipcode: string | null;
  address1: string;
  address2: string | null;
  payment_method: string;
  created_at: string;
  courier: string | null;
  tracking_number: string | null;
  delivery_memo: string | null;
  delay_notified_at?: string | null;
  order_items?: OrderItem[];
}

/** 주문 알림 발송 — 여러 번호에 중복 없이 발송(숫자만 기준 dedupe).
 *  배송 관련은 [수령인, 주문자] 양쪽, 결제 관련은 [주문자]만 넘기면 됨. */
function notifyOrderPhones(phones: (string | null | undefined)[], payload: Record<string, unknown>) {
  const uniq = [...new Set(phones.map(p => (p || '').replace(/[^0-9]/g, '')).filter(Boolean))];
  uniq.forEach(ph => {
    fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, phone: ph }) }).catch(() => {});
  });
}

/** 주문 대표 상품명 — 알림톡 변수용 (첫 상품 + 외 N건) */
function orderProductName(o: Order): string {
  const items = o.order_items || [];
  if (items.length === 0) return '주문상품';
  return items[0].product_name + (items.length > 1 ? ` 외 ${items.length - 1}건` : '');
}

interface AdminProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  discount_rate: number;
  discounted_price: number;
  is_active: boolean;
  farm_id: string | null;
  sort_order: number;
  created_at: string;
  total_stock?: number | null;
}

interface AdminProductFull extends AdminProduct {
  sku: string;
  supply_price: number;
  origin: string;
  origin_region: string | null;
  short_desc: string | null;
  thumbnail_url: string | null;
  image_urls: (string | null)[] | null;
  dispatch_cutoff: string | null;
  brix: number | null;
  badge: string | null;
  badge_color: string | null;
  is_new: boolean;
  is_best: boolean;
  is_dawn: boolean;
  show_stat_pill: boolean;
  seller_score: Record<string, number> | null;
}

interface AdminFarmSimple {
  id: string;
  name: string;
  is_own?: boolean;
}

interface AdminFarm {
  id: string;
  slug: string;
  name: string;
  farmer_name: string | null;
  region: string | null;
  farm_type: string | null;   // 사용 안 함(과거 노지/비닐하우스). items 로 대체
  items: string[] | null;     // 취급 품목(복수)
  intro: string | null;
  carrier: string | null;
  /* 출고마감시간 — null이면 사이트 전체 설정을 따름. 값이 있으면 이 브랜드 상품의 기본값 */
  dispatch_cutoff: string | null;
  /* 은행정보는 farms에 두지 않음 — farms는 anon 조회가 열려 있어 계좌가 노출됨.
     관리자 전용 farm_bank_info 테이블에 분리 보관 */
  thumbnail_url: string | null;
  logo_url: string | null;
  landing_images: string[] | null;
  created_at: string;
  wish_count?: number;
  product_count?: number;
  active_count?: number;
  review_count?: number;
  avg_rating?: number;
}

interface AdminProfile {
  id: string;
  email: string;
  name: string;
  grade: string;
  point_balance: number;
  created_at: string;
  phone: string | null;
  is_blocked: boolean;
  memo: string | null;
  provider?: string | null;
  marketing_sms?: boolean | null;
}

interface AdminReview {
  id: string;
  product_id: string;
  rating: number;
  content: string;
  is_best: boolean;
  likes_count: number;
  image_urls: string[] | null;
  report_count?: number;
  report_reasons?: string[];
  created_at: string;
  seller_reply?: string | null;
  seller_replied_at?: string | null;
  profiles: { name: string | null; email: string } | null;
  products: { name: string; farm_id: string | null } | null;
}

interface AdminEvent {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  badge: string | null;
  badge_color: string | null;
  thumbnail_url: string | null;
  image_url: string | null;
  content: string | null;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  created_at: string;
}

interface AdminLoungePost {
  id: number;
  filter: string;
  title: string;
  badge: string;
  date: string;
  thumbnail_url: string | null;
  image_url: string | null;
  content: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

interface FarmInquiry {
  id: string;
  inquiry_type: string;
  company: string;
  contact: string;
  email: string;
  message: string;
  status: string;
  created_at: string;
}

interface AdminBanner {
  id: string;
  type: string;
  sort_order: number;
  image_url: string | null;
  image_url_mobile: string | null;
  link_url: string;
  is_active: boolean;
  view_count?: number;
  click_count?: number;
  created_at: string;
}

interface AdminSurveyResult {
  id: string;
  user_id: string | null;
  gender: string | null;
  age_group: string | null;
  family_size: string | null;
  result_type: string | null;
  result_label: string | null;
  axis1: string | null;
  axis2: string | null;
  axis3: string | null;
  purchase_frequency: string | null;
  purchase_purpose: string | null;
  decision_factor: string | null;
  created_at: string;
  profiles: { name: string; email: string } | null;
}

interface AdminReferral {
  id: string;
  referrer_id: string;
  referred_id: string;
  rewarded: boolean;
  rewarded_at: string | null;
  created_at: string;
  referrer: { name: string; email: string } | null;
  referred: { name: string; email: string } | null;
}

interface AdminRefundReq {
  id: string;
  order_id: string | null;
  reason: string;
  detail: string;
  status: string; // pending | processing | completed | rejected | hold
  reject_reason?: string | null;
  created_at: string;
  type?: string; // 'cancel' | 'refund'
  orders: { order_no: string; final_amount: number; status: string; portone_payment_id: string | null } | null;
  profiles: { name: string | null; email: string | null } | null;
}

interface AdminProductInquiry {
  id: string;
  product_id: string;
  user_id: string | null;
  category: string;
  content: string;
  is_private: boolean;
  answer: string | null;
  answered_at: string | null;
  created_at: string;
  products: { name: string } | null;
}

interface FaqItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

interface AdminCoupon {
  id: string; code: string | null; name: string;
  discount_type: 'percent' | 'fixed'; discount_value: number;
  min_order_amount: number; max_discount_amount: number | null;
  starts_at: string; expires_at: string | null; is_active: boolean; is_public: boolean; signup_grant?: boolean; is_membership?: boolean; description?: string | null; valid_days?: number | null; created_at: string;
}

interface CsInquiryAdmin {
  id: string;
  user_id: string;
  category: string;
  title: string;
  message: string;
  status: string;
  answer?: string;
  attachments?: string[];
  created_at: string;
}

/* ===== 상수 ===== */
const TITLES: Record<PanelKey, string> = {
  dashboard:'대시보드', orders:'주문 관리', products:'상품 관리', menu:'메뉴 관리', farms:'브랜드 관리',
  reviews:'리뷰 관리', coupon:'쿠폰 / 포인트', banner:'배너 / 팝업', events:'이벤트',
  lounge:'라운지 관리', homesections:'메인페이지 섹션관리', members:'회원 관리', referral:'친구 추천', sms:'SMS 발송',
  inquiry:'입점 문의', faq:'FAQ 관리', cs:'1:1 문의 관리', productinquiry:'상품 문의',
  refund:'환불 관리', settlement:'정산 관리', farmsettle:'농가 정산', tasteprofile:'취향 프로파일', analytics:'마케팅 분석', settings:'설정',
};

const FAQ_CATS: Record<string, string> = {
  delivery:'배송', return:'취소/교환/반품', order:'결제/주문',
  product:'상품', member:'회원관련', etc:'기타',
};

const CS_CAT_LABEL: Record<string, string> = {
  order:'주문/배송', return:'취소/교환/반품', product:'상품',
  member:'회원/계정', other:'기타',
};

const STATUS_LABEL: Record<string, string> = {
  pending:'결제대기', paid:'결제완료', preparing:'배송준비중',
  shipped:'배송중', delivered:'배송완료', confirmed:'구매확정', cancelled:'취소',
  refunding:'환불처리중', refunded:'환불완료',
};

const STATUS_BADGE_CLS: Record<string, string> = {
  pending:'badge-wait', paid:'badge-paid', preparing:'badge-ready',
  shipped:'badge-shipping', delivered:'badge-done', confirmed:'badge-done', cancelled:'badge-off',
  refunding:'badge-refund', refunded:'badge-off',
};

/* 주문 상태 변경 버튼 — 선택 시 주문관리 표 뱃지와 동일 색상 */
const STATUS_BTN_COLOR: Record<string, { bg: string; color: string; border: string }> = {
  preparing: { bg:'#FFF7ED', color:'#C2410C', border:'#FDBA74' }, // 배송준비중(주황)
  shipped:   { bg:'#F0FDF4', color:'#15803D', border:'#86EFAC' }, // 배송중(초록)
  delivered: { bg:'#F1F5F9', color:'#475569', border:'#CBD5E1' }, // 배송완료(회색)
  cancelled: { bg:'#FEF2F2', color:'#B91C1C', border:'#FCA5A5' }, // 취소(빨강)
  refunded:  { bg:'#FEF2F2', color:'#DC2626', border:'#FCA5A5' }, // 환불(빨강)
};

/* 결제수단 뱃지 — 카드 회색 / 네이버 초록 / 카카오 노랑 */
const PAY_INFO: Record<string, { label: string; bg: string; color: string }> = {
  card:  { label:'카드',   bg:'#F1F5F9', color:'#475569' },
  naver: { label:'네이버', bg:'#E7F7EC', color:'#03C75A' },
  kakao: { label:'카카오', bg:'#FEE500', color:'#3C1E1E' },
  toss:  { label:'토스',   bg:'#E9F1FE', color:'#3182F6' },
  vbank: { label:'무통장', bg:'#F1F5F9', color:'#475569' },
};
function PayBadge({ method }: { method: string }) {
  const info = PAY_INFO[method] || { label: method || '기타', bg:'#F1F5F9', color:'#475569' };
  return (
    <span style={{ display:'inline-block', marginLeft:8, padding:'2px 9px', borderRadius:6,
      background: info.bg, color: info.color, fontSize:12, fontWeight:700, verticalAlign:'middle' }}>
      {info.label}
    </span>
  );
}

/* YYYY-MM-DD 포맷 (날짜 input 값) */
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/* 농가 유형 = 재배 형태 프리셋 (추가 가능 — 직접입력도 허용) */
const FARM_TYPE_PRESETS = ['과수원', '비닐하우스', '노지', '스마트팜'];

/* 마케팅 분석 기본 Looker Studio 임베드 URL (설정값 없을 때 사용) */
const LOOKER_DEFAULT_URL = 'https://datastudio.google.com/embed/reporting/246d1604-471d-46e6-ab6f-f385f581ea36/page/e7Z0F';

/* 국내 시·도 (원산지 계층 입력용) */
const SIDO_LIST: string[] = [
  '서울특별시','부산광역시','대구광역시','인천광역시','광주광역시','대전광역시','울산광역시','세종특별자치시',
  '경기도','강원특별자치도','충청북도','충청남도','전북특별자치도','전라남도','경상북도','경상남도','제주특별자치도',
];

/* 시·도별 시·군·구 (원산지 세부 드롭다운용) — 세종은 시군구 없음 */
const SIGUNGU_MAP: Record<string, string[]> = {
  '서울특별시': ['종로구','중구','용산구','성동구','광진구','동대문구','중랑구','성북구','강북구','도봉구','노원구','은평구','서대문구','마포구','양천구','강서구','구로구','금천구','영등포구','동작구','관악구','서초구','강남구','송파구','강동구'],
  '부산광역시': ['중구','서구','동구','영도구','부산진구','동래구','남구','북구','해운대구','사하구','금정구','강서구','연제구','수영구','사상구','기장군'],
  '대구광역시': ['중구','동구','서구','남구','북구','수성구','달서구','달성군','군위군'],
  '인천광역시': ['중구','동구','미추홀구','연수구','남동구','부평구','계양구','서구','강화군','옹진군'],
  '광주광역시': ['동구','서구','남구','북구','광산구'],
  '대전광역시': ['동구','중구','서구','유성구','대덕구'],
  '울산광역시': ['중구','남구','동구','북구','울주군'],
  '세종특별자치시': [],
  '경기도': ['수원시','성남시','의정부시','안양시','부천시','광명시','평택시','동두천시','안산시','고양시','과천시','구리시','남양주시','오산시','시흥시','군포시','의왕시','하남시','용인시','파주시','이천시','안성시','김포시','화성시','광주시','양주시','포천시','여주시','연천군','가평군','양평군'],
  '강원특별자치도': ['춘천시','원주시','강릉시','동해시','태백시','속초시','삼척시','홍천군','횡성군','영월군','평창군','정선군','철원군','화천군','양구군','인제군','고성군','양양군'],
  '충청북도': ['청주시','충주시','제천시','보은군','옥천군','영동군','증평군','진천군','괴산군','음성군','단양군'],
  '충청남도': ['천안시','공주시','보령시','아산시','서산시','논산시','계룡시','당진시','금산군','부여군','서천군','청양군','홍성군','예산군','태안군'],
  '전북특별자치도': ['전주시','군산시','익산시','정읍시','남원시','김제시','완주군','진안군','무주군','장수군','임실군','순창군','고창군','부안군'],
  '전라남도': ['목포시','여수시','순천시','나주시','광양시','담양군','곡성군','구례군','고흥군','보성군','화순군','장흥군','강진군','해남군','영암군','무안군','함평군','영광군','장성군','완도군','진도군','신안군'],
  '경상북도': ['포항시','경주시','김천시','안동시','구미시','영주시','영천시','상주시','문경시','경산시','의성군','청송군','영양군','영덕군','청도군','고령군','성주군','칠곡군','예천군','봉화군','울진군','울릉군'],
  '경상남도': ['창원시','진주시','통영시','사천시','김해시','밀양시','거제시','양산시','의령군','함안군','창녕군','고성군','남해군','하동군','산청군','함양군','거창군','합천군'],
  '제주특별자치도': ['제주시','서귀포시'],
};

/* 뱃지 색상 프리셋 (배경 hex) */
const BADGE_COLORS: { label: string; value: string }[] = [
  { label: '빨강', value: '#CB1D11' },
  { label: '주황', value: '#E8741E' },
  { label: '초록', value: '#1F9D55' },
  { label: '파랑', value: '#2563EB' },
  { label: '보라', value: '#7C3AED' },
  { label: '검정', value: '#1A1A1A' },
];
const BADGE_DEFAULT_COLOR = '#CB1D11';

/* 출발 마감 시간 선택지 (08:00~21:00, 30분 간격) */
const CUTOFF_TIMES: string[] = (() => {
  const arr: string[] = [];
  for (let h = 8; h <= 21; h++) { arr.push(`${String(h).padStart(2,'0')}:00`); if (h !== 21) arr.push(`${String(h).padStart(2,'0')}:30`); }
  return arr;
})();
function cutoffLabel(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${h12}시${m ? ' 30분' : ''}`;
}

/* ===== 브랜드 분석 — 지표 계산 & 증감 표시 =====
   매출 인정 기준은 정산 탭과 동일(배송완료·구매확정). 두 화면 숫자가 어긋나면 정산 분쟁이 남. */
const FA_SALES_ST  = ['delivered', 'confirmed'];
const FA_CANCEL_ST = ['cancelled', 'refunded'];

interface FarmRawItem {
  order_id: string; product_id: string; option_label: string | null;
  quantity: number; subtotal: number; supply_price: number | null;
  orders: { status: string; created_at: string; user_id: string | null } | null;
}
interface FarmRawReview { id: string; rating: number; content: string; created_at: string; product_id: string }
interface FarmRawOption {
  id: string; product_id: string; label: string | null; group_name: string | null;
  purchase_price: number | null; shipping_fee: number | null; supply_price: number | null;
}

/* 증감 종류
   money/count : 변화율(%)   · 증가=초록
   rate        : 변화폭(%p)  · 증가=초록
   inverse     : 변화폭(%p)  · 증가=빨강 (낮을수록 좋은 지표 — 반품·취소율)
   rating      : 점수차       · 증가=초록
   flat        : 색 없음, 화살표 '-' 고정 (평균 객단가) */
type DeltaKind = 'money' | 'count' | 'rate' | 'inverse' | 'rating' | 'flat';

function FaDelta({ cur, prev, kind, unit }: { cur: number; prev: number; kind: DeltaKind; unit?: string }) {
  const GRAY = '#94A3B8', UP = '#16A34A', DOWN = '#DC2626';
  const none = <div style={{ fontSize:11, color:GRAY, marginTop:3 }}>— 전월대비</div>;
  if (kind === 'flat') return none;

  const diff = cur - prev;
  if (Math.abs(diff) < 1e-9) return none;          // 전월과 값이 같음

  const up = diff > 0;
  const good = kind === 'inverse' ? !up : up;
  const color = good ? UP : DOWN;
  const pctBase = kind === 'money' || kind === 'count';

  /* 전월이 0이면 변화율(÷0)을 낼 수 없다. 대신 늘어난 양을 그대로 보여준다.
     비율(%p)·평점(점수차)은 애초에 뺄셈이라 이 문제가 없음. */
  const text =
    pctBase && prev === 0 ? (unit === '원' ? `${fmtPrice(Math.abs(diff))}원` : `${Math.abs(diff).toLocaleString()}${unit || ''}`)
    : pctBase             ? `${Math.abs(diff / prev * 100).toFixed(1)}%`
    : kind === 'rating'   ? `${Math.abs(diff).toFixed(1)}점`
    :                       `${Math.abs(diff).toFixed(1)}%p`;

  return (
    <div style={{ fontSize:11, color, marginTop:3, fontWeight:600 }}>
      {up ? '↑' : '↓'} {text} <span style={{ fontWeight:400 }}>전월대비</span>
    </div>
  );
}

/* 원자료를 받아 기간별 지표를 계산. 조회는 한 번만 하고 기간 전환은 전부 여기서 다시 계산한다. */
function computeFarmStats(
  items: FarmRawItem[], reviews: FarmRawReview[], options: FarmRawOption[],
  prodName: Map<string, string>, chartFrom: Date, chartTo: Date,
) {
  const now = new Date();
  const curFrom  = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const inRange = (iso: string | undefined, f: Date, t: Date) => {
    if (!iso) return false;
    const d = new Date(iso);
    return d >= f && d < t;
  };

  /* 한 기간의 금액·건수 지표 */
  const agg = (f: Date, t: Date) => {
    const sold = items.filter(it => FA_SALES_ST.includes(it.orders?.status || '') && inRange(it.orders?.created_at, f, t));
    let sales = 0, payout = 0, qty = 0;
    const orderSet = new Set<string>();
    sold.forEach(it => {
      const q = it.quantity || 0;
      sales  += it.subtotal || 0;
      payout += (it.supply_price || 0) * q;   // 공급가에 농가 배송비가 이미 포함되어 있음
      qty    += q;
      if (it.order_id) orderSet.add(it.order_id);
    });
    const orderCount = orderSet.size;

    /* 반품·취소율 = 취소·환불 주문수 / 전체 주문수 (해당 기간에 이 브랜드 상품이 담긴 주문 기준) */
    const periodAll = items.filter(it => inRange(it.orders?.created_at, f, t));
    const allOrders = new Set(periodAll.map(it => it.order_id));
    const badOrders = new Set(periodAll.filter(it => FA_CANCEL_ST.includes(it.orders?.status || '')).map(it => it.order_id));
    const cancelRate = allOrders.size ? badOrders.size / allOrders.size * 100 : 0;

    /* 재구매율 = 기간 내 주문 중 '그 고객의 이 브랜드 첫 주문이 아닌' 주문의 비율 */
    const firstSeen = new Map<string, number>();
    items.filter(it => FA_SALES_ST.includes(it.orders?.status || '')).forEach(it => {
      const u = it.orders?.user_id; if (!u || !it.orders?.created_at) return;
      const ts = new Date(it.orders.created_at).getTime();
      if (!firstSeen.has(u) || ts < (firstSeen.get(u) as number)) firstSeen.set(u, ts);
    });
    const seenOrder = new Set<string>();
    let repeatOrders = 0, totalUserOrders = 0;
    sold.forEach(it => {
      const u = it.orders?.user_id; const oid = it.order_id;
      if (!u || !oid || seenOrder.has(oid)) return;
      seenOrder.add(oid);
      totalUserOrders++;
      if (new Date(it.orders!.created_at).getTime() > (firstSeen.get(u) as number)) repeatOrders++;
    });
    const repurchase = totalUserOrders ? repeatOrders / totalUserOrders * 100 : 0;

    const revs = reviews.filter(r => inRange(r.created_at, f, t));
    const avgRating = revs.length ? revs.reduce((s, r) => s + (r.rating || 0), 0) / revs.length : 0;

    return {
      sales, payout, margin: sales - payout, qty, orderCount,
      aov: orderCount ? Math.round(sales / orderCount) : 0,
      reviewCount: revs.length, avgRating, repurchase, cancelRate,
    };
  };

  const cur  = agg(curFrom,  new Date(now.getFullYear(), now.getMonth() + 1, 1));
  const prev = agg(prevFrom, curFrom);

  /* 누적 매출액 — 등록일~현재 (기간 제한 없음) */
  const cumulative = items
    .filter(it => FA_SALES_ST.includes(it.orders?.status || ''))
    .reduce((s, it) => s + (it.subtotal || 0), 0);

  /* 월별 매출 추이 — 선택 기간을 월 단위로 채움(매출 없는 달도 0으로 표시) */
  const mMap: Record<string, number> = {};
  const cursor = new Date(chartFrom.getFullYear(), chartFrom.getMonth(), 1);
  while (cursor < chartTo) {
    mMap[`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`] = 0;
    cursor.setMonth(cursor.getMonth() + 1);
  }
  items.filter(it => FA_SALES_ST.includes(it.orders?.status || '') && inRange(it.orders?.created_at, chartFrom, chartTo))
    .forEach(it => {
      const d = new Date(it.orders!.created_at);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (k in mMap) mMap[k] += it.subtotal || 0;
    });
  const monthly = Object.entries(mMap).map(([ym, amount]) => ({ ym, amount })).sort((a, b) => a.ym.localeCompare(b.ym));

  /* 인기 상품 TOP5 — 상품+옵션 단위. 마진액 = 매출 - 공급가×수량 */
  const pMap: Record<string, { name: string; option: string; orders: Set<string>; amount: number; margin: number; qty: number }> = {};
  items.filter(it => FA_SALES_ST.includes(it.orders?.status || '')).forEach(it => {
    const nm = prodName.get(it.product_id) || '(삭제된 상품)';
    const op = it.option_label || '';
    const key = nm + ' ' + op;
    if (!pMap[key]) pMap[key] = { name: nm, option: op, orders: new Set(), amount: 0, margin: 0, qty: 0 };
    const q = it.quantity || 0;
    pMap[key].amount += it.subtotal || 0;
    pMap[key].margin += (it.subtotal || 0) - (it.supply_price || 0) * q;
    pMap[key].qty    += q;
    if (it.order_id) pMap[key].orders.add(it.order_id);
  });
  const topProducts = Object.values(pMap)
    .map(v => ({ name: v.name, option: v.option, orders: v.orders.size, amount: v.amount, margin: v.margin, qty: v.qty }))
    .sort((a, b) => b.amount - a.amount).slice(0, 5);

  const recentReviews = reviews.slice(0, 5).map(r => ({ ...r, product_name: prodName.get(r.product_id) || '' }));

  /* 공급가 미입력 진단
     - now  : 지금 옵션에 매입가가 비어 있는 것. 채우면 앞으로의 주문부터 정산액에 반영됨
     - past : 이미 팔린 주문 중 공급가 0으로 박제된 것. 지금 채워도 소급되지 않음
     공급가가 0이면 총이익이 매출 전액으로 잡혀 실제보다 부풀려진다. */
  const missingNow = options
    .filter(o => !o.supply_price)
    .map(o => ({
      product: prodName.get(o.product_id) || '(삭제된 상품)',
      option: [o.group_name, o.label].filter(Boolean).join(' · ') || '기본',
    }));

  const pastMap: Record<string, { product: string; option: string; qty: number; amount: number }> = {};
  items.filter(it => FA_SALES_ST.includes(it.orders?.status || '') && !it.supply_price).forEach(it => {
    const product = prodName.get(it.product_id) || '(삭제된 상품)';
    const option = it.option_label || '기본';
    const k = product + '||' + option;
    if (!pastMap[k]) pastMap[k] = { product, option, qty: 0, amount: 0 };
    pastMap[k].qty += it.quantity || 0;
    pastMap[k].amount += it.subtotal || 0;
  });
  const missingPast = Object.values(pastMap).sort((a, b) => b.amount - a.amount);
  const missingPastAmount = missingPast.reduce((s, m) => s + m.amount, 0);

  return { cur, prev, cumulative, monthly, topProducts, recentReviews, missingNow, missingPast, missingPastAmount };
}

/* 주문 단계 플로우 (대시보드·주문관리 공용) — 스마트스토어식 */
const ORDER_STAGES: { key: string; label: string }[] = [
  { key:'paid',      label:'신규주문' },
  { key:'preparing', label:'배송준비' },
  { key:'shipped',   label:'배송중' },
  { key:'delivered', label:'배송완료' },
  { key:'confirmed', label:'구매확정' },
];
/* 매출·주문 집계 시 유효로 인정하는 주문 상태(취소·환불·무통장 미입금 제외) — 판매성과와 동일 기준 */
const VALID_ORDER_STATUS = ORDER_STAGES.map(s => s.key);

const GRADE_LABEL: Record<string, string> = {
  beginner:'비기너', taster:'테이스터', buyer:'바이어', master:'마스터',
};

const GRADE_BADGE_CLS: Record<string, string> = {
  beginner:'badge-normal', taster:'badge-silver', buyer:'badge-gold', master:'badge-gold',
};

/* 등급 산정 기준(분기 누적) — 회원 등급변경 안내용 */
const GRADE_CRITERIA: Record<string, string> = {
  beginner:'10만원 미만', taster:'10만원 이상', buyer:'30만원·3회 이상', master:'150만원·5회 이상',
};

const CAT_LABEL: Record<string, string> = {
  apple:'사과/배', citrus:'감귤류', berry:'베리류', melon:'멜론/참외',
  kiwi:'키위', mango:'망고', grape:'포도', gift:'선물세트',
};

/* SKU 자동생성용 카테고리 코드 */
const CAT_SKU_CODE: Record<string, string> = {
  apple:'APL', citrus:'CIT', berry:'BER', melon:'MEL',
  kiwi:'KIW', mango:'MNG', grape:'GRP', gift:'GFT',
};

// CHART_DATA는 실데이터로 대체됨

function fmtPrice(n: number) { return n.toLocaleString('ko-KR'); }

/* 업로드 전 이미지 리사이즈·압축 (iOS 이미지 메모리 한계로 큰 원본이 모바일에서 안 보이는 문제 방지).
   최대 1200px·JPEG 품질 0.82 로 줄임. 실패 시 원본 그대로 업로드. */
async function compressImage(file: File, maxDim = 1200, quality = 0.82): Promise<{ blob: Blob; ext: string; type: string }> {
  const fallback = { blob: file, ext: (file.name.split('.').pop() || 'jpg').toLowerCase(), type: file.type || 'application/octet-stream' };
  if (!file.type.startsWith('image/')) return fallback;
  try {
    const dataUrl: string = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.onerror = rej; fr.readAsDataURL(file); });
    const img: HTMLImageElement = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = dataUrl; });
    let w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) return fallback;
    // 가로폭 기준 축소(세로로 긴 상세이미지가 가로 뭉개지는 문제 방지). 단, 캔버스 한계 방지로 높이도 안전 상한 적용.
    let scale = Math.min(1, maxDim / w);
    const MAX_H = 12000;
    if (h * scale > MAX_H) scale = Math.min(scale, MAX_H / h);
    w = Math.round(w * scale); h = Math.round(h * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return fallback;
    ctx.drawImage(img, 0, 0, w, h);
    const blob: Blob | null = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob) return fallback;
    return { blob, ext: 'jpg', type: 'image/jpeg' };
  } catch { return fallback; }
}
function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function fmtDateShort(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

/* ===== SVG 아이콘 ===== */
const Icon = {
  Dashboard: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>,
  Orders: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>,
  Products: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  Farms: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Reviews: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  Coupon: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  Banner: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16"><rect x="3" y="3" width="18" height="18" rx="0"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  Events: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16"><rect x="3" y="4" width="18" height="18" rx="0"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  Lounge: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  Members: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  Referral: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>,
  SMS: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>,
  Inquiry: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  Settlement: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  Taste: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Settings: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  Download: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  ExternalLink: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="15" height="15"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  Menu: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  SMS2: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>,
  Refresh: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>,
  Faq: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
  Cs: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/><line x1="9" y1="10" x2="15" y2="10"/><line x1="12" y1="7" x2="12" y2="13"/></svg>,
};

/* ===== 토글 컴포넌트 ===== */
function Toggle({ defaultOn = false, onChange }: { defaultOn?: boolean; onChange?: (v: boolean) => void }) {
  const [on, setOn] = useState(defaultOn);
  useEffect(() => { setOn(defaultOn); }, [defaultOn]);
  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !on;
    setOn(next);
    onChange?.(next);
  }
  return (
    <div onClick={handleClick} style={{
      width: 38, height: 22, borderRadius: 999, cursor: 'pointer', flexShrink: 0,
      background: on ? 'var(--accent, #2563EB)' : '#CBD5E1',
      transition: 'background .28s cubic-bezier(.4,0,.2,1)',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute', top: 3, left: 3,
        width: 16, height: 16, borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
        transition: 'transform .28s cubic-bezier(.34,1.56,.64,1)',
        transform: on ? 'translateX(16px)' : 'translateX(0)',
      }} />
    </div>
  );
}

/* 문자열 날짜 → datetime-local 입력값(YYYY-MM-DDTHH:mm). 레거시 "2026.05.30"도 변환 */
function toDateTimeLocal(s: string): string {
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return s.slice(0, 16);
  const m = s.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}T00:00` : '';
}

/* ===== 로딩 스피너 ===== */
function PanelLoading() {
  return <div style={{ textAlign:'center', padding:'60px 0', color:'#94A3B8', fontSize:14 }}>불러오는 중...</div>;
}

/* ===== 페이지네이션 (페이지 크기 선택 + 이전/다음) ===== */
function Pager({ page, pageSize, total, onPage, onPageSize }: {
  page: number; pageSize: number; total: number;
  onPage: (p: number) => void; onPageSize: (n: number) => void;
}) {
  if (total === 0) return null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const cur = Math.min(Math.max(1, page), totalPages);
  return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:8, marginTop:14, flexWrap:'wrap' }}>
      <AdmSelect value={String(pageSize)} onChange={v => { onPageSize(Number(v)); onPage(1); }}
        options={[10, 20, 30, 50, 100].map(n => ({ value:String(n), label:`${n}개씩` }))} />
      <button className="adm-btn adm-btn-outline" disabled={cur <= 1} onClick={() => onPage(cur - 1)}>이전</button>
      <span className="adm-muted" style={{ fontSize:13 }}>{cur} / {totalPages}</span>
      <button className="adm-btn adm-btn-outline" disabled={cur >= totalPages} onClick={() => onPage(cur + 1)}>다음</button>
      <span className="adm-muted" style={{ fontSize:12, marginLeft:8 }}>총 {total.toLocaleString()}건</span>
    </div>
  );
}

/* ===== SMS 발송 패널 ===== */
function SmsPanel({ members, loadMembers, membersLoading }: {
  members: AdminProfile[];
  loadMembers: () => void;
  membersLoading: boolean;
}) {
  const [smsText,      setSmsText]      = useState('');
  const [smsKind,      setSmsKind]      = useState<'ad'|'notice'>('ad'); // 광고성(동의자만) / 안내성(전원)
  const [targetMode,   setTargetMode]   = useState<'all'|'grade'|'select'|'custom'>('all');
  const [gradeFilter,  setGradeFilter]  = useState('high');
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set());
  const [memberSearch, setMemberSearch] = useState('');
  const [customNums,   setCustomNums]   = useState('');
  const [sending,      setSending]      = useState(false);
  const [preview,      setPreview]      = useState(false);
  const [smsLogs,      setSmsLogs]      = useState<{ id: string; message: string; target_count: number; msg_type: string; status: string; error_msg: string|null; created_at: string }[]>([]);
  const [logsLoading,  setLogsLoading]  = useState(false);
  const [smsFrom, setSmsFrom] = useState('');
  const [smsTo, setSmsTo] = useState('');
  const [smsTotalCount, setSmsTotalCount] = useState(0);

  useEffect(() => {
    if (members.length === 0) loadMembers();
    loadSmsLogs();
  }, []); // eslint-disable-line

  async function loadSmsLogs(from?: string, to?: string) {
    setLogsLoading(true);
    const f = from ?? smsFrom; const t = to ?? smsTo;
    const supabase = createClient();
    let q = supabase.from('sms_logs').select('*').order('created_at', { ascending: false }).limit(200);
    if (f) q = q.gte('created_at', new Date(`${f}T00:00:00`).toISOString());
    if (t) q = q.lte('created_at', new Date(`${t}T23:59:59`).toISOString());
    const [{ data }, totalRes] = await Promise.all([
      q,
      supabase.from('sms_logs').select('id', { count: 'exact', head: true }),
    ]);
    setSmsLogs((data || []) as typeof smsLogs);
    setSmsTotalCount(totalRes.count || 0);
    setLogsLoading(false);
  }

  /* 회원 목록 필터 (선택 모드) */
  const filteredForSelect = members.filter(m => {
    if (!m.phone) return false;
    const q = memberSearch.toLowerCase();
    return !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || m.phone.includes(q);
  });

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredForSelect.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredForSelect.map(m => m.id)));
    }
  }

  function buildTargets(): string[] {
    if (targetMode === 'custom') {
      return customNums.split(/[\n,]+/).map(s => s.trim().replace(/-/g, '')).filter(s => /^0\d{9,10}$/.test(s));
    }
    let filtered: AdminProfile[] = [];
    if (targetMode === 'all')    filtered = members;
    if (targetMode === 'grade')  filtered = members.filter(m => gradeFilter === 'high' ? ['buyer','master'].includes(m.grade) : m.grade === gradeFilter);
    if (targetMode === 'select') filtered = members.filter(m => selectedIds.has(m.id));
    /* 광고성 단체발송은 마케팅 SMS 수신 동의 회원에게만 (법적 필수). 안내성(공지)은 전원 발송 가능. */
    if (smsKind === 'ad') filtered = filtered.filter(m => m.marketing_sms === true);
    return filtered.map(m => m.phone || '').filter(Boolean).map(p => p.replace(/-/g, ''));
  }

  async function sendSms() {
    const targets = buildTargets();
    if (!smsText.trim()) { alert('메시지를 입력하세요.'); return; }
    if (targets.length === 0) { alert('발송 대상이 없습니다. 전화번호가 등록된 회원을 선택해주세요.'); return; }
    if (!confirm(`${targets.length}명에게 발송하시겠습니까?`)) return;
    setSending(true);
    const res = await fetch('/api/sms', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ text: smsText, targets }) });
    const data = await res.json();
    setSending(false);
    if (!res.ok) { alert('발송 실패: ' + (data.error || '알 수 없는 오류')); }
    else { alert(`✅ ${data.sent}명에게 ${data.type} 발송 완료`); setSmsText(''); setSelectedIds(new Set()); loadSmsLogs(); }
  }

  const charCount    = smsText.length;
  const msgType      = charCount > 90 ? 'LMS' : 'SMS';
  const targetCount  = buildTargets().length;
  const GRADE_LABEL_MAP: Record<string,string> = { beginner:'비기너', taster:'테이스터', buyer:'바이어', master:'마스터' };

  const smsPeriodRecipients = smsLogs.reduce((s, l) => s + (l.target_count || 0), 0);
  return (
    <div className="adm-content">
      <div className="adm-kpi-grid adm-kpi-3 adm-kpi-mb16">
        {[
          ['누적 발송 횟수', `${smsTotalCount.toLocaleString()}회`],
          ['조회 기간 발송', `${smsLogs.length.toLocaleString()}회`],
          ['조회 기간 수신자', `${smsPeriodRecipients.toLocaleString()}명`],
        ].map(([l, v]) => (
          <div key={l} className="adm-kpi-card"><div className="adm-kpi-label">{l}</div><div className="adm-kpi-value adm-kpi-value-mt">{v}</div></div>
        ))}
      </div>
      <div className="adm-row" style={{ alignItems:'flex-start' }}>

        {/* 좌: 작성 영역 */}
        <div className="adm-card adm-card-lg">
          <div className="adm-card-head"><span className="adm-card-title">SMS 작성</span></div>
          <div className="adm-form">

            {/* 발송 종류 (광고성/안내성) */}
            <div className="adm-form-row" style={{ flexDirection:'column', alignItems:'flex-start', gap:10 }}>
              <label className="adm-label">발송 종류</label>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {([['ad','광고성'],['notice','안내성(공지)']] as const).map(([v, l]) => (
                  <button key={v} onClick={() => setSmsKind(v)}
                    style={{ padding:'6px 14px', borderRadius:99, border:'1.5px solid', fontSize:12, fontWeight:600, cursor:'pointer',
                      borderColor: smsKind === v ? '#1A1A1A' : '#E2E8F0',
                      background: smsKind === v ? '#1A1A1A' : '#fff',
                      color: smsKind === v ? '#fff' : '#64748B' }}>
                    {l}
                  </button>
                ))}
              </div>
              <div className="adm-muted" style={{ fontSize:12 }}>
                {smsKind === 'ad'
                  ? <>※ <strong>광고성</strong>은 법적으로 <strong>마케팅 SMS 수신 동의 회원</strong>에게만 발송됩니다.</>
                  : <>※ <strong>안내성(공지)</strong>은 서비스 변경·본인인증 안내 등 비광고 목적이라 <strong>수신동의 무관 전원 발송</strong>됩니다. 광고 문구는 넣지 마세요.</>}
              </div>
            </div>

            {/* 발송 대상 탭 */}
            <div className="adm-form-row" style={{ flexDirection:'column', alignItems:'flex-start', gap:10 }}>
              <label className="adm-label">발송 대상</label>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {([['all','전체 회원'],['grade','등급별'],['select','회원 선택'],['custom','번호 직접입력']] as const).map(([v, l]) => (
                  <button key={v} onClick={() => setTargetMode(v)}
                    style={{ padding:'6px 14px', borderRadius:99, border:'1.5px solid', fontSize:12, fontWeight:600, cursor:'pointer',
                      borderColor: targetMode === v ? '#1A1A1A' : '#E2E8F0',
                      background: targetMode === v ? '#1A1A1A' : '#fff',
                      color: targetMode === v ? '#fff' : '#64748B' }}>
                    {l}
                  </button>
                ))}
              </div>

              {/* 등급별 선택 */}
              {targetMode === 'grade' && (
                <AdmSelect value={gradeFilter} onChange={setGradeFilter}
                  options={[{ value:'high', label:'바이어·마스터' }, ...Object.entries(GRADE_LABEL_MAP).map(([v,l]) => ({ value:v, label:`${l}만` }))]} />
              )}

              {/* 번호 직접입력 */}
              {targetMode === 'custom' && (
                <textarea className="adm-textarea" rows={4}
                  placeholder="01012345678&#10;010-9876-5432&#10;(쉼표 또는 줄바꿈으로 구분)"
                  value={customNums} onChange={e => setCustomNums(e.target.value)} />
              )}

              <span className="adm-muted" style={{ fontSize:12 }}>
                {membersLoading ? '회원 로딩 중...' : <><strong>{targetCount}명</strong> 선택됨</>}
              </span>
            </div>

            {/* 회원 선택 목록 */}
            {targetMode === 'select' && (
              <div style={{ border:'1px solid #E2E8F0', borderRadius:10, overflow:'hidden', marginBottom:8 }}>
                <div style={{ padding:'10px 12px', borderBottom:'1px solid #E2E8F0', background:'#F8FAFC', display:'flex', gap:8, alignItems:'center' }}>
                  <input type="text" className="adm-input-text" placeholder="이름·아이디(이메일)·전화번호 검색"
                    style={{ flex:1 }} value={memberSearch} onChange={e => setMemberSearch(e.target.value)} />
                  <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:13, cursor:'pointer', whiteSpace:'nowrap' }}>
                    <input type="checkbox"
                      checked={filteredForSelect.length > 0 && selectedIds.size === filteredForSelect.length}
                      onChange={toggleSelectAll} />
                    전체선택
                  </label>
                </div>
                <div style={{ maxHeight:240, overflowY:'auto' }}>
                  {membersLoading ? (
                    <div style={{ textAlign:'center', padding:'20px 0', color:'#94A3B8', fontSize:13 }}>로딩 중...</div>
                  ) : filteredForSelect.length === 0 ? (
                    <div style={{ textAlign:'center', padding:'20px 0', color:'#94A3B8', fontSize:13 }}>전화번호 있는 회원 없음</div>
                  ) : filteredForSelect.map(m => (
                    <label key={m.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px', borderBottom:'1px solid #F4F4F4', cursor:'pointer', background: selectedIds.has(m.id) ? '#EFF6FF' : '#fff' }}>
                      <input type="checkbox" checked={selectedIds.has(m.id)} onChange={() => toggleSelect(m.id)} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:500 }}>{m.name}</div>
                        <div style={{ fontSize:11, color:'#64748B', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{m.email || '-'}</div>
                        <div style={{ fontSize:11, color:'#94A3B8' }}>{m.phone}</div>
                      </div>
                      <span className={`adm-badge ${GRADE_BADGE_CLS[m.grade] || 'badge-normal'}`} style={{ fontSize:10 }}>
                        {GRADE_LABEL_MAP[m.grade] || m.grade}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* 메시지 작성 */}
            <div className="adm-form-row" style={{ flexDirection:'column', alignItems:'flex-start', gap:6 }}>
              <label className="adm-label">메시지 내용</label>
              <textarea className="adm-textarea" placeholder="최대 90자 (SMS) · 91자 이상 자동 LMS 전환" rows={5}
                style={{ width:'100%' }} value={smsText} onChange={e => setSmsText(e.target.value)} />
              <div className="adm-char-count">
                <span style={{ color: charCount > 2000 ? '#DC2626' : 'inherit' }}>{charCount}</span>
                &nbsp;/ {charCount > 90 ? '2,000자 (LMS)' : '90자 (SMS)'}
                &nbsp;<span style={{ background: msgType==='LMS'?'#FEF3C7':'#EFF6FF', color: msgType==='LMS'?'#92400E':'#1D4ED8', padding:'1px 6px', borderRadius:4, fontSize:11, fontWeight:700 }}>{msgType}</span>
              </div>
            </div>

            <div className="adm-form-actions">
              <button className="adm-btn adm-btn-outline" disabled={!smsText.trim()} onClick={() => setPreview(true)}>미리보기</button>
              <button className="adm-btn adm-btn-primary" onClick={sendSms} disabled={sending || !smsText.trim()}>
                {sending ? '발송 중...' : `발송하기 (${targetCount}명)`}
              </button>
            </div>
          </div>
        </div>

        {/* 우: 발송 이력 */}
        <div className="adm-card adm-card-sm">
          <div className="adm-card-head">
            <span className="adm-card-title">발송 이력</span>
            <button className="adm-btn adm-btn-outline" style={{ fontSize:12, padding:'4px 10px' }} onClick={() => loadSmsLogs()}>
              <span className="adm-btn-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg></span>새로고침
            </button>
          </div>
          {/* 기간 조회 */}
          <div style={{ display:'flex', flexDirection:'column', gap:8, padding:'14px 18px', borderBottom:'1px solid #F1F5F9' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <input type="date" className="adm-select" style={{ fontSize:12, flex:1, minWidth:0 }} value={smsFrom} onChange={e => setSmsFrom(e.target.value)} />
              <span style={{ color:'#94A3B8', flexShrink:0 }}>~</span>
              <input type="date" className="adm-select" style={{ fontSize:12, flex:1, minWidth:0 }} value={smsTo} onChange={e => setSmsTo(e.target.value)} />
            </div>
            <button className="adm-btn adm-btn-primary" style={{ fontSize:12, width:'100%' }} onClick={() => loadSmsLogs()}>조회</button>
          </div>
          {logsLoading ? <PanelLoading /> : smsLogs.length === 0 ? (
            <div className="adm-muted" style={{ padding:'28px 18px', fontSize:13, textAlign:'center' }}>발송 이력 없음</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8, padding:'14px 18px' }}>
              {smsLogs.map(log => (
                <div key={log.id} style={{ padding:'12px 14px', border:'1px solid #EEF2F6', borderRadius:10, background:'#fff' }}>
                  <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:8 }}>
                    <span style={{ fontSize:11, background: log.status==='sent'?'#DCFCE7':'#FEE2E2', color: log.status==='sent'?'#166534':'#991B1B', borderRadius:4, padding:'2px 7px', fontWeight:700 }}>
                      {log.status==='sent' ? '발송완료' : '실패'}
                    </span>
                    <span style={{ fontSize:11, background:'#F1F5F9', color:'#64748B', borderRadius:4, padding:'2px 7px', fontWeight:700, marginLeft:'auto' }}>{log.msg_type}</span>
                  </div>
                  <div style={{ fontSize:13, color:'#1A1A1A', marginBottom:6, lineHeight:1.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{log.message}</div>
                  <div style={{ fontSize:11, color:'#94A3B8', display:'flex', gap:6, alignItems:'center' }}>
                    <span style={{ fontWeight:700, color:'#475569' }}>{log.target_count}명</span>
                    <span>·</span>
                    <span>{new Date(log.created_at).toLocaleString('ko-KR', { year:'2-digit', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })}</span>
                  </div>
                  {log.error_msg && <div style={{ fontSize:11, color:'#DC2626', marginTop:4 }}>{log.error_msg}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 미리보기 모달 */}
      {preview && (
        <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={() => setPreview(false)}>
          <div style={{ background:'#fff', borderRadius:16, padding:28, width:320 }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <span style={{ fontSize:15, fontWeight:700 }}>SMS 미리보기</span>
              <button onClick={() => setPreview(false)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#94A3B8' }}>✕</button>
            </div>
            {/* 폰 목업 */}
            <div style={{ background:'#1A1A1A', borderRadius:28, padding:'12px 8px', margin:'0 auto', width:260 }}>
              <div style={{ background:'#fff', borderRadius:20, padding:'16px 12px', minHeight:160 }}>
                <div style={{ fontSize:10, color:'#94A3B8', marginBottom:8, textAlign:'center' }}>문자 메시지</div>
                <div style={{ background:'#E9F5FF', borderRadius:'14px 14px 14px 4px', padding:'10px 12px', fontSize:13, lineHeight:1.7, color:'#1A1A1A', wordBreak:'break-all' }}>
                  {smsText || <span style={{ color:'#94A3B8' }}>메시지를 입력하세요</span>}
                </div>
              </div>
            </div>
            <div style={{ marginTop:16, textAlign:'center', fontSize:12, color:'#94A3B8' }}>
              {charCount}자 · {msgType} · {targetCount}명 발송 예정
            </div>
            <button className="adm-btn adm-btn-primary" style={{ width:'100%', marginTop:12 }} onClick={() => { setPreview(false); sendSms(); }}
              disabled={sending || !smsText.trim() || targetCount === 0}>
              {sending ? '발송 중...' : `바로 발송 (${targetCount}명)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== 차트 컴포넌트 ===== */
function SalesChart({ data }: { days: '7'|'30'; data?: { labels: string[]; values: number[] } }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);

  /* ResizeObserver로 컨테이너 너비 안정적으로 추적 */
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setWidth(w);
    });
    ro.observe(ref.current);
    setWidth(ref.current.clientWidth || 560);
    return () => ro.disconnect();
  }, []);

  const vals  = data?.values || [];
  const lbs   = data?.labels  || [];
  const noData = vals.length === 0 || vals.every(v => v === 0);

  if (noData) {
    return (
      <div ref={ref} style={{ height: 160, display:'flex', alignItems:'center', justifyContent:'center', color:'#CBD5E1', fontSize:13 }}>
        아직 매출 데이터가 없습니다
      </div>
    );
  }

  const H   = 160;
  const PAD = { top: 28, right: 16, bottom: 4, left: 44 };
  const cw  = width - PAD.left - PAD.right;
  const ch  = H - PAD.top - PAD.bottom;
  const max = Math.max(...vals);
  const range = max || 1;
  const n   = vals.length;
  const xStep = n > 1 ? cw / (n - 1) : cw;

  let gridLines = '', yLabels = '';
  for (let i = 0; i <= 4; i++) {
    const y   = PAD.top + ch - (ch * i / 4);
    const val = Math.round(range * i / 4);
    const lbl = val >= 10000 ? (val / 10000).toFixed(0) + '만' : val.toLocaleString();
    gridLines += `<line x1="${PAD.left}" y1="${y}" x2="${width - PAD.right}" y2="${y}" stroke="#E2E8F0" stroke-width="1"/>`;
    yLabels   += `<text x="${PAD.left - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="#94A3B8">${lbl}</text>`;
  }

  const pts = vals.map((v, i) => ({
    x: PAD.left + i * xStep,
    y: PAD.top + ch - (v / range * ch),
    v,
  }));
  const areaPath = [
    `M ${pts[0].x} ${pts[0].y}`,
    ...pts.slice(1).map(p => `L ${p.x} ${p.y}`),
    `L ${pts[n-1].x} ${PAD.top + ch}`,
    `L ${pts[0].x}   ${PAD.top + ch}`,
    'Z',
  ].join(' ');
  const linePath = [`M ${pts[0].x} ${pts[0].y}`, ...pts.slice(1).map(p => `L ${p.x} ${p.y}`)].join(' ');
  const circles  = pts.map((p, i) =>
    `<g class="adm-chart-point">` +
    `<circle cx="${p.x}" cy="${p.y}" r="5" fill="#fff" stroke="#3B82F6" stroke-width="2.2"/>` +
    `<circle cx="${p.x}" cy="${p.y}" r="10" fill="transparent"/>` +
    `<title>${lbs[i]}: ${p.v.toLocaleString()}원</title>` +
    `</g>`
  ).join('');

  const svgStr = `<svg width="100%" height="${H}" viewBox="0 0 ${width} ${H}" preserveAspectRatio="none" overflow="visible">` +
    `<defs><linearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0%" stop-color="#3B82F6" stop-opacity="0.18"/>` +
    `<stop offset="100%" stop-color="#3B82F6" stop-opacity="0.01"/>` +
    `</linearGradient></defs>` +
    gridLines + yLabels +
    `<path d="${areaPath}" fill="url(#lineAreaGrad)"/>` +
    `<path d="${linePath}" fill="none" stroke="#3B82F6" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>` +
    circles + `</svg>`;

  /* 라벨은 최대 7개만 표시 (간격 균등) */
  const maxLabels = 7;
  const step = n <= maxLabels ? 1 : Math.ceil(n / maxLabels);
  const visibleLbs = lbs.filter((_, i) => i % step === 0 || i === n - 1);

  return (
    <div style={{ overflow: 'hidden' }}>
      <div ref={ref} className="adm-chart" dangerouslySetInnerHTML={{ __html: svgStr }} />
      <div style={{ display:'flex', justifyContent:'space-between', paddingLeft:44, paddingRight:16, marginTop:4 }}>
        {visibleLbs.map(l => <span key={l} style={{ fontSize:10, color:'#94A3B8', whiteSpace:'nowrap' }}>{l}</span>)}
      </div>
    </div>
  );
}

/* ===== 가입경로 (provider) ===== */
function providerKey(p?: string | null): 'kakao'|'naver'|'email' {
  if (p === 'kakao') return 'kakao';
  if (p === 'naver') return 'naver';
  return 'email';
}
const PROVIDER_META: Record<'kakao'|'naver'|'email', { label:string; bg:string; color:string }> = {
  kakao: { label:'카카오', bg:'#FEE500', color:'#3A1D1D' },
  naver: { label:'네이버', bg:'#03C75A', color:'#fff' },
  email: { label:'일반',   bg:'#EEF2F6', color:'#475569' },
};

/* ===== 미니 스파크라인 (판매 성과 그래프 보기) ===== */
function Spark({ data, color }: { data:number[]; color:string }) {
  const w = 120, h = 36, pad = 3;
  const n = data.length;
  if (!n) return <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} />;
  const max = Math.max(...data, 1), min = Math.min(...data, 0);
  const range = max - min || 1;
  const X = (i:number) => n>1 ? pad + (i/(n-1))*(w-pad*2) : w/2;
  const Y = (v:number) => h-pad - ((v-min)/range)*(h-pad*2);
  const pts = data.map((v,i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);
  const line = `M ${pts.join(' L ')}`;
  const area = `${line} L ${X(n-1).toFixed(1)},${(h-pad).toFixed(1)} L ${X(0).toFixed(1)},${(h-pad).toFixed(1)} Z`;
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display:'block' }}>
      <path d={area} fill={color} opacity={0.1} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* 관리자 공통 처리항목 롤링 알림 바 — 있는 항목만, 여러 개면 위로 롤링, 클릭 시 이동 */
type AdmAlert = { icon: string; label: string; count: number; onClick: () => void };
function AdminAlertBar({ alerts }: { alerts: AdmAlert[] }) {
  const [i, setI] = useState(0);
  const [manualTick, setManualTick] = useState(0);
  useEffect(() => { setI(0); }, [alerts.length]);
  useEffect(() => {
    if (alerts.length <= 1) return;
    const t = setInterval(() => setI(p => (p + 1) % alerts.length), 3500);
    return () => clearInterval(t);
  }, [alerts.length, manualTick]); // 수동 조작 시 자동롤링 타이머 재시작
  if (alerts.length === 0) return null;
  const idx = ((i % alerts.length) + alerts.length) % alerts.length;
  const a = alerts[idx];
  const step = (d: number) => (e: React.MouseEvent) => { e.stopPropagation(); setI(p => (((p + d) % alerts.length) + alerts.length) % alerts.length); setManualTick(t => t + 1); };
  return (
    <div className="adm-alertbar">
      <div className="adm-alertbar-item adm-alertbar-anim" key={idx} onClick={a.onClick} role="button">
        <span className="adm-alertbar-icon">{a.icon}</span>
        <span className="adm-alertbar-label">{a.label}</span>
        <span className="adm-alertbar-badge">{a.count.toLocaleString()}건</span>
        <span className="adm-alertbar-go">바로가기 ›</span>
      </div>
      {alerts.length > 1 && (
        <div className="adm-alertbar-ctrl">
          <div className="adm-alertbar-dots">
            {alerts.map((_, k) => <span key={k} className={`adm-alertbar-dot${k === idx ? ' on' : ''}`} />)}
          </div>
          <div className="adm-alertbar-arrows">
            <button className="adm-alertbar-arrow" onClick={step(-1)} title="이전" aria-label="이전 알림">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 15 12 9 18 15"/></svg>
            </button>
            <button className="adm-alertbar-arrow" onClick={step(1)} title="다음" aria-label="다음 알림">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== 뱃지 색상 선택 (프리셋 클릭 → 선택칸을 피커로 덮어쓰기) =====
 *  - 프리셋 원 클릭: 그 색 선택
 *  - 무지개 피커: 현재 선택된 칸의 색을 직접 변경(그 칸이 새 색으로 교체)
 *  - 드래그 중엔 로컬상태만 갱신 + 멈추면 디바운스로 부모에 1회 커밋 (렉 방지) */
function BadgeColorRow({ value, presets, onPick }: {
  value: string; presets: string[]; onPick: (v: string) => void;
}) {
  // 각 칸이 자기 색을 기억 (커스텀 색은 첫 칸에)
  const [colors, setColors] = useState<string[]>(() => {
    const arr = [...presets];
    if (!presets.includes(value)) arr[0] = value;
    return arr;
  });
  const [selIdx, setSelIdx] = useState(() => { const i = presets.indexOf(value); return i >= 0 ? i : 0; });
  const [local, setLocal] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCommit = useRef(value); // 우리가 마지막으로 부모에 커밋한 값

  // 외부에서 value가 바뀌면(다른 상품 로드 등) 재동기화. 우리 변경의 echo는 무시.
  useEffect(() => {
    if (value === lastCommit.current) return;
    lastCommit.current = value;
    setLocal(value);
    const i = presets.indexOf(value);
    if (i >= 0) { setSelIdx(i); setColors([...presets]); }
    else { setSelIdx(0); setColors(prev => { const n = [...presets]; n[0] = value; return n; }); }
  }, [value, presets]);

  function commit(v: string) { lastCommit.current = v; onPick(v); }
  function pick(i: number) {
    if (timer.current) clearTimeout(timer.current);
    setSelIdx(i); setLocal(colors[i]); commit(colors[i]); // 그 칸의 현재 색 커밋
  }
  function recolor(v: string) {
    setLocal(v);
    setColors(prev => prev.map((c, idx) => idx === selIdx ? v : c)); // 선택 칸 색 교체
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(v), 140);
  }
  function commitNow() { if (timer.current) clearTimeout(timer.current); commit(local); }

  return (
    <>
      {colors.map((c, i) => {
        const color = i === selIdx ? local : c;
        const active = i === selIdx;
        return (
          <button key={i} type="button" title="이 색 선택"
            onClick={() => pick(i)}
            style={{ width:24, height:24, borderRadius:'50%', background: color, cursor:'pointer',
              border: active ? '2px solid #1A1A1A' : '2px solid #fff', boxShadow:'0 0 0 1px #E2E8F0' }} />
        );
      })}
      {/* 무지개 피커: 선택된 칸의 색을 직접 변경 */}
      <label title="선택한 칸 색 직접 변경" style={{ position:'relative', width:24, height:24, borderRadius:'50%', cursor:'pointer', overflow:'hidden',
        background:'conic-gradient(red, orange, yellow, lime, cyan, blue, magenta, red)', border:'2px solid #fff', boxShadow:'0 0 0 1px #E2E8F0' }}>
        <input type="color" value={local}
          onChange={e => recolor(e.target.value)}
          onBlur={commitNow}
          style={{ position:'absolute', inset:0, opacity:0, width:'100%', height:'100%', border:'none', padding:0, cursor:'pointer' }} />
      </label>
    </>
  );
}

/* ===== 커스텀 셀렉트 (네이티브 select 대체) ===== */
type AdmOption = { value: string; label: string };
function AdmSelect({ value, onChange, options, placeholder, className, style, disabled }: {
  value: string;
  onChange: (v: string) => void;
  options: AdmOption[];
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  // 옵션이 많을 때만 검색창 노출
  const searchable = options.length >= 8;
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  // 열릴 때 검색어 초기화 + 검색창 포커스
  useEffect(() => {
    if (open) { setQ(''); if (searchable) setTimeout(() => searchRef.current?.focus(), 0); }
  }, [open, searchable]);
  function toggle() {
    if (disabled) return;
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const listH = Math.min(280, options.length * 38 + 12) + (searchable ? 44 : 0);
      setDropUp(window.innerHeight - rect.bottom < listH + 16 && rect.top > listH + 16);
    }
    setOpen(o => !o);
  }
  const selected = options.find(o => o.value === value);
  const kw = q.trim().toLowerCase();
  const shown = kw ? options.filter(o => o.label.toLowerCase().includes(kw)) : options;
  return (
    <div ref={ref} className={`adm-cs${className ? ' ' + className : ''}`} style={style}>
      <button ref={btnRef} type="button" className={`adm-cs-btn${open ? ' open' : ''}`} disabled={disabled}
        onClick={toggle}>
        <span className={selected ? 'adm-cs-val' : 'adm-cs-ph'}>{selected ? selected.label : (placeholder || '선택')}</span>
        <svg className="adm-cs-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <div className="adm-cs-list" style={dropUp ? { top: 'auto', bottom: 'calc(100% + 5px)' } : undefined}>
          {searchable && (
            <div className="adm-cs-search">
              <input ref={searchRef} type="text" value={q} onChange={e => setQ(e.target.value)}
                placeholder="검색" onKeyDown={e => { if (e.key === 'Enter' && shown.length === 1) { onChange(shown[0].value); setOpen(false); } }} />
            </div>
          )}
          <div className="adm-cs-scroll">
            {shown.length === 0 ? (
              <div className="adm-cs-empty">검색 결과 없음</div>
            ) : shown.map(o => (
              <button type="button" key={o.value} className={`adm-cs-item${o.value === value ? ' active' : ''}`}
                onClick={() => { onChange(o.value); setOpen(false); }}>
                {o.label}
                {o.value === value && <svg className="adm-cs-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== 옵션 트리 에디터 (단품 / 1단계 / 2단계 상위→하위) =====
 *  A안: 가격·재고는 하위(잎)에만. 상위는 분류 선택지(가격·재고 없음). */
let _optSeq = 0;
const newOptId = () => `o${Date.now().toString(36)}${(_optSeq++).toString(36)}`;
// 편집 중 상위-하위 연결은 라벨(이름)이 아니라 고정 id(parent_id)로 함 → 이름이 비거나 같아도 분류별 독립.
// 저장 시 parent_id → 해당 상위의 라벨(parent_label)로 변환해 DB에 기록(스토어프론트는 parent_label 사용).
type POpt = { id: string; group: string; required: boolean; label: string; add_price: number; purchase_price: number; shipping_fee: number; stock: number; manage_stock: boolean; parent_label?: string; parent_id?: string };
function OptionTreeEditor({ options, setOptions, basePrice = 0 }: {
  options: POpt[];
  setOptions: React.Dispatch<React.SetStateAction<POpt[]>>;
  basePrice?: number; // 할인 적용된 판매가 — 옵션별 판매금액 계산용
}) {
  const groups = [...new Set(options.map(o => o.group))];
  const idx = options.map((o, i) => ({ ...o, _i: i }));
  const dataCascade = options.some(o => !!o.parent_id || (o.parent_label || '').trim() !== '');
  const [mode, setMode] = useState<'indep' | 'cascade'>(dataCascade ? 'cascade' : 'indep');
  // 옵션이 늦게 로드돼도, parent_label이 있으면 자동으로 2단계 모드로 (사용자가 직접 토글하면 그 뒤론 유지)
  const userTouchedMode = useRef(false);
  const lastCascade = useRef<POpt[] | null>(null); // 단일 전환 직전 2단계 구성 스냅샷 → 다시 2단계로 오면 복원
  const [subNameDraft, setSubNameDraft] = useState(''); // 하위 옵션이 아직 없을 때 하위 그룹명 미리 입력용
  useEffect(() => { if (!userTouchedMode.current) setMode(dataCascade ? 'cascade' : 'indep'); }, [dataCascade]);

  const patch = (_i: number, p: Partial<POpt>) => setOptions(prev => prev.map((o, i) => i === _i ? { ...o, ...p } : o));
  const removeAt = (_i: number) => setOptions(prev => prev.filter((_, i) => i !== _i));
  const renameGroup = (oldG: string, nv: string) => setOptions(prev => prev.map(o => o.group === oldG ? { ...o, group: nv } : o));
  const clearAll = () => { if (confirm('옵션을 모두 지우고 단품으로 바꿀까요?')) { lastCascade.current = null; setOptions([]); } };

  const valueRow = (o: { _i:number; id:string; label:string; add_price:number; purchase_price:number; shipping_fee:number; stock:number; manage_stock:boolean }) => (
    <div key={o.id} style={{ marginBottom:8, marginLeft:16 }}>
      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
        <span style={{ color:'#CBD5E1', flexShrink:0 }}>└</span>
        <input className="adm-input-text" style={{ flex:1, minWidth:140 }} placeholder="예: 1kg" value={o.label} onChange={e => patch(o._i, { label: e.target.value })} />
        <span style={{ fontSize:11, color:'#94A3B8', flexShrink:0 }}>+</span>
        <input className="adm-input-text" style={{ width:86, minWidth:86, flexShrink:0 }} type="number" placeholder="0" value={o.add_price || ''} onChange={e => patch(o._i, { add_price: Number(e.target.value) })} />
        <span style={{ fontSize:11, color:'#94A3B8', flexShrink:0 }}>원</span>
        <input className="adm-input-text" style={{ width:86, minWidth:86, flexShrink:0 }} type="number" placeholder="0" title="농가 매입가"
          value={o.purchase_price || ''} onChange={e => patch(o._i, { purchase_price: Number(e.target.value) })} />
        <span style={{ fontSize:11, color:'#94A3B8', flexShrink:0 }}>매입가</span>
        <input className="adm-input-text" style={{ width:86, minWidth:86, flexShrink:0 }} type="number" placeholder="0" title="농가 배송비"
          value={o.shipping_fee || ''} onChange={e => patch(o._i, { shipping_fee: Number(e.target.value) })} />
        <span style={{ fontSize:11, color:'#94A3B8', flexShrink:0 }}>배송비</span>
        <input className="adm-input-text" style={{ width:86, minWidth:86, flexShrink:0, background: o.manage_stock ? undefined : '#F1F5F9', color: o.manage_stock ? undefined : '#94A3B8' }}
          type="number" placeholder={o.manage_stock ? '0' : '무한'} disabled={!o.manage_stock}
          value={o.manage_stock ? (o.stock || '') : ''} onChange={e => patch(o._i, { stock: Number(e.target.value) })} />
        <label style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, color:'#94A3B8', flexShrink:0, cursor:'pointer' }} title="끄면 재고 무한(차감·품절 없음)">
          <input type="checkbox" checked={o.manage_stock} onChange={e => patch(o._i, { manage_stock: e.target.checked })} />
          재고관리
        </label>
        <button type="button" onClick={() => removeAt(o._i)} style={{ width:28, height:28, border:'1px solid #FECACA', background:'#fff', color:'#DC2626', borderRadius:6, cursor:'pointer', flexShrink:0 }}>×</button>
      </div>
      <div style={{ marginLeft:18, marginTop:3, fontSize:11, color:'#64748B' }}>
        판매금액 <b style={{ color:'#1A1A1A', fontSize:12 }}>{fmtPrice(basePrice + (Number(o.add_price) || 0))}원</b>
        <span style={{ marginLeft:8 }}>· 공급가 <b style={{ color:'#334155' }}>{fmtPrice((Number(o.purchase_price) || 0) + (Number(o.shipping_fee) || 0))}원</b></span>
        {!o.manage_stock && <span style={{ marginLeft:8, color:'#16A34A', fontWeight:600 }}>· 재고 무한</span>}
      </div>
    </div>
  );
  const addBtn = (label: string, onClick: () => void) => (
    <button type="button" onClick={onClick} style={{ fontSize:12, color:'#2563EB', background:'#fff', border:'1px dashed #BFDBFE', borderRadius:6, padding:'7px 10px', cursor:'pointer', width:'100%', marginTop:4 }}>{label}</button>
  );

  /* ── 독립 모드 helpers ── */
  const addValue = (g: string) => { const req = options.find(o => o.group === g)?.required !== false; setOptions(prev => [...prev, { id: newOptId(), group: g, required: req, label:'', add_price:0, purchase_price:0, shipping_fee:0, stock:0, manage_stock:true, parent_label:'' }]); };
  const removeGroup = (g: string) => setOptions(prev => prev.filter(o => o.group !== g));
  const addGroup = () => setOptions(prev => { const gs = [...new Set(prev.map(o => o.group))]; let n = gs.length + 1, name = `옵션${n}`; while (gs.includes(name)) { n++; name = `옵션${n}`; } return [...prev, { id: newOptId(), group: name, required:true, label:'', add_price:0, purchase_price:0, shipping_fee:0, stock:0, manage_stock:true, parent_label:'' }]; });

  /* ── 2단계(종속) helpers — 상위/하위를 "이름"이 아니라 "역할(parent_id 유무)"로 구분.
       하위는 parent_id가 있음 → 상위/하위 그룹명이 같아도 안 섞임 ── */
  const supOpts = idx.filter(o => !o.parent_id);     // 상위(분류)
  const subOpts = idx.filter(o => !!o.parent_id);    // 하위(값)
  const supName = supOpts[0]?.group ?? '';
  const subName = subOpts[0]?.group ?? '';
  const renameSupGroup = (nv: string) => setOptions(prev => prev.map(o => !o.parent_id ? { ...o, group: nv } : o));
  const renameSubGroup = (nv: string) => setOptions(prev => prev.map(o => o.parent_id ? { ...o, group: nv } : o));
  // 연결은 id로 하므로 상위 라벨 변경 시 자식 재연결 불필요(라벨만 바꿈)
  const renameSup = (_i: number, _oldLabel: string, nv: string) => setOptions(prev => prev.map((o, i) => i === _i ? { ...o, label: nv } : o));
  const addSup = () => setOptions(prev => [...prev, { id: newOptId(), group: supName || '분류', required: true, label:'', add_price:0, purchase_price:0, shipping_fee:0, stock:0, manage_stock:true, parent_label:'' }]);
  const addSubUnder = (parentId: string) => setOptions(prev => [...prev, { id: newOptId(), group: subName || subNameDraft.trim() || '옵션', required: true, label:'', add_price:0, purchase_price:0, shipping_fee:0, stock:0, manage_stock:true, parent_label:'', parent_id: parentId }]);

  /* ── 시작 / 모드 전환 ── */
  const startOne = () => { userTouchedMode.current = true; lastCascade.current = null; setOptions([{ id: newOptId(), group:'옵션', required:true, label:'', add_price:0, purchase_price:0, shipping_fee:0, stock:0, manage_stock:true, parent_label:'' }]); setMode('indep'); };
  const startTwo = () => { userTouchedMode.current = true; lastCascade.current = null; setOptions([{ id: newOptId(), group:'분류', required:true, label:'', add_price:0, purchase_price:0, shipping_fee:0, stock:0, manage_stock:true, parent_label:'' }]); setMode('cascade'); };
  const toIndep = () => {
    const hasCascade = options.some(o => (o.parent_label || '').trim());
    userTouchedMode.current = true;
    lastCascade.current = hasCascade ? options : null; // 복원용 스냅샷 (다시 2단계 누르면 복원)
    setOptions(prev => {
      const isCasc = prev.some(o => !!o.parent_id || (o.parent_label || '').trim());
      // 종속이면 하위(값=parent_id 있는 것)만 단일 옵션으로 유지, 상위(분류)는 버림
      const kept = isCasc ? prev.filter(o => !!o.parent_id) : prev;
      return kept.map(o => ({ ...o, parent_label:'', parent_id: undefined }));
    });
    setMode('indep');
  };
  const toCascade = () => {
    userTouchedMode.current = true;
    if (lastCascade.current && lastCascade.current.length) {
      setOptions(lastCascade.current);   // 단일 전환 직전 2단계 구성 복원
      lastCascade.current = null;
      setMode('cascade');
      return;
    }
    setOptions(prev => {
      const gs = [...new Set(prev.map(o => o.group))];
      if (gs.length >= 2) return prev.map(o => ({ ...o, parent_label:'' }));
      // 평면 → 2단계: 빈 상위 분류 하나 만들고, 기존 옵션들을 그 분류(parent_id)에 연결
      const sup: POpt = { id: newOptId(), group:'분류', required:true, label:'', add_price:0, purchase_price:0, shipping_fee:0, stock:0, manage_stock:true, parent_label:'' };
      return [sup, ...prev.map(o => ({ ...o, parent_label:'', parent_id: sup.id }))];
    });
    setMode('cascade');
  };

  /* 옵션 사용 여부 라디오 — 설정안함 = 단품(재고 무한) / 설정함 = 옵션별 관리(재고는 옵션마다 on/off) */
  const stockRadio = (
    <div style={{ display:'flex', alignItems:'center', gap:18, flexWrap:'wrap', paddingBottom:4 }}>
      <span style={{ fontSize:12, fontWeight:800, color:'#334155', flexShrink:0 }}>옵션</span>
      <label style={{ display:'inline-flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:13, fontWeight:600, color:'#334155' }}>
        <input type="radio" name="stockMode" checked={options.length === 0} onChange={clearAll} />
        설정안함
      </label>
      <label style={{ display:'inline-flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:13, fontWeight:600, color:'#334155' }}>
        <input type="radio" name="stockMode" checked={options.length > 0} onChange={() => options.length === 0 && startOne()} />
        설정함
      </label>
      <span style={{ fontSize:11, color:'#94A3B8' }}>
        {options.length === 0
          ? '옵션 없는 단품입니다. 재고 관리 없이 수량 제한 없이 계속 판매돼요.'
          : '재고는 옵션마다 [재고관리] 체크로 켜고 끌 수 있어요. (끄면 무한 판매)'}
      </span>
    </div>
  );

  if (options.length === 0) return <div>{stockRadio}</div>;

  const modeBar = stockRadio;

  if (mode === 'cascade') {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {modeBar}
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <span style={{ fontSize:11, color:'#1A8A4C', fontWeight:800 }}>상위(분류)</span>
          <input className="adm-input-text" style={{ flex:1, maxWidth:150, minWidth:0, fontWeight:600 }} value={supName} placeholder="예: 품종" onChange={e => renameSupGroup(e.target.value)} />
          <span style={{ fontSize:11, color:'#7C3AED', fontWeight:800, marginLeft:6 }}>하위(옵션)</span>
          <input className="adm-input-text" style={{ flex:1, maxWidth:150, minWidth:0, fontWeight:600 }}
            value={subOpts.length ? subName : subNameDraft} placeholder="예: 중량"
            onChange={e => subOpts.length ? renameSubGroup(e.target.value) : setSubNameDraft(e.target.value)} />
        </div>
        <div style={{ fontSize:11, color:'#94A3B8' }}>
          위 두 이름은 <b>고객에게 선택 항목명으로 보여요</b> (예: <b>품종</b> ▾ 무농약/유기농 · <b>중량</b> ▾ 1kg/2kg).<br />
          분류를 고르면 그 분류의 하위 옵션만 보입니다. 가격·재고는 하위에만 입력하세요.
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {supOpts.map(sup => (
            <div key={sup.id} style={{ border:'1px solid #EEF2F6', borderRadius:8, padding:'10px', background:'#fff' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                <span style={{ color:'#1A8A4C', fontWeight:800, flexShrink:0 }}>●</span>
                <input className="adm-input-text" style={{ flex:1, minWidth:0, fontWeight:600 }} placeholder="예: 무농약 방울토마토" value={sup.label} onChange={e => renameSup(sup._i, sup.label, e.target.value)} />
                <button type="button" onClick={() => removeAt(sup._i)} style={{ fontSize:11, color:'#DC2626', background:'#fff', border:'1px solid #FECACA', borderRadius:6, padding:'4px 9px', cursor:'pointer', flexShrink:0 }}>분류 삭제</button>
              </div>
              {subOpts.filter(s => s.parent_id === sup.id).map(s => valueRow(s))}
              {addBtn(`+ ${sup.label || '이 분류'}의 옵션 추가`, () => addSubUnder(sup.id))}
            </div>
          ))}
        </div>
        {addBtn('+ 분류 추가', addSup)}
        <button type="button" onClick={toIndep}
          style={{ alignSelf:'flex-start', fontSize:11, color:'#64748B', background:'#fff', border:'1px solid #E2E8F0', borderRadius:6, padding:'4px 9px', cursor:'pointer' }}>
          분류 없애기 (단일 옵션으로)
        </button>
      </div>
    );
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {modeBar}
      <span style={{ fontSize:11, color:'#94A3B8' }}>옵션 하나만 고르는 상품입니다 (예: <b>중량</b> 1kg/2kg/3kg). 품종별로 가격이 다르면 아래 <b>분류 추가</b>를 누르세요.</span>
      {(() => {
        const g = groups[0] ?? '';
        const gOpts = idx.filter(o => o.group === g);
        return (
          <div style={{ border:'1px solid #E2E8F0', borderRadius:8, padding:12, background:'#FAFBFC' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, flexWrap:'wrap' }}>
              <span style={{ color:'#1A8A4C', fontWeight:800, flexShrink:0 }}>●</span>
              <span style={{ fontSize:11, color:'#64748B', fontWeight:800 }}>옵션명</span>
              <input className="adm-input-text" style={{ flex:1, maxWidth:180, minWidth:0, fontWeight:600 }} value={g} placeholder="예: 중량" onChange={e => renameGroup(g, e.target.value)} />
              <span style={{ fontSize:11, color:'#94A3B8' }}>고객에게 이 이름으로 보여요 (예: 중량 ▾ 1kg/2kg)</span>
            </div>
            {gOpts.map(o => valueRow(o))}
            {addBtn('+ 옵션값 추가', () => addValue(g))}
            {addBtn('+ 분류 추가 (품종 등 2단계로 나누기)', toCascade)}
          </div>
        );
      })()}
    </div>
  );
}

/* ===== 메인 컴포넌트 ===== */
export default function AdminClient() {
  const [panel, setPanel] = useState<PanelKey>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authedUser, setAuthedUser] = useState(false);
  const [admEmail, setAdmEmail] = useState('');
  const [admPw, setAdmPw] = useState('');
  const [admLoginErr, setAdmLoginErr] = useState('');
  const [admLoginLoading, setAdmLoginLoading] = useState(false);
  const [chartDays, setChartDays] = useState<'7'|'30'>('7');
  const [rankDays, setRankDays] = useState<'7'|'30'>('30'); // 상품별 판매순위 기간
  type RankItem = { name: string; option: string; unit_price: number; qty: number };
  const [productRank, setProductRank] = useState<{ '7': RankItem[]; '30': RankItem[] }>({ '7': [], '30': [] });
  const [farmModal, setFarmModal] = useState(false);
  const [farms, setFarms] = useState<AdminFarm[]>([]);
  const [farmsLoading, setFarmsLoading] = useState(false);
  const [editingFarm, setEditingFarm] = useState<AdminFarm | null>(null);
  const [farmSaving, setFarmSaving] = useState(false);
  const [farmForm, setFarmForm] = useState({ name: '', farmer_name: '', region: '', items: [] as string[], intro: '', carrier: '', dispatch_cutoff: '', bank_name: '', bank_account: '', thumbnail_url: '', logo_url: '', landing_images: [] as string[] });
  /* 브랜드 운영 메모(누적) — 회원 메모와 동일 구조. 수정 모드에서만 사용 */
  const [farmMemo, setFarmMemo] = useState('');
  const [farmMemoSaving, setFarmMemoSaving] = useState(false);
  const [farmMemos, setFarmMemos] = useState<{ id: string; content: string; admin_name: string|null; created_at: string }[]>([]);
  const [farmImgUploading, setFarmImgUploading] = useState(false);
  const [farmTypeFilter, setFarmTypeFilter] = useState('');   // 농가 목록 품목 탭 필터
  const [farmListSearch, setFarmListSearch] = useState('');    // 브랜드 목록 검색(품목·브랜드명·대표자명)


  /* ── 상품 등록/수정 모달 ── */
  const [productModal, setProductModal] = useState(false);
  // 상품폼 열림을 브라우저 히스토리에 연동 — 뒤로가기 시 이전 페이지가 아니라 폼만 닫히도록
  useEffect(() => {
    if (!productModal) return;
    window.history.pushState({ adminPForm: true }, '');
    const onPop = () => setProductModal(false);
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      // 버튼/저장으로 닫힌 경우(뒤로가기 아님) 쌓아둔 히스토리 항목 정리
      if (window.history.state?.adminPForm) window.history.back();
    };
  }, [productModal]);
  const [editingProduct, setEditingProduct] = useState<AdminProductFull | null>(null);

  /* ── 상세설명 / 상세정보 에디터 ── */
  const [detailEditor, setDetailEditor] = useState<{ id: string; name: string } | null>(null);
  const [infoEditor,   setInfoEditor]   = useState<{ id: string; name: string } | null>(null);
  // 신규 상품 등록 중 상세 내용을 상품 저장 전까지 메모리에 보관하는 버퍼 (상품 등록 시 함께 커밋)
  const [draftImages, setDraftImages] = useState<string[] | null>(null);
  const [draftInfo,   setDraftInfo]   = useState<InfoContent | null>(null);
  const [farmList, setFarmList] = useState<AdminFarmSimple[]>([]);
  const [farmSearch, setFarmSearch] = useState('');
  const [farmPickOpen, setFarmPickOpen] = useState(false);
  const PRODUCT_EMPTY: Omit<AdminProductFull, 'id' | 'discounted_price' | 'created_at'> = {
    sku: '', name: '', category: 'apple', origin: 'domestic', origin_region: '', supply_price: 0, price: 0, discount_rate: 0,
    short_desc: '', thumbnail_url: '', image_urls: [null, null, null, null, null],
    dispatch_cutoff: '', brix: null,   // ''=상속(농가 → 사이트 전체). 값 박으면 상위 변경이 반영 안 됨
 badge: '', badge_color: BADGE_DEFAULT_COLOR, is_new: false,
    is_best: false, is_dawn: false, is_active: true, show_stat_pill: true, farm_id: null, sort_order: 0,
    seller_score: null,
  };
  const [pForm, setPForm] = useState({ ...PRODUCT_EMPTY });
  const [pSaving, setPSaving] = useState(false);
  const [pDiscMode, setPDiscMode] = useState<'rate'|'amount'>('rate');
  const [pDiscOn, setPDiscOn] = useState(false); // '할인 판매하기' 체크 → 할인영역 펼침
  const [pDiscAmount, setPDiscAmount] = useState(''); // '원 할인' 모드 입력값(원)
  // 금액 입력 → 가격 기준으로 할인율(%) 환산 (가격 입력 순서 무관)
  useEffect(() => {
    if (pDiscMode !== 'amount' || pDiscAmount === '') return;
    setPForm(f => {
      if (!(f.price > 0)) return f;
      // 원 할인 입력 → 소수 할인율로 환산(정수 반올림 X) → 생성 판매가가 입력 금액만큼 정확히 빠짐
      const raw = Math.min(99, Math.max(0, Number(pDiscAmount) / f.price * 100));
      const r = Math.round(raw * 10000) / 10000; // numeric(7,4) 정밀도에 맞춰 소수 4자리
      return f.discount_rate === r ? f : { ...f, discount_rate: r };
    });
  }, [pDiscAmount, pDiscMode]);
  /* 상품 옵션 (label / add_price / stock) */
  const [pOptions, setPOptions] = useState<POpt[]>([]);
  const [pImgUploading, setPImgUploading] = useState(false);
  const pImgRef = useRef<HTMLInputElement>(null);
  const pImgDragIdx = useRef<number | null>(null); // 이미지 드래그 시작 인덱스
  // 업로드된 URL을 ref로도 보관 → 스테일 클로저로 인한 null 저장 방지
  const uploadedThumbnailRef = useRef<string>('');
  // 신규 등록 세션에 업로드된 상세이미지 경로 전체 — 취소 시 스토리지에서 정리
  const detailUploadsRef = useRef<string[]>([]);

  async function uploadProductImage(file: File): Promise<string | null> {
    setPImgUploading(true);
    const supabase = createClient();
    const { blob, ext, type } = await compressImage(file);   // 리사이즈·압축 (모바일 표시 문제 방지)
    const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    console.log('[업로드] 시작 →', path, `(${Math.round(blob.size/1024)}KB)`);
    const { error } = await supabase.storage.from('products').upload(path, blob, { upsert: true, contentType: type });
    if (error) {
      console.error('[업로드] 실패:', error.message);
      alert('업로드 실패: ' + error.message);
      setPImgUploading(false);
      return null;
    }
    const { data } = supabase.storage.from('products').getPublicUrl(path);
    console.log('[업로드] 성공 →', data.publicUrl);
    setPImgUploading(false);
    return data.publicUrl;
  }

  /* ── 대시보드 ── */
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [chartData, setChartData] = useState<{ '7': { labels: string[]; values: number[] }; '30': { labels: string[]; values: number[] } }>({ '7': { labels:[], values:[] }, '30': { labels:[], values:[] } });
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({});
  const [dashRefreshedAt, setDashRefreshedAt] = useState<Date | null>(null);
  const [dashExtra, setDashExtra] = useState<{ cancelReq:number; refunding:number; exchanging:number; shipDelay:number; refundDelay:number; pendingCancel:number; pendingRefund:number; unansweredCs:number; unansweredProdInq:number; unansweredFarmInq:number; unansweredReview:number }>({ cancelReq:0, refunding:0, exchanging:0, shipDelay:0, refundDelay:0, pendingCancel:0, pendingRefund:0, unansweredCs:0, unansweredProdInq:0, unansweredFarmInq:0, unansweredReview:0 });
  /* ── 회원 현황 (대시보드, 전월 대비 비교) ── */
  const [memberDash, setMemberDash] = useState<{ total:number; netIncrease:number; newThis:number; newPrev:number; buyersThis:number; buyersPrev:number; repeatRateThis:number; repeatRatePrev:number; avgOrdersThis:number; avgOrdersPrev:number } | null>(null);
  /* ── 판매 성과 (GA 방문 + 주문 지표) ── */
  type PerfMetrics = { visits:number; orders:number; payment:number; aov:number; conv:number };
  type PerfSeries = { visits:number[]; orders:number[]; payment:number[]; aov:number[]; conv:number[] };
  const [perfRange, setPerfRange] = useState<'day'|'week'|'month'>('month');
  const [perfLoading, setPerfLoading] = useState(false);
  const [salesPerf, setSalesPerf] = useState<{ cur:PerfMetrics; prev:PerfMetrics; series:PerfSeries; gaConfigured:boolean; label:string } | null>(null);

  async function loadSalesPerf(range: 'day'|'week'|'month') {
    setPerfLoading(true);
    const pad = (n:number) => String(n).padStart(2,'0');
    const fmt = (d:Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    const today = new Date();
    let curStart:Date, prevStart:Date, prevEnd:Date;
    let curEnd = new Date(today);
    if (range === 'day') {
      curStart = new Date(today);
      prevEnd = new Date(today); prevEnd.setDate(prevEnd.getDate()-1); prevStart = new Date(prevEnd);
    } else if (range === 'week') {
      // 이번주 월요일~일요일 (달력 주). 비교는 지난주 동기간(월~같은 요일)
      const back = (today.getDay() + 6) % 7; // 월요일까지 며칠 뒤로
      curStart = new Date(today); curStart.setDate(today.getDate() - back);
      curEnd = new Date(curStart); curEnd.setDate(curStart.getDate() + 6);
      prevStart = new Date(curStart); prevStart.setDate(curStart.getDate() - 7);
      prevEnd = new Date(today); prevEnd.setDate(today.getDate() - 7);
    } else {
      curStart = new Date(today.getFullYear(), today.getMonth(), 1);
      prevStart = new Date(today.getFullYear(), today.getMonth()-1, 1);
      prevEnd = new Date(today.getFullYear(), today.getMonth()-1, today.getDate());
    }
    /* 현재 기간의 일자 키 목록 (그래프 X축) */
    const dayKeys:string[] = [];
    { const d = new Date(curStart); while (d <= curEnd) { dayKeys.push(fmt(d)); d.setDate(d.getDate()+1); } }

    const supabase = createClient();
    const valid = VALID_ORDER_STATUS;
    /* 현재 기간: 일자별 집계까지 (created_at 포함) */
    const { data: curRows } = await supabase.from('orders').select('final_amount, created_at')
      .gte('created_at', new Date(curStart.getFullYear(),curStart.getMonth(),curStart.getDate(),0,0,0).toISOString())
      .lte('created_at', new Date(curEnd.getFullYear(),curEnd.getMonth(),curEnd.getDate(),23,59,59).toISOString())
      .in('status', valid).limit(10000);
    const ordByDay:Record<string,number> = {}, payByDay:Record<string,number> = {};
    dayKeys.forEach(k => { ordByDay[k]=0; payByDay[k]=0; });
    (curRows||[]).forEach((o:{final_amount:number; created_at:string}) => {
      const k = fmt(new Date(o.created_at));
      if (k in ordByDay) { ordByDay[k]++; payByDay[k]+=(o.final_amount||0); }
    });
    const curOrders = (curRows||[]).length;
    const curPayment = (curRows||[]).reduce((s, o:{final_amount:number}) => s+(o.final_amount||0), 0);
    /* 이전 기간: 합계만 */
    const { data: prevRows } = await supabase.from('orders').select('final_amount')
      .gte('created_at', new Date(prevStart.getFullYear(),prevStart.getMonth(),prevStart.getDate(),0,0,0).toISOString())
      .lte('created_at', new Date(prevEnd.getFullYear(),prevEnd.getMonth(),prevEnd.getDate(),23,59,59).toISOString())
      .in('status', valid).limit(10000);
    const prevOrders = (prevRows||[]).length;
    const prevPayment = (prevRows||[]).reduce((s, o:{final_amount:number}) => s+(o.final_amount||0), 0);

    /* GA 방문수 (현재=일자별, 이전=합계) */
    let gaConfigured = false, curVisits = 0, prevVisits = 0;
    const visByDay:Record<string,number> = {};
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/ga-stats?daily=1&start=${fmt(curStart)}&end=${fmt(curEnd)}`).then(r=>r.json()),
        fetch(`/api/ga-stats?start=${fmt(prevStart)}&end=${fmt(prevEnd)}`).then(r=>r.json()),
      ]);
      if (r1?.configured) {
        gaConfigured = true; curVisits = r1.sessions||0; prevVisits = r2?.sessions||0;
        (r1.series||[]).forEach((d:{date:string; sessions:number}) => {
          const k = `${d.date.slice(0,4)}-${d.date.slice(4,6)}-${d.date.slice(6,8)}`;
          visByDay[k] = d.sessions;
        });
      }
    } catch { /* GA 미연동 */ }

    const visSeries = dayKeys.map(k => visByDay[k] || 0);
    const ordSeries = dayKeys.map(k => ordByDay[k]);
    const paySeries = dayKeys.map(k => payByDay[k]);
    const aovSeries = dayKeys.map((_, i) => ordSeries[i]>0 ? Math.round(paySeries[i]/ordSeries[i]) : 0);
    const convSeries = dayKeys.map((_, i) => visSeries[i]>0 ? (ordSeries[i]/visSeries[i]*100) : 0);

    const mk = (o:number, p:number, v:number): PerfMetrics =>
      ({ visits:v, orders:o, payment:p, aov: o>0?Math.round(p/o):0, conv: v>0?(o/v*100):0 });
    setSalesPerf({
      cur: mk(curOrders, curPayment, curVisits),
      prev: mk(prevOrders, prevPayment, prevVisits),
      series: { visits:visSeries, orders:ordSeries, payment:paySeries, aov:aovSeries, conv:convSeries },
      gaConfigured,
      label: `${fmt(curStart).slice(5).replace('-','.')} ~ ${fmt(curEnd).slice(5).replace('-','.')}`,
    });
    setPerfLoading(false);
  }

  /* ── 주문 ── */
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailStatus, setDetailStatus] = useState<string>(''); // 상세 모달에서 선택한(미저장) 주문 상태
  useEffect(() => { setDetailStatus(selectedOrder?.status || ''); }, [selectedOrder]);
  // 모달(어떤 것이든) 열려 있는 동안 뒷배경 스크롤 잠금 — 매 렌더 후 열린 모달 유무로 판단
  useEffect(() => {
    const lock = !!document.querySelector('.adm-modal-bg.open');
    document.documentElement.style.overflow = lock ? 'hidden' : '';
    document.body.style.overflow = lock ? 'hidden' : '';
  });
  useEffect(() => () => { document.documentElement.style.overflow = ''; document.body.style.overflow = ''; }, []);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const pendingOrderStatus = useRef<string | null>(null); // 대시보드 바로가기로 진입 시 적용할 주문상태 필터
  const pendingRefundType = useRef<'' | 'cancel' | 'refund' | null>(null); // 환불 패널 진입 시 적용할 유형 필터
  const pendingRefundStatus = useRef<string | null>(null); // 환불 패널 진입 시 적용할 상태 필터
  const [orderFarmFilter, setOrderFarmFilter] = useState('');
  const [orderReqOnly, setOrderReqOnly] = useState(false);
  const [orderDateBasis, setOrderDateBasis] = useState<'paid_at'|'delivered_at'>('paid_at');
  const [orderFrom, setOrderFrom] = useState<string>(() => { const d = new Date(); d.setMonth(d.getMonth()-1); return ymd(d); });
  const [orderTo, setOrderTo] = useState<string>(() => ymd(new Date()));
  const [orderPageSize, setOrderPageSize] = useState(50);
  const [orderPage, setOrderPage] = useState(1);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [trackingInput, setTrackingInput] = useState({ courier: '', tracking_number: '' });
  const [selOrders, setSelOrders] = useState<Set<string>>(new Set()); // 주문 일괄선택
  const bulkShipFileRef = useRef<HTMLInputElement>(null); // 엑셀 일괄 발송처리 파일 인풋
  const [trackEditRow, setTrackEditRow] = useState<string | null>(null); // 목록 인라인 송장 편집 중인 주문
  const [trackEditVal, setTrackEditVal] = useState('');
  const [trackEditCourier, setTrackEditCourier] = useState('');
  const [trackSaving, setTrackSaving] = useState<string | null>(null);
  const [farmTracking, setFarmTracking] = useState<Record<string, { courier: string; tracking_number: string }>>({}); // 농가별 송장 입력
  const [savingTracking, setSavingTracking] = useState(false);
  const [showTrackingModal, setShowTrackingModal] = useState(false);

  /* ── 상품 ── */
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productCatFilter, setProductCatFilter] = useState('');
  const [productBrandFilter, setProductBrandFilter] = useState('');
  const [productStatusFilter, setProductStatusFilter] = useState<''|'selling'|'soldout'|'stopped'>('');

  /* ── 필탭 / 카테고리 ── */
  const FT_EMPTY = { tab_type: 'category' as TabType, tab_value: '', label: '', emoji: '', bg: '#F5F5F5',
    is_active: true, show_in_home: false, show_in_category: false, show_in_shortcut: false, parent: '' as string };
  const [filterTabs, setFilterTabs] = useState<FilterTab[]>([]);
  const [ftLoading, setFtLoading] = useState(false);
  const [ftModal, setFtModal] = useState(false);
  const [editingFt, setEditingFt] = useState<FilterTab | null>(null);
  const [ftForm, setFtForm] = useState(FT_EMPTY);
  /* ── 상단 메뉴 (menu_items) ── */
  type MenuRow = { id: string; label: string; href: string; emoji: string; parent: string | null; sort_order: number; is_active: boolean; show_in_mega: boolean; show_in_header: boolean; show_in_shortcut: boolean };
  const [menus, setMenus] = useState<MenuRow[]>([]);
  const [menusLoading, setMenusLoading] = useState(false);
  const [menuTab, setMenuTab] = useState<'mega'|'header'|'productlist'|'shortcut'|'home'>('mega');

  /* ── 회원 ── */
  const [members, setMembers] = useState<AdminProfile[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberTab, setMemberTab] = useState<'list'|'withdrawn'>('list');
  const [withdrawnList, setWithdrawnList] = useState<{ id:string; email:string|null; phone:string|null; reason:string|null; withdrawn_at:string }[]>([]);
  const [withdrawnLoading, setWithdrawnLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberGradeFilter, setMemberGradeFilter] = useState('');
  const [memberBlockFilter, setMemberBlockFilter] = useState<'all'|'active'|'blocked'>('all');
  const [memberProviderFilter, setMemberProviderFilter] = useState('');
  const [selectedMember, setSelectedMember] = useState<AdminProfile | null>(null);
  const [memberMemo, setMemberMemo] = useState('');
  const [memberMemoSaving, setMemberMemoSaving] = useState(false);
  const [memberOrders, setMemberOrders] = useState<Order[]>([]);
  const [memberMemos, setMemberMemos] = useState<{ id: string; content: string; admin_name: string|null; created_at: string }[]>([]);
  const [memberStats, setMemberStats] = useState({ totalSpent: 0, orderCount: 0 });
  const [memberOrdersLoading, setMemberOrdersLoading] = useState(false);

  /* ── 리뷰 ── */
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [selectedReview, setSelectedReview] = useState<AdminReview | null>(null);
  const [reviewRating, setReviewRating] = useState('');        // '' | '5'..'1'
  const [reviewFarm, setReviewFarm] = useState('');            // '' = 전체 농가, 아니면 farm_id
  /* 리뷰 상태 필터 — 베스트 / 신고됨 / 도움돼요. 서로 배타적이지 않아 '보는 관점'으로 하나만 고름 */
  const [reviewFlag, setReviewFlag] = useState<'' | 'best' | 'reported' | 'liked'>('');
  const [reviewAnswered, setReviewAnswered] = useState<'all'|'unanswered'|'answered'>('all');
  const [reviewSearch, setReviewSearch] = useState('');
  const [reviewFrom, setReviewFrom] = useState('');
  const [reviewTo, setReviewTo] = useState('');
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewPageSize, setReviewPageSize] = useState(30);
  const [reviewReply, setReviewReply] = useState('');
  const [reviewReplySaving, setReviewReplySaving] = useState(false);

  /* ── 이벤트 ── */
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventModal, setEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AdminEvent | null>(null);
  const EVENT_EMPTY = {
    slug: '', title: '', subtitle: '', badge: '', badge_color: BADGE_DEFAULT_COLOR,
    thumbnail_url: '', image_url: '', content: '',
    starts_at: '', ends_at: '', is_active: true,
  };
  const [evForm, setEvForm] = useState({ ...EVENT_EMPTY });
  const [evSaving, setEvSaving] = useState(false);
  const [evThumbUploading, setEvThumbUploading] = useState(false);
  const [evImgUploading, setEvImgUploading] = useState(false);
  const evThumbRef = useRef<HTMLInputElement>(null);
  const evImgRef   = useRef<HTMLInputElement>(null);

  /* ── 라운지 ── */
  const [loungePosts, setLoungePosts] = useState<AdminLoungePost[]>([]);
  const [loungeLoading, setLoungeLoading] = useState(false);
  const [loungeFilter, setLoungeFilter] = useState('');
  const [loungeModal, setLoungeModal] = useState(false);
  const [editingLounge, setEditingLounge] = useState<AdminLoungePost | null>(null);
  const [loungeForm, setLoungeForm] = useState({ filter: 'recipe', title: '', badge: '', date: '', thumbnail_url: '', image_url: '', content: '', is_active: true, sort_order: 0 });
  const [loungeSaving, setLoungeSaving] = useState(false);
  const [loungeThumbUploading, setLoungeThumbUploading] = useState(false);
  const [loungeImgUploading, setLoungeImgUploading] = useState(false);
  const loungeThumbRef = useRef<HTMLInputElement>(null);
  const loungeImgRef   = useRef<HTMLInputElement>(null);

  /* ── 포인트 관리 ── */
  const [pointMembers, setPointMembers] = useState<AdminProfile[]>([]);
  const [pointMembersLoading, setPointMembersLoading] = useState(false);
  const [pointSearch, setPointSearch] = useState('');
  /* 페이지네이션: 포인트 회원 / 포인트 내역 / 회원관리 */
  const [pmPage, setPmPage] = useState(1); const [pmSize, setPmSize] = useState(10);
  const [plPage, setPlPage] = useState(1); const [plSize, setPlSize] = useState(10);
  const [memPage, setMemPage] = useState(1); const [memSize, setMemSize] = useState(10);
  const [cpPage, setCpPage] = useState(1); const [cpSize, setCpSize] = useState(10);
  /* 포인트 적립 설정 */
  const [ptEdit, setPtEdit] = useState(false);
  const [ptRate, setPtRate] = useState('1');
  const [ptApply, setPtApply] = useState('');
  const [ptSaving, setPtSaving] = useState(false);
  /* 멤버십 등급 설정 */
  const [mTiers, setMTiers] = useState<MembershipTier[]>([]);
  const [mLoaded, setMLoaded] = useState(false);
  const [mSaving, setMSaving] = useState(false);
  const [recalcRunning, setRecalcRunning] = useState(false);
  const [pointFilter, setPointFilter] = useState<'all' | 'has' | 'none'>('all');
  const [pointStats, setPointStats] = useState({ total: 0, monthGiven: 0, monthUsed: 0 });
  const [pointLogs, setPointLogs] = useState<{ id: string; amount: number; created_at: string; description?: string | null; profiles?: { name: string|null; email: string|null } | null }[]>([]);
  const [pointLogFrom, setPointLogFrom] = useState<string>(() => { const d = new Date(); d.setMonth(d.getMonth()-1); return ymd(d); });
  const [pointLogTo, setPointLogTo] = useState<string>(() => ymd(new Date()));
  const [givePointModal, setGivePointModal] = useState(false);
  const [givePointTarget, setGivePointTarget] = useState<AdminProfile | null>(null);
  const [givePointForm, setGivePointForm] = useState({ amount: '', desc: '' });
  const [givePointSaving, setGivePointSaving] = useState(false);

  /* ── 쿠폰 ── */
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [couponModal, setCouponModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<AdminCoupon | null>(null);
  const [couponForm, setCouponForm] = useState({ code: '', name: '', description: '', discount_type: 'percent' as 'percent'|'fixed', discount_value: 10, min_order_amount: 0, max_discount_amount: '', starts_at: '', expires_at: '', valid_days: '', is_active: true, is_public: false, signup_grant: false, is_membership: false });
  const [couponSaving, setCouponSaving] = useState(false);
  /* 쿠폰 지급 */
  const [giveCouponModal, setGiveCouponModal] = useState(false);
  const [giveCouponTarget, setGiveCouponTarget] = useState<AdminCoupon | null>(null);
  const [giveCouponMode, setGiveCouponMode] = useState<'all'|'select'>('all');
  const [giveCouponIds, setGiveCouponIds] = useState<Set<string>>(new Set());
  const [giveCouponSearch, setGiveCouponSearch] = useState('');
  const [giveCouponSaving, setGiveCouponSaving] = useState(false);

  /* ── 입점 문의 ── */
  const [inquiries, setInquiries] = useState<FarmInquiry[]>([]);
  const [inquiriesLoading, setInquiriesLoading] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState<FarmInquiry | null>(null);
  const [inquiryTpl, setInquiryTpl] = useState<'general'|'accept'|'reject'>('general');

  /* ── FAQ ── */
  const [faqItems, setFaqItems] = useState<FaqItem[]>([]);
  const [faqLoading, setFaqLoading] = useState(false);
  const [faqModal, setFaqModal] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FaqItem | null>(null);
  const FAQ_EMPTY = { category: 'delivery', question: '', answer: '', sort_order: 0, is_active: true };
  const [faqForm, setFaqForm] = useState<typeof FAQ_EMPTY>({ ...FAQ_EMPTY });
  const [faqSaving, setFaqSaving] = useState(false);
  const [faqSearch, setFaqSearch] = useState('');
  const [faqCatFilter, setFaqCatFilter] = useState('');
  const [dragFaqId, setDragFaqId] = useState<string | null>(null);
  const [faqPage, setFaqPage] = useState(1);
  const [faqPageSize, setFaqPageSize] = useState(30);

  /* ── 상품 문의 ── */
  const [productInquiries, setProductInquiries] = useState<AdminProductInquiry[]>([]);
  const [productInquiriesLoading, setProductInquiriesLoading] = useState(false);
  const [selectedProductInquiry, setSelectedProductInquiry] = useState<AdminProductInquiry | null>(null);
  const [piqAnswer, setPiqAnswer] = useState('');
  const [piqAnswering, setPiqAnswering] = useState(false);
  const [piqStatusFilter, setPiqStatusFilter] = useState<'all'|'pending'|'answered'>('all');
  const [piqSearch, setPiqSearch] = useState('');
  const [piqFrom, setPiqFrom] = useState('');
  const [piqTo, setPiqTo] = useState('');

  /* ── 1:1 문의 ── */
  const [csItems, setCsItems] = useState<CsInquiryAdmin[]>([]);
  const [csAdminLoading, setCsAdminLoading] = useState(false);
  const [selectedCs, setSelectedCs] = useState<CsInquiryAdmin | null>(null);
  const [csAnswer, setCsAnswer] = useState('');
  const [csAnswering, setCsAnswering] = useState(false);
  const [csAdminTab, setCsAdminTab] = useState('tab-all');
  const [csCatFilter, setCsCatFilter] = useState('');
  const [csFrom, setCsFrom] = useState('');
  const [csTo, setCsTo] = useState('');
  const [csSearch, setCsSearch] = useState('');

  /* ── 배너 ── */
  const [banners, setBanners] = useState<AdminBanner[]>([]);
  const [bannersLoading, setBannersLoading] = useState(false);
  const [bannerModal, setBannerModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState<AdminBanner | null>(null);
  const BANNER_EMPTY = { type: 'main', link_url: '/', is_active: true };
  const [bnForm, setBnForm] = useState<{ type: string; link_url: string; is_active: boolean }>({ ...BANNER_EMPTY });
  const [bnImgUrl, setBnImgUrl] = useState<string>('');
  const [bnImgUrlMobile, setBnImgUrlMobile] = useState<string>('');
  const [bnSaving, setBnSaving] = useState(false);
  const [bnUploading, setBnUploading] = useState(false);
  const bnImgRef = useRef<HTMLInputElement>(null);
  const bnImgRefMobile = useRef<HTMLInputElement>(null);

  /* ── 팝업 ── */
  interface AdminPopup { id: string; title: string | null; image_url: string | null; image_url_mobile: string | null; link_url: string; width: number; position: string; is_active: boolean; starts_at: string | null; ends_at: string | null; created_at: string; }
  const [popups, setPopups] = useState<AdminPopup[]>([]);
  const [popupsLoading, setPopupsLoading] = useState(false);
  /* 배너/팝업 변경 이력 */
  interface MediaHistory { id: string; entity_type: string; entity_id: string | null; action: string; snapshot: Record<string, unknown>; changed_at: string; }
  const [mediaHistory, setMediaHistory] = useState<MediaHistory[]>([]);
  const [mediaHistoryOpen, setMediaHistoryOpen] = useState(false);
  const [mhLoading, setMhLoading] = useState(false);
  const [mhFilter, setMhFilter] = useState<'all' | 'banner' | 'popup'>('all');
  const [mhPage, setMhPage] = useState(1); const [mhSize, setMhSize] = useState(10);
  const [popupModal, setPopupModal] = useState(false);
  const [editingPopup, setEditingPopup] = useState<AdminPopup | null>(null);
  const POPUP_EMPTY = { title: '', link_url: '/', width: 400, position: 'center', is_active: true, starts_at: '', ends_at: '' };
  const [ppForm, setPpForm] = useState<typeof POPUP_EMPTY>({ ...POPUP_EMPTY });
  const [ppImgUrl, setPpImgUrl] = useState('');
  const [ppImgUrlMobile, setPpImgUrlMobile] = useState('');
  const [ppSaving, setPpSaving] = useState(false);
  const [ppUploading, setPpUploading] = useState(false);
  const ppImgRef = useRef<HTMLInputElement>(null);
  const ppImgRefMobile = useRef<HTMLInputElement>(null);

  /* ── 취향 프로파일(설문 결과) ── */
  const [surveyResults, setSurveyResults] = useState<AdminSurveyResult[]>([]);
  const [surveyLoading, setSurveyLoading] = useState(false);
  const [surveyShowProducts, setSurveyShowProducts] = useState(true);
  const [surveyMemberTotal, setSurveyMemberTotal] = useState(0);
  const [surveyTypeFilter, setSurveyTypeFilter] = useState('');

  /* ── 친구 추천 ── */
  const [referrals, setReferrals] = useState<AdminReferral[]>([]);
  const [referralsLoading, setReferralsLoading] = useState(false);
  const [referralSearch, setReferralSearch] = useState('');
  const [referralStatusFilter, setReferralStatusFilter] = useState<'all'|'pending'|'rewarded'>('all');
  /* 친구추천 발급 쿠폰 내역 */
  interface RefCoupon { key: string; referral_id: string | null; reward_type: string; created_at: string; recipient_name: string; recipient_email: string; discount_value: number; is_used: boolean; used_at: string | null; expires_at: string | null; }
  const [refCoupons, setRefCoupons] = useState<RefCoupon[]>([]);
  const [refCouponsLoading, setRefCouponsLoading] = useState(false);

  /* 쿠폰 지급 내역 (회원별) */
  interface CouponLog { id: string; name: string; email: string; couponName: string; discountLabel: string; issued_at: string; status: '미사용'|'사용완료'|'만료'; source: string; category: 'signup'|'membership'|'general'; }
  const [couponLogs, setCouponLogs] = useState<CouponLog[]>([]);
  const [couponLogsLoading, setCouponLogsLoading] = useState(false);
  const [clSearch, setClSearch] = useState('');
  const [clStatus, setClStatus] = useState<'all'|'unused'|'used'|'expired'>('all');
  const [clCategory, setClCategory] = useState<'all'|'signup'|'membership'|'general'>('all');
  const [clPage, setClPage] = useState(1); const [clSize, setClSize] = useState(20);
  const [refcPage, setRefcPage] = useState(1); const [refcSize, setRefcSize] = useState(10);

  /* ── 환불 관리 ── */
  const [refundReqs, setRefundReqs] = useState<AdminRefundReq[]>([]);
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundDetail, setRefundDetail] = useState<AdminRefundReq | null>(null);
  const [refundFilter, setRefundFilter] = useState<'all' | 'customer' | 'admin'>('all');
  const [refundTypeFilter, setRefundTypeFilter] = useState<'' | 'cancel' | 'refund'>('');
  const [refundStatusFilter, setRefundStatusFilter] = useState('');
  const [refundFrom, setRefundFrom] = useState('');
  const [refundTo, setRefundTo] = useState('');

  /* ── 탭 ── */
  const [couponTab, setCouponTab] = useState('tab-coupon');
  const [couponStats, setCouponStats] = useState({ issued: 0, used: 0 });
  const [bannerTab, setBannerTab] = useState('tab-banner');
  const [inquiryTab, setInquiryTab] = useState('tab-general');
  const [inquiryFrom, setInquiryFrom] = useState('');
  const [inquiryTo, setInquiryTo] = useState('');
  const [inquirySearch, setInquirySearch] = useState('');
  const [inquiryTypeFilter, setInquiryTypeFilter] = useState('');

  /* ── 사이트 설정 ── */
  const [siteSettings, setSiteSettings] = useState<Record<string, string>>({ pick_count: '6' });
  const [settingsSaving, setSettingsSaving] = useState(false);

  /* ── 검색 통계 ── */
  const [searchStats, setSearchStats] = useState<{ keyword: string; count: number; trend: number; isNew: boolean }[]>([]);
  const [noResultStats, setNoResultStats] = useState<{ keyword: string; count: number }[]>([]);
  const [searchStatsLoading, setSearchStatsLoading] = useState(false);
  const [statsDays, setStatsDays] = useState<7|30>(7);
  /* ── 마케팅 분석 (자체 DB) ── */
  const [marketingTab, setMarketingTab] = useState<'channel'|'hour'|'age'>('channel');
  const [marketingLoading, setMarketingLoading] = useState(false);
  const [marketing, setMarketing] = useState<{
    todayOrders: number; monthOrders: number; repeatCustomers: number;
    monthSales: number; prevSales: number; refundRate: number; refundCount: number;
    newMembers: number; aov: number; prevAov: number;
    adView: number; adClick: number; adCtr: number;
    channels: { label: string; orders: number; revenue: number; color: string }[];
    byHour: { h: number; count: number }[];
    byAge: { label: string; n: number }[];
    couponActive: number; couponTotal: number; couponIssued: number; couponUsed: number;
    topCoupons: { name: string; used: number; issued: number; rate: number }[];
    smsCount: number; smsRecipients: number;
  } | null>(null);
  const [statsTab, setStatsTab] = useState<'all'|'empty'>('all');

  /* ── 정산 관리 ── */
  const [settlementMonth, setSettlementMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });
  const [settlementData, setSettlementData] = useState<{
    confirmed: number; pending: number; cancelled: number;
    total: number; orderCount: number;
    byStatus: { status: string; count: number; amount: number }[];
    byMethod: { method: string; count: number; amount: number }[];
    daily: { date: string; amount: number }[];
    realSettle: number; aov: number; couponTotal: number; pointTotal: number;
    refundCount: number; refundRate: number;
    prevTotal: number; prevOrderCount: number;
    topProducts: { name: string; qty: number; amount: number }[];
    topCategories: { category: string; qty: number; amount: number }[];
  } | null>(null);
  /* 기간 프리셋 */
  const [settlementPreset, setSettlementPreset] = useState<'today'|'yesterday'|'7d'|'30d'|'thisMonth'|'lastMonth'|'all'|'custom'>('thisMonth');
  const [settlementCustFrom, setSettlementCustFrom] = useState('');
  const [settlementCustTo, setSettlementCustTo] = useState('');
  const [settlementLoading, setSettlementLoading] = useState(false);
  /* ── 농가 정산 ── */
  const [farmSettleMonth, setFarmSettleMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });
  const [farmSettleRows, setFarmSettleRows] = useState<{ farmId: string|null; farmName: string; qty: number; sales: number; payout: number; margin: number }[]>([]);
  const [farmSettleLoading, setFarmSettleLoading] = useState(false);
  const [farmSettlePaid, setFarmSettlePaid] = useState<Record<string, string>>({}); // farmId → paid_at
  /* 농가 상세 분석 */
  const [farmDetailOpen, setFarmDetailOpen] = useState(false);
  const [farmDetailTarget, setFarmDetailTarget] = useState<AdminFarm | null>(null);
  const [farmDetailLoading, setFarmDetailLoading] = useState(false);
  /* 원자료만 담아두고 기간별 지표는 화면에서 계산 — 3/6/12개월·달력 전환 때 재조회하지 않기 위함 */
  const [farmRaw, setFarmRaw] = useState<{
    items: FarmRawItem[]; reviews: FarmRawReview[]; options: FarmRawOption[]; prodName: Map<string, string>;
  } | null>(null);
  const [farmChartMonths, setFarmChartMonths] = useState(6);   // 3 / 6 / 12
  const [farmChartFrom, setFarmChartFrom] = useState('');      // 달력 직접 지정(비면 개월수 사용)
  const [farmChartTo,   setFarmChartTo]   = useState('');

  async function loadFarmSettlement(month: string) {
    setFarmSettleLoading(true);
    const supabase = createClient();
    const [year, mon] = month.split('-').map(Number);
    const from = new Date(year, mon - 1, 1).toISOString();
    const to   = new Date(year, mon,     1).toISOString();
    // 이미 정산완료한 내역
    const { data: paidData } = await supabase
      .from('farm_settlements').select('farm_id, paid_at').eq('period', month).eq('status', 'paid');
    const paidMap: Record<string, string> = {};
    (paidData || []).forEach((p: { farm_id: string; paid_at: string|null }) => { paidMap[p.farm_id] = p.paid_at || ''; });
    setFarmSettlePaid(paidMap);
    // 배송완료/구매확정 주문의 상품항목 + 농가 정보
    const { data } = await supabase
      .from('order_items')
      .select('quantity, subtotal, supply_price, orders!inner(status, created_at), products!inner(farm_id, supply_price, farms(id, name))')
      .gte('orders.created_at', from).lt('orders.created_at', to)
      .in('orders.status', ['delivered', 'confirmed'])
      .limit(10000);
    const map: Record<string, { farmId: string|null; farmName: string; qty: number; sales: number; payout: number }> = {};
    (data as Record<string, unknown>[] | null || []).forEach(row => {
      const prod = row.products as { farm_id: string|null; supply_price: number|null; farms: { id: string; name: string }|null } | null;
      const farmId = prod?.farm_id ?? null;
      const farmName = prod?.farms?.name ?? '농가 미지정';
      const key = farmId ?? '__none__';
      const qty = Number(row.quantity) || 0;
      const unitSupply = (row.supply_price != null ? Number(row.supply_price) : (prod?.supply_price ?? 0)) || 0;
      if (!map[key]) map[key] = { farmId, farmName, qty: 0, sales: 0, payout: 0 };
      map[key].qty    += qty;
      map[key].sales  += Number(row.subtotal) || 0;
      map[key].payout += unitSupply * qty;
    });
    const rows = Object.values(map)
      .map(r => ({ ...r, margin: r.sales - r.payout }))
      .sort((a, b) => b.payout - a.payout);
    setFarmSettleRows(rows);
    setFarmSettleLoading(false);
  }
  /* 정산 완료 처리 (upsert) */
  async function markFarmSettled(row: { farmId: string|null; sales: number; payout: number; margin: number }) {
    if (!row.farmId) { alert('농가 미지정 항목은 정산할 수 없습니다.'); return; }
    const supabase = createClient();
    const { error } = await supabase.from('farm_settlements').upsert({
      farm_id: row.farmId, period: farmSettleMonth,
      payout: row.payout, sales: row.sales, margin: row.margin,
      status: 'paid', paid_at: new Date().toISOString(),
    }, { onConflict: 'farm_id,period' });
    if (error) { alert('정산 처리 실패: ' + error.message); return; }
    setFarmSettlePaid(prev => ({ ...prev, [row.farmId!]: new Date().toISOString() }));
  }
  /* 정산 취소 */
  async function unmarkFarmSettled(farmId: string) {
    const supabase = createClient();
    const { error } = await supabase.from('farm_settlements').delete().eq('farm_id', farmId).eq('period', farmSettleMonth);
    if (error) { alert('취소 실패: ' + error.message); return; }
    setFarmSettlePaid(prev => { const n = { ...prev }; delete n[farmId]; return n; });
  }
  const [settlementView, setSettlementView] = useState<'daily'|'monthly'>('daily');
  const [settlementYearly, setSettlementYearly] = useState<{ month: number; amount: number }[]>([]);

  const loadedPanels = useRef(new Set<PanelKey>());

  /* ── 어드민 권한 확인 (모든 useState/useRef 이후) ── */
  async function checkAdmin() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    setAuthedUser(!!user);
    if (!user) { setIsAdmin(false); setAdminChecked(true); return; }
    const { data } = await supabase.rpc('is_current_user_admin');
    setIsAdmin(data === true);
    setAdminChecked(true);
  }
  useEffect(() => { checkAdmin(); }, []); // eslint-disable-line

  /* 관리자 로그인 처리 */
  async function doAdminLogin() {
    if (!admEmail.trim() || !admPw) return;
    setAdmLoginLoading(true); setAdmLoginErr('');
    const { signIn } = await import('@/lib/auth');
    const { error } = await signIn(admEmail.trim(), admPw);
    if (error) { setAdmLoginErr('이메일 또는 비밀번호를 확인해주세요.'); setAdmLoginLoading(false); return; }
    setAdminChecked(false);
    await checkAdmin();
    setAdmLoginLoading(false);
  }

  /* ── 대시보드 최초 로드 (isAdmin 확인 후) ── */
  useEffect(() => {
    if (isAdmin) loadDashboard();
  }, [isAdmin]); // eslint-disable-line

  /* ── 판매 성과: 로그인 후 + 기간(일/주/월) 변경 시 ── */
  useEffect(() => {
    if (isAdmin) loadSalesPerf(perfRange);
  }, [isAdmin, perfRange]); // eslint-disable-line

  /* ── 브라우저 뒤로/앞으로 가기 → 이전 패널로 이동 ── */
  useEffect(() => {
    function onPop() {
      const p = (window.history.state?.admPanel as PanelKey) || 'dashboard';
      go(p, true);
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── 섹션(패널) 이동 시 하위 필터 초기화 — 나갔다 와도 이전 선택이 남지 않도록.
        대시보드 바로가기는 pendingOrderStatus 로 원하는 상태를 전달해 그 값만 유지 ── */
  useEffect(() => {
    setOrderFarmFilter(''); setOrderSearch(''); setOrderPage(1);
    setRefundFilter('all');
    setOrderStatusFilter(pendingOrderStatus.current ?? '');
    setRefundTypeFilter(pendingRefundType.current ?? '');
    setRefundStatusFilter(pendingRefundStatus.current ?? '');
    pendingOrderStatus.current = null;
    pendingRefundType.current = null;
    pendingRefundStatus.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel]);

  /* 메뉴 순서변경 드래그 중인 행 id (훅이므로 early return 위에 선언) */
  const dragRow = useRef<string | null>(null);

  /* ── Early return: 모든 Hook 선언 이후에만 위치 가능 ── */
  if (!adminChecked) {
    return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontSize:14, color:'#94A3B8' }}>확인 중...</div>;
  }
  if (!isAdmin) {
    /* 로그인 O · 관리자 X → 권한 없음 안내 + 로그아웃 */
    if (authedUser) {
      return (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', gap:12 }}>
          <div style={{ fontSize:32 }}>🔒</div>
          <div style={{ fontSize:16, fontWeight:700, color:'#1A1A1A' }}>관리자 권한이 없는 계정입니다</div>
          <div style={{ fontSize:13, color:'#94A3B8' }}>관리자 계정으로 다시 로그인해주세요.</div>
          <button onClick={async () => { await createClient().auth.signOut(); setAuthedUser(false); }}
            style={{ marginTop:8, fontSize:13, color:'#1A1A1A', textDecoration:'underline', background:'none', border:'none', cursor:'pointer' }}>
            다른 계정으로 로그인
          </button>
        </div>
      );
    }
    /* 미로그인 → 관리자 전용 로그인 화면 (자사몰 로그인과 동일 스타일) */
    return (
      <div className="login-wrap">
        <div className="login-box">
          <h1 className="login-title">관리자 로그인</h1>
          <input type="text" className="login-input" placeholder="이메일을 입력해주세요"
            value={admEmail} onChange={e => setAdmEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && document.getElementById('admPw')?.focus()} autoComplete="email" />
          <input id="admPw" type="password" className="login-input login-input-pw" placeholder="비밀번호를 입력해주세요"
            value={admPw} onChange={e => setAdmPw(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doAdminLogin()} autoComplete="current-password" />
          {admLoginErr && (
            <p style={{ color:'var(--color-error)', fontSize:13, marginBottom:8, marginTop:-2 }}>{admLoginErr}</p>
          )}
          <button className="login-btn login-btn-solid" onClick={doAdminLogin} disabled={admLoginLoading}>
            {admLoginLoading ? '로그인 중...' : '로그인'}
          </button>
          <a href="/" style={{ marginTop:14, fontSize:13, color:'#94A3B8', textAlign:'center', textDecoration:'none' }}>← 쇼핑몰로 돌아가기</a>
        </div>
      </div>
    );
  }

  const now = new Date();
  const dateStr = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')}`;

  /* ========== 데이터 Fetch 함수 ========== */

  async function loadDashboard() {
    const supabase = createClient();
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

    const [ordersRes, membersRes, ...stageRes] = await Promise.all([
      supabase.from('orders').select('final_amount, created_at').gte('created_at', monthStart).in('status', VALID_ORDER_STATUS),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      ...ORDER_STAGES.map(st =>
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', st.key)
      ),
    ]);

    /* 단계별 실시간 건수 */
    const counts: Record<string, number> = {};
    ORDER_STAGES.forEach((st, i) => { counts[st.key] = stageRes[i]?.count || 0; });
    setStageCounts(counts);
    setDashRefreshedAt(new Date());

    /* 취소·반품·교환 / 판매지연 (대시보드 카드) */
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
    const [cancelReqRes, refundingRes, exchangeRes, shipDelayRes, refundDelayRes, csRes, prodInqRes, farmInqRes, reviewRes, cancelPendingRes, refundPendingRes] = await Promise.all([
      supabase.from('refund_requests').select('id', { count:'exact', head:true }).eq('status', 'pending'),
      supabase.from('orders').select('id', { count:'exact', head:true }).eq('status', 'refunding'),
      supabase.from('orders').select('id', { count:'exact', head:true }).in('status', ['exchanging','exchanged']),
      supabase.from('orders').select('id', { count:'exact', head:true }).in('status', ['paid','preparing']).lt('created_at', twoDaysAgo),
      supabase.from('refund_requests').select('id', { count:'exact', head:true }).eq('status', 'pending').lt('created_at', twoDaysAgo),
      supabase.from('cs_inquiries').select('id', { count:'exact', head:true }).eq('status', 'pending'),
      supabase.from('product_inquiries').select('id', { count:'exact', head:true }).is('answer', null),
      supabase.from('farm_inquiries').select('id', { count:'exact', head:true }).or('status.eq.pending,status.eq.new,status.is.null'),
      supabase.from('reviews').select('id', { count:'exact', head:true }).is('seller_reply', null),
      supabase.from('refund_requests').select('id', { count:'exact', head:true }).eq('status', 'pending').eq('type', 'cancel'),
      supabase.from('refund_requests').select('id', { count:'exact', head:true }).eq('status', 'pending').or('type.eq.refund,type.is.null'),
    ]);
    setDashExtra({
      cancelReq:  cancelReqRes.count   || 0,
      refunding:  refundingRes.count   || 0,
      exchanging: exchangeRes.count    || 0,
      shipDelay:  shipDelayRes.count   || 0,
      refundDelay: refundDelayRes.count || 0,
      pendingCancel: cancelPendingRes.count || 0,
      pendingRefund: refundPendingRes.count || 0,
      unansweredCs:      csRes.count      || 0,
      unansweredProdInq: prodInqRes.count || 0,
      unansweredFarmInq: farmInqRes.count || 0,
      unansweredReview:  reviewRes.count  || 0,
    });

    const allOrders = ordersRes.data || [];
    const monthRevenue = allOrders.reduce((s, o) => s + (o.final_amount || 0), 0);
    const monthOrders = allOrders.length;
    const todayOrders = allOrders.filter(o => o.created_at >= todayStart);
    const todayRevenue = todayOrders.reduce((s, o) => s + (o.final_amount || 0), 0);

    setStats({
      monthRevenue,
      todayRevenue,
      monthOrders,
      todayOrders: todayOrders.length,
      totalMembers: membersRes.count || 0,
    });

    // ── 매출 추이 차트 (주간=이번주 월~일 / 월간=이번달 1~말일) ──
    const dkey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const cNow = new Date();
    const weekMon = new Date(cNow); weekMon.setDate(cNow.getDate() - ((cNow.getDay()+6)%7)); weekMon.setHours(0,0,0,0);
    const monthFirst = new Date(cNow.getFullYear(), cNow.getMonth(), 1);
    const monthLast  = new Date(cNow.getFullYear(), cNow.getMonth()+1, 0);
    const fetchStart = weekMon < monthFirst ? weekMon : monthFirst; // 둘 중 이른 날짜부터 조회
    const { data: chartOrders } = await supabase
      .from('orders')
      .select('final_amount, created_at')
      .gte('created_at', fetchStart.toISOString())
      .in('status', VALID_ORDER_STATUS);

    const dayMap: Record<string, number> = {};
    (chartOrders || []).forEach((o: { final_amount: number; created_at: string }) => {
      const key = dkey(new Date(o.created_at));
      dayMap[key] = (dayMap[key] || 0) + o.final_amount;
    });

    // 주간: 이번주 월요일~일요일 (7일)
    const labelsW: string[] = [], valuesW: number[] = [];
    for (let i = 0; i < 7; i++) { const d = new Date(weekMon); d.setDate(weekMon.getDate()+i); labelsW.push(`${d.getMonth()+1}/${d.getDate()}`); valuesW.push(dayMap[dkey(d)] || 0); }
    // 월간: 이번달 1일~말일
    const labelsM: string[] = [], valuesM: number[] = [];
    for (let d = new Date(monthFirst); d <= monthLast; d.setDate(d.getDate()+1)) { labelsM.push(`${d.getMonth()+1}/${d.getDate()}`); valuesM.push(dayMap[dkey(d)] || 0); }
    setChartData({ '7': { labels: labelsW, values: valuesW }, '30': { labels: labelsM, values: valuesM } });

    setStatsLoading(false);
    loadMemberDash();
    loadProductRank();
  }

  /* 상품별 판매 순위 TOP5 (이번주 월~일 / 이번달 1~말일) — 판매 수량 기준 */
  async function loadProductRank() {
    const supabase = createClient();
    const cNow = new Date();
    const weekMon = new Date(cNow); weekMon.setDate(cNow.getDate() - ((cNow.getDay()+6)%7)); weekMon.setHours(0,0,0,0);
    const weekEnd = new Date(weekMon); weekEnd.setDate(weekMon.getDate()+6); weekEnd.setHours(23,59,59,999);
    const monthFirst = new Date(cNow.getFullYear(), cNow.getMonth(), 1);
    const monthEnd = new Date(cNow.getFullYear(), cNow.getMonth()+1, 0); monthEnd.setHours(23,59,59,999);
    const fetchStart = weekMon < monthFirst ? weekMon : monthFirst;

    // 기간 내 유효주문 → 그 주문의 상품 아이템 집계
    const { data: ords } = await supabase.from('orders').select('id, created_at')
      .gte('created_at', fetchStart.toISOString()).in('status', VALID_ORDER_STATUS).limit(10000);
    const orderDate: Record<string, number> = {};
    (ords || []).forEach((o: { id:string; created_at:string }) => { orderDate[o.id] = new Date(o.created_at).getTime(); });
    const orderIds = Object.keys(orderDate);
    if (orderIds.length === 0) { setProductRank({ '7': [], '30': [] }); return; }

    const items: { order_id:string; product_name:string|null; option_label:string|null; unit_price:number|null; quantity:number|null }[] = [];
    for (let i = 0; i < orderIds.length; i += 300) {
      const { data } = await supabase.from('order_items')
        .select('order_id, product_name, option_label, unit_price, quantity')
        .in('order_id', orderIds.slice(i, i+300));
      if (data) items.push(...(data as typeof items));
    }

    const parseName = (full: string) => {
      // 상품명 뒤 " (옵션)" 분리 — 옵션 안에 괄호가 또 있어도(중첩) 첫 " (" ~ 마지막 ")" 사이를 옵션으로
      const i = full.indexOf(' (');
      if (i >= 0 && full.trim().endsWith(')')) return { name: full.slice(0, i).trim(), option: full.slice(i + 2, full.lastIndexOf(')')).trim() };
      return { name: full, option: '' };
    };
    const agg = (start: number, end: number): RankItem[] => {
      const map: Record<string, RankItem> = {};
      items.forEach(it => {
        const t = orderDate[it.order_id]; if (t == null || t < start || t > end) return;
        const full = it.product_name || '상품';
        const pn = parseName(full);
        const opt = (it.option_label || '').trim() || pn.option || '-';
        const key = `${full}`;
        if (!map[key]) map[key] = { name: pn.name, option: opt, unit_price: it.unit_price || 0, qty: 0 };
        map[key].qty += it.quantity || 0;
        if (it.unit_price) map[key].unit_price = it.unit_price;
      });
      return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 5);
    };
    setProductRank({
      '7':  agg(weekMon.getTime(), weekEnd.getTime()),
      '30': agg(monthFirst.getTime(), monthEnd.getTime()),
    });
  }

  /* 회원 현황 (전체회원·이번달신규·구매회원·재구매율·평균구매횟수 + 전월 대비) */
  async function loadMemberDash() {
    const supabase = createClient();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthStartISO = monthStart.toISOString();
    const lastMonthStartISO = lastMonthStart.toISOString();

    const [totalRes, newThisRes, newPrevRes, withdrawThisRes, ordersRes] = await Promise.all([
      supabase.from('profiles').select('id', { count:'exact', head:true }),
      supabase.from('profiles').select('id', { count:'exact', head:true }).gte('created_at', monthStartISO),
      supabase.from('profiles').select('id', { count:'exact', head:true }).gte('created_at', lastMonthStartISO).lt('created_at', monthStartISO),
      supabase.from('withdrawn_users').select('id', { count:'exact', head:true }).gte('withdrawn_at', monthStartISO),
      // 유효 주문(취소·환불·무통장 미입금 제외) — 구매자/재구매/평균구매횟수 계산용
      supabase.from('orders').select('user_id, created_at').in('status', VALID_ORDER_STATUS).limit(20000),
    ]);

    const orders = ((ordersRes.data as { user_id:string|null; created_at:string }[]) || []).filter(o => o.user_id);
    const nowMs = now.getTime() + 1000;
    const monthStartMs = monthStart.getTime();
    const lastMonthStartMs = lastMonthStart.getTime();

    /* 특정 기간(periodStart~periodEnd) 구매자 기준 지표. cumEnd = 누적 구매횟수 계산 마감 시점 */
    const calc = (periodStart:number, periodEnd:number, cumEnd:number) => {
      const cum: Record<string, number> = {};
      orders.forEach(o => { const t = new Date(o.created_at).getTime(); if (t < cumEnd) cum[o.user_id!] = (cum[o.user_id!] || 0) + 1; });
      const inPeriod = orders.filter(o => { const t = new Date(o.created_at).getTime(); return t >= periodStart && t < periodEnd; });
      const buyers = new Set(inPeriod.map(o => o.user_id!));
      const buyerCnt = buyers.size;
      let repeat = 0; buyers.forEach(u => { if ((cum[u] || 0) >= 2) repeat++; });
      return {
        buyers: buyerCnt,
        repeatRate: buyerCnt > 0 ? repeat / buyerCnt * 100 : 0,
        avgOrders: buyerCnt > 0 ? inPeriod.length / buyerCnt : 0,
      };
    };
    const cur = calc(monthStartMs, nowMs, nowMs);
    const prev = calc(lastMonthStartMs, monthStartMs, monthStartMs);

    const newThis = newThisRes.count || 0;
    setMemberDash({
      total: totalRes.count || 0,
      netIncrease: newThis - (withdrawThisRes.count || 0),
      newThis,
      newPrev: newPrevRes.count || 0,
      buyersThis: cur.buyers,
      buyersPrev: prev.buyers,
      repeatRateThis: cur.repeatRate,
      repeatRatePrev: prev.repeatRate,
      avgOrdersThis: cur.avgOrders,
      avgOrdersPrev: prev.avgOrders,
    });
  }

  async function loadOrders(opts?: { from?: string; to?: string; basis?: 'paid_at'|'delivered_at' }) {
    setOrdersLoading(true);
    setOrderPage(1);
    const basis = opts?.basis ?? orderDateBasis;
    const from  = opts?.from  ?? orderFrom;
    const to    = opts?.to    ?? orderTo;
    const supabase = createClient();
    let query = supabase
      .from('orders')
      .select('*,order_items(id,product_name,option_label,quantity,unit_price,subtotal,supply_price,thumbnail_url,farm_id,courier,tracking_number,ship_status,products(farm_id,farms(name,carrier)))')
      .order(basis, { ascending: false })
      .limit(1000);
    /* 조회 기준(주문일/결제일) + 기간 필터 */
    if (from) query = query.gte(basis, new Date(`${from}T00:00:00`).toISOString());
    if (to)   query = query.lte(basis, new Date(`${to}T23:59:59`).toISOString());
    const { data } = await query;
    // farm_id, farm_name 평탄화
    const orders = (data || []).map((o: Record<string, unknown>) => ({
      ...o,
      order_items: ((o.order_items as Record<string, unknown>[]) || []).map((item: Record<string, unknown>) => {
        const prod = item.products as Record<string, unknown> | null;
        const farm = prod?.farms as Record<string, unknown> | null;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { products: _p, ...rest } = item;
        return { ...rest, farm_id: (item.farm_id as string) ?? prod?.farm_id ?? null, farm_name: farm?.name ?? null, carrier: farm?.carrier ?? null };
      }),
    }));
    setOrders(orders as unknown as Order[]);
    setOrdersLoading(false);
    refreshStageCounts();
  }

  /* 주문 단계별 실시간 건수 재조회 (대시보드·주문관리 공용) */
  async function refreshStageCounts() {
    const supabase = createClient();
    const res = await Promise.all(
      ORDER_STAGES.map(st =>
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', st.key)
      )
    );
    const counts: Record<string, number> = {};
    ORDER_STAGES.forEach((st, i) => { counts[st.key] = res[i]?.count || 0; });
    setStageCounts(counts);
  }

  async function loadProducts() {
    setProductsLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('products')
      .select('id, name, category, price, discount_rate, discounted_price, is_active, farm_id, sort_order, created_at, product_options(stock, manage_stock)')
      .order('sort_order')
      .limit(200);
    /* 옵션 재고 합계 → total_stock 평탄화 (품절 판정용).
       단품(옵션 0개)·재고 무한(manage_stock=false) 옵션 보유 시 → null = 재고 N/A(품절 아님) */
    const flat = (data || []).map((p: Record<string, unknown>) => {
      const opts = (p.product_options as { stock: number; manage_stock?: boolean | null }[]) || [];
      const managed = opts.filter(o => o.manage_stock !== false);
      const hasUnlimited = opts.length > managed.length;
      const total_stock = (!hasUnlimited && managed.length > 0) ? managed.reduce((s, o) => s + (o.stock || 0), 0) : null;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { product_options: _po, ...rest } = p;
      return { ...rest, total_stock };
    });
    setProducts(flat as AdminProduct[]);
    setProductsLoading(false);
  }

  /* ========== 필탭 / 카테고리 ========== */
  async function loadFilterTabs() {
    setFtLoading(true);
    setFilterTabs(await loadAllTabs());
    setFtLoading(false);
  }
  function openFtModal(t?: FilterTab) {
    if (t) {
      setEditingFt(t);
      setFtForm({ tab_type: t.tab_type, tab_value: t.tab_value, label: t.label, emoji: t.emoji || '',
        bg: t.bg || '#F5F5F5', is_active: t.is_active,
        show_in_home: t.show_in_home, show_in_category: t.show_in_category, show_in_shortcut: t.show_in_shortcut, parent: t.parent || '' });
    } else {
      setEditingFt(null);
      setFtForm(FT_EMPTY);
    }
    setFtModal(true);
  }
  async function saveFilterTab() {
    const f = ftForm;
    if (!f.label.trim()) { alert('이름을 입력하세요.'); return; }
    if (!f.tab_value.trim()) {
      alert(f.tab_type === 'category' ? '카테고리 키(영문, 예: apple)를 입력하세요.'
        : f.tab_type === 'link' ? '이동 경로(예: /brand)를 입력하세요.'
        : '값을 입력하세요.'); return;
    }
    const supabase = createClient();
    const payload = {
      tab_type: f.tab_type, tab_value: f.tab_value.trim(), label: f.label.trim(),
      emoji: f.emoji.trim(), bg: f.bg || '#F5F5F5', is_active: f.is_active,
      show_in_home: f.show_in_home, show_in_category: f.show_in_category, show_in_shortcut: f.show_in_shortcut,
      parent: f.tab_type === 'category' && f.parent ? f.parent.trim() : null,
    };
    if (editingFt) {
      const { error } = await supabase.from('filter_tabs').update(payload).eq('id', editingFt.id);
      if (error) { alert('저장 실패: ' + error.message); return; }
    } else {
      const maxOrder = filterTabs.reduce((m, t) => Math.max(m, t.sort_order), 0);
      const { error } = await supabase.from('filter_tabs').insert({ ...payload, sort_order: maxOrder + 10 });
      if (error) { alert('추가 실패: ' + error.message); return; }
    }
    setFtModal(false);
    loadFilterTabs();
  }
  async function deleteFilterTab(t: FilterTab) {
    const supabase = createClient();
    if (t.tab_type === 'category') {
      // 이 카테고리를 쓰는 상품 수 확인
      const { count } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('category', t.tab_value);
      const n = count || 0;
      if (n > 0) {
        if (!confirm(`'${t.label}' 카테고리를 쓰는 상품 ${n}개가 있습니다.\n삭제하면 해당 상품들의 카테고리가 '기타'로 변경됩니다. 계속할까요?`)) return;
        const { error: upErr } = await supabase.from('products').update({ category: 'etc' }).eq('category', t.tab_value);
        if (upErr) { alert('상품 이동 실패: ' + upErr.message); return; }
      } else {
        if (!confirm(`'${t.label}' 필탭을 삭제할까요?`)) return;
      }
    } else {
      if (!confirm(`'${t.label}' 필탭을 삭제할까요?`)) return;
    }
    const { error } = await supabase.from('filter_tabs').delete().eq('id', t.id);
    if (error) { alert('삭제 실패: ' + error.message); return; }
    loadFilterTabs();
  }
  async function moveFilterTab(t: FilterTab, dir: -1 | 1) {
    const sorted = [...filterTabs].sort((a, b) => a.sort_order - b.sort_order);
    const i = sorted.findIndex(x => x.id === t.id);
    const j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    const a = sorted[i], b = sorted[j];
    const supabase = createClient();
    await Promise.all([
      supabase.from('filter_tabs').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('filter_tabs').update({ sort_order: a.sort_order }).eq('id', b.id),
    ]);
    loadFilterTabs();
  }

  /* 드래그 순서변경 — 같은 그룹(같은 parent) 안에서만 재배치 후 sort_order 재부여.
     (dragRow ref는 훅이라 early return 위 hook 영역에 선언되어 있음) */
  async function reorderFilterTabs(draggedId: string, targetId: string) {
    if (draggedId === targetId) return;
    const dragged = filterTabs.find(t => t.id === draggedId);
    const target  = filterTabs.find(t => t.id === targetId);
    if (!dragged || !target) return;
    // 그룹 키: 소분류는 parent, 최상위는 카테고리(#cat)/필탭(#filtag) 구분 (섞이지 않게)
    const keyOf = (t: FilterTab) => t.parent || (t.tab_type === 'category' ? '#cat' : '#filtag');
    if (keyOf(dragged) !== keyOf(target)) return;
    const group = filterTabs.filter(t => keyOf(t) === keyOf(dragged)).sort((a, b) => a.sort_order - b.sort_order);
    const from = group.findIndex(t => t.id === draggedId);
    const to   = group.findIndex(t => t.id === targetId);
    const next = [...group];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const supabase = createClient();
    await Promise.all(next.map((t, i) => supabase.from('filter_tabs').update({ sort_order: (i + 1) * 10 }).eq('id', t.id)));
    loadFilterTabs();
  }
  async function reorderMenus(draggedId: string, targetId: string) {
    if (draggedId === targetId) return;
    const dragged = menus.find(t => t.id === draggedId);
    const target  = menus.find(t => t.id === targetId);
    if (!dragged || !target || (dragged.parent || '') !== (target.parent || '')) return;
    const group = menus.filter(t => (t.parent || '') === (dragged.parent || '')).sort((a, b) => a.sort_order - b.sort_order);
    const from = group.findIndex(t => t.id === draggedId);
    const to   = group.findIndex(t => t.id === targetId);
    const next = [...group];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const supabase = createClient();
    await Promise.all(next.map((t, i) => supabase.from('menu_items').update({ sort_order: (i + 1) * 10 }).eq('id', t.id)));
    loadMenus();
  }

  /* ========== 상단 메뉴 관리 (menu_items) ========== */
  async function loadMenus() {
    setMenusLoading(true);
    const { data } = await createClient().from('menu_items')
      .select('id,label,href,emoji,parent,sort_order,is_active,show_in_mega,show_in_header,show_in_shortcut')
      .order('sort_order');
    setMenus((data as MenuRow[]) || []);
    setMenusLoading(false);
  }
  async function addMenu(row: Partial<MenuRow>) {
    const maxOrder = menus.reduce((m, x) => Math.max(m, x.sort_order), 0);
    const { error } = await createClient().from('menu_items').insert({
      label: '새 메뉴', href: '/', emoji: '', sort_order: maxOrder + 10,
      is_active: true, show_in_mega: false, show_in_header: false, show_in_shortcut: false, parent: null, ...row,
    });
    if (error) { alert('추가 실패: ' + error.message); return; }
    loadMenus();
  }
  async function updateMenu(id: string, patch: Partial<MenuRow>, reload = true) {
    await createClient().from('menu_items').update(patch).eq('id', id);
    if (reload) loadMenus();
    else setMenus(prev => prev.map(x => x.id === id ? { ...x, ...patch } : x));
  }
  async function deleteMenu(id: string) {
    if (!confirm('이 메뉴를 삭제할까요? (하위 링크도 함께 삭제됩니다)')) return;
    await createClient().from('menu_items').delete().eq('id', id);
    loadMenus();
  }

  /* ── 카테고리(filter_tabs) 인라인 CRUD (메뉴 관리 패널용) ── */
  function genCatSlug() { return 'cat_' + Math.random().toString(36).slice(2, 8); }
  async function updateFt(id: string, patch: Partial<FilterTab>, reload = true) {
    await createClient().from('filter_tabs').update(patch).eq('id', id);
    if (reload) loadFilterTabs();
    else setFilterTabs(prev => prev.map(x => x.id === id ? { ...x, ...patch } : x));
  }
  async function addCategory(parent: string | null) {
    const maxOrder = filterTabs.reduce((m, t) => Math.max(m, t.sort_order), 0);
    const { error } = await createClient().from('filter_tabs').insert({
      tab_type: 'category', tab_value: genCatSlug(), label: parent ? '새 소분류' : '새 대분류',
      emoji: '', bg: '#F5F5F5', sort_order: maxOrder + 10, is_active: true,
      show_in_home: false, show_in_category: true, show_in_shortcut: false, parent,
    });
    if (error) { alert('추가 실패: ' + error.message); return; }
    loadFilterTabs();
  }
  async function deleteCategory(t: FilterTab) {
    const subCount = filterTabs.filter(x => x.parent === t.tab_value).length;
    if (!confirm(`'${t.label}' 삭제할까요?${subCount ? ` (소분류 ${subCount}개도 함께 정리하세요)` : ''}`)) return;
    await createClient().from('filter_tabs').delete().eq('id', t.id);
    loadFilterTabs();
  }

  async function loadFarms() {
    setFarmsLoading(true);
    const supabase = createClient();
    const [{ data: farmData }, { data: wishData }, { data: prodData }] = await Promise.all([
      supabase.from('farms').select('id, slug, name, farmer_name, region, farm_type, items, intro, carrier, dispatch_cutoff, thumbnail_url, logo_url, landing_images, created_at').order('name'),
      supabase.from('farm_wishlist').select('farm_id').limit(10000),
      supabase.from('products').select('farm_id, is_active, review_count, avg_rating').limit(10000),
    ]);
    // 농가별 찜(팔로워) 수
    const wishMap: Record<string, number> = {};
    (wishData || []).forEach((w: { farm_id: string }) => { if (w.farm_id) wishMap[w.farm_id] = (wishMap[w.farm_id] || 0) + 1; });
    // 농가별 상품 수·판매중·리뷰 수·가중 평균 평점
    const pStat: Record<string, { count: number; active: number; reviews: number; rSum: number; rW: number }> = {};
    (prodData as { farm_id: string|null; is_active: boolean; review_count: number|null; avg_rating: number|null }[] | null || []).forEach(p => {
      if (!p.farm_id) return;
      if (!pStat[p.farm_id]) pStat[p.farm_id] = { count: 0, active: 0, reviews: 0, rSum: 0, rW: 0 };
      const s = pStat[p.farm_id]; s.count++; if (p.is_active) s.active++;
      const rc = p.review_count || 0; s.reviews += rc;
      if (rc > 0 && p.avg_rating) { s.rSum += p.avg_rating * rc; s.rW += rc; }
    });
    const farms = (farmData || []).map((f: Record<string, unknown>) => {
      const s = pStat[f.id as string] || { count: 0, active: 0, reviews: 0, rSum: 0, rW: 0 };
      return { ...f, wish_count: wishMap[f.id as string] || 0, product_count: s.count, active_count: s.active, review_count: s.reviews, avg_rating: s.rW > 0 ? s.rSum / s.rW : 0 };
    });
    setFarms(farms as AdminFarm[]);
    setFarmsLoading(false);
  }

  async function openFarmDetail(farm: AdminFarm) {
    setFarmDetailTarget(farm); setFarmDetailOpen(true); setFarmDetailLoading(true); setFarmRaw(null);
    setFarmChartMonths(6); setFarmChartFrom(''); setFarmChartTo('');
    const supabase = createClient();
    const { data: prods } = await supabase.from('products').select('id, name').eq('farm_id', farm.id);
    const prodIds = (prods || []).map((p: { id: string }) => p.id);
    const prodName = new Map<string, string>((prods || []).map((p: { id: string; name: string }) => [p.id, p.name]));
    if (prodIds.length === 0) {
      setFarmRaw({ items: [], reviews: [], options: [], prodName });
      setFarmDetailLoading(false); return;
    }
    /* 취소·환불까지 전부 가져온다 — 반품·취소율을 내려면 실패한 주문도 있어야 함 */
    const items: FarmRawItem[] = [];
    for (let i = 0; i < prodIds.length; i += 200) {
      const { data: it } = await supabase.from('order_items')
        .select('order_id, product_id, option_label, quantity, subtotal, supply_price, orders!inner(status, created_at, user_id)')
        .in('product_id', prodIds.slice(i, i + 200)).limit(10000);
      if (it) items.push(...(it as unknown as FarmRawItem[]));
    }
    const { data: revs } = await supabase.from('reviews')
      .select('id, rating, content, created_at, product_id')
      .in('product_id', prodIds).order('created_at', { ascending: false }).limit(500);
    /* 공급가 미입력 진단용 — 지금 옵션에 매입가가 비어 있는지 확인 */
    const { data: opts } = await supabase.from('product_options')
      .select('id, product_id, label, group_name, purchase_price, shipping_fee, supply_price')
      .in('product_id', prodIds).limit(2000);
    setFarmRaw({ items, reviews: (revs || []) as FarmRawReview[], options: (opts || []) as FarmRawOption[], prodName });
    setFarmDetailLoading(false);
  }

  function openFarmModal(farm?: AdminFarm) {
    setFarmMemo('');
    if (farm) {
      setEditingFarm(farm);
      setFarmForm({ name: farm.name, farmer_name: farm.farmer_name || '', region: farm.region || '', items: farm.items || [], intro: farm.intro || '', carrier: farm.carrier || '', dispatch_cutoff: farm.dispatch_cutoff || '', bank_name: '', bank_account: '', thumbnail_url: farm.thumbnail_url || '', logo_url: farm.logo_url || '', landing_images: farm.landing_images || [] });
      loadFarmMemos(farm.id);
      loadFarmBank(farm.id);
    } else {
      setEditingFarm(null);
      setFarmForm({ name: '', farmer_name: '', region: '', items: [], intro: '', carrier: '', dispatch_cutoff: '', bank_name: '', bank_account: '', thumbnail_url: '', logo_url: '', landing_images: [] });
      setFarmMemos([]);
    }
    setFarmModal(true);
  }

  /* 은행정보 — 관리자 전용 별도 테이블(farm_bank_info)에서 조회 */
  async function loadFarmBank(farmId: string) {
    const supabase = createClient();
    const { data } = await supabase.from('farm_bank_info')
      .select('bank_name, bank_account').eq('farm_id', farmId).maybeSingle();
    setFarmForm(p => ({ ...p, bank_name: data?.bank_name || '', bank_account: data?.bank_account || '' }));
  }

  /* ===== 브랜드 운영 메모 (최신이 위로 쌓임) ===== */
  async function loadFarmMemos(farmId: string) {
    const supabase = createClient();
    const { data } = await supabase.from('farm_memos')
      .select('id, content, admin_name, created_at')
      .eq('farm_id', farmId).order('created_at', { ascending: false });
    setFarmMemos(data || []);
  }

  async function addFarmMemo(farmId: string) {
    if (!farmMemo.trim()) return;
    setFarmMemoSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('farm_memos')
      .insert({ farm_id: farmId, content: farmMemo.trim(), admin_name: user?.email || null })
      .select('id, content, admin_name, created_at').single();
    setFarmMemoSaving(false);
    if (error) { alert('메모 저장 실패: ' + error.message); return; }
    setFarmMemos(prev => [data, ...prev]);
    setFarmMemo('');
  }

  async function deleteFarmMemo(id: string) {
    const supabase = createClient();
    await supabase.from('farm_memos').delete().eq('id', id);
    setFarmMemos(prev => prev.filter(m => m.id !== id));
  }

  async function saveFarm() {
    if (!farmForm.name.trim()) { alert('브랜드명을 입력해주세요.'); return; }
    setFarmSaving(true);
    const supabase = createClient();
    let slug = farmForm.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9가-힣-]/g, '').replace(/^-+|-+$/g, '');
    if (!slug) slug = 'farm-' + Date.now().toString(36);   // 한글 자모/특수문자만이면 빈 slug 방지(=404)
    const payload = { name: farmForm.name.trim(), farmer_name: farmForm.farmer_name || null, region: farmForm.region || null, items: farmForm.items.length ? farmForm.items : null, intro: farmForm.intro || null, carrier: farmForm.carrier || null, dispatch_cutoff: farmForm.dispatch_cutoff || null, thumbnail_url: farmForm.thumbnail_url || null, logo_url: farmForm.logo_url || null, landing_images: farmForm.landing_images.length ? farmForm.landing_images : null };
    let farmId = editingFarm?.id || '';
    if (editingFarm) {
      // 기존에 slug가 비어있던 농가(404 나던)는 수정 시 새 slug로 채워줌
      const editPayload = editingFarm.slug ? payload : { ...payload, slug };
      const { error } = await supabase.from('farms').update(editPayload).eq('id', editingFarm.id);
      if (!error) setFarms(prev => prev.map(f => f.id === editingFarm.id ? { ...f, ...editPayload } : f));
      else { alert('수정 실패: ' + error.message); setFarmSaving(false); return; }
    } else {
      const { data, error } = await supabase.from('farms').insert({ ...payload, slug }).select().single();
      if (!error && data) { farmId = (data as AdminFarm).id; setFarms(prev => [...prev, data as AdminFarm]); setFarmList(prev => [...prev, { id: (data as AdminFarm).id, name: (data as AdminFarm).name }]); }
      else { alert('등록 실패: ' + (error?.message || '')); setFarmSaving(false); return; }
    }

    /* 은행정보는 farms가 아니라 관리자 전용 테이블에 저장 (farms는 고객도 조회 가능) */
    const bn = farmForm.bank_name.trim(), ba = farmForm.bank_account.trim();
    if (farmId) {
      if (bn || ba) {
        const { error: bErr } = await supabase.from('farm_bank_info')
          .upsert({ farm_id: farmId, bank_name: bn || null, bank_account: ba || null, updated_at: new Date().toISOString() }, { onConflict: 'farm_id' });
        if (bErr) alert('은행정보 저장 실패: ' + bErr.message);
      } else {
        await supabase.from('farm_bank_info').delete().eq('farm_id', farmId);
      }
    }
    setFarmSaving(false);
    setFarmModal(false);
  }

  /* 농가 폼 '취급 품목' 후보 — 등록된 소분류 카테고리(실제 품목) + 이미 쓰이는 품목 */
  const itemPresets: string[] = [...new Set([
    ...filterTabs.filter(t => t.tab_type === 'category' && t.parent).map(t => t.label),
    ...farms.flatMap(f => f.items || []),
  ])].sort();

  async function deleteFarm(id: string) {
    if (!confirm('이 브랜드를 삭제하시겠습니까? 연결된 상품의 브랜드 정보도 해제됩니다.')) return;
    const supabase = createClient();
    await supabase.from('farms').delete().eq('id', id);
    setFarms(prev => prev.filter(f => f.id !== id));
  }

  async function loadFarmList() {
    if (farmList.length > 0) return;
    const supabase = createClient();
    const { data } = await supabase.from('farms').select('id, name, is_own').order('name');
    setFarmList((data as AdminFarmSimple[]) || []);
  }

  /* 카테고리별 다음 SKU 자동생성: APL-0001 */
  async function generateSku(category: string): Promise<string> {
    const code = CAT_SKU_CODE[category] || 'PRD';
    const supabase = createClient();
    // SKU 는 전역 유니크라 카테고리로 거르지 않고 같은 코드(prefix) 전체에서 최대번호 계산 (코드 공유 카테고리 충돌 방지)
    const { data } = await supabase.from('products')
      .select('sku').like('sku', `${code}-%`);
    let max = 0;
    (data || []).forEach((r: { sku: string | null }) => {
      const m = r.sku?.match(new RegExp(`^${code}-(\\d+)$`));
      if (m) max = Math.max(max, parseInt(m[1]));
    });
    return `${code}-${String(max + 1).padStart(4, '0')}`;
  }

  /* 상품 이미지 목록 — [대표, ...추가5]에서 실제 등록된 것만 (항상 왼쪽부터 채움) */
  const pImgList = (): string[] =>
    [pForm.thumbnail_url || null, ...((pForm.image_urls as (string|null)[]) || [])].filter((u): u is string => !!u);
  const setPImgList = (list: string[]) => {
    const next: (string|null)[] = [...list, ...Array(Math.max(0, 6 - list.length)).fill(null)];
    uploadedThumbnailRef.current = next[0] || '';
    setPForm(f => ({ ...f, thumbnail_url: next[0] || '', image_urls: next.slice(1, 6) }));
  };
  /* 드래그 이동 (등록된 이미지 인덱스 기준) */
  function reorderPImg(from: number, to: number) {
    const list = pImgList();
    if (from === to || from < 0 || from >= list.length) return;
    const [moved] = list.splice(from, 1);
    list.splice(Math.min(to, list.length), 0, moved);
    setPImgList(list);
  }

  function openProductModal(p?: AdminProduct) {
    loadFarmList();
    setDraftImages(null); setDraftInfo(null);   // 상세 버퍼 초기화 (신규 등록 시 새로 담김)
    detailUploadsRef.current = [];              // 상세이미지 업로드 추적 초기화
    if (p) {
      // 수정: 전체 필드 fetch 완료 후 모달 열기
      const supabase = createClient();
      supabase.from('products').select('*').eq('id', p.id).single().then(({ data }) => {
        if (data) {
          setEditingProduct(data as AdminProductFull);
          const thumb = data.thumbnail_url || '';
          uploadedThumbnailRef.current = thumb;   // ref도 동기화
          // image_urls: DB 값이 없으면 5칸 null 배열로 패딩
          const rawUrls: (string | null)[] = Array.isArray(data.image_urls) ? data.image_urls : [];
          const imageUrls: (string | null)[] = [
            rawUrls[0] ?? null, rawUrls[1] ?? null, rawUrls[2] ?? null,
            rawUrls[3] ?? null, rawUrls[4] ?? null,
          ];
          setPDiscOn((data.discount_rate || 0) > 0); // 기존 할인 있으면 펼친 상태로
          setPForm({
            sku: data.sku || '', name: data.name, category: data.category,
            origin: data.origin || '', origin_region: data.origin_region || '', supply_price: data.supply_price ?? 0, price: data.price, discount_rate: data.discount_rate,
            short_desc: data.short_desc || '', thumbnail_url: thumb, image_urls: imageUrls,
            dispatch_cutoff: data.dispatch_cutoff || '',
            brix: data.brix, badge: data.badge || '', badge_color: data.badge_color || BADGE_DEFAULT_COLOR, is_new: data.is_new,
            is_best: data.is_best, is_dawn: data.is_dawn, is_active: data.is_active,
            show_stat_pill: data.show_stat_pill !== false,
            farm_id: data.farm_id, sort_order: data.sort_order || 0,
            seller_score: data.seller_score || null,
          });
          setProductModal(true);
        }
      });
      // 옵션 로드
      supabase.from('product_options').select('label, add_price, purchase_price, shipping_fee, supply_price, stock, manage_stock, group_name, is_required, parent_label')
        .eq('product_id', p.id).order('sort_order')
        .then(({ data }) => {
          const rawRows: POpt[] = ((data || []) as { label: string; add_price: number; purchase_price: number | null; shipping_fee: number | null; supply_price: number | null; stock: number; manage_stock: boolean | null; group_name: string | null; is_required: boolean | null; parent_label: string | null }[]).map(o =>
            ({ id: newOptId(), group: o.group_name || '옵션', required: o.is_required !== false, label: o.label, add_price: o.add_price || 0,
              // 매입가 미입력 + 기존 공급가만 있는 예전 데이터 → 공급가를 매입가로 폴백
              purchase_price: o.purchase_price || (o.purchase_price === 0 && !o.shipping_fee ? (o.supply_price ?? 0) : 0),
              shipping_fee: o.shipping_fee ?? 0,
              stock: o.stock ?? 0, manage_stock: o.manage_stock !== false, parent_label: o.parent_label || '' }));
          // 중복 옵션 제거(같은 분류·그룹·라벨은 1개만) — 과거 중복 저장 데이터 방어
          const _seen = new Set<string>();
          const rows = rawRows.filter(r => { const k = `${(r.parent_label||'').trim()}|${r.group}|${(r.label||'').trim()}`; if (_seen.has(k)) return false; _seen.add(k); return true; });
          // 저장된 parent_label(상위 라벨) → 편집용 parent_id 로 연결
          for (const r of rows) {
            const pl = (r.parent_label || '').trim();
            if (pl) { const sup = rows.find(s => !(s.parent_label || '').trim() && s.label === pl); if (sup) r.parent_id = sup.id; }
          }
          setPOptions(rows);
        });
    } else {
      setEditingProduct(null);
      uploadedThumbnailRef.current = '';          // 새 등록 시 ref 초기화
      setPDiscOn(false); setPDiscAmount('');      // 신규는 할인 접힘
      setPForm({ ...PRODUCT_EMPTY });
      setPOptions([{ id: newOptId(), group: '옵션', required: true, label: '기본', add_price: 0, purchase_price: 0, shipping_fee: 0, stock: 999, manage_stock: true, parent_label: '' }]);  // 단품 기본 옵션
      setProductModal(true);
      // 기본 카테고리 기준 SKU 자동 생성
      generateSku(PRODUCT_EMPTY.category).then(sku => setPForm(f => ({ ...f, sku })));
    }
  }

  async function saveProduct() {
    if (!pForm.name.trim()) { alert('상품명을 입력하세요.'); return; }
    if (!pForm.price || pForm.price <= 0) { alert('정상가를 입력하세요.'); return; }
    /* 옵션 0개 = 단품 (옵션 선택 없이 바로구매). 허용. */
    // pForm 상태 + ref 양쪽 모두 확인 (스테일 클로저 방어)
    const thumbnailUrl = pForm.thumbnail_url?.trim() || uploadedThumbnailRef.current || null;
    console.log('[저장] pForm.thumbnail_url:', pForm.thumbnail_url);
    console.log('[저장] uploadedThumbnailRef:', uploadedThumbnailRef.current);
    console.log('[저장] 최종 thumbnail_url:', thumbnailUrl);
    setPSaving(true);
    const supabase = createClient();
    const price          = Number(pForm.price);
    const discount_rate  = Number(pForm.discount_rate) || 0;
    const finalSku = pForm.sku?.trim() || (!editingProduct ? await generateSku(pForm.category) : null);
    const payload = {
      sku:            finalSku,
      name:           pForm.name.trim(),
      category:       pForm.category,
      origin:         pForm.origin?.trim()        || 'domestic',
      origin_region:  pForm.origin_region?.trim() || null,
      supply_price:   Number(pForm.supply_price)  || 0,
      price,
      discount_rate,
      short_desc:     pForm.short_desc?.trim()    || null,
      thumbnail_url:  thumbnailUrl,
      image_urls:     (pForm.image_urls as (string|null)[])?.filter((u): u is string => Boolean(u)).length > 0
                        ? (pForm.image_urls as (string|null)[]).filter((u): u is string => Boolean(u))
                        : null,
      dispatch_cutoff: pForm.dispatch_cutoff?.trim() || null,
      brix:           pForm.brix != null ? Number(pForm.brix) : null,
      badge:          pForm.badge?.trim()         || null,
      badge_color:    pForm.badge?.trim() ? (pForm.badge_color || BADGE_DEFAULT_COLOR) : null,
      is_new:         Boolean(pForm.is_new),
      is_best:        Boolean(pForm.is_best),
      is_dawn:        Boolean(pForm.is_dawn),
      is_active:      Boolean(pForm.is_active),
      show_stat_pill: Boolean(pForm.show_stat_pill),
      // 자사배송(is_dawn=false) 상품은 자사센터(델리오)에 자동 연결 — 발주서용
      farm_id:        (pForm.is_dawn ? pForm.farm_id : (farmList.find(fm => fm.is_own)?.id ?? pForm.farm_id)) || null,
      sort_order:     Number(pForm.sort_order)    || 0,
      seller_score:   pForm.seller_score && Object.keys(pForm.seller_score).length > 0 ? pForm.seller_score : null,
    };
    let productId = editingProduct?.id;
    if (editingProduct) {
      const { error } = await supabase.from('products').update(payload).eq('id', editingProduct.id);
      if (error) { console.error('상품 저장 오류:', error); alert(`저장 실패: ${error.message}`); setPSaving(false); return; }
    } else {
      let { data, error } = await supabase.from('products').insert(payload).select('id').single();
      // SKU 중복(전역 유니크) 시 재생성 후 1회 재시도
      if (error && /sku/i.test(error.message)) {
        payload.sku = await generateSku(pForm.category);
        ({ data, error } = await supabase.from('products').insert(payload).select('id').single());
      }
      if (error || !data) { console.error('상품 저장 오류:', error); alert(`저장 실패: ${error?.message || ''}`); setPSaving(false); return; }
      productId = data.id;
    }

    // ── 옵션 저장 (기존 삭제 후 재삽입) ──
    if (productId) {
      // 기존 옵션 삭제 — 실패하면 중단(삭제 실패 후 insert 시 옵션이 중복 누적되는 것 방지)
      const { error: delErr } = await supabase.from('product_options').delete().eq('product_id', productId);
      if (delErr) { alert('옵션 저장 실패(기존 옵션 삭제 오류): ' + delErr.message + '\n다시 시도해주세요.'); setPSaving(false); return; }
      const validOptsRaw = pOptions.filter(o => o.label.trim());
      // parent_id(편집용 연결) → 상위 라벨(parent_label)로 변환해 저장 (스토어프론트는 parent_label 사용)
      const labelById = new Map(pOptions.map(o => [o.id, o.label?.trim() || '']));
      // 중복 옵션 방어: 같은 (상위라벨·그룹·라벨)은 1개만 저장
      const _seenSave = new Set<string>();
      const validOpts = validOptsRaw.filter(o => {
        const pl = o.parent_id ? (labelById.get(o.parent_id) || '') : (o.parent_label?.trim() || '');
        const k = `${pl}|${o.group?.trim() || '옵션'}|${o.label.trim()}`;
        if (_seenSave.has(k)) return false; _seenSave.add(k); return true;
      });
      if (validOpts.length > 0) {
        await supabase.from('product_options').insert(
          validOpts.map((o, i) => ({
            product_id: productId,
            group_name: o.group?.trim() || '옵션',
            is_required: o.required !== false,
            label: o.label.trim(),
            add_price: Number(o.add_price) || 0,
            purchase_price: Number(o.purchase_price) || 0,
            shipping_fee: Number(o.shipping_fee) || 0,
            // 공급가 = 매입가 + 배송비 (발주서·농가정산·트리거가 이 값을 사용)
            supply_price: (Number(o.purchase_price) || 0) + (Number(o.shipping_fee) || 0),
            stock: Number(o.stock) || 0,
            manage_stock: o.manage_stock !== false,
            parent_label: o.parent_id ? (labelById.get(o.parent_id) || null) : (o.parent_label?.trim() || null),
            is_default: i === 0,
            sort_order: i + 1,
          }))
        );
      }
    }

    // 신규 상품: 등록 중 버퍼에 담아둔 상세(이미지·정보)를 이제 함께 저장
    if (!editingProduct && productId && (draftImages?.length || draftInfo)) {
      const sections: { product_id: string; section_type: string; content: string; sort_order: number }[] = [];
      if (draftImages?.length) sections.push({ product_id: productId, section_type: 'detail_images', content: JSON.stringify({ images: draftImages }), sort_order: 0 });
      if (draftInfo)           sections.push({ product_id: productId, section_type: 'info_content',  content: JSON.stringify(draftInfo), sort_order: 99 });
      const { error: secErr } = await supabase.from('product_detail_sections').insert(sections);
      if (secErr) console.error('상세 저장 오류:', secErr);
    }
    // 세션에 업로드했으나 최종 목록에 없는 상세이미지(추가 후 삭제한 것)는 스토리지에서 정리
    if (!editingProduct && detailUploadsRef.current.length) {
      const kept = new Set((draftImages || []).map(storageKeyFromUrl).filter(Boolean) as string[]);
      const orphans = detailUploadsRef.current.filter(p => !kept.has(p));
      if (orphans.length) supabase.storage.from('products').remove(orphans).then(({ error }) => { if (error) console.error('상세이미지 정리 오류:', error); });
    }
    detailUploadsRef.current = [];
    setDraftImages(null); setDraftInfo(null);

    setPSaving(false);
    setProductModal(false);
    loadProducts();
    return productId;
  }

  /* 상세 에디터(상세설명/상세정보) 열기.
     - 신규 상품: 저장하지 않고 버퍼(메모리) 편집 모드로 연다 → 상품 등록 시 함께 커밋
     - 기존 상품: 해당 상품 상세를 곧바로 DB 편집 */
  async function saveAndEditDetail(kind: 'desc' | 'info') {
    if (!editingProduct) {
      const name = pForm.name.trim() || '새 상품';
      if (kind === 'desc') setDetailEditor({ id: '', name });   // id='' → 버퍼 모드
      else setInfoEditor({ id: '', name });
      return;
    }
    const id = editingProduct.id;
    const name = pForm.name.trim();
    if (kind === 'desc') setDetailEditor({ id, name });
    else setInfoEditor({ id, name });
  }

  /* 공개 URL → 스토리지 키(products 버킷 기준 경로) */
  function storageKeyFromUrl(url: string): string | null {
    const m = url.split('/storage/v1/object/public/products/');
    return m[1] ? decodeURIComponent(m[1]) : null;
  }

  /* 상품 등록/수정 화면 닫기.
     신규 등록을 저장 없이 닫으면 세션에 업로드해둔 상세이미지(_new)는 참조되지 않으므로 스토리지에서 정리 */
  async function closeProductForm() {
    setProductModal(false);
    if (!editingProduct && detailUploadsRef.current.length) {
      const paths = [...detailUploadsRef.current];
      detailUploadsRef.current = [];
      createClient().storage.from('products').remove(paths).then(({ error }) => {
        if (error) console.error('상세이미지 정리 오류:', error);
      });
    }
    setDraftImages(null); setDraftInfo(null);
  }

  async function toggleProductActive(p: AdminProduct) {
    const supabase = createClient();
    await supabase.from('products').update({ is_active: !p.is_active }).eq('id', p.id);
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, is_active: !x.is_active } : x));
  }
  async function deleteProduct(p: AdminProduct) {
    if (!confirm(`'${p.name}' 상품을 완전히 삭제할까요?\n\n옵션·상세정보도 함께 삭제되며 되돌릴 수 없습니다.\n(주문 내역이 있는 상품은 '비활성'을 권장)`)) return;
    const supabase = createClient();
    // 자식 데이터 먼저 정리 후 상품 삭제
    await supabase.from('product_options').delete().eq('product_id', p.id);
    await supabase.from('product_detail_sections').delete().eq('product_id', p.id);
    const { error } = await supabase.from('products').delete().eq('id', p.id);
    if (error) { alert('삭제 실패: ' + error.message + '\n(이 상품을 참조하는 주문 등이 있으면 비활성 처리하세요.)'); return; }
    setProducts(prev => prev.filter(x => x.id !== p.id));
  }

  async function loadMembers() {
    setMembersLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('profiles')
      .select('id, email, name, grade, point_balance, created_at, phone, is_blocked, memo, provider, marketing_sms')
      .order('created_at', { ascending: false })
      .limit(300);
    setMembers((data as AdminProfile[]) || []);
    setMembersLoading(false);
  }
  async function loadWithdrawn() {
    setWithdrawnLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('withdrawn_users')
      .select('id, email, phone, reason, withdrawn_at')
      .order('withdrawn_at', { ascending: false })
      .limit(500);
    setWithdrawnList((data as typeof withdrawnList) || []);
    setWithdrawnLoading(false);
  }

  async function openMemberDetail(m: AdminProfile) {
    setSelectedMember(m);
    setMemberMemo('');
    setMemberMemos([]);
    setMemberStats({ totalSpent: 0, orderCount: 0 });
    setMemberOrdersLoading(true);
    const supabase = createClient();
    const [{ data }, { data: memos }, { data: allOrders }] = await Promise.all([
      supabase.from('orders').select('id, order_no, status, final_amount, created_at')
        .eq('user_id', m.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('member_memos').select('id, content, admin_name, created_at')
        .eq('user_id', m.id).order('created_at', { ascending: false }),
      supabase.from('orders').select('final_amount, status').eq('user_id', m.id),
    ]);
    setMemberOrders((data as Order[]) || []);
    setMemberMemos(memos || []);
    /* 누적 구매금액 = 결제완료/배송 단계 주문 합 (취소·환불 제외) */
    const paid = (allOrders || []).filter((o: { status: string }) => ['paid','preparing','shipped','delivered','confirmed'].includes(o.status));
    setMemberStats({ totalSpent: paid.reduce((s: number, o: { final_amount: number }) => s + (o.final_amount || 0), 0), orderCount: paid.length });
    setMemberOrdersLoading(false);
  }

  /* 관리자 메모 추가(누적) */
  async function addMemberMemo(memberId: string) {
    if (!memberMemo.trim()) return;
    setMemberMemoSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('member_memos')
      .insert({ user_id: memberId, content: memberMemo.trim(), admin_name: user?.email || null })
      .select('id, content, admin_name, created_at').single();
    setMemberMemoSaving(false);
    if (error) { alert('메모 저장 실패: ' + error.message); return; }
    setMemberMemos(prev => [data, ...prev]);
    setMemberMemo('');
  }

  async function deleteMemberMemo(id: string) {
    const supabase = createClient();
    await supabase.from('member_memos').delete().eq('id', id);
    setMemberMemos(prev => prev.filter(m => m.id !== id));
  }

  async function changeMemberGrade(memberId: string, grade: string) {
    const supabase = createClient();
    /* 수동 변경 = 잠금 → 분기 자동 재산정에서 제외 */
    const { error } = await supabase.from('profiles')
      .update({ grade, grade_locked: true, grade_updated_at: new Date().toISOString() }).eq('id', memberId);
    if (!error) {
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, grade } : m));
      setSelectedMember(prev => prev?.id === memberId ? { ...prev, grade } : prev);
    }
  }

  async function toggleMemberBlock(memberId: string, isBlocked: boolean) {
    if (!confirm(isBlocked ? '이 회원의 블랙리스트를 해제하시겠습니까?' : '이 회원을 블랙리스트에 추가하시겠습니까?')) return;
    const supabase = createClient();
    const { error } = await supabase.from('profiles').update({ is_blocked: !isBlocked }).eq('id', memberId);
    if (!error) {
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, is_blocked: !isBlocked } : m));
      setSelectedMember(prev => prev?.id === memberId ? { ...prev, is_blocked: !isBlocked } : prev);
    }
  }

  async function loadSurveySettings() {
    const supabase = createClient();
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'survey_show_products').maybeSingle();
    setSurveyShowProducts(data?.value !== 'false');
  }

  async function toggleSurveyProducts(on: boolean) {
    setSurveyShowProducts(on);
    const supabase = createClient();
    await supabase.from('site_settings').upsert({ key: 'survey_show_products', value: on ? 'true' : 'false' }, { onConflict: 'key' });
  }

  async function loadSurveyResults() {
    setSurveyLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('survey_results')
      .select(`
        id, user_id, gender, age_group, family_size,
        result_type, result_label, axis1, axis2, axis3,
        purchase_frequency, purchase_purpose, decision_factor,
        created_at,
        profiles(name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(500);
    setSurveyResults((data as unknown as AdminSurveyResult[]) || []);
    const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
    setSurveyMemberTotal(count || 0);
    setSurveyLoading(false);
  }

  async function loadReferrals() {
    setReferralsLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('referrals')
      .select(`
        id, referrer_id, referred_id, rewarded, rewarded_at, created_at,
        referrer:profiles!referrals_referrer_id_fkey(name, email),
        referred:profiles!referrals_referred_id_fkey(name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(200);
    setReferrals((data as unknown as AdminReferral[]) || []);
    setReferralsLoading(false);
  }

  /* 친구추천으로 발급된 쿠폰 내역 (referral_rewards → user_coupons → profiles/coupons, JS 조인) */
  async function loadReferralCoupons() {
    setRefCouponsLoading(true);
    const supabase = createClient();
    const { data: rewards } = await supabase.from('referral_rewards')
      .select('referral_id, reward_type, user_coupon_id, created_at').order('created_at', { ascending: false }).limit(500);
    const ucIds = [...new Set((rewards || []).map((r: { user_coupon_id: string }) => r.user_coupon_id).filter(Boolean))];
    if (ucIds.length === 0) { setRefCoupons([]); setRefCouponsLoading(false); return; }
    const { data: ucs } = await supabase.from('user_coupons')
      .select('id, user_id, coupon_id, is_used, used_at, expires_at').in('id', ucIds);
    const ucMap = new Map((ucs || []).map((u: { id: string }) => [u.id, u]));
    const userIds = [...new Set((ucs || []).map((u: { user_id: string }) => u.user_id))];
    const couponIds = [...new Set((ucs || []).map((u: { coupon_id: string }) => u.coupon_id))];
    const [{ data: profs }, { data: cps }] = await Promise.all([
      supabase.from('profiles').select('id, name, email').in('id', userIds),
      supabase.from('coupons').select('id, discount_value').in('id', couponIds),
    ]);
    const profMap = new Map((profs || []).map((p: { id: string }) => [p.id, p]));
    const cpMap = new Map((cps || []).map((c: { id: string }) => [c.id, c]));
    const rows: RefCoupon[] = (rewards || []).map((r: { referral_id: string | null; reward_type: string; user_coupon_id: string; created_at: string }) => {
      const uc = ucMap.get(r.user_coupon_id) as { user_id: string; coupon_id: string; is_used: boolean; used_at: string | null; expires_at: string | null } | undefined;
      const prof = uc ? profMap.get(uc.user_id) as { name: string | null; email: string } | undefined : undefined;
      const cp = uc ? cpMap.get(uc.coupon_id) as { discount_value: number } | undefined : undefined;
      return {
        key: r.user_coupon_id || r.created_at,
        referral_id: r.referral_id,
        reward_type: r.reward_type,
        created_at: r.created_at,
        recipient_name: prof?.name || '(탈퇴)',
        recipient_email: prof?.email || '',
        discount_value: cp?.discount_value || 0,
        is_used: uc?.is_used || false,
        used_at: uc?.used_at || null,
        expires_at: uc?.expires_at || null,
      };
    });
    setRefCoupons(rows);
    setRefCouponsLoading(false);
  }

  /* 쿠폰 지급 내역 로드 (user_coupons → profiles/coupons JS 조인) */
  async function loadCouponLogs() {
    setCouponLogsLoading(true);
    const supabase = createClient();
    const { data: ucs } = await supabase.from('user_coupons')
      .select('id, user_id, coupon_id, is_used, issued_at, expires_at, grant_period')
      .order('issued_at', { ascending: false }).limit(2000);
    const userIds = [...new Set((ucs || []).map((u: { user_id: string }) => u.user_id))];
    const couponIds = [...new Set((ucs || []).map((u: { coupon_id: string }) => u.coupon_id))];
    const [{ data: profs }, { data: cps }] = await Promise.all([
      supabase.from('profiles').select('id, name, email').in('id', userIds.length ? userIds : ['_']),
      supabase.from('coupons').select('id, name, discount_type, discount_value, signup_grant, is_membership, is_public').in('id', couponIds.length ? couponIds : ['_']),
    ]);
    const profMap = new Map((profs || []).map((p: { id: string }) => [p.id, p]));
    const cpMap = new Map((cps || []).map((c: { id: string }) => [c.id, c]));
    const now = Date.now();
    const sourceOf = (gp: string | null, c: { signup_grant?: boolean; is_membership?: boolean; is_public?: boolean } | undefined) => {
      if (gp && /^\d{4}-\d{2}$/.test(gp)) return `멤버십 월발급 (${gp})`;
      if (gp && gp.startsWith('bday')) return '생일쿠폰';
      if (c?.signup_grant) return '신규회원 웰컴';
      if (c?.is_membership) return '멤버십';
      if (c?.is_public) return '다운로드/이벤트';
      return '수동/기타';
    };
    const categoryOf = (gp: string | null, c: { signup_grant?: boolean; is_membership?: boolean } | undefined): 'signup'|'membership'|'general' => {
      if (c?.signup_grant) return 'signup';
      if (c?.is_membership || (gp && (/^\d{4}-\d{2}$/.test(gp) || gp.startsWith('bday')))) return 'membership';
      return 'general';
    };
    const rows: CouponLog[] = (ucs || []).map((u: { id: string; user_id: string; coupon_id: string; is_used: boolean; issued_at: string; expires_at: string | null; grant_period: string | null }) => {
      const p = profMap.get(u.user_id) as { name: string | null; email: string } | undefined;
      const c = cpMap.get(u.coupon_id) as { name: string; discount_type: 'percent'|'fixed'; discount_value: number; signup_grant?: boolean; is_membership?: boolean; is_public?: boolean } | undefined;
      const expired = !u.is_used && !!u.expires_at && new Date(u.expires_at).getTime() < now;
      return {
        id: u.id,
        name: p?.name || '(탈퇴)',
        email: p?.email || '',
        couponName: c?.name || '(삭제된 쿠폰)',
        discountLabel: c ? (c.discount_type === 'percent' ? `${c.discount_value}%` : `${fmtPrice(c.discount_value)}원`) : '-',
        issued_at: u.issued_at,
        status: u.is_used ? '사용완료' : expired ? '만료' : '미사용',
        source: sourceOf(u.grant_period, c),
        category: categoryOf(u.grant_period, c),
      };
    });
    setCouponLogs(rows);
    setCouponLogsLoading(false);
  }

  async function revokeReferralReward(r: AdminReferral) {
    if (!confirm(`${r.referrer?.name || '추천인'}의 리워드를 철회하시겠습니까?\n지급된 5,000원 쿠폰(미사용분)이 회수되고 추천 상태가 초기화됩니다.`)) return;
    const supabase = createClient();
    /* 쿠폰 회수 + 발급이력 삭제 + 추천 상태 초기화 (SECURITY DEFINER RPC) */
    const { error } = await supabase.rpc('revoke_referral_reward', { p_referral_id: r.id });
    if (error) { alert('철회 실패: ' + error.message); return; }
    setReferrals(prev => prev.map(x => x.id === r.id ? { ...x, rewarded: false, rewarded_at: null } : x));
  }

  /* ── 환불 신청 관리 ── */
  async function loadRefundRequests() {
    setRefundLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('refund_requests')
      .select(`
        id, order_id, reason, detail, status, reject_reason, created_at, type,
        orders ( order_no, final_amount, status, portone_payment_id ),
        profiles:user_id ( name, email )
      `)
      .order('created_at', { ascending: false })
      .limit(200);
    setRefundReqs((data as unknown as AdminRefundReq[]) || []);
    setRefundLoading(false);
  }

  /* 환불 신청 상태 변경 + 주문 상태 연동 */
  async function updateRefundStatus(req: AdminRefundReq, newStatus: 'processing'|'completed'|'rejected'|'hold', rejectReason?: string) {
    const supabase = createClient();

    /* 환불 승인(완료)이면 실제 카드 취소부터 — 포트원 취소 API */
    if (newStatus === 'completed') {
      const pid = req.orders?.portone_payment_id;
      if (pid) {
        const res = await fetch('/api/payment/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId: pid, reason: '관리자 환불 승인' }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          alert('카드 취소 실패 — 상태 변경 중단\n' + (j.error || '') + (j.detail ? '\n' + JSON.stringify(j.detail) : ''));
          return;
        }
      } else {
        if (!confirm('이 주문은 결제 ID가 없어(0원/무통장 등) 실제 카드 취소 없이 상태만 "환불완료"로 바꿉니다. 계속할까요?')) return;
      }
    }

    const updatePayload: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'rejected') updatePayload.reject_reason = rejectReason || null;
    const { error } = await supabase.from('refund_requests').update(updatePayload).eq('id', req.id);
    if (error) { alert('상태 변경 실패: ' + error.message); return; }
    // 주문 상태 연동 (취소/환불 구분). 거절·보류는 주문 상태 변경 안 함
    const isCancel = req.type === 'cancel';
    let nextOrderStatus: string | null = null;
    if (newStatus === 'completed') nextOrderStatus = isCancel ? 'cancelled' : 'refunded';
    else if (newStatus === 'processing' && !isCancel) nextOrderStatus = 'refunding';
    if (req.order_id && nextOrderStatus) {
      await supabase.from('orders').update({ status: nextOrderStatus }).eq('id', req.order_id);
    }
    /* 승인(완료) 시 취소/환불 알림톡 */
    if (newStatus === 'completed' && req.order_id) {
      const ord = orders.find(o => o.id === req.order_id);
      if (ord) {
        /* 취소·환불 = 결제 관련 → 주문자(계정)에게만 발송 */
        notifyOrderPhones([ord.orderer_phone || ord.phone], {
          type: 'order_cancelled', recipient: ord.recipient,
          orderNo: ord.order_no, cancelledAt: new Date().toLocaleString('ko-KR'),
          refundAmount: `${(ord.final_amount || 0).toLocaleString()}원`,
        });
      }
    }
    /* 승인(완료) 시 사용 쿠폰·포인트 복원 (서버에서 멱등 처리) */
    if (newStatus === 'completed' && req.order_id) {
      try {
        const rr = await fetch('/api/admin/refund-restore', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: req.order_id }),
        });
        const rj = await rr.json().catch(() => ({}));
        if (rj?.restored) {
          const parts: string[] = [];
          if (rj.refundedPoint > 0) parts.push(`포인트 ${rj.refundedPoint.toLocaleString()}P 환급`);
          if (rj.clawback > 0) parts.push(`적립 ${rj.clawback.toLocaleString()}P 회수`);
          if (rj.couponRestored) parts.push('쿠폰 복원');
          if (parts.length) alert('복원 완료: ' + parts.join(' · '));
        }
      } catch { /* 복원 실패해도 환불 상태는 유지 */ }
    }
    setRefundReqs(prev => prev.map(r => r.id === req.id
      ? { ...r, status: newStatus, reject_reason: newStatus === 'rejected' ? (rejectReason || null) : r.reject_reason,
          orders: r.orders && nextOrderStatus ? { ...r.orders, status: nextOrderStatus } : r.orders }
      : r));
    setRefundDetail(prev => prev && prev.id === req.id ? { ...prev, status: newStatus, reject_reason: newStatus === 'rejected' ? (rejectReason || null) : prev.reject_reason } : prev);
    if (req.order_id && nextOrderStatus) setOrders(prev => prev.map(o => o.id === req.order_id ? { ...o, status: nextOrderStatus as string } : o));
    refreshStageCounts(); // 환불 처리로 바뀐 주문상태를 현황판에 반영
  }

  async function loadReviews() {
    setReviewsLoading(true);
    const supabase = createClient();
    const [{ data }, { data: reportCounts }] = await Promise.all([
      supabase.from('reviews')
        .select('id, product_id, rating, content, is_best, likes_count, image_urls, created_at, seller_reply, seller_replied_at, profiles(name, email), products(name, farm_id)')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('review_reports')
        .select('review_id, reason, created_at')
        .order('created_at', { ascending: false })
        .limit(1000),
    ]);
    const countMap: Record<string, number> = {};
    const reasonMap: Record<string, string[]> = {};
    (reportCounts || []).forEach((r: { review_id: string; reason: string | null }) => {
      countMap[r.review_id] = (countMap[r.review_id] || 0) + 1;
      if (r.reason) { (reasonMap[r.review_id] ||= []).push(r.reason); }
    });
    const reviews = (data || []).map((r: Record<string, unknown>) => ({
      ...r, report_count: countMap[r.id as string] || 0, report_reasons: reasonMap[r.id as string] || [],
    }));
    setReviews(reviews as unknown as AdminReview[]);
    setReviewsLoading(false);
  }

  /* 리뷰 판매자 답변 저장 — 서버 경유 필수.
     여기서 바로 update 하면 reviews RLS("본인 리뷰만 수정")에 막혀 0행 갱신 = 조용히 실패한다.
     (에러도 안 나서 저장된 것처럼 보였고, 실제로 답변이 하나도 저장돼 있지 않았음) */
  async function saveReviewReply(reviewId: string, reply: string) {
    setReviewReplySaving(true);
    try {
      const res = await fetch('/api/reviews/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId, reply }),
      });
      const json = await res.json();
      setReviewReplySaving(false);
      if (!json.ok) { alert('답변 저장 실패: ' + (json.error || '')); return; }
      const payload = { seller_reply: json.seller_reply, seller_replied_at: json.seller_replied_at };
      setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, ...payload } : r));
      setSelectedReview(prev => prev && prev.id === reviewId ? { ...prev, ...payload } : prev);
    } catch {
      setReviewReplySaving(false);
      alert('답변 저장 중 오류가 발생했습니다.');
    }
  }

  async function loadEvents() {
    setEventsLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('events')
      .select('*')
      .order('starts_at', { ascending: false });
    setEvents((data as AdminEvent[]) || []);
    setEventsLoading(false);
  }

  async function loadLounge() {
    setLoungeLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('lounge_posts')
      .select('id, filter, title, badge, date, is_active, sort_order, created_at')
      .order('sort_order')
      .order('created_at', { ascending: false });
    setLoungePosts((data as AdminLoungePost[]) || []);
    setLoungeLoading(false);
  }

  async function loadInquiries() {
    setInquiriesLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('farm_inquiries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    setInquiries((data as FarmInquiry[]) || []);
    setInquiriesLoading(false);
  }

  /* ========== FAQ ========== */
  async function loadFaq() {
    setFaqLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from('faq_items').select('*').order('category').order('sort_order');
    setFaqItems((data as FaqItem[]) || []);
    setFaqLoading(false);
  }

  /* FAQ 순서 이동 (같은 카테고리 내 인접 항목과 sort_order 교환) */
  async function moveFaq(item: FaqItem, dir: -1 | 1) {
    const sameCat = faqItems.filter(f => f.category === item.category).sort((a, b) => a.sort_order - b.sort_order);
    const idx = sameCat.findIndex(f => f.id === item.id);
    const swap = sameCat[idx + dir];
    if (!swap) return;
    const supabase = createClient();
    await Promise.all([
      supabase.from('faq_items').update({ sort_order: swap.sort_order }).eq('id', item.id),
      supabase.from('faq_items').update({ sort_order: item.sort_order }).eq('id', swap.id),
    ]);
    setFaqItems(prev => prev.map(f =>
      f.id === item.id ? { ...f, sort_order: swap.sort_order } :
      f.id === swap.id ? { ...f, sort_order: item.sort_order } : f));
  }

  function openFaqModal(item?: FaqItem) {
    if (item) {
      setEditingFaq(item);
      setFaqForm({ category: item.category, question: item.question, answer: item.answer, sort_order: item.sort_order, is_active: item.is_active });
    } else {
      setEditingFaq(null);
      setFaqForm({ ...FAQ_EMPTY });
    }
    setFaqModal(true);
  }

  async function saveFaq() {
    if (!faqForm.question.trim()) { alert('질문을 입력하세요.'); return; }
    if (!faqForm.answer.trim())   { alert('답변을 입력하세요.'); return; }
    setFaqSaving(true);
    const supabase = createClient();
    const payload = {
      category: faqForm.category,
      question: faqForm.question.trim(),
      answer: faqForm.answer.trim(),
      sort_order: Number(faqForm.sort_order) || 0,
      is_active: Boolean(faqForm.is_active),
    };
    const { error } = editingFaq
      ? await supabase.from('faq_items').update(payload).eq('id', editingFaq.id)
      : await supabase.from('faq_items').insert(payload);
    if (error) { alert('저장 실패: ' + error.message); setFaqSaving(false); return; }
    setFaqSaving(false);
    setFaqModal(false);
    loadFaq();
  }

  async function deleteFaq(id: string) {
    if (!confirm('이 FAQ를 삭제하시겠습니까?')) return;
    const supabase = createClient();
    await supabase.from('faq_items').delete().eq('id', id);
    setFaqItems(prev => prev.filter(f => f.id !== id));
  }

  async function toggleFaqActive(item: FaqItem) {
    const supabase = createClient();
    await supabase.from('faq_items').update({ is_active: !item.is_active }).eq('id', item.id);
    setFaqItems(prev => prev.map(f => f.id === item.id ? { ...f, is_active: !f.is_active } : f));
  }

  /* ========== 상품 문의 ========== */
  async function loadProductInquiries() {
    setProductInquiriesLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('product_inquiries')
      .select('id, product_id, user_id, category, content, is_private, answer, answered_at, created_at, products(name)')
      .order('created_at', { ascending: false })
      .limit(200);
    setProductInquiries((data as unknown as AdminProductInquiry[]) || []);
    setProductInquiriesLoading(false);
  }

  async function answerProductInquiry() {
    if (!selectedProductInquiry || !piqAnswer.trim()) { alert('답변을 입력하세요.'); return; }
    setPiqAnswering(true);
    const supabase = createClient();
    const { error } = await supabase.from('product_inquiries')
      .update({ answer: piqAnswer.trim(), answered_at: new Date().toISOString() })
      .eq('id', selectedProductInquiry.id);
    if (!error) {
      setProductInquiries(prev => prev.map(q => q.id === selectedProductInquiry.id
        ? { ...q, answer: piqAnswer.trim(), answered_at: new Date().toISOString() } : q));
      setSelectedProductInquiry(prev => prev ? { ...prev, answer: piqAnswer.trim(), answered_at: new Date().toISOString() } : null);
    } else { alert('답변 저장 실패: ' + error.message); }
    setPiqAnswering(false);
  }

  /* ========== 1:1 문의 ========== */
  async function loadCsInquiries() {
    setCsAdminLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from('cs_inquiries').select('*').order('created_at', { ascending: false }).limit(200);
    setCsItems((data as CsInquiryAdmin[]) || []);
    setCsAdminLoading(false);
  }

  async function answerCs() {
    if (!selectedCs || !csAnswer.trim()) { alert('답변을 입력하세요.'); return; }
    setCsAnswering(true);
    const supabase = createClient();
    const { error } = await supabase.from('cs_inquiries').update({ answer: csAnswer.trim(), status: 'answered' }).eq('id', selectedCs.id);
    if (error) { alert('저장 실패: ' + error.message); setCsAnswering(false); return; }
    setCsItems(prev => prev.map(c => c.id === selectedCs.id ? { ...c, answer: csAnswer.trim(), status: 'answered' } : c));
    setSelectedCs(null);
    setCsAnswer('');
    setCsAnswering(false);
  }

  /* ========== 팝업 관리 ========== */
  async function loadPopups() {
    setPopupsLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from('popups').select('*').order('created_at', { ascending: false });
    setPopups((data || []) as AdminPopup[]);
    setPopupsLoading(false);
  }

  async function uploadPopupImage(file: File): Promise<string | null> {
    setPpUploading(true);
    const supabase = createClient();
    const { blob, ext, type } = await compressImage(file, 1600);
    const path = `popup_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('banners').upload(path, blob, { upsert: true, contentType: type });
    if (error) { alert('업로드 실패: ' + error.message); setPpUploading(false); return null; }
    const { data } = supabase.storage.from('banners').getPublicUrl(path);
    setPpUploading(false);
    return data.publicUrl;
  }

  function openPopupModal(p?: AdminPopup) {
    if (p) {
      setEditingPopup(p);
      setPpForm({
        title: p.title || '', link_url: p.link_url || '/',
        width: p.width || 400, position: p.position || 'center',
        is_active: p.is_active,
        starts_at: p.starts_at ? p.starts_at.slice(0, 16) : '',
        ends_at:   p.ends_at   ? p.ends_at.slice(0, 16)   : '',
      });
      setPpImgUrl(p.image_url || '');
      setPpImgUrlMobile(p.image_url_mobile || '');
    } else {
      setEditingPopup(null);
      setPpForm({ ...POPUP_EMPTY });
      setPpImgUrl('');
      setPpImgUrlMobile('');
    }
    setPopupModal(true);
  }

  async function savePopup() {
    if (!ppImgUrl && !editingPopup?.image_url) { alert('이미지를 업로드해주세요.'); return; }
    setPpSaving(true);
    const supabase = createClient();
    const payload = {
      title:     ppForm.title.trim() || '',
      image_url: ppImgUrl || editingPopup?.image_url || null,
      image_url_mobile: ppImgUrlMobile || null,
      link_url:  ppForm.link_url.trim() || '/',
      width:     Number(ppForm.width) || 400,
      position:  ppForm.position,
      is_active: ppForm.is_active,
      starts_at: ppForm.starts_at ? new Date(ppForm.starts_at).toISOString() : null,
      ends_at:   ppForm.ends_at   ? new Date(ppForm.ends_at).toISOString()   : null,
    };
    if (editingPopup) {
      const { error } = await supabase.from('popups').update(payload).eq('id', editingPopup.id);
      if (error) { alert('저장 실패: ' + error.message); setPpSaving(false); return; }
      logMediaHistory('popup', editingPopup.id, 'update', { ...payload, id: editingPopup.id });
    } else {
      const { data, error } = await supabase.from('popups').insert(payload).select('id').single();
      if (error) { alert('저장 실패: ' + error.message); setPpSaving(false); return; }
      logMediaHistory('popup', (data as { id?: string })?.id ?? null, 'create', { ...payload, id: (data as { id?: string })?.id });
    }
    setPpSaving(false);
    setPopupModal(false);
    loadPopups();
  }

  async function deletePopup(id: string) {
    if (!confirm('이 팝업을 삭제하시겠습니까?')) return;
    const supabase = createClient();
    const snap = popups.find(p => p.id === id);
    await supabase.from('popups').delete().eq('id', id);
    if (snap) logMediaHistory('popup', id, 'delete', snap);
    setPopups(prev => prev.filter(p => p.id !== id));
  }

  async function togglePopupActive(p: AdminPopup) {
    const supabase = createClient();
    await supabase.from('popups').update({ is_active: !p.is_active }).eq('id', p.id);
    setPopups(prev => prev.map(x => x.id === p.id ? { ...x, is_active: !p.is_active } : x));
  }

  /* ========== 배너/팝업 변경 이력 ========== */
  async function logMediaHistory(entity_type: 'banner' | 'popup', entity_id: string | null, action: 'create' | 'update' | 'delete', snapshot: unknown) {
    try { await createClient().from('banner_history').insert({ entity_type, entity_id, action, snapshot }); } catch { /* 이력 실패는 조용히 무시 */ }
  }
  async function loadMediaHistory() {
    setMhLoading(true);
    const { data } = await createClient()
      .from('banner_history').select('*').order('changed_at', { ascending: false }).limit(200);
    setMediaHistory((data as MediaHistory[]) || []);
    setMhLoading(false);
  }
  function openMediaHistory() { setMediaHistoryOpen(true); loadMediaHistory(); }
  async function restoreMedia(h: MediaHistory) {
    if (!confirm('이 시점 내용으로 새로 복원하시겠습니까? (기존 항목은 그대로 두고 새 항목으로 추가됩니다)')) return;
    const supabase = createClient();
    const snap = { ...h.snapshot } as Record<string, unknown>;
    delete snap.id; delete snap.created_at;
    if (h.entity_type === 'banner') {
      const { data } = await supabase.from('banners').insert(snap).select('id').single();
      await logMediaHistory('banner', (data as { id?: string })?.id ?? null, 'create', { ...snap, id: (data as { id?: string })?.id });
      loadBanners();
    } else {
      const { data } = await supabase.from('popups').insert(snap).select('id').single();
      await logMediaHistory('popup', (data as { id?: string })?.id ?? null, 'create', { ...snap, id: (data as { id?: string })?.id });
      loadPopups();
    }
    loadMediaHistory();
    alert('복원되었습니다.');
  }

  /* ========== 배너 관리 ========== */
  async function loadBanners() {
    setBannersLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from('banners').select('*').order('type').order('sort_order');
    setBanners((data as AdminBanner[]) || []);
    setBannersLoading(false);
  }

  async function uploadBannerImage(file: File): Promise<string | null> {
    setBnUploading(true);
    const supabase = createClient();
    const { blob, ext, type } = await compressImage(file, 1600);
    const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('banners').upload(path, blob, { upsert: true, contentType: type });
    if (error) { alert('업로드 실패: ' + error.message); setBnUploading(false); return null; }
    const { data } = supabase.storage.from('banners').getPublicUrl(path);
    setBnUploading(false);
    return data.publicUrl;
  }

  function openBannerModal(b?: AdminBanner) {
    if (b) {
      setEditingBanner(b);
      setBnForm({ type: b.type, link_url: b.link_url, is_active: b.is_active });
      setBnImgUrl(b.image_url || '');
      setBnImgUrlMobile(b.image_url_mobile || '');
    } else {
      setEditingBanner(null);
      setBnForm({ ...BANNER_EMPTY });
      setBnImgUrl('');
      setBnImgUrlMobile('');
    }
    setBannerModal(true);
  }

  async function saveBanner() {
    if (!bnImgUrl && !editingBanner?.image_url) { alert('이미지를 업로드해주세요.'); return; }
    setBnSaving(true);
    const supabase = createClient();
    const payload = {
      type: bnForm.type,
      link_url: bnForm.link_url.trim() || '/',
      image_url: bnImgUrl || editingBanner?.image_url || null,
      image_url_mobile: bnImgUrlMobile || null,
      is_active: bnForm.is_active,
      sort_order: editingBanner?.sort_order ?? banners.filter(b => b.type === bnForm.type).length,
    };
    if (editingBanner) {
      const { error } = await supabase.from('banners').update(payload).eq('id', editingBanner.id);
      if (error) { alert('저장 실패: ' + error.message); setBnSaving(false); return; }
      logMediaHistory('banner', editingBanner.id, 'update', { ...payload, id: editingBanner.id });
    } else {
      const { data, error } = await supabase.from('banners').insert(payload).select('id').single();
      if (error) { alert('저장 실패: ' + error.message); setBnSaving(false); return; }
      logMediaHistory('banner', (data as { id?: string })?.id ?? null, 'create', { ...payload, id: (data as { id?: string })?.id });
    }
    setBnSaving(false);
    setBannerModal(false);
    loadBanners();
  }

  async function deleteBanner(id: string) {
    if (!confirm('이 배너를 삭제하시겠습니까?')) return;
    const supabase = createClient();
    const snap = banners.find(b => b.id === id);
    await supabase.from('banners').delete().eq('id', id);
    if (snap) logMediaHistory('banner', id, 'delete', snap);
    setBanners(prev => prev.filter(b => b.id !== id));
  }

  async function toggleBannerActive(b: AdminBanner) {
    const supabase = createClient();
    await supabase.from('banners').update({ is_active: !b.is_active }).eq('id', b.id);
    setBanners(prev => prev.map(x => x.id === b.id ? { ...x, is_active: !b.is_active } : x));
  }

  /* ========== 사이트 설정 ========== */
  async function loadSettings() {
    const supabase = createClient();
    const { data } = await supabase.from('site_settings').select('key,value');
    if (data) {
      const map: Record<string, string> = {};
      data.forEach(row => { map[row.key] = row.value; });
      setSiteSettings(prev => ({ ...prev, ...map }));
    }
  }

  async function saveSettings() {
    setSettingsSaving(true);
    const supabase = createClient();
    /* 메인 큐레이션 키(_mode/_ids/_count)는 각 관리 탭에서 관리 → 여기선 건드리지 않음 */
    const CURATION_KEYS = new Set(['pick_count', 'qg_count', 'brand_count', 'reviewhl_count', 'lounge_count']);
    const isCuration = (k: string) => k.endsWith('_mode') || k.endsWith('_ids') || CURATION_KEYS.has(k);
    const upsertRows = Object.entries(siteSettings)
      .filter(([key]) => !isCuration(key))
      .map(([key, value]) => ({ key, value }));
    const { error } = await supabase.from('site_settings').upsert(upsertRows, { onConflict: 'key' });
    setSettingsSaving(false);
    if (error) alert('저장 실패: ' + error.message);
    else alert('저장되었습니다!');
  }

  /* ========== 포인트 적립 설정 ========== */
  function openPtEdit() {
    // 예약 변경이 있으면 그 값을, 없으면 현재값을 프리필
    setPtRate(siteSettings.point_rate_next || siteSettings.point_rate || '1');
    setPtApply(siteSettings.point_apply_date || '');
    setPtEdit(true);
  }
  async function togglePointEnabled(v: boolean) {
    setSiteSettings(prev => ({ ...prev, point_enabled: v ? 'true' : 'false' }));
    await createClient().from('site_settings').upsert({ key: 'point_enabled', value: v ? 'true' : 'false' }, { onConflict: 'key' });
  }
  async function savePointSettings() {
    const rate = Number(ptRate);
    const today = new Date().toISOString().slice(0, 10);
    if (isNaN(rate) || rate < 0 || rate > 10) { alert('적립률은 0% ~ 10% 사이로 입력해주세요.'); return; }
    if (ptApply && ptApply < today) { alert('적용일은 오늘 이후 날짜만 선택할 수 있습니다.'); return; }
    setPtSaving(true);
    // 미래 적용일이면 예약(point_rate_next)으로 두고 현재 적립률은 유지(소급 적용 X).
    // 적용일이 없거나 오늘이면 즉시 반영.
    const scheduled = !!ptApply && ptApply > today;
    const patch: Record<string, string> = scheduled
      ? { point_rate_next: String(rate), point_apply_date: ptApply, point_updated_at: today }
      : { point_rate: String(rate), point_rate_next: '', point_apply_date: '', point_updated_at: today };
    const rows = Object.entries(patch).map(([key, value]) => ({ key, value }));
    const { error } = await createClient().from('site_settings').upsert(rows, { onConflict: 'key' });
    setPtSaving(false);
    if (error) { alert('저장 실패: ' + error.message); return; }
    setSiteSettings(prev => ({ ...prev, ...patch }));
    setPtEdit(false);
  }

  /* ========== 멤버십 등급 설정 ========== */
  async function loadMTiers() {
    const { data } = await createClient().from('membership_tiers').select('*').order('sort');
    setMTiers(data && data.length ? (data as MembershipTier[]) : DEFAULT_TIERS);
    setMLoaded(true);
  }
  function updateTier(grade: string, patch: Partial<MembershipTier>) {
    setMTiers(prev => prev.map(t => t.grade === grade ? { ...t, ...patch } : t));
  }
  function toggleTierCoupon(grade: string, code: string) {
    setMTiers(prev => prev.map(t => {
      if (t.grade !== grade) return t;
      const has = t.coupon_codes.includes(code);
      return { ...t, coupon_codes: has ? t.coupon_codes.filter(c => c !== code) : [...t.coupon_codes, code] };
    }));
  }
  async function saveMTiers() {
    setMSaving(true);
    const today = new Date().toISOString().slice(0, 10);
    const rows = mTiers.map(t => {
      const next = t.point_rate_next === null || String(t.point_rate_next) === '' ? null : Number(t.point_rate_next);
      const scheduled = next != null && !!t.apply_date && t.apply_date > today;
      return {
        grade: t.grade, sort: t.sort, label: t.label,
        point_rate: Number(t.point_rate) || 0,
        point_rate_next: scheduled ? next : null,
        apply_date: scheduled ? t.apply_date : null,
        min_amount: Number(t.min_amount) || 0,
        min_count: Number(t.min_count) || 0,
        coupon_codes: t.coupon_codes,
        monthly_active: t.monthly_active,
        updated_at: new Date().toISOString(),
      };
    });
    const { error } = await createClient().from('membership_tiers').upsert(rows, { onConflict: 'grade' });
    setMSaving(false);
    if (error) { alert('저장 실패: ' + error.message); return; }
    alert('멤버십 등급 설정이 저장되었습니다.');
  }
  async function saveMembershipToggle(key: string, v: boolean) {
    setSiteSettings(prev => ({ ...prev, [key]: v ? 'true' : 'false' }));
    await createClient().from('site_settings').upsert({ key, value: v ? 'true' : 'false' }, { onConflict: 'key' });
  }
  async function recalcGradesNow() {
    if (!confirm('전체 회원 등급을 분기 누적 구매(금액·횟수) 기준으로 재산정합니다.\n수동 변경(잠금)된 회원은 제외됩니다. 진행할까요?')) return;
    setRecalcRunning(true);
    let data: { ok?: boolean; updated?: number; error?: string } = {};
    try {
      const res = await fetch('/api/membership/recalc', { method: 'POST' });
      data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) { alert('재산정 실패: ' + (data.error || res.status)); }
      else {
        alert(`재산정 완료 — ${data.updated || 0}명 등급 변경`);
        setSiteSettings(prev => ({ ...prev, membership_last_recalc: new Date().toISOString().slice(0, 16).replace('T', ' ') }));
        loadMembers();
      }
    } catch (e) { alert('재산정 오류: ' + (e as Error).message); }
    setRecalcRunning(false);
  }

  /* ========== 마케팅 분석 (자체 DB 집계) ========== */
  async function loadMarketing() {
    setMarketingLoading(true);
    const supabase = createClient();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevPeriodEnd = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate(), 23, 59, 59);
    const isCancel = (s: string) => ['cancelled', 'refunded', 'refunding'].includes(s);

    const [oRes, pRes, bRes, cRes, ucRes, sRes, svRes] = await Promise.all([
      supabase.from('orders').select('user_id, final_amount, status, created_at').gte('created_at', lastMonthStart.toISOString()).order('created_at', { ascending: false }).limit(8000),
      supabase.from('profiles').select('id, created_at, provider').limit(10000),
      supabase.from('banners').select('view_count, click_count'),
      supabase.from('coupons').select('id, name, is_active'),
      supabase.from('user_coupons').select('coupon_id, is_used').limit(10000),
      supabase.from('sms_logs').select('target_count, created_at').gte('created_at', monthStart.toISOString()).limit(2000),
      supabase.from('survey_results').select('age_group').limit(5000),
    ]);
    const orders = (oRes.data || []) as { user_id: string|null; final_amount: number; status: string; created_at: string }[];
    const profs = (pRes.data || []) as { id: string; created_at: string; provider: string|null }[];

    const inMonth = (d: string) => d >= monthStart.toISOString();
    const inPrev = (d: string) => d >= lastMonthStart.toISOString() && d < monthStart.toISOString();
    const inPrevSame = (d: string) => d >= lastMonthStart.toISOString() && d <= prevPeriodEnd.toISOString();
    const valid = (o: { status: string }) => !isCancel(o.status);

    const monthOrdersArr = orders.filter(o => inMonth(o.created_at));
    const todayOrders = orders.filter(o => o.created_at >= today.toISOString()).length;
    const monthSales = monthOrdersArr.filter(valid).reduce((s, o) => s + (o.final_amount || 0), 0);
    const prevSales = orders.filter(o => inPrevSame(o.created_at) && valid(o)).reduce((s, o) => s + (o.final_amount || 0), 0);
    const refundCount = monthOrdersArr.filter(o => isCancel(o.status)).length;
    const refundRate = monthOrdersArr.length ? refundCount / monthOrdersArr.length * 100 : 0;
    // 재주문 고객(2회+ 구매)
    const userOrderCnt: Record<string, number> = {};
    orders.filter(valid).forEach(o => { if (o.user_id) userOrderCnt[o.user_id] = (userOrderCnt[o.user_id] || 0) + 1; });
    const repeatCustomers = Object.values(userOrderCnt).filter(n => n >= 2).length;
    // 객단가
    const mValid = monthOrdersArr.filter(valid);
    const aov = mValid.length ? Math.round(monthSales / mValid.length) : 0;
    const pValid = orders.filter(o => inPrev(o.created_at) && valid(o));
    const prevAov = pValid.length ? Math.round(pValid.reduce((s, o) => s + (o.final_amount || 0), 0) / pValid.length) : 0;
    // 신규 회원(이번달)
    const newMembers = profs.filter(p => inMonth(p.created_at)).length;
    // 광고(배너)
    const adView = (bRes.data || []).reduce((s: number, b: { view_count: number|null }) => s + (b.view_count || 0), 0);
    const adClick = (bRes.data || []).reduce((s: number, b: { click_count: number|null }) => s + (b.click_count || 0), 0);
    const adCtr = adView ? adClick / adView * 100 : 0;
    // 채널별(가입경로) — 회원 기준 주문/매출
    const provMap = new Map(profs.map(p => [p.id, providerKey(p.provider)]));
    const chAgg: Record<string, { orders: number; revenue: number }> = { kakao: { orders:0, revenue:0 }, naver: { orders:0, revenue:0 }, email: { orders:0, revenue:0 } };
    orders.filter(valid).forEach(o => { const ch = (o.user_id && provMap.get(o.user_id)) || 'email'; chAgg[ch].orders++; chAgg[ch].revenue += o.final_amount || 0; });
    const channels = [
      { label: '카카오', ...chAgg.kakao, color: '#FEE500' },
      { label: '네이버', ...chAgg.naver, color: '#03C75A' },
      { label: '일반', ...chAgg.email, color: '#94A3B8' },
    ];
    // 시간대별 주문(최근 fetch 범위)
    const hourMap: Record<number, number> = {};
    for (let h = 0; h < 24; h++) hourMap[h] = 0;
    orders.forEach(o => { hourMap[new Date(o.created_at).getHours()]++; });
    const byHour = Object.entries(hourMap).map(([h, count]) => ({ h: Number(h), count }));
    // 연령대(취향진단)
    const AGE_ORDER = ['10대', '20대', '30대', '40대', '50대 이상'];
    const ageMap: Record<string, number> = {};
    (svRes.data || []).forEach((r: { age_group: string|null }) => { if (r.age_group) ageMap[r.age_group] = (ageMap[r.age_group] || 0) + 1; });
    const byAge = AGE_ORDER.filter(a => ageMap[a]).map(a => ({ label: a, n: ageMap[a] }));
    const byAgeFinal = byAge.length ? byAge : Object.entries(ageMap).map(([label, n]) => ({ label, n }));
    // 쿠폰
    const coupons = (cRes.data || []) as { id: string; name: string; is_active: boolean }[];
    const ucs = (ucRes.data || []) as { coupon_id: string; is_used: boolean }[];
    const couponActive = coupons.filter(c => c.is_active).length;
    const couponTotal = coupons.length;
    const couponIssued = ucs.length;
    const couponUsed = ucs.filter(u => u.is_used).length;
    const cName = new Map(coupons.map(c => [c.id, c.name]));
    const cAgg: Record<string, { used: number; issued: number }> = {};
    ucs.forEach(u => { (cAgg[u.coupon_id] ||= { used: 0, issued: 0 }); cAgg[u.coupon_id].issued++; if (u.is_used) cAgg[u.coupon_id].used++; });
    const topCoupons = Object.entries(cAgg).map(([id, v]) => ({ name: (cName.get(id) as string) || '(삭제된 쿠폰)', used: v.used, issued: v.issued, rate: v.issued ? Math.round(v.used / v.issued * 100) : 0 })).sort((a, b) => b.used - a.used).slice(0, 3);
    // SMS
    const sms = (sRes.data || []) as { target_count: number|null }[];
    const smsCount = sms.length;
    const smsRecipients = sms.reduce((s, x) => s + (x.target_count || 0), 0);

    setMarketing({ todayOrders, monthOrders: monthOrdersArr.length, repeatCustomers, monthSales, prevSales, refundRate, refundCount, newMembers, aov, prevAov, adView, adClick, adCtr, channels, byHour, byAge: byAgeFinal, couponActive, couponTotal, couponIssued, couponUsed, topCoupons, smsCount, smsRecipients });
    setMarketingLoading(false);
  }

  /* ========== 검색어 통계 ========== */
  async function loadSearchStats(days: 7|30) {
    setSearchStatsLoading(true);
    const supabase = createClient();
    const now = Date.now();
    const since     = new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
    const prevSince = new Date(now - days * 2 * 24 * 60 * 60 * 1000).toISOString();

    const countMap = (rows: { keyword: string }[] | null) => {
      const c: Record<string, number> = {};
      (rows || []).forEach(r => { const k = r.keyword.trim(); c[k] = (c[k] || 0) + 1; });
      return c;
    };

    const [{ data: curData }, { data: prevData }, { data: emptyData }] = await Promise.all([
      supabase.from('search_logs').select('keyword').gte('created_at', since).limit(2000),
      supabase.from('search_logs').select('keyword').gte('created_at', prevSince).lt('created_at', since).limit(2000),
      supabase.from('search_logs').select('keyword').eq('result_count', 0).gte('created_at', since).limit(1000),
    ]);

    const cur  = countMap(curData);
    const prev = countMap(prevData);

    setSearchStats(
      Object.entries(cur)
        .map(([keyword, count]) => {
          const prevCount = prev[keyword] || 0;
          const isNew  = prevCount === 0;
          const trend  = isNew ? 100 : Math.round(((count - prevCount) / prevCount) * 100);
          return { keyword, count, trend, isNew };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 20)
    );

    setNoResultStats(
      Object.entries(countMap(emptyData))
        .map(([keyword, count]) => ({ keyword, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20)
    );

    setSearchStatsLoading(false);
  }

  async function deleteSearchKeyword(keyword: string) {
    if (!confirm(`"${keyword}" 검색어 로그를 모두 삭제하시겠습니까?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from('search_logs').delete().eq('keyword', keyword);
    if (error) { alert('삭제 실패: ' + error.message); return; }
    setSearchStats(prev => prev.filter(s => s.keyword !== keyword));
  }

  async function clearAllSearchLogs() {
    if (!confirm('모든 검색 로그를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;
    const supabase = createClient();
    const { error } = await supabase.from('search_logs').delete().gte('id', 0);
    if (error) { alert('삭제 실패: ' + error.message); return; }
    setSearchStats([]);
  }

  /* ========== 정산 집계 ========== */
  /* 연간(월별) 매출 — 확정+처리중 기준 */
  async function loadSettlementYearly(year: number) {
    const supabase = createClient();
    const from = new Date(year, 0, 1).toISOString();
    const to   = new Date(year + 1, 0, 1).toISOString();
    const { data } = await supabase
      .from('orders').select('final_amount, created_at, status')
      .gte('created_at', from).lt('created_at', to)
      .in('status', ['paid','preparing','shipped','delivered','confirmed']).limit(5000);
    const m: Record<number, number> = {};
    for (let i = 1; i <= 12; i++) m[i] = 0;
    (data || []).forEach((o: { final_amount: number; created_at: string }) => {
      const mon = new Date(o.created_at).getMonth() + 1;
      m[mon] = (m[mon] || 0) + (o.final_amount || 0);
    });
    setSettlementYearly(Object.entries(m).map(([month, amount]) => ({ month: Number(month), amount })));
  }

  async function loadSettlement(from: Date, to: Date) {
    setSettlementLoading(true);
    const supabase = createClient();
    loadSettlementYearly(new Date().getFullYear());
    const fromISO = from.toISOString();
    const toISO = to.toISOString();
    const isConfirmed = (s: string) => s === 'delivered' || s === 'confirmed';
    const isPending = (s: string) => ['paid','preparing','shipped'].includes(s);
    const isCancel = (s: string) => ['cancelled','refunded','refunding'].includes(s);

    const { data } = await supabase
      .from('orders')
      .select('id, status, final_amount, coupon_discount, point_used, payment_method, created_at')
      .gte('created_at', fromISO).lt('created_at', toISO).limit(5000);
    if (!data) { setSettlementLoading(false); return; }

    const confirmed = data.filter(o => isConfirmed(o.status)).reduce((s, o) => s + (o.final_amount || 0), 0);
    const pending   = data.filter(o => isPending(o.status)).reduce((s, o) => s + (o.final_amount || 0), 0);
    const cancelled = data.filter(o => isCancel(o.status)).reduce((s, o) => s + (o.final_amount || 0), 0);
    const total     = data.reduce((s, o) => s + (o.final_amount || 0), 0);
    const couponTotal = data.reduce((s, o) => s + (o.coupon_discount || 0), 0);
    const pointTotal  = data.reduce((s, o) => s + (o.point_used || 0), 0);
    const validOrders = data.filter(o => !isCancel(o.status));
    const validTotal  = validOrders.reduce((s, o) => s + (o.final_amount || 0), 0);
    const aov = validOrders.length ? Math.round(validTotal / validOrders.length) : 0;
    const realSettle = confirmed; // 확정 매출(쿠폰·포인트 차감 후 실수령 추정)
    const refundCount = data.filter(o => isCancel(o.status)).length;
    const refundRate = data.length ? (refundCount / data.length * 100) : 0;

    const statusMap: Record<string, { count: number; amount: number }> = {};
    data.forEach(o => { if (!statusMap[o.status]) statusMap[o.status] = { count: 0, amount: 0 }; statusMap[o.status].count++; statusMap[o.status].amount += o.final_amount || 0; });
    const byStatus = Object.entries(statusMap).map(([status, v]) => ({ status, ...v })).sort((a, b) => b.amount - a.amount);

    const methodMap: Record<string, { count: number; amount: number }> = {};
    data.forEach(o => { const m = o.payment_method || '기타'; if (!methodMap[m]) methodMap[m] = { count: 0, amount: 0 }; methodMap[m].count++; methodMap[m].amount += o.final_amount || 0; });
    const byMethod = Object.entries(methodMap).map(([method, v]) => ({ method, ...v })).sort((a, b) => b.amount - a.amount);

    // 일별 (범위 92일 이하만 — 너무 길면 월별 그래프 사용)
    const dayMs = 86400000;
    const rangeDays = Math.round((to.getTime() - from.getTime()) / dayMs);
    const dailyMap: Record<string, number> = {};
    if (rangeDays <= 92) {
      const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
      for (let t = start.getTime(); t < to.getTime(); t += dayMs) { const d = new Date(t); dailyMap[`${d.getMonth()+1}/${d.getDate()}`] = 0; }
      data.forEach(o => { const d = new Date(o.created_at); const k = `${d.getMonth()+1}/${d.getDate()}`; if (dailyMap[k] !== undefined) dailyMap[k] += o.final_amount || 0; });
    }
    const daily = Object.entries(dailyMap).map(([date, amount]) => ({ date, amount }));

    // 전기간 대비 (직전 동일 길이)
    const lenMs = to.getTime() - from.getTime();
    const { data: prev } = await supabase.from('orders').select('final_amount')
      .gte('created_at', new Date(from.getTime() - lenMs).toISOString()).lt('created_at', fromISO).limit(5000);
    const prevTotal = (prev || []).reduce((s, o) => s + (o.final_amount || 0), 0);
    const prevOrderCount = (prev || []).length;

    // TOP 상품/카테고리 (order_items, 200개씩 청크)
    const orderIds = data.map(o => o.id);
    let topProducts: { name: string; qty: number; amount: number }[] = [];
    let topCategories: { category: string; qty: number; amount: number }[] = [];
    if (orderIds.length) {
      const items: { product_id: string; product_name: string; quantity: number; subtotal: number }[] = [];
      for (let i = 0; i < orderIds.length; i += 200) {
        const { data: it } = await supabase.from('order_items').select('product_id, product_name, quantity, subtotal').in('order_id', orderIds.slice(i, i + 200));
        if (it) items.push(...(it as typeof items));
      }
      const { data: prods } = await supabase.from('products').select('id, category');
      const prodCat = new Map((prods || []).map((p: { id: string; category: string }) => [p.id, p.category]));
      const pMap: Record<string, { qty: number; amount: number }> = {};
      const cMap: Record<string, { qty: number; amount: number }> = {};
      items.forEach(it => {
        const nm = it.product_name || '(상품)';
        if (!pMap[nm]) pMap[nm] = { qty: 0, amount: 0 }; pMap[nm].qty += it.quantity || 0; pMap[nm].amount += it.subtotal || 0;
        const cat = (prodCat.get(it.product_id) as string) || '기타';
        const cl = (catOptions[cat] || CAT_LABEL[cat] || cat);
        if (!cMap[cl]) cMap[cl] = { qty: 0, amount: 0 }; cMap[cl].qty += it.quantity || 0; cMap[cl].amount += it.subtotal || 0;
      });
      topProducts = Object.entries(pMap).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.amount - a.amount).slice(0, 5);
      topCategories = Object.entries(cMap).map(([category, v]) => ({ category, ...v })).sort((a, b) => b.amount - a.amount).slice(0, 5);
    }

    setSettlementData({ confirmed, pending, cancelled, total, orderCount: data.length, byStatus, byMethod, daily,
      realSettle, aov, couponTotal, pointTotal, refundCount, refundRate, prevTotal, prevOrderCount, topProducts, topCategories });
    setSettlementLoading(false);
  }

  /* 기간 프리셋 → [from, to] Date */
  function settlementRange(preset: typeof settlementPreset = settlementPreset): [Date, Date] {
    const now = new Date();
    const sod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const today = sod(now);
    const tomorrow = new Date(today.getTime() + 86400000);
    switch (preset) {
      case 'today':     return [today, tomorrow];
      case 'yesterday': return [new Date(today.getTime() - 86400000), today];
      case '7d':        return [new Date(today.getTime() - 6 * 86400000), tomorrow];
      case '30d':       return [new Date(today.getTime() - 29 * 86400000), tomorrow];
      case 'thisMonth': return [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 1)];
      case 'lastMonth': return [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 1)];
      case 'all':       return [new Date(2020, 0, 1), tomorrow];
      case 'custom':    return [settlementCustFrom ? new Date(`${settlementCustFrom}T00:00:00`) : new Date(2020,0,1), settlementCustTo ? new Date(`${settlementCustTo}T23:59:59`) : tomorrow];
    }
  }

  /* ========== 주문 상태 변경 ========== */
  async function updateOrderStatus(orderId: string, newStatus: string) {
    setUpdatingStatus(orderId);

    /* 취소(cancelled)·환불(refunded)이면 결제된 카드도 실제 취소(포트원) 먼저 수행 */
    const isVoid = newStatus === 'cancelled' || newStatus === 'refunded';
    if (isVoid) {
      const ord = orders.find(o => o.id === orderId) || (selectedOrder?.id === orderId ? selectedOrder : null);
      const pid = (ord as unknown as { portone_payment_id?: string | null })?.portone_payment_id;
      const alreadyVoid = ord && ['cancelled', 'refunded', 'refunding'].includes(ord.status);
      if (pid && !alreadyVoid) {
        const res = await fetch('/api/payment/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId: pid, reason: newStatus === 'cancelled' ? '관리자 주문취소' : '관리자 환불' }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          alert((newStatus === 'cancelled' ? '주문취소' : '환불') + ' 중 카드 취소 실패 — 중단\n' + (j.error || '') + (j.detail ? '\n' + JSON.stringify(j.detail) : ''));
          setUpdatingStatus(null);
          return;
        }
      }
    }

    const supabase = createClient();
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus, ...(newStatus === 'delivered' ? { delivered_at: new Date().toISOString() } : {}) })
      .eq('id', orderId);
    if (!error) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      if (selectedOrder?.id === orderId) setSelectedOrder(s => s ? { ...s, status: newStatus } : s);
      refreshStageCounts(); // 주문 처리 현황판 즉시 갱신

      /* 취소·환불이면 사용 쿠폰·포인트 복원 (서버에서 멱등 처리) */
      if (isVoid) {
        try {
          const rr = await fetch('/api/admin/refund-restore', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId }),
          });
          const rj = await rr.json().catch(() => ({}));
          if (rj?.restored) {
            const parts: string[] = [];
            if (rj.refundedPoint > 0) parts.push(`포인트 ${rj.refundedPoint.toLocaleString()}P 환급`);
            if (rj.clawback > 0) parts.push(`적립 ${rj.clawback.toLocaleString()}P 회수`);
            if (rj.couponRestored) parts.push('쿠폰 복원');
            if (parts.length) alert('복원 완료: ' + parts.join(' · '));
          }
        } catch { /* 복원 실패해도 상태는 유지 */ }

        /* 판매자 직접 취소/환불 → 고객(주문자)에게 취소 안내 알림톡 */
        const vo = orders.find(o => o.id === orderId) || (selectedOrder?.id === orderId ? selectedOrder : null);
        if (vo) {
          notifyOrderPhones([vo.orderer_phone || vo.phone], {
            type: 'order_cancelled', recipient: vo.recipient, orderNo: vo.order_no,
            cancelledAt: new Date().toLocaleString('ko-KR'),
            refundAmount: `${(vo.final_amount || 0).toLocaleString()}원`,
          });
        }
      }

      /* 추천 리워드는 첫 구매 배송완료(delivered) 시 DB 트리거가 자동 지급 (5,000원 쿠폰) */
      if (newStatus === 'delivered') {
        // 배송 완료 SMS 발송
        const deliveredOrder = orders.find(o => o.id === orderId);
        if (deliveredOrder) {
          /* 배송 관련 → 수령인 + 주문자 양쪽(같은 번호면 1회) */
          notifyOrderPhones([deliveredOrder.phone, deliveredOrder.orderer_phone], {
            type: 'delivery_complete',
            recipient: deliveredOrder.recipient,
            orderNo: deliveredOrder.order_no,
            productName: orderProductName(deliveredOrder),
            completedAt: new Date().toLocaleString('ko-KR'),
          });
        }
      }
    }
    setUpdatingStatus(null);
  }

  /* ========== 배송 추적 정보 저장 ========== */
  const COURIER_NAMES: Record<string, string> = {
    'kr.cjlogistics': 'CJ대한통운', 'kr.lotte': '롯데택배',
    'kr.hanjin': '한진택배', 'kr.epost': '우체국택배',
    'kr.logen': '로젠택배', 'kr.lotteglogis': '롯데글로벌로지스',
    'kr.coupang': '쿠팡로켓배송', 'kr.cupost': 'CU편의점택배',
  };

  const COURIER_OPTIONS = [
    { value:'', label:'택배사 선택' },
    { value:'kr.cjlogistics', label:'CJ대한통운' },
    { value:'kr.lotte', label:'롯데택배' },
    { value:'kr.hanjin', label:'한진택배' },
    { value:'kr.epost', label:'우체국택배' },
    { value:'kr.logen', label:'로젠택배' },
    { value:'kr.lotteglogis', label:'롯데글로벌로지스' },
    { value:'kr.coupang', label:'쿠팡로켓배송' },
    { value:'kr.cupost', label:'CU편의점택배' },
  ];

  /* 농가(상품)별 송장 저장 — 해당 농가 order_items 업데이트 + 모든 농가 발송 시 주문 배송중 전환
     + 해당 농가 배송시작 알림톡 발송 + 추적 웹훅 구독 등록(송장별 각각) */
  async function saveItemTracking(itemIds: string[], courier: string, tracking: string) {
    if (!selectedOrder || itemIds.length === 0) return;
    setSavingTracking(true);
    const supabase = createClient();
    const patch = {
      courier: courier || null,
      tracking_number: tracking || null,
      ship_status: tracking ? 'shipped' : 'preparing',
      shipped_at: tracking ? new Date().toISOString() : null,
    };
    const { error } = await supabase.from('order_items').update(patch).in('id', itemIds);
    if (error) { setSavingTracking(false); alert('저장 실패: ' + error.message); return; }
    // 로컬 반영 (해당 상품 줄들)
    const idSet = new Set(itemIds);
    const newItems = (selectedOrder.order_items || []).map(i =>
      (i.id && idSet.has(i.id)) ? { ...i, courier: patch.courier, tracking_number: patch.tracking_number, ship_status: patch.ship_status } : i
    );
    setSelectedOrder(s => s ? { ...s, order_items: newItems } : s);

    // 송장이 새로 입력된 경우: 그 농가 배송시작 알림톡 + 추적 웹훅 구독 등록
    if (tracking) {
      const cid = courier || 'kr.cjlogistics';
      const its = newItems.filter(i => i.id && idSet.has(i.id));
      const names = its.map(i => i.product_name).filter(Boolean) as string[];
      const productName = names.length ? names[0] + (names.length > 1 ? ` 외 ${names.length - 1}건` : '') : '주문상품';
      // 배송시작 알림톡 (해당 농가 상품명) — 수령인 + 주문자 양쪽
      notifyOrderPhones([selectedOrder.phone, selectedOrder.orderer_phone], {
        type: 'shipping_started',
        recipient: selectedOrder.recipient,
        orderNo: selectedOrder.order_no,
        productName,
        courierName: COURIER_NAMES[courier] || courier || '택배사',
        trackingNumber: tracking,
      });
      // tracker.delivery 웹훅 구독 등록 → 이후 상태 변경 자동 동기화(배포 환경)
      fetch('/api/tracking/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carrierId: cid, trackingNumber: tracking }),
      }).catch(() => {});
    }

    // 하나라도 송장 등록되면 주문 상태 배송중 전환 (부분 배송 포함)
    const anyShipped = newItems.some(i => !!i.tracking_number);
    if (anyShipped && (selectedOrder.status === 'paid' || selectedOrder.status === 'preparing')) {
      await supabase.from('orders').update({ status: 'shipped' }).eq('id', selectedOrder.id);
      setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, status: 'shipped' } : o));
      setSelectedOrder(s => s ? { ...s, status: 'shipped' } : s);
    }
    setSavingTracking(false);
  }

  async function saveTracking() {
    if (!selectedOrder) return;
    setSavingTracking(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('orders')
      .update({
        courier:         trackingInput.courier || null,
        tracking_number: trackingInput.tracking_number || null,
      })
      .eq('id', selectedOrder.id);
    if (!error) {
      setOrders(prev => prev.map(o => o.id === selectedOrder.id
        ? { ...o, courier: trackingInput.courier || null, tracking_number: trackingInput.tracking_number || null }
        : o
      ));
      setSelectedOrder(s => s ? { ...s, courier: trackingInput.courier || null, tracking_number: trackingInput.tracking_number || null } : s);

      // 운송장번호가 새로 입력된 경우: 배송 시작 SMS + 상태 배송중 전환 + 웹훅 구독 등록
      if (trackingInput.tracking_number) {
        const cid = trackingInput.courier || 'kr.cjlogistics';
        const tno = trackingInput.tracking_number;

        // 배송 시작 알림 — 수령인 + 주문자 양쪽
        notifyOrderPhones([selectedOrder.phone, selectedOrder.orderer_phone], {
          type: 'shipping_started',
          recipient: selectedOrder.recipient,
          orderNo: selectedOrder.order_no,
          productName: orderProductName(selectedOrder),
          courierName: COURIER_NAMES[trackingInput.courier] || trackingInput.courier || '택배사',
          trackingNumber: tno,
        });

        // 송장 등록 시 실제 배송상태 조회해서 반영 (배송완료면 바로 배송완료, 진행중이면 배송중)
        if (selectedOrder.status === 'paid' || selectedOrder.status === 'preparing' || selectedOrder.status === 'shipped') {
          const sync = await fetch(`/api/tracking/webhook?carrierId=${encodeURIComponent(cid)}&trackingNumber=${encodeURIComponent(tno)}`, { method: 'POST' })
            .then(r => r.json()).catch(() => null);
          const real = sync?.updated as string | undefined; // 'shipped' | 'delivered' 등
          const finalStatus = (real && real !== 'preparing') ? real : 'shipped';
          await supabase.from('orders').update({ status: finalStatus }).eq('id', selectedOrder.id);
          setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, status: finalStatus } : o));
          setSelectedOrder(s => s ? { ...s, status: finalStatus } : s);
        }

        // tracker.delivery 웹훅 구독 등록 → 이후 상태 변경 자동 동기화 (배포 환경)
        fetch('/api/tracking/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ carrierId: cid, trackingNumber: tno }),
        }).catch(() => {});
      }
    } else {
      alert('저장 실패: ' + error.message);
    }
    setSavingTracking(false);
  }

  /* 주문 목록 인라인 송장 저장 — 택배사 기본(CJ) + SMS + 상태동기화 + 웹훅(상세 저장과 동일 흐름) */
  async function saveInlineTracking(o: Order, tno: string, courierSel?: string) {
    const trk = (tno || '').trim();
    if (!trk) { alert('송장번호를 입력하세요.'); return; }
    setTrackSaving(o.id);
    const supabase = createClient();
    const cid = courierSel || o.courier || 'kr.cjlogistics';
    const { error } = await supabase.from('orders').update({ courier: cid, tracking_number: trk }).eq('id', o.id);
    if (error) { alert('저장 실패: ' + error.message); setTrackSaving(null); return; }
    setOrders(prev => prev.map(x => x.id === o.id ? { ...x, courier: cid, tracking_number: trk } : x));
    // 배송 시작 알림 — 수령인 + 주문자 양쪽
    notifyOrderPhones([o.phone, o.orderer_phone], { type:'shipping_started', recipient:o.recipient, orderNo:o.order_no, productName: orderProductName(o), courierName: COURIER_NAMES[cid] || cid || '택배사', trackingNumber: trk });
    // 상태 동기화 (배송중/배송완료)
    if (o.status === 'paid' || o.status === 'preparing' || o.status === 'shipped') {
      const sync = await fetch(`/api/tracking/webhook?carrierId=${encodeURIComponent(cid)}&trackingNumber=${encodeURIComponent(trk)}`, { method:'POST' }).then(r => r.json()).catch(() => null);
      const real = sync?.updated as string | undefined;
      const finalStatus = (real && real !== 'preparing') ? real : 'shipped';
      await supabase.from('orders').update({ status: finalStatus }).eq('id', o.id);
      setOrders(prev => prev.map(x => x.id === o.id ? { ...x, status: finalStatus } : x));
      refreshStageCounts();
    }
    // 웹훅 구독 등록
    fetch('/api/tracking/register', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ carrierId: cid, trackingNumber: trk }) }).catch(() => {});
    setTrackSaving(null);
    setTrackEditRow(null);
  }

  /* 선택 주문 일괄 배송준비 처리 */
  async function bulkSetPreparing() {
    const ids = [...selOrders];
    if (ids.length === 0) return;
    if (!confirm(`선택한 ${ids.length}건을 '배송준비' 상태로 변경할까요?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from('orders').update({ status: 'preparing' }).in('id', ids);
    if (error) { alert('변경 실패: ' + error.message); return; }
    setOrders(prev => prev.map(o => ids.includes(o.id) ? { ...o, status: 'preparing' } : o));
    refreshStageCounts();
    setSelOrders(new Set());
    alert(`${ids.length}건을 배송준비로 변경했습니다.`);
  }

  /* 선택 주문 일괄 배송 지연 안내 발송 (사유·예상도착일 1회 입력 → 전체 발송) */
  async function bulkDelayNotice() {
    const targets = orders.filter(o => selOrders.has(o.id) && o.phone);
    if (targets.length === 0) { alert('연락처가 있는 선택 주문이 없습니다.'); return; }
    const reason = prompt(`선택 ${targets.length}건에 보낼 지연 사유를 입력하세요. (예: 산지 기상 악화로 출고 지연)`);
    if (!reason || !reason.trim()) return;
    const eta = prompt('변경 예상 도착일을 입력하세요. (예: 6/15(일))');
    if (!eta || !eta.trim()) return;
    if (!confirm(`선택한 ${targets.length}건에 배송 지연 안내를 발송할까요?\n\n사유: ${reason.trim()}\n예상 도착일: ${eta.trim()}`)) return;
    for (const o of targets) {
      /* 배송 지연 = 배송 관련 → 수령인 + 주문자 양쪽 */
      notifyOrderPhones([o.phone, o.orderer_phone], { type:'delivery_delayed', recipient:o.recipient, orderNo:o.order_no, reason:reason.trim(), eta:eta.trim() });
    }
    alert(`${targets.length}건에 배송 지연 안내를 발송했습니다.`);
    setSelOrders(new Set());
  }

  /* 선택 주문 일괄 발송처리(배송중으로 변경) — 송장은 인라인/엑셀로 별도 등록 */
  async function bulkSetShipped() {
    const ids = [...selOrders];
    if (ids.length === 0) return;
    if (!confirm(`선택한 ${ids.length}건을 '배송중'으로 변경할까요?\n(송장번호는 인라인 입력 또는 '엑셀 일괄 발송처리'로 등록하세요)`)) return;
    const supabase = createClient();
    const { error } = await supabase.from('orders').update({ status: 'shipped' }).in('id', ids);
    if (error) { alert('변경 실패: ' + error.message); return; }
    setOrders(prev => prev.map(o => ids.includes(o.id) ? { ...o, status: 'shipped' } : o));
    refreshStageCounts();
    setSelOrders(new Set());
    alert(`${ids.length}건을 배송중으로 변경했습니다.`);
  }

  /* 선택 주문 일괄 판매자 직접취소 (결제취소 + 쿠폰·포인트 복원) */
  async function bulkCancel() {
    const targets = orders.filter(o => selOrders.has(o.id) && !['cancelled','refunded'].includes(o.status));
    if (targets.length === 0) { alert('취소 가능한 선택 주문이 없습니다.'); return; }
    if (!confirm(`선택한 ${targets.length}건을 '판매자 직접취소' 처리할까요?\n\n결제취소 + 쿠폰·포인트 복원이 진행되며 되돌릴 수 없습니다.`)) return;
    for (const o of targets) { await updateOrderStatus(o.id, 'cancelled'); }
    setSelOrders(new Set());
    alert(`${targets.length}건 취소 처리했습니다.`);
  }

  /* 엑셀 일괄 발송처리 — 주문서(배송용) 양식(주문번호·택배사·운송장번호)을 올려 여러 건 송장+배송중 일괄 등록 */
  async function bulkExcelShip(file: File) {
    const xlsxMod = await import('xlsx');
    const XLSX = xlsxMod.default ?? xlsxMod;
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const nameToCode: Record<string, string> = {};
    Object.entries(COURIER_NAMES).forEach(([code, nm]) => { nameToCode[nm] = code; });
    type P = { orderNo: string; courier: string; tracking: string };
    const byNo: Record<string, P> = {};
    wb.SheetNames.forEach(sn => {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1 }) as unknown[][];
      const hi = rows.findIndex(r => (r || []).some(c => String(c).trim() === '주문번호'));
      if (hi < 0) return;
      const hdr = (rows[hi] || []).map(c => String(c || '').trim());
      const iNo = hdr.indexOf('주문번호'), iCr = hdr.indexOf('택배사');
      const iTk = hdr.findIndex(h => h === '운송장번호' || h === '송장번호');
      if (iNo < 0 || iTk < 0) return;
      for (let r = hi + 1; r < rows.length; r++) {
        const row = rows[r] || [];
        const orderNo = String(row[iNo] || '').trim();
        const tracking = String(row[iTk] || '').replace(/[^0-9]/g, '').trim();
        if (!orderNo || !tracking) continue;
        const courierName = iCr >= 0 ? String(row[iCr] || '').trim() : '';
        byNo[orderNo] = { orderNo, courier: nameToCode[courierName] || 'kr.cjlogistics', tracking };
      }
    });
    const list = Object.values(byNo);
    if (list.length === 0) { alert('엑셀에서 주문번호·운송장번호를 찾지 못했습니다.\n주문서(배송용)를 내려받아 택배사·운송장번호를 채운 뒤 올려주세요.'); return; }
    if (!confirm(`엑셀에서 ${list.length}건을 찾았습니다. 일괄 발송처리(송장 등록 + 배송중)할까요?`)) return;
    const supabase = createClient();
    // 현재 조회 기간 밖 주문도 매칭되도록, 화면에 없는 주문번호는 서버에서 직접 조회
    const loadedByNo: Record<string, Order> = {};
    orders.forEach(o => { if (o.order_no) loadedByNo[o.order_no] = o; });
    const missingNos = list.map(p => p.orderNo).filter(no => !loadedByNo[no]);
    const fetchedByNo: Record<string, Order> = {};
    for (let i = 0; i < missingNos.length; i += 300) {
      const chunk = missingNos.slice(i, i + 300);
      const { data } = await supabase.from('orders')
        .select('id, order_no, phone, orderer_phone, recipient, status, order_items(product_name)')
        .in('order_no', chunk);
      (data || []).forEach((o: Record<string, unknown>) => { fetchedByNo[o.order_no as string] = o as unknown as Order; });
    }
    let done = 0, miss = 0, skip = 0;
    for (const p of list) {
      const o = loadedByNo[p.orderNo] || fetchedByNo[p.orderNo];
      if (!o) { miss++; continue; }
      if (['cancelled','refunded','refunding'].includes(o.status)) { skip++; continue; }
      await supabase.from('orders').update({ courier: p.courier, tracking_number: p.tracking, status: 'shipped' }).eq('id', o.id);
      setOrders(prev => prev.map(x => x.id === o.id ? { ...x, courier: p.courier, tracking_number: p.tracking, status: 'shipped' } : x));
      notifyOrderPhones([o.phone, o.orderer_phone], { type:'shipping_started', recipient:o.recipient, orderNo:o.order_no, productName: orderProductName(o), courierName: COURIER_NAMES[p.courier] || p.courier, trackingNumber: p.tracking });
      fetch('/api/tracking/register', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ carrierId: p.courier, trackingNumber: p.tracking }) }).catch(() => {});
      done++;
    }
    refreshStageCounts();
    setSelOrders(new Set());
    alert(`엑셀 일괄 발송처리 완료: ${done}건 처리${skip ? `, ${skip}건 취소/환불건 제외` : ''}${miss ? `, ${miss}건 주문번호 매칭 실패` : ''}`);
  }

  /* ========== 라운지 노출 토글 ========== */
  async function toggleLoungeActive(id: number, newVal: boolean) {
    const supabase = createClient();
    await supabase.from('lounge_posts').update({ is_active: newVal }).eq('id', id);
    setLoungePosts(prev => prev.map(p => p.id === id ? { ...p, is_active: newVal } : p));
  }

  /* ========== 리뷰 베스트 토글 + 삭제 ========== */
  async function toggleReviewBest(id: string, newVal: boolean) {
    const supabase = createClient();
    await supabase.from('reviews').update({ is_best: newVal }).eq('id', id);
    setReviews(prev => prev.map(r => r.id === id ? { ...r, is_best: newVal } : r));
  }

  async function deleteReview(id: string) {
    if (!confirm('이 리뷰를 삭제하시겠습니까?')) return;
    const supabase = createClient();
    const { error } = await supabase.from('reviews').delete().eq('id', id);
    if (error) { alert('삭제 실패: ' + error.message); return; }
    setReviews(prev => prev.filter(r => r.id !== id));
  }

  /* ========== 라운지 CRUD ========== */
  function openLoungeModal(post?: AdminLoungePost) {
    if (post) {
      setEditingLounge(post);
      setLoungeForm({ filter: post.filter, title: post.title, badge: post.badge || '', date: toDateTimeLocal(post.date || ''), thumbnail_url: post.thumbnail_url || '', image_url: post.image_url || '', content: post.content || '', is_active: post.is_active, sort_order: post.sort_order });
    } else {
      setEditingLounge(null);
      setLoungeForm({ filter: 'recipe', title: '', badge: '', date: '', thumbnail_url: '', image_url: '', content: '', is_active: true, sort_order: 0 });
    }
    setLoungeModal(true);
  }

  async function uploadLoungeImage(file: File, type: 'thumb' | 'img'): Promise<string | null> {
    const setLoading = type === 'thumb' ? setLoungeThumbUploading : setLoungeImgUploading;
    setLoading(true);
    const supabase = createClient();
    const { blob, ext, type: ctype } = await compressImage(file);
    const path = `${type}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('lounge').upload(path, blob, { upsert: true, contentType: ctype });
    if (error) { alert('업로드 실패: ' + error.message); setLoading(false); return null; }
    const { data } = supabase.storage.from('lounge').getPublicUrl(path);
    setLoading(false);
    return data.publicUrl;
  }

  async function saveLounge() {
    if (!loungeForm.title.trim()) { alert('제목을 입력해주세요.'); return; }
    setLoungeSaving(true);
    const supabase = createClient();
    if (editingLounge) {
      const { error } = await supabase.from('lounge_posts').update(loungeForm).eq('id', editingLounge.id);
      if (!error) setLoungePosts(prev => prev.map(p => p.id === editingLounge.id ? { ...p, ...loungeForm } : p));
      else alert('수정 실패: ' + error.message);
    } else {
      const { data, error } = await supabase.from('lounge_posts').insert(loungeForm).select().single();
      if (!error && data) setLoungePosts(prev => [data, ...prev]);
      else alert('등록 실패: ' + (error?.message || ''));
    }
    setLoungeSaving(false);
    setLoungeModal(false);
  }

  async function deleteLounge(id: number) {
    if (!confirm('이 게시물을 삭제하시겠습니까?')) return;
    const supabase = createClient();
    await supabase.from('lounge_posts').delete().eq('id', id);
    setLoungePosts(prev => prev.filter(p => p.id !== id));
  }

  /* ========== 입점문의 상세 + 수락/거절 ========== */
  async function updateInquiryStatus(id: string, status: 'done' | 'rejected') {
    const supabase = createClient();
    const { error } = await supabase.from('farm_inquiries').update({ status }).eq('id', id);
    if (error) { alert('처리 실패: ' + error.message + '\n(RLS 권한 문제일 수 있습니다)'); return; }
    setInquiries(prev => prev.map(i => i.id === id ? { ...i, status } : i));
    setSelectedInquiry(prev => prev?.id === id ? { ...prev, status } : prev);
  }

  /* 입점문의 연락 템플릿 (수동 발송용) */
  function inquiryTemplate(kind: 'general'|'accept'|'reject', company: string): string {
    const name = company?.trim() || '담당자';
    if (kind === 'accept') return `안녕하세요 ${name}님, 델리오입니다.\n입점 문의 주셔서 감사합니다. 긍정적으로 검토되어 입점 절차를 안내드리고자 연락드립니다. 편하신 시간에 회신 부탁드립니다.`;
    if (kind === 'reject') return `안녕하세요 ${name}님, 델리오입니다.\n소중한 입점 문의 감사합니다. 내부 검토 결과 아쉽게도 이번에는 함께하기 어려운 점 양해 부탁드립니다. 더 좋은 기회로 다시 뵙기를 바랍니다.`;
    return `안녕하세요 ${name}님, 델리오입니다.\n문의해 주셔서 감사합니다. 관련하여 안내드릴 사항이 있어 연락드립니다.`;
  }

  /* ========== 포인트 관리 ========== */
  async function loadPointData() {
    setPointMembersLoading(true);
    const supabase = createClient();
    const { data: members } = await supabase
      .from('profiles')
      .select('id, name, email, phone, point_balance, grade, created_at')
      .order('point_balance', { ascending: false });
    setPointMembers((members as AdminProfile[]) || []);

    const total = (members || []).reduce((s, m) => s + ((m as AdminProfile).point_balance || 0), 0);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    const { data: logs } = await supabase
      .from('point_logs').select('amount')
      .gte('created_at', monthStart.toISOString());
    const monthGiven = (logs || []).filter((l: {amount:number}) => l.amount > 0).reduce((s: number, l: {amount:number}) => s + l.amount, 0);
    const monthUsed  = (logs || []).filter((l: {amount:number}) => l.amount < 0).reduce((s: number, l: {amount:number}) => s + Math.abs(l.amount), 0);
    setPointStats({ total, monthGiven, monthUsed });
    setPointMembersLoading(false);
    loadPointLogs();
  }

  /* 포인트 지급/사용 내역 (기간별) */
  async function loadPointLogs(from?: string, to?: string) {
    const f = from ?? pointLogFrom;
    const t = to ?? pointLogTo;
    const supabase = createClient();
    let q = supabase.from('point_logs')
      .select('id, amount, created_at, description, profiles:user_id(name, email)')
      .order('created_at', { ascending: false }).limit(500);
    if (f) q = q.gte('created_at', new Date(`${f}T00:00:00`).toISOString());
    if (t) q = q.lte('created_at', new Date(`${t}T23:59:59`).toISOString());
    const { data } = await q;
    setPointLogs((data as unknown as typeof pointLogs) || []);
  }

  async function givePoints() {
    if (!givePointTarget) return;
    const amount = Number(givePointForm.amount);
    if (!amount || isNaN(amount)) { alert('포인트를 입력해주세요.'); return; }
    setGivePointSaving(true);
    const supabase = createClient();
    const { error } = await supabase.rpc('add_points', {
      p_user_id: givePointTarget.id,
      p_amount: amount,
      p_desc: givePointForm.desc.trim() || '관리자 지급',
    });
    if (!error) {
      setPointMembers(prev => prev.map(m => m.id === givePointTarget.id
        ? { ...m, point_balance: (m.point_balance || 0) + amount } : m
      ));
      setPointStats(prev => ({
        total: prev.total + amount,
        monthGiven: amount > 0 ? prev.monthGiven + amount : prev.monthGiven,
        monthUsed:  amount < 0 ? prev.monthUsed + Math.abs(amount) : prev.monthUsed,
      }));
      setGivePointModal(false);
      setGivePointForm({ amount: '', desc: '' });
    } else {
      alert('포인트 지급 실패: ' + error.message);
    }
    setGivePointSaving(false);
  }

  /* ========== 쿠폰 CRUD ========== */
  async function loadCoupons() {
    setCouponsLoading(true);
    const supabase = createClient();
    const [{ data }, issuedRes, usedRes] = await Promise.all([
      supabase.from('coupons').select('*').order('created_at', { ascending: false }),
      supabase.from('user_coupons').select('id', { count: 'exact', head: true }),
      supabase.from('user_coupons').select('id', { count: 'exact', head: true }).eq('is_used', true),
    ]);
    setCoupons((data || []) as AdminCoupon[]);
    setCouponStats({ issued: issuedRes.count || 0, used: usedRes.count || 0 });
    setCouponsLoading(false);
  }

  function openCouponModal(c?: AdminCoupon) {
    if (c) {
      setEditingCoupon(c);
      setCouponForm({ code: c.code || '', name: c.name, description: c.description || '', discount_type: c.discount_type, discount_value: c.discount_value, min_order_amount: c.min_order_amount, max_discount_amount: c.max_discount_amount?.toString() || '', starts_at: c.starts_at.slice(0,10), expires_at: c.expires_at ? c.expires_at.slice(0,10) : '', valid_days: c.valid_days != null ? String(c.valid_days) : '', is_active: c.is_active, is_public: c.is_public ?? false, signup_grant: c.signup_grant ?? false, is_membership: c.is_membership ?? false });
    } else {
      setEditingCoupon(null);
      setCouponForm({ code: '', name: '', description: '', discount_type: 'percent', discount_value: 10, min_order_amount: 0, max_discount_amount: '', starts_at: new Date().toISOString().slice(0,10), expires_at: '', valid_days: '', is_active: true, is_public: false, signup_grant: false, is_membership: false });
    }
    setCouponModal(true);
  }

  /* 신규회원 쿠폰 추가 — signup_grant·정액·유효기간 30일 프리셋 */
  function openSignupCouponModal() {
    setEditingCoupon(null);
    setCouponForm({ code: '', name: '신규회원 쿠폰', description: '', discount_type: 'fixed', discount_value: 3000, min_order_amount: 0, max_discount_amount: '', starts_at: new Date().toISOString().slice(0,10), expires_at: '', valid_days: '30', is_active: true, is_public: false, signup_grant: true, is_membership: false });
    setCouponModal(true);
  }

  /* 멤버십 월발급 쿠폰 추가 — is_membership·유효기간 30일 프리셋 (등급별 월 발급 대상) */
  function openMembershipCouponModal() {
    setEditingCoupon(null);
    setCouponForm({ code: '', name: '멤버십 쿠폰', description: '', discount_type: 'fixed', discount_value: 1000, min_order_amount: 10000, max_discount_amount: '', starts_at: new Date().toISOString().slice(0,10), expires_at: '', valid_days: '30', is_active: true, is_public: false, signup_grant: false, is_membership: true });
    setCouponModal(true);
  }

  /* 쿠폰 코드 자동생성: 영문대문자+숫자 10자리 (혼동문자 0,O,1,I 제외) */
  function genCouponCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  async function saveCoupon() {
    if (!couponForm.name.trim()) { alert('쿠폰명을 입력해주세요.'); return; }
    if (couponForm.signup_grant && !couponForm.valid_days.trim()) {
      alert('신규회원 쿠폰은 유효기간(발급일로부터 N일)을 반드시 입력해주세요.\n(고정 만료일이 아니라 가입일 기준으로 만료되어야 합니다.)');
      return;
    }
    if (couponForm.is_membership && !couponForm.valid_days.trim()) {
      alert('멤버십 월발급 쿠폰은 유효기간(발급일로부터 N일)을 반드시 입력해주세요.\n(매월 발급되며 발급일 기준으로 만료됩니다.)');
      return;
    }
    setCouponSaving(true);
    const supabase = createClient();
    const payload = {
      code: couponForm.code.trim() || genCouponCode(),
      name: couponForm.name.trim(),
      description: couponForm.description.trim() || null,
      discount_type: couponForm.discount_type,
      discount_value: Number(couponForm.discount_value),
      min_order_amount: Number(couponForm.min_order_amount) || 0,
      max_discount_amount: couponForm.max_discount_amount ? Number(couponForm.max_discount_amount) : null,
      starts_at: couponForm.starts_at || new Date().toISOString(),
      expires_at: couponForm.expires_at || null,
      valid_days: couponForm.valid_days.trim() ? Number(couponForm.valid_days) : null,
      is_active: couponForm.is_active,
      is_public: couponForm.is_public,
      signup_grant: couponForm.signup_grant,
      is_membership: couponForm.is_membership,
    };
    // is_membership 컬럼이 아직 없으면(SQL 미실행) 그 필드 빼고 재시도
    const stripMembership = (p: typeof payload) => { const { is_membership, ...rest } = p; void is_membership; return rest; };
    if (editingCoupon) {
      let { error } = await supabase.from('coupons').update(payload).eq('id', editingCoupon.id);
      if (error && /is_membership|column/i.test(error.message)) ({ error } = await supabase.from('coupons').update(stripMembership(payload)).eq('id', editingCoupon.id));
      if (!error) setCoupons(prev => prev.map(c => c.id === editingCoupon.id ? { ...c, ...payload } as AdminCoupon : c));
      else { alert('수정 실패: ' + error.message); setCouponSaving(false); return; }
    } else {
      let { data, error } = await supabase.from('coupons').insert(payload).select().single();
      if (error && /is_membership|column/i.test(error.message)) ({ data, error } = await supabase.from('coupons').insert(stripMembership(payload)).select().single());
      if (!error && data) setCoupons(prev => [data as AdminCoupon, ...prev]);
      else { alert('생성 실패: ' + (error?.message || '')); setCouponSaving(false); return; }
    }
    setCouponSaving(false);
    setCouponModal(false);
  }

  async function deleteCoupon(id: string) {
    if (!confirm('이 쿠폰을 삭제하시겠습니까?')) return;
    const supabase = createClient();
    await supabase.from('coupons').delete().eq('id', id);
    setCoupons(prev => prev.filter(c => c.id !== id));
  }

  function openGiveCouponModal(c: AdminCoupon) {
    setGiveCouponTarget(c);
    setGiveCouponMode('all');
    setGiveCouponIds(new Set());
    setGiveCouponSearch('');
    setGiveCouponModal(true);
    if (members.length === 0) loadMembers();
  }

  async function giveCoupon() {
    if (!giveCouponTarget) return;
    const targets = giveCouponMode === 'all'
      ? members.map(m => m.id)
      : members.filter(m => giveCouponIds.has(m.id)).map(m => m.id);
    if (targets.length === 0) { alert('지급 대상이 없습니다.'); return; }
    if (!confirm(`${targets.length}명에게 "${giveCouponTarget.name}" 쿠폰을 지급하시겠습니까?`)) return;
    setGiveCouponSaving(true);
    const supabase = createClient();
    // 유효기간(발급일+N일) 설정 시 그 만료일, 아니면 절대 만료일
    const giveExpires = giveCouponTarget.valid_days != null
      ? new Date(Date.now() + giveCouponTarget.valid_days * 86400000).toISOString()
      : giveCouponTarget.expires_at;
    const { data, error } = await supabase.rpc('give_coupon_to_users', {
      p_coupon_id: giveCouponTarget.id,
      p_user_ids: targets,
      p_expires_at: giveExpires,
    });
    setGiveCouponSaving(false);
    if (error) { alert('지급 실패: ' + error.message); return; }
    setGiveCouponModal(false);
    alert(`${data ?? 0}명에게 쿠폰을 지급했습니다. (이미 보유한 회원 제외)`);
  }

  async function toggleCouponActive(id: string, newVal: boolean) {
    const supabase = createClient();
    await supabase.from('coupons').update({ is_active: newVal }).eq('id', id);
    setCoupons(prev => prev.map(c => c.id === id ? { ...c, is_active: newVal } : c));
  }

  /* ========== 이벤트 활성 토글 ========== */
  async function toggleEventActive(id: string, newVal: boolean) {
    const supabase = createClient();
    await supabase.from('events').update({ is_active: newVal }).eq('id', id);
    setEvents(prev => prev.map(e => e.id === id ? { ...e, is_active: newVal } : e));
  }

  function openEventModal(ev?: AdminEvent) {
    if (ev) {
      setEditingEvent(ev);
      setEvForm({
        slug: ev.slug, title: ev.title, subtitle: ev.subtitle || '',
        badge: ev.badge || '', badge_color: ev.badge_color || BADGE_DEFAULT_COLOR,
        thumbnail_url: ev.thumbnail_url || '',
        image_url: ev.image_url || '',
        content: ev.content || '',
        starts_at: ev.starts_at ? ev.starts_at.slice(0, 16) : '',
        ends_at:   ev.ends_at   ? ev.ends_at.slice(0, 16)   : '',
        is_active: ev.is_active,
      });
    } else {
      setEditingEvent(null);
      setEvForm({ ...EVENT_EMPTY });
    }
    setEventModal(true);
  }

  async function uploadEventImage(file: File, type: 'thumb' | 'img'): Promise<string | null> {
    const setLoading = type === 'thumb' ? setEvThumbUploading : setEvImgUploading;
    setLoading(true);
    const supabase = createClient();
    const { blob, ext, type: ctype } = await compressImage(file);
    const path = `${type}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('events').upload(path, blob, { upsert: true, contentType: ctype });
    if (error) { alert('업로드 실패: ' + error.message); setLoading(false); return null; }
    const { data } = supabase.storage.from('events').getPublicUrl(path);
    setLoading(false);
    return data.publicUrl;
  }

  function makeSlug(title: string) {
    const en = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const ts = Date.now().toString(36);
    return en ? `${en}-${ts}` : `event-${ts}`;
  }

  async function saveEvent() {
    if (!evForm.title.trim()) { alert('이벤트명을 입력하세요.'); return; }
    // 즉시 활성화 체크 시 날짜를 비워도 "지금부터 ~ 무기한"으로 자동 설정
    const immediate = evForm.is_active;
    const startsRaw = evForm.starts_at || (immediate ? new Date().toISOString().slice(0, 16) : '');
    const endsRaw   = evForm.ends_at   || (immediate ? '2099-12-31T23:59' : '');
    if (!startsRaw) { alert('시작일을 입력하세요. (또는 "즉시 활성화"를 체크하면 지금부터 노출됩니다)'); return; }
    if (!endsRaw)   { alert('종료일을 입력하세요. (또는 "즉시 활성화"를 체크하면 무기한 노출됩니다)'); return; }
    // 새 등록 시 슬러그 없으면 자동 생성
    if (!evForm.slug.trim()) setEvForm(f => ({ ...f, slug: makeSlug(f.title) }));
    setEvSaving(true);
    const supabase = createClient();
    const payload = {
      slug:          evForm.slug.trim(),
      title:         evForm.title.trim(),
      subtitle:      evForm.subtitle.trim()     || null,
      badge:         evForm.badge.trim()        || null,
      badge_color:   evForm.badge.trim() ? (evForm.badge_color || BADGE_DEFAULT_COLOR) : null,
      thumbnail_url: evForm.thumbnail_url.trim() || null,
      image_url:     evForm.image_url.trim()     || null,
      content:       evForm.content.trim()       || null,
      starts_at:     new Date(startsRaw).toISOString(),
      ends_at:       new Date(endsRaw).toISOString(),
      is_active:     evForm.is_active,
    };
    const { error } = editingEvent
      ? await supabase.from('events').update(payload).eq('id', editingEvent.id)
      : await supabase.from('events').insert(payload);
    if (error) { alert('저장 실패: ' + error.message); setEvSaving(false); return; }
    setEvSaving(false);
    setEventModal(false);
    loadEvents();
  }

  async function deleteEvent(id: string) {
    if (!confirm('이 이벤트를 삭제하시겠습니까?')) return;
    const supabase = createClient();
    await supabase.from('events').delete().eq('id', id);
    setEvents(prev => prev.filter(e => e.id !== id));
  }

  /* ========== 패널 전환 ========== */
  function go(p: PanelKey, fromHistory = false) {
    setPanel(prev => {
      // 사용자가 직접 이동한 경우만 히스토리에 기록 (뒤로가기로 복원 가능)
      if (!fromHistory && typeof window !== 'undefined' && p !== prev) {
        window.history.pushState({ ...window.history.state, admPanel: p }, '');
      }
      return p;
    });
    if (window.innerWidth <= 900) setSidebarOpen(false);
    if (loadedPanels.current.has(p)) return;
    loadedPanels.current.add(p);
    switch (p) {
      case 'orders':    loadOrders(); loadFarms(); loadRefundRequests(); break;
      case 'products':  loadProducts(); loadFilterTabs(); loadFarms(); break;
      case 'menu': loadMenus(); loadFilterTabs(); break;
      case 'farms':     loadFarms(); break;
      case 'members':   loadMembers(); break;
      case 'banner':    loadBanners(); loadPopups(); break;
      case 'reviews':   loadReviews(); break;
      case 'coupon':    loadCoupons(); loadPointData(); loadSettings(); loadMTiers(); loadCouponLogs(); break;
      case 'events':    loadEvents(); break;
      case 'lounge':    loadLounge(); break;
      case 'homesections': loadProducts(); loadFarms(); loadReviews(); loadLounge(); loadFilterTabs(); loadSettings(); break;
      case 'referral':     loadReferrals(); loadReferralCoupons(); break;
      case 'tasteprofile': loadSurveyResults(); loadSurveySettings(); break;
      case 'inquiry':   loadInquiries(); break;
      case 'productinquiry': loadProductInquiries(); break;
      case 'faq':       loadFaq(); break;
      case 'cs':        loadCsInquiries(); break;
      case 'refund':    loadRefundRequests(); loadOrders(); break;
      case 'settings':    loadSettings(); loadSearchStats(7); break;
      case 'analytics':   loadMarketing(); break;
      case 'settlement':  { const [f, t] = settlementRange(); loadSettlement(f, t); break; }
      case 'farmsettle':  loadFarmSettlement(farmSettleMonth); break;
    }
  }

  /* ========== 서브 컴포넌트 ========== */
  /* 사이드바 메뉴 — 아이콘 제거, 글씨만 (icon prop은 호출부 호환 위해 받기만 하고 렌더 안 함) */
  function NavItem({ panel: p, label, badge }: { panel: PanelKey; icon?: React.ReactNode; label: string; badge?: number }) {
    return (
      <a className={`adm-nav-item${panel === p ? ' active' : ''}`} onClick={() => go(p)}>
        {label}
        {badge ? <span className="adm-nav-badge">{badge}</span> : null}
      </a>
    );
  }

  function TabBtns({ tabs, active, setActive }: { tabs: {id:string; label: React.ReactNode}[]; active: string; setActive: (id:string)=>void }) {
    return (
      <div className="adm-tabs">
        {tabs.map(t => (
          <button key={t.id} className={`adm-tab${active===t.id?' active':''}`} onClick={() => setActive(t.id)}>{t.label}</button>
        ))}
      </div>
    );
  }

  /* 필터된 주문 목록 */
  /* 주문별 진행 중(접수/처리중) 취소·환불 요청 — 주문관리에서 배지·처리 노출용 */
  const pendingReqByOrder = new Map<string, AdminRefundReq>();
  refundReqs.forEach(r => {
    if (r.order_id && (r.status === 'pending' || r.status === 'processing')) pendingReqByOrder.set(r.order_id, r);
  });

  const filteredOrders = orders.filter(o => {
    const matchStatus = !orderStatusFilter || o.status === orderStatusFilter;
    const matchFarm   = !orderFarmFilter || (o.order_items || []).some(i => i.farm_id === orderFarmFilter);
    const q = orderSearch.toLowerCase();
    const matchSearch = !q || o.order_no.toLowerCase().includes(q) ||
      o.recipient.toLowerCase().includes(q) || o.phone.includes(q);
    const matchReq = !orderReqOnly || pendingReqByOrder.has(o.id);
    return matchStatus && matchFarm && matchSearch && matchReq;
  });

  /* 페이지네이션 (N개씩) */
  const orderTotalPages = Math.max(1, Math.ceil(filteredOrders.length / orderPageSize));
  const orderCurPage = Math.min(orderPage, orderTotalPages);
  const pagedOrders = filteredOrders.slice((orderCurPage - 1) * orderPageSize, orderCurPage * orderPageSize);

  /* 엑셀 다운로드 — kind='ship'(주문서·배송용, 공급가 제외) / 'purchase'(발주서·매입용, 고객 개인정보 제외) */
  async function downloadOrderExcel(farmId?: string, kind: 'ship' | 'purchase' = 'ship') {
    const xlsxMod = await import('xlsx');
    const XLSX = xlsxMod.default ?? xlsxMod;
    const targetOrders = farmId
      ? orders.filter(o => (o.order_items || []).some(i => i.farm_id === farmId))
      : filteredOrders;

    // 주문항목을 농가별로 평탄화
    type Row = { farmId: string; farmName: string; carrier: string; order_no: string; recipient: string; phone: string; zipcode: string; address: string; memo: string; product: string; option: string; qty: number; supply: number; courierName: string; tracking: string; shipStatus: string };
    const SHIP_LABEL: Record<string, string> = { preparing:'배송준비중', shipped:'배송중', delivered:'배송완료' };
    const all: Row[] = [];
    targetOrders.forEach(o => {
      (o.order_items || []).forEach(it => {
        const i = it as typeof it & { supply_price?: number|null; option_label?: string|null; carrier?: string|null; courier?: string|null; tracking_number?: string|null; ship_status?: string|null };
        if (farmId && i.farm_id !== farmId) return;
        all.push({
          farmId: (i.farm_id as string) || '__none__',
          farmName: (i.farm_name as string) || '농가 미지정',
          carrier: (i.carrier as string) || '미지정',
          order_no: o.order_no, recipient: o.recipient, phone: o.phone, zipcode: o.zipcode || '',
          address: o.address1 + (o.address2 ? ' ' + o.address2 : ''), memo: o.delivery_memo || '',
          product: i.product_name, option: (i.option_label as string) || '', qty: Number(i.quantity) || 0,
          supply: Number(i.supply_price) || 0,
          courierName: i.courier ? (COURIER_NAMES[i.courier] || i.courier) : '',
          tracking: (i.tracking_number as string) || '',
          shipStatus: i.ship_status ? (SHIP_LABEL[i.ship_status] || i.ship_status) : '',
        });
      });
    });
    if (all.length === 0) { alert('다운로드할 주문이 없습니다.'); return; }

    // 농가별 그룹
    const byFarm: Record<string, Row[]> = {};
    all.forEach(r => { (byFarm[r.farmId] ||= []).push(r); });

    const wb = XLSX.utils.book_new();
    const usedNames = new Set<string>();
    const today0 = new Date().toISOString().slice(0, 10);
    Object.values(byFarm).forEach(rows => {
      const f = rows[0];
      const aoa: (string | number)[][] = [];
      let cols: { wch: number }[];
      if (kind === 'ship') {
        // 주문서(배송용) — 고객·배송 정보만 (공급가/원가 제외)
        aoa.push([`${f.farmName} 주문서 (배송용)`, '', '', '', `지정 택배사: ${f.carrier}`]);
        aoa.push([`출력일: ${today0}`]);
        aoa.push([]);
        aoa.push(['주문번호', '받는분', '연락처', '우편번호', '주소', '상품명', '옵션', '수량', '배송메시지', '택배사', '운송장번호', '배송상태']);
        rows.forEach(r => aoa.push([r.order_no, r.recipient, r.phone, r.zipcode, r.address, r.product, r.option, r.qty, r.memo, r.courierName, r.tracking, r.shipStatus]));
        cols = [{ wch: 18 }, { wch: 10 }, { wch: 14 }, { wch: 8 }, { wch: 34 }, { wch: 22 }, { wch: 12 }, { wch: 6 }, { wch: 20 }, { wch: 14 }, { wch: 18 }, { wch: 12 }];
      } else {
        // 발주서(매입용) — 상품·수량·공급가만 (고객 개인정보 제외)
        aoa.push([`${f.farmName} 발주서 (매입용)`, '', '', `출력일: ${today0}`]);
        aoa.push([]);
        aoa.push(['주문번호', '상품명', '옵션', '수량', '공급단가', '공급가 소계']);
        rows.forEach(r => aoa.push([r.order_no, r.product, r.option, r.qty, r.supply, r.supply * r.qty]));
        const totalQty = rows.reduce((s, r) => s + r.qty, 0);
        const totalSupply = rows.reduce((s, r) => s + r.supply * r.qty, 0);
        aoa.push([]);
        aoa.push(['── 상품별 발주 합계 ──']);
        aoa.push(['상품명', '옵션', '수량', '공급가 합계']);
        const pmap: Record<string, { qty: number; amount: number }> = {};
        rows.forEach(r => { const k = `${r.product}|${r.option}`; (pmap[k] ||= { qty: 0, amount: 0 }); pmap[k].qty += r.qty; pmap[k].amount += r.supply * r.qty; });
        Object.entries(pmap).forEach(([k, v]) => { const [p, op] = k.split('|'); aoa.push([p, op, v.qty, v.amount]); });
        aoa.push([]);
        aoa.push(['농가 발주 합계', '', totalQty, totalSupply]);
        cols = [{ wch: 18 }, { wch: 24 }, { wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 14 }];
      }
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = cols;
      // 시트명: 농가명(31자, 특수문자 제거, 중복방지)
      let nm = f.farmName.replace(/[\\/?*[\]:]/g, ' ').slice(0, 28) || '농가';
      let n = nm; let c = 2; while (usedNames.has(n)) { n = `${nm}_${c++}`; } usedNames.add(n);
      XLSX.utils.book_append_sheet(wb, ws, n);
    });

    const today = new Date().toISOString().slice(0, 10);
    const docName = kind === 'ship' ? '주문서(배송용)' : '발주서(매입용)';
    const fileName = farmId
      ? `${docName}_${(byFarm[farmId]?.[0]?.farmName) || '농가'}_${today}.xlsx`
      : `${docName}_농가별_${today}.xlsx`;
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([buf], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
  }

  /* CJ대한통운 대량접수 엑셀 — 주문×농가(파셀) 1행, CJ 업로드 양식 컬럼에 매핑 */
  async function downloadCJExcel(farmId?: string) {
    const xlsxMod = await import('xlsx');
    const XLSX = xlsxMod.default ?? xlsxMod;
    const targetOrders = farmId
      ? orders.filter(o => (o.order_items || []).some(i => i.farm_id === farmId))
      : filteredOrders;
    // (주문 × 농가) 단위로 묶어 파셀 1행 — 같은 주문 내 같은 농가 상품은 한 박스로 합침
    type Pcl = { order_no: string; recipient: string; phone: string; address: string; memo: string; products: string[]; qty: number; tracking: string };
    const parcels: Record<string, Pcl> = {};
    targetOrders.forEach(o => {
      (o.order_items || []).forEach(it => {
        const i = it as typeof it & { option_label?: string|null; tracking_number?: string|null };
        if (farmId && i.farm_id !== farmId) return;
        const key = `${o.id}|${i.farm_id || '__none__'}`;
        const p = (parcels[key] ||= { order_no: o.order_no, recipient: o.recipient, phone: o.phone,
          address: o.address1 + (o.address2 ? ' ' + o.address2 : ''), memo: o.delivery_memo || '', products: [], qty: 0, tracking: (i.tracking_number as string) || '' });
        const nm = i.product_name + (i.option_label ? ` (${i.option_label})` : '');
        p.products.push(nm);
        p.qty += Number(i.quantity) || 0;
      });
    });
    const list = Object.values(parcels);
    if (list.length === 0) { alert('다운로드할 주문이 없습니다.'); return; }

    const header = ['받는분성명','받는분전화번호','받는분기타연락처','받는분주소(전체, 분할)','품목명','내품명','내품수량','박스타입','운임구분','사용안함','배송메세지1','고객주문번호','운송장번호'];
    const aoa: (string | number)[][] = [header];
    list.forEach(p => {
      const item = p.products.length > 1 ? `${p.products[0]} 외 ${p.products.length - 1}건` : (p.products[0] || '상품');
      aoa.push([p.recipient, p.phone, '', p.address, item, '', p.qty, '소', '신용', '', p.memo, p.order_no, p.tracking]);
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch:10 },{ wch:15 },{ wch:15 },{ wch:40 },{ wch:24 },{ wch:12 },{ wch:8 },{ wch:8 },{ wch:8 },{ wch:8 },{ wch:24 },{ wch:20 },{ wch:16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'sheet1');
    const today = new Date().toISOString().slice(0, 10);
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([buf], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `CJ대한통운_발송_${today}.xlsx`; a.click();
    URL.revokeObjectURL(url);
  }

  /* 필터된 상품 목록 */
  /* 판매상태 판정: 판매중(활성·재고>0) / 품절(활성·재고0) / 판매중지(비활성) */
  const productSellState = (p: AdminProduct): 'selling'|'soldout'|'stopped' =>
    !p.is_active ? 'stopped' : (p.total_stock != null && p.total_stock <= 0) ? 'soldout' : 'selling';
  const productStatusCounts = {
    selling: products.filter(p => productSellState(p) === 'selling').length,
    soldout: products.filter(p => productSellState(p) === 'soldout').length,
    stopped: products.filter(p => productSellState(p) === 'stopped').length,
  };
  /* 카테고리 라벨 — filter_tabs(category형)에서 동적 생성, 없으면 하드코딩 폴백 */
  const dynCatLabel: Record<string, string> = filterTabs
    .filter(t => t.tab_type === 'category')
    .sort((a, b) => a.sort_order - b.sort_order)
    .reduce((m, t) => { m[t.tab_value] = t.label; return m; }, {} as Record<string, string>);
  const catOptions = Object.keys(dynCatLabel).length ? dynCatLabel : CAT_LABEL;
  /* 카테고리 트리 (대분류/소분류) — filter_tabs(category형) */
  const catTabsAll = filterTabs.filter(t => t.tab_type === 'category');
  const majorCats = catTabsAll.filter(t => !t.parent).sort((a, b) => a.sort_order - b.sort_order);
  const subCatsOf = (majorVal: string) => catTabsAll.filter(t => t.parent === majorVal).sort((a, b) => a.sort_order - b.sort_order);
  const filteredProducts = products.filter(p => {
    const matchCat = !productCatFilter || p.category === productCatFilter;
    const matchBrand = !productBrandFilter || p.farm_id === productBrandFilter;
    const q = productSearch.toLowerCase();
    const brandName = (farms.find(f => f.id === p.farm_id)?.name || '').toLowerCase();
    const matchSearch = !q || p.name.toLowerCase().includes(q) || brandName.includes(q);
    const matchStatus = !productStatusFilter || productSellState(p) === productStatusFilter;
    return matchCat && matchBrand && matchSearch && matchStatus;
  });

  /* 리뷰 필터·페이지 */
  /* 리뷰 목록 농가 필터 — '' 이면 전체 */
  const reviewFarmName = (r: AdminReview) => farms.find(f => f.id === r.products?.farm_id)?.name || '';
  const reviewUnansweredCount = reviews.filter(r => !r.seller_reply).length;
  const reviewAvgRating = reviews.length ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length) : 0;
  const filteredReviews = reviews.filter(r => {
    const matchRating = !reviewRating || r.rating === Number(reviewRating);
    const matchAns = reviewAnswered === 'all' || (reviewAnswered === 'answered' ? !!r.seller_reply : !r.seller_reply);
    const matchFarm = !reviewFarm || r.products?.farm_id === reviewFarm;
    const matchFlag =
      !reviewFlag ? true
      : reviewFlag === 'best'     ? !!r.is_best
      : reviewFlag === 'reported' ? (r.report_count || 0) > 0
      :                             (r.likes_count || 0) > 0;
    const q = reviewSearch.trim().toLowerCase();
    /* 검색 대상: 리뷰 내용 · 작성자(이름/이메일) · 농가명 · 상품명 */
    const matchSearch = !q || [
      r.content || '', r.profiles?.email || '', r.profiles?.name || '',
      reviewFarmName(r), r.products?.name || '',
    ].some(v => v.toLowerCase().includes(q));
    const matchFrom = !reviewFrom || r.created_at >= new Date(`${reviewFrom}T00:00:00`).toISOString();
    const matchTo   = !reviewTo   || r.created_at <= new Date(`${reviewTo}T23:59:59`).toISOString();
    return matchRating && matchAns && matchFarm && matchFlag && matchSearch && matchFrom && matchTo;
  });
  const reviewTotalPages = Math.max(1, Math.ceil(filteredReviews.length / reviewPageSize));
  const reviewCurPage = Math.min(reviewPage, reviewTotalPages);
  const pagedReviews = filteredReviews.slice((reviewCurPage - 1) * reviewPageSize, reviewCurPage * reviewPageSize);

  /* 포인트 필터된 회원 */
  const filteredPointMembers = pointMembers
    .filter(m => {
      if (pointFilter === 'has')  return (m.point_balance || 0) > 0;
      if (pointFilter === 'none') return (m.point_balance || 0) === 0;
      return true;
    })
    .filter(m => {
      const q = pointSearch.toLowerCase();
      return !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || (m.phone||'').includes(q);
    });

  /* 필터된 회원 목록 */
  const filteredMembers = members.filter(m => {
    const matchGrade   = !memberGradeFilter || m.grade === memberGradeFilter;
    const matchBlock   = memberBlockFilter === 'all' ? true : memberBlockFilter === 'blocked' ? m.is_blocked : !m.is_blocked;
    const matchProvider = !memberProviderFilter || providerKey(m.provider) === memberProviderFilter;
    const q = memberSearch.toLowerCase();
    const matchSearch  = !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || (m.phone || '').includes(q);
    return matchGrade && matchBlock && matchProvider && matchSearch;
  });

  /* 페이지 슬라이스 (포인트회원 / 포인트내역 / 회원관리) */
  const pmCur = Math.min(Math.max(1, pmPage), Math.max(1, Math.ceil(filteredPointMembers.length / pmSize)));
  const pagedPointMembers = filteredPointMembers.slice((pmCur - 1) * pmSize, pmCur * pmSize);
  const plCur = Math.min(Math.max(1, plPage), Math.max(1, Math.ceil(pointLogs.length / plSize)));
  const pagedPointLogs = pointLogs.slice((plCur - 1) * plSize, plCur * plSize);
  const memCur = Math.min(Math.max(1, memPage), Math.max(1, Math.ceil(filteredMembers.length / memSize)));
  const pagedMembers = filteredMembers.slice((memCur - 1) * memSize, memCur * memSize);
  const cpCur = Math.min(Math.max(1, cpPage), Math.max(1, Math.ceil(coupons.length / cpSize)));
  const pagedCoupons = coupons.slice((cpCur - 1) * cpSize, cpCur * cpSize);
  /* 멤버십 관리 탭 월발급 체크박스용 — 활성 멤버십 쿠폰 목록 */
  const membershipCoupons = coupons.filter(c => c.is_membership && c.is_active);
  /* 쿠폰 지급 내역 필터/페이징 */
  const clFiltered = couponLogs.filter(l => {
    if (clStatus === 'unused' && l.status !== '미사용') return false;
    if (clStatus === 'used' && l.status !== '사용완료') return false;
    if (clStatus === 'expired' && l.status !== '만료') return false;
    if (clCategory !== 'all' && l.category !== clCategory) return false;
    const q = clSearch.trim().toLowerCase();
    if (q && !(`${l.name} ${l.email} ${l.couponName}`.toLowerCase().includes(q))) return false;
    return true;
  });
  const clCur = Math.min(Math.max(1, clPage), Math.max(1, Math.ceil(clFiltered.length / clSize)));
  const pagedCouponLogs = clFiltered.slice((clCur - 1) * clSize, clCur * clSize);

  /* 필터된 라운지 */
  const filteredLounge = loungeFilter
    ? loungePosts.filter(p => p.filter === loungeFilter)
    : loungePosts;

  /* 문의 탭별 필터 */
  const pendingInquiries = inquiries.filter(i => i.status === 'pending' || i.status === 'new' || !i.status);
  const doneInquiries = inquiries.filter(i => ['answered', 'done', 'rejected'].includes(i.status));

  /* FAQ 필터 */
  const filteredFaq = faqItems.filter(f => {
    if (faqCatFilter && f.category !== faqCatFilter) return false;
    if (faqSearch.trim() && !f.question.includes(faqSearch.trim()) && !f.answer.includes(faqSearch.trim())) return false;
    return true;
  });
  const faqTotalPages = Math.max(1, Math.ceil(filteredFaq.length / faqPageSize));
  const faqCurPage = Math.min(faqPage, faqTotalPages);
  const pagedFaq = filteredFaq.slice((faqCurPage - 1) * faqPageSize, faqCurPage * faqPageSize);
  /* 드래그 정렬: 특정 카테고리 선택 + 검색 없을 때만 (전체에선 순서 의미 없음) */
  const canDragFaq = !!faqCatFilter && !faqSearch.trim();
  async function reorderFaq(fromId: string, toId: string) {
    if (fromId === toId) return;
    const list = filteredFaq;
    const fromIdx = list.findIndex(f => f.id === fromId);
    const toIdx = list.findIndex(f => f.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const reordered = [...list];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const ids = new Set(list.map(f => f.id));
    setFaqItems(prev => { let ri = 0; return prev.map(f => { if (!ids.has(f.id)) return f; const nf = reordered[ri]; ri++; return { ...nf, sort_order: ri }; }); });
    const supabase = createClient();
    await Promise.all(reordered.map((f, i) => supabase.from('faq_items').update({ sort_order: i + 1 }).eq('id', f.id)));
  }

  /* 1:1 문의 탭별 필터 */
  const csPending  = csItems.filter(c => c.status === 'pending');
  const csAnswered = csItems.filter(c => c.status === 'answered');
  const csTabBase  = csAdminTab === 'tab-pending' ? csPending : csAdminTab === 'tab-answered' ? csAnswered : csItems;
  const csTabList  = csTabBase.filter(c => {
    const matchCat  = !csCatFilter || c.category === csCatFilter;
    const matchFrom = !csFrom || c.created_at >= new Date(`${csFrom}T00:00:00`).toISOString();
    const matchTo   = !csTo   || c.created_at <= new Date(`${csTo}T23:59:59`).toISOString();
    const q = csSearch.trim().toLowerCase();
    const matchSearch = !q || (c.title || '').toLowerCase().includes(q) || (c.message || '').toLowerCase().includes(q);
    return matchCat && matchFrom && matchTo && matchSearch;
  });

  /* 이벤트 상태 */
  function getEventStatus(ev: AdminEvent) {
    const now = new Date();
    if (!ev.is_active) return 'inactive';
    if (new Date(ev.starts_at) > now) return 'upcoming';
    if (new Date(ev.ends_at) < now) return 'ended';
    return 'ongoing';
  }

  return (
    <div style={{ background:'#F1F5F9', minHeight:'100vh', fontFamily:"'Pretendard', -apple-system, sans-serif" }}>

      {/* 오버레이 */}
      {sidebarOpen && <div className="adm-overlay open" onClick={() => setSidebarOpen(false)} />}

      {/* ===== 상세설명 이미지 에디터 ===== */}
      {detailEditor && (
        <ImageDetailEditor
          productId={detailEditor.id}
          productName={detailEditor.name}
          draftImages={draftImages}
          onCommitDraft={imgs => setDraftImages(imgs)}
          onUpload={path => detailUploadsRef.current.push(path)}
          onClose={() => setDetailEditor(null)}
        />
      )}

      {/* ===== 상세정보 에디터 (구조화) ===== */}
      {infoEditor && (
        <InfoSectionEditor
          productId={infoEditor.id}
          productName={infoEditor.name}
          draftInfo={draftInfo}
          onCommitDraft={d => setDraftInfo(d)}
          onClose={() => setInfoEditor(null)}
        />
      )}

      {/* ===== 상품 등록/수정 — 페이지형 패널 ===== */}
      {productModal && panel === 'products' && (
        <div className="adm-productpage">
          <div className="adm-productpage-inner">
            <div className="adm-modal-head" style={{ position:'sticky', top:0, background:'#fff', zIndex:2 }}>
              <span className="adm-modal-title">{editingProduct ? '상품 수정' : '상품 등록'}</span>
              <button className="adm-btn adm-btn-outline" style={{ height:32, padding:'0 12px', fontSize:13 }} onClick={closeProductForm}>← 목록으로</button>
            </div>
            <div className="adm-modal-body" style={{ display:'flex', flexDirection:'column', gap:14 }}>

              {/* ===== 섹션 1 · 기본정보 (상품 유형 + 기본 필드) ===== */}
              <div className="adm-formsec">
              <div className="adm-formsec-title">기본정보</div>
              {/* 상품 유형: 자사 / 산지 (맨 위에서 먼저 선택) */}
              <div style={{ display:'flex', gap:8, marginBottom:16 }}>
                {([
                  { dawn:false, label:'자사 상품', desc:'자사배송' },
                  { dawn:true,  label:'브랜드 직송', desc:'산지직송' },
                ] as const).map(opt => {
                  const active = !!pForm.is_dawn === opt.dawn;
                  // 산지 = 초록, 자사 = 주황 (상품페이지와 동일 계열)
                  const cMain = opt.dawn ? '#16A34A' : '#EA580C';
                  const cBg = opt.dawn ? '#F0FDF4' : '#FFF7ED';
                  const cBorder = opt.dawn ? '#16A34A' : '#F97316';
                  return (
                    <button key={String(opt.dawn)} type="button"
                      onClick={() => setPForm(f => ({ ...f, is_dawn: opt.dawn }))}
                      style={{ flex:1, padding:'12px 10px', borderRadius:10, cursor:'pointer', textAlign:'center',
                        border: active ? `2px solid ${cBorder}` : '1px solid #E2E8F0',
                        background: active ? cBg : '#fff',
                        color: active ? cMain : '#475569' }}>
                      <div style={{ fontSize:14, fontWeight:700 }}>{opt.label}</div>
                      <div style={{ fontSize:11, color: active ? cMain : '#94A3B8', marginTop:2 }}>{opt.desc}</div>
                    </button>
                  );
                })}
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div style={{ gridColumn:'1 / -1' }}>
                  <label className="adm-label">상품명 *</label>
                  <input className="adm-input-text" style={{ width:'100%' }} value={pForm.name}
                    onChange={e => setPForm(f => ({ ...f, name: e.target.value }))} placeholder="상품명 입력" />
                </div>
                <div style={{ gridColumn:'1 / -1' }}>
                  <label className="adm-label">한 줄 설명 <span style={{ fontWeight:400, color:'#94A3B8' }}>(상품명 아래 · 상품카드 표시)</span></label>
                  <input className="adm-input-text" style={{ width:'100%' }} value={pForm.short_desc || ''}
                    onChange={e => setPForm(f => ({ ...f, short_desc: e.target.value }))} placeholder="상품 카드에 표시되는 짧은 설명" />
                </div>
                <div>
                  <label className="adm-label">SKU <span style={{ fontWeight:400, color:'#94A3B8' }}>(자동생성 · 내부코드)</span></label>
                  <input className="adm-input-text" style={{ width:'100%', background:'#F1F5F9', color:'#64748B', cursor:'default' }}
                    value={pForm.sku} readOnly tabIndex={-1} placeholder="저장 시 자동 생성됩니다" />
                </div>
                <div style={{ gridColumn:'1 / -1' }}>
                  <label className="adm-label">카테고리 * <span style={{ fontWeight:400, color:'#94A3B8' }}>(대분류 → 소분류)</span></label>
                  {(() => {
                    const curTab = catTabsAll.find(t => t.tab_value === pForm.category);
                    const majorVal = curTab ? (curTab.parent || curTab.tab_value) : (majorCats.some(m => m.tab_value === pForm.category) ? pForm.category : '');
                    const subVal = curTab && curTab.parent ? curTab.tab_value : '';
                    const subs = subCatsOf(majorVal);
                    const setCat = (v: string) => {
                      setPForm(f => ({ ...f, category: v }));
                      if (!editingProduct) generateSku(v).then(sku => setPForm(f => ({ ...f, sku })));
                    };
                    return (
                      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                        <AdmSelect style={{ flex:'1 1 160px' }} value={majorVal}
                          onChange={v => setCat(v)}
                          options={[{ value:'', label:'대분류 선택' }, ...majorCats.map(m => ({ value:m.tab_value, label:m.label }))]} />
                        {majorVal && subs.length > 0 && (
                          <AdmSelect style={{ flex:'1 1 160px' }} value={subVal}
                            onChange={v => setCat(v || majorVal)}
                            options={[{ value:'', label:'전체 (대분류 직속)' }, ...subs.map(s => ({ value:s.tab_value, label:s.label }))]} />
                        )}
                      </div>
                    );
                  })()}
                </div>
                {pForm.is_dawn && (
                <div style={{ gridColumn:'1 / -1' }}>
                  <label className="adm-label">연결 농가 <span style={{ fontWeight:400, color:'#94A3B8' }}>(이름 검색)</span></label>
                  <div style={{ position:'relative' }}>
                    <input className="adm-input-text" style={{ width:'100%' }} placeholder="농가 없음 — 이름으로 검색"
                      value={farmPickOpen ? farmSearch : (farmList.find(fm => fm.id === pForm.farm_id)?.name || '')}
                      onFocus={() => { setFarmPickOpen(true); setFarmSearch(''); }}
                      onBlur={() => setTimeout(() => setFarmPickOpen(false), 150)}
                      onChange={e => setFarmSearch(e.target.value)} />
                    {farmPickOpen && (() => {
                      const matched = farmList.filter(fm => fm.name.toLowerCase().includes(farmSearch.toLowerCase()));
                      return (
                        <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:30, maxHeight:220,
                          overflowY:'auto', background:'#fff', border:'1px solid #E2E8F0', borderRadius:8, boxShadow:'0 6px 18px rgba(0,0,0,0.1)' }}>
                          <div onMouseDown={() => { setPForm(f => ({ ...f, farm_id: null })); setFarmPickOpen(false); }}
                            style={{ padding:'9px 12px', cursor:'pointer', fontSize:13, color:'#94A3B8', borderBottom:'1px solid #F1F5F9' }}>농가 없음</div>
                          {matched.map(fm => (
                            <div key={fm.id} onMouseDown={() => { setPForm(f => ({ ...f, farm_id: fm.id })); setFarmPickOpen(false); }}
                              style={{ padding:'9px 12px', cursor:'pointer', fontSize:13, fontWeight: pForm.farm_id===fm.id ? 700 : 400,
                                background: pForm.farm_id===fm.id ? '#F1F5F9' : '#fff' }}>{fm.name}</div>
                          ))}
                          {matched.length === 0 && <div style={{ padding:'9px 12px', fontSize:12, color:'#94A3B8' }}>검색 결과 없음</div>}
                        </div>
                      );
                    })()}
                  </div>
                </div>
                )}
                <div style={{ gridColumn:'1 / -1' }}>
                  <label className="adm-label">원산지 <span style={{ fontWeight:400, color:'#94A3B8' }}>(국내산: 시·도 → 시·군·구 / 수입산: 국가)</span></label>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    <AdmSelect style={{ flex:'0 0 130px' }} value={pForm.origin || 'domestic'}
                      onChange={v => setPForm(f => ({ ...f, origin: v, origin_region: '' }))}
                      options={[{ value:'domestic', label:'국내산' }, { value:'import', label:'수입산' }]} />
                    {pForm.origin === 'import' ? (
                      <input className="adm-input-text" style={{ flex:1, minWidth:160 }} placeholder="국가명 (예: 미국, 칠레)"
                        value={pForm.origin_region || ''} onChange={e => setPForm(f => ({ ...f, origin_region: e.target.value }))} />
                    ) : (() => {
                      const parts = (pForm.origin_region || '').split(' ');
                      const sido = parts[0] || '';
                      const sigungu = parts[1] || '';
                      const detail = parts.slice(2).join(' ');
                      const sigunguList = SIGUNGU_MAP[sido] || [];
                      const setRegion = (s: string, sg: string, d: string) =>
                        setPForm(f => ({ ...f, origin_region: [s, sg, d].filter(Boolean).join(' ') }));
                      return (
                        <>
                          {/* 시·도 (바꾸면 시·군·구·세부 초기화) */}
                          <AdmSelect style={{ flex:'0 0 150px' }} value={sido}
                            onChange={v => setRegion(v, '', '')}
                            options={[{ value:'', label:'시·도 선택' }, ...SIDO_LIST.map(s => ({ value:s, label:s }))]} />
                          {/* 시·군·구 (시·도 선택 + 시군구 있는 경우만) */}
                          {sido && sigunguList.length > 0 && (
                            <AdmSelect style={{ flex:'0 0 150px' }} value={sigungu}
                              onChange={v => setRegion(sido, v, detail)}
                              options={[{ value:'', label:'시·군·구 선택' }, ...sigunguList.map(s => ({ value:s, label:s }))]} />
                          )}
                          {/* 세부 (읍·면·동, 선택 직접입력) */}
                          {sido && (
                            <input className="adm-input-text" style={{ flex:1, minWidth:120 }} placeholder="세부 (읍·면·동, 선택)"
                              value={detail} onChange={e => setRegion(sido, sigungu, e.target.value)} />
                          )}
                        </>
                      );
                    })()}
                  </div>
                  {pForm.origin_region && (
                    <div style={{ fontSize:12, color:'#475569', marginTop:6 }}>
                      표기: <strong>{pForm.origin === 'import' ? '수입산' : '국내산'} {pForm.origin_region}</strong>
                    </div>
                  )}
                </div>
              </div>
              </div>

              {/* ===== 섹션 2 · 가격 · 옵션 ===== */}
              <div className="adm-formsec">
                <div className="adm-formsec-title">가격 · 옵션</div>
                <div style={{ fontSize:13, fontWeight:700, color:'#475569', marginBottom:12 }}>판매금액 · 정산</div>
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {/* 정상가 */}
                  <div>
                    <label className="adm-label">정상가 (원) *</label>
                    <input className="adm-input-text" style={{ width:'100%' }} type="number" value={pForm.price || ''}
                      onChange={e => setPForm(f => ({ ...f, price: Number(e.target.value) }))} placeholder="0" />
                  </div>
                  {/* 할인 — 체크 시 펼쳐지는 영역 */}
                  <div>
                    <label style={{ display:'inline-flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13, fontWeight:600, color:'#334155' }}>
                      <input type="checkbox" checked={pDiscOn}
                        onChange={e => {
                          const on = e.target.checked;
                          setPDiscOn(on);
                          if (!on) { setPForm(f => ({ ...f, discount_rate: 0 })); setPDiscAmount(''); }
                        }} />
                      할인 판매하기
                    </label>
                    {pDiscOn && (
                      <div style={{ marginTop:10, padding:14, background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:10 }}>
                        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                          <span style={{ fontSize:13, color:'#64748B', flexShrink:0 }}>정상가에서</span>
                          {pDiscMode === 'rate' ? (
                            <input className="adm-input-text" style={{ flex:1, minWidth:120 }} type="number" min="0" max="99" value={pForm.discount_rate || ''}
                              onChange={e => setPForm(f => ({ ...f, discount_rate: Math.min(99, Math.max(0, Number(e.target.value))) }))} placeholder="할인율" />
                          ) : (
                            <input className="adm-input-text" style={{ flex:1, minWidth:120 }} type="number" min="0"
                              value={pDiscAmount}
                              onChange={e => setPDiscAmount(e.target.value.replace(/[^0-9]/g, ''))}
                              placeholder={pForm.price > 0 ? '할인액(원)' : '먼저 정상가를 입력하세요'} />
                          )}
                          <AdmSelect style={{ flex:'0 0 90px' }} value={pDiscMode}
                            onChange={v => {
                              const mode = v as 'rate'|'amount';
                              setPDiscMode(mode);
                              if (mode === 'amount') setPDiscAmount(pForm.price > 0 && pForm.discount_rate > 0 ? String(Math.round(pForm.price * pForm.discount_rate / 100)) : '');
                            }}
                            options={[{ value:'rate', label:'% 할인' }, { value:'amount', label:'원 할인' }]} />
                          <span style={{ fontSize:13, color:'#64748B', flexShrink:0 }}>할인</span>
                        </div>
                        {/* 할인가 실시간 */}
                        {(() => {
                          const rate = Number(pForm.discount_rate) || 0;
                          const sell = Math.round((pForm.price || 0) * (1 - rate / 100));
                          const off = (pForm.price || 0) - sell;
                          return (
                            <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid #E2E8F0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                              <span style={{ fontSize:13, fontWeight:700, color:'#334155' }}>할인가</span>
                              <span>
                                <b style={{ fontSize:18, color:'#2563EB' }}>{fmtPrice(sell)}</b>
                                <span style={{ fontSize:13, color:'#2563EB' }}>원</span>
                                <span style={{ fontSize:12, color:'#64748B', marginLeft:6 }}>({fmtPrice(off)}원 할인)</span>
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
                {/* 농가 공급가 (농가 정산 기준) */}
                <div style={{ marginTop:12 }}>
                  <label className="adm-label">농가 공급가 (원) <span style={{ fontWeight:400, color:'#94A3B8' }}>· 농가에게 줄 정산 단가</span></label>
                  <input className="adm-input-text" style={{ width:'100%' }} type="number" min="0" value={pForm.supply_price || ''}
                    onChange={e => setPForm(f => ({ ...f, supply_price: Number(e.target.value) }))} placeholder="0" />
                  {pForm.supply_price > 0 && pForm.price > 0 && (() => {
                    const sellPrice = Math.round(pForm.price * (1 - pForm.discount_rate / 100));
                    const margin = sellPrice - Number(pForm.supply_price);
                    return (
                      <div style={{ marginTop:6, fontSize:12, color:'#475569' }}>
                        마진(판매가−공급가): <strong style={{ color: margin >= 0 ? '#1A8A4C' : '#DC2626' }}>{margin.toLocaleString()}원</strong>
                      </div>
                    );
                  })()}
                </div>
                {/* 판매가 미리보기 (할인액으로 넣어도 소비자엔 % 자동 표기) */}
                {pForm.price > 0 && (
                  <div style={{ marginTop:10, fontSize:13, color:'#475569' }}>
                    판매가: <strong style={{ color:'#1A1A1A', fontSize:15 }}>
                      {Math.round(pForm.price * (1 - pForm.discount_rate / 100)).toLocaleString()}원
                    </strong>
                    {pForm.discount_rate > 0 && (
                      <span style={{ color:'#CB1D11', marginLeft:8 }}>
                        ({Math.round(pForm.discount_rate)}% · {Math.round(pForm.price * pForm.discount_rate / 100).toLocaleString()}원 할인)
                      </span>
                    )}
                  </div>
                )}
                {/* ── 판매 옵션 ── */}
                <div style={{ fontSize:13, fontWeight:700, color:'#475569', margin:'22px 0 12px', paddingTop:18, borderTop:'1px solid #EEF1F5' }}>판매 옵션 <span style={{ fontWeight:400, fontSize:11, color:'#94A3B8' }}>(없으면 단품)</span></div>
                <OptionTreeEditor key={editingProduct?.id || 'new'} options={pOptions} setOptions={setPOptions}
                  basePrice={Math.round((pForm.price || 0) * (1 - (Number(pForm.discount_rate) || 0) / 100))} />
              </div>

              {/* ===== 섹션 3 · 이미지 · 맛 프로파일 ===== */}
              <div className="adm-formsec">
              <div className="adm-formsec-title">이미지 · 맛 프로파일</div>
              <div style={{ fontSize:13, fontWeight:700, color:'#475569', marginBottom:12 }}>상품 이미지</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div style={{ gridColumn:'1 / -1' }}>
                  <label className="adm-label">상품 이미지 <span style={{ fontWeight:400, color:'#94A3B8' }}>(최대 6장 · 첫 번째 = 대표)</span></label>
                  {/* 숨김 파일 인풋 — 여러 장 동시 선택 */}
                  <input ref={pImgRef} type="file" accept="image/*" multiple style={{ display:'none' }}
                    onChange={async e => {
                      const files = Array.from(e.target.files || []);
                      e.target.value = '';
                      if (!files.length) return;
                      const urls: string[] = [];
                      for (const file of files) { const u = await uploadProductImage(file); if (u) urls.push(u); }
                      if (!urls.length) return;
                      setPImgList([...pImgList(), ...urls].slice(0, 6)); // 뒤에 추가(최대 6장)
                    }} />
                  {(() => {
                    const imgs = pImgList();
                    return (
                      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:6 }}>
                        {/* 카메라 버튼 (당근식 · 등록수/최대) */}
                        {imgs.length < 6 && (
                          <button type="button" onClick={() => pImgRef.current?.click()} disabled={pImgUploading}
                            style={{ width:88, height:88, flexShrink:0, borderRadius:8, border:'1px solid #E2E8F0', background:'#fff',
                              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:5,
                              cursor: pImgUploading ? 'wait' : 'pointer' }}>
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
                            </svg>
                            <span style={{ fontSize:13, fontWeight:700, color:'#64748B' }}>
                              <span style={{ color:'#F97316' }}>{imgs.length}</span>/6
                            </span>
                          </button>
                        )}
                        {/* 등록된 이미지 — 끌어서 순서 변경 */}
                        {imgs.map((imgUrl, i) => (
                          <div key={imgUrl + i}
                            draggable
                            onDragStart={() => { pImgDragIdx.current = i; }}
                            onDragOver={e => { if (pImgDragIdx.current !== null) e.preventDefault(); }}
                            onDrop={e => {
                              e.preventDefault();
                              const from = pImgDragIdx.current;
                              pImgDragIdx.current = null;
                              if (from !== null) reorderPImg(from, i);
                            }}
                            onDragEnd={() => { pImgDragIdx.current = null; }}
                            style={{ position:'relative', width:88, height:88, flexShrink:0, borderRadius:8,
                              border:'1px solid #E2E8F0', background:'#fff', overflow:'hidden', cursor:'grab' }}>
                            <img src={imgUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                            {i === 0 && (
                              <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'rgba(0,0,0,0.6)',
                                fontSize:10, fontWeight:700, color:'#fff', textAlign:'center', padding:'2px 0' }}>대표</div>
                            )}
                            <button type="button"
                              onClick={e => { e.stopPropagation(); const l = pImgList(); l.splice(i, 1); setPImgList(l); }}
                              style={{ position:'absolute', top:4, right:4, background:'rgba(255,255,255,0.92)',
                                border:'1px solid #E2E8F0', color:'#475569', borderRadius:'50%', width:20, height:20,
                                fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  <p style={{ fontSize:11, color:'#94A3B8', marginTop:6 }}>사진을 <b>끌어서 순서 변경</b> · 첫 번째(맨 왼쪽)가 대표 이미지 · 여러 장 한 번에 선택 가능</p>
                  {pImgUploading && <p style={{ fontSize:12, color:'#64748B', marginTop:6 }}>업로드 중...</p>}
                </div>
              </div>

              {/* ── 맛 프로파일 ── */}
              <div style={{ fontSize:13, fontWeight:700, color:'#475569', margin:'22px 0 12px', paddingTop:18, borderTop:'1px solid #EEF1F5' }}>맛 프로파일 <span style={{ fontWeight:400, color:'#94A3B8', fontSize:12 }}>(상세페이지 표시 · 미설정 시 카테고리 기본값)</span></div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {SELLER_AXES.map(axis => (
                  <div key={axis.key} style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                    <span style={{ width:66, flexShrink:0, fontSize:13, fontWeight:600 }}>{axis.icon} {axis.label}</span>
                    <div style={{ display:'flex', gap:5, flex:1, flexWrap:'wrap' }}>
                      {axis.levels.map((lv, i) => {
                        const level = i + 1;
                        const on = pForm.seller_score?.[axis.key] === level;
                        return (
                          <button key={level} type="button"
                            onClick={() => setPForm(f => {
                              const cur = { ...(f.seller_score || {}) } as Record<string, number>;
                              if (cur[axis.key] === level) delete cur[axis.key]; // 눌렀던 것 다시 누르면 해제
                              else cur[axis.key] = level;
                              return { ...f, seller_score: cur };
                            })}
                            style={{ padding:'6px 11px', borderRadius:8, cursor:'pointer', fontSize:12, fontFamily:'inherit',
                              border:`1px solid ${on ? '#1A1A1A' : '#E2E8F0'}`, background:'#fff',
                              color: on ? '#1A1A1A' : '#64748B', fontWeight: on ? 700 : 500 }}>
                            {lv}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <span style={{ fontSize:11, color:'#94A3B8' }}>신선도는 구매자 리뷰로만 집계되어 별도 설정이 없습니다.</span>
              </div>
              </div>

              {/* ===== 섹션 4 · 상세페이지 (등록 화면에서 바로 작성 · 신규는 상품 등록 시 함께 저장) ===== */}
              <div className="adm-formsec">
                <div className="adm-formsec-title">상세페이지</div>
                <div style={{ fontSize:12, color:'#94A3B8', marginBottom:10 }}>
                  {editingProduct ? '상세설명(이미지)·상세정보를 작성/수정합니다.' : '지금 작성해두면 아래 「상품 등록」을 누를 때 상품과 함께 저장됩니다.'}
                </div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                  <button type="button" className="adm-btn adm-btn-outline" style={{ color:'#2563EB', borderColor:'#BFDBFE' }}
                    disabled={pSaving} onClick={() => saveAndEditDetail('desc')}>🖼 상세설명 작성</button>
                  {!editingProduct && draftImages?.length ? <span style={{ fontSize:12, color:'#16A34A', fontWeight:600 }}>✓ 이미지 {draftImages.length}장 작성됨</span> : null}
                  <button type="button" className="adm-btn adm-btn-outline" style={{ color:'#7C3AED', borderColor:'#DDD6FE' }}
                    disabled={pSaving} onClick={() => saveAndEditDetail('info')}>📋 상세정보 작성</button>
                  {!editingProduct && draftInfo ? <span style={{ fontSize:12, color:'#16A34A', fontWeight:600 }}>✓ 상세정보 작성됨</span> : null}
                </div>
              </div>

              {/* ===== 섹션 5 · 배송 · 표시 ===== */}
              <div className="adm-formsec">
              <div className="adm-formsec-title">배송 · 표시</div>
              <div style={{ fontSize:13, fontWeight:700, color:'#475569', marginBottom:12 }}>배송</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label className="adm-label">출발 마감 시간</label>
                  {/* ''(비움) = 상위를 따라감: 브랜드에 값이 있으면 브랜드, 없으면 사이트 전체 설정 */}
                  {(() => {
                    /* 저장 시 자사배송(is_dawn=false)은 farm_id가 자사센터로 강제 교체됨(3001줄).
                       미리보기도 같은 규칙을 따라야 표시와 실제 저장값이 어긋나지 않음 */
                    const effFarmId = pForm.is_dawn ? pForm.farm_id : (farmList.find(fm => fm.is_own)?.id ?? pForm.farm_id);
                    const farmCut = farms.find(fm => fm.id === effFarmId)?.dispatch_cutoff || '';
                    const inherited = farmCut || siteSettings.dispatch_cutoff || '';
                    const farmNm = farms.find(fm => fm.id === effFarmId)?.name || '브랜드';
                    const src = farmCut ? `${farmNm} 설정` : '전체 설정';
                    return (
                      <>
                        <AdmSelect className="adm-cs-full" value={pForm.dispatch_cutoff || ''}
                          onChange={v => setPForm(f => ({ ...f, dispatch_cutoff: v }))}
                          options={[
                            { value:'', label: inherited ? `${src} 따름 (${cutoffLabel(inherited)})` : '상위 설정 따름' },
                            ...CUTOFF_TIMES.map(t => ({ value:t, label:cutoffLabel(t) })),
                          ]} />
                        <div style={{ fontSize:11.5, color:'#94A3B8', marginTop:5 }}>
                          {pForm.dispatch_cutoff
                            ? '이 상품만 따로 지정된 상태입니다. 상위 설정을 바꿔도 이 상품은 그대로 유지됩니다.'
                            : '비워두면 상위 설정을 따라갑니다.'}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* ── 표시 설정 ── */}
              <div style={{ fontSize:13, fontWeight:700, color:'#475569', margin:'22px 0 12px', paddingTop:18, borderTop:'1px solid #EEF1F5' }}>표시 설정 <span style={{ fontWeight:400, fontSize:11, color:'#94A3B8' }}>(뱃지 · 정렬 · 태그)</span></div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label className="adm-label">뱃지 <span style={{ fontWeight:400, color:'#94A3B8' }}>(텍스트 + 색상)</span></label>
                  <input className="adm-input-text" style={{ width:'100%' }} value={pForm.badge || ''}
                    onChange={e => setPForm(f => ({ ...f, badge: e.target.value }))} placeholder="예: 한정수량" />
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8, flexWrap:'wrap' }}>
                    <BadgeColorRow
                      value={pForm.badge_color || BADGE_DEFAULT_COLOR}
                      presets={BADGE_COLORS.map(c => c.value)}
                      onPick={v => setPForm(f => ({ ...f, badge_color: v }))} />
                    <span style={{ fontSize:11, color:'#94A3B8' }}>← 색칸 선택 후 🌈로 변경</span>
                    {pForm.badge && (
                      <span style={{ marginLeft:4, fontSize:11, fontWeight:700, color:'#fff',
                        background: pForm.badge_color || BADGE_DEFAULT_COLOR, padding:'3px 8px', borderRadius:6 }}>
                        {pForm.badge}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="adm-label">정렬 순서</label>
                  <input className="adm-input-text" style={{ width:'100%' }} type="number" value={pForm.sort_order || ''}
                    onChange={e => setPForm(f => ({ ...f, sort_order: Number(e.target.value) }))} placeholder="0" />
                </div>
              </div>

              {/* 태그 & 상태 — 선택 시 검정으로 채워지는 토글 칩 */}
              <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:14 }}>
                {([
                  ['is_new',  'NEW 태그',   '상품카드에 NEW 표시'],
                  ['is_best', '인기 태그',  'NEW와 함께 켜면 NEW가 우선 표시됨'],
                  ['is_active', '판매중',   '끄면 판매중지'],
                  ['show_stat_pill', '만족/재구매 필 표시', '상품카드에 만족도·재구매 필 노출'],
                ] as const).map(([key, label, hint]) => {
                  const on = !!pForm[key];
                  return (
                    <label key={key} title={hint}
                      style={{ display:'inline-flex', alignItems:'center', gap:7, cursor:'pointer', fontSize:13, fontWeight:600,
                        padding:'8px 14px', borderRadius:999, userSelect:'none', transition:'all .12s',
                        border:`1px solid ${on ? '#1A1A1A' : '#E2E8F0'}`,
                        background: on ? '#1A1A1A' : '#fff',
                        color: on ? '#fff' : '#64748B' }}>
                      <input type="checkbox" checked={on} style={{ display:'none' }}
                        onChange={e => setPForm(f => ({ ...f, [key]: e.target.checked }))} />
                      <span aria-hidden style={{ display:'inline-flex', alignItems:'center', justifyContent:'center',
                        width:15, height:15, borderRadius:4, flexShrink:0,
                        border:`1.5px solid ${on ? '#fff' : '#CBD5E1'}`, background:'transparent' }}>
                        {on && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </span>
                      {label}
                    </label>
                  );
                })}
              </div>
              </div>

              {/* ── 미리보기 (목록/홈에 보이는 상품 카드) ── */}
              <div className="adm-formsec">
                <div className="adm-formsec-title">미리보기</div>
                <div style={{ fontSize:12, color:'#94A3B8', marginBottom:14 }}>
                  입력한 내용이 실제 상품 목록에서 어떻게 보이는지 미리 확인할 수 있습니다.
                </div>
                <div style={{ display:'flex', gap:32, flexWrap:'wrap', alignItems:'flex-start',
                  background:'#F8FAFC', border:'1px solid #E5E9EF', borderRadius:12, padding:'24px 28px' }}>
                  {([
                    { m: 'pc'     as const, label:'PC' },
                    { m: 'mobile' as const, label:'모바일' },
                  ]).map(v => (
                    <div key={v.m} style={{ display:'flex', flexDirection:'column', gap:10, alignItems:'center' }}>
                      <span style={{ fontSize:12, fontWeight:700, color:'#64748B', display:'flex', alignItems:'center', gap:5 }}>
                        {v.m === 'pc'
                          ? <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
                          : <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/></svg>}
                        {v.label}
                      </span>
                      <div style={{ background:'#fff', padding: v.m === 'mobile' ? '14px 16px' : '16px 18px',
                        borderRadius:12, boxShadow:'0 1px 3px rgba(0,0,0,.08)' }}>
                        <ProductPreviewCard
                          mode={v.m}
                          name={pForm.name}
                          shortDesc={pForm.short_desc || ''}
                          price={Number(pForm.price) || 0}
                          discountRate={Number(pForm.discount_rate) || 0}
                          thumbnailUrl={(pForm.thumbnail_url || uploadedThumbnailRef.current || '').trim()}
                          category={pForm.category}
                          isDawn={Boolean(pForm.is_dawn)}
                          isNew={Boolean(pForm.is_new)}
                          isBest={Boolean(pForm.is_best)}
                          badge={pForm.badge?.trim() || ''}
                          badgeColor={pForm.badge_color || BADGE_DEFAULT_COLOR}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize:11, color:'#B0B0B0', marginTop:8 }}>
                  💡 모바일 카드는 실제 화면과 동일하게 NEW·인기·직접 뱃지가 표시되지 않습니다.
                </div>
              </div>

              <div className="adm-flex-gap adm-flex-end" style={{ marginTop:4 }}>
                <button className="adm-btn adm-btn-outline" onClick={closeProductForm}>취소</button>
                <button className="adm-btn adm-btn-primary" onClick={saveProduct} disabled={pSaving}>
                  {pSaving ? '저장 중...' : editingProduct ? '수정 완료' : '상품 등록'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== 이벤트 등록/수정 모달 ===== */}
      {eventModal && (
        <div className="adm-modal-bg open" onClick={() => setEventModal(false)}>
          <div className="adm-modal" style={{ maxWidth:600, width:'95vw', maxHeight:'92vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
            <div className="adm-modal-head">
              <span className="adm-modal-title">{editingEvent ? '이벤트 수정' : '이벤트 등록'}</span>
              <button className="adm-modal-close" onClick={() => setEventModal(false)}>✕</button>
            </div>
            <div className="adm-modal-body" style={{ display:'flex', flexDirection:'column', gap:16 }}>

              {/* 이벤트명 */}
              <div>
                <label className="adm-label">이벤트명 *</label>
                <input className="adm-input-text" style={{ width:'100%' }} value={evForm.title}
                  onChange={e => { const title = e.target.value; setEvForm(f => ({ ...f, title, slug: editingEvent ? f.slug : makeSlug(title) })); }}
                  placeholder="예: 여름 과일 페스티벌" />
                <div style={{ fontSize:11, color:'#94A3B8', marginTop:4 }}>URL: /event/<strong>{evForm.slug || '자동생성'}</strong></div>
              </div>

              {/* 부제목 / 배지 */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label className="adm-label">부제목</label>
                  <input className="adm-input-text" style={{ width:'100%' }} value={evForm.subtitle}
                    onChange={e => setEvForm(f => ({ ...f, subtitle: e.target.value }))} placeholder="선택 입력" />
                </div>
                <div>
                  <label className="adm-label">배지 <span style={{ fontWeight:400, color:'#94A3B8' }}>(텍스트 + 색상)</span></label>
                  <input className="adm-input-text" style={{ width:'100%' }} value={evForm.badge}
                    onChange={e => setEvForm(f => ({ ...f, badge: e.target.value }))} placeholder="예: HOT, NEW, 한정" />
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8, flexWrap:'wrap' }}>
                    <BadgeColorRow
                      value={evForm.badge_color || BADGE_DEFAULT_COLOR}
                      presets={BADGE_COLORS.map(c => c.value)}
                      onPick={v => setEvForm(f => ({ ...f, badge_color: v }))} />
                    {evForm.badge && (
                      <span style={{ fontSize:11, fontWeight:700, color:'#fff',
                        background: evForm.badge_color || BADGE_DEFAULT_COLOR, padding:'3px 8px', borderRadius:6 }}>
                        {evForm.badge}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 썸네일 이미지 */}
              <div>
                <label className="adm-label">썸네일 이미지 <span style={{ fontWeight:400, color:'#94A3B8' }}>(이벤트 카드에 표시)</span></label>
                <div style={{ fontSize:11, color:'#64748B', margin:'-2px 0 6px' }}>권장 <strong>1200 × 750px</strong> (가로:세로 = 1.6:1) · 최소 800×500 · 카드+상세 상단 공용, 상세에선 상하가 약간 잘리니 핵심은 중앙 · JPG/PNG</div>
                <input ref={evThumbRef} type="file" accept="image/*" style={{ display:'none' }}
                  onChange={async e => {
                    const file = e.target.files?.[0]; if (!file) return;
                    const url = await uploadEventImage(file, 'thumb');
                    if (url) setEvForm(f => ({ ...f, thumbnail_url: url }));
                    e.target.value = '';
                  }} />
                {evForm.thumbnail_url ? (
                  <div style={{ position:'relative', display:'inline-block' }}>
                    <img src={evForm.thumbnail_url} alt="" style={{ width:'100%', maxHeight:180, objectFit:'cover', borderRadius:8, border:'1px solid #E2E8F0' }} />
                    <button onClick={() => setEvForm(f => ({ ...f, thumbnail_url: '' }))}
                      style={{ position:'absolute', top:6, right:6, background:'rgba(0,0,0,0.5)', border:'none', borderRadius:'50%', color:'#fff', width:24, height:24, cursor:'pointer', fontSize:12 }}>✕</button>
                  </div>
                ) : (
                  <button className="adm-btn adm-btn-outline" style={{ width:'100%', height:80, fontSize:13 }}
                    onClick={() => evThumbRef.current?.click()} disabled={evThumbUploading}>
                    {evThumbUploading ? '업로드 중...' : '🖼 썸네일 이미지 업로드'}
                  </button>
                )}
              </div>

              {/* 본문 이미지 */}
              <div>
                <label className="adm-label">본문 이미지 <span style={{ fontWeight:400, color:'#94A3B8' }}>(이벤트 상세 페이지 상단)</span></label>
                <div style={{ fontSize:11, color:'#64748B', margin:'-2px 0 6px' }}>가로 <strong>1200px</strong> 권장 (상세 본문 폭 최대 780px) · 세로 자유(긴 이미지 가능) · JPG/PNG</div>
                <input ref={evImgRef} type="file" accept="image/*" style={{ display:'none' }}
                  onChange={async e => {
                    const file = e.target.files?.[0]; if (!file) return;
                    const url = await uploadEventImage(file, 'img');
                    if (url) setEvForm(f => ({ ...f, image_url: url }));
                    e.target.value = '';
                  }} />
                {evForm.image_url ? (
                  <div style={{ position:'relative' }}>
                    <img src={evForm.image_url} alt="" style={{ width:'100%', objectFit:'cover', borderRadius:8, border:'1px solid #E2E8F0' }} />
                    <button onClick={() => setEvForm(f => ({ ...f, image_url: '' }))}
                      style={{ position:'absolute', top:6, right:6, background:'rgba(0,0,0,0.5)', border:'none', borderRadius:'50%', color:'#fff', width:24, height:24, cursor:'pointer', fontSize:12 }}>✕</button>
                  </div>
                ) : (
                  <button className="adm-btn adm-btn-outline" style={{ width:'100%', height:80, fontSize:13 }}
                    onClick={() => evImgRef.current?.click()} disabled={evImgUploading}>
                    {evImgUploading ? '업로드 중...' : '🖼 본문 이미지 업로드'}
                  </button>
                )}
              </div>

              {/* 이벤트 내용 */}
              <div>
                <label className="adm-label">이벤트 내용 <span style={{ fontWeight:400, color:'#94A3B8' }}>(선택, 텍스트 또는 HTML)</span></label>
                <textarea className="adm-textarea" rows={5} style={{ width:'100%' }} value={evForm.content}
                  onChange={e => setEvForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="이벤트 내용을 입력하세요. HTML 태그 사용 가능합니다." />
              </div>

              {/* 기간 */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label className="adm-label">시작일시 {evForm.is_active ? <span style={{ fontWeight:400, color:'#94A3B8' }}>(선택)</span> : '*'}</label>
                  <input className="adm-input-text" style={{ width:'100%' }} type="datetime-local" value={evForm.starts_at}
                    onChange={e => setEvForm(f => ({ ...f, starts_at: e.target.value }))} />
                </div>
                <div>
                  <label className="adm-label">종료일시 {evForm.is_active ? <span style={{ fontWeight:400, color:'#94A3B8' }}>(선택)</span> : '*'}</label>
                  <input className="adm-input-text" style={{ width:'100%' }} type="datetime-local" value={evForm.ends_at}
                    onChange={e => setEvForm(f => ({ ...f, ends_at: e.target.value }))} />
                </div>
              </div>

              <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:13 }}>
                <input type="checkbox" checked={evForm.is_active}
                  onChange={e => setEvForm(f => ({ ...f, is_active: e.target.checked }))} />
                즉시 활성화
              </label>
              {evForm.is_active && (!evForm.starts_at || !evForm.ends_at) && (
                <div style={{ fontSize:11, color:'#16A34A', marginTop:-6 }}>
                  ✓ 날짜를 비워두면 <strong>지금부터{!evForm.ends_at ? ' 무기한' : ''}</strong> 즉시 노출됩니다. (원하면 위에서 기간 지정 가능)
                </div>
              )}

              <div className="adm-flex-gap adm-flex-end">
                <button className="adm-btn adm-btn-outline" onClick={() => setEventModal(false)}>취소</button>
                <button className="adm-btn adm-btn-primary" onClick={saveEvent} disabled={evSaving}>
                  {evSaving ? '저장 중...' : editingEvent ? '수정 완료' : '이벤트 등록'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== FAQ 등록/수정 모달 ===== */}
      {faqModal && (
        <div className="adm-modal-bg open" onClick={() => setFaqModal(false)}>
          <div className="adm-modal" style={{ maxWidth:580, width:'95vw', maxHeight:'90vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
            <div className="adm-modal-head">
              <span className="adm-modal-title">{editingFaq ? 'FAQ 수정' : 'FAQ 등록'}</span>
              <button className="adm-modal-close" onClick={() => setFaqModal(false)}>✕</button>
            </div>
            <div className="adm-modal-body" style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label className="adm-label">카테고리 *</label>
                  <AdmSelect className="adm-cs-full" value={faqForm.category}
                    onChange={v => setFaqForm(f => ({ ...f, category: v }))}
                    options={Object.entries(FAQ_CATS).map(([v, l]) => ({ value:v, label:l as string }))} />
                </div>
                <div>
                  <label className="adm-label">정렬 순서</label>
                  <input className="adm-input-text" style={{ width:'100%' }} type="number" value={faqForm.sort_order}
                    onChange={e => setFaqForm(f => ({ ...f, sort_order: Number(e.target.value) }))} />
                </div>
              </div>
              <div>
                <label className="adm-label">질문 *</label>
                <input className="adm-input-text" style={{ width:'100%' }} value={faqForm.question}
                  onChange={e => setFaqForm(f => ({ ...f, question: e.target.value }))}
                  placeholder="예: 배송은 얼마나 걸리나요?" />
              </div>
              <div>
                <label className="adm-label">답변 *</label>
                <textarea className="adm-textarea" rows={6} style={{ width:'100%' }} value={faqForm.answer}
                  onChange={e => setFaqForm(f => ({ ...f, answer: e.target.value }))}
                  placeholder="고객에게 보여질 답변을 입력하세요." />
              </div>
              <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:13 }}>
                <input type="checkbox" checked={faqForm.is_active}
                  onChange={e => setFaqForm(f => ({ ...f, is_active: e.target.checked }))} />
                노출 활성화
              </label>
              <div className="adm-flex-gap adm-flex-end" style={{ marginTop:4 }}>
                <button className="adm-btn adm-btn-outline" onClick={() => setFaqModal(false)}>취소</button>
                <button className="adm-btn adm-btn-primary" onClick={saveFaq} disabled={faqSaving}>
                  {faqSaving ? '저장 중...' : editingFaq ? '수정 완료' : 'FAQ 등록'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== 필탭 등록/수정 모달 ===== */}
      {ftModal && (
        <div className="adm-modal-bg open" onClick={() => setFtModal(false)}>
          <div className="adm-modal" style={{ maxWidth:540, width:'95vw', maxHeight:'90vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
            <div className="adm-modal-head">
              <span className="adm-modal-title">{editingFt ? '필탭 수정' : '필탭 추가'}</span>
            </div>
            <div className="adm-modal-body" style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label className="adm-label">유형 *</label>
                  <AdmSelect className="adm-cs-full" value={ftForm.tab_type}
                    onChange={v => setFtForm(f => ({ ...f, tab_type: v as TabType }))}
                    disabled={!!editingFt}
                    options={[
                      { value:'category', label:'카테고리 (상품 분류)' },
                      { value:'flag', label:'태그 (베스트/새벽배송/신상품)' },
                      { value:'sort', label:'정렬 (당도순/할인특가 등)' },
                      { value:'link', label:'링크 (페이지 이동)' },
                    ]} />
                  {editingFt && <p style={{ fontSize:11, color:'#94A3B8', margin:'4px 0 0' }}>* 유형은 수정 불가</p>}
                </div>
                <div>
                  <label className="adm-label">이름 *</label>
                  <input className="adm-input-text" style={{ width:'100%' }} value={ftForm.label}
                    onChange={e => setFtForm(f => ({ ...f, label: e.target.value }))} placeholder="예: 사과/배" />
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label className="adm-label">
                    {ftForm.tab_type === 'category' ? '카테고리 키 (영문) *'
                      : ftForm.tab_type === 'flag' ? '플래그 *'
                      : ftForm.tab_type === 'sort' ? '정렬 값 *'
                      : '이동 경로 *'}
                  </label>
                  {ftForm.tab_type === 'flag' ? (
                    <AdmSelect className="adm-cs-full" value={ftForm.tab_value}
                      onChange={v => setFtForm(f => ({ ...f, tab_value: v }))}
                      options={[
                        { value:'', label:'선택' },
                        { value:'is_best', label:'베스트 (is_best)' },
                        { value:'is_dawn', label:'새벽배송 (is_dawn)' },
                        { value:'is_new', label:'신상품 (is_new)' },
                      ]} />
                  ) : ftForm.tab_type === 'sort' ? (
                    <AdmSelect className="adm-cs-full" value={ftForm.tab_value}
                      onChange={v => setFtForm(f => ({ ...f, tab_value: v }))}
                      options={[
                        { value:'', label:'선택' },
                        { value:'brix', label:'당도순' },
                        { value:'best', label:'베스트순' },
                        { value:'price_asc', label:'낮은 가격순' },
                      ]} />
                  ) : (
                    <input className="adm-input-text" style={{ width:'100%' }} value={ftForm.tab_value}
                      onChange={e => setFtForm(f => ({ ...f, tab_value: e.target.value }))}
                      placeholder={ftForm.tab_type === 'category' ? '예: apple' : '예: /brand'} />
                  )}
                </div>
              </div>
              {ftForm.tab_type === 'category' && (
                <div>
                  <label className="adm-label">상위 대분류 <span style={{ fontWeight:400, color:'#94A3B8' }}>(없으면 이게 대분류)</span></label>
                  <AdmSelect className="adm-cs-full" value={ftForm.parent}
                    onChange={v => setFtForm(f => ({ ...f, parent: v }))}
                    options={[
                      { value:'', label:'— 대분류로 만들기 —' },
                      ...filterTabs.filter(t => t.tab_type === 'category' && !t.parent && t.tab_value !== ftForm.tab_value)
                        .map(t => ({ value: t.tab_value, label: `${t.label} 밑 소분류로` })),
                    ]} />
                </div>
              )}
              {ftForm.tab_type === 'category' && (
                <p style={{ fontSize:12, color:'#64748B', margin:0, background:'#F8FAFC', padding:'8px 10px', borderRadius:6 }}>
                  💡 카테고리 키는 상품의 <strong>category</strong> 값과 일치해야 합니다. <strong>대분류</strong>(예: 국산과일)는 키를 <code>domestic</code> 식으로, 그 밑 <strong>소분류</strong>(사과/배)는 상위 대분류를 지정하세요.
                </p>
              )}
              <div>
                <label className="adm-label">하단바 아이콘 배경색</label>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <input type="color" value={ftForm.bg} onChange={e => setFtForm(f => ({ ...f, bg: e.target.value }))}
                    style={{ width:44, height:34, border:'1px solid #E2E8F0', borderRadius:6, cursor:'pointer', padding:2 }} />
                  <input className="adm-input-text" style={{ flex:1 }} value={ftForm.bg}
                    onChange={e => setFtForm(f => ({ ...f, bg: e.target.value }))} placeholder="#F5F5F5" />
                </div>
              </div>
              <div>
                <label className="adm-label">노출 위치 (각각 켜고 끌 수 있음)</label>
                <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:4 }}>
                  <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13 }}>
                    <input type="checkbox" checked={ftForm.show_in_home}
                      onChange={e => setFtForm(f => ({ ...f, show_in_home: e.target.checked }))} />
                    메인 퀵 가이드
                  </label>
                  <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13 }}>
                    <input type="checkbox" checked={ftForm.show_in_category}
                      onChange={e => setFtForm(f => ({ ...f, show_in_category: e.target.checked }))} />
                    상품목록 상단
                  </label>
                  <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13 }}>
                    <input type="checkbox" checked={ftForm.show_in_shortcut}
                      onChange={e => setFtForm(f => ({ ...f, show_in_shortcut: e.target.checked }))} />
                    모바일 카테고리 탭
                  </label>
                </div>
              </div>
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13, borderTop:'1px solid #F1F5F9', paddingTop:12 }}>
                <input type="checkbox" checked={ftForm.is_active}
                  onChange={e => setFtForm(f => ({ ...f, is_active: e.target.checked }))} />
                <strong>전체 사용</strong> (끄면 모든 위치에서 숨김)
              </label>
              <div className="adm-flex-gap adm-flex-end" style={{ marginTop:4 }}>
                <button className="adm-btn adm-btn-outline" onClick={() => setFtModal(false)}>취소</button>
                <button className="adm-btn adm-btn-primary" onClick={saveFilterTab}>
                  {editingFt ? '수정 완료' : '추가'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== 1:1 문의 상세 모달 ===== */}
      {selectedCs && (
        <div className="adm-modal-bg open" onClick={() => { setSelectedCs(null); setCsAnswer(''); }}>
          <div className="adm-modal" style={{ maxWidth:600, width:'95vw', maxHeight:'90vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
            <div className="adm-modal-head">
              <span className="adm-modal-title">문의 상세</span>
              <button className="adm-modal-close" onClick={() => { setSelectedCs(null); setCsAnswer(''); }}>✕</button>
            </div>
            <div className="adm-modal-body" style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div className="adm-detail-group">
                  <div className="adm-detail-label">카테고리</div>
                  <div className="adm-detail-val">{CS_CAT_LABEL[selectedCs.category] || selectedCs.category}</div>
                </div>
                <div className="adm-detail-group">
                  <div className="adm-detail-label">접수일시</div>
                  <div className="adm-detail-val">{fmtDate(selectedCs.created_at)}</div>
                </div>
                <div className="adm-detail-group" style={{ gridColumn:'1 / -1' }}>
                  <div className="adm-detail-label">제목</div>
                  <div className="adm-detail-val">{selectedCs.title}</div>
                </div>
              </div>
              <div>
                <div className="adm-detail-label" style={{ marginBottom:6 }}>문의 내용</div>
                <div style={{ background:'#F8FAFC', borderRadius:8, padding:'14px 16px', fontSize:13, lineHeight:1.8, color:'#334155', whiteSpace:'pre-line' }}>
                  {selectedCs.message}
                </div>
              </div>
              {selectedCs.attachments && selectedCs.attachments.length > 0 && (
                <div>
                  <div className="adm-detail-label" style={{ marginBottom:6 }}>첨부파일</div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {selectedCs.attachments.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer"
                        style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'4px 10px',
                          background:'#EFF6FF', borderRadius:6, fontSize:12, color:'#2563EB', textDecoration:'none' }}>
                        📎 파일 {i + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {selectedCs.answer && (
                <div>
                  <div className="adm-detail-label" style={{ marginBottom:6 }}>기존 답변</div>
                  <div style={{ background:'#F0FDF4', borderRadius:8, padding:'14px 16px', fontSize:13, lineHeight:1.8, color:'#166534', whiteSpace:'pre-line', border:'1px solid #BBF7D0' }}>
                    {selectedCs.answer}
                  </div>
                </div>
              )}
              <div>
                <label className="adm-label">{selectedCs.answer ? '답변 수정' : '답변 작성'} *</label>
                <textarea className="adm-textarea" rows={5} style={{ width:'100%' }}
                  value={csAnswer || selectedCs.answer || ''}
                  onChange={e => setCsAnswer(e.target.value)}
                  placeholder="고객에게 전달할 답변을 입력하세요." />
              </div>
              <div className="adm-flex-gap adm-flex-end">
                <button className="adm-btn adm-btn-outline" onClick={() => { setSelectedCs(null); setCsAnswer(''); }}>닫기</button>
                <button className="adm-btn adm-btn-primary" onClick={answerCs} disabled={csAnswering}>
                  {csAnswering ? '저장 중...' : '답변 저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== 브랜드 등록/수정 (페이지형) ===== */}
      {/* 농가 상세 분석 모달 */}
      {farmDetailOpen && (
        <div className="adm-modal-bg open" onClick={() => setFarmDetailOpen(false)}>
          <div className="adm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth:880, width:'96vw', maxHeight:'92vh', overflowY:'auto' }}>
            <div className="adm-modal-head" style={{ position:'sticky', top:0, background:'#fff', zIndex:2 }}>
              <span className="adm-modal-title">{farmDetailTarget?.name} 분석</span>
              <button className="adm-modal-close" onClick={() => setFarmDetailOpen(false)}>✕</button>
            </div>
            <div className="adm-modal-body">
              {farmDetailLoading || !farmRaw ? <PanelLoading /> : (() => {
                /* 차트 기간 — 달력을 직접 지정했으면 그 값, 아니면 최근 N개월 */
                const today = new Date();
                const useCustom = !!(farmChartFrom && farmChartTo);
                const cFrom = useCustom ? new Date(farmChartFrom)
                  : new Date(today.getFullYear(), today.getMonth() - (farmChartMonths - 1), 1);
                const cTo = useCustom
                  ? new Date(new Date(farmChartTo).getFullYear(), new Date(farmChartTo).getMonth() + 1, 1)
                  : new Date(today.getFullYear(), today.getMonth() + 1, 1);
                const d = computeFarmStats(farmRaw.items, farmRaw.reviews, farmRaw.options, farmRaw.prodName, cFrom, cTo);
                const maxM = Math.max(...d.monthly.map(m => m.amount), 1);
                const hasSales = d.monthly.some(m => m.amount > 0);

                /* 요청 색: 매출=파랑 / 정산액=빨강 / 총이익=초록 / 누적=검정 */
                const topCards: { label: string; value: string; color: string; cur: number; prev: number; kind: DeltaKind; unit?: string }[] = [
                  { label:'총 매출액',   value:`${fmtPrice(d.cur.sales)}원`,  color:'#2563EB', cur:d.cur.sales,  prev:d.prev.sales,  kind:'money', unit:'원' },
                  { label:'농가 정산액', value:`${fmtPrice(d.cur.payout)}원`, color:'#DC2626', cur:d.cur.payout, prev:d.prev.payout, kind:'money', unit:'원' },
                  { label:'매출 총이익', value:`${fmtPrice(d.cur.margin)}원`, color:'#16A34A', cur:d.cur.margin, prev:d.prev.margin, kind:'money', unit:'원' },
                  { label:'누적 매출액', value:`${fmtPrice(d.cumulative)}원`, color:'#1A1A1A', cur:0, prev:0, kind:'flat' },
                ];
                const rateCards: { label: string; value: string; cur: number; prev: number; kind: DeltaKind }[] = [
                  { label:'재구매율',    value:`${d.cur.repurchase.toFixed(1)}%`, cur:d.cur.repurchase, prev:d.prev.repurchase, kind:'rate' },
                  { label:'반품·취소율', value:`${d.cur.cancelRate.toFixed(1)}%`, cur:d.cur.cancelRate, prev:d.prev.cancelRate, kind:'inverse' },
                  { label:'평균 평점',   value:d.cur.reviewCount ? d.cur.avgRating.toFixed(1) : '-', cur:d.cur.avgRating, prev:d.prev.avgRating, kind:'rating' },
                ];
                const countCards: { label: string; value: string; cur: number; prev: number; kind: DeltaKind; unit?: string }[] = [
                  { label:'주문 건수',   value:`${d.cur.orderCount.toLocaleString()}건`,  cur:d.cur.orderCount,  prev:d.prev.orderCount,  kind:'count', unit:'건' },
                  { label:'판매 수량',   value:`${d.cur.qty.toLocaleString()}개`,         cur:d.cur.qty,         prev:d.prev.qty,         kind:'count', unit:'개' },
                  { label:'평균 객단가', value:`${fmtPrice(d.cur.aov)}원`,                cur:d.cur.aov,         prev:d.prev.aov,         kind:'flat' },
                  { label:'리뷰 수',     value:`${d.cur.reviewCount.toLocaleString()}건`, cur:d.cur.reviewCount, prev:d.prev.reviewCount, kind:'count', unit:'건' },
                ];
                const cardBox: React.CSSProperties = { background:'#FAFAF8', border:'1px solid #F0F0EE', borderRadius:12, padding:'14px 16px', textAlign:'left' };
                const cardLabel: React.CSSProperties = { fontSize:11.5, color:'#1A1A1A', fontWeight:600 };

                return (
                  <>
                    {/* 1) 금액 지표 */}
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:10, marginBottom:12 }}>
                      {topCards.map(c => (
                        <div key={c.label} style={cardBox}>
                          <div style={cardLabel}>{c.label}</div>
                          <div style={{ fontSize:19, fontWeight:800, color:c.color, marginTop:5, letterSpacing:'-0.4px' }}>{c.value}</div>
                          {c.label === '누적 매출액'
                            ? <div style={{ fontSize:11, color:'#94A3B8', marginTop:3 }}>등록일~현재</div>
                            : <FaDelta cur={c.cur} prev={c.prev} kind={c.kind} unit={c.unit} />}
                        </div>
                      ))}
                    </div>

                    {/* 1-b) 공급가 미입력 경고 — 총이익이 부풀려지는 원인을 그 자리에서 알려줌 */}
                    {(d.missingNow.length > 0 || d.missingPast.length > 0) && (
                      <div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:12, padding:'12px 16px', marginBottom:12, textAlign:'left' }}>
                        <div style={{ fontSize:12.5, fontWeight:700, color:'#92400E' }}>
                          공급가(매입가)가 비어 있어 정산액·총이익이 실제와 다릅니다
                        </div>
                        <div style={{ fontSize:11.5, color:'#B45309', marginTop:3, lineHeight:1.6 }}>
                          공급가가 0이면 총이익이 매출 전액으로 잡혀 실제보다 크게 보입니다.
                        </div>
                        {d.missingNow.length > 0 && (
                          <div style={{ marginTop:9 }}>
                            <div style={{ fontSize:11.5, fontWeight:700, color:'#92400E' }}>
                              지금 채워야 할 옵션 {d.missingNow.length}개
                              <span style={{ fontWeight:400 }}> — 상품 수정 → 옵션의 매입가</span>
                            </div>
                            <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:5 }}>
                              {d.missingNow.slice(0, 12).map((m, i) => (
                                <span key={i} style={{ fontSize:11, background:'#fff', border:'1px solid #FDE68A', borderRadius:6, padding:'3px 8px', color:'#92400E' }}>
                                  {m.product} <span style={{ color:'#D97706' }}>· {m.option}</span>
                                </span>
                              ))}
                              {d.missingNow.length > 12 && (
                                <span style={{ fontSize:11, color:'#B45309', alignSelf:'center' }}>외 {d.missingNow.length - 12}개</span>
                              )}
                            </div>
                          </div>
                        )}
                        {d.missingPast.length > 0 && (
                          <div style={{ marginTop:9 }}>
                            <div style={{ fontSize:11.5, fontWeight:700, color:'#92400E' }}>
                              이미 팔린 주문 {fmtPrice(d.missingPastAmount)}원어치
                              <span style={{ fontWeight:400 }}> — 주문 시점 값이 저장되어 지금 채워도 소급되지 않습니다</span>
                            </div>
                            <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:5 }}>
                              {d.missingPast.slice(0, 8).map((m, i) => (
                                <span key={i} style={{ fontSize:11, background:'#fff', border:'1px solid #FDE68A', borderRadius:6, padding:'3px 8px', color:'#92400E' }}>
                                  {m.product} <span style={{ color:'#D97706' }}>· {m.option}</span> <b>{m.qty}개</b>
                                </span>
                              ))}
                              {d.missingPast.length > 8 && (
                                <span style={{ fontSize:11, color:'#B45309', alignSelf:'center' }}>외 {d.missingPast.length - 8}건</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 2) 월별 매출 추이 */}
                    <div style={{ ...cardBox, marginBottom:12 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:14 }}>
                        <span style={{ fontSize:13, fontWeight:800, color:'#1A1A1A' }}>월별 매출 추이</span>
                        <div style={{ display:'flex', gap:6, marginLeft:'auto' }}>
                          {[3, 6, 12].map(n => {
                            const on = !useCustom && farmChartMonths === n;
                            return (
                              <button key={n} type="button"
                                onClick={() => { setFarmChartMonths(n); setFarmChartFrom(''); setFarmChartTo(''); }}
                                style={{ fontSize:12, fontWeight:600, padding:'5px 12px', borderRadius:8, cursor:'pointer',
                                  border:`1px solid ${on ? '#1A1A1A' : '#E2E8F0'}`, background: on ? '#1A1A1A' : '#fff', color: on ? '#fff' : '#64748B' }}>
                                {n}개월
                              </button>
                            );
                          })}
                        </div>
                        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                          <input type="date" className="adm-input-text" style={{ fontSize:12, padding:'5px 8px' }}
                            value={farmChartFrom} onChange={e => setFarmChartFrom(e.target.value)} />
                          <span style={{ color:'#CBD5E1' }}>~</span>
                          <input type="date" className="adm-input-text" style={{ fontSize:12, padding:'5px 8px' }}
                            value={farmChartTo} onChange={e => setFarmChartTo(e.target.value)} />
                          {useCustom && (
                            <button type="button" onClick={() => { setFarmChartFrom(''); setFarmChartTo(''); }}
                              style={{ fontSize:11, color:'#94A3B8', background:'none', border:'none', cursor:'pointer' }}>초기화</button>
                          )}
                        </div>
                      </div>
                      {!hasSales ? (
                        <div className="adm-muted" style={{ fontSize:12, padding:'26px 0', textAlign:'center' }}>이 기간에 매출이 없습니다</div>
                      ) : (
                        <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:150 }}>
                          {d.monthly.map(m => {
                            const h = Math.max(3, m.amount / maxM * 108);
                            return (
                              <div key={m.ym} title={`${m.ym.replace('-', '년 ')}월 · ${fmtPrice(m.amount)}원`}
                                style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
                                <div style={{ fontSize:10.5, color:'#64748B', fontWeight:600, whiteSpace:'nowrap' }}>
                                  {m.amount > 0 ? `${Math.round(m.amount / 10000).toLocaleString()}만` : ''}
                                </div>
                                <div style={{ width:'100%', maxWidth:44, height:h, background: m.amount > 0 ? '#2563EB' : '#E2E8F0', borderRadius:'4px 4px 0 0' }} />
                                <div style={{ fontSize:10.5, color:'#94A3B8' }}>{Number(m.ym.slice(5))}월</div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* 3) 비율 지표 */}
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10, marginBottom:12 }}>
                      {rateCards.map(c => (
                        <div key={c.label} style={cardBox}>
                          <div style={cardLabel}>{c.label}</div>
                          <div style={{ fontSize:19, fontWeight:800, color:'#1A1A1A', marginTop:5 }}>
                            {c.label === '평균 평점' && c.value !== '-' && <span style={{ color:'#C8841C', marginRight:4 }}>★</span>}
                            {c.value}
                          </div>
                          <FaDelta cur={c.cur} prev={c.prev} kind={c.kind} />
                        </div>
                      ))}
                    </div>

                    {/* 4) 건수 지표 */}
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:10, marginBottom:12 }}>
                      {countCards.map(c => (
                        <div key={c.label} style={cardBox}>
                          <div style={cardLabel}>{c.label}</div>
                          <div style={{ fontSize:19, fontWeight:800, color:'#1A1A1A', marginTop:5 }}>{c.value}</div>
                          <FaDelta cur={c.cur} prev={c.prev} kind={c.kind} unit={c.unit} />
                        </div>
                      ))}
                    </div>

                    {/* 5) 인기 상품 TOP 5 */}
                    <div className="adm-card" style={{ marginBottom:12 }}>
                      <div className="adm-card-head"><span className="adm-card-title">인기 상품 TOP 5</span></div>
                      <table className="adm-table" style={{ marginTop:4 }}>
                        <thead><tr><th>상품명</th><th>옵션</th><th>주문 건수</th><th>매출액</th><th>마진액</th></tr></thead>
                        <tbody>
                          {d.topProducts.length === 0
                            ? <tr><td colSpan={5} style={{ textAlign:'center', color:'#94A3B8', padding:'20px 0' }}>판매 없음</td></tr>
                            : d.topProducts.map((r, i) => (
                              <tr key={r.name + r.option}>
                                <td><span style={{ fontWeight:800, color:'#CBD5E1', marginRight:6 }}>{i + 1}</span>{r.name}</td>
                                <td className="adm-muted">{r.option || '-'}</td>
                                <td className="adm-mono">{r.orders.toLocaleString()}건</td>
                                <td className="adm-mono" style={{ fontWeight:600 }}>{fmtPrice(r.amount)}원</td>
                                <td className="adm-mono" style={{ fontWeight:600, color: r.margin >= 0 ? '#16A34A' : '#DC2626' }}>
                                  {r.margin >= 0 ? '+' : '-'}{fmtPrice(Math.abs(r.margin))}원
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>

                    {/* 6) 최근 리뷰 */}
                    <div className="adm-card">
                      <div className="adm-card-head"><span className="adm-card-title">최근 리뷰</span></div>
                      <div style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:10 }}>
                        {d.recentReviews.length === 0 ? <div className="adm-muted" style={{ fontSize:12 }}>리뷰 없음</div>
                          : d.recentReviews.map(rv => (
                            <div key={rv.id} style={{ borderBottom:'1px solid #F1F5F9', paddingBottom:8, textAlign:'left' }}>
                              <div style={{ fontSize:11, color:'#C8841C', fontWeight:700 }}>
                                {'★'.repeat(rv.rating)}<span style={{ color:'#E2E8F0' }}>{'★'.repeat(5 - rv.rating)}</span>
                                <span style={{ color:'#94A3B8', fontWeight:400 }}> · {rv.product_name} · {fmtDateShort(rv.created_at)}</span>
                              </div>
                              <div style={{ fontSize:12.5, color:'#475569', marginTop:3, lineHeight:1.5, overflow:'hidden',
                                textOverflow:'ellipsis', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{rv.content}</div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {farmModal && panel === 'farms' && (
        <div className="adm-productpage">
          <div className="adm-productpage-inner">
            <div className="adm-modal-head" style={{ position:'sticky', top:0, background:'#fff', zIndex:2 }}>
              <span className="adm-modal-title">{editingFarm ? '브랜드 수정' : '브랜드 등록'}</span>
              <button className="adm-btn adm-btn-outline" style={{ height:32, padding:'0 12px', fontSize:13 }} onClick={() => setFarmModal(false)}>← 목록으로</button>
            </div>
            <div className="adm-modal-body">
              <div className="adm-detail-grid adm-farm-grid">
                <div className="adm-form-row">
                  <label className="adm-label">브랜드명 <span className="adm-required">*</span></label>
                  <input type="text" className="adm-input-text adm-input-full" placeholder="예: 서귀포 감귤농원"
                    value={farmForm.name} onChange={e => setFarmForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="adm-form-row">
                  <label className="adm-label">대표자명</label>
                  <input type="text" className="adm-input-text adm-input-full" placeholder="예: 홍길동"
                    value={farmForm.farmer_name} onChange={e => setFarmForm(p => ({ ...p, farmer_name: e.target.value }))} />
                </div>
                <div className="adm-form-row adm-form-row-full">
                  <label className="adm-label">지역/주소 <span style={{ fontWeight:400, color:'#94A3B8' }}>(시·도 → 시·군·구 → 상세주소)</span></label>
                  {/* 상품등록 원산지와 동일한 계층 입력. region 한 칸에 '시도 시군구 상세' 형태로 저장 */}
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', flex:1 }}>
                    {(() => {
                      const parts = (farmForm.region || '').split(' ');
                      const sido = SIDO_LIST.includes(parts[0]) ? parts[0] : '';
                      /* 시·도가 목록에 없으면(옛 자유입력 데이터) 전체를 상세주소로 넘겨서 값이 사라지지 않게 함 */
                      const sigungu = sido ? (parts[1] || '') : '';
                      const detail  = sido ? parts.slice(2).join(' ') : (farmForm.region || '');
                      const sigunguList = SIGUNGU_MAP[sido] || [];
                      const setRegion = (s: string, sg: string, d: string) =>
                        setFarmForm(p => ({ ...p, region: [s, sg, d].filter(Boolean).join(' ') }));
                      return (
                        <>
                          <AdmSelect style={{ flex:'0 0 160px' }} value={sido}
                            onChange={v => setRegion(v, '', detail)}
                            options={[{ value:'', label:'시·도 선택' }, ...SIDO_LIST.map(s => ({ value:s, label:s }))]} />
                          {sido && sigunguList.length > 0 && (
                            <AdmSelect style={{ flex:'0 0 160px' }} value={sigungu}
                              onChange={v => setRegion(sido, v, detail)}
                              options={[{ value:'', label:'시·군·구 선택' }, ...sigunguList.map(s => ({ value:s, label:s }))]} />
                          )}
                          <input className="adm-input-text" style={{ flex:1, minWidth:180 }} placeholder="상세주소 (읍·면·동, 도로명 등)"
                            value={detail} onChange={e => setRegion(sido, sigungu, e.target.value)} />
                        </>
                      );
                    })()}
                  </div>
                </div>
                <div className="adm-form-row">
                  <label className="adm-label">취급 품목 <span style={{ fontWeight:400, color:'#94A3B8' }}>(여러 개 선택 가능)</span></label>
                  <div style={{ display:'flex', gap:8, flex:1, flexWrap:'wrap', alignItems:'center' }}>
                    {/* 등록된 품목(소분류 카테고리) 칩 — 클릭해서 여러 개 켜고 끔 */}
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      {itemPresets.map(t => {
                        const on = farmForm.items.includes(t);
                        return (
                          <button key={t} type="button"
                            onClick={() => setFarmForm(p => ({ ...p, items: on ? p.items.filter(x => x !== t) : [...p.items, t] }))}
                            style={{ fontSize:12.5, fontWeight:600, padding:'7px 13px', borderRadius:999, cursor:'pointer',
                              border:`1px solid ${on ? '#1A1A1A' : '#E2E8F0'}`, background: on ? '#1A1A1A' : '#fff', color: on ? '#fff' : '#64748B' }}>
                            {t}
                          </button>
                        );
                      })}
                    </div>
                    {/* 목록에 없는 품목 직접 추가 */}
                    <input type="text" className="adm-input-text" style={{ flex:1, minWidth:150 }} placeholder="직접 추가 후 Enter"
                      onKeyDown={e => {
                        if (e.key !== 'Enter') return;
                        e.preventDefault();
                        const v = (e.target as HTMLInputElement).value.trim();
                        if (!v) return;
                        setFarmForm(p => p.items.includes(v) ? p : ({ ...p, items: [...p.items, v] }));
                        (e.target as HTMLInputElement).value = '';
                      }} />
                  </div>
                  {farmForm.items.length > 0 && (
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8, width:'100%' }}>
                      {farmForm.items.map(t => (
                        <span key={t} style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:12, background:'#F1F5F9', border:'1px solid #E2E8F0', borderRadius:999, padding:'5px 10px' }}>
                          {t}
                          <button type="button" onClick={() => setFarmForm(p => ({ ...p, items: p.items.filter(x => x !== t) }))}
                            style={{ background:'none', border:'none', cursor:'pointer', color:'#94A3B8', fontSize:14, lineHeight:1, padding:0 }}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="adm-form-row">
                  <label className="adm-label">담당 택배사</label>
                  <AdmSelect className="adm-cs-full" value={farmForm.carrier}
                    onChange={v => setFarmForm(p => ({ ...p, carrier: v }))}
                    options={['', 'CJ대한통운', '롯데택배', '한진택배', '우체국택배', '로젠택배'].map(c => ({ value:c, label:c || '택배사 선택' }))} />
                </div>
                <div className="adm-form-row">
                  <label className="adm-label">출고마감시간</label>
                  {/* 비워두면 사이트 전체 설정을 따라감. 값을 넣으면 이 브랜드 상품의 기본값이 됨 */}
                  <AdmSelect className="adm-cs-full" value={farmForm.dispatch_cutoff}
                    onChange={v => setFarmForm(p => ({ ...p, dispatch_cutoff: v }))}
                    options={[
                      { value:'', label: `전체 설정 적용${siteSettings.dispatch_cutoff ? ` (현재 ${cutoffLabel(siteSettings.dispatch_cutoff)})` : ''}` },
                      ...CUTOFF_TIMES.map(t => ({ value:t, label:cutoffLabel(t) })),
                    ]} />
                </div>
                <div className="adm-form-row adm-form-row-full">
                  <div style={{ fontSize:12, color:'#94A3B8', marginTop:-4 }}>
                    출고마감시간을 비워두면 사이트 전체 설정을 따라갑니다. 여기서 정하면 이 브랜드로 등록하는 상품의 기본값이 되고, 상품별로 다시 바꿀 수 있습니다.
                  </div>
                </div>
                <div className="adm-form-row">
                  <label className="adm-label">은행명</label>
                  <input type="text" className="adm-input-text adm-input-full" placeholder="예: 국민은행"
                    value={farmForm.bank_name} onChange={e => setFarmForm(p => ({ ...p, bank_name: e.target.value }))} />
                </div>
                <div className="adm-form-row">
                  <label className="adm-label">계좌번호 <span style={{ fontWeight:400, color:'#94A3B8' }}>(관리자만 열람)</span></label>
                  <input type="text" className="adm-input-text adm-input-full" placeholder="예: 123456-01-234567"
                    value={farmForm.bank_account} onChange={e => setFarmForm(p => ({ ...p, bank_account: e.target.value }))} />
                </div>
                <div className="adm-form-row adm-form-row-full">
                  <label className="adm-label">브랜드 소개</label>
                  <textarea className="adm-textarea" rows={8} style={{ width:'100%' }} placeholder="브랜드 소개 (상세 상단 좌측에 표시)"
                    value={farmForm.intro} onChange={e => setFarmForm(p => ({ ...p, intro: e.target.value }))} />
                </div>

                {/* 브랜드 썸네일 */}
                <div className="adm-form-row adm-form-row-full">
                  <label className="adm-label">브랜드 썸네일 <span style={{ fontWeight:400, color:'#94A3B8' }}>(상세 상단 우측 사진)</span></label>
                  <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                    {farmForm.thumbnail_url ? (
                      <div style={{ position:'relative', width:130, height:96 }}>
                        <img src={farmForm.thumbnail_url} alt="" style={{ width:130, height:96, objectFit:'cover', borderRadius:8, border:'1px solid #E2E8F0' }} />
                        <button type="button" onClick={() => setFarmForm(p => ({ ...p, thumbnail_url:'' }))} style={{ position:'absolute', top:-7, right:-7, width:22, height:22, borderRadius:'50%', background:'rgba(0,0,0,.6)', color:'#fff', border:'none', cursor:'pointer', fontSize:12, lineHeight:1 }}>✕</button>
                      </div>
                    ) : (
                      <label style={{ width:130, height:96, border:'1px dashed #CBD5E1', borderRadius:8, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#94A3B8', fontSize:12, gap:4 }}>
                        {farmImgUploading ? '업로드 중...' : '+ 썸네일'}
                        <input type="file" accept="image/*" hidden onChange={async e => { const f = e.target.files?.[0]; if (!f) return; setFarmImgUploading(true); const url = await uploadProductImage(f); setFarmImgUploading(false); if (url) setFarmForm(p => ({ ...p, thumbnail_url: url })); e.target.value=''; }} />
                      </label>
                    )}
                  </div>
                </div>

                {/* 브랜드 로고 (원형 — 메인 브랜드 직송관 카드 농가명 좌측 동그라미) */}
                <div className="adm-form-row adm-form-row-full">
                  <label className="adm-label">브랜드 로고 <span style={{ fontWeight:400, color:'#94A3B8' }}>(메인 브랜드 직송관 카드 · 동그라미 · 정사각 권장 400×400)</span></label>
                  <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                    {farmForm.logo_url ? (
                      <div style={{ position:'relative', width:80, height:80 }}>
                        <img src={farmForm.logo_url} alt="" style={{ width:80, height:80, objectFit:'cover', borderRadius:'50%', border:'1px solid #E2E8F0' }} />
                        <button type="button" onClick={() => setFarmForm(p => ({ ...p, logo_url:'' }))} style={{ position:'absolute', top:-7, right:-7, width:22, height:22, borderRadius:'50%', background:'rgba(0,0,0,.6)', color:'#fff', border:'none', cursor:'pointer', fontSize:12, lineHeight:1 }}>✕</button>
                      </div>
                    ) : (
                      <label style={{ width:80, height:80, border:'1px dashed #CBD5E1', borderRadius:'50%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#94A3B8', fontSize:11, gap:3, textAlign:'center' }}>
                        {farmImgUploading ? '업로드중' : '+ 로고'}
                        <input type="file" accept="image/*" hidden onChange={async e => { const f = e.target.files?.[0]; if (!f) return; setFarmImgUploading(true); const url = await uploadProductImage(f); setFarmImgUploading(false); if (url) setFarmForm(p => ({ ...p, logo_url: url })); e.target.value=''; }} />
                      </label>
                    )}
                  </div>
                </div>

                {/* 브랜드 소개 이미지 (여러 장) */}
                <div className="adm-form-row adm-form-row-full">
                  <label className="adm-label">브랜드 소개 이미지 <span style={{ fontWeight:400, color:'#94A3B8' }}>(상세 하단 · 위→아래 순서로 표시)</span></label>
                  <div style={{ display:'flex', flexDirection:'column', gap:8, flex:1 }}>
                    {farmForm.landing_images.map((url, i) => (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:11, color:'#94A3B8', width:18, textAlign:'right' }}>{i+1}</span>
                        <img src={url} alt="" style={{ width:90, height:54, objectFit:'cover', borderRadius:6, border:'1px solid #E2E8F0' }} />
                        <div style={{ display:'flex', gap:4 }}>
                          <button type="button" disabled={i===0} onClick={() => setFarmForm(p => { const a=[...p.landing_images]; [a[i-1],a[i]]=[a[i],a[i-1]]; return {...p, landing_images:a}; })} style={{ width:26, height:26, border:'1px solid #E2E8F0', borderRadius:5, background:'#fff', cursor: i===0?'default':'pointer', color: i===0?'#CBD5E1':'#64748B' }}>▲</button>
                          <button type="button" disabled={i===farmForm.landing_images.length-1} onClick={() => setFarmForm(p => { const a=[...p.landing_images]; [a[i+1],a[i]]=[a[i],a[i+1]]; return {...p, landing_images:a}; })} style={{ width:26, height:26, border:'1px solid #E2E8F0', borderRadius:5, background:'#fff', cursor:'pointer', color:'#64748B' }}>▼</button>
                        </div>
                        <button type="button" onClick={() => setFarmForm(p => ({ ...p, landing_images: p.landing_images.filter((_, j) => j !== i) }))} style={{ fontSize:11, color:'#DC2626', background:'#fff', border:'1px solid #FECACA', borderRadius:6, padding:'5px 9px', cursor:'pointer' }}>삭제</button>
                      </div>
                    ))}
                    <label style={{ alignSelf:'flex-start', fontSize:12, color:'#2563EB', background:'#fff', border:'1px dashed #BFDBFE', borderRadius:6, padding:'8px 12px', cursor:'pointer' }}>
                      {farmImgUploading ? '업로드 중...' : '+ 브랜드 소개 이미지 추가'}
                      <input type="file" accept="image/*" multiple hidden onChange={async e => { const files = Array.from(e.target.files || []); if (!files.length) return; setFarmImgUploading(true); for (const f of files) { const url = await uploadProductImage(f); if (url) setFarmForm(p => ({ ...p, landing_images: [...p.landing_images, url] })); } setFarmImgUploading(false); e.target.value=''; }} />
                    </label>
                  </div>
                </div>
              </div>

              {/* ===== 운영 메모 (등록된 브랜드만. 작성 즉시 저장되고 최신이 위로 쌓임) ===== */}
              {editingFarm ? (
                <div style={{ marginTop:24, paddingTop:20, borderTop:'1px solid #E2E8F0' }}>
                  <div style={{ fontSize:13, fontWeight:700, marginBottom:8, textAlign:'left' }}>운영 메모</div>
                  <textarea className="adm-textarea" rows={2} placeholder="상담·특이사항을 적어주세요. 등록하면 날짜·시간이 자동으로 기록됩니다."
                    value={farmMemo} onChange={e => setFarmMemo(e.target.value)} />
                  <button onClick={() => addFarmMemo(editingFarm.id)} disabled={farmMemoSaving || !farmMemo.trim()}
                    className="adm-btn adm-btn-outline" style={{ marginTop:8, height:32, padding:'0 14px', fontSize:13 }}>
                    {farmMemoSaving ? '저장 중...' : '+ 메모 추가'}
                  </button>
                  {farmMemos.length > 0 && (
                    <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:6 }}>
                      {farmMemos.map(fm => (
                        <div key={fm.id} style={{ background:'#F8FAFC', borderRadius:8, padding:'8px 12px', fontSize:13, textAlign:'left' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                            <span style={{ fontSize:11, color:'#94A3B8' }}>{fmtDate(fm.created_at)}{fm.admin_name ? ` · ${fm.admin_name}` : ''}</span>
                            <button onClick={() => deleteFarmMemo(fm.id)} style={{ background:'none', border:'none', color:'#DC2626', fontSize:11, cursor:'pointer' }}>삭제</button>
                          </div>
                          <div style={{ color:'#334155', whiteSpace:'pre-wrap', lineHeight:1.5 }}>{fm.content}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ marginTop:24, paddingTop:20, borderTop:'1px solid #E2E8F0', fontSize:12, color:'#94A3B8', textAlign:'left' }}>
                  운영 메모는 브랜드를 등록한 뒤 수정 화면에서 작성할 수 있습니다.
                </div>
              )}

              <div className="adm-flex-gap adm-flex-end adm-mt-20">
                <button className="adm-btn adm-btn-outline" onClick={() => setFarmModal(false)}>취소</button>
                <button className="adm-btn adm-btn-primary" onClick={saveFarm} disabled={farmSaving}>
                  {farmSaving ? '저장 중...' : editingFarm ? '수정 완료' : '브랜드 등록'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== 배송추적 모달 ===== */}
      {showTrackingModal && trackingInput.tracking_number && (
        <TrackingModal
          carrierId={trackingInput.courier || 'kr.cjlogistics'}
          trackingNumber={trackingInput.tracking_number}
          onClose={() => setShowTrackingModal(false)}
        />
      )}

      {/* ===== 주문 상세 모달 ===== */}
      {selectedOrder && (
        <div className="adm-modal-bg open" onClick={() => setSelectedOrder(null)}>
          <div className="adm-modal adm-modal-wide" onClick={e => e.stopPropagation()}>
            <div className="adm-modal-head">
              <span className="adm-modal-title">주문 상세 — {selectedOrder.order_no}</span>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <button className="adm-btn adm-btn-outline" style={{ height:32, padding:'0 14px', fontSize:13 }}
                  onClick={() => setSelectedOrder(null)}>취소</button>
                <button className="adm-btn adm-btn-primary" style={{ height:32, padding:'0 14px', fontSize:13 }}
                  disabled={updatingStatus === selectedOrder.id}
                  onClick={async () => {
                    if (detailStatus && detailStatus !== selectedOrder.status) {
                      await updateOrderStatus(selectedOrder.id, detailStatus);
                    }
                    setSelectedOrder(null);
                  }}>저장</button>
              </div>
            </div>
            {/* 상태 변경 바 (상단, 전체 폭) */}
            <div className="adm-statusbar">
              <div className="adm-statusbar-cur">
                <span className="adm-statusbar-caption">현재 상태</span>
                <span className={`adm-badge ${STATUS_BADGE_CLS[selectedOrder.status] || 'badge-wait'}`}>{STATUS_LABEL[selectedOrder.status] || selectedOrder.status}</span>
              </div>
              <div className="adm-statusbar-btns">
                {(['preparing','shipped','delivered'] as const).map(s => {
                  const on = detailStatus === s; const c = STATUS_BTN_COLOR[s];
                  return (
                    <button key={s} disabled={updatingStatus === selectedOrder.id}
                      onClick={() => setDetailStatus(s)}
                      style={{ height:32, padding:'0 13px', fontSize:13, fontWeight:700, borderRadius:8, cursor:'pointer',
                        border:`1px solid ${on ? c.border : '#E2E8F0'}`, background: on ? c.bg : '#fff', color: on ? c.color : '#64748B' }}>
                      {STATUS_LABEL[s]}
                    </button>
                  );
                })}
                <span className="adm-statusbar-sep" />
                {!(selectedOrder.tracking_number || (selectedOrder.order_items || []).some(i => i.tracking_number)) && (
                  <button disabled={updatingStatus === selectedOrder.id}
                    onClick={() => { if (confirm('이 주문을 취소(취소됨) 처리할까요?\n결제취소 + 쿠폰·포인트 복원이 진행됩니다.')) updateOrderStatus(selectedOrder.id, 'cancelled'); }}
                    style={{ height:32, padding:'0 13px', fontSize:13, fontWeight:700, borderRadius:8, cursor:'pointer', border:'1px solid #FCA5A5', background:'#fff', color:'#DC2626' }}>취소</button>
                )}
                <button disabled={updatingStatus === selectedOrder.id}
                  onClick={() => { if (confirm('이 주문을 환불(환불완료) 처리할까요?\n결제취소 + 쿠폰·포인트 복원이 진행됩니다.')) updateOrderStatus(selectedOrder.id, 'refunded'); }}
                  style={{ height:32, padding:'0 13px', fontSize:13, fontWeight:700, borderRadius:8, cursor:'pointer', border:'1px solid #FCA5A5', background:'#fff', color:'#DC2626' }}>환불</button>
              </div>
            </div>
            <div className="adm-modal-body">
              <div className="adm-detail-2col">
              <div className="adm-detail-col">
              {[
                { title:'고객 정보', rows: [
                  ['주문자', selectedOrder.recipient],
                  ['연락처', selectedOrder.phone],
                ] as [string, React.ReactNode][] },
                { title:'배송 정보', rows: [
                  ['배송지', `${selectedOrder.address1}${selectedOrder.address2 ? ' ' + selectedOrder.address2 : ''}`],
                  ['배송 요청사항', selectedOrder.delivery_memo || '-'],
                ] as [string, React.ReactNode][] },
                { title:'결제 정보', rows: [
                  ['결제금액', <>{fmtPrice(selectedOrder.final_amount)}원<PayBadge method={selectedOrder.payment_method} /></>],
                  ['주문일시', fmtDate(selectedOrder.created_at)],
                ] as [string, React.ReactNode][] },
              ].map(sec => (
                <div key={sec.title} className="adm-detail-card">
                  <div className="adm-detail-card-title">{sec.title}</div>
                  <div className="adm-detail-grid">
                    {sec.rows.map(([k, v]) => (
                      <div key={k} className="adm-detail-group">
                        <div className="adm-detail-label">{k}</div>
                        <div className="adm-detail-val">{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              </div>
              <div className="adm-detail-col">
              {/* 주문 상품 목록 */}
              {(selectedOrder.order_items?.length ?? 0) > 0 && (
                <div className="adm-detail-group">
                  <div className="adm-detail-label" style={{ marginBottom:10 }}>주문 상품</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {selectedOrder.order_items!.map((item, i) => (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:12,
                        padding:'10px 12px', background:'#F8F9FA', borderRadius:8 }}>
                        <div style={{ width:44, height:44, borderRadius:6, background:'#EBEBEB',
                          flexShrink:0, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          {item.thumbnail_url
                            ? <img src={item.thumbnail_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                            : <span style={{ fontSize:18 }}>🍑</span>}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:600, marginBottom:2 }}>{item.product_name}</div>
                          <div style={{ fontSize:12, color:'#64748B' }}>
                            {item.quantity}개 · {fmtPrice(item.unit_price)}원
                          </div>
                        </div>
                        <div style={{ fontSize:13, fontWeight:700, flexShrink:0 }}>
                          {fmtPrice(item.subtotal)}원
                        </div>
                      </div>
                    ))}
                    {(() => {
                      const coupon = selectedOrder.coupon_discount || 0;
                      const point = selectedOrder.point_used || 0;
                      const goods = selectedOrder.total_amount || ((selectedOrder.final_amount || 0) + coupon + point);
                      const hasDiscount = coupon > 0 || point > 0;
                      const rowS = { display:'flex', justifyContent:'flex-end', gap:8, fontSize:13 } as React.CSSProperties;
                      return (
                        <div style={{ borderTop:'1px solid #E2E8F0', marginTop:2, paddingTop:8, display:'flex', flexDirection:'column', gap:5 }}>
                          {hasDiscount && (
                            <>
                              <div style={rowS}><span style={{ color:'#64748B' }}>상품 금액</span><span style={{ minWidth:90, textAlign:'right' }}>{fmtPrice(goods)}원</span></div>
                              {coupon > 0 && <div style={rowS}><span style={{ color:'#64748B' }}>쿠폰 할인</span><span style={{ minWidth:90, textAlign:'right', color:'#DC2626' }}>-{fmtPrice(coupon)}원</span></div>}
                              {point > 0 && <div style={rowS}><span style={{ color:'#64748B' }}>포인트 사용</span><span style={{ minWidth:90, textAlign:'right', color:'#DC2626' }}>-{fmtPrice(point)}원</span></div>}
                            </>
                          )}
                          <div style={{ ...rowS, paddingTop: hasDiscount ? 5 : 0, borderTop: hasDiscount ? '1px dashed #E2E8F0' : 'none' }}>
                            <span style={{ color:'#64748B', fontWeight:700 }}>총 결제금액</span>
                            <span style={{ minWidth:90, textAlign:'right', fontSize:14, fontWeight:800 }}>{fmtPrice(selectedOrder.final_amount)}원</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
              {/* 배송 추적 정보 입력 — 농가(상품)별 송장 */}
              <div className="adm-detail-group adm-detail-mt16">
                <div className="adm-detail-label" style={{ marginBottom:8 }}>배송 추적 (농가별 송장)</div>
                {(() => {
                  const items = selectedOrder.order_items || [];
                  const farmIds = [...new Set(items.map(i => i.farm_id || '__none'))];
                  return farmIds.map(fid => {
                    const fItems = items.filter(i => (i.farm_id || '__none') === fid);
                    const first = fItems[0];
                    const carrier = first?.carrier || '';
                    const cur = farmTracking[fid] ?? { courier: first?.courier || carrier || '', tracking_number: first?.tracking_number || '' };
                    const shipped = fItems.every(i => !!i.tracking_number);
                    return (
                      <div key={fid} style={{ marginBottom:10, padding:'10px 12px', border:'1px solid #E2E8F0', borderRadius:8 }}>
                        <div style={{ fontSize:13, fontWeight:700, marginBottom:4 }}>
                          {first?.farm_name || '농가 미지정'}
                          {carrier && <span style={{ fontSize:11, color:'#94A3B8', fontWeight:500, marginLeft:6 }}>지정: {COURIER_NAMES[carrier] || carrier}</span>}
                          {shipped && <span style={{ fontSize:11, color:'#2D7A4D', fontWeight:700, marginLeft:6 }}>✓ 발송</span>}
                        </div>
                        <div style={{ fontSize:12, color:'#64748B', marginBottom:8 }}>{fItems.map(i => i.product_name).join(', ')}</div>
                        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                          <AdmSelect value={cur.courier} onChange={v => setFarmTracking(p => ({ ...p, [fid]: { ...cur, courier: v } }))} style={{ minWidth:140 }} options={COURIER_OPTIONS} />
                          <input placeholder="운송장번호" value={cur.tracking_number}
                            onChange={e => setFarmTracking(p => ({ ...p, [fid]: { ...cur, tracking_number: e.target.value } }))}
                            style={{ flex:1, minWidth:140, height:36, padding:'0 10px', border:'1.5px solid #E2E8F0', borderRadius:0, fontSize:13, fontFamily:'inherit', outline:'none' }} />
                          <button onClick={() => saveItemTracking(fItems.map(i => i.id).filter((id): id is string => !!id), cur.courier, cur.tracking_number)} disabled={savingTracking}
                            className="adm-btn adm-btn-primary" style={{ height:36, padding:'0 14px', fontSize:13 }}>
                            {savingTracking ? '저장 중...' : '저장'}
                          </button>
                          {first?.tracking_number && (
                            <button onClick={() => { setTrackingInput({ courier: first.courier || '', tracking_number: first.tracking_number || '' }); setShowTrackingModal(true); }}
                              className="adm-btn adm-btn-outline" style={{ height:36, padding:'0 14px', fontSize:13 }}>🚚 배송추적</button>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* 배송 지연 안내 발송 */}
              <div className="adm-detail-group adm-detail-mt16">
                <div className="adm-detail-label" style={{ marginBottom:8 }}>배송 지연 안내</div>
                {(() => {
                  const sentAt = selectedOrder.delay_notified_at;
                  const doSend = async () => {
                    if (!selectedOrder.phone) { alert('수령인 연락처가 없습니다.'); return; }
                    const reason = prompt('지연 사유를 입력하세요. (예: 산지 기상 악화로 출고 지연)');
                    if (!reason || !reason.trim()) return;
                    const eta = prompt('변경 예상 도착일을 입력하세요. (예: 6/15(일))');
                    if (!eta || !eta.trim()) return;
                    /* 배송 관련 → 수령인 + 주문자 양쪽 */
                    notifyOrderPhones([selectedOrder.phone, selectedOrder.orderer_phone], { type:'delivery_delayed', recipient: selectedOrder.recipient,
                      orderNo: selectedOrder.order_no, reason: reason.trim(), eta: eta.trim() });
                    const iso = new Date().toISOString();
                    await createClient().from('orders').update({ delay_notified_at: iso }).eq('id', selectedOrder.id);
                    setSelectedOrder(prev => prev ? { ...prev, delay_notified_at: iso } : prev);
                    setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, delay_notified_at: iso } : o));
                  };
                  return sentAt ? (
                    <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:320, padding:'10px 14px',
                      border:'1px solid #BBF7D0', background:'#F0FDF4', borderRadius:8 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      <span style={{ fontSize:13, fontWeight:700, color:'#15803D' }}>배송 지연 안내 발송 완료</span>
                      <span style={{ marginLeft:'auto', fontSize:12, color:'#64748B' }}>{fmtDate(sentAt)} 발송</span>
                      <button onClick={doSend} title="예상 도착일이 바뀌면 다시 발송"
                        style={{ display:'inline-flex', alignItems:'center', gap:4, height:26, padding:'0 9px', fontSize:12, fontWeight:600,
                          border:'1px solid #86EFAC', background:'#fff', color:'#15803D', borderRadius:6, cursor:'pointer' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                        다시 보내기
                      </button>
                    </div>
                  ) : (
                    <button
                      style={{ display:'inline-flex', alignItems:'center', gap:7, width:'fit-content', height:38, padding:'0 16px',
                        border:'1px solid #E2E8F0', background:'#fff', borderRadius:8, fontSize:13, fontWeight:600, color:'#334155', cursor:'pointer' }}
                      onClick={doSend}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                      고객에게 배송 지연 안내 발송
                    </button>
                  );
                })()}
              </div>

              {/* 고객 취소/환불 요청 (진행중일 때) — 여기서 바로 승인/거절 */}
              {(() => {
                const rq = pendingReqByOrder.get(selectedOrder.id);
                if (!rq) return null;
                const w = rq.type === 'cancel' ? '취소' : '환불';
                return (
                  <div className="adm-detail-group adm-detail-mt16" style={{ border:'1px solid #FECACA', background:'#FEF2F2', borderRadius:10, padding:'14px 16px' }}>
                    <div style={{ fontWeight:800, color:'#B91C1C', marginBottom:8 }}>🔔 고객 {w} 요청{rq.status === 'processing' ? ' (진행중)' : ''}</div>
                    <div style={{ fontSize:13, color:'#333', marginBottom:4 }}>사유: {rq.reason}{rq.detail ? ` — ${rq.detail}` : ''}</div>
                    <div style={{ fontSize:12, color:'#888', marginBottom:12 }}>신청일 {fmtDate(rq.created_at)}</div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      <button className="adm-btn adm-btn-primary" disabled={updatingStatus === selectedOrder.id}
                        onClick={async () => {
                          if (!confirm(`${w} 요청을 승인할까요?\n결제취소 + 쿠폰·포인트 복원이 진행됩니다.`)) return;
                          await updateRefundStatus(rq, 'completed');
                          await loadRefundRequests(); await loadOrders();
                          setSelectedOrder(null);
                        }}>승인 ({w} 처리)</button>
                      <button className="adm-btn adm-btn-outline" disabled={updatingStatus === selectedOrder.id}
                        onClick={async () => {
                          const reason = prompt('거절(반려) 사유를 입력하세요. (고객 마이페이지에 표시됩니다)');
                          if (reason === null) return;
                          await updateRefundStatus(rq, 'rejected', reason || '');
                          await loadRefundRequests();
                        }}>거절(반려)</button>
                      <button className="adm-btn adm-btn-outline" disabled={updatingStatus === selectedOrder.id}
                        onClick={async () => {
                          await updateRefundStatus(rq, 'hold');
                          await loadRefundRequests();
                        }}>보류</button>
                    </div>
                  </div>
                );
              })()}

              </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="adm-wrap">
        {/* ===== 사이드바 ===== */}
        <aside className={`adm-sidebar${sidebarOpen?' open':''}`}>
          <div className="adm-sidebar-logo">
            <img src="/DelioLogo.png" alt="Delio" style={{ height:26, objectFit:'contain', display:'block', filter:'brightness(0) invert(1)' }} />
            <div><div className="adm-logo-sub" style={{ marginTop:2 }}>Admin Console</div></div>
          </div>
          <nav className="adm-nav">
            <div className="adm-nav-group">
              <div className="adm-nav-label">운영</div>
              <NavItem panel="dashboard" icon={<Icon.Dashboard />} label="대시보드" />
              <NavItem panel="orders"   icon={<Icon.Orders />}   label="주문 관리" />
              <NavItem panel="products" icon={<Icon.Products />} label="상품 관리" />
              <NavItem panel="menu" icon={<Icon.Products />} label="메뉴 관리" />
              <NavItem panel="farms"    icon={<Icon.Farms />}    label="브랜드 관리" />
              <NavItem panel="reviews"  icon={<Icon.Reviews />}  label="리뷰 관리" />
            </div>
            <div className="adm-nav-group">
              <div className="adm-nav-label">마케팅</div>
              <NavItem panel="coupon" icon={<Icon.Coupon />} label="쿠폰 / 포인트" />
              <NavItem panel="banner" icon={<Icon.Banner />} label="배너 / 팝업" />
              <NavItem panel="events" icon={<Icon.Events />} label="이벤트" />
              <NavItem panel="lounge" icon={<Icon.Lounge />} label="라운지 관리" />
              <NavItem panel="homesections" icon={<Icon.Banner />} label="메인페이지 섹션관리" />
            </div>
            <div className="adm-nav-group">
              <div className="adm-nav-label">회원</div>
              <NavItem panel="members"  icon={<Icon.Members />}  label="회원 관리" />
              <NavItem panel="referral" icon={<Icon.Referral />} label="친구 추천" />
              <NavItem panel="sms"      icon={<Icon.SMS />}      label="SMS 발송" />
            </div>
            <div className="adm-nav-group">
              <div className="adm-nav-label">고객지원</div>
              <NavItem panel="inquiry" icon={<Icon.Inquiry />} label="입점 문의"
                badge={pendingInquiries.length || undefined} />
              <NavItem panel="faq" icon={<Icon.Faq />} label="FAQ 관리" />
              <NavItem panel="cs"  icon={<Icon.Cs />}  label="1:1 문의"
                badge={csPending.length || undefined} />
              <NavItem panel="productinquiry" icon={<Icon.Faq />} label="상품 문의"
                badge={productInquiries.filter(q => !q.answer).length || undefined} />
              <NavItem panel="refund" icon={<Icon.Settlement />} label="환불 관리"
                badge={refundReqs.filter(r => r.status === 'pending').length || undefined} />
            </div>
            <div className="adm-nav-group">
              <div className="adm-nav-label">정산·설정</div>
              <NavItem panel="settlement"   icon={<Icon.Settlement />} label="정산 관리" />
              <NavItem panel="farmsettle"   icon={<Icon.Settlement />} label="농가 정산" />
              <NavItem panel="tasteprofile" icon={<Icon.Taste />}      label="취향 프로파일" />
              <NavItem panel="analytics"    icon={<Icon.Settlement />} label="마케팅 분석" />
              <NavItem panel="settings"     icon={<Icon.Settings />}   label="설정" />
            </div>
          </nav>
          <div className="adm-sidebar-footer">
            <div className="adm-sidebar-user">
              <div className="adm-user-avatar">A</div>
              <div><div className="adm-user-name">관리자</div><div className="adm-user-role">Super Admin</div></div>
            </div>
            <Link href="/" target="_blank" rel="noopener noreferrer" className="adm-ext-btn" title="사이트 보기"><Icon.ExternalLink /></Link>
          </div>
        </aside>

        {/* ===== 메인 ===== */}
        <div className="adm-main">
          <header className="adm-topbar">
            <div className="adm-topbar-left">
              <button className="adm-hamburger" onClick={() => setSidebarOpen(v => !v)}><Icon.Menu /></button>
              <h1 className="adm-page-title">{TITLES[panel]}</h1>
            </div>
            <div className="adm-topbar-right">
              <span className="adm-topbar-date">{dateStr}</span>
            </div>
          </header>

          {/* 공통 처리항목 알림 바 (모든 페이지 동일 위치) */}
          <div className="adm-alertbar-wrap">
            <AdminAlertBar alerts={([
              stageCounts.paid > 0 && { icon:'🆕', label:'신규 주문', count: stageCounts.paid, onClick: () => { pendingOrderStatus.current='paid'; go('orders'); } },
              stageCounts.preparing > 0 && { icon:'📦', label:'금일 발송 대기', count: stageCounts.preparing, onClick: () => { pendingOrderStatus.current='preparing'; go('orders'); } },
              dashExtra.cancelReq > 0 && { icon:'↩️', label:'취소·환불 요청', count: dashExtra.cancelReq, onClick: () => { pendingRefundStatus.current='pending'; go('refund'); } },
              dashExtra.unansweredCs > 0 && { icon:'💬', label:'미답변 1:1 문의', count: dashExtra.unansweredCs, onClick: () => { setCsAdminTab('tab-pending'); go('cs'); } },
              dashExtra.unansweredProdInq > 0 && { icon:'❓', label:'미답변 상품문의', count: dashExtra.unansweredProdInq, onClick: () => go('productinquiry') },
              dashExtra.unansweredReview > 0 && { icon:'⭐', label:'미답변 리뷰', count: dashExtra.unansweredReview, onClick: () => { setReviewAnswered('unanswered'); go('reviews'); } },
            ].filter(Boolean)) as AdmAlert[]} />
          </div>

          {/* ===== 대시보드 ===== */}
          {panel === 'dashboard' && (
            <div className="adm-content">
              {/* 주문 처리 단계 플로우 (실시간) */}
              <div className="adm-card" style={{ marginBottom: 22 }}>
                <div className="adm-card-head">
                  <span className="adm-card-title">주문 처리 현황</span>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    {dashRefreshedAt && (
                      <span className="adm-muted" style={{ fontSize:12 }}>
                        최근 {String(dashRefreshedAt.getHours()).padStart(2,'0')}:{String(dashRefreshedAt.getMinutes()).padStart(2,'0')}
                      </span>
                    )}
                    <button className="adm-btn adm-btn-outline" onClick={() => { setStatsLoading(true); loadDashboard(); }}>
                      <span className="adm-btn-icon"><Icon.Refresh /></span>새로고침
                    </button>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', padding:'16px 8px 10px', flexWrap:'wrap' }}>
                  {ORDER_STAGES.map((st, i) => (
                    <div key={st.key} style={{ display:'flex', alignItems:'center', flex:1, minWidth:96 }}>
                      <div onClick={() => { pendingOrderStatus.current = st.key; go('orders'); }}
                        style={{ flex:1, cursor:'pointer', textAlign:'center', padding:'12px 6px', borderRadius:12, background:'#F8FAFC' }}>
                        <div style={{ fontSize:13, color:'#64748B', marginBottom:6 }}>{st.label}</div>
                        <div style={{ fontSize:26, fontWeight:800, color:'#1A1A1A', lineHeight:1 }}>
                          {stageCounts[st.key] ?? 0}
                          <span style={{ fontSize:13, fontWeight:600, color:'#94A3B8', marginLeft:2 }}>건</span>
                        </div>
                      </div>
                      {i < ORDER_STAGES.length - 1 && (
                        <div style={{ display:'flex', alignItems:'center', color:'#CBD5E1', padding:'0 2px' }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 취소·환불 / 미답변 / 판매지연 — 각 행 클릭 시 해당 파트로 필터 걸고 진입 */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:16, marginBottom:24 }}>
                <div className="adm-card">
                  <div className="adm-card-head"><span className="adm-card-title">취소 · 환불</span></div>
                  <div className="adm-pending-list">
                    <div className="adm-pending-row" onClick={() => { pendingRefundType.current = 'cancel'; pendingRefundStatus.current = 'pending'; go('refund'); }}><span>취소 요청</span><span className="adm-pending-num red">{dashExtra.pendingCancel}</span></div>
                    <div className="adm-pending-row" onClick={() => { pendingRefundType.current = 'refund'; pendingRefundStatus.current = 'pending'; go('refund'); }}><span>환불 요청</span><span className="adm-pending-num orange">{dashExtra.pendingRefund}</span></div>
                  </div>
                </div>
                <div className="adm-card">
                  <div className="adm-card-head"><span className="adm-card-title">미답변</span></div>
                  <div className="adm-pending-list">
                    <div className="adm-pending-row" onClick={() => { setCsAdminTab('tab-pending'); go('cs'); }}><span>미답변 1:1 문의</span><span className="adm-pending-num red">{dashExtra.unansweredCs}</span></div>
                    <div className="adm-pending-row" onClick={() => { setReviewAnswered('unanswered'); go('reviews'); }}><span>미답변 리뷰</span><span className="adm-pending-num orange">{dashExtra.unansweredReview}</span></div>
                  </div>
                </div>
                <div className="adm-card">
                  <div className="adm-card-head"><span className="adm-card-title">판매 지연</span></div>
                  <div className="adm-pending-list">
                    <div className="adm-pending-row" onClick={() => { pendingOrderStatus.current = 'preparing'; go('orders'); }}><span>발송 지연 <span className="adm-muted" style={{ fontSize:11 }}>(2일+)</span></span><span className="adm-pending-num red">{dashExtra.shipDelay}</span></div>
                    <div className="adm-pending-row" onClick={() => { pendingRefundStatus.current = 'pending'; go('refund'); }}><span>환불 지연 <span className="adm-muted" style={{ fontSize:11 }}>(2일+)</span></span><span className="adm-pending-num orange">{dashExtra.refundDelay}</span></div>
                  </div>
                </div>
              </div>

              {/* 판매 성과 (GA 방문 + 주문 지표) */}
              <div className="adm-card" style={{ marginBottom:24 }}>
                <div className="adm-card-head" style={{ alignItems:'center' }}>
                  <span className="adm-card-title">판매 성과</span>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginLeft:'auto' }}>
                    {/* 일별 / 주별 / 월간 */}
                    <div className="adm-perf-toggle">
                      {([['day','일별'],['week','주별'],['month','월간']] as const).map(([k,lb]) => (
                        <button key={k} className={`adm-perf-tab ${perfRange===k?'active':''}`} onClick={() => setPerfRange(k)}>{lb}</button>
                      ))}
                    </div>
                    {salesPerf && <span className="adm-muted" style={{ fontSize:12 }}>{salesPerf.label} 기준</span>}
                  </div>
                </div>
                <div className="adm-perf-grid">
                  {(() => {
                    const c = salesPerf?.cur, p = salesPerf?.prev;
                    const s = salesPerf?.series;
                    const ga = salesPerf?.gaConfigured;
                    const diff = (a:number, b:number) => b>0 ? ((a-b)/b*100) : (a>0?100:0);
                    const items = [
                      { label:'결제금액',      val: fmtPrice(c?.payment||0),                 unit:'원', d: diff(c?.payment||0,p?.payment||0), na:false, series:s?.payment||[], color:'#DB2777' },
                      { label:'상품주문단가',  val: fmtPrice(c?.aov||0),                     unit:'원', d: diff(c?.aov||0,p?.aov||0), na:false, series:s?.aov||[],     color:'#0891B2' },
                      { label:'상품 주문건수', val: (c?.orders||0).toLocaleString(),         unit:'건', d: diff(c?.orders||0,p?.orders||0), na:false, series:s?.orders||[],  color:'#2563EB' },
                      { label:'구매전환율',    val: ga ? (c?.conv||0).toFixed(1) : '—',     unit: ga?'%':'', d: ga?diff(c!.conv,p!.conv):0, na:!ga, series:s?.conv||[],    color:'#9333EA' },
                      { label:'방문 수',      val: ga ? (c?.visits||0).toLocaleString() : '—', unit: ga?'':'', d: ga?diff(c!.visits,p!.visits):0, na:!ga, series:s?.visits||[],  color:'#16A34A' },
                    ];
                    return items.map(it => (
                      <div key={it.label} className="adm-perf-item">
                        <div className="adm-perf-label">{it.label}</div>
                        <div className="adm-perf-value">{perfLoading ? '...' : it.val}{it.unit && <span className="adm-perf-unit">{it.unit}</span>}</div>
                        <div className="adm-perf-diff">
                          {it.na ? <span className="adm-muted">GA 연동 필요</span>
                            : <>전기 동기 대비 <span className={it.d>0?'up':it.d<0?'down':''}>{it.d>0?'+':''}{it.d.toFixed(1)}%</span></>}
                        </div>
                        <div className="adm-perf-spark">
                          {it.na ? <div className="adm-perf-spark-empty">GA 연동 시 표시</div> : <Spark data={it.series} color={it.color} />}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              <div className="adm-kpi-section-label">매출 · 주문</div>
              <div className="adm-kpi-grid adm-kpi-5">
                {statsLoading ? (
                  Array(5).fill(0).map((_, i) => (
                    <div key={i} className="adm-kpi-card">
                      <div className="adm-kpi-label">-</div>
                      <div className="adm-kpi-value" style={{ color:'#CBD5E1' }}>불러오는 중...</div>
                    </div>
                  ))
                ) : [
                  { label:'이번달 매출', val: stats ? `${fmtPrice(stats.monthRevenue)}원` : '-', kpiCls:'kpi-green', panel:'settlement',
                    icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg> },
                  { label:'금일 매출', val: stats ? `${fmtPrice(stats.todayRevenue)}원` : '-', kpiCls:'kpi-blue', panel:'settlement',
                    icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><rect x="2" y="7" width="20" height="14"/><path d="M16 7V5a2 2 0 00-4 0v2"/></svg> },
                  { label:'이번달 주문', val: stats ? `${stats.monthOrders.toLocaleString()}건` : '-', kpiCls:'kpi-blue', panel:'orders',
                    icon:<Icon.Orders /> },
                  { label:'금일 신규 주문', val: stats ? `${stats.todayOrders}건` : '-', kpiCls:'kpi-purple', panel:'orders',
                    icon:<Icon.Orders /> },
                  { label:'전체 회원수', val: stats ? `${stats.totalMembers.toLocaleString()}명` : '-', kpiCls:'kpi-green', panel:'members',
                    icon:<Icon.Members /> },
                ].map(k => (
                  <div key={k.label} className="adm-kpi-card" style={{ cursor: 'pointer' }}
                    onClick={() => go((k as {panel: PanelKey}).panel)}>
                    <div className="adm-kpi-header">
                      <span className="adm-kpi-label">{k.label}</span>
                      <span className={`adm-kpi-icon ${k.kpiCls}`}>{k.icon}</span>
                    </div>
                    <div className="adm-kpi-value">{k.val}</div>
                  </div>
                ))}
              </div>

              {/* 회원 현황 (전월 대비) */}
              <div className="adm-kpi-section-label" style={{ marginTop: 24 }}>회원 현황</div>
              <div className="adm-kpi-grid adm-kpi-5">
                {!memberDash ? (
                  Array(5).fill(0).map((_, i) => (
                    <div key={i} className="adm-kpi-card"><div className="adm-kpi-label">-</div><div className="adm-kpi-value" style={{ color:'#CBD5E1' }}>불러오는 중...</div></div>
                  ))
                ) : (() => {
                  const m = memberDash;
                  const col = (up:boolean, flat:boolean) => flat ? '#94A3B8' : up ? '#16A34A' : '#DC2626';
                  const pctTag = (cur:number, prev:number) => {
                    const d = prev > 0 ? (cur - prev) / prev * 100 : (cur > 0 ? 100 : 0);
                    const flat = Math.abs(d) < 0.05;
                    return <span style={{ color: col(d > 0, flat) }}>{d > 0 ? '▲' : d < 0 ? '▼' : '·'} {Math.abs(d).toFixed(1)}%</span>;
                  };
                  const ppTag = (cur:number, prev:number) => {
                    const d = cur - prev; const flat = Math.abs(d) < 0.05;
                    return <span style={{ color: col(d > 0, flat) }}>{d > 0 ? '▲' : d < 0 ? '▼' : '·'} {Math.abs(d).toFixed(1)}%p</span>;
                  };
                  const netTag = (() => { const n = m.netIncrease; return <span style={{ color: col(n > 0, n === 0) }}>{n > 0 ? '+' : ''}{n.toLocaleString()}명</span>; })();
                  const cards = [
                    { label:'전체 회원',      val:`${m.total.toLocaleString()}명`,     cls:'kpi-green',  icon:<Icon.Members />, sub:<>이번달 {netTag}</>,                       panel:'members' as PanelKey },
                    { label:'이번달 신규',     val:`${m.newThis.toLocaleString()}명`,   cls:'kpi-blue',   icon:<Icon.Members />, sub:<>전월 대비 {pctTag(m.newThis, m.newPrev)}</>, panel:'members' as PanelKey },
                    { label:'이번달 구매 회원', val:`${m.buyersThis.toLocaleString()}명`, cls:'kpi-purple', icon:<Icon.Orders />,  sub:<>전월 대비 {pctTag(m.buyersThis, m.buyersPrev)}</>, panel:'orders' as PanelKey },
                    { label:'재구매율',       val:`${m.repeatRateThis.toFixed(0)}%`,   cls:'kpi-green',  icon:<Icon.Members />, sub:<>전월 대비 {ppTag(m.repeatRateThis, m.repeatRatePrev)}</>, panel:'members' as PanelKey },
                    { label:'평균 구매 횟수',  val:`${m.avgOrdersThis.toFixed(1)}회`,    cls:'kpi-blue',   icon:<Icon.Orders />,  sub:<>전월 대비 {pctTag(m.avgOrdersThis, m.avgOrdersPrev)}</>, panel:'orders' as PanelKey },
                  ];
                  return cards.map(k => (
                    <div key={k.label} className="adm-kpi-card" style={{ cursor:'pointer' }} onClick={() => go(k.panel)}>
                      <div className="adm-kpi-header">
                        <span className="adm-kpi-label">{k.label}</span>
                        <span className={`adm-kpi-icon ${k.cls}`}>{k.icon}</span>
                      </div>
                      <div className="adm-kpi-value">{k.val}</div>
                      <div style={{ fontSize:12, marginTop:4, color:'#94A3B8' }}>{k.sub}</div>
                    </div>
                  ));
                })()}
              </div>

              <div className="adm-row" style={{ marginTop: 24 }}>
                <div className="adm-card adm-card-lg">
                  <div className="adm-card-head">
                    <span className="adm-card-title">매출 추이</span>
                    <div className="adm-btn-group">
                      {(['7','30'] as const).map(d => (
                        <button key={d} className={`adm-seg-btn${chartDays===d?' active':''}`} onClick={() => setChartDays(d)}>{d==='7'?'이번주':'이번달'}</button>
                      ))}
                    </div>
                  </div>
                  <div className="adm-chart-pad"><SalesChart days={chartDays} data={chartData[chartDays]} /></div>
                </div>

                <div className="adm-sidebar-cards">
                  <div className="adm-card">
                    <div className="adm-card-head"><span className="adm-card-title">처리 대기</span></div>
                    <div className="adm-pending-list">
                      {[
                        { label:'신규 주문', num: orders.filter(o=>o.status==='paid').length, cls:'red', panel:'orders' as PanelKey },
                        { label:'답변대기 문의', num: pendingInquiries.length, cls:'orange', panel:'inquiry' as PanelKey },
                      ].map(r => (
                        <div key={r.label} className="adm-pending-row" onClick={() => go(r.panel)}>
                          <span>{r.label}</span>
                          <span className={`adm-pending-num ${r.cls}`}>{r.num}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="adm-card">
                    <div className="adm-card-head"><span className="adm-card-title">최근 주문 현황</span></div>
                    <div className="adm-pending-list">
                      {orders.slice(0, 5).map(o => (
                        <div key={o.id} className="adm-pending-row" style={{ cursor:'pointer' }} onClick={() => { go('orders'); setSelectedOrder(o); setTrackingInput({ courier: o.courier || '', tracking_number: o.tracking_number || '' }); setFarmTracking({}); }}>
                          <span className="adm-muted" style={{ fontSize:12 }}>{o.recipient}</span>
                          <span className={`adm-badge ${STATUS_BADGE_CLS[o.status] || 'badge-wait'}`} style={{ fontSize:10 }}>
                            {STATUS_LABEL[o.status] || o.status}
                          </span>
                        </div>
                      ))}
                      {orders.length === 0 && <div className="adm-muted" style={{ padding:'12px 0', fontSize:13 }}>주문 없음</div>}
                    </div>
                  </div>
                </div>
              </div>

              {/* 상품별 판매 순위 TOP5 (이번주/이번달) */}
              <div className="adm-card" style={{ marginTop: 24 }}>
                <div className="adm-card-head">
                  <span className="adm-card-title">상품별 판매 순위 <span className="adm-muted" style={{ fontSize:11, fontWeight:400 }}>TOP 5 · 판매수량순</span></span>
                  <div className="adm-btn-group">
                    {(['7','30'] as const).map(d => (
                      <button key={d} className={`adm-seg-btn${rankDays===d?' active':''}`} onClick={() => setRankDays(d)}>{d==='7'?'이번주':'이번달'}</button>
                    ))}
                  </div>
                </div>
                <div className="adm-table-wrap">
                  <table className="adm-table">
                    <thead><tr><th style={{ width:44, textAlign:'center' }}>순위</th><th>상품명</th><th>옵션</th><th className="adm-num">단가</th><th className="adm-num">판매수량</th></tr></thead>
                    <tbody>
                      {productRank[rankDays].length === 0 ? (
                        <tr><td colSpan={5} style={{ textAlign:'center', padding:'32px 0', color:'#94A3B8' }}>해당 기간 판매 내역이 없습니다.</td></tr>
                      ) : productRank[rankDays].map((r, i) => (
                        <tr key={i}>
                          <td style={{ textAlign:'center', fontWeight:700, color:'#94A3B8' }}>{i+1}</td>
                          <td>{r.name}</td>
                          <td className="adm-muted">{r.option}</td>
                          <td className="adm-num">{fmtPrice(r.unit_price)}원</td>
                          <td className="adm-num" style={{ fontWeight:600 }}>{r.qty.toLocaleString()}개</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ===== 주문 관리 ===== */}
          {panel === 'orders' && (
            <div className="adm-content">
              {/* 주문 처리 단계 바 — 클릭 시 해당 상태로 필터 */}
              <div className="adm-card" style={{ marginBottom: 16 }}>
                <div style={{ display:'flex', alignItems:'center', padding:'14px 8px 8px', flexWrap:'wrap' }}>
                  {ORDER_STAGES.map((st, i) => {
                    const active = orderStatusFilter === st.key;
                    return (
                      <div key={st.key} style={{ display:'flex', alignItems:'center', flex:1, minWidth:96 }}>
                        <div onClick={() => setOrderStatusFilter(active ? '' : st.key)}
                          style={{ flex:1, cursor:'pointer', textAlign:'center', padding:'10px 6px', borderRadius:12,
                            background: active ? '#1A1A1A' : '#F8FAFC', transition:'background .15s' }}>
                          <div style={{ fontSize:12, color: active ? '#fff' : '#64748B', marginBottom:5 }}>{st.label}</div>
                          <div style={{ fontSize:22, fontWeight:800, color: active ? '#fff' : '#1A1A1A', lineHeight:1 }}>
                            {stageCounts[st.key] ?? 0}
                            <span style={{ fontSize:12, fontWeight:600, color: active ? '#CBD5E1' : '#94A3B8', marginLeft:2 }}>건</span>
                          </div>
                        </div>
                        {i < ORDER_STAGES.length - 1 && (
                          <div style={{ display:'flex', alignItems:'center', color:'#CBD5E1', padding:'0 2px' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* 조회 기준 · 기간 · 페이지당 개수 */}
              <div className="adm-toolbar" style={{ flexWrap:'wrap', gap:8 }}>
                <div className="adm-toolbar-left" style={{ flexWrap:'wrap', gap:8, alignItems:'center' }}>
                  <AdmSelect value={orderDateBasis} onChange={v => setOrderDateBasis(v as 'paid_at'|'delivered_at')}
                    options={[{ value:'paid_at', label:'결제일' }, { value:'delivered_at', label:'배송완료일' }]} />
                  <div className="adm-btn-group">
                    {([['오늘',0],['1주',7],['1개월',30],['3개월',90]] as const).map(([label, days]) => (
                      <button key={label} className="adm-seg-btn" onClick={() => {
                        const t = new Date(); const f = new Date(); if (days) f.setDate(f.getDate() - days);
                        const fromS = ymd(f), toS = ymd(t);
                        setOrderFrom(fromS); setOrderTo(toS); loadOrders({ from: fromS, to: toS });
                      }}>{label}</button>
                    ))}
                  </div>
                  <input type="date" className="adm-select" value={orderFrom} onChange={e => setOrderFrom(e.target.value)} />
                  <span style={{ color:'#94A3B8' }}>~</span>
                  <input type="date" className="adm-select" value={orderTo} onChange={e => setOrderTo(e.target.value)} />
                  <button className="adm-btn adm-btn-primary" onClick={() => loadOrders()}>검색</button>
                </div>
                <div className="adm-toolbar-right">
                  <AdmSelect value={String(orderPageSize)} onChange={v => { setOrderPageSize(Number(v)); setOrderPage(1); }}
                    options={[50,100,200].map(n => ({ value:String(n), label:`${n}개씩` }))} />
                </div>
              </div>
              <div className="adm-toolbar">
                <div className="adm-toolbar-left">
                  <AdmSelect value={orderStatusFilter} onChange={v => { setOrderStatusFilter(v); setOrderPage(1); }}
                    options={[{ value:'', label:'전체' }, ...Object.entries(STATUS_LABEL).map(([v, l]) => ({ value:v, label:l as string }))]} />
                  <AdmSelect value={orderFarmFilter} onChange={v => { setOrderFarmFilter(v); setOrderPage(1); }}
                    options={[{ value:'', label:'전체 브랜드' }, ...farms.map(f => ({ value:f.id, label:f.name }))]} />
                  <input type="text" className="adm-input-text" placeholder="주문번호 · 수령인 · 연락처 검색"
                    value={orderSearch} onChange={e => { setOrderSearch(e.target.value); setOrderPage(1); }} />
                  <button
                    className={`adm-seg-btn${orderReqOnly ? ' active' : ''}`}
                    style={{ borderColor: pendingReqByOrder.size > 0 ? '#DC2626' : undefined, color: !orderReqOnly && pendingReqByOrder.size > 0 ? '#DC2626' : undefined, fontWeight:700 }}
                    onClick={() => { setOrderReqOnly(v => !v); setOrderPage(1); }}>
                    🔔 취소·환불 요청{pendingReqByOrder.size > 0 ? ` ${pendingReqByOrder.size}` : ''}
                  </button>
                </div>
                <div className="adm-toolbar-right">
                  <button className="adm-btn adm-btn-outline" onClick={() => downloadOrderExcel(orderFarmFilter || undefined, 'ship')} title="고객·배송 정보 (공급가 제외)">
                    <span className="adm-btn-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </span>
                    주문서(배송용)
                  </button>
                  <button className="adm-btn adm-btn-outline" onClick={() => downloadOrderExcel(orderFarmFilter || undefined, 'purchase')} title="상품·수량·공급가 (고객 개인정보 제외)">
                    <span className="adm-btn-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </span>
                    발주서(매입용)
                  </button>
                  <button className="adm-btn adm-btn-outline" onClick={() => {
                      const delio = farms.find(f => f.name === '델리오' || f.name.includes('델리오'));
                      if (!delio) { alert('델리오(자사) 브랜드를 찾을 수 없습니다.'); return; }
                      downloadCJExcel(delio.id);
                    }} title="델리오(자사) 상품만 CJ대한통운 대량접수 업로드용 양식">
                    <span className="adm-btn-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </span>
                    자사상품(CJ) 엑셀
                  </button>
                  <button className="adm-btn adm-btn-outline" onClick={() => loadOrders()}><span className="adm-btn-icon"><Icon.Refresh /></span>새로고침</button>
                </div>
              </div>
              {(() => { const hasSel = selOrders.size > 0; return (
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', marginBottom:12, background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:10, flexWrap:'wrap' }}>
                  <span style={{ fontSize:14, fontWeight:800, color: hasSel ? '#1D4ED8' : '#94A3B8', marginRight:2 }}>{hasSel ? `${selOrders.size}건 선택` : '주문 선택'}</span>
                  <button className="adm-btn adm-btn-primary" style={{ height:34 }} disabled={!hasSel} onClick={bulkSetPreparing}>발주확인</button>
                  <button className="adm-btn adm-btn-outline" style={{ height:34 }} disabled={!hasSel} onClick={bulkSetShipped}>발송처리</button>
                  <button className="adm-btn adm-btn-outline" style={{ height:34 }} onClick={() => bulkShipFileRef.current?.click()}>엑셀 일괄 발송처리</button>
                  <button className="adm-btn adm-btn-outline" style={{ height:34 }} disabled={!hasSel} onClick={bulkDelayNotice}>발송지연 처리</button>
                  <button className="adm-btn adm-btn-outline" style={{ height:34, color: hasSel ? '#DC2626' : undefined, borderColor: hasSel ? '#FECACA' : undefined }} disabled={!hasSel} onClick={bulkCancel}>판매자 직접취소</button>
                  {hasSel && <button className="adm-btn adm-btn-outline" style={{ height:34, marginLeft:'auto' }} onClick={() => setSelOrders(new Set())}>선택 해제</button>}
                  <input ref={bulkShipFileRef} type="file" accept=".xlsx,.xls" style={{ display:'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) bulkExcelShip(f); e.target.value = ''; }} />
                </div>
              ); })()}
              <div className="adm-card">
                {ordersLoading ? <PanelLoading /> : (
                  <div className="adm-table-wrap">
                    <table className="adm-table adm-table-center">
                      <thead>
                        <tr>
                          <th style={{ width:34 }}>
                            <input type="checkbox" aria-label="전체 선택"
                              checked={pagedOrders.length > 0 && pagedOrders.every(o => selOrders.has(o.id))}
                              onChange={e => setSelOrders(prev => { const next = new Set(prev); if (e.target.checked) pagedOrders.forEach(o => next.add(o.id)); else pagedOrders.forEach(o => next.delete(o.id)); return next; })} />
                          </th>
                          <th>주문번호</th><th>주문일시</th><th>수령인</th><th>상품</th>
                          <th>금액</th><th>상태</th><th>송장번호</th><th>관리</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOrders.length === 0 ? (
                          <tr><td colSpan={9} style={{ textAlign:'center', padding:'40px 0', color:'#94A3B8' }}>
                            {orders.length === 0 ? '주문 데이터 없음 (create_admin_policies.sql 실행 필요)' : '검색 결과 없음'}
                          </td></tr>
                        ) : pagedOrders.map(o => (
                          <tr key={o.id}>
                            <td onClick={e => e.stopPropagation()}>
                              <input type="checkbox" checked={selOrders.has(o.id)}
                                onChange={e => setSelOrders(prev => { const next = new Set(prev); if (e.target.checked) next.add(o.id); else next.delete(o.id); return next; })} />
                            </td>
                            <td title={o.order_no}>#{(o.order_no || '').split('-').pop()}</td>
                            <td className="adm-muted">{fmtDate(o.created_at)}</td>
                            <td>{o.recipient}</td>
                            <td>
                              {(() => {
                                const items = o.order_items || [];
                                if (items.length === 0) return <span className="adm-muted">-</span>;
                                const first = items[0];
                                const opt = first.option_label || '';
                                let name = first.product_name || '상품';
                                if (opt && name.endsWith(`(${opt})`)) name = name.slice(0, -(`(${opt})`.length)).trim();
                                return (
                                  <div style={{ lineHeight:1.35 }}>
                                    <div style={{ fontWeight:600 }}>{name}{items.length > 1 ? ` 외 ${items.length - 1}건` : ''}</div>
                                    {opt && <div className="adm-muted" style={{ fontSize:12 }}>{opt}</div>}
                                  </div>
                                );
                              })()}
                            </td>
                            <td>{fmtPrice(o.final_amount)}원</td>
                            <td>
                              <span className={`adm-badge ${STATUS_BADGE_CLS[o.status] || 'badge-wait'}`}>
                                {STATUS_LABEL[o.status] || o.status}
                              </span>
                              {(() => {
                                const rq = pendingReqByOrder.get(o.id);
                                if (!rq) return null;
                                return (
                                  <span style={{ marginLeft:6, fontSize:10, fontWeight:800, color:'#fff', background:'#DC2626', borderRadius:5, padding:'2px 6px', whiteSpace:'nowrap' }}>
                                    {rq.type === 'cancel' ? '취소요청' : '환불요청'}
                                  </span>
                                );
                              })()}
                            </td>
                            <td onClick={e => e.stopPropagation()}>
                              {(() => {
                                const st = o.status;
                                if (['cancelled','refunded','refunding','exchanging','exchanged'].includes(st)) return <span className="adm-muted">—</span>;
                                const editable = st === 'paid' || st === 'preparing' || st === 'shipped';
                                const editing = trackEditRow === o.id;
                                const saving = trackSaving === o.id;
                                if (editing || (editable && !o.tracking_number)) {
                                  const startEdit = () => { if (trackEditRow !== o.id) { setTrackEditRow(o.id); setTrackEditVal(o.tracking_number || ''); setTrackEditCourier(o.courier || ''); } };
                                  const curCourier = editing ? trackEditCourier : (o.courier || '');
                                  return (
                                    <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                                      <select value={curCourier} disabled={saving}
                                        onChange={e => { startEdit(); setTrackEditCourier(e.target.value); }}
                                        style={{ height:28, padding:'0 6px', border:'1.5px solid #E2E8F0', borderRadius:6, fontSize:12, outline:'none', fontFamily:'inherit', background:'#fff' }}>
                                        {COURIER_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                      </select>
                                      <input value={editing ? trackEditVal : ''} disabled={saving}
                                        onChange={e => { startEdit(); setTrackEditVal(e.target.value.replace(/[^0-9]/g,'')); }}
                                        placeholder="송장번호" inputMode="numeric"
                                        style={{ width:120, height:28, padding:'0 8px', border:'1.5px solid #E2E8F0', borderRadius:6, fontSize:12, outline:'none', fontFamily:'inherit' }} />
                                      <button className="adm-row-btn" disabled={saving} onClick={() => saveInlineTracking(o, editing ? trackEditVal : '', editing ? trackEditCourier : (o.courier || ''))}>{saving ? '저장 중' : '저장'}</button>
                                    </div>
                                  );
                                }
                                if (o.tracking_number) {
                                  return (
                                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                                      {o.courier && <span className="adm-muted" style={{ fontSize:11, flexShrink:0 }}>{COURIER_NAMES[o.courier] || o.courier}</span>}
                                      <span>{o.tracking_number}</span>
                                      {editable && <button className="adm-row-btn" onClick={() => { setTrackEditRow(o.id); setTrackEditVal(o.tracking_number || ''); setTrackEditCourier(o.courier || ''); }}>수정</button>}
                                    </div>
                                  );
                                }
                                return <span className="adm-muted">—</span>;
                              })()}
                            </td>
                            <td>
                              <button className="adm-row-btn" onClick={() => {
                                setSelectedOrder(o);
                                setTrackingInput({ courier: o.courier || '', tracking_number: o.tracking_number || '' }); setFarmTracking({});
                              }}>상세</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              {!ordersLoading && filteredOrders.length > 0 && (
                <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:8, marginTop:14 }}>
                  <button className="adm-btn adm-btn-outline" disabled={orderCurPage <= 1} onClick={() => setOrderPage(p => Math.max(1, p - 1))}>이전</button>
                  <span className="adm-muted" style={{ fontSize:13 }}>{orderCurPage} / {orderTotalPages}</span>
                  <button className="adm-btn adm-btn-outline" disabled={orderCurPage >= orderTotalPages} onClick={() => setOrderPage(p => Math.min(orderTotalPages, p + 1))}>다음</button>
                  <span className="adm-muted" style={{ fontSize:12, marginLeft:8 }}>총 {filteredOrders.length}건</span>
                </div>
              )}
            </div>
          )}

          {/* ===== 상품 관리 ===== */}
          {panel === 'products' && (
            <div className="adm-content">
              <div className="adm-kpi-grid adm-kpi-4 adm-kpi-mb16">
                {[
                  { l:'전체 상품', v:products.length, st:'' as const, red:false },
                  { l:'판매중', v:productStatusCounts.selling, st:'selling' as const, red:false },
                  { l:'품절', v:productStatusCounts.soldout, st:'soldout' as const, red:true },
                  { l:'판매중지', v:productStatusCounts.stopped, st:'stopped' as const, red:false },
                ].map(k => (
                  <div key={k.l} className="adm-kpi-card" style={{ cursor:'pointer', outline: productStatusFilter===k.st ? '2px solid #1A1A1A' : 'none' }}
                    onClick={() => setProductStatusFilter(k.st)}>
                    <div className="adm-kpi-label">{k.l}</div>
                    <div className="adm-kpi-value adm-kpi-value-mt" style={k.red && k.v>0 ? { color:'#DC2626' } : undefined}>{k.v}</div>
                  </div>
                ))}
              </div>
              <div className="adm-toolbar">
                <div className="adm-toolbar-left">
                  <AdmSelect value={productCatFilter} onChange={setProductCatFilter}
                    options={[{ value:'', label:'전체 카테고리' }, ...Object.entries(catOptions).map(([v, l]) => ({ value:v, label:l as string }))]} />
                  <AdmSelect value={productBrandFilter} onChange={setProductBrandFilter}
                    options={[{ value:'', label:'전체 브랜드' }, ...farms.map(f => ({ value:f.id, label:f.name }))]} />
                  <input type="text" className="adm-input-text" placeholder="브랜드명·상품명 검색"
                    value={productSearch} onChange={e => setProductSearch(e.target.value)} />
                </div>
                <div className="adm-toolbar-right">
                  <button className="adm-btn adm-btn-outline" onClick={loadProducts}><span className="adm-btn-icon"><Icon.Refresh /></span>새로고침</button>
                  <button className="adm-btn adm-btn-primary" onClick={() => openProductModal()}>+ 상품 등록</button>
                </div>
              </div>
              <div className="adm-card">
                {productsLoading ? <PanelLoading /> : (
                  <div className="adm-table-wrap">
                    <table className="adm-table">
                      <thead>
                        <tr>
                          <th>상품명</th><th>브랜드</th><th>카테고리</th><th className="adm-num">정상가</th><th className="adm-num">판매가</th>
                          <th>할인율</th><th>상태</th><th>관리</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProducts.length === 0 ? (
                          <tr><td colSpan={8} style={{ textAlign:'center', padding:'40px 0', color:'#94A3B8' }}>상품 없음</td></tr>
                        ) : filteredProducts.map(p => (
                          <tr key={p.id}>
                            <td>{p.name}</td>
                            <td>{farms.find(f => f.id === p.farm_id)?.name || '-'}</td>
                            <td>{catOptions[p.category] || CAT_LABEL[p.category] || p.category}</td>
                            <td className="adm-mono adm-num adm-muted"><s>{fmtPrice(p.price)}원</s></td>
                            <td className="adm-mono adm-num"><strong>{fmtPrice(p.discounted_price)}원</strong></td>
                            <td>{p.discount_rate > 0 ? <span className="adm-badge badge-refund">{Math.round(p.discount_rate)}%</span> : '-'}</td>
                            <td>
                              {(() => {
                                const st = productSellState(p);
                                const info = st === 'selling' ? { l:'판매중', c:'badge-on' } : st === 'soldout' ? { l:'품절', c:'badge-ready' } : { l:'판매중지', c:'badge-done' };
                                return <span className={`adm-badge ${info.c}`}>{info.l}</span>;
                              })()}
                            </td>
                            <td style={{ display:'flex', gap:6 }}>
                              <button className="adm-row-btn" onClick={() => openProductModal(p)}>수정</button>
                              <button className="adm-row-btn" style={{ color: p.is_active ? '#DC2626' : '#16A34A' }} onClick={() => toggleProductActive(p)}>
                                {p.is_active ? '판매중지' : '판매중'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== 메뉴 관리 ===== */}
          {panel === 'menu' && (
            <div className="adm-content">
              {/* 위치 탭 — 글씨만 표기 + 선택 시 하단 검정바 (이모지 제거) */}
              <TabBtns active={menuTab} setActive={k => setMenuTab(k as typeof menuTab)}
                tabs={[
                  { id:'mega',        label:'메가메뉴' },
                  { id:'header',      label:'상단바' },
                  { id:'productlist', label:'상품목록' },
                  { id:'shortcut',    label:'모바일 서랍' },
                  { id:'home',        label:'퀵가이드' },
                ]} />

              {menuTab === 'mega' ? (menusLoading || ftLoading ? <PanelLoading /> : (() => {
                const ftText = (t: FilterTab) => (
                  <input className="adm-input-text" style={{ flex:'1 1 140px', minWidth:0, fontWeight:600 }} value={t.label} placeholder="이름"
                    onChange={e => setFilterTabs(prev => prev.map(x => x.id===t.id ? { ...x, label:e.target.value } : x))}
                    onBlur={() => updateFt(t.id, { label: t.label }, false)} />
                );
                const mText = (m: MenuRow) => (<>
                  <input className="adm-input-text" style={{ flex:'1 1 120px', minWidth:0, fontWeight:600 }} value={m.label} placeholder="이름"
                    onChange={e => setMenus(prev => prev.map(x => x.id===m.id ? { ...x, label:e.target.value } : x))}
                    onBlur={() => updateMenu(m.id, { label: m.label }, false)} />
                  <input className="adm-input-text" style={{ flex:'1 1 130px', minWidth:0, fontSize:12 }} value={m.href} placeholder="/경로"
                    onChange={e => setMenus(prev => prev.map(x => x.id===m.id ? { ...x, href:e.target.value } : x))}
                    onBlur={() => updateMenu(m.id, { href: m.href }, false)} />
                </>);
                const majors = filterTabs.filter(t => t.tab_type==='category' && !t.parent).sort((a,b)=>a.sort_order-b.sort_order);
                const megaGroups = menus.filter(m => !m.parent && m.show_in_mega).sort((a,b)=>a.sort_order-b.sort_order);
                return (
                  <>
                    {/* 미리보기 — 실제 사이트 메가드롭다운과 동일하게 렌더 */}
                    <div style={{ marginBottom:16 }}>
                      <div style={{ fontSize:12, color:'#94A3B8', marginBottom:8 }}>실제 메가드롭다운 미리보기</div>
                      {(() => {
                        // 실제 화면과 동일: 카테고리 대분류(전체보기+소분류) + 메뉴 그룹을 컬럼으로
                        const cols = [
                          ...majors.map(m => ({
                            key: 'm' + m.id, title: m.label,
                            items: ['전체보기', ...filterTabs.filter(s => s.parent===m.tab_value).sort((a,b)=>a.sort_order-b.sort_order).map(s => s.label)],
                          })),
                          ...megaGroups.map(g => ({
                            key: 'g' + g.id, title: g.label,
                            items: menus.filter(l => l.parent===g.id).sort((a,b)=>a.sort_order-b.sort_order).map(l => l.label),
                          })),
                        ];
                        return (
                          <div style={{ background:'#FAFAF8', padding:14, borderRadius:8, border:'1px solid #EEE' }}>
                            <div style={{ background:'#fff', border:'1.5px solid #D8D8D2', boxShadow:'0 6px 24px rgba(0,0,0,0.10)' }}>
                              <div style={{ display:'flex', gap:0, padding:'26px 24px 18px', alignItems:'flex-start' }}>
                                {cols.map((c, i) => (
                                  <div key={c.key} style={{ flex:1, padding: i===0 ? '0 32px 0 0' : '0 32px', textAlign:'center', minWidth:0 }}>
                                    <div style={{ position:'relative', fontSize:19, fontWeight:700, color:'#1A1A1A', paddingBottom:10, marginBottom:12, whiteSpace:'nowrap' }}>
                                      {c.title}
                                      <span style={{ position:'absolute', bottom:0, left:'50%', transform:'translateX(-50%)', width:64, height:2, background:'#1A1A1A' }} />
                                    </div>
                                    {c.items.map((label, j) => (
                                      <div key={j} style={{ fontSize:14.5, color:'#555', padding:'6px 0', whiteSpace:'nowrap' }}>{label}</div>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    {(() => {
                      // 공통 스타일
                      const rowSt: React.CSSProperties = { display:'flex', gap:8, alignItems:'center', marginBottom:8 };
                      const leadSt: React.CSSProperties = { width:16, flexShrink:0, textAlign:'center', color:'#CBD5E1', fontSize:14 };
                      const handleSt: React.CSSProperties = { cursor:'grab', color:'#B8B8B8', fontSize:15, letterSpacing:'-2px', flexShrink:0, userSelect:'none' };
                      const delSt: React.CSSProperties = { flexShrink:0, fontSize:12, fontWeight:600, color:'#DC2626', background:'#fff', border:'1px solid #E5E5E1', borderRadius:6, padding:'6px 11px', cursor:'pointer' };
                      const addSt: React.CSSProperties = { width:'100%', fontSize:14, fontWeight:600, color:'#1A1A1A', background:'#fff', border:'1px dashed #C4C4C4', borderRadius:8, padding:'10px', cursor:'pointer', marginTop:8 };
                      return (
                    <>
                    {/* 컬럼 추가 — 소분류 추가와 동일 스타일(검정 점선·상단 카드 폭에 맞춤) */}
                    <div style={{ display:'flex', gap:10, marginBottom:14 }}>
                      <button type="button" onClick={() => addCategory(null)} style={{ ...addSt, marginTop:0 }}>+ 카테고리</button>
                      <button type="button" onClick={() => addMenu({ show_in_mega:true, parent:null, label:'새 메뉴 그룹', href:'/' })} style={{ ...addSt, marginTop:0 }}>+ 메뉴 그룹</button>
                    </div>
                    {/* 카테고리 대분류 컬럼 */}
                    {majors.map(m => (
                      <div key={m.id} className="adm-card" style={{ padding:'14px 16px', marginBottom:12, opacity: m.is_active ? 1 : 0.55 }}>
                        <div style={{ fontSize:11, fontWeight:800, color:'#1A8A4C', marginBottom:8 }}>카테고리</div>
                        {/* 대분류 행 */}
                        <div style={rowSt} onDragOver={e => e.preventDefault()} onDrop={() => { reorderFilterTabs(dragRow.current || '', m.id); dragRow.current = null; }}>
                          <span style={leadSt} />
                          <span draggable onDragStart={() => { dragRow.current = m.id; }} onDragEnd={() => { dragRow.current = null; }} style={handleSt} title="드래그로 순서 변경">⠿⠿</span>
                          {ftText(m)}
                          <AdmToggle on={m.is_active} onChange={v => updateFt(m.id, { is_active: v })} title="노출" />
                          <button type="button" onClick={() => deleteCategory(m)} style={delSt}>삭제</button>
                        </div>
                        {/* 소분류 행 */}
                        {filterTabs.filter(s => s.parent===m.tab_value).sort((a,b)=>a.sort_order-b.sort_order).map(s => (
                          <div key={s.id} style={rowSt} onDragOver={e => e.preventDefault()} onDrop={() => { reorderFilterTabs(dragRow.current || '', s.id); dragRow.current = null; }}>
                            <span style={leadSt}>└</span>
                            <span draggable onDragStart={() => { dragRow.current = s.id; }} onDragEnd={() => { dragRow.current = null; }} style={handleSt} title="드래그로 순서 변경">⠿⠿</span>
                            {ftText(s)}
                            <AdmToggle on={s.is_active} onChange={v => updateFt(s.id, { is_active: v })} title="노출" />
                            <button type="button" onClick={() => deleteCategory(s)} style={delSt}>삭제</button>
                          </div>
                        ))}
                        <button type="button" onClick={() => addCategory(m.tab_value)} style={addSt}>+ 소분류 추가</button>
                      </div>
                    ))}
                    {/* 메뉴 그룹 컬럼 */}
                    {megaGroups.map(g => (
                      <div key={g.id} className="adm-card" style={{ padding:'14px 16px', marginBottom:12, opacity: g.is_active ? 1 : 0.55 }}>
                        <div style={{ fontSize:11, fontWeight:800, color:'#2563EB', marginBottom:8 }}>메뉴 그룹</div>
                        <div style={rowSt} onDragOver={e => e.preventDefault()} onDrop={() => { reorderMenus(dragRow.current || '', g.id); dragRow.current = null; }}>
                          <span style={leadSt} />
                          <span draggable onDragStart={() => { dragRow.current = g.id; }} onDragEnd={() => { dragRow.current = null; }} style={handleSt} title="드래그로 순서 변경">⠿⠿</span>
                          {mText(g)}
                          <AdmToggle on={g.is_active} onChange={v => updateMenu(g.id, { is_active: v })} title="노출" />
                          <button type="button" onClick={() => deleteMenu(g.id)} style={delSt}>삭제</button>
                        </div>
                        {menus.filter(s => s.parent===g.id).sort((a,b)=>a.sort_order-b.sort_order).map(s => (
                          <div key={s.id} style={{ ...rowSt, opacity: s.is_active ? 1 : 0.5 }} onDragOver={e => e.preventDefault()} onDrop={() => { reorderMenus(dragRow.current || '', s.id); dragRow.current = null; }}>
                            <span style={leadSt}>└</span>
                            <span draggable onDragStart={() => { dragRow.current = s.id; }} onDragEnd={() => { dragRow.current = null; }} style={handleSt} title="드래그로 순서 변경">⠿⠿</span>
                            {mText(s)}
                            <AdmToggle on={s.is_active} onChange={v => updateMenu(s.id, { is_active: v })} title="노출" />
                            <button type="button" onClick={() => deleteMenu(s.id)} style={delSt}>삭제</button>
                          </div>
                        ))}
                        <button type="button" onClick={() => addMenu({ parent:g.id, label:'새 링크', href:'/' })} style={addSt}>+ 소분류 추가</button>
                      </div>
                    ))}
                    </>
                      );
                    })()}
                  </>
                );
              })()) : menuTab === 'header' ? (menusLoading ? <PanelLoading /> : (() => {
                const navItems = menus.filter(m => !m.parent).sort((a,b)=>a.sort_order-b.sort_order);
                const shown = navItems.filter(m => m.show_in_header && m.is_active);
                const mIn = (m: MenuRow, field: 'label'|'href', ph: string, w: string) => (
                  <input className="adm-input-text" style={{ flex:w, minWidth:0, ...(field==='label'?{fontWeight:600}:{fontSize:12}) }} value={m[field]} placeholder={ph}
                    onChange={e => setMenus(prev => prev.map(x => x.id===m.id ? { ...x, [field]:e.target.value } : x))}
                    onBlur={() => updateMenu(m.id, { [field]: m[field] }, false)} />
                );
                return (
                  <>
                    <div style={{ marginBottom:16 }}>
                      <div style={{ fontSize:12, color:'#94A3B8', marginBottom:8 }}>상단바 미리보기</div>
                      {/* 실제 PC 헤더 상단 메뉴바와 동일 (흰 바탕·큰 글씨·넓은 간격) */}
                      <div style={{ background:'#fff', border:'1px solid #EBEBEB', borderRadius:8, padding:'16px 28px', display:'flex', gap:40, alignItems:'center', flexWrap:'wrap' }}>
                        {shown.length===0 ? <span className="adm-muted">노출 항목 없음</span> : shown.map(m => (
                          <span key={m.id} style={{ fontSize:19, fontWeight:400, color:'#1A1A1A', whiteSpace:'nowrap' }}>{m.label}</span>
                        ))}
                      </div>
                    </div>
                    <div className="adm-toolbar"><div className="adm-toolbar-left" /><div className="adm-toolbar-right">
                      <button className="adm-btn adm-btn-outline" onClick={() => addMenu({ show_in_header:true, parent:null, label:'새 메뉴', href:'/' })}>+ 메뉴 추가</button>
                    </div></div>
                    {navItems.map(m => (
                      <div key={m.id} className="adm-card" style={{ padding:'10px 14px', marginBottom:8, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}
                        onDragOver={e => e.preventDefault()} onDrop={() => { reorderMenus(dragRow.current || '', m.id); dragRow.current = null; }}>
                        <span draggable onDragStart={() => { dragRow.current = m.id; }} onDragEnd={() => { dragRow.current = null; }} style={{ cursor:'grab', color:'#B8B8B8', fontSize:15, letterSpacing:'-2px', flexShrink:0, userSelect:'none' }} title="드래그로 순서 변경">⠿⠿</span>
                        {mIn(m,'label','메뉴명','1 1 120px')}
                        {mIn(m,'href','/경로','1 1 130px')}
                        <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:11, color:'#475569', flexShrink:0 }}>상단바 노출 <AdmToggle on={m.show_in_header} onChange={v => updateMenu(m.id, { show_in_header: v })} title="상단바 노출" /></span>
                        <button type="button" onClick={() => deleteMenu(m.id)} style={{ flexShrink:0, fontSize:12, fontWeight:600, color:'#DC2626', background:'#fff', border:'1px solid #E5E5E1', borderRadius:6, padding:'6px 11px', cursor:'pointer' }}>삭제</button>
                      </div>
                    ))}
                  </>
                );
              })()) : menuTab === 'productlist' ? (ftLoading ? <PanelLoading /> : (() => {
                const majors = filterTabs.filter(t => t.tab_type==='category' && !t.parent).sort((a,b)=>a.sort_order-b.sort_order);
                const filtags = filterTabs.filter(t => t.tab_type !== 'category').sort((a,b)=>a.sort_order-b.sort_order);
                const subsOf = (mv: string) => filterTabs.filter(s => s.parent===mv).sort((a,b)=>a.sort_order-b.sort_order);
                const shownMajors = majors.filter(m => m.show_in_category && m.is_active);
                const shownTags = filtags.filter(t => t.show_in_category && t.is_active);
                const catLabel = (t: FilterTab) => (
                  <input className="adm-input-text" style={{ flex:'1 1 140px', minWidth:0, fontWeight:600 }} value={t.label} placeholder="이름"
                    onChange={e => setFilterTabs(prev => prev.map(x => x.id===t.id ? { ...x, label:e.target.value } : x))}
                    onBlur={() => updateFt(t.id, { label: t.label }, false)} />
                );
                const chip = { display:'inline-flex', alignItems:'center', padding:'5px 11px', border:'1px solid #E5E7EB', borderRadius:999, background:'#fff', fontSize:12, fontWeight:600, color:'#374151', whiteSpace:'nowrap' as const };
                return (
                  <>
                    {/* 미리보기 — 실제 상품목록 상단(대분류 탭 + 소분류 필터)처럼 */}
                    <div style={{ marginBottom:16 }}>
                      <div style={{ fontSize:12, color:'#94A3B8', marginBottom:8 }}>상품목록 상단 미리보기</div>
                      <div style={{ background:'#fff', border:'1px solid #EBEBEB', borderRadius:8, padding:'18px 22px' }}>
                        {/* 대분류 탭 — 실제처럼 글씨 + 선택(전체) 하단 검정바 */}
                        <div style={{ display:'flex', gap:26, alignItems:'center', flexWrap:'wrap', borderBottom:'1px solid #EEE', paddingBottom:2 }}>
                          <span style={{ fontSize:15, fontWeight:700, color:'#1A1A1A', paddingBottom:10, borderBottom:'2px solid #1A1A1A', marginBottom:'-1px' }}>전체</span>
                          {shownMajors.map(m => <span key={m.id} style={{ fontSize:15, fontWeight:500, color:'#8A8A8A', paddingBottom:10 }}>{m.label}</span>)}
                          {shownMajors.length===0 && <span className="adm-muted" style={{ fontSize:12 }}>노출된 대분류 없음</span>}
                        </div>
                        {/* 소분류 필터 필 */}
                        {shownMajors.map(m => {
                          const ss = subsOf(m.tab_value).filter(s => s.show_in_category && s.is_active);
                          if (!ss.length) return null;
                          return (
                            <div key={m.id} style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginTop:12 }}>
                              <span style={{ fontSize:12, color:'#94A3B8', minWidth:72 }}>{m.label}</span>
                              {ss.map(s => <span key={s.id} style={{ fontSize:13, color:'#555', background:'#F4F4F2', border:'1px solid #E5E5E1', borderRadius:999, padding:'6px 14px' }}>{s.label}</span>)}
                            </div>
                          );
                        })}
                        {shownTags.length>0 && (
                          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginTop:14, paddingTop:12, borderTop:'1px dashed #EEE' }}>
                            <span style={{ fontSize:12, color:'#94A3B8', minWidth:72 }}>정렬·태그</span>
                            {shownTags.map(t => <span key={t.id} style={{ fontSize:13, color:'#555', background:'#F4F4F2', border:'1px solid #E5E5E1', borderRadius:999, padding:'6px 14px' }}>{t.label}</span>)}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* 대분류·소분류는 메가메뉴 탭에서 일원 관리 (여기선 미리보기만) */}
                    <div className="adm-muted" style={{ fontSize:12.5, padding:'10px 2px 4px' }}>
                      대분류·소분류(카테고리)는 <strong style={{ color:'#475569' }}>메뉴 관리 &gt; 메가메뉴</strong> 탭에서 추가·수정·순서 변경하세요. (여기선 미리보기만 표시됩니다)
                    </div>
                    {/* 정렬·태그 필탭 */}
                    <div className="adm-toolbar" style={{ marginTop:18 }}>
                      <div className="adm-toolbar-left"><span className="adm-muted" style={{ fontSize:13 }}>정렬 · 태그 필탭 <span style={{ color:'#CBD5E1' }}>(보기 방식 — 신상품·당도순 등)</span></span></div>
                      <div className="adm-toolbar-right"><button className="adm-btn adm-btn-outline" onClick={() => openFtModal()}>+ 추가</button></div>
                    </div>
                    {filtags.length===0 ? <div className="adm-muted" style={{ fontSize:12, padding:'10px 0' }}>필탭 없음</div> : filtags.map(t => (
                      <div key={t.id} className="adm-card" style={{ padding:'10px 14px', marginBottom:8, display:'flex', gap:10, alignItems:'center', flexWrap:'wrap', opacity:t.is_active?1:0.55 }}
                        onDragOver={e => e.preventDefault()} onDrop={() => { reorderFilterTabs(dragRow.current || '', t.id); dragRow.current = null; }}>
                        <span draggable onDragStart={() => { dragRow.current = t.id; }} onDragEnd={() => { dragRow.current = null; }} style={{ cursor:'grab', color:'#B8B8B8', fontSize:15, letterSpacing:'-2px', flexShrink:0, userSelect:'none' }} title="드래그로 순서 변경">⠿⠿</span>
                        <span style={{ fontWeight:600, flex:'1 1 120px' }}>{t.label}</span>
                        <span className={`adm-badge ${t.tab_type==='link'?'badge-off':'badge-on'}`}>{t.tab_type==='flag'?'태그':t.tab_type==='sort'?'정렬':'링크'}</span>
                        <AdmToggle on={t.show_in_category} onChange={v => updateFt(t.id, { show_in_category: v })} title="노출" />
                        <button type="button" className="adm-row-btn" onClick={() => openFtModal(t)}>수정</button>
                        <button type="button" onClick={() => deleteFilterTab(t)} style={{ flexShrink:0, fontSize:12, fontWeight:600, color:'#DC2626', background:'#fff', border:'1px solid #E5E5E1', borderRadius:6, padding:'6px 11px', cursor:'pointer' }}>삭제</button>
                      </div>
                    ))}
                  </>
                );
              })()) : (ftLoading ? <PanelLoading /> : (() => {
                const flagKey: 'show_in_shortcut'|'show_in_home' = menuTab==='shortcut' ? 'show_in_shortcut' : 'show_in_home';
                const surfaceName = menuTab==='shortcut' ? '모바일 서랍 바로가기' : '홈 퀵가이드';
                const filtags = filterTabs.filter(t => t.tab_type !== 'category').sort((a,b)=>a.sort_order-b.sort_order);
                const shownTags = filtags.filter(t => t[flagKey] && t.is_active);
                const chip = { display:'inline-flex', alignItems:'center', padding:'5px 11px', border:'1px solid #E5E7EB', borderRadius:999, background:'#fff', fontSize:12, fontWeight:600, color:'#374151', whiteSpace:'nowrap' as const };
                return (
                  <>
                    <div style={{ marginBottom:16 }}>
                      <div style={{ fontSize:12, color:'#94A3B8', marginBottom:8 }}>{surfaceName} 미리보기</div>
                      <div style={{ background:'#fff', border:'1px solid #EBEBEB', borderRadius:8, padding:'16px 20px', display:'flex', gap:8, flexWrap:'wrap' }}>
                        {shownTags.map(t => <span key={t.id} style={{ fontSize:13, color:'#555', background:'#F4F4F2', border:'1px solid #E5E5E1', borderRadius:999, padding:'6px 14px' }}>{t.label}</span>)}
                        {shownTags.length===0 && <span className="adm-muted" style={{ fontSize:12 }}>노출 항목 없음</span>}
                      </div>
                    </div>
                    <div className="adm-toolbar">
                      <div className="adm-toolbar-left"><span className="adm-muted" style={{ fontSize:13 }}>필탭(정렬/태그) 노출 관리</span></div>
                      <div className="adm-toolbar-right"><button className="adm-btn adm-btn-outline" onClick={() => openFtModal()}>+ 추가</button></div>
                    </div>
                    {filtags.length===0 ? <div className="adm-muted" style={{ fontSize:12, padding:'10px 0' }}>필탭 없음</div> : filtags.map(t => (
                      <div key={t.id} className="adm-card" style={{ padding:'10px 14px', marginBottom:8, display:'flex', gap:10, alignItems:'center', flexWrap:'wrap', opacity:t.is_active?1:0.55 }}
                        onDragOver={e => e.preventDefault()} onDrop={() => { reorderFilterTabs(dragRow.current || '', t.id); dragRow.current = null; }}>
                        <span draggable onDragStart={() => { dragRow.current = t.id; }} onDragEnd={() => { dragRow.current = null; }} style={{ cursor:'grab', color:'#B8B8B8', fontSize:15, letterSpacing:'-2px', flexShrink:0, userSelect:'none' }} title="드래그로 순서 변경">⠿⠿</span>
                        <span style={{ fontWeight:600, flex:'1 1 120px' }}>{t.label}</span>
                        <span className={`adm-badge ${t.tab_type==='link'?'badge-off':'badge-on'}`}>{t.tab_type==='flag'?'태그':t.tab_type==='sort'?'정렬':'링크'}</span>
                        <AdmToggle on={!!t[flagKey]} onChange={v => updateFt(t.id, { [flagKey]: v } as Partial<FilterTab>)} title="노출" />
                        <button type="button" className="adm-row-btn" onClick={() => openFtModal(t)}>수정</button>
                        <button type="button" onClick={() => deleteFilterTab(t)} style={{ flexShrink:0, fontSize:12, fontWeight:600, color:'#DC2626', background:'#fff', border:'1px solid #E5E5E1', borderRadius:6, padding:'6px 11px', cursor:'pointer' }}>삭제</button>
                      </div>
                    ))}
                  </>
                );
              })())}
            </div>
          )}

          {/* ===== 농가 관리 ===== */}
          {panel === 'farms' && (() => {
            /* 품목 탭 — 농가들이 실제 취급하는 품목 모음. 복수 품목 농가는 각 품목 탭에 모두 노출 */
            const farmItems = [...new Set(farms.flatMap(f => f.items || []))].sort();
            const kw = farmListSearch.trim().toLowerCase();
            const filteredFarms = farms.filter(f => {
              if (farmTypeFilter && !(f.items || []).includes(farmTypeFilter)) return false;
              if (!kw) return true;
              return [f.name, f.farmer_name || '', ...(f.items || [])]
                .some(v => v.toLowerCase().includes(kw));
            });
            return (
            <div className="adm-content">
              <div className="adm-toolbar" style={{ flexWrap:'wrap', gap:8 }}>
                <div className="adm-toolbar-left">
                  {/* 품목 탭 — 글씨만 + 선택 시 하단 검정바 */}
                  <div className="adm-tabs" style={{ marginBottom:0 }}>
                    <button className={`adm-tab${farmTypeFilter===''?' active':''}`} onClick={() => setFarmTypeFilter('')}>전체</button>
                    {farmItems.map(t => (
                      <button key={t} className={`adm-tab${farmTypeFilter===t?' active':''}`} onClick={() => setFarmTypeFilter(t)}>{t}</button>
                    ))}
                  </div>
                </div>
                <div className="adm-toolbar-right">
                  <input type="text" className="adm-input-text" style={{ width:230 }} placeholder="품목·브랜드명·대표자명 검색"
                    value={farmListSearch} onChange={e => setFarmListSearch(e.target.value)} />
                  <button className="adm-btn adm-btn-outline" onClick={loadFarms}><span className="adm-btn-icon"><Icon.Refresh /></span>새로고침</button>
                  <button className="adm-btn adm-btn-primary" onClick={() => openFarmModal()}>+ 브랜드 등록</button>
                </div>
              </div>
              <div className="adm-card">
                {farmsLoading ? <PanelLoading /> : (
                  <div className="adm-table-wrap">
                    <table className="adm-table">
                      <thead><tr><th>브랜드명</th><th>대표자</th><th>지역</th><th>취급 품목</th><th>택배사</th><th className="adm-num">상품</th><th className="adm-num">리뷰</th><th className="adm-num">찜</th><th>관리</th></tr></thead>
                      <tbody>
                        {filteredFarms.length === 0 ? (
                          <tr><td colSpan={9} style={{ textAlign:'center', padding:'40px 0', color:'#94A3B8' }}>{farms.length === 0 ? '등록된 브랜드 없음' : '조건에 맞는 브랜드 없음'}</td></tr>
                        ) : filteredFarms.map(f => (
                          <tr key={f.id}>
                            <td><strong>{f.name}</strong></td>
                            <td>{f.farmer_name || '-'}</td>
                            <td className="adm-muted">{f.region || '-'}</td>
                            <td>{(f.items || []).length ? (f.items || []).join(', ') : '-'}</td>
                            <td>{f.carrier ? <span className="adm-badge badge-carrier">{f.carrier}</span> : '-'}</td>
                            <td className="adm-mono adm-num">{f.active_count || 0}<span style={{ color:'#CBD5E1' }}>/{f.product_count || 0}</span></td>
                            <td className="adm-mono adm-num">{(f.review_count || 0) > 0 ? <>{(f.avg_rating || 0).toFixed(1)} <span className="adm-muted">({f.review_count})</span></> : <span className="adm-muted">-</span>}</td>
                            <td className="adm-mono adm-num">{(f.wish_count || 0).toLocaleString()}</td>
                            <td style={{ display:'flex', gap:6 }}>
                              <button className="adm-row-btn" onClick={() => openFarmModal(f)}>수정</button>
                              <button className="adm-row-btn" onClick={() => openFarmDetail(f)}>분석</button>
                              <button className="adm-row-btn adm-row-btn-danger" onClick={() => deleteFarm(f.id)}>삭제</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
            );
          })()}

          {/* ===== 리뷰 관리 ===== */}
          {panel === 'reviews' && (
            <div className="adm-content">
              <div className="adm-kpi-grid adm-kpi-4 adm-kpi-mb16">
                {[
                  /* st 이 있으면 클릭 필터. 평균 평점은 지표라 필터가 아님(st: null) */
                  { l:'전체 리뷰',  v:`${reviews.length}건`,                     st:'all' as const,        red:false },
                  { l:'미답변',    v:`${reviewUnansweredCount}건`,              st:'unanswered' as const, red:true },
                  { l:'답변완료',  v:`${reviews.length - reviewUnansweredCount}건`, st:'answered' as const,   red:false },
                  { l:'평균 평점',  v:`★ ${reviewAvgRating.toFixed(1)}`,          st:null,                  red:false },
                ].map(k => (
                  <div key={k.l} className="adm-kpi-card"
                    style={k.st ? { cursor:'pointer', outline: reviewAnswered === k.st ? '2px solid #1A1A1A' : 'none' } : undefined}
                    onClick={k.st ? () => { setReviewAnswered(k.st); setReviewPage(1); } : undefined}>
                    <div className="adm-kpi-label">{k.l}</div>
                    <div className="adm-kpi-value adm-kpi-value-mt" style={k.red && reviewUnansweredCount>0 ? { color:'#DC2626' } : undefined}>{k.v}</div>
                  </div>
                ))}
              </div>
              <div className="adm-toolbar" style={{ flexWrap:'wrap', gap:8 }}>
                <div className="adm-toolbar-left" style={{ flexWrap:'wrap', gap:8, alignItems:'center' }}>
                  <AdmSelect value={reviewRating} onChange={v => { setReviewRating(v); setReviewPage(1); }}
                    options={[{ value:'', label:'전체 별점' }, ...['5','4','3','2','1'].map(s => ({ value:s, label:`${s}점` }))]} />
                  <AdmSelect value={reviewFarm} onChange={v => { setReviewFarm(v); setReviewPage(1); }}
                    options={[{ value:'', label:'전체 농가' }, ...farms.map(f => ({ value:f.id, label:f.name }))]} />
                  <AdmSelect value={reviewAnswered} onChange={v => { setReviewAnswered(v as 'all'|'unanswered'|'answered'); setReviewPage(1); }}
                    options={[{ value:'all', label:'답변상태 전체' }, { value:'unanswered', label:'미답변' }, { value:'answered', label:'답변완료' }]} />
                  <AdmSelect value={reviewFlag} onChange={v => { setReviewFlag(v as ''|'best'|'reported'|'liked'); setReviewPage(1); }}
                    options={[
                      { value:'', label:'상태 전체' },
                      { value:'best', label:'베스트' },
                      { value:'reported', label:'신고됨' },
                      { value:'liked', label:'도움돼요' },
                    ]} />
                  <input type="date" className="adm-select" value={reviewFrom} onChange={e => { setReviewFrom(e.target.value); setReviewPage(1); }} />
                  <span style={{ color:'#94A3B8' }}>~</span>
                  <input type="date" className="adm-select" value={reviewTo} onChange={e => { setReviewTo(e.target.value); setReviewPage(1); }} />
                  <input type="text" className="adm-input-text" style={{ minWidth:260 }} placeholder="리뷰 내용·작성자·농가명·상품명 검색"
                    value={reviewSearch} onChange={e => { setReviewSearch(e.target.value); setReviewPage(1); }} />
                </div>
                <div className="adm-toolbar-right" style={{ gap:8 }}>
                  <AdmSelect value={String(reviewPageSize)} onChange={v => { setReviewPageSize(Number(v)); setReviewPage(1); }}
                    options={[10,30,50,100].map(n => ({ value:String(n), label:`${n}개씩` }))} />
                  <button className="adm-btn adm-btn-outline" onClick={loadReviews}><span className="adm-btn-icon"><Icon.Refresh /></span>새로고침</button>
                </div>
              </div>
              <div className="adm-card">
                {reviewsLoading ? <PanelLoading /> : (
                  <div className="adm-table-wrap">
                    <table className="adm-table">
                      <thead><tr><th>별점</th><th>내용</th><th>작성자(아이디)</th><th>상품</th><th>답변</th><th>베스트</th><th className="adm-num">👍</th><th>🚨</th><th>작성일</th><th>관리</th></tr></thead>
                      <tbody>
                        {filteredReviews.length === 0 ? (
                          <tr><td colSpan={10} style={{ textAlign:'center', padding:'40px 0', color:'#94A3B8' }}>{reviews.length === 0 ? '리뷰 없음' : '검색 결과 없음'}</td></tr>
                        ) : pagedReviews.map(r => (
                          <tr key={r.id} style={{ cursor:'pointer' }} onClick={() => { setSelectedReview(r); setReviewReply(r.seller_reply || ''); }}>
                            <td><StarRating rating={r.rating} size={13} /></td>
                            <td style={{ maxWidth:240, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.content}</td>
                            <td style={{ lineHeight:1.35 }}>
                              <div style={{ fontWeight:600 }}>{r.profiles?.name || '익명'}</div>
                              <div className="adm-muted" style={{ fontSize:11 }}>{r.profiles?.email || '-'}</div>
                            </td>
                            <td className="adm-muted">{r.products?.name || '-'}</td>
                            <td>
                              {r.seller_reply
                                ? <span className="adm-badge badge-done">완료</span>
                                : <span className="adm-badge badge-wait" style={{ color:'#DC2626' }}>미답변</span>}
                            </td>
                            <td><Toggle defaultOn={r.is_best} onChange={v => toggleReviewBest(r.id, v)} /></td>
                            <td className="adm-mono adm-num">{r.likes_count || 0}</td>
                            <td>
                              {(r.report_count || 0) > 0
                                ? <span className="adm-badge badge-off" style={{ cursor:'default' }}>{r.report_count}</span>
                                : <span className="adm-muted">-</span>}
                            </td>
                            <td className="adm-muted">{fmtDate(r.created_at)}</td>
                            <td><button className="adm-row-btn adm-row-btn-danger" onClick={() => deleteReview(r.id)}>삭제</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              {!reviewsLoading && filteredReviews.length > 0 && (
                <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:8, marginTop:14 }}>
                  <button className="adm-btn adm-btn-outline" disabled={reviewCurPage <= 1} onClick={() => setReviewPage(p => Math.max(1, p - 1))}>이전</button>
                  <span className="adm-muted" style={{ fontSize:13 }}>{reviewCurPage} / {reviewTotalPages}</span>
                  <button className="adm-btn adm-btn-outline" disabled={reviewCurPage >= reviewTotalPages} onClick={() => setReviewPage(p => Math.min(reviewTotalPages, p + 1))}>다음</button>
                  <span className="adm-muted" style={{ fontSize:12, marginLeft:8 }}>총 {filteredReviews.length}건</span>
                </div>
              )}
            </div>
          )}

          {/* ===== 쿠폰 / 포인트 ===== */}
          {panel === 'coupon' && (
            <div className="adm-content">
              <TabBtns active={couponTab} setActive={setCouponTab}
                tabs={[{id:'tab-coupon',label:'쿠폰 관리'},{id:'tab-point',label:'포인트 관리'},{id:'tab-membership',label:'멤버십 관리'},{id:'tab-couponlog',label:'지급 내역'}]} />
              {couponTab === 'tab-coupon' ? (
                <>
                  <div className="adm-kpi-grid adm-kpi-5 adm-kpi-mb16">
                    {[
                      ['전체 쿠폰', `${coupons.length}개`],
                      ['활성', `${coupons.filter(c => c.is_active).length}개`],
                      ['비활성', `${coupons.filter(c => !c.is_active).length}개`],
                      ['총 발급', `${couponStats.issued.toLocaleString()}건`],
                      ['총 사용', `${couponStats.used.toLocaleString()}건`],
                    ].map(([l, v]) => (
                      <div key={l} className="adm-kpi-card">
                        <div className="adm-kpi-label">{l}</div>
                        <div className="adm-kpi-value adm-kpi-value-mt">{v}</div>
                      </div>
                    ))}
                  </div>
                  {/* 신규회원 웰컴 쿠폰팩 (signup_grant) */}
                  {(() => {
                    const pack = coupons.filter(c => c.signup_grant);
                    const today = new Date().toISOString().slice(0,10);
                    const totalAmt = pack.filter(c => c.is_active && c.discount_type === 'fixed').reduce((s,c) => s + c.discount_value, 0);
                    return (
                      <div className="adm-card" style={{ marginBottom:16 }}>
                        <div className="adm-card-head" style={{ alignItems:'center' }}>
                          <span className="adm-card-title">신규회원 웰컴 쿠폰팩</span>
                          <button className="adm-btn adm-btn-primary" style={{ marginLeft:'auto' }} onClick={openSignupCouponModal}>+ 신규회원 쿠폰 추가</button>
                        </div>
                        <div className="adm-muted" style={{ fontSize:12, margin:'2px 0 12px' }}>
                          신규 회원이 가입하면 아래 쿠폰이 <strong>각자 가입일 기준으로 자동 발급</strong>됩니다. (정액 합계 <strong>{fmtPrice(totalAmt)}원</strong> · {pack.filter(c=>c.is_active).length}종 활성)
                        </div>
                        {pack.length === 0 ? (
                          <div className="adm-muted" style={{ fontSize:13, padding:'6px 0' }}>등록된 신규회원 쿠폰이 없습니다. 우측 “+ 신규회원 쿠폰 추가”로 만드세요.</div>
                        ) : (
                          <div className="adm-table-wrap">
                            <table className="adm-table">
                              <thead><tr><th>쿠폰명</th><th>할인값</th><th>유효기간</th><th>상태</th><th>관리</th></tr></thead>
                              <tbody>
                                {pack.map(c => {
                                  const relative = c.valid_days != null;
                                  const expiredFixed = !relative && !!c.expires_at && c.expires_at.slice(0,10) < today;
                                  return (
                                    <tr key={c.id} style={{ opacity: c.is_active ? 1 : 0.55 }}>
                                      <td style={{ fontWeight:700 }}>{c.name}</td>
                                      <td style={{ fontWeight:800 }}>{c.discount_type === 'percent' ? `${c.discount_value}%` : `${fmtPrice(c.discount_value)}원`}</td>
                                      <td className="adm-muted">
                                        {relative ? <strong style={{ color:'#475569' }}>발급일 +{c.valid_days}일</strong> : (c.expires_at ? `${c.expires_at.slice(0,10)} 고정` : '무제한')}
                                        {expiredFixed && <span style={{ fontSize:11, color:'#DC2626', fontWeight:700, marginLeft:6 }}>⚠️ 만료일 지남</span>}
                                      </td>
                                      <td>{c.is_active ? <span className="adm-badge badge-on">활성</span> : <span className="adm-badge badge-off">비활성</span>}</td>
                                      <td>
                                        <div style={{ display:'flex', gap:6 }}>
                                          <button className="adm-row-btn" style={{ color:'#2563EB' }} onClick={() => openGiveCouponModal(c)}>지급</button>
                                          <button className="adm-row-btn" onClick={() => openCouponModal(c)}>수정</button>
                                          <button className="adm-row-btn adm-row-btn-danger" onClick={() => deleteCoupon(c.id)}>삭제</button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div className="adm-toolbar">
                    <div className="adm-toolbar-left" />
                    <div className="adm-toolbar-right">
                      <button className="adm-btn adm-btn-outline" onClick={loadCoupons}><span className="adm-btn-icon"><Icon.Refresh /></span>새로고침</button>
                      <button className="adm-btn adm-btn-primary" onClick={() => openCouponModal()}>+ 쿠폰 생성</button>
                    </div>
                  </div>
                  <div className="adm-card">
                    {couponsLoading ? <PanelLoading /> : (
                      <div className="adm-table-wrap">
                        <table className="adm-table">
                          <thead><tr><th>쿠폰명</th><th>코드</th><th>할인 유형</th><th>할인값</th><th>만료일</th><th>활성</th><th>관리</th></tr></thead>
                          <tbody>
                            {coupons.length === 0 ? (
                              <tr><td colSpan={7} style={{ textAlign:'center', padding:'40px 0', color:'#94A3B8' }}>쿠폰 없음</td></tr>
                            ) : pagedCoupons.map(c => (
                              <tr key={c.id}>
                                <td>{c.name}</td>
                                <td className="adm-mono">{c.code || '-'}</td>
                                <td>{c.discount_type === 'percent' ? '정률' : '정액'}</td>
                                <td><strong>{c.discount_type === 'percent' ? `${c.discount_value}%` : `${fmtPrice(c.discount_value)}원`}</strong></td>
                                <td className="adm-muted">{c.expires_at ? c.expires_at.slice(0,10) : '무제한'}</td>
                                <td><Toggle defaultOn={c.is_active} onChange={v => toggleCouponActive(c.id, v)} /></td>
                                <td>
                                  <div style={{ display:'flex', gap:6 }}>
                                    <button className="adm-row-btn" style={{ color:'#2563EB' }} onClick={() => openGiveCouponModal(c)}>지급</button>
                                    <button className="adm-row-btn" onClick={() => openCouponModal(c)}>수정</button>
                                    <button className="adm-row-btn adm-row-btn-danger" onClick={() => deleteCoupon(c.id)}>삭제</button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                  <Pager page={cpCur} pageSize={cpSize} total={coupons.length} onPage={setCpPage} onPageSize={setCpSize} />
                </>
              ) : (
                <>
                  {couponTab === 'tab-couponlog' && (
                  <div className="adm-card">
                    <div className="adm-card-head" style={{ alignItems:'center' }}>
                      <span className="adm-card-title">쿠폰 지급 내역</span>
                      <span className="adm-muted" style={{ fontSize:12, marginLeft:8 }}>총 {clFiltered.length.toLocaleString()}건</span>
                      <button className="adm-btn adm-btn-outline" style={{ marginLeft:'auto' }} onClick={loadCouponLogs}><span className="adm-btn-icon"><Icon.Refresh /></span>새로고침</button>
                    </div>
                    <div className="adm-toolbar" style={{ marginTop:4 }}>
                      <div className="adm-toolbar-left">
                        <AdmSelect value={clStatus} onChange={v => { setClStatus(v as 'all'|'unused'|'used'|'expired'); setClPage(1); }}
                          options={[{ value:'all', label:'전체 상태' }, { value:'unused', label:'미사용' }, { value:'used', label:'사용완료' }, { value:'expired', label:'만료' }]} />
                        <AdmSelect value={clCategory} onChange={v => { setClCategory(v as 'all'|'signup'|'membership'|'general'); setClPage(1); }}
                          options={[{ value:'all', label:'전체 종류' }, { value:'signup', label:'신규회원' }, { value:'general', label:'일반쿠폰' }, { value:'membership', label:'멤버십쿠폰' }]} />
                        <input type="text" className="adm-input-text" placeholder="회원 이름·이메일·쿠폰명 검색"
                          value={clSearch} onChange={e => { setClSearch(e.target.value); setClPage(1); }} />
                      </div>
                    </div>
                    {couponLogsLoading ? <PanelLoading /> : (
                      <div className="adm-table-wrap">
                        <table className="adm-table">
                          <thead><tr><th>회원</th><th>쿠폰명</th><th>할인값</th><th>발급경로</th><th>발급일</th><th>상태</th></tr></thead>
                          <tbody>
                            {pagedCouponLogs.length === 0 ? (
                              <tr><td colSpan={6} style={{ textAlign:'center', padding:'40px 0', color:'#94A3B8' }}>지급 내역이 없습니다</td></tr>
                            ) : pagedCouponLogs.map(l => (
                              <tr key={l.id}>
                                <td>{l.name} <span className="adm-muted" style={{ fontSize:11 }}>{l.email}</span></td>
                                <td style={{ fontWeight:600 }}>{l.couponName}</td>
                                <td><strong>{l.discountLabel}</strong></td>
                                <td className="adm-muted">{l.source}</td>
                                <td className="adm-muted">{l.issued_at ? l.issued_at.slice(0,10) : '-'}</td>
                                <td>
                                  <span className={`adm-badge ${l.status === '사용완료' ? 'badge-off' : l.status === '만료' ? 'badge-off' : 'badge-on'}`}>{l.status}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <Pager page={clCur} pageSize={clSize} total={clFiltered.length} onPage={setClPage} onPageSize={setClSize} />
                  </div>
                  )}

                  {couponTab === 'tab-point' && (<>
                  {/* 포인트 적립 설정 */}
                  <div className="adm-card" style={{ marginBottom:24, padding:'20px 22px' }}>
                    <div className="adm-card-head" style={{ paddingBottom:16, marginBottom:18, borderBottom:'1px solid #EEF2F6' }}>
                      <div>
                        <div className="adm-card-title">포인트 적립 설정</div>
                        <div className="adm-muted" style={{ fontSize:12, marginTop:4 }}>구매액에 대한 포인트 적립률과 적용일을 설정할 수 있습니다.</div>
                      </div>
                    </div>
                    {/* 시스템 활성화 토글 */}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, padding:'14px 16px', background:'#F8FAFC', border:'1px solid #EEF2F6', borderRadius:8, margin:'0 0 18px' }}>
                      <div>
                        <div style={{ fontWeight:700, fontSize:13 }}>포인트 시스템 활성화</div>
                        <div className="adm-muted" style={{ fontSize:11, marginTop:2 }}>포인트 적립 및 사용 기능을 활성화합니다.</div>
                      </div>
                      <Toggle defaultOn={siteSettings.point_enabled !== 'false'} onChange={togglePointEnabled} />
                    </div>
                    {/* 적립률은 등급별 설정으로 이전 */}
                    <div style={{ padding:'12px 14px', background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:8, fontSize:12.5, color:'#92400E', lineHeight:1.6 }}>
                      포인트 <b>적립률은 회원 등급별</b>로 적용됩니다. <b>멤버십 관리</b> 탭에서 등급마다 적립률·적용일을 관리하세요.
                    </div>
                  </div>
                  </>)}

                  {couponTab === 'tab-membership' && (<>
                  {/* ===== 멤버십 등급 설정 ===== */}
                  <div className="adm-card" style={{ marginBottom:24, padding:'20px 22px' }}>
                    <div className="adm-card-head" style={{ paddingBottom:16, marginBottom:18, borderBottom:'1px solid #EEF2F6', alignItems:'flex-start' }}>
                      <div>
                        <div className="adm-card-title">멤버십 등급 설정</div>
                        <div className="adm-muted" style={{ fontSize:12, marginTop:4 }}>등급별 적립률·산정 임계값·월 발급 쿠폰을 설정합니다. 분기 누적 구매로 자동 산정됩니다.</div>
                      </div>
                    </div>

                    {/* 운영 토글 + 재산정 */}
                    <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:18 }}>
                      {([
                        ['membership_monthly_on', '월 쿠폰팩 발급'],
                        ['membership_birthday_on', '생일쿠폰(5천원)'],
                        ['membership_auto_recalc', '분기 자동 재산정'],
                      ] as const).map(([key, label]) => (
                        <div key={key} style={{ flex:'1 1 200px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, padding:'12px 14px', background:'#F8FAFC', border:'1px solid #EEF2F6', borderRadius:8 }}>
                          <span style={{ fontSize:13, fontWeight:600, color:'#334155' }}>{label}</span>
                          <Toggle defaultOn={siteSettings[key] !== 'false'} onChange={v => saveMembershipToggle(key, v)} />
                        </div>
                      ))}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18, flexWrap:'wrap' }}>
                      <button className="adm-btn adm-btn-outline" disabled={recalcRunning} onClick={recalcGradesNow}>
                        {recalcRunning ? '재산정 중...' : '지금 재산정'}
                      </button>
                      <span className="adm-muted" style={{ fontSize:12 }}>
                        마지막 재산정: {siteSettings.membership_last_recalc || '없음'} · 수동 변경(잠금) 회원은 제외
                      </span>
                    </div>

                    {/* 등급별 표 */}
                    <div className="adm-table-wrap" style={{ overflowX:'auto' }}>
                      <table className="adm-table" style={{ minWidth:760 }}>
                        <thead>
                          <tr>
                            <th style={{ minWidth:84 }}>등급</th>
                            <th style={{ minWidth:96 }}>적립률(%)</th>
                            <th style={{ minWidth:170 }}>예약 적립률 / 적용일</th>
                            <th style={{ minWidth:120 }}>분기 누적금액(원)</th>
                            <th style={{ minWidth:84 }}>구매횟수</th>
                            <th style={{ minWidth:210 }}>월 발급 쿠폰</th>
                            <th style={{ minWidth:70 }}>월 발급</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mTiers.map(t => (
                            <tr key={t.grade}>
                              <td><span className={`adm-badge ${GRADE_BADGE_CLS[t.grade] || 'badge-normal'}`}>{t.label}</span></td>
                              <td>
                                <input type="number" className="adm-input-text" style={{ width:70 }} min={0} max={10} step={0.5}
                                  value={String(t.point_rate)} onChange={e => updateTier(t.grade, { point_rate: Number(e.target.value) })} />
                              </td>
                              <td>
                                <div style={{ display:'flex', gap:5, alignItems:'center' }}>
                                  <input type="number" className="adm-input-text" style={{ width:58 }} min={0} max={10} step={0.5} placeholder="-"
                                    value={t.point_rate_next == null ? '' : String(t.point_rate_next)}
                                    onChange={e => updateTier(t.grade, { point_rate_next: e.target.value === '' ? null : Number(e.target.value) })} />
                                  <input type="date" className="adm-input-text" style={{ width:138 }} min={new Date().toISOString().slice(0,10)}
                                    value={t.apply_date || ''} onChange={e => updateTier(t.grade, { apply_date: e.target.value || null })} />
                                </div>
                              </td>
                              <td>
                                <input type="number" className="adm-input-text" style={{ width:110 }} min={0} step={10000}
                                  value={String(t.min_amount)} onChange={e => updateTier(t.grade, { min_amount: Number(e.target.value) })} />
                              </td>
                              <td>
                                <input type="number" className="adm-input-text" style={{ width:64 }} min={0} step={1}
                                  value={String(t.min_count)} onChange={e => updateTier(t.grade, { min_count: Number(e.target.value) })} />
                              </td>
                              <td>
                                <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                                  {membershipCoupons.length === 0 ? (
                                    <span className="adm-muted" style={{ fontSize:11 }}>쿠폰 관리 탭에서 멤버십 쿠폰을 먼저 등록하세요.</span>
                                  ) : membershipCoupons.map(c => (
                                    <label key={c.id} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11.5, cursor:'pointer' }}>
                                      <input type="checkbox" checked={!!c.code && t.coupon_codes.includes(c.code)} disabled={!c.code} onChange={() => c.code && toggleTierCoupon(t.grade, c.code)} />
                                      {c.name} <span className="adm-muted">({c.discount_type === 'percent' ? `${c.discount_value}%` : `${fmtPrice(c.discount_value)}원`})</span>
                                    </label>
                                  ))}
                                </div>
                              </td>
                              <td>
                                <Toggle defaultOn={t.monthly_active} onChange={v => updateTier(t.grade, { monthly_active: v })} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="adm-muted" style={{ fontSize:11, marginTop:10, lineHeight:1.6 }}>
                      예약 적립률은 적용일이 지나면 자동 반영됩니다(소급 X). 분기 누적금액·구매횟수는 둘 다 충족해야 해당 등급으로 승급됩니다.
                      생일쿠폰은 전 등급 공통으로 생일월에 자동 발급됩니다.
                    </div>
                    <div style={{ display:'flex', gap:8, marginTop:16, justifyContent:'flex-end' }}>
                      <button className="adm-btn adm-btn-primary" disabled={mSaving} onClick={saveMTiers}>{mSaving ? '저장 중...' : '등급 설정 저장'}</button>
                    </div>
                  </div>

                  {/* 멤버십 월발급 쿠폰팩 (is_membership) */}
                  {(() => {
                    const pack = coupons.filter(c => c.is_membership);
                    const today = new Date().toISOString().slice(0,10);
                    return (
                      <div className="adm-card" style={{ marginBottom:24, padding:'20px 22px' }}>
                        <div className="adm-card-head" style={{ alignItems:'center' }}>
                          <span className="adm-card-title">멤버십 월발급 쿠폰팩</span>
                          <button className="adm-btn adm-btn-primary" style={{ marginLeft:'auto' }} onClick={openMembershipCouponModal}>+ 멤버십 쿠폰 추가</button>
                        </div>
                        <div className="adm-muted" style={{ fontSize:12, margin:'2px 0 12px' }}>
                          여기에 등록한 쿠폰을 <strong>위 등급 설정</strong>의 ‘월 발급 쿠폰’에서 등급별로 골라 매월 자동 발급합니다. ({pack.filter(c=>c.is_active).length}종 활성)
                        </div>
                        {pack.length === 0 ? (
                          <div className="adm-muted" style={{ fontSize:13, padding:'6px 0' }}>등록된 멤버십 쿠폰이 없습니다. 우측 “+ 멤버십 쿠폰 추가”로 만드세요.</div>
                        ) : (
                          <div className="adm-table-wrap">
                            <table className="adm-table">
                              <thead><tr><th>쿠폰명</th><th>할인값</th><th>유효기간</th><th>상태</th><th>관리</th></tr></thead>
                              <tbody>
                                {pack.map(c => {
                                  const relative = c.valid_days != null;
                                  const expiredFixed = !relative && !!c.expires_at && c.expires_at.slice(0,10) < today;
                                  return (
                                    <tr key={c.id} style={{ opacity: c.is_active ? 1 : 0.55 }}>
                                      <td style={{ fontWeight:700 }}>{c.name}</td>
                                      <td style={{ fontWeight:800 }}>{c.discount_type === 'percent' ? `${c.discount_value}%` : `${fmtPrice(c.discount_value)}원`}</td>
                                      <td className="adm-muted">
                                        {relative ? <strong style={{ color:'#475569' }}>발급일 +{c.valid_days}일</strong> : (c.expires_at ? `${c.expires_at.slice(0,10)} 고정` : '무제한')}
                                        {expiredFixed && <span style={{ fontSize:11, color:'#DC2626', fontWeight:700, marginLeft:6 }}>⚠️ 만료일 지남</span>}
                                      </td>
                                      <td>{c.is_active ? <span className="adm-badge badge-on">활성</span> : <span className="adm-badge badge-off">비활성</span>}</td>
                                      <td>
                                        <div style={{ display:'flex', gap:6 }}>
                                          <button className="adm-row-btn" style={{ color:'#2563EB' }} onClick={() => openGiveCouponModal(c)}>지급</button>
                                          <button className="adm-row-btn" onClick={() => openCouponModal(c)}>수정</button>
                                          <button className="adm-row-btn adm-row-btn-danger" onClick={() => deleteCoupon(c.id)}>삭제</button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  </>)}

                  {couponTab === 'tab-point' && (<>
                  {/* KPI */}
                  <div className="adm-kpi-grid adm-kpi-3 adm-kpi-mb16">
                    {[
                      ['전체 보유 포인트', `${fmtPrice(pointStats.total)}P`],
                      ['이번달 지급',      `+${fmtPrice(pointStats.monthGiven)}P`],
                      ['이번달 사용',      `-${fmtPrice(pointStats.monthUsed)}P`],
                    ].map(([l,v]) => (
                      <div key={l} className="adm-kpi-card">
                        <div className="adm-kpi-label">{l}</div>
                        <div className="adm-kpi-value adm-kpi-value-mt">{v}</div>
                      </div>
                    ))}
                  </div>

                  {/* 툴바 */}
                  <div className="adm-toolbar">
                    <div className="adm-toolbar-left">
                      <AdmSelect value={pointFilter} onChange={v => setPointFilter(v as 'all'|'has'|'none')}
                        options={[{ value:'all', label:'전체 회원' }, { value:'has', label:'포인트 있는 회원' }, { value:'none', label:'포인트 없는 회원' }]} />
                      <input type="text" className="adm-input-text" placeholder="이름·이메일·연락처 검색"
                        value={pointSearch} onChange={e => setPointSearch(e.target.value)} />
                    </div>
                    <div className="adm-toolbar-right">
                      <button className="adm-btn adm-btn-outline" onClick={loadPointData}>
                        <span className="adm-btn-icon"><Icon.Refresh /></span>새로고침
                      </button>
                    </div>
                  </div>

                  {/* 회원 목록 */}
                  <div className="adm-card">
                    {pointMembersLoading ? <PanelLoading /> : (
                      <div className="adm-table-wrap">
                        <table className="adm-table">
                          <thead>
                            <tr><th>이름</th><th>이메일</th><th>등급</th><th className="adm-num">보유 포인트</th><th>관리</th></tr>
                          </thead>
                          <tbody>
                            {filteredPointMembers.length === 0 ? (
                              <tr><td colSpan={5} style={{ textAlign:'center', padding:'40px 0', color:'#94A3B8' }}>회원 없음</td></tr>
                            ) : pagedPointMembers.map(m => (
                              <tr key={m.id}>
                                <td style={{ fontWeight:500 }}>{m.name}</td>
                                <td className="adm-muted">{m.email}</td>
                                <td>
                                  <span className={`adm-badge ${GRADE_BADGE_CLS[m.grade]||'badge-normal'}`}>
                                    {GRADE_LABEL[m.grade]||m.grade}
                                  </span>
                                </td>
                                <td className="adm-mono adm-num" style={{ fontWeight:600, color: (m.point_balance||0) > 0 ? '#2D7A4D' : '#94A3B8' }}>
                                  {fmtPrice(m.point_balance||0)}P
                                </td>
                                <td>
                                  <button className="adm-btn adm-btn-primary" style={{ fontSize:12, padding:'4px 12px' }}
                                    onClick={() => { setGivePointTarget(m); setGivePointForm({ amount:'', desc:'' }); setGivePointModal(true); }}>
                                    포인트 지급
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                  <Pager page={pmCur} pageSize={pmSize} total={filteredPointMembers.length} onPage={setPmPage} onPageSize={setPmSize} />

                  {/* 포인트 지급/사용 내역 (기간별) */}
                  <div className="adm-toolbar" style={{ marginTop:20, flexWrap:'wrap', gap:8 }}>
                    <div className="adm-toolbar-left" style={{ alignItems:'center', gap:8 }}>
                      <span className="adm-card-title">포인트 내역</span>
                    </div>
                    <div className="adm-toolbar-right" style={{ flexWrap:'wrap', gap:8 }}>
                      <input type="date" className="adm-select" value={pointLogFrom} onChange={e => setPointLogFrom(e.target.value)} />
                      <span style={{ color:'#94A3B8' }}>~</span>
                      <input type="date" className="adm-select" value={pointLogTo} onChange={e => setPointLogTo(e.target.value)} />
                      <button className="adm-btn adm-btn-primary" onClick={() => loadPointLogs()}>조회</button>
                    </div>
                  </div>
                  <div className="adm-card">
                    <div className="adm-table-wrap">
                      <table className="adm-table">
                        <thead><tr><th>일시</th><th>회원</th><th>구분</th><th className="adm-num">포인트</th><th>사유</th></tr></thead>
                        <tbody>
                          {pointLogs.length === 0 ? (
                            <tr><td colSpan={5} style={{ textAlign:'center', padding:'40px 0', color:'#94A3B8' }}>해당 기간 포인트 내역이 없습니다.</td></tr>
                          ) : pagedPointLogs.map(l => (
                            <tr key={l.id}>
                              <td className="adm-muted">{fmtDate(l.created_at)}</td>
                              <td>{l.profiles?.name || '-'} <span className="adm-muted" style={{ fontSize:11 }}>{l.profiles?.email || ''}</span></td>
                              <td>
                                <span className={`adm-badge ${l.amount >= 0 ? 'badge-paid' : 'badge-off'}`}>
                                  {l.amount >= 0 ? '적립' : '사용'}
                                </span>
                              </td>
                              <td className="adm-mono adm-num" style={{ fontWeight:600, color: l.amount >= 0 ? '#2D7A4D' : '#DC2626' }}>
                                {l.amount >= 0 ? '+' : ''}{fmtPrice(l.amount)}P
                              </td>
                              <td className="adm-muted">{l.description || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <Pager page={plCur} pageSize={plSize} total={pointLogs.length} onPage={setPlPage} onPageSize={setPlSize} />
                  </>)}
                </>
              )}
            </div>
          )}

          {/* ===== 배너 관리 ===== */}
          {panel === 'banner' && (
            <div className="adm-content">
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, flexWrap:'wrap' }}>
                <TabBtns active={bannerTab} setActive={setBannerTab}
                  tabs={[
                    { id:'tab-banner',   label:'메인 배너' },
                    { id:'tab-mid',      label:'중간 배너' },
                    { id:'tab-catpromo', label:'카테고리 배너' },
                    { id:'tab-popup',    label:'팝업' },
                  ]} />
                <button className="adm-btn adm-btn-outline" onClick={openMediaHistory}>📜 변경 이력</button>
              </div>

              {/* ── 배너 탭 (메인 / 중간 / 카테고리) ── */}
              {(bannerTab === 'tab-banner' || bannerTab === 'tab-mid' || bannerTab === 'tab-catpromo') && (() => {
                const bannerType = bannerTab === 'tab-banner' ? 'main' : bannerTab === 'tab-mid' ? 'mid' : 'cat_promo';
                const list = banners.filter(b => b.type === bannerType);
                const totView = list.reduce((s, b) => s + (b.view_count || 0), 0);
                const totClick = list.reduce((s, b) => s + (b.click_count || 0), 0);
                const avgCtr = totView > 0 ? (totClick / totView * 100) : 0;
                return (
                <>
                  <div className="adm-kpi-grid adm-kpi-3 adm-kpi-mb16">
                    {[
                      ['총 조회수', `${totView.toLocaleString()}`],
                      ['총 클릭수', `${totClick.toLocaleString()}`],
                      ['평균 CTR', `${avgCtr.toFixed(2)}%`],
                    ].map(([l, v]) => (
                      <div key={l} className="adm-kpi-card"><div className="adm-kpi-label">{l}</div><div className="adm-kpi-value adm-kpi-value-mt">{v}</div></div>
                    ))}
                  </div>
                  <div className="adm-toolbar">
                    <div className="adm-toolbar-left" />
                    <div className="adm-toolbar-right">
                      <button className="adm-btn adm-btn-outline" onClick={loadBanners}><span className="adm-btn-icon"><Icon.Refresh /></span>새로고침</button>
                      <button className="adm-btn adm-btn-primary" onClick={() => {
                        setBnForm({ type: bannerType, link_url: '/', is_active: true });
                        openBannerModal();
                      }}>+ 배너 등록</button>
                    </div>
                  </div>
                  {bannersLoading
                    ? <div className="adm-card" style={{ textAlign:'center', padding:40, color:'#94A3B8' }}>불러오는 중...</div>
                    : list.length === 0
                    ? <div className="adm-card" style={{ textAlign:'center', padding:40, color:'#94A3B8' }}>등록된 배너가 없습니다</div>
                    : (
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:16 }}>
                        {list.map(b => {
                          const ctr = (b.view_count || 0) > 0 ? ((b.click_count || 0) / (b.view_count || 1) * 100) : 0;
                          return (
                          <div key={b.id} className="adm-card" style={{ padding:0, overflow:'hidden' }}>
                            {b.image_url
                              ? <img src={b.image_url} alt="" style={{ width:'100%', aspectRatio:'2.2/1', objectFit:'cover', display:'block', background:'#F0F0EE' }} />
                              : <div style={{ width:'100%', aspectRatio:'2.2/1', background:'#F0F0EE' }} />}
                            <div style={{ padding:'12px 14px' }}>
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                                <button onClick={() => toggleBannerActive(b)} style={{ fontSize:11, padding:'3px 10px', borderRadius:99, border:'none', cursor:'pointer', background: b.is_active?'#DCFCE7':'#F1F5F9', color: b.is_active?'#16A34A':'#64748B', fontWeight:700 }}>
                                  {b.is_active ? '노출중' : '숨김'}
                                </button>
                                <span style={{ fontSize:11, color:'#94A3B8' }}>순서 {b.sort_order}</span>
                              </div>
                              <div className="adm-muted" style={{ fontSize:12, marginBottom:10, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>🔗 {b.link_url || '/'}</div>
                              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:10 }}>
                                {[['조회', (b.view_count||0).toLocaleString()], ['클릭', (b.click_count||0).toLocaleString()], ['CTR', `${ctr.toFixed(1)}%`]].map(([l,v]) => (
                                  <div key={l} style={{ background:'#F8FAFC', borderRadius:6, padding:'6px 4px', textAlign:'center' }}>
                                    <div style={{ fontSize:10, color:'#94A3B8' }}>{l}</div>
                                    <div style={{ fontSize:13, fontWeight:700, color:'#1A1A1A' }}>{v}</div>
                                  </div>
                                ))}
                              </div>
                              <div style={{ display:'flex', gap:6 }}>
                                <button className="adm-btn adm-btn-outline" style={{ flex:1, fontSize:12 }} onClick={() => openBannerModal(b)}>수정</button>
                                <button className="adm-btn adm-btn-outline" style={{ flex:1, fontSize:12, color:'#DC2626', borderColor:'#FECACA' }} onClick={() => deleteBanner(b.id)}>삭제</button>
                              </div>
                            </div>
                          </div>
                        ); })}
                      </div>
                    )
                  }
                </>
                );
              })()}

              {/* ── 팝업 탭 ── */}
              {bannerTab === 'tab-popup' && (
                <>
                  <div className="adm-toolbar">
                    <div className="adm-toolbar-left">
                      <div style={{ fontSize:12, color:'#64748B' }}>
                        사이트 접속 시 뜨는 팝업을 관리합니다. 기간이 설정된 팝업은 기간 내에만 표시됩니다.
                      </div>
                    </div>
                    <div className="adm-toolbar-right">
                      <button className="adm-btn adm-btn-outline" onClick={loadPopups}><span className="adm-btn-icon"><Icon.Refresh /></span>새로고침</button>
                      <button className="adm-btn adm-btn-primary" onClick={() => openPopupModal()}>+ 팝업 등록</button>
                    </div>
                  </div>
                  {popupsLoading
                    ? <div className="adm-card" style={{ textAlign:'center', padding:40, color:'#94A3B8' }}>불러오는 중...</div>
                    : popups.length === 0
                    ? <div className="adm-card" style={{ textAlign:'center', padding:40, color:'#94A3B8' }}>등록된 팝업이 없습니다 (popups 테이블 생성 필요)</div>
                    : (
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:16 }}>
                        {popups.map(p => {
                          const posLabel: Record<string, string> = { center:'중앙', left:'좌측', right:'우측' };
                          const now = new Date();
                          const expired = !!(p.ends_at && new Date(p.ends_at) < now);
                          const notYet  = !!(p.starts_at && new Date(p.starts_at) > now);
                          return (
                            <div key={p.id} className="adm-card" style={{ padding:0, overflow:'hidden', opacity: expired ? 0.55 : 1 }}>
                              {p.image_url
                                ? <img src={p.image_url} alt="" style={{ width:'100%', aspectRatio:'1/1', objectFit:'cover', display:'block', background:'#F0F0EE' }} />
                                : <div style={{ width:'100%', aspectRatio:'1/1', background:'#F0F0EE' }} />}
                              <div style={{ padding:'12px 14px' }}>
                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                                  <button onClick={() => togglePopupActive(p)} style={{ fontSize:11, padding:'3px 10px', borderRadius:99, border:'none', cursor:'pointer', background: p.is_active?'#DCFCE7':'#F1F5F9', color: p.is_active?'#16A34A':'#64748B', fontWeight:700 }}>
                                    {p.is_active ? '노출중' : '숨김'}
                                  </button>
                                  <span style={{ fontSize:11, background:'#F1F5F9', borderRadius:99, padding:'2px 8px' }}>{posLabel[p.position] || p.position} · {p.width}px</span>
                                </div>
                                <div style={{ fontWeight:600, fontSize:14, marginBottom:6, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                  {p.title || <span style={{ color:'#94A3B8' }}>제목 없음</span>}
                                </div>
                                <div style={{ fontSize:11, color:'#64748B', marginBottom:10 }}>
                                  {p.starts_at || p.ends_at ? (
                                    <>
                                      {p.starts_at && <span>시작 {fmtDateShort(p.starts_at)} </span>}
                                      {p.ends_at && <span>~ 종료 {fmtDateShort(p.ends_at)}</span>}
                                      {expired && <span style={{ color:'#DC2626', fontWeight:700, marginLeft:4 }}>만료</span>}
                                      {notYet && <span style={{ color:'#F59E0B', fontWeight:700, marginLeft:4 }}>예정</span>}
                                    </>
                                  ) : <span style={{ color:'#94A3B8' }}>상시 노출</span>}
                                </div>
                                <div style={{ display:'flex', gap:6 }}>
                                  <button className="adm-btn adm-btn-outline" style={{ flex:1, fontSize:12 }} onClick={() => openPopupModal(p)}>수정</button>
                                  <button className="adm-btn adm-btn-outline" style={{ flex:1, fontSize:12, color:'#DC2626', borderColor:'#FECACA' }} onClick={() => deletePopup(p.id)}>삭제</button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  }

                </>
              )}

              {/* ── 팝업 등록/수정 모달 ── */}
              {popupModal && (() => {
                const QUICK_LINKS_PP = [
                  { label:'홈',           url:'/' },
                  { label:'신상품',        url:'/category?new=true' },
                  { label:'베스트',        url:'/category?sort=best' },
                  { label:'국산과일',      url:'/category?origin=domestic' },
                  { label:'수입과일',      url:'/category?origin=import' },
                  { label:'이벤트',        url:'/event' },
                  { label:'라운지',        url:'/lounge' },
                  { label:'직접 입력',     url:'__custom__' },
                ];
                const isPpCustom = !QUICK_LINKS_PP.slice(0, -1).some(l => l.url === ppForm.link_url);
                const ppDropVal  = isPpCustom ? '__custom__' : ppForm.link_url;
                return (
                  <div className="adm-modal-bg open" onClick={() => setPopupModal(false)}>
                    <div className="adm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth:500, width:'95vw', maxHeight:'90vh', overflowY:'auto' }}>
                      <div className="adm-modal-head">
                        <span className="adm-modal-title">{editingPopup ? '팝업 수정' : '팝업 등록'}</span>
                        <button className="adm-modal-close" onClick={() => setPopupModal(false)}>✕</button>
                      </div>
                      <div className="adm-modal-body" style={{ display:'flex', flexDirection:'column', gap:18 }}>

                        {/* 이미지 업로드 */}
                        <div>
                          <label className="adm-label">💻 PC 이미지 * <span style={{ fontWeight:400, color:'#94A3B8' }}>(권장 800×830px @2x)</span></label>
                          <input ref={ppImgRef} type="file" accept="image/*" style={{ display:'none' }}
                            onChange={async e => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const url = await uploadPopupImage(file);
                              if (url) setPpImgUrl(url);
                              e.target.value = '';
                            }} />
                          <div
                            onClick={() => !ppUploading && ppImgRef.current?.click()}
                            onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.borderColor = '#3B82F6'; (e.currentTarget as HTMLDivElement).style.background = '#EFF6FF'; }}
                            onDragLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#CBD5E1'; (e.currentTarget as HTMLDivElement).style.background = ppImgUrl ? '#000' : '#F8FAFC'; }}
                            onDrop={async e => {
                              e.preventDefault();
                              (e.currentTarget as HTMLDivElement).style.borderColor = '#CBD5E1';
                              (e.currentTarget as HTMLDivElement).style.background = '#F8FAFC';
                              const file = e.dataTransfer.files?.[0];
                              if (!file || !file.type.startsWith('image/')) return;
                              const url = await uploadPopupImage(file);
                              if (url) setPpImgUrl(url);
                            }}
                            style={{
                              position:'relative', border:'2px dashed #CBD5E1', borderRadius:12,
                              background: ppImgUrl ? '#000' : '#F8FAFC',
                              height:160, display:'flex', alignItems:'center', justifyContent:'center',
                              cursor: ppUploading ? 'wait' : 'pointer', overflow:'hidden',
                              transition:'border-color .15s, background .15s',
                            }}>
                            {ppImgUrl ? (
                              <>
                                <img src={ppImgUrl} alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', opacity:0.85 }} />
                                <div style={{ position:'relative', zIndex:1, background:'rgba(0,0,0,0.55)', borderRadius:8, padding:'6px 14px', color:'#fff', fontSize:13, fontWeight:600 }}>
                                  {ppUploading ? '업로드 중...' : '클릭 또는 드래그로 교체'}
                                </div>
                              </>
                            ) : (
                              <div style={{ textAlign:'center', color:'#94A3B8', pointerEvents:'none' }}>
                                {ppUploading
                                  ? <><div style={{ fontSize:24, marginBottom:8 }}>⏳</div><div style={{ fontSize:13 }}>업로드 중...</div></>
                                  : <><div style={{ fontSize:32, marginBottom:8 }}>🪟</div><div style={{ fontSize:13, fontWeight:600 }}>클릭 또는 이미지 드래그</div><div style={{ fontSize:11, marginTop:4 }}>JPG, PNG, WebP 지원</div></>
                                }
                              </div>
                            )}
                          </div>
                          <div style={{ fontSize:11, color:'#94A3B8', marginTop:5 }}>
                            권장: 팝업 너비에 맞는 이미지 (기본 400px)
                          </div>
                        </div>

                        {/* 모바일 팝업 이미지 (선택) */}
                        <div>
                          <label className="adm-label">📱 모바일 이미지 <span style={{ fontWeight:400, color:'#94A3B8' }}>(선택 · 없으면 PC 이미지 공용)</span></label>
                          <input ref={ppImgRefMobile} type="file" accept="image/*" style={{ display:'none' }}
                            onChange={async e => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const url = await uploadPopupImage(file);
                              if (url) setPpImgUrlMobile(url);
                              e.target.value = '';
                            }} />
                          <div
                            onClick={() => !ppUploading && ppImgRefMobile.current?.click()}
                            onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.borderColor = '#15803D'; (e.currentTarget as HTMLDivElement).style.background = '#F0FDF4'; }}
                            onDragLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#CBD5E1'; (e.currentTarget as HTMLDivElement).style.background = ppImgUrlMobile ? '#000' : '#F8FAFC'; }}
                            onDrop={async e => {
                              e.preventDefault();
                              (e.currentTarget as HTMLDivElement).style.borderColor = '#CBD5E1';
                              (e.currentTarget as HTMLDivElement).style.background = '#F8FAFC';
                              const file = e.dataTransfer.files?.[0];
                              if (!file || !file.type.startsWith('image/')) return;
                              const url = await uploadPopupImage(file);
                              if (url) setPpImgUrlMobile(url);
                            }}
                            style={{
                              position:'relative', border:'2px dashed #CBD5E1', borderRadius:12,
                              background: ppImgUrlMobile ? '#000' : '#F8FAFC',
                              height:130, display:'flex', alignItems:'center', justifyContent:'center',
                              cursor: ppUploading ? 'wait' : 'pointer', overflow:'hidden',
                              transition:'border-color .15s, background .15s',
                            }}>
                            {ppImgUrlMobile ? (
                              <>
                                <img src={ppImgUrlMobile} alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', opacity:0.85 }} />
                                <button type="button" onClick={e => { e.stopPropagation(); setPpImgUrlMobile(''); }}
                                  style={{ position:'absolute', top:8, right:8, zIndex:2, width:24, height:24, borderRadius:'50%', border:'none', background:'rgba(0,0,0,0.6)', color:'#fff', cursor:'pointer', fontSize:13 }}>✕</button>
                                <div style={{ position:'relative', zIndex:1, background:'rgba(0,0,0,0.55)', borderRadius:8, padding:'6px 14px', color:'#fff', fontSize:13, fontWeight:600 }}>
                                  클릭 또는 드래그로 교체
                                </div>
                              </>
                            ) : (
                              <div style={{ textAlign:'center', color:'#94A3B8', pointerEvents:'none' }}>
                                <div style={{ fontSize:28, marginBottom:6 }}>📱</div>
                                <div style={{ fontSize:13, fontWeight:600 }}>모바일 전용 이미지 (선택)</div>
                                <div style={{ fontSize:11, marginTop:4 }}>안 올리면 PC 이미지가 모바일에도 표시됩니다</div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 제목 */}
                        <div>
                          <label className="adm-label">팝업 제목 (선택)</label>
                          <input className="adm-input-text" style={{ width:'100%' }}
                            placeholder="예: 봄맞이 특가 이벤트"
                            value={ppForm.title}
                            onChange={e => setPpForm(f => ({ ...f, title: e.target.value }))} />
                          <div style={{ fontSize:11, color:'#94A3B8', marginTop:4 }}>
                            이미지만 표시하려면 비워두세요.
                          </div>
                        </div>

                        {/* 링크 URL */}
                        <div>
                          <label className="adm-label">클릭 시 이동 페이지</label>
                          <AdmSelect className="adm-cs-full" style={{ marginBottom:8 }} value={ppDropVal}
                            onChange={v => {
                              if (v === '__custom__') setPpForm(f => ({ ...f, link_url: isPpCustom ? f.link_url : '' }));
                              else setPpForm(f => ({ ...f, link_url: v }));
                            }}
                            options={QUICK_LINKS_PP.map(l => ({ value:l.url, label:`${l.label}${l.url !== '__custom__' ? ` — ${l.url}` : ''}` }))} />
                          {(isPpCustom || ppDropVal === '__custom__') && (
                            <input className="adm-input-text" style={{ width:'100%' }}
                              placeholder="예: /event/spring-sale"
                              value={ppForm.link_url}
                              onChange={e => setPpForm(f => ({ ...f, link_url: e.target.value }))} />
                          )}
                        </div>

                        {/* 너비 / 위치 */}
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                          <div>
                            <label className="adm-label">팝업 너비 (px)</label>
                            <input className="adm-input-text" style={{ width:'100%' }} type="number"
                              min={200} max={900} step={10}
                              value={ppForm.width}
                              onChange={e => setPpForm(f => ({ ...f, width: Number(e.target.value) }))} />
                            <div style={{ fontSize:11, color:'#94A3B8', marginTop:3 }}>권장: 300~600px</div>
                          </div>
                          <div>
                            <label className="adm-label">팝업 위치</label>
                            <AdmSelect className="adm-cs-full" value={ppForm.position}
                              onChange={v => setPpForm(f => ({ ...f, position: v }))}
                              options={[{ value:'center', label:'중앙' }, { value:'left', label:'좌측' }, { value:'right', label:'우측' }]} />
                          </div>
                        </div>

                        {/* 노출 기간 */}
                        <div>
                          <label className="adm-label">노출 기간 (비우면 상시 노출)</label>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                            <div>
                              <div style={{ fontSize:11, color:'#64748B', marginBottom:4 }}>시작일시</div>
                              <input className="adm-input-text" style={{ width:'100%' }} type="datetime-local"
                                value={ppForm.starts_at}
                                onChange={e => setPpForm(f => ({ ...f, starts_at: e.target.value }))} />
                            </div>
                            <div>
                              <div style={{ fontSize:11, color:'#64748B', marginBottom:4 }}>종료일시</div>
                              <input className="adm-input-text" style={{ width:'100%' }} type="datetime-local"
                                value={ppForm.ends_at}
                                onChange={e => setPpForm(f => ({ ...f, ends_at: e.target.value }))} />
                            </div>
                          </div>
                        </div>

                        {/* 활성 */}
                        <div style={{ background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:8, padding:'12px 14px' }}>
                          <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', userSelect:'none' }}>
                            <input type="checkbox" checked={ppForm.is_active}
                              onChange={e => setPpForm(f => ({ ...f, is_active: e.target.checked }))}
                              style={{ width:16, height:16, cursor:'pointer', flexShrink:0 }} />
                            <div>
                              <div style={{ fontSize:13, fontWeight:600 }}>즉시 노출</div>
                              <div style={{ fontSize:11, color:'#94A3B8', marginTop:1 }}>체크 해제 시 저장만 되고 사이트에 표시되지 않습니다</div>
                            </div>
                          </label>
                        </div>

                      </div>
                      <div style={{ display:'flex', justifyContent:'flex-end', gap:8, padding:'0 20px 20px' }}>
                        <button className="adm-btn adm-btn-outline" onClick={() => setPopupModal(false)}>취소</button>
                        <button className="adm-btn adm-btn-primary" onClick={savePopup} disabled={ppSaving || ppUploading}>
                          {ppSaving ? '저장 중...' : '저장'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 변경 이력 모달 */}
              {mediaHistoryOpen && (
                <div className="adm-modal-bg open" onClick={() => setMediaHistoryOpen(false)}>
                  <div className="adm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth:780, width:'95vw', maxHeight:'90vh', overflowY:'auto' }}>
                    <div className="adm-modal-head">
                      <span className="adm-modal-title">📜 배너 / 팝업 변경 이력</span>
                      <button className="adm-modal-close" onClick={() => setMediaHistoryOpen(false)}>✕</button>
                    </div>
                    <div className="adm-modal-body">
                    <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:16 }}>
                      <AdmSelect value={mhFilter} onChange={v => { setMhFilter(v as 'all'|'banner'|'popup'); setMhPage(1); }}
                        options={[{ value:'all', label:'전체' }, { value:'banner', label:'배너' }, { value:'popup', label:'팝업' }]} />
                      <button className="adm-btn adm-btn-outline" onClick={loadMediaHistory}>새로고침</button>
                      <span className="adm-muted" style={{ fontSize:12, marginLeft:'auto' }}>최근 200건</span>
                    </div>
                    {mhLoading ? <PanelLoading /> : (() => {
                      const rows = mediaHistory.filter(h => mhFilter === 'all' || h.entity_type === mhFilter);
                      if (rows.length === 0) return <div className="adm-muted" style={{ textAlign:'center', padding:'30px 0' }}>변경 이력이 없습니다. (이 기능 적용 후 등록/수정/삭제부터 기록됩니다)</div>;
                      const ACT: Record<string, { t:string; c:string }> = { create:{ t:'등록', c:'badge-on' }, update:{ t:'수정', c:'badge-paid' }, delete:{ t:'삭제', c:'badge-off' } };
                      const mhCur = Math.min(Math.max(1, mhPage), Math.max(1, Math.ceil(rows.length / mhSize)));
                      const pagedRows = rows.slice((mhCur - 1) * mhSize, mhCur * mhSize);
                      return (
                        <>
                        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                          {pagedRows.map(h => {
                            const snap = h.snapshot as Record<string, unknown>;
                            const img = (snap.image_url as string) || (snap.thumbnail_url as string) || '';
                            const act = ACT[h.action] || { t:h.action, c:'badge-off' };
                            return (
                              <div key={h.id} style={{ display:'flex', gap:12, alignItems:'center', border:'1px solid #E2E8F0', borderRadius:8, padding:10 }}>
                                <div style={{ width:88, height:55, borderRadius:6, background:'#F1F5F9', flexShrink:0, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
                                  {img ? <img src={img} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <span style={{ fontSize:11, color:'#94A3B8' }}>이미지 없음</span>}
                                </div>
                                <div style={{ flex:1, minWidth:0 }}>
                                  <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:3, flexWrap:'wrap' }}>
                                    <span className="adm-badge badge-normal">{h.entity_type === 'banner' ? '배너' : '팝업'}</span>
                                    <span className={`adm-badge ${act.c}`}>{act.t}</span>
                                    <span className="adm-muted" style={{ fontSize:11 }}>{fmtDate(h.changed_at)}</span>
                                  </div>
                                  <div style={{ fontSize:12, color:'#475569', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                                    🔗 {(snap.link_url as string) || '-'}{snap.type ? ` · ${String(snap.type)}` : ''}
                                  </div>
                                </div>
                                <button className="adm-row-btn" onClick={() => restoreMedia(h)}>복원</button>
                              </div>
                            );
                          })}
                        </div>
                        <Pager page={mhCur} pageSize={mhSize} total={rows.length} onPage={setMhPage} onPageSize={setMhSize} />
                        </>
                      );
                    })()}
                    </div>
                  </div>
                </div>
              )}

              {/* 배너 등록/수정 모달 */}
              {bannerModal && (() => {
                /* 자주 쓰는 링크 목록 */
                const QUICK_LINKS = [
                  { label:'홈',             url:'/' },
                  { label:'신상품',          url:'/category?new=true' },
                  { label:'베스트',          url:'/category?sort=best' },
                  { label:'국산과일 전체',    url:'/category?origin=domestic' },
                  { label:'수입과일 전체',    url:'/category?origin=import' },
                  { label:'사과/배',         url:'/category?cat=apple' },
                  { label:'감귤류',          url:'/category?cat=citrus' },
                  { label:'베리류',          url:'/category?cat=berry' },
                  { label:'키위',            url:'/category?cat=kiwi' },
                  { label:'망고',            url:'/category?cat=mango' },
                  { label:'포도',            url:'/category?cat=grape' },
                  { label:'선물세트',         url:'/category?cat=gift' },
                  { label:'브랜드소개관',     url:'/brand-intro' },
                  { label:'이벤트',          url:'/event' },
                  { label:'라운지',          url:'/lounge' },
                  { label:'직접 입력',        url:'__custom__' },
                ];
                const isCustomUrl = !QUICK_LINKS.slice(0, -1).some(l => l.url === bnForm.link_url);
                const dropVal = isCustomUrl ? '__custom__' : bnForm.link_url;

                return (
                  <div className="adm-modal-bg open" onClick={() => setBannerModal(false)}>
                    <div className="adm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth:500, width:'95vw', maxHeight:'90vh', overflowY:'auto' }}>
                      <div className="adm-modal-head">
                        <span className="adm-modal-title">{editingBanner ? '배너 수정' : '배너 등록'}</span>
                        <button className="adm-modal-close" onClick={() => setBannerModal(false)}>✕</button>
                      </div>
                      <div className="adm-modal-body" style={{ display:'flex', flexDirection:'column', gap:18 }}>

                        {/* 종류 */}
                        {(() => {
                          const SIZE_HINT: Record<string, { pc: string; mobile: string }> = {
                            main: { pc: '1090×780px (@2x)', mobile: '1080×740px (@2x)' },
                            mid:  { pc: '1060×350px (@2x)', mobile: '1200×480px · 5:2 비율 · 가로 전체(풀폭) 권장' },
                            cat_promo: { pc: '모바일 전용', mobile: '1000×280px 내외 · 가로 긴 카드형 · 모바일 카테고리 상단' },
                          };
                          const hint = SIZE_HINT[bnForm.type];
                          return (
                            <div>
                              <label className="adm-label">배너 종류</label>
                              <AdmSelect className="adm-cs-full" value={bnForm.type}
                                onChange={v => setBnForm(f => ({ ...f, type: v }))}
                                options={[{ value:'main', label:'메인 배너 (상단 슬라이더)' }, { value:'mid', label:'중간 배너 (중단 슬라이더)' }, { value:'cat_promo', label:'카테고리 배너 (모바일 카테고리 상단)' }]} />
                              {hint && (
                                <div style={{ marginTop:6, display:'flex', gap:12, fontSize:12 }}>
                                  {bnForm.type !== 'cat_promo' && (
                                    <span style={{ background:'#EFF6FF', color:'#2563EB', borderRadius:5, padding:'3px 8px', fontWeight:600 }}>
                                      💻 PC {hint.pc}
                                    </span>
                                  )}
                                  <span style={{ background:'#F0FDF4', color:'#15803D', borderRadius:5, padding:'3px 8px', fontWeight:600 }}>
                                    {bnForm.type === 'cat_promo' ? `🖼️ ${hint.mobile}` : `📱 모바일 ${hint.mobile}`}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* 이미지 드래그앤드롭 업로드 (cat_promo는 단일 '이미지', 그 외 'PC 이미지') */}
                        <div>
                          <label className="adm-label">{bnForm.type === 'cat_promo' ? '🖼️ 이미지 *' : '💻 PC 이미지 *'}</label>
                          <input ref={bnImgRef} type="file" accept="image/*" style={{ display:'none' }}
                            onChange={async e => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const url = await uploadBannerImage(file);
                              if (url) setBnImgUrl(url);
                              e.target.value = '';
                            }} />
                          <div
                            onClick={() => !bnUploading && bnImgRef.current?.click()}
                            onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.borderColor = '#3B82F6'; (e.currentTarget as HTMLDivElement).style.background = '#EFF6FF'; }}
                            onDragLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#CBD5E1'; (e.currentTarget as HTMLDivElement).style.background = bnImgUrl ? '#000' : '#F8FAFC'; }}
                            onDrop={async e => {
                              e.preventDefault();
                              (e.currentTarget as HTMLDivElement).style.borderColor = '#CBD5E1';
                              (e.currentTarget as HTMLDivElement).style.background = '#F8FAFC';
                              const file = e.dataTransfer.files?.[0];
                              if (!file || !file.type.startsWith('image/')) return;
                              const url = await uploadBannerImage(file);
                              if (url) setBnImgUrl(url);
                            }}
                            style={{
                              position:'relative', border:'2px dashed #CBD5E1', borderRadius:12,
                              background: bnImgUrl ? '#000' : '#F8FAFC',
                              height:160, display:'flex', alignItems:'center', justifyContent:'center',
                              cursor: bnUploading ? 'wait' : 'pointer', overflow:'hidden',
                              transition:'border-color .15s, background .15s',
                            }}>
                            {bnImgUrl ? (
                              <>
                                <img src={bnImgUrl} alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', opacity:0.85 }} />
                                <div style={{ position:'relative', zIndex:1, background:'rgba(0,0,0,0.55)', borderRadius:8, padding:'6px 14px', color:'#fff', fontSize:13, fontWeight:600 }}>
                                  {bnUploading ? '업로드 중...' : '클릭 또는 드래그로 교체'}
                                </div>
                              </>
                            ) : (
                              <div style={{ textAlign:'center', color:'#94A3B8', pointerEvents:'none' }}>
                                {bnUploading
                                  ? <><div style={{ fontSize:24, marginBottom:8 }}>⏳</div><div style={{ fontSize:13 }}>업로드 중...</div></>
                                  : <><div style={{ fontSize:32, marginBottom:8 }}>🖼️</div><div style={{ fontSize:13, fontWeight:600 }}>클릭 또는 이미지 드래그</div><div style={{ fontSize:11, marginTop:4 }}>JPG, PNG, WebP 지원</div></>
                                }
                              </div>
                            )}
                          </div>
                          <div style={{ fontSize:11, color:'#94A3B8', marginTop:5 }}>
                            JPG, PNG, WebP · 최대 5MB · 위 종류 선택 시 권장 사이즈 표시
                          </div>
                        </div>

                        {/* 모바일 이미지 드래그앤드롭 업로드 (선택) — 카테고리 배너는 모바일 전용이라 단일 이미지만 사용, 이 칸 숨김 */}
                        {bnForm.type !== 'cat_promo' && (
                        <div>
                          <label className="adm-label">📱 모바일 이미지 <span style={{ fontWeight:400, color:'#94A3B8' }}>(선택 · 없으면 PC 이미지 공용)</span></label>
                          <input ref={bnImgRefMobile} type="file" accept="image/*" style={{ display:'none' }}
                            onChange={async e => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const url = await uploadBannerImage(file);
                              if (url) setBnImgUrlMobile(url);
                              e.target.value = '';
                            }} />
                          <div
                            onClick={() => !bnUploading && bnImgRefMobile.current?.click()}
                            onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.borderColor = '#15803D'; (e.currentTarget as HTMLDivElement).style.background = '#F0FDF4'; }}
                            onDragLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#CBD5E1'; (e.currentTarget as HTMLDivElement).style.background = bnImgUrlMobile ? '#000' : '#F8FAFC'; }}
                            onDrop={async e => {
                              e.preventDefault();
                              (e.currentTarget as HTMLDivElement).style.borderColor = '#CBD5E1';
                              (e.currentTarget as HTMLDivElement).style.background = '#F8FAFC';
                              const file = e.dataTransfer.files?.[0];
                              if (!file || !file.type.startsWith('image/')) return;
                              const url = await uploadBannerImage(file);
                              if (url) setBnImgUrlMobile(url);
                            }}
                            style={{
                              position:'relative', border:'2px dashed #CBD5E1', borderRadius:12,
                              background: bnImgUrlMobile ? '#000' : '#F8FAFC',
                              height:130, display:'flex', alignItems:'center', justifyContent:'center',
                              cursor: bnUploading ? 'wait' : 'pointer', overflow:'hidden',
                              transition:'border-color .15s, background .15s',
                            }}>
                            {bnImgUrlMobile ? (
                              <>
                                <img src={bnImgUrlMobile} alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', opacity:0.85 }} />
                                <button type="button" onClick={e => { e.stopPropagation(); setBnImgUrlMobile(''); }}
                                  style={{ position:'absolute', top:8, right:8, zIndex:2, width:24, height:24, borderRadius:'50%', border:'none', background:'rgba(0,0,0,0.6)', color:'#fff', cursor:'pointer', fontSize:13 }}>✕</button>
                                <div style={{ position:'relative', zIndex:1, background:'rgba(0,0,0,0.55)', borderRadius:8, padding:'6px 14px', color:'#fff', fontSize:13, fontWeight:600 }}>
                                  클릭 또는 드래그로 교체
                                </div>
                              </>
                            ) : (
                              <div style={{ textAlign:'center', color:'#94A3B8', pointerEvents:'none' }}>
                                <div style={{ fontSize:28, marginBottom:6 }}>📱</div>
                                <div style={{ fontSize:13, fontWeight:600 }}>모바일 전용 이미지 (선택)</div>
                                <div style={{ fontSize:11, marginTop:4 }}>안 올리면 PC 이미지가 모바일에도 표시됩니다</div>
                              </div>
                            )}
                          </div>
                        </div>
                        )}

                        {/* 링크 URL */}
                        <div>
                          <label className="adm-label">클릭 시 이동 페이지</label>
                          <AdmSelect className="adm-cs-full" style={{ marginBottom:8 }} value={dropVal}
                            onChange={v => {
                              if (v === '__custom__') setBnForm(f => ({ ...f, link_url: isCustomUrl ? f.link_url : '' }));
                              else setBnForm(f => ({ ...f, link_url: v }));
                            }}
                            options={QUICK_LINKS.map(l => ({ value:l.url, label:`${l.label}${l.url !== '__custom__' ? ` — ${l.url}` : ''}` }))} />
                          {(isCustomUrl || dropVal === '__custom__') && (
                            <input className="adm-input-text" style={{ width:'100%' }}
                              placeholder="예: /event/summer-sale"
                              value={bnForm.link_url}
                              onChange={e => setBnForm(f => ({ ...f, link_url: e.target.value }))} />
                          )}
                          <div style={{ fontSize:11, color:'#94A3B8', marginTop:4 }}>
                            배너 클릭 시 이동할 페이지입니다. 링크 없이 이미지만 표시하려면 <code>/</code>를 선택하세요.
                          </div>
                        </div>

                        {/* 활성 */}
                        <div style={{ background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:8, padding:'12px 14px' }}>
                          <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', userSelect:'none' }}>
                            <input type="checkbox" checked={bnForm.is_active}
                              onChange={e => setBnForm(f => ({ ...f, is_active: e.target.checked }))}
                              style={{ width:16, height:16, cursor:'pointer', flexShrink:0 }} />
                            <div>
                              <div style={{ fontSize:13, fontWeight:600 }}>즉시 노출</div>
                              <div style={{ fontSize:11, color:'#94A3B8', marginTop:1 }}>체크 해제 시 저장만 되고 사이트에 표시되지 않습니다</div>
                            </div>
                          </label>
                        </div>

                      </div>
                      <div style={{ display:'flex', justifyContent:'flex-end', gap:8, padding:'0 20px 20px' }}>
                        <button className="adm-btn adm-btn-outline" onClick={() => setBannerModal(false)}>취소</button>
                        <button className="adm-btn adm-btn-primary" onClick={saveBanner} disabled={bnSaving || bnUploading}>
                          {bnSaving ? '저장 중...' : '저장'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ===== 이벤트 ===== */}
          {panel === 'events' && (
            <div className="adm-content">
              <div className="adm-toolbar">
                <div className="adm-toolbar-left">
                  <AdmSelect value="" onChange={() => {}}
                    options={[{ value:'', label:'전체 상태' }, { value:'ongoing', label:'진행중' }, { value:'scheduled', label:'예정' }, { value:'ended', label:'종료' }]} />
                </div>
                <div className="adm-toolbar-right">
                  <button className="adm-btn adm-btn-outline" onClick={loadEvents}><span className="adm-btn-icon"><Icon.Refresh /></span>새로고침</button>
                  <button className="adm-btn adm-btn-primary" onClick={() => openEventModal()}>+ 이벤트 등록</button>
                </div>
              </div>
              <div className="adm-card">
                {eventsLoading ? <PanelLoading /> : (
                  <div className="adm-table-wrap">
                    <table className="adm-table">
                      <thead><tr><th>이벤트명</th><th>배지</th><th>시작일</th><th>종료일</th><th>상태</th><th>활성</th><th>관리</th></tr></thead>
                      <tbody>
                        {events.length === 0 ? (
                          <tr><td colSpan={7} style={{ textAlign:'center', padding:'40px 0', color:'#94A3B8' }}>이벤트 없음</td></tr>
                        ) : events.map(ev => {
                          const status = getEventStatus(ev);
                          const statusMap: Record<string, { label: string; cls: string }> = {
                            ongoing:  { label:'진행중', cls:'badge-on' },
                            upcoming: { label:'예정',   cls:'badge-paid' },
                            ended:    { label:'종료',   cls:'badge-off' },
                            inactive: { label:'비활성', cls:'badge-off' },
                          };
                          const s = statusMap[status] || statusMap.inactive;
                          return (
                            <tr key={ev.id}>
                              <td>{ev.title}</td>
                              <td>{ev.badge ? <span className="adm-badge badge-paid">{ev.badge}</span> : '-'}</td>
                              <td className="adm-muted">{fmtDateShort(ev.starts_at)}</td>
                              <td className="adm-muted">{fmtDateShort(ev.ends_at)}</td>
                              <td><span className={`adm-badge ${s.cls}`}>{s.label}</span></td>
                              <td>
                                <Toggle defaultOn={ev.is_active}
                                  onChange={(v) => toggleEventActive(ev.id, v)} />
                              </td>
                              <td style={{ display:'flex', gap:6 }}>
                                <button className="adm-row-btn" onClick={() => openEventModal(ev)}>수정</button>
                                <Link href={`/event/${ev.slug}`} className="adm-row-btn" target="_blank">보기</Link>
                                <button className="adm-row-btn adm-row-btn-danger" onClick={() => deleteEvent(ev.id)}>삭제</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== 라운지 ===== */}
          {panel === 'lounge' && (
            <div className="adm-content">
              <div className="adm-toolbar">
                <div className="adm-toolbar-left">
                  <AdmSelect value={loungeFilter} onChange={setLoungeFilter}
                    options={[
                      { value:'', label:'전체 카테고리' },
                      { value:'recipe', label:'레시피' },
                      { value:'story', label:'과일이야기' },
                      { value:'farm', label:'산지소식' },
                      { value:'health', label:'건강팁' },
                    ]} />
                </div>
                <div className="adm-toolbar-right">
                  <button className="adm-btn adm-btn-outline" onClick={loadLounge}><span className="adm-btn-icon"><Icon.Refresh /></span>새로고침</button>
                  <button className="adm-btn adm-btn-primary" onClick={() => openLoungeModal()}>+ 글 등록</button>
                </div>
              </div>
              <div className="adm-card">
                {loungeLoading ? <PanelLoading /> : (
                  <div className="adm-table-wrap">
                    <table className="adm-table">
                      <thead><tr><th>ID</th><th>제목</th><th>카테고리</th><th>배지</th><th>작성일</th><th>노출</th><th>관리</th></tr></thead>
                      <tbody>
                        {filteredLounge.length === 0 ? (
                          <tr><td colSpan={7} style={{ textAlign:'center', padding:'40px 0', color:'#94A3B8' }}>게시물 없음</td></tr>
                        ) : filteredLounge.map(p => (
                          <tr key={p.id}>
                            <td className="adm-mono">{p.id}</td>
                            <td>{p.title}</td>
                            <td>{p.filter}</td>
                            <td>{p.badge ? <span className="adm-badge badge-paid">{p.badge}</span> : '-'}</td>
                            <td className="adm-muted">{p.date || fmtDateShort(p.created_at)}</td>
                            <td>
                              <Toggle defaultOn={p.is_active}
                                onChange={(v) => toggleLoungeActive(p.id, v)} />
                            </td>
                            <td style={{ display:'flex', gap:6 }}>
                              <button className="adm-row-btn" onClick={() => openLoungeModal(p)}>수정</button>
                              <Link href={`/lounge/${p.id}`} className="adm-row-btn" target="_blank">보기</Link>
                              <button className="adm-row-btn adm-row-btn-danger" onClick={() => deleteLounge(p.id)}>삭제</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== 메인페이지 섹션관리 ===== */}
          {panel === 'homesections' && (
            <div className="adm-content">
              <div className="adm-card adm-card-settings" style={{ marginBottom: 16 }}>
                <div className="adm-card-head"><span className="adm-card-title">메인 섹션 노출</span></div>
                <div style={{ padding:'4px 0 8px', fontSize:12, color:'#94A3B8' }}>끄면 해당 섹션이 메인 페이지에서 완전히 숨겨집니다. (켜져 있으면 비었을 때 ‘준비중’ 표시)</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0,1fr))', gap:'8px 12px' }}>
                  {([
                    ['sec_topbanner','상단 배너'],
                    ['sec_quickguide','퀵가이드'],
                    ['sec_pick','델리오 픽'],
                    ['sec_brand','브랜드 직송관'],
                    ['sec_midbanner','중간 배너'],
                    ['sec_review','리뷰 하이라이트'],
                    ['sec_lounge','델리오 라운지'],
                    ['sec_survey','취향찾기 CTA'],
                  ] as const).map(([key, label]) => (
                    <div key={key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, padding:'9px 12px', border:'1px solid #EEF2F6', borderRadius:8, background:'#FAFBFC' }}>
                      <span style={{ fontSize:13, fontWeight:600, color:'#334155' }}>{label}</span>
                      <Toggle defaultOn={siteSettings[key] !== 'false'}
                        onChange={v => { setSiteSettings(prev => ({ ...prev, [key]: v ? 'true' : 'false' })); createClient().from('site_settings').upsert({ key, value: v ? 'true' : 'false' }, { onConflict: 'key' }); }} />
                    </div>
                  ))}
                </div>
              </div>

              <SectionCuration sec="pick" items={products.map(p => ({ id: p.id, label: p.name, sub: catOptions[p.category] || CAT_LABEL[p.category] || p.category }))} />
              <SectionCuration sec="qg"
                buckets={[...new Set(products.map(p => p.category))].map(c => ({ value: c, label: catOptions[c] || CAT_LABEL[c] || c }))}
                items={products.map(p => ({ id: p.id, label: p.name, sub: catOptions[p.category] || CAT_LABEL[p.category] || p.category, bucket: p.category }))} />
              <SectionCuration sec="brand" items={farms.map(f => ({ id: f.id, label: f.name, sub: f.region || f.farm_type || '' }))} />
              <SectionCuration sec="reviewhl" items={reviews.filter(r => r.image_urls && r.image_urls.length > 0).map(r => ({ id: r.id, label: (r.content || '(내용 없음)').slice(0, 30), sub: `★${r.rating} · ${r.products?.name || ''}` }))} />
              <SectionCuration sec="lounge" items={loungePosts.filter(l => l.is_active).map(l => ({ id: String(l.id), label: l.title, sub: l.filter }))} />
            </div>
          )}

          {/* ===== 회원 관리 ===== */}
          {panel === 'members' && (
            <div className="adm-content">
              {/* 서브탭: 회원 목록 / 탈퇴 사유 */}
              <div style={{ display:'flex', gap:4, marginBottom:18, borderBottom:'1px solid #E2E8F0' }}>
                {([['list','회원 목록'],['withdrawn','탈퇴 사유']] as const).map(([k, label]) => (
                  <button key={k} onClick={() => { setMemberTab(k); if (k === 'withdrawn') loadWithdrawn(); }}
                    style={{ padding:'10px 18px', background:'none', border:'none',
                      borderBottom:`2px solid ${memberTab===k?'#1A1A1A':'transparent'}`,
                      fontWeight:memberTab===k?700:500, color:memberTab===k?'#1A1A1A':'#94A3B8',
                      cursor:'pointer', fontFamily:'inherit', fontSize:14, marginBottom:-1 }}>{label}</button>
                ))}
              </div>
              {memberTab === 'list' ? (<>
              <div className="adm-kpi-grid adm-kpi-4 adm-kpi-mb16">
                {[
                  ['전체 회원수',  stats ? `${stats.totalMembers.toLocaleString()}명` : '...'],
                  ['블랙리스트',   members.filter(m => m.is_blocked).length + '명'],
                  ['바이어 이상',  members.filter(m => ['buyer','master'].includes(m.grade)).length + '명'],
                  ['포인트 보유',  members.reduce((s,m) => s+(m.point_balance||0), 0).toLocaleString() + 'P'],
                ].map(([l,v]) => (
                  <div key={l} className="adm-kpi-card">
                    <div className="adm-kpi-label">{l}</div>
                    <div className="adm-kpi-value adm-kpi-value-mt">{v}</div>
                  </div>
                ))}
              </div>
              <div className="adm-toolbar">
                <div className="adm-toolbar-left">
                  <AdmSelect value={memberGradeFilter} onChange={setMemberGradeFilter}
                    options={[{ value:'', label:'전체 등급' }, ...Object.entries(GRADE_LABEL).map(([v,l]) => ({ value:v, label:l as string }))]} />
                  <AdmSelect value={memberBlockFilter} onChange={v => setMemberBlockFilter(v as 'all'|'active'|'blocked')}
                    options={[{ value:'all', label:'전체' }, { value:'active', label:'정상' }, { value:'blocked', label:'블랙리스트' }]} />
                  <AdmSelect value={memberProviderFilter} onChange={setMemberProviderFilter}
                    options={[{ value:'', label:'전체 가입경로' }, { value:'email', label:'일반' }, { value:'kakao', label:'카카오' }, { value:'naver', label:'네이버' }]} />
                  <input type="text" className="adm-input-text" placeholder="이름 · 이메일 · 연락처 검색"
                    value={memberSearch} onChange={e => setMemberSearch(e.target.value)} />
                </div>
                <div className="adm-toolbar-right">
                  <button className="adm-btn adm-btn-outline" onClick={() => go('sms')}><span className="adm-btn-icon"><Icon.SMS2 /></span>SMS 발송</button>
                  <button className="adm-btn adm-btn-outline" onClick={loadMembers}><span className="adm-btn-icon"><Icon.Refresh /></span>새로고침</button>
                </div>
              </div>
              <div className="adm-card">
                {membersLoading ? <PanelLoading /> : (
                  <div className="adm-table-wrap">
                    <table className="adm-table">
                      <thead><tr><th>이름</th><th>이메일</th><th>연락처</th><th>가입경로</th><th>등급</th><th className="adm-num">포인트</th><th>상태</th><th>가입일</th><th>관리</th></tr></thead>
                      <tbody>
                        {filteredMembers.length === 0 ? (
                          <tr><td colSpan={9} style={{ textAlign:'center', padding:'40px 0', color:'#94A3B8' }}>
                            {members.length === 0 ? '회원 없음' : '검색 결과 없음'}
                          </td></tr>
                        ) : pagedMembers.map(m => (
                          <tr key={m.id} style={{ opacity: m.is_blocked ? 0.55 : 1 }}>
                            <td style={{ fontWeight:500 }}>
                              {m.memo && <span title={m.memo} style={{ marginRight:4, cursor:'help' }}>📌</span>}
                              {m.name}
                            </td>
                            <td className="adm-muted">{m.email}</td>
                            <td className="adm-muted">{m.phone || '-'}</td>
                            <td>
                              {(() => { const pm = PROVIDER_META[providerKey(m.provider)]; return (
                                <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:700, background:pm.bg, color:pm.color }}>{pm.label}</span>
                              ); })()}
                            </td>
                            <td>
                              <span className={`adm-badge ${GRADE_BADGE_CLS[m.grade] || 'badge-normal'}`}>
                                {GRADE_LABEL[m.grade] || m.grade}
                              </span>
                            </td>
                            <td className="adm-mono adm-num">{(m.point_balance||0).toLocaleString()}P</td>
                            <td>
                              {m.is_blocked
                                ? <span className="adm-badge badge-off">블랙리스트</span>
                                : <span className="adm-badge badge-on">정상</span>
                              }
                            </td>
                            <td className="adm-muted">{fmtDateShort(m.created_at)}</td>
                            <td>
                              <button className="adm-row-btn" onClick={() => openMemberDetail(m)}>상세</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <Pager page={memCur} pageSize={memSize} total={filteredMembers.length} onPage={setMemPage} onPageSize={setMemSize} />
              </>) : (<>
              {/* 탈퇴 사유 집계 */}
              {(() => {
                const counts: Record<string, number> = {};
                withdrawnList.forEach(w => { const k = (w.reason || '기타').split(/[—:]/)[0].trim() || '기타'; counts[k] = (counts[k] || 0) + 1; });
                const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4);
                return top.length === 0 ? null : (
                  <div className="adm-kpi-grid adm-kpi-4 adm-kpi-mb16">
                    {top.map(([k, v]) => (
                      <div key={k} className="adm-kpi-card">
                        <div className="adm-kpi-label">{k}</div>
                        <div className="adm-kpi-value adm-kpi-value-mt">{v}건</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
              <div className="adm-toolbar">
                <div className="adm-toolbar-left">
                  <span style={{ fontSize:13, color:'#64748B' }}>총 <strong>{withdrawnList.length}</strong>건의 탈퇴 이력</span>
                </div>
                <div className="adm-toolbar-right">
                  <button className="adm-btn adm-btn-outline" onClick={loadWithdrawn}><span className="adm-btn-icon"><Icon.Refresh /></span>새로고침</button>
                </div>
              </div>
              <div className="adm-card">
                {withdrawnLoading ? <PanelLoading /> : (
                  <div className="adm-table-wrap">
                    <table className="adm-table">
                      <thead><tr><th>탈퇴일</th><th>이메일</th><th>연락처</th><th>탈퇴 사유</th></tr></thead>
                      <tbody>
                        {withdrawnList.length === 0 ? (
                          <tr><td colSpan={4} style={{ textAlign:'center', padding:'40px 0', color:'#94A3B8' }}>탈퇴 이력이 없습니다.</td></tr>
                        ) : withdrawnList.map(w => (
                          <tr key={w.id}>
                            <td className="adm-muted">{fmtDateShort(w.withdrawn_at)}</td>
                            <td className="adm-muted">{w.email || '-'}</td>
                            <td className="adm-muted">{w.phone || '-'}</td>
                            <td>{w.reason || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              </>)}
            </div>
          )}

          {/* ===== 친구 추천 ===== */}
          {panel === 'referral' && (() => {
            const thisMonth    = new Date().toISOString().slice(0, 7);
            const total        = referrals.length;
            const thisMonthCnt = referrals.filter(r => r.created_at.startsWith(thisMonth)).length;
            const rewarded     = referrals.filter(r => r.rewarded).length;
            // 추천인 보상 쿠폰을 이미 사용한 referral_id (철회 비활성화용)
            const usedReferrerSet = new Set(refCoupons.filter(c => c.reward_type === 'referrer' && c.is_used && c.referral_id).map(c => c.referral_id));

            const filteredReferrals = referrals.filter(r => {
              const status = r.rewarded ? 'rewarded' : 'pending';
              const matchStatus = referralStatusFilter === 'all' || status === referralStatusFilter;
              const q = referralSearch.toLowerCase();
              const matchSearch = !q ||
                (r.referrer?.name || '').toLowerCase().includes(q) ||
                (r.referrer?.email || '').toLowerCase().includes(q) ||
                (r.referred?.name || '').toLowerCase().includes(q) ||
                (r.referred?.email || '').toLowerCase().includes(q);
              return matchStatus && matchSearch;
            });

            return (
              <div className="adm-content">
                <div className="adm-kpi-grid adm-kpi-3 adm-kpi-mb16">
                  {[
                    ['누적 총 추천 수',  `${total.toLocaleString()}건`],
                    ['이번달 친구 초대', `${thisMonthCnt.toLocaleString()}건`],
                    ['리워드 지급 완료', `${rewarded.toLocaleString()}건`],
                  ].map(([l, v]) => (
                    <div key={l} className="adm-kpi-card">
                      <div className="adm-kpi-label">{l}</div>
                      <div className="adm-kpi-value adm-kpi-value-mt">{v}</div>
                    </div>
                  ))}
                </div>

                <div className="adm-toolbar">
                  <div className="adm-toolbar-left">
                    <AdmSelect value={referralStatusFilter} onChange={v => setReferralStatusFilter(v as 'all'|'pending'|'rewarded')}
                      options={[{ value:'all', label:'전체 상태' }, { value:'pending', label:'대기중' }, { value:'rewarded', label:'지급 완료' }]} />
                    <input type="text" className="adm-input-text" placeholder="추천인 · 피추천인 검색"
                      value={referralSearch} onChange={e => setReferralSearch(e.target.value)} />
                  </div>
                  <div className="adm-toolbar-right">
                    <button className="adm-btn adm-btn-outline" onClick={loadReferrals}>
                      <span className="adm-btn-icon"><Icon.Refresh /></span>새로고침
                    </button>
                  </div>
                </div>

                <div className="adm-card">
                  {referralsLoading ? <PanelLoading /> : (
                    <div className="adm-table-wrap">
                      <table className="adm-table">
                        <thead>
                          <tr>
                            <th>추천인</th>
                            <th>피추천인</th>
                            <th>가입일</th>
                            <th>리워드 상태</th>
                            <th>지급일</th>
                            <th>관리</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredReferrals.length === 0 ? (
                            <tr><td colSpan={6} style={{ textAlign:'center', padding:'40px 0', color:'#94A3B8' }}>
                              {referrals.length === 0 ? '친구 추천 이력 없음' : '검색 결과 없음'}
                            </td></tr>
                          ) : filteredReferrals.map(r => (
                            <tr key={r.id}>
                              <td>
                                <div style={{ fontWeight:500 }}>{r.referrer?.name || '(탈퇴)'}</div>
                                <div className="adm-muted" style={{ fontSize:11 }}>{r.referrer?.email || ''}</div>
                              </td>
                              <td>
                                <div style={{ fontWeight:500 }}>{r.referred?.name || '(탈퇴)'}</div>
                                <div className="adm-muted" style={{ fontSize:11 }}>{r.referred?.email || ''}</div>
                              </td>
                              <td className="adm-muted">{fmtDateShort(r.created_at)}</td>
                              <td>
                                <span className={`adm-badge ${r.rewarded ? 'badge-paid' : 'badge-wait'}`}>
                                  {r.rewarded ? '지급 완료' : '대기중'}
                                </span>
                              </td>
                              <td className="adm-muted">{r.rewarded_at ? fmtDateShort(r.rewarded_at) : '—'}</td>
                              <td>
                                {r.rewarded && (() => {
                                  const used = usedReferrerSet.has(r.id);
                                  return (
                                    <button className="adm-row-btn adm-row-btn-danger" disabled={used}
                                      title={used ? '추천인이 보상 쿠폰을 이미 사용하여 철회할 수 없습니다' : ''}
                                      onClick={() => { if (!used) revokeReferralReward(r); }}
                                      style={used ? { opacity:0.45, cursor:'not-allowed' } : undefined}>철회</button>
                                  );
                                })()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* 친구추천으로 발급된 쿠폰 내역 */}
                <div className="adm-card" style={{ marginTop:16 }}>
                  <div className="adm-card-head">
                    <span className="adm-card-title">친구추천으로 발급된 쿠폰 내역 <span style={{ fontWeight:400, color:'#94A3B8', fontSize:12 }}>(피추천인 가입쿠폰 + 추천인 보상쿠폰)</span></span>
                    <button className="adm-btn adm-btn-outline" style={{ marginLeft:'auto' }} onClick={loadReferralCoupons}>새로고침</button>
                  </div>
                  {refCouponsLoading ? <PanelLoading /> : refCoupons.length === 0 ? (
                    <div className="adm-muted" style={{ textAlign:'center', padding:'30px 0', fontSize:13 }}>발급된 추천 쿠폰이 없습니다.</div>
                  ) : (() => {
                    const cur = Math.min(Math.max(1, refcPage), Math.max(1, Math.ceil(refCoupons.length / refcSize)));
                    const paged = refCoupons.slice((cur - 1) * refcSize, cur * refcSize);
                    return (
                      <>
                        <div className="adm-table-wrap">
                          <table className="adm-table">
                            <thead><tr><th>수령자</th><th>유형</th><th>금액</th><th>발급일</th><th>사용 여부</th><th>사용 / 만료</th></tr></thead>
                            <tbody>
                              {paged.map(rc => (
                                <tr key={rc.key}>
                                  <td><div style={{ fontWeight:500 }}>{rc.recipient_name}</div><div className="adm-muted" style={{ fontSize:11 }}>{rc.recipient_email}</div></td>
                                  <td><span className={`adm-badge ${rc.reward_type==='referrer'?'badge-paid':'badge-normal'}`}>{rc.reward_type==='referrer'?'추천인 보상':'피추천인 가입'}</span></td>
                                  <td style={{ fontWeight:700 }}>{rc.discount_value.toLocaleString()}원</td>
                                  <td className="adm-muted">{fmtDateShort(rc.created_at)}</td>
                                  <td>{rc.is_used ? <span className="adm-badge badge-off">사용됨</span> : <span className="adm-badge badge-on">미사용</span>}</td>
                                  <td className="adm-muted">{rc.is_used ? (rc.used_at ? `사용 ${fmtDateShort(rc.used_at)}` : '사용됨') : (rc.expires_at ? `만료 ${fmtDateShort(rc.expires_at)}` : '무제한')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <Pager page={cur} pageSize={refcSize} total={refCoupons.length} onPage={setRefcPage} onPageSize={setRefcSize} />
                      </>
                    );
                  })()}
                </div>
              </div>
            );
          })()}

          {/* ===== SMS 발송 ===== */}
          {panel === 'sms' && (
            <SmsPanel members={members} loadMembers={loadMembers} membersLoading={membersLoading} />
          )}

          {/* ===== 문의 관리 ===== */}
          {panel === 'inquiry' && (
            <div className="adm-content">
              <div className="adm-toolbar" style={{ flexWrap:'wrap', gap:8 }}>
                <div className="adm-toolbar-left" style={{ alignItems:'center', gap:8 }}>
                  <span className="adm-card-title">입점·협업 문의</span>
                  <span className="adm-badge badge-paid">총 {inquiries.length}건</span>
                </div>
                <div className="adm-toolbar-right" style={{ flexWrap:'wrap', gap:8, alignItems:'center' }}>
                  <AdmSelect value={inquiryTypeFilter} onChange={setInquiryTypeFilter}
                    options={[{ value:'', label:'전체 유형' }, ...[...new Set(inquiries.map(i => i.inquiry_type).filter(Boolean))].map(t => ({ value:t as string, label:t as string }))]} />
                  <div style={{ display:'inline-flex', gap:4 }}>
                    {([['오늘',0],['3일',3],['1주일',7],['1개월',30],['3개월',90]] as const).map(([lb, d]) => (
                      <button key={lb} className="adm-btn adm-btn-outline" style={{ fontSize:12, padding:'5px 10px' }}
                        onClick={() => { const to = new Date(); const from = new Date(); from.setDate(from.getDate() - d); setInquiryFrom(from.toISOString().slice(0,10)); setInquiryTo(to.toISOString().slice(0,10)); }}>{lb}</button>
                    ))}
                  </div>
                  <input type="date" className="adm-select" value={inquiryFrom} onChange={e => setInquiryFrom(e.target.value)} />
                  <span style={{ color:'#94A3B8' }}>~</span>
                  <input type="date" className="adm-select" value={inquiryTo} onChange={e => setInquiryTo(e.target.value)} />
                  <input type="text" className="adm-input-text" placeholder="업체·이름·연락처·이메일·내용 검색"
                    value={inquirySearch} onChange={e => setInquirySearch(e.target.value)} />
                  {(inquiryFrom || inquiryTo || inquirySearch || inquiryTypeFilter) && <button className="adm-btn adm-btn-outline" onClick={() => { setInquiryFrom(''); setInquiryTo(''); setInquirySearch(''); setInquiryTypeFilter(''); }}>초기화</button>}
                </div>
              </div>
              <TabBtns active={inquiryTab} setActive={setInquiryTab}
                tabs={[
                  { id:'tab-general', label: <span>답변대기 {pendingInquiries.length > 0 && <span className="adm-tab-count adm-tab-count-red">{pendingInquiries.length}</span>}</span> },
                  { id:'tab-done',    label: '답변완료' },
                  { id:'tab-all',     label: '전체' },
                ]} />
              <div className="adm-card">
                {inquiriesLoading ? <PanelLoading /> : (() => {
                  const inDate = (ts: string) =>
                    (!inquiryFrom || ts >= new Date(`${inquiryFrom}T00:00:00`).toISOString()) &&
                    (!inquiryTo   || ts <= new Date(`${inquiryTo}T23:59:59`).toISOString());
                  const base = inquiryTab === 'tab-general' ? pendingInquiries
                             : inquiryTab === 'tab-done'    ? doneInquiries
                             : inquiries;
                  const q = inquirySearch.trim().toLowerCase();
                  const list = base.filter(i =>
                    inDate(i.created_at) &&
                    (!inquiryTypeFilter || i.inquiry_type === inquiryTypeFilter) &&
                    (!q || [i.company, i.contact, i.email, i.message].some(v => (v || '').toLowerCase().includes(q)))
                  );
                  return (
                    <div className="adm-table-wrap">
                      <table className="adm-table">
                        <thead>
                          <tr><th>유형</th><th>업체/이름</th><th>연락처</th><th>이메일</th><th>내용</th><th>접수일</th><th>상태</th></tr>
                        </thead>
                        <tbody>
                          {list.length === 0 ? (
                            <tr><td colSpan={7} style={{ textAlign:'center', padding:'40px 0', color:'#94A3B8' }}>
                              {inquiries.length === 0 ? '문의 없음 (create_admin_policies.sql 실행 필요)' : '해당 항목 없음'}
                            </td></tr>
                          ) : list.map(inq => (
                            <tr key={inq.id} style={{ cursor:'pointer' }} onClick={() => setSelectedInquiry(inq)}>
                              <td><span className="adm-badge badge-paid">{inq.inquiry_type}</span></td>
                              <td>{inq.company}</td>
                              <td className="adm-mono">{inq.contact}</td>
                              <td className="adm-muted">{inq.email}</td>
                              <td style={{ maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{inq.message}</td>
                              <td className="adm-muted">{fmtDate(inq.created_at)}</td>
                              <td>
                                <span className={`adm-badge ${inq.status === 'answered' || inq.status === 'done' ? 'badge-done' : inq.status === 'rejected' ? 'badge-off' : 'badge-wait'}`}>
                                  {inq.status === 'answered' || inq.status === 'done' ? '수락' : inq.status === 'rejected' ? '거절' : '대기중'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ===== FAQ 관리 ===== */}
          {panel === 'faq' && (
            <div className="adm-content">
              <div className="adm-toolbar">
                <div className="adm-toolbar-left">
                  <AdmSelect value={faqCatFilter} onChange={v => { setFaqCatFilter(v); setFaqPage(1); }}
                    options={[{ value:'', label:'전체 카테고리' }, ...Object.entries(FAQ_CATS).map(([v, l]) => ({ value:v, label:l as string }))]} />
                  <input type="text" className="adm-input-text" placeholder="질문 · 답변 검색"
                    value={faqSearch} onChange={e => { setFaqSearch(e.target.value); setFaqPage(1); }} />
                </div>
                <div className="adm-toolbar-right">
                  <AdmSelect value={String(faqPageSize)} onChange={v => { setFaqPageSize(Number(v)); setFaqPage(1); }}
                    options={[10,30,100].map(n => ({ value:String(n), label:`${n}개씩` }))} />
                  <button className="adm-btn adm-btn-outline" onClick={loadFaq}><span className="adm-btn-icon"><Icon.Refresh /></span>새로고침</button>
                  <button className="adm-btn adm-btn-primary" onClick={() => openFaqModal()}>+ FAQ 등록</button>
                </div>
              </div>
              <div className="adm-card">
                {faqLoading ? <PanelLoading /> : (
                  <div className="adm-table-wrap">
                    <table className="adm-table">
                      <thead>
                        <tr>{canDragFaq && <th style={{ width:34 }}></th>}<th>카테고리</th><th>질문</th><th>노출</th><th>관리</th></tr>
                      </thead>
                      <tbody>
                        {filteredFaq.length === 0 ? (
                          <tr><td colSpan={canDragFaq ? 5 : 4} style={{ textAlign:'center', padding:'40px 0', color:'#94A3B8' }}>
                            FAQ 없음
                          </td></tr>
                        ) : pagedFaq.map(f => (
                          <tr key={f.id}
                            draggable={canDragFaq}
                            onDragStart={canDragFaq ? () => setDragFaqId(f.id) : undefined}
                            onDragOver={canDragFaq ? (e) => e.preventDefault() : undefined}
                            onDrop={canDragFaq ? () => { if (dragFaqId) reorderFaq(dragFaqId, f.id); setDragFaqId(null); } : undefined}
                            style={canDragFaq ? { cursor:'move', background: dragFaqId===f.id ? '#EFF6FF' : undefined } : undefined}>
                            {canDragFaq && <td style={{ color:'#CBD5E1', textAlign:'center', cursor:'grab', fontSize:15 }}>⠿</td>}
                            <td><span className="adm-badge badge-paid">{FAQ_CATS[f.category] || f.category}</span></td>
                            <td style={{ maxWidth:340, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.question}</td>
                            <td>
                              <Toggle defaultOn={f.is_active} onChange={() => toggleFaqActive(f)} />
                            </td>
                            <td style={{ display:'flex', gap:6 }}>
                              <button className="adm-row-btn" onClick={() => openFaqModal(f)}>수정</button>
                              <button className="adm-row-btn adm-row-btn-danger" onClick={() => deleteFaq(f.id)}>삭제</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              {!faqLoading && filteredFaq.length > 0 && (
                <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:8, marginTop:14 }}>
                  <button className="adm-btn adm-btn-outline" disabled={faqCurPage <= 1} onClick={() => setFaqPage(p => Math.max(1, p - 1))}>이전</button>
                  <span className="adm-muted" style={{ fontSize:13 }}>{faqCurPage} / {faqTotalPages}</span>
                  <button className="adm-btn adm-btn-outline" disabled={faqCurPage >= faqTotalPages} onClick={() => setFaqPage(p => Math.min(faqTotalPages, p + 1))}>다음</button>
                  <span className="adm-muted" style={{ fontSize:12, marginLeft:8 }}>총 {filteredFaq.length}건</span>
                </div>
              )}
            </div>
          )}

          {/* ===== 1:1 문의 관리 ===== */}
          {panel === 'cs' && (
            <div className="adm-content">
              <div className="adm-kpi-grid adm-kpi-3 adm-kpi-mb16">
                {[
                  { l:'전체 문의', v:csItems.length, tab:'tab-all', red:false },
                  { l:'답변 완료', v:csAnswered.length, tab:'tab-answered', red:false },
                  { l:'답변 대기', v:csPending.length, tab:'tab-pending', red:true },
                ].map(k => (
                  <div key={k.l} className="adm-kpi-card" style={{ cursor:'pointer', outline: csAdminTab===k.tab ? '2px solid #1A1A1A' : 'none' }}
                    onClick={() => setCsAdminTab(k.tab)}>
                    <div className="adm-kpi-label">{k.l}</div>
                    <div className="adm-kpi-value adm-kpi-value-mt" style={k.red && k.v>0 ? { color:'#DC2626' } : undefined}>{k.v}건</div>
                  </div>
                ))}
              </div>
              <TabBtns active={csAdminTab} setActive={setCsAdminTab}
                tabs={[
                  { id:'tab-all',      label: '전체' },
                  { id:'tab-answered', label: '답변 완료' },
                  { id:'tab-pending',  label: <span>답변 대기 {csPending.length > 0 && <span className="adm-tab-count adm-tab-count-red">{csPending.length}</span>}</span> },
                ]} />
              <div className="adm-toolbar" style={{ flexWrap:'wrap', gap:8 }}>
                <div className="adm-toolbar-left" style={{ flexWrap:'wrap', gap:8, alignItems:'center' }}>
                  <AdmSelect value={csCatFilter} onChange={setCsCatFilter}
                    options={[{ value:'', label:'전체 카테고리' }, ...Object.entries(CS_CAT_LABEL).map(([v, l]) => ({ value:v, label:l as string }))]} />
                  <div style={{ display:'inline-flex', gap:4 }}>
                    {([['오늘',0],['3일',3],['1주일',7],['1개월',30],['3개월',90]] as const).map(([lb, d]) => (
                      <button key={lb} className="adm-btn adm-btn-outline" style={{ fontSize:12, padding:'5px 10px' }}
                        onClick={() => { const to = new Date(); const from = new Date(); from.setDate(from.getDate() - d); setCsFrom(from.toISOString().slice(0,10)); setCsTo(to.toISOString().slice(0,10)); }}>{lb}</button>
                    ))}
                  </div>
                  <input type="date" className="adm-select" value={csFrom} onChange={e => setCsFrom(e.target.value)} />
                  <span style={{ color:'#94A3B8' }}>~</span>
                  <input type="date" className="adm-select" value={csTo} onChange={e => setCsTo(e.target.value)} />
                  <input type="text" className="adm-input-text" placeholder="제목·내용 검색"
                    value={csSearch} onChange={e => setCsSearch(e.target.value)} />
                  {(csCatFilter || csFrom || csTo || csSearch) && (
                    <button className="adm-btn adm-btn-outline" onClick={() => { setCsCatFilter(''); setCsFrom(''); setCsTo(''); setCsSearch(''); }}>초기화</button>
                  )}
                </div>
                <div className="adm-toolbar-right">
                  <button className="adm-btn adm-btn-outline" onClick={loadCsInquiries}><span className="adm-btn-icon"><Icon.Refresh /></span>새로고침</button>
                </div>
              </div>
              <div className="adm-card">
                {csAdminLoading ? <PanelLoading /> : (
                  <div className="adm-table-wrap">
                    <table className="adm-table">
                      <thead>
                        <tr><th>카테고리</th><th>제목</th><th>첨부</th><th>접수일시</th><th>상태</th><th>관리</th></tr>
                      </thead>
                      <tbody>
                        {csTabList.length === 0 ? (
                          <tr><td colSpan={6} style={{ textAlign:'center', padding:'40px 0', color:'#94A3B8' }}>
                            {csItems.length === 0 ? '1:1 문의 없음 (cs_inquiries 테이블 생성 필요)' : '해당 항목 없음'}
                          </td></tr>
                        ) : csTabList.map(c => (
                          <tr key={c.id}>
                            <td><span className="adm-badge badge-paid">{CS_CAT_LABEL[c.category] || c.category}</span></td>
                            <td style={{ maxWidth:280, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.title}</td>
                            <td>{c.attachments && c.attachments.length > 0 ? <span style={{ fontSize:13 }}>📎 {c.attachments.length}</span> : '-'}</td>
                            <td className="adm-muted">{fmtDate(c.created_at)}</td>
                            <td>
                              <span className={`adm-badge ${c.status === 'answered' ? 'badge-done' : 'badge-wait'}`}>
                                {c.status === 'answered' ? '답변완료' : '대기중'}
                              </span>
                            </td>
                            <td>
                              <button className="adm-row-btn" onClick={() => { setSelectedCs(c); setCsAnswer(c.answer || ''); }}>
                                {c.status === 'answered' ? '수정' : '답변'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== 상품 문의 관리 ===== */}
          {panel === 'productinquiry' && (() => {
            const pending  = productInquiries.filter(q => !q.answer);
            const answered = productInquiries.filter(q => !!q.answer);
            const filtered = productInquiries.filter(q => {
              const matchStatus = piqStatusFilter === 'all' ? true : piqStatusFilter === 'pending' ? !q.answer : !!q.answer;
              const s = piqSearch.toLowerCase();
              const matchSearch = !s || (q.products?.name||'').toLowerCase().includes(s) || q.content.toLowerCase().includes(s) || q.category.toLowerCase().includes(s);
              const matchFrom = !piqFrom || q.created_at >= new Date(`${piqFrom}T00:00:00`).toISOString();
              const matchTo   = !piqTo   || q.created_at <= new Date(`${piqTo}T23:59:59`).toISOString();
              return matchStatus && matchSearch && matchFrom && matchTo;
            });
            return (
              <div className="adm-content">
                <div className="adm-kpi-grid adm-kpi-3 adm-kpi-mb16">
                  {[
                    { l:'전체 문의', v:productInquiries.length, st:'all' as const, red:false },
                    { l:'답변 완료', v:answered.length, st:'answered' as const, red:false },
                    { l:'답변 대기', v:pending.length, st:'pending' as const, red:true },
                  ].map(k => (
                    <div key={k.l} className="adm-kpi-card" style={{ cursor:'pointer', outline: piqStatusFilter===k.st ? '2px solid #1A1A1A' : 'none' }}
                      onClick={() => setPiqStatusFilter(k.st)}>
                      <div className="adm-kpi-label">{k.l}</div>
                      <div className="adm-kpi-value adm-kpi-value-mt" style={k.red && k.v>0 ? { color:'#DC2626' } : undefined}>{k.v}건</div>
                    </div>
                  ))}
                </div>
                <div className="adm-toolbar" style={{ flexWrap:'wrap', gap:8 }}>
                  <div className="adm-toolbar-left" style={{ flexWrap:'wrap', gap:8, alignItems:'center' }}>
                    <AdmSelect value={piqStatusFilter} onChange={v => setPiqStatusFilter(v as 'all'|'pending'|'answered')}
                      options={[{ value:'all', label:'전체' }, { value:'answered', label:'답변 완료' }, { value:'pending', label:'답변 대기' }]} />
                    <div style={{ display:'inline-flex', gap:4 }}>
                      {([['오늘',0],['3일',3],['1주일',7],['1개월',30],['3개월',90]] as const).map(([lb, d]) => (
                        <button key={lb} className="adm-btn adm-btn-outline" style={{ fontSize:12, padding:'5px 10px' }}
                          onClick={() => { const to = new Date(); const from = new Date(); from.setDate(from.getDate() - d); setPiqFrom(from.toISOString().slice(0,10)); setPiqTo(to.toISOString().slice(0,10)); }}>{lb}</button>
                      ))}
                    </div>
                    <input type="date" className="adm-select" value={piqFrom} onChange={e => setPiqFrom(e.target.value)} />
                    <span style={{ color:'#94A3B8' }}>~</span>
                    <input type="date" className="adm-select" value={piqTo} onChange={e => setPiqTo(e.target.value)} />
                    <input type="text" className="adm-input-text" placeholder="상품명·내용·카테고리 검색"
                      value={piqSearch} onChange={e => setPiqSearch(e.target.value)} />
                    {(piqFrom || piqTo || piqSearch || piqStatusFilter !== 'all') && (
                      <button className="adm-btn adm-btn-outline" onClick={() => { setPiqFrom(''); setPiqTo(''); setPiqSearch(''); setPiqStatusFilter('all'); }}>초기화</button>
                    )}
                  </div>
                  <div className="adm-toolbar-right">
                    <button className="adm-btn adm-btn-outline" onClick={loadProductInquiries}>
                      <span className="adm-btn-icon"><Icon.Refresh /></span>새로고침
                    </button>
                  </div>
                </div>
                <div className="adm-card">
                  {productInquiriesLoading ? <PanelLoading /> : (
                    <div className="adm-table-wrap">
                      <table className="adm-table">
                        <thead>
                          <tr><th>상품</th><th>카테고리</th><th>문의 내용</th><th>비밀</th><th>상태</th><th>접수일</th></tr>
                        </thead>
                        <tbody>
                          {filtered.length === 0 ? (
                            <tr><td colSpan={6} style={{ textAlign:'center', padding:'40px 0', color:'#94A3B8' }}>문의 없음</td></tr>
                          ) : filtered.map(q => (
                            <tr key={q.id} style={{ cursor:'pointer' }} onClick={() => { setSelectedProductInquiry(q); setPiqAnswer(q.answer || ''); }}>
                              <td style={{ fontWeight:500, maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{q.products?.name || '-'}</td>
                              <td><span className="adm-badge badge-paid">{q.category}</span></td>
                              <td style={{ maxWidth:240, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{q.content}</td>
                              <td>{q.is_private ? '🔒' : '-'}</td>
                              <td>
                                <span className={`adm-badge ${q.answer ? 'badge-done' : 'badge-wait'}`}>
                                  {q.answer ? '답변완료' : '대기중'}
                                </span>
                              </td>
                              <td className="adm-muted">{fmtDate(q.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ===== 환불 관리 ===== */}
          {panel === 'refund' && (
            <div className="adm-content">
              <div className="adm-kpi-grid adm-kpi-5 adm-kpi-mb16">
                {(() => {
                  const w = refundTypeFilter === 'cancel' ? '취소' : refundTypeFilter === 'refund' ? '환불' : '취소·환불';
                  return [
                  { l:`${w} 요청`, st:'pending',    red:true  },
                  { l:`${w} 보류`, st:'hold',       red:false },
                  { l:'진행중',    st:'processing', red:false },
                  { l:`${w} 완료`, st:'completed',  red:false },
                  { l:`${w} 불가`, st:'rejected',   red:false },
                ]; })().map(k => {
                  const cnt = refundReqs.filter(r => r.status === k.st && (!refundTypeFilter || (r.type || 'refund') === refundTypeFilter)).length;
                  const active = refundStatusFilter === k.st;
                  return (
                    <div key={k.l} className="adm-kpi-card" style={{ cursor:'pointer', outline: active ? '2px solid #1A1A1A' : 'none' }}
                      onClick={() => setRefundStatusFilter(active ? '' : k.st)}>
                      <div className="adm-kpi-label">{k.l}</div>
                      <div className="adm-kpi-value adm-kpi-value-mt" style={k.red && cnt>0 ? { color:'#DC2626' } : undefined}>{cnt}건</div>
                    </div>
                  );
                })}
              </div>

              <div className="adm-toolbar" style={{ flexWrap:'wrap', gap:8 }}>
                <div className="adm-toolbar-left" style={{ flexWrap:'wrap', gap:8, alignItems:'center' }}>
                  <div className="adm-btn-group">
                    {([['all','전체'],['customer','고객신청'],['admin','관리자취소']] as const).map(([id, label]) => (
                      <button key={id} className={`adm-seg-btn${refundFilter===id?' active':''}`} onClick={() => setRefundFilter(id)}>{label}</button>
                    ))}
                  </div>
                  <div className="adm-btn-group">
                    {([['','유형 전체'],['cancel','취소'],['refund','환불']] as const).map(([id, label]) => (
                      <button key={id} className={`adm-seg-btn${refundTypeFilter===id?' active':''}`} onClick={() => setRefundTypeFilter(id)}>{label}</button>
                    ))}
                  </div>
                  <AdmSelect value={refundStatusFilter} onChange={setRefundStatusFilter}
                    options={[
                      { value:'', label:'전체 상태' },
                      { value:'pending', label:'환불 요청' },
                      { value:'hold', label:'환불 보류' },
                      { value:'processing', label:'진행중' },
                      { value:'completed', label:'환불 완료' },
                      { value:'rejected', label:'환불 불가' },
                    ]} />
                  <input type="date" className="adm-select" value={refundFrom} onChange={e => setRefundFrom(e.target.value)} />
                  <span style={{ color:'#94A3B8' }}>~</span>
                  <input type="date" className="adm-select" value={refundTo} onChange={e => setRefundTo(e.target.value)} />
                  {(refundStatusFilter || refundFrom || refundTo) && (
                    <button className="adm-btn adm-btn-outline" onClick={() => { setRefundStatusFilter(''); setRefundFrom(''); setRefundTo(''); }}>초기화</button>
                  )}
                </div>
                <div className="adm-toolbar-right">
                  <button className="adm-btn adm-btn-outline" onClick={loadRefundRequests}>
                    <span className="adm-btn-icon"><Icon.Refresh /></span>새로고침
                  </button>
                </div>
              </div>

              <div className="adm-card">
                {refundLoading ? <PanelLoading /> : (
                  <div className="adm-table-wrap">
                    <table className="adm-table">
                      <thead>
                        <tr>
                          <th>유형</th><th>신청자</th><th>주문번호</th><th>금액</th><th>사유</th>
                          <th>일자</th><th>상태</th><th>관리</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const stLabel: Record<string,string> = { pending:'환불요청', hold:'환불보류', processing:'진행중', completed:'환불완료', rejected:'환불불가' };
                          const stCls: Record<string,string> = { pending:'badge-wait', hold:'badge-ready', processing:'badge-refund', completed:'badge-paid', rejected:'badge-off' };
                          const inDate = (ts: string) =>
                            (!refundFrom || ts >= new Date(`${refundFrom}T00:00:00`).toISOString()) &&
                            (!refundTo   || ts <= new Date(`${refundTo}T23:59:59`).toISOString());
                          /* 고객 환불신청에 이미 잡힌 주문은 제외하고, 관리자 취소/환불 주문만 추가 */
                          const reqOrderNos = new Set(refundReqs.map(r => r.orders?.order_no).filter(Boolean) as string[]);
                          const customerReqs = (refundFilter === 'admin' ? [] : refundReqs)
                            .filter(r => (!refundStatusFilter || r.status === refundStatusFilter) && inDate(r.created_at)
                              && (!refundTypeFilter || (r.type || 'refund') === refundTypeFilter));
                          /* 상태 필터가 환불신청 전용값이면 관리자취소는 숨김 */
                          const adminStatusOk = !refundStatusFilter || ['completed','processing'].includes(refundStatusFilter);
                          /* 관리자 직접취소: 주문상태 cancelled=취소, refunded/refunding=환불 */
                          const directCancels = (refundFilter === 'customer' || !adminStatusOk ? [] : orders).filter(o =>
                            ['cancelled','refunded','refunding'].includes(o.status) && !reqOrderNos.has(o.order_no) && inDate(o.created_at)
                            && (!refundTypeFilter || (o.status === 'cancelled' ? 'cancel' : 'refund') === refundTypeFilter)
                          );
                          if (customerReqs.length === 0 && directCancels.length === 0) {
                            return <tr><td colSpan={8} style={{ textAlign:'center', padding:'40px 0', color:'#94A3B8' }}>환불·취소 내역이 없습니다.</td></tr>;
                          }
                          return (
                            <>
                              {customerReqs.map(r => (
                                <tr key={r.id}>
                                  <td><span className={`adm-badge ${r.type === 'cancel' ? 'badge-off' : 'badge-paid'}`}>{r.type === 'cancel' ? '취소신청' : '환불신청'}</span></td>
                                  <td>
                                    <div style={{ fontWeight:500 }}>{r.profiles?.name || '(탈퇴)'}</div>
                                    <div className="adm-muted" style={{ fontSize:11 }}>{r.profiles?.email || ''}</div>
                                  </td>
                                  <td className="adm-mono">{r.orders?.order_no || '-'}</td>
                                  <td>{r.orders ? `${fmtPrice(r.orders.final_amount)}원` : '-'}</td>
                                  <td style={{ maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.reason}</td>
                                  <td className="adm-muted">{fmtDateShort(r.created_at)}</td>
                                  <td><span className={`adm-badge ${stCls[r.status] || 'badge-wait'}`}>{(stLabel[r.status] || r.status).replace('환불', r.type === 'cancel' ? '취소' : '환불')}</span></td>
                                  <td>
                                    <button className="adm-row-btn" onClick={() => setRefundDetail(r)}>상세</button>
                                  </td>
                                </tr>
                              ))}
                              {directCancels.map(o => (
                                <tr key={o.id}>
                                  <td><span className="adm-badge badge-off">{o.status === 'cancelled' ? '관리자취소' : '관리자환불'}</span></td>
                                  <td><div style={{ fontWeight:500 }}>{o.recipient}</div></td>
                                  <td className="adm-mono">{o.order_no}</td>
                                  <td>{fmtPrice(o.final_amount)}원</td>
                                  <td className="adm-muted">관리자 취소</td>
                                  <td className="adm-muted">{fmtDateShort(o.created_at)}</td>
                                  <td><span className={`adm-badge ${STATUS_BADGE_CLS[o.status] || 'badge-off'}`}>{STATUS_LABEL[o.status] || o.status}</span></td>
                                  <td className="adm-muted">-</td>
                                </tr>
                              ))}
                            </>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 환불 상세 모달 */}
              {refundDetail && (() => {
                const r = refundDetail;
                const stLabel: Record<string,string> = { pending:'환불요청', hold:'환불보류', processing:'진행중', completed:'환불완료', rejected:'환불불가' };
                const stCls: Record<string,string> = { pending:'badge-wait', hold:'badge-ready', processing:'badge-refund', completed:'badge-paid', rejected:'badge-off' };
                const rows: [string, string][] = [
                  ['신청자', `${r.profiles?.name || '(탈퇴)'}${r.profiles?.email ? ` · ${r.profiles.email}` : ''}`],
                  ['주문번호', r.orders?.order_no || '-'],
                  ['결제금액', r.orders ? `${fmtPrice(r.orders.final_amount)}원` : '-'],
                  ['신청일', fmtDateShort(r.created_at)],
                  ['사유', r.reason],
                  ...(r.status === 'rejected' && r.reject_reason ? [['거부사유', r.reject_reason]] as [string,string][] : []),
                ];
                return (
                  <div className="adm-float-overlay" onClick={() => setRefundDetail(null)}>
                    <div className="adm-float-modal" style={{ maxWidth:480, padding:28 }} onClick={e => e.stopPropagation()}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
                        <h3 style={{ fontSize:15, fontWeight:700, margin:0 }}>환불 신청 상세</h3>
                        <button onClick={() => setRefundDetail(null)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#94A3B8' }}>✕</button>
                      </div>

                      <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
                        {rows.map(([label, val]) => (
                          <div key={label} style={{ display:'flex', gap:12, fontSize:13 }}>
                            <span style={{ width:64, flexShrink:0, color:'#94A3B8', fontWeight:600 }}>{label}</span>
                            <span style={{ color:'#1A1A1A', fontWeight:500 }}>{val}</span>
                          </div>
                        ))}
                        <div style={{ display:'flex', gap:12, fontSize:13, alignItems:'center' }}>
                          <span style={{ width:64, flexShrink:0, color:'#94A3B8', fontWeight:600 }}>상태</span>
                          <span className={`adm-badge ${stCls[r.status] || 'badge-wait'}`}>{stLabel[r.status] || r.status}</span>
                        </div>
                      </div>

                      <div style={{ fontSize:12, color:'#94A3B8', fontWeight:600, marginBottom:6 }}>상세 내용</div>
                      <div style={{ background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:8, padding:'14px 16px',
                        fontSize:13, color:'#334155', lineHeight:1.7, whiteSpace:'pre-wrap', minHeight:60, marginBottom:20 }}>
                        {r.detail || '(상세 내용 없음)'}
                      </div>

                      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                        {(r.status === 'pending' || r.status === 'rejected' || r.status === 'hold') && (
                          <button className="adm-btn adm-btn-outline" style={{ flex:1, minWidth:80 }} onClick={() => updateRefundStatus(r, 'processing')}>처리중</button>
                        )}
                        {r.status !== 'completed' && r.status !== 'hold' && r.status !== 'rejected' && (
                          <button className="adm-btn adm-btn-outline" style={{ flex:1, minWidth:80 }} onClick={() => updateRefundStatus(r, 'hold')}>보류</button>
                        )}
                        {r.status !== 'completed' && (
                          <button className="adm-btn adm-btn-primary" style={{ flex:1, minWidth:80 }} onClick={() => { if (confirm('환불 승인 처리하시겠습니까? 주문이 환불완료로 변경됩니다.')) updateRefundStatus(r, 'completed'); }}>환불승인</button>
                        )}
                        {r.status !== 'rejected' && r.status !== 'completed' && (
                          <button className="adm-btn adm-btn-outline" style={{ flex:1, minWidth:80, color:'#DC2626', borderColor:'#FCA5A5' }} onClick={() => {
                            const reason = prompt('환불 불가(거부) 사유를 입력하세요. 고객에게 전달됩니다.');
                            if (reason && reason.trim()) updateRefundStatus(r, 'rejected', reason.trim());
                          }}>환불 불가</button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ===== 정산 관리 ===== */}
          {panel === 'settlement' && (
            <div className="adm-content">
              {/* 기간 선택 */}
              <div className="adm-toolbar" style={{ marginBottom:16, flexWrap:'wrap', gap:8 }}>
                <div className="adm-toolbar-left" style={{ gap:8, flexWrap:'wrap', alignItems:'center' }}>
                  <AdmSelect value={settlementPreset} onChange={v => {
                    const pv = v as typeof settlementPreset;
                    setSettlementPreset(pv);
                    if (pv !== 'custom') { const [f, t] = settlementRange(pv); setSettlementData(null); loadSettlement(f, t); }
                  }} options={[
                    { value:'today', label:'오늘' }, { value:'yesterday', label:'어제' },
                    { value:'7d', label:'최근 7일' }, { value:'30d', label:'최근 30일' },
                    { value:'thisMonth', label:'이번 달' }, { value:'lastMonth', label:'지난 달' },
                    { value:'all', label:'전체 기간' }, { value:'custom', label:'사용자 정의' },
                  ]} />
                  {settlementPreset === 'custom' && (
                    <>
                      <input type="date" className="adm-select" value={settlementCustFrom} onChange={e => setSettlementCustFrom(e.target.value)} />
                      <span style={{ color:'#94A3B8' }}>~</span>
                      <input type="date" className="adm-select" value={settlementCustTo} onChange={e => setSettlementCustTo(e.target.value)} />
                      <button className="adm-btn adm-btn-primary" onClick={() => { const [f, t] = settlementRange(); setSettlementData(null); loadSettlement(f, t); }}>조회</button>
                    </>
                  )}
                </div>
                <div className="adm-toolbar-right">
                  <button className="adm-btn adm-btn-outline" onClick={() => { const [f, t] = settlementRange(); loadSettlement(f, t); }}>
                    <span className="adm-btn-icon"><Icon.Refresh /></span>새로고침
                  </button>
                </div>
              </div>

              {settlementLoading ? <PanelLoading /> : !settlementData ? (
                <div className="adm-card adm-card-empty">데이터를 불러오는 중...</div>
              ) : (
                <>
                  {/* KPI */}
                  <div className="adm-kpi-grid adm-kpi-5 adm-kpi-mb16">
                    {[
                      ['총 주문금액', `${fmtPrice(settlementData.total)}원`, '#1A1A1A'],
                      ['확정 매출', `${fmtPrice(settlementData.confirmed)}원`, '#16A34A'],
                      ['처리 중', `${fmtPrice(settlementData.pending)}원`, '#2563EB'],
                      ['취소/환불', `${fmtPrice(settlementData.cancelled)}원`, '#DC2626'],
                      ['총 주문수', `${settlementData.orderCount}건`, '#7C3AED'],
                    ].map(([l, v, c]) => (
                      <div key={l} className="adm-kpi-card">
                        <div className="adm-kpi-label">{l}</div>
                        <div className="adm-kpi-value adm-kpi-value-mt" style={{ color: c as string }}>{v}</div>
                      </div>
                    ))}
                  </div>

                  {/* 핵심 정산 지표 */}
                  <div className="adm-kpi-grid adm-kpi-5 adm-kpi-mb16">
                    {[
                      ['실정산 예상액', `${fmtPrice(settlementData.realSettle)}원`, '#16A34A', '확정 매출(쿠폰·포인트 차감 후)'],
                      ['객단가(AOV)', `${fmtPrice(settlementData.aov)}원`, '#1A1A1A', '취소 제외 평균 주문금액'],
                      ['쿠폰 차감', `-${fmtPrice(settlementData.couponTotal)}원`, '#DC2626', '기간 내 쿠폰 할인 합계'],
                      ['포인트 사용', `-${fmtPrice(settlementData.pointTotal)}원`, '#DC2626', '기간 내 포인트 사용 합계'],
                      ['환불·취소율', `${settlementData.refundRate.toFixed(1)}%`, '#DC2626', `${settlementData.refundCount}건 / ${settlementData.orderCount}건`],
                    ].map(([l, v, c, sub]) => (
                      <div key={l} className="adm-kpi-card">
                        <div className="adm-kpi-label">{l}</div>
                        <div className="adm-kpi-value adm-kpi-value-mt" style={{ color: c as string }}>{v}</div>
                        {sub && <div className="adm-muted" style={{ fontSize:10, marginTop:2, lineHeight:1.3 }}>{sub}</div>}
                      </div>
                    ))}
                  </div>

                  {/* 전기간 대비 */}
                  <div className="adm-card" style={{ marginBottom:16, padding:'14px 18px' }}>
                    <div style={{ fontSize:13, fontWeight:800, marginBottom:10 }}>전기간 대비 <span style={{ fontWeight:400, color:'#94A3B8', fontSize:11 }}>(직전 동일 길이 기간)</span></div>
                    <div style={{ display:'flex', gap:32, flexWrap:'wrap' }}>
                      {([['매출', settlementData.total, settlementData.prevTotal, true], ['주문수', settlementData.orderCount, settlementData.prevOrderCount, false]] as [string, number, number, boolean][]).map(([lb, cur, prev, money]) => {
                        const p = prev > 0 ? ((cur - prev) / prev * 100) : (cur > 0 ? 100 : 0);
                        const up = p >= 0;
                        return (
                          <div key={lb}>
                            <div className="adm-muted" style={{ fontSize:11, marginBottom:2 }}>{lb}</div>
                            <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
                              <span style={{ fontSize:17, fontWeight:800 }}>{money ? `${fmtPrice(cur)}원` : `${cur}건`}</span>
                              <span style={{ fontSize:13, fontWeight:700, color: up ? '#16A34A' : '#DC2626' }}>{up ? '▲' : '▼'} {Math.abs(p).toFixed(1)}%</span>
                            </div>
                            <div className="adm-muted" style={{ fontSize:10, marginTop:1 }}>이전: {money ? `${fmtPrice(prev)}원` : `${prev}건`}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* TOP 상품 / 카테고리 */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
                    <div className="adm-card">
                      <div className="adm-card-head"><span className="adm-card-title">상위 판매 상품 TOP 5</span></div>
                      <table className="adm-table" style={{ marginTop:4 }}>
                        <thead><tr><th>상품</th><th className="adm-num">수량</th><th className="adm-num">매출</th></tr></thead>
                        <tbody>
                          {settlementData.topProducts.length === 0
                            ? <tr><td colSpan={3} style={{ textAlign:'center', color:'#94A3B8', padding:'20px 0' }}>데이터 없음</td></tr>
                            : settlementData.topProducts.map((r, i) => (
                              <tr key={r.name}><td><span style={{ fontWeight:800, color:'#CBD5E1', marginRight:6 }}>{i+1}</span>{r.name}</td><td className="adm-num">{r.qty}개</td><td className="adm-num" style={{ fontWeight:600 }}>{fmtPrice(r.amount)}원</td></tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="adm-card">
                      <div className="adm-card-head"><span className="adm-card-title">카테고리별 매출 TOP</span></div>
                      <table className="adm-table" style={{ marginTop:4 }}>
                        <thead><tr><th>카테고리</th><th className="adm-num">수량</th><th className="adm-num">매출</th></tr></thead>
                        <tbody>
                          {settlementData.topCategories.length === 0
                            ? <tr><td colSpan={3} style={{ textAlign:'center', color:'#94A3B8', padding:'20px 0' }}>데이터 없음</td></tr>
                            : settlementData.topCategories.map((r, i) => (
                              <tr key={r.category}><td><span style={{ fontWeight:800, color:'#CBD5E1', marginRight:6 }}>{i+1}</span>{r.category}</td><td className="adm-num">{r.qty}개</td><td className="adm-num" style={{ fontWeight:600 }}>{fmtPrice(r.amount)}원</td></tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
                    {/* 주문 상태별 */}
                    <div className="adm-card">
                      <div className="adm-card-head"><span className="adm-card-title">주문 상태별 현황</span></div>
                      <table className="adm-table" style={{ marginTop:4 }}>
                        <thead><tr><th>상태</th><th className="adm-num">건수</th><th className="adm-num">금액</th></tr></thead>
                        <tbody>
                          {settlementData.byStatus.length === 0
                            ? <tr><td colSpan={3} style={{ textAlign:'center', color:'#94A3B8', padding:'20px 0' }}>주문 없음</td></tr>
                            : settlementData.byStatus.map(r => (
                            <tr key={r.status}>
                              <td><span className={`adm-badge ${STATUS_BADGE_CLS[r.status] || 'badge-wait'}`}>{STATUS_LABEL[r.status] || r.status}</span></td>
                              <td className="adm-num">{r.count}건</td>
                              <td className="adm-num" style={{ fontWeight:600 }}>{fmtPrice(r.amount)}원</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* 결제 수단별 */}
                    <div className="adm-card">
                      <div className="adm-card-head"><span className="adm-card-title">결제 수단별 현황</span></div>
                      <table className="adm-table" style={{ marginTop:4 }}>
                        <thead><tr><th>결제수단</th><th className="adm-num">건수</th><th className="adm-num">금액</th></tr></thead>
                        <tbody>
                          {settlementData.byMethod.length === 0
                            ? <tr><td colSpan={3} style={{ textAlign:'center', color:'#94A3B8', padding:'20px 0' }}>주문 없음</td></tr>
                            : settlementData.byMethod.map(r => (
                            <tr key={r.method}>
                              <td style={{ fontWeight:500 }}>{r.method}</td>
                              <td className="adm-num">{r.count}건</td>
                              <td className="adm-num" style={{ fontWeight:600 }}>{fmtPrice(r.amount)}원</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 매출 그래프 (일별/월별) */}
                  <div className="adm-card">
                    <div className="adm-card-head">
                      <span className="adm-card-title">{settlementView === 'daily' ? '일별 매출' : `${settlementMonth.slice(0,4)}년 월별 매출`}</span>
                      <div className="adm-btn-group">
                        {([['daily','일별'],['monthly','월별']] as const).map(([v, l]) => (
                          <button key={v} className={`adm-seg-btn${settlementView===v?' active':''}`} onClick={() => setSettlementView(v)}>{l}</button>
                        ))}
                      </div>
                    </div>
                    <div style={{ overflowX:'auto', padding:'8px 0' }}>
                      {settlementView === 'monthly' ? (() => {
                        const W = 46, H = 140, pad = 10;
                        const data = settlementYearly;
                        const maxAmt = Math.max(...data.map(d => d.amount), 1);
                        const totalW = Math.max(data.length * W, 300);
                        return (
                          <svg width={totalW} height={H + 22} style={{ display:'block' }}>
                            {[0.25,0.5,0.75,1].map(r => {
                              const y = H - pad - Math.round(r * (H - pad * 2));
                              return <line key={r} x1={pad} x2={totalW - pad} y1={y} y2={y} stroke="#E2E8F0" strokeWidth="1" />;
                            })}
                            {data.map((d, i) => {
                              const barH = Math.round((d.amount / maxAmt) * (H - pad * 2));
                              const x = pad + i * W + 6;
                              return (
                                <g key={i}>
                                  <rect x={x} y={H - pad - barH} width={W - 16} height={barH} rx="3" fill="#3B82F6" fillOpacity={settlementMonth.endsWith(String(d.month).padStart(2,'0')) ? 1 : 0.55} />
                                  <title>{`${d.month}월: ${fmtPrice(d.amount)}원`}</title>
                                  <text x={x + (W-16)/2} y={H + 14} textAnchor="middle" fontSize="10" fill="#94A3B8">{d.month}월</text>
                                </g>
                              );
                            })}
                          </svg>
                        );
                      })() : (() => {
                        const W = 28, H = 120, pad = 8;
                        const data = settlementData.daily;
                        const maxAmt = Math.max(...data.map(d => d.amount), 1);
                        const totalW = Math.max(data.length * W, 300);
                        const pts = data.map((d, i) => {
                          const x = pad + i * W + W / 2;
                          const y = H - pad - Math.round((d.amount / maxAmt) * (H - pad * 2));
                          return { x, y, d };
                        });
                        const polyline = pts.map(p => `${p.x},${p.y}`).join(' ');
                        return (
                          <svg width={totalW} height={H + 20} style={{ display:'block' }}>
                            {/* 그리드 라인 */}
                            {[0.25,0.5,0.75,1].map(r => {
                              const y = H - pad - Math.round(r * (H - pad * 2));
                              return <line key={r} x1={pad} x2={totalW - pad} y1={y} y2={y} stroke="#E2E8F0" strokeWidth="1" />;
                            })}
                            {/* 영역 채우기 */}
                            <polygon
                              points={`${pts[0]?.x},${H - pad} ${polyline} ${pts[pts.length-1]?.x},${H - pad}`}
                              fill="#3B82F6" fillOpacity="0.08" />
                            {/* 꺾은선 */}
                            <polyline points={polyline} fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                            {/* 점 + 날짜 라벨 */}
                            {pts.map((p, i) => (
                              <g key={i}>
                                {p.d.amount > 0 && <circle cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke="#3B82F6" strokeWidth="2" />}
                                <title>{`${p.d.date}: ${fmtPrice(p.d.amount)}원`}</title>
                                <text x={p.x} y={H + 14} textAnchor="middle" fontSize="9" fill="#94A3B8">{String(p.d.date).slice(-2)}</text>
                              </g>
                            ))}
                          </svg>
                        );
                      })()}
                    </div>
                    <div style={{ display:'flex', justifyContent:'flex-end', padding:'4px 16px 0', fontSize:12, color:'#94A3B8' }}>
                      일평균: {settlementData.orderCount > 0 ? fmtPrice(Math.round(settlementData.total / Math.max(settlementData.daily.filter(d => d.amount > 0).length, 1))) : 0}원
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ===== 농가 정산 ===== */}
          {panel === 'farmsettle' && (
            <div className="adm-content">
              <div className="adm-toolbar">
                <div className="adm-toolbar-left">
                  <input type="month" className="adm-input-text" value={farmSettleMonth}
                    onChange={e => { setFarmSettleMonth(e.target.value); loadFarmSettlement(e.target.value); }} />
                </div>
                <div className="adm-toolbar-right">
                  <button className="adm-btn adm-btn-outline" onClick={() => loadFarmSettlement(farmSettleMonth)}>
                    <span className="adm-btn-icon"><Icon.Refresh /></span>새로고침
                  </button>
                </div>
              </div>
              {(() => {
                const t = farmSettleRows.reduce((a, r) => ({ sales:a.sales+r.sales, payout:a.payout+r.payout, margin:a.margin+r.margin }), { sales:0, payout:0, margin:0 });
                return (
                  <div className="adm-kpi-grid adm-kpi-mb16" style={{ gridTemplateColumns:'repeat(3, 1fr)' }}>
                    <div className="adm-kpi-card"><div className="adm-kpi-label">매출 합계</div><div className="adm-kpi-value adm-kpi-value-mt">{fmtPrice(t.sales)}원</div></div>
                    <div className="adm-kpi-card"><div className="adm-kpi-label">농가 정산액(공급가)</div><div className="adm-kpi-value adm-kpi-value-mt">{fmtPrice(t.payout)}원</div></div>
                    <div className="adm-kpi-card"><div className="adm-kpi-label">마진</div><div className="adm-kpi-value adm-kpi-value-mt" style={{ color:'#16A34A' }}>{fmtPrice(t.margin)}원</div></div>
                  </div>
                );
              })()}
              <div className="adm-card">
                {farmSettleLoading ? <PanelLoading /> : (
                  <div className="adm-table-wrap">
                    <table className="adm-table">
                      <thead><tr><th>농가</th><th className="adm-num">판매수량</th><th className="adm-num">매출</th><th className="adm-num">정산액(공급가)</th><th className="adm-num">마진</th><th>상태</th><th>처리</th></tr></thead>
                      <tbody>
                        {farmSettleRows.length === 0 ? (
                          <tr><td colSpan={7} style={{ textAlign:'center', padding:'40px 0', color:'#94A3B8' }}>해당 월 정산 내역이 없습니다.</td></tr>
                        ) : farmSettleRows.map(r => {
                          const paidAt = r.farmId ? farmSettlePaid[r.farmId] : undefined;
                          return (
                          <tr key={r.farmId ?? 'none'}>
                            <td><strong>{r.farmName}</strong></td>
                            <td className="adm-num">{r.qty.toLocaleString()}개</td>
                            <td className="adm-num adm-muted">{fmtPrice(r.sales)}원</td>
                            <td className="adm-num"><strong>{fmtPrice(r.payout)}원</strong></td>
                            <td className="adm-num" style={{ color: r.margin >= 0 ? '#16A34A' : '#DC2626' }}>{fmtPrice(r.margin)}원</td>
                            <td>
                              {paidAt
                                ? <span className="adm-badge badge-on" title={new Date(paidAt).toLocaleString('ko-KR')}>정산완료</span>
                                : <span className="adm-badge badge-off">미정산</span>}
                            </td>
                            <td>
                              {!r.farmId ? <span className="adm-muted" style={{ fontSize:12 }}>—</span>
                                : paidAt
                                  ? <button className="adm-row-btn adm-row-btn-danger" onClick={() => unmarkFarmSettled(r.farmId!)}>정산취소</button>
                                  : <button className="adm-row-btn" onClick={() => markFarmSettled(r)}>정산완료</button>}
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== 취향 프로파일 ===== */}
          {panel === 'tasteprofile' && (() => {
            const thisMonth = new Date().toISOString().slice(0, 7);
            const total      = surveyResults.length;
            const thisMonthCnt = surveyResults.filter(r => r.created_at.startsWith(thisMonth)).length;
            const memberCnt  = surveyResults.filter(r => r.user_id).length;

            /* 유형별 집계 */
            const TYPE_EMOJI: Record<string, string> = {
              '새벽':'🌅','이슬':'💧','여름':'☀️','가을':'🍂',
              '봄':'🌸','바람':'🌬️','불꽃':'🔥','달빛':'🌙',
            };
            const typeCounts: Record<string, number> = {};
            surveyResults.forEach(r => {
              const k = r.result_label || r.result_type || '알 수 없음';
              typeCounts[k] = (typeCounts[k] || 0) + 1;
            });
            const typeSorted = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);

            const AXIS1_LABEL: Record<string, string> = { routine:'루틴형', free:'자유형' };
            const AXIS2_LABEL: Record<string, string> = { care:'케어형', self:'자기충전형' };
            const AXIS3_LABEL: Record<string, string> = { vitamin:'비타민형', healing:'힐링형' };
            /* 성향 축 분포 집계 */
            const axisDist = (vals: (string | null)[], labels: Record<string, string>) => {
              const c: Record<string, number> = {};
              vals.forEach(v => { if (v) c[v] = (c[v] || 0) + 1; });
              const tot = Object.values(c).reduce((s, n) => s + n, 0) || 1;
              return Object.entries(labels).map(([k, lb]) => ({ lb, n: c[k] || 0, pct: Math.round((c[k] || 0) / tot * 100) }));
            };
            const axisRows = [
              axisDist(surveyResults.map(r => r.axis1), AXIS1_LABEL),
              axisDist(surveyResults.map(r => r.axis2), AXIS2_LABEL),
              axisDist(surveyResults.map(r => r.axis3), AXIS3_LABEL),
            ];

            return (
              <div className="adm-content">
                {/* KPI */}
                <div className="adm-kpi-grid adm-kpi-4 adm-kpi-mb16">
                  {[
                    ['총 응답 수', `${total.toLocaleString()}건`],
                    ['회원 응답률', surveyMemberTotal > 0 ? `${Math.round(memberCnt/surveyMemberTotal*100)}%` : '-', `회원 ${memberCnt}/${surveyMemberTotal}명`],
                    ['이번달 응답', `${thisMonthCnt.toLocaleString()}건`],
                    ['회원 응답', `${memberCnt.toLocaleString()}건`],
                  ].map(([l, v, sub]) => (
                    <div key={l} className="adm-kpi-card">
                      <div className="adm-kpi-label">{l}</div>
                      <div className="adm-kpi-value adm-kpi-value-mt">{v}</div>
                      {sub && <div style={{ fontSize:11, color:'#94A3B8', marginTop:2 }}>{sub}</div>}
                    </div>
                  ))}
                </div>

                {/* 성향 축 분포 */}
                {total > 0 && (
                  <div className="adm-card" style={{ marginBottom:16 }}>
                    <div className="adm-card-head"><span className="adm-card-title">성향(축) 분포</span></div>
                    <div style={{ padding:'14px 18px', display:'flex', flexDirection:'column', gap:16 }}>
                      {axisRows.map((row, ai) => (
                        <div key={ai}>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:700, color:'#475569', marginBottom:5 }}>
                            <span>{row[0]?.lb}</span><span>{row[1]?.lb}</span>
                          </div>
                          <div style={{ display:'flex', height:26, borderRadius:6, overflow:'hidden', border:'1px solid #EEF2F6' }}>
                            {row.map((e, i) => (
                              <div key={e.lb} style={{ width:`${e.pct}%`, background: i === 0 ? '#3B82F6' : '#CBD5E1', color:'#fff', fontSize:11, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', whiteSpace:'nowrap' }}>
                                {e.pct >= 10 && `${e.pct}%`}
                              </div>
                            ))}
                          </div>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#94A3B8', marginTop:3 }}>
                            {row.map(e => <span key={e.lb}>{e.lb} {e.n}명 ({e.pct}%)</span>)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 결과 페이지 설정 */}
                <div className="adm-card" style={{ marginBottom:16 }}>
                  <div className="adm-card-head"><span className="adm-card-title">진단 결과 페이지 설정</span></div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px' }}>
                    <div>
                      <div style={{ fontSize:14, fontWeight:600, color:'#1A1A1A' }}>🛒 나를 위한 추천 상품 노출</div>
                      <div style={{ fontSize:12, color:'#94A3B8', marginTop:3 }}>
                        끄면 취향진단 결과 화면에서 추천 상품 섹션이 숨겨집니다.
                      </div>
                    </div>
                    <Toggle defaultOn={surveyShowProducts} onChange={toggleSurveyProducts} />
                  </div>
                </div>

                {/* 유형별 분포 */}
                {typeSorted.length > 0 && (
                  <div className="adm-card" style={{ marginBottom:16 }}>
                    <div className="adm-card-head">
                      <span className="adm-card-title">유형별 분포</span>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:10, padding:'4px 0 8px' }}>
                      {typeSorted.map(([type, cnt]) => (
                        <div key={type} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'#F8F9FA', borderRadius:10 }}>
                          <span style={{ fontSize:22 }}>{TYPE_EMOJI[type] || '🍑'}</span>
                          <div>
                            <div style={{ fontSize:13, fontWeight:700 }}>{type}</div>
                            <div style={{ fontSize:12, color:'#64748B' }}>{cnt}건 ({total > 0 ? Math.round(cnt/total*100) : 0}%)</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 응답 분포 (마케팅용) */}
                {(() => {
                  const AGE_LABEL: Record<string,string> = { '10s':'10대','20s':'20대','30s':'30대','40s':'40대','50s':'50대 이상' };
                  const GENDER_LABEL: Record<string,string> = { male:'남성', female:'여성', other:'기타' };
                  const dist = (field: keyof AdminSurveyResult, labelMap?: Record<string,string>) => {
                    const m: Record<string, number> = {};
                    surveyResults.forEach(r => { const v = (r[field] as string) || '미응답'; m[v] = (m[v]||0)+1; });
                    return Object.entries(m).sort((a,b) => b[1]-a[1]).map(([k,c]) => ({ label: labelMap?.[k] || k, c }));
                  };
                  const blocks: [string, { label:string; c:number }[], string][] = [
                    ['나이대', dist('age_group', AGE_LABEL), '#16A34A'],
                    ['성별', dist('gender', GENDER_LABEL), '#2563EB'],
                    ['구매 목적', dist('purchase_purpose'), '#9333EA'],
                    ['구매 빈도', dist('purchase_frequency'), '#EA580C'],
                  ];
                  return (
                    <div className="adm-dist-grid">
                      {blocks.map(([title, rows, color]) => (
                        <div key={title} className="adm-dist-card">
                          <div className="adm-dist-title" style={{ ['--dist-c' as string]: color } as React.CSSProperties}>{title} 분포</div>
                          <div className="adm-dist-rows">
                            {rows.length === 0 ? <div className="adm-muted" style={{ fontSize:12 }}>응답 없음</div> : rows.map(({label, c}, i) => {
                              const pct = total > 0 ? Math.round(c/total*100) : 0;
                              return (
                                <div key={label} className="adm-dist-row">
                                  <div className="adm-dist-row-head">
                                    <span className="adm-dist-label">{i === 0 && <span className="adm-dist-rank" style={{ background:color }} />}{label}</span>
                                    <span className="adm-dist-val"><b>{c}건</b> {pct}%</span>
                                  </div>
                                  <div className="adm-dist-bar">
                                    <div className="adm-dist-bar-fill" style={{ width:`${pct}%`, background:color }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* 유형 필터 */}
                {typeSorted.length > 0 && (
                  <div className="adm-toolbar">
                    <div className="adm-toolbar-left">
                      <div className="adm-btn-group" style={{ flexWrap:'wrap' }}>
                        <button className={`adm-seg-btn${surveyTypeFilter===''?' active':''}`} onClick={() => setSurveyTypeFilter('')}>전체</button>
                        {typeSorted.map(([type]) => (
                          <button key={type} className={`adm-seg-btn${surveyTypeFilter===type?' active':''}`} onClick={() => setSurveyTypeFilter(type)}>{type}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 응답 목록 */}
                <div className="adm-card">
                  {surveyLoading ? <PanelLoading /> : (
                    <div className="adm-table-wrap">
                      <table className="adm-table">
                        <thead>
                          <tr>
                            <th>유형</th>
                            <th>축 조합</th>
                            <th>회원</th>
                            <th>성별</th>
                            <th>나이</th>
                            <th>구매 목적</th>
                            <th>응답일</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                          const shown = surveyResults.filter(r => !surveyTypeFilter || (r.result_label || r.result_type) === surveyTypeFilter);
                          return shown.length === 0 ? (
                            <tr><td colSpan={7} style={{ textAlign:'center', padding:'40px 0', color:'#94A3B8' }}>
                              설문 응답 없음
                            </td></tr>
                          ) : shown.map(r => (
                            <tr key={r.id}>
                              <td>
                                <span style={{ marginRight:4 }}>{TYPE_EMOJI[r.result_label || ''] || '🍑'}</span>
                                <strong>{r.result_label || r.result_type || '—'}</strong>
                              </td>
                              <td>
                                <span className="adm-badge badge-normal" style={{ marginRight:2 }}>{AXIS1_LABEL[r.axis1 || ''] || r.axis1}</span>
                                <span className="adm-badge badge-normal" style={{ marginRight:2 }}>{AXIS2_LABEL[r.axis2 || ''] || r.axis2}</span>
                                <span className="adm-badge badge-normal">{AXIS3_LABEL[r.axis3 || ''] || r.axis3}</span>
                              </td>
                              <td>
                                {r.profiles ? (
                                  <>
                                    <div style={{ fontWeight:500 }}>{r.profiles.name}</div>
                                    <div className="adm-muted" style={{ fontSize:11 }}>{r.profiles.email}</div>
                                  </>
                                ) : <span className="adm-muted">비회원</span>}
                              </td>
                              <td className="adm-muted">
                                {r.gender === 'male' ? '남성' : r.gender === 'female' ? '여성' : r.gender === 'none' ? '미응답' : '—'}
                              </td>
                              <td className="adm-muted">{r.age_group ? r.age_group.replace('s','대').replace('plus','대+') : '—'}</td>
                              <td className="adm-muted">{r.purchase_purpose || '—'}</td>
                              <td className="adm-muted">{fmtDateShort(r.created_at)}</td>
                            </tr>
                          ));
                          })()}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ===== 마케팅 분석 (Looker Studio 임베드) ===== */}
          {panel === 'analytics' && (
            <div className="adm-content">
              <div className="adm-toolbar" style={{ flexWrap:'wrap', gap:8 }}>
                <div className="adm-toolbar-left" style={{ alignItems:'baseline', gap:8 }}>
                  <span className="adm-card-title">마케팅 분석</span>
                  <span className="adm-muted" style={{ fontSize:12 }}>· 우리 데이터 실시간 집계</span>
                </div>
                <div className="adm-toolbar-right" style={{ gap:8 }}>
                  <button className="adm-btn adm-btn-outline" onClick={loadMarketing}><span className="adm-btn-icon"><Icon.Refresh /></span>새로고침</button>
                  <a className="adm-btn adm-btn-outline" href="https://analytics.google.com" target="_blank" rel="noopener" style={{ textDecoration:'none' }}>GA4 열기 ↗</a>
                </div>
              </div>
              {marketingLoading || !marketing ? <PanelLoading /> : (() => {
                const m = marketing;
                const pct = (c: number, p: number) => p > 0 ? Math.round((c - p) / p * 100) : (c > 0 ? 100 : 0);
                const arr = (v: number) => `${v >= 0 ? '▲' : '▼'} ${Math.abs(v)}%`;
                const arrC = (v: number) => v >= 0 ? '#16A34A' : '#DC2626';
                const salesPct = pct(m.monthSales, m.prevSales);
                const aovPct = pct(m.aov, m.prevAov);
                const trendObj = (v: number) => ({ t: arr(v), c: arrC(v), bg: v >= 0 ? '#ECFDF5' : '#FEF2F2' });
                const kpiCard = (l: string, v: string, sub: string, opts: { trend?: { t: string; c: string; bg: string }; valColor?: string } = {}) => (
                  <div key={l} className="adm-kpi-card">
                    <div className="adm-kpi-label">{l}</div>
                    <div className="adm-kpi-value adm-kpi-value-mt" style={{ color: opts.valColor }}>{v}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:6, flexWrap:'wrap' }}>
                      {opts.trend && <span style={{ fontSize:10.5, fontWeight:800, color: opts.trend.c, background: opts.trend.bg, borderRadius:5, padding:'2px 7px' }}>{opts.trend.t}</span>}
                      <span style={{ fontSize:11, color:'#94A3B8' }}>{sub}</span>
                    </div>
                  </div>
                );
                const sectionH = (t: string, d: string) => (
                  <div style={{ display:'flex', alignItems:'center', gap:8, margin:'8px 0 11px' }}>
                    <span style={{ width:3, height:15, background:'#1A1A1A', borderRadius:2 }} />
                    <span style={{ fontSize:13.5, fontWeight:800, color:'#1A1A1A' }}>{t}</span>
                    <span style={{ fontSize:11, color:'#94A3B8' }}>{d}</span>
                  </div>
                );
                return (
                  <>
                    {sectionH('핵심 지표', '· 매일 먼저 확인')}
                    <div className="adm-kpi-grid adm-kpi-4 adm-kpi-mb16">
                      {kpiCard('오늘 주문 건수', `${m.todayOrders}건`, `이번달 누적 ${m.monthOrders}건`)}
                      {kpiCard('재주문 고객수', `${m.repeatCustomers}명`, '2회 이상 구매 고객')}
                      {kpiCard('이번달 매출', `${fmtPrice(m.monthSales)}원`, '전월 동기 대비', { trend: trendObj(salesPct) })}
                      {kpiCard('환불·취소율', `${m.refundRate.toFixed(1)}%`, `이번달 ${m.refundCount}건`, { valColor: m.refundRate > 0 ? '#DC2626' : undefined })}
                    </div>

                    {sectionH('참고 지표', '· 맥락 파악용')}
                    <div className="adm-kpi-grid adm-kpi-4 adm-kpi-mb16">
                      {kpiCard('신규 회원', `${m.newMembers}명`, '이번달 가입')}
                      {kpiCard('평균 객단가', `${fmtPrice(m.aov)}원`, '전월 평균 대비', { trend: trendObj(aovPct) })}
                      {kpiCard('오늘 방문자', '—', 'GA 연동 시 표시', { valColor: '#CBD5E1' })}
                      {kpiCard('결제 전환율', '—', 'GA 연동 시 표시', { valColor: '#CBD5E1' })}
                    </div>

                    {sectionH('광고(배너) 지표', '· 등록 배너 기준')}
                    <div className="adm-kpi-grid adm-kpi-3 adm-kpi-mb16">
                      {kpiCard('총 조회수', m.adView.toLocaleString(), '배너 노출 합계', { valColor: '#2563EB' })}
                      {kpiCard('총 클릭수', m.adClick.toLocaleString(), '배너 클릭 합계', { valColor: '#7C3AED' })}
                      {kpiCard('평균 CTR', `${m.adCtr.toFixed(2)}%`, '클릭 ÷ 조회', { valColor: '#16A34A' })}
                    </div>

                    {/* 마케팅 주요 지표 (토글) */}
                    <div className="adm-card" style={{ marginBottom:16 }}>
                      <div className="adm-card-head"><span className="adm-card-title">마케팅 주요 지표</span></div>
                      <div style={{ padding:'16px 18px' }}>
                        <div style={{ display:'inline-flex', background:'#F1F5F9', borderRadius:10, padding:3, gap:2, marginBottom:18 }}>
                          {([['channel','채널별 유입'],['hour','시간대별 주문'],['age','연령대 분포']] as const).map(([k, lb]) => (
                            <button key={k} onClick={() => setMarketingTab(k)} style={{ border:'none', cursor:'pointer', fontSize:12.5, fontWeight:700, padding:'7px 16px', borderRadius:8, whiteSpace:'nowrap', background: marketingTab===k ? '#fff' : 'transparent', color: marketingTab===k ? '#1A1A1A' : '#94A3B8', boxShadow: marketingTab===k ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition:'all .15s' }}>{lb}</button>
                          ))}
                        </div>
                        {marketingTab === 'channel' ? (() => {
                          const max = Math.max(...m.channels.map(c => c.orders), 1);
                          return (
                            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                              {m.channels.map(c => (
                                <div key={c.label}>
                                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                                    <span style={{ fontWeight:700 }}>{c.label}</span>
                                    <span className="adm-muted">{c.orders}건 · {fmtPrice(c.revenue)}원</span>
                                  </div>
                                  <div style={{ height:20, background:'#F1F5F9', borderRadius:5, overflow:'hidden' }}>
                                    <div style={{ width:`${c.orders/max*100}%`, height:'100%', background: c.color === '#FEE500' ? '#F2C200' : c.color }} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })() : marketingTab === 'hour' ? (() => {
                          const max = Math.max(...m.byHour.map(h => h.count), 1);
                          const peak = m.byHour.reduce((a, b) => b.count > a.count ? b : a, m.byHour[0]);
                          return (
                            <div>
                              <div style={{ fontSize:11, color:'#94A3B8', marginBottom:8 }}>가장 주문 많은 시간대 <span style={{ color:'#1A1A1A', fontWeight:700 }}>{peak.h}시 ({peak.count}건)</span></div>
                              {/* 막대 */}
                              <div style={{ display:'flex', alignItems:'flex-end', gap:3, height:130, borderBottom:'1.5px solid #E2E8F0' }}>
                                {m.byHour.map(h => (
                                  <div key={h.h} style={{ flex:1, height:'100%', display:'flex', alignItems:'flex-end', justifyContent:'center' }} title={`${h.h}시 ${h.count}건`}>
                                    {h.count > 0 && <div style={{ width:'68%', height:`${Math.max(3, h.count / max * 100)}%`, background: h.h === peak.h ? '#2563EB' : '#93C5FD', borderRadius:'3px 3px 0 0' }} />}
                                  </div>
                                ))}
                              </div>
                              {/* 라벨 */}
                              <div style={{ display:'flex', gap:3, marginTop:5 }}>
                                {m.byHour.map(h => (
                                  <div key={h.h} style={{ flex:1, textAlign:'center', fontSize:9, color:'#94A3B8' }}>{h.h % 3 === 0 ? `${h.h}시` : ''}</div>
                                ))}
                              </div>
                            </div>
                          );
                        })() : (
                          m.byAge.length === 0 ? <div className="adm-muted" style={{ fontSize:12, padding:'10px 0' }}>취향진단 데이터 없음</div> : (() => {
                            const max = Math.max(...m.byAge.map(a => a.n), 1);
                            return (
                              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                                {m.byAge.map(a => (
                                  <div key={a.label} style={{ display:'flex', alignItems:'center', gap:8 }}>
                                    <span style={{ width:64, fontSize:12, fontWeight:600 }}>{a.label}</span>
                                    <div style={{ flex:1, height:20, background:'#F1F5F9', borderRadius:5, overflow:'hidden' }}><div style={{ width:`${a.n/max*100}%`, height:'100%', background:'#3B82F6' }} /></div>
                                    <span style={{ width:44, fontSize:12, color:'#64748B', textAlign:'right' }}>{a.n}명</span>
                                  </div>
                                ))}
                              </div>
                            );
                          })()
                        )}
                      </div>
                    </div>

                    {/* 마케팅 진단 */}
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
                      <div className="adm-card">
                        <div className="adm-card-head"><span className="adm-card-title">🎟 쿠폰 효과</span></div>
                        <div style={{ padding:'14px 18px' }}>
                          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:14 }}>
                            {[['발행 쿠폰', `${m.couponActive}/${m.couponTotal}`], ['사용률', `${m.couponIssued ? Math.round(m.couponUsed/m.couponIssued*100) : 0}%`], ['발급', `${m.couponIssued}건`], ['사용', `${m.couponUsed}건`]].map(([l, v]) => (
                              <div key={l} style={{ background:'#F8FAFC', borderRadius:8, padding:'9px 10px' }}>
                                <div style={{ fontSize:10, color:'#64748B' }}>{l}</div>
                                <div style={{ fontSize:15, fontWeight:800, marginTop:2 }}>{v}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{ fontSize:12, fontWeight:700, color:'#475569', marginBottom:6 }}>사용 많은 쿠폰 TOP 3</div>
                          {m.topCoupons.length === 0 ? <div className="adm-muted" style={{ fontSize:12 }}>발급 내역 없음</div> : m.topCoupons.map((c, i) => (
                            <div key={c.name} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'6px 0', borderBottom:'1px solid #F1F5F9' }}>
                              <span><b style={{ color:'#CBD5E1', marginRight:5 }}>{i+1}</b>{c.name}</span>
                              <span className="adm-muted">{c.used}/{c.issued}건 · {c.rate}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="adm-card">
                        <div className="adm-card-head"><span className="adm-card-title">💬 마케팅 메시지 (SMS)</span></div>
                        <div style={{ padding:'14px 18px' }}>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                            {[['이번달 발송', `${m.smsCount}건`], ['총 수신자', `${m.smsRecipients.toLocaleString()}명`]].map(([l, v]) => (
                              <div key={l} className="adm-kpi-card"><div className="adm-kpi-label">{l}</div><div className="adm-kpi-value adm-kpi-value-mt">{v}</div></div>
                            ))}
                          </div>
                          <div className="adm-muted" style={{ fontSize:11, marginTop:10, lineHeight:1.5 }}>읽음·클릭률은 SMS로는 추적이 안 됩니다. (카카오 알림톡 전환 시 가능)</div>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* ===== 설정 ===== */}
          {panel === 'settings' && (
            <div className="adm-content">

              {/* ── 검색어 통계 카드 ── */}
              <div className="adm-card" style={{ marginBottom:20 }}>
                <div className="adm-card-head">
                  <span className="adm-card-title">🔍 검색어 통계</span>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    {([7, 30] as const).map(d => (
                      <button key={d} className={`adm-seg-btn${statsDays===d?' active':''}`}
                        onClick={() => { setStatsDays(d); loadSearchStats(d); }}>{d}일</button>
                    ))}
                    <button className="adm-btn adm-btn-outline" style={{ fontSize:12, padding:'4px 10px' }}
                      onClick={() => loadSearchStats(statsDays)}>
                      <span className="adm-btn-icon"><Icon.Refresh /></span>새로고침
                    </button>
                    {searchStats.length > 0 && (
                      <button className="adm-btn adm-btn-outline" style={{ fontSize:12, padding:'4px 10px', color:'#DC2626', borderColor:'#FECACA' }}
                        onClick={clearAllSearchLogs}>
                        전체 삭제
                      </button>
                    )}
                  </div>
                </div>
                {/* 탭 */}
                <div style={{ display:'flex', borderBottom:'1px solid #E2E8F0' }}>
                  {([['all','전체 검색어'],['empty','결과없음']] as const).map(([id, label]) => (
                    <button key={id} onClick={() => setStatsTab(id)}
                      style={{ padding:'8px 16px', fontSize:13, border:'none', background:'none', cursor:'pointer',
                        fontWeight: statsTab===id ? 700 : 400,
                        color: statsTab===id ? '#1A1A1A' : '#94A3B8',
                        borderBottom: statsTab===id ? '2px solid #1A1A1A' : '2px solid transparent' }}>
                      {label}
                      {id==='empty' && noResultStats.length > 0 &&
                        <span style={{ marginLeft:5, background:'#FEE2E2', color:'#DC2626', borderRadius:99, padding:'1px 6px', fontSize:10, fontWeight:700 }}>
                          {noResultStats.length}
                        </span>
                      }
                    </button>
                  ))}
                </div>

                {searchStatsLoading ? (
                  <div style={{ textAlign:'center', padding:40, color:'#94A3B8', fontSize:14 }}>집계 중...</div>

                ) : statsTab === 'all' ? (
                  searchStats.length === 0 ? (
                    <div style={{ textAlign:'center', padding:'40px 0', color:'#94A3B8', fontSize:14 }}>
                      아직 검색 데이터가 없습니다
                      <div style={{ fontSize:12, marginTop:4 }}>사용자가 검색하면 자동으로 집계됩니다</div>
                    </div>
                  ) : (
                    <div className="adm-table-wrap">
                      <table className="adm-table">
                        <thead>
                          <tr><th>#</th><th>검색어</th><th>검색 횟수</th><th>증감</th><th>관리</th></tr>
                        </thead>
                        <tbody>
                          {searchStats.map((s, i) => (
                            <tr key={s.keyword}>
                              <td style={{ color:'#94A3B8', fontWeight:700, width:36 }}>{i + 1}</td>
                              <td style={{ fontWeight:600 }}>{s.keyword}</td>
                              <td>
                                <strong style={{ fontSize:15 }}>{s.count.toLocaleString()}</strong>
                                <span style={{ color:'#94A3B8', fontSize:12 }}> 회</span>
                              </td>
                              <td style={{ minWidth:80 }}>
                                {s.isNew ? (
                                  <span style={{ fontSize:11, background:'#EFF6FF', color:'#2563EB', borderRadius:99, padding:'2px 8px', fontWeight:700 }}>NEW</span>
                                ) : s.trend >= 50 ? (
                                  <span style={{ fontSize:11, background:'#FEF2F2', color:'#DC2626', borderRadius:99, padding:'2px 8px', fontWeight:700 }}>🔥 +{s.trend}%</span>
                                ) : s.trend > 0 ? (
                                  <span style={{ fontSize:12, color:'#16A34A', fontWeight:600 }}>↑ +{s.trend}%</span>
                                ) : s.trend < 0 ? (
                                  <span style={{ fontSize:12, color:'#94A3B8' }}>↓ {s.trend}%</span>
                                ) : (
                                  <span style={{ fontSize:12, color:'#CBD5E1' }}>—</span>
                                )}
                              </td>
                              <td style={{ display:'flex', gap:6 }}>
                                <button className="adm-row-btn" onClick={() => {
                                  const arr = (siteSettings.popular_keywords || '').split(',').map((x: string) => x.trim());
                                  while (arr.length < 10) arr.push('');
                                  if (arr.slice(0, 10).includes(s.keyword)) return;
                                  const emptyIdx = arr.findIndex(x => !x);
                                  if (emptyIdx === -1) return;
                                  arr[emptyIdx] = s.keyword;
                                  setSiteSettings(prev => ({ ...prev, popular_keywords: arr.slice(0, 10).join(', ') }));
                                }}>+ 추가</button>
                                <button className="adm-row-btn adm-row-btn-danger"
                                  onClick={() => deleteSearchKeyword(s.keyword)}>삭제</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )

                ) : (
                  /* ── 결과없음 탭 ── */
                  noResultStats.length === 0 ? (
                    <div style={{ textAlign:'center', padding:'40px 0', color:'#94A3B8', fontSize:14 }}>
                      결과없음 검색어가 없습니다 🎉
                      <div style={{ fontSize:12, marginTop:4 }}>모든 검색에 상품이 매칭되고 있습니다</div>
                    </div>
                  ) : (
                    <>
                      <div style={{ padding:'10px 16px', background:'#FFFBEB', borderBottom:'1px solid #FDE68A', fontSize:12, color:'#92400E' }}>
                        💡 아래 키워드는 검색 결과가 0건이었습니다. 상품 추가 또는 상품명 수정을 검토하세요.
                      </div>
                      <div className="adm-table-wrap">
                        <table className="adm-table">
                          <thead>
                            <tr><th>#</th><th>검색어</th><th>검색 횟수</th><th>처리</th></tr>
                          </thead>
                          <tbody>
                            {noResultStats.map((s, i) => (
                              <tr key={s.keyword}>
                                <td style={{ color:'#94A3B8', fontWeight:700, width:36 }}>{i + 1}</td>
                                <td style={{ fontWeight:600 }}>{s.keyword}</td>
                                <td>
                                  <strong style={{ fontSize:15 }}>{s.count.toLocaleString()}</strong>
                                  <span style={{ color:'#94A3B8', fontSize:12 }}> 회</span>
                                </td>
                                <td style={{ display:'flex', gap:6 }}>
                                  <button className="adm-row-btn" style={{ color:'#2563EB' }}
                                    onClick={() => window.open(`/search?q=${encodeURIComponent(s.keyword)}`, '_blank')}>검색 확인</button>
                                  <button className="adm-row-btn adm-row-btn-danger"
                                    onClick={() => deleteSearchKeyword(s.keyword)}>로그 삭제</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )
                )}
              </div>

              <div className="adm-settings-cols">
              {/* 표시 · 배송 설정 */}
              <div className="adm-card adm-card-settings">
                <div className="adm-card-head"><span className="adm-card-title">표시 · 배송 설정</span></div>
                <div className="adm-form">
                  <div className="adm-form-row">
                    <label className="adm-label">전체 출발 마감 시간 (기본값)</label>
                    <div className="adm-flex-center-gap">
                      <input type="text" className="adm-input-text adm-input-w100" value={siteSettings.dispatch_cutoff ?? ''} placeholder="예: 14:00" onChange={e => setSiteSettings(prev => ({ ...prev, dispatch_cutoff: e.target.value }))} />
                      <span className="adm-muted">상품별 설정 없으면 이 값으로 표시</span>
                    </div>
                  </div>
                  <div className="adm-form-row">
                    <label className="adm-label">상단 배송안내 탭 노출</label>
                    <Toggle defaultOn={siteSettings.show_shipping_tab !== 'false'} onChange={v => setSiteSettings(prev => ({ ...prev, show_shipping_tab: v ? 'true' : 'false' }))} />
                  </div>
                  <div className="adm-form-row">
                    <label className="adm-label">리뷰 작성 적립 포인트</label>
                    <div className="adm-flex-center-gap">
                      <input type="number" className="adm-input-text adm-input-w100" min={0} value={siteSettings.review_point_text ?? '50'} onChange={e => setSiteSettings(prev => ({ ...prev, review_point_text: e.target.value }))} />
                      <span className="adm-muted">P (일반 리뷰)</span>
                    </div>
                  </div>
                  <div className="adm-form-row">
                    <label className="adm-label">사진·영상 리뷰 적립 포인트</label>
                    <div className="adm-flex-center-gap">
                      <input type="number" className="adm-input-text adm-input-w100" min={0} value={siteSettings.review_point_photo ?? '150'} onChange={e => setSiteSettings(prev => ({ ...prev, review_point_photo: e.target.value }))} />
                      <span className="adm-muted">P (사진·영상 첨부 시)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 인기 검색어 */}
              <div className="adm-card adm-card-settings">
                <div className="adm-card-head"><span className="adm-card-title">인기 검색어 <span style={{ fontWeight:400, color:'#94A3B8', fontSize:12 }}>· 검색창·검색페이지 추천</span></span></div>
                <div className="adm-form">
                  <div className="adm-form-row" style={{ alignItems:'flex-start' }}>
                    <label className="adm-label" style={{ paddingTop:6 }}>순위</label>
                    <div style={{ display:'flex', flexDirection:'column', gap:6, flex:1 }}>
                      <button className="adm-btn adm-btn-outline" style={{ alignSelf:'flex-start', fontSize:13 }}
                        onClick={() => {
                          if (searchStats.length === 0) {
                            alert('먼저 위 검색어 통계를 새로고침 해주세요.');
                            return;
                          }
                          const top = searchStats.slice(0, 10).map(s => s.keyword);
                          const padded = [...top, ...Array(10).fill('')].slice(0, 10);
                          setSiteSettings(prev => ({ ...prev, popular_keywords: padded.join(', ') }));
                        }}>
                        📊 검색통계 TOP {Math.min(searchStats.length, 10)}개로 자동 채우기
                      </button>
                      {Array.from({ length: 10 }, (_, i) => {
                        const arr10 = () => {
                          const a = (siteSettings.popular_keywords || '').split(',').map(x => x.trim());
                          while (a.length < 10) a.push('');
                          return a;
                        };
                        const val = arr10()[i] || '';
                        const moveItem = (from: number, to: number) => {
                          const a = arr10();
                          const [item] = a.splice(from, 1);
                          a.splice(to, 0, item);
                          setSiteSettings(prev => ({ ...prev, popular_keywords: a.join(', ') }));
                        };
                        return (
                          <div key={i}
                            draggable
                            onDragStart={e => {
                              e.dataTransfer.setData('text/plain', String(i));
                              e.dataTransfer.effectAllowed = 'move';
                              (e.currentTarget as HTMLDivElement).style.opacity = '0.4';
                            }}
                            onDragEnd={e => { (e.currentTarget as HTMLDivElement).style.opacity = '1'; }}
                            onDragOver={e => {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                              (e.currentTarget as HTMLDivElement).style.background = '#F1F5F9';
                            }}
                            onDragLeave={e => { (e.currentTarget as HTMLDivElement).style.background = ''; }}
                            onDrop={e => {
                              e.preventDefault();
                              (e.currentTarget as HTMLDivElement).style.background = '';
                              const from = parseInt(e.dataTransfer.getData('text/plain'));
                              if (!isNaN(from) && from !== i) moveItem(from, i);
                            }}
                            style={{ display:'flex', alignItems:'center', gap:8, padding:'2px 6px', borderRadius:8, transition:'background .12s' }}>

                            {/* 드래그 핸들 */}
                            <svg viewBox="0 0 10 16" width="10" height="16" fill="#CBD5E1" style={{ flexShrink:0, cursor:'grab' }}>
                              <circle cx="3" cy="3"  r="1.4"/><circle cx="7" cy="3"  r="1.4"/>
                              <circle cx="3" cy="8"  r="1.4"/><circle cx="7" cy="8"  r="1.4"/>
                              <circle cx="3" cy="13" r="1.4"/><circle cx="7" cy="13" r="1.4"/>
                            </svg>

                            <span style={{ fontSize:12, fontWeight:700, color:'#94A3B8', minWidth:28, textAlign:'right', flexShrink:0 }}>
                              {i + 1}위
                            </span>

                            <input
                              className="adm-input-text"
                              style={{ flex:1 }}
                              value={val}
                              placeholder={`${i + 1}위 검색어`}
                              onChange={e => {
                                const a = arr10();
                                a[i] = e.target.value;
                                setSiteSettings(prev => ({ ...prev, popular_keywords: a.join(', ') }));
                              }}
                            />

                            {/* 위/아래 버튼 */}
                            <div style={{ display:'flex', flexDirection:'column', gap:2, flexShrink:0 }}>
                              <button
                                onClick={() => { if (i > 0) moveItem(i, i - 1); }}
                                disabled={i === 0}
                                style={{ width:22, height:19, border:'1px solid #E2E8F0', borderRadius:4, background: i===0?'#F8FAFC':'#fff', cursor: i===0?'default':'pointer', fontSize:9, color: i===0?'#CBD5E1':'#64748B', display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}>▲</button>
                              <button
                                onClick={() => { if (i < 9) moveItem(i, i + 1); }}
                                disabled={i === 9}
                                style={{ width:22, height:19, border:'1px solid #E2E8F0', borderRadius:4, background: i===9?'#F8FAFC':'#fff', cursor: i===9?'default':'pointer', fontSize:9, color: i===9?'#CBD5E1':'#64748B', display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}>▼</button>
                            </div>
                          </div>
                        );
                      })}
                      <span className="adm-muted" style={{ fontSize:11, marginTop:2 }}>
                        헤더 검색창 및 검색 페이지에 표시됩니다 · 빈 칸은 건너뜁니다
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              </div>{/* /.adm-settings-cols */}

              <div className="adm-form-actions adm-settings-save">
                <button className="adm-btn adm-btn-primary" onClick={saveSettings} disabled={settingsSaving}>
                  {settingsSaving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          )}

        </div>{/* /.adm-main */}
      </div>{/* /.adm-wrap */}

      {/* ===== 회원 상세 모달 ===== */}
      {selectedMember && (
        <div className="adm-float-overlay" onClick={() => setSelectedMember(null)}>
          <div className="adm-float-modal" style={{ maxWidth:560 }}
            onClick={e => e.stopPropagation()}>

            {/* 헤더 */}
            <div style={{ padding:'18px 22px', borderBottom:'1px solid #F0F0F0', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, background:'#fff', zIndex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:15, fontWeight:700 }}>{selectedMember.name}</span>
                <span className={`adm-badge ${GRADE_BADGE_CLS[selectedMember.grade]||'badge-normal'}`}>{GRADE_LABEL[selectedMember.grade]||selectedMember.grade}</span>
                {selectedMember.is_blocked && <span className="adm-badge badge-off">블랙리스트</span>}
              </div>
              <button onClick={() => setSelectedMember(null)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#94A3B8' }}>✕</button>
            </div>

            <div style={{ padding:'16px 22px', display:'flex', flexDirection:'column', gap:16 }}>

              {/* 기본 정보 */}
              <div style={{ background:'#F8FAFC', borderRadius:10, padding:'14px 16px' }}>
                {[
                  ['이메일', selectedMember.email],
                  ['연락처', selectedMember.phone || '-'],
                  ['포인트', `${(selectedMember.point_balance||0).toLocaleString()}P`],
                  ['가입일', fmtDate(selectedMember.created_at)],
                ].map(([l,v]) => (
                  <div key={l} style={{ display:'flex', gap:12, marginBottom:8, fontSize:13 }}>
                    <span style={{ color:'#64748B', width:60, flexShrink:0 }}>{l}</span>
                    <span style={{ fontWeight:500 }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* 구매 통계 */}
              <div>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:8 }}>구매 통계 <span style={{ fontWeight:400, color:'#94A3B8' }}>(취소·환불 제외)</span></div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8 }}>
                  {(() => {
                    const avg = memberStats.orderCount > 0 ? Math.round(memberStats.totalSpent / memberStats.orderCount) : 0;
                    const lastAt = memberOrders[0]?.created_at;
                    return [
                      ['누적 구매금액', `${memberStats.totalSpent.toLocaleString()}원`, '#2563EB'],
                      ['주문 횟수', `${memberStats.orderCount}건`, '#1A1A1A'],
                      ['평균 주문금액', `${avg.toLocaleString()}원`, '#1A1A1A'],
                      ['최근 주문일', lastAt ? fmtDateShort(lastAt) : '-', '#1A1A1A'],
                    ] as [string, string, string][];
                  })().map(([l, v, c]) => (
                    <div key={l} style={{ background:'#F8FAFC', border:'1px solid #EEF2F6', borderRadius:10, padding:'11px 13px' }}>
                      <div style={{ fontSize:11, color:'#64748B' }}>{l}</div>
                      <div style={{ fontSize:16, fontWeight:800, color:c, marginTop:3 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 등급 변경 */}
              <div>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:8 }}>회원 등급 변경</div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {Object.entries(GRADE_LABEL).map(([grade, label]) => (
                    <button key={grade} onClick={() => changeMemberGrade(selectedMember.id, grade)}
                      title={`기준: ${GRADE_CRITERIA[grade] || ''}`}
                      style={{ padding:'6px 14px', borderRadius:99, border:'1.5px solid', fontSize:12, fontWeight:600, cursor:'pointer',
                        borderColor: selectedMember.grade === grade ? '#1A1A1A' : '#E2E8F0',
                        background: selectedMember.grade === grade ? '#1A1A1A' : '#fff',
                        color: selectedMember.grade === grade ? '#fff' : '#64748B' }}>
                      {label}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize:11, color:'#94A3B8', marginTop:6, lineHeight:1.5 }}>
                  분기 누적 구매로 자동 산정됩니다. 수동 변경 시 <b>잠금</b> 처리되어 자동 재산정에서 제외됩니다.<br />
                  비기너 {GRADE_CRITERIA.beginner} · 테이스터 {GRADE_CRITERIA.taster} · 바이어 {GRADE_CRITERIA.buyer} · 마스터 {GRADE_CRITERIA.master}
                </div>
              </div>

              {/* 회원 상태 / 블랙리스트 */}
              <div style={{ padding:'14px 16px', borderRadius:12, background: selectedMember.is_blocked ? '#FEF2F2' : '#F8FAFC', border:`1px solid ${selectedMember.is_blocked ? '#FECACA' : '#E2E8F0'}` }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                  <span style={{ fontSize:13, fontWeight:800, color:'#1A1A1A' }}>회원 상태</span>
                  <span className={`adm-badge ${selectedMember.is_blocked ? 'badge-off' : 'badge-on'}`}>
                    {selectedMember.is_blocked ? '블랙리스트' : '정상'}
                  </span>
                </div>
                <div style={{ fontSize:12, color:'#64748B', marginBottom:12, lineHeight:1.5 }}>
                  {selectedMember.is_blocked
                    ? '현재 이 회원은 로그인·주문 등 서비스 이용이 제한된 상태입니다.'
                    : '블랙리스트로 등록하면 이 회원의 로그인·주문 등 서비스 이용이 제한됩니다.'}
                </div>
                <button onClick={() => toggleMemberBlock(selectedMember.id, selectedMember.is_blocked)}
                  style={{ width:'100%', padding:'11px', borderRadius:8, border:'none', cursor:'pointer', fontSize:13, fontWeight:700,
                    background: selectedMember.is_blocked ? '#16A34A' : '#DC2626', color:'#fff' }}>
                  {selectedMember.is_blocked ? '✓ 블랙리스트 해제' : '🚫 블랙리스트 등록'}
                </button>
              </div>

              {/* 관리자 메모 (누적) */}
              <div>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:8 }}>관리자 메모 <span style={{ fontWeight:400, color:'#94A3B8' }}>(내부용 · 누적 기록)</span></div>
                <textarea rows={2} style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1.5px solid #E2E8F0', fontSize:13, resize:'vertical', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }}
                  placeholder="새 메모 입력 후 추가 (회원에게 보이지 않음)"
                  value={memberMemo} onChange={e => setMemberMemo(e.target.value)} />
                <button onClick={() => addMemberMemo(selectedMember.id)} disabled={memberMemoSaving || !memberMemo.trim()}
                  style={{ marginTop:6, padding:'6px 16px', borderRadius:6, border:'none', background:'#1A1A1A', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                  {memberMemoSaving ? '저장 중...' : '+ 메모 추가'}
                </button>
                {memberMemos.length > 0 && (
                  <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:6 }}>
                    {memberMemos.map(mm => (
                      <div key={mm.id} style={{ background:'#F8FAFC', borderRadius:8, padding:'8px 12px', fontSize:13 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                          <span style={{ fontSize:11, color:'#94A3B8' }}>{fmtDate(mm.created_at)}{mm.admin_name ? ` · ${mm.admin_name}` : ''}</span>
                          <button onClick={() => deleteMemberMemo(mm.id)} style={{ background:'none', border:'none', color:'#DC2626', fontSize:11, cursor:'pointer' }}>삭제</button>
                        </div>
                        <div style={{ color:'#334155', whiteSpace:'pre-wrap', lineHeight:1.5 }}>{mm.content}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 최근 주문 */}
              <div>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:8 }}>최근 주문</div>
                {memberOrdersLoading ? (
                  <div style={{ textAlign:'center', padding:'20px 0', color:'#94A3B8', fontSize:13 }}>불러오는 중...</div>
                ) : memberOrders.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'20px 0', color:'#94A3B8', fontSize:13 }}>주문 내역 없음</div>
                ) : (
                  <div style={{ border:'1px solid #F0F0F0', borderRadius:8, overflow:'hidden' }}>
                    {memberOrders.map((o, i) => (
                      <div key={o.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', borderBottom: i < memberOrders.length-1 ? '1px solid #F0F0F0' : 'none', fontSize:13 }}>
                        <div>
                          <span className="adm-mono" style={{ fontSize:11, color:'#94A3B8' }}>{o.order_no}</span>
                          <span className={`adm-badge ${STATUS_BADGE_CLS[o.status]||'badge-wait'}`} style={{ marginLeft:6, fontSize:10 }}>{STATUS_LABEL[o.status]||o.status}</span>
                        </div>
                        <div style={{ fontWeight:600 }}>{fmtPrice(o.final_amount)}원</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ===== 리뷰 상세 모달 ===== */}
      {selectedReview && (
        <div className="adm-float-overlay" onClick={() => setSelectedReview(null)}>
          <div className="adm-float-modal" style={{ maxWidth:520 }} onClick={e => e.stopPropagation()}>
            {/* 헤더 */}
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #F0F0F0', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, background:'#fff', zIndex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <StarRating rating={selectedReview.rating} size={14} />
                {selectedReview.report_count ? (
                  <span className="adm-badge badge-off">🚨 신고 {selectedReview.report_count}건</span>
                ) : null}
                {selectedReview.is_best && <span className="adm-badge badge-paid">BEST</span>}
              </div>
              <button onClick={() => setSelectedReview(null)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#94A3B8' }}>✕</button>
            </div>

            <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:14 }}>
              {/* 작성자 + 상품 */}
              <div style={{ background:'#F8FAFC', borderRadius:8, padding:'10px 14px', fontSize:13 }}>
                <div><span style={{ color:'#64748B' }}>작성자</span> <strong>{selectedReview.profiles?.name || '익명'}</strong> <span style={{ color:'#94A3B8', fontSize:11 }}>{selectedReview.profiles?.email}</span></div>
                <div style={{ marginTop:4 }}><span style={{ color:'#64748B' }}>상품</span> <strong>{selectedReview.products?.name || '-'}</strong></div>
                <div style={{ marginTop:4 }}><span style={{ color:'#64748B' }}>작성일</span> {fmtDate(selectedReview.created_at)} <span style={{ marginLeft:12, color:'#64748B' }}>👍</span> {selectedReview.likes_count || 0}</div>
              </div>

              {/* 신고 사유 */}
              {selectedReview.report_reasons && selectedReview.report_reasons.length > 0 && (
                <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, padding:'10px 14px' }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#B91C1C', marginBottom:6 }}>🚨 신고 사유 ({selectedReview.report_reasons.length}건)</div>
                  <ul style={{ margin:0, paddingLeft:18, fontSize:13, color:'#7F1D1D', lineHeight:1.7 }}>
                    {selectedReview.report_reasons.map((rs, i) => <li key={i}>{rs}</li>)}
                  </ul>
                </div>
              )}

              {/* 리뷰 내용 */}
              <div style={{ fontSize:14, lineHeight:1.8, color:'#1A1A1A', whiteSpace:'pre-wrap' }}>
                {selectedReview.content}
              </div>

              {/* 이미지 */}
              {selectedReview.image_urls && selectedReview.image_urls.length > 0 && (
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {selectedReview.image_urls.map((url, i) => (
                    <img key={i} src={url} alt="" style={{ width:80, height:80, objectFit:'cover', borderRadius:6, border:'1px solid #E2E8F0' }} />
                  ))}
                </div>
              )}

              {/* 판매자 답변 */}
              <div style={{ borderTop:'1px solid #F0F0F0', paddingTop:14 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#475569', marginBottom:6 }}>💬 판매자 답변 {selectedReview.seller_reply ? '(작성됨 · 상품 상세에 노출)' : ''}</div>
                <textarea className="adm-input-text" style={{ width:'100%', minHeight:80, resize:'vertical', lineHeight:1.6 }}
                  placeholder="고객 리뷰에 대한 판매자 답변을 입력하세요. (상품 상세 리뷰에 함께 노출됩니다)"
                  value={reviewReply} onChange={e => setReviewReply(e.target.value)} />
                <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:8 }}>
                  {selectedReview.seller_reply && (
                    <button className="adm-btn adm-btn-outline" disabled={reviewReplySaving}
                      onClick={() => { setReviewReply(''); saveReviewReply(selectedReview.id, ''); }}>답변 삭제</button>
                  )}
                  <button className="adm-btn adm-btn-primary" disabled={reviewReplySaving || !reviewReply.trim()}
                    onClick={() => saveReviewReply(selectedReview.id, reviewReply)}>
                    {reviewReplySaving ? '저장 중...' : selectedReview.seller_reply ? '답변 수정' : '답변 등록'}
                  </button>
                </div>
              </div>

              {/* 삭제 버튼 */}
              <div style={{ display:'flex', justifyContent:'flex-end', gap:8, paddingTop:8, borderTop:'1px solid #F0F0F0' }}>
                <button className="adm-btn adm-btn-outline" onClick={() => setSelectedReview(null)}>닫기</button>
                <button className="adm-btn" style={{ background:'#DC2626', color:'#fff', border:'none' }}
                  onClick={async () => {
                    if (!confirm('이 리뷰를 삭제하시겠습니까?')) return;
                    await deleteReview(selectedReview.id);
                    setSelectedReview(null);
                  }}>
                  삭제
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== 쿠폰 지급 모달 ===== */}
      {giveCouponModal && giveCouponTarget && (() => {
        const filtered = members.filter(m => {
          const q = giveCouponSearch.toLowerCase();
          return !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
        });
        return (
          <div className="adm-float-overlay" onClick={() => setGiveCouponModal(false)}>
            <div className="adm-float-modal" style={{ maxWidth:460 }} onClick={e => e.stopPropagation()}>
              <div style={{ padding:'18px 22px', borderBottom:'1px solid #F0F0F0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:15, fontWeight:700 }}>쿠폰 지급</span>
                <button onClick={() => setGiveCouponModal(false)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#94A3B8' }}>✕</button>
              </div>
              <div style={{ padding:'18px 22px' }}>
                <div style={{ background:'#F8FAFC', borderRadius:8, padding:'12px 14px', marginBottom:16 }}>
                  <div style={{ fontSize:14, fontWeight:700 }}>{giveCouponTarget.name}</div>
                  <div style={{ fontSize:12, color:'#64748B', marginTop:2 }}>
                    {giveCouponTarget.discount_type === 'percent' ? `${giveCouponTarget.discount_value}% 할인` : `${fmtPrice(giveCouponTarget.discount_value)}원 할인`}
                  </div>
                </div>

                {/* 대상 선택 */}
                <div style={{ display:'flex', gap:8, marginBottom:14 }}>
                  {([['all','전체 회원'],['select','회원 선택']] as const).map(([v,l]) => (
                    <button key={v} onClick={() => setGiveCouponMode(v)}
                      style={{ flex:1, padding:'9px 0', borderRadius:8, border:'1.5px solid', fontSize:13, fontWeight:600, cursor:'pointer',
                        borderColor: giveCouponMode === v ? '#1A1A1A' : '#E2E8F0',
                        background: giveCouponMode === v ? '#1A1A1A' : '#fff',
                        color: giveCouponMode === v ? '#fff' : '#64748B' }}>
                      {l}{v === 'all' ? ` (${members.length})` : ''}
                    </button>
                  ))}
                </div>

                {/* 회원 선택 목록 */}
                {giveCouponMode === 'select' && (
                  <div style={{ border:'1px solid #E2E8F0', borderRadius:10, overflow:'hidden', marginBottom:14 }}>
                    <div style={{ padding:'10px 12px', borderBottom:'1px solid #E2E8F0', background:'#F8FAFC', display:'flex', gap:8, alignItems:'center' }}>
                      <input type="text" className="adm-input-text" placeholder="이름·이메일 검색" style={{ flex:1 }}
                        value={giveCouponSearch} onChange={e => setGiveCouponSearch(e.target.value)} />
                      <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:13, cursor:'pointer', whiteSpace:'nowrap' }}>
                        <input type="checkbox"
                          checked={filtered.length > 0 && filtered.every(m => giveCouponIds.has(m.id))}
                          onChange={e => {
                            setGiveCouponIds(prev => {
                              const next = new Set(prev);
                              if (e.target.checked) filtered.forEach(m => next.add(m.id));
                              else filtered.forEach(m => next.delete(m.id));
                              return next;
                            });
                          }} />
                        전체
                      </label>
                    </div>
                    <div style={{ maxHeight:240, overflowY:'auto' }}>
                      {filtered.length === 0 ? (
                        <div style={{ textAlign:'center', padding:'20px 0', color:'#94A3B8', fontSize:13 }}>회원 없음</div>
                      ) : filtered.map(m => (
                        <label key={m.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px', borderBottom:'1px solid #F4F4F4', cursor:'pointer', background: giveCouponIds.has(m.id) ? '#EFF6FF' : '#fff' }}>
                          <input type="checkbox" checked={giveCouponIds.has(m.id)}
                            onChange={() => setGiveCouponIds(prev => { const n = new Set(prev); n.has(m.id) ? n.delete(m.id) : n.add(m.id); return n; })} />
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:500 }}>{m.name}</div>
                            <div style={{ fontSize:11, color:'#94A3B8' }}>{m.email}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display:'flex', gap:8 }}>
                  <button className="adm-btn adm-btn-outline" style={{ flex:1 }} onClick={() => setGiveCouponModal(false)}>취소</button>
                  <button className="adm-btn adm-btn-primary" style={{ flex:2 }} onClick={giveCoupon} disabled={giveCouponSaving}>
                    {giveCouponSaving ? '지급 중...' : '쿠폰 지급'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===== 포인트 지급 모달 ===== */}
      {givePointModal && givePointTarget && (
        <div className="adm-float-overlay" onClick={() => setGivePointModal(false)}>
          <div className="adm-float-modal" style={{ maxWidth:420, padding:28 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h3 style={{ fontSize:15, fontWeight:700, margin:0 }}>포인트 지급</h3>
              <button onClick={() => setGivePointModal(false)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#94A3B8' }}>✕</button>
            </div>
            <div style={{ background:'#F8FAFC', borderRadius:10, padding:'12px 16px', marginBottom:20 }}>
              <div style={{ fontSize:14, fontWeight:700 }}>{givePointTarget.name}</div>
              <div style={{ fontSize:12, color:'#64748B', marginTop:2 }}>{givePointTarget.email}</div>
              <div style={{ fontSize:13, color:'#2D7A4D', fontWeight:600, marginTop:6 }}>
                현재 보유 포인트: {fmtPrice(givePointTarget.point_balance||0)}P
              </div>
            </div>
            <div className="adm-form">
              <div className="adm-form-row">
                <label className="adm-label">지급 포인트</label>
                <div className="adm-flex-center-gap">
                  <input type="number" className="adm-input-text adm-input-w100"
                    placeholder="예: 1000"
                    value={givePointForm.amount}
                    onChange={e => setGivePointForm(p => ({ ...p, amount: e.target.value }))} />
                  <span className="adm-muted">P (음수 입력 시 차감)</span>
                </div>
              </div>
              <div className="adm-form-row">
                <label className="adm-label">사유</label>
                <input type="text" className="adm-input-text"
                  placeholder="예: 이벤트 당첨, 불편 보상 등"
                  value={givePointForm.desc}
                  onChange={e => setGivePointForm(p => ({ ...p, desc: e.target.value }))} />
              </div>
              <div className="adm-form-actions">
                <button className="adm-btn adm-btn-outline" onClick={() => setGivePointModal(false)}>취소</button>
                <button className="adm-btn adm-btn-primary" onClick={givePoints} disabled={givePointSaving}>
                  {givePointSaving ? '처리 중...' : '지급하기'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== 상품 문의 상세 + 답변 모달 ===== */}
      {selectedProductInquiry && (
        <div className="adm-float-overlay" onClick={() => setSelectedProductInquiry(null)}>
          <div className="adm-float-modal" style={{ maxWidth:540 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #F0F0F0', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, background:'#fff', zIndex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span className="adm-badge badge-paid">{selectedProductInquiry.category}</span>
                {selectedProductInquiry.is_private && <span style={{ fontSize:12 }}>🔒 비밀문의</span>}
                <span className={`adm-badge ${selectedProductInquiry.answer ? 'badge-done' : 'badge-wait'}`}>
                  {selectedProductInquiry.answer ? '답변완료' : '대기중'}
                </span>
              </div>
              <button onClick={() => setSelectedProductInquiry(null)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#94A3B8' }}>✕</button>
            </div>
            <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:14 }}>
              {/* 상품 + 접수일 */}
              <div style={{ background:'#F8FAFC', borderRadius:8, padding:'10px 14px', fontSize:13 }}>
                <div><span style={{ color:'#64748B' }}>상품</span> <strong>{selectedProductInquiry.products?.name || '-'}</strong></div>
                <div style={{ marginTop:4 }}><span style={{ color:'#64748B' }}>접수일</span> {fmtDate(selectedProductInquiry.created_at)}</div>
              </div>
              {/* 문의 내용 */}
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:'#64748B', marginBottom:6 }}>문의 내용</div>
                <div style={{ fontSize:14, lineHeight:1.8, color:'#1A1A1A', background:'#F8FAFC', borderRadius:8, padding:'12px 14px', whiteSpace:'pre-wrap' }}>
                  {selectedProductInquiry.content}
                </div>
              </div>
              {/* 답변 입력 */}
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:'#64748B', marginBottom:6 }}>
                  {selectedProductInquiry.answer ? '답변 수정' : '답변 작성'}
                  {selectedProductInquiry.answered_at && (
                    <span style={{ fontWeight:400, marginLeft:8, color:'#94A3B8' }}>{fmtDate(selectedProductInquiry.answered_at)} 답변됨</span>
                  )}
                </div>
                <textarea rows={5} value={piqAnswer} onChange={e => setPiqAnswer(e.target.value)}
                  placeholder="고객에게 보여질 답변을 입력해주세요."
                  style={{ width:'100%', padding:'10px 12px', border:'1.5px solid #E2E8F0', borderRadius:8, fontSize:14, fontFamily:'inherit', resize:'vertical', outline:'none', boxSizing:'border-box' }} />
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                <button className="adm-btn adm-btn-outline" onClick={() => setSelectedProductInquiry(null)}>닫기</button>
                <button className="adm-btn adm-btn-primary" onClick={answerProductInquiry} disabled={piqAnswering || !piqAnswer.trim()}>
                  {piqAnswering ? '저장 중...' : selectedProductInquiry.answer ? '답변 수정' : '답변 등록'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== 입점문의 상세 모달 ===== */}
      {selectedInquiry && (
        <div className="adm-float-overlay" onClick={() => setSelectedInquiry(null)}>
          <div className="adm-float-modal" style={{ maxWidth:520, padding:28 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h3 style={{ fontSize:15, fontWeight:700, margin:0 }}>입점문의 상세</h3>
              <button onClick={() => setSelectedInquiry(null)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#94A3B8' }}>✕</button>
            </div>
            {[
              ['유형', selectedInquiry.inquiry_type],
              ['업체/이름', selectedInquiry.company],
              ['연락처', selectedInquiry.contact],
              ['이메일', selectedInquiry.email],
              ['접수일', fmtDate(selectedInquiry.created_at)],
            ].map(([l, v]) => (
              <div key={l} style={{ display:'flex', gap:12, marginBottom:12 }}>
                <span style={{ fontSize:13, color:'#64748B', width:72, flexShrink:0 }}>{l}</span>
                <span style={{ fontSize:13, fontWeight:500 }}>{v}</span>
              </div>
            ))}
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:13, color:'#64748B', marginBottom:6 }}>문의 내용</div>
              <div style={{ fontSize:13, background:'#F8FAFC', borderRadius:8, padding:'12px 14px', lineHeight:1.7, whiteSpace:'pre-wrap' }}>{selectedInquiry.message}</div>
            </div>

            {/* ① 회신 보내기 */}
            <div style={{ border:'1px solid #E2E8F0', borderRadius:12, padding:'14px 16px', marginBottom:12 }}>
              <div style={{ fontSize:13, fontWeight:800, color:'#1A1A1A' }}>① 회신 보내기</div>
              <div style={{ fontSize:11, color:'#94A3B8', margin:'2px 0 12px' }}>메시지 <strong>톤</strong>을 고르면 메일·문자 내용이 자동으로 채워집니다. (실제 발송은 메일/문자 앱에서)</div>

              <div style={{ fontSize:11, fontWeight:700, color:'#64748B', marginBottom:6 }}>1. 메시지 톤 선택</div>
              <div className="adm-btn-group" style={{ marginBottom:12 }}>
                {([['general','일반 안내'],['accept','수락 안내'],['reject','거절 안내']] as const).map(([k, l]) => (
                  <button key={k} type="button" className={`adm-seg-btn${inquiryTpl===k?' active':''}`} onClick={() => setInquiryTpl(k)}>{l}</button>
                ))}
              </div>

              <div style={{ fontSize:11, fontWeight:700, color:'#64748B', marginBottom:6 }}>2. 내용 미리보기</div>
              <div style={{ background:'#F8FAFC', border:'1px solid #EEF2F6', borderRadius:8, padding:'10px 12px', fontSize:12.5, color:'#475569', lineHeight:1.65, whiteSpace:'pre-wrap', marginBottom:12, maxHeight:96, overflowY:'auto' }}>
                {inquiryTemplate(inquiryTpl, selectedInquiry.company)}
              </div>

              <div style={{ fontSize:11, fontWeight:700, color:'#64748B', marginBottom:6 }}>3. 보낼 방법 선택</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <a className="adm-btn adm-btn-outline" style={{ fontSize:12, textDecoration:'none' }}
                  href={`mailto:${selectedInquiry.email}?subject=${encodeURIComponent('[델리오] 입점문의 회신')}&body=${encodeURIComponent(inquiryTemplate(inquiryTpl, selectedInquiry.company))}`}>📧 메일로 보내기</a>
                <button className="adm-btn adm-btn-outline" style={{ fontSize:12 }}
                  onClick={() => { navigator.clipboard?.writeText(inquiryTemplate(inquiryTpl, selectedInquiry.company)); alert('위 내용이 복사되었습니다. 문자 앱에 붙여넣어 전송하세요.\n수신번호: ' + selectedInquiry.contact); }}>💬 문자 내용 복사</button>
                <a className="adm-btn adm-btn-outline" style={{ fontSize:12, textDecoration:'none' }}
                  href={`tel:${(selectedInquiry.contact || '').replace(/[^0-9+]/g, '')}`}>📞 전화 {selectedInquiry.contact}</a>
              </div>
            </div>

            {/* ② 처리 결과 */}
            <div style={{ border:'1px solid #E2E8F0', borderRadius:12, padding:'14px 16px' }}>
              <div style={{ fontSize:13, fontWeight:800, color:'#1A1A1A' }}>② 처리 결과 기록</div>
              <div style={{ fontSize:11, color:'#94A3B8', margin:'2px 0 12px' }}>이 입점 문의의 <strong>최종 결정</strong>을 기록합니다. (①의 회신 발송과는 별개)</div>
              {['answered','done'].includes(selectedInquiry.status) ? (
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span className="adm-badge badge-done" style={{ fontSize:13, padding:'6px 14px' }}>✅ 수락 (처리완료)</span>
                  <span style={{ fontSize:12, color:'#94A3B8' }}>이미 처리된 문의입니다.</span>
                </div>
              ) : selectedInquiry.status === 'rejected' ? (
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span className="adm-badge badge-off" style={{ fontSize:13, padding:'6px 14px' }}>거절됨</span>
                  <span style={{ fontSize:12, color:'#94A3B8' }}>이미 처리된 문의입니다.</span>
                </div>
              ) : (
                <div style={{ display:'flex', gap:8 }}>
                  <button className="adm-btn adm-btn-primary" style={{ flex:1 }}
                    onClick={() => updateInquiryStatus(selectedInquiry.id, 'done')}>✅ 수락으로 처리</button>
                  <button className="adm-btn adm-btn-outline" style={{ flex:1, color:'#EF4444', borderColor:'#FECACA' }}
                    onClick={() => updateInquiryStatus(selectedInquiry.id, 'rejected')}>거절로 처리</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== 라운지 등록/수정 모달 ===== */}
      {loungeModal && (
        <div className="adm-float-overlay" onClick={() => setLoungeModal(false)}>
          <div className="adm-float-modal" style={{ maxWidth:560, padding:28 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h3 style={{ fontSize:15, fontWeight:700, margin:0 }}>{editingLounge ? '라운지 수정' : '라운지 등록'}</h3>
              <button onClick={() => setLoungeModal(false)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#94A3B8' }}>✕</button>
            </div>
            <div className="adm-form">

              {/* 카테고리 */}
              <div className="adm-form-row">
                <label className="adm-label">카테고리</label>
                <AdmSelect className="adm-cs-full" value={loungeForm.filter}
                  onChange={v => setLoungeForm(p => ({ ...p, filter: v }))}
                  options={[
                    { value:'recipe', label:'레시피' },
                    { value:'story', label:'과일이야기' },
                    { value:'farm', label:'산지소식' },
                    { value:'health', label:'건강팁' },
                  ]} />
              </div>

              {/* 제목 */}
              <div className="adm-form-row">
                <label className="adm-label">제목 *</label>
                <input type="text" className="adm-input-text" placeholder="제목을 입력해주세요"
                  value={loungeForm.title} onChange={e => setLoungeForm(p => ({ ...p, title: e.target.value }))} />
              </div>

              {/* 배지 / 작성일 */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div className="adm-form-row" style={{ flexDirection:'column', alignItems:'flex-start', gap:4 }}>
                  <label className="adm-label">배지</label>
                  <input type="text" className="adm-input-text" placeholder="예: NEW, HOT"
                    value={loungeForm.badge} onChange={e => setLoungeForm(p => ({ ...p, badge: e.target.value }))} />
                </div>
                <div className="adm-form-row" style={{ flexDirection:'column', alignItems:'flex-start', gap:4 }}>
                  <label className="adm-label">작성일 <span style={{ fontWeight:400, color:'#94A3B8' }}>(달력+시간)</span></label>
                  <input type="datetime-local" className="adm-input-text" style={{ width:'100%' }}
                    value={loungeForm.date} onChange={e => setLoungeForm(p => ({ ...p, date: e.target.value }))} />
                </div>
              </div>

              {/* 썸네일 이미지 */}
              <div className="adm-form-row" style={{ flexDirection:'column', alignItems:'flex-start', gap:6 }}>
                <label className="adm-label">썸네일 이미지 <span style={{ fontWeight:400, color:'#94A3B8' }}>(목록 카드에 표시)</span></label>
                <input ref={loungeThumbRef} type="file" accept="image/*" style={{ display:'none' }}
                  onChange={async e => {
                    const file = e.target.files?.[0]; if (!file) return;
                    const url = await uploadLoungeImage(file, 'thumb');
                    if (url) setLoungeForm(p => ({ ...p, thumbnail_url: url }));
                    e.target.value = '';
                  }} />
                {loungeForm.thumbnail_url ? (
                  <div style={{ position:'relative', width:'100%' }}>
                    <img src={loungeForm.thumbnail_url} alt="" style={{ width:'100%', maxHeight:160, objectFit:'cover', borderRadius:8, border:'1px solid #E2E8F0' }} />
                    <button onClick={() => setLoungeForm(p => ({ ...p, thumbnail_url: '' }))}
                      style={{ position:'absolute', top:6, right:6, background:'rgba(0,0,0,0.5)', border:'none', borderRadius:'50%', color:'#fff', width:24, height:24, cursor:'pointer', fontSize:12 }}>✕</button>
                  </div>
                ) : (
                  <button className="adm-btn adm-btn-outline" style={{ width:'100%', height:72, fontSize:13 }}
                    onClick={() => loungeThumbRef.current?.click()} disabled={loungeThumbUploading}>
                    {loungeThumbUploading ? '업로드 중...' : '🖼 썸네일 업로드'}
                  </button>
                )}
              </div>

              {/* 본문 이미지 */}
              <div className="adm-form-row" style={{ flexDirection:'column', alignItems:'flex-start', gap:6 }}>
                <label className="adm-label">본문 이미지 <span style={{ fontWeight:400, color:'#94A3B8' }}>(상세 페이지 상단)</span></label>
                <input ref={loungeImgRef} type="file" accept="image/*" style={{ display:'none' }}
                  onChange={async e => {
                    const file = e.target.files?.[0]; if (!file) return;
                    const url = await uploadLoungeImage(file, 'img');
                    if (url) setLoungeForm(p => ({ ...p, image_url: url }));
                    e.target.value = '';
                  }} />
                {loungeForm.image_url ? (
                  <div style={{ position:'relative', width:'100%' }}>
                    <img src={loungeForm.image_url} alt="" style={{ width:'100%', objectFit:'cover', borderRadius:8, border:'1px solid #E2E8F0' }} />
                    <button onClick={() => setLoungeForm(p => ({ ...p, image_url: '' }))}
                      style={{ position:'absolute', top:6, right:6, background:'rgba(0,0,0,0.5)', border:'none', borderRadius:'50%', color:'#fff', width:24, height:24, cursor:'pointer', fontSize:12 }}>✕</button>
                  </div>
                ) : (
                  <button className="adm-btn adm-btn-outline" style={{ width:'100%', height:72, fontSize:13 }}
                    onClick={() => loungeImgRef.current?.click()} disabled={loungeImgUploading}>
                    {loungeImgUploading ? '업로드 중...' : '🖼 본문 이미지 업로드'}
                  </button>
                )}
              </div>

              {/* 본문 내용 */}
              <div className="adm-form-row" style={{ flexDirection:'column', alignItems:'flex-start', gap:6 }}>
                <label className="adm-label">본문 내용 <span style={{ fontWeight:400, color:'#94A3B8' }}>(선택, HTML 가능)</span></label>
                <textarea className="adm-textarea" rows={6} style={{ width:'100%' }}
                  placeholder="본문 내용을 입력하세요."
                  value={loungeForm.content}
                  onChange={e => setLoungeForm(p => ({ ...p, content: e.target.value }))} />
              </div>

              {/* 노출 여부 */}
              <div className="adm-form-row">
                <label className="adm-label">노출 여부</label>
                <Toggle defaultOn={loungeForm.is_active} onChange={v => setLoungeForm(p => ({ ...p, is_active: v }))} />
              </div>

              <div className="adm-form-actions">
                <button className="adm-btn adm-btn-outline" onClick={() => setLoungeModal(false)}>취소</button>
                <button className="adm-btn adm-btn-primary" onClick={saveLounge} disabled={loungeSaving}>
                  {loungeSaving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== 쿠폰 생성/수정 모달 ===== */}
      {couponModal && (
        <div className="adm-float-overlay" onClick={() => setCouponModal(false)}>
          <div className="adm-float-modal" style={{ maxWidth:480, padding:28 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h3 style={{ fontSize:15, fontWeight:700, margin:0 }}>{editingCoupon ? '쿠폰 수정' : '쿠폰 생성'}</h3>
              <button onClick={() => setCouponModal(false)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#94A3B8' }}>✕</button>
            </div>
            <div className="adm-form">
              <div className="adm-form-row">
                <label className="adm-label">쿠폰명 *</label>
                <input type="text" className="adm-input-text" placeholder="예: 신규회원 10% 할인"
                  value={couponForm.name} onChange={e => setCouponForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="adm-form-row">
                <label className="adm-label">쿠폰 설명</label>
                <input type="text" className="adm-input-text" placeholder="예: 첫 구매 시 사용 가능한 신규회원 전용 쿠폰"
                  value={couponForm.description} onChange={e => setCouponForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="adm-form-row">
                <label className="adm-label">쿠폰 코드</label>
                <div className="adm-flex-center-gap" style={{ flex:1 }}>
                  <input type="text" className="adm-input-text" style={{ flex:1 }} placeholder="예: WELCOME10 (미입력 시 자동생성)"
                    value={couponForm.code} onChange={e => setCouponForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} />
                  <button type="button" onClick={() => setCouponForm(p => ({ ...p, code: genCouponCode() }))}
                    style={{ padding:'0 14px', height:38, border:'1.5px solid #1A1A1A', background:'#fff', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
                    자동생성
                  </button>
                </div>
              </div>
              <div className="adm-form-row">
                <label className="adm-label">할인 유형</label>
                <AdmSelect value={couponForm.discount_type} onChange={v => setCouponForm(p => ({ ...p, discount_type: v as 'percent'|'fixed' }))}
                  options={[{ value:'percent', label:'정률 (%)' }, { value:'fixed', label:'정액 (원)' }]} />
              </div>
              <div className="adm-form-row">
                <label className="adm-label">할인값</label>
                <div className="adm-flex-center-gap">
                  <input type="number" className="adm-input-text adm-input-w100" min={0}
                    value={couponForm.discount_value} onChange={e => setCouponForm(p => ({ ...p, discount_value: Number(e.target.value) }))} />
                  <span className="adm-muted">{couponForm.discount_type === 'percent' ? '%' : '원'}</span>
                </div>
              </div>
              <div className="adm-form-row">
                <label className="adm-label">최소 주문금액</label>
                <div className="adm-flex-center-gap">
                  <input type="number" className="adm-input-text adm-input-w100" min={0} placeholder="0"
                    value={couponForm.min_order_amount} onChange={e => setCouponForm(p => ({ ...p, min_order_amount: Number(e.target.value) }))} />
                  <span className="adm-muted">원 (0=제한없음)</span>
                </div>
              </div>
              <div className="adm-form-row">
                <label className="adm-label">최대 할인금액</label>
                <div className="adm-flex-center-gap">
                  <input type="number" className="adm-input-text adm-input-w100" min={0} placeholder="제한없음"
                    value={couponForm.max_discount_amount} onChange={e => setCouponForm(p => ({ ...p, max_discount_amount: e.target.value }))} />
                  <span className="adm-muted">원</span>
                </div>
              </div>
              <div className="adm-form-row">
                <label className="adm-label">시작일</label>
                <input type="date" className="adm-input-text"
                  value={couponForm.starts_at} onChange={e => setCouponForm(p => ({ ...p, starts_at: e.target.value }))} />
              </div>
              {/* 일반 쿠폰: 고정 만료일 선택 가능 (신규회원 쿠폰은 발급일 기준이라 숨김) */}
              {!couponForm.signup_grant && (
                <div className="adm-form-row">
                  <label className="adm-label">만료일 <span style={{ fontWeight:400, color:'#94A3B8' }}>(고정 날짜)</span></label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                      <input type="checkbox" checked={!couponForm.expires_at}
                        onChange={e => setCouponForm(p => ({ ...p, expires_at: e.target.checked ? '' : new Date(Date.now() + 30*24*60*60*1000).toISOString().slice(0,10) }))} />
                      무제한 (만료일 없음)
                    </label>
                    {couponForm.expires_at && (
                      <input type="date" className="adm-input-text"
                        value={couponForm.expires_at} onChange={e => setCouponForm(p => ({ ...p, expires_at: e.target.value }))} />
                    )}
                  </div>
                </div>
              )}
              <div className="adm-form-row">
                <label className="adm-label">유효기간 <span style={{ fontWeight:400, color:'#94A3B8' }}>(발급일 기준)</span></label>
                <div style={{ display:'flex', flexDirection:'column', gap:4, flex:1 }}>
                  <div className="adm-flex-center-gap">
                    <input type="number" min={1} className="adm-input-text adm-input-w100" placeholder="예: 30"
                      value={couponForm.valid_days} onChange={e => setCouponForm(p => ({ ...p, valid_days: e.target.value }))} />
                    <span className="adm-muted">일 (발급일로부터)</span>
                  </div>
                  <span style={{ fontSize:11, color: couponForm.signup_grant ? '#B45309' : '#94A3B8' }}>
                    {couponForm.signup_grant
                      ? <>신규회원 쿠폰은 <strong>각 회원 가입일 + N일</strong>로 만료됩니다. (고정 만료일은 사용 안 함 — 반드시 일수 입력)</>
                      : <>회원가입 자동지급·다운로드 쿠폰의 만료일을 <strong>발급일 + N일</strong>로 계산합니다. 비우면 위 만료일(고정) 사용.</>}
                  </span>
                </div>
              </div>
              <div className="adm-form-row">
                <label className="adm-label">활성 여부</label>
                <Toggle defaultOn={couponForm.is_active} onChange={v => setCouponForm(p => ({ ...p, is_active: v }))} />
              </div>
              <div className="adm-form-row">
                <label className="adm-label">회원 다운로드 허용</label>
                <div style={{ display:'flex', flexDirection:'column', gap:4, flex:1 }}>
                  <Toggle defaultOn={couponForm.is_public} onChange={v => setCouponForm(p => ({ ...p, is_public: v }))} />
                  <span style={{ fontSize:11, color:'#94A3B8' }}>켜면 마이페이지·결제창의 &lsquo;쿠폰 다운받기&rsquo;에서 회원이 직접 받을 수 있습니다.</span>
                </div>
              </div>
              <div className="adm-form-row">
                <label className="adm-label">회원가입 자동 지급</label>
                <div style={{ display:'flex', flexDirection:'column', gap:4, flex:1 }}>
                  <Toggle defaultOn={couponForm.signup_grant} onChange={v => setCouponForm(p => ({ ...p, signup_grant: v }))} />
                  <span style={{ fontSize:11, color:'#94A3B8' }}>켜면 신규 회원가입 시 이 쿠폰이 자동으로 지급됩니다(웰컴 쿠폰팩). 여러 개 켜면 모두 지급됩니다.</span>
                </div>
              </div>
              <div className="adm-form-row">
                <label className="adm-label">멤버십 월발급용</label>
                <div style={{ display:'flex', flexDirection:'column', gap:4, flex:1 }}>
                  <Toggle defaultOn={couponForm.is_membership} onChange={v => setCouponForm(p => ({ ...p, is_membership: v }))} />
                  <span style={{ fontSize:11, color:'#94A3B8' }}>켜면 <strong>멤버십 관리 탭</strong>의 등급별 월 발급 쿠폰 목록에 나타납니다. (유효기간 일수 필수 · 등급마다 선택해 매월 발급)</span>
                </div>
              </div>
              <div className="adm-form-actions">
                <button className="adm-btn adm-btn-outline" onClick={() => setCouponModal(false)}>취소</button>
                <button className="adm-btn adm-btn-primary" onClick={saveCoupon} disabled={couponSaving}>
                  {couponSaving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
