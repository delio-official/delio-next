'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import '@/styles/inquiry.css';

type InquiryType = 'listing' | 'collab' | 'other';

const TYPES: { value: InquiryType; icon: string; name: string; sub: string }[] = [
  { value: 'listing', icon: '🌾', name: '입점 문의',  sub: '델리오 파트너 농가로 입점' },
  { value: 'collab',  icon: '🤝', name: '협업 문의',  sub: '브랜드 · 유통 협업 제안' },
  { value: 'other',   icon: '💬', name: '기타 문의',  sub: '그 외 궁금한 사항' },
];

const PROCESS = [
  { icon: '📝', step: '01', label: '문의 접수',    desc: '양식 작성 후 제출' },
  { icon: '🔍', step: '02', label: '내부 검토',    desc: '1~3 영업일 이내' },
  { icon: '📞', step: '03', label: '담당자 연락',  desc: '이메일 · 전화 회신' },
  { icon: '🚀', step: '04', label: '파트너십 시작', desc: '계약 및 온보딩' },
];

const WHY = [
  { icon: '📊', title: '데이터 기반 매칭',   desc: '취향 진단 데이터로 내 농산물에 맞는 고객을 직접 연결합니다.' },
  { icon: '🚚', title: '산지 직송 시스템',   desc: '복잡한 중간 유통 없이 산지에서 소비자에게 직배송합니다.' },
  { icon: '💰', title: '합리적인 수수료',    desc: '업계 최저 수준의 수수료로 농가 수익을 극대화합니다.' },
  { icon: '📦', title: '빠른 온보딩',        desc: '서류 제출부터 판매 시작까지 평균 7일 이내에 완료됩니다.' },
];

