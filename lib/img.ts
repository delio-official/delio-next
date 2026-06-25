/**
 * Supabase Storage 이미지 변환(리사이즈+압축) URL 생성.
 * 원본 public URL(`/storage/v1/object/public/...`)을 변환 엔드포인트(`/render/image/public/...`)로 바꾸고
 * width·quality 파라미터를 붙여 화면 크기에 맞는 작은 이미지를 받는다. (Supabase Pro 이미지 변환 기능)
 *
 * @param url    원본 이미지 URL
 * @param width  목표 가로 px (표시 크기의 1.5~2배 권장; 레티나 대응)
 * @param quality 1~100 (기본 70)
 */
export function imgThumb(url: string | null | undefined, width = 400, quality = 70): string {
  if (!url) return '';
  if (url.includes('/storage/v1/object/public/')) {
    const t = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
    return `${t}${t.includes('?') ? '&' : '?'}width=${width}&quality=${quality}`;
  }
  return url; // 외부 URL 등은 그대로
}
