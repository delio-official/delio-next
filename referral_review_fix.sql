-- ════════════════════════════════════════════════════════════════════
--  오류 수정 2묶음 (2026-09-14) — 추천 보상 회수 · 추천 등록 조건 · 리뷰 적립금
--  실행 위치: Supabase → SQL Editor → 전체 붙여넣기 → Run (여러 번 실행해도 안전)
--
--  4) 추천 보상 자동 회수가 엉뚱하게 돌던 문제
--     · '구매확정' 주문을 남은 주문으로 안 세서, 확정 후 다른 주문을 취소하면 쿠폰이 회수됨
--     · 보상과 무관한 주문(발송 전 취소 등)이 취소돼도 회수 검사
--     · 이미 만료된 쿠폰을 회수하면서 '미지급'으로 되돌려, 다음 배송완료 때 새 쿠폰이 또 나감
--  5) 기존 회원도 추천 등록 → 쿠폰 수령 가능 → 가입 24시간 이내 + 주문 0건만 등록
--  10) 리뷰 적립금
--     · 지급액을 기록해 두고(point_reward_amount/point_reward_max) 삭제 시 그 금액을 회수
--     · 사진·영상을 모두 지우면 (지급액 − 텍스트 리뷰 금액) 회수, 다시 올리면 원래 받은 만큼까지 복원
--     · [보안] 고객이 자기 리뷰의 적립완료 표시·베스트·좋아요 수·작성일을 직접 바꿀 수 있던 구멍 차단
--       (적립완료 표시를 끄고 적립 API를 다시 부르면 적립금을 반복 수령 가능했음)
-- ════════════════════════════════════════════════════════════════════


-- ── 4-1) 추천 보상 회수 ──────────────────────────────────────────────
create or replace function public.handle_referral_clawback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec        referrals%rowtype;
  uc_id      uuid;
  uc_used    boolean;
  uc_expires timestamptz;
  remaining  integer;
begin
  /* 취소·환불로 '바뀌는 순간'만 */
  if new.status not in ('cancelled', 'refunded') or old.status = new.status or new.user_id is null then
    return new;
  end if;

  /* 보상을 받게 한 적 있는 주문(배송완료·구매확정, 또는 배송완료 후 환불 진행중)이 취소·환불될 때만.
     발송 전 취소처럼 배송완료된 적 없는 주문은 보상과 무관 */
  if not (old.status in ('delivered', 'confirmed')
          or (old.status = 'refunding' and old.delivered_at is not null)) then
    return new;
  end if;

  select * into rec from referrals where referred_id = new.user_id;
  if not found or not coalesce(rec.rewarded, false) then
    return new;
  end if;

  /* 배송완료·구매확정 주문이 하나라도 남아 있으면 보상 조건 유지 */
  select count(*) into remaining
    from orders
   where user_id = new.user_id
     and status in ('delivered', 'confirmed')
     and id <> new.id;
  if remaining > 0 then
    return new;
  end if;

  select user_coupon_id into uc_id
    from referral_rewards
   where referral_id = rec.id and reward_type = 'referrer';

  if uc_id is not null then
    select is_used, expires_at into uc_used, uc_expires from user_coupons where id = uc_id;
    /* 이미 사용 → 회수 불가, 이력 유지(중복 지급 방지) */
    if uc_used is true then
      return new;
    end if;
    /* 이미 만료 → 회수할 가치 없음. 이력을 지우면 다음 배송완료 때 새 쿠폰이 나가므로 그대로 둔다 */
    if uc_used is false and uc_expires is not null and uc_expires < now() then
      return new;
    end if;
    if uc_used is false then
      delete from user_coupons where id = uc_id;
    end if;
  end if;

  delete from referral_rewards where referral_id = rec.id and reward_type = 'referrer';
  update referrals set rewarded = false, rewarded_at = null where id = rec.id;
  return new;
end $$;


-- ── 4-2) 추천 보상 지급: '첫 구매' 판단에 구매확정 포함 ─────────────────
create or replace function public.handle_referral_reward()
returns trigger as $$
declare
  rec          record;
  prior_orders integer;
  cpn_id       uuid;
  uc_id        uuid;
