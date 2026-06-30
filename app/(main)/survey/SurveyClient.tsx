'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { shareKakaoFeed } from '@/lib/kakao';
import '@/styles/survey.css';

// ════════════════════════════════════════════════
// 타입
// ════════════════════════════════════════════════
type Phase = 'intro' | 'info' | 'quiz' | 'result';
type Axis1  = 'routine' | 'free';
type Axis2  = 'care'    | 'self';
type Axis3  = 'vitamin' | 'healing';

interface Opt {
  text: string;
  emoji?: string;
  a1?:          Axis1;
  a2?:          Axis2;
  strongScore?: number;
  gentleScore?: number;
  a3tie?:       Axis3;
  mktVal?:      string;
}
interface Q { id: string; text: string; axis: 'a1'|'a2'|'a3'|'a3tie'|'mkt'; opts: Opt[]; }

interface ResultData {
  name: string; tagline: string; emoji: string; color: string; bg: string;
  desc: string[]; energyHigh: string; energyLow: string;
  doingWell: string; missing: string; tryThis: string;
  fruitRec: string; fruitTime: string; wellness: string;
}

// ════════════════════════════════════════════════
// 질문 (소비자 노출 순서)
// ════════════════════════════════════════════════
const QS: Q[] = [
  { id:'q1', axis:'a1', text:'오랜만에 생긴\n온전한 하루, 당신은?', opts:[
    { text:'일찍 일어나서 계획대로 움직여\n— 이게 제일 개운해', a1:'routine', emoji:'⏰' },
    { text:'할 일 목록 써놓고 하나씩 해\n— 다 해야 뿌듯해', a1:'routine', emoji:'📝' },
    { text:'특별한 계획 없이 흘러가는 대로\n— 이런 날은 그냥 쉬어야 해', a1:'free', emoji:'☁️' },
    { text:'하고 싶은 거 생각나면 바로\n— 계획 없는 게 더 설레', a1:'free', emoji:'✨' },
  ]},
  { id:'q4', axis:'a2', text:'긴 연휴가 생겼을 때\n나는?', opts:[
    { text:'가족이나 친구랑 가득 채워\n— 같이 있어야 충전돼', a2:'care', emoji:'👨‍👩‍👧' },
    { text:'소중한 사람들 만나는 약속 잡아\n— 사람이 있어야 에너지가 나', a2:'care', emoji:'🤝' },
    { text:'혼자만의 시간으로 채워\n— 이래야 진짜 쉬는 거야', a2:'self', emoji:'🧘' },
    { text:'나를 위한 것들로만\n— 나를 채워야 다시 달릴 수 있어', a2:'self', emoji:'💆' },
  ]},
  { id:'q2', axis:'a1', text:'건강을 챙기는\n나만의 방식은?', opts:[
    { text:'정해진 루틴대로\n— 규칙적이어야 효과가 있어', a1:'routine', emoji:'🏃' },
    { text:'목표 세우고 기록하면서\n— 관리해야 느는 거지', a1:'routine', emoji:'📊' },
    { text:'그날 컨디션에 맞게\n— 몸이 원하는 걸 해야지', a1:'free', emoji:'🌈' },
    { text:'하고 싶을 때 집중적으로\n— 억지로 하면 오래 못 가', a1:'free', emoji:'⚡' },
  ]},
  { id:'q6', axis:'a3', text:'과일의 단맛,\n나는 이 정도가 딱 좋아', opts:[
    { text:'달달할수록 좋아\n— 당도 높을수록 행복해', strongScore:2, gentleScore:0, emoji:'🍯' },
    { text:'적당히 달달한 정도가 딱\n— 너무 달면 느끼해', strongScore:1, gentleScore:0, emoji:'🍬' },
    { text:'단 건 별로야\n— 담백한 게 좋아', strongScore:0, gentleScore:2, emoji:'🍃' },
  ]},
  { id:'q5', axis:'a2', text:'스트레스 받을 때\n나는?', opts:[
    { text:'사람 만나면서 풀어\n— 혼자 있으면 더 힘들어', a2:'care', emoji:'🫂' },
    { text:'누군가와 함께 맛있는 거 먹으면서\n— 같이 먹어야 더 맛있어', a2:'care', emoji:'🍽️' },
    { text:'혼자 조용히 있어야 풀려\n— 나만의 공간이 필요해', a2:'self', emoji:'🌙' },
    { text:'혼자 운동하면서 날려버려\n— 땀 흘리면 다 풀려', a2:'self', emoji:'💪' },
  ]},
  { id:'q7', axis:'a3', text:'새콤한 맛이 느껴질 때\n당신은?', opts:[
    { text:'새콤할수록 좋아\n— 입이 살아나는 느낌', strongScore:2, gentleScore:0, emoji:'🍋' },
    { text:'살짝 새콤한 정도면 딱 좋아\n— 적당한 게 최고야', strongScore:1, gentleScore:0, emoji:'🍊' },
    { text:'신 건 별로야\n— 단게 훨씬 나아', strongScore:0, gentleScore:2, emoji:'🍑' },
  ]},
  { id:'q3', axis:'a1', text:'새로운 걸 시작할 때\n나는?', opts:[
    { text:'정보 충분히 모으고 나서\n— 알고 시작해야 실패가 없어', a1:'routine', emoji:'📚' },
    { text:'계획부터 세우고 단계적으로\n— 준비가 돼야 시작하지', a1:'routine', emoji:'🗺️' },
    { text:'일단 해보고 맞춰가\n— 해보면서 배우는 거지', a1:'free', emoji:'🚀' },
    { text:'영감 생길 때 바로\n— 그 순간 지나면 흥미가 식어', a1:'free', emoji:'💡' },
  ]},
  { id:'q8', axis:'a3tie', text:'과일 먹을 때\n식감은?', opts:[
    { text:'아삭아삭 씹히는 게 최고야\n— 식감이 살아있어야 해', a3tie:'vitamin', emoji:'🥕' },
    { text:'과즙이 팡 터지는 느낌\n— 이게 진짜 과일이지', a3tie:'vitamin', emoji:'💦' },
    { text:'부드럽고 촉촉한 게 좋아\n— 편하게 먹어야지', a3tie:'healing', emoji:'🌸' },
  ]},
  { id:'q9', axis:'mkt', text:'우리 집 냉장고\n과일 칸은?', opts:[
    { text:'항상 가득 채워져 있어\n— 떨어지면 바로 사', mktVal:'주2회이상', emoji:'🧺' },
    { text:'일주일에 한 번 정도 채워놔', mktVal:'주1회', emoji:'📅' },
    { text:'2주에 한 번? 생각날 때 사는 편', mktVal:'격주', emoji:'🗓️' },
    { text:'사실 거의 비어있어\n— 과일 잘 안 사게 되더라고', mktVal:'비정기', emoji:'🪴' },
  ]},
  { id:'q10', axis:'mkt', text:'우리 집에서 과일이\n사라지는 이유는?', opts:[
    { text:'애들 간식으로 가족이 다 먹어\n— 없으면 서운해해', mktVal:'가족용', emoji:'👨‍👩‍👧' },
    { text:'운동하고 나서 내가 챙겨먹어\n— 이게 진짜 루틴이지', mktVal:'건강관리용', emoji:'🏋️' },
    { text:'다이어트 한다고 열심히 먹어\n— 건강하게 빼야지', mktVal:'다이어트용', emoji:'🥗' },
    { text:'소중한 사람한테 선물할 때 주로 사', mktVal:'선물용', emoji:'🎁' },
    { text:'그냥 맛있어서 혼자 다 먹어\n— 먹는 게 행복이지', mktVal:'본인취식', emoji:'😋' },
  ]},
  { id:'q11', axis:'mkt', text:'과일 고를 때\n가장 먼저 마음이 가는 건?', opts:[
    { text:'맛있을 것 같은 느낌\n— 이게 제일 중요해', mktVal:'품질중시형', emoji:'👅' },
    { text:'믿을 수 있는 곳인지\n— 신뢰가 먼저야', mktVal:'신뢰중시형', emoji:'🛡️' },
    { text:'신선하게 올 것 같은지\n— 신선함이 생명이지', mktVal:'배송중시형', emoji:'🌿' },
    { text:'가격이 납득되는지\n— 가성비가 맞아야 해', mktVal:'가성비형', emoji:'💰' },
  ]},
];

