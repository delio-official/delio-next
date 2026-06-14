import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';
import { notifyAlimtalk } from '@/lib/sms';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/*
  쿠폰 소멸 임박 알림톡 자동발송 크론 (Vercel Cron → 매일 1회).
  · 미사용 보유쿠폰 중 만료 EXPIRY_DAYS일 이내인 쿠폰에 소멸 임박 알림톡 발송
  · user_coupons.expiry_notified 플래그로 1회만 발송 (멱등)
  보안: Authorization: Bearer <CRON_SECRET>. ?force=1 이면 일수 무관(테스트용).
*/
const EXPIRY_DAYS = 3;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const force = req.nextUrl.searchParams.get('force') === '1';
  const admin = createAdminSupabaseClient();

  // 토글 확인 (기본 on)
  const { data: st } = await admin.from('site_settings').select('value').eq('key', 'coupon_expiry_on').maybeSingle();
  if (st?.value === 'false') return NextResponse.json({ ok: true, skipped: 'toggle off' });

  const now = new Date();
  const cutoff = new Date(now.getTime() + EXPIRY_DAYS * 86400000).toISOString();
  let q = admin.from('user_coupons')
    .select('id, expires_at, profiles:user_id(name, phone), coupons:coupon_id(name)')
    .eq('is_used', false)
    .eq('expiry_notified', false)
    .not('expires_at', 'is', null)
    .gte('expires_at', now.toISOString())  // 아직 만료 전
    .limit(500);
  if (!force) q = q.lte('expires_at', cutoff);  // EXPIRY_DAYS 이내

  const { data: ucs, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  let sent = 0;
  for (const uc of (ucs || []) as unknown as Array<{ id: string; expires_at: string; profiles?: { name: string | null; phone: string | null }; coupons?: { name: string | null } }>) {
    const phone = uc.profiles?.phone;
    if (!phone) { await admin.from('user_coupons').update({ expiry_notified: true }).eq('id', uc.id); continue; }
    const couponName = uc.coupons?.name || '보유 쿠폰';
    const validUntil = new Date(uc.expires_at).toLocaleDateString('ko-KR');
    try {
      await notifyAlimtalk('coupon_expiry', phone, { recipient: uc.profiles?.name || '고객', couponName, validUntil });
      await admin.from('user_coupons').update({ expiry_notified: true }).eq('id', uc.id);
      sent++;
    } catch { /* 개별 실패는 건너뜀 → 다음 회차 재시도 */ }
  }

  return NextResponse.json({ ok: true, candidates: ucs?.length || 0, sent });
}
