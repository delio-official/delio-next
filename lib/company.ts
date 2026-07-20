/** 고객센터·회사 정보 단일 소스(SSOT).
 *  전화번호·상담시간·계좌 등은 여기 값만 바꾸면 사이트 전체가 일관되게 바뀐다.
 *  (사이트 하단 푸터 표기와 동일하게 유지할 것 — 상품고시정보는 법적 표기사항) */

export const CS_PHONE   = '070-8064-3601';        // 고객센터 전화
export const CS_HOURS   = '평일 09:00~18:00';     // 운영시간
export const CS_LUNCH   = '12:00~13:00';          // 점심시간(휴게)
export const CS_HOLIDAY = '주말 및 공휴일';        // 휴무일
export const CS_EMAIL   = 'deli_o@naver.com';     // 고객센터 이메일

/** 상세정보/안내에 쓰는 상담시간 한 줄 (점심시간 포함). */
export const CS_HOURS_LINE = `운영시간: ${CS_HOURS} 점심시간 ${CS_LUNCH} 휴무일: ${CS_HOLIDAY}`;

/** 입금 계좌 안내. ⚠️ 계좌번호·예금주는 실제 계좌와 반드시 일치해야 함.
 *  2026-07 사장님 확정: 국민은행 469901-04-404587 / 예금주 송민창(델리오). */
export const BANK_NAME    = '국민은행';
export const BANK_ACCOUNT = '469901-04-404587';
export const BANK_HOLDER  = '송민창(델리오)';
export const BANK_LINE    = `${BANK_NAME} ${BANK_ACCOUNT}`;
