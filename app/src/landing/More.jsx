import { Mascot } from '../components/Mascot.jsx';
import { Why } from './Why.jsx';
import { Story } from './Story.jsx';
import { SayDemo } from './SayDemo.jsx';
import { Showcase } from './Showcase.jsx';
import { Reach } from './Reach.jsx';
import { LiveDay } from './LiveDay.jsx';
import { Paths } from './Paths.jsx';
import { REFERENCES as EXAMPLES, referenceFor } from '../data/references.js';
import '../styles/landing-more.css';

// 첫 화면 아래 이야기: 왜 lecpage(한 문장·두 사이트 견주기·다른 점 넷) → 교재가 사이트가 되기까지 → 말로 고치기 → 디자인 → 배포 → 연수 당일 → 연수 전·중·후 → 쓰던 AI 그대로(0원·스킬) → 예시 → 마무리.
// 첫 화면(Home.jsx)이 그려진 다음 틈에 받는 묶음이라 첫 화면 JS·CSS에 들지 않아요. 구성과 근거: docs/research/landing-2026-11.md
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

/** pick: 교재 고르기 창 열기, busyProps·fromExample: 참고 디자인으로 시작(두 번 눌러도 한 번만, Home) */
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
        <div class="section-title"><h2 id="ld-ex-h">참고 디자인</h2><p class="muted">완성된 강의 사이트 사례예요. 고르면 AI가 분위기를 참고해 내 교재로 새로 만들어요. 고르지 않아도 돼요.</p></div>
        <div class="grid grid-fill">
          {EXAMPLES.map((x) => (
            <article class="ex-card">
              <a class="ex-img" href={`examples/${x.id}/index.html`} target="_blank" rel="noopener" aria-label={`${x.title} 사이트 새 창으로 보기`}><img src={x.img} alt="" loading="lazy" width="640" height="400" onError={(e) => { e.currentTarget.style.display = 'none'; }} /></a>
              <div class="ex-body">
                <span class="tag tag-lav">{x.kind}</span>
                <h3>{x.title}</h3>
                <p class="small muted">{x.desc}</p>
                <div class="btn-row"><button class="btn btn-sm btn-primary" {...busyProps(`ex-${x.id}`)} onClick={() => fromExample(referenceFor(x))}>이 디자인 참고해 만들기</button><a class="btn btn-sm" href={`examples/${x.id}/index.html`} target="_blank" rel="noopener">사이트 보기</a></div>
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
          <a class="btn btn-lg" href="#/demo">먼저 해보기</a>
          <a class="btn btn-quiet" href="#/help/start">도움말</a>
        </div>
      </section>
    </>
  );
}
