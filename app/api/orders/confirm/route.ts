import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';

/* 고객 구매확정 — 배송완료(delivered) 상태에서만 본인이 직접 확정.
   status → confirmed, confirmed_at 기록. (자동확정 7일과 동일 결과, 조기 확정용)
   진행 중 환불신청이 있으면 확정 불가(환불 보호). */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: '인증 필요' }, { status: 401 });

  const { orderId } = await req.json().catch(() => ({}));
  if (!orderId) return NextResponse.json({ ok: false, error: 'orderId 누락' }, { status: 400 });

  const admin = createAdminSupabaseClient();
  const { data: order } = await admin.from('orders')
    .select('id, user_id, status')
    .eq('id', orderId).maybeSingle();
  if (!order) return NextResponse.json({ ok: false, error: '주문 없음' }, { status: 404 });
  if (order.user_id !== user.id) return NextResponse.json({ ok: false, error: '본인 주문이 아닙니다' }, { status: 403 });
  if (order.status === 'confirmed') return NextResponse.json({ ok: true, already: true });
  if (order.status !== 'delivered') return NextResponse.json({ ok: false, error: '배송완료 상태에서만 구매확정할 수 있습니다.' }, { status: 400 });

  /* 진행 중 환불신청이 있으면 확정 차단 */
  const { data: reqs } = await admin.from('refund_requests')
    .select('id').eq('order_id', orderId).in('status', ['pending', 'processing', 'hold']).limit(1);
  if (reqs && reqs.length > 0) {
    return NextResponse.json({ ok: false, error: '진행 중인 환불신청이 있어 구매확정할 수 없습니다.' }, { status: 400 });
  }

  const { error } = await admin.from('orders')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('id', orderId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
