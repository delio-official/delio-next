import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/*
  무통장 입금기한 만료 크론 (Vercel Cron → 매일 1회).
  · 무통장(vbank) 입금대기(pending)이고 주문(created_at)으로부터 EXPIRE_DAYS일 경과 → 'expired'(입금기한 만료)
  · 만료 시: 재고 복원 + 사용 쿠폰 복원 + 사용 포인트 환급 (결제 안 됐으므로 적립 포인트 회수는 없음)
  · 환불관리에는 기록을 남기지 않음(돌려줄 돈 없음). 주문관리에서 '입금기한 만료'로만 보임.
  보안: Authorization: Bearer <CRON_SECRET>. ?force=1 이면 경과일수 무관(테스트용).
*/
const EXPIRE_DAYS = 3;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const force = req.nextUrl.searchParams.get('force') === '1';
  const admin = createAdminSupabaseClient();
  const cutoff = new Date(Date.now() - EXPIRE_DAYS * 86400000).toISOString();

  let q = admin.from('orders')
    .select('id, user_id, point_used, used_coupon_id, refund_restored')
    .eq('status', 'pending')
    .eq('payment_method', 'vbank')
    .limit(2000);
  if (!force) q = q.lte('created_at', cutoff);

  const { data: orders, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!orders || orders.length === 0) return NextResponse.json({ ok: true, candidates: 0, expired: 0 });

  let expired = 0;
  for (const o of orders as { id: string; user_id: string; point_used: number | null; used_coupon_id: string | null; refund_restored: boolean | null }[]) {
    // 상태 전환 (동시성 가드: 여전히 pending일 때만)
    const { data: upd } = await admin.from('orders')
      .update({ status: 'expired' }).eq('id', o.id).eq('status', 'pending').select('id').maybeSingle();
    if (!upd) continue;
    expired++;

    // 쿠폰·포인트 복원 (멱등: refund_restored 가드)
    if (!o.refund_restored) {
      const { data: marked } = await admin.from('orders')
        .update({ refund_restored: true }).eq('id', o.id).eq('refund_restored', false).select('id').maybeSingle();
      if (marked) {
        if (o.used_coupon_id) {
          await admin.from('user_coupons').update({ is_used: false, used_at: null }).eq('id', o.used_coupon_id);
        }
        const pointUsed = o.point_used || 0;
        if (pointUsed > 0 && o.user_id) {
          const { data: prof } = await admin.from('profiles').select('point_balance').eq('id', o.user_id).single();
          await admin.from('profiles').update({ point_balance: Math.max(0, (prof?.point_balance || 0) + pointUsed) }).eq('id', o.user_id);
          try { await admin.from('point_logs').insert([{ user_id: o.user_id, amount: pointUsed, description: '무통장 입금기한 만료 — 사용 포인트 환급' }]); } catch { /* 원장 실패 무시 */ }
        }
      }
    }

    // 재고 복원 (멱등: stock_restored 가드)
    try { await admin.rpc('restore_order_stock', { p_order_id: o.id }); } catch { /* 복원 실패는 관리자 확인 */ }
  }

  return NextResponse.json({ ok: true, candidates: orders.length, expired });
}
