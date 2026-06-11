import { NextRequest, NextResponse } from 'next/server';
import { notifyAlimtalk, type AlimtalkKind } from '@/lib/sms';

/* 자동 알림 = 카카오 알림톡 (실패 시 솔라피가 SMS 자동 대체).
   직접/대량 발송은 /api/sms 사용. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: '잘못된 요청' }, { status: 400 });
  const { type, phone, ...params } = body as { type: AlimtalkKind; phone: string; [key: string]: string };

  if (!type || !phone) {
    return NextResponse.json({ error: 'type, phone 필수' }, { status: 400 });
  }

  await notifyAlimtalk(type, phone, params as Record<string, string>);
  return NextResponse.json({ ok: true });
}
