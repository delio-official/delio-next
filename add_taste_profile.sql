-- ══════════════════════════════════════════════════════════════
--  맛 프로파일 개편 — 5축(당도·산도·과즙·식감 + 신선도)
--  · 판매자: 4축 5단계 라벨 설정 (products.seller_score)
--  · 구매자: 리뷰 작성 시 5축 평가 (reviews.taste) → 동의율 산출
--  ⚠️ Supabase SQL Editor 에서 1회 실행
-- ══════════════════════════════════════════════════════════════

-- 1) 리뷰에 맛 평가 저장 (구매자 5축 1~5)  예: {"sweet":4,"sour":2,"juice":5,"texture":4,"fresh":5}
alter table public.reviews add column if not exists taste jsonb;

-- 2) seller_score 를 jsonb 로 통일 (기존 json 타입이면 ? / - / || 연산자 사용 불가)
alter table public.products
  alter column seller_score type jsonb using seller_score::jsonb;

-- 3) seller_score 키 이관: 기존 'fresh'(=과즙 의미) → 'juice' 로 재명명
--    신선도(fresh)는 판매자 설정 없음(구매자 리뷰 전용)
update public.products
set seller_score = (seller_score - 'fresh') || jsonb_build_object('juice', seller_score->'fresh')
where seller_score ? 'fresh' and not (seller_score ? 'juice');
