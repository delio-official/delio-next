/* ───────────────────────────────────────────────────────────
   멤버십 서버 작업 (service_role) — 어드민 재산정 + 크론 공용.
   · recalcAllGrades : 분기(롤링 3개월) 누적 구매로 등급 재산정 (잠금 제외)
   · issueMonthlyPacks: 등급별 월 쿠폰팩 발급 (멱등)
   · issueBirthdayCoupons: 생일월 5천원 쿠폰 발급 (멱등)
   ─────────────────────────────────────────────────────────── */
import { createAdminSupabaseClient } from '@/lib/supabase-admin';
import {
  computeGrade, normalizeGrade, quarterKey, DEFAULT_TIERS, MEMBERSHIP_COUPON,
  type MembershipTier,
} from '@/lib/membership';

type Admin = ReturnType<typeof createAdminSupabaseClient>;

async function loadTiers(admin: Admin): Promise<MembershipTier[]> {
  const { data } = await admin.from('membership_tiers').select('*').order('sort');
  return data && data.length ? (data as MembershipTier[]) : DEFAULT_TIERS;
}

function ymd(d = new Date()) { return d.toISOString().slice(0, 10); }
function monthKey(d = new Date()) { return d.toISOString().slice(0, 7); }    // YYYY-MM

/** 생일 문자열에서 'MM' 추출 (YYYY-MM-DD / YYYYMMDD / MM-DD 지원) */
function birthMonth(birth: string | null | undefined): string | null {
  if (!birth) return null;
  let m = birth.match(/^\d{4}-(\d{2})-\d{2}/);
  if (m) return m[1];
  m = birth.match(/^(\d{2})-\d{2}$/);
  if (m) return m[1];
  m = birth.match(/^\d{4}(\d{2})\d{2}$/);
  if (m) return m[1];
  return null;
}

/* ── 등급 재산정 ───────────────────────────────────────────── */
export async function recalcAllGrades(): Promise<{ updated: number }> {
  const admin = createAdminSupabaseClient();
  const tiers = await loadTiers(admin);

  // 롤링 3개월(분기) 확정 주문 집계
  const since = new Date(Date.now() - 90 * 86400000).toISOString();
  const { data: orders } = await admin
    .from('orders')
    .select('user_id, final_amount, status, created_at')
    .gte('created_at', since)
    .in('status', ['delivered', 'confirmed'])
    .limit(50000);

  const agg: Record<string, { amount: number; count: number }> = {};
  (orders || []).forEach((o: { user_id: string | null; final_amount: number | null }) => {
    if (!o.user_id) return;
    const a = agg[o.user_id] || { amount: 0, count: 0 };
    a.amount += o.final_amount || 0;
    a.count += 1;
    agg[o.user_id] = a;
  });

  const { data: profs } = await admin.from('profiles').select('id, grade, grade_locked').limit(100000);
  let updated = 0;
  for (const p of (profs || []) as { id: string; grade: string | null; grade_locked: boolean | null }[]) {
    if (p.grade_locked) continue;
    const s = agg[p.id] || { amount: 0, count: 0 };
    const newGrade = computeGrade(s.amount, s.count, tiers);
    if (normalizeGrade(p.grade) !== newGrade) {
      await admin.from('profiles')
        .update({ grade: newGrade, grade_updated_at: new Date().toISOString() })
        .eq('id', p.id);
      updated++;
    }
  }

  await admin.from('site_settings').upsert(
    { key: 'membership_last_recalc', value: new Date().toISOString().slice(0, 16).replace('T', ' ') },
    { onConflict: 'key' },
  );
  return { updated };
}

/* ── 등급별 월 쿠폰팩 발급 ─────────────────────────────────── */
export async function issueMonthlyPacks(): Promise<{ issued: number }> {
  const admin = createAdminSupabaseClient();
  const period = monthKey();
  const tiers = await loadTiers(admin);

  const codes = [...new Set(tiers.filter(t => t.monthly_active).flatMap(t => t.coupon_codes))];
  if (codes.length === 0) return { issued: 0 };

  const { data: cps } = await admin.from('coupons').select('id, code, valid_days').in('code', codes);
  const codeMap: Record<string, { id: string; valid_days: number | null }> = {};
  (cps || []).forEach((c: { id: string; code: string; valid_days: number | null }) => { codeMap[c.code] = { id: c.id, valid_days: c.valid_days }; });

  const { data: profs } = await admin.from('profiles').select('id, grade').limit(100000);
  const { data: granted } = await admin.from('membership_grants').select('user_id').eq('grant_type', 'monthly').eq('period', period);
  const grantedSet = new Set((granted || []).map((g: { user_id: string }) => g.user_id));

  let issued = 0;
  for (const p of (profs || []) as { id: string; grade: string | null }[]) {
    if (grantedSet.has(p.id)) continue;
    const tier = tiers.find(t => t.grade === normalizeGrade(p.grade));
    if (!tier || !tier.monthly_active || tier.coupon_codes.length === 0) continue;
    const rows = tier.coupon_codes
      .map(code => codeMap[code])
      .filter(Boolean)
      .map(c => ({
        user_id: p.id, coupon_id: c.id, grant_period: period,
        expires_at: c.valid_days != null ? new Date(Date.now() + c.valid_days * 86400000).toISOString() : null,
      }));
    if (rows.length === 0) continue;
    await admin.from('user_coupons').insert(rows);
    await admin.from('membership_grants').insert({ user_id: p.id, grant_type: 'monthly', period, detail: tier.coupon_codes.join(',') });
    issued++;
  }
  return { issued };
}

/* ── 생일월 쿠폰 발급 ──────────────────────────────────────── */
export async function issueBirthdayCoupons(): Promise<{ issued: number }> {
  const admin = createAdminSupabaseClient();
  const now = new Date();
  const yearPeriod = String(now.getFullYear());
  const curMonth = ymd(now).slice(5, 7);

  const { data: bday } = await admin.from('coupons').select('id, valid_days').eq('code', MEMBERSHIP_COUPON.BIRTHDAY).maybeSingle();
  if (!bday) return { issued: 0 };
  const bd = bday as { id: string; valid_days: number | null };

  const { data: profs } = await admin.from('profiles').select('id, birth').limit(100000);
  const { data: granted } = await admin.from('membership_grants').select('user_id').eq('grant_type', 'birthday').eq('period', yearPeriod);
  const grantedSet = new Set((granted || []).map((g: { user_id: string }) => g.user_id));

  let issued = 0;
  for (const p of (profs || []) as { id: string; birth: string | null }[]) {
    if (grantedSet.has(p.id)) continue;
    if (birthMonth(p.birth) !== curMonth) continue;
    await admin.from('user_coupons').insert({
      user_id: p.id, coupon_id: bd.id, grant_period: `bday-${yearPeriod}`,
      expires_at: bd.valid_days != null ? new Date(Date.now() + bd.valid_days * 86400000).toISOString() : null,
    });
    await admin.from('membership_grants').insert({ user_id: p.id, grant_type: 'birthday', period: yearPeriod, detail: curMonth });
    issued++;
  }
  return { issued };
}
