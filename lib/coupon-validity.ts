import type { SupabaseClient } from '@supabase/supabase-js';

/* 쿠폰 '유효기간(일)' 적용 (멱등).
   받은 쿠폰(user_coupons)의 만료일이 비어 있고, 쿠폰에 유효기간(valid_days)이 있으면 → 발급일 + N일로 채운다.
   신규가입 쿠폰팩(DB 함수 grant_signup_coupons)이 valid_days 를 무시하고 만료일 없이 넣는 문제를 보완.
   - 가입 직후(이메일 /api/auth/welcome · 카카오 /auth/callback · 네이버 콜백): userId 지정
   - 매일 쿠폰 만료 알림 크론: 전체 대상(누락 안전망)
   admin = service-role Supabase client. 반환: 채운 건수 */
export async function applyCouponValidity(admin: SupabaseClient, userId?: string): Promise<number> {
  const { data: cps } = await admin.from('coupons').select('id, valid_days').not('valid_days', 'is', null);
  const days = new Map<string, number>(
    ((cps || []) as { id: string; valid_days: number | null }[])
      .filter(c => (c.valid_days ?? 0) > 0)
      .map(c => [c.id, c.valid_days as number]),
  );
  if (days.size === 0) return 0;

  /* 처리할수록 '만료일 없음' 대상이 줄어드므로 페이지를 넘기지 않고, 남은 대상이 없을 때까지 앞에서부터 반복
     (한 번에 1,000건까지만 오기 때문 — 예전엔 1회만 조회해서 1,000건 넘으면 일부가 다음 날로 밀렸다) */
  let fixed = 0;
  for (let round = 0; round < 50; round++) {
    let q = admin.from('user_coupons')
      .select('id, coupon_id, issued_at')
      .is('expires_at', null)
      .in('coupon_id', [...days.keys()])
      .order('id')
      .limit(1000);
    if (userId) q = q.eq('user_id', userId);
    const { data: rows } = await q;
    if (!rows || rows.length === 0) break;
    const before = fixed;

    for (const r of (rows || []) as { id: string; coupon_id: string; issued_at: string | null }[]) {
      const base = r.issued_at ? new Date(r.issued_at).getTime() : Date.now();
      const expires_at = new Date(base + (days.get(r.coupon_id) as number) * 86400000).toISOString();
      const { error } = await admin.from('user_coupons').update({ expires_at }).eq('id', r.id).is('expires_at', null);
      if (!error) fixed++;
    }
    if (fixed === before) break; // 전부 실패한 회차면 무한 반복 방지
  }
  return fixed;
}
