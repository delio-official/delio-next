-- 재고 차감을 '주문 생성 전'으로 옮기면서, 주문 저장 실패 시 차감분을 되돌리기 위한 복원 함수.
-- (restore_order_stock 은 order_id 기반이라 주문이 없을 때는 못 씀 → 옵션 배열 기반 복원 추가)

create or replace function restore_stocks(p_items jsonb)
returns void
language plpgsql
security definer
as $$
declare it jsonb;
begin
  for it in select * from jsonb_array_elements(p_items) loop
    if (it->>'optionId') is null or (it->>'optionId') = '' then
      continue;
    end if;
    update product_options
       set stock = stock + (it->>'qty')::int
     where id = (it->>'optionId')::uuid;
  end loop;
end $$;

grant execute on function restore_stocks(jsonb) to anon, authenticated, service_role;
