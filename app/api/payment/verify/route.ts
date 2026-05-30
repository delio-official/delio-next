import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const apiSecret = process.env.PORTONE_API_SECRET;
  if (!apiSecret) {
    return NextResponse.json({ error: '포트원 API 시크릿 미설정' }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.paymentId || !body?.orderData) {
    return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });
  }

  const { paymentId, bypass, orderData } = body;

  /* ── 1. 포트원 검증 (bypass 모드면 스킵) ── */
  if (!bypass) {
    const portoneRes = await fetch(
      `https://api.portone.io/payments/${encodeURIComponent(paymentId)}`,
      {
        headers: {
          Authorization: `PortOne ${apiSecret}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!portoneRes.ok) {
      const err = await portoneRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: '포트원 결제 조회 실패', detail: err },
        { status: 502 }
      );
    }

    const payment = await portoneRes.json();

    if (payment.status !== 'PAID') {
      return NextResponse.json(
        { error: `결제 미완료 (status: ${payment.status})` },
        { status: 400 }
      );
    }

    if (payment.amount?.total !== orderData.totalAmount) {
      return NextResponse.json(
        { error: `결제금액 불일치 (expected: ${orderData.totalAmount}, actual: ${payment.amount?.total})` },
        { status: 400 }
      );
    }
  }

  /* ── 2. Supabase에 주문 저장 ── */
  try {
    const supabase = await createServerSupabaseClient();

    const insertRow: Record<string, unknown> = {
      user_id:         orderData.userId,
      status:          'paid',
      total_amount:    orderData.subtotal,
      discount_amount: 0,
      coupon_discount: 0,
      point_used:      0,
      final_amount:    orderData.totalAmount,
      recipient:       orderData.recipient,
      phone:           orderData.phone,
      zipcode:         orderData.zipcode,
      address1:        orderData.addr1,
      address2:        orderData.addr2,
      delivery_type:   'parcel',
      delivery_memo:   orderData.memo,
      payment_method:  orderData.payMethod,
      paid_at:         new Date().toISOString(),
    };
    if (!bypass) insertRow.portone_payment_id = paymentId;

    console.log('[verify] inserting order:', JSON.stringify(insertRow));

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(insertRow)
      .select()
      .single();

    if (orderError || !order) {
      console.error('[verify] order insert error:', orderError);
      return NextResponse.json({ error: '주문 저장 실패', detail: orderError }, { status: 500 });
    }

    /* 주문 아이템 */
    await supabase.from('order_items').insert(
      orderData.items.map((i: { id: string; name: string; price: number; quantity: number; thumbnail?: string }) => ({
        order_id:      order.id,
        product_id:    i.id,
        product_name:  i.name,
        unit_price:    i.price,
        quantity:      i.quantity,
        subtotal:      i.price * i.quantity,
        thumbnail_url: i.thumbnail || null,
      }))
    );

    /* 포인트 적립 (1%) */
    const earned = Math.floor(orderData.totalAmount * 0.01);
    if (earned > 0 && orderData.userId) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('point_balance')
        .eq('id', orderData.userId)
        .single();
      if (prof) {
        await supabase.from('profiles')
          .update({ point_balance: (prof.point_balance || 0) + earned })
          .eq('id', orderData.userId);
      }
    }

    return NextResponse.json({
      success: true,
      orderNo: order.order_no,
      earnedPoint: Math.floor(orderData.totalAmount * 0.01),
    });

  } catch (e) {
    console.error('[verify] unexpected error:', e);
    return NextResponse.json({ error: '서버 오류', detail: String(e) }, { status: 500 });
  }
}
