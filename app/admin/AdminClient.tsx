'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import '@/styles/admin.css';
import { StarRating } from '@/components/StarRating';
import TrackingModal from '@/components/TrackingModal/TrackingModal';
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
type PanelKey = 'dashboard'|'orders'|'products'|'farms'|'reviews'|'coupon'|'banner'|'events'|'lounge'|'members'|'referral'|'sms'|'inquiry'|'faq'|'cs'|'productinquiry'|'settlement'|'tasteprofile'|'settings';

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
  order_items?: OrderItem[];
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
}

interface AdminProductFull extends AdminProduct {
  sku: string;
  origin: string;
  short_desc: string | null;
  thumbnail_url: string | null;
  image_urls: (string | null)[] | null;
  dispatch_cutoff: string | null;
  brix: number | null;
  badge: string | null;
  is_new: boolean;
  is_best: boolean;
  is_dawn: boolean;
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
  created_at: string;
  wish_count?: number;
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
  created_at: string;
  profiles: { name: string | null; email: string } | null;
  products: { name: string } | null;
}

interface AdminEvent {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  badge: string | null;
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
  link_url: string;
  is_active: boolean;
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
  code: string;
  status: string;  /* pending | rewarded */
  rewarded_at: string | null;
  created_at: string;
  referrer: { name: string; email: string } | null;
  referred: { name: string; email: string } | null;
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
  starts_at: string; expires_at: string | null; is_active: boolean; created_at: string;
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
  dashboard:'대시보드', orders:'주문 관리', products:'상품 관리', farms:'농가 관리',
  reviews:'리뷰 관리', coupon:'쿠폰 / 포인트', banner:'배너 / 팝업', events:'이벤트',
  lounge:'라운지 관리', members:'회원 관리', referral:'친구 추천', sms:'SMS 발송',
  inquiry:'입점 문의', faq:'FAQ 관리', cs:'1:1 문의 관리', productinquiry:'상품 문의',
  settlement:'정산 관리', tasteprofile:'취향 프로파일', settings:'설정',
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
  shipped:'배송중', delivered:'배송완료', cancelled:'취소됨',
  refunding:'환불처리중', refunded:'환불완료',
};

const STATUS_BADGE_CLS: Record<string, string> = {
  pending:'badge-wait', paid:'badge-paid', preparing:'badge-ready',
  shipped:'badge-shipping', delivered:'badge-done', cancelled:'badge-off',
  refunding:'badge-refund', refunded:'badge-off',
};

const GRADE_LABEL: Record<string, string> = {
  normal:'일반', silver:'실버', gold:'골드', vip:'VIP', vvip:'VVIP',
};

const GRADE_BADGE_CLS: Record<string, string> = {
  normal:'badge-normal', silver:'badge-silver', gold:'badge-gold',
  vip:'badge-gold', vvip:'badge-gold',
};

const CAT_LABEL: Record<string, string> = {
  apple:'사과/배', citrus:'감귤류', berry:'베리류', melon:'멜론/참외',
  kiwi:'키위', mango:'망고', grape:'포도', gift:'선물세트',
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
  Bell: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
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
  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !on;
    setOn(next);
    onChange?.(next);
  }
  return (
    <div onClick={handleClick} style={{
      width: 36, height: 20, borderRadius: 999, cursor: 'pointer', flexShrink: 0,
      background: on ? 'var(--accent, #2563EB)' : '#CBD5E1',
      transition: 'background .2s',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute', top: 3, left: 3,
        width: 14, height: 14, borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        transition: 'transform .2s',
        transform: on ? 'translateX(16px)' : 'translateX(0)',
      }} />
    </div>
  );
}

/* ===== 로딩 스피너 ===== */
function PanelLoading() {
  return <div style={{ textAlign:'center', padding:'60px 0', color:'#94A3B8', fontSize:14 }}>불러오는 중...</div>;
}

