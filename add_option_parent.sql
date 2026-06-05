-- 2단(종속) 옵션 지원: 하위 옵션이 어떤 상위 옵션에 속하는지 표시
-- parent_label 이 NULL/'' 이면 모든 상위 선택에서 노출(기존 추가형과 동일),
-- 값이 있으면 상위 그룹에서 그 label 을 골랐을 때만 노출(종속형).
alter table public.product_options
  add column if not exists parent_label text;
