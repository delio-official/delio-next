import { NextRequest, NextResponse } from 'next/server';

const TOKEN_URL  = 'https://auth.tracker.delivery/oauth2/token';
const TRACKER_GQL = 'https://apis.tracker.delivery/graphql';

const QUERY = `
  query Track($carrierId: ID!, $trackingNumber: String!) {
    track(carrierId: $carrierId, trackingNumber: $trackingNumber) {
      lastEvent {
        time
        status { code name }
        description
      }
      events(last: 50) {
        edges {
          node {
            time
            status { code name }
            description
            location { name }
          }
        }
      }
    }
  }
`;

/* ── 토큰 메모리 캐시 (서버 프로세스 내에서 공유) ── */
let cachedToken: string | null = null;
let tokenExpiresAt = 0; // epoch ms

async function getToken(): Promise<string> {
  // 만료 1분 전에 미리 갱신
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const clientId     = process.env.TRACKER_CLIENT_ID;
  const clientSecret = process.env.TRACKER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('TRACKER_CLIENT_ID / TRACKER_CLIENT_SECRET 환경변수가 없습니다.');
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    throw new Error(`토큰 발급 실패: ${res.status}`);
  }

  const json = await res.json();
  cachedToken    = json.access_token as string;
  // expires_in(초) 없으면 21일로 가정
  const expiresIn = (json.expires_in ?? 60 * 60 * 24 * 21) as number;
  tokenExpiresAt = Date.now() + expiresIn * 1000;

  return cachedToken;
}

async function queryTracker(carrierId: string, trackingNumber: string, token: string) {
  const res = await fetch(TRACKER_GQL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      query: QUERY,
      variables: { carrierId, trackingNumber },
    }),
    next: { revalidate: 60 },
  });
  return res.json();
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const carrierId      = searchParams.get('carrierId');
  const trackingNumber = searchParams.get('trackingNumber');

  if (!carrierId || !trackingNumber) {
    return NextResponse.json(
      { error: '택배사 코드와 운송장번호가 필요합니다.' },
      { status: 400 }
    );
  }

  try {
    let token = await getToken();
    let json  = await queryTracker(carrierId, trackingNumber, token);

    // 토큰 만료로 UNAUTHENTICATED 에러 시 한 번 재발급 후 재시도
    const isUnauth = json.errors?.some(
      (e: { extensions?: { code?: string } }) => e.extensions?.code === 'UNAUTHENTICATED'
    );
    if (isUnauth) {
      cachedToken  = null;
      tokenExpiresAt = 0;
      token = await getToken();
      json  = await queryTracker(carrierId, trackingNumber, token);
    }

    if (json.errors?.length) {
      return NextResponse.json(
        { error: json.errors[0]?.message || '조회 실패' },
        { status: 400 }
      );
    }

    const track = json.data?.track || {};
    // edges 구조를 flat 배열로 변환해서 내보냄 (TrackingModal 호환)
    const events = track.events?.edges?.map(
      (e: { node: unknown }) => e.node
    ) ?? [];
    return NextResponse.json({ ...track, events });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '배송 조회 중 오류가 발생했습니다.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
