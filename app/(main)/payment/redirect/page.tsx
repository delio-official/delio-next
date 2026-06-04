import { Suspense } from 'react';
import PaymentRedirectClient from './PaymentRedirectClient';

export const metadata = { title: '결제 확인 중 — 델리오' };

export default function PaymentRedirectPage() {
  return (
    <Suspense>
      <PaymentRedirectClient />
    </Suspense>
  );
}
