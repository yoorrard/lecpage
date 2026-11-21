import { Mascot } from '../components/Mascot.jsx';
import { Knowhow } from './Knowhow.jsx';
import { Story } from './Story.jsx';
import { LiveDay } from './LiveDay.jsx';
import { Connect } from './Connect.jsx';
import { Deploy } from './Deploy.jsx';
import { Showcase } from './Showcase.jsx';
import '../styles/landing-more.css';

// 첫 화면 아래 이야기(장마다 리듬이 달라요): 노하우(운영자 두 문장 · 세 가지) → 교재가 사이트가 되기까지(붙은 무대) → 강의 당일 세 화면(어두운 띠, 눌러 보는 예시)
// → 구독 계정 연결(선 그림) → 배포·QR → 참고 디자인(긴 그림 창) → 무료·오픈소스(큰 숫자) → 마무리.
// 첫 화면(Home.jsx)이 그려진 다음 틈에 받는 묶음이라 첫 화면 JS·CSS에 들지 않아요. 구성과 근거: docs/research/landing-2026-11.md 10장
const REPO = 'https://github.com/yoorrard/lecpage';
const FREE = [
  ['회원가입 없음', '이메일도 계정도 만들지 않고 바로 써요.'],
  ['AI는 쓰던 구독으로', 'AI 사용량은 연결한 ChatGPT·Claude 계정의 요금제에서 써요.'],
  ['코드는 모두 GitHub에', '엔진·웹앱·Skill 코드를 누구나 보고 고쳐 쓸 수 있어요(Apache-2.0·MIT-0). 만든 사이트는 만든 사람의 것이에요.'],
  ['교재는 내 브라우저에서', '쪽 그림과 미리보기는 이 브라우저에서 만들어요.'],
];

/** pick: 교재 고르기 창 열기, busyProps·fromExample: 참고 디자인으로 시작(두 번 눌러도 한 번만, Home) */
export function More({ pick, busyProps, fromExample }) {
  return (
    <>
      <Knowhow />
      <Story />
      <LiveDay />
      <Connect />
      <Deploy />
      <Showcase busyProps={busyProps} fromExample={fromExample} />

      <section class="ld-free" aria-labelledby="ld-free-h">
        <p class="ld-free-big" aria-hidden="true">0<small>원</small></p>
        <div class="ld-free-t">
          <h2 id="ld-free-h">lecpage는 무료이고 오픈소스예요</h2>
          <ul>{FREE.map(([h, p]) => <li><h3>{h}</h3><p>{p}</p></li>)}</ul>
          <p class="ld-free-link"><a href={REPO} target="_blank" rel="noopener">GitHub에서 코드 보기<span class="ld-sr"> (새 창)</span><span aria-hidden="true"> ↗</span></a><a href="#/help/license">오픈소스·라이선스</a></p>
        </div>
      </section>

      <section class="ld-end" aria-labelledby="ld-end-h">
        <Mascot size={76} mood="happy" />
        <h2 id="ld-end-h">교재 하나면 시작할 수 있어요</h2>
        <p>먼저 해보기는 예시 교재로 만들기부터 배포 연습까지 실제와 같은 화면으로 해 봐요. 키가 필요 없어요.</p>
        <div class="btn-row">
          <button type="button" class="btn btn-primary btn-lg" onClick={pick}>교재 넣고 시작하기</button>
          <a class="btn btn-lg" href="#/demo">먼저 해보기</a>
          <a class="btn btn-quiet" href="#/help/start">도움말</a>
        </div>
      </section>
    </>
  );
}
