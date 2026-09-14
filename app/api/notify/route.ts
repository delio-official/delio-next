import { NextRequest, NextResponse } from 'next/server';
import { notifyAlimtalk, type AlimtalkKind } from '@/lib/sms';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';

/* 자동 알림 = 카카오 알림톡 (실패 시 솔라피가 SMS 자동 대체).
   직접/대량 발송은 /api/sms 사용.

   [보안] 예전엔 로그인만 확인해서, 일반 회원이 아무 번호로 아무 알림(문자 대체 시 넣은 문구 그대로)을
   [델리오] 이름으로 보낼 수 있었다. 이제 역할별로 막는다.
   · 관리자: 모든 알림 가능 (주문 처리 알림 등)
   · 일반 회원: 고객 화면에서 쓰는 2종만, 받는 번호·이름은 서버가 본인 정보로 확정하고 문구 값은 정리한다
       - profile_changed(회원정보 변경): 본인 프로필 번호로만
       - payment_failed(결제 실패): 본인 프로필 번호 또는 본인 주문에 쓴 번호로만 */

const MEMBER_KINDS = new Set<AlimtalkKind>(['profile_changed', 'payment_failed']);
const onlyDigits = (p?: string | null) => (p || '').replace(/[^0-9]/g, '');
/* 문구 값 정리: 링크·주소 형태 제거, 줄바꿈 제거, 길이 제한 (문자 대체 시 사칭 문구 삽입 방지) */
const clean = (v: unknown, max: number) => String(v ?? '')
  .replace(/https?:\/\/\S+|www\.\S+|\b\S+\.(com|kr|net|co|me|ly|io|to|gl|link|shop|site|xyz)\b\S*/gi, '')
  .replace(/[\r\n\t]+/g, ' ')
  .trim()
  .slice(0, max);

export async function POST(req: NextRequest) {
  const sb = await createServerSupabaseClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: '잘못된 요청' }, { status: 400 });
  const { type, phone: rawPhone, paymentId, ...params } = body as { type: AlimtalkKind; phone?: string; paymentId?: string; [key: string]: string | undefined };
  let phone = rawPhone || '';
  /* 모바일 결제 실패: 복귀 페이지엔 번호·금액이 없어 paymentId 만 온다 → 결제 준비 데이터에서 본인 것인지 확인 후 채움 */
  if (type === 'payment_failed' && !phone && paymentId) {
    const { data: pp } = await createAdminSupabaseClient().from('pending_payments')
      .select('data').eq('payment_id', String(paymentId)).maybeSingle();
    const d = (pp as { data?: { userId?: string; ordererPhone?: string; phone?: string; ordererName?: string; recipient?: string; totalAmount?: number; couponDiscount?: number; pointUsed?: number } } | null)?.data;
    if (!d || d.userId !== user.id) return NextResponse.json({ error: '본인 결제가 아닙니다.' }, { status: 403 });
    phone = d.ordererPhone || d.phone || '';
    if (!params.recipient) params.recipient = d.ordererName || d.recipient || '';
    if (!params.amount) params.amount = `${Math.max(0, (d.totalAmount || 0) - (d.couponDiscount || 0) - (d.pointUsed || 0)).toLocaleString('ko-KR')}원`;
  }
  if (!type || !phone) {
    return NextResponse.json({ error: 'type, phone 필수' }, { status: 400 });
  }

  const { data: isAdmin } = await sb.rpc('is_current_user_admin');
  if (isAdmin) {
    await notifyAlimtalk(type, phone, params as Record<string, string>);
    return NextResponse.json({ ok: true });
  }

  /* ── 일반 회원 ── */
  if (!MEMBER_KINDS.has(type)) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const admin = createAdminSupabaseClient();
  const { data: prof } = await admin.from('profiles').select('name, phone').eq('id', user.id).maybeSingle();
  const profPhone = onlyDigits((prof as { phone?: string | null } | null)?.phone);
  const profName = clean((prof as { name?: string | null } | null)?.name, 20) || '고객';
  const want = onlyDigits(phone);

  if (type === 'profile_changed') {
    /* 본인 프로필 번호로만. 이름·변경항목은 서버에서 정리한 값만 사용 */
    if (!profPhone || want !== profPhone) {
      return NextResponse.json({ error: '본인 번호로만 보낼 수 있습니다.' }, { status: 403 });
    }
    await notifyAlimtalk('profile_changed', profPhone, {
      recipient: profName,
      changedAt: clean(params.changedAt, 30),
      changedFields: clean(params.changedFields, 40),
    });
    return NextResponse.json({ ok: true });
  }

  /* payment_failed: 본인 프로필 번호 또는 본인 주문에 쓴 번호(주문자·수령인)로만 */
  let allowed = !!profPhone && want === profPhone;
  if (!allowed && want) {
    const { data: ords } = await admin.from('orders')
      .select('phone, orderer_phone').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30);
    allowed = ((ords || []) as { phone: string | null; orderer_phone: string | null }[])
      .some(o => onlyDigits(o.orderer_phone) === want || onlyDigits(o.phone) === want);
  }
  if (!allowed && want) {
    /* 첫 구매 고객은 프로필·주문에 아직 번호가 없다 → 방금 결제창 직전에 서버가 검증·저장한
       본인 결제 데이터(pending_payments, 로그인 세션으로 userId 확정)의 주문자·수령인 번호와 대조 */
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: pend } = await admin.from('pending_payments')
      .select('data').eq('data->>userId', user.id).gte('created_at', since).limit(5);
    allowed = ((pend || []) as { data: { ordererPhone?: string; phone?: string } | null }[])
      .some(p => onlyDigits(p.data?.ordererPhone) === want || onlyDigits(p.data?.phone) === want);
  }
  if (!allowed) {
    return NextResponse.json({ error: '본인 번호로만 보낼 수 있습니다.' }, { status: 403 });
  }
  const amount = /^[\d,]+원$/.test(String(params.amount || '')) ? String(params.amount) : '';
  await notifyAlimtalk('payment_failed', want, {
    recipient: clean(params.recipient, 20) || profName,
    reason: clean(params.reason, 50) || '결제가 완료되지 않았습니다',
    amount,
  });
  return NextResponse.json({ ok: true });
}
