-- 어드민 "쿠폰 지급 내역" / "총 발급·총 사용" 통계가 1건만 보이는 문제 수정
-- 원인: user_coupons 에 관리자 전체조회 RLS 정책이 없어, 관리자도 본인 쿠폰만 읽힘.
-- (회원 본인 조회 정책은 그대로 두고, 관리자 전체조회 정책을 추가 — 정책은 OR로 합쳐짐)

drop policy if exists "uc_admin_select" on public.user_coupons;
create policy "uc_admin_select" on public.user_coupons
  for select
  using (public.is_current_user_admin());
