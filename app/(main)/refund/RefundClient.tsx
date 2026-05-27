'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import '@/styles/refund.css';

const REASONS = ['상품 불량/파손', '오배송', '상품 누락', '품질 불만족', '기타'];

export default function RefundClient() {
  const router = useRouter();
  const { user } = useAuth();
  const [orderId, setOrderId] = useState('');
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { router.push('/login'); return; }
    if (!orderId.trim() || !reason) { alert('필수 항목을 입력해주세요.'); return; }
    setLoading(true);
    const supabase = createClient();
    // orderId로 order 조회
    const { data: order } = await supabase.from('orders')
      .select('id').eq('order_no', orderId.trim()).single();
    if (!order) {
      setLoading(false);
      alert('주문 번호를 찾을 수 없습니다. 마이페이지에서 주문 번호를 확인해주세요.');
      return;
    }
    await supabase.from('refund_requests').insert({
      order_id: order.id, user_id: user.id, reason, detail,
    });
    setLoading(false);
    setDone(true);
  }

  if (done) {
    return (
      <div style={{ minHeight:'60vh', display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center', textAlign:'center', padding:'40px 20px' }}>
        <div style={{ fontSize:56, marginBottom:16 }}>✅</div>
        <h2 style={{ fontSize:22, fontWeight:700, marginBottom:10 }}>환불 신청이 완료되었습니다</h2>
        <p style={{ fontSize:14, color:'#666', lineHeight:1.8, marginBottom:28 }}>
          담당자가 확인 후 1~3 영업일 이내에 처리해드립니다.
        </p>
        <Link href="/mypage"
          style={{ padding:'12px 28px', background:'var(--color-accent)', color:'#fff',
            borderRadius:8, fontWeight:700, textDecoration:'none', fontSize:14 }}>
          마이페이지 가기
        </Link>
      </div>
    );
  }

  return (
    <div style={{ background:'#fff', minHeight:'100vh' }}>
      <div style={{ padding:'36px 0 32px', borderBottom:'1px solid #EBEBEB' }}>
        <div className="container">
          <h1 style={{ fontSize:'clamp(20px,3vw,28px)', fontWeight:700 }}>환불/교환 신청</h1>
        </div>
      </div>

      <div className="container" style={{ maxWidth:540, paddingTop:32, paddingBottom:80 }}>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:13, fontWeight:700, color:'#555', display:'block', marginBottom:6 }}>
              주문번호 *
            </label>
            <input placeholder="예: ORD-20250526-abc123"
              value={orderId} onChange={e => setOrderId(e.target.value)}
              style={{ width:'100%', height:48, padding:'0 14px', border:'1.5px solid #EBEBEB',
                borderRadius:8, fontSize:14, outline:'none', boxSizing:'border-box', fontFamily:'inherit' }} />
            <p style={{ fontSize:12, color:'#bbb', marginTop:4 }}>
              주문번호는 마이페이지 &gt; 주문내역에서 확인할 수 있습니다.
            </p>
          </div>

          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:13, fontWeight:700, color:'#555', display:'block', marginBottom:6 }}>
              환불/교환 사유 *
            </label>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {REASONS.map(r => (
                <label key={r} style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer',
                  padding:'12px 14px', border:`1.5px solid ${reason===r?'var(--color-accent)':'#EBEBEB'}`,
                  borderRadius:8, background:reason===r?'var(--color-accent-bg)':'#fff',
                  fontSize:14, fontWeight:reason===r?700:400, color:reason===r?'var(--color-accent)':'#333' }}>
                  <input type="radio" name="reason" checked={reason===r} onChange={() => setReason(r)} style={{ display:'none' }} />
                  {r}
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginBottom:24 }}>
            <label style={{ fontSize:13, fontWeight:700, color:'#555', display:'block', marginBottom:6 }}>
              상세 내용
            </label>
            <textarea placeholder="상세 내용을 입력해주세요 (불량 부위, 파손 정도 등)"
              value={detail} onChange={e => setDetail(e.target.value)} rows={4}
              style={{ width:'100%', padding:'12px 14px', border:'1.5px solid #EBEBEB',
                borderRadius:8, fontSize:14, resize:'vertical', boxSizing:'border-box',
                outline:'none', fontFamily:'inherit', lineHeight:1.7 }} />
          </div>

          <div style={{ background:'#FFF9C4', borderRadius:8, padding:'14px 16px', marginBottom:24, fontSize:13, color:'#7A5800' }}>
            <strong>환불/교환 안내</strong><br />
            신선식품 특성상 수령 후 24시간 이내에만 접수 가능합니다.<br />
            단순 변심에 의한 반품은 불가합니다.
          </div>

          <button type="submit" disabled={loading}
            style={{ width:'100%', padding:'16px', background:'var(--color-accent)', color:'#fff',
              border:'none', borderRadius:8, fontSize:16, fontWeight:700, cursor:'pointer',
              opacity:loading?0.7:1 }}>
            {loading ? '처리 중...' : '환불 신청하기'}
          </button>
        </form>
      </div>
    </div>
  );
}