export default function InquiryClient() {
  const router = useRouter();
  const [type,    setType]    = useState<InquiryType>('listing');
  const [company, setCompany] = useState('');
  const [contact, setContact] = useState('');
  const [email,   setEmail]   = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!company.trim() || !contact.trim() || !email.trim() || !message.trim()) {
      alert('모든 필수 항목을 입력해주세요.'); return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from('farm_inquiries').insert({
      inquiry_type: type, company, contact, email, message,
    });
    setLoading(false);
    if (error) { alert('문의 등록에 실패했습니다. 다시 시도해주세요.'); return; }
    setDone(true);
  }

  /* ── 완료 화면 ── */
  if (done) {
    return (
      <div style={{ minHeight:'80vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#FAFAF8', padding:'40px 20px' }}>
        <div style={{ maxWidth:460, width:'100%', background:'#fff', borderRadius:20, padding:'48px 36px', textAlign:'center', boxShadow:'0 4px 32px rgba(0,0,0,0.07)' }}>
          <div style={{ width:72, height:72, borderRadius:'50%', background:'#22C55E', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
            <svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h2 style={{ fontSize:22, fontWeight:800, marginBottom:10 }}>문의가 접수되었습니다!</h2>
          <p style={{ fontSize:14, color:'#666', lineHeight:1.8, marginBottom:8 }}>
            담당자가 확인 후 영업일 기준 1~3일 이내에<br />
            전화 또는 이메일로 연락드립니다.
          </p>
          <p style={{ fontSize:12, color:'#bbb', marginBottom:32 }}>빠른 검토를 원하시면 카카오 채널 @델리오로 연락 주세요.</p>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={() => router.push('/')}
              style={{ flex:1, padding:'13px', border:'1.5px solid #EBEBEB', borderRadius:10, background:'#fff', fontSize:14, fontWeight:600, cursor:'pointer', color:'#666' }}>
              홈으로
            </button>
            <button onClick={() => { setDone(false); setCompany(''); setContact(''); setEmail(''); setMessage(''); }}
              style={{ flex:1, padding:'13px', border:'none', borderRadius:10, background:'#1A1A1A', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>
              추가 문의하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── 메인 레이아웃 ── */
  return (
    <div style={{ background:'#FAFAF8', minHeight:'100vh', paddingBottom:80 }}>

      {/* ── 히어로 ── */}
      <div style={{ background:'linear-gradient(135deg,#F4EFE6 0%,#EDE8DC 100%)', borderBottom:'1px solid #E8E2D8', padding:'48px 0 36px' }}>
        <div className="container">
          <p style={{ fontSize:11, color:'#A08060', fontWeight:700, letterSpacing:2, marginBottom:8 }}>PARTNER WITH DELIO</p>
          <h1 style={{ fontSize:'clamp(24px,4vw,34px)', fontWeight:800, marginBottom:10, color:'#1A1A1A' }}>
            입점 / 협업 문의
          </h1>
          <p style={{ fontSize:14, color:'#666', lineHeight:1.7, marginBottom:16 }}>
            좋은 농산물을 키우고 계신가요?<br />
            델리오와 함께 더 많은 소비자에게 소개해보세요.
          </p>
          <div style={{ fontSize:12, color:'#aaa' }}>
            <Link href="/" style={{ color:'#aaa', textDecoration:'none' }}>홈</Link>
            <span style={{ margin:'0 6px' }}>/</span>
            <span style={{ color:'#555' }}>입점/협업 문의</span>
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop:36 }}>
        <div className="inq-grid">

          {/* ════ 왼쪽: 폼 ════ */}
          <div>
            <form onSubmit={handleSubmit}>

              {/* 문의 유형 */}
              <div style={{ background:'#fff', borderRadius:16, padding:'24px', marginBottom:16, border:'1px solid #EFEFED' }}>
                <div style={{ fontSize:15, fontWeight:800, marginBottom:4 }}>문의 유형 선택</div>
                <div style={{ fontSize:12, color:'#999', marginBottom:16 }}>해당하는 문의 유형을 선택해주세요.</div>
                <div className="inq-type-row">
                  {TYPES.map(t => (
                    <button type="button" key={t.value}
                      className={`inq-type-btn${type === t.value ? ' active' : ''}`}
                      onClick={() => setType(t.value)}>
                      <span className="inq-type-icon">{t.icon}</span>
                      <span className="inq-type-name">{t.name}</span>
                      <span className="inq-type-sub">{t.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 기본 정보 */}
              <div style={{ background:'#fff', borderRadius:16, padding:'24px', marginBottom:16, border:'1px solid #EFEFED' }}>
                <div style={{ fontSize:15, fontWeight:800, marginBottom:18 }}>기본 정보</div>

                <div className="inq-field">
                  <label>업체명 / 농장명 <span style={{ color:'var(--color-accent)', fontSize:10 }}>*필수</span></label>
                  <input className="inq-input" type="text" placeholder="예: 서귀포 감귤 농원"
                    value={company} onChange={e => setCompany(e.target.value)} />
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div className="inq-field" style={{ marginBottom:0 }}>
                    <label>담당자 연락처 <span style={{ color:'var(--color-accent)', fontSize:10 }}>*필수</span></label>
                    <input className="inq-input" type="tel" placeholder="010-0000-0000"
                      value={contact} onChange={e => setContact(e.target.value)} />
                  </div>
                  <div className="inq-field" style={{ marginBottom:0 }}>
                    <label>이메일 <span style={{ color:'var(--color-accent)', fontSize:10 }}>*필수</span></label>
                    <input className="inq-input" type="email" placeholder="example@email.com"
                      value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* 문의 내용 */}
              <div style={{ background:'#fff', borderRadius:16, padding:'24px', marginBottom:16, border:'1px solid #EFEFED' }}>
                <div style={{ fontSize:15, fontWeight:800, marginBottom:4 }}>문의 내용</div>
                <div style={{ fontSize:12, color:'#999', marginBottom:16 }}>
                  {type === 'listing' && '농산물 종류, 연간 생산량, 판매 희망 가격대 등을 기재해 주시면 빠른 검토가 가능합니다.'}
                  {type === 'collab'  && '협업 희망 형태, 브랜드 소개, 제안 내용 등을 자유롭게 작성해 주세요.'}
                  {type === 'other'   && '문의하실 내용을 자유롭게 작성해 주세요.'}
                </div>
                <div className="inq-field" style={{ marginBottom:4 }}>
                  <label>문의 내용 <span style={{ color:'var(--color-accent)', fontSize:10 }}>*필수</span></label>
                  <textarea className="inq-textarea" rows={6}
                    placeholder={
                      type === 'listing'
                        ? '예) 제주 천혜향 농가입니다. 연간 생산량 약 10톤, 가격대 2~3만원대 희망합니다...'
                        : type === 'collab'
                        ? '예) B2B 도매 납품 관련 협업 제안드립니다...'
                        : '문의 내용을 입력해주세요.'
                    }
                    value={message} onChange={e => setMessage(e.target.value)} />
                  <div className="char-cnt">{message.length} / 1000</div>
                </div>
              </div>

              {/* 제출 버튼 */}
              <button type="submit" className="btn-inq-submit" disabled={loading}
                style={{ fontSize:15 }}>
                {loading ? '접수 중...' : '문의 접수하기'}
              </button>

              <p style={{ fontSize:11, color:'#bbb', textAlign:'center', marginTop:12, lineHeight:1.6 }}>
                접수된 문의는 영업일 기준 1~3일 이내에 전화 또는 이메일로 연락드립니다.
              </p>
            </form>
          </div>

          {/* ════ 오른쪽: 정보 패널 ════ */}
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

            {/* 왜 델리오인가 */}
            <div style={{ background:'#fff', borderRadius:16, padding:'24px', border:'1px solid #EFEFED' }}>
              <div style={{ fontSize:15, fontWeight:800, marginBottom:4 }}>왜 델리오 파트너인가요?</div>
              <div style={{ fontSize:12, color:'#999', marginBottom:18 }}>파트너 농가에게 드리는 혜택</div>
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {WHY.map(w => (
                  <div key={w.title} style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                    <div style={{ width:40, height:40, borderRadius:10, background:'var(--color-accent-bg)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                      {w.icon}
                    </div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, marginBottom:2 }}>{w.title}</div>
                      <div style={{ fontSize:12, color:'#888', lineHeight:1.6 }}>{w.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 입점 프로세스 */}
            <div style={{ background:'#fff', borderRadius:16, padding:'24px', border:'1px solid #EFEFED' }}>
              <div style={{ fontSize:15, fontWeight:800, marginBottom:18 }}>입점 프로세스</div>
              <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                {PROCESS.map((p, i) => (
                  <div key={p.step} style={{ display:'flex', gap:14, alignItems:'flex-start', paddingBottom: i < PROCESS.length - 1 ? 16 : 0, position:'relative' }}>
                    {/* 연결선 */}
                    {i < PROCESS.length - 1 && (
                      <div style={{ position:'absolute', left:19, top:38, width:2, height:'calc(100% - 38px)', background:'#F0EDE8', borderRadius:2 }} />
                    )}
                    <div style={{ width:38, height:38, borderRadius:'50%', background:'var(--color-accent-bg)', border:'2px solid var(--color-accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0, zIndex:1 }}>
                      {p.icon}
                    </div>
                    <div style={{ paddingTop:4 }}>
                      <div style={{ fontSize:10, color:'var(--color-accent)', fontWeight:800, letterSpacing:1, marginBottom:1 }}>STEP {p.step}</div>
                      <div style={{ fontSize:13, fontWeight:700, marginBottom:1 }}>{p.label}</div>
                      <div style={{ fontSize:12, color:'#999' }}>{p.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 빠른 연락 채널 */}
            <div style={{ background:'#fff', borderRadius:16, padding:'24px', border:'1px solid #EFEFED' }}>
              <div style={{ fontSize:15, fontWeight:800, marginBottom:4 }}>빠른 연락 채널</div>
              <div style={{ fontSize:12, color:'#999', marginBottom:16 }}>양식 대신 직접 연락하셔도 됩니다.</div>
              <div className="quick-channels">
                <button className="quick-ch kakao" onClick={() => alert('카카오 채널: @델리오')}>
                  <span className="quick-ch-icon">
                    {/* 카카오톡 공식 아이콘 */}
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect width="28" height="28" rx="8" fill="#FEE500"/>
                      <path d="M14 6C9.03 6 5 9.24 5 13.22c0 2.55 1.66 4.79 4.17 6.1l-.9 3.35a.3.3 0 0 0 .44.33l3.9-2.57c.44.06.9.09 1.39.09 4.97 0 9-3.24 9-7.22C23 9.24 18.97 6 14 6Z" fill="#3C1E1E"/>
                    </svg>
                  </span>
                  <div className="quick-ch-name">카카오 채널</div>
                  <div className="quick-ch-sub">@델리오</div>
                </button>
                <button className="quick-ch faq" onClick={() => window.location.href = 'mailto:partner@delio.co.kr'}>
                  <span className="quick-ch-icon">📧</span>
                  <div className="quick-ch-name">이메일</div>
                  <div className="quick-ch-sub">partner@delio.co.kr</div>
                </button>
              </div>
              <div style={{ marginTop:14, padding:'12px 14px', background:'#F7F7F5', borderRadius:10, fontSize:12, color:'#888', lineHeight:1.7 }}>
                📞 전화 문의: 070-8064-3601<br />
                평일 09:00 ~ 18:00 (점심 12~13시 제외)
              </div>
            </div>

          </div>
          {/* /오른쪽 */}

        </div>
        {/* /inq-grid */}
      </div>
    </div>
  );
}
