-- 프로필 이미지 URL (없으면 이름 첫 글자 표시)
alter table profiles add column if not exists avatar_url text;
