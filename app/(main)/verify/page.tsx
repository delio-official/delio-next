import { Suspense } from 'react';
import VerifyClient from './VerifyClient';

export const metadata = { title: '본인인증 | 델리오' };

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyClient />
    </Suspense>
  );
}
