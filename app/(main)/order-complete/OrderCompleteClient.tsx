'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import '@/styles/order-complete.css';
import { BANK_LINE, BANK_HOLDER, CS_PHONE, CS_HOURS, CS_LUNCH } from '@/lib/company';

export default function OrderCompleteClient() {
  const sp = useSearchParams();
  const orderNo     = sp.get('order') || '';
  const earnedPoint = Number(sp.get('point') || 0);
  const isVbank     = sp.get('vbank') === '1';

  return (
    <div style={{ minHeight:'calc(100dvh - 64px)', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', textAlign:'center',
      padding:'40px 20px 96px', boxSizing:'border-box' }}>
      <h1 style={{ fontSize:'clamp(22px,4vw,32px)', fontWeight:800, marginBottom:10 }}>
        {isVbank ? '주문이 접수되었습니다!' : '주문이 완료되었습니다!'}
      </h1>
      {orderNo && (
        <p style={{ fontSize:13, color:'#888', marginBottom:6 }}>주문번호: {orderNo}</p>
      )}
      {earnedPoint > 0 && (
        <p style={{ fontSize:13, color:'var(--color-accent)', fontWeight:700, marginBottom:6 }}>
          {earnedPoint.toLocaleString()}P 적립 완료!
        </p>
      )}
      <p style={{ fontSize:15, color:'#555', lineHeight:1.8, marginBottom:32 }}>
        {isVbank
          ? <>아래 계좌로 입금해주시면 확인 후 배송이 시작됩니다.<br />입금 전까지는 <b>‘입금대기’</b> 상태로 표시됩니다.</>
          : <>주문이 정상 접수되었습니다.<br />배송 정보는 마이페이지에서 확인하실 수 있습니다.</>}
      </p>

      {isVbank && (
        <div style={{ marginBottom:24, background:'#FFF9E6', border:'1.5px solid #FFE082', borderRadius:12,
          padding:'18px 22px', maxWidth:380, width:'100%', textAlign:'left' }}>
          <div style={{ fontSize:13, fontWeight:800, marginBottom:8, color:'#7A5800' }}>입금 계좌 안내</div>
          <p style={{ fontSize:15, fontWeight:800, color:'#1A1A1A', marginBottom:4 }}>{BANK_LINE}</p>
          <p style={{ fontSize:13, color:'#666', lineHeight:1.7 }}>
            예금주: {BANK_HOLDER}<br />
            입금자명을 주문자명(<b>{orderNo}</b> 주문)과 맞춰주시면 확인이 빠릅니다.<br />
            입금 확인은 영업일 기준 순차 처리됩니다.
          </p>
        </div>
      )}

      <div style={{ display:'flex', gap:12, flexWrap:'wrap', justifyContent:'center' }}>
        <Link href="/mypage"
          style={{ padding:'14px 28px', background:'var(--color-ink)', color:'#fff',
            borderRadius:8, fontWeight:700, textDecoration:'none', fontSize:15 }}>
          주문 내역 보기
        </Link>
        <Link href="/"
          style={{ padding:'14px 28px', background:'#F2F2F2', color:'var(--color-ink)',
            borderRadius:8, fontWeight:700, textDecoration:'none', fontSize:15 }}>
          계속 쇼핑하기
        </Link>
      </div>

      <div style={{ marginTop:40, background:'#F7F7F5', borderRadius:12, padding:'20px 24px',
        maxWidth:380, width:'100%', textAlign:'left' }}>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>배송 안내</div>
        <p style={{ fontSize:13, color:'#666', lineHeight:1.8 }}>
          · 산지배송: 오전 11시 이전 결제 완료 시 → 당일수확 → 당일배송<br/>
          · 자사배송: 오전 11시 이전 결제 완료 시 → 결제 후 1~2 영업일 소요<br/>
          · 문의: {CS_PHONE} ({CS_HOURS} · 점심 {CS_LUNCH} 제외)
        </p>
      </div>
    </div>
  );
}
