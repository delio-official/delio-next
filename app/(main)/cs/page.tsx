import { redirect } from 'next/navigation';

export default function CsPage() {
  redirect('/mypage?panel=cs');
}
