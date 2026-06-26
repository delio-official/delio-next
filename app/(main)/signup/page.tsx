import { Suspense } from 'react';
import SignupClient from './SignupClient';

export const metadata = { title: '회원가입 — 델리오' };

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupClient />
    </Suspense>
  );
}
