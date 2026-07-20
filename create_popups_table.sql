-- 팝업(popups) 테이블 셋업 — 배너/팝업 관리에서 팝업 기능을 처음 켤 때 1회 실행.
-- (관리자 화면의 파란 안내 박스에 있던 SQL을 파일로 백업)
CREATE TABLE IF NOT EXISTS popups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  image_url text,
  link_url text NOT NULL DEFAULT '/',
  width int NOT NULL DEFAULT 400,
  position text NOT NULL DEFAULT 'center',
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE popups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "popups_select_all" ON popups FOR SELECT USING (true);
CREATE POLICY "popups_all_admin" ON popups FOR ALL USING (is_current_user_admin());
GRANT ALL ON popups TO authenticated, anon;
