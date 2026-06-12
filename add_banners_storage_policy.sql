-- banners 스토리지 버킷 RLS 정책
-- 증상: 어드민에서 배너 이미지 업로드 시
--   "업로드 실패: new row violates row-level security policy"
-- 원인: storage.objects 에 banners 버킷 INSERT 정책 없음

-- 0) 버킷이 없으면 생성 (public 읽기 가능)
INSERT INTO storage.buckets (id, name, public)
VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 1) 관리자 업로드(INSERT) 허용
DROP POLICY IF EXISTS "banners admin insert" ON storage.objects;
CREATE POLICY "banners admin insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'banners' AND is_current_user_admin());

-- 2) 관리자 수정(UPDATE) 허용 (upsert 대비)
DROP POLICY IF EXISTS "banners admin update" ON storage.objects;
CREATE POLICY "banners admin update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'banners' AND is_current_user_admin())
  WITH CHECK (bucket_id = 'banners' AND is_current_user_admin());

-- 3) 관리자 삭제(DELETE) 허용
DROP POLICY IF EXISTS "banners admin delete" ON storage.objects;
CREATE POLICY "banners admin delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'banners' AND is_current_user_admin());

-- 4) 공개 읽기(SELECT) 허용
DROP POLICY IF EXISTS "banners public read" ON storage.objects;
CREATE POLICY "banners public read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'banners');
