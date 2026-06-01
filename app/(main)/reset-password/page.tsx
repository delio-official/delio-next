import type { Metadata } from 'next';
import ResetPasswordClient from './ResetPasswordClient';

export const metadata: Metadata = {
  title: '비밀번호 재설정 | Delio',
};

export default function Page() {
  return <ResetPasswordClient />;
}
