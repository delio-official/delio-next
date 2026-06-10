import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';
import { recalcAllGrades, issueMonthlyPacks, issueBirthdayCoupons } from '@/lib/membership-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/*
  멤버십 자동화 크론 (Vercel Cron → 매일 00:10 호출).
  · 분기 첫날(1·4·7·10월 1일)  → 등급 재산정
  · 매월 1일                    → 등급별 월 쿠폰팩 발급
  · 매일                        → 생일월 회원 생일쿠폰 발급 (연 1회 멱등)
  보안: Authorization: Bearer <CRON_SECRET>. ?force=1 이면 날짜 무관 전체 실행(테스트용).
*/
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const force = req.nextUrl.searchParams.get('force') === '1';
  const now = new Date();
  const isMonthStart = now.getDate() === 1;
  const isQuarterStart = isMonthStart && now.getMonth() % 3 === 0; // 1·4·7·10월 1일

  // 운영 토글 로드
  const admin = createAdminSupabaseClient();
  const { data: st } = await admin.from('site_settings').select('key, value')
    .in('key', ['membership_auto_recalc', 'membership_monthly_on', 'membership_birthday_on']);
  const flag = (k: string) => !(st || []).some((r: { key: string; value: string }) => r.key === k && r.value === 'false');

  const result: Record<string, unknown> = { ran: [] as string[] };
  try {
    if (flag('membership_auto_recalc') && (force || isQuarterStart)) {
      result.recalc = await recalcAllGrades();
      (result.ran as string[]).push('recalc');
    }
    if (flag('membership_monthly_on') && (force || isMonthStart)) {
      result.monthly = await issueMonthlyPacks();
      (result.ran as string[]).push('monthly');
    }
    if (flag('membership_birthday_on')) {
      result.birthday = await issueBirthdayCoupons();
      (result.ran as string[]).push('birthday');
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message, ...result }, { status: 500 });
  }
}
