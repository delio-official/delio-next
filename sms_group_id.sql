-- 예약 문자 취소용 솔라피 그룹 ID 저장 칸 (2026-09-14)
-- Supabase SQL Editor 에서 실행
-- 발송할 때 솔라피가 돌려준 그룹 ID를 기록해 두고, 예약 취소 시 그 ID로 바로 취소한다.
-- (예전엔 접수시각·수신자 수로 추정해서, 같은 시각에 같은 건수로 예약된 발송이 겹치면 자동 취소가 불가능했음)

alter table public.sms_logs add column if not exists solapi_group_id text;

select 'OK — sms_logs.solapi_group_id 준비 완료' as result;
