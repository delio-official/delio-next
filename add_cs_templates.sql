-- 1:1 문의 답변 템플릿 저장용 테이블
-- 실행 위치: Supabase SQL Editor

create table if not exists public.cs_templates (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  content    text not null,
  created_at timestamptz not null default now()
);

alter table public.cs_templates enable row level security;
drop policy if exists cs_templates_read  on public.cs_templates;
drop policy if exists cs_templates_write on public.cs_templates;
create policy cs_templates_read  on public.cs_templates for select using (true);
create policy cs_templates_write on public.cs_templates for all to authenticated using (true) with check (true);
grant select on public.cs_templates to anon, authenticated;
grant insert, update, delete on public.cs_templates to authenticated;
