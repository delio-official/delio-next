import { Suspense } from 'react';
import FaqClient from './FaqClient';

export const metadata = {
  title: 'FAQ / 고객센터 — 델리오',
  description: '델리오 자주 묻는 질문과 고객센터 안내. 주문·배송·교환·환불 관련 궁금증을 빠르게 해결하세요.',
};

export default function FaqPage() {
  return (
    <Suspense>
      <FaqClient />
    </Suspense>
  );
}
