-- ════════════════════════════════════════════════════════════════
-- 취소/환불 승인 시 쿠폰·포인트 복원에 필요한 주문 스냅샷
--   used_coupon_id   : 주문에 사용한 user_coupons.id (복원 대상)
--   earned_point     : 이 주문으로 적립된 포인트 (취소 시 회수)
--   refund_restored  : 복원 완료 플래그 (중복 복원 방지)
-- ════════════════════════════════════════════════════════════════
alter table public.orders add column if not exists used_coupon_id uuid;
alter table public.orders add column if not exists earned_point bigint not null default 0;
alter table public.orders add column if not exists refund_restored boolean not null default false;
