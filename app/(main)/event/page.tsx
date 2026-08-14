import EventClient from './EventClient';

export const metadata = {
  title: '이벤트 — 델리오',
  description: '델리오 진행 중인 이벤트와 특가 혜택. 산지직송 제철 과일 할인·기획전·신규회원 쿠폰을 확인하세요.',
};

export default function EventPage() {
  return <EventClient />;
}