/* ===== SMS 발송 패널 ===== */
function SmsPanel({ members, loadMembers, membersLoading }: {
  members: AdminProfile[];
  loadMembers: () => void;
  membersLoading: boolean;
}) {
  const [smsText,      setSmsText]      = useState('');
  const [targetMode,   setTargetMode]   = useState<'all'|'grade'|'select'|'custom'>('all');
  const [gradeFilter,  setGradeFilter]  = useState('gold');
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set());
  const [memberSearch, setMemberSearch] = useState('');
  const [customNums,   setCustomNums]   = useState('');
  const [sending,      setSending]      = useState(false);
  const [preview,      setPreview]      = useState(false);
  const [smsLogs,      setSmsLogs]      = useState<{ id: string; message: string; target_count: number; msg_type: string; status: string; error_msg: string|null; created_at: string }[]>([]);
  const [logsLoading,  setLogsLoading]  = useState(false);

  useEffect(() => {
    if (members.length === 0) loadMembers();
    loadSmsLogs();
  }, []); // eslint-disable-line

  async function loadSmsLogs() {
    setLogsLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from('sms_logs').select('*').order('created_at', { ascending: false }).limit(30);
    setSmsLogs((data || []) as typeof smsLogs);
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
    if (targetMode === 'grade')  filtered = members.filter(m => gradeFilter === 'gold' ? ['gold','vip','vvip'].includes(m.grade) : m.grade === gradeFilter);
    if (targetMode === 'select') filtered = members.filter(m => selectedIds.has(m.id));
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
  const GRADE_LABEL_MAP: Record<string,string> = { normal:'일반', silver:'실버', gold:'골드', vip:'VIP', vvip:'VVIP' };

  return (
    <div className="adm-content">
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

              {/* 등급별 선택 */}
              {targetMode === 'grade' && (
                <select className="adm-select" value={gradeFilter} onChange={e => setGradeFilter(e.target.value)}>
                  <option value="gold">골드·VIP·VVIP</option>
                  {Object.entries(GRADE_LABEL_MAP).map(([v,l]) => <option key={v} value={v}>{l}만</option>)}
                </select>
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
                  <input type="text" className="adm-input-text" placeholder="이름·이메일·전화번호 검색"
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
                        <div style={{ fontSize:11, color:'#94A3B8' }}>{m.phone}</div>
                      </div>
                      <span className={`adm-badge ${m.grade === 'gold' || m.grade === 'vip' || m.grade === 'vvip' ? 'badge-gold' : 'badge-normal'}`} style={{ fontSize:10 }}>
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
            <span className="adm-card-title">최근 발송 이력</span>
            <button className="adm-btn adm-btn-outline" style={{ fontSize:12, padding:'4px 10px' }} onClick={loadSmsLogs}>
              <span className="adm-btn-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg></span>새로고침
            </button>
          </div>
          {logsLoading ? <PanelLoading /> : smsLogs.length === 0 ? (
            <div className="adm-muted" style={{ padding:'24px 0', fontSize:13, textAlign:'center' }}>발송 이력 없음</div>
          ) : (
            <div>
              {smsLogs.map(log => (
                <div key={log.id} style={{ padding:'12px 16px', borderBottom:'1px solid #F1F5F9' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                    <span style={{ fontSize:11, background: log.status==='sent'?'#DCFCE7':'#FEE2E2', color: log.status==='sent'?'#166534':'#991B1B', borderRadius:4, padding:'1px 6px', fontWeight:700 }}>
                      {log.status==='sent' ? '발송완료' : '실패'}
                    </span>
                    <span style={{ fontSize:11, background:'#F1F5F9', color:'#64748B', borderRadius:4, padding:'1px 6px', fontWeight:700 }}>{log.msg_type}</span>
                  </div>
                  <div style={{ fontSize:13, color:'#1A1A1A', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{log.message}</div>
                  <div style={{ fontSize:11, color:'#94A3B8' }}>
                    {log.target_count}명 · {new Date(log.created_at).toLocaleString('ko-KR', { month:'numeric', day:'numeric', hour:'numeric', minute:'2-digit' })}
                  </div>
                  {log.error_msg && <div style={{ fontSize:11, color:'#DC2626', marginTop:2 }}>{log.error_msg}</div>}
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

/* ===== 메인 컴포넌트 ===== */
export default function AdminClient() {
  const [panel, setPanel] = useState<PanelKey>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [chartDays, setChartDays] = useState<'7'|'30'>('7');
  const [farmModal, setFarmModal] = useState(false);
  const [farms, setFarms] = useState<AdminFarm[]>([]);
  const [farmsLoading, setFarmsLoading] = useState(false);
  const [editingFarm, setEditingFarm] = useState<AdminFarm | null>(null);
  const [farmSaving, setFarmSaving] = useState(false);
  const [farmForm, setFarmForm] = useState({ name: '', farmer_name: '', region: '', farm_type: 'fruit', intro: '', carrier: '' });


  /* ── 상품 등록/수정 모달 ── */
  const [productModal, setProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AdminProductFull | null>(null);

  /* ── 상세설명 / 상세정보 에디터 ── */
  const [detailEditor, setDetailEditor] = useState<{ id: string; name: string } | null>(null);
  const [infoEditor,   setInfoEditor]   = useState<{ id: string; name: string } | null>(null);
  const [farmList, setFarmList] = useState<AdminFarmSimple[]>([]);
  const PRODUCT_EMPTY: Omit<AdminProductFull, 'id' | 'discounted_price' | 'created_at'> = {
    sku: '', name: '', category: 'apple', origin: '', price: 0, discount_rate: 0,
    short_desc: '', thumbnail_url: '', image_urls: [null, null, null, null, null],
    dispatch_cutoff: '', brix: null, badge: '', is_new: false,
    is_best: false, is_dawn: false, is_active: true, farm_id: null, sort_order: 0,
  };
  const [pForm, setPForm] = useState({ ...PRODUCT_EMPTY });
  const [pSaving, setPSaving] = useState(false);
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

  /* ── 주문 ── */
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [orderFarmFilter, setOrderFarmFilter] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [trackingInput, setTrackingInput] = useState({ courier: '', tracking_number: '' });
  const [savingTracking, setSavingTracking] = useState(false);
  const [showTrackingModal, setShowTrackingModal] = useState(false);

  /* ── 상품 ── */
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productCatFilter, setProductCatFilter] = useState('');

  /* ── 회원 ── */
  const [members, setMembers] = useState<AdminProfile[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberGradeFilter, setMemberGradeFilter] = useState('');
  const [memberBlockFilter, setMemberBlockFilter] = useState<'all'|'active'|'blocked'>('all');
  const [selectedMember, setSelectedMember] = useState<AdminProfile | null>(null);
  const [memberMemo, setMemberMemo] = useState('');
  const [memberMemoSaving, setMemberMemoSaving] = useState(false);
  const [memberOrders, setMemberOrders] = useState<Order[]>([]);
  const [memberOrdersLoading, setMemberOrdersLoading] = useState(false);

  /* ── 리뷰 ── */
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [selectedReview, setSelectedReview] = useState<AdminReview | null>(null);

  /* ── 이벤트 ── */
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventModal, setEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AdminEvent | null>(null);
  const EVENT_EMPTY = {
    slug: '', title: '', subtitle: '', badge: '',
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
  const [pointFilter, setPointFilter] = useState<'all' | 'has' | 'none'>('all');
  const [pointStats, setPointStats] = useState({ total: 0, monthGiven: 0, monthUsed: 0 });
  const [givePointModal, setGivePointModal] = useState(false);
  const [givePointTarget, setGivePointTarget] = useState<AdminProfile | null>(null);
  const [givePointForm, setGivePointForm] = useState({ amount: '', desc: '' });
  const [givePointSaving, setGivePointSaving] = useState(false);

  /* ── 쿠폰 ── */
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [couponModal, setCouponModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<AdminCoupon | null>(null);
  const [couponForm, setCouponForm] = useState({ code: '', name: '', discount_type: 'percent' as 'percent'|'fixed', discount_value: 10, min_order_amount: 0, max_discount_amount: '', starts_at: '', expires_at: '', is_active: true });
  const [couponSaving, setCouponSaving] = useState(false);

  /* ── 입점 문의 ── */
  const [inquiries, setInquiries] = useState<FarmInquiry[]>([]);
  const [inquiriesLoading, setInquiriesLoading] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState<FarmInquiry | null>(null);

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

  /* ── 상품 문의 ── */
  const [productInquiries, setProductInquiries] = useState<AdminProductInquiry[]>([]);
  const [productInquiriesLoading, setProductInquiriesLoading] = useState(false);
  const [selectedProductInquiry, setSelectedProductInquiry] = useState<AdminProductInquiry | null>(null);
  const [piqAnswer, setPiqAnswer] = useState('');
  const [piqAnswering, setPiqAnswering] = useState(false);
  const [piqStatusFilter, setPiqStatusFilter] = useState<'all'|'pending'|'answered'>('all');
  const [piqSearch, setPiqSearch] = useState('');

  /* ── 1:1 문의 ── */
  const [csItems, setCsItems] = useState<CsInquiryAdmin[]>([]);
  const [csAdminLoading, setCsAdminLoading] = useState(false);
  const [selectedCs, setSelectedCs] = useState<CsInquiryAdmin | null>(null);
  const [csAnswer, setCsAnswer] = useState('');
  const [csAnswering, setCsAnswering] = useState(false);
  const [csAdminTab, setCsAdminTab] = useState('tab-pending');

  /* ── 배너 ── */
  const [banners, setBanners] = useState<AdminBanner[]>([]);
  const [bannersLoading, setBannersLoading] = useState(false);
  const [bannerModal, setBannerModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState<AdminBanner | null>(null);
  const BANNER_EMPTY = { type: 'main', link_url: '/', is_active: true };
  const [bnForm, setBnForm] = useState<{ type: string; link_url: string; is_active: boolean }>({ ...BANNER_EMPTY });
  const [bnImgUrl, setBnImgUrl] = useState<string>('');
  const [bnSaving, setBnSaving] = useState(false);
  const [bnUploading, setBnUploading] = useState(false);
  const bnImgRef = useRef<HTMLInputElement>(null);

  /* ── 팝업 ── */
  interface AdminPopup { id: string; title: string | null; image_url: string | null; link_url: string; width: number; position: string; is_active: boolean; starts_at: string | null; ends_at: string | null; created_at: string; }
  const [popups, setPopups] = useState<AdminPopup[]>([]);
  const [popupsLoading, setPopupsLoading] = useState(false);
  const [popupModal, setPopupModal] = useState(false);
  const [editingPopup, setEditingPopup] = useState<AdminPopup | null>(null);
  const POPUP_EMPTY = { title: '', link_url: '/', width: 400, position: 'center', is_active: true, starts_at: '', ends_at: '' };
  const [ppForm, setPpForm] = useState<typeof POPUP_EMPTY>({ ...POPUP_EMPTY });
  const [ppImgUrl, setPpImgUrl] = useState('');
  const [ppSaving, setPpSaving] = useState(false);
  const [ppUploading, setPpUploading] = useState(false);
  const ppImgRef = useRef<HTMLInputElement>(null);

  /* ── 취향 프로파일(설문 결과) ── */
  const [surveyResults, setSurveyResults] = useState<AdminSurveyResult[]>([]);
  const [surveyLoading, setSurveyLoading] = useState(false);

  /* ── 친구 추천 ── */
  const [referrals, setReferrals] = useState<AdminReferral[]>([]);
  const [referralsLoading, setReferralsLoading] = useState(false);
  const [referralSearch, setReferralSearch] = useState('');
  const [referralStatusFilter, setReferralStatusFilter] = useState<'all'|'pending'|'rewarded'>('all');

  /* ── 탭 ── */
  const [couponTab, setCouponTab] = useState('tab-coupon');
  const [bannerTab, setBannerTab] = useState('tab-banner');
  const [inquiryTab, setInquiryTab] = useState('tab-general');

  /* ── 사이트 설정 ── */
  const [siteSettings, setSiteSettings] = useState<Record<string, string>>({ pick_count: '6' });
  const [settingsSaving, setSettingsSaving] = useState(false);

  /* ── 검색 통계 ── */
  const [searchStats, setSearchStats] = useState<{ keyword: string; count: number; trend: number; isNew: boolean }[]>([]);
  const [noResultStats, setNoResultStats] = useState<{ keyword: string; count: number }[]>([]);
  const [searchStatsLoading, setSearchStatsLoading] = useState(false);
  const [statsDays, setStatsDays] = useState<7|30>(7);
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
  } | null>(null);
  const [settlementLoading, setSettlementLoading] = useState(false);

  const loadedPanels = useRef(new Set<PanelKey>());

  /* ── 어드민 권한 확인 (모든 useState/useRef 이후) ── */
  useEffect(() => {
    async function checkAdmin() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAdminChecked(true); return; }
      const { data } = await supabase.rpc('is_current_user_admin');
      setIsAdmin(data === true);
      setAdminChecked(true);
    }
    checkAdmin();
  }, []); // eslint-disable-line

  /* ── 대시보드 최초 로드 (isAdmin 확인 후) ── */
  useEffect(() => {
    if (isAdmin) loadDashboard();
  }, [isAdmin]); // eslint-disable-line

  /* ── Early return: 모든 Hook 선언 이후에만 위치 가능 ── */
  if (!adminChecked) {
    return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontSize:14, color:'#94A3B8' }}>확인 중...</div>;
  }
  if (!isAdmin) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', gap:12 }}>
        <div style={{ fontSize:32 }}>🔒</div>
        <div style={{ fontSize:16, fontWeight:700, color:'#1A1A1A' }}>접근 권한이 없습니다</div>
        <div style={{ fontSize:13, color:'#94A3B8' }}>어드민 계정으로 로그인해주세요.</div>
        <a href="/" style={{ marginTop:8, fontSize:13, color:'#1A1A1A', textDecoration:'underline' }}>홈으로 돌아가기</a>
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

    const [ordersRes, membersRes] = await Promise.all([
      supabase.from('orders').select('final_amount, created_at').gte('created_at', monthStart),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
    ]);

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

  async function loadOrders() {
    setOrdersLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('orders')
      .select('*,order_items(product_name,quantity,unit_price,subtotal,thumbnail_url,products(farm_id,farms(name,carrier)))')
      .order('created_at', { ascending: false })
      .limit(100);
    // farm_id, farm_name 평탄화
    const orders = (data || []).map((o: Record<string, unknown>) => ({
      ...o,
      order_items: ((o.order_items as Record<string, unknown>[]) || []).map((item: Record<string, unknown>) => {
        const prod = item.products as Record<string, unknown> | null;
        const farm = prod?.farms as Record<string, unknown> | null;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { products: _p, ...rest } = item;
        return { ...rest, farm_id: prod?.farm_id ?? null, farm_name: farm?.name ?? null };
      }),
    }));
    setOrders(orders as Order[]);
    setOrdersLoading(false);
  }

  async function loadProducts() {
    setProductsLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('products')
      .select('id, name, category, price, discount_rate, discounted_price, is_active, farm_id, sort_order, created_at')
      .order('sort_order')
      .limit(200);
    setProducts((data as AdminProduct[]) || []);
    setProductsLoading(false);
  }

  async function loadFarms() {
    setFarmsLoading(true);
    const supabase = createClient();
    const [{ data: farmData }, { data: wishData }] = await Promise.all([
      supabase.from('farms').select('id, slug, name, farmer_name, region, farm_type, intro, carrier, created_at').order('name'),
      supabase.from('wishlist').select('product_id, products!inner(farm_id)').limit(5000),
    ]);
    // 농가별 찜 수 집계
    const wishMap: Record<string, Set<string>> = {};
    (wishData || []).forEach((w: Record<string, unknown>) => {
      const farmId = (w.products as Record<string, unknown>)?.farm_id as string;
      if (farmId) {
        if (!wishMap[farmId]) wishMap[farmId] = new Set();
        wishMap[farmId].add(w.product_id as string);
      }
    });
    const farms = (farmData || []).map((f: Record<string, unknown>) => ({
      ...f, wish_count: wishMap[f.id as string]?.size || 0,
    }));
    setFarms(farms as AdminFarm[]);
    setFarmsLoading(false);
  }

  function openFarmModal(farm?: AdminFarm) {
    if (farm) {
      setEditingFarm(farm);
      setFarmForm({ name: farm.name, farmer_name: farm.farmer_name || '', region: farm.region || '', farm_type: farm.farm_type || 'fruit', intro: farm.intro || '', carrier: farm.carrier || '' });
    } else {
      setEditingFarm(null);
      setFarmForm({ name: '', farmer_name: '', region: '', farm_type: 'fruit', intro: '', carrier: '' });
    }
    setFarmModal(true);
  }

  async function saveFarm() {
    if (!farmForm.name.trim()) { alert('농가명을 입력해주세요.'); return; }
    setFarmSaving(true);
    const supabase = createClient();
    const slug = farmForm.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9가-힣-]/g, '');
    const payload = { name: farmForm.name.trim(), farmer_name: farmForm.farmer_name || null, region: farmForm.region || null, farm_type: farmForm.farm_type || null, intro: farmForm.intro || null, carrier: farmForm.carrier || null };
    if (editingFarm) {
      const { error } = await supabase.from('farms').update(payload).eq('id', editingFarm.id);
      if (!error) setFarms(prev => prev.map(f => f.id === editingFarm.id ? { ...f, ...payload } : f));
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
            origin: data.origin || '', price: data.price, discount_rate: data.discount_rate,
            short_desc: data.short_desc || '', thumbnail_url: thumb, image_urls: imageUrls,
            dispatch_cutoff: data.dispatch_cutoff || '',
            brix: data.brix, badge: data.badge || '', is_new: data.is_new,
            is_best: data.is_best, is_dawn: data.is_dawn, is_active: data.is_active,
            farm_id: data.farm_id, sort_order: data.sort_order || 0,
          });
          setProductModal(true);
        }
      });
    } else {
      setEditingProduct(null);
      uploadedThumbnailRef.current = '';          // 새 등록 시 ref 초기화
      setPForm({ ...PRODUCT_EMPTY });
      setProductModal(true);
    }
  }

  async function saveProduct() {
    if (!pForm.name.trim()) { alert('상품명을 입력하세요.'); return; }
    if (!pForm.price || pForm.price <= 0) { alert('정상가를 입력하세요.'); return; }
    // pForm 상태 + ref 양쪽 모두 확인 (스테일 클로저 방어)
    const thumbnailUrl = pForm.thumbnail_url?.trim() || uploadedThumbnailRef.current || null;
    console.log('[저장] pForm.thumbnail_url:', pForm.thumbnail_url);
    console.log('[저장] uploadedThumbnailRef:', uploadedThumbnailRef.current);
    console.log('[저장] 최종 thumbnail_url:', thumbnailUrl);
    setPSaving(true);
    const supabase = createClient();
    const price          = Number(pForm.price);
    const discount_rate  = Number(pForm.discount_rate) || 0;
    const payload = {
      sku:            pForm.sku?.trim()           || null,
      name:           pForm.name.trim(),
      category:       pForm.category,
      origin:         pForm.origin?.trim()        || null,
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
      is_new:         Boolean(pForm.is_new),
      is_best:        Boolean(pForm.is_best),
      is_dawn:        Boolean(pForm.is_dawn),
      is_active:      Boolean(pForm.is_active),
      farm_id:        pForm.farm_id               || null,
      sort_order:     Number(pForm.sort_order)    || 0,
    };
    const { error } = editingProduct
      ? await supabase.from('products').update(payload).eq('id', editingProduct.id)
      : await supabase.from('products').insert(payload);
    if (error) {
      console.error('상품 저장 오류:', error);
      alert(`저장 실패: ${error.message}`);
      setPSaving(false);
      return;
    }
    setPSaving(false);
    setProductModal(false);
    loadProducts();
  }

  async function toggleProductActive(p: AdminProduct) {
    const supabase = createClient();
    await supabase.from('products').update({ is_active: !p.is_active }).eq('id', p.id);
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, is_active: !x.is_active } : x));
  }

  async function loadMembers() {
    setMembersLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('profiles')
      .select('id, email, name, grade, point_balance, created_at, phone, is_blocked, memo')
      .order('created_at', { ascending: false })
      .limit(300);
    setMembers((data as AdminProfile[]) || []);
    setMembersLoading(false);
  }

  async function openMemberDetail(m: AdminProfile) {
    setSelectedMember(m);
    setMemberMemo(m.memo || '');
    setMemberOrdersLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('orders')
      .select('id, order_no, status, final_amount, created_at')
      .eq('user_id', m.id)
      .order('created_at', { ascending: false })
      .limit(10);
    setMemberOrders((data as Order[]) || []);
    setMemberOrdersLoading(false);
  }

  async function changeMemberGrade(memberId: string, grade: string) {
    const supabase = createClient();
    const { error } = await supabase.from('profiles').update({ grade }).eq('id', memberId);
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

  async function saveMemberMemo(memberId: string) {
    setMemberMemoSaving(true);
    const supabase = createClient();
    await supabase.from('profiles').update({ memo: memberMemo || null }).eq('id', memberId);
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, memo: memberMemo || null } : m));
    setSelectedMember(prev => prev?.id === memberId ? { ...prev, memo: memberMemo || null } : prev);
    setMemberMemoSaving(false);
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
    setSurveyLoading(false);
  }

  async function loadReferrals() {
    setReferralsLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('referrals')
      .select(`
        id, referrer_id, referred_id, code, status, rewarded_at, created_at,
        referrer:profiles!referrals_referrer_id_fkey(name, email),
        referred:profiles!referrals_referred_id_fkey(name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(200);
    setReferrals((data as unknown as AdminReferral[]) || []);
    setReferralsLoading(false);
  }

  async function revokeReferralReward(r: AdminReferral) {
    if (!confirm(`${r.referrer?.name || '추천인'}의 리워드를 철회하시겠습니까?\n추천인·피추천인 각 1,000P가 차감됩니다.`)) return;
    const supabase = createClient();
    const REWARD = 1000;
    await Promise.all([
      supabase.rpc('add_points', { p_user_id: r.referrer_id, p_amount: -REWARD, p_desc: '친구 추천 리워드 철회' }),
      supabase.rpc('add_points', { p_user_id: r.referred_id,  p_amount: -REWARD, p_desc: '친구 추천 가입 혜택 철회' }),
      supabase.from('referrals').update({ status: 'pending', rewarded_at: null }).eq('id', r.id),
    ]);
    setReferrals(prev => prev.map(x => x.id === r.id ? { ...x, status: 'pending', rewarded_at: null } : x));
  }

  async function loadReviews() {
    setReviewsLoading(true);
    const supabase = createClient();
    const [{ data }, { data: reportCounts }] = await Promise.all([
      supabase.from('reviews')
        .select('id, product_id, rating, content, is_best, likes_count, image_urls, created_at, profiles(name, email), products(name)')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('review_reports')
        .select('review_id')
        .limit(1000),
    ]);
    const countMap: Record<string, number> = {};
    (reportCounts || []).forEach((r: { review_id: string }) => {
      countMap[r.review_id] = (countMap[r.review_id] || 0) + 1;
    });
    const reviews = (data || []).map((r: Record<string, unknown>) => ({
      ...r, report_count: countMap[r.id as string] || 0,
    }));
    setReviews(reviews as unknown as AdminReview[]);
    setReviewsLoading(false);
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
    } else {
      setEditingPopup(null);
      setPpForm({ ...POPUP_EMPTY });
      setPpImgUrl('');
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
      link_url:  ppForm.link_url.trim() || '/',
      width:     Number(ppForm.width) || 400,
      position:  ppForm.position,
      is_active: ppForm.is_active,
      starts_at: ppForm.starts_at ? new Date(ppForm.starts_at).toISOString() : null,
      ends_at:   ppForm.ends_at   ? new Date(ppForm.ends_at).toISOString()   : null,
    };
    const { error } = editingPopup
      ? await supabase.from('popups').update(payload).eq('id', editingPopup.id)
      : await supabase.from('popups').insert(payload);
    if (error) { alert('저장 실패: ' + error.message); setPpSaving(false); return; }
    setPpSaving(false);
    setPopupModal(false);
    loadPopups();
  }

  async function deletePopup(id: string) {
    if (!confirm('이 팝업을 삭제하시겠습니까?')) return;
    const supabase = createClient();
    await supabase.from('popups').delete().eq('id', id);
    setPopups(prev => prev.filter(p => p.id !== id));
  }

  async function togglePopupActive(p: AdminPopup) {
    const supabase = createClient();
    await supabase.from('popups').update({ is_active: !p.is_active }).eq('id', p.id);
    setPopups(prev => prev.map(x => x.id === p.id ? { ...x, is_active: !p.is_active } : x));
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
    } else {
      setEditingBanner(null);
      setBnForm({ ...BANNER_EMPTY });
      setBnImgUrl('');
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
      is_active: bnForm.is_active,
      sort_order: editingBanner?.sort_order ?? banners.filter(b => b.type === bnForm.type).length,
    };
    const { error } = editingBanner
      ? await supabase.from('banners').update(payload).eq('id', editingBanner.id)
      : await supabase.from('banners').insert(payload);
    if (error) { alert('저장 실패: ' + error.message); setBnSaving(false); return; }
    setBnSaving(false);
    setBannerModal(false);
    loadBanners();
  }

  async function deleteBanner(id: string) {
    if (!confirm('이 배너를 삭제하시겠습니까?')) return;
    const supabase = createClient();
    await supabase.from('banners').delete().eq('id', id);
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
    const upsertRows = Object.entries(siteSettings).map(([key, value]) => ({ key, value }));
    const { error } = await supabase.from('site_settings').upsert(upsertRows, { onConflict: 'key' });
    setSettingsSaving(false);
    if (error) alert('저장 실패: ' + error.message);
    else alert('저장되었습니다!');
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
  async function loadSettlement(month: string) {
    setSettlementLoading(true);
    const supabase = createClient();
    const [year, mon] = month.split('-').map(Number);
    const from = new Date(year, mon - 1, 1).toISOString();
    const to   = new Date(year, mon,     1).toISOString();

    const { data } = await supabase
      .from('orders')
      .select('status, final_amount, payment_method, created_at')
      .gte('created_at', from)
      .lt('created_at', to)
      .limit(2000);

    if (!data) { setSettlementLoading(false); return; }

    const confirmed = data.filter(o => o.status === 'delivered')
      .reduce((s, o) => s + (o.final_amount || 0), 0);
    const pending = data.filter(o => ['paid','preparing','shipped'].includes(o.status))
      .reduce((s, o) => s + (o.final_amount || 0), 0);
    const cancelled = data.filter(o => ['cancelled','refunded','refunding'].includes(o.status))
      .reduce((s, o) => s + (o.final_amount || 0), 0);
    const total = data.reduce((s, o) => s + (o.final_amount || 0), 0);

    const statusMap: Record<string, { count: number; amount: number }> = {};
    data.forEach(o => {
      if (!statusMap[o.status]) statusMap[o.status] = { count: 0, amount: 0 };
      statusMap[o.status].count++;
      statusMap[o.status].amount += o.final_amount || 0;
    });
    const byStatus = Object.entries(statusMap)
      .map(([status, v]) => ({ status, ...v }))
      .sort((a, b) => b.amount - a.amount);

    const methodMap: Record<string, { count: number; amount: number }> = {};
    data.forEach(o => {
      const m = o.payment_method || '기타';
      if (!methodMap[m]) methodMap[m] = { count: 0, amount: 0 };
      methodMap[m].count++;
      methodMap[m].amount += o.final_amount || 0;
    });
    const byMethod = Object.entries(methodMap)
      .map(([method, v]) => ({ method, ...v }))
      .sort((a, b) => b.amount - a.amount);

    const daysInMonth = new Date(year, mon, 0).getDate();
    const dailyMap: Record<number, number> = {};
    for (let d = 1; d <= daysInMonth; d++) dailyMap[d] = 0;
    data.forEach(o => {
      const d = new Date(o.created_at).getDate();
      if (dailyMap[d] !== undefined) dailyMap[d] += o.final_amount || 0;
    });
    const daily = Object.entries(dailyMap).map(([date, amount]) => ({ date, amount }));

    setSettlementData({ confirmed, pending, cancelled, total, orderCount: data.length, byStatus, byMethod, daily });
    setSettlementLoading(false);
  }

  /* ========== 주문 상태 변경 ========== */
  async function updateOrderStatus(orderId: string, newStatus: string) {
    setUpdatingStatus(orderId);
    const supabase = createClient();
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);
    if (!error) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      if (selectedOrder?.id === orderId) setSelectedOrder(s => s ? { ...s, status: newStatus } : s);

      /* ── 첫 구매 완료 시 추천 리워드 지급 ── */
      if (newStatus === 'delivered') {
        const order = orders.find(o => o.id === orderId);
        if (order?.user_id) {
          const userId = order.user_id;
          /* 이 사용자가 피추천인인 referral(pending) 조회 */
          const { data: ref } = await supabase
            .from('referrals')
            .select('id, referrer_id')
            .eq('referred_id', userId)
            .eq('status', 'pending')
            .maybeSingle();

          if (ref) {
            /* 이미 delivered 주문이 이번 것 말고 있는지 확인 (첫 구매 여부) */
            const { count } = await supabase
              .from('orders')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', userId)
              .eq('status', 'delivered')
              .neq('id', orderId);

            if ((count ?? 0) === 0) {
              /* 첫 구매 확인 → 포인트 지급 (추천인 + 피추천인 각 1,000P) */
              const REWARD = 1000;
              await Promise.all([
                /* 추천인 포인트 */
                supabase.rpc('add_points', { p_user_id: ref.referrer_id, p_amount: REWARD, p_desc: '친구 추천 리워드' }),
                /* 피추천인 포인트 */
                supabase.rpc('add_points', { p_user_id: userId, p_amount: REWARD, p_desc: '친구 추천 가입 혜택' }),
                /* referral 상태 업데이트 */
                supabase.from('referrals').update({ status: 'rewarded', rewarded_at: new Date().toISOString() }).eq('id', ref.id),
              ]);
              /* 어드민 테이블 새로고침 */
              if (panel === 'referral') loadReferrals();
            }
          }
        }

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

      // 운송장번호가 새로 입력된 경우 배송 시작 SMS 발송
      if (trackingInput.tracking_number && selectedOrder.phone) {
        fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'shipping_started',
            phone: selectedOrder.phone,
            recipient: selectedOrder.recipient,
            courierName: COURIER_NAMES[trackingInput.courier] || trackingInput.courier || '택배사',
            trackingNumber: trackingInput.tracking_number,
          }),
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
    await supabase.from('reviews').delete().eq('id', id);
    setReviews(prev => prev.filter(r => r.id !== id));
  }

  /* ========== 라운지 CRUD ========== */
  function openLoungeModal(post?: AdminLoungePost) {
    if (post) {
      setEditingLounge(post);
      setLoungeForm({ filter: post.filter, title: post.title, badge: post.badge || '', date: post.date || '', thumbnail_url: post.thumbnail_url || '', image_url: post.image_url || '', content: post.content || '', is_active: post.is_active, sort_order: post.sort_order });
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
  async function updateInquiryStatus(id: string, status: 'answered' | 'rejected') {
    const supabase = createClient();
    await supabase.from('farm_inquiries').update({ status }).eq('id', id);
    setInquiries(prev => prev.map(i => i.id === id ? { ...i, status } : i));
    setSelectedInquiry(prev => prev?.id === id ? { ...prev, status } : prev);
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
    const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    setCoupons((data || []) as AdminCoupon[]);
    setCouponsLoading(false);
  }

  function openCouponModal(c?: AdminCoupon) {
    if (c) {
      setEditingCoupon(c);
      setCouponForm({ code: c.code || '', name: c.name, discount_type: c.discount_type, discount_value: c.discount_value, min_order_amount: c.min_order_amount, max_discount_amount: c.max_discount_amount?.toString() || '', starts_at: c.starts_at.slice(0,16), expires_at: c.expires_at ? c.expires_at.slice(0,16) : '', is_active: c.is_active });
    } else {
      setEditingCoupon(null);
      setCouponForm({ code: '', name: '', discount_type: 'percent', discount_value: 10, min_order_amount: 0, max_discount_amount: '', starts_at: new Date().toISOString().slice(0,16), expires_at: '', is_active: true });
    }
    setCouponModal(true);
  }

  async function saveCoupon() {
    if (!couponForm.name.trim()) { alert('쿠폰명을 입력해주세요.'); return; }
    setCouponSaving(true);
    const supabase = createClient();
    const payload = {
      code: couponForm.code.trim() || null,
      name: couponForm.name.trim(),
      discount_type: couponForm.discount_type,
      discount_value: Number(couponForm.discount_value),
      min_order_amount: Number(couponForm.min_order_amount) || 0,
      max_discount_amount: couponForm.max_discount_amount ? Number(couponForm.max_discount_amount) : null,
      starts_at: couponForm.starts_at || new Date().toISOString(),
      expires_at: couponForm.expires_at || null,
      is_active: couponForm.is_active,
    };
    if (editingCoupon) {
      const { error } = await supabase.from('coupons').update(payload).eq('id', editingCoupon.id);
      if (!error) setCoupons(prev => prev.map(c => c.id === editingCoupon.id ? { ...c, ...payload } as AdminCoupon : c));
      else { alert('수정 실패: ' + error.message); setCouponSaving(false); return; }
    } else {
      const { data, error } = await supabase.from('coupons').insert(payload).select().single();
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
        badge: ev.badge || '',
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
    if (!evForm.starts_at)    { alert('시작일을 입력하세요.'); return; }
    if (!evForm.ends_at)      { alert('종료일을 입력하세요.'); return; }
    // 새 등록 시 슬러그 없으면 자동 생성
    if (!evForm.slug.trim()) setEvForm(f => ({ ...f, slug: makeSlug(f.title) }));
    setEvSaving(true);
    const supabase = createClient();
    const payload = {
      slug:          evForm.slug.trim(),
      title:         evForm.title.trim(),
      subtitle:      evForm.subtitle.trim()     || null,
      badge:         evForm.badge.trim()        || null,
      thumbnail_url: evForm.thumbnail_url.trim() || null,
      image_url:     evForm.image_url.trim()     || null,
      content:       evForm.content.trim()       || null,
      starts_at:     new Date(evForm.starts_at).toISOString(),
      ends_at:       new Date(evForm.ends_at).toISOString(),
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
  function go(p: PanelKey) {
    setPanel(p);
    if (window.innerWidth <= 900) setSidebarOpen(false);
    if (loadedPanels.current.has(p)) return;
    loadedPanels.current.add(p);
    switch (p) {
      case 'orders':    loadOrders(); loadFarms(); break;
      case 'products':  loadProducts(); break;
      case 'farms':     loadFarms(); break;
      case 'members':   loadMembers(); break;
      case 'banner':    loadBanners(); loadPopups(); break;
      case 'reviews':   loadReviews(); break;
      case 'coupon':    loadCoupons(); loadPointData(); break;
      case 'events':    loadEvents(); break;
      case 'lounge':    loadLounge(); break;
      case 'referral':     loadReferrals(); break;
      case 'tasteprofile': loadSurveyResults(); break;
      case 'inquiry':   loadInquiries(); break;
      case 'productinquiry': loadProductInquiries(); break;
      case 'faq':       loadFaq(); break;
      case 'cs':        loadCsInquiries(); break;
      case 'settings':    loadSettings(); loadSearchStats(7); break;
      case 'settlement':  loadSettlement(settlementMonth); break;
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
  const filteredOrders = orders.filter(o => {
    const matchStatus = !orderStatusFilter || o.status === orderStatusFilter;
    const matchFarm   = !orderFarmFilter || (o.order_items || []).some(i => i.farm_id === orderFarmFilter);
    const q = orderSearch.toLowerCase();
    const matchSearch = !q || o.order_no.toLowerCase().includes(q) ||
      o.recipient.toLowerCase().includes(q) || o.phone.includes(q);
    return matchStatus && matchFarm && matchSearch;
  });

  /* 엑셀 다운로드 (농가별 발주서) */
  async function downloadOrderExcel(farmId?: string) {
    const xlsxMod = await import('xlsx');
    const XLSX = xlsxMod.default ?? xlsxMod;
    const targetOrders = farmId
      ? orders.filter(o => (o.order_items||[]).some(i => i.farm_id === farmId))
      : filteredOrders;
    const farm = farms.find(f => f.id === farmId);
    const carrier = farm?.carrier || '기타';

    const rows = targetOrders.flatMap(o =>
      (o.order_items || [])
        .filter(i => !farmId || i.farm_id === farmId)
        .map(i => ({
          '주문번호':    o.order_no,
          '수령인':      o.recipient,
          '전화번호':    o.phone,
          '우편번호':    o.zipcode || '',
          '주소':        o.address1 + (o.address2 ? ' ' + o.address2 : ''),
          '배송메모':    '',
          '상품명':      i.product_name,
          '수량':        i.quantity,
          '단가':        i.unit_price,
          '소계':        i.subtotal,
          '택배사':      carrier,
          '운송장번호':  o.tracking_number || '',
          '주문일':      o.created_at.slice(0, 10),
        }))
    );

    if (rows.length === 0) { alert('다운로드할 주문이 없습니다.'); return; }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '발주서');
    const fileName = farm
      ? `발주서_${farm.name}_${new Date().toISOString().slice(0,10)}.xlsx`
      : `발주서_전체_${new Date().toISOString().slice(0,10)}.xlsx`;

    // 브라우저 다운로드
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([buf], { type: 'application/octet-stream' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
  }

  /* 필터된 상품 목록 */
  const filteredProducts = products.filter(p => {
    const matchCat = !productCatFilter || p.category === productCatFilter;
    const q = productSearch.toLowerCase();
    const matchSearch = !q || p.name.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

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
    const q = memberSearch.toLowerCase();
    const matchSearch  = !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || (m.phone || '').includes(q);
    return matchGrade && matchBlock && matchSearch;
  });

  /* 필터된 라운지 */
  const filteredLounge = loungeFilter
    ? loungePosts.filter(p => p.filter === loungeFilter)
    : loungePosts;

  /* 문의 탭별 필터 */
  const pendingInquiries = inquiries.filter(i => i.status === 'pending' || i.status === 'new' || !i.status);
  const doneInquiries = inquiries.filter(i => i.status === 'answered' || i.status === 'done');

  /* FAQ 필터 */
  const filteredFaq = faqItems.filter(f => {
    if (faqCatFilter && f.category !== faqCatFilter) return false;
    if (faqSearch.trim() && !f.question.includes(faqSearch.trim()) && !f.answer.includes(faqSearch.trim())) return false;
    return true;
  });

  /* 1:1 문의 탭별 필터 */
  const csPending  = csItems.filter(c => c.status === 'pending');
  const csAnswered = csItems.filter(c => c.status === 'answered');
  const csTabList  = csAdminTab === 'tab-pending' ? csPending : csAdminTab === 'tab-answered' ? csAnswered : csItems;

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
        <div className="adm-modal-bg open" onClick={() => setProductModal(false)}>
          <div className="adm-modal" style={{ maxWidth:640, width:'95vw', maxHeight:'90vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
            <div className="adm-modal-head">
              <span className="adm-modal-title">{editingProduct ? '상품 수정' : '상품 등록'}</span>
              <button className="adm-modal-close" onClick={() => setProductModal(false)}>✕</button>
            </div>
            <div className="adm-modal-body" style={{ display:'flex', flexDirection:'column', gap:14 }}>

              {/* 기본 정보 */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div style={{ gridColumn:'1 / -1' }}>
                  <label className="adm-label">상품명 *</label>
                  <input className="adm-input-text" style={{ width:'100%' }} value={pForm.name}
                    onChange={e => setPForm(f => ({ ...f, name: e.target.value }))} placeholder="상품명 입력" />
                </div>
                <div>
                  <label className="adm-label">SKU</label>
                  <input className="adm-input-text" style={{ width:'100%' }} value={pForm.sku}
                    onChange={e => setPForm(f => ({ ...f, sku: e.target.value }))} placeholder="상품 코드" />
                </div>
                <div>
                  <label className="adm-label">카테고리 *</label>
                  <select className="adm-select" style={{ width:'100%' }} value={pForm.category}
                    onChange={e => setPForm(f => ({ ...f, category: e.target.value }))}>
                    {Object.entries(CAT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="adm-label">원산지</label>
                  <input className="adm-input-text" style={{ width:'100%' }} value={pForm.origin}
                    onChange={e => setPForm(f => ({ ...f, origin: e.target.value }))} placeholder="예: 경북 의성" />
                </div>
                <div>
                  <label className="adm-label">정상가 (원) *</label>
                  <input className="adm-input-text" style={{ width:'100%' }} type="number" value={pForm.price || ''}
                    onChange={e => setPForm(f => ({ ...f, price: Number(e.target.value) }))} placeholder="0" />
                </div>
                <div>
                  <label className="adm-label">할인율 (%)</label>
                  <input className="adm-input-text" style={{ width:'100%' }} type="number" min="0" max="99" value={pForm.discount_rate || ''}
                    onChange={e => setPForm(f => ({ ...f, discount_rate: Number(e.target.value) }))} placeholder="0" />
                </div>
              </div>

              {/* 판매가 미리보기 */}
              {pForm.price > 0 && (
                <div style={{ background:'#F8FAFC', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#475569' }}>
                  판매가: <strong style={{ color:'#1A1A1A', fontSize:15 }}>
                    {Math.round(pForm.price * (1 - pForm.discount_rate / 100)).toLocaleString()}원
                  </strong>
                  {pForm.discount_rate > 0 && <span style={{ color:'#CB1D11', marginLeft:8 }}>({pForm.discount_rate}% 할인)</span>}
                </div>
              )}

              {/* 상세 정보 */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div style={{ gridColumn:'1 / -1' }}>
                  <label className="adm-label">한 줄 설명</label>
                  <input className="adm-input-text" style={{ width:'100%' }} value={pForm.short_desc || ''}
                    onChange={e => setPForm(f => ({ ...f, short_desc: e.target.value }))} placeholder="상품 카드에 표시되는 짧은 설명" />
                </div>
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
                        {/* 대표 뱃지 */}
                        {i === 0 && (
                          <div style={{ position:'absolute', bottom:0, left:0, right:0,
                            background:'rgba(0,0,0,0.45)', fontSize:9, color:'#fff',
                            textAlign:'center', padding:'2px 0', letterSpacing:'0.04em' }}>
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
                      </div>
                    ))}
                  </div>
                  {pImgUploading && <p style={{ fontSize:12, color:'#64748B', marginTop:6 }}>업로드 중...</p>}
                </div>
                <div>
                  <label className="adm-label">당도 (Brix)</label>
                  <input className="adm-input-text" style={{ width:'100%' }} type="number" step="0.1" value={pForm.brix ?? ''}
                    onChange={e => setPForm(f => ({ ...f, brix: e.target.value ? Number(e.target.value) : null }))} placeholder="예: 13.5" />
                </div>
                <div>
                  <label className="adm-label">출발 마감 시간</label>
                  <input className="adm-input-text" style={{ width:'100%' }} value={pForm.dispatch_cutoff || ''}
                    onChange={e => setPForm(f => ({ ...f, dispatch_cutoff: e.target.value }))}
                    placeholder="예: 14:00 (비우면 전체 설정 적용)" />
                </div>
                <div>
                  <label className="adm-label">뱃지</label>
                  <input className="adm-input-text" style={{ width:'100%' }} value={pForm.badge || ''}
                    onChange={e => setPForm(f => ({ ...f, badge: e.target.value }))} placeholder="예: 한정수량" />
                </div>
                <div>
                  <label className="adm-label">연결 농가</label>
                  <select className="adm-select" style={{ width:'100%' }} value={pForm.farm_id || ''}
                    onChange={e => setPForm(f => ({ ...f, farm_id: e.target.value || null }))}>
                    <option value="">농가 없음</option>
                    {farmList.map(fm => <option key={fm.id} value={fm.id}>{fm.name}</option>)}
                  </select>
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
                  ['is_dawn', '산지직송'],
                  ['is_active', '판매중'],
                ] as const).map(([key, label]) => (
                  <label key={key} style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:14 }}>
                    <input type="checkbox" checked={!!pForm[key]}
                      onChange={e => setPForm(f => ({ ...f, [key]: e.target.checked }))} />
                    {label}
                  </label>
                ))}
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
                  <label className="adm-label">배지 텍스트</label>
                  <input className="adm-input-text" style={{ width:'100%' }} value={evForm.badge}
                    onChange={e => setEvForm(f => ({ ...f, badge: e.target.value }))} placeholder="예: HOT, NEW, 한정" />
                </div>
              </div>

              {/* 썸네일 이미지 */}
              <div>
                <label className="adm-label">썸네일 이미지 <span style={{ fontWeight:400, color:'#94A3B8' }}>(이벤트 카드에 표시)</span></label>
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
                  <label className="adm-label">시작일시 *</label>
                  <input className="adm-input-text" style={{ width:'100%' }} type="datetime-local" value={evForm.starts_at}
                    onChange={e => setEvForm(f => ({ ...f, starts_at: e.target.value }))} />
                </div>
                <div>
                  <label className="adm-label">종료일시 *</label>
                  <input className="adm-input-text" style={{ width:'100%' }} type="datetime-local" value={evForm.ends_at}
                    onChange={e => setEvForm(f => ({ ...f, ends_at: e.target.value }))} />
                </div>
              </div>

              <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:14 }}>
                <input type="checkbox" checked={evForm.is_active}
                  onChange={e => setEvForm(f => ({ ...f, is_active: e.target.checked }))} />
                즉시 활성화
              </label>

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
                  <select className="adm-select" style={{ width:'100%' }} value={faqForm.category}
                    onChange={e => setFaqForm(f => ({ ...f, category: e.target.value }))}>
                    {Object.entries(FAQ_CATS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
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
                  <label className="adm-label">농가 유형</label>
                  <input type="text" className="adm-input-text adm-input-full" placeholder="예: 감귤, 포도, 베리"
                    value={farmForm.farm_type} onChange={e => setFarmForm(p => ({ ...p, farm_type: e.target.value }))} />
                </div>
                <div className="adm-form-row">
                  <label className="adm-label">담당 택배사</label>
                  <select className="adm-select adm-select-full" value={farmForm.carrier}
                    onChange={e => setFarmForm(p => ({ ...p, carrier: e.target.value }))}>
                    <option value="">택배사 선택</option>
                    <option value="CJ대한통운">CJ대한통운</option>
                    <option value="롯데택배">롯데택배</option>
                    <option value="한진택배">한진택배</option>
                    <option value="우체국택배">우체국택배</option>
                    <option value="로젠택배">로젠택배</option>
                  </select>
                </div>
                <div className="adm-form-row adm-form-row-full">
                  <label className="adm-label">농가 소개</label>
                  <textarea className="adm-textarea" rows={2} placeholder="농가 소개 (선택)"
                    value={farmForm.intro} onChange={e => setFarmForm(p => ({ ...p, intro: e.target.value }))} />
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
                  <select
                    value={trackingInput.courier}
                    onChange={e => setTrackingInput(p => ({ ...p, courier: e.target.value }))}
                    style={{ height:36, padding:'0 10px', border:'1.5px solid #E2E8F0', borderRadius:6,
                      fontSize:13, background:'#fff', fontFamily:'inherit', minWidth:140 }}>
                    <option value="">택배사 선택</option>
                    {[
                      ['kr.cjlogistics',  'CJ대한통운'],
                      ['kr.lotte',        '롯데택배'],
                      ['kr.hanjin',       '한진택배'],
                      ['kr.epost',        '우체국택배'],
                      ['kr.logen',        '로젠택배'],
                      ['kr.lotteglogis',  '롯데글로벌로지스'],
                      ['kr.coupang',      '쿠팡로켓배송'],
                      ['kr.cupost',       'CU편의점택배'],
                    ].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
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
                    onClick={() => updateOrderStatus(selectedOrder.id, 'cancelled')}
                  >취소/환불</button>
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
              <NavItem panel="farms"    icon={<Icon.Farms />}    label="농가 관리" />
              <NavItem panel="reviews"  icon={<Icon.Reviews />}  label="리뷰 관리" />
            </div>
            <div className="adm-nav-group">
              <div className="adm-nav-label">마케팅</div>
              <NavItem panel="coupon" icon={<Icon.Coupon />} label="쿠폰 / 포인트" />
              <NavItem panel="banner" icon={<Icon.Banner />} label="배너 / 팝업" />
              <NavItem panel="events" icon={<Icon.Events />} label="이벤트" />
              <NavItem panel="lounge" icon={<Icon.Lounge />} label="라운지 관리" />
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
            </div>
            <div className="adm-nav-group">
              <div className="adm-nav-label">정산·설정</div>
              <NavItem panel="settlement"   icon={<Icon.Settlement />} label="정산 관리" />
              <NavItem panel="tasteprofile" icon={<Icon.Taste />}      label="취향 프로파일" />
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
              <button className="adm-icon-btn"><Icon.Bell /><span className="adm-notif-dot" /></button>
            </div>
          </header>

          {/* ===== 대시보드 ===== */}
          {panel === 'dashboard' && (
            <div className="adm-content">
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
              <div className="adm-toolbar">
                <div className="adm-toolbar-left">
                  <select className="adm-select" value={orderStatusFilter} onChange={e => setOrderStatusFilter(e.target.value)}>
                    <option value="">전체 상태</option>
                    {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <select className="adm-select" value={orderFarmFilter} onChange={e => setOrderFarmFilter(e.target.value)}>
                    <option value="">전체 농가</option>
                    {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                  <input type="text" className="adm-input-text" placeholder="주문번호 · 수령인 · 연락처 검색"
                    value={orderSearch} onChange={e => setOrderSearch(e.target.value)} />
                </div>
                <div className="adm-toolbar-right">
                  <button className="adm-btn adm-btn-outline" onClick={() => downloadOrderExcel(orderFarmFilter || undefined)}>
                    <span className="adm-btn-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </span>
                    {orderFarmFilter ? `${farms.find(f=>f.id===orderFarmFilter)?.name || ''} 발주서` : '발주서 다운로드'}
                  </button>
                  <button className="adm-btn adm-btn-outline" onClick={loadOrders}><span className="adm-btn-icon"><Icon.Refresh /></span>새로고침</button>
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
                        ) : filteredOrders.map(o => (
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
              <div className="adm-info-box adm-info-mt10">
                📦 <strong>상태 변경:</strong> 상세 버튼 클릭 → 상태 버튼으로 변경. 변경 사항은 Supabase에 즉시 저장됩니다.
              </div>
            </div>
          )}

          {/* ===== 상품 관리 ===== */}
          {panel === 'products' && (
            <div className="adm-content">
              <div className="adm-toolbar">
                <div className="adm-toolbar-left">
                  <select className="adm-select" value={productCatFilter} onChange={e => setProductCatFilter(e.target.value)}>
                    <option value="">전체 카테고리</option>
                    {Object.entries(CAT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
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
                            <td>{CAT_LABEL[p.category] || p.category}</td>
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

          {/* ===== 농가 관리 ===== */}
          {panel === 'farms' && (
            <div className="adm-content">
              <div className="adm-toolbar">
                <div className="adm-toolbar-left" />
                <div className="adm-toolbar-right">
                  <button className="adm-btn adm-btn-outline" onClick={loadFarms}><span className="adm-btn-icon"><Icon.Refresh /></span>새로고침</button>
                  <button className="adm-btn adm-btn-primary" onClick={() => openFarmModal()}>+ 농가 등록</button>
                </div>
              </div>
              <div className="adm-card">
                {farmsLoading ? <PanelLoading /> : (
                  <div className="adm-table-wrap">
                    <table className="adm-table">
                      <thead><tr><th>농가명</th><th>대표자</th><th>지역</th><th>농가 유형</th><th>담당 택배사</th><th>❤️찜</th><th>등록일</th><th>관리</th></tr></thead>
                      <tbody>
                        {farms.length === 0 ? (
                          <tr><td colSpan={7} style={{ textAlign:'center', padding:'40px 0', color:'#94A3B8' }}>등록된 농가 없음</td></tr>
                        ) : farms.map(f => (
                          <tr key={f.id}>
                            <td><strong>{f.name}</strong></td>
                            <td>{f.farmer_name || '-'}</td>
                            <td className="adm-muted">{f.region || '-'}</td>
                            <td>{f.farm_type || '-'}</td>
                            <td>{f.carrier ? <span className="adm-badge badge-carrier">{f.carrier}</span> : '-'}</td>
                            <td className="adm-mono">{(f.wish_count || 0).toLocaleString()}</td>
                            <td className="adm-muted">{fmtDateShort(f.created_at)}</td>
                            <td style={{ display:'flex', gap:6 }}>
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
          )}

          {/* ===== 리뷰 관리 ===== */}
          {panel === 'reviews' && (
            <div className="adm-content">
              <div className="adm-toolbar">
                <div className="adm-toolbar-left">
                  <select className="adm-select"><option>별점 전체</option><option>⭐⭐⭐⭐⭐ 5점</option><option>⭐⭐⭐⭐ 4점</option><option>⭐⭐⭐ 3점 이하</option></select>
                  <input type="text" className="adm-input-text" placeholder="내용 검색" />
                </div>
                <div className="adm-toolbar-right">
                  <button className="adm-btn adm-btn-outline" onClick={loadReviews}><span className="adm-btn-icon"><Icon.Refresh /></span>새로고침</button>
                </div>
              </div>
              <div className="adm-card">
                {reviewsLoading ? <PanelLoading /> : (
                  <div className="adm-table-wrap">
                    <table className="adm-table">
                      <thead><tr><th>번호</th><th>별점</th><th>내용</th><th>상품</th><th>베스트</th><th>👍도움</th><th>🚨신고</th><th>작성일</th><th>관리</th></tr></thead>
                      <tbody>
                        {reviews.length === 0 ? (
                          <tr><td colSpan={7} style={{ textAlign:'center', padding:'40px 0', color:'#94A3B8' }}>리뷰 없음</td></tr>
                        ) : reviews.map((r, i) => (
                          <tr key={r.id} style={{ cursor:'pointer' }} onClick={() => setSelectedReview(r)}>
                            <td className="adm-mono" style={{ fontSize:12 }}>R-{String(i+1).padStart(3,'0')}</td>
                            <td><StarRating rating={r.rating} size={13} /></td>
                            <td style={{ maxWidth:240, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.content}</td>
                            <td className="adm-muted" style={{ fontSize:12 }}>{r.products?.name || '-'}</td>
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
            </div>
          )}

          {/* ===== 쿠폰 / 포인트 ===== */}
          {panel === 'coupon' && (
            <div className="adm-content">
              <TabBtns active={couponTab} setActive={setCouponTab}
                tabs={[{id:'tab-coupon',label:'쿠폰 관리'},{id:'tab-point',label:'포인트 관리'}]} />
              {couponTab === 'tab-coupon' ? (
                <>
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
                            ) : coupons.map(c => (
                              <tr key={c.id}>
                                <td>{c.name}</td>
                                <td className="adm-mono" style={{ fontSize:12 }}>{c.code || '-'}</td>
                                <td>{c.discount_type === 'percent' ? '정률' : '정액'}</td>
                                <td><strong>{c.discount_type === 'percent' ? `${c.discount_value}%` : `${fmtPrice(c.discount_value)}원`}</strong></td>
                                <td className="adm-muted" style={{ fontSize:12 }}>{c.expires_at ? c.expires_at.slice(0,10) : '무제한'}</td>
                                <td><Toggle defaultOn={c.is_active} onChange={v => toggleCouponActive(c.id, v)} /></td>
                                <td style={{ display:'flex', gap:6 }}>
                                  <button className="adm-row-btn" onClick={() => openCouponModal(c)}>수정</button>
                                  <button className="adm-row-btn adm-row-btn-danger" onClick={() => deleteCoupon(c.id)}>삭제</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
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
                      <select className="adm-select" value={pointFilter}
                        onChange={e => setPointFilter(e.target.value as 'all'|'has'|'none')}>
                        <option value="all">전체 회원</option>
                        <option value="has">포인트 있는 회원</option>
                        <option value="none">포인트 없는 회원</option>
                      </select>
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
                            ) : filteredPointMembers.map(m => (
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
                </>
              )}
            </div>
          )}

          {/* ===== 배너 관리 ===== */}
          {panel === 'banner' && (
            <div className="adm-content">
              <TabBtns active={bannerTab} setActive={setBannerTab}
                tabs={[
                  { id:'tab-banner', label:'메인 배너' },
                  { id:'tab-mid',    label:'중간 배너' },
                  { id:'tab-popup',  label:'팝업' },
                ]} />

              {/* ── 배너 탭 (메인 / 중간) ── */}
              {(bannerTab === 'tab-banner' || bannerTab === 'tab-mid') && (
                <>
                  <div className="adm-toolbar">
                    <div className="adm-toolbar-left" />
                    <div className="adm-toolbar-right">
                      <button className="adm-btn adm-btn-outline" onClick={loadBanners}><span className="adm-btn-icon"><Icon.Refresh /></span>새로고침</button>
                      <button className="adm-btn adm-btn-primary" onClick={() => {
                        setBnForm({ type: bannerTab === 'tab-banner' ? 'main' : 'mid', link_url: '/', is_active: true });
                        openBannerModal();
                      }}>+ 배너 등록</button>
                    </div>
                  </div>
                  {bannersLoading
                    ? <div className="adm-card" style={{ textAlign:'center', padding:40, color:'#94A3B8' }}>불러오는 중...</div>
                    : (
                      <div className="adm-card">
                        <div className="adm-table-wrap">
                          <table className="adm-table">
                            <thead>
                              <tr><th>순서</th><th>미리보기</th><th>종류</th><th>링크 URL</th><th>활성</th><th>관리</th></tr>
                            </thead>
                            <tbody>
                              {banners
                                .filter(b => bannerTab === 'tab-banner' ? b.type === 'main' : b.type === 'mid')
                                .map(b => {
                                  const badge = b.type === 'main'
                                    ? { label:'메인', bg:'#E8F0FF', color:'#2563EB' }
                                    : { label:'중간', bg:'#FFF3E0', color:'#D97706' };
                                  return (
                                  <tr key={b.id}>
                                    <td style={{ color:'#94A3B8', fontSize:12 }}>{b.sort_order}</td>
                                    <td>
                                      {b.image_url
                                        ? <img src={b.image_url} alt="" style={{ width:80, height:40, objectFit:'cover', borderRadius:6, display:'block' }} />
                                        : <div style={{ width:80, height:40, background:'#F0F0EE', borderRadius:6 }} />
                                      }
                                    </td>
                                    <td><span style={{ fontSize:11, background:badge.bg, color:badge.color, borderRadius:99, padding:'2px 8px', fontWeight:700 }}>{badge.label}</span></td>
                                    <td className="adm-muted" style={{ maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{b.link_url || '/'}</td>
                                    <td>
                                      <button onClick={() => toggleBannerActive(b)} style={{ fontSize:11, padding:'3px 10px', borderRadius:99, border:'none', cursor:'pointer', background: b.is_active?'#DCFCE7':'#F1F5F9', color: b.is_active?'#16A34A':'#64748B', fontWeight:700 }}>
                                        {b.is_active ? '노출중' : '숨김'}
                                      </button>
                                    </td>
                                    <td>
                                      <button className="adm-row-btn" onClick={() => openBannerModal(b)}>수정</button>
                                      {' '}
                                      <button className="adm-row-btn adm-row-btn-danger" onClick={() => deleteBanner(b.id)}>삭제</button>
                                    </td>
                                  </tr>
                                ); })
                              }
                              {banners.filter(b => bannerTab === 'tab-banner' ? b.type === 'main' : b.type === 'mid').length === 0 && (
                                <tr><td colSpan={6} style={{ textAlign:'center', padding:40, color:'#94A3B8' }}>등록된 배너가 없습니다</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  }
                </>
              )}

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
                    : (
                      <div className="adm-card">
                        <div className="adm-table-wrap">
                          <table className="adm-table">
                            <thead>
                              <tr><th>미리보기</th><th>제목</th><th>위치</th><th>기간</th><th>너비</th><th>활성</th><th>관리</th></tr>
                            </thead>
                            <tbody>
                              {popups.length === 0 ? (
                                <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:'#94A3B8' }}>
                                  등록된 팝업이 없습니다 (popups 테이블 생성 필요)
                                </td></tr>
                              ) : popups.map(p => {
                                const posLabel: Record<string, string> = { center:'중앙', left:'좌측', right:'우측' };
                                const now = new Date();
                                const expired = p.ends_at && new Date(p.ends_at) < now;
                                const notYet  = p.starts_at && new Date(p.starts_at) > now;
                                return (
                                  <tr key={p.id} style={{ opacity: expired ? 0.5 : 1 }}>
                                    <td>
                                      {p.image_url
                                        ? <img src={p.image_url} alt="" style={{ width:64, height:40, objectFit:'cover', borderRadius:6, display:'block' }} />
                                        : <div style={{ width:64, height:40, background:'#F0F0EE', borderRadius:6 }} />
                                      }
                                    </td>
                                    <td style={{ maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                      {p.title || <span style={{ color:'#94A3B8' }}>제목 없음</span>}
                                    </td>
                                    <td>
                                      <span style={{ fontSize:11, background:'#F1F5F9', borderRadius:99, padding:'2px 8px' }}>
                                        {posLabel[p.position] || p.position}
                                      </span>
                                    </td>
                                    <td style={{ fontSize:11, color:'#64748B' }}>
                                      {p.starts_at || p.ends_at ? (
                                        <div>
                                          {p.starts_at && <div>시작: {fmtDateShort(p.starts_at)}</div>}
                                          {p.ends_at   && <div>종료: {fmtDateShort(p.ends_at)}</div>}
                                          {expired && <span style={{ color:'#DC2626', fontWeight:700 }}>기간 만료</span>}
                                          {notYet  && <span style={{ color:'#F59E0B', fontWeight:700 }}>예정</span>}
                                        </div>
                                      ) : (
                                        <span style={{ color:'#94A3B8' }}>상시</span>
                                      )}
                                    </td>
                                    <td style={{ fontSize:12 }}>{p.width}px</td>
                                    <td>
                                      <button onClick={() => togglePopupActive(p)} style={{ fontSize:11, padding:'3px 10px', borderRadius:99, border:'none', cursor:'pointer', background: p.is_active?'#DCFCE7':'#F1F5F9', color: p.is_active?'#16A34A':'#64748B', fontWeight:700 }}>
                                        {p.is_active ? '노출중' : '숨김'}
                                      </button>
                                    </td>
                                    <td style={{ display:'flex', gap:6 }}>
                                      <button className="adm-row-btn" onClick={() => openPopupModal(p)}>수정</button>
                                      <button className="adm-row-btn adm-row-btn-danger" onClick={() => deletePopup(p.id)}>삭제</button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
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
                          <label className="adm-label">팝업 이미지 *</label>
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
                          <select className="adm-select" style={{ width:'100%', marginBottom:8 }} value={ppDropVal}
                            onChange={e => {
                              if (e.target.value === '__custom__') setPpForm(f => ({ ...f, link_url: f.link_url || '/' }));
                              else setPpForm(f => ({ ...f, link_url: e.target.value }));
                            }}>
                            {QUICK_LINKS_PP.map(l => (
                              <option key={l.url} value={l.url}>{l.label}{l.url !== '__custom__' ? ` — ${l.url}` : ''}</option>
                            ))}
                          </select>
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
                            <select className="adm-select" style={{ width:'100%' }} value={ppForm.position}
                              onChange={e => setPpForm(f => ({ ...f, position: e.target.value }))}>
                              <option value="center">중앙</option>
                              <option value="left">좌측</option>
                              <option value="right">우측</option>
                            </select>
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
                            main: { pc: '550×390px', mobile: '380×370px' },
                            mid:  { pc: '1100×200px', mobile: '490×130px' },
                          };
                          const hint = SIZE_HINT[bnForm.type];
                          return (
                            <div>
                              <label className="adm-label">배너 종류</label>
                              <select className="adm-select" style={{ width:'100%' }} value={bnForm.type}
                                onChange={e => setBnForm(f => ({ ...f, type: e.target.value }))}>
                                <option value="main">메인 배너 (상단 슬라이더)</option>
                                <option value="mid">중간 배너 (중단 슬라이더)</option>
                              </select>
                              {hint && (
                                <div style={{ marginTop:6, display:'flex', gap:12, fontSize:12 }}>
                                  <span style={{ background:'#EFF6FF', color:'#2563EB', borderRadius:5, padding:'3px 8px', fontWeight:600 }}>
                                    💻 PC {hint.pc}
                                  </span>
                                  <span style={{ background:'#F0FDF4', color:'#15803D', borderRadius:5, padding:'3px 8px', fontWeight:600 }}>
                                    📱 모바일 {hint.mobile}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* 이미지 드래그앤드롭 업로드 */}
                        <div>
                          <label className="adm-label">배너 이미지 *</label>
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

                        {/* 링크 URL */}
                        <div>
                          <label className="adm-label">클릭 시 이동 페이지</label>
                          <select className="adm-select" style={{ width:'100%', marginBottom:8 }} value={dropVal}
                            onChange={e => {
                              if (e.target.value === '__custom__') setBnForm(f => ({ ...f, link_url: f.link_url || '/' }));
                              else setBnForm(f => ({ ...f, link_url: e.target.value }));
                            }}>
                            {QUICK_LINKS.map(l => (
                              <option key={l.url} value={l.url}>{l.label}{l.url !== '__custom__' ? ` — ${l.url}` : ''}</option>
                            ))}
                          </select>
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
                  <select className="adm-select"><option>전체 상태</option><option>진행중</option><option>예정</option><option>종료</option></select>
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
                  <select className="adm-select" value={loungeFilter} onChange={e => setLoungeFilter(e.target.value)}>
                    <option value="">전체 카테고리</option>
                    <option value="recipe">레시피</option>
                    <option value="story">과일이야기</option>
                    <option value="farm">산지소식</option>
                    <option value="health">건강팁</option>
                  </select>
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

          {/* ===== 회원 관리 ===== */}
          {panel === 'members' && (
            <div className="adm-content">
              <div className="adm-kpi-grid adm-kpi-4 adm-kpi-mb16">
                {[
                  ['전체 회원수',  stats ? `${stats.totalMembers.toLocaleString()}명` : '...'],
                  ['블랙리스트',   members.filter(m => m.is_blocked).length + '명'],
                  ['골드 이상',    members.filter(m => ['gold','vip','vvip'].includes(m.grade)).length + '명'],
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
                  <select className="adm-select" value={memberGradeFilter} onChange={e => setMemberGradeFilter(e.target.value)}>
                    <option value="">전체 등급</option>
                    {Object.entries(GRADE_LABEL).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <select className="adm-select" value={memberBlockFilter} onChange={e => setMemberBlockFilter(e.target.value as 'all'|'active'|'blocked')}>
                    <option value="all">전체</option>
                    <option value="active">정상</option>
                    <option value="blocked">블랙리스트</option>
                  </select>
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
                      <thead><tr><th>이름</th><th>이메일</th><th>연락처</th><th>등급</th><th>적립금</th><th>상태</th><th>가입일</th><th>관리</th></tr></thead>
                      <tbody>
                        {filteredMembers.length === 0 ? (
                          <tr><td colSpan={8} style={{ textAlign:'center', padding:'40px 0', color:'#94A3B8' }}>
                            {members.length === 0 ? '회원 없음' : '검색 결과 없음'}
                          </td></tr>
                        ) : filteredMembers.map(m => (
                          <tr key={m.id} style={{ opacity: m.is_blocked ? 0.55 : 1 }}>
                            <td style={{ fontWeight:500 }}>
                              {m.memo && <span title={m.memo} style={{ marginRight:4, cursor:'help' }}>📌</span>}
                              {m.name}
                            </td>
                            <td className="adm-muted" style={{ fontSize:12 }}>{m.email}</td>
                            <td className="adm-muted" style={{ fontSize:12 }}>{m.phone || '-'}</td>
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
            </div>
          )}

          {/* ===== 친구 추천 ===== */}
          {panel === 'referral' && (() => {
            const thisMonth    = new Date().toISOString().slice(0, 7);
            const total        = referrals.length;
            const thisMonthCnt = referrals.filter(r => r.created_at.startsWith(thisMonth)).length;
            const rewarded     = referrals.filter(r => r.status === 'rewarded').length;

            const filteredReferrals = referrals.filter(r => {
              const matchStatus = referralStatusFilter === 'all' || r.status === referralStatusFilter;
              const q = referralSearch.toLowerCase();
              const matchSearch = !q ||
                (r.referrer?.name || '').toLowerCase().includes(q) ||
                (r.referrer?.email || '').toLowerCase().includes(q) ||
                (r.referred?.name || '').toLowerCase().includes(q) ||
                (r.referred?.email || '').toLowerCase().includes(q) ||
                r.code.toLowerCase().includes(q);
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
                    <select className="adm-select" value={referralStatusFilter}
                      onChange={e => setReferralStatusFilter(e.target.value as 'all'|'pending'|'rewarded')}>
                      <option value="all">전체 상태</option>
                      <option value="pending">대기중</option>
                      <option value="rewarded">지급 완료</option>
                    </select>
                    <input type="text" className="adm-input-text" placeholder="추천인 · 피추천인 · 코드 검색"
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
                            <th>추천 코드</th>
                            <th>가입일</th>
                            <th>리워드 상태</th>
                            <th>지급일</th>
                            <th>관리</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredReferrals.length === 0 ? (
                            <tr><td colSpan={7} style={{ textAlign:'center', padding:'40px 0', color:'#94A3B8' }}>
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
                              <td className="adm-mono" style={{ fontSize:12 }}>{r.code}</td>
                              <td className="adm-muted">{fmtDateShort(r.created_at)}</td>
                              <td>
                                <span className={`adm-badge ${r.status === 'rewarded' ? 'badge-paid' : 'badge-wait'}`}>
                                  {r.status === 'rewarded' ? '지급 완료' : '대기중'}
                                </span>
                              </td>
                              <td className="adm-muted">{r.rewarded_at ? fmtDateShort(r.rewarded_at) : '—'}</td>
                              <td>
                                {r.status === 'rewarded' && (
                                  <button className="adm-row-btn adm-row-btn-danger"
                                    onClick={() => revokeReferralReward(r)}>철회</button>
                                )}
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

          {/* ===== SMS 발송 ===== */}
          {panel === 'sms' && (
            <SmsPanel members={members} loadMembers={loadMembers} membersLoading={membersLoading} />
          )}

          {/* ===== 문의 관리 ===== */}
          {panel === 'inquiry' && (
            <div className="adm-content">
              <TabBtns active={inquiryTab} setActive={setInquiryTab}
                tabs={[
                  { id:'tab-general', label: <span>답변대기 {pendingInquiries.length > 0 && <span className="adm-tab-count adm-tab-count-red">{pendingInquiries.length}</span>}</span> },
                  { id:'tab-done',    label: '답변완료' },
                  { id:'tab-all',     label: '전체' },
                ]} />
              <div className="adm-card">
                {inquiriesLoading ? <PanelLoading /> : (() => {
                  const list = inquiryTab === 'tab-general' ? pendingInquiries
                             : inquiryTab === 'tab-done'    ? doneInquiries
                             : inquiries;
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
                                <span className={`adm-badge ${inq.status === 'answered' || inq.status === 'done' ? 'badge-done' : 'badge-wait'}`}>
                                  {inq.status === 'answered' || inq.status === 'done' ? '답변완료' : '대기중'}
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
                  <select className="adm-select" value={faqCatFilter} onChange={e => setFaqCatFilter(e.target.value)}>
                    <option value="">전체 카테고리</option>
                    {Object.entries(FAQ_CATS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <input type="text" className="adm-input-text" placeholder="질문 · 답변 검색"
                    value={faqSearch} onChange={e => setFaqSearch(e.target.value)} />
                </div>
                <div className="adm-toolbar-right">
                  <button className="adm-btn adm-btn-outline" onClick={loadFaq}><span className="adm-btn-icon"><Icon.Refresh /></span>새로고침</button>
                  <button className="adm-btn adm-btn-primary" onClick={() => openFaqModal()}>+ FAQ 등록</button>
                </div>
              </div>
              <div className="adm-card">
                {faqLoading ? <PanelLoading /> : (
                  <div className="adm-table-wrap">
                    <table className="adm-table">
                      <thead>
                        <tr><th>카테고리</th><th>질문</th><th>정렬</th><th>노출</th><th>관리</th></tr>
                      </thead>
                      <tbody>
                        {filteredFaq.length === 0 ? (
                          <tr><td colSpan={5} style={{ textAlign:'center', padding:'40px 0', color:'#94A3B8' }}>
                            FAQ 없음
                          </td></tr>
                        ) : filteredFaq.map(f => (
                          <tr key={f.id}>
                            <td><span className="adm-badge badge-paid">{FAQ_CATS[f.category] || f.category}</span></td>
                            <td style={{ maxWidth:340, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.question}</td>
                            <td className="adm-mono">{f.sort_order}</td>
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
              <div className="adm-info-box adm-info-mt10">
                💡 <strong>FAQ</strong>는 고객센터 페이지에 카테고리별로 그룹 표시됩니다. 정렬 순서(낮을수록 위)와 노출 여부를 설정하세요.
              </div>
            </div>
          )}

          {/* ===== 1:1 문의 관리 ===== */}
          {panel === 'cs' && (
            <div className="adm-content">
              <div className="adm-kpi-grid adm-kpi-3 adm-kpi-mb16">
                {[
                  ['전체 문의', csItems.length + '건'],
                  ['답변 대기', csPending.length + '건'],
                  ['답변 완료', csAnswered.length + '건'],
                ].map(([l, v]) => (
                  <div key={l} className="adm-kpi-card">
                    <div className="adm-kpi-label">{l}</div>
                    <div className="adm-kpi-value adm-kpi-value-mt">{v}</div>
                  </div>
                ))}
              </div>
              <TabBtns active={csAdminTab} setActive={setCsAdminTab}
                tabs={[
                  { id:'tab-pending',  label: <span>답변 대기 {csPending.length > 0 && <span className="adm-tab-count adm-tab-count-red">{csPending.length}</span>}</span> },
                  { id:'tab-answered', label: '답변 완료' },
                  { id:'tab-all',      label: '전체' },
                ]} />
              <div className="adm-toolbar">
                <div className="adm-toolbar-left">
                  <select className="adm-select">
                    <option value="">전체 카테고리</option>
                    {Object.entries(CS_CAT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
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
              return matchStatus && matchSearch;
            });
            return (
              <div className="adm-content">
                <div className="adm-kpi-grid adm-kpi-3 adm-kpi-mb16">
                  {[
                    ['전체 문의', `${productInquiries.length}건`],
                    ['답변 대기', `${pending.length}건`],
                    ['답변 완료', `${answered.length}건`],
                  ].map(([l,v]) => (
                    <div key={l} className="adm-kpi-card">
                      <div className="adm-kpi-label">{l}</div>
                      <div className="adm-kpi-value adm-kpi-value-mt">{v}</div>
                    </div>
                  ))}
                </div>
                <div className="adm-toolbar">
                  <div className="adm-toolbar-left">
                    <select className="adm-select" value={piqStatusFilter}
                      onChange={e => setPiqStatusFilter(e.target.value as 'all'|'pending'|'answered')}>
                      <option value="all">전체</option>
                      <option value="pending">답변 대기</option>
                      <option value="answered">답변 완료</option>
                    </select>
                    <input type="text" className="adm-input-text" placeholder="상품명·내용·카테고리 검색"
                      value={piqSearch} onChange={e => setPiqSearch(e.target.value)} />
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

          {/* ===== 정산 관리 ===== */}
          {panel === 'settlement' && (
            <div className="adm-content">
              {/* 월 선택 */}
              <div className="adm-toolbar" style={{ marginBottom:16 }}>
                <div className="adm-toolbar-left" style={{ gap:8 }}>
                  <button className="adm-btn adm-btn-outline" style={{ padding:'6px 12px', fontSize:14 }}
                    onClick={() => {
                      const [y, m] = settlementMonth.split('-').map(Number);
                      const d = new Date(y, m - 2, 1);
                      const next = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
                      setSettlementMonth(next);
                      setSettlementData(null);
                      loadSettlement(next);
                    }}>◀</button>
                  <span style={{ fontSize:15, fontWeight:700, minWidth:90, textAlign:'center' }}>
                    {settlementMonth.replace('-', '년 ')}월
                  </span>
                  <button className="adm-btn adm-btn-outline" style={{ padding:'6px 12px', fontSize:14 }}
                    onClick={() => {
                      const [y, m] = settlementMonth.split('-').map(Number);
                      const d = new Date(y, m, 1);
                      const next = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
                      setSettlementMonth(next);
                      setSettlementData(null);
                      loadSettlement(next);
                    }}>▶</button>
                </div>
                <div className="adm-toolbar-right">
                  <button className="adm-btn adm-btn-outline" onClick={() => loadSettlement(settlementMonth)}>
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

                  {/* 일별 매출 꺾은선 그래프 */}
                  <div className="adm-card">
                    <div className="adm-card-head"><span className="adm-card-title">일별 매출</span></div>
                    <div style={{ overflowX:'auto', padding:'8px 0' }}>
                      {(() => {
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

            return (
              <div className="adm-content">
                {/* KPI */}
                <div className="adm-kpi-grid adm-kpi-3 adm-kpi-mb16">
                  {[
                    ['총 응답 수', `${total.toLocaleString()}건`],
                    ['이번달 응답', `${thisMonthCnt.toLocaleString()}건`],
                    ['회원 응답', `${memberCnt.toLocaleString()}건`],
                  ].map(([l, v]) => (
                    <div key={l} className="adm-kpi-card">
                      <div className="adm-kpi-label">{l}</div>
                      <div className="adm-kpi-value adm-kpi-value-mt">{v}</div>
                    </div>
                  ))}
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
                          {surveyResults.length === 0 ? (
                            <tr><td colSpan={7} style={{ textAlign:'center', padding:'40px 0', color:'#94A3B8' }}>
                              설문 응답 없음
                            </td></tr>
                          ) : surveyResults.map(r => (
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
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

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

              <div className="adm-card adm-card-settings">
                <div className="adm-card-head"><span className="adm-card-title">홈 화면 설정</span></div>
                <div className="adm-form">
                  <div className="adm-form-row">
                    <label className="adm-label">델리오 픽 노출 수</label>
                    <div className="adm-flex-center-gap">
                      <input
                        type="number"
                        className="adm-input-text adm-input-w100"
                        value={siteSettings.pick_count ?? '6'}
                        min={3} max={12} step={3}
                        onChange={e => setSiteSettings(prev => ({ ...prev, pick_count: e.target.value }))}
                      />
                      <span className="adm-muted">개 (3·6·9·12 권장)</span>
                    </div>
                  </div>
                  <div className="adm-form-row">
                    <label className="adm-label">전체 출발 마감 시간 (기본값)</label>
                    <div className="adm-flex-center-gap">
                      <input
                        type="text"
                        className="adm-input-text adm-input-w100"
                        value={siteSettings.dispatch_cutoff ?? ''}
                        placeholder="예: 14:00"
                        onChange={e => setSiteSettings(prev => ({ ...prev, dispatch_cutoff: e.target.value }))}
                      />
                      <span className="adm-muted">상품별 설정이 없으면 이 값으로 표시</span>
                    </div>
                  </div>
                  <div className="adm-form-row">
                    <label className="adm-label">고객센터 전화번호</label>
                    <input
                      type="text"
                      className="adm-input-text"
                      style={{ maxWidth:200 }}
                      value={siteSettings.cs_phone ?? ''}
                      placeholder="예: 02-0000-0000"
                      onChange={e => setSiteSettings(prev => ({ ...prev, cs_phone: e.target.value }))}
                    />
                  </div>
                  <div className="adm-form-row">
                    <label className="adm-label">회원가입 쿠폰 금액</label>
                    <div className="adm-flex-center-gap">
                      <input
                        type="number"
                        className="adm-input-text adm-input-w100"
                        value={siteSettings.signup_coupon ?? '5000'}
                        min={0} step={1000}
                        onChange={e => setSiteSettings(prev => ({ ...prev, signup_coupon: e.target.value }))}
                      />
                      <span className="adm-muted">원</span>
                    </div>
                  </div>
                  <div className="adm-form-row">
                    <label className="adm-label">적립금 비율</label>
                    <div className="adm-flex-center-gap">
                      <input
                        type="number"
                        className="adm-input-text adm-input-w100"
                        value={siteSettings.point_rate ?? '1'}
                        min={0} max={10} step={0.5}
                        onChange={e => setSiteSettings(prev => ({ ...prev, point_rate: e.target.value }))}
                      />
                      <span className="adm-muted">% (구매금액 기준)</span>
                    </div>
                  </div>
                  <div className="adm-form-row" style={{ alignItems:'flex-start' }}>
                    <label className="adm-label" style={{ paddingTop:6 }}>인기 검색어</label>
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
                  <div className="adm-form-actions">
                    <button className="adm-btn adm-btn-primary" onClick={saveSettings} disabled={settingsSaving}>
                      {settingsSaving ? '저장 중...' : '저장'}
                    </button>
                  </div>
                </div>
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

              {/* 등급 변경 */}
              <div>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:8 }}>회원 등급 변경</div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {Object.entries(GRADE_LABEL).map(([grade, label]) => (
                    <button key={grade} onClick={() => changeMemberGrade(selectedMember.id, grade)}
                      style={{ padding:'6px 14px', borderRadius:99, border:'1.5px solid', fontSize:12, fontWeight:600, cursor:'pointer',
                        borderColor: selectedMember.grade === grade ? '#1A1A1A' : '#E2E8F0',
                        background: selectedMember.grade === grade ? '#1A1A1A' : '#fff',
                        color: selectedMember.grade === grade ? '#fff' : '#64748B' }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 블랙리스트 */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', background: selectedMember.is_blocked ? '#FEF2F2' : '#F8FAFC', borderRadius:10, border:`1px solid ${selectedMember.is_blocked ? '#FECACA' : '#E2E8F0'}` }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color: selectedMember.is_blocked ? '#DC2626' : '#1A1A1A' }}>
                    {selectedMember.is_blocked ? '🚫 블랙리스트 등록됨' : '✅ 정상 회원'}
                  </div>
                  <div style={{ fontSize:11, color:'#94A3B8', marginTop:2 }}>
                    {selectedMember.is_blocked ? '로그인 및 주문이 제한됩니다.' : '블랙리스트 등록 시 서비스 이용이 제한됩니다.'}
                  </div>
                </div>
                <button onClick={() => toggleMemberBlock(selectedMember.id, selectedMember.is_blocked)}
                  style={{ padding:'7px 14px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:700,
                    background: selectedMember.is_blocked ? '#16A34A' : '#DC2626', color:'#fff' }}>
                  {selectedMember.is_blocked ? '해제' : '등록'}
                </button>
              </div>

              {/* 관리자 메모 */}
              <div>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:8 }}>관리자 메모</div>
                <textarea rows={3} style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1.5px solid #E2E8F0', fontSize:13, resize:'vertical', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }}
                  placeholder="내부용 메모 (회원에게 보이지 않음)"
                  value={memberMemo} onChange={e => setMemberMemo(e.target.value)} />
                <button onClick={() => saveMemberMemo(selectedMember.id)} disabled={memberMemoSaving}
                  style={{ marginTop:6, padding:'6px 16px', borderRadius:6, border:'none', background:'#1A1A1A', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                  {memberMemoSaving ? '저장 중...' : '메모 저장'}
                </button>
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
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              {selectedInquiry.status !== 'answered' && selectedInquiry.status !== 'done' && (
                <>
                  <button className="adm-btn adm-btn-outline" style={{ color:'#EF4444', borderColor:'#FECACA' }}
                    onClick={() => updateInquiryStatus(selectedInquiry.id, 'rejected')}>거절</button>
                  <button className="adm-btn adm-btn-primary"
                    onClick={() => updateInquiryStatus(selectedInquiry.id, 'answered')}>수락</button>
                </>
              )}
              {(selectedInquiry.status === 'answered' || selectedInquiry.status === 'done') && (
                <span className="adm-badge badge-done" style={{ fontSize:13, padding:'6px 14px' }}>답변완료</span>
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
                <select className="adm-select" value={loungeForm.filter}
                  onChange={e => setLoungeForm(p => ({ ...p, filter: e.target.value }))}>
                  <option value="recipe">레시피</option>
                  <option value="story">과일이야기</option>
                  <option value="farm">산지소식</option>
                  <option value="health">건강팁</option>
                </select>
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
                  <label className="adm-label">작성일</label>
                  <input type="text" className="adm-input-text" placeholder="예: 2026.05.30"
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
                <label className="adm-label">쿠폰 코드</label>
                <input type="text" className="adm-input-text" placeholder="예: WELCOME10 (미입력 시 자동생성)"
                  value={couponForm.code} onChange={e => setCouponForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} />
              </div>
              <div className="adm-form-row">
                <label className="adm-label">할인 유형</label>
                <select className="adm-select" value={couponForm.discount_type}
                  onChange={e => setCouponForm(p => ({ ...p, discount_type: e.target.value as 'percent'|'fixed' }))}>
                  <option value="percent">정률 (%)</option>
                  <option value="fixed">정액 (원)</option>
                </select>
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
              <div className="adm-form-row">
                <label className="adm-label">만료일</label>
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
              <div className="adm-form-row">
                <label className="adm-label">활성 여부</label>
                <Toggle defaultOn={couponForm.is_active} onChange={v => setCouponForm(p => ({ ...p, is_active: v }))} />
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
