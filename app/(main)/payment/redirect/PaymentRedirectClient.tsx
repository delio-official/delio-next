'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { clearCart } from '@/lib/cart';

/* 모바일 REDIRECTION 결제 복귀 핸들러.
   포트원이 redirectUrl로 paymentId(+실패 시 code/message)를 붙여 돌려보냄.
   여기서 서버 verify를 호출해 주문을 확정한다 (orderData는 서버가 pending_payments에서 복구). */
export default function PaymentRedirectClient() {
  const router = useRouter();
  const params = useSearchParams();
  const ran = useRef(false);
  const [msg, setMsg] = useState('결제 결과를 확인하고 있습니다…');

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const paymentId = params.get('paymentId');
    const code = params.get('code');       // 실패/취소 시 존재
    const message = params.get('message');

    // 결제 실패·취소
    if (code) {
      alert(message || '결제가 취소되었습니다.');
      router.replace('/checkout');
      return;
    }
    if (!paymentId) {
      alert('결제 정보를 확인할 수 없습니다.');
      router.replace('/checkout');
      return;
    }

    (async () => {
      try {
        const res = await fetch('/api/payment/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId }), // orderData는 서버가 복구
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          alert(`주문 처리 실패: ${data.error || '알 수 없는 오류'}`);
          router.replace('/checkout');
          return;
        }
        clearCart();
        router.replace(`/order-complete?order=${data.orderNo}&point=${data.earnedPoint}`);
      } catch {
        alert('결제 확인 중 오류가 발생했습니다. 마이페이지에서 주문 내역을 확인해주세요.');
        router.replace('/mypage');
      }
    })();
  }, [params, router]);

  return (
    <div className="container" style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16, paddingTop: 60, paddingBottom: 100 }}>
      <div className="spinner" style={{ width: 36, height: 36, border: '3px solid #eee',
        borderTopColor: '#1A1A1A', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: '#666', fontSize: 15 }}>{msg}</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
