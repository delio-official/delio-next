'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import '@/styles/admin.css';
import { StarRating } from '@/components/StarRating';

/* ===== 타입 ===== */
type PanelKey = 'dashboard'|'orders'|'products'|'farms'|'reviews'|'coupon'|'banner'|'events'|'lounge'|'members'|'referral'|'sms'|'inquiry'|'settlement'|'tasteprofile'|'settings';

interface DashboardStats {
  monthRevenue: number;
  todayRevenue: number;
  monthOrders: number;
  todayOrders: number;
  totalMembers: number;
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

interface AdminProfile {
  id: string;
  email: string;
  name: string;
  grade: string;
  point_balance: number;
  created_at: string;
  phone: string | null;
}

interface AdminReview {
  id: string;
  product_id: string;
  rating: number;
  content: string;
  is_best: boolean;
  created_at: string;
  products: { name: string } | null;
}

interface AdminEvent {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  badge: string | null;
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

/* ===== 상수 ===== */
const TITLES: Record<PanelKey, string> = {
  dashboard:'대시보드', orders:'주문 관리', products:'상품 관리', farms:'농가 관리',
  reviews:'리뷰 관리', coupon:'쿠폰 / 포인트', banner:'배너 / 팝업', events:'이벤트',
  lounge:'라운지 관리', members:'회원 관리', referral:'친구 추천', sms:'SMS 발송',
  inquiry:'문의 관리', settlement:'정산 관리', tasteprofile:'취향 프로파일', settings:'설정',
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

const CHART_DATA: Record<string, { labels: string[]; values: number[] }> = {
  '7':  { labels:['5/17','5/18','5/19','5/20','5/21','5/22','5/23'], values:[820,1240,980,1560,1120,1380,1240] },
  '30': { labels:['4/24','4/27','4/30','5/3','5/6','5/9','5/12','5/15','5/18','5/21','5/23'], values:[600,920,1100,880,1340,1020,1560,1240,980,1380,1240] },
};

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
};

/* ===== 토글 컴포넌트 ===== */
function Toggle({ defaultOn = false, onChange }: { defaultOn?: boolean; onChange?: (v: boolean) => void }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <label className="adm-toggle" onClick={() => { setOn(v => { onChange?.(!v); return !v; }); }}>
      <input type="checkbox" checked={on} onChange={() => {}} style={{ position:'absolute',opacity:0,width:0,height:0 }} />
      <span></span>
    </label>
  );
}

/* ===== 로딩 스피너 ===== */
function PanelLoading() {
  return <div style={{ textAlign:'center', padding:'60px 0', color:'#94A3B8', fontSize:14 }}>불러오는 중...</div>;
}

/* ===== 빈 상태 ===== */
function EmptyState({ msg = '데이터가 없습니다.' }: { msg?: string }) {
  return <div style={{ textAlign:'center', padding:'60px 0', color:'#94A3B8', fontSize:14 }}>{msg}</div>;
}

/* ===== 차트 컴포넌트 ===== */
function SalesChart({ days }: { days: '7'|'30' }) {
  const ref = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState('');
  const [labels, setLabels] = useState<string[]>([]);

  useEffect(() => {
    const data = CHART_DATA[days];
    const vals = data.values;
    const lbs = data.labels;
    setLabels(lbs);
    const W = ref.current?.clientWidth || 560;
    const H = 160;
    const PAD = { top: 28, right: 16, bottom: 4, left: 44 };
    const cw = W - PAD.left - PAD.right;
    const ch = H - PAD.top - PAD.bottom;
    const max = Math.max(...vals);
    const range = max || 1;
    const n = vals.length;
    const xStep = cw / (n - 1);
    const yTicks = 4;
    let gridLines = '';
    let yLabels = '';
    for (let i = 0; i <= yTicks; i++) {
      const y = PAD.top + ch - (ch * i / yTicks);
      const val = Math.round(range * i / yTicks);
      const label = val >= 10000 ? (val/10000).toFixed(0)+'만' : val.toLocaleString();
      gridLines += `<line x1="${PAD.left}" y1="${y}" x2="${W - PAD.right}" y2="${y}" stroke="#E2E8F0" stroke-width="1"/>`;
      yLabels += `<text x="${PAD.left - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="#94A3B8">${label}</text>`;
    }
    const pts = vals.map((v, i) => ({ x: PAD.left + i * xStep, y: PAD.top + ch - (v / range * ch), v }));
    const areaPath = [`M ${pts[0].x} ${pts[0].y}`, ...pts.slice(1).map(p=>`L ${p.x} ${p.y}`), `L ${pts[n-1].x} ${PAD.top+ch}`, `L ${pts[0].x} ${PAD.top+ch}`, 'Z'].join(' ');
    const linePath = [`M ${pts[0].x} ${pts[0].y}`, ...pts.slice(1).map(p=>`L ${p.x} ${p.y}`)].join(' ');
    const circles = pts.map((p, i) => `<g class="adm-chart-point"><circle cx="${p.x}" cy="${p.y}" r="5" fill="#fff" stroke="#3B82F6" stroke-width="2.2"/><circle cx="${p.x}" cy="${p.y}" r="10" fill="transparent"/><title>${lbs[i]}: ${(p.v * 10000).toLocaleString()}원</title></g>`).join('');
    setSvg(`<svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" overflow="visible"><defs><linearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3B82F6" stop-opacity="0.18"/><stop offset="100%" stop-color="#3B82F6" stop-opacity="0.01"/></linearGradient></defs>${gridLines}${yLabels}<path d="${areaPath}" fill="url(#lineAreaGrad)"/><path d="${linePath}" fill="none" stroke="#3B82F6" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>${circles}</svg>`);
  }, [days, ref.current?.clientWidth]); // eslint-disable-line

  return (
    <>
      <div ref={ref} className="adm-chart" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="adm-chart-labels" style={{ display:'flex', paddingLeft:44, paddingRight:16 }}>
        {labels.map(l => <span key={l} className="adm-chart-label">{l}</span>)}
      </div>
    </>
  );
}

/* ===== 메인 컴포넌트 ===== */
export default function AdminClient() {
  const [panel, setPanel] = useState<PanelKey>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chartDays, setChartDays] = useState<'7'|'30'>('7');
  const [farmModal, setFarmModal] = useState(false);
  const [smsLen, setSmsLen] = useState(0);

