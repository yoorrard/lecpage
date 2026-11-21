import { copy } from '../lib/util.js';
import { SKILL_CMDS } from '../lib/agent.js';

/**
 * 쓰던 AI 그대로: AI를 쓰는 세 길이 lecpage 한 곳으로 모이는 그림(선은 스크롤하며 그려짐) + 드는 돈 + 내 PC 연결 프로그램·AI 에이전트 스킬 명령.
 * 세 길의 순서는 앱의 추천 순서와 같아요: 내 PC의 Claude Code·Codex → Claude·GPT API 키 → 쓰던 AI(복사·붙여 넣기).
 * 스킬 설치 명령은 lib/agent.js 한 곳(교재 넣기 화면의 AI 카드와 함께 씀), 연결 프로그램 명령은 skills/lecpage/references/studio.md와 같아요.
 */
const PATHS = [
  { name: '내 PC의 Claude Code·Codex', how: '연결 프로그램을 켜고 앱에서 바로 만들어요', cost: '쓰던 구독 그대로', tag: '추천' },
  { name: 'Claude·GPT API 키', how: '키를 넣으면 앱이 교재를 AI에 바로 보내요', cost: '쓴 만큼 AI 회사에 직접' },
  { name: '쓰던 AI', how: '요청 글을 복사해 붙여 넣고 교재를 첨부해요', cost: '추가 비용 없음' },
];
const STAGES = ['참여 기능', '화면 살펴보기', '배포', '진행'];
const STUDIO_CMD = 'npx -y github:yoorrard/lecpage studio';

export function Paths() {
  return (
    <section class="ld-paths" aria-labelledby="ld-paths-h">
      <header class="ld-head">
        <h2 id="ld-paths-h">쓰던 AI 그대로,<br />lecpage는 0원</h2>
        <p class="ld-sub">회원가입도 요금도 없어요. 쪽 그림 그리기부터 검수·미리보기까지 이 브라우저 안에서 해요. AI는 세 가지 중 편한 방법으로 연결해요.</p>
      </header>
      <div class="ld-hub">
        <ol class="ld-hub-src">
          {PATHS.map((p) => <li><b>{p.name}{p.tag && <> <span class="tag tag-lav">{p.tag}</span></>}</b><span>{p.how}</span><small>{p.cost}</small></li>)}
        </ol>
        <svg class="ld-hub-line" viewBox="0 0 100 90" preserveAspectRatio="none" aria-hidden="true">
          <path pathLength="1" d="M0 15 C 55 15, 45 45, 100 45" /><path pathLength="1" d="M0 45 H 100" /><path pathLength="1" d="M0 75 C 55 75, 45 45, 100 45" />
        </svg>
        <div class="ld-hub-to">
          <b class="ld-hub-name">lecpage <span>0원</span></b>
          <ol aria-label="lecpage가 이어서 하는 일">{STAGES.map((s) => <li>{s}</li>)}</ol>
        </div>
      </div>
      <p class="ld-paths-note">바로 배포는 가입 없이 무료예요. 내 계정(Vercel·Cloudflare·구글 시트 등)에 배포하면 그 계정의 무료 한도 안에서 돌아가요.</p>
      <div class="ld-skill">
        <div>
          <h3 class="ld-h3">AI 에이전트에서 쓰기</h3>
          <p>내 PC에 Claude Code나 Codex가 있으면 연결 프로그램을 한 줄로 켜요. 앱에서 교재를 넣으면 AI 에이전트가 쓰던 구독으로 사이트를 만들어요(Node.js 필요).</p>
          <p>AI 에이전트에 lecpage 스킬을 넣어 대화창에서 만들 수도 있어요. 고치거나 배포할 때는 앱에서 이어서 해요.</p>
          <a class="ld-cmd-help" href="#/help/skill">AI 에이전트에서 쓰는 법</a>
        </div>
        <div class="ld-cmds">
          <div class="ld-cmd">
            <span class="ld-cmd-for">내 PC 연결 프로그램</span>
            <code>{STUDIO_CMD.split(' ').map((t, i) => <>{i ? ' ' : ''}<span>{t}</span></>)}</code>
            <button type="button" class="btn btn-sm" aria-label="연결 프로그램 명령 복사" onClick={() => copy(STUDIO_CMD, '명령을 복사했어요.')}>복사</button>
          </div>
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
