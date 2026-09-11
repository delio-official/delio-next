import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';
import { createDirectOrder, type DirectOrderData } from '@/lib/direct-order';

/* 결제창 없는 주문 생성 — 무통장입금(mode:'vbank') · 0원 결제(mode:'free').
   주문자는 로그인 세션으로 확정, 금액·쿠폰·포인트·재고는 서버가 검증·처리 (lib/direct-order) */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const mode = body?.mode === 'vbank' ? 'vbank' : body?.mode === 'free' ? 'free' : null;
  if (!mode || !body?.orderData) return NextResponse.json({ ok: false, error: '필수 파라미터 누락' }, { status: 400 });

  const authClient = await createServerSupabaseClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: '로그인이 필요합니다. 다시 로그인 후 주문해주세요.' }, { status: 401 });

  const orderData = { ...body.orderData, userId: user.id } as DirectOrderData;
  const r = await createDirectOrder(createAdminSupabaseClient(), orderData, mode, { bypass: process.env.PAYMENT_BYPASS === 'true' });
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, orderNo: r.orderNo });
}
