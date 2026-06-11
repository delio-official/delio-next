import crypto from 'crypto';

const API_URL = 'https://api.solapi.com/messages/v4/send';

function getAuthHeader(): string {
  const date      = new Date().toISOString();
  const salt      = crypto.randomBytes(8).toString('hex');
  const signature = crypto
    .createHmac('sha256', process.env.SOLAPI_API_SECRET!)
    .update(date + salt)
    .digest('hex');
  return `HMAC-SHA256 apiKey=${process.env.SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`;
}

/** 전화번호에서 숫자만 추출 */
function cleanPhone(phone: string) {
  return phone.replace(/\D/g, '');
}

/** SMS / LMS 발송 (90바이트 초과 시 자동으로 LMS) */
export async function sendSMS(to: string, text: string): Promise<void> {
  const key    = process.env.SOLAPI_API_KEY;
  const secret = process.env.SOLAPI_API_SECRET;
  const from   = process.env.SOLAPI_FROM_NUMBER;

  if (!key || !secret || !from) {
    console.warn('[SMS] 환경변수 미설정 — 발송 스킵');
    return;
  }

  const toClean   = cleanPhone(to);
  const byteLen   = Buffer.byteLength(text, 'utf8');
  const msgType   = byteLen > 90 ? 'LMS' : 'SMS';

  try {
    const res = await fetch(API_URL, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  getAuthHeader(),
      },
      body: JSON.stringify({
        message: {
          to:   toClean,
          from: cleanPhone(from),
          text,
          type: msgType,
        },
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      console.error('[SMS] 발송 실패:', json);
    } else {
      console.log('[SMS] 발송 성공:', toClean, msgType);
    }
  } catch (e) {
    console.error('[SMS] 네트워크 오류:', e);
  }
}

/* ─────────────────────────────────────────
   카카오 알림톡 (Solapi kakaoOptions)
───────────────────────────────────────── */

/** 델리오 카카오 채널 발신프로필 ID */
export const ALIMTALK_PF_ID = 'KA01PF2606051202569430QOAPlJeKJy';

/** 등록된 알림톡 템플릿 ID (검수 통과분) */
export const ALIMTALK_TEMPLATES = {
  signup_coupon:     'KA01TP260606135557618xAgb0Wd6mUi', // 신규회원 가입 쿠폰  · #{고객명}
  order_complete:    'KA01TP260609143505056ihGFa6eTeTJ', // 신규 주문          · #{고객명} #{주문일} #{주문번호} #{상품명} #{주문금액}
  shipping_started:  'KA01TP260609152342156SAxcZ97JGOR', // 배송 시작          · #{고객명} #{상품명} #{주문번호} #{택배사} #{운송장번호}
  delivery_complete: 'KA01TP260609152939095o9pwWfxw5wL', // 배송 완료          · #{고객명} #{배송완료일시} #{주문번호} #{상품명}
  order_cancelled:   'KA01TP260609144031045Yn5NlSRuI10', // 주문 취소          · #{고객명} #{주문번호} #{취소일시} #{환불금액}
  profile_changed:   'KA01TP2606091532135742aicXXtVyTj', // 회원 정보 변경 완료 · #{고객명} #{변경일시} #{변경항목}
  payment_failed:    'KA01TP260609153605426xgTJ8SC568K', // 결제 실패          · #{고객명} #{실패사유} #{결제금액}
  delivery_delayed:  'KA01TP260609153428978wpREDvV4bQf', // 배송 지연          · #{고객명} #{주문번호} #{지연사유} #{변경도착일}
  review_request:    'KA01TP260609154123870EgfjTztWArd', // 후기 요청          · #{고객명} #{상품명}
} as const;

export type AlimtalkKind = keyof typeof ALIMTALK_TEMPLATES;

/** 알림톡 타입별 발송 — 변수 매핑 + 실패 시 SMS 대체문구.
   d 는 미리 포맷된 문자열 필드(금액은 "25,900원" 식)로 전달. */
export async function notifyAlimtalk(kind: AlimtalkKind, to: string, d: Record<string, string>): Promise<void> {
  const name = d.name || d.recipient || '고객';
  let variables: Record<string, string> = {};
  let fallback = '';

  switch (kind) {
    case 'signup_coupon':
      variables = { '#{고객명}': name };
      fallback = `[델리오] ${name}님, 가입을 환영합니다! 신규회원 1만원 쿠폰팩을 지급해드렸어요.`;
      break;
    case 'order_complete':
      variables = { '#{고객명}': name, '#{주문일}': d.orderDate || '', '#{주문번호}': d.orderNo || '', '#{상품명}': d.productName || '', '#{주문금액}': d.amount || '' };
      fallback = `[델리오] ${name}님, 주문이 접수됐습니다.\n주문번호: ${d.orderNo}\n결제금액: ${d.amount}`;
      break;
    case 'shipping_started':
      variables = { '#{고객명}': name, '#{상품명}': d.productName || '', '#{주문번호}': d.orderNo || '', '#{택배사}': d.courierName || '', '#{운송장번호}': d.trackingNumber || '' };
      fallback = `[델리오] ${name}님, 상품이 출고됐습니다.\n택배사: ${d.courierName}\n운송장번호: ${d.trackingNumber}`;
      break;
    case 'delivery_complete':
      variables = { '#{고객명}': name, '#{배송완료일시}': d.completedAt || '', '#{주문번호}': d.orderNo || '', '#{상품명}': d.productName || '' };
      fallback = `[델리오] ${name}님, 주문하신 상품의 배송이 완료됐습니다.\n주문번호: ${d.orderNo}`;
      break;
    case 'order_cancelled':
      variables = { '#{고객명}': name, '#{주문번호}': d.orderNo || '', '#{취소일시}': d.cancelledAt || '', '#{환불금액}': d.refundAmount || '' };
      fallback = `[델리오] ${name}님, 요청하신 주문이 취소 처리됐습니다.\n주문번호: ${d.orderNo}\n환불 예정 금액: ${d.refundAmount}`;
      break;
    case 'profile_changed':
      variables = { '#{고객명}': name, '#{변경일시}': d.changedAt || '', '#{변경항목}': d.changedFields || '' };
      fallback = `[델리오] ${name}님, 회원 정보가 변경됐습니다. (${d.changedFields})\n본인이 아니라면 고객센터로 연락 주세요.`;
      break;
    case 'payment_failed':
      variables = { '#{고객명}': name, '#{실패사유}': d.reason || '', '#{결제금액}': d.amount || '' };
      fallback = `[델리오] ${name}님, 결제가 정상 처리되지 않았습니다.\n사유: ${d.reason}\n결제수단 확인 후 다시 시도해주세요.`;
      break;
    case 'delivery_delayed':
      variables = { '#{고객명}': name, '#{주문번호}': d.orderNo || '', '#{지연사유}': d.reason || '', '#{변경도착일}': d.eta || '' };
      fallback = `[델리오] ${name}님, 주문하신 상품의 배송이 지연되고 있어 안내드립니다.\n주문번호: ${d.orderNo}\n변경 예상 도착일: ${d.eta}`;
      break;
    case 'review_request':
      variables = { '#{고객명}': name, '#{상품명}': d.productName || '' };
      fallback = `[델리오] ${name}님, 구매하신 ${d.productName}은 어떠셨나요? 소중한 후기를 남겨주세요!`;
      break;
  }

  await sendAlimtalk({ to, templateId: ALIMTALK_TEMPLATES[kind], variables, fallbackText: fallback });
}

/**
 * 알림톡 발송 (실패 시 disableSms:false 로 SMS 자동 대체발송)
 * @param variables 템플릿 치환 변수. 키는 `#{고객명}` 형태 그대로.
 * @param fallbackText 알림톡 실패 시 대체 SMS 본문 (선택)
 */
export async function sendAlimtalk(params: {
  to: string;
  templateId: string;
  variables?: Record<string, string>;
  fallbackText?: string;
}): Promise<void> {
  const key    = process.env.SOLAPI_API_KEY;
  const secret = process.env.SOLAPI_API_SECRET;
  const from   = process.env.SOLAPI_FROM_NUMBER;
  if (!key || !secret || !from) {
    console.warn('[알림톡] 환경변수 미설정 — 발송 스킵');
    return;
  }

  const message: Record<string, unknown> = {
    to:   cleanPhone(params.to),
    from: cleanPhone(from),
    kakaoOptions: {
      pfId:       ALIMTALK_PF_ID,
      templateId: params.templateId,
      variables:  params.variables || {},
      disableSms: false, // 알림톡 실패 시 SMS 대체발송
    },
  };
  if (params.fallbackText) message.text = params.fallbackText;

  try {
    const res  = await fetch(API_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: getAuthHeader() },
      body:    JSON.stringify({ message }),
    });
    const json = await res.json();
    if (!res.ok) console.error('[알림톡] 발송 실패:', json);
    else         console.log('[알림톡] 발송 성공:', cleanPhone(params.to), params.templateId);
  } catch (e) {
    console.error('[알림톡] 네트워크 오류:', e);
  }
}

/* ─────────────────────────────────────────
   메시지 템플릿 (일반 SMS)
───────────────────────────────────────── */

/** 주문 완료 알림 */
export function smsOrderComplete(params: {
  recipient: string;
  orderNo:   string;
  amount:    number;
}) {
  return `[델리오] ${params.recipient}님, 주문이 완료됐습니다.\n주문번호: ${params.orderNo}\n결제금액: ${params.amount.toLocaleString()}원\n감사합니다 :)`;
}

/** 배송 시작 알림 */
export function smsShippingStarted(params: {
  recipient:      string;
  courierName:    string;
  trackingNumber: string;
}) {
  return `[델리오] ${params.recipient}님, 주문하신 상품이 출고됐습니다.\n택배사: ${params.courierName}\n운송장번호: ${params.trackingNumber}\n마이페이지에서 배송조회가 가능합니다.`;
}

/** 배송 완료 알림 */
export function smsDeliveryComplete(params: {
  recipient: string;
  orderNo:   string;
}) {
  return `[델리오] ${params.recipient}님, 주문하신 상품 배송이 완료됐습니다.\n주문번호: ${params.orderNo}\n이용해주셔서 감사합니다 :)`;
}
