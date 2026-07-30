-- 설정 페이지: 사이트 정보(푸터) + 결제수단 노출 토글 기본값
-- site_settings(key text pk, value text) 사용. 값이 없으면 코드 기본값으로 표시되므로
-- 아래 seed는 선택사항(관리자에서 저장하면 자동 upsert 됨). 참고용/초기값.
-- 실행 위치: Supabase SQL Editor

insert into public.site_settings (key, value) values
  ('biz_name',       '델리오'),
  ('biz_ceo',        '송민창'),
  ('biz_no',         '288-12-02921'),
  ('biz_mail_order', '2026-고양덕양구-1612'),
  ('biz_addr',       '경기도 고양시 덕양구 권율대로 656, 13층 1329호 (원흥동, 클레시아 더 퍼스트)'),
  ('cs_phone',       '070-8064-3601'),
  ('cs_email',       'deli_o@naver.com'),
  ('pay_card',       'true'),
  ('pay_kakao',      'true'),
  ('pay_naver',      'false'),
  ('pay_vbank',      'true')
on conflict (key) do nothing;

-- site_settings 는 푸터/체크아웃에서 비로그인도 읽어야 하므로 공개 read 정책 필요.
-- 이미 설정돼 있으면 아래는 무시됨(중복 생성 방지).
alter table public.site_settings enable row level security;
drop policy if exists site_settings_public_read on public.site_settings;
create policy site_settings_public_read on public.site_settings
  for select to anon, authenticated using (true);
grant select on public.site_settings to anon, authenticated;
