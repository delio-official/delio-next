'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signUp, signIn } from '@/lib/auth';
import { createClient } from '@/lib/supabase';
import '@/styles/signup.css';

/* 비밀번호 보기/숨기기 눈 토글 (입력칸 우측) */
function PwEye({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} aria-label={shown ? '비밀번호 숨기기' : '비밀번호 표시'} tabIndex={-1}
      style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
        background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#9AA0A6',
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {shown ? (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
          <path d="M6.61 6.61A18.45 18.45 0 0 0 2 12s3 8 10 8a9.12 9.12 0 0 0 5.39-1.61" />
          <line x1="2" y1="2" x2="22" y2="22" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
}

/* 원형 체크박스 */
function CircleCheck({ on, onClick, sm }: { on: boolean; onClick: (e?: React.MouseEvent) => void; sm?: boolean }) {
  return (
    <div className={`cc${sm ? ' cc-sm' : ''}${on ? ' on' : ''}`} onClick={onClick}>
      <svg viewBox="0 0 24 24" width={sm ? 10 : 12} height={sm ? 10 : 12}
        fill="none" stroke="#fff" strokeWidth="2.8">
        <polyline points="4 12 9 17 20 7" />
      </svg>
    </div>
  );
}

export default function SignupClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get('next') || '/';

  /* ── 기본 필드 ── */
  const [name, setName] = useState('');
  const [emailUser, setEmailUser] = useState('');
  const [emailDomain, setEmailDomain] = useState('');
  const [emailChecked, setEmailChecked] = useState(false);
  const [emailCheckMsg, setEmailCheckMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [emailDirect, setEmailDirect] = useState('');
  const [showDirect, setShowDirect] = useState(false);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('other');
  const [birthY, setBirthY] = useState('');
  const [birthM, setBirthM] = useState('');
  const [birthD, setBirthD] = useState('');
  const [refCode, setRefCode] = useState('');
  const [showRef, setShowRef] = useState(false);

  /* 초대 링크(?ref=코드)로 들어오면 추천코드 자동 입력 + 펼침
     · ?preview=done → 가입 안 해도 완료화면 미리보기 */
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const r = sp.get('ref');
    if (r) { setRefCode(r); setShowRef(true); }
    if (sp.get('preview') === 'done') setDone(true);
  }, []);

  /* 회원가입 쿠폰 금액 (관리자 설정값) */
  const [welcomeAmount, setWelcomeAmount] = useState(0);
  useEffect(() => {
    createClient().from('site_settings').select('value').eq('key', 'signup_coupon').maybeSingle()
      .then(({ data }) => { if (data?.value) setWelcomeAmount(Number(data.value) || 0); });
  }, []);

  /* ── 약관 ── */
  const [t1, setT1] = useState(false);  // 이용약관 (필수)
  const [t2, setT2] = useState(false);  // 개인정보 (필수)
  const [t3, setT3] = useState(false);  // 마케팅 (선택)
  const [t4, setT4] = useState(false);  // 혜택/정보 (선택)
  const [t4s, setT4s] = useState(false); // 혜택 - 문자
  const [t4e, setT4e] = useState(false); // 혜택 - 이메일
  const [t5, setT5] = useState(false);  // 만 14세 (필수)

  /* ── 완료 오버레이 ── */
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  /* 완료 오버레이가 뜨면 뒤 페이지 스크롤 잠금 (스크롤바 중복 방지) */
  useEffect(() => {
    if (!done) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [done]);

  /* ── 필드별 에러 ── */
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const fBmRef = useRef<HTMLInputElement>(null);
  const fBdRef = useRef<HTMLInputElement>(null);

  /* 자동 스크롤용 row refs */
  const rowNameRef  = useRef<HTMLDivElement>(null);
  const rowEmailRef = useRef<HTMLDivElement>(null);
  const rowPwRef    = useRef<HTMLDivElement>(null);
  const rowPw2Ref   = useRef<HTMLDivElement>(null);
  const rowTermsRef = useRef<HTMLDivElement>(null);

  /* 전체 동의 */
  const allOn = t1 && t2 && t3 && t4 && t4s && t4e && t5;
  function toggleAll() {
    const v = !allOn;
    setT1(v); setT2(v); setT3(v); setT4(v); setT4s(v); setT4e(v); setT5(v);
    if (fieldErrors.terms) setFieldErrors(p => ({ ...p, terms: '' }));
  }

  /* 도메인 셀렉트 */
  function onDomainChange(val: string) {
    if (val === 'direct') {
      setEmailDomain('');
      setShowDirect(true);
    } else {
      setEmailDomain(val);
      setShowDirect(false);
    }
  }

  function getEmail() {
    const domain = showDirect ? emailDirect.trim() : emailDomain;
    if (!emailUser.trim() || !domain) return '';
    return `${emailUser.trim()}@${domain}`;
  }

  /* 이메일 입력 변경 시 중복확인 상태 초기화 */
  function resetEmailCheck() {
    if (emailChecked || emailCheckMsg) { setEmailChecked(false); setEmailCheckMsg(null); }
  }

  /* 이메일 중복확인 */
  const [emailChecking, setEmailChecking] = useState(false);
  async function checkEmailDup() {
    const full = getEmail();
    if (!full || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(full)) {
      setEmailChecked(false); setEmailCheckMsg({ ok: false, text: '이메일을 정확히 입력해주세요.' }); return;
    }
    setEmailChecking(true);
    const { data } = await createClient().from('profiles').select('id').eq('email', full).maybeSingle();
    setEmailChecking(false);
    if (data) { setEmailChecked(false); setEmailCheckMsg({ ok: false, text: '이미 가입된 이메일입니다.' }); }
    else { setEmailChecked(true); setEmailCheckMsg({ ok: true, text: '사용 가능한 이메일입니다.' }); }
  }

  /* 유효성 */
  const pwOk = pw.length >= 8;
  const pw2Ok = pw === pw2 && pw2.length > 0;

  /* 비밀번호 강도 */
  function getPwStrength(p: string): { level: 0 | 1 | 2 | 3; label: string; color: string } {
    if (p.length === 0) return { level: 0, label: '', color: '' };
    let score = 0;
    if (p.length >= 8)  score++;
    if (p.length >= 12) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^a-zA-Z0-9]/.test(p)) score++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
    if (score <= 1) return { level: 1, label: '약함',  color: '#EF4444' };
    if (score <= 3) return { level: 2, label: '보통',  color: '#F59E0B' };
    return              { level: 3, label: '강함',  color: '#22C55E' };
  }
  const pwStrength = getPwStrength(pw);

  async function completeSignup() {
    const email = getEmail();
    const errs: Record<string, string> = {};
    let firstRef: React.RefObject<HTMLDivElement | null> | null = null;

    if (!name.trim()) {
      errs.name = '이름을 입력해주세요.';
      if (!firstRef) firstRef = rowNameRef;
    }
    if (!email) {
      errs.email = '이메일을 입력해주세요.';
      if (!firstRef) firstRef = rowEmailRef;
    } else if (!emailChecked) {
      errs.email = '이메일 중복확인을 해주세요.';
      if (!firstRef) firstRef = rowEmailRef;
    }
    if (!pwOk) {
      errs.pw = '비밀번호를 8자 이상 입력해주세요.';
      if (!firstRef) firstRef = rowPwRef;
    }
    if (!pw2Ok) {
      errs.pw2 = '비밀번호가 일치하지 않습니다.';
      if (!firstRef) firstRef = rowPw2Ref;
    }
    if (!t1 || !t2 || !t5) {
      errs.terms = '필수 약관에 동의해주세요.';
      if (!firstRef) firstRef = rowTermsRef;
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      if (firstRef?.current) {
        const top = firstRef.current.getBoundingClientRect().top + window.scrollY - 90;
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      }
      return;
    }

    setFieldErrors({});
    setLoading(true);
    setError('');
    const { error: err } = await signUp(email, pw, name.trim(), refCode.trim() || undefined, phone.trim() || undefined, t4s, t4e);
    if (err) {
      setLoading(false);
      if (err.message.includes('already')) setError('이미 가입된 이메일입니다.');
      else setError(err.message);
    } else {
      // 가입 성공 → 자동 로그인 (세션 확실히 확보)
      await signIn(email, pw);
      // 가입 환영 알림톡 1회 발송 (세션 확보 후)
      fetch('/api/auth/welcome', { method: 'POST' }).catch(() => {});
      setLoading(false);
      setDone(true);
    }
  }

  return (
    <>
      <div className="su-wrap">
        <h1 className="su-title">회원가입</h1>
        <p className="su-required-note"><em>*</em> 필수입력사항</p>

        <div className="su-form">

          {/* 이름 */}
          <div className="su-row" ref={rowNameRef}>
            <div className="su-lbl">이름<em>*</em></div>
            <div className="su-ctrl">
              <input type="text" className={`su-input${fieldErrors.name ? ' su-err' : ''}`} placeholder="이름을 입력해주세요"
                value={name} onChange={e => { setName(e.target.value); if (fieldErrors.name) setFieldErrors(p => ({ ...p, name: '' })); }} />
              {fieldErrors.name && <div className="su-field-error">{fieldErrors.name}</div>}
            </div>
          </div>

          {/* 이메일 */}
          <div className="su-row" ref={rowEmailRef}>
            <div className="su-lbl">이메일<em>*</em></div>
            <div className="su-ctrl">
              <div className="su-email-row">
                <input type="text" className={`su-input${fieldErrors.email ? ' su-err' : ''}`} placeholder="예: delio"
                  value={emailUser} onChange={e => { setEmailUser(e.target.value); resetEmailCheck(); if (fieldErrors.email) setFieldErrors(p => ({ ...p, email: '' })); }} />
                <span className="su-at">@</span>
                {showDirect && (
                  <input type="text" className="su-input su-domain-direct" placeholder="직접 입력"
                    value={emailDirect} onChange={e => { setEmailDirect(e.target.value); resetEmailCheck(); if (fieldErrors.email) setFieldErrors(p => ({ ...p, email: '' })); }} />
                )}
                <select className="su-domain-select" defaultValue=""
                  onChange={e => { onDomainChange(e.target.value); resetEmailCheck(); }}>
                  <option value="">선택하기</option>
                  <option value="gmail.com">gmail.com</option>
                  <option value="naver.com">naver.com</option>
                  <option value="kakao.com">kakao.com</option>
                  <option value="hanmail.net">hanmail.net</option>
                  <option value="daum.net">daum.net</option>
                  <option value="nate.com">nate.com</option>
                  <option value="icloud.com">icloud.com</option>
                  <option value="direct">직접입력</option>
                </select>
                <button type="button" className="su-email-check" onClick={checkEmailDup} disabled={emailChecking}>
                  {emailChecking ? '확인중' : '중복확인'}
                </button>
              </div>
              {emailCheckMsg && <div className={`su-hint ${emailCheckMsg.ok ? 'ok' : 'err'}`}>{emailCheckMsg.text}</div>}
              {fieldErrors.email && <div className="su-field-error">{fieldErrors.email}</div>}
            </div>
          </div>

          {/* 비밀번호 */}
          <div className="su-row" ref={rowPwRef}>
            <div className="su-lbl">비밀번호<em>*</em></div>
            <div className="su-ctrl">
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'} className={`su-input${fieldErrors.pw ? ' su-err' : ''}`} placeholder="8자 이상 입력해주세요"
                  style={{ paddingRight: 44 }}
                  value={pw} onChange={e => { setPw(e.target.value); if (fieldErrors.pw) setFieldErrors(p => ({ ...p, pw: '' })); }} />
                <PwEye shown={showPw} onToggle={() => setShowPw(v => !v)} />
              </div>
              {pw.length > 0 && (
                <>
                  {/* 강도 바 */}
                  <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                    {([1, 2, 3] as const).map(lv => (
                      <div key={lv} style={{
                        flex: 1, height: 4, borderRadius: 2,
                        background: pwStrength.level >= lv ? pwStrength.color : '#E5E7EB',
                        transition: 'background .2s',
                      }} />
                    ))}
                  </div>
                  <div style={{ fontSize: 11, marginTop: 4, color: pwStrength.color, fontWeight: 600 }}>
                    {pwStrength.label}
                  </div>
                  {/* 조건 체크리스트 */}
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {[
                      { ok: pw.length >= 8,                                   text: '8자 이상' },
                      { ok: pw.length >= 12,                                  text: '12자 이상' },
                      { ok: /[0-9]/.test(pw),                                 text: '숫자 포함' },
                      { ok: /[^a-zA-Z0-9]/.test(pw),                         text: '특수문자 포함 (!@#$...)' },
                      { ok: /[A-Z]/.test(pw) && /[a-z]/.test(pw),            text: '영문 대·소문자 혼합' },
                    ].map(({ ok, text }) => (
                      <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11,
                        color: ok ? '#22C55E' : '#94A3B8' }}>
                        <span style={{ fontSize: 12 }}>{ok ? '✓' : '○'}</span>
                        {text}
                      </div>
                    ))}
                  </div>
                </>
              )}
              {fieldErrors.pw && <div className="su-field-error">{fieldErrors.pw}</div>}
            </div>
          </div>

          {/* 비밀번호 확인 */}
          <div className="su-row" ref={rowPw2Ref}>
            <div className="su-lbl">비밀번호확인<em>*</em></div>
            <div className="su-ctrl">
              <div style={{ position: 'relative' }}>
                <input type={showPw2 ? 'text' : 'password'} className={`su-input${fieldErrors.pw2 ? ' su-err' : ''}`} placeholder="비밀번호를 한번 더 입력해주세요"
                  style={{ paddingRight: 44 }}
                  value={pw2} onChange={e => { setPw2(e.target.value); if (fieldErrors.pw2) setFieldErrors(p => ({ ...p, pw2: '' })); }} />
                <PwEye shown={showPw2} onToggle={() => setShowPw2(v => !v)} />
              </div>
              {pw2.length > 0 && (
                <div className={`su-hint ${pw2Ok ? 'ok' : 'err'}`}>
                  {pw2Ok ? '비밀번호가 일치합니다.' : '비밀번호가 일치하지 않습니다.'}
                </div>
              )}
              {fieldErrors.pw2 && <div className="su-field-error">{fieldErrors.pw2}</div>}
            </div>
          </div>

          {/* 휴대폰·성별·생년월일은 가입 직후 휴대폰 본인인증에서 한 번에 등록 */}
          <div className="su-row">
            <div className="su-lbl">본인인증</div>
            <div className="su-ctrl su-ctrl-pt16">
              <div style={{ fontSize:13, color:'#888', lineHeight:1.6 }}>
                휴대폰번호·생년월일·성별은 가입 직후 <strong style={{ color:'#1A1A1A' }}>휴대폰 본인인증</strong>에서 한 번에 등록됩니다.
              </div>
            </div>
          </div>

          {/* 추천인 */}
          <div className="su-row">
            <div className="su-lbl">추가입력사항</div>
            <div className="su-ctrl su-ctrl-pt16">
              <div className="su-ref-chk">
                <CircleCheck on={showRef} onClick={e => { e?.stopPropagation(); setShowRef(v => !v); }} />
                <span onClick={() => setShowRef(v => !v)}>친구초대 추천인 코드</span>
              </div>
              {showRef && (
                <div style={{ marginTop: 10 }}>
                  <input type="text" className="su-input su-input-ref" placeholder="추천인 코드를 입력해주세요"
                    value={refCode} onChange={e => setRefCode(e.target.value)} />
                </div>
              )}
            </div>
          </div>

          {/* 구분선 */}
          <div className="su-row-sep" />

          {/* 약관 */}
          <div className="su-row su-row-terms" ref={rowTermsRef}>
            <div className="su-lbl su-lbl-terms">이용약관동의<em>*</em></div>
            <div className="su-ctrl su-ctrl-terms">
              {fieldErrors.terms && <div className="su-field-error" style={{ marginBottom: 8 }}>{fieldErrors.terms}</div>}

              {/* 전체동의 */}
              <div className="su-terms-all">
                <div className="su-terms-all-lbl" onClick={toggleAll}>
                  <CircleCheck on={allOn} onClick={toggleAll} />
                  <span className="su-terms-all-title">전체 동의합니다.</span>
                </div>
                <p className="su-terms-all-sub">선택항목에 동의하지 않은 경우도 회원가입 및 일반적인 서비스를 이용할 수 있습니다.</p>
              </div>

              <div className="su-terms-item">
                <div className="su-terms-left">
                  <CircleCheck on={t1} onClick={() => { setT1(v => !v); if (fieldErrors.terms) setFieldErrors(p => ({ ...p, terms: '' })); }} />
                  <span className="su-terms-txt">이용약관 동의 <span className="su-terms-badge su-terms-required">(필수)</span></span>
                </div>
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="su-terms-view">약관보기 ›</a>
              </div>

              <div className="su-terms-item">
                <div className="su-terms-left">
                  <CircleCheck on={t2} onClick={() => { setT2(v => !v); if (fieldErrors.terms) setFieldErrors(p => ({ ...p, terms: '' })); }} />
                  <span className="su-terms-txt">개인정보 수집·이용 동의 <span className="su-terms-badge su-terms-required">(필수)</span></span>
                </div>
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="su-terms-view">약관보기 ›</a>
              </div>

              <div className="su-terms-item">
                <div className="su-terms-left">
                  <CircleCheck on={t3} onClick={() => setT3(v => !v)} />
                  <span className="su-terms-txt">마케팅 광고 활용을 위한 수집 및 이용 동의 <span className="su-terms-badge">(선택)</span></span>
                </div>
                <a href="/terms/marketing" target="_blank" rel="noopener noreferrer" className="su-terms-view">약관보기 ›</a>
              </div>

              <div className="su-terms-item su-terms-item-wrap">
                <div className="su-terms-left">
                  <CircleCheck on={t4} onClick={() => setT4(v => !v)} />
                  <span className="su-terms-txt">무료배송, 할인쿠폰 등 혜택/정보 수신 동의 <span className="su-terms-badge">(선택)</span></span>
                </div>
                <div className="su-terms-sub-row">
                  <label className="su-sub-chk-lbl">
                    <CircleCheck on={t4s} onClick={e => { e?.stopPropagation(); setT4s(v => !v); }} />
                    문자
                  </label>
                  <label className="su-sub-chk-lbl">
                    <CircleCheck on={t4e} onClick={e => { e?.stopPropagation(); setT4e(v => !v); }} />
                    이메일
                  </label>
                </div>
              </div>

              <div className="su-terms-item">
                <div className="su-terms-left">
                  <CircleCheck on={t5} onClick={() => { setT5(v => !v); if (fieldErrors.terms) setFieldErrors(p => ({ ...p, terms: '' })); }} />
                  <span className="su-terms-txt">본인은 만 14세 이상입니다. <span className="su-terms-badge su-terms-required">(필수)</span></span>
                </div>
              </div>

            </div>
          </div>
        </div>

        {error && (
          <p style={{ color: 'var(--color-error)', fontSize: 13, textAlign: 'center', marginTop: 12 }}>
            {error}
          </p>
        )}

        <div className="su-submit-wrap">
          <button className="su-submit-btn" onClick={completeSignup} disabled={loading}>
            {loading ? '처리 중...' : '가입하기'}
          </button>
        </div>
        <p className="su-login-link">이미 계정이 있으신가요? <Link href="/login">로그인</Link></p>
      </div>

      {/* 가입 완료 오버레이 */}
      <div className={`done-overlay${done ? ' show' : ''}`}>
        <div className="done-inner">
          <h2 className="done-title">회원가입 완료</h2>
          <hr className="done-hr" />
          <p className="done-headline">
            신규 고객 전용<br />
            <em>할인쿠폰</em>을 발급했어요
          </p>
          {/* 쿠폰 카드 (친구초대 쿠폰과 동일 디자인) */}
          <div style={{ background:'#1A1A1A', borderRadius:16, padding:'34px 24px', maxWidth:280,
            margin:'0 auto 36px', position:'relative', overflow:'hidden', textAlign:'center' }}>
            <div style={{ position:'absolute', left:0, top:'50%', transform:'translateY(-50%)', width:0, height:0,
              borderTop:'22px solid transparent', borderBottom:'22px solid transparent', borderLeft:'18px solid #fff' }} />
            <div style={{ position:'absolute', right:0, top:'50%', transform:'translateY(-50%)', width:0, height:0,
              borderTop:'22px solid transparent', borderBottom:'22px solid transparent', borderRight:'18px solid #fff' }} />
            <p style={{ fontSize:14, fontWeight:600, color:'#fff', letterSpacing:3, margin:'0 0 12px' }}>COUPON</p>
            <p style={{ fontSize:48, fontWeight:800, color:'#fff', lineHeight:1, letterSpacing:-1, margin:0 }}>
              {welcomeAmount > 0 ? welcomeAmount.toLocaleString() : '쿠폰'}
            </p>
            <p style={{ fontSize:12, color:'#bbb', margin:'12px 0 0' }}>+ 첫 주문 무료배송</p>
          </div>
          <ul className="done-notes">
            <li>무료배송 혜택은 첫구매에 자동으로 적용돼요.</li>
            <li>쿠폰은 [마이페이지] &gt; [쿠폰]에서 확인해주세요.</li>
          </ul>
          <button className="done-btn done-btn-dark" onClick={() => router.push('/survey')}>
            내 과일 취향 확인하기
          </button>
          <button className="done-btn done-btn-light" onClick={() => router.push(nextUrl)}>
            {nextUrl !== '/' ? '이어서 쇼핑하기' : '쇼핑하러 가기'}
          </button>
        </div>
      </div>
    </>
  );
}
