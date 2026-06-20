-- 본인이 작성한 문의 삭제 허용 (상품 Q&A + 1:1 문의)
-- ⚠️ Supabase SQL Editor 에서 1회 실행

-- 1) 상품 Q&A (product_inquiries)
alter table public.product_inquiries enable row level security;
drop policy if exists "own delete product_inquiries" on public.product_inquiries;
create policy "own delete product_inquiries" on public.product_inquiries
  for delete using (auth.uid() = user_id);
grant delete on public.product_inquiries to authenticated;

-- 2) 1:1 문의 (cs_inquiries)
alter table public.cs_inquiries enable row level security;
drop policy if exists "own delete cs_inquiries" on public.cs_inquiries;
create policy "own delete cs_inquiries" on public.cs_inquiries
  for delete using (auth.uid() = user_id);
grant delete on public.cs_inquiries to authenticated;
