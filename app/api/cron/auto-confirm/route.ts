import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/*
  자동 구매확정 크론 (Vercel Cron → 매일 1회).
  · 배송완료(delivered)이고 배송완료일(delivered_at)로부터 CONFIRM_DAYS일 경과한 주문을 구매확정(confirmed)으로 변경
  · 진행 중인 환불신청(pending/processing/hold)이 걸린 주문은 제외 (환불 진행 보호)
  보안: Authorization: Bearer <CRON_SECRET>. ?force=1 이면 경과일수 무관(테스트용).
*/
const CONFIRM_DAYS = 8;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const force = req.nextUrl.searchParams.get('force') === '1';
  const admin = createAdminSupabaseClient();

  const cutoff = new Date(Date.now() - CONFIRM_DAYS * 86400000).toISOString();

  // 배송완료 + delivered_at 존재 + (강제 아니면) 경과 CONFIRM_DAYS일 이상
  let q = admin.from('orders')
    .select('id')
    .eq('status', 'delivered')
    .not('delivered_at', 'is', null)
    .limit(2000);
  if (!force) q = q.lte('delivered_at', cutoff);

  const { data: orders, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const ids = (orders || []).map((o: { id: string }) => o.id);
  if (ids.length === 0) return NextResponse.json({ ok: true, candidates: 0, confirmed: 0 });

  // 진행 중 환불신청이 있는 주문은 확정 제외
  const { data: reqs } = await admin.from('refund_requests')
    .select('order_id')
    .in('order_id', ids)
    .in('status', ['pending', 'processing', 'hold']);
  const blocked = new Set((reqs || []).map((r: { order_id: string }) => r.order_id));
  const targets = ids.filter(id => !blocked.has(id));

  if (targets.length > 0) {
    const { error: upErr } = await admin.from('orders').update({ status: 'confirmed' }).in('id', targets);
    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, candidates: ids.length, confirmed: targets.length, blockedByRefund: blocked.size });
}
