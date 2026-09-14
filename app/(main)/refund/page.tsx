import { redirect } from 'next/navigation';

/* 옛 환불 신청 페이지 — 주문 상태·기한 확인 없이 신청이 들어가던 경로라 없앴다.
   취소·환불 신청은 마이페이지 주문내역의 [주문취소]·[환불신청] 버튼으로만 한다. */
export default function RefundPage() {
  redirect('/mypage?panel=order');
}
