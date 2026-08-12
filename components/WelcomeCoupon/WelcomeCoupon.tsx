'use client';

/* 소셜 로그인(카카오·네이버) 신규 가입자에게 '쿠폰 발급' 안내 오버레이.
   로그인 콜백이 신규 유저를 감지해 리다이렉트 URL에 ?welcome=1 을 붙이면,
   메인 레이아웃에 상주하는 이 컴포넌트가 이메일 가입과 동일한 완료 화면을 띄운다.
   (이메일 가입은 SignupClient 내부에서 직접 오버레이를 띄우므로 여기선 소셜만 담당) */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import '@/styles/signup.css';

export default function WelcomeCoupon() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [amount, setAmount] = useState(0);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('welcome') !== '1') return;
    setShow(true);

    /* 새로고침 시 재표시 방지 — URL에서 welcome 파라미터 제거 */
    sp.delete('welcome');
    const q = sp.toString();
    const url = window.location.pathname + (q ? `?${q}` : '') + window.location.hash;
    window.history.replaceState(window.history.state, '', url);

    /* 쿠폰 금액 조회 (관리자 설정값) */
    createClient().from('site_settings').select('value').eq('key', 'signup_coupon').maybeSingle()
      .then(({ data }) => { if (data?.value) setAmount(Number(data.value) || 0); });
  }, []);

  /* 오버레이가 뜨면 뒤 페이지(html·body) 스크롤 잠금 */
  useEffect(() => {
    if (!show) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [show]);

  if (!show) return null;

  return (
    <div className="done-overlay show">
      <div className="done-inner">
        <h2 className="done-title">가입을 환영해요</h2>
        <hr className="done-hr" />
        <p className="done-headline">
          신규 고객 전용<br />
          <em>할인쿠폰</em>을 발급했어요
        </p>
        {/* 쿠폰 카드 (이메일 가입 완료화면과 동일 디자인) */}
        <div style={{ background:'#1A1A1A', borderRadius:16, padding:'34px 24px', maxWidth:280,
          margin:'0 auto 36px', position:'relative', overflow:'hidden', textAlign:'center' }}>
          <div style={{ position:'absolute', left:0, top:'50%', transform:'translateY(-50%)', width:0, height:0,
            borderTop:'22px solid transparent', borderBottom:'22px solid transparent', borderLeft:'18px solid #fff' }} />
          <div style={{ position:'absolute', right:0, top:'50%', transform:'translateY(-50%)', width:0, height:0,
            borderTop:'22px solid transparent', borderBottom:'22px solid transparent', borderRight:'18px solid #fff' }} />
          <p style={{ fontSize:14, fontWeight:600, color:'#fff', letterSpacing:3, margin:'0 0 12px' }}>COUPON</p>
          <p style={{ fontSize:48, fontWeight:800, color:'#fff', lineHeight:1, letterSpacing:-1, margin:0 }}>
            {amount > 0 ? amount.toLocaleString() : '쿠폰'}
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
        <button className="done-btn done-btn-light" onClick={() => setShow(false)}>
          쇼핑하러 가기
        </button>
      </div>
    </div>
  );
}
