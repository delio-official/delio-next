-- ════════════════════════════════════════════════════════════════════
--  권한 구멍 막기 + 환불/취소 신청 규칙 (2026-09-15)
--  실행 위치: Supabase → SQL Editor → 전체 붙여넣기 → Run (여러 번 실행해도 안전)
--
--  1) 퀵 가이드(quickguide_groups)·라운지 카테고리(lounge_categories)
--     로그인한 일반 회원도 수정·추가·삭제할 수 있었다 → 읽기는 누구나, 쓰기는 관리자만
--  2) 고객이 직접 넣는 취소·환불 신청 규칙 (마이페이지와 같은 기준, 관리자·서버 기록은 검사 안 함)
--     · 취소 신청: 주문이 결제완료·배송준비중일 때만
--     · 환불 신청: 주문이 배송완료이고 배송완료일로부터 7일 이내(한국 날짜)일 때만
--     · 같은 주문에 처리 중(접수·진행중·보류)인 신청이 있으면 거부 (반려 후 재신청은 허용)
--     (링크 없는 옛 /refund 페이지로 기한·상태와 무관하게 신청을 넣어 자동 구매확정을 멈출 수 있었다)
-- ════════════════════════════════════════════════════════════════════


-- ── 1) 퀵 가이드 · 라운지 카테고리: 쓰기는 관리자만 ──────────────────
drop policy if exists quickguide_groups_write on public.quickguide_groups;
create policy quickguide_groups_write on public.quickguide_groups
  for all to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

drop policy if exists lounge_categories_write on public.lounge_categories;
create policy lounge_categories_write on public.lounge_categories
  for all to authenticated
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());


-- ── 2) 취소·환불 신청 규칙 ─────────────────────────────────────────
--   기존 보호(상태·금액 칸 초기화)는 그대로 두고, 고객 직접 신청일 때 조건 검사를 더한다.
--   security invoker(기본값) — is_direct_non_admin() 이 호출한 사람 기준으로 판별돼야 하므로 definer 로 만들지 않는다.
create or replace function public.protect_refund_request_columns()
returns trigger
language plpgsql
as $$
declare
  o_status    text;
  o_delivered timestamptz;
  v_type      text;
begin
  if public.is_direct_non_admin() and tg_op = 'INSERT' then
    new.status := 'pending';
    new.refund_amount := null; new.refund_items := null;
    new.resend_amount := null; new.resend_status := null;
    new.reject_reason := null; new.admin_memo := null; new.memo := null;

    v_type := coalesce(new.type, 'refund');
    select status, delivered_at into o_status, o_delivered from public.orders where id = new.order_id;

    if exists (select 1 from public.refund_requests
                where order_id = new.order_id and status in ('pending', 'processing', 'hold')) then
      raise exception 'REFUND_REQ_DUPLICATE';
    end if;

    if v_type = 'cancel' then
      if o_status is null or o_status not in ('paid', 'preparing') then
        raise exception 'REFUND_REQ_STATUS';
      end if;
    else
      if o_status is distinct from 'delivered' then
        raise exception 'REFUND_REQ_STATUS';
      end if;
      if o_delivered is not null
         and (now() at time zone 'Asia/Seoul')::date - (o_delivered at time zone 'Asia/Seoul')::date > 7 then
        raise exception 'REFUND_REQ_EXPIRED';
      end if;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_protect_refund_request_columns on public.refund_requests;
create trigger trg_protect_refund_request_columns
  before insert on public.refund_requests
  for each row execute function public.protect_refund_request_columns();


-- ── 확인 ──
select
  (select count(*) from pg_policies where tablename in ('quickguide_groups', 'lounge_categories')
      and policyname like '%_write' and qual like '%is_current_user_admin%') as 관리자쓰기정책_2이어야정상,
  (select count(*) from pg_trigger where tgname = 'trg_protect_refund_request_columns') as 신청규칙트리거_1이어야정상;
