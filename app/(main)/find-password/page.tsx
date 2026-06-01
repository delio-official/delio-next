import type { Metadata } from 'next';
import FindPasswordClient from './FindPasswordClient';

export const metadata: Metadata = {
  title: '비밀번호 찾기 | Delio',
};

export default function Page() {
  return <FindPasswordClient />;
}
