-- 멤버십 등급 설정 저장 실패 수정
-- 증상: 어드민 "등급 설정 저장" → permission denied for table membership_tiers
-- 원인: membership_tiers 에 authenticated 역할의 SELECT 만 GRANT 돼 있고
--       INSERT/UPDATE GRANT 가 없어 upsert 가 막힘 (RLS 정책과 별개로 테이블 GRANT 필요).

grant insert, update, delete on public.membership_tiers to authenticated;

-- (안전) 관리자 쓰기 RLS 정책 보장 — 이미 있으면 재생성
alter table public.membership_tiers enable row level security;
drop policy if exists "mt_admin_write" on public.membership_tiers;
create policy "mt_admin_write" on public.membership_tiers for all
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());
