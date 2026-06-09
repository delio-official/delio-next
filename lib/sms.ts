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

/** 등록된 알림톡 템플릿 ID (검수 통과분부터 채움) */
export const ALIMTALK_TEMPLATES = {
  signup_coupon: 'KA01TP260606135557618xAgb0Wd6mUi', // 신규회원 가입 쿠폰 (변수: #{고객명})
} as const;

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
