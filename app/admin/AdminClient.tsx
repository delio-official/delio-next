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
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  thumbnail_url: string | null;
  farm_id?: string | null;
  farm_name?: string | null;
}
interface Order {
  id: string;
  order_no: string;
  user_id: string | null;
  status: string;
  final_amount: number;
  recipient: string;
  phone: string;
  zipcode: string | null;
  address1: string;
  address2: string | null;
  payment_method: string;
  created_at: string;
  courier: string | null;
  tracking_number: string | null;
  delivery_memo: string | null;
  order_items?: OrderItem[];
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
  seller_score: Record<string, number> | null;
}

interface AdminFarmSimple {
  id: string;
  name: string;
}

interface AdminFarm {
  id: string;
  slug: string;
  name: string;
  farmer_name: string | null;
  region: string | null;
  farm_type: string | null;
  intro: string | null;
  carrier: string | null;
  thumbnail_url: string | null;
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
  products: { name: string } | null;
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
  dashboard:'대시보드', orders:'주문 관리', products:'상품 관리', menu:'메뉴 관리', farms:'농가 관리',
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
  pending:'결제대기', paid:'결제완료', preparing:'상품준비중',
  shipped:'배송중', delivered:'배송완료', confirmed:'구매확정', cancelled:'취소됨',
  refunding:'환불처리중', refunded:'환불완료',
};

const STATUS_BADGE_CLS: Record<string, string> = {
  pending:'badge-wait', paid:'badge-paid', preparing:'badge-ready',
  shipped:'badge-shipping', delivered:'badge-done', confirmed:'badge-done', cancelled:'badge-off',
  refunding:'badge-refund', refunded:'badge-off',
};

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

