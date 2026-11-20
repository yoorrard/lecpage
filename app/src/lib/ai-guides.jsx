// AI 키 만드는 법(연결 창과 도움말이 함께 씀). 버튼 이름은 각 사이트 화면에 나오는 그대로(영문) 적습니다.
// 각 회사 공식 문서와 맞춰 본 날: 2026-11-14(자세한 근거·출처: docs/research/ai-facts-2026-11-14.md)
//  Gemini — ai.google.dev/gemini-api/docs/{models,pricing,rate-limits,api-key,billing,verification,troubleshoot-ai-studio,changelog}
//    · 새 계정은 무료 등급에서 시작하고, 약관에 동의하면 기본 프로젝트와 키가 저절로 만들어짐(결제 등록 없이 됨)
//    · 구글 클라우드를 쓰던 계정은 기본 키가 안 만들어져 프로젝트를 불러와야 하고, 그 프로젝트는 휴대폰 확인(QR)이나 결제가 필요할 수 있음
//    · 결제를 연결한 프로젝트는 선불(Prepay) 크레딧이 있어야 응답함(최소 5달러, 없으면 402). 무료 등급만 쓰는 계정은 할 일이 없음
//    · Gemini 4부터 이름이 Carbon·Argon·Hydrogen(Pro·Flash라는 이름 없음). 무료 등급: 4 Hydrogen(2026-11-12 출시)·3.8 Flash·3.6 Flash·Flash-Lite 등.
//      4 Carbon·Argon은 유료 등급만 · 넣은 내용이 제품 개선에 쓰임 · 하루 횟수는 태평양 시간 자정에 다시 채워짐(숫자는 공개하지 않고 AI Studio에서 봄) · 만 18세 이상
//  OpenAI — developers.openai.com/api/docs/{models,quickstart,guides/rate-limits,guides/error-codes,guides/chatgpt-api-credits}
//    · 키: platform.openai.com/api-keys · 결제: platform.openai.com/settings/organization/billing/overview(선불 크레딧, 5달러를 사면 Build 등급)
//    · ChatGPT Pro·Business 구독은 매달 API 크레딧(최대 500달러)을 받을 수 있음(무료·Go·Plus는 해당 없음, 2026-10-28부터)
//    · 확인하지 못함: 키 만드는 버튼 이름과 최소 충전 금액(도움말 센터가 자동 접속을 막음) → 버튼 이름은 괄호 안에만, 금액은 '5달러면 충분'으로 적음
//  Claude — platform.claude.com/docs/en/{get-api-key,manage-claude/authentication}, support.claude.com 'How do I pay for my API usage'
//    · 키: platform.claude.com/settings/keys의 Create key(이름·만료·Linked account·Workspace). sk-ant-로 시작하고 한 번만 보임
//    · 결제: platform.claude.com/settings/billing의 Buy credits(선불). Max·Ultra·Team 구독에는 매달 API 크레딧이 들어 있음(Pro는 해당 없음)
//    · Workspace를 고르지 않은 키는 요청마다 workspace id가 필요 → ai.js(withWorkspace)가 알아서 찾아 넣음
import { PROVIDERS } from './ai.js';

const P = PROVIDERS;
const ENOUGH = '5달러면 사이트를 열 개 넘게 만들어요.';

/**
 * label·tag: 고르는 버튼 · what: 무엇을 얻고 얼마가 드는지 한 줄
 * steps: 붙여넣기 앞까지의 걸음(연결 창에서는 한 번에 하나만 보임). url: 새 창으로 열 곳 · open: 버튼 글 · skip: 건너뛰는 글 · pic: 누를 곳 그림
 * tips: 잘 안 될 때(접어 둠)
 */
export const KEY_GUIDES = {
  openai: {
    title: 'GPT (OpenAI)', label: 'GPT', tag: '유료',
    what: '처음 한 번 결제 등록과 키 복사가 필요해요. 사이트 하나에 몇백 원쯤 들어요.',
    steps: [
      { id: 'pay', title: '크레딧 충전하기', url: P.openai.billingUrl, open: 'OpenAI 결제 페이지 열기', skip: '이미 충전했어요',
        text: <>ChatGPT 계정 그대로 로그인하고 크레딧을 충전해요. {ENOUGH}</>,
        pic: { host: 'platform.openai.com', head: 'Billing', row: 'balance', ring: 'button', tip: '충전 버튼' } },
      { id: 'key', title: '키 만들기', url: P.openai.keyUrl, open: 'OpenAI 키 페이지 열기', skip: '이미 복사했어요',
        text: <>키 만들기 버튼(<b>Create new secret key</b>)을 누르고, 나온 키를 복사해요. 키는 한 번만 보여요.</>,
        pic: { host: 'platform.openai.com', head: 'API keys', button: 'Create new secret key', row: 'key', ring: 'button', tip: '키 만들기' } },
    ],
    tips: [
      <>ChatGPT 무료·Plus 구독과는 따로 충전해요. Pro·Business 구독은 API 크레딧을 받을 수 있어요.</>,
      <>키를 복사하지 못하고 창을 닫았으면 새로 만들어요.</>,
    ],
    more: [],
  },
  anthropic: {
    title: 'Claude (Anthropic)', label: 'Claude', tag: '유료',
    what: '처음 한 번 결제 등록과 키 복사가 필요해요. 사이트 하나에 몇백 원쯤 들어요.',
    steps: [
      { id: 'pay', title: '크레딧 충전하기', url: P.anthropic.billingUrl, open: 'Claude 결제 페이지 열기', skip: '이미 충전했어요',
        text: <>Claude Console에 로그인하고 <b>Buy credits</b>로 충전해요. {ENOUGH}</>,
        pic: { host: 'platform.claude.com', head: 'Billing', button: 'Buy credits', row: 'balance', ring: 'button', tip: '충전 버튼' } },
      { id: 'key', title: '키 만들기', url: P.anthropic.keyUrl, open: 'Claude 키 페이지 열기', skip: '이미 복사했어요',
        text: <><b>Create key</b>를 누르고 이름을 적어 만든 뒤, 나온 키를 복사해요. 키는 한 번만 보여요.</>,
        pic: { host: 'platform.claude.com', head: 'API keys', button: 'Create key', row: 'key', ring: 'button', tip: '키 만들기' } },
    ],
    tips: [
      <>Claude Pro 구독과는 따로 충전해요. Max·Ultra·Team 구독에는 매달 API 크레딧이 들어 있어요.</>,
      <>만료(Expiration)를 정한 키는 그날이 지나면 새로 만들어야 해요.</>,
      <>키를 복사하지 못하고 창을 닫았으면 새로 만들어요.</>,
    ],
    more: [],
  },
};
// 두 회사를 같은 자리·같은 위계로(AI 고르기 화면의 카드 순서와 같게)
export const GUIDE_ORDER = ['openai', 'anthropic'];
export const GUIDE_MORE = [];

