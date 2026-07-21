-- 리뷰 신고 처리 상태 — 관리자가 신고를 '기각'할 수 있도록
--
-- 배경: 지금은 신고가 들어오면 확인만 되고 되돌릴 방법이 없음.
--       악의적이거나 신고 거리가 안 되는 것도 계속 신고 건수로 남아
--       진짜 처리해야 할 신고와 구분이 안 됨.
--
-- 설계: 행을 지우지 않고 상태만 바꾼다.
--       지워버리면 "누가 반복해서 허위 신고를 하는지" 추적할 수 없기 때문.
--       화면의 신고 건수는 pending 만 센다.

alter table public.review_reports add column if not exists status      text not null default 'pending';
alter table public.review_reports add column if not exists resolved_at timestamptz;
alter table public.review_reports add column if not exists resolved_by text;

comment on column public.review_reports.status is
  'pending = 확인 대기 / dismissed = 관리자가 신고 거리 아님으로 기각';

create index if not exists review_reports_status_idx on public.review_reports(status, created_at desc);

-- 관리자가 상태를 바꿀 수 있어야 함.
-- (기존 정책은 신고 등록용이라 UPDATE 권한이 없어 조용히 0행 갱신될 수 있음)
alter table public.review_reports enable row level security;
drop policy if exists review_reports_admin_update on public.review_reports;
create policy review_reports_admin_update on public.review_reports
  for update using (public.is_current_user_admin()) with check (public.is_current_user_admin());
grant update on public.review_reports to authenticated;

-- 확인용
-- select status, count(*) from public.review_reports group by 1;
