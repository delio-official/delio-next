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
   메시지 템플릿
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
