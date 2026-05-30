import { NextRequest, NextResponse } from 'next/server';
import {
  sendSMS,
  smsOrderComplete,
  smsShippingStarted,
  smsDeliveryComplete,
} from '@/lib/sms';

export type NotifyType = 'order_complete' | 'shipping_started' | 'delivery_complete';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { type, phone, ...params } = body as { type: NotifyType; phone: string; [key: string]: string };

  if (!type || !phone) {
    return NextResponse.json({ error: 'type, phone 필수' }, { status: 400 });
  }

  let text = '';

  switch (type) {
    case 'order_complete':
      text = smsOrderComplete({
        recipient: params.recipient,
        orderNo:   params.orderNo,
        amount:    Number(params.amount),
      });
      break;

    case 'shipping_started':
      text = smsShippingStarted({
        recipient:      params.recipient,
        courierName:    params.courierName,
        trackingNumber: params.trackingNumber,
      });
      break;

    case 'delivery_complete':
      text = smsDeliveryComplete({
        recipient: params.recipient,
        orderNo:   params.orderNo,
      });
      break;

    default:
      return NextResponse.json({ error: '알 수 없는 type' }, { status: 400 });
  }

  await sendSMS(phone, text);
  return NextResponse.json({ ok: true });
}
