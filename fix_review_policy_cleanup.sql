-- 리뷰 정책 정리 — 열려 있는 구멍 두 개를 막는다
--
-- 조사 결과 reviews 에 정책이 8개나 쌓여 있었고, 그중 두 개가 완전히 열려 있었다.
--
--   Admin can update reviews   UPDATE  using(true) with check(true)   ← 누구나 남의 리뷰 수정
--   Admin can delete reviews   DELETE  using(true)                    ← 누구나 남의 리뷰 삭제
--
-- 이름은 'Admin can ...' 인데 실제로는 관리자 확인이 전혀 없다.
-- 예전에 관리자 기능을 급히 열면서 true 로 둔 것으로 보인다.
-- (베스트 토글이 남의 리뷰에도 저장되던 이유가 이것)
--
-- PostgreSQL RLS 는 같은 동작의 정책이 여러 개면 '하나만 통과해도 허용' 이다.
-- 따라서 true 정책이 하나라도 살아 있으면 나머지 제한은 전부 무의미하다.
--
-- 다행히 비로그인(anon)은 테이블 권한(GRANT) 자체가 없어 막혀 있다.
-- 하지만 로그인한 일반 회원은 GRANT 가 있으므로 남의 리뷰를 수정·삭제할 수 있는 상태다.
--
-- 삭제는 화면에서 전부 /api/reviews/delete (서버 service_role) 를 거치므로
-- 정책을 조여도 관리자·본인 삭제 기능은 그대로 동작한다.

------------------------------------------------------------------
-- 1) 열려 있는 정책 제거
------------------------------------------------------------------
drop policy if exists "Admin can update reviews" on public.reviews;
drop policy if exists "Admin can delete reviews" on public.reviews;

-- rv_update 는 reviews_update_scope 와 중복(작성자 본인). 하나로 통일
drop policy if exists rv_update on public.reviews;

------------------------------------------------------------------
-- 2) 삭제 정책 — 작성자 본인 또는 관리자
------------------------------------------------------------------
drop policy if exists rv_delete             on public.reviews;
drop policy if exists reviews_delete_scope  on public.reviews;

create policy reviews_delete_scope on public.reviews
  for delete
  using (auth.uid() = user_id or public.is_current_user_admin());

------------------------------------------------------------------
-- 3) rv_admin (FOR ALL, is_admin()) 점검
------------------------------------------------------------------
-- is_admin() 과 is_current_user_admin() 두 함수가 따로 있다.
-- rv_admin 은 FOR ALL 이라 관리자에게 모든 동작을 허용하는데,
-- 칸 단위 제한은 trg_review_update_scope 트리거가 걸어주므로
-- 관리자가 남의 리뷰 '본문'을 고치는 것은 여전히 막힌다.
--
-- 아래로 두 함수가 같은 판정을 하는지 확인해 주세요.
select public.is_admin()                as is_admin_fn,
       public.is_current_user_admin()   as is_current_user_admin_fn;

------------------------------------------------------------------
-- 4) 최종 확인 — UPDATE/DELETE 에 using_expr 이 true 인 것이 없어야 정상
------------------------------------------------------------------
select policyname, cmd, qual::text as using_expr, with_check::text as check_expr
  from pg_policies
 where schemaname = 'public' and tablename = 'reviews'
 order by cmd, policyname;
