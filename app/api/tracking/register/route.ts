import { NextRequest, NextResponse } from 'next/server';
import { registerTrackWebhook } from '@/lib/tracker';

/**
 * 운송장 등록 시 tracker.delivery 웹훅 구독을 등록.
 * 어드민에서 송장번호 저장 직후 호출.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const carrierId = body?.carrierId as string | undefined;
  const trackingNumber = body?.trackingNumber as string | undefined;
  if (!carrierId || !trackingNumber) {
    return NextResponse.json({ error: 'carrierId / trackingNumber 필요' }, { status: 400 });
  }

  // 콜백 URL (공개 도메인). NEXT_PUBLIC_SITE_URL 우선, 없으면 요청 origin 사용.
  const base = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const callbackUrl =
    `${base}/api/tracking/webhook` +
    `?carrierId=${encodeURIComponent(carrierId)}` +
    `&trackingNumber=${encodeURIComponent(trackingNumber)}`;

  try {
    await registerTrackWebhook(carrierId, trackingNumber, callbackUrl);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[tracking/register]', e);
    // 구독 등록 실패해도 주문 저장 자체는 막지 않도록 200 + ok:false
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 });
  }
}
