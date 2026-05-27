import { Suspense } from 'react';
import SearchClient from './SearchClient';

export const metadata = { title: '검색 — 델리오' };

export default function SearchPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#999' }}>검색 중...</div>}>
      <SearchClient />
    </Suspense>
  );
}
