import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createHmac, randomBytes } from 'crypto';

/* ── 건당 단가(원) — Solapi 웹 표준단가 ── */
const SMS_COST = 18;
const LMS_COST = 45;

/* ── EUC-KR 바이트 길이(한글 2byte / 그 외 1byte). SMS 한계 = 90byte ── */
function byteLen(s: string) {
  let n = 0;
  for (const ch of s) n += ch.charCodeAt(0) > 0x7f ? 2 : 1;
  return n;
}

/* ── Solapi HMAC 인증 헤더 생성 ── */
function solapiAuth(apiKey: string, apiSecret: string) {
  const date = new Date().toISOString();
  const salt = randomBytes(16).toString('hex');
  const signature = createHmac('sha256', apiSecret)
    .update(date + salt)
    .digest('hex');
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

export async function POST(req: NextRequest) {
  /* ── 환경변수 확인 ── */
  const apiKey    = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const fromNum   = process.env.SOLAPI_FROM_NUMBER;   // 발신 번호 (사전 등록 필수)

  if (!apiKey || !apiSecret || !fromNum) {
    return NextResponse.json(
      { error: 'SMS 서비스 미설정 — .env.local에 SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_FROM_NUMBER를 추가하세요.' },
      { status: 503 },
    );
  }

  /* ── 요청 파싱 ── */
  const body = await req.json().catch(() => null);
  if (!body?.text || !body?.targets) {
    return NextResponse.json({ error: '필수 필드 누락 (text, targets)' }, { status: 400 });
  }

  const { text, targets, msgKind, scheduledAt }: {
    text: string; targets: string[]; msgKind?: 'ad' | 'notice'; scheduledAt?: string | null;
  } = body;
  if (!Array.isArray(targets) || targets.length === 0) {
    return NextResponse.json({ error: '수신자가 없습니다.' }, { status: 400 });
  }
  if (text.trim().length === 0) {
    return NextResponse.json({ error: '메시지 내용을 입력하세요.' }, { status: 400 });
  }

  /* ── 유형·금액·예약 ── */
  const isLms = byteLen(text) > 90;
  const unit  = isLms ? LMS_COST : SMS_COST;
  const cost  = unit * targets.length;
  const kind  = msgKind === 'notice' ? 'notice' : 'ad';
  // 예약: 미래 시각이면 예약, 아니면 즉시
  const schedDate = scheduledAt && new Date(scheduledAt).getTime() > Date.now() ? scheduledAt : null;

  /* ── Solapi 전송 ── */
  const messages = targets.map(to => ({ to, from: fromNum, text }));
  const payload: Record<string, unknown> = { messages };
  if (schedDate) payload.scheduledDate = new Date(schedDate).toISOString();

  const solapiRes = await fetch('https://api.solapi.com/messages/v4/send-many', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': solapiAuth(apiKey, apiSecret),
    },
    body: JSON.stringify(payload),
  });

  const result = await solapiRes.json().catch(() => ({}));

  /* ── Supabase에 발송 이력 저장 ── */
  try {
    const supabase = await createServerSupabaseClient();
    await supabase.from('sms_logs').insert({
      message:       text,
      target_count:  targets.length,
      msg_type:      isLms ? 'LMS' : 'SMS',
      msg_kind:      kind,
      cost:          solapiRes.ok ? cost : 0,
      scheduled_at:  schedDate,
      status:        !solapiRes.ok ? 'failed' : (schedDate ? 'reserved' : 'sent'),
      error_msg:     solapiRes.ok ? null : (result?.error?.message || JSON.stringify(result)),
    });
  } catch { /* 로그 저장 실패는 무시 */ }

  if (!solapiRes.ok) {
    return NextResponse.json(
      { error: result?.error?.message || '발송 실패', detail: result },
      { status: 502 },
    );
  }

  return NextResponse.json({
    success: true,
    sent: targets.length,
    type: isLms ? 'LMS' : 'SMS',
    reserved: !!schedDate,
    cost,
  });
}
