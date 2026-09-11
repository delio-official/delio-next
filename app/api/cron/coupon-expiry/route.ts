import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';
import { notifyAlimtalk } from '@/lib/sms';
import { applyCouponValidity } from '@/lib/coupon-validity';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/*
  쿠폰 소멸 임박 알림톡 자동발송 크론 (Vercel Cron → 매일 1회).
  · 미사용 보유쿠폰 중 만료 EXPIRY_DAYS일 이내인 쿠폰에 소멸 임박 알림톡 발송
  · user_coupons.expiry_notified 플래그로 1회만 발송 (멱등), 회원당 1통으로 묶어 발송
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
  /* 안전망: 유효기간(일) 쿠폰인데 만료일이 비어 있는 보유쿠폰 → 발급일+N일로 채움 (가입쿠폰 누락 방지) */
  const validityFixed = await applyCouponValidity(admin).catch(() => 0);

  /* user_coupons ↔ profiles 는 직접 FK 관계가 없어(auth.users 경유) 조인 불가 → 쿠폰만 조회 후 회원정보는 따로 */
  let q = admin.from('user_coupons')
    .select('id, user_id, expires_at, coupons:coupon_id(name)')
    .eq('is_used', false)
    .eq('expiry_notified', false)
    .not('expires_at', 'is', null)
    .gte('expires_at', now.toISOString())  // 아직 만료 전
    .limit(500);
  if (!force) q = q.lte('expires_at', cutoff);  // EXPIRY_DAYS 이내

  const { data: ucs, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const list = (ucs || []) as unknown as Array<{ id: string; user_id: string; expires_at: string; coupons?: { name: string | null } }>;
  const userIds = [...new Set(list.map(u => u.user_id).filter(Boolean))];
  const profMap = new Map<string, { name: string | null; phone: string | null }>();
  if (userIds.length) {
    const { data: profs } = await admin.from('profiles').select('id, name, phone').in('id', userIds);
    for (const p of (profs || []) as { id: string; name: string | null; phone: string | null }[]) profMap.set(p.id, { name: p.name, phone: p.phone });
  }

  /* 회원 1명당 알림톡 1통 — 여러 장이 동시에 임박하면 "쿠폰명 외 N장", 유효기간은 가장 빠른 만료일 */
  const byUser = new Map<string, typeof list>();
  for (const uc of list) {
    if (!uc.user_id) continue;
    byUser.set(uc.user_id, [...(byUser.get(uc.user_id) || []), uc]);
  }

  let sent = 0;
  for (const [uid, ucsOfUser] of byUser) {
    const ids = ucsOfUser.map(u => u.id);
    const prof = profMap.get(uid);
    const phone = prof?.phone;
    if (!phone) { await admin.from('user_coupons').update({ expiry_notified: true }).in('id', ids); continue; }
    ucsOfUser.sort((x, y) => x.expires_at.localeCompare(y.expires_at));
    const first = ucsOfUser[0];
    const couponName = (first.coupons?.name || '보유 쿠폰') + (ucsOfUser.length > 1 ? ` 외 ${ucsOfUser.length - 1}장` : '');
    const validUntil = new Date(first.expires_at).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
    /* 실제 발송 성공했을 때만 '보냄' 플래그 → 실패건은 다음 회차에 재시도 */
    const ok = await notifyAlimtalk('coupon_expiry', phone, { recipient: prof?.name || '고객', couponName, validUntil }).catch(() => false);
    if (ok) {
      await admin.from('user_coupons').update({ expiry_notified: true }).in('id', ids);
      sent++;
    }
  }

  return NextResponse.json({ ok: true, validityFixed, candidates: list.length, sent });
}