// ════════════════════════════════════════════════
// 결과 데이터 (8가지 유형)
// ════════════════════════════════════════════════
const RESULTS: Record<string, ResultData> = {
  'routine-care-vitamin': {
    name:'새벽', tagline:'매일 피어나는 에너지로 주변을 밝히는 사람',
    emoji:'🌅', color:'#FF8C42', bg:'linear-gradient(135deg,#FFE0C4,#FFF4EC)',
    desc:['하루가 계획대로 흘러갈 때 가장 편안한 사람이에요.','루틴이 무너지면 왠지 하루 전체가 어긋난 느낌이 들고, 할 일 목록을 하나씩 지워가는 것에서 작은 성취감을 느껴요.','그러면서도 주변 사람을 챙기는 게 자연스러워요. 휴일엔 소중한 사람들과 함께해야 에너지가 충전돼요.','달콤하고 강렬한 맛처럼 — 한 번 만나면 잊을 수 없는 에너지를 가진 사람이에요.'],
    energyHigh:'루틴이 지켜질 때', energyLow:'계획이 틀어지거나 혼자 있는 시간이 길어질 때',
    doingWell:'규칙적인 루틴을 지키는 것 자체가 가장 강력한 건강 습관이에요. 계속 유지하세요.',
    missing:'주변을 챙기다 보면 정작 나 자신을 소홀히 하기 쉬워요. 이유 없이 피곤하거나 예민해진다면 번아웃 신호예요.',
    tryThis:'아침 루틴에 과일 한 접시를 추가해보세요. 주변을 채우기 전에 나를 먼저 채우는 가장 쉬운 방법이에요.',
    fruitRec:'달고 과즙 넘치는 과일', fruitTime:'아침 — 루틴의 시작에 과일 한 접시로 하루 에너지를 빠르게 충전하세요.',
    wellness:'"루틴이 나를 만들고, 나는 주변을 밝혀요"',
  },
  'routine-care-healing': {
    name:'이슬', tagline:'조용하고 세심하게 주변을 돌보는 사람',
    emoji:'💧', color:'#5BA4CF', bg:'linear-gradient(135deg,#DDEEFF,#F0F8FF)',
    desc:['말하지 않아도 다 챙겨주는 사람이에요.','규칙적인 일상 속에서 작은 것 하나도 놓치지 않고 주변을 돌봐요.','소란스럽지 않지만 당신이 없으면 뭔가 허전해요.','담백하고 은은한 맛처럼 — 화려하지 않지만 가장 깊이 스며드는 온기예요.'],
    energyHigh:'루틴이 지켜지고 주변이 안정적일 때', energyLow:'갑작스러운 변화나 과도한 부탁이 많을 때',
    doingWell:'꼼꼼하게 일상을 관리하면서 주변을 돌보는 것 자체가 큰 힘이에요.',
    missing:'세심하게 챙기다 보면 정작 내 감정과 컨디션을 놓치기 쉬워요. 나의 피로 신호도 꼼꼼하게 챙기세요.',
    tryThis:'저녁 루틴에 나를 위한 과일 한 조각을 더해보세요. 하루의 끝에 나를 돌보는 작은 의식이에요.',
    fruitRec:'담백하고 신선한 과일', fruitTime:'저녁 — 바쁜 하루 끝에 나를 위한 조용한 시간에 즐겨보세요.',
    wellness:'"세심한 나의 루틴이 주변을 조용히 지켜요"',
  },
  'routine-self-vitamin': {
    name:'여름', tagline:'철저한 루틴으로 스스로 활력을 만드는 사람',
    emoji:'☀️', color:'#E8A000', bg:'linear-gradient(135deg,#FFF5CC,#FFFAE8)',
    desc:['루틴이 곧 나의 언어인 사람이에요.','오늘도 계획대로, 내일도 계획대로 — 흔들리지 않는 나만의 기준이 있어요.','혼자서도 충분히 에너지를 채우고, 강렬한 것에서 활력을 얻어요.','자기 자신을 가장 잘 아는 사람이에요.'],
    energyHigh:'루틴 + 혼자만의 시간이 보장될 때', energyLow:'계획이 틀어지거나 과도한 사회적 활동이 많을 때',
    doingWell:'자신을 위한 루틴을 철저하게 지키는 것, 그게 가장 강력한 자기관리예요.',
    missing:'너무 혼자 모든 걸 해결하려다 고립될 수 있어요. 가끔 주변에 도움을 요청하는 것도 힘이 돼요.',
    tryThis:'운동 전후 고당도 과일로 에너지를 채워보세요. 루틴의 일부로 만들면 더 강력해져요.',
    fruitRec:'달고 에너지 넘치는 과일', fruitTime:'운동 후 — 소모된 에너지를 빠르게 충전하는 최적의 타이밍이에요.',
    wellness:'"나의 루틴이 나를 가장 강하게 만들어요"',
  },
  'routine-self-healing': {
    name:'가을', tagline:'혼자만의 시간 속에서 깊이 성장하는 사람',
    emoji:'🍂', color:'#A07040', bg:'linear-gradient(135deg,#F5ECD8,#FBF6EE)',
    desc:['소란스럽지 않게 꾸준히 자신을 가꾸는 사람이에요.','혼자만의 고요한 시간 속에서 진짜 성장이 일어나요.','강렬함보다 깊이를 추구하고, 은은한 것에서 본질을 찾아요.','겉으로 드러나지 않지만 — 가장 단단하게 자라고 있는 사람이에요.'],
    energyHigh:'혼자만의 조용한 시간이 충분할 때', energyLow:'시끄럽고 자극적인 환경이 지속될 때',
    doingWell:'혼자만의 시간을 소중히 여기고 내면을 가꾸는 것, 그게 당신만의 성장 방식이에요.',
    missing:'혼자 있는 시간이 너무 길어지면 고립감이 올 수 있어요. 가끔 가벼운 사람들과의 연결도 필요해요.',
    tryThis:'아침 명상이나 독서 시간에 담백한 과일을 곁들여보세요. 고요한 시간의 완성이 돼요.',
    fruitRec:'담백하고 깔끔한 과일', fruitTime:'아침 명상 / 독서 시간 — 고요한 나만의 시간에 은은하게 즐겨보세요.',
    wellness:'"고요함 속에서 나는 가장 단단하게 자라요"',
  },
  'free-care-vitamin': {
    name:'봄', tagline:'자유롭게 움직이며 주변에 활기를 주는 사람',
    emoji:'🌸', color:'#E0558A', bg:'linear-gradient(135deg,#FFE0EE,#FFF5F9)',
    desc:['계획 없이 살아도 주변이 늘 행복한 사람이에요.','그 순간 느끼는 대로 움직이면서도, 소중한 사람 챙기는 건 본능이에요.','달콤하고 강렬한 것처럼 — 함께하는 순간마다 삶이 더 풍성해져요.','당신 주변엔 항상 웃음이 있어요.'],
    energyHigh:'소중한 사람들과 함께하는 자유로운 시간에', energyLow:'계획에 묶이거나 오랜 시간 혼자 있을 때',
    doingWell:'자유롭게 살면서도 주변을 챙기는 균형, 그게 당신만의 특별한 에너지예요.',
    missing:'즉흥적으로 움직이다 보면 자신의 건강 루틴을 놓치기 쉬워요. 최소한의 건강 습관 하나는 지켜보세요.',
    tryThis:'생각날 때 바로 과일을 집어보세요. 거창한 루틴 없이도 충분해요.',
    fruitRec:'달고 과즙 넘치는 과일', fruitTime:'생각날 때 언제든 — 루틴 없이 즉흥적으로 즐기는 게 당신 스타일이에요.',
    wellness:'"계획 없이도 나는 주변을 밝혀요"',
  },
  'free-care-healing': {
    name:'바람', tagline:'흘러가듯 자연스럽게 온기를 나눠주는 사람',
    emoji:'🌬️', color:'#4A9FD4', bg:'linear-gradient(135deg,#D8EEFF,#EEF7FF)',
    desc:['계획 없이도 자연스럽게 온기를 나눠주는 사람이에요.','억지 없이 흘러가는 대로 살면서도, 곁에 있는 사람은 늘 따뜻해요.','은은하고 담백한 맛처럼 — 강요하지 않아도 스며드는 편안함이 있어요.','당신과 함께하면 이유 없이 기분이 좋아져요.'],
    energyHigh:'자유롭게 소중한 사람들과 함께하는 시간에', energyLow:'억압적인 환경이나 강요받는 상황에서',
    doingWell:'자연스럽게 흘러가면서도 주변을 따뜻하게 하는 것, 그게 당신다운 삶이에요.',
    missing:'너무 흘러가다 보면 정작 나의 건강을 챙기는 타이밍을 놓칠 수 있어요.',
    tryThis:'저녁 여유 시간에 담백한 과일 한 조각, 그게 당신을 위한 가장 자연스러운 휴식이에요.',
    fruitRec:'은은하고 신선한 과일', fruitTime:'저녁 여유 시간 — 자연스럽게 흘러가는 하루의 마무리에 어울려요.',
    wellness:'"자연스럽게 흘러가는 나의 온기가 주변을 데워요"',
  },
  'free-self-vitamin': {
    name:'불꽃', tagline:'자신만의 취향으로 에너지 넘치게 사는 사람',
    emoji:'🔥', color:'#E03030', bg:'linear-gradient(135deg,#FFE0E0,#FFF4F4)',
    desc:['익숙함에 안주하지 않는 사람이에요.','혼자서도 충분히 즐기고, 새로운 자극을 찾아 끊임없이 움직여요.','강렬하고 임팩트 있는 것처럼 — 한 번 꽂히면 끝까지 파고들어요.','취향 하나만큼은 누구보다 확실한 사람이에요.'],
    energyHigh:'새로운 것을 발견하고 혼자 깊이 탐험할 때', energyLow:'반복적이고 자극 없는 환경이 지속될 때',
    doingWell:'새로운 것을 끊임없이 탐험하는 에너지, 그게 당신을 살아있게 하는 힘이에요.',
    missing:'강렬한 자극만 찾다 보면 몸의 회복 시간을 놓치기 쉬워요. 가끔 의도적으로 쉬는 시간을 만드세요.',
    tryThis:'새로운 과일을 발견했을 때 주저 말고 도전해보세요. 새로운 맛의 탐험이 당신의 활력이에요.',
    fruitRec:'새콤달콤 강렬한 과일', fruitTime:'새로운 과일 발견했을 때 — 도전하는 그 순간이 딱 맞는 타이밍이에요.',
    wellness:'"새로운 것을 향한 나의 탐험이 곧 나의 에너지예요"',
  },
  'free-self-healing': {
    name:'달빛', tagline:'은은하게 자신만의 감각으로 살아가는 사람',
    emoji:'🌙', color:'#7050C0', bg:'linear-gradient(135deg,#EDE0FF,#F8F4FF)',
    desc:['유행보다 자신의 감각을 믿는 사람이에요.','혼자만의 시간 속에서 가장 자유롭고, 본질에 집중하는 삶을 살아요.','은은하고 깊은 맛처럼 — 겉으로 드러나지 않지만 독보적인 세계가 있어요.','당신만의 감각이 곧 당신의 언어예요.'],
    energyHigh:'혼자만의 자유로운 시간에', energyLow:'과도한 사회적 자극이나 타인의 기대에 맞춰야 할 때',
    doingWell:'자신만의 감각과 페이스를 지키는 것, 그게 가장 건강한 삶의 방식이에요.',
    missing:'혼자 모든 것을 처리하려다 외로움이 쌓일 수 있어요. 가끔 신뢰하는 한 사람에게 마음을 열어보세요.',
    tryThis:'혼자만의 시간에 좋아하는 담백한 과일을 천천히 즐겨보세요. 감각을 온전히 느끼는 나만의 의식이에요.',
    fruitRec:'은은하고 깊은 맛의 과일', fruitTime:'혼자만의 조용한 시간 — 감각에 온전히 집중할 수 있는 그 순간이에요.',
    wellness:'"나만의 감각이 곧 나의 언어예요"',
  },
};

