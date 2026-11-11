// AI 키 만드는 법(앱 안 안내와 도움말이 함께 씀). 버튼 이름은 각 사이트 화면에 나오는 그대로(영문) 적습니다. 2026-11 기준.
const A = ({ href, children }) => <a href={href} target="_blank" rel="noopener">{children}</a>;

export const KEY_GUIDES = {
  gemini: {
    title: 'Google Gemini',
    tag: '무료',
    steps: [
      <><A href="https://aistudio.google.com/apikey">Google AI Studio</A>를 열고 개인 구글 계정으로 로그인해요. 처음이면 약관에 동의해요.</>,
      <>처음 쓰는 계정이면 키가 하나 만들어져 있어요. 없으면 <b>Create API key</b>를 눌러요.</>,
      <>키(<span class="mono">AQ.</span> 또는 <span class="mono">AIza</span>로 시작)를 복사해 붙여 넣어요.</>,
    ],
    notes: ['만 18세 이상 개인 계정만 돼요. 학교 계정은 관리자가 막아 둔 경우가 많아요.', '무료 등급은 Gemini 3.8 Flash까지 쓸 수 있고(Gemini 4는 결제를 등록한 키만), 하루 횟수는 한국 시간 오후 5시쯤 다시 채워져요. 넣은 내용이 구글 제품 개선에 쓰일 수 있어요.'],
  },
  openrouter: {
    title: 'OpenRouter',
    tag: '무료 모델 있음',
    steps: [
      <><A href="https://openrouter.ai/settings/keys">OpenRouter</A>에 로그인해요(구글 계정 가능).</>,
      <><b>Create API Key</b>를 누르고 이름을 적은 뒤 <b>Create</b>를 눌러요.</>,
      <><span class="mono">sk-or-v1-</span>로 시작하는 키를 복사해 붙여 넣어요.</>,
    ],
    notes: ['키를 만들지 않아도 위의 [OpenRouter로 로그인]을 누르면 바로 연결돼요.', '무료 모델은 하루 50번까지예요. 10달러 이상 충전하면 하루 1,000번으로 늘어요.'],
  },
  openai: {
    title: 'OpenAI',
    tag: '유료',
    steps: [
      <><A href="https://platform.openai.com/api-keys">OpenAI Platform</A>에 로그인해요. ChatGPT 계정 그대로 돼요.</>,
      <><b>Settings → Billing</b>에서 카드를 등록하고 크레딧을 충전해요(최소 5달러).</>,
      <><b>API keys</b>에서 <b>Create new secret key</b> → <b>Create secret key</b>를 눌러요.</>,
      <><span class="mono">sk-proj-</span>로 시작하는 키를 복사해 붙여 넣어요. 창을 닫으면 다시 볼 수 없어요.</>,
    ],
    notes: ['ChatGPT Plus 구독과는 따로 결제해요.'],
  },
  anthropic: {
    title: 'Anthropic Claude',
    tag: '유료',
    steps: [
      <><A href="https://platform.claude.com/settings/keys">Claude Console</A>에 로그인해요.</>,
      <><b>Settings → Billing</b>에서 크레딧을 충전해요(최소 5달러).</>,
      <><b>API keys</b>에서 <b>Create Key</b>를 누르고 이름을 적은 뒤 <b>Add</b>를 눌러요.</>,
      <><span class="mono">sk-ant-</span>로 시작하는 키를 복사해 붙여 넣어요. 창을 닫으면 다시 볼 수 없어요.</>,
    ],
    notes: ['Claude Pro·Max 구독과는 따로 결제해요.'],
  },
};
export const GUIDE_ORDER = ['gemini', 'openrouter', 'openai', 'anthropic'];

export function KeyGuide({ id }) {
  const g = KEY_GUIDES[id];
  return (
    <div class="guide">
      <ol class="guide-steps">{g.steps.map((s) => <li>{s}</li>)}</ol>
      {g.notes.map((n) => <p class="small muted">{n}</p>)}
    </div>
  );
}

/** 회사별 안내를 접어 둔 목록(열면 단계가 보임) */
export function KeyGuides({ open = '' }) {
  return (
    <div class="guides">
      {GUIDE_ORDER.map((id) => (
        <details open={open === id}>
          <summary><b>{KEY_GUIDES[id].title}</b> <span class="small muted">{KEY_GUIDES[id].tag}</span></summary>
          <KeyGuide id={id} />
        </details>
      ))}
    </div>
  );
}
