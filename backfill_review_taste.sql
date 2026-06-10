-- ──────────────────────────────────────────────────────────────
--  [테스트용] 맛 평가 없는 기존 리뷰에 taste 백필
--  판매자 라벨(seller_score) 기준으로 채워 동의율이 높게 나옵니다.
--  신선도(fresh)는 4~5 랜덤. Supabase SQL Editor 에서 1회 실행.
--  ⚠️ 실데이터가 아니라 데모 확인용 — 실오픈 전 정리 권장.
-- ──────────────────────────────────────────────────────────────
update public.reviews r
set taste = jsonb_build_object(
  'sweet',   coalesce(round((p.seller_score->>'sweet')::numeric),   4),
  'sour',    coalesce(round((p.seller_score->>'sour')::numeric),    2),
  'juice',   coalesce(round((p.seller_score->>'juice')::numeric),   4),
  'texture', coalesce(round((p.seller_score->>'texture')::numeric), 4),
  'fresh',   4 + (random() > 0.5)::int
)
from public.products p
where r.product_id = p.id
  and (r.taste is null or r.taste = '{}'::jsonb);
