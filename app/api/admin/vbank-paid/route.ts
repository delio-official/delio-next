import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';
import { normalizeGrade, effectiveRate, DEFAULT_TIERS, type MembershipTier } from '@/lib/membership';

/* 무통장 입금확인 (관리자 전용, 멱등).
   입금대기(pending) 주문을 결제 이후 단계로 넘기는 순간 1회만:
   - 상태 전환 + 결제일(paid_at) 기록
   - 구매 적립 지급 — 카드 결제(finalize-order)와 동일하게 회원 등급별 적립률 × 실결제금액, 포인트 on/off 존중
   동시성 가드: 'status = pending' 조건부 업데이트에 성공한 호출만 적립한다(중복 지급 방지). */
const PAID_STATUSES = ['paid', 'preparing', 'shipped', 'delivered', 'confirmed'];

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: '인증 필요' }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc('is_current_user_admin');
  if (!isAdmin) return NextResponse.json({ ok: false, error: '권한 없음' }, { status: 403 });

  let orderIds: string[] = [];
  let status = '';
  try {
    const b = await req.json();
    orderIds = Array.isArray(b?.orderIds) ? b.orderIds.filter((x: unknown) => typeof x === 'string') : [];
    status = typeof b?.status === 'string' ? b.status : '';
  } catch { /* noop */ }
  if (orderIds.length === 0 || !PAID_STATUSES.includes(status)) {
    return NextResponse.json({ ok: false, error: '잘못된 요청' }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  const { data: pe } = await admin.from('site_settings').select('value').eq('key', 'point_enabled').maybeSingle();
  const pointEnabled = !pe || pe.value !== 'false';

  const nowIso = new Date().toISOString();
  const granted: { id: string; earned: number }[] = [];
  for (const id of orderIds) {
    const { data: ord } = await admin.from('orders')
      .update({
        status, paid_at: nowIso,
        ...(status === 'delivered' ? { delivered_at: nowIso } : {}),
        ...(status === 'confirmed' ? { confirmed_at: nowIso } : {}),
      })
      .eq('id', id).eq('status', 'pending')
      .select('id, user_id, final_amount').maybeSingle();
    if (!ord) continue;   // 이미 입금확인됐거나 입금대기가 아님 → 적립 없음

    let earned = 0;
    if (ord.user_id && pointEnabled) {
      const { data: prof } = await admin.from('profiles').select('point_balance, grade').eq('id', ord.user_id).single();
      if (prof) {
        const grade = normalizeGrade(prof.grade);
        const { data: tierRow } = await admin.from('membership_tiers').select('*').eq('grade', grade).maybeSingle();
        const tier = (tierRow as MembershipTier | null) ?? DEFAULT_TIERS.find(t => t.grade === grade)!;
        earned = Math.floor((ord.final_amount || 0) * effectiveRate(tier) / 100);
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

  return NextResponse.json({ ok: true, granted });
}
