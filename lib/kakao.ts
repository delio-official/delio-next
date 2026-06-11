/* 카카오 JavaScript SDK 공유 (NEXT_PUBLIC_KAKAO_JS_KEY 필요)
   키가 없거나 SDK 미로드면 false 반환 → 호출부에서 링크복사 등으로 폴백 */

interface KakaoShareOpts {
  title: string;
  description: string;
  imageUrl: string;   // 절대 URL (https) 필요
  linkUrl: string;    // 절대 URL
  buttonTitle?: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function isKakaoReady(): boolean {
  if (typeof window === 'undefined') return false;
  const K = (window as any).Kakao;
  return !!(K && K.isInitialized && K.isInitialized());
}

export function shareKakaoFeed(o: KakaoShareOpts): boolean {
  if (!isKakaoReady()) return false;
  const K = (window as any).Kakao;
  try {
    K.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: o.title,
        description: o.description,
        imageUrl: o.imageUrl,
        link: { mobileWebUrl: o.linkUrl, webUrl: o.linkUrl },
      },
      buttons: [{ title: o.buttonTitle || '자세히 보기', link: { mobileWebUrl: o.linkUrl, webUrl: o.linkUrl } }],
    });
    return true;
  } catch {
    return false;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