// ════════════════════════════════════════════════
// 점수 계산
// ════════════════════════════════════════════════
function calcResult(answers: Record<string, number>) {
  // answers[id]가 undefined이면 null 반환 (개발 핫리로드 등 엣지케이스 방어)
  const opt = (id: string) => {
    const idx = answers[id];
    if (idx === undefined) return null;
    return QS.find(q => q.id === id)?.opts[idx] ?? null;
  };

  // 축1: q1, q2, q3
  let routine = 0, free = 0;
  ['q1','q2','q3'].forEach(id => { opt(id)?.a1 === 'routine' ? routine++ : free++; });
  const axis1: Axis1 = routine >= 2 ? 'routine' : 'free';

  // 축2: q4, q5 (동수→q5 우선)
  let care = 0, self = 0;
  ['q4','q5'].forEach(id => { opt(id)?.a2 === 'care' ? care++ : self++; });
  const axis2: Axis2 = care !== self ? (care > self ? 'care' : 'self') : ((opt('q5')?.a2 as Axis2) ?? 'care');

  // 축3: q6, q7 (동수→q8 보조)
  let strong = 0, gentle = 0;
  ['q6','q7'].forEach(id => { strong += opt(id)?.strongScore ?? 0; gentle += opt(id)?.gentleScore ?? 0; });
  const axis3: Axis3 = strong !== gentle ? (strong > gentle ? 'vitamin' : 'healing') : ((opt('q8')?.a3tie as Axis3) ?? 'healing');

  return { axis1, axis2, axis3, key: `${axis1}-${axis2}-${axis3}` };
}

