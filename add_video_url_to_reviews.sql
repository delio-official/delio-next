-- 1. reviews 테이블 video_url 컬럼 추가 (이미 추가했으면 skip)
ALTER TABLE reviews ADD COLUMN video_url text;

-- 2. Storage: products 버킷 reviews/ 경로 업로드 허용 (로그인 유저)
CREATE POLICY "reviews upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'products'
    AND (storage.foldername(name))[1] = 'reviews'
  );

-- 3. Storage: products 버킷 reviews/ 경로 공개 읽기 허용
CREATE POLICY "reviews public read"
  ON storage.objects FOR SELECT
  TO public
  USING (
    bucket_id = 'products'
    AND (storage.foldername(name))[1] = 'reviews'
  );
