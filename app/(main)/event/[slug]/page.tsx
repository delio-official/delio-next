import { Suspense } from 'react';
import EventDetailClient from './EventDetailClient';

export default function EventDetailPage() {
  return (
    <Suspense fallback={<div style={{ padding: '60px', textAlign: 'center', color: '#bbb' }}>불러오는 중...</div>}>
      <EventDetailClient />
    </Suspense>
  );
}
