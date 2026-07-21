-- 리뷰 수정 권한을 '칸 단위'로 정리
--
-- 문제
--   reviews 의 UPDATE 정책이 "auth.uid() = user_id" 한 줄뿐이라
--   행을 건드리는 모든 동작이 작성자 본인으로 묶여 있었음.
--   그래서 관리자가 '답변'만 달려고 해도 막혔고(그것도 에러 없이 0행 갱신),
--   서버 API로 우회해야 했음.
--
--   답변은 개념상 리뷰 수정이 아님. 정책이 칸을 구분하지 못한 것이 원인.
--
-- 해결
--   1) UPDATE 자체는 '작성자 본인 또는 관리자'면 시도할 수 있게 열고
--   2) 트리거로 누가 어떤 칸을 바꿀 수 있는지 강제한다
--
--   칸 구분
--     고객 소유 : rating, content, image_urls, video_url, taste  → 작성자 본인만
--     관리자 전용: seller_reply, seller_replied_at               → 관리자만
--     그 외(is_best 등) : 관리자가 운영상 조작. 위 두 제한에 걸리지 않음
--
--   이렇게 하면 관리자도 남의 리뷰 '본문'은 못 고친다.
--   고객이 쓴 말을 관리자가 바꿔치기할 수 없어야 하므로 의도된 제한.

------------------------------------------------------------------
-- 0) 적용 전 현재 정책 확인 (실행 결과를 한번 봐주세요)
------------------------------------------------------------------
select policyname, cmd, qual::text as using_expr
  from pg_policies
 where schemaname = 'public' and tablename = 'reviews'
 order by cmd, policyname;

------------------------------------------------------------------
-- 1) UPDATE 정책 — 작성자 본인 또는 관리자
------------------------------------------------------------------
drop policy if exists "Users can update own reviews" on public.reviews;
drop policy if exists reviews_update_scope           on public.reviews;

create policy reviews_update_scope on public.reviews
  for update
  using      (auth.uid() = user_id or public.is_current_user_admin())
  with check (auth.uid() = user_id or public.is_current_user_admin());

------------------------------------------------------------------
-- 2) 칸 단위 강제 트리거
------------------------------------------------------------------
create or replace function public.enforce_review_update_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_admin boolean;
begin
  -- 서버(service_role)를 통한 갱신은 API에서 이미 권한을 확인했으므로 통과시킨다.
  -- service_role 키는 서버에만 있고 브라우저로 나가지 않는다.
  if v_uid is null then
    return new;
  end if;

  v_admin := public.is_current_user_admin();

  -- 판매자 답변 칸은 관리자만
  if not v_admin
     and (new.seller_reply      is distinct from old.seller_reply
       or new.seller_replied_at is distinct from old.seller_replied_at) then
    raise exception 'REPLY_ADMIN_ONLY';
  end if;

  -- 리뷰 본문은 작성자 본인만 (관리자도 남의 글은 못 고침)
  if v_uid is distinct from old.user_id
     and (new.rating     is distinct from old.rating
       or new.content    is distinct from old.content
       or new.image_urls is distinct from old.image_urls
       or new.video_url  is distinct from old.video_url
       or new.taste      is distinct from old.taste) then
    raise exception 'CONTENT_OWNER_ONLY';
  end if;

  return new;
end $$;

drop trigger if exists trg_review_update_scope on public.reviews;
create trigger trg_review_update_scope
  before update on public.reviews
  for each row execute function public.enforce_review_update_scope();

------------------------------------------------------------------
-- 3) 적용 후 확인
------------------------------------------------------------------
select policyname, cmd from pg_policies
 where schemaname = 'public' and tablename = 'reviews' order by cmd, policyname;

select tgname, tgenabled from pg_trigger
 where tgrelid = 'public.reviews'::regclass and not tgisinternal;
