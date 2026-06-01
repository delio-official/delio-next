/** tracker.delivery 공통 유틸 (서버 전용) */

const TOKEN_URL = 'https://auth.tracker.delivery/oauth2/token';
const TRACKER_GQL = 'https://apis.tracker.delivery/graphql';

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

export async function getTrackerToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken;
  const clientId = process.env.TRACKER_CLIENT_ID;
  const clientSecret = process.env.TRACKER_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('TRACKER_CLIENT_ID / TRACKER_CLIENT_SECRET 미설정');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
  });
  if (!res.ok) throw new Error(`토큰 발급 실패: ${res.status}`);
  const json = await res.json();
  cachedToken = json.access_token as string;
  const expiresIn = (json.expires_in ?? 60 * 60 * 24 * 21) as number;
  tokenExpiresAt = Date.now() + expiresIn * 1000;
  return cachedToken;
}

/** 운송장의 최신 상태코드 조회 (예: DELIVERED, IN_TRANSIT ...) */
export async function fetchLastStatusCode(carrierId: string, trackingNumber: string): Promise<string | null> {
  const query = `
    query Track($carrierId: ID!, $trackingNumber: String!) {
      track(carrierId: $carrierId, trackingNumber: $trackingNumber) {
        lastEvent { status { code } }
      }
    }`;
  const run = async (token: string) =>
    fetch(TRACKER_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query, variables: { carrierId, trackingNumber } }),
    }).then(r => r.json());

  let token = await getTrackerToken();
  let json = await run(token);
  if (json.errors?.some((e: { extensions?: { code?: string } }) => e.extensions?.code === 'UNAUTHENTICATED')) {
    cachedToken = null; tokenExpiresAt = 0;
    token = await getTrackerToken();
    json = await run(token);
  }
  return json.data?.track?.lastEvent?.status?.code ?? null;
}

/** tracker.delivery 상태코드 → 우리 주문 상태 */
export function mapTrackerCodeToOrderStatus(code: string | null): 'preparing' | 'shipped' | 'delivered' | null {
  switch (code) {
    case 'DELIVERED':
      return 'delivered';
    case 'OUT_FOR_DELIVERY':
    case 'IN_TRANSIT':
    case 'AT_PICKUP':
    case 'AVAILABLE_FOR_PICKUP':
      return 'shipped';
    case 'INFORMATION_RECEIVED':
      return 'preparing';
    default:
      return null; // UNKNOWN / ATTEMPT_FAIL / EXCEPTION 등은 변경 안 함
  }
}

/** 주문 상태 순위 (앞으로만 진행, 역행 방지) */
export const ORDER_STATUS_RANK: Record<string, number> = {
  pending: 0, paid: 1, preparing: 2, shipped: 3, delivered: 4,
};

/**
 * tracker.delivery 웹훅 구독 등록.
 * callbackUrl 에 carrierId·trackingNumber 를 쿼리로 실어 보내 수신 시 식별이 쉽도록 함.
 */
export async function registerTrackWebhook(carrierId: string, trackingNumber: string, callbackUrl: string) {
  const token = await getTrackerToken();
  const mutation = `
    mutation RegisterTrackWebhook($input: RegisterTrackWebhookInput!) {
      registerTrackWebhook(input: $input)
    }`;
  const expirationTime = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(); // 14일 후 만료
  const res = await fetch(TRACKER_GQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      query: mutation,
      variables: { input: { carrierId, trackingNumber, callbackUrl, expirationTime } },
    }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message || '웹훅 구독 등록 실패');
  }
  return json.data;
}
