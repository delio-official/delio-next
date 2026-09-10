/* 광고성 문자 야간 전송 제한 (정보통신망법 제50조 제3항)
   21:00 ~ 다음 날 08:00(한국시간)에 광고성 정보를 보내려면 별도 야간 수신 동의가 필요.
   델리오는 야간 동의를 받지 않으므로 이 시간대 광고성 문자는 발송·예약 모두 차단한다. (안내성은 제한 없음)
   서버(/api/sms)·관리자 화면 공용 — 브라우저 시간대와 무관하게 KST로 판단 */
const KST = 9 * 3600000;

export function isAdNightKst(d: Date = new Date()): boolean {
  const h = new Date(d.getTime() + KST).getUTCHours();
  return h >= 21 || h < 8;
}

/** base 이후(현재보다 뒤) 가장 가까운 오전 9시(KST) */
export function nextKst9am(base: Date = new Date()): Date {
  const k = new Date(base.getTime() + KST);
  let t = Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate(), 9) - KST;
  while (t <= base.getTime() || t <= Date.now()) t += 86400000;
  return new Date(t);
}

export const AD_NIGHT_MSG = '광고성 문자는 밤 9시 ~ 아침 8시(한국시간)에는 보내거나 예약할 수 없습니다. (야간 수신 동의 필요 — 정보통신망법)';