/* 주문 단계 플로우 (대시보드·주문관리 공용) — 스마트스토어식 */
const ORDER_STAGES: { key: string; label: string }[] = [
  { key:'paid',      label:'신규주문' },
  { key:'preparing', label:'배송준비' },
  { key:'shipped',   label:'배송중' },
  { key:'delivered', label:'배송완료' },
  { key:'confirmed', label:'구매확정' },
];

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
    /* 광고성 단체발송은 마케팅 SMS 수신 동의 회원에게만 (법적 필수) */
    filtered = filtered.filter(m => m.marketing_sms === true);
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

              {targetMode !== 'custom' && (
                <div className="adm-muted" style={{ fontSize:12 }}>
                  ※ 광고성 발송은 <strong>마케팅 SMS 수신 동의 회원</strong>에게만 발송됩니다.
                </div>
              )}

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
                  <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, cursor:'pointer', whiteSpace:'nowrap' }}>
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
              <span style={{ fontSize:15, fontWeight:800 }}>SMS 미리보기</span>
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
  const last = data[n-1];
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display:'block' }}>
      <path d={area} fill={color} opacity={0.1} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {n>1 && <circle cx={X(n-1)} cy={Y(last)} r={2.4} fill={color} />}
    </svg>
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
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  function toggle() {
    if (disabled) return;
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const listH = Math.min(280, options.length * 38 + 12);
      setDropUp(window.innerHeight - rect.bottom < listH + 16 && rect.top > listH + 16);
    }
    setOpen(o => !o);
  }
  const selected = options.find(o => o.value === value);
  return (
    <div ref={ref} className={`adm-cs${className ? ' ' + className : ''}`} style={style}>
      <button ref={btnRef} type="button" className={`adm-cs-btn${open ? ' open' : ''}`} disabled={disabled}
        onClick={toggle}>
        <span className={selected ? 'adm-cs-val' : 'adm-cs-ph'}>{selected ? selected.label : (placeholder || '선택')}</span>
        <svg className="adm-cs-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <div className="adm-cs-list" style={dropUp ? { top: 'auto', bottom: 'calc(100% + 5px)' } : undefined}>
          {options.map(o => (
            <button type="button" key={o.value} className={`adm-cs-item${o.value === value ? ' active' : ''}`}
              onClick={() => { onChange(o.value); setOpen(false); }}>
              {o.label}
              {o.value === value && <svg className="adm-cs-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ===== 옵션 트리 에디터 (단품 / 1단계 / 2단계 상위→하위) =====
 *  A안: 가격·재고는 하위(잎)에만. 상위는 분류 선택지(가격·재고 없음). */
type POpt = { group: string; required: boolean; label: string; add_price: number; stock: number; parent_label?: string };
function OptionTreeEditor({ options, setOptions }: {
  options: POpt[];
  setOptions: React.Dispatch<React.SetStateAction<POpt[]>>;
}) {
  const groups = [...new Set(options.map(o => o.group))];
  const idx = options.map((o, i) => ({ ...o, _i: i }));
  const dataCascade = options.some(o => (o.parent_label || '').trim() !== '');
  const [mode, setMode] = useState<'indep' | 'cascade'>(dataCascade ? 'cascade' : 'indep');
  // 옵션이 늦게 로드돼도, parent_label이 있으면 자동으로 2단계 모드로 (사용자가 직접 토글하면 그 뒤론 유지)
  const userTouchedMode = useRef(false);
  const lastCascade = useRef<POpt[] | null>(null); // 단일 전환 직전 2단계 구성 스냅샷 → 다시 2단계로 오면 복원
  useEffect(() => { if (!userTouchedMode.current) setMode(dataCascade ? 'cascade' : 'indep'); }, [dataCascade]);

  const patch = (_i: number, p: Partial<POpt>) => setOptions(prev => prev.map((o, i) => i === _i ? { ...o, ...p } : o));
  const removeAt = (_i: number) => setOptions(prev => prev.filter((_, i) => i !== _i));
  const renameGroup = (oldG: string, nv: string) => setOptions(prev => prev.map(o => o.group === oldG ? { ...o, group: nv } : o));
  const setGroupReq = (g: string, req: boolean) => setOptions(prev => prev.map(o => o.group === g ? { ...o, required: req } : o));
  const clearAll = () => { if (confirm('옵션을 모두 지우고 단품으로 바꿀까요?')) { lastCascade.current = null; setOptions([]); } };

  const reqToggle = (g: string, req: boolean) => (
    <div style={{ display:'inline-flex', border:'1px solid #E2E8F0', borderRadius:6, overflow:'hidden', flexShrink:0 }}>
      <button type="button" onClick={() => setGroupReq(g, true)} style={{ fontSize:11, padding:'4px 9px', border:'none', cursor:'pointer', fontWeight:600, background: req ? '#1A1A1A':'#fff', color: req ? '#fff':'#64748B' }}>필수</button>
      <button type="button" onClick={() => setGroupReq(g, false)} style={{ fontSize:11, padding:'4px 9px', border:'none', borderLeft:'1px solid #E2E8F0', cursor:'pointer', fontWeight:600, background: !req ? '#1A1A1A':'#fff', color: !req ? '#fff':'#64748B' }}>선택</button>
    </div>
  );
  const valueRow = (o: { _i:number; label:string; add_price:number; stock:number }) => (
    <div key={o._i} style={{ display:'flex', gap:6, alignItems:'center', marginBottom:6, marginLeft:16 }}>
      <span style={{ color:'#CBD5E1', flexShrink:0 }}>└</span>
      <input className="adm-input-text" style={{ flex:1, minWidth:0 }} placeholder="예: 1kg" value={o.label} onChange={e => patch(o._i, { label: e.target.value })} />
      <span style={{ fontSize:11, color:'#94A3B8', flexShrink:0 }}>+</span>
      <input className="adm-input-text" style={{ width:84, minWidth:0 }} type="number" placeholder="0" value={o.add_price || ''} onChange={e => patch(o._i, { add_price: Number(e.target.value) })} />
      <span style={{ fontSize:11, color:'#94A3B8', flexShrink:0 }}>원</span>
      <input className="adm-input-text" style={{ width:72, minWidth:0 }} type="number" placeholder="0" value={o.stock || ''} onChange={e => patch(o._i, { stock: Number(e.target.value) })} />
      <span style={{ fontSize:11, color:'#94A3B8', flexShrink:0 }}>재고</span>
      <button type="button" onClick={() => removeAt(o._i)} style={{ width:28, height:28, border:'1px solid #FECACA', background:'#fff', color:'#DC2626', borderRadius:6, cursor:'pointer', flexShrink:0 }}>×</button>
    </div>
  );
  const addBtn = (label: string, onClick: () => void) => (
    <button type="button" onClick={onClick} style={{ fontSize:12, color:'#2563EB', background:'#fff', border:'1px dashed #BFDBFE', borderRadius:6, padding:'7px 10px', cursor:'pointer', width:'100%', marginTop:4 }}>{label}</button>
  );

  /* ── 독립 모드 helpers ── */
  const addValue = (g: string) => { const req = options.find(o => o.group === g)?.required !== false; setOptions(prev => [...prev, { group: g, required: req, label:'', add_price:0, stock:0, parent_label:'' }]); };
  const removeGroup = (g: string) => setOptions(prev => prev.filter(o => o.group !== g));
  const addGroup = () => setOptions(prev => { const gs = [...new Set(prev.map(o => o.group))]; let n = gs.length + 1, name = `옵션${n}`; while (gs.includes(name)) { n++; name = `옵션${n}`; } return [...prev, { group: name, required:true, label:'', add_price:0, stock:0, parent_label:'' }]; });

  /* ── 2단계(종속) helpers — 1번째 그룹=상위(분류), 2번째=하위(값). 위치로 식별(파생값엔 폴백 없음 → 리셋·desync 방지) ── */
  const supName = groups[0] ?? '';
  const subName = groups[1] ?? '';
  const supReq = options.find(o => o.group === supName)?.required !== false;
  const subReq = options.find(o => o.group === subName)?.required !== false;
  const supOpts = idx.filter(o => o.group === supName);
  const subOpts = idx.filter(o => o.group === subName);
  const renameSup = (_i: number, oldLabel: string, nv: string) => setOptions(prev => prev.map((o, i) => {
    if (i === _i) return { ...o, label: nv };
    if (o.group === subName && (o.parent_label || '') === (oldLabel || '')) return { ...o, parent_label: nv };
    return o;
  }));
  const addSup = () => setOptions(prev => [...prev, { group: supName || '분류', required: supReq, label:'', add_price:0, stock:0, parent_label:'' }]);
  const addSubUnder = (parentLabel: string) => setOptions(prev => [...prev, { group: subName || '옵션', required: subReq, label:'', add_price:0, stock:0, parent_label: parentLabel }]);

  /* ── 시작 / 모드 전환 ── */
  const startOne = () => { userTouchedMode.current = true; lastCascade.current = null; setOptions([{ group:'옵션', required:true, label:'', add_price:0, stock:0, parent_label:'' }]); setMode('indep'); };
  const startTwo = () => { userTouchedMode.current = true; lastCascade.current = null; setOptions([{ group:'분류', required:true, label:'', add_price:0, stock:0, parent_label:'' }]); setMode('cascade'); };
  const toIndep = () => {
    const hasCascade = options.some(o => (o.parent_label || '').trim());
    userTouchedMode.current = true;
    lastCascade.current = hasCascade ? options : null; // 복원용 스냅샷 (다시 2단계 누르면 복원)
    setOptions(prev => {
      const names = [...new Set(prev.map(o => o.group))];
      // 종속이면 하위(값) 그룹을, 아니면 첫 그룹을 단일 옵션으로 유지
      const keep = (prev.some(o => (o.parent_label || '').trim()) && names[1]) ? names[1] : names[0];
      return prev.filter(o => o.group === keep).map(o => ({ ...o, parent_label:'' }));
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
      return [{ group:'분류', required:true, label:'', add_price:0, stock:0, parent_label:'' }, ...prev.map(o => ({ ...o, parent_label:'' }))];
    });
    setMode('cascade');
  };

  if (options.length === 0) {
    return (
      <div>
        <div style={{ fontSize:12, color:'#64748B', padding:'4px 0 12px' }}>옵션 없는 <strong>단품</strong>입니다. 옵션이 필요하면 방식을 고르세요.</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button type="button" className="adm-btn adm-btn-outline" style={{ fontSize:12 }} onClick={startOne}>+ 단일 옵션 <span style={{ color:'#94A3B8' }}>(예: 중량만)</span></button>
          <button type="button" className="adm-btn adm-btn-outline" style={{ fontSize:12 }} onClick={startTwo}>+ 2단계 옵션 <span style={{ color:'#94A3B8' }}>(예: 품종 → 중량)</span></button>
        </div>
      </div>
    );
  }

  const modeBar = (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, flexWrap:'wrap' }}>
      <div style={{ display:'inline-flex', border:'1px solid #E2E8F0', borderRadius:6, overflow:'hidden' }}>
        <button type="button" onClick={() => mode !== 'indep' && toIndep()} style={{ fontSize:11, padding:'5px 11px', border:'none', cursor:'pointer', fontWeight:700, background: mode==='indep'?'#1A1A1A':'#fff', color: mode==='indep'?'#fff':'#64748B' }}>단일 옵션</button>
        <button type="button" onClick={() => mode !== 'cascade' && toCascade()} style={{ fontSize:11, padding:'5px 11px', border:'none', borderLeft:'1px solid #E2E8F0', cursor:'pointer', fontWeight:700, background: mode==='cascade'?'#1A1A1A':'#fff', color: mode==='cascade'?'#fff':'#64748B' }}>2단계(분류→옵션)</button>
      </div>
      <button type="button" onClick={clearAll} style={{ fontSize:11, color:'#DC2626', background:'#fff', border:'1px solid #FECACA', borderRadius:6, padding:'4px 9px', cursor:'pointer' }}>옵션 없애기</button>
    </div>
  );

  if (mode === 'cascade') {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {modeBar}
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <span style={{ fontSize:11, color:'#1A8A4C', fontWeight:800 }}>상위(분류)</span>
          <input className="adm-input-text" style={{ flex:1, maxWidth:150, minWidth:0, fontWeight:600 }} value={supName} placeholder="예: 품종" onChange={e => renameGroup(supName, e.target.value)} />
          {reqToggle(supName, supReq)}
          <span style={{ fontSize:11, color:'#7C3AED', fontWeight:800, marginLeft:6 }}>하위(옵션)</span>
          <input className="adm-input-text" style={{ flex:1, maxWidth:150, minWidth:0, fontWeight:600 }} value={subName} placeholder="예: 중량" onChange={e => renameGroup(subName, e.target.value)} />
          {reqToggle(subName, subReq)}
        </div>
        <div style={{ fontSize:11, color:'#94A3B8' }}>분류를 고르면 그 분류의 하위 옵션만 보입니다. 가격·재고는 하위에만 입력하세요.</div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {supOpts.map(sup => (
            <div key={sup._i} style={{ border:'1px solid #EEF2F6', borderRadius:8, padding:'10px', background:'#fff' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                <span style={{ color:'#1A8A4C', fontWeight:800, flexShrink:0 }}>●</span>
                <input className="adm-input-text" style={{ flex:1, minWidth:0, fontWeight:600 }} placeholder="예: 무농약 방울토마토" value={sup.label} onChange={e => renameSup(sup._i, sup.label, e.target.value)} />
                <button type="button" onClick={() => removeAt(sup._i)} style={{ fontSize:11, color:'#DC2626', background:'#fff', border:'1px solid #FECACA', borderRadius:6, padding:'4px 9px', cursor:'pointer', flexShrink:0 }}>분류 삭제</button>
              </div>
              {subOpts.filter(s => (s.parent_label || '') === (sup.label || '')).map(s => valueRow(s))}
              {addBtn(`+ ${sup.label || '이 분류'}의 옵션 추가`, () => addSubUnder(sup.label))}
            </div>
          ))}
        </div>
        {addBtn('+ 분류 추가', addSup)}
      </div>
    );
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {modeBar}
      <span style={{ fontSize:11, color:'#94A3B8' }}>옵션 하나만 고르는 상품입니다 (예: <b>중량</b> 1kg/2kg/3kg). 품종별로 가격이 다르면 <b>2단계</b>를 쓰세요.</span>
      {(() => {
        const g = groups[0] || '옵션';
        const gReq = options.find(o => o.group === g)?.required !== false;
        const gOpts = idx.filter(o => o.group === g);
        return (
          <div style={{ border:'1px solid #E2E8F0', borderRadius:8, padding:12, background:'#FAFBFC' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, flexWrap:'wrap' }}>
              <span style={{ color:'#1A8A4C', fontWeight:800, flexShrink:0 }}>●</span>
              <span style={{ fontSize:11, color:'#64748B', fontWeight:800 }}>옵션명</span>
              <input className="adm-input-text" style={{ flex:1, maxWidth:180, minWidth:0, fontWeight:600 }} value={g} placeholder="예: 중량" onChange={e => renameGroup(g, e.target.value)} />
              {reqToggle(g, gReq)}
            </div>
            {gOpts.map(o => valueRow(o))}
            {addBtn('+ 옵션값 추가', () => addValue(g))}
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
  const [farmModal, setFarmModal] = useState(false);
  const [farms, setFarms] = useState<AdminFarm[]>([]);
  const [farmsLoading, setFarmsLoading] = useState(false);
  const [editingFarm, setEditingFarm] = useState<AdminFarm | null>(null);
  const [farmSaving, setFarmSaving] = useState(false);
  const [farmForm, setFarmForm] = useState({ name: '', farmer_name: '', region: '', farm_type: '', intro: '', carrier: '', thumbnail_url: '', landing_images: [] as string[] });
  const [farmImgUploading, setFarmImgUploading] = useState(false);
  const [farmTypeFilter, setFarmTypeFilter] = useState('');


  /* ── 상품 등록/수정 모달 ── */
  const [productModal, setProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AdminProductFull | null>(null);

  /* ── 상세설명 / 상세정보 에디터 ── */
  const [detailEditor, setDetailEditor] = useState<{ id: string; name: string } | null>(null);
  const [infoEditor,   setInfoEditor]   = useState<{ id: string; name: string } | null>(null);
  const [farmList, setFarmList] = useState<AdminFarmSimple[]>([]);
  const [farmSearch, setFarmSearch] = useState('');
  const [farmPickOpen, setFarmPickOpen] = useState(false);
  const PRODUCT_EMPTY: Omit<AdminProductFull, 'id' | 'discounted_price' | 'created_at'> = {
    sku: '', name: '', category: 'apple', origin: 'domestic', origin_region: '', supply_price: 0, price: 0, discount_rate: 0,
    short_desc: '', thumbnail_url: '', image_urls: [null, null, null, null, null],
    dispatch_cutoff: '11:00', brix: null, badge: '', badge_color: BADGE_DEFAULT_COLOR, is_new: false,
    is_best: false, is_dawn: false, is_active: true, farm_id: null, sort_order: 0,
    seller_score: null,
  };
  const [pForm, setPForm] = useState({ ...PRODUCT_EMPTY });
  const [pSaving, setPSaving] = useState(false);
  const [pDiscMode, setPDiscMode] = useState<'rate'|'amount'>('rate');
  const [pDiscAmount, setPDiscAmount] = useState(''); // '원 할인' 모드 입력값(원)
  // 금액 입력 → 가격 기준으로 할인율(%) 환산 (가격 입력 순서 무관)
  useEffect(() => {
    if (pDiscMode !== 'amount' || pDiscAmount === '') return;
    setPForm(f => {
      if (!(f.price > 0)) return f;
      const r = Math.min(99, Math.max(0, Math.round(Number(pDiscAmount) / f.price * 100)));
      return f.discount_rate === r ? f : { ...f, discount_rate: r };
    });
  }, [pDiscAmount, pDiscMode]);
  /* 상품 옵션 (label / add_price / stock) */
  const [pOptions, setPOptions] = useState<{ group: string; required: boolean; label: string; add_price: number; stock: number; parent_label?: string }[]>([]);
  const [pImgUploading, setPImgUploading] = useState(false);
  const pImgRef = useRef<HTMLInputElement>(null);
  const pImgSlotRef = useRef<number>(0);   // 현재 업로드 중인 슬롯 (0 = 대표, 1~5 = 추가)
  // 업로드된 URL을 ref로도 보관 → 스테일 클로저로 인한 null 저장 방지
  const uploadedThumbnailRef = useRef<string>('');

  async function uploadProductImage(file: File): Promise<string | null> {
    setPImgUploading(true);
    const supabase = createClient();
    const ext = file.name.split('.').pop();
    const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    console.log('[업로드] 시작 →', path);
    const { error } = await supabase.storage.from('products').upload(path, file, { upsert: true });
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
  const [dashExtra, setDashExtra] = useState<{ cancelReq:number; refunding:number; exchanging:number; shipDelay:number; refundDelay:number }>({ cancelReq:0, refunding:0, exchanging:0, shipDelay:0, refundDelay:0 });
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
    const curEnd = new Date(today);
    if (range === 'day') {
      curStart = new Date(today);
      prevEnd = new Date(today); prevEnd.setDate(prevEnd.getDate()-1); prevStart = new Date(prevEnd);
    } else if (range === 'week') {
      curStart = new Date(today); curStart.setDate(curStart.getDate()-6);
      prevEnd = new Date(curStart); prevEnd.setDate(prevEnd.getDate()-1);
      prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate()-6);
    } else {
      curStart = new Date(today.getFullYear(), today.getMonth(), 1);
      prevStart = new Date(today.getFullYear(), today.getMonth()-1, 1);
      prevEnd = new Date(today.getFullYear(), today.getMonth()-1, today.getDate());
    }
    /* 현재 기간의 일자 키 목록 (그래프 X축) */
    const dayKeys:string[] = [];
    { const d = new Date(curStart); while (d <= curEnd) { dayKeys.push(fmt(d)); d.setDate(d.getDate()+1); } }

    const supabase = createClient();
    const valid = ['paid','preparing','shipped','delivered','confirmed'];
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
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [orderFarmFilter, setOrderFarmFilter] = useState('');
  const [orderReqOnly, setOrderReqOnly] = useState(false);
  const [orderDateBasis, setOrderDateBasis] = useState<'created_at'|'paid_at'>('created_at');
  const [orderFrom, setOrderFrom] = useState<string>(() => { const d = new Date(); d.setMonth(d.getMonth()-1); return ymd(d); });
  const [orderTo, setOrderTo] = useState<string>(() => ymd(new Date()));
  const [orderPageSize, setOrderPageSize] = useState(50);
  const [orderPage, setOrderPage] = useState(1);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [trackingInput, setTrackingInput] = useState({ courier: '', tracking_number: '' });
  const [savingTracking, setSavingTracking] = useState(false);
  const [showTrackingModal, setShowTrackingModal] = useState(false);

  /* ── 상품 ── */
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productCatFilter, setProductCatFilter] = useState('');
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
  const [farmDetail, setFarmDetail] = useState<{
    sales: number; payout: number; margin: number; qty: number; orderCount: number;
    topProducts: { name: string; qty: number; amount: number }[];
    monthly: { ym: string; amount: number }[];
    recentReviews: { id: string; rating: number; content: string; created_at: string; product_name: string }[];
  } | null>(null);

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
      supabase.from('orders').select('final_amount, created_at').gte('created_at', monthStart),
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
    const [cancelReqRes, refundingRes, exchangeRes, shipDelayRes, refundDelayRes] = await Promise.all([
      supabase.from('refund_requests').select('id', { count:'exact', head:true }).eq('status', 'pending'),
      supabase.from('orders').select('id', { count:'exact', head:true }).eq('status', 'refunding'),
      supabase.from('orders').select('id', { count:'exact', head:true }).in('status', ['exchanging','exchanged']),
      supabase.from('orders').select('id', { count:'exact', head:true }).in('status', ['paid','preparing']).lt('created_at', twoDaysAgo),
      supabase.from('refund_requests').select('id', { count:'exact', head:true }).eq('status', 'pending').lt('created_at', twoDaysAgo),
    ]);
    setDashExtra({
      cancelReq:  cancelReqRes.count   || 0,
      refunding:  refundingRes.count   || 0,
      exchanging: exchangeRes.count    || 0,
      shipDelay:  shipDelayRes.count   || 0,
      refundDelay: refundDelayRes.count || 0,
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

    // ── 차트 데이터 (최근 30일 일별 매출) ──
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    const { data: chartOrders } = await supabase
      .from('orders')
      .select('final_amount, created_at')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .in('status', ['paid', 'preparing', 'shipped', 'delivered']);

    const dayMap: Record<string, number> = {};
    (chartOrders || []).forEach((o: { final_amount: number; created_at: string }) => {
      const day = o.created_at.slice(0, 10);
      dayMap[day] = (dayMap[day] || 0) + o.final_amount;
    });

    const labels30: string[] = [], values30: number[] = [];
    const labels7: string[]  = [], values7: number[]  = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key   = d.toISOString().slice(0, 10);
      const label = `${d.getMonth()+1}/${d.getDate()}`;
      labels30.push(label);
      values30.push(dayMap[key] || 0);
      if (i < 7) { labels7.push(label); values7.push(dayMap[key] || 0); }
    }
    setChartData({ '7': { labels: labels7, values: values7 }, '30': { labels: labels30, values: values30 } });

    setStatsLoading(false);
  }

  async function loadOrders(opts?: { from?: string; to?: string; basis?: 'created_at'|'paid_at' }) {
    setOrdersLoading(true);
    setOrderPage(1);
    const basis = opts?.basis ?? orderDateBasis;
    const from  = opts?.from  ?? orderFrom;
    const to    = opts?.to    ?? orderTo;
    const supabase = createClient();
    let query = supabase
      .from('orders')
      .select('*,order_items(product_name,option_label,quantity,unit_price,subtotal,supply_price,thumbnail_url,products(farm_id,farms(name,carrier)))')
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
        return { ...rest, farm_id: prod?.farm_id ?? null, farm_name: farm?.name ?? null, carrier: farm?.carrier ?? null };
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
      .select('id, name, category, price, discount_rate, discounted_price, is_active, farm_id, sort_order, created_at, product_options(stock)')
      .order('sort_order')
      .limit(200);
    /* 옵션 재고 합계 → total_stock 평탄화 (품절 판정용). 단품(옵션 0개)은 null = 재고 N/A */
    const flat = (data || []).map((p: Record<string, unknown>) => {
      const opts = (p.product_options as { stock: number }[]) || [];
      const total_stock = opts.length > 0 ? opts.reduce((s, o) => s + (o.stock || 0), 0) : null;
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
      supabase.from('farms').select('id, slug, name, farmer_name, region, farm_type, intro, carrier, thumbnail_url, landing_images, created_at').order('name'),
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
    setFarmDetailTarget(farm); setFarmDetailOpen(true); setFarmDetailLoading(true); setFarmDetail(null);
    const supabase = createClient();
    const { data: prods } = await supabase.from('products').select('id, name').eq('farm_id', farm.id);
    const prodIds = (prods || []).map((p: { id: string }) => p.id);
    const prodName = new Map((prods || []).map((p: { id: string; name: string }) => [p.id, p.name]));
    if (prodIds.length === 0) {
      setFarmDetail({ sales:0, payout:0, margin:0, qty:0, orderCount:0, topProducts:[], monthly:[], recentReviews:[] });
      setFarmDetailLoading(false); return;
    }
    // 주문항목(배송완료/구매확정)
    const items: { order_id: string; product_id: string; quantity: number; subtotal: number; supply_price: number|null; orders: { created_at: string } | null }[] = [];
    for (let i = 0; i < prodIds.length; i += 200) {
      const { data: it } = await supabase.from('order_items')
        .select('order_id, product_id, quantity, subtotal, supply_price, orders!inner(status, created_at)')
        .in('product_id', prodIds.slice(i, i + 200)).in('orders.status', ['delivered','confirmed']).limit(10000);
      if (it) items.push(...(it as unknown as typeof items));
    }
    let sales = 0, payout = 0, qty = 0;
    const orderSet = new Set<string>();
    const pMap: Record<string, { qty: number; amount: number }> = {};
    const mMap: Record<string, number> = {};
    items.forEach(it => {
      const q = it.quantity || 0; sales += it.subtotal || 0; payout += (it.supply_price || 0) * q; qty += q;
      if (it.order_id) orderSet.add(it.order_id);
      const nm = (prodName.get(it.product_id) as string) || '(상품)';
      if (!pMap[nm]) pMap[nm] = { qty: 0, amount: 0 }; pMap[nm].qty += q; pMap[nm].amount += it.subtotal || 0;
      const ca = it.orders?.created_at; if (ca) { const d = new Date(ca); const ym = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}`; mMap[ym] = (mMap[ym] || 0) + (it.subtotal || 0); }
    });
    const topProducts = Object.entries(pMap).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.amount - a.amount).slice(0, 5);
    const monthly = Object.entries(mMap).map(([ym, amount]) => ({ ym, amount })).sort((a, b) => a.ym.localeCompare(b.ym)).slice(-6);
    // 최근 리뷰
    const { data: revs } = await supabase.from('reviews').select('id, rating, content, created_at, product_id').in('product_id', prodIds).order('created_at', { ascending: false }).limit(3);
    const recentReviews = (revs || []).map((r: { id: string; rating: number; content: string; created_at: string; product_id: string }) => ({ id: r.id, rating: r.rating, content: r.content, created_at: r.created_at, product_name: (prodName.get(r.product_id) as string) || '' }));
    setFarmDetail({ sales, payout, margin: sales - payout, qty, orderCount: orderSet.size, topProducts, monthly, recentReviews });
    setFarmDetailLoading(false);
  }

  function openFarmModal(farm?: AdminFarm) {
    if (farm) {
      setEditingFarm(farm);
      setFarmForm({ name: farm.name, farmer_name: farm.farmer_name || '', region: farm.region || '', farm_type: farm.farm_type || '', intro: farm.intro || '', carrier: farm.carrier || '', thumbnail_url: farm.thumbnail_url || '', landing_images: farm.landing_images || [] });
    } else {
      setEditingFarm(null);
      setFarmForm({ name: '', farmer_name: '', region: '', farm_type: '', intro: '', carrier: '', thumbnail_url: '', landing_images: [] });
    }
    setFarmModal(true);
  }

  async function saveFarm() {
    if (!farmForm.name.trim()) { alert('농가명을 입력해주세요.'); return; }
    setFarmSaving(true);
    const supabase = createClient();
    let slug = farmForm.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9가-힣-]/g, '').replace(/^-+|-+$/g, '');
    if (!slug) slug = 'farm-' + Date.now().toString(36);   // 한글 자모/특수문자만이면 빈 slug 방지(=404)
    const payload = { name: farmForm.name.trim(), farmer_name: farmForm.farmer_name || null, region: farmForm.region || null, farm_type: farmForm.farm_type || null, intro: farmForm.intro || null, carrier: farmForm.carrier || null, thumbnail_url: farmForm.thumbnail_url || null, landing_images: farmForm.landing_images.length ? farmForm.landing_images : null };
    if (editingFarm) {
      // 기존에 slug가 비어있던 농가(404 나던)는 수정 시 새 slug로 채워줌
      const editPayload = editingFarm.slug ? payload : { ...payload, slug };
      const { error } = await supabase.from('farms').update(editPayload).eq('id', editingFarm.id);
      if (!error) setFarms(prev => prev.map(f => f.id === editingFarm.id ? { ...f, ...editPayload } : f));
      else { alert('수정 실패: ' + error.message); setFarmSaving(false); return; }
    } else {
      const { data, error } = await supabase.from('farms').insert({ ...payload, slug }).select().single();
      if (!error && data) { setFarms(prev => [...prev, data as AdminFarm]); setFarmList(prev => [...prev, { id: (data as AdminFarm).id, name: (data as AdminFarm).name }]); }
      else { alert('등록 실패: ' + (error?.message || '')); setFarmSaving(false); return; }
    }
    setFarmSaving(false);
    setFarmModal(false);
  }

  async function deleteFarm(id: string) {
    if (!confirm('이 농가를 삭제하시겠습니까? 연결된 상품의 농가 정보도 해제됩니다.')) return;
    const supabase = createClient();
    await supabase.from('farms').delete().eq('id', id);
    setFarms(prev => prev.filter(f => f.id !== id));
  }

  async function loadFarmList() {
    if (farmList.length > 0) return;
    const supabase = createClient();
    const { data } = await supabase.from('farms').select('id, name').order('name');
    setFarmList((data as AdminFarmSimple[]) || []);
  }

  /* 카테고리별 다음 SKU 자동생성: APL-0001 */
  async function generateSku(category: string): Promise<string> {
    const code = CAT_SKU_CODE[category] || 'PRD';
    const supabase = createClient();
    const { data } = await supabase.from('products')
      .select('sku').eq('category', category).like('sku', `${code}-%`);
    let max = 0;
    (data || []).forEach((r: { sku: string | null }) => {
      const m = r.sku?.match(new RegExp(`^${code}-(\\d+)$`));
      if (m) max = Math.max(max, parseInt(m[1]));
    });
    return `${code}-${String(max + 1).padStart(4, '0')}`;
  }

  /* 상품 이미지 순서 변경 ([대표, ...추가5] 통합 배열에서 스왑) */
  function movePImg(i: number, dir: -1 | 1) {
    const arr: (string|null)[] = [pForm.thumbnail_url || null, ...((pForm.image_urls as (string|null)[]) || [null,null,null,null,null])];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    uploadedThumbnailRef.current = arr[0] || '';
    setPForm(f => ({ ...f, thumbnail_url: arr[0] || '', image_urls: arr.slice(1) }));
  }

  function openProductModal(p?: AdminProduct) {
    loadFarmList();
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
          setPForm({
            sku: data.sku || '', name: data.name, category: data.category,
            origin: data.origin || '', origin_region: data.origin_region || '', supply_price: data.supply_price ?? 0, price: data.price, discount_rate: data.discount_rate,
            short_desc: data.short_desc || '', thumbnail_url: thumb, image_urls: imageUrls,
            dispatch_cutoff: data.dispatch_cutoff || '',
            brix: data.brix, badge: data.badge || '', badge_color: data.badge_color || BADGE_DEFAULT_COLOR, is_new: data.is_new,
            is_best: data.is_best, is_dawn: data.is_dawn, is_active: data.is_active,
            farm_id: data.farm_id, sort_order: data.sort_order || 0,
            seller_score: data.seller_score || null,
          });
          setProductModal(true);
        }
      });
      // 옵션 로드
      supabase.from('product_options').select('label, add_price, stock, group_name, is_required, parent_label')
        .eq('product_id', p.id).order('sort_order')
        .then(({ data }) => {
          setPOptions(((data || []) as { label: string; add_price: number; stock: number; group_name: string | null; is_required: boolean | null; parent_label: string | null }[]).map(o =>
            ({ group: o.group_name || '옵션', required: o.is_required !== false, label: o.label, add_price: o.add_price || 0, stock: o.stock ?? 0, parent_label: o.parent_label || '' })));
        });
    } else {
      setEditingProduct(null);
      uploadedThumbnailRef.current = '';          // 새 등록 시 ref 초기화
      setPForm({ ...PRODUCT_EMPTY });
      setPOptions([{ group: '옵션', required: true, label: '기본', add_price: 0, stock: 999 }]);  // 단품 기본 옵션
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
      farm_id:        pForm.farm_id               || null,
      sort_order:     Number(pForm.sort_order)    || 0,
      seller_score:   pForm.seller_score && Object.keys(pForm.seller_score).length > 0 ? pForm.seller_score : null,
    };
    let productId = editingProduct?.id;
    if (editingProduct) {
      const { error } = await supabase.from('products').update(payload).eq('id', editingProduct.id);
      if (error) { console.error('상품 저장 오류:', error); alert(`저장 실패: ${error.message}`); setPSaving(false); return; }
    } else {
      const { data, error } = await supabase.from('products').insert(payload).select('id').single();
      if (error || !data) { console.error('상품 저장 오류:', error); alert(`저장 실패: ${error?.message || ''}`); setPSaving(false); return; }
      productId = data.id;
    }

    // ── 옵션 저장 (기존 삭제 후 재삽입) ──
    if (productId) {
      await supabase.from('product_options').delete().eq('product_id', productId);
      const validOpts = pOptions.filter(o => o.label.trim());
      if (validOpts.length > 0) {
        await supabase.from('product_options').insert(
          validOpts.map((o, i) => ({
            product_id: productId,
            group_name: o.group?.trim() || '옵션',
            is_required: o.required !== false,
            label: o.label.trim(),
            add_price: Number(o.add_price) || 0,
            stock: Number(o.stock) || 0,
            parent_label: o.parent_label?.trim() || null,
            is_default: i === 0,
            sort_order: i + 1,
          }))
        );
      }
    }

    setPSaving(false);
    setProductModal(false);
    loadProducts();
    return productId;
  }

  /* 저장 후 상세 에디터(상세설명/상세정보) 바로 열기 — 등록 화면에서 한 번에 */
  async function saveAndEditDetail(kind: 'desc' | 'info') {
    const id = editingProduct?.id || await saveProduct();
    if (!id) return;
    const name = pForm.name.trim();
    if (kind === 'desc') setDetailEditor({ id, name });
    else setInfoEditor({ id, name });
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
      if (ord?.phone) {
        fetch('/api/notify', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'order_cancelled', phone: ord.phone, recipient: ord.recipient,
            orderNo: ord.order_no, cancelledAt: new Date().toLocaleString('ko-KR'),
            refundAmount: `${(ord.final_amount || 0).toLocaleString()}원`,
          }),
        }).catch(() => {});
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
  }

  async function loadReviews() {
    setReviewsLoading(true);
    const supabase = createClient();
    const [{ data }, { data: reportCounts }] = await Promise.all([
      supabase.from('reviews')
        .select('id, product_id, rating, content, is_best, likes_count, image_urls, created_at, seller_reply, seller_replied_at, profiles(name, email), products(name)')
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

  /* 리뷰 판매자 답변 저장 */
  async function saveReviewReply(reviewId: string, reply: string) {
    setReviewReplySaving(true);
    const supabase = createClient();
    const payload = { seller_reply: reply.trim() || null, seller_replied_at: reply.trim() ? new Date().toISOString() : null };
    const { error } = await supabase.from('reviews').update(payload).eq('id', reviewId);
    setReviewReplySaving(false);
    if (error) { alert('답변 저장 실패: ' + error.message); return; }
    setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, ...payload } : r));
    setSelectedReview(prev => prev && prev.id === reviewId ? { ...prev, ...payload } : prev);
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
    const ext = file.name.split('.').pop();
    const path = `popup_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('banners').upload(path, file, { upsert: true });
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
    const ext = file.name.split('.').pop();
    const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('banners').upload(path, file, { upsert: true });
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
      }

      /* 추천 리워드는 첫 구매 배송완료(delivered) 시 DB 트리거가 자동 지급 (5,000원 쿠폰) */
      if (newStatus === 'delivered') {
        // 배송 완료 SMS 발송
        const deliveredOrder = orders.find(o => o.id === orderId);
        if (deliveredOrder?.phone) {
          fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'delivery_complete',
              phone: deliveredOrder.phone,
              recipient: deliveredOrder.recipient,
              orderNo: deliveredOrder.order_no,
              productName: orderProductName(deliveredOrder),
              completedAt: new Date().toLocaleString('ko-KR'),
            }),
          }).catch(() => {});
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

        // 배송 시작 SMS
        if (selectedOrder.phone) {
          fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'shipping_started',
              phone: selectedOrder.phone,
              recipient: selectedOrder.recipient,
              orderNo: selectedOrder.order_no,
              productName: orderProductName(selectedOrder),
              courierName: COURIER_NAMES[trackingInput.courier] || trackingInput.courier || '택배사',
              trackingNumber: tno,
            }),
          }).catch(() => {});
        }

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
    const ext  = file.name.split('.').pop();
    const path = `${type}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('lounge').upload(path, file, { upsert: true });
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
      setCouponForm({ code: c.code || '', name: c.name, description: c.description || '', discount_type: c.discount_type, discount_value: c.discount_value, min_order_amount: c.min_order_amount, max_discount_amount: c.max_discount_amount?.toString() || '', starts_at: c.starts_at.slice(0,16), expires_at: c.expires_at ? c.expires_at.slice(0,16) : '', valid_days: c.valid_days != null ? String(c.valid_days) : '', is_active: c.is_active, is_public: c.is_public ?? false, signup_grant: c.signup_grant ?? false, is_membership: c.is_membership ?? false });
    } else {
      setEditingCoupon(null);
      setCouponForm({ code: '', name: '', description: '', discount_type: 'percent', discount_value: 10, min_order_amount: 0, max_discount_amount: '', starts_at: new Date().toISOString().slice(0,16), expires_at: '', valid_days: '', is_active: true, is_public: false, signup_grant: false, is_membership: false });
    }
    setCouponModal(true);
  }

  /* 신규회원 쿠폰 추가 — signup_grant·정액·유효기간 30일 프리셋 */
  function openSignupCouponModal() {
    setEditingCoupon(null);
    setCouponForm({ code: '', name: '신규회원 쿠폰', description: '', discount_type: 'fixed', discount_value: 3000, min_order_amount: 0, max_discount_amount: '', starts_at: new Date().toISOString().slice(0,16), expires_at: '', valid_days: '30', is_active: true, is_public: false, signup_grant: true, is_membership: false });
    setCouponModal(true);
  }

  /* 멤버십 월발급 쿠폰 추가 — is_membership·유효기간 30일 프리셋 (등급별 월 발급 대상) */
  function openMembershipCouponModal() {
    setEditingCoupon(null);
    setCouponForm({ code: '', name: '멤버십 쿠폰', description: '', discount_type: 'fixed', discount_value: 1000, min_order_amount: 10000, max_discount_amount: '', starts_at: new Date().toISOString().slice(0,16), expires_at: '', valid_days: '30', is_active: true, is_public: false, signup_grant: false, is_membership: true });
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
    const ext  = file.name.split('.').pop();
    const path = `${type}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('events').upload(path, file, { upsert: true });
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
      case 'products':  loadProducts(); loadFilterTabs(); break;
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
  function NavItem({ panel: p, icon, label, badge }: { panel: PanelKey; icon: React.ReactNode; label: string; badge?: number }) {
    return (
      <a className={`adm-nav-item${panel === p ? ' active' : ''}`} onClick={() => go(p)}>
        {icon}{label}
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

  /* 엑셀 다운로드 (농가별 주문서 겸 발주서) — 농가별 시트 + 배송행 + 발주 합계 */
  async function downloadOrderExcel(farmId?: string) {
    const xlsxMod = await import('xlsx');
    const XLSX = xlsxMod.default ?? xlsxMod;
    const targetOrders = farmId
      ? orders.filter(o => (o.order_items || []).some(i => i.farm_id === farmId))
      : filteredOrders;

    // 주문항목을 농가별로 평탄화
    type Row = { farmId: string; farmName: string; carrier: string; order_no: string; recipient: string; phone: string; zipcode: string; address: string; memo: string; product: string; option: string; qty: number; supply: number };
    const all: Row[] = [];
    targetOrders.forEach(o => {
      (o.order_items || []).forEach(it => {
        const i = it as typeof it & { supply_price?: number|null; option_label?: string|null; carrier?: string|null };
        if (farmId && i.farm_id !== farmId) return;
        all.push({
          farmId: (i.farm_id as string) || '__none__',
          farmName: (i.farm_name as string) || '농가 미지정',
          carrier: (i.carrier as string) || '미지정',
          order_no: o.order_no, recipient: o.recipient, phone: o.phone, zipcode: o.zipcode || '',
          address: o.address1 + (o.address2 ? ' ' + o.address2 : ''), memo: o.delivery_memo || '',
          product: i.product_name, option: (i.option_label as string) || '', qty: Number(i.quantity) || 0,
          supply: Number(i.supply_price) || 0,
        });
      });
    });
    if (all.length === 0) { alert('다운로드할 주문이 없습니다.'); return; }

    // 농가별 그룹
    const byFarm: Record<string, Row[]> = {};
    all.forEach(r => { (byFarm[r.farmId] ||= []).push(r); });

    const wb = XLSX.utils.book_new();
    const usedNames = new Set<string>();
    Object.values(byFarm).forEach(rows => {
      const f = rows[0];
      const aoa: (string | number)[][] = [];
      aoa.push([`${f.farmName} 주문서 / 발주서`, '', '', '', `지정 택배사: ${f.carrier}`]);
      aoa.push([`출력일: ${new Date().toISOString().slice(0,10)}`]);
      aoa.push([]);
      // 배송용 행 (택배사 업로드)
      aoa.push(['주문번호', '받는분', '연락처', '우편번호', '주소', '상품명', '옵션', '수량', '공급단가', '공급가 소계', '배송메시지']);
      rows.forEach(r => aoa.push([r.order_no, r.recipient, r.phone, r.zipcode, r.address, r.product, r.option, r.qty, r.supply, r.supply * r.qty, r.memo]));
      // 발주 합계
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

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [{ wch: 18 }, { wch: 10 }, { wch: 14 }, { wch: 8 }, { wch: 34 }, { wch: 22 }, { wch: 12 }, { wch: 6 }, { wch: 10 }, { wch: 12 }, { wch: 20 }];
      // 시트명: 농가명(31자, 특수문자 제거, 중복방지)
      let nm = f.farmName.replace(/[\\/?*[\]:]/g, ' ').slice(0, 28) || '농가';
      let n = nm; let c = 2; while (usedNames.has(n)) { n = `${nm}_${c++}`; } usedNames.add(n);
      XLSX.utils.book_append_sheet(wb, ws, n);
    });

    const today = new Date().toISOString().slice(0, 10);
    const fileName = farmId
      ? `주문서_${(byFarm[farmId]?.[0]?.farmName) || '농가'}_${today}.xlsx`
      : `주문서_농가별_${today}.xlsx`;
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([buf], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName; a.click();
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
    const q = productSearch.toLowerCase();
    const matchSearch = !q || p.name.toLowerCase().includes(q);
    const matchStatus = !productStatusFilter || productSellState(p) === productStatusFilter;
    return matchCat && matchSearch && matchStatus;
  });

  /* 리뷰 필터·페이지 */
  const reviewUnansweredCount = reviews.filter(r => !r.seller_reply).length;
  const reviewAvgRating = reviews.length ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length) : 0;
  const filteredReviews = reviews.filter(r => {
    const matchRating = !reviewRating || r.rating === Number(reviewRating);
    const matchAns = reviewAnswered === 'all' || (reviewAnswered === 'answered' ? !!r.seller_reply : !r.seller_reply);
    const q = reviewSearch.trim().toLowerCase();
    const matchSearch = !q || (r.content || '').toLowerCase().includes(q) || (r.profiles?.email || '').toLowerCase().includes(q) || (r.profiles?.name || '').toLowerCase().includes(q);
    const matchFrom = !reviewFrom || r.created_at >= new Date(`${reviewFrom}T00:00:00`).toISOString();
    const matchTo   = !reviewTo   || r.created_at <= new Date(`${reviewTo}T23:59:59`).toISOString();
    return matchRating && matchAns && matchSearch && matchFrom && matchTo;
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
          onClose={() => setDetailEditor(null)}
        />
      )}

      {/* ===== 상세정보 에디터 (구조화) ===== */}
      {infoEditor && (
        <InfoSectionEditor
          productId={infoEditor.id}
          productName={infoEditor.name}
          onClose={() => setInfoEditor(null)}
        />
      )}

      {/* ===== 상품 등록/수정 모달 ===== */}
      {productModal && (
        <div className="adm-modal-bg open">
          <div className="adm-modal" style={{ maxWidth:640, width:'95vw', maxHeight:'90vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
            <div className="adm-modal-head">
              <span className="adm-modal-title">{editingProduct ? '상품 수정' : '상품 등록'}</span>
              <button className="adm-modal-close" onClick={() => setProductModal(false)}>✕</button>
            </div>
            <div className="adm-modal-body" style={{ display:'flex', flexDirection:'column', gap:14 }}>

              {/* 상품 유형: 자사 / 산지 (맨 위에서 먼저 선택) */}
              <div style={{ display:'flex', gap:8 }}>
                {([
                  { dawn:false, label:'자사 상품', desc:'자사배송' },
                  { dawn:true,  label:'산지 상품', desc:'산지직송' },
                ] as const).map(opt => {
                  const active = !!pForm.is_dawn === opt.dawn;
                  return (
                    <button key={String(opt.dawn)} type="button"
                      onClick={() => setPForm(f => ({ ...f, is_dawn: opt.dawn }))}
                      style={{ flex:1, padding:'12px 10px', borderRadius:10, cursor:'pointer', textAlign:'center',
                        border: active ? '2px solid #16A34A' : '1px solid #E2E8F0',
                        background: active ? '#F0FDF4' : '#fff',
                        color: active ? '#16A34A' : '#475569' }}>
                      <div style={{ fontSize:14, fontWeight: active ? 800 : 700 }}>{opt.label}</div>
                      <div style={{ fontSize:11, color: active ? '#16A34A' : '#94A3B8', marginTop:2 }}>{opt.desc}</div>
                    </button>
                  );
                })}
              </div>

              {/* 기본 정보 */}
              <div className="adm-formsec">
              <div className="adm-formsec-title">📋 기본 정보</div>
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
                  <label className="adm-label">SKU <span style={{ fontWeight:400, color:'#94A3B8' }}>(자동생성·수정가능)</span></label>
                  <input className="adm-input-text" style={{ width:'100%' }} value={pForm.sku}
                    onChange={e => setPForm(f => ({ ...f, sku: e.target.value }))} placeholder="자동 생성됩니다" />
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

              {/* 판매금액 영역 (정상가 · 할인 · 판매가 한 묶음) */}
              <div className="adm-formsec">
                <div className="adm-formsec-title">💰 판매금액 · 정산</div>
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {/* 정상가 */}
                  <div>
                    <label className="adm-label">정상가 (원) *</label>
                    <input className="adm-input-text" style={{ width:'100%' }} type="number" value={pForm.price || ''}
                      onChange={e => setPForm(f => ({ ...f, price: Number(e.target.value) }))} placeholder="0" />
                  </div>
                  {/* 할인 — 값 입력 + 단위(%/원) 드롭다운 */}
                  <div>
                    <label className="adm-label">할인 <span style={{ fontWeight:400, color:'#94A3B8' }}>(없으면 비워두세요)</span></label>
                    <div style={{ display:'flex', gap:8 }}>
                      {pDiscMode === 'rate' ? (
                        <input className="adm-input-text" style={{ flex:1, minWidth:0 }} type="number" min="0" max="99" value={pForm.discount_rate || ''}
                          onChange={e => setPForm(f => ({ ...f, discount_rate: Math.min(99, Math.max(0, Number(e.target.value))) }))} placeholder="할인율" />
                      ) : (
                        <input className="adm-input-text" style={{ flex:1, minWidth:0 }} type="number" min="0"
                          value={pDiscAmount}
                          onChange={e => setPDiscAmount(e.target.value.replace(/[^0-9]/g, ''))}
                          placeholder={pForm.price > 0 ? '할인액(원)' : '먼저 판매가를 입력하세요'} />
                      )}
                      <AdmSelect style={{ flex:'0 0 90px' }} value={pDiscMode}
                        onChange={v => {
                          const mode = v as 'rate'|'amount';
                          setPDiscMode(mode);
                          if (mode === 'amount') setPDiscAmount(pForm.price > 0 && pForm.discount_rate > 0 ? String(Math.round(pForm.price * pForm.discount_rate / 100)) : '');
                        }}
                        options={[{ value:'rate', label:'% 할인' }, { value:'amount', label:'원 할인' }]} />
                    </div>
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
                        ({pForm.discount_rate}% · {Math.round(pForm.price * pForm.discount_rate / 100).toLocaleString()}원 할인)
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* 옵션 */}
              <div className="adm-formsec">
                <div className="adm-formsec-title">🧩 판매 옵션 <span style={{ fontWeight:400, fontSize:11, color:'#94A3B8' }}>(없으면 단품)</span></div>
                <OptionTreeEditor key={editingProduct?.id || 'new'} options={pOptions} setOptions={setPOptions} />
              </div>

              {/* 상품 이미지 */}
              <div className="adm-formsec">
              <div className="adm-formsec-title">🖼 상품 이미지</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div style={{ gridColumn:'1 / -1' }}>
                  <label className="adm-label">상품 이미지 (최대 6장 · 첫 번째 = 대표)</label>
                  {/* 숨김 파일 인풋 — 슬롯별 공유 */}
                  <input ref={pImgRef} type="file" accept="image/*" style={{ display:'none' }}
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const url = await uploadProductImage(file);
                      if (url) {
                        const slot = pImgSlotRef.current;
                        if (slot === 0) {
                          uploadedThumbnailRef.current = url;
                          setPForm(f => ({ ...f, thumbnail_url: url }));
                        } else {
                          setPForm(f => {
                            const imgs: (string|null)[] = [...((f.image_urls as (string|null)[]) || [null,null,null,null,null])];
                            imgs[slot - 1] = url;
                            return { ...f, image_urls: imgs };
                          });
                        }
                      }
                      e.target.value = '';
                    }} />
                  {/* 6슬롯 그리드 */}
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:8, marginTop:6 }}>
                    {[pForm.thumbnail_url, ...((pForm.image_urls as (string|null)[]) || [null,null,null,null,null])].map((imgUrl, i) => (
                      <div key={i}
                        onClick={() => { pImgSlotRef.current = i; pImgRef.current?.click(); }}
                        style={{ position:'relative', aspectRatio:'1', borderRadius:8,
                          border:'1.5px dashed #CBD5E1', background: imgUrl ? '#fff' : '#F8FAFC',
                          overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center',
                          cursor: pImgUploading ? 'wait' : 'pointer', flexDirection:'column', gap:4 }}>
                        {imgUrl
                          ? <img src={imgUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                          : <span style={{ fontSize:20, color:'#CBD5E1' }}>+</span>}
                        {/* 대표 뱃지 (좌상단) */}
                        {i === 0 && imgUrl && (
                          <div style={{ position:'absolute', top:3, left:3,
                            background:'#1A1A1A', fontSize:9, fontWeight:700, color:'#fff',
                            borderRadius:4, padding:'2px 6px', letterSpacing:'0.04em' }}>
                            대표
                          </div>
                        )}
                        {/* 삭제 버튼 */}
                        {imgUrl && (
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              if (i === 0) {
                                uploadedThumbnailRef.current = '';
                                setPForm(f => ({ ...f, thumbnail_url: '' }));
                              } else {
                                setPForm(f => {
                                  const imgs: (string|null)[] = [...((f.image_urls as (string|null)[]) || [null,null,null,null,null])];
                                  imgs[i - 1] = null;
                                  return { ...f, image_urls: imgs };
                                });
                              }
                            }}
                            style={{ position:'absolute', top:3, right:3,
                              background:'rgba(0,0,0,0.55)', border:'none', color:'#fff',
                              borderRadius:'50%', width:18, height:18, fontSize:11,
                              cursor:'pointer', display:'flex', alignItems:'center',
                              justifyContent:'center', lineHeight:1 }}>
                            ×
                          </button>
                        )}
                        {/* 순서 변경 ◀ ▶ (대표 포함 스왑) */}
                        {imgUrl && (
                          <div style={{ position:'absolute', bottom:0, left:0, right:0, display:'flex', justifyContent:'space-between',
                            padding:'2px 3px', background: i===0 ? 'transparent' : 'rgba(0,0,0,0.35)' }}>
                            <button type="button" disabled={i===0}
                              onClick={e => { e.stopPropagation(); movePImg(i, -1); }}
                              style={{ border:'none', background:'rgba(255,255,255,0.85)', color:'#1A1A1A', borderRadius:4, width:18, height:16,
                                fontSize:10, cursor: i===0 ? 'default':'pointer', opacity: i===0 ? 0.3 : 1, lineHeight:1 }}>◀</button>
                            <button type="button" disabled={i===5}
                              onClick={e => { e.stopPropagation(); movePImg(i, 1); }}
                              style={{ border:'none', background:'rgba(255,255,255,0.85)', color:'#1A1A1A', borderRadius:4, width:18, height:16,
                                fontSize:10, cursor: i===5 ? 'default':'pointer', opacity: i===5 ? 0.3 : 1, lineHeight:1 }}>▶</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize:11, color:'#94A3B8', marginTop:6 }}>◀ ▶ 로 순서 변경 · 첫 번째(맨 왼쪽)가 대표 이미지</p>
                  {pImgUploading && <p style={{ fontSize:12, color:'#64748B', marginTop:6 }}>업로드 중...</p>}
                </div>
              </div>
              </div>

              {/* 맛 프로파일 */}
              <div className="adm-formsec">
              <div className="adm-formsec-title">🍯 맛 프로파일 <span style={{ fontWeight:400, color:'#94A3B8', fontSize:12 }}>(상세페이지 표시 · 미설정 시 카테고리 기본값)</span></div>
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
                            onClick={() => setPForm(f => ({ ...f, seller_score: { ...(f.seller_score || {}), [axis.key]: level } }))}
                            style={{ padding:'6px 11px', borderRadius:8, cursor:'pointer', fontSize:12, fontFamily:'inherit',
                              border:`1px solid ${on ? axis.hex : '#E2E8F0'}`, background: on ? axis.hex : '#fff',
                              color: on ? '#fff' : '#64748B', fontWeight: on ? 700 : 500 }}>
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

              {/* 배송 · 표시 */}
              <div className="adm-formsec">
              <div className="adm-formsec-title">🚚 배송 · 표시</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label className="adm-label">출발 마감 시간 <span style={{ fontWeight:400, color:'#94A3B8' }}>(기본 오전 11시)</span></label>
                  <AdmSelect className="adm-cs-full" value={pForm.dispatch_cutoff || ''}
                    onChange={v => setPForm(f => ({ ...f, dispatch_cutoff: v }))}
                    options={[{ value:'', label:'전체 설정 적용' }, ...CUTOFF_TIMES.map(t => ({ value:t, label:cutoffLabel(t) }))]} />
                </div>
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
                <div>
                  <label className="adm-label">정렬 순서</label>
                  <input className="adm-input-text" style={{ width:'100%' }} type="number" value={pForm.sort_order || ''}
                    onChange={e => setPForm(f => ({ ...f, sort_order: Number(e.target.value) }))} placeholder="0" />
                </div>
              </div>

              {/* 태그 & 상태 */}
              <div style={{ display:'flex', flexWrap:'wrap', gap:16 }}>
                {([
                  ['is_new',  'NEW 태그'],
                  ['is_best', '인기 태그'],
                  ['is_active', '판매중'],
                ] as const).map(([key, label]) => (
                  <label key={key} style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:14 }}>
                    <input type="checkbox" checked={!!pForm[key]}
                      onChange={e => setPForm(f => ({ ...f, [key]: e.target.checked }))} />
                    {label}
                  </label>
                ))}
              </div>
              </div>

              {/* 상세페이지 — 등록 화면에서 바로 작성 (신규는 저장 후 자동 진입) */}
              <div className="adm-formsec">
                <div className="adm-formsec-title">📄 상세페이지</div>
                <div style={{ fontSize:12, color:'#94A3B8', marginBottom:10 }}>
                  {editingProduct ? '상세설명(이미지)·상세정보를 작성/수정합니다.' : '버튼을 누르면 먼저 상품이 저장된 뒤 상세 작성 화면이 열립니다.'}
                </div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  <button type="button" className="adm-btn adm-btn-outline" style={{ color:'#2563EB', borderColor:'#BFDBFE' }}
                    disabled={pSaving} onClick={() => saveAndEditDetail('desc')}>🖼 상세설명 작성</button>
                  <button type="button" className="adm-btn adm-btn-outline" style={{ color:'#7C3AED', borderColor:'#DDD6FE' }}
                    disabled={pSaving} onClick={() => saveAndEditDetail('info')}>📋 상세정보 작성</button>
                </div>
              </div>

              <div className="adm-flex-gap adm-flex-end" style={{ marginTop:4 }}>
                <button className="adm-btn adm-btn-outline" onClick={() => setProductModal(false)}>취소</button>
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

              <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:14 }}>
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
              <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:14 }}>
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
              <button className="adm-modal-close" onClick={() => setFtModal(false)}>✕</button>
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
                  <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:14 }}>
                    <input type="checkbox" checked={ftForm.show_in_home}
                      onChange={e => setFtForm(f => ({ ...f, show_in_home: e.target.checked }))} />
                    메인 퀵 가이드
                  </label>
                  <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:14 }}>
                    <input type="checkbox" checked={ftForm.show_in_category}
                      onChange={e => setFtForm(f => ({ ...f, show_in_category: e.target.checked }))} />
                    상품목록 상단
                  </label>
                  <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:14 }}>
                    <input type="checkbox" checked={ftForm.show_in_shortcut}
                      onChange={e => setFtForm(f => ({ ...f, show_in_shortcut: e.target.checked }))} />
                    모바일 카테고리 탭
                  </label>
                </div>
              </div>
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:14, borderTop:'1px solid #F1F5F9', paddingTop:12 }}>
                <input type="checkbox" checked={ftForm.is_active}
                  onChange={e => setFtForm(f => ({ ...f, is_active: e.target.checked }))} />
                <strong>전체 사용</strong> (끄면 모든 위치에서 숨김)
              </label>
              <div className="adm-flex-gap adm-flex-end" style={{ marginTop:4 }}>
                <button className="adm-btn adm-btn-outline" onClick={() => setFtModal(false)}>취소</button>
                <button className="adm-btn adm-btn-primary" onClick={saveFilterTab}>
                  {editingFt ? '수정 완료' : '필탭 추가'}
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

      {/* ===== 농가 등록/수정 모달 ===== */}
      {/* 농가 상세 분석 모달 */}
      {farmDetailOpen && (
        <div className="adm-modal-bg open" onClick={() => setFarmDetailOpen(false)}>
          <div className="adm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth:720, width:'95vw', maxHeight:'90vh', overflowY:'auto' }}>
            <div className="adm-modal-head">
              <span className="adm-modal-title">📊 {farmDetailTarget?.name} 분석</span>
              <button className="adm-modal-close" onClick={() => setFarmDetailOpen(false)}>✕</button>
            </div>
            <div className="adm-modal-body">
              {farmDetailLoading || !farmDetail ? <PanelLoading /> : (() => {
                const d = farmDetail;
                const maxM = Math.max(...d.monthly.map(m => m.amount), 1);
                return (
                  <>
                    {/* 핵심 지표 */}
                    <div className="adm-kpi-grid adm-kpi-3" style={{ marginBottom:14 }}>
                      {[
                        ['총 매출(확정)', `${fmtPrice(d.sales)}원`, '#1A1A1A'],
                        ['농가 정산액', `${fmtPrice(d.payout)}원`, '#2563EB'],
                        ['마진(매출-정산)', `${fmtPrice(d.margin)}원`, '#16A34A'],
                        ['판매 수량', `${d.qty.toLocaleString()}개`, '#7C3AED'],
                        ['주문 건수', `${d.orderCount.toLocaleString()}건`, '#1A1A1A'],
                        ['평균 평점', farmDetailTarget?.review_count ? `★ ${(farmDetailTarget.avg_rating||0).toFixed(1)} (${farmDetailTarget.review_count})` : '리뷰 없음', '#C8841C'],
                      ].map(([l, v, c]) => (
                        <div key={l} className="adm-kpi-card">
                          <div className="adm-kpi-label">{l}</div>
                          <div className="adm-kpi-value adm-kpi-value-mt" style={{ color: c as string, fontSize:16 }}>{v}</div>
                        </div>
                      ))}
                    </div>

                    {/* 월별 매출 추이 */}
                    <div className="adm-card" style={{ padding:'14px 16px', marginBottom:14 }}>
                      <div style={{ fontSize:13, fontWeight:800, marginBottom:12 }}>월별 매출 추이 <span style={{ fontWeight:400, color:'#94A3B8', fontSize:11 }}>(최근 6개월)</span></div>
                      {d.monthly.length === 0 ? <div className="adm-muted" style={{ fontSize:12, padding:'10px 0' }}>매출 데이터 없음</div> : (
                        <div style={{ display:'flex', alignItems:'flex-end', gap:10, height:120 }}>
                          {d.monthly.map(m => (
                            <div key={m.ym} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                              <div style={{ fontSize:10, color:'#64748B' }}>{(m.amount/10000).toFixed(0)}만</div>
                              <div style={{ width:'100%', maxWidth:40, height:`${Math.max(4, m.amount/maxM*90)}px`, background:'#3B82F6', borderRadius:'4px 4px 0 0' }} />
                              <div style={{ fontSize:10, color:'#94A3B8' }}>{m.ym.slice(5)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 인기 상품 + 최근 리뷰 */}
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                      <div className="adm-card">
                        <div className="adm-card-head"><span className="adm-card-title">인기 상품 TOP 5</span></div>
                        <table className="adm-table" style={{ marginTop:4 }}>
                          <thead><tr><th>상품</th><th>수량</th><th>매출</th></tr></thead>
                          <tbody>
                            {d.topProducts.length === 0 ? <tr><td colSpan={3} style={{ textAlign:'center', color:'#94A3B8', padding:'16px 0' }}>판매 없음</td></tr>
                              : d.topProducts.map((r, i) => <tr key={r.name}><td><span style={{ fontWeight:800, color:'#CBD5E1', marginRight:5 }}>{i+1}</span>{r.name}</td><td>{r.qty}개</td><td style={{ fontWeight:600 }}>{fmtPrice(r.amount)}원</td></tr>)}
                          </tbody>
                        </table>
                      </div>
                      <div className="adm-card">
                        <div className="adm-card-head"><span className="adm-card-title">최근 리뷰</span></div>
                        <div style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:10 }}>
                          {d.recentReviews.length === 0 ? <div className="adm-muted" style={{ fontSize:12 }}>리뷰 없음</div>
                            : d.recentReviews.map(rv => (
                              <div key={rv.id} style={{ borderBottom:'1px solid #F1F5F9', paddingBottom:8 }}>
                                <div style={{ fontSize:11, color:'#C8841C', fontWeight:700 }}>{'★'.repeat(rv.rating)}<span style={{ color:'#E2E8F0' }}>{'★'.repeat(5-rv.rating)}</span> <span style={{ color:'#94A3B8' }}>· {rv.product_name}</span></div>
                                <div style={{ fontSize:12, color:'#475569', marginTop:3, lineHeight:1.5, overflow:'hidden', textOverflow:'ellipsis', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{rv.content}</div>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {farmModal && (
        <div className="adm-modal-bg open" onClick={() => setFarmModal(false)}>
          <div className="adm-modal adm-modal-farm" onClick={e => e.stopPropagation()}>
            <div className="adm-modal-head">
              <span className="adm-modal-title">{editingFarm ? '농가 수정' : '농가 등록'}</span>
              <button className="adm-modal-close" onClick={() => setFarmModal(false)}>✕</button>
            </div>
            <div className="adm-modal-body">
              <div className="adm-detail-grid adm-farm-grid">
                <div className="adm-form-row">
                  <label className="adm-label">농가명 <span className="adm-required">*</span></label>
                  <input type="text" className="adm-input-text adm-input-full" placeholder="예: 서귀포 감귤농원"
                    value={farmForm.name} onChange={e => setFarmForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="adm-form-row">
                  <label className="adm-label">대표자명</label>
                  <input type="text" className="adm-input-text adm-input-full" placeholder="예: 홍길동"
                    value={farmForm.farmer_name} onChange={e => setFarmForm(p => ({ ...p, farmer_name: e.target.value }))} />
                </div>
                <div className="adm-form-row adm-form-row-full">
                  <label className="adm-label">지역/주소</label>
                  <input type="text" className="adm-input-text adm-input-full" placeholder="예: 제주특별자치도 서귀포시 남원읍"
                    value={farmForm.region} onChange={e => setFarmForm(p => ({ ...p, region: e.target.value }))} />
                </div>
                <div className="adm-form-row">
                  <label className="adm-label">농가 유형 <span style={{ fontWeight:400, color:'#94A3B8' }}>(재배 형태)</span></label>
                  <div style={{ display:'flex', gap:8, flex:1, flexWrap:'wrap', alignItems:'center' }}>
                    <div className="adm-btn-group">
                      {FARM_TYPE_PRESETS.map(t => (
                        <button key={t} type="button" className={`adm-seg-btn${farmForm.farm_type===t?' active':''}`}
                          onClick={() => setFarmForm(p => ({ ...p, farm_type: t }))}>{t}</button>
                      ))}
                    </div>
                    <input type="text" className="adm-input-text" style={{ flex:1, minWidth:140 }} placeholder="직접 입력(예: 친환경/유기농)"
                      value={farmForm.farm_type} onChange={e => setFarmForm(p => ({ ...p, farm_type: e.target.value }))} />
                  </div>
                </div>
                <div className="adm-form-row">
                  <label className="adm-label">담당 택배사</label>
                  <AdmSelect className="adm-cs-full" value={farmForm.carrier}
                    onChange={v => setFarmForm(p => ({ ...p, carrier: v }))}
                    options={['', 'CJ대한통운', '롯데택배', '한진택배', '우체국택배', '로젠택배'].map(c => ({ value:c, label:c || '택배사 선택' }))} />
                </div>
                <div className="adm-form-row adm-form-row-full">
                  <label className="adm-label">농가 소개</label>
                  <textarea className="adm-textarea" rows={2} placeholder="농가 소개 (상세 상단 좌측에 표시)"
                    value={farmForm.intro} onChange={e => setFarmForm(p => ({ ...p, intro: e.target.value }))} />
                </div>

                {/* 대표 썸네일 */}
                <div className="adm-form-row adm-form-row-full">
                  <label className="adm-label">대표 썸네일 <span style={{ fontWeight:400, color:'#94A3B8' }}>(상세 상단 우측 사진)</span></label>
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

                {/* 랜딩 이미지 (여러 장) */}
                <div className="adm-form-row adm-form-row-full">
                  <label className="adm-label">랜딩 이미지 <span style={{ fontWeight:400, color:'#94A3B8' }}>(상세 하단 · 위→아래 순서로 표시)</span></label>
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
                      {farmImgUploading ? '업로드 중...' : '+ 랜딩 이미지 추가'}
                      <input type="file" accept="image/*" multiple hidden onChange={async e => { const files = Array.from(e.target.files || []); if (!files.length) return; setFarmImgUploading(true); for (const f of files) { const url = await uploadProductImage(f); if (url) setFarmForm(p => ({ ...p, landing_images: [...p.landing_images, url] })); } setFarmImgUploading(false); e.target.value=''; }} />
                    </label>
                  </div>
                </div>
              </div>
              <div className="adm-flex-gap adm-flex-end adm-mt-20">
                <button className="adm-btn adm-btn-outline" onClick={() => setFarmModal(false)}>취소</button>
                <button className="adm-btn adm-btn-primary" onClick={saveFarm} disabled={farmSaving}>
                  {farmSaving ? '저장 중...' : editingFarm ? '수정' : '농가 등록'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== 배송추적 모달 ===== */}
      {showTrackingModal && selectedOrder?.tracking_number && (
        <TrackingModal
          carrierId={selectedOrder.courier || 'kr.cjlogistics'}
          trackingNumber={selectedOrder.tracking_number}
          onClose={() => setShowTrackingModal(false)}
        />
      )}

      {/* ===== 주문 상세 모달 ===== */}
      {selectedOrder && (
        <div className="adm-modal-bg open" onClick={() => setSelectedOrder(null)}>
          <div className="adm-modal" onClick={e => e.stopPropagation()}>
            <div className="adm-modal-head">
              <span className="adm-modal-title">주문 상세 — {selectedOrder.order_no}</span>
              <button className="adm-modal-close" onClick={() => setSelectedOrder(null)}>✕</button>
            </div>
            <div className="adm-modal-body">
              <div className="adm-detail-grid">
                {[
                  ['주문자', selectedOrder.recipient],
                  ['연락처', selectedOrder.phone],
                  ['배송지', `${selectedOrder.address1}${selectedOrder.address2 ? ' ' + selectedOrder.address2 : ''}`],
                  ['배송 요청사항', selectedOrder.delivery_memo || '-'],
                  ['결제금액', `${fmtPrice(selectedOrder.final_amount)}원 (${selectedOrder.payment_method})`],
                  ['주문일시', fmtDate(selectedOrder.created_at)],
                  ['현재 상태', STATUS_LABEL[selectedOrder.status] || selectedOrder.status],
                ].map(([k, v]) => (
                  <div key={k} className="adm-detail-group">
                    <div className="adm-detail-label">{k}</div>
                    <div className="adm-detail-val">{v}</div>
                  </div>
                ))}
              </div>
              {/* 주문 상품 목록 */}
              {(selectedOrder.order_items?.length ?? 0) > 0 && (
                <div className="adm-detail-group adm-detail-mt16">
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
                    <div style={{ display:'flex', justifyContent:'flex-end', paddingTop:6,
                      borderTop:'1px solid #E2E8F0', marginTop:2 }}>
                      <span style={{ fontSize:13, color:'#64748B', marginRight:8 }}>총 결제금액</span>
                      <span style={{ fontSize:14, fontWeight:800 }}>{fmtPrice(selectedOrder.final_amount)}원</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 배송 추적 정보 입력 */}
              <div className="adm-detail-group adm-detail-mt16">
                <div className="adm-detail-label" style={{ marginBottom:8 }}>배송 추적</div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                  <AdmSelect
                    value={trackingInput.courier}
                    onChange={v => setTrackingInput(p => ({ ...p, courier: v }))}
                    style={{ minWidth:140 }}
                    options={[
                      { value:'', label:'택배사 선택' },
                      { value:'kr.cjlogistics', label:'CJ대한통운' },
                      { value:'kr.lotte', label:'롯데택배' },
                      { value:'kr.hanjin', label:'한진택배' },
                      { value:'kr.epost', label:'우체국택배' },
                      { value:'kr.logen', label:'로젠택배' },
                      { value:'kr.lotteglogis', label:'롯데글로벌로지스' },
                      { value:'kr.coupang', label:'쿠팡로켓배송' },
                      { value:'kr.cupost', label:'CU편의점택배' },
                    ]} />
                  <input
                    placeholder="운송장번호"
                    value={trackingInput.tracking_number}
                    onChange={e => setTrackingInput(p => ({ ...p, tracking_number: e.target.value }))}
                    style={{ flex:1, minWidth:140, height:36, padding:'0 10px', border:'1.5px solid #E2E8F0',
                      borderRadius:6, fontSize:13, fontFamily:'inherit', outline:'none' }}
                  />
                  <button
                    onClick={saveTracking}
                    disabled={savingTracking}
                    className="adm-btn adm-btn-primary"
                    style={{ height:36, padding:'0 14px', fontSize:13 }}>
                    {savingTracking ? '저장 중...' : '저장'}
                  </button>
                  {selectedOrder.tracking_number && (
                    <button
                      onClick={() => setShowTrackingModal(true)}
                      className="adm-btn adm-btn-outline"
                      style={{ height:36, padding:'0 14px', fontSize:13 }}>
                      🚚 배송추적
                    </button>
                  )}
                </div>
              </div>

              {/* 배송 지연 안내 발송 */}
              <div className="adm-detail-group adm-detail-mt16">
                <div className="adm-detail-label" style={{ marginBottom:8 }}>배송 지연 안내</div>
                <button className="adm-btn adm-btn-outline" style={{ height:36, padding:'0 14px', fontSize:13 }}
                  onClick={async () => {
                    if (!selectedOrder.phone) { alert('수령인 연락처가 없습니다.'); return; }
                    const reason = prompt('지연 사유를 입력하세요. (예: 산지 기상 악화로 출고 지연)');
                    if (!reason || !reason.trim()) return;
                    const eta = prompt('변경 예상 도착일을 입력하세요. (예: 6/15(일))');
                    if (!eta || !eta.trim()) return;
                    await fetch('/api/notify', { method:'POST', headers:{'Content-Type':'application/json'},
                      body: JSON.stringify({ type:'delivery_delayed', phone: selectedOrder.phone, recipient: selectedOrder.recipient,
                        orderNo: selectedOrder.order_no, reason: reason.trim(), eta: eta.trim() }) }).catch(()=>{});
                    alert('배송 지연 안내를 발송했습니다.');
                  }}>
                  📦 배송 지연 안내 발송
                </button>
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

              <div className="adm-detail-group adm-detail-mt16">
                <div className="adm-detail-label">주문 상태 변경</div>
                <div className="adm-flex-gap adm-mt-6 adm-flex-wrap">
                  {(['preparing','shipped','delivered'] as const).map(s => (
                    <button
                      key={s}
                      className={`adm-btn ${selectedOrder.status === s ? 'adm-btn-primary' : 'adm-btn-outline'}`}
                      disabled={updatingStatus === selectedOrder.id}
                      onClick={() => updateOrderStatus(selectedOrder.id, s)}
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  ))}
                  <button
                    className="adm-btn adm-btn-refund"
                    disabled={updatingStatus === selectedOrder.id}
                    onClick={() => { if (confirm('이 주문을 취소(취소됨) 처리할까요?\n결제취소 + 쿠폰·포인트 복원이 진행됩니다.')) updateOrderStatus(selectedOrder.id, 'cancelled'); }}
                  >취소</button>
                  <button
                    className="adm-btn adm-btn-refund"
                    disabled={updatingStatus === selectedOrder.id}
                    onClick={() => { if (confirm('이 주문을 환불(환불완료) 처리할까요?\n결제취소 + 쿠폰·포인트 복원이 진행됩니다.')) updateOrderStatus(selectedOrder.id, 'refunded'); }}
                  >환불</button>
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
              <NavItem panel="farms"    icon={<Icon.Farms />}    label="농가 관리" />
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
            <Link href="/" className="adm-ext-btn" title="사이트 보기"><Icon.ExternalLink /></Link>
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
                      <div onClick={() => { setOrderStatusFilter(st.key); go('orders'); }}
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

              {/* 취소·반품·교환 / 판매지연 / 정산요약 */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:16, marginBottom:24 }}>
                <div className="adm-card">
                  <div className="adm-card-head"><span className="adm-card-title">취소 · 반품 · 교환</span></div>
                  <div className="adm-pending-list">
                    <div className="adm-pending-row" onClick={() => go('refund')}><span>취소/환불 요청</span><span className="adm-pending-num red">{dashExtra.cancelReq}</span></div>
                    <div className="adm-pending-row" onClick={() => go('refund')}><span>환불 진행중</span><span className="adm-pending-num orange">{dashExtra.refunding}</span></div>
                    <div className="adm-pending-row" onClick={() => go('orders')}><span>교환 요청</span><span className="adm-pending-num">{dashExtra.exchanging}</span></div>
                  </div>
                </div>
                <div className="adm-card">
                  <div className="adm-card-head"><span className="adm-card-title">판매 지연</span></div>
                  <div className="adm-pending-list">
                    <div className="adm-pending-row" onClick={() => { setOrderStatusFilter('preparing'); go('orders'); }}><span>발송 지연 <span className="adm-muted" style={{ fontSize:11 }}>(2일+)</span></span><span className="adm-pending-num red">{dashExtra.shipDelay}</span></div>
                    <div className="adm-pending-row" onClick={() => go('refund')}><span>환불 처리 지연 <span className="adm-muted" style={{ fontSize:11 }}>(2일+)</span></span><span className="adm-pending-num orange">{dashExtra.refundDelay}</span></div>
                  </div>
                </div>
                <div className="adm-card">
                  <div className="adm-card-head"><span className="adm-card-title">정산 요약</span></div>
                  <div className="adm-pending-list">
                    <div className="adm-pending-row" onClick={() => go('settlement')}><span>금일 매출</span><span className="adm-pending-num">{fmtPrice(stats?.todayRevenue || 0)}원</span></div>
                    <div className="adm-pending-row" onClick={() => go('settlement')}><span>이번달 매출 <span className="adm-muted" style={{ fontSize:11 }}>(정산예정)</span></span><span className="adm-pending-num">{fmtPrice(stats?.monthRevenue || 0)}원</span></div>
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
                      { label:'방문 수',      val: ga ? (c?.visits||0).toLocaleString() : '—', unit: ga?'':'', d: ga?diff(c!.visits,p!.visits):0, na:!ga, series:s?.visits||[],  color:'#16A34A' },
                      { label:'상품 주문건수', val: (c?.orders||0).toLocaleString(),         unit:'건', d: diff(c?.orders||0,p?.orders||0), na:false, series:s?.orders||[],  color:'#2563EB' },
                      { label:'구매전환율',    val: ga ? (c?.conv||0).toFixed(1) : '—',     unit: ga?'%':'', d: ga?diff(c!.conv,p!.conv):0, na:!ga, series:s?.conv||[],    color:'#9333EA' },
                      { label:'상품주문단가',  val: fmtPrice(c?.aov||0),                     unit:'원', d: diff(c?.aov||0,p?.aov||0), na:false, series:s?.aov||[],     color:'#0891B2' },
                      { label:'결제금액',      val: fmtPrice(c?.payment||0),                 unit:'원', d: diff(c?.payment||0,p?.payment||0), na:false, series:s?.payment||[], color:'#DB2777' },
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

              <div className="adm-row" style={{ marginTop: 24 }}>
                <div className="adm-card adm-card-lg">
                  <div className="adm-card-head">
                    <span className="adm-card-title">매출 현황</span>
                    <div className="adm-btn-group">
                      {(['7','30'] as const).map(d => (
                        <button key={d} className={`adm-seg-btn${chartDays===d?' active':''}`} onClick={() => setChartDays(d)}>{d}일</button>
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
                        <div key={o.id} className="adm-pending-row" style={{ cursor:'pointer' }} onClick={() => { go('orders'); setSelectedOrder(o); setTrackingInput({ courier: o.courier || '', tracking_number: o.tracking_number || '' }); }}>
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
                  <AdmSelect value={orderDateBasis} onChange={v => setOrderDateBasis(v as 'created_at'|'paid_at')}
                    options={[{ value:'created_at', label:'주문일' }, { value:'paid_at', label:'결제일' }]} />
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
                    options={[{ value:'', label:'전체 상태' }, ...Object.entries(STATUS_LABEL).map(([v, l]) => ({ value:v, label:l as string }))]} />
                  <AdmSelect value={orderFarmFilter} onChange={v => { setOrderFarmFilter(v); setOrderPage(1); }}
                    options={[{ value:'', label:'전체 농가' }, ...farms.map(f => ({ value:f.id, label:f.name }))]} />
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
                  <button className="adm-btn adm-btn-outline" onClick={() => downloadOrderExcel(orderFarmFilter || undefined)}>
                    <span className="adm-btn-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </span>
                    {orderFarmFilter ? `${farms.find(f=>f.id===orderFarmFilter)?.name || ''} 주문서/발주서` : '농가별 주문서/발주서'}
                  </button>
                  <button className="adm-btn adm-btn-outline" onClick={() => loadOrders()}><span className="adm-btn-icon"><Icon.Refresh /></span>새로고침</button>
                </div>
              </div>
              <div className="adm-card">
                {ordersLoading ? <PanelLoading /> : (
                  <div className="adm-table-wrap">
                    <table className="adm-table">
                      <thead>
                        <tr>
                          <th>주문번호</th><th>주문일시</th><th>수령인</th><th>연락처</th>
                          <th>금액</th><th>결제수단</th><th>상태</th><th>관리</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOrders.length === 0 ? (
                          <tr><td colSpan={8} style={{ textAlign:'center', padding:'40px 0', color:'#94A3B8' }}>
                            {orders.length === 0 ? '주문 데이터 없음 (create_admin_policies.sql 실행 필요)' : '검색 결과 없음'}
                          </td></tr>
                        ) : pagedOrders.map(o => (
                          <tr key={o.id}>
                            <td className="adm-mono" style={{ fontSize:12 }}>{o.order_no}</td>
                            <td className="adm-muted">{fmtDate(o.created_at)}</td>
                            <td>{o.recipient}</td>
                            <td className="adm-mono">{o.phone}</td>
                            <td className="adm-mono">{fmtPrice(o.final_amount)}원</td>
                            <td className="adm-muted">{o.payment_method}</td>
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
                            <td>
                              <button className="adm-row-btn" onClick={() => {
                                setSelectedOrder(o);
                                setTrackingInput({ courier: o.courier || '', tracking_number: o.tracking_number || '' });
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
              <div className="adm-info-box adm-info-mt10">
                📦 <strong>상태 변경:</strong> 상세 버튼 클릭 → 상태 버튼으로 변경. 변경 사항은 Supabase에 즉시 저장됩니다.
              </div>
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
                  <div key={k.l} className="adm-kpi-card" style={{ cursor:'pointer', outline: productStatusFilter===k.st && k.st!=='' ? '2px solid #1A1A1A' : 'none' }}
                    onClick={() => setProductStatusFilter(productStatusFilter===k.st ? '' : k.st)}>
                    <div className="adm-kpi-label">{k.l}</div>
                    <div className="adm-kpi-value adm-kpi-value-mt" style={k.red && k.v>0 ? { color:'#DC2626' } : undefined}>{k.v}</div>
                  </div>
                ))}
              </div>
              <div className="adm-toolbar">
                <div className="adm-toolbar-left">
                  <AdmSelect value={productCatFilter} onChange={setProductCatFilter}
                    options={[{ value:'', label:'전체 카테고리' }, ...Object.entries(catOptions).map(([v, l]) => ({ value:v, label:l as string }))]} />
                  <input type="text" className="adm-input-text" placeholder="상품명 검색"
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
                          <th>상품명</th><th>카테고리</th><th>정상가</th><th>판매가</th>
                          <th>할인율</th><th>상태</th><th>관리</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProducts.length === 0 ? (
                          <tr><td colSpan={7} style={{ textAlign:'center', padding:'40px 0', color:'#94A3B8' }}>상품 없음</td></tr>
                        ) : filteredProducts.map(p => (
                          <tr key={p.id}>
                            <td>{p.name}</td>
                            <td>{catOptions[p.category] || CAT_LABEL[p.category] || p.category}</td>
                            <td className="adm-mono adm-muted"><s>{fmtPrice(p.price)}원</s></td>
                            <td className="adm-mono"><strong>{fmtPrice(p.discounted_price)}원</strong></td>
                            <td>{p.discount_rate > 0 ? <span className="adm-badge badge-paid">{p.discount_rate}%</span> : '-'}</td>
                            <td>
                              <span className={`adm-badge ${p.is_active ? 'badge-on' : 'badge-off'}`}>
                                {p.is_active ? '판매중' : '판매중지'}
                              </span>
                            </td>
                            <td style={{ display:'flex', gap:6 }}>
                              <button className="adm-row-btn" onClick={() => openProductModal(p)}>수정</button>
                              <button className="adm-row-btn" style={{ color:'#2563EB' }} onClick={() => setDetailEditor({ id: p.id, name: p.name })}>상세설명</button>
                              <button className="adm-row-btn" style={{ color:'#7C3AED' }} onClick={() => setInfoEditor({ id: p.id, name: p.name })}>상세정보</button>
                              <button className="adm-row-btn" style={{ color: p.is_active ? '#DC2626' : '#16A34A' }} onClick={() => toggleProductActive(p)}>
                                {p.is_active ? '판매중지' : '판매활성'}
                              </button>
                              <button className="adm-row-btn adm-row-btn-danger" onClick={() => deleteProduct(p)}>삭제</button>
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
              {/* 위치 탭 */}
              <div className="adm-btn-group" style={{ marginBottom:14, flexWrap:'wrap' }}>
                {([['mega','🧭 메가메뉴'],['header','📌 상단바'],['productlist','📋 상품목록'],['shortcut','📱 모바일 서랍'],['home','🏠 퀵가이드']] as const).map(([k,lb]) => (
                  <button key={k} className={`adm-seg-btn${menuTab===k?' active':''}`} onClick={() => setMenuTab(k)}>{lb}</button>
                ))}
              </div>

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
                    <div className="adm-info-box" style={{ marginBottom:12 }}>💡 헤더 <strong>메가드롭다운</strong>에 뜨는 컬럼입니다. <strong>카테고리 대분류</strong>(국산과일…)와 <strong>메뉴 그룹</strong>(브랜드소개관…)이 나란히 떠요.</div>
                    {/* 미리보기 */}
                    <div className="adm-card" style={{ padding:'16px 18px', marginBottom:16, border:'1px solid #FCD34D', background:'#FFFBEB' }}>
                      <div style={{ fontWeight:800, fontSize:13, marginBottom:12 }}>🖥 실제 메가드롭다운 미리보기</div>
                      <div style={{ display:'flex', gap:28, flexWrap:'wrap' }}>
                        {majors.map(m => (
                          <div key={m.id} style={{ minWidth:110 }}>
                            <div style={{ fontWeight:800, borderBottom:'2px solid #1A1A1A', paddingBottom:6, marginBottom:8 }}>{m.label}</div>
                            <div style={{ fontSize:12, color:'#94A3B8', marginBottom:5 }}>전체보기</div>
                            {filterTabs.filter(s => s.parent===m.tab_value).sort((a,b)=>a.sort_order-b.sort_order).map(s => (
                              <div key={s.id} style={{ fontSize:12.5, color:'#374151', marginBottom:5 }}>{s.label}</div>
                            ))}
                          </div>
                        ))}
                        {megaGroups.map(g => (
                          <div key={g.id} style={{ minWidth:110 }}>
                            <div style={{ fontWeight:800, borderBottom:'2px solid #1A1A1A', paddingBottom:6, marginBottom:8 }}>{g.label}</div>
                            {menus.filter(l => l.parent===g.id).sort((a,b)=>a.sort_order-b.sort_order).map(l => (
                              <div key={l.id} style={{ fontSize:12.5, color:'#374151', marginBottom:5 }}>{l.label}</div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* 컬럼 추가 */}
                    <div className="adm-toolbar">
                      <div className="adm-toolbar-left"><span className="adm-muted" style={{ fontSize:13 }}>컬럼 추가 →</span></div>
                      <div className="adm-toolbar-right">
                        <button className="adm-btn adm-btn-outline" onClick={() => addCategory(null)}>+ 카테고리 컬럼</button>
                        <button className="adm-btn adm-btn-outline" onClick={() => addMenu({ show_in_mega:true, parent:null, label:'새 메뉴 그룹', href:'/' })}>+ 메뉴 컬럼</button>
                      </div>
                    </div>
                    {/* 카테고리 대분류 컬럼 */}
                    {majors.map(m => (
                      <div key={m.id} className="adm-card" style={{ padding:'14px 16px', marginBottom:12, opacity: m.is_active ? 1 : 0.55 }}>
                        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:10 }}>
                          <span style={{ display:'inline-flex', gap:4 }}>
                            <button className="adm-row-btn" style={{ padding:'2px 6px' }} onClick={() => moveFilterTab(m, -1)}>▲</button>
                            <button className="adm-row-btn" style={{ padding:'2px 6px' }} onClick={() => moveFilterTab(m, 1)}>▼</button>
                          </span>
                          <span style={{ fontSize:11, fontWeight:800, color:'#1A8A4C', flexShrink:0 }}>카테고리</span>
                          {ftText(m)}
                          <label style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, color:'#475569', flexShrink:0 }}><input type="checkbox" checked={m.is_active} onChange={e => updateFt(m.id, { is_active: e.target.checked })} />노출</label>
                          <button type="button" onClick={() => deleteCategory(m)} style={{ fontSize:11, color:'#DC2626', background:'#fff', border:'1px solid #FECACA', borderRadius:6, padding:'5px 9px', cursor:'pointer', flexShrink:0 }}>삭제</button>
                        </div>
                        {filterTabs.filter(s => s.parent===m.tab_value).sort((a,b)=>a.sort_order-b.sort_order).map(s => (
                          <div key={s.id} style={{ display:'flex', gap:8, alignItems:'center', marginBottom:6, marginLeft:16 }}>
                            <span style={{ color:'#CBD5E1', flexShrink:0 }}>└</span>
                            {ftText(s)}
                            <label style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, color:'#475569', flexShrink:0 }}><input type="checkbox" checked={s.is_active} onChange={e => updateFt(s.id, { is_active: e.target.checked })} />노출</label>
                            <button type="button" onClick={() => deleteCategory(s)} style={{ width:28, height:28, border:'1px solid #FECACA', background:'#fff', color:'#DC2626', borderRadius:6, cursor:'pointer', flexShrink:0 }}>×</button>
                          </div>
                        ))}
                        <button type="button" onClick={() => addCategory(m.tab_value)} style={{ fontSize:12, color:'#1A8A4C', background:'#fff', border:'1px dashed #BBF7D0', borderRadius:6, padding:'7px 10px', cursor:'pointer', width:'100%', marginTop:4 }}>+ 소분류 추가</button>
                      </div>
                    ))}
                    {/* 메뉴 그룹 컬럼 */}
                    {megaGroups.map(g => (
                      <div key={g.id} className="adm-card" style={{ padding:'14px 16px', marginBottom:12, opacity: g.is_active ? 1 : 0.55 }}>
                        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:10 }}>
                          <span style={{ fontSize:11, fontWeight:800, color:'#2563EB', flexShrink:0 }}>메뉴 그룹</span>
                          {mText(g)}
                          <label style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, color:'#475569', flexShrink:0 }}><input type="checkbox" checked={g.is_active} onChange={e => updateMenu(g.id, { is_active: e.target.checked })} />노출</label>
                          <button type="button" onClick={() => deleteMenu(g.id)} style={{ fontSize:11, color:'#DC2626', background:'#fff', border:'1px solid #FECACA', borderRadius:6, padding:'5px 9px', cursor:'pointer', flexShrink:0 }}>삭제</button>
                        </div>
                        {menus.filter(s => s.parent===g.id).sort((a,b)=>a.sort_order-b.sort_order).map(s => (
                          <div key={s.id} style={{ display:'flex', gap:8, alignItems:'center', marginBottom:6, marginLeft:16, opacity: s.is_active ? 1 : 0.5 }}>
                            <span style={{ color:'#CBD5E1', flexShrink:0 }}>└</span>
                            {mText(s)}
                            <label style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, color:'#475569', flexShrink:0 }}><input type="checkbox" checked={s.is_active} onChange={e => updateMenu(s.id, { is_active: e.target.checked })} />노출</label>
                            <button type="button" onClick={() => deleteMenu(s.id)} style={{ width:28, height:28, border:'1px solid #FECACA', background:'#fff', color:'#DC2626', borderRadius:6, cursor:'pointer', flexShrink:0 }}>×</button>
                          </div>
                        ))}
                        <button type="button" onClick={() => addMenu({ parent:g.id, label:'새 링크', href:'/' })} style={{ fontSize:12, color:'#2563EB', background:'#fff', border:'1px dashed #BFDBFE', borderRadius:6, padding:'7px 10px', cursor:'pointer', width:'100%', marginTop:4 }}>+ 하위 링크</button>
                      </div>
                    ))}
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
                    <div className="adm-info-box" style={{ marginBottom:12 }}>💡 PC 헤더 <strong>상단 가로 메뉴</strong>. 노출 체크한 메뉴가 헤더 상단에 뜹니다.</div>
                    <div className="adm-card" style={{ padding:'14px 18px', marginBottom:16, border:'1px solid #FCD34D', background:'#FFFBEB' }}>
                      <div style={{ fontWeight:800, fontSize:13, marginBottom:10 }}>🖥 상단바 미리보기</div>
                      <div style={{ display:'flex', gap:24, flexWrap:'wrap', fontWeight:700 }}>
                        {shown.length===0 ? <span className="adm-muted" style={{ fontWeight:600 }}>노출 항목 없음</span> : shown.map(m => <span key={m.id}>{m.label}</span>)}
                      </div>
                    </div>
                    <div className="adm-toolbar"><div className="adm-toolbar-left" /><div className="adm-toolbar-right">
                      <button className="adm-btn adm-btn-outline" onClick={() => addMenu({ show_in_header:true, parent:null, label:'새 메뉴', href:'/' })}>+ 메뉴 추가</button>
                    </div></div>
                    {navItems.map(m => (
                      <div key={m.id} className="adm-card" style={{ padding:'10px 14px', marginBottom:8, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                        {mIn(m,'label','메뉴명','1 1 120px')}
                        {mIn(m,'href','/경로','1 1 130px')}
                        <label style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, color:'#475569' }}><input type="checkbox" checked={m.show_in_header} onChange={e => updateMenu(m.id, { show_in_header: e.target.checked })} />상단바</label>
                        <label style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, color:'#475569' }}><input type="checkbox" checked={m.is_active} onChange={e => updateMenu(m.id, { is_active: e.target.checked })} />활성</label>
                        <button type="button" onClick={() => deleteMenu(m.id)} style={{ fontSize:11, color:'#DC2626', background:'#fff', border:'1px solid #FECACA', borderRadius:6, padding:'5px 9px', cursor:'pointer' }}>삭제</button>
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
                    <div className="adm-info-box" style={{ marginBottom:12 }}>💡 <strong>상품목록 상단</strong> 구조입니다. <strong>대분류</strong> 탭(국산과일·수입과일)을 누르면 그 아래 <strong>소분류</strong>가 필탭으로 뜹니다. 여기서 추가·수정하면 <strong>메가메뉴</strong>에도 함께 반영돼요. <strong>노출</strong> 체크한 것만 실제로 보입니다.</div>
                    {/* 미리보기 */}
                    <div className="adm-card" style={{ padding:'16px 18px', marginBottom:16, border:'1px solid #FCD34D', background:'#FFFBEB' }}>
                      <div style={{ fontWeight:800, fontSize:13, marginBottom:12 }}>🖥 상품목록 상단 미리보기</div>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
                        <span style={{ ...chip, background:'#1A1A1A', color:'#fff', borderColor:'#1A1A1A', fontWeight:700 }}>전체</span>
                        {shownMajors.map(m => <span key={m.id} style={{ ...chip, borderColor:'#86EFAC', color:'#15803D', fontWeight:700 }}>{m.label}</span>)}
                        {shownMajors.length===0 && <span className="adm-muted" style={{ fontSize:12 }}>노출된 대분류 없음</span>}
                      </div>
                      {shownMajors.map(m => {
                        const ss = subsOf(m.tab_value).filter(s => s.show_in_category && s.is_active);
                        if (!ss.length) return null;
                        return (
                          <div key={m.id} style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', marginBottom:6 }}>
                            <span style={{ fontSize:11.5, color:'#94A3B8', minWidth:76 }}>{m.label} ▸</span>
                            {ss.map(s => <span key={s.id} style={chip}>{s.label}</span>)}
                          </div>
                        );
                      })}
                      {shownTags.length>0 && (
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', marginTop:10, paddingTop:10, borderTop:'1px dashed #FCD34D' }}>
                          <span style={{ fontSize:11.5, color:'#94A3B8', minWidth:76 }}>정렬·태그 ▸</span>
                          {shownTags.map(t => <span key={t.id} style={chip}>{t.label}</span>)}
                        </div>
                      )}
                    </div>
                    {/* 대분류·소분류 트리 (메가메뉴 공유) */}
                    <div className="adm-toolbar">
                      <div className="adm-toolbar-left"><span className="adm-muted" style={{ fontSize:13 }}>대분류 · 소분류 <span style={{ color:'#CBD5E1' }}>(메가메뉴와 공유 — 여기 수정하면 메가메뉴도 반영)</span></span></div>
                      <div className="adm-toolbar-right"><button className="adm-btn adm-btn-outline" onClick={() => addCategory(null)}>+ 대분류</button></div>
                    </div>
                    {majors.length===0 ? <div className="adm-muted" style={{ fontSize:12, padding:'10px 0' }}>대분류 없음</div> : majors.map(m => (
                      <div key={m.id} className="adm-card" style={{ padding:'14px 16px', marginBottom:12, opacity: m.is_active ? 1 : 0.55 }}>
                        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:10 }}>
                          <span style={{ display:'inline-flex', gap:4 }}>
                            <button className="adm-row-btn" style={{ padding:'2px 6px' }} onClick={() => moveFilterTab(m, -1)}>▲</button>
                            <button className="adm-row-btn" style={{ padding:'2px 6px' }} onClick={() => moveFilterTab(m, 1)}>▼</button>
                          </span>
                          <span style={{ fontSize:11, fontWeight:800, color:'#1A8A4C', flexShrink:0 }}>대분류</span>
                          {catLabel(m)}
                          <label style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, color:'#475569', flexShrink:0 }}><input type="checkbox" checked={m.show_in_category} onChange={e => updateFt(m.id, { show_in_category: e.target.checked })} />노출</label>
                          <button type="button" onClick={() => deleteCategory(m)} style={{ fontSize:11, color:'#DC2626', background:'#fff', border:'1px solid #FECACA', borderRadius:6, padding:'5px 9px', cursor:'pointer', flexShrink:0 }}>삭제</button>
                        </div>
                        {subsOf(m.tab_value).map(s => (
                          <div key={s.id} style={{ display:'flex', gap:8, alignItems:'center', marginBottom:6, marginLeft:16 }}>
                            <span style={{ color:'#CBD5E1', flexShrink:0 }}>└</span>
                            {catLabel(s)}
                            <label style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, color:'#475569', flexShrink:0 }}><input type="checkbox" checked={s.show_in_category} onChange={e => updateFt(s.id, { show_in_category: e.target.checked })} />노출</label>
                            <button type="button" onClick={() => deleteCategory(s)} style={{ width:28, height:28, border:'1px solid #FECACA', background:'#fff', color:'#DC2626', borderRadius:6, cursor:'pointer', flexShrink:0 }}>×</button>
                          </div>
                        ))}
                        <button type="button" onClick={() => addCategory(m.tab_value)} style={{ fontSize:12, color:'#1A8A4C', background:'#fff', border:'1px dashed #BBF7D0', borderRadius:6, padding:'7px 10px', cursor:'pointer', width:'100%', marginTop:4 }}>+ 소분류 추가</button>
                      </div>
                    ))}
                    {/* 정렬·태그 필탭 */}
                    <div className="adm-toolbar" style={{ marginTop:18 }}>
                      <div className="adm-toolbar-left"><span className="adm-muted" style={{ fontSize:13 }}>정렬 · 태그 필탭 <span style={{ color:'#CBD5E1' }}>(보기 방식 — 신상품·당도순 등)</span></span></div>
                      <div className="adm-toolbar-right"><button className="adm-btn adm-btn-outline" onClick={() => openFtModal()}>+ 필탭 추가</button></div>
                    </div>
                    {filtags.length===0 ? <div className="adm-muted" style={{ fontSize:12, padding:'10px 0' }}>필탭 없음</div> : filtags.map(t => (
                      <div key={t.id} className="adm-card" style={{ padding:'10px 14px', marginBottom:8, display:'flex', gap:10, alignItems:'center', flexWrap:'wrap', opacity:t.is_active?1:0.55 }}>
                        <span style={{ display:'inline-flex', gap:4 }}>
                          <button type="button" className="adm-row-btn" style={{ padding:'2px 7px' }} onClick={() => moveFilterTab(t, -1)}>▲</button>
                          <button type="button" className="adm-row-btn" style={{ padding:'2px 7px' }} onClick={() => moveFilterTab(t, 1)}>▼</button>
                        </span>
                        <span style={{ fontWeight:600, flex:'1 1 120px' }}>{t.label}</span>
                        <span className={`adm-badge ${t.tab_type==='link'?'badge-off':'badge-on'}`}>{t.tab_type==='flag'?'태그':t.tab_type==='sort'?'정렬':'링크'}</span>
                        <label style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, color:'#475569' }}><input type="checkbox" checked={t.show_in_category} onChange={e => updateFt(t.id, { show_in_category: e.target.checked })} />노출</label>
                        <button type="button" className="adm-row-btn" onClick={() => openFtModal(t)}>수정</button>
                        <button type="button" onClick={() => deleteFilterTab(t)} style={{ fontSize:11, color:'#DC2626', background:'#fff', border:'1px solid #FECACA', borderRadius:6, padding:'5px 9px', cursor:'pointer' }}>삭제</button>
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
                    <div className="adm-info-box" style={{ marginBottom:12 }}>💡 <strong>{surfaceName}</strong>에 뜨는 항목입니다. <strong>노출</strong> 체크한 것만 실제 화면에 나옵니다.</div>
                    <div className="adm-card" style={{ padding:'14px 18px', marginBottom:16, border:'1px solid #FCD34D', background:'#FFFBEB' }}>
                      <div style={{ fontWeight:800, fontSize:13, marginBottom:10 }}>🖥 {surfaceName} 미리보기</div>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                        {shownTags.map(t => <span key={t.id} style={chip}>{t.label}</span>)}
                        {shownTags.length===0 && <span className="adm-muted" style={{ fontSize:12 }}>노출 항목 없음</span>}
                      </div>
                    </div>
                    <div className="adm-toolbar">
                      <div className="adm-toolbar-left"><span className="adm-muted" style={{ fontSize:13 }}>필탭(정렬/태그) 노출 관리</span></div>
                      <div className="adm-toolbar-right"><button className="adm-btn adm-btn-outline" onClick={() => openFtModal()}>+ 필탭 추가</button></div>
                    </div>
                    {filtags.length===0 ? <div className="adm-muted" style={{ fontSize:12, padding:'10px 0' }}>필탭 없음</div> : filtags.map(t => (
                      <div key={t.id} className="adm-card" style={{ padding:'10px 14px', marginBottom:8, display:'flex', gap:10, alignItems:'center', flexWrap:'wrap', opacity:t.is_active?1:0.55 }}>
                        <span style={{ display:'inline-flex', gap:4 }}>
                          <button type="button" className="adm-row-btn" style={{ padding:'2px 7px' }} onClick={() => moveFilterTab(t, -1)}>▲</button>
                          <button type="button" className="adm-row-btn" style={{ padding:'2px 7px' }} onClick={() => moveFilterTab(t, 1)}>▼</button>
                        </span>
                        <span style={{ fontWeight:600, flex:'1 1 120px' }}>{t.label}</span>
                        <span className={`adm-badge ${t.tab_type==='link'?'badge-off':'badge-on'}`}>{t.tab_type==='flag'?'태그':t.tab_type==='sort'?'정렬':'링크'}</span>
                        <label style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, color:'#475569' }}><input type="checkbox" checked={t[flagKey]} onChange={e => updateFt(t.id, { [flagKey]: e.target.checked } as Partial<FilterTab>)} />노출</label>
                        <button type="button" className="adm-row-btn" onClick={() => openFtModal(t)}>수정</button>
                        <button type="button" onClick={() => deleteFilterTab(t)} style={{ fontSize:11, color:'#DC2626', background:'#fff', border:'1px solid #FECACA', borderRadius:6, padding:'5px 9px', cursor:'pointer' }}>삭제</button>
                      </div>
                    ))}
                  </>
                );
              })())}
            </div>
          )}

          {/* ===== 농가 관리 ===== */}
          {panel === 'farms' && (() => {
            const farmTypes = [...new Set(farms.map(f => f.farm_type).filter(Boolean) as string[])];
            const filteredFarms = farms.filter(f => !farmTypeFilter || f.farm_type === farmTypeFilter);
            return (
            <div className="adm-content">
              <div className="adm-toolbar" style={{ flexWrap:'wrap', gap:8 }}>
                <div className="adm-toolbar-left">
                  <div className="adm-btn-group">
                    <button className={`adm-seg-btn${farmTypeFilter===''?' active':''}`} onClick={() => setFarmTypeFilter('')}>전체</button>
                    {farmTypes.map(t => (
                      <button key={t} className={`adm-seg-btn${farmTypeFilter===t?' active':''}`} onClick={() => setFarmTypeFilter(t)}>{t}</button>
                    ))}
                  </div>
                </div>
                <div className="adm-toolbar-right">
                  <button className="adm-btn adm-btn-outline" onClick={loadFarms}><span className="adm-btn-icon"><Icon.Refresh /></span>새로고침</button>
                  <button className="adm-btn adm-btn-primary" onClick={() => openFarmModal()}>+ 농가 등록</button>
                </div>
              </div>
              <div className="adm-card">
                {farmsLoading ? <PanelLoading /> : (
                  <div className="adm-table-wrap">
                    <table className="adm-table">
                      <thead><tr><th>농가명</th><th>대표자</th><th>지역</th><th>농가 유형</th><th>택배사</th><th>상품</th><th>리뷰</th><th>❤️찜</th><th>관리</th></tr></thead>
                      <tbody>
                        {filteredFarms.length === 0 ? (
                          <tr><td colSpan={9} style={{ textAlign:'center', padding:'40px 0', color:'#94A3B8' }}>{farms.length === 0 ? '등록된 농가 없음' : '해당 유형 농가 없음'}</td></tr>
                        ) : filteredFarms.map(f => (
                          <tr key={f.id}>
                            <td><strong>{f.name}</strong></td>
                            <td>{f.farmer_name || '-'}</td>
                            <td className="adm-muted">{f.region || '-'}</td>
                            <td>{f.farm_type || '-'}</td>
                            <td>{f.carrier ? <span className="adm-badge badge-carrier">{f.carrier}</span> : '-'}</td>
                            <td className="adm-mono" style={{ fontSize:12 }}>{f.active_count || 0}<span style={{ color:'#CBD5E1' }}>/{f.product_count || 0}</span></td>
                            <td className="adm-mono" style={{ fontSize:12 }}>{(f.review_count || 0) > 0 ? <>{(f.avg_rating || 0).toFixed(1)} <span className="adm-muted">({f.review_count})</span></> : <span className="adm-muted">-</span>}</td>
                            <td className="adm-mono">{(f.wish_count || 0).toLocaleString()}</td>
                            <td style={{ display:'flex', gap:6 }}>
                              <button className="adm-row-btn" style={{ color:'#2563EB' }} onClick={() => openFarmDetail(f)}>분석</button>
                              <button className="adm-row-btn" onClick={() => openFarmModal(f)}>수정</button>
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
              <div className="adm-kpi-grid adm-kpi-3 adm-kpi-mb16">
                {[
                  { l:'전체 리뷰', v:`${reviews.length}건`, red:false },
                  { l:'미답변', v:`${reviewUnansweredCount}건`, red:true },
                  { l:'평균 평점', v:`★ ${reviewAvgRating.toFixed(1)}`, red:false },
                ].map(k => (
                  <div key={k.l} className="adm-kpi-card">
                    <div className="adm-kpi-label">{k.l}</div>
                    <div className="adm-kpi-value adm-kpi-value-mt" style={k.red && reviewUnansweredCount>0 ? { color:'#DC2626' } : undefined}>{k.v}</div>
                  </div>
                ))}
              </div>
              <div className="adm-toolbar" style={{ flexWrap:'wrap', gap:8 }}>
                <div className="adm-toolbar-left" style={{ flexWrap:'wrap', gap:8, alignItems:'center' }}>
                  <AdmSelect value={reviewRating} onChange={v => { setReviewRating(v); setReviewPage(1); }}
                    options={[{ value:'', label:'별점 전체' }, ...['5','4','3','2','1'].map(s => ({ value:s, label:`${s}점` }))]} />
                  <AdmSelect value={reviewAnswered} onChange={v => { setReviewAnswered(v as 'all'|'unanswered'|'answered'); setReviewPage(1); }}
                    options={[{ value:'all', label:'전체' }, { value:'unanswered', label:'미답변' }, { value:'answered', label:'답변완료' }]} />
                  <input type="date" className="adm-select" value={reviewFrom} onChange={e => { setReviewFrom(e.target.value); setReviewPage(1); }} />
                  <span style={{ color:'#94A3B8' }}>~</span>
                  <input type="date" className="adm-select" value={reviewTo} onChange={e => { setReviewTo(e.target.value); setReviewPage(1); }} />
                  <input type="text" className="adm-input-text" placeholder="내용·작성자(이름/이메일) 검색"
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
                      <thead><tr><th>별점</th><th>내용</th><th>작성자(아이디)</th><th>상품</th><th>답변</th><th>베스트</th><th>👍</th><th>🚨</th><th>작성일</th><th>관리</th></tr></thead>
                      <tbody>
                        {filteredReviews.length === 0 ? (
                          <tr><td colSpan={10} style={{ textAlign:'center', padding:'40px 0', color:'#94A3B8' }}>{reviews.length === 0 ? '리뷰 없음' : '검색 결과 없음'}</td></tr>
                        ) : pagedReviews.map(r => (
                          <tr key={r.id} style={{ cursor:'pointer' }} onClick={() => { setSelectedReview(r); setReviewReply(r.seller_reply || ''); }}>
                            <td><StarRating rating={r.rating} size={13} /></td>
                            <td style={{ maxWidth:240, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.content}</td>
                            <td style={{ fontSize:12, lineHeight:1.35 }}>
                              <div style={{ fontWeight:600 }}>{r.profiles?.name || '익명'}</div>
                              <div className="adm-muted" style={{ fontSize:11 }}>{r.profiles?.email || '-'}</div>
                            </td>
                            <td className="adm-muted" style={{ fontSize:12 }}>{r.products?.name || '-'}</td>
                            <td>
                              {r.seller_reply
                                ? <span className="adm-badge badge-done">완료</span>
                                : <span className="adm-badge badge-wait" style={{ color:'#DC2626' }}>미답변</span>}
                            </td>
                            <td><Toggle defaultOn={r.is_best} onChange={v => toggleReviewBest(r.id, v)} /></td>
                            <td className="adm-mono" style={{ fontSize:12 }}>{r.likes_count || 0}</td>
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
                                      <td className="adm-muted" style={{ fontSize:12 }}>
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
                                <td className="adm-mono" style={{ fontSize:12 }}>{c.code || '-'}</td>
                                <td>{c.discount_type === 'percent' ? '정률' : '정액'}</td>
                                <td><strong>{c.discount_type === 'percent' ? `${c.discount_value}%` : `${fmtPrice(c.discount_value)}원`}</strong></td>
                                <td className="adm-muted" style={{ fontSize:12 }}>{c.expires_at ? c.expires_at.slice(0,10) : '무제한'}</td>
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
                                <td className="adm-muted" style={{ fontSize:12 }}>{l.source}</td>
                                <td className="adm-muted" style={{ fontSize:12 }}>{l.issued_at ? l.issued_at.slice(0,10) : '-'}</td>
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
                                      <td className="adm-muted" style={{ fontSize:12 }}>
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
                            <tr><th>이름</th><th>이메일</th><th>등급</th><th>보유 포인트</th><th>관리</th></tr>
                          </thead>
                          <tbody>
                            {filteredPointMembers.length === 0 ? (
                              <tr><td colSpan={5} style={{ textAlign:'center', padding:'40px 0', color:'#94A3B8' }}>회원 없음</td></tr>
                            ) : pagedPointMembers.map(m => (
                              <tr key={m.id}>
                                <td style={{ fontWeight:500 }}>{m.name}</td>
                                <td className="adm-muted" style={{ fontSize:12 }}>{m.email}</td>
                                <td>
                                  <span className={`adm-badge ${GRADE_BADGE_CLS[m.grade]||'badge-normal'}`}>
                                    {GRADE_LABEL[m.grade]||m.grade}
                                  </span>
                                </td>
                                <td className="adm-mono" style={{ fontWeight:600, color: (m.point_balance||0) > 0 ? '#2D7A4D' : '#94A3B8' }}>
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
                        <thead><tr><th>일시</th><th>회원</th><th>구분</th><th>포인트</th><th>사유</th></tr></thead>
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
                              <td className="adm-mono" style={{ fontWeight:600, color: l.amount >= 0 ? '#2D7A4D' : '#DC2626' }}>
                                {l.amount >= 0 ? '+' : ''}{fmtPrice(l.amount)}P
                              </td>
                              <td className="adm-muted" style={{ fontSize:12 }}>{l.description || '-'}</td>
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

                  {/* SQL 안내 */}
                  {popups.length === 0 && !popupsLoading && (
                    <div className="adm-info-box adm-info-mt10">
                      💡 <strong>팝업 테이블이 없으면</strong> Supabase SQL Editor에서 아래 쿼리를 실행하세요:<br/>
                      <code style={{ fontSize:11, display:'block', marginTop:6, background:'rgba(0,0,0,0.06)', padding:'8px 12px', borderRadius:6, whiteSpace:'pre-wrap' }}>
{`CREATE TABLE IF NOT EXISTS popups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  image_url text,
  link_url text NOT NULL DEFAULT '/',
  width int NOT NULL DEFAULT 400,
  position text NOT NULL DEFAULT 'center',
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE popups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "popups_select_all" ON popups FOR SELECT USING (true);
CREATE POLICY "popups_all_admin" ON popups FOR ALL USING (is_current_user_admin());
GRANT ALL ON popups TO authenticated, anon;`}
                      </code>
                    </div>
                  )}
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
                      <thead><tr><th>이름</th><th>이메일</th><th>연락처</th><th>가입경로</th><th>등급</th><th>포인트</th><th>상태</th><th>가입일</th><th>관리</th></tr></thead>
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
                            <td className="adm-muted" style={{ fontSize:12 }}>{m.email}</td>
                            <td className="adm-muted" style={{ fontSize:12 }}>{m.phone || '-'}</td>
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
                            <td className="adm-mono">{(m.point_balance||0).toLocaleString()}P</td>
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
                <div className="adm-info-box" style={{ marginBottom:12 }}>
                  💡 리워드는 <strong>피추천인이 첫 구매(배송완료)</strong>하면 <strong>추천인</strong>에게 <strong>5,000원 쿠폰</strong>이 <strong>자동 지급</strong>됩니다. (아래 "추천인"이 리워드 수령자)
                </div>
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
                                  <td className="adm-muted" style={{ fontSize:12 }}>{rc.is_used ? (rc.used_at ? `사용 ${fmtDateShort(rc.used_at)}` : '사용됨') : (rc.expires_at ? `만료 ${fmtDateShort(rc.expires_at)}` : '무제한')}</td>
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
                              <td className="adm-mono" style={{ fontSize:12 }}>{inq.contact}</td>
                              <td className="adm-muted" style={{ fontSize:12 }}>{inq.email}</td>
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
              <div className="adm-info-box" style={{ marginBottom:12 }}>
                💡 <strong>FAQ</strong>는 고객센터 페이지에 카테고리별로 그룹 표시됩니다. {canDragFaq
                  ? <>⠿ 행을 <strong>드래그</strong>해서 순서를 바꾸세요 (저장 자동).</>
                  : <>순서를 바꾸려면 위에서 <strong>카테고리를 선택</strong>하세요. (전체·검색 상태에선 순서 숨김)</>}
              </div>
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
                                  <td className="adm-mono" style={{ fontSize:12 }}>{r.orders?.order_no || '-'}</td>
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
                                  <td className="adm-mono" style={{ fontSize:12 }}>{o.order_no}</td>
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
                        <h3 style={{ fontSize:18, fontWeight:800, margin:0 }}>환불 신청 상세</h3>
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
                        <div className="adm-kpi-value adm-kpi-value-mt" style={{ color: c as string, fontSize:18 }}>{v}</div>
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
                        <div className="adm-kpi-value adm-kpi-value-mt" style={{ color: c as string, fontSize:18 }}>{v}</div>
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
                        <thead><tr><th>상품</th><th>수량</th><th>매출</th></tr></thead>
                        <tbody>
                          {settlementData.topProducts.length === 0
                            ? <tr><td colSpan={3} style={{ textAlign:'center', color:'#94A3B8', padding:'20px 0' }}>데이터 없음</td></tr>
                            : settlementData.topProducts.map((r, i) => (
                              <tr key={r.name}><td><span style={{ fontWeight:800, color:'#CBD5E1', marginRight:6 }}>{i+1}</span>{r.name}</td><td>{r.qty}개</td><td style={{ fontWeight:600 }}>{fmtPrice(r.amount)}원</td></tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="adm-card">
                      <div className="adm-card-head"><span className="adm-card-title">카테고리별 매출 TOP</span></div>
                      <table className="adm-table" style={{ marginTop:4 }}>
                        <thead><tr><th>카테고리</th><th>수량</th><th>매출</th></tr></thead>
                        <tbody>
                          {settlementData.topCategories.length === 0
                            ? <tr><td colSpan={3} style={{ textAlign:'center', color:'#94A3B8', padding:'20px 0' }}>데이터 없음</td></tr>
                            : settlementData.topCategories.map((r, i) => (
                              <tr key={r.category}><td><span style={{ fontWeight:800, color:'#CBD5E1', marginRight:6 }}>{i+1}</span>{r.category}</td><td>{r.qty}개</td><td style={{ fontWeight:600 }}>{fmtPrice(r.amount)}원</td></tr>
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
                        <thead><tr><th>상태</th><th>건수</th><th>금액</th></tr></thead>
                        <tbody>
                          {settlementData.byStatus.length === 0
                            ? <tr><td colSpan={3} style={{ textAlign:'center', color:'#94A3B8', padding:'20px 0' }}>주문 없음</td></tr>
                            : settlementData.byStatus.map(r => (
                            <tr key={r.status}>
                              <td><span className={`adm-badge ${STATUS_BADGE_CLS[r.status] || 'badge-wait'}`}>{STATUS_LABEL[r.status] || r.status}</span></td>
                              <td>{r.count}건</td>
                              <td style={{ fontWeight:600 }}>{fmtPrice(r.amount)}원</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* 결제 수단별 */}
                    <div className="adm-card">
                      <div className="adm-card-head"><span className="adm-card-title">결제 수단별 현황</span></div>
                      <table className="adm-table" style={{ marginTop:4 }}>
                        <thead><tr><th>결제수단</th><th>건수</th><th>금액</th></tr></thead>
                        <tbody>
                          {settlementData.byMethod.length === 0
                            ? <tr><td colSpan={3} style={{ textAlign:'center', color:'#94A3B8', padding:'20px 0' }}>주문 없음</td></tr>
                            : settlementData.byMethod.map(r => (
                            <tr key={r.method}>
                              <td style={{ fontWeight:500 }}>{r.method}</td>
                              <td>{r.count}건</td>
                              <td style={{ fontWeight:600 }}>{fmtPrice(r.amount)}원</td>
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
              <div className="adm-info-box" style={{ marginBottom:12 }}>
                💡 농가가 제공한 <strong>공급가</strong> 기준으로 선택 월의 <strong>배송완료·구매확정</strong> 주문을 농가별 집계합니다. <strong>정산액 = 공급가 × 판매수량</strong>, 마진 = 매출 − 정산액.
              </div>
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
                      <thead><tr><th>농가</th><th>판매수량</th><th>매출</th><th>정산액(공급가)</th><th>마진</th><th>상태</th><th>처리</th></tr></thead>
                      <tbody>
                        {farmSettleRows.length === 0 ? (
                          <tr><td colSpan={7} style={{ textAlign:'center', padding:'40px 0', color:'#94A3B8' }}>해당 월 정산 내역이 없습니다.</td></tr>
                        ) : farmSettleRows.map(r => {
                          const paidAt = r.farmId ? farmSettlePaid[r.farmId] : undefined;
                          return (
                          <tr key={r.farmId ?? 'none'}>
                            <td><strong>{r.farmName}</strong></td>
                            <td className="adm-mono">{r.qty.toLocaleString()}개</td>
                            <td className="adm-mono adm-muted">{fmtPrice(r.sales)}원</td>
                            <td className="adm-mono"><strong>{fmtPrice(r.payout)}원</strong></td>
                            <td className="adm-mono" style={{ color: r.margin >= 0 ? '#16A34A' : '#DC2626' }}>{fmtPrice(r.margin)}원</td>
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
                              <td style={{ fontSize:11 }}>
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
                              <td className="adm-muted" style={{ fontSize:11 }}>{r.purchase_purpose || '—'}</td>
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
                    <div className="adm-kpi-value adm-kpi-value-mt" style={{ fontSize:21, color: opts.valColor }}>{v}</div>
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
                              <div key={l} className="adm-kpi-card"><div className="adm-kpi-label">{l}</div><div className="adm-kpi-value adm-kpi-value-mt" style={{ fontSize:18 }}>{v}</div></div>
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
                      <input type="number" className="adm-input-text adm-input-w100" min={0} value={siteSettings.review_point_text ?? '100'} onChange={e => setSiteSettings(prev => ({ ...prev, review_point_text: e.target.value }))} />
                      <span className="adm-muted">P (일반 리뷰)</span>
                    </div>
                  </div>
                  <div className="adm-form-row">
                    <label className="adm-label">사진·영상 리뷰 적립 포인트</label>
                    <div className="adm-flex-center-gap">
                      <input type="number" className="adm-input-text adm-input-w100" min={0} value={siteSettings.review_point_photo ?? '500'} onChange={e => setSiteSettings(prev => ({ ...prev, review_point_photo: e.target.value }))} />
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
                <span style={{ fontSize:16, fontWeight:800 }}>{selectedMember.name}</span>
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
                <span style={{ fontSize:17, fontWeight:800 }}>쿠폰 지급</span>
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
                      <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, cursor:'pointer', whiteSpace:'nowrap' }}>
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
              <h3 style={{ fontSize:18, fontWeight:800, margin:0 }}>포인트 지급</h3>
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
              <h3 style={{ fontSize:18, fontWeight:800, margin:0 }}>입점문의 상세</h3>
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
              <h3 style={{ fontSize:18, fontWeight:800, margin:0 }}>{editingLounge ? '라운지 수정' : '라운지 등록'}</h3>
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
              <h3 style={{ fontSize:18, fontWeight:800, margin:0 }}>{editingCoupon ? '쿠폰 수정' : '쿠폰 생성'}</h3>
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
                <input type="datetime-local" className="adm-input-text"
                  value={couponForm.starts_at} onChange={e => setCouponForm(p => ({ ...p, starts_at: e.target.value }))} />
              </div>
              {/* 일반 쿠폰: 고정 만료일 선택 가능 (신규회원 쿠폰은 발급일 기준이라 숨김) */}
              {!couponForm.signup_grant && (
                <div className="adm-form-row">
                  <label className="adm-label">만료일 <span style={{ fontWeight:400, color:'#94A3B8' }}>(고정 날짜)</span></label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                      <input type="checkbox" checked={!couponForm.expires_at}
                        onChange={e => setCouponForm(p => ({ ...p, expires_at: e.target.checked ? '' : new Date(Date.now() + 30*24*60*60*1000).toISOString().slice(0,16) }))} />
                      무제한 (만료일 없음)
                    </label>
                    {couponForm.expires_at && (
                      <input type="datetime-local" className="adm-input-text"
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
