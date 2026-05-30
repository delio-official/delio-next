import type { Metadata } from 'next';
import ShippingClient from './ShippingClient';

export const metadata: Metadata = {
  title: '배송안내 | Delio',
  description: '델리오의 배송 정책, 배송비, 배송 일정을 안내합니다.',
};

export default function ShippingPage() {
  return <ShippingClient />;
}
