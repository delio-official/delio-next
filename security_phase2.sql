-- ════════════════════════════════════════════════════════════════════
--  델리오 보안 수정 2단계 (2026-09-12)
--  실행 위치: Supabase → SQL Editor → 전체 붙여넣기 → Run
--  전제: 무통장·0원 주문이 서버(/api/orders/create)에서 만들어지도록 코드 배포 완료(72a1622)
--
--  막는 것 (일반 회원·비로그인이 브라우저에서 직접 하던 것)
--   1) 자기 포인트 잔액 바꾸기
--   2) 주문을 직접 만들기(예: 결제완료·0원 주문), 자기 주문의 상태·금액 바꾸기(예: 입금 안 한 주문을 배송준비로)
--   3) 주문 상품 직접 추가·수정
--   4) 재고를 직접 깎거나 늘리기(재고 함수 직접 호출)
--   5) 받은 쿠폰을 직접 '사용 처리' (이제 서버가 처리)
--  영향 없음: 관리자 계정 작업, 서버(service role) 작업(결제 확정·무통장/0원 주문·취소·환불·자동 작업 등)
-- ════════════════════════════════════════════════════════════════════

-- 1) 회원 정보: 포인트 잔액도 본인이 못 바꿈 (1단계 보호 칸 + point_balance)
create or replace function public.protect_profile_columns()
returns trigger language plpgsql as $$
begin
  if public.is_direct_non_admin() then
    if tg_op = 'INSERT' then
      new.is_admin := false;  new.is_blocked := false;
      new.grade := 'beginner'; new.grade_locked := false; new.grade_updated_at := null;
      new.point_balance := 0; new.memo := null;
      new.ci := null; new.di := null; new.verified_at := null;
      new.welcome_sent := false; new.signup_coupons_granted := false;
    else
      new.id := old.id; new.email := old.email; new.created_at := old.created_at;
      new.is_admin := old.is_admin;  new.is_blocked := old.is_blocked;
      new.grade := old.grade; new.grade_locked := old.grade_locked; new.grade_updated_at := old.grade_updated_at;
      new.point_balance := old.point_balance;
      new.memo := old.memo;
      new.ci := old.ci; new.di := old.di; new.verified_at := old.verified_at;
      new.welcome_sent := old.welcome_sent; new.signup_coupons_granted := old.signup_coupons_granted;
      if old.referral_code is not null then new.referral_code := old.referral_code; end if;
    end if;
  end if;
  return new;
end $$;


-- 2) 주문·주문상품: 만들기·수정·삭제는 관리자만 (서버 작업은 service role 이라 해당 없음)
--    기존 정책은 그대로 두고 '제한(RESTRICTIVE)' 정책을 추가 → 기존 허용 조건 AND 관리자여야 함
drop policy if exists orders_admin_only_insert on public.orders;
drop policy if exists orders_admin_only_update on public.orders;
drop policy if exists orders_admin_only_delete on public.orders;
create policy orders_admin_only_insert on public.orders as restrictive for insert to anon, authenticated
  with check (public.is_current_user_admin());
create policy orders_admin_only_update on public.orders as restrictive for update to anon, authenticated
  using (public.is_current_user_admin()) with check (public.is_current_user_admin());
create policy orders_admin_only_delete on public.orders as restrictive for delete to anon, authenticated
  using (public.is_current_user_admin());

drop policy if exists order_items_admin_only_insert on public.order_items;
drop policy if exists order_items_admin_only_update on public.order_items;
drop policy if exists order_items_admin_only_delete on public.order_items;
create policy order_items_admin_only_insert on public.order_items as restrictive for insert to anon, authenticated
  with check (public.is_current_user_admin());
create policy order_items_admin_only_update on public.order_items as restrictive for update to anon, authenticated
  using (public.is_current_user_admin()) with check (public.is_current_user_admin());
create policy order_items_admin_only_delete on public.order_items as restrictive for delete to anon, authenticated
  using (public.is_current_user_admin());


-- 3) 받은 쿠폰 사용 처리: 이제 서버가 하므로 관리자만 (다운로드=발급은 1단계 규칙 그대로)
drop policy if exists uc_update on public.user_coupons;
create policy uc_update on public.user_coupons for update to authenticated
  using (public.is_current_user_admin()) with check (public.is_current_user_admin());


-- 4) 재고 함수: 서버만 호출 가능 (브라우저에서 직접 재고 깎기·늘리기 차단)
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('decrement_stocks', 'restore_stocks', 'restore_order_stock')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;


-- 확인용: 아래에 새 정책 7개(orders_admin_only_* 3, order_items_admin_only_* 3, uc_update)가 보이면 완료
select tablename, policyname, permissive, cmd from pg_policies
where schemaname = 'public'
  and (policyname like 'orders_admin_only_%' or policyname like 'order_items_admin_only_%' or (tablename = 'user_coupons' and policyname = 'uc_update'))
order by tablename, policyname;
