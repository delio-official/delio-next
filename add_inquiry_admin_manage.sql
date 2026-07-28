-- 관리자 패널에서 문의 삭제 / 비공개 처리(수정) 허용
-- 관리자 페이지는 라우트에서 접근이 보호되므로, 기존 앱 패턴(orders 등)과 동일하게 authenticated 허용.
-- 실행 위치: Supabase SQL Editor

-- 1) 상품 Q&A (product_inquiries) — 수정(비공개 토글·답변)/삭제
alter table public.product_inquiries enable row level security;
drop policy if exists piq_admin_update on public.product_inquiries;
drop policy if exists piq_admin_delete on public.product_inquiries;
create policy piq_admin_update on public.product_inquiries for update to authenticated using (true) with check (true);
create policy piq_admin_delete on public.product_inquiries for delete to authenticated using (true);
grant update, delete on public.product_inquiries to authenticated;

-- 2) 1:1 문의 (cs_inquiries) — 수정(답변)/삭제
alter table public.cs_inquiries enable row level security;
drop policy if exists cs_admin_update on public.cs_inquiries;
drop policy if exists cs_admin_delete on public.cs_inquiries;
create policy cs_admin_update on public.cs_inquiries for update to authenticated using (true) with check (true);
create policy cs_admin_delete on public.cs_inquiries for delete to authenticated using (true);
grant update, delete on public.cs_inquiries to authenticated;
