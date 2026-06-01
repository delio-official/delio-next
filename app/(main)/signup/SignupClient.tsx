'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signUp, signIn } from '@/lib/auth';
import '@/styles/signup.css';

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

  /* ── 기본 필드 ── */
  const [name, setName] = useState('');
  const [emailUser, setEmailUser] = useState('');
  const [emailDomain, setEmailDomain] = useState('');
  const [emailDirect, setEmailDirect] = useState('');
  const [showDirect, setShowDirect] = useState(false);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('other');
  const [birthY, setBirthY] = useState('');
  const [birthM, setBirthM] = useState('');
  const [birthD, setBirthD] = useState('');
  const [refCode, setRefCode] = useState('');
  const [showRef, setShowRef] = useState(false);

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
    const { error: err } = await signUp(email, pw, name.trim(), refCode.trim() || undefined);
    if (err) {
      setLoading(false);
      if (err.message.includes('already')) setError('이미 가입된 이메일입니다.');
      else setError(err.message);
    } else {
      // 가입 성공 → 자동 로그인 (세션 확실히 확보)
      await signIn(email, pw);
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
                  value={emailUser} onChange={e => { setEmailUser(e.target.value); if (fieldErrors.email) setFieldErrors(p => ({ ...p, email: '' })); }} />
                <span className="su-at">@</span>
                <select className="su-domain-select" defaultValue=""
                  onChange={e => onDomainChange(e.target.value)}>
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
              </div>
              {showDirect && (
                <div className="su-email-direct-wrap">
                  <input type="text" className="su-input" placeholder="도메인을 직접 입력해주세요"
                    value={emailDirect} onChange={e => { setEmailDirect(e.target.value); if (fieldErrors.email) setFieldErrors(p => ({ ...p, email: '' })); }} />
                </div>
              )}
              {fieldErrors.email && <div className="su-field-error">{fieldErrors.email}</div>}
            </div>
          </div>

          {/* 비밀번호 */}
          <div className="su-row" ref={rowPwRef}>
            <div className="su-lbl">비밀번호<em>*</em></div>
            <div className="su-ctrl">
              <input type="password" className={`su-input${fieldErrors.pw ? ' su-err' : ''}`} placeholder="8자 이상 입력해주세요"
                value={pw} onChange={e => { setPw(e.target.value); if (fieldErrors.pw) setFieldErrors(p => ({ ...p, pw: '' })); }} />
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
              <input type="password" className={`su-input${fieldErrors.pw2 ? ' su-err' : ''}`} placeholder="비밀번호를 한번 더 입력해주세요"
                value={pw2} onChange={e => { setPw2(e.target.value); if (fieldErrors.pw2) setFieldErrors(p => ({ ...p, pw2: '' })); }} />
              {pw2.length > 0 && (
                <div className={`su-hint ${pw2Ok ? 'ok' : 'err'}`}>
                  {pw2Ok ? '비밀번호가 일치합니다.' : '비밀번호가 일치하지 않습니다.'}
                </div>
              )}
              {fieldErrors.pw2 && <div className="su-field-error">{fieldErrors.pw2}</div>}
            </div>
          </div>

          {/* 휴대폰 */}
          <div className="su-row">
            <div className="su-lbl">휴대폰</div>
            <div className="su-ctrl">
              <input type="tel" className="su-input" placeholder="숫자만 입력해주세요"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))} />
            </div>
          </div>

          {/* 성별 */}
          <div className="su-row">
            <div className="su-lbl">성별</div>
            <div className="su-ctrl">
              <div className="su-gender-row">
                <label className="su-radio-lbl">
                  <input type="radio" name="gender" checked={gender === 'male'} onChange={() => setGender('male')} />
                  <span>남자</span>
                </label>
                <label className="su-radio-lbl">
                  <input type="radio" name="gender" checked={gender === 'female'} onChange={() => setGender('female')} />
                  <span>여자</span>
                </label>
                <label className="su-radio-lbl">
                  <input type="radio" name="gender" checked={gender === 'other'} onChange={() => setGender('other')} />
                  <span>선택안함</span>
                </label>
              </div>
            </div>
          </div>

          {/* 생년월일 */}
          <div className="su-row">
            <div className="su-lbl">생년월일</div>
            <div className="su-ctrl">
              <div className="su-birth-row">
                <input type="text" className="su-birth-in su-birth-yyyy" maxLength={4} placeholder="YYYY"
                  value={birthY}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '');
                    setBirthY(v);
                    if (v.length === 4) fBmRef.current?.focus();
                  }} />
                <span className="su-birth-sep">/</span>
                <input ref={fBmRef} type="text" className="su-birth-in su-birth-mm" maxLength={2} placeholder="MM"
                  value={birthM}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '');
                    setBirthM(v);
                    if (v.length === 2) fBdRef.current?.focus();
                  }} />
                <span className="su-birth-sep">/</span>
                <input ref={fBdRef} type="text" className="su-birth-in su-birth-dd" maxLength={2} placeholder="DD"
                  value={birthD}
                  onChange={e => setBirthD(e.target.value.replace(/\D/g, ''))} />
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
                <a href="#" className="su-terms-view" onClick={e => e.preventDefault()}>약관보기 ›</a>
              </div>

              <div className="su-terms-item">
                <div className="su-terms-left">
                  <CircleCheck on={t2} onClick={() => { setT2(v => !v); if (fieldErrors.terms) setFieldErrors(p => ({ ...p, terms: '' })); }} />
                  <span className="su-terms-txt">개인정보 수집·이용 동의 <span className="su-terms-badge su-terms-required">(필수)</span></span>
                </div>
                <a href="#" className="su-terms-view" onClick={e => e.preventDefault()}>약관보기 ›</a>
              </div>

              <div className="su-terms-item">
                <div className="su-terms-left">
                  <CircleCheck on={t3} onClick={() => setT3(v => !v)} />
                  <span className="su-terms-txt">마케팅 광고 활용을 위한 수집 및 이용 동의 <span className="su-terms-badge">(선택)</span></span>
                </div>
                <a href="#" className="su-terms-view" onClick={e => e.preventDefault()}>약관보기 ›</a>
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
            <em>3천원 할인쿠폰</em>과<br />
            무료배송 혜택을 받았어요
          </p>
          <div className="done-illus">
            <div className="done-envelope">
              <div className="done-coupon-amount">3,000</div>
              <div className="done-coupon-sub">+ 첫 주문 무료배송</div>
            </div>
            <span className="done-truck">🚚</span>
          </div>
          <ul className="done-notes">
            <li>무료배송 혜택은 첫구매에 자동으로 적용돼요.</li>
            <li>쿠폰은 [마이페이지] &gt; [쿠폰]에서 확인해주세요.</li>
          </ul>
          <button className="done-btn done-btn-dark" onClick={() => router.push('/survey')}>
            내 과일 취향 확인하기
          </button>
          <button className="done-btn done-btn-light" onClick={() => router.push('/')}>
            쇼핑하러 가기
          </button>
        </div>
      </div>
    </>
  );
}
