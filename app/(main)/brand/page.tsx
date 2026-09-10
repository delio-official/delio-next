import { permanentRedirect } from 'next/navigation';

/* 옛 브랜드 소개 주소(/brand) → 실제 브랜드 소개관(/brand-intro)으로 영구 이동.
   (예전 데모 페이지는 이미지 적용 전 임시 내용이라 제거. 메뉴·즐겨찾기에 남은 옛 주소도 안전하게 연결) */
export default function BrandPage() {
  permanentRedirect('/brand-intro');
}
