-- ════════════════════════════════════════════════════════════════════
--  델리오 보안 긴급 수정 1단계 (2026-09-12)
--  실행 위치: Supabase → SQL Editor → 전체 붙여넣기 → Run
--
--  막는 것 (일반 회원·비로그인이 브라우저에서 직접 DB를 고치는 경우)
--   1) 회원이 자기 계정을 관리자로/등급/블랙리스트/본인인증 칸을 바꾸는 것
--   2) 쿠폰 만들기·수정, 아무 쿠폰이나 자기에게 발급, 쓴 쿠폰을 미사용으로 되돌리기
--   3) 남의 상품 문의(비밀글) 읽기·가짜 답변·삭제
--   4) 남의 환불 신청 읽기·수정, 신청 시 환불금액·처리상태 조작
--   5) FAQ 카테고리·1:1 답변 템플릿·문자 템플릿 수정, 문자 발송기록 열람
--  추가: 상품·브랜드 '숨김 삭제'용 칸(deleted_at)
--
--  영향 없는 것: 서버(service role)·DB 전용 함수(RPC)·관리자 계정의 작업은 그대로.
--  아직 안 막는 것: 포인트 잔액(point_balance) — 무통장·0원 결제가 브라우저에서 차감 중이라 2단계에서.
-- ════════════════════════════════════════════════════════════════════

-- 0) 공통: "브라우저에서 직접 온 요청인데 관리자가 아님" 판별
--    DB 전용 함수(SECURITY DEFINER)·서버 요청은 current_user 가 postgres/service_role 이라 해당 없음
create or replace function public.is_direct_non_admin()
returns boolean language sql stable as $$
  select current_user in ('authenticated', 'anon')
     and not coalesce(public.is_current_user_admin(), false)
$$;

-- 테이블의 기존 정책을 모두 지우는 도우미 (정책 이름을 몰라도 깨끗이 다시 만들기 위해)
create or replace function public._drop_all_policies(p_table text)
returns void language plpgsql as $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = p_table loop
    execute format('drop policy %I on public.%I', p.policyname, p_table);
  end loop;
end $$;


-- ── 1) 회원 정보(profiles): 민감한 칸은 본인이 못 바꿈 ─────────────────
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
      new.memo := old.memo;
      new.ci := old.ci; new.di := old.di; new.verified_at := old.verified_at;
      new.welcome_sent := old.welcome_sent; new.signup_coupons_granted := old.signup_coupons_granted;
      if old.referral_code is not null then new.referral_code := old.referral_code; end if;  -- 최초 1회 생성만 허용
      -- point_balance 는 2단계에서 잠금
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_protect_profile_columns on public.profiles;
create trigger trg_protect_profile_columns
  before insert or update on public.profiles
  for each row execute function public.protect_profile_columns();


-- ── 2) 쿠폰(coupons): 읽기는 공개, 만들기·수정·삭제는 관리자만 ──────────
alter table public.coupons enable row level security;
select public._drop_all_policies('coupons');
create policy coupons_read  on public.coupons for select using (true);
create policy coupons_admin on public.coupons for all to authenticated
  using (public.is_current_user_admin()) with check (public.is_current_user_admin());


-- ── 3) 받은 쿠폰(user_coupons) ────────────────────────────────────────
--   읽기: 본인·관리자 / 발급: 관리자, 또는 '다운로드 가능(공개)' 쿠폰을 본인이 1장만
--   수정: 본인은 '사용 처리'만 가능(미사용으로 되돌리기·만료일 변경 불가) / 삭제: 관리자
create or replace function public.user_has_coupon(p_coupon uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_coupons where user_id = auth.uid() and coupon_id = p_coupon)
$$;

alter table public.user_coupons enable row level security;
select public._drop_all_policies('user_coupons');
create policy uc_select on public.user_coupons for select
  using (user_id = auth.uid() or public.is_current_user_admin());
create policy uc_insert on public.user_coupons for insert to authenticated
  with check (
    public.is_current_user_admin()
    or (
      user_id = auth.uid()
      and exists (select 1 from public.coupons c
                  where c.id = coupon_id and c.is_public = true and c.is_active = true
                    and (c.expires_at is null or c.expires_at > now()))
      and not public.user_has_coupon(coupon_id)
    )
  );
create policy uc_update on public.user_coupons for update to authenticated
  using (user_id = auth.uid() or public.is_current_user_admin())
  with check (user_id = auth.uid() or public.is_current_user_admin());
create policy uc_delete on public.user_coupons for delete to authenticated
  using (public.is_current_user_admin());

create or replace function public.protect_user_coupon_columns()
returns trigger language plpgsql as $$
declare c record;
begin
  if public.is_direct_non_admin() then
    if tg_op = 'INSERT' then
      select valid_days, expires_at into c from public.coupons where id = new.coupon_id;
      new.is_used := false; new.used_at := null; new.grant_period := ''; new.expiry_notified := false;
      new.issued_at := now();
      new.expires_at := case when c.valid_days is not null then now() + make_interval(days => c.valid_days)
                             else c.expires_at end;
    else
      new.user_id := old.user_id; new.coupon_id := old.coupon_id; new.issued_at := old.issued_at;
      new.expires_at := old.expires_at; new.grant_period := old.grant_period; new.expiry_notified := old.expiry_notified;
      if old.is_used then new.is_used := true; new.used_at := old.used_at; end if;   -- 쓴 쿠폰 되살리기 금지
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_protect_user_coupon_columns on public.user_coupons;
create trigger trg_protect_user_coupon_columns
  before insert or update on public.user_coupons
  for each row execute function public.protect_user_coupon_columns();