  /* ── 대시보드 ── */
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  /* ── 주문 ── */
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  /* ── 상품 ── */
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);

  /* ── 회원 ── */
  const [members, setMembers] = useState<AdminProfile[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  /* ── 리뷰 ── */
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  /* ── 이벤트 ── */
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  /* ── 라운지 ── */
  const [loungePosts, setLoungePosts] = useState<AdminLoungePost[]>([]);
  const [loungeLoading, setLoungeLoading] = useState(false);
  const [loungeFilter, setLoungeFilter] = useState('');

  /* ── 문의 ── */
  const [inquiries, setInquiries] = useState<FarmInquiry[]>([]);
  const [inquiriesLoading, setInquiriesLoading] = useState(false);

  /* ── 탭 ── */
  const [orderTab, setOrderTab] = useState('order-tab-all');
  const [couponTab, setCouponTab] = useState('tab-coupon');
  const [bannerTab, setBannerTab] = useState('tab-banner');
  const [inquiryTab, setInquiryTab] = useState('tab-general');

  const loadedPanels = useRef(new Set<PanelKey>());

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
    setStatsLoading(false);
  }

  async function loadOrders() {
    setOrdersLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    setOrders((data as Order[]) || []);
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

  async function loadMembers() {
    setMembersLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('profiles')
      .select('id, email, name, grade, point_balance, created_at, phone')
      .order('created_at', { ascending: false })
      .limit(100);
    setMembers((data as AdminProfile[]) || []);
    setMembersLoading(false);
  }

  async function loadReviews() {
    setReviewsLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('reviews')
      .select('id, product_id, rating, content, is_best, created_at, products(name)')
      .order('created_at', { ascending: false })
      .limit(100);
    setReviews((data as unknown as AdminReview[]) || []);
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
    }
    setUpdatingStatus(null);
  }

  /* ========== 라운지 노출 토글 ========== */
  async function toggleLoungeActive(id: number, newVal: boolean) {
    const supabase = createClient();
    await supabase.from('lounge_posts').update({ is_active: newVal }).eq('id', id);
    setLoungePosts(prev => prev.map(p => p.id === id ? { ...p, is_active: newVal } : p));
  }

  /* ========== 이벤트 활성 토글 ========== */
  async function toggleEventActive(id: string, newVal: boolean) {
    const supabase = createClient();
    await supabase.from('events').update({ is_active: newVal }).eq('id', id);
    setEvents(prev => prev.map(e => e.id === id ? { ...e, is_active: newVal } : e));
  }

  /* ========== 패널 전환 ========== */
  function go(p: PanelKey) {
    setPanel(p);
    if (window.innerWidth <= 900) setSidebarOpen(false);
    if (loadedPanels.current.has(p)) return;
    loadedPanels.current.add(p);
    switch (p) {
      case 'orders':    loadOrders(); break;
      case 'products':  loadProducts(); break;
      case 'members':   loadMembers(); break;
      case 'reviews':   loadReviews(); break;
      case 'events':    loadEvents(); break;
      case 'lounge':    loadLounge(); break;
      case 'inquiry':   loadInquiries(); break;
    }
  }

  /* 대시보드 최초 로드 */
  useEffect(() => { loadDashboard(); }, []); // eslint-disable-line

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
    const q = orderSearch.toLowerCase();
    const matchSearch = !q || o.order_no.toLowerCase().includes(q) ||
      o.recipient.toLowerCase().includes(q) || o.phone.includes(q);
    return matchStatus && matchSearch;
  });

  /* 필터된 회원 목록 */
  const filteredMembers = members.filter(m => {
    const q = memberSearch.toLowerCase();
    return !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || (m.phone || '').includes(q);
  });

  /* 필터된 라운지 */
  const filteredLounge = loungeFilter
    ? loungePosts.filter(p => p.filter === loungeFilter)
    : loungePosts;

  /* 문의 탭별 필터 */
  const pendingInquiries = inquiries.filter(i => i.status === 'pending' || i.status === 'new' || !i.status);
  const doneInquiries = inquiries.filter(i => i.status === 'answered' || i.status === 'done');

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

      {/* ===== 농가 등록 모달 ===== */}
      {farmModal && (
        <div className="adm-modal-bg open" onClick={() => setFarmModal(false)}>
          <div className="adm-modal adm-modal-farm" onClick={e => e.stopPropagation()}>
            <div className="adm-modal-head">
              <span className="adm-modal-title">농가 등록</span>
              <button className="adm-modal-close" onClick={() => setFarmModal(false)}>✕</button>
            </div>
            <div className="adm-modal-body">
              <div className="adm-detail-grid adm-farm-grid">
                <div className="adm-form-row"><label className="adm-label">농가명 <span className="adm-required">*</span></label><input type="text" className="adm-input-text adm-input-full" placeholder="예: 서귀포 감귤농원" /></div>
                <div className="adm-form-row"><label className="adm-label">대표자명 <span className="adm-required">*</span></label><input type="text" className="adm-input-text adm-input-full" placeholder="예: 홍길동" /></div>
                <div className="adm-form-row"><label className="adm-label">연락처 <span className="adm-required">*</span></label><input type="text" className="adm-input-text adm-input-full" placeholder="010-0000-0000" /></div>
                <div className="adm-form-row"><label className="adm-label">이메일</label><input type="email" className="adm-input-text adm-input-full" placeholder="farm@example.com" /></div>
                <div className="adm-form-row adm-form-row-full"><label className="adm-label">주소 <span className="adm-required">*</span></label><input type="text" className="adm-input-text adm-input-full" placeholder="예: 제주특별자치도 서귀포시 남원읍" /></div>
                <div className="adm-form-row"><label className="adm-label">담당 택배사 <span className="adm-required">*</span></label>
                  <select className="adm-select adm-select-full"><option value="">택배사 선택</option><option>CJ대한통운</option><option>롯데택배</option><option>한진택배</option><option>우체국택배</option></select>
                </div>
                <div className="adm-form-row"><label className="adm-label">주요 품목</label><input type="text" className="adm-input-text adm-input-full" placeholder="예: 감귤, 한라봉, 레몬" /></div>
                <div className="adm-form-row adm-form-row-full"><label className="adm-label">계약 수수료율</label>
                  <div className="adm-flex-center-gap"><input type="number" className="adm-input-text adm-input-w80" defaultValue="5" /><span className="adm-muted">% (기본: 5%)</span></div>
                </div>
                <div className="adm-form-row adm-form-row-full"><label className="adm-label">메모</label><textarea className="adm-textarea" rows={2} placeholder="내부 메모" /></div>
              </div>
              <div className="adm-flex-gap adm-flex-end adm-mt-20">
                <button className="adm-btn adm-btn-outline" onClick={() => setFarmModal(false)}>취소</button>
                <button className="adm-btn adm-btn-primary" onClick={() => setFarmModal(false)}>농가 등록</button>
              </div>
            </div>
          </div>
        </div>
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
            <div className="adm-logo-mark">D</div>
            <div><div className="adm-logo-name">Delio</div><div className="adm-logo-sub">Admin Console</div></div>
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
              <NavItem panel="inquiry" icon={<Icon.Inquiry />} label="문의 관리"
                badge={pendingInquiries.length || undefined} />
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
                  { label:'이번달 매출', val: stats ? `${fmtPrice(stats.monthRevenue)}원` : '-', kpiCls:'kpi-green',
                    icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg> },
                  { label:'금일 매출', val: stats ? `${fmtPrice(stats.todayRevenue)}원` : '-', kpiCls:'kpi-blue',
                    icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><rect x="2" y="7" width="20" height="14"/><path d="M16 7V5a2 2 0 00-4 0v2"/></svg> },
                  { label:'이번달 주문', val: stats ? `${stats.monthOrders.toLocaleString()}건` : '-', kpiCls:'kpi-blue',
                    icon:<Icon.Orders /> },
                  { label:'금일 신규 주문', val: stats ? `${stats.todayOrders}건` : '-', kpiCls:'kpi-purple',
                    icon:<Icon.Orders /> },
                  { label:'전체 회원수', val: stats ? `${stats.totalMembers.toLocaleString()}명` : '-', kpiCls:'kpi-green',
                    icon:<Icon.Members /> },
                ].map(k => (
                  <div key={k.label} className="adm-kpi-card">
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
                    <span className="adm-card-title">매출 현황 (샘플)</span>
                    <div className="adm-btn-group">
                      {(['7','30'] as const).map(d => (
                        <button key={d} className={`adm-seg-btn${chartDays===d?' active':''}`} onClick={() => setChartDays(d)}>{d}일</button>
                      ))}
                    </div>
                  </div>
                  <div className="adm-chart-pad"><SalesChart days={chartDays} /></div>
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
                        <div key={o.id} className="adm-pending-row" style={{ cursor:'pointer' }} onClick={() => { go('orders'); setSelectedOrder(o); }}>
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
                  <input type="text" className="adm-input-text" placeholder="주문번호 · 수령인 · 연락처 검색"
                    value={orderSearch} onChange={e => setOrderSearch(e.target.value)} />
                </div>
                <div className="adm-toolbar-right">
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
                              <button className="adm-row-btn" onClick={() => setSelectedOrder(o)}>상세</button>
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
                  <select className="adm-select">
                    <option value="">전체 카테고리</option>
                    {Object.entries(CAT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <input type="text" className="adm-input-text" placeholder="상품명 검색" />
                </div>
                <div className="adm-toolbar-right">
                  <button className="adm-btn adm-btn-outline" onClick={loadProducts}><span className="adm-btn-icon"><Icon.Refresh /></span>새로고침</button>
                  <button className="adm-btn adm-btn-primary">+ 상품 등록</button>
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
                        {products.length === 0 ? (
                          <tr><td colSpan={7} style={{ textAlign:'center', padding:'40px 0', color:'#94A3B8' }}>상품 없음</td></tr>
                        ) : products.map(p => (
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
                            <td><button className="adm-row-btn">수정</button></td>
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
                <div className="adm-toolbar-left"><input type="text" className="adm-input-text" placeholder="농가명 · 대표자 검색" /></div>
                <div className="adm-toolbar-right"><button className="adm-btn adm-btn-primary" onClick={() => setFarmModal(true)}>+ 농가 등록</button></div>
              </div>
              <div className="adm-card">
                <div className="adm-table-wrap">
                  <table className="adm-table">
                    <thead><tr><th>농가명</th><th>대표자</th><th>연락처</th><th>주소</th><th>택배사</th><th>정산계좌</th><th>연결 상품</th><th>누적 주문</th><th>관리</th></tr></thead>
                    <tbody>
                      <tr><td><strong>서귀포 감귤농원</strong></td><td>고영철</td><td className="adm-mono">010-1234-5678</td><td className="adm-muted">제주 서귀포시</td><td><span className="adm-badge badge-carrier">CJ대한통운</span></td><td className="adm-muted">국민 123-456-789</td><td>8개</td><td className="adm-mono">1,240건</td><td><button className="adm-row-btn">수정</button></td></tr>
                      <tr><td><strong>영천포도원</strong></td><td>박상훈</td><td className="adm-mono">010-2345-6789</td><td className="adm-muted">경북 영천시</td><td><span className="adm-badge badge-carrier">롯데택배</span></td><td className="adm-muted">신한 234-567-890</td><td>5개</td><td className="adm-mono">892건</td><td><button className="adm-row-btn">수정</button></td></tr>
                      <tr><td><strong>고성베리팜</strong></td><td>이재원</td><td className="adm-mono">010-3456-7890</td><td className="adm-muted">경남 고성군</td><td><span className="adm-badge badge-carrier">한진택배</span></td><td className="adm-muted">우리 345-678-901</td><td>3개</td><td className="adm-mono">456건</td><td><button className="adm-row-btn">수정</button></td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="adm-info-box adm-info-mt10">💡 농가 관리 기능은 추후 확장 예정입니다.</div>
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
                      <thead><tr><th>번호</th><th>별점</th><th>내용</th><th>상품</th><th>베스트</th><th>작성일</th><th>관리</th></tr></thead>
                      <tbody>
                        {reviews.length === 0 ? (
                          <tr><td colSpan={7} style={{ textAlign:'center', padding:'40px 0', color:'#94A3B8' }}>리뷰 없음</td></tr>
                        ) : reviews.map((r, i) => (
                          <tr key={r.id}>
                            <td className="adm-mono" style={{ fontSize:12 }}>R-{String(i+1).padStart(3,'0')}</td>
                            <td><StarRating rating={r.rating} size={13} /></td>
                            <td style={{ maxWidth:240, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.content}</td>
                            <td className="adm-muted" style={{ fontSize:12 }}>{r.products?.name || '-'}</td>
                            <td><Toggle defaultOn={r.is_best} /></td>
                            <td className="adm-muted">{fmtDate(r.created_at)}</td>
                            <td><button className="adm-row-btn adm-row-btn-danger">삭제</button></td>
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
                    <div className="adm-toolbar-left">
                      <select className="adm-select"><option>전체 유형</option><option>정률 할인</option><option>정액 할인</option></select>
                      <select className="adm-select"><option>전체 상태</option><option>활성</option><option>만료</option></select>
                    </div>
                    <div className="adm-toolbar-right"><button className="adm-btn adm-btn-primary">+ 쿠폰 생성</button></div>
                  </div>
                  <div className="adm-card">
                    <div className="adm-table-wrap">
                      <table className="adm-table">
                        <thead><tr><th>쿠폰명</th><th>코드</th><th>할인 유형</th><th>할인값</th><th>시작일</th><th>만료일</th><th>사용/발급</th><th>활성</th><th>관리</th></tr></thead>
                        <tbody>
                          <tr><td>신규가입 환영 쿠폰</td><td className="adm-mono">WELCOME5000</td><td>정액</td><td><strong>5,000원</strong></td><td className="adm-muted">2025.01.01</td><td className="adm-muted">2025.12.31</td><td className="adm-mono">342 / 무제한</td><td><Toggle defaultOn={true} /></td><td><button className="adm-row-btn">수정</button></td></tr>
                          <tr><td>봄맞이 할인 쿠폰</td><td className="adm-mono">SPRING10</td><td>정률</td><td><strong>10%</strong></td><td className="adm-muted">2025.03.01</td><td className="adm-muted">2025.05.31</td><td className="adm-mono">28 / 100</td><td><Toggle defaultOn={true} /></td><td><button className="adm-row-btn">수정</button></td></tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="adm-kpi-grid adm-kpi-3 adm-kpi-mb16">
                    {[['전체 보유 포인트','4,820,000P'],['이번달 지급','342,000P'],['이번달 사용','198,000P']].map(([l,v])=>(
                      <div key={l} className="adm-kpi-card"><div className="adm-kpi-label">{l}</div><div className="adm-kpi-value adm-kpi-value-mt">{v}</div></div>
                    ))}
                  </div>
                  <div className="adm-card">
                    <div className="adm-table-wrap">
                      <table className="adm-table">
                        <thead><tr><th>회원명</th><th>유형</th><th>포인트</th><th>사유</th><th>일시</th><th>잔여</th></tr></thead>
                        <tbody>
                          <tr><td>-</td><td>-</td><td>-</td><td className="adm-muted">포인트 이력 없음</td><td>-</td><td>-</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ===== 배너/팝업 ===== */}
          {panel === 'banner' && (
            <div className="adm-content">
              <TabBtns active={bannerTab} setActive={setBannerTab}
                tabs={[{id:'tab-banner',label:'배너 관리'},{id:'tab-popup',label:'팝업 관리'}]} />
              <div className="adm-toolbar">
                <div className="adm-toolbar-left">
                  <select className="adm-select"><option>노출 페이지</option><option>메인</option><option>카테고리</option><option>상품 상세</option></select>
                  <select className="adm-select"><option>노출 기기</option><option>PC</option><option>모바일</option><option>전체</option></select>
                </div>
                <div className="adm-toolbar-right">
                  <button className="adm-btn adm-btn-primary">+ {bannerTab==='tab-banner'?'배너':'팝업'} 등록</button>
                </div>
              </div>

              {/* 배너 관리 탭 */}
              {bannerTab === 'tab-banner' && (
                <div className="adm-card">
                  <div className="adm-table-wrap">
                    <table className="adm-table">
                      <thead><tr><th>순서</th><th>미리보기</th><th>배너명</th><th>링크 URL</th><th>노출 페이지</th><th>기기</th><th>시작일</th><th>종료일</th><th>활성</th><th>관리</th></tr></thead>
                      <tbody>
                        <tr><td><div className="adm-order-btns"><button>▲</button><button>▼</button></div></td><td><div className="adm-banner-thumb">🍎</div></td><td>5월 가정의 달 배너</td><td className="adm-muted">/category?cat=gift</td><td>메인</td><td>전체</td><td className="adm-muted">05.01</td><td className="adm-muted">05.31</td><td><Toggle defaultOn={true} /></td><td><button className="adm-row-btn">수정</button> <button className="adm-row-btn adm-row-btn-danger">삭제</button></td></tr>
                        <tr><td><div className="adm-order-btns"><button>▲</button><button>▼</button></div></td><td><div className="adm-banner-thumb">🍊</div></td><td>제주 한라봉 시즌 배너</td><td className="adm-muted">/category?cat=citrus</td><td>메인</td><td>모바일</td><td className="adm-muted">05.10</td><td className="adm-muted">상시</td><td><Toggle defaultOn={true} /></td><td><button className="adm-row-btn">수정</button> <button className="adm-row-btn adm-row-btn-danger">삭제</button></td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 팝업 관리 탭 */}
              {bannerTab === 'tab-popup' && (
                <div className="adm-card">
                  <div className="adm-table-wrap">
                    <table className="adm-table">
                      <thead><tr><th>순서</th><th>팝업명</th><th>노출 페이지</th><th>기기</th><th>시작일</th><th>종료일</th><th>다시보지않기</th><th>활성</th><th>관리</th></tr></thead>
                      <tbody>
                        <tr><td><div className="adm-order-btns"><button>▲</button><button>▼</button></div></td><td>신규 회원 웰컴 팝업</td><td>메인</td><td>전체</td><td className="adm-muted">01.01</td><td className="adm-muted">12.31</td><td><Toggle defaultOn={true} /></td><td><Toggle defaultOn={true} /></td><td><button className="adm-row-btn">수정</button> <button className="adm-row-btn adm-row-btn-danger">삭제</button></td></tr>
                        <tr><td><div className="adm-order-btns"><button>▲</button><button>▼</button></div></td><td>여름 과일 이벤트 팝업</td><td>메인</td><td>PC</td><td className="adm-muted">06.01</td><td className="adm-muted">08.31</td><td><Toggle /></td><td><Toggle /></td><td><button className="adm-row-btn">수정</button> <button className="adm-row-btn adm-row-btn-danger">삭제</button></td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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
                  <button className="adm-btn adm-btn-primary">+ 이벤트 등록</button>
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
                              <td>
                                <Link href={`/event/${ev.slug}`} className="adm-row-btn" target="_blank">보기</Link>
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
                  <button className="adm-btn adm-btn-primary">+ 글 등록</button>
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
                            <td>
                              <Link href={`/lounge/${p.id}`} className="adm-row-btn" target="_blank">보기</Link>
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
                  ['전체 회원수', stats ? `${stats.totalMembers.toLocaleString()}명` : '...'],
                  ['이번달 신규', '-'],
                  ['골드 이상', members.filter(m=>['gold','vip','vvip'].includes(m.grade)).length + '명'],
                  ['포인트 보유', members.reduce((s,m)=>s+(m.point_balance||0),0).toLocaleString() + 'P'],
                ].map(([l,v])=>(
                  <div key={l} className="adm-kpi-card">
                    <div className="adm-kpi-label">{l}</div>
                    <div className="adm-kpi-value adm-kpi-value-mt">{v}</div>
                  </div>
                ))}
              </div>
              <div className="adm-toolbar">
                <div className="adm-toolbar-left">
                  <select className="adm-select">
                    <option value="">전체 등급</option>
                    {Object.entries(GRADE_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}
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
                      <thead><tr><th>이름</th><th>이메일</th><th>등급</th><th>적립금</th><th>가입일</th></tr></thead>
                      <tbody>
                        {filteredMembers.length === 0 ? (
                          <tr><td colSpan={5} style={{ textAlign:'center', padding:'40px 0', color:'#94A3B8' }}>
                            {members.length === 0 ? '회원 없음 (create_admin_policies.sql 실행 필요)' : '검색 결과 없음'}
                          </td></tr>
                        ) : filteredMembers.map(m => (
                          <tr key={m.id}>
                            <td>{m.name}</td>
                            <td className="adm-muted" style={{ fontSize:12 }}>{m.email}</td>
                            <td>
                              <span className={`adm-badge ${GRADE_BADGE_CLS[m.grade] || 'badge-normal'}`}>
                                {GRADE_LABEL[m.grade] || m.grade}
                              </span>
                            </td>
                            <td className="adm-mono">{(m.point_balance || 0).toLocaleString()}P</td>
                            <td className="adm-muted">{fmtDateShort(m.created_at)}</td>
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
          {panel === 'referral' && (
            <div className="adm-content">
              <div className="adm-kpi-grid adm-kpi-3 adm-kpi-mb16">
                {[['누적 총 추천 수','1,248건'],['이번달 친구 초대','87건'],['쿠폰 사용 현황','64% 사용']].map(([l,v])=>(
                  <div key={l} className="adm-kpi-card"><div className="adm-kpi-label">{l}</div><div className="adm-kpi-value adm-kpi-value-mt">{v}</div></div>
                ))}
              </div>
              <div className="adm-card">
                <div className="adm-table-wrap">
                  <table className="adm-table">
                    <thead><tr><th>추천인</th><th>피추천인</th><th>가입일</th><th>첫구매 완료</th><th>추천인 쿠폰 지급</th></tr></thead>
                    <tbody>
                      <tr><td colSpan={5} style={{ textAlign:'center', padding:'40px 0', color:'#94A3B8' }}>친구 추천 이력 없음</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ===== SMS 발송 ===== */}
          {panel === 'sms' && (
            <div className="adm-content">
              <div className="adm-row">
                <div className="adm-card adm-card-lg">
                  <div className="adm-card-head"><span className="adm-card-title">SMS 작성</span></div>
                  <div className="adm-form">
                    <div className="adm-form-row"><label className="adm-label">발송 대상</label>
                      <div className="adm-radio-group">
                        {['전체 회원','등급별 (골드·VIP)','특정 구매이력','직접 선택'].map((t,i)=>(
                          <label key={t} className="adm-radio"><input type="radio" name="smsTarget" defaultChecked={i===0} /> {t}</label>
                        ))}
                      </div>
                    </div>
                    <div className="adm-form-row"><label className="adm-label">발신번호</label>
                      <input type="text" className="adm-input-text adm-input-sender" defaultValue="1588-0000" /></div>
                    <div className="adm-form-row"><label className="adm-label">메시지 내용</label>
                      <textarea className="adm-textarea" placeholder="최대 90자 (SMS) / 2,000자 (LMS)" rows={5}
                        onChange={e => setSmsLen(e.target.value.length)} />
                      <div className="adm-char-count"><span>{smsLen}</span> / 90자</div>
                    </div>
                    <div className="adm-form-row"><label className="adm-label">발송 시간</label>
                      <div className="adm-radio-group">
                        <label className="adm-radio"><input type="radio" name="smsTime" defaultChecked /> 즉시 발송</label>
                        <label className="adm-radio"><input type="radio" name="smsTime" /> 예약 발송</label>
                      </div>
                    </div>
                    <div className="adm-form-actions">
                      <button className="adm-btn adm-btn-outline">미리보기</button>
                      <button className="adm-btn adm-btn-primary">발송하기</button>
                    </div>
                  </div>
                </div>
                <div className="adm-card adm-card-sm">
                  <div className="adm-card-head"><span className="adm-card-title">최근 발송 이력</span></div>
                  <div className="adm-sms-history">
                    <div className="adm-muted" style={{ padding:'20px 0', fontSize:13, textAlign:'center' }}>발송 이력 없음</div>
                  </div>
                </div>
              </div>
            </div>
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
                            <tr key={inq.id}>
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

          {/* ===== 정산 관리 ===== */}
          {panel === 'settlement' && (
            <div className="adm-content">
              <div className="adm-kpi-grid adm-kpi-5 adm-kpi-mb16">
                {stats ? [
                  ['총 매출', `${fmtPrice(stats.monthRevenue)}원`],
                  ['이번달 주문', `${stats.monthOrders}건`],
                  ['금일 매출', `${fmtPrice(stats.todayRevenue)}원`],
                  ['쿠폰 할인', '-'],
                  ['포인트 결제', '-'],
                ].map(([l,v])=>(
                  <div key={l} className="adm-kpi-card"><div className="adm-kpi-label">{l}</div><div className="adm-kpi-value adm-kpi-value-mt">{v}</div></div>
                )) : Array(5).fill(0).map((_,i) => <div key={i} className="adm-kpi-card"><div className="adm-kpi-label">-</div><div className="adm-kpi-value adm-kpi-value-mt">...</div></div>)}
              </div>
              <div className="adm-card adm-card-empty">
                정산 관리 기능은 추후 확장 예정입니다.
              </div>
            </div>
          )}

          {/* ===== 취향 프로파일 ===== */}
          {panel === 'tasteprofile' && (
            <div className="adm-content">
              <div className="adm-toolbar">
                <div className="adm-toolbar-left"><input type="text" className="adm-input-text" placeholder="프로파일명 검색" /></div>
                <div className="adm-toolbar-right"><button className="adm-btn adm-btn-primary">+ 프로파일 추가</button></div>
              </div>
              <div className="adm-card">
                <div className="adm-table-wrap">
                  <table className="adm-table">
                    <thead><tr><th>프로파일명</th><th>설명</th><th>연결 상품 수</th><th>설문 연결</th><th>활성</th><th>관리</th></tr></thead>
                    <tbody>
                      <tr><td><strong>달콤한 과일 선호</strong></td><td className="adm-muted">당도 높고 부드러운 과일을 좋아하는 취향</td><td>24개</td><td>Q3, Q5</td><td><Toggle defaultOn={true} /></td><td><button className="adm-row-btn">수정</button></td></tr>
                      <tr><td><strong>새콤한 과일 선호</strong></td><td className="adm-muted">신맛이 있는 상큼한 과일을 좋아하는 취향</td><td>18개</td><td>Q3, Q4</td><td><Toggle defaultOn={true} /></td><td><button className="adm-row-btn">수정</button></td></tr>
                      <tr><td><strong>선물용 구매</strong></td><td className="adm-muted">포장·선물세트 위주로 구매하는 취향</td><td>12개</td><td>Q1, Q2</td><td><Toggle /></td><td><button className="adm-row-btn">수정</button></td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="adm-info-box adm-info-mt10">
                💡 <strong>취향 프로파일</strong>은 설문 응답 결과를 기반으로 자동 분류됩니다.
              </div>
            </div>
          )}

          {/* ===== 설정 ===== */}
          {panel === 'settings' && (
            <div className="adm-content">
              <div className="adm-card adm-card-settings">
                <div className="adm-card-head"><span className="adm-card-title">기본 설정</span></div>
                <div className="adm-form">
                  <div className="adm-form-row"><label className="adm-label">쇼핑몰 이름</label><input type="text" className="adm-input-text" defaultValue="Delio" /></div>
                  <div className="adm-form-row"><label className="adm-label">대표 전화</label><input type="text" className="adm-input-text" defaultValue="1588-0000" /></div>
                  <div className="adm-form-row"><label className="adm-label">기본 수수료율</label>
                    <div className="adm-flex-center-gap"><input type="number" className="adm-input-text adm-input-w100" defaultValue="5" /><span className="adm-muted">%</span></div>
                  </div>
                  <div className="adm-form-row"><label className="adm-label">무료배송 기준</label>
                    <div className="adm-flex-center-gap"><input type="number" className="adm-input-text adm-input-w140" defaultValue="30000" /><span className="adm-muted">원 이상</span></div>
                  </div>
                  <div className="adm-form-actions"><button className="adm-btn adm-btn-primary">저장</button></div>
                </div>
              </div>
            </div>
          )}

        </div>{/* /.adm-main */}
      </div>{/* /.adm-wrap */}
    </div>
  );
}
