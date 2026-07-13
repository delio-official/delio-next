'use client';

import Link from 'next/link';
import { useState } from 'react';

/* 전 페이지 공용 푸터 — 사업자정보 상시 노출(결제형 심사 필수) */
export default function SiteFooter() {
  const [bizOpen, setBizOpen] = useState(true); // 모바일 사업자정보 기본 펼침(필수정보 상시 노출)
  return (
    <footer className="site-footer">
      <div className="container">
        {/* 로고 (맨 위 단독) */}
        <div className="footer-logo" style={{ marginBottom:16 }}>
          <img src="/DelioLogo.png" alt="Delio" style={{ height:48, width:'auto', display:'block', objectFit:'contain' }} />
        </div>

        {/* 사업자정보 | 고객센터 | 입금계좌 */}
        <div className="footer-top" style={{ display:'grid', gridTemplateColumns:'1.9fr 1fr 1fr', gap:48, paddingBottom:40, alignItems:'start' }}>
          {/* 사업자 정보 */}
          <div className={`footer-biz${bizOpen ? ' open' : ''}`} style={{ display:'flex', flexDirection:'column', gap:16, fontSize:13, color:'#888', lineHeight:1.75 }}>
            <button type="button" className="footer-biz-toggle" onClick={() => setBizOpen(o => !o)}>
              <span>델리오 사업자 정보</span>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div className="footer-biz-detail">
              <div>상호명 : 델리오 &nbsp;&nbsp;|&nbsp;&nbsp; 대표 : 송민창</div>
              <div>주소 : 경기도 고양시 덕양구 권율대로 656, 13층 1329호 (원흥동, 클레시아 더 퍼스트)</div>
              <div>사업자등록번호 : 288-12-02921 &nbsp;&nbsp;|&nbsp;&nbsp; 통신판매업신고 : 2026-고양덕양구-1612</div>
              <div>개인정보보호책임자 : 송민창 (deli_o@naver.com)</div>
              <div>모든 거래에 대한 책임과 환불·민원 처리는 델리오가 진행합니다. &nbsp;|&nbsp; 민원담당자 : 송민창 (070-8064-3601)</div>
            </div>
            <div style={{ color:'#c0c0c0', fontSize:13 }}>© 델리오. All rights reserved.</div>
          </div>

          {/* 고객센터 */}
          <div style={{ display:'flex', flexDirection:'column', gap:9, fontSize:13.5, color:'#888', lineHeight:1.75 }}>
            <div style={{ fontWeight:700, color:'#1A1A1A', fontSize:15 }}>고객센터 안내</div>
            <div className="footer-cs-tel" style={{ fontSize:28, fontWeight:800, color:'#1A1A1A', letterSpacing:'-0.5px' }}>070-8064-3601</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <div style={{ display:'flex', gap:18 }}><span style={{ color:'#1A1A1A', fontWeight:600, minWidth:56, flexShrink:0 }}>운영시간</span><span>평일 09:00 - 18:00</span></div>
              <div style={{ display:'flex', gap:18 }}><span style={{ color:'#1A1A1A', fontWeight:600, minWidth:56, flexShrink:0 }}>점심시간</span><span>12:00 - 13:00</span></div>
              <div style={{ display:'flex', gap:18 }}><span style={{ color:'#1A1A1A', fontWeight:600, minWidth:56, flexShrink:0 }}>휴무일</span><span>주말 및 공휴일</span></div>
            </div>
          </div>

          {/* 입금 계좌 */}
          <div style={{ display:'flex', flexDirection:'column', gap:9, fontSize:14, color:'#999', lineHeight:1.75 }}>
            <div style={{ fontWeight:700, color:'#1A1A1A', fontSize:15 }}>입금 계좌안내</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <div>국민은행 469901-04-404587</div>
              <div>예금주 : 송민창(델리오)</div>
            </div>
            <div style={{ display:'inline-block', alignSelf:'flex-start', background:'#F3F3F1', color:'#666', fontSize:13.5, padding:'9px 16px', borderRadius:6 }}>
              입금 시 주문자 성함 기재
            </div>
          </div>
        </div>

        {/* 하단: 정책 링크 + SNS */}
        <div className="footer-bottom-bar" style={{ borderTop:'1px solid #EBEBEB', paddingTop:26, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div className="footer-policy-links" style={{ display:'flex', gap:28, fontSize:13.5, fontWeight:500, color:'#444' }}>
            <Link href="/privacy" style={{ color:'#444', textDecoration:'none' }}>개인정보처리방침</Link>
            <Link href="/terms" style={{ color:'#444', textDecoration:'none' }}>이용약관</Link>
            <Link href="/refund-policy" style={{ color:'#444', textDecoration:'none' }}>취소/환불정책</Link>
            <Link href="/faq" style={{ color:'#444', textDecoration:'none' }}>자주 묻는 질문</Link>
          </div>
          <div className="footer-sns" style={{ display:'flex', gap:16, alignItems:'center', color:'#bbb' }}>
            <a href="https://www.instagram.com/the_delio" target="_blank" rel="noreferrer" style={{ color:'#bbb' }} title="인스타그램">
              <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
            </a>
            <a href="#" style={{ color:'#bbb' }} title="유튜브">
              <svg viewBox="0 0 24 24" width="23" height="23" fill="currentColor"><path d="M23 12s0-3.5-.45-5.16a2.6 2.6 0 00-1.83-1.84C19.06 4.55 12 4.55 12 4.55s-7.06 0-8.72.45A2.6 2.6 0 001.45 6.84C1 8.5 1 12 1 12s0 3.5.45 5.16a2.6 2.6 0 001.83 1.84c1.66.45 8.72.45 8.72.45s7.06 0 8.72-.45a2.6 2.6 0 001.83-1.84C23 15.5 23 12 23 12zM9.75 15.27V8.73L15.5 12z"/></svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
