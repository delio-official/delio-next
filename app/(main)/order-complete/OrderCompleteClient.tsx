'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import '@/styles/order-complete.css';

export default function OrderCompleteClient() {
  const sp = useSearchParams();
  const orderNo     = sp.get('order') || '';
  const earnedPoint = Number(sp.get('point') || 0);

  return (
    <div style={{ minHeight:'80vh', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', textAlign:'center', padding:'48px 20px 100px' }}>
      <div style={{ fontSize:72, marginBottom:20 }}>🎉</div>
      <h1 style={{ fontSize:'clamp(22px,4vw,32px)', fontWeight:800, marginBottom:10 }}>
        주문이 완료되었습니다!
      </h1>
      {orderNo && (
        <p style={{ fontSize:13, color:'#888', marginBottom:6 }}>주문번호: {orderNo}</p>
      )}
      {earnedPoint > 0 && (
        <p style={{ fontSize:13, color:'var(--color-accent)', fontWeight:700, marginBottom:6 }}>
          🎁 {earnedPoint.toLocaleString()}P 적립 완료!
        </p>
      )}
      <p style={{ fontSize:15, color:'#555', lineHeight:1.8, marginBottom:32 }}>
        주문이 정상 접수되었습니다.<br />
        배송 정보는 마이페이지에서 확인하실 수 있습니다.
      </p>

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
          · 새벽배송: 오후 11시 이전 결제 완료 → 내일 새벽 도착<br/>
          · 일반택배: 결제 후 1~3 영업일 소요<br/>
          · 문의: 1588-0000 (평일 09~18시)
        </p>
      </div>
    </div>
  );
}
