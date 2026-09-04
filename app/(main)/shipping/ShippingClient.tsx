'use client';

import { useState } from 'react';
import Link from 'next/link';

/* 배송안내 — 디자인 이미지(자사배송/산지직송) 2종을 탭으로 전환.
   이미지 위에 투명 오버레이를 얹어: (1) 상단 탭(델리오 프레쉬센터 | 산지직송) 전환, (2) '지금 주문하기' → 해당 상품목록.
   상품목록 slug: 자사상품 = cat_dxlk3m, 산지직송 = domestic */
const TABS = {
  own: {
    img: '/delio_delivery1.png',
    order: '/category?cat=cat_dxlk3m',
    tabTop: 23,     // 상단 탭 행 위치(%)
    orderTop: 80.6, // '지금 주문하기' 버튼 위치(%)
  },
  dawn: {
    img: '/delio_delivery2.png',
    order: '/category?cat=domestic',
    tabTop: 22.6,    // 상단 탭 행(델리오 프레쉬센터 | 산지직송)
    orderTop: 80.9,  // '지금 주문하기' 버튼 (이미지 높이 9480 기준, 바닥거리 역산)
  },
} as const;

export default function ShippingClient() {
  const [tab, setTab] = useState<'own' | 'dawn'>('own');
  const cfg = TABS[tab];

  return (
    <div style={{ background: '#fff', minHeight: '100vh' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', position: 'relative' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cfg.img} alt="배송안내" style={{ width: '100%', display: 'block' }} />

        {/* 상단 탭 전환 (좌: 델리오 프레쉬센터 / 우: 산지직송) — 탭 시 회색 하이라이트 박스 제거 */}
        <button type="button" aria-label="델리오 프레쉬센터(자사배송)" onClick={() => setTab('own')}
          style={{ position: 'absolute', left: '4%', top: `${cfg.tabTop}%`, width: '46%', height: '4.5%', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, WebkitTapHighlightColor: 'transparent', outline: 'none', appearance: 'none' }} />
        <button type="button" aria-label="산지직송" onClick={() => setTab('dawn')}
          style={{ position: 'absolute', left: '50%', top: `${cfg.tabTop}%`, width: '46%', height: '4.5%', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, WebkitTapHighlightColor: 'transparent', outline: 'none', appearance: 'none' }} />

        {/* 지금 주문하기 → 해당 상품목록 */}
        <Link href={cfg.order} aria-label="지금 주문하기"
          style={{ position: 'absolute', left: '22%', top: `${cfg.orderTop}%`, width: '56%', height: '3.4%', cursor: 'pointer', WebkitTapHighlightColor: 'transparent', outline: 'none' }} />
      </div>
    </div>
  );
}
