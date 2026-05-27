'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signUp } from '@/lib/auth';
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

  const fBmRef = useRef<HTMLInputElement>(null);
  const fBdRef = useRef<HTMLInputElement>(null);

  /* 전체 동의 */
  const allOn = t1 && t2 && t3 && t4 && t4s && t4e && t5;
  function toggleAll() {
    const v = !allOn;
    setT1(v); setT2(v); setT3(v); setT4(v); setT4s(v); setT4e(v); setT5(v);
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

  async function completeSignup() {
    const email = getEmail();
    if (!email) return setError('이메일을 입력해주세요.');
    if (!name.trim()) return setError('이름을 입력해주세요.');
    if (!pwOk) return setError('비밀번호를 8자 이상 입력해주세요.');
    if (!pw2Ok) return setError('비밀번호가 일치하지 않습니다.');
    if (!t1 || !t2 || !t5) return setError('필수 약관에 동의해주세요.');

    setLoading(true);
    setError('');
    const { error: err } = await signUp(email, pw, name.trim());
    setLoading(false);
    if (err) {
      if (err.message.includes('already')) setError('이미 가입된 이메일입니다.');
      else setError(err.message);
    } else {
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
          <div className="su-row">
            <div className="su-lbl">이름<em>*</em></div>
            <div className="su-ctrl">
              <input type="text" className="su-input" placeholder="이름을 입력해주세요"
                value={name} onChange={e => setName(e.target.value)} />
            </div>
          </div>

          {/* 이메일 */}
          <div className="su-row">
            <div className="su-lbl">이메일<em>*</em></div>
            <div className="su-ctrl">
              <div className="su-email-row">
                <input type="text" className="su-input" placeholder="예: delio"
                  value={emailUser} onChange={e => setEmailUser(e.target.value)} />
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
                    value={emailDirect} onChange={e => setEmailDirect(e.target.value)} />
                </div>
              )}
            </div>
          </div>

          {/* 비밀번호 */}
          <div className="su-row">
            <div className="su-lbl">비밀번호<em>*</em></div>
            <div className="su-ctrl">
              <input type="password" className="su-input" placeholder="8자 이상 입력해주세요"
                value={pw} onChange={e => setPw(e.target.value)} />
              {pw.length > 0 && (
                <div className={`su-hint ${pwOk ? 'ok' : 'err'}`}>
                  {pwOk ? '사용 가능한 비밀번호입니다.' : '8자 이상 입력해주세요.'}
                </div>
              )}
            </div>
          </div>

          {/* 비밀번호 확인 */}
          <div className="su-row">
            <div className="su-lbl">비밀번호확인<em>*</em></div>
            <div className="su-ctrl">
              <input type="password" className="su-input" placeholder="비밀번호를 한번 더 입력해주세요"
                value={pw2} onChange={e => setPw2(e.target.value)} />
              {pw2.length > 0 && (
                <div className={`su-hint ${pw2Ok ? 'ok' : 'err'}`}>
                  {pw2Ok ? '비밀번호가 일치합니다.' : '비밀번호가 일치하지 않습니다.'}
                </div>
              )}
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
              <label className="su-ref-chk">
                <input type="checkbox" checked={showRef} onChange={e => setShowRef(e.target.checked)} />
                <span>친구초대 추천인 코드</span>
              </label>
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
          <div className="su-row su-row-terms">
            <div className="su-lbl su-lbl-terms">이용약관동의<em>*</em></div>
            <div className="su-ctrl su-ctrl-terms">

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
                  <CircleCheck on={t1} onClick={() => setT1(v => !v)} />
                  <span className="su-terms-txt">이용약관 동의 <span className="su-terms-badge su-terms-required">(필수)</span></span>
                </div>
                <a href="#" className="su-terms-view" onClick={e => e.preventDefault()}>약관보기 ›</a>
              </div>

              <div className="su-terms-item">
                <div className="su-terms-left">
                  <CircleCheck on={t2} onClick={() => setT2(v => !v)} />
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
                    <CircleCheck sm on={t4s} onClick={e => { e?.stopPropagation(); setT4s(v => !v); }} />
                    문자
                  </label>
                  <label className="su-sub-chk-lbl">
                    <CircleCheck sm on={t4e} onClick={e => { e?.stopPropagation(); setT4e(v => !v); }} />
                    이메일
                  </label>
                </div>
              </div>

              <div className="su-terms-item">
                <div className="su-terms-left">
                  <CircleCheck on={t5} onClick={() => setT5(v => !v)} />
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
