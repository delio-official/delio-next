-- 자사센터(델리오) 표시용 플래그 추가
-- 자사배송 상품은 발주서를 위해 '델리오' 농가에 연결하되,
-- 파트너농가 페이지/홈 농가섹션에는 노출하지 않기 위함.

alter table farms
  add column if not exists is_own boolean not null default false;

-- 델리오 = 자사센터로 표시
update farms set is_own = true
  where id = 'e139f3b1-cc9f-4e59-8b4d-02fb813eabb4';

-- (참고) 나머지 농가는 default false 유지
