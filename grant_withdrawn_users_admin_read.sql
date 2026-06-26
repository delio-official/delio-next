-- 관리자 페이지(회원관리 > 탈퇴 사유)에서 withdrawn_users 조회 허용
-- Supabase SQL Editor에서 실행해주세요. (관리자 계정만 SELECT 가능)

GRANT SELECT ON public.withdrawn_users TO authenticated;

ALTER TABLE public.withdrawn_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "withdrawn admin read" ON public.withdrawn_users;
CREATE POLICY "withdrawn admin read" ON public.withdrawn_users
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );
