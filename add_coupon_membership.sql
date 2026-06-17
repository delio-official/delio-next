-- 멤버십 월발급 쿠폰을 동적으로 관리하기 위한 플래그
-- coupons.is_membership = true 인 쿠폰이 "멤버십 월발급 쿠폰팩"에 노출되고,
-- 멤버십 관리 탭에서 등급별로 선택해 매월 자동 발급됩니다.

alter table public.coupons
  add column if not exists is_membership boolean not null default false;

-- 기존 고정 멤버십 쿠폰(MBR_*) 마이그레이션 → is_membership 플래그 on
update public.coupons
  set is_membership = true
  where code in ('MBR_THOUSAND', 'MBR_PERCENT10', 'MBR_FIVE');

-- 참고: 생일쿠폰(MBR_BIRTHDAY)은 별도 로직(생일월 발급)이라 그대로 둡니다.
