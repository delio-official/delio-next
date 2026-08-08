-- 환불/취소 신청 증빙 사진 — refund_requests에 첨부 URL 배열 컬럼 추가
-- 고객이 환불신청 시 사진 업로드 → 관리자 환불 상세에서 확인(라이트박스)
alter table public.refund_requests
  add column if not exists attachments text[];

comment on column public.refund_requests.attachments is '환불/취소 증빙 사진 URL 배열(cs-attachments 버킷). 없으면 null';
