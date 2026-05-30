'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import '@/styles/inquiry.css';

type CsCategory = 'order' | 'return' | 'product' | 'member' | 'other';
type TabType = 'write' | 'history';

const CATEGORIES: { value: CsCategory; icon: string; name: string; sub: string }[] = [
  { value: 'order',   icon: '🚚', name: '주문/배송',       sub: '배송 조회 · 배송지 변경' },
  { value: 'return',  icon: '↩️', name: '취소/교환/반품',  sub: '취소 · 반품 · 교환 신청' },
  { value: 'product', icon: '🌿', name: '상품 문의',        sub: '상품 정보 · 재고 · 품질' },
  { value: 'member',  icon: '👤', name: '회원/포인트',      sub: '계정 · 포인트 · 쿠폰' },
  { value: 'other',   icon: '💬', name: '기타',             sub: '그 외 궁금한 사항' },
];

const STATUS_LABEL: Record<string, string> = {
  pending: '답변 대기',
  answered: '답변 완료',
};

interface Inquiry {
  id: string;
  category: CsCategory;
  title: string;
  message: string;
  status: string;
  answer?: string;
  created_at: string;
}

export default function CsClient() {
  const [tab, setTab] = useState<TabType>('write');
  const [category, setCategory] = useState<CsCategory>('order');
  const [title, setTitle]       = useState('');
  const [message, setMessage]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [openId, setOpenId]     = useState<string | null>(null);
  const [user, setUser]         = useState<{ id: string; email: string } | null>(null);

  // 로그인 사용자 확인
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser({ id: data.user.id, email: data.user.email ?? '' });
    });
  }, []);

  // 문의 내역 로드
  useEffect(() => {
    if (tab !== 'history' || !user) return;
    const supabase = createClient();
    supabase
      .from('cs_inquiries')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setInquiries((data as Inquiry[]) ?? []));
  }, [tab, user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      alert('제목과 문의 내용을 입력해주세요.'); return;
    }
    if (!user) {
      alert('로그인이 필요합니다.'); return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from('cs_inquiries').insert({
      user_id: user.id,
      category,
      title: title.trim(),
      message: message.trim(),
      status: 'pending',
    });
    setLoading(false);
    if (error) { alert('문의 등록에 실패했습니다. 다시 시도해주세요.'); return; }
    setDone(true);
  }

  function resetForm() {
    setDone(false); setTitle(''); setMessage(''); setCategory('order');
  }

  /* ── 완료 화면 ── */
  if (done) {
    return (
      <div style={{ minHeight:'80vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#FAFAF8', padding:'40px 20px' }}>
        <div style={{ maxWidth:460, width:'100%', background:'#fff', borderRadius:20, padding:'48px 36px', textAlign:'center', boxShadow:'0 4px 32px rgba(0,0,0,0.07)' }}>
          <div style={{ width:72, height:72, borderRadius:'50%', background:'#E8F5E9', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', fontSize:32 }}>✅</div>
          <h2 style={{ fontSize:22, fontWeight:800, marginBottom:10 }}>문의가 접수되었습니다!</h2>
          <p style={{ fontSize:14, color:'#666', lineHeight:1.8, marginBottom:8 }}>
            영업일 기준 <strong>1~2일 이내</strong>에 답변 드립니다.<br />
            답변은 마이페이지 &gt; 1:1 문의에서 확인 가능합니다.
          </p>
          <p style={{ fontSize:12, color:'#bbb', marginBottom:32 }}>급한 문의는 카카오 채널 @델리오로 연락 주세요.</p>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={() => setTab('history')}
              style={{ flex:1, padding:'13px', border:'1.5px solid #EBEBEB', borderRadius:10, background:'#fff', fontSize:14, fontWeight:600, cursor:'pointer', color:'#666' }}>
              문의 내역 보기
            </button>
            <button onClick={resetForm}
              style={{ flex:1, padding:'13px', border:'none', borderRadius:10, background:'#1A1A1A', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>
              추가 문의하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background:'#FAFAF8', minHeight:'100vh', paddingBottom:80 }}>

      {/* 히어로 */}
      <div style={{ background:'#fff', borderBottom:'1px solid #EBEBEB', padding:'40px 0 28px' }}>
        <div className="container">
          <p style={{ fontSize:11, color:'#aaa', fontWeight:700, letterSpacing:2, marginBottom:8 }}>CUSTOMER SERVICE</p>
          <h1 style={{ fontSize:'clamp(22px,4vw,30px)', fontWeight:800, marginBottom:8, color:'#1A1A1A' }}>
            1:1 문의
          </h1>
          <p style={{ fontSize:13, color:'#888', lineHeight:1.7, marginBottom:16 }}>
            주문·배송·상품 관련 궁금한 점을 남겨 주세요.<br />
            영업일 기준 1~2일 내 답변 드립니다.
          </p>
          <div style={{ fontSize:12, color:'#aaa' }}>
            <Link href="/" style={{ color:'#aaa', textDecoration:'none' }}>홈</Link>
            <span style={{ margin:'0 6px' }}>/</span>
            <span style={{ color:'#555' }}>1:1 문의</span>
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop:28 }}>
        <div className="inq-grid">

          {/* ════ 왼쪽: 탭 + 폼/내역 ════ */}
          <div>

            {/* 탭 */}
            <div className="inq-tabs">
              <div className={`inq-tab${tab === 'write' ? ' active' : ''}`}
                onClick={() => { setTab('write'); setDone(false); }}>
                ✏️ 문의하기
              </div>
              <div className={`inq-tab${tab === 'history' ? ' active' : ''}`}
                onClick={() => setTab('history')}>
                📋 문의 내역
              </div>
            </div>

            {/* ── 문의하기 패널 ── */}
            <div className={`inq-panel${tab === 'write' ? ' active' : ''}`}>
              <form onSubmit={handleSubmit}>

                {/* 유형 선택 */}
                <div className="inq-field">
                  <label>문의 유형 <span className="inq-label-required">필수</span></label>
                  <div className="inq-type-row" style={{ marginBottom:0 }}>
                    {CATEGORIES.map(c => (
                      <button type="button" key={c.value}
                        className={`inq-type-btn${category === c.value ? ' active' : ''}`}
                        onClick={() => setCategory(c.value)}>
                        <span className="inq-type-icon">{c.icon}</span>
                        <span className="inq-type-name">{c.name}</span>
                        <span className="inq-type-sub">{c.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 제목 */}
                <div className="inq-field">
                  <label>제목 <span className="inq-label-required">필수</span></label>
                  <input className="inq-input" type="text"
                    placeholder="문의 제목을 입력해주세요"
                    value={title} onChange={e => setTitle(e.target.value)} />
                </div>

                {/* 내용 */}
                <div className="inq-field">
                  <label>문의 내용 <span className="inq-label-required">필수</span></label>
                  <textarea className="inq-textarea" rows={6}
                    placeholder={
                      category === 'order'   ? '주문번호, 상품명, 배송 관련 문의 내용을 입력해주세요.' :
                      category === 'return'  ? '주문번호, 취소·교환·반품 사유를 입력해주세요.' :
                      category === 'product' ? '상품명, 궁금한 점을 입력해주세요.' :
                      category === 'member'  ? '회원 정보, 포인트, 쿠폰 관련 문의 내용을 입력해주세요.' :
                      '문의 내용을 자유롭게 입력해주세요.'
                    }
                    value={message} onChange={e => setMessage(e.target.value)} />
                  <div className="char-cnt">{message.length} / 1000</div>
                </div>

                {/* 제출 */}
                <button type="submit" className="btn-inq-submit" disabled={loading}>
                  {loading ? '⏳ 접수 중...' : '문의 접수하기 →'}
                </button>

                {!user && (
                  <p style={{ fontSize:12, color:'#E53935', textAlign:'center', marginTop:10 }}>
                    ⚠️ 로그인 후 문의를 접수할 수 있습니다.{' '}
                    <Link href="/login" style={{ color:'#1A1A1A', fontWeight:700 }}>로그인하기</Link>
                  </p>
                )}
              </form>
            </div>

            {/* ── 문의 내역 패널 ── */}
            <div className={`inq-panel${tab === 'history' ? ' active' : ''}`}>
              <div className="inq-history-title">나의 문의 내역</div>

              {!user ? (
                <div style={{ textAlign:'center', padding:'40px 0', color:'#aaa', fontSize:14 }}>
                  로그인 후 문의 내역을 확인할 수 있습니다.<br />
                  <Link href="/login" style={{ color:'#1A1A1A', fontWeight:700, marginTop:12, display:'inline-block' }}>로그인하기 →</Link>
                </div>
              ) : inquiries.length === 0 ? (
                <div style={{ textAlign:'center', padding:'40px 0', color:'#aaa', fontSize:14 }}>
                  아직 문의 내역이 없습니다.
                </div>
              ) : (
                inquiries.map(inq => {
                  const cat = CATEGORIES.find(c => c.value === inq.category);
                  const isOpen = openId === inq.id;
                  return (
                    <div key={inq.id}
                      className={`inq-list-item${isOpen ? ' open' : ''}`}
                      onClick={() => setOpenId(isOpen ? null : inq.id)}>
                      <div className="inq-list-top">
                        <span className="inq-list-cat">{cat?.name ?? inq.category}</span>
                        <span className="inq-list-title">{inq.title}</span>
                        <span className={`inq-list-status ${inq.status === 'answered' ? 'status-done' : 'status-wait'}`}>
                          {STATUS_LABEL[inq.status] ?? inq.status}
                        </span>
                      </div>
                      <div className="inq-list-bottom">
                        <span className="inq-list-date">
                          {new Date(inq.created_at).toLocaleDateString('ko-KR')}
                        </span>
                        <span className="inq-list-preview">
                          {inq.message.slice(0, 30)}{inq.message.length > 30 ? '...' : ''}
                        </span>
                      </div>
                      {isOpen && (
                        <div className="inq-reply">
                          <div className="inq-reply-header">📝 문의 내용</div>
                          <p style={{ marginBottom: inq.answer ? 12 : 0, whiteSpace:'pre-wrap' }}>{inq.message}</p>
                          {inq.answer && (
                            <>
                              <div className="inq-reply-header" style={{ marginTop:12 }}>💬 답변</div>
                              <p style={{ whiteSpace:'pre-wrap' }}>{inq.answer}</p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

          </div>

          {/* ════ 오른쪽: 안내 패널 ════ */}
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

            {/* 운영 시간 */}
            <div className="inq-card">
              <div className="inq-card-head">고객센터 운영 안내</div>
              <div className="inq-card-body" style={{ fontSize:13, lineHeight:2, color:'#555' }}>
                <div>📅 평일 <strong>09:00 ~ 18:00</strong></div>
                <div style={{ fontSize:12, color:'#aaa' }}>점심 12:00 ~ 13:00 제외</div>
                <div style={{ marginTop:8 }}>📵 주말 · 공휴일 휴무</div>
                <div style={{ marginTop:8, fontSize:12, color:'#888' }}>
                  접수된 문의는 영업일 기준<br />1~2일 이내 이메일로 답변드립니다.
                </div>
              </div>
            </div>

            {/* 빠른 채널 */}
            <div className="inq-card">
              <div className="inq-card-head">빠른 문의 채널</div>
              <div className="inq-card-body">
                <div className="quick-channels">
                  <button className="quick-ch kakao" onClick={() => alert('카카오 채널: @델리오')}>
                    <span className="quick-ch-icon">
                      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                        <rect width="28" height="28" rx="8" fill="#FEE500"/>
                        <path d="M14 6C9.03 6 5 9.24 5 13.22c0 2.55 1.66 4.79 4.17 6.1l-.9 3.35a.3.3 0 0 0 .44.33l3.9-2.57c.44.06.9.09 1.39.09 4.97 0 9-3.24 9-7.22C23 9.24 18.97 6 14 6Z" fill="#3C1E1E"/>
                      </svg>
                    </span>
                    <div className="quick-ch-name">카카오톡</div>
                    <div className="quick-ch-sub">@델리오</div>
                  </button>
                  <button className="quick-ch faq" onClick={() => window.location.href='mailto:cs@delio.co.kr'}>
                    <span className="quick-ch-icon">📧</span>
                    <div className="quick-ch-name">이메일</div>
                    <div className="quick-ch-sub">cs@delio.co.kr</div>
                  </button>
                </div>
              </div>
            </div>

            {/* 자주 묻는 질문 */}
            <div className="inq-card">
              <div className="inq-card-head">자주 묻는 질문</div>
              <div className="inq-card-sub">문의 전 먼저 확인해보세요</div>
              <div className="inq-card-body" style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {[
                  '배송은 얼마나 걸리나요?',
                  '취소/반품은 어떻게 하나요?',
                  '쿠폰은 어디서 확인하나요?',
                  '포인트는 어떻게 사용하나요?',
                ].map((q, i) => (
                  <Link key={i} href="/faq"
                    style={{ fontSize:13, color:'#444', padding:'9px 12px', background:'#F7F7F5', borderRadius:8, display:'block', textDecoration:'none', transition:'background .15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#EFEFED')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#F7F7F5')}>
                    💬 {q}
                  </Link>
                ))}
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
