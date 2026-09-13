-- 상품 문의: 관리자가 작성할 때 작성자명·작성일 지정 (2026-09-14)
-- Supabase SQL Editor 에서 실행

-- 1) 작성자명 칸 (관리자가 지정한 표시 이름, 고객 문의는 비어 있음)
alter table public.product_inquiries add column if not exists author_name text;

-- 2) 보호 트리거 갱신 — 일반 회원은 작성자명·작성일을 넣거나 바꿀 수 없다
--    (기존: 답변·답변일 차단 / 추가: 작성자명 비움, 작성일은 서버 현재 시각으로 고정)
create or replace function public.protect_inquiry_columns()
returns trigger language plpgsql as $$
begin
  if public.is_direct_non_admin() then
    if tg_op = 'INSERT' then
      new.answer := null; new.answered_at := null;
      new.author_name := null; new.created_at := now();
    else
      new.user_id := old.user_id; new.product_id := old.product_id; new.created_at := old.created_at;
      new.answer := old.answer; new.answered_at := old.answered_at;
      new.is_private := old.is_private; new.password := old.password;
      new.author_name := old.author_name;
    end if;
  end if;
  return new;
end $$;

select 'OK — 상품 문의 관리자 작성자·작성일 준비 완료' as result;
