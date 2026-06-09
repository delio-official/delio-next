import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

/* 네이버 로그인 시작 — 네이버 인증 페이지로 리다이렉트 (state CSRF 쿠키 발급) */
export async function GET(request: Request) {
  const clientId = process.env.NAVER_CLIENT_ID;
  const url = new URL(request.url);
  const next = url.searchParams.get('next') || '/';

  const proto = request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '');
  const host = request.headers.get('x-forwarded-host') || url.host;
  const base = `${proto}://${host}`;

  if (!clientId) return NextResponse.redirect(`${base}/login?error=naver_config`);

  const redirectUri = `${base}/api/auth/naver/callback`;
  const state = randomBytes(16).toString('hex');

  const authUrl = new URL('https://nid.naver.com/oauth2.0/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);

  const res = NextResponse.redirect(authUrl.toString());
  const secure = proto === 'https';
  res.cookies.set('naver_oauth_state', state, { httpOnly: true, secure, sameSite: 'lax', maxAge: 600, path: '/' });
  res.cookies.set('naver_oauth_next', next, { httpOnly: true, secure, sameSite: 'lax', maxAge: 600, path: '/' });
  return res;
}
