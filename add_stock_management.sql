-- ══════════════════════════════════════════════════════════
-- 재고 자동 차감/복원 (동시성 안전)
-- 이 SQL은 컬럼·함수 "추가"만 하므로 기존 결제/주문에 영향 없음.
-- ══════════════════════════════════════════════════════════

-- 1) order_items: 재고 차감/복원 대상 옵션(leaf, 예: 무농약 2kg) id
alter table order_items add column if not exists option_id uuid;

-- 2) orders: 재고 복원 멱등 플래그(중복 복원 방지)
alter table orders add column if not exists stock_restored boolean not null default false;

-- 3) 원자적 재고 차감 — 하나라도 재고 부족이면 전체 롤백(예외)
--    p_items = [{ "optionId": "...", "qty": 2 }, ...]  (optionId 없으면 재고 미관리 → 스킵)
create or replace function decrement_stocks(p_items jsonb)
returns void
language plpgsql
security definer
as $$
declare it jsonb;
begin
  for it in select * from jsonb_array_elements(p_items) loop
    if (it->>'optionId') is null or (it->>'optionId') = '' then
      continue;  -- 옵션 없는 단품 등 재고 미관리 항목은 건너뜀
    end if;
    update product_options
       set stock = stock - (it->>'qty')::int
     where id = (it->>'optionId')::uuid
       and stock >= (it->>'qty')::int;   -- 재고 있을 때만 (동시성: row lock)
    if not found then
      raise exception 'OUT_OF_STOCK:%', it->>'optionId' using errcode = 'P0001';
    end if;
  end loop;
end $$;

-- 4) 주문 취소/환불 시 재고 복원 — 멱등(stock_restored 가드)
create or replace function restore_order_stock(p_order_id uuid)
returns void
language plpgsql
security definer
as $$
declare rec record;
begin
  update orders set stock_restored = true
   where id = p_order_id and stock_restored = false;
  if not found then
    return;  -- 이미 복원됨 → 중복 실행 방지
  end if;
  for rec in
    select option_id, quantity from order_items
     where order_id = p_order_id and option_id is not null
  loop
    update product_options
       set stock = stock + rec.quantity
     where id = rec.option_id;
  end loop;
end $$;

grant execute on function decrement_stocks(jsonb)      to anon, authenticated, service_role;
grant execute on function restore_order_stock(uuid)    to anon, authenticated, service_role;
