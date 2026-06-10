-- ============================================================
-- 배너/팝업 변경 이력 (등록·수정·삭제 스냅샷 보관)
-- ------------------------------------------------------------
-- 어드민이 배너/팝업을 등록/수정/삭제할 때마다 그 시점 전체 값(이미지 URL 포함)을
-- snapshot(jsonb)으로 기록. 삭제된 것도 남아서 과거 배너/이미지를 열람·복원 가능.
-- 실행: Supabase SQL Editor 1회.
-- ============================================================

create table if not exists public.banner_history (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null,                 -- 'banner' | 'popup'
  entity_id   uuid,                          -- 원본 id (삭제돼도 보관)
  action      text not null,                 -- 'create' | 'update' | 'delete'
  snapshot    jsonb not null,                -- 그 시점 전체 필드(image_url 등)
  changed_by  uuid default auth.uid(),       -- 작업한 관리자
  changed_at  timestamptz not null default now()
);

create index if not exists idx_banner_history_changed on public.banner_history (changed_at desc);
create index if not exists idx_banner_history_entity  on public.banner_history (entity_type, entity_id);

alter table public.banner_history enable row level security;

-- 관리자만 읽기/쓰기 (is_current_user_admin() 기존 함수 사용)
drop policy if exists "admin read banner_history"   on public.banner_history;
drop policy if exists "admin insert banner_history" on public.banner_history;
create policy "admin read banner_history"   on public.banner_history for select using (public.is_current_user_admin());
create policy "admin insert banner_history" on public.banner_history for insert with check (public.is_current_user_admin());

grant select, insert on public.banner_history to authenticated;
grant all on public.banner_history to service_role;
