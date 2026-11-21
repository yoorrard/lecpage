import { Mascot } from '../components/Mascot.jsx';
import { Why } from './Why.jsx';
import { Story } from './Story.jsx';
import { Reach } from './Reach.jsx';
import { LiveDay } from './LiveDay.jsx';
import { Paths } from './Paths.jsx';
import { REFERENCES as EXAMPLES, referenceFor } from '../data/references.js';
import '../styles/landing-more.css';

// 첫 화면 아래 이야기: 왜 lecpage(한 문장·같은 교재로 견준 실제 결과·단계마다 견주기) → 교재가 사이트가 되기까지(AI가 한 번에 사이트 전체, lecpage는 참여 기능·교재 대조) → 배포 → 연수 당일 → 연수 전·중·후 → 쓰던 AI 그대로(0원·연결 프로그램·스킬) → 참고 디자인 → 마무리.
// 첫 화면(Home.jsx)이 그려진 다음 틈에 받는 묶음이라 첫 화면 JS·CSS에 들지 않아요. 구성과 근거: docs/research/landing-2026-11.md
const DAYS = [
  ['전', '연수 전', ['안내·일정·준비물 점검', '접속 확인 페이지', 'QR 안내문 인쇄']],
  ['중', '연수 중', ['발표 화면에 교재 쪽, 강사 화면과 함께 넘기기', '실습 단계·프롬프트 복사·실습 타이머', '질문·투표·퀴즈·도움 요청·출석']],
  ['후', '연수 후', ['다시 보기·자료실', '만족도 조사·나의 기록 내려받기', '출석 명단 CSV']],
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
      <Reach />
      <LiveDay />
      <Days />
      <Paths />

      <section class="ld-ex" aria-labelledby="ld-ex-h">
        <div class="section-title"><h2 id="ld-ex-h">참고 디자인</h2><p class="muted">AI가 교재를 읽고 만든 강의 사이트 사례예요. 고르면 AI에게 그 분위기 설명만 건네고, 내 교재로 새로 만들어요. 고르지 않아도 돼요.</p></div>
        <div class="grid grid-fill">
          {EXAMPLES.map((x) => (
            <article class="ex-card">
              <a class="ex-img" href={`examples/${x.id}/index.html`} target="_blank" rel="noopener" aria-label={`${x.title} 사이트 새 창으로 보기`}><img src={x.img} alt="" loading="lazy" width="640" height="400" onError={(e) => { e.currentTarget.style.display = 'none'; }} /></a>
              <div class="ex-body">
                <span class="tag tag-lav">{x.kind}</span>
                <h3>{x.title}</h3>
                <p class="small muted">{x.mood}</p>
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
