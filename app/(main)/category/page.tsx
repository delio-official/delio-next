import { Suspense } from 'react';
import CategoryClient from './CategoryClient';

export const metadata = { title: '카테고리 — 델리오' };

export default function CategoryPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#999' }}>불러오는 중...</div>}>
      <CategoryClient />
    </Suspense>
  );
}
