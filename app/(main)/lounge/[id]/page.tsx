import { Suspense } from 'react';
import LoungeDetailClient from './LoungeDetailClient';

export default function LoungeDetailPage() {
  return (
    <Suspense fallback={<div style={{ padding: '60px', textAlign: 'center', color: '#bbb' }}>불러오는 중...</div>}>
      <LoungeDetailClient />
    </Suspense>
  );
}
