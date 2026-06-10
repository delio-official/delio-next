-- ============================================================
-- service_role(서버 전용 비밀키)에 public 스키마 전체 접근 권한 부여
-- ------------------------------------------------------------
-- 배경: 일부 테이블(site_settings, farms 등)이 service_role에 GRANT 없이
--       생성돼서, 서버 코드(finalize-order 등)가 service_role 키로 읽을 때
--       "permission denied for table ..." 가 발생했습니다.
--       → 주문 완료 시 site_settings의 적립률을 못 읽어 항상 기본 1%로 적립됨.
--
-- 안전성: service_role 은 서버에서만 쓰는 비밀키이고 RLS를 우회하도록
--         설계된 신뢰 역할입니다. 클라이언트(anon/authenticated)는 기존 RLS
--         정책 그대로라 보안 영향 없음. 아래는 Supabase 기본 동작을 복원하는 것.
-- 실행: Supabase 대시보드 > SQL Editor 에서 1회 실행.
-- ============================================================

GRANT USAGE ON SCHEMA public TO service_role;

-- 현재 존재하는 모든 테이블/시퀀스/함수
GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- 앞으로 새로 만드는 테이블/시퀀스/함수에도 자동 부여(다음 누락 방지)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;

-- 확인용(선택): 권한 붙었는지 보기
-- SELECT grantee, table_name, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE grantee = 'service_role' AND table_name IN ('site_settings','farms')
-- ORDER BY table_name, privilege_type;
