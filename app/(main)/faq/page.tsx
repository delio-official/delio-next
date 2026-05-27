import { Suspense } from 'react';
import FaqClient from './FaqClient';

export const metadata = { title: 'FAQ / 고객센터 — 델리오' };

export default function FaqPage() {
  return (
    <Suspense>
      <FaqClient />
    </Suspense>
  );
}
