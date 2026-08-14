import { Suspense } from 'react';
import CategoryClient from './CategoryClient';

export const metadata = {
  title: '카테고리 — 델리오',
  description: '델리오 전체 과일을 카테고리별로 만나보세요. 산지직송 제철 과일 — 복숭아·샤인머스캣·블루베리·납작복숭아 등 엄선한 농가 상품.',
};

export default function CategoryPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#999' }}>불러오는 중...</div>}>
      <CategoryClient />
    </Suspense>
  );
}
