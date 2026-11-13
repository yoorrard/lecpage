import { copy } from '../lib/util.js';
import { SKILL_CMDS } from '../lib/agent.js';

/**
 * 쓰던 AI 그대로: AI를 쓰는 세 길이 lecpage 한 곳으로 모이는 그림(선은 스크롤하며 그려짐) + 드는 돈 + AI 에이전트 스킬 설치 명령.
 * 설치 명령은 lib/agent.js 한 곳(교재 넣기 화면의 AI 카드와 함께 씀)
 */
const PATHS = [
  { name: '쓰던 ChatGPT·Claude·Gemini 창', how: '요청 글을 복사해 붙여 넣어요', cost: '추가 비용 없음' },
  { name: 'API 키', how: '버튼 한 번으로 만들어요', cost: '사이트 하나에 몇백 원쯤, AI 회사에 직접' },
  { name: 'AI 에이전트 + lecpage 스킬', how: '만든 연수를 .lecpage 파일로 앱에서 열어요', cost: '쓰던 구독 그대로' },
];
const STAGES = ['디자인', '배포', '진행', '마무리'];

export function Paths() {
  return (
    <section class="ld-paths" aria-labelledby="ld-paths-h">
      <header class="ld-head">
        <h2 id="ld-paths-h">쓰던 AI 그대로,<br />lecpage는 0원</h2>
        <p class="ld-sub">회원가입도 요금도 없어요. 교재 읽기부터 사이트 조립까지 이 브라우저 안에서 해요. AI는 세 가지 중 편한 방법으로 연결해요.</p>
      </header>
      <div class="ld-hub">
        <ol class="ld-hub-src">
          {PATHS.map((p) => <li><b>{p.name}</b><span>{p.how}</span><small>{p.cost}</small></li>)}
        </ol>
        <svg class="ld-hub-line" viewBox="0 0 100 90" preserveAspectRatio="none" aria-hidden="true">
          <path pathLength="1" d="M0 15 C 55 15, 45 45, 100 45" /><path pathLength="1" d="M0 45 H 100" /><path pathLength="1" d="M0 75 C 55 75, 45 45, 100 45" />
        </svg>
        <div class="ld-hub-to">
          <b class="ld-hub-name">lecpage <span>0원</span></b>
          <ol aria-label="lecpage가 이어서 하는 일">{STAGES.map((s) => <li>{s}</li>)}</ol>
        </div>
      </div>
      <p class="ld-paths-note">배포와 참여 기능은 강사님 계정(Vercel·Cloudflare·구글 시트 등)의 무료 한도 안에서 돌아가요.</p>
      <div class="ld-skill">
        <div>
          <h3 class="ld-h3">AI 에이전트에서 쓰기</h3>
          <p>Claude Code·Codex·Cursor·Gemini CLI에 lecpage 스킬을 한 줄로 넣어요. 앱과 같은 엔진으로 만들고, 고치거나 배포할 때는 앱에서 이어서 해요.</p>
          <a class="ld-cmd-help" href="#/help/skill">AI 에이전트에서 쓰는 법</a>
        </div>
        <div class="ld-cmds">
          {SKILL_CMDS.map((c) => (
            <div class="ld-cmd">
              <span class="ld-cmd-for">{c.for}</span>
              <code>{c.cmd.split(' ').map((t, i) => <>{i ? ' ' : ''}<span>{t}</span></>)}</code>
              <button type="button" class="btn btn-sm" aria-label={`${c.for} 설치 명령 복사`} onClick={() => copy(c.cmd, '명령을 복사했어요.')}>복사</button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
