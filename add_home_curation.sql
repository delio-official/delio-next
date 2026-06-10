-- ════════════════════════════════════════════════════════════════
-- 메인페이지 큐레이션: 조회수 추적 + 섹션 노출 설정
-- (델리오 픽 / 퀵가이드 / 브랜드 직송관 / 리뷰 하이라이트 / 라운지)
-- ════════════════════════════════════════════════════════════════

-- ── 1. 조회수 컬럼 ───────────────────────────────────────────────
alter table public.products     add column if not exists view_count bigint not null default 0;
alter table public.farms        add column if not exists view_count bigint not null default 0;
alter table public.lounge_posts add column if not exists view_count bigint not null default 0;

-- ── 2. 조회수 증가 RPC (anon 호출 허용, SECURITY DEFINER) ─────────
create or replace function public.bump_product_view(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.products set view_count = coalesce(view_count,0) + 1 where id = p_id;
$$;

create or replace function public.bump_farm_view(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.farms set view_count = coalesce(view_count,0) + 1 where id = p_id;
$$;

create or replace function public.bump_lounge_view(p_id bigint)
returns void language sql security definer set search_path = public as $$
  update public.lounge_posts set view_count = coalesce(view_count,0) + 1 where id = p_id;
$$;

grant execute on function public.bump_product_view(uuid) to anon, authenticated;
grant execute on function public.bump_farm_view(uuid)    to anon, authenticated;
grant execute on function public.bump_lounge_view(bigint) to anon, authenticated;

-- ── 3. 섹션 노출 설정 기본값 (site_settings: key/value) ──────────
--   {sec}_mode  : latest | popular | views | manual
--   {sec}_ids   : 직접 선택 시 순서대로 id 들 (콤마 구분)
--   {sec}_count : 노출 개수
insert into public.site_settings (key, value) values
  ('pick_mode','popular'),   ('pick_ids',''),     -- pick_count 는 기존 사용
  ('qg_mode','latest'),
  ('brand_mode','latest'),   ('brand_ids',''),    ('brand_count','4'),
  ('reviewhl_mode','latest'),('reviewhl_ids',''), ('reviewhl_count','6'),
  ('lounge_mode','manual'),  ('lounge_ids',''),   ('lounge_count','3')
on conflict (key) do nothing;
