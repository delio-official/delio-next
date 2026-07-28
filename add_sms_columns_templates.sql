-- SMS 발송 개편: sms_logs 확장 + sms_templates 신규
-- 실행 위치: Supabase SQL Editor

-- 1) sms_logs 컬럼 추가
--    msg_kind    : 광고성(ad) / 안내성(notice)
--    cost        : 발송 금액(원) = 건당단가(SMS 18 / LMS 45) × 대상수
--    scheduled_at: 예약 발송 시각(즉시발송이면 null). status='reserved' 와 함께 사용
alter table public.sms_logs
  add column if not exists msg_kind     text,
  add column if not exists cost         integer default 0,
  add column if not exists scheduled_at timestamptz;

-- status 는 기존 text 컬럼: sent(완료) / reserved(예약) / failed(실패) 값을 사용 (제약 없음)

-- 2) 템플릿 저장/불러오기 테이블
create table if not exists public.sms_templates (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  content    text not null,
  created_at timestamptz not null default now()
);

alter table public.sms_templates enable row level security;

drop policy if exists sms_templates_read  on public.sms_templates;
drop policy if exists sms_templates_write on public.sms_templates;
create policy sms_templates_read  on public.sms_templates for select using (true);
create policy sms_templates_write on public.sms_templates for all to authenticated using (true) with check (true);

grant select on public.sms_templates to anon, authenticated;
grant insert, update, delete on public.sms_templates to authenticated;
