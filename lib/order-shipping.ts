import type { SupabaseClient } from '@supabase/supabase-js';
import { ORDER_STATUS_RANK } from './tracker';

/* 농가(상품)별 송장 → 주문 배송상태 집계 유틸.
   한 주문이 여러 농가 송장으로 나뉘므로, 주문 상태는 order_items 들의 ship_status 를 집계해 결정한다.
   - 모든 상품 줄이 delivered            → 주문 delivered
   - 모든 상품 줄이 shipped 이상(배송중)  → 주문 shipped
   - 그 외(일부 농가만 출고 등)          → 변경 없음(null)
   ※ 예전엔 '하나라도 배송중'이면 주문 전체를 배송중으로 올려서, 여러 농가 주문이
      배송준비중 목록·금일 발송 대기·발송 지연 알림에서 빠져 남은 농가 송장 입력을 놓쳤다.
      관리자 송장 저장(모든 농가 송장이 들어와야 배송중)과 기준을 통일한다. */

const ITEM_RANK: Record<string, number> = { preparing: 2, shipped: 3, delivered: 4 };

export function aggregateOrderStatus(
  statuses: (string | null | undefined)[],
): 'shipped' | 'delivered' | null {
  if (!statuses.length) return null;
  if (statuses.every((s) => s === 'delivered')) return 'delivered';
  if (statuses.every((s) => s === 'shipped' || s === 'delivered')) return 'shipped';
  return null;
}

export interface DeliveredOrder {
  id: string;
  phone: string | null;
  recipient: string | null;
  orderer_phone: string | null;
  orderer_name: string | null;
  order_no: string | null;
  productName: string;
}

/**
 * 한 운송장(trackingNumber)의 order_items 를 mapped 상태로 전진(역행 방지)시키고,
 * 영향받은 주문들을 재집계해 주문 status 를 갱신한다.
 * 새로 delivered 로 전환된 주문 목록을 반환(배송완료 알림톡 발송용).
 */
export async function applyTrackingStatusByItems(
  admin: SupabaseClient,
  trackingNumber: string,
  mapped: 'preparing' | 'shipped' | 'delivered',
): Promise<{ matched: number; deliveredOrders: DeliveredOrder[] }> {
  const { data: items } = await admin
    .from('order_items')
    .select('id, order_id, ship_status, product_name')
    .eq('tracking_number', trackingNumber);
  if (!items || items.length === 0) return { matched: 0, deliveredOrders: [] };

  const newRank = ITEM_RANK[mapped] ?? 0;
  const orderIds = new Set<string>();
  for (const it of items as Array<{ id: string; order_id: string; ship_status: string | null }>) {
    orderIds.add(it.order_id);
    if ((ITEM_RANK[it.ship_status ?? ''] ?? 0) >= newRank) continue; // 역행/동급 방지
    await admin
      .from('order_items')
      .update({
        ship_status: mapped,
        ...(mapped === 'delivered' ? { delivered_at: new Date().toISOString() } : {}),
      })
      .eq('id', it.id);
  }

  const deliveredOrders: DeliveredOrder[] = [];
  for (const oid of orderIds) {
    const { data: ord } = await admin
      .from('orders')
      .select('id, status, phone, recipient, orderer_phone, orderer_name, order_no, order_items(ship_status, product_name)')
      .eq('id', oid)
      .single();
    if (!ord) continue;
    /* 취소·환불 진행 건은 물론, 구매확정·입금기한 만료·입금대기 주문도 배송추적 결과로 되돌리지 않는다
       (구매확정 주문이 배송완료로 내려가 7일 자동확정이 다시 돌던 문제) */
    if (['cancelled', 'refunding', 'refunded', 'confirmed', 'expired', 'pending'].includes(ord.status as string)) continue;

    const its = (ord.order_items || []) as Array<{ ship_status: string | null; product_name: string | null }>;
    const agg = aggregateOrderStatus(its.map((i) => i.ship_status));
    if (!agg) continue;

    const aggRank = ORDER_STATUS_RANK[agg] ?? 0;
    if ((ORDER_STATUS_RANK[ord.status as string] ?? 0) >= aggRank) continue; // 역행 방지

    await admin
      .from('orders')
      .update({
        status: agg,
        ...(agg === 'delivered' ? { delivered_at: new Date().toISOString() } : {}),
      })
      .eq('id', oid);

    if (agg === 'delivered') {
      const name = its[0]?.product_name || '주문 상품';
      deliveredOrders.push({
        id: ord.id as string,
        phone: (ord.phone as string | null) ?? null,
        recipient: (ord.recipient as string | null) ?? null,
        orderer_phone: (ord.orderer_phone as string | null) ?? null,
        orderer_name: (ord.orderer_name as string | null) ?? null,
        order_no: (ord.order_no as string | null) ?? null,
        productName: name + (its.length > 1 ? ` 외 ${its.length - 1}건` : ''),
      });
    }
  }

  return { matched: items.length, deliveredOrders };
}
