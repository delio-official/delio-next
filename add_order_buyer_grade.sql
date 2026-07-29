-- 주문 시점 회원 등급 스냅샷 (매출현황 등급별 매출 정확도용)
-- 앞으로의 주문부터 등급이 기록됨. 과거 주문은 null → 매출현황에선 현재 프로필 등급으로 대체 집계.
-- 실행 위치: Supabase SQL Editor

alter table public.orders
  add column if not exists buyer_grade text;
