import { PRESET_COUNT, LAYOUT_COUNT } from './facts.js';
import { Bench } from './Bench.jsx';

/**
 * 왜 lecpage: 어떤 AI로 만들든 마무리는 한 곳(구조 한 장) + 그냥 AI에게 맡길 때와 다른 점 넷(수치 하나씩) + 재어 본 값(benchmark.json).
 * 수치는 모두 잰 값이고 조건을 함께 적어요. 재는 방법: docs/research/benchmark-2026-11.md, 여정 수치는 docs/research/ux-journey-2026-11.md 6장.
 * 디자인·배치 수는 빌드 때 엔진에서 읽어요(facts.js). 움직임 없음.
 */
const SOURCES = [
  ['쓰던 ChatGPT·Claude·Gemini 창', '복사해 붙여 넣기 · 추가 비용 없음'],
  ['API 키 연결', '버튼 한 번 · 사이트 하나에 몇백 원쯤'],
  ['AI 에이전트 + lecpage 스킬', 'Claude Code·Codex 등 · .lecpage 파일로 이어서'],
];
const STAGES = ['다듬기', '공개·QR', '연수 당일', '연수 뒤'];

export function Why() {
  const points = [
    {
      h: '기획부터 공개까지 한 곳에서, 처음이어도 쉽게',
      n: '24', u: '번',
      cap: '첫 연수에 교재 넣기부터 연수 뒤 명단까지 앱에서 누르는 횟수',
      p: '컨셉·디자인·공개·QR·참여 기능·안내물을 한 흐름으로 이어 해요. 같은 기기에서 다음 연수부터는 공개·참여 기능 준비가 0번이에요.',
    },
    {
      h: 'AI 티 없이, 강의 주제에 맞춘 디자인',
      n: String(PRESET_COUNT), u: '가지',
      cap: `디자인 ${PRESET_COUNT}가지 · 본문 배치 ${LAYOUT_COUNT}가지`,
      p: '주제에서 컨셉을 먼저 세우고 그에 맞는 디자인을 골라요. 글자 대비 4.5:1 이상·휴대폰·어두운 화면·겹침을 936조합 검사해 문제 0건이에요.',
    },
    {
      h: '작업 시간과 토큰을 줄여요',
      n: '1/127', u: '',
      cap: 'AI 에이전트에 그냥 맡길 때와 견준 AI 비용(토큰 단가 환산)',
      p: 'AI는 교재로 내용을 짤 때 한 번만 불러요(약 1.3만 토큰). 디자인·공개·참여 기능·안내물·CSV는 AI 없이 해요.',
    },
    {
      h: '강의 운영에 맞춘 기능',
      n: '1', u: '번',
      cap: '연수 뒤 명단·설문 CSV 받기(강사 화면 버튼)',
      p: '질문·투표·나눔 보드·도움 요청이 사이트 안에 있어 참가자가 밖으로 나가지 않아요. 공개한 뒤 고치면 [바뀐 내용 다시 올리기] 한 번이에요.',
    },
  ];
  return (
    <section class="ld-why" aria-labelledby="ld-why-h">
      <header class="ld-head">
        <p class="ld-kicker">왜 lecpage인가요</p>
        <h2 id="ld-why-h">어떤 AI로 만들든,<br />마무리는 한 곳에서</h2>
        <p class="ld-sub">학교·기업·공공기관·학원 어디서 하는 강의든 써요. 내용은 쓰던 AI가 짜고, 다듬기·공개·연수 당일·연수 뒤는 lecpage가 이어서 해요.</p>
      </header>

      <div class="ld-hub">
        <ul class="ld-hub-src" aria-label="AI를 쓰는 세 가지 길">
          {SOURCES.map(([a, b]) => <li><b>{a}</b><small>{b}</small></li>)}
        </ul>
        <svg class="ld-hub-line" viewBox="0 0 100 90" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 15 C 55 15, 45 45, 100 45" /><path d="M0 45 H 100" /><path d="M0 75 C 55 75, 45 45, 100 45" />
        </svg>
        <div class="ld-hub-to">
          <b class="ld-hub-name">lecpage</b>
          <ol aria-label="lecpage에서 이어 하는 일">{STAGES.map((s) => <li>{s}</li>)}</ol>
        </div>
      </div>

      <h3 class="ld-why-h3">그냥 AI에게 맡길 때와 다른 점</h3>
      <ol class="ld-pts">
        {points.map((x) => (
          <li>
            <h4>{x.h}</h4>
            <p class="ld-pt-num"><b>{x.n}<span>{x.u}</span></b><small>{x.cap}</small></p>
            <p class="ld-pt-p">{x.p}</p>
          </li>
        ))}
      </ol>
      <Bench />
    </section>
  );
}
