-- 환불 상세 '메모'를 브랜드/회원 메모처럼 누적 기록(블록 스택)으로 전환
-- 주문 단위로 메모가 쌓이고, 작성자·시각 기록 + 개별 삭제
create table if not exists public.refund_memos (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  content text not null,
  admin_name text,
  created_at timestamptz default now()
);
create index if not exists refund_memos_order_idx on public.refund_memos(order_id, created_at desc);

alter table public.refund_memos enable row level security;
create policy "refund_memos admin all" on public.refund_memos
  for all using (public.is_current_user_admin()) with check (public.is_current_user_admin());
grant all on public.refund_memos to authenticated;
