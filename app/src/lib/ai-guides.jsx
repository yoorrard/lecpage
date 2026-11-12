// AI 키 만드는 법(앱 안 안내와 도움말이 함께 씀). 버튼 이름은 각 사이트 화면에 나오는 그대로(영문) 적습니다. 2026-11 기준.
// quick: 연결 창에 보이는 한 줄 · pic: 키 페이지에서 찾을 단추를 그린 작은 그림 · steps·notes: 도움말의 자세한 순서
const A = ({ href, children }) => <a href={href} target="_blank" rel="noopener">{children}</a>;

export const KEY_GUIDES = {
  gemini: {
    title: 'Google Gemini',
    tag: '무료',
    quick: <>새 창에서 <b>개인 구글 계정</b>으로 로그인하고 키를 복사해요. 키가 안 보이면 <b>Create API key</b>를 눌러요.</>,
    pic: { host: 'aistudio.google.com', button: 'Create API key', sample: 'AIza' },
    steps: [
      <><A href="https://aistudio.google.com/apikey">Google AI Studio</A>를 열고 개인 구글 계정으로 로그인해요. 처음이면 약관에 동의해요.</>,
      <>처음 쓰는 계정이면 키가 하나 만들어져 있어요. 없으면 <b>Create API key</b>를 눌러요.</>,
      <>키(<span class="mono">AQ.</span> 또는 <span class="mono">AIza</span>로 시작)를 복사해 붙여 넣어요.</>,
    ],
    notes: ['만 18세 이상 개인 계정만 돼요. 학교 계정은 관리자가 막아 둔 경우가 많아요.', '무료 키는 Gemini 3.8 Flash까지 쓸 수 있어요(Gemini 4는 결제를 등록한 키만). 하루 횟수는 한국 시간 오후 5시쯤 다시 채워지고, 넣은 내용이 구글 제품 개선에 쓰일 수 있어요.'],
  },
  openai: {
    title: 'OpenAI (ChatGPT)',
    tag: '유료',
    quick: <>새 창에서 로그인하고(ChatGPT 계정 그대로) <b>Create new secret key</b>로 키를 만들어 복사해요.</>,
    pic: { host: 'platform.openai.com', button: 'Create new secret key', sample: 'sk-proj-' },
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
    quick: <>새 창에서 로그인하고 <b>Create Key</b>로 키를 만들어 복사해요.</>,
    pic: { host: 'platform.claude.com', button: 'Create Key', sample: 'sk-ant-' },
    steps: [
      <><A href="https://platform.claude.com/settings/keys">Claude Console</A>에 로그인해요.</>,
      <><b>Settings → Billing</b>에서 크레딧을 충전해요(최소 5달러).</>,
      <><b>API keys</b>에서 <b>Create Key</b>를 누르고 이름을 적은 뒤 <b>Add</b>를 눌러요.</>,
      <><span class="mono">sk-ant-</span>로 시작하는 키를 복사해 붙여 넣어요. 창을 닫으면 다시 볼 수 없어요.</>,
    ],
    notes: ['Claude Pro·Max 구독과는 따로 결제해요.'],
  },
};
export const GUIDE_ORDER = ['gemini', 'openai', 'anthropic'];

/**
 * 키 페이지에서 찾을 것을 보여 주는 작은 그림: 주소, 키 만드는 단추, 키 옆의 복사 단추.
 * 실제 화면을 단순하게 그린 것이고, 같은 내용을 글로도 적으므로 화면 읽기 프로그램에는 숨깁니다.
 */
export function KeyPic({ id }) {
  const pic = KEY_GUIDES[id]?.pic; if (!pic) return null;
  const bw = Math.round(18 + pic.button.length * 5.1); // 단추 너비 어림
  return (
    <svg class="key-pic" viewBox="0 0 220 110" aria-hidden="true" focusable="false">
      <rect class="kp-win" x=".5" y=".5" width="219" height="109" rx="9" />
      <circle class="kp-dot" cx="13" cy="12" r="2.5" /><circle class="kp-dot" cx="22" cy="12" r="2.5" /><circle class="kp-dot" cx="31" cy="12" r="2.5" />
      <rect class="kp-bar" x="42" y="5" width="146" height="14" rx="7" />
      <text class="kp-host" x="50" y="15.4">{pic.host}</text>
      <path class="kp-line" d="M0 24.5H220" />
      <text class="kp-h" x="12" y="46">API keys</text>
      <rect class="kp-btn" x={208 - bw} y="33" width={bw} height="20" rx="5" />
      <text class="kp-btn-t" x={208 - bw / 2} y="46.4" text-anchor="middle">{pic.button}</text>
      <rect class="kp-key" x="12" y="61" width="196" height="28" rx="6" />
      <text class="kp-key-t" x="22" y="79">{pic.sample}••••••••</text>
      <circle class="kp-ring" cx="190" cy="75" r="12" />
      <rect class="kp-copy" x="187.5" y="69.5" width="8" height="9.5" rx="1.6" /><path class="kp-copy" d="M184.5 77.5v-5.2a1.6 1.6 0 0 1 1.6-1.6" />
      <text class="kp-tip" x="170" y="104.5" text-anchor="end">복사 단추</text>
      <path class="kp-arrow" d="M174 100.5h10q6 0 6-6v-6" />
    </svg>
  );
}

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
