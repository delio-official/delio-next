-- ============================================================
-- 농가 정산 상태 관리 (정산 완료/송금 처리 기록)
--  · farm_id + period(YYYY-MM) 당 1행, 정산 완료 시 기록
-- ============================================================
create table if not exists farm_settlements (
  id          uuid primary key default gen_random_uuid(),
  farm_id     uuid not null references farms(id) on delete cascade,
  period      text not null,                 -- 정산 월 (예: 2026-06)
  payout      numeric not null default 0,    -- 정산액(공급가 합계) 스냅샷
  sales       numeric not null default 0,    -- 매출 스냅샷
  margin      numeric not null default 0,    -- 마진 스냅샷
  status      text not null default 'paid',  -- paid = 정산완료
  paid_at     timestamptz,                   -- 송금/정산 완료 시각
  memo        text,
  created_at  timestamptz not null default now()
);
create unique index if not exists farm_settlements_farm_period_uq on farm_settlements(farm_id, period);

alter table farm_settlements enable row level security;
drop policy if exists "farm_settlements admin" on farm_settlements;
create policy "farm_settlements admin" on farm_settlements
  for all using (is_current_user_admin()) with check (is_current_user_admin());
grant select, insert, update, delete on farm_settlements to authenticated;
