import { NextResponse } from 'next/server';

/* GA4 방문 수(세션/사용자) 조회 — 대시보드 판매 성과용
 *  필요한 환경변수:
 *    GA_PROPERTY_ID        : GA4 속성 ID (숫자, 예: 391234567)
 *    GA_CREDENTIALS_JSON   : 서비스 계정 JSON 전체 문자열 (GA 속성에 뷰어 권한 부여)
 *  미설정 시 { configured:false } 반환 → 프론트는 방문수/전환율을 "—"로 표시
 */
export async function GET(req: Request) {
  const propertyId = process.env.GA_PROPERTY_ID;
  const credsJson = process.env.GA_CREDENTIALS_JSON;
  if (!propertyId || !credsJson) {
    return NextResponse.json({ configured: false });
  }

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('start') || '7daysAgo';
  const endDate = searchParams.get('end') || 'today';
  const daily = searchParams.get('daily') === '1';

  try {
    const { BetaAnalyticsDataClient } = await import('@google-analytics/data');
    const credentials = JSON.parse(credsJson);
    const client = new BetaAnalyticsDataClient({ credentials });
    const [resp] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
      ...(daily ? { dimensions: [{ name: 'date' }], orderBys: [{ dimension: { dimensionName: 'date' } }] } : {}),
    });
    if (daily) {
      const series = (resp.rows || []).map(r => ({
        date: r.dimensionValues?.[0]?.value || '',          // YYYYMMDD
        sessions: Number(r.metricValues?.[0]?.value || 0),
      }));
      const sessions = series.reduce((s, d) => s + d.sessions, 0);
      return NextResponse.json({ configured: true, sessions, series });
    }
    const row = resp.rows?.[0];
    const sessions = Number(row?.metricValues?.[0]?.value || 0);
    const users = Number(row?.metricValues?.[1]?.value || 0);
    return NextResponse.json({ configured: true, sessions, users });
  } catch (e) {
    return NextResponse.json({ configured: false, error: String(e) });
  }
}
