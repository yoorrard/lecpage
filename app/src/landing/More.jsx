import { useRef } from 'preact/hooks';
import { Mascot } from '../components/Mascot.jsx';
import { copy } from '../lib/util.js';
import { useInView } from './motion.js';
import { Why } from './Why.jsx';
import { Story } from './Story.jsx';
import { Showcase } from './Showcase.jsx';
import { Reach } from './Reach.jsx';
import { LiveDay } from './LiveDay.jsx';
import '../styles/landing-more.css';

// 첫 화면 아래 이야기: 왜 lecpage → 교재가 사이트가 되기까지 → 디자인 → 공개 → 연수 당일 → 연수 전·중·뒤 → 드는 돈 → 스킬 → 예시 → 마무리.
// 첫 화면(Home.jsx)이 그려진 다음 틈에 받는 묶음이라 첫 화면 JS·CSS에 들지 않아요. 구성과 근거: docs/research/landing-2026-11.md
// 설치 명령: Claude Code는 플러그인 한 줄(code.claude.com/docs/en/plugins/install), 그 밖의 도구는 skills CLI(github.com/vercel-labs/skills)
const SKILL_CMDS = [
  { for: 'Claude Code', cmd: '/plugin install lecpage --marketplace yoorrard/lecpage' },
  { for: 'Codex·Cursor·Gemini CLI 등', cmd: 'npx skills add yoorrard/lecpage' },
];
const EXAMPLES = [
  { id: 'data-lab', title: '데이터로 읽는 우리 반', kind: '디지털 연수 · 실습형 3시간', desc: '실습 5개, 도움 요청·진행 현황, 퀴즈, 만족도 조사', img: 'img/example-data-lab.webp' },
  { id: 'sel-story', title: '마음이 먼저 도착하는 교실', kind: '사회정서학습 연수 · 강의형 90분', desc: '핵심 메시지, 다섯 역량, 교재 보기, 투표·나눔 보드', img: 'img/example-sel-story.webp' },
];

/** 연수 전·중·뒤: 화면에 들어오면 선이 그려져요 */
function Days() {
  const box = useRef();
  const on = useInView(box, { margin: '-20% 0px', once: true });
  return (
    <section class={`ld-days${on ? ' is-on' : ''}`} ref={box} aria-labelledby="ld-days-h">
      <header class="ld-head">
        <h2 id="ld-days-h">연수 전부터 연수 뒤까지</h2>
        <p class="ld-sub">같은 주소가 연수 전에는 안내, 당일에는 참여, 끝난 뒤에는 다시 보기 자리가 돼요.</p>
      </header>
      <svg class="ld-days-line" viewBox="0 0 1200 48" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M4 30 C 140 6, 260 44, 400 24 S 660 4, 800 24 S 1060 44, 1196 18" /></svg>
      <ol class="ld-days-list">
        <li style={{ '--i': 0 }}><h3><span>전</span>연수 전</h3><ul><li>안내·일정·준비 점검</li><li>접속 확인 페이지</li><li>QR 안내문 인쇄</li></ul></li>
        <li style={{ '--i': 1 }}><h3><span>중</span>연수 중</h3><ul><li>교재 보기·강사 따라 넘기기</li><li>실습 단계·프롬프트 복사·완료 체크</li><li>질문·투표·나눔 보드·퀴즈</li></ul></li>
        <li style={{ '--i': 2 }}><h3><span>뒤</span>연수 뒤</h3><ul><li>다시 보기·자료실</li><li>만족도 조사·나의 기록 내려받기</li><li>이수자 명단 CSV</li></ul></li>
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
      <Showcase />
      <Reach />
      <LiveDay />
      <Days />

      <section class="ld-cost" aria-labelledby="ld-cost-h">
        <header class="ld-head">
          <h2 id="ld-cost-h">lecpage에 내는 돈은 없어요</h2>
        </header>
        <dl class="ld-cost-list">
          <div><dt>lecpage</dt><dd><b>0원</b><span>회원가입이 없어요. 교재 읽기부터 사이트 조립까지 이 브라우저 안에서 해요.</span></dd></div>
          <div><dt>AI</dt><dd><b>쓰던 챗봇이면 0원</b><span>쓰던 ChatGPT·Claude·Gemini 창으로 만들면 추가 비용이 없어요. API 키를 연결하면 버튼 한 번으로 만들고, 사이트 하나에 몇백 원쯤 그 회사에 직접 내요. AI는 내용을 짤 때 한 번만 쓰고, 디자인·공개·참여 기능에는 쓰지 않아요.</span></dd></div>
          <div><dt>공개·참여 기능</dt><dd><b>강사님 계정의 무료 한도 안에서</b><span>사이트는 Vercel·GitHub Pages 같은 강사님 계정에 올리고, 참여 기능은 Cloudflare·구글 시트 같은 강사님 계정에 연결해요. 올릴 곳과 내 서버(Cloudflare)는 한 번 연결하면 같은 기기의 다음 연수부터 저절로 이어져요.</span></dd></div>
        </dl>
      </section>

      <section class="ld-skill" aria-labelledby="ld-skill-h">
        <div>
          <p class="ld-kicker">Agent Skill</p>
          <h2 id="ld-skill-h">AI 에이전트에서 만들고, 앱에서 이어서</h2>
          <p class="ld-sub">Claude Code·Codex·Cursor·Gemini CLI 같은 AI 에이전트에 lecpage 스킬을 한 줄로 넣으면, 쓰던 구독 그대로 같은 엔진으로 만들어요. 만든 연수는 .lecpage 파일 하나로 이 앱에서 열어 다듬고 공개해요.</p>
        </div>
        <div class="ld-cmds">
          {SKILL_CMDS.map((c) => (
            <div class="ld-cmd">
              <span class="ld-cmd-for">{c.for}</span>
              <code>{c.cmd.split(' ').map((t, i) => <>{i ? ' ' : ''}<span>{t}</span></>)}</code>
              <button type="button" class="btn btn-sm" aria-label={`${c.for} 설치 명령 복사`} onClick={() => copy(c.cmd, '명령을 복사했어요.')}>복사</button>
            </div>
          ))}
          <a class="ld-cmd-help" href="#/help/skill">AI 도구에서 쓰는 법</a>
        </div>
      </section>

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
