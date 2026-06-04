-- 결제 웹훅/안정화: 결제 전 주문데이터 임시저장 + 주문 멱등성
-- Supabase SQL Editor에서 실행

-- 결제 전 주문 데이터 임시 저장 (웹훅이 브라우저 없이 주문 확정할 수 있게)
create table if not exists pending_payments (
  payment_id text primary key,
  data       jsonb not null,
  created_at timestamptz not null default now()
);
alter table pending_payments enable row level security;
-- 정책 없음 = 클라이언트 접근 전면 차단 (서버 service-role 라우트만 접근)

-- 같은 결제로 주문 중복 생성 방지 (verify·webhook 동시 처리 멱등성)
create unique index if not exists orders_portone_payment_id_uniq
  on orders(portone_payment_id) where portone_payment_id is not null;
