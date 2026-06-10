import { Suspense } from 'react';
import LoginClient from './LoginClient';

export const metadata = { title: '로그인 — 델리오' };

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginClient />
    </Suspense>
  );
}
