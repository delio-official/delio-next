import { Suspense } from 'react';
import SurveyClient from './SurveyClient';

export const metadata = { title: '취향진단 — 델리오' };

export default function SurveyPage() {
  return (
    <Suspense fallback={null}>
      <SurveyClient />
    </Suspense>
  );
}
