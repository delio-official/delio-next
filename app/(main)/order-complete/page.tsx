import { Suspense } from 'react';
import OrderCompleteClient from './OrderCompleteClient';

export const metadata = { title: '주문 완료 — 델리오' };

export default function OrderCompletePage() {
  return (
    <Suspense>
      <OrderCompleteClient />
    </Suspense>
  );
}