begin
  if new.status <> 'delivered' then
    return new;
  end if;

  /* 이번 주문 말고 배송완료·구매확정 주문이 이미 있으면 첫 구매 아님
     (예전엔 배송완료만 세서, 옛 주문이 전부 구매확정인 회원은 다시 첫 구매로 잡혔다) */
  select count(*) into prior_orders
    from orders
   where user_id = new.user_id
     and status in ('delivered', 'confirmed')
     and id <> new.id;
  if prior_orders > 0 then
    return new;
  end if;

  select * into rec from referrals where referred_id = new.user_id;
  if not found then
    return new;
  end if;

  insert into referral_rewards (referral_id, reward_type) values (rec.id, 'referrer')
  on conflict do nothing;
  if not found then
    return new;
  end if;

  update referrals set rewarded = true, rewarded_at = now() where id = rec.id;

  select id into cpn_id from coupons where code = 'REFERRAL5000' limit 1;
  if cpn_id is not null then
    insert into user_coupons (user_id, coupon_id, expires_at)
    values (rec.referrer_id, cpn_id, now() + interval '30 days')
    returning id into uc_id;
    update referral_rewards set user_coupon_id = uc_id
     where referral_id = rec.id and reward_type = 'referrer';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;


-- ── 5) 추천 등록: 가입 24시간 이내 + 주문 0건만 ─────────────────────────
create or replace function public.register_referral(p_code text)
returns void as $$
declare
  v_me       uuid := auth.uid();
  v_referrer uuid;
begin
  if v_me is null or p_code is null or btrim(p_code) = '' then
    return;
  end if;
  /* 막 가입한 회원만 (기존 회원이 초대링크·함수 호출로 쿠폰을 받던 구멍) */
  if not exists (select 1 from auth.users where id = v_me and created_at > now() - interval '24 hours') then
    return;
  end if;
  if exists (select 1 from public.orders where user_id = v_me) then
    return;
  end if;
  select id into v_referrer from public.profiles where lower(referral_code) = lower(btrim(p_code)) limit 1;
  if v_referrer is null then return; end if;
  if v_referrer = v_me then return; end if;
  if exists (select 1 from public.referrals where referred_id = v_me) then return; end if;
  insert into public.referrals (referrer_id, referred_id, rewarded)
  values (v_referrer, v_me, false);
end;
$$ language plpgsql security definer set search_path = public;
revoke execute on function public.register_referral(text) from public, anon;
grant execute on function public.register_referral(text) to authenticated;


-- ── 10-1) 리뷰 지급 적립금 기록 칸 ─────────────────────────────────────
alter table public.reviews add column if not exists point_reward_amount integer;  -- 지금 보유 중인 지급액
alter table public.reviews add column if not exists point_reward_max    integer;  -- 처음 지급한 금액(복원 상한)

/* 기존 적립 리뷰: 적립 기록에 리뷰 번호가 없어 정확한 금액을 알 수 없음 → 현재 규칙(사진 유무 × 현재 설정)으로 채움
   (지금까지 삭제 API가 쓰던 계산과 같은 결과) */
update public.reviews r
   set point_reward_amount = v.amt, point_reward_max = v.amt
  from (
    select rv.id,
           case when coalesce(array_length(rv.image_urls, 1), 0) > 0 or coalesce(rv.video_url, '') <> ''
                then coalesce((select nullif(value, '')::int from public.site_settings where key = 'review_point_photo'), 150)
                else coalesce((select nullif(value, '')::int from public.site_settings where key = 'review_point_text'), 50)
           end as amt
      from public.reviews rv
     where rv.point_rewarded and rv.point_reward_amount is null
  ) v
 where r.id = v.id;


-- ── 10-2) 리뷰 수정 규칙: 칸 보호 + 사진 삭제/재등록 시 적립금 조정 ─────────
create or replace function public.enforce_review_update_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_admin   boolean := false;
  had_media boolean;
  has_media boolean;
  text_amt  integer;
  diff      integer;
  bal       integer;
  rec_amt   integer;
