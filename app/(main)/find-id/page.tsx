import type { Metadata } from 'next';
import FindIdClient from './FindIdClient';

export const metadata: Metadata = {
  title: '아이디 찾기 | Delio',
};

export default function Page() {
  return <FindIdClient />;
}
