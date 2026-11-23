// Netlify 계정으로 연결(브라우저만으로, lecpage 커넥트 없이): Netlify가 공식 CLI에 쓰는 '티켓' 방식.
//   ① POST /oauth/tickets?client_id=…  → 티켓  ② 새 탭 app.netlify.com/authorize?response_type=ticket&ticket=… 에서 [Authorize]
//   ③ GET /oauth/tickets/{id}를 authorized까지 물음  ④ POST /oauth/tickets/{id}/exchange → access_token
// 토큰은 이 브라우저와 Netlify 사이에서만 오감(운영자 서버를 거치지 않음, 비밀 값 없음). 받은 토큰은 토큰 붙여넣기와 같은 곳(deploy-netlify)에 둠.
// client ID는 공개 값(운영자가 Netlify에 등록한 OAuth 앱 'lecpage'). 따로 운영하는 곳은 VITE_NETLIFY_CLIENT_ID로 바꾸고, 빈 값이면 이 길을 감추고 토큰 길만 보임.
// 실측(2026-11-23): 티켓 만들기 201 { id, authorized: null }, 승인 전 exchange는 401, 없는 티켓은 404. API는 CORS *
const NF = 'https://api.netlify.com/api/v1';
const DEFAULT_ID = 'seQ-oQamRXSn4C7RQG2EOYsG8yqtabJi2SS-PK63WQQ';
export const NETLIFY_CLIENT_ID = String(import.meta.env?.VITE_NETLIFY_CLIENT_ID ?? DEFAULT_ID).trim();
/** 이 앱에서 Netlify 로그인 한 번 길을 쓸 수 있는지 */
export const netlifyLoginOn = () => /^[A-Za-z0-9_-]{20,}$/.test(NETLIFY_CLIENT_ID);
export const netlifyAuthUrl = (ticket) => `https://app.netlify.com/authorize?response_type=ticket&ticket=${encodeURIComponent(ticket)}`;
export const NETLIFY_LOGIN_OK = (u) => /^https:\/\/app\.netlify\.com\/authorize\?/.test(u || '');

export const NF_PHASE = {
  tool: 'Netlify 로그인을 준비하는 중…',
  login: '새 창에서 Netlify에 로그인하고 [Authorize]를 눌러 주세요.',
  exchange: 'Netlify 연결을 마무리하는 중…',
};
const WAIT_MS = 10 * 60e3;

class LoginError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const sleep = (ms, signal) => new Promise((ok) => { const t = setTimeout(ok, ms); signal?.addEventListener('abort', () => { clearTimeout(t); ok(); }, { once: true }); });
async function call(method, path, signal) {
  let r;
  try { r = await fetch(NF + path, { method, signal }); }
  catch (e) { if (signal?.aborted) throw new LoginError('cancelled', '멈췄어요.'); throw new LoginError('network', 'Netlify에 닿지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요. 기관·회사 망이 막았다면 휴대폰 핫스팟으로 바꿔 보세요.'); }
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ok: r.ok, j };
}

/**
 * 로그인 한 번: 티켓 → 새 창에서 [Authorize] → 토큰. 반환: access_token(글).
 * win: 버튼을 누른 그 순간 열어 둔 창(팝업 차단을 피하려고 먼저 열고 주소를 나중에 넣음). 막혔으면 null → 화면의 [로그인 창 열기] 링크로
 * onView({ running, phase, seconds, loginUrl }) · signal: [중지]
 * 실패 코드: cancelled · network · denied(Netlify에서 거절) · timeout · failed
 */
export async function netlifyLogin({ win = null, onView, signal, waitMs = WAIT_MS, every = 1500 } = {}) {
  const t0 = Date.now();
  const view = (phase, more = {}) => onView?.({ running: true, phase, seconds: Math.round((Date.now() - t0) / 1000), ...more });
  const shut = () => { try { win?.close(); } catch { /* 이미 닫힘 */ } };
  try {
    view('tool');
    const made = await call('POST', `/oauth/tickets?client_id=${encodeURIComponent(NETLIFY_CLIENT_ID)}`, signal);
    const id = String(made.j?.id || '');
    if (!made.ok || !/^[A-Za-z0-9_-]{8,}$/.test(id)) throw new LoginError('failed', 'Netlify 로그인을 시작하지 못했어요. 잠시 뒤 다시 시도하거나 아래 다른 방법으로 연결해 주세요.');
    const loginUrl = netlifyAuthUrl(id);
    try { if (win && !win.closed) win.location.replace(loginUrl); } catch { /* 창을 못 쓰면 화면의 링크로 */ }
    for (;;) {
      if (signal?.aborted) throw new LoginError('cancelled', '멈췄어요.');
      if (Date.now() - t0 > waitMs) throw new LoginError('timeout', '기다리는 시간이 지났어요. 다시 눌러 주세요.');
      view('login', { loginUrl });
      await sleep(every, signal);
      if (signal?.aborted) throw new LoginError('cancelled', '멈췄어요.');
      const s = await call('GET', `/oauth/tickets/${id}`, signal);
      if (s.status === 404 || s.status === 401) throw new LoginError('denied', 'Netlify에서 연결을 허용하지 않았거나 기다리는 시간이 지났어요. 다시 눌러 주세요.');
      if (s.j?.authorized === true) break;
      if (s.j?.authorized === false) throw new LoginError('denied', 'Netlify에서 연결을 허용하지 않았어요. 다시 누르고 [Authorize]를 눌러 주세요.');
    }
    view('exchange');
    const x = await call('POST', `/oauth/tickets/${id}/exchange`, signal);
    const token = String(x.j?.access_token || '');
    if (!x.ok || !token) throw new LoginError('failed', 'Netlify 연결을 마무리하지 못했어요. 다시 눌러 주세요.');
    shut();
    return token;
  } catch (e) {
    shut();
    throw e instanceof LoginError ? e : new LoginError('failed', 'Netlify 로그인을 끝내지 못했어요. 다시 눌러 주세요.');
  }
}