begin
  /* 브라우저에서 직접 수정하는 경우만 권한 검사 (서버 service_role 은 API에서 이미 확인) */
  if v_uid is not null then
    v_admin := coalesce(public.is_current_user_admin(), false);

    if not v_admin
       and (new.seller_reply      is distinct from old.seller_reply
         or new.seller_replied_at is distinct from old.seller_replied_at) then
      raise exception 'REPLY_ADMIN_ONLY';
    end if;

    if v_uid is distinct from old.user_id
       and (new.rating     is distinct from old.rating
         or new.content    is distinct from old.content
         or new.image_urls is distinct from old.image_urls
         or new.video_url  is distinct from old.video_url
         or new.taste      is distinct from old.taste) then
      raise exception 'CONTENT_OWNER_ONLY';
    end if;

    /* 고객은 운영·적립 칸을 못 바꾼다 (조용히 원래 값 유지) */
    if not v_admin then
      new.user_id             := old.user_id;
      new.product_id          := old.product_id;
      new.order_item_id       := old.order_item_id;
      new.created_at          := old.created_at;
      new.is_best             := old.is_best;
      new.likes_count         := old.likes_count;
      new.point_rewarded      := old.point_rewarded;
      new.point_reward_amount := old.point_reward_amount;
      new.point_reward_max    := old.point_reward_max;
    end if;
  end if;

  /* 적립금 조정 — 적립된 리뷰에서 사진·영상이 모두 없어지거나 다시 생길 때 */
  if coalesce(old.point_rewarded, false) and coalesce(new.point_rewarded, false)
     and old.point_reward_amount is not null and old.user_id is not null then
    had_media := coalesce(array_length(old.image_urls, 1), 0) > 0 or coalesce(old.video_url, '') <> '';
    has_media := coalesce(array_length(new.image_urls, 1), 0) > 0 or coalesce(new.video_url, '') <> '';

    if had_media and not has_media then
      text_amt := coalesce((select nullif(value, '')::int from site_settings where key = 'review_point_text'), 50);
      diff := old.point_reward_amount - text_amt;
      if diff > 0 then
        select point_balance into bal from profiles where id = old.user_id for update;
        rec_amt := least(greatest(coalesce(bal, 0), 0), diff);   -- 잔액이 모자라면 있는 만큼만
        if rec_amt > 0 then
          update profiles set point_balance = bal - rec_amt where id = old.user_id;
          insert into point_logs (user_id, amount, description)
          values (old.user_id, -rec_amt, '리뷰 사진 삭제로 적립금 차액 회수');
        end if;
        new.point_reward_amount := old.point_reward_amount - rec_amt;
      end if;

    elsif not had_media and has_media then
      diff := coalesce(old.point_reward_max, old.point_reward_amount) - old.point_reward_amount;
      if diff > 0 then
        update profiles set point_balance = coalesce(point_balance, 0) + diff where id = old.user_id;
        insert into point_logs (user_id, amount, description)
        values (old.user_id, diff, '리뷰 사진 재등록으로 적립금 복원');
        new.point_reward_amount := old.point_reward_amount + diff;
      end if;
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_review_update_scope on public.reviews;
create trigger trg_review_update_scope
  before update on public.reviews
  for each row execute function public.enforce_review_update_scope();


-- ── 10-3) 리뷰 작성 규칙: 고객이 넣은 운영·적립 칸 무시 ───────────────────
create or replace function public.enforce_review_insert_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_direct_non_admin() then
    new.created_at          := now();
    new.is_best             := false;
    new.likes_count         := 0;
    new.point_rewarded      := false;
    new.point_reward_amount := null;
    new.point_reward_max    := null;
    new.seller_reply        := null;
    new.seller_replied_at   := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_review_insert_scope on public.reviews;
create trigger trg_review_insert_scope
  before insert on public.reviews
  for each row execute function public.enforce_review_insert_scope();


-- ── 확인 ──
select
  (select count(*) from public.reviews where point_rewarded)                                   as 적립리뷰,
  (select count(*) from public.reviews where point_rewarded and point_reward_amount is null)   as 금액미기록_0이어야정상,
  (select count(*) from pg_trigger where tgrelid = 'public.reviews'::regclass
      and tgname in ('trg_review_update_scope', 'trg_review_insert_scope'))                   as 리뷰트리거_2이어야정상,
  (select count(*) from pg_trigger where tgrelid = 'public.orders'::regclass
      and tgname in ('referral_reward_trigger', 'referral_clawback_trigger'))                 as 추천트리거_2이어야정상;
