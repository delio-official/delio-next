-- 농가 취급 품목(복수) — farm_type(노지/비닐하우스) 대체
--
-- 배경: 농가를 재배방식(노지/비닐하우스)이 아니라 취급 품목으로 구분하고,
--       한 농가가 여러 품목을 취급하는 경우(예: 복숭아+사과) 각 품목에 모두 노출되어야 함.
-- 설계: 품목을 '이름(라벨)' 배열로 저장. 카테고리 tab_value 대신 라벨을 쓰는 이유는
--       현재 같은 품목(토마토)이 대분류별로 두 개(cat_xbev6n / cat_29py9t) 존재해
--       tab_value 기준이면 검색·필터가 갈라지기 때문.
-- farm_type 컬럼은 남겨두되(과거 데이터 보존) 화면에서는 더 이상 사용하지 않음.

ALTER TABLE public.farms ADD COLUMN IF NOT EXISTS items text[];

-- 기존 농가 품목 자동 채움 — 그 농가 상품들의 카테고리(소분류) 라벨을 모아서 세팅
WITH farm_labels AS (
  SELECT p.farm_id,
         ARRAY_AGG(DISTINCT ft.label ORDER BY ft.label) AS labels
  FROM public.products p
  JOIN public.filter_tabs ft
    ON ft.tab_value = p.category
   AND ft.tab_type  = 'category'
   AND ft.parent IS NOT NULL          -- 소분류(실제 품목)만. 대분류(산지직송/자사상품) 제외
  WHERE p.farm_id IS NOT NULL
  GROUP BY p.farm_id
)
UPDATE public.farms f
SET items = fl.labels
FROM farm_labels fl
WHERE f.id = fl.farm_id
  AND (f.items IS NULL OR array_length(f.items, 1) IS NULL);

-- 확인용
-- SELECT name, farm_type, items FROM public.farms ORDER BY name;