-- ── 4) 상품 문의(product_inquiries): 본인·관리자만 읽기, 답변은 관리자만 ──
--   상품페이지 목록은 서버 API(service role)가 읽으므로 영향 없음
alter table public.product_inquiries enable row level security;
select public._drop_all_policies('product_inquiries');
create policy piq_select on public.product_inquiries for select
  using (user_id = auth.uid() or public.is_current_user_admin());
create policy piq_insert on public.product_inquiries for insert to authenticated
  with check (user_id = auth.uid() or public.is_current_user_admin());
create policy piq_update on public.product_inquiries for update to authenticated
  using (user_id = auth.uid() or public.is_current_user_admin())
  with check (user_id = auth.uid() or public.is_current_user_admin());
create policy piq_delete on public.product_inquiries for delete to authenticated
  using (user_id = auth.uid() or public.is_current_user_admin());

create or replace function public.protect_inquiry_columns()
returns trigger language plpgsql as $$
begin
  if public.is_direct_non_admin() then
    if tg_op = 'INSERT' then
      new.answer := null; new.answered_at := null;
    else
      new.user_id := old.user_id; new.product_id := old.product_id; new.created_at := old.created_at;
      new.answer := old.answer; new.answered_at := old.answered_at;
      new.is_private := old.is_private; new.password := old.password;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_protect_inquiry_columns on public.product_inquiries;
create trigger trg_protect_inquiry_columns
  before insert or update on public.product_inquiries
  for each row execute function public.protect_inquiry_columns();


-- ── 5) 취소·환불 신청(refund_requests): 본인·관리자만 읽기, 처리는 관리자만 ──
alter table public.refund_requests enable row level security;
select public._drop_all_policies('refund_requests');
create policy rr_select on public.refund_requests for select
  using (user_id = auth.uid() or public.is_current_user_admin());
create policy rr_insert on public.refund_requests for insert to authenticated
  with check (
    public.is_current_user_admin()
    or (user_id = auth.uid()
        and exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()))
  );
create policy rr_admin_update on public.refund_requests for update to authenticated
  using (public.is_current_user_admin()) with check (public.is_current_user_admin());
create policy rr_admin_delete on public.refund_requests for delete to authenticated
  using (public.is_current_user_admin());

create or replace function public.protect_refund_request_columns()
returns trigger language plpgsql as $$
begin
  if public.is_direct_non_admin() and tg_op = 'INSERT' then
    new.status := 'pending';
    new.refund_amount := null; new.refund_items := null;
    new.resend_amount := null; new.resend_status := null;
    new.reject_reason := null; new.admin_memo := null; new.memo := null;
  end if;
  return new;
end $$;
drop trigger if exists trg_protect_refund_request_columns on public.refund_requests;
create trigger trg_protect_refund_request_columns
  before insert on public.refund_requests
  for each row execute function public.protect_refund_request_columns();


-- ── 6) FAQ 카테고리: 읽기 공개, 수정은 관리자만 ─────────────────────────
alter table public.faq_categories enable row level security;
select public._drop_all_policies('faq_categories');
create policy faqcat_read  on public.faq_categories for select using (true);
create policy faqcat_admin on public.faq_categories for all to authenticated
  using (public.is_current_user_admin()) with check (public.is_current_user_admin());

-- ── 7) 답변 템플릿·문자 템플릿·문자 발송기록: 관리자만 ─────────────────────
alter table public.cs_templates enable row level security;
select public._drop_all_policies('cs_templates');
create policy cstpl_admin on public.cs_templates for all to authenticated
  using (public.is_current_user_admin()) with check (public.is_current_user_admin());

alter table public.sms_templates enable row level security;
select public._drop_all_policies('sms_templates');
create policy smstpl_admin on public.sms_templates for all to authenticated
  using (public.is_current_user_admin()) with check (public.is_current_user_admin());

alter table public.sms_logs enable row level security;
select public._drop_all_policies('sms_logs');
create policy smslog_admin on public.sms_logs for all to authenticated
  using (public.is_current_user_admin()) with check (public.is_current_user_admin());


-- ── 8) 숨김 삭제용 칸 (판매 이력 있는 상품·브랜드는 지우지 않고 숨김) ────────
alter table public.products add column if not exists deleted_at timestamptz;
alter table public.farms    add column if not exists deleted_at timestamptz;


-- 정리: 임시 도우미 삭제
drop function if exists public._drop_all_policies(text);

-- 확인용: 아래 결과에 각 테이블 정책이 새 이름(coupons_read, uc_select, piq_select, rr_select …)으로 보이면 완료
select tablename, policyname, cmd from pg_policies
where schemaname = 'public'
  and tablename in ('coupons','user_coupons','product_inquiries','refund_requests','faq_categories','cs_templates','sms_templates','sms_logs')
order by tablename, policyname;
