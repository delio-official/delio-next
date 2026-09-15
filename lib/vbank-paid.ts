import type { SupabaseClient } from '@supabase/supabase-js';
import { computeOrderEarn } from '@/lib/point-earn-server';

/* 무통장 입금확인 (멱등).
   입금대기(pending) 주문을 결제 이후 단계로 넘기는 순간 1회만:
   - 상태 전환 + 결제일(paid_at) 기록
   - 구매 적립 지급 — 카드 결제(finalize-order)와 같은 계산(lib/point-earn), 포인트 on/off 존중
   동시성 가드: 'status = pending' 조건부 업데이트에 성공한 호출만 적립한다(중복 지급 방지).
   admin = service-role Supabase client. */
export const VBANK_PAID_STATUSES = ['paid', 'preparing', 'shipped', 'delivered', 'confirmed'];

export async function confirmVbankPaidOrders(
  admin: SupabaseClient,
  orderIds: string[],
  status: string,
): Promise<{ id: string; earned: number }[]> {
  if (orderIds.length === 0 || !VBANK_PAID_STATUSES.includes(status)) return [];

  const { data: pe } = await admin.from('site_settings').select('value').eq('key', 'point_enabled').maybeSingle();
  const pointEnabled = !pe || pe.value !== 'false';

  const nowIso = new Date().toISOString();
  const granted: { id: string; earned: number }[] = [];
  for (const id of orderIds) {
    const { data: ord } = await admin.from('orders')
      .update({
        status, paid_at: nowIso,
        ...(status === 'shipped' ? { shipped_at: nowIso } : {}),
        ...(status === 'delivered' ? { delivered_at: nowIso } : {}),
        ...(status === 'confirmed' ? { confirmed_at: nowIso } : {}),
      })
      .eq('id', id).eq('status', 'pending')
      .select('id, user_id, final_amount, created_at').maybeSingle();
    if (!ord) continue;   // 이미 입금확인됐거나 입금대기가 아님 → 적립 없음

    let earned = 0;
    if (ord.user_id && pointEnabled) {
      const { data: prof } = await admin.from('profiles').select('point_balance').eq('id', ord.user_id).single();
      if (prof) {
        /* 적립 이벤트는 '주문한 시각' 기준 — 이벤트가 끝난 뒤 입금해도 주문 때 안내된 적립 그대로 */
        const { data: its } = await admin.from('order_items').select('product_id, subtotal').eq('order_id', ord.id);
        earned = await computeOrderEarn(admin, {
          userId: ord.user_id,
          finalAmount: ord.final_amount || 0,
          items: ((its || []) as { product_id: string | null; subtotal: number | null }[]).map(i => ({ productId: i.product_id, amount: i.subtotal || 0 })),
          at: new Date(ord.created_at || Date.now()),
        });
        if (earned > 0) {
          await admin.from('profiles').update({ point_balance: (prof.point_balance || 0) + earned }).eq('id', ord.user_id);
          try { await admin.from('point_logs').insert([{ user_id: ord.user_id, amount: earned, description: '구매 적립' }]); } catch { /* 원장 실패 무시 */ }
        }
      }
    }
    /* earned_point = 실제 지급액 (취소·환불 시 회수 기준). 미지급이면 0 */
    await admin.from('orders').update({ earned_point: earned }).eq('id', ord.id);
    granted.push({ id: ord.id, earned });
  }
  return granted;
}
