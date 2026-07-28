-- 입점 협업문의: 관리자 회신 문구 저장용 컬럼
-- 상세 모달에서 톤 기본문구를 수정하면 그 내용이 저장됨 (닫아도 유지)
-- 실행 위치: Supabase SQL Editor

alter table public.farm_inquiries
  add column if not exists reply text;
