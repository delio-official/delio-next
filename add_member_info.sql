-- 회원정보 수정(아르르 레이아웃)용 컬럼
-- phone 은 이미 있을 수 있음 (있으면 무시됨)
alter table profiles add column if not exists phone text;
alter table profiles add column if not exists birth text;                          -- 생년월일 (예: 1998.06.27)
alter table profiles add column if not exists marketing_email boolean not null default false; -- 메일 수신동의
alter table profiles add column if not exists marketing_sms   boolean not null default false; -- SMS 수신동의
alter table profiles add column if not exists push_enabled    boolean not null default false; -- 앱 푸시 알림
