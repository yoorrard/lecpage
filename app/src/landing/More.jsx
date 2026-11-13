import { Mascot } from '../components/Mascot.jsx';
import { Why } from './Why.jsx';
import { Story } from './Story.jsx';
import { SayDemo } from './SayDemo.jsx';
import { Showcase } from './Showcase.jsx';
import { Reach } from './Reach.jsx';
import { LiveDay } from './LiveDay.jsx';
import { Paths } from './Paths.jsx';
import '../styles/landing-more.css';

// 첫 화면 아래 이야기: 왜 lecpage(한 문장·두 사이트 견주기·다른 점 넷) → 교재가 사이트가 되기까지 → 말로 고치기 → 디자인 → 공개 → 연수 당일 → 연수 전·중·후 → 쓰던 AI 그대로(0원·스킬) → 예시 → 마무리.
// 첫 화면(Home.jsx)이 그려진 다음 틈에 받는 묶음이라 첫 화면 JS·CSS에 들지 않아요. 구성과 근거: docs/research/landing-2026-11.md
const EXAMPLES = [
  { id: 'data-lab', title: '데이터로 읽는 우리 반', kind: '디지털 연수 · 실습형 3시간', desc: '실습 5개, 도움 요청·진행 현황, 퀴즈, 만족도 조사', img: 'img/example-data-lab.webp' },
  { id: 'sel-story', title: '마음이 먼저 도착하는 교실', kind: '사회정서학습 연수 · 강의형 90분', desc: '핵심 메시지, 다섯 역량, 교재 보기, 투표·나눔 보드', img: 'img/example-sel-story.webp' },
];
const DAYS = [
  ['전', '연수 전', ['안내·일정·준비물 점검', '접속 확인 페이지', 'QR 안내문 인쇄']],
  ['중', '연수 중', ['교재 보기, 강사 따라 넘기기', '실습 단계·프롬프트 복사·완료 표시', '질문·투표·나눔 보드·퀴즈']],
  ['후', '연수 후', ['다시 보기·자료실', '만족도 조사·나의 기록 내려받기', '이수자 명단 CSV']],
];

/** 연수 전·중·후: 스크롤하면 세 때를 잇는 선이 그려져요(지원하지 않거나 동작 줄이기면 다 그린 선) */
function Days() {
  return (
    <section class="ld-days" aria-labelledby="ld-days-h">
      <header class="ld-head">
        <h2 id="ld-days-h">연수 전부터 연수 후까지<br />주소 하나로</h2>
        <p class="ld-sub">같은 주소가 연수 전에는 안내, 당일에는 참여, 끝난 뒤에는 다시 보기 자리가 돼요.</p>
      </header>
      <svg class="ld-days-line" viewBox="0 0 1200 48" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M4 30 C 140 6, 260 44, 400 24 S 660 4, 800 24 S 1060 44, 1196 18" /></svg>
      <ol class="ld-days-list">
        {DAYS.map(([k, h, items]) => <li><h3><span aria-hidden="true">{k}</span>{h}</h3><ul>{items.map((t) => <li>{t}</li>)}</ul></li>)}
      </ol>
    </section>
  );
}

/** pick: 교재 고르기 창 열기, busyProps·fromExample: 예시로 시작(두 번 눌러도 한 번만, Home) */
export function More({ pick, busyProps, fromExample }) {
  return (
    <>
      <Why />
      <Story />
      <SayDemo />
      <Showcase />
      <Reach />
      <LiveDay />
      <Days />
      <Paths />

      <section class="ld-ex" aria-labelledby="ld-ex-h">
        <div class="section-title"><h2 id="ld-ex-h">예시로 시작하기</h2><p class="muted">마음에 들면 그대로 고쳐 쓰세요.</p></div>
        <div class="grid grid-fill">
          {EXAMPLES.map((x) => (
            <article class="ex-card">
              <a class="ex-img" href={`examples/${x.id}/index.html`} target="_blank" rel="noopener" aria-label={`${x.title} 예시 사이트 새 창으로 보기`}><img src={x.img} alt="" loading="lazy" width="640" height="400" onError={(e) => { e.currentTarget.style.display = 'none'; }} /></a>
              <div class="ex-body">
                <span class="tag tag-lav">{x.kind}</span>
                <h3>{x.title}</h3>
                <p class="small muted">{x.desc}</p>
                <div class="btn-row"><button class="btn btn-sm btn-primary" {...busyProps(`ex-${x.id}`)} onClick={() => fromExample(x.id)}>이 예시로 시작</button><a class="btn btn-sm" href={`examples/${x.id}/index.html`} target="_blank" rel="noopener">예시 보기</a></div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section class="ld-end" aria-labelledby="ld-end-h">
        <Mascot size={72} mood="happy" />
        <h2 id="ld-end-h">교재 하나면 시작할 수 있어요</h2>
        <div class="btn-row">
          <button type="button" class="btn btn-primary btn-lg" onClick={pick}>교재 넣고 시작하기</button>
          <a class="btn btn-lg" href="#/demo">먼저 체험해 보기</a>
          <a class="btn btn-quiet" href="#/help/start">도움말</a>
        </div>
      </section>
    </>
  );
}