// ════════════════════════════════════════════════
// 메인 컴포넌트
// ════════════════════════════════════════════════
export default function SurveyClient() {
  const { user } = useAuth();
  const sp = useSearchParams();

  const [phase,        setPhase]        = useState<Phase>('intro');
  const [info,         setInfo]         = useState({ gender:'', age:'', family:'' });
  const [step,         setStep]         = useState(0);
  const [answers,      setAnswers]      = useState<Record<string, number>>({});
  const [transitioning,setTransitioning]= useState(false);
  const [selected,     setSelected]     = useState<number | null>(null);
  const [result,       setResult]       = useState<ReturnType<typeof calcResult> | null>(null);
  const [copied,       setCopied]       = useState(false);
  const [sharingInsta, setSharingInsta] = useState(false);
  const [savingImg, setSavingImg] = useState(false);
  const storyCardRef = useRef<HTMLDivElement>(null);

  /* 공유 링크(?r=key)로 들어오면 결과 화면을 바로 표시 (처음부터 다시 안 하게) */
  useEffect(() => {
    const r = sp.get('r');
    if (r && RESULTS[r]) {
      const [a1, a2, a3] = r.split('-');
      setResult({ axis1: a1, axis2: a2, axis3: a3, key: r } as ReturnType<typeof calcResult>);
      setPhase('result');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 맞춤 상품 */
  interface RecProduct {
    id: string; name: string; price: number; discounted_price: number;
    discount_rate: number; thumbnail_url: string | null; category: string; avg_rating: number;
  }
  const [recProducts, setRecProducts] = useState<RecProduct[]>([]);
  const [showRecProducts, setShowRecProducts] = useState(true);

  useEffect(() => {
    if (!result) return;
    async function loadRecs() {
      const supabase = createClient();
      /* 추천 상품 노출 설정 확인 */
      const { data: setting } = await supabase
        .from('site_settings').select('value').eq('key', 'survey_show_products').maybeSingle();
      setShowRecProducts(setting?.value !== 'false');
      /* axis3: vitamin→강한맛 과일, healing→부드러운 과일 */
      const cats = result!.axis3 === 'vitamin'
        ? ['citrus', 'berry', 'apple']
        : ['melon', 'grape', 'kiwi'];
      /* axis1: routine→베스트 우선, free→신상 우선 */
      const order = result!.axis1 === 'routine'
        ? { col: 'is_best', asc: false }
        : { col: 'created_at', asc: false };
      const { data } = await supabase
        .from('products')
        .select('id,name,price,discounted_price,discount_rate,thumbnail_url,category,avg_rating')
        .in('category', cats)
        .eq('is_active', true)
        .order(order.col, { ascending: order.asc })
        .limit(6);
      if (data) setRecProducts(data as RecProduct[]);
    }
    loadRecs();
  }, [result]);

  const TOTAL = QS.length;
  const currentQ = QS[step];

  /* ── 선택 처리 ────────────── */
  function handleSelect(idx: number) {
    if (transitioning) return;
    setSelected(idx);
    setTimeout(() => {
      const newAns = { ...answers, [currentQ.id]: idx };
      setAnswers(newAns);
      setSelected(null);
      setTransitioning(true);
      setTimeout(() => {
        if (step + 1 >= TOTAL) {
          const r = calcResult(newAns);
          setResult(r);
          setPhase('result');
          saveResult(newAns, r);
        } else {
          setStep(s => s + 1);
        }
        setTransitioning(false);
      }, 250);
    }, 180);
  }

  /* ── 뒤로가기 ────────────── */
  function handleBack() {
    if (step === 0) { setPhase('info'); return; }
    const newAns = { ...answers };
    delete newAns[currentQ.id];
    setAnswers(newAns);
    setStep(s => s - 1);
  }

  /* ── Supabase 저장 ───────── */
  async function saveResult(ans: Record<string, number>, r: ReturnType<typeof calcResult>) {
    try {
      const supabase = createClient();
      const res = RESULTS[r.key];
      const getOpt = (id: string) => QS.find(q => q.id === id)?.opts[ans[id]];
      await supabase.from('survey_results').insert({
        user_id:            user?.id || null,
        gender:             info.gender || null,
        age_group:          info.age    || null,
        family_size:        info.family || null,
        result_type:        res?.name,
        axis1:              r.axis1,
        axis2:              r.axis2,
        axis3:              r.axis3,
        purchase_frequency: getOpt('q9')?.mktVal,
        purchase_purpose:   getOpt('q10')?.mktVal,
        decision_factor:    getOpt('q11')?.mktVal,
        texture_pref:       getOpt('q8')?.a3tie,
        answers:            Object.fromEntries(Object.entries(ans).map(([id,i]) => [id, QS.find(q=>q.id===id)?.opts[i]?.text ?? null])),
        result_category:    r.axis3 === 'vitamin' ? 'vitamin' : 'healing',
        result_label:       res?.name,
        result_desc:        res?.tagline,
      });
    } catch { /* silent */ }
  }

  /* ── 공유 ─────────────────── */
  function copyLink() {
    /* 결과 공유 링크: ?r=<유형key> 를 붙여, 받는 사람이 결과 화면을 바로 보게 */
    const url = result
      ? `${window.location.origin}/survey?r=${encodeURIComponent(result.key)}`
      : window.location.href;
    navigator.clipboard.writeText(url)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  function shareKakao() {
    if (!result) return;
    const r = RESULTS[result.key];
    const url = `${window.location.origin}/survey?r=${encodeURIComponent(result.key)}`;
    const ok = shareKakaoFeed({
      title: `내 과일 취향유형 · ${r?.name ?? '취향진단'}`,
      description: r?.tagline ?? '델리오 취향진단으로 내 과일 유형을 확인해보세요!',
      imageUrl: `${window.location.origin}/KakaoThumbnail.png`,
      linkUrl: url,
      buttonTitle: '내 결과 보기',
    });
    if (!ok) { copyLink(); alert('카카오톡 공유가 아직 준비 중이라 결과 링크를 복사했어요. 붙여넣어 공유해 주세요.'); }
  }

  async function shareInstagram() {
    if (!storyCardRef.current || sharingInsta) return;
    setSharingInsta(true);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(storyCardRef.current, {
        pixelRatio: 2,
        skipFonts: true,          // 외부 폰트 시트 cssRules CORS 오류 방지
        cacheBust: true,          // 캐시 무효화로 재캡처 시 이전 이미지 사용 방지
      });

      // Blob 변환
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], 'delio-wellness-result.png', { type: 'image/png' });

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      if (isMobile && navigator.canShare?.({ files: [file] })) {
        // 모바일: 공유 시트 → 인스타 스토리 선택 가능
        await navigator.share({ files: [file], title: 'DELI\'O 취향유형 진단 결과' });
      } else {
        // 데스크탑: 이미지 다운로드 후 안내
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = 'delio-wellness-result.png';
        a.click();
        alert('이미지가 저장됐어요! 📸\n인스타그램 앱에서 스토리에 업로드해 주세요.');
      }
    } catch {
      alert('공유 중 오류가 발생했어요. 다시 시도해 주세요.');
    } finally {
      setSharingInsta(false);
    }
  }

  /* ── 결과 이미지 저장(다운로드) ── */
  async function saveImage() {
    if (!storyCardRef.current || savingImg) return;
    setSavingImg(true);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(storyCardRef.current, { pixelRatio: 2, skipFonts: true, cacheBust: true });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'delio-taste-result.png';
      a.click();
    } catch {
      alert('이미지 저장 중 오류가 발생했어요. 다시 시도해 주세요.');
    } finally {
      setSavingImg(false);
    }
  }

  // ════════ INTRO ════════
  if (phase === 'intro') {
    return (
      <div style={{ minHeight:'100vh', background:'linear-gradient(160deg,#F4EFE6 0%,#EDE8DC 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 20px', textAlign:'center' }}>
        <div style={{ fontSize:72, marginBottom:20 }}>🍑</div>
        <p style={{ fontSize:12, letterSpacing:3, color:'#A08060', fontWeight:700, marginBottom:12 }}>DELI'O</p>
        <h1 style={{ fontSize:'clamp(24px,5vw,38px)', fontWeight:800, lineHeight:1.3, marginBottom:16, color:'#1A1A1A' }}>
          취향유형 진단
        </h1>
        <p style={{ fontSize:15, color:'#666', lineHeight:1.8, maxWidth:360, marginBottom:8 }}>
          나의 라이프스타일과 입맛으로<br />
          찾는 나의 유형은?
        </p>
        <p style={{ fontSize:13, color:'#AAA', marginBottom:36 }}>총 11문항 · 3분 소요</p>
        <button
          onClick={() => setPhase('info')}
          style={{ padding:'16px 48px', background:'#1A1A1A', color:'#fff', border:'none', borderRadius:12, fontSize:17, fontWeight:800, cursor:'pointer', boxShadow:'0 4px 20px rgba(0,0,0,0.15)' }}>
          테스트 시작하기 →
        </button>
        <p style={{ fontSize:12, color:'#BBB', marginTop:20 }}>비회원도 참여 가능 · 회원가입 시 상세 결과 공개</p>
      </div>
    );
  }

  // ════════ INFO ════════
  if (phase === 'info') {
    const S: React.CSSProperties = { padding:'12px 16px', border:'1.5px solid #EBEBEB', borderRadius:10, fontSize:14, width:'100%', outline:'none', background:'#fff', fontFamily:'inherit', cursor:'pointer', appearance:'none', WebkitAppearance:'none' };
    return (
      <div style={{ minHeight:'100vh', background:'#FAFAF8', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 20px' }}>
        <div style={{ width:'100%', maxWidth:420 }}>
          <p style={{ fontSize:12, letterSpacing:2, color:'#888', fontWeight:700, marginBottom:8 }}>STEP 0 / 11</p>
          <h2 style={{ fontSize:22, fontWeight:800, marginBottom:6 }}>시작 전,<br />간단히 알려주세요 👋</h2>
          <p style={{ fontSize:13, color:'#999', marginBottom:28 }}>모두 선택하면 진단을 시작할 수 있어요.</p>

          <div style={{ display:'flex', flexDirection:'column', gap:16, marginBottom:36 }}>
            <div>
              <label style={{ fontSize:13, fontWeight:700, color:'#555', display:'block', marginBottom:6 }}>성별</label>
              <div style={{ display:'flex', gap:8 }}>
                {[['male','남성'],['female','여성'],['none','선택 안 할게요']].map(([v,l]) => (
                  <button key={v} onClick={() => setInfo(p => ({...p, gender:v}))}
                    style={{ flex:1, padding:'11px 0', border:`1.5px solid ${info.gender===v?'#1A1A1A':'#EBEBEB'}`, borderRadius:10, background:info.gender===v?'#F4F4F4':'#fff', color:info.gender===v?'#1A1A1A':'#555', fontSize:13, fontWeight:info.gender===v?700:400, cursor:'pointer' }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize:13, fontWeight:700, color:'#555', display:'block', marginBottom:6 }}>나이</label>
              <select value={info.age} onChange={e => setInfo(p => ({...p, age:e.target.value}))} style={S}>
                <option value="">선택해주세요</option>
                {[['10s','10대'],['20s','20대'],['30s','30대'],['40s','40대'],['50s','50대'],['60plus','60대 이상']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:13, fontWeight:700, color:'#555', display:'block', marginBottom:6 }}>가족 구성</label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[['1','1인 가구'],['2','2인 가구'],['3-4','3~4인 가구'],['5plus','5인 이상']].map(([v,l]) => (
                  <button key={v} onClick={() => setInfo(p => ({...p, family:v}))}
                    style={{ padding:'11px 0', border:`1.5px solid ${info.family===v?'#1A1A1A':'#EBEBEB'}`, borderRadius:10, background:info.family===v?'#F4F4F4':'#fff', color:info.family===v?'#1A1A1A':'#555', fontSize:13, fontWeight:info.family===v?700:400, cursor:'pointer' }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {(() => {
            const allFilled = info.gender !== '' && info.age !== '' && info.family !== '';
            return (
              <button
                onClick={() => { if (allFilled) setPhase('quiz'); }}
                disabled={!allFilled}
                style={{ width:'100%', padding:'16px', background: allFilled ? '#1A1A1A' : '#CFCFCF',
                  color:'#fff', border:'none', borderRadius:12, fontSize:16, fontWeight:800,
                  cursor: allFilled ? 'pointer' : 'not-allowed', transition:'background .2s' }}>
                진단 시작하기 →
              </button>
            );
          })()}

          <div style={{ marginTop:16, textAlign:'center' }}>
            <button onClick={() => setPhase('intro')}
              style={{ background:'none', border:'1.5px solid #E0E0E0', borderRadius:10,
                padding:'11px 32px', cursor:'pointer', color:'#888', fontSize:14,
                fontWeight:600, fontFamily:'inherit' }}>
              ← 처음으로
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ════════ QUIZ ════════
  if (phase === 'quiz') {
    // step이 범위를 벗어나면 결과 계산으로 안전 전환
    if (!currentQ) {
      const r = calcResult(answers);
      setResult(r);
      setPhase('result');
      return null;
    }
    const progress = ((step + 1) / TOTAL) * 100;
    const isMidPoint = step === 6; // 7번째 질문

    return (
      <div style={{ minHeight:'100vh', background:'#FAFAF8', display:'flex', flexDirection:'column' }}>

        {/* 진행바 */}
        <div style={{ padding:'16px 20px 0', maxWidth:520, width:'100%', margin:'0 auto' }}>
          <div style={{ display:'flex', justifyContent:'flex-end', alignItems:'center', marginBottom:8 }}>
            <span style={{ fontSize:13, fontWeight:700, color:'#888' }}>{step + 1} / {TOTAL}</span>
          </div>
          <div style={{ height:6, background:'#E8E8E8', borderRadius:99, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${progress}%`, background:'#1A1A1A', borderRadius:99, transition:'width .3s' }} />
          </div>
        </div>

        {/* 중간 흥미 유발 */}
        {isMidPoint && (
          <div style={{ textAlign:'center', padding:'10px', marginTop:8 }}>
            <span style={{ fontSize:13, color:'#7050C0', fontWeight:700, background:'#EDE0FF', padding:'4px 14px', borderRadius:20 }}>
              🎉 거의 다 왔어요! 조금만 더!
            </span>
          </div>
        )}

        {/* 질문 카드 */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-start', padding:'28px 20px 40px', maxWidth:520, width:'100%', margin:'0 auto' }}>
          <div style={{
            width:'100%', opacity: transitioning ? 0 : 1,
            transform: transitioning ? 'translateY(10px)' : 'none',
            transition:'opacity .25s, transform .25s',
          }}>
            {/* 질문 텍스트 */}
            <div style={{ textAlign:'center', marginBottom:32 }}>
              <p style={{ fontSize:11, letterSpacing:2, color:'#888', fontWeight:700, marginBottom:10 }}>
                Q{step + 1}
              </p>
              <h2 style={{ fontSize:'clamp(20px,4vw,26px)', fontWeight:800, lineHeight:1.4, color:'#1A1A1A', whiteSpace:'pre-line' }}>
                {currentQ.text}
              </h2>
            </div>

            {/* 선택지 */}
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {currentQ.opts.map((opt, i) => {
                const [headline, sub] = opt.text.split('\n');
                const isActive = selected === i;
                return (
                  <button
                    key={i}
                    onClick={() => handleSelect(i)}
                    style={{
                      width:'100%', textAlign:'left',
                      padding:'18px 20px',
                      border:`1.5px solid ${isActive ? '#1A1A1A' : '#EBEBEB'}`,
                      borderRadius:16,
                      background: isActive ? '#F5F5F5' : '#fff',
                      cursor:'pointer', transition:'border-color .15s, background .15s',
                      display:'flex', alignItems:'center', justifyContent:'space-between', gap:16,
                      fontFamily:'inherit',
                    }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.borderColor='#AAAAAA'; }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.borderColor='#EBEBEB'; }}
                  >
                    {/* 텍스트 */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:16, fontWeight:700, color:'#1A1A1A', lineHeight:1.3, marginBottom: sub ? 4 : 0 }}>
                        {headline}
                      </div>
                      {sub && (
                        <div style={{ fontSize:13, color:'#888', lineHeight:1.5 }}>
                          {sub.replace(/^—\s*/, '')}
                        </div>
                      )}
                    </div>
                    {/* 이모지 */}
                    <div style={{ fontSize:30, flexShrink:0, lineHeight:1 }}>
                      {opt.emoji}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 이전 버튼 */}
            <div style={{ marginTop:20, textAlign:'center' }}>
              <button onClick={handleBack}
                style={{ background:'none', border:'1.5px solid #E0E0E0', borderRadius:10,
                  padding:'11px 32px', cursor:'pointer', color:'#888', fontSize:14,
                  fontWeight:600, fontFamily:'inherit' }}>
                ← 이전
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ════════ RESULT ════════
  const res = result ? RESULTS[result.key] : null;
  if (!res || !result) return null;

  const isLoggedIn = !!user;

  const tags = [
    result.axis1 === 'routine' ? '루틴형' : '자유형',
    result.axis2 === 'care'    ? '케어형' : '자기충전형',
    result.axis3 === 'vitamin' ? '비타민형' : '힐링형',
  ];

  return (
    <div style={{ background:'#fff', minHeight:'100vh', paddingBottom:80 }}>

      {/* 히어로 — 포스텔러식 그라데 헤더 */}
      <div style={{ background: `linear-gradient(160deg, ${res.color}26 0%, ${res.bg} 55%)`, padding:'48px 20px 40px' }}>
        <p style={{ fontSize:11, letterSpacing:3, color: res.color, fontWeight:700, marginBottom:18, textAlign:'center' }}>MY LIFESTYLE TYPE</p>

        {/* 결과 카드 — 이미지 스타일 */}
        <div style={{
          background:'#fff', borderRadius:18,
          border:`2px solid ${res.color}`,
          padding:'20px 20px 20px 24px',
          display:'flex', justifyContent:'space-between', alignItems:'center',
          boxShadow:`0 6px 24px ${res.color}25`,
          maxWidth:560, margin:'0 auto',
        }}>
          <div style={{ flex:1, minWidth:0 }}>
            <h1 style={{ fontSize:28, fontWeight:900, color: res.color, marginBottom:6, letterSpacing:-0.5 }}>
              {res.name}
            </h1>
            <p style={{ fontSize:13, color:'#666', lineHeight:1.7, marginBottom:12 }}>{res.tagline}</p>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {tags.map(tag => (
                <span key={tag} style={{
                  fontSize:11, fontWeight:700,
                  background:`${res.color}18`, color: res.color,
                  padding:'3px 10px', borderRadius:20,
                }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div style={{ fontSize:56, marginLeft:20, flexShrink:0, lineHeight:1 }}>{res.emoji}</div>
        </div>
      </div>

      <div style={{ maxWidth:640, margin:'0 auto', padding:'0 20px' }}>

        {/* ── 비회원 게이트 ── */}
        {!isLoggedIn ? (
          <div style={{ margin:'40px 0', border:'1.5px dashed #DDDDD8', borderRadius:20, padding:'36px 24px', textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🔒</div>
            <h3 style={{ fontSize:18, fontWeight:800, marginBottom:8 }}>상세 결과는 회원만 볼 수 있어요</h3>
            <p style={{ fontSize:14, color:'#888', lineHeight:1.7, marginBottom:24 }}>
델리오의 가이드, 추천 과일, 에너지 패턴까지<br />
              나에게 딱 맞는 분석을 확인해보세요.
            </p>
            <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
              <Link href="/signup" style={{ padding:'12px 28px', background:'#1A1A1A', color:'#fff', borderRadius:10, fontWeight:700, fontSize:14, textDecoration:'none' }}>
                회원가입하고 결과 보기
              </Link>
              <Link href="/login" style={{ padding:'12px 28px', border:'1.5px solid #1A1A1A', color:'#1A1A1A', borderRadius:10, fontWeight:700, fontSize:14, textDecoration:'none' }}>
                로그인
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* ① 당신은 이런 사람이에요 */}
            <section style={{ marginTop:36, marginBottom:28, padding:'24px', background:'#FAFAF8', borderRadius:16 }}>
              <h2 style={{ fontSize:16, fontWeight:800, marginBottom:14, color: res.color }}>당신은 이런 사람이에요</h2>
              {res.desc.map((line, i) => (
                <p key={i} style={{ fontSize:14, lineHeight:1.8, color:'#333', marginBottom: i < res.desc.length-1 ? 6 : 0 }}>{line}</p>
              ))}
            </section>

            {/* ② 에너지 패턴 */}
            <section style={{ marginBottom:28 }}>
              <h2 style={{ fontSize:16, fontWeight:800, marginBottom:14 }}>⚡ 당신의 에너지 패턴</h2>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', background:'#F0FAF3', borderRadius:12, border:'1px solid #B2DFCC' }}>
                  <span style={{ fontSize:22 }}>🔋</span>
                  <div>
                    <p style={{ fontSize:12, color:'#2D7A4D', fontWeight:700, marginBottom:2 }}>에너지 최고조</p>
                    <p style={{ fontSize:14, color:'#333' }}>{res.energyHigh}</p>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', background:'#FFF8F0', borderRadius:12, border:'1px solid #FFCCAA' }}>
                  <span style={{ fontSize:22 }}>🪫</span>
                  <div>
                    <p style={{ fontSize:12, color:'#AA5500', fontWeight:700, marginBottom:2 }}>에너지 저하</p>
                    <p style={{ fontSize:14, color:'#333' }}>{res.energyLow}</p>
                  </div>
                </div>
              </div>
            </section>

            {/* ③ 웰니스 가이드 */}
            <section style={{ marginBottom:28 }}>
              <h2 style={{ fontSize:16, fontWeight:800, marginBottom:14 }}>🌿 당신을 위한 델리오의 가이드</h2>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {[
                  { icon:'✅', label:'잘 하고 있어요', text: res.doingWell, bg:'#F0FAF3', border:'#B2DFCC', labelColor:'#2D7A4D' },
                  { icon:'⚠️', label:'놓치기 쉬운 것', text: res.missing,   bg:'#FFFBE6', border:'#FFE08A', labelColor:'#8A6000' },
                  { icon:'💡', label:'이렇게 해보세요', text: res.tryThis,   bg:'#F4EFE6', border:'#E0C89A', labelColor:'#1A1A1A' },
                ].map(item => (
                  <div key={item.label} style={{ padding:'16px', background: item.bg, borderRadius:12, border:`1px solid ${item.border}` }}>
                    <p style={{ fontSize:12, fontWeight:700, color: item.labelColor, marginBottom:6 }}>{item.icon} {item.label}</p>
                    <p style={{ fontSize:14, color:'#333', lineHeight:1.7 }}>{item.text}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* ④ 추천 과일 */}
            <section style={{ marginBottom:28, padding:'24px', background:'#FAFAF8', borderRadius:16 }}>
              <h2 style={{ fontSize:16, fontWeight:800, marginBottom:14, color: res.color }}>🍑 당신에게 맞는 과일</h2>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
                <span style={{ fontSize:32 }}>{res.emoji}</span>
                <div>
                  <p style={{ fontSize:15, fontWeight:700, color:'#1A1A1A', marginBottom:2 }}>{res.fruitRec}</p>
                  <p style={{ fontSize:13, color:'#666' }}>{res.fruitTime}</p>
                </div>
              </div>
            </section>

            {/* ⑤ 맞춤 상품 추천 */}
            {showRecProducts && (
            <section style={{ marginBottom:28 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                <h2 style={{ fontSize:16, fontWeight:800 }}>🛒 나를 위한 추천 상품</h2>
                <Link href="/category" style={{ fontSize:12, color:'#888', textDecoration:'none', fontWeight:600 }}>
                  전체보기 →
                </Link>
              </div>

              {recProducts.length === 0 ? (
                <div style={{ textAlign:'center', padding:'32px 0', color:'#aaa', fontSize:13,
                  background:'#F7F7F5', borderRadius:12 }}>
                  상품을 불러오는 중...
                </div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:12 }}>
                  {recProducts.map(p => {
                    const EMOJI_MAP: Record<string,string> = {
                      apple:'🍎', citrus:'🍊', berry:'🫐', melon:'🍈',
                      kiwi:'🥝', mango:'🥭', grape:'🍇', gift:'🎁', default:'🍑',
                    };
                    const emoji = EMOJI_MAP[p.category] || EMOJI_MAP.default;
                    const price = p.discounted_price ?? p.price;
                    const rating = p.avg_rating ? p.avg_rating.toFixed(1) : null;
                    return (
                      <Link key={p.id} href={`/product/${p.id}`}
                        style={{ textDecoration:'none', color:'inherit' }}>
                        <div style={{ borderRadius:14, border:'1px solid #EBEBEB',
                          overflow:'hidden', background:'#fff',
                          transition:'box-shadow .15s', cursor:'pointer',
                          display:'flex', flexDirection:'column', height:'100%' }}
                          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow='0 4px 16px rgba(0,0,0,0.1)'}
                          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow='none'}>
                          {/* 이미지 — 고정 높이 */}
                          <div style={{ height:140, flexShrink:0, background:'#F7F7F5',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            fontSize:44, overflow:'hidden' }}>
                            {p.thumbnail_url
                              ? <img src={p.thumbnail_url} alt={p.name}
                                  style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                              : emoji}
                          </div>
                          {/* 텍스트 — flex-grow로 높이 균일 */}
                          <div style={{ padding:'10px 12px 12px', flex:1,
                            display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
                            <div style={{ fontSize:12, fontWeight:600, color:'#1A1A1A',
                              marginBottom:6, lineHeight:1.4, height:'2.8em',
                              overflow:'hidden' }}>
                              {p.name}
                            </div>
                            <div>
                              {rating && (
                                <div style={{ fontSize:11, color:'#F5A623', marginBottom:3 }}>
                                  ★ {rating}
                                </div>
                              )}
                              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                                {p.discount_rate > 0 && (
                                  <span style={{ fontSize:11, fontWeight:700, color:'var(--color-accent)' }}>
                                    {Math.round(p.discount_rate)}%
                                  </span>
                                )}
                                <span style={{ fontSize:13, fontWeight:800, color:'#1A1A1A' }}>
                                  {price.toLocaleString('ko-KR')}원
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
            )}
          </>
        )}

        {/* ⑦ 델리오 한 마디 */}
        <div style={{ textAlign:'center', padding:'28px 20px', borderTop:'1px solid #F0F0EE', borderBottom:'1px solid #F0F0EE', margin:'28px 0' }}>
          <p style={{ fontSize:13, color:'#AAA', marginBottom:8 }}>델리오 한 마디</p>
          <p style={{ fontSize:18, fontWeight:800, color: res.color, fontStyle:'italic', lineHeight:1.5 }}>{res.wellness}</p>
        </div>

        {/* ⑧ 공유 섹션 */}
        <div style={{ marginBottom:40, background:'#F7F7F5', borderRadius:16, padding:'24px' }}>
          <div style={{ fontSize:15, fontWeight:800, marginBottom:2 }}>결과 공유하기</div>
          <div style={{ fontSize:12, color:'#aaa', marginBottom:20 }}>나의 유형을 친구에게 알려보세요</div>

          {/* 미니 프리뷰 카드 */}
          <div style={{
            background: res.bg, borderRadius:14, padding:'16px 18px',
            display:'flex', alignItems:'center', gap:14, marginBottom:16,
            border:`1.5px solid ${res.color}30`,
          }}>
            <div style={{ fontSize:36, flexShrink:0 }}>{res.emoji}</div>
            <div>
              <div style={{ fontSize:18, fontWeight:900, color: res.color }}>{res.name}</div>
              <div style={{ fontSize:11, color:'#666', marginTop:2 }}>{res.tagline}</div>
            </div>
          </div>

          {/* 원형 공유 버튼 */}
          <div style={{ display:'flex', justifyContent:'center', alignItems:'flex-start', gap:24, paddingTop:4 }}>
            {/* 링크 복사 */}
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:7 }}>
              <button onClick={copyLink} title="링크 복사"
                style={{ width:54, height:54, borderRadius:'50%', border:'none', cursor:'pointer',
                  background: copied ? '#2D7A4D' : '#5B7FE0',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  boxShadow:'0 2px 8px rgba(0,0,0,0.12)', transition:'all .2s' }}>
                {copied ? (
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#fff" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                )}
              </button>
              <span style={{ fontSize:11, color:'#888', fontWeight:600 }}>{copied ? '복사됨' : '링크'}</span>
            </div>

            {/* 카카오톡 */}
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:7 }}>
              <button onClick={shareKakao} title="카카오톡 공유"
                style={{ width:54, height:54, borderRadius:'50%', border:'none', cursor:'pointer',
                  background:'#FEE500', display:'flex', alignItems:'center', justifyContent:'center',
                  boxShadow:'0 2px 8px rgba(0,0,0,0.12)' }}>
                <svg viewBox="0 0 24 24" width="26" height="26" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#3C1E1E" d="M12 4C7.03 4 3 7.13 3 11c0 2.47 1.65 4.64 4.13 5.88-.18.65-.66 2.37-.75 2.74-.12.46.17.45.35.33.14-.09 2.26-1.54 3.18-2.17.68.1 1.38.15 2.09.15 4.97 0 9-3.13 9-7s-4.03-7-9-7z"/>
                </svg>
              </button>
              <span style={{ fontSize:11, color:'#888', fontWeight:600 }}>카카오톡</span>
            </div>

            {/* 인스타 저장 */}
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:7 }}>
              <button onClick={shareInstagram} disabled={sharingInsta} title="인스타 스토리 저장"
                style={{ width:54, height:54, borderRadius:'50%', border:'none',
                  cursor: sharingInsta ? 'not-allowed' : 'pointer',
                  background: sharingInsta ? '#ccc' : 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  boxShadow:'0 2px 8px rgba(0,0,0,0.12)' }}>
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#fff" strokeWidth="2">
                  <rect x="2" y="2" width="20" height="20" rx="5"/>
                  <circle cx="12" cy="12" r="4"/>
                  <circle cx="17.5" cy="6.5" r="1.2" fill="#fff" stroke="none"/>
                </svg>
              </button>
              <span style={{ fontSize:11, color:'#888', fontWeight:600 }}>{sharingInsta ? '생성중' : '인스타'}</span>
            </div>

            {/* 이미지 저장 */}
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:7 }}>
              <button onClick={saveImage} disabled={savingImg} title="이미지 저장"
                style={{ width:54, height:54, borderRadius:'50%', border:'none',
                  cursor: savingImg ? 'not-allowed' : 'pointer',
                  background: savingImg ? '#ccc' : '#1A1A1A',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  boxShadow:'0 2px 8px rgba(0,0,0,0.12)' }}>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </button>
              <span style={{ fontSize:11, color:'#888', fontWeight:600 }}>{savingImg ? '저장중' : '이미지 저장'}</span>
            </div>
          </div>
        </div>

        {/* 인스타 스토리 카드 (숨김 렌더링 — html-to-image 캡처용) */}
        {/* overflow:hidden 래퍼로 off-screen 처리 → flex 미사용, block 레이아웃으로 캔버스 렌더 안정화 */}
        <div style={{ position:'fixed', top:0, left:0, width:0, height:0, overflow:'hidden', pointerEvents:'none' }} aria-hidden="true">
          <div ref={storyCardRef} style={{
            width: 360, height: 640,
            background: res.bg,
            position: 'relative',
            overflow: 'hidden',
            boxSizing: 'border-box',
            textAlign: 'center',
            fontFamily: "'-apple-system','Helvetica Neue','Apple SD Gothic Neo',sans-serif",
          }}>
            {/* 상단 브랜드 */}
            <div style={{ paddingTop:30, marginBottom:26 }}>
              <span style={{ fontSize:10, letterSpacing:3, color:res.color, fontWeight:800, opacity:0.75 }}>
                DELI&apos;O LIFESTYLE
              </span>
            </div>

            {/* 메인 이모지 */}
            <div style={{ fontSize:80, lineHeight:'1', marginBottom:14 }}>{res.emoji}</div>

            {/* 유형명 */}
            <div style={{ fontSize:52, fontWeight:900, color:res.color, lineHeight:'1.1', marginBottom:10, letterSpacing:-1 }}>
              {res.name}
            </div>

            {/* 태그라인 */}
            <div style={{ fontSize:12, color:'#555', fontWeight:600, lineHeight:'1.65', marginBottom:24, padding:'0 36px' }}>
              {res.tagline}
            </div>

            {/* 구분선 */}
            <div style={{ width:40, height:2, background:res.color, margin:'0 auto 24px', opacity:0.4, borderRadius:2 }} />

            {/* 축 배지 */}
            <div style={{ marginBottom:24, padding:'0 20px', lineHeight:'2' }}>
              {[
                result!.axis1 === 'routine' ? '루틴형' : '자유형',
                result!.axis2 === 'care'    ? '케어형' : '자기충전형',
                result!.axis3 === 'vitamin' ? '비타민형' : '힐링형',
              ].map(tag => (
                <span key={tag} style={{
                  display:'inline-block', marginRight:6, marginBottom:6,
                  fontSize:11, fontWeight:700,
                  background:'rgba(255,255,255,0.8)', color:res.color,
                  padding:'4px 13px', borderRadius:20,
                  border:`1.5px solid ${res.color}`,
                }}>
                  {tag}
                </span>
              ))}
            </div>

            {/* 웰니스 한마디 */}
            <div style={{ fontSize:13, fontStyle:'italic', color:res.color, fontWeight:700, lineHeight:'1.7', padding:'0 32px' }}>
              {res.wellness}
            </div>

            {/* 하단 URL */}
            <div style={{ position:'absolute', bottom:22, left:0, right:0, fontSize:10, color:'#BBB', letterSpacing:1 }}>
              delio.co.kr/survey
            </div>
          </div>
        </div>

        {/* 홈으로 가기 + 재검사 */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
          <Link href="/"
            style={{ width:'100%', maxWidth:320, textAlign:'center', padding:'13px 28px', border:'none', borderRadius:10, background:'#1A1A1A', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', textDecoration:'none' }}>
            홈으로 가기
          </Link>
          <button onClick={() => { setPhase('intro'); setStep(0); setAnswers({}); setResult(null); setInfo({ gender:'', age:'', family:'' }); }}
            style={{ padding:'11px 28px', border:'1.5px solid #DDDDD8', borderRadius:10, background:'#fff', color:'#888', fontSize:13, fontWeight:600, cursor:'pointer' }}>
            재검사하기
          </button>
        </div>
      </div>
    </div>
  );
}