/**
 * 열린 페이지에서 누를 곳을 보여 주는 작은 그림(주소 · 제목 · 버튼 · 키나 잔액 한 줄). 동그라미가 누를 곳입니다.
 * 실제 화면을 단순하게 그린 것이고, 같은 내용을 글로도 적으므로 화면 읽기 프로그램에는 숨깁니다.
 */
export function KeyPic({ pic }) {
  if (!pic) return null;
  const bw = pic.button ? Math.round(20 + pic.button.length * 5.1) : 34; // 버튼 너비 어림
  const bx = 208 - bw; const onBtn = pic.ring === 'button';
  const ry = onBtn ? 82 : 60; // 키·잔액 줄의 위쪽
  return (
    <svg class="key-pic" viewBox="0 0 220 112" aria-hidden="true" focusable="false">
      <rect class="kp-win" x=".5" y=".5" width="219" height="111" rx="9" />
      <circle class="kp-dot" cx="13" cy="12" r="2.5" /><circle class="kp-dot" cx="22" cy="12" r="2.5" /><circle class="kp-dot" cx="31" cy="12" r="2.5" />
      <rect class="kp-bar" x="42" y="5" width="146" height="14" rx="7" />
      <text class="kp-host" x="50" y="15.4">{pic.host}</text>
      <path class="kp-line" d="M0 24.5H220" />
      <text class="kp-h" x="12" y="47">{pic.head}</text>
      {onBtn && <rect class="kp-ring" x={bx - 5} y="28" width={bw + 10} height="30" rx="10" />}
      <rect class="kp-btn" x={bx} y="33" width={bw} height="20" rx="5" />
      {pic.button ? <text class="kp-btn-t" x={bx + bw / 2} y="46.4" text-anchor="middle">{pic.button}</text> : <path class="kp-plus" d={`M${bx + bw / 2 - 5} 43h10M${bx + bw / 2} 38v10`} />}
      <rect class="kp-key" x="12" y={ry} width="196" height="22" rx="6" />
      {pic.row === 'balance' ? <><text class="kp-key-t" x="22" y={ry + 14.5}>Credit balance</text><text class="kp-key-t" x="198" y={ry + 14.5} text-anchor="end">$0.00</text></>
        : <><text class="kp-key-t" x="22" y={ry + 14.5}>••••••••••••••••</text>
          {!onBtn && <circle class="kp-ring" cx="190" cy={ry + 11} r="11" />}
          <rect class="kp-copy" x="186.5" y={ry + 6.5} width="7" height="8.5" rx="1.5" /><path class="kp-copy" d={`M184 ${ry + 13.5}v-4.6a1.5 1.5 0 0 1 1.5-1.5`} /></>}
      {onBtn ? <><path class="kp-arrow" d={`M${bx + bw / 2} 61v7M${bx + bw / 2 - 3.5} 64.5l3.5-3.5 3.5 3.5`} /><text class="kp-tip" x={bx + bw / 2} y="77.5" text-anchor="middle">{pic.tip}</text></>
        : <><text class="kp-tip" x="172" y="105" text-anchor="end">{pic.tip}</text><path class="kp-arrow" d="M176 101h8q6 0 6-6v-10" /></>}
    </svg>
  );
}

/** 도움말용: 한 회사의 순서 전체(그림 포함) */
export function KeyGuide({ id }) {
  const g = KEY_GUIDES[id];
  return (
    <div class="guide">
      <ol class="guide-steps">
        {g.steps.map((s) => <li><div class="guide-step"><div><b>{s.title}</b> <a href={s.url} target="_blank" rel="noopener">{s.open}</a><p>{s.text}</p></div><KeyPic pic={s.pic} /></div></li>)}
        <li><b>붙여넣기</b><p>lecpage로 돌아와 [붙여넣기]를 누르면 바로 연결돼요.</p></li>
      </ol>
      <ul class="guide-tips small">{[...g.tips, ...g.more].map((t) => <li>{t}</li>)}</ul>
    </div>
  );
}

/** 회사별 안내를 접어 둔 목록(열면 단계가 보임) */
export function KeyGuides({ open = '' }) {
  return (
    <div class="guides">
      {[...GUIDE_ORDER, ...GUIDE_MORE].map((id) => (
        <details open={open === id}>
          <summary><b>{KEY_GUIDES[id].title}</b> <span class="small muted">{KEY_GUIDES[id].tag}</span></summary>
          <KeyGuide id={id} />
        </details>
      ))}
    </div>
  );
}
