// 지금 망에서 앱이 쓰는 곳(AI 회사 API·올릴 곳 API·짧은 주소·글꼴 서버)이 열리는지 가볍게 확인합니다.
// - 필요할 때 그곳 하나만, 요청 한 번(본문을 거의 받지 않는 주소). 결과는 이 탭에 잠깐 기억(열림 10분, 막힘 3분 → 핫스팟으로 바꾸면 곧 다시 확인)
// - 진짜 서버가 CORS 머리글을 주는 곳은 cors로 물음: 학교 필터의 차단 화면(머리글 없음)을 '열림'으로 잘못 보지 않음
// - 키·교재·주소는 보내지 않음(인증 없는 요청이라 401·403이 와도 '닿음'으로 봄)
// 근거: docs/research/school-network-2026-11.md §4
const SPOTS = {
  'ai:openai': { name: 'OpenAI API', url: 'https://api.openai.com/v1/models', cors: true },
  'ai:anthropic': { name: 'Claude API', url: 'https://api.anthropic.com/v1/models', cors: false }, // 브라우저 허용 머리글 없이는 CORS 머리글을 주지 않음
  'ai:gemini': { name: 'Gemini API', url: 'https://generativelanguage.googleapis.com/v1beta/models', cors: true },
  'ai:openrouter': { name: 'OpenRouter', url: 'https://openrouter.ai/api/v1/models?limit=1', cors: true },
  'host:vercel': { name: 'Vercel', url: 'https://api.vercel.com/v2/user', cors: true },
  'host:github-pages': { name: 'GitHub', url: 'https://api.github.com/zen', cors: true },
  'host:netlify': { name: 'Netlify', url: 'https://api.netlify.com/api/v1/user', cors: true },
  'short:isgd': { name: 'is.gd', url: 'https://is.gd/create.php?format=json', cors: true },
  'font:google': { name: '구글 글꼴', url: 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR&text=%EA%B0%80', cors: true },
  'font:jsdelivr': { name: 'jsDelivr', url: 'https://cdn.jsdelivr.net/npm/pretendard@1.3.9/package.json', cors: true },
};
export const spotName = (id) => SPOTS[id]?.name || id;

const KEY = 'lecpage:net:';
const TTL = { ok: 10 * 60e3, blocked: 3 * 60e3 };
const inflight = new Map();
function remembered(id) {
  try { const v = JSON.parse(sessionStorage.getItem(KEY + id) || 'null'); if (v && Date.now() - v.at < (TTL[v.s] || 0)) return v.s; } catch { /* 저장소를 못 쓰면 다시 물음 */ }
  return '';
}
function remember(id, s) { try { sessionStorage.setItem(KEY + id, JSON.stringify({ s, at: Date.now() })); } catch { /* 이번에만 */ } }
if (typeof addEventListener === 'function') addEventListener('online', () => { try { Object.keys(sessionStorage).filter((k) => k.startsWith(KEY)).forEach((k) => sessionStorage.removeItem(k)); } catch { /* 없음 */ } });

/** 그곳에 닿는지 한 번 물음 → 'ok' | 'blocked' | 'offline'. url을 직접 줄 수도 있음({ url, cors }) */
export function probe({ url, cors = true, timeout = 6000 }) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve('offline');
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout);
  return fetch(url, { mode: cors ? 'cors' : 'no-cors', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal: ctl.signal })
    .then(() => 'ok', () => 'blocked') // 막힘·끊김·차단 화면(CORS 머리글 없음)·응답 없음(제한 시간) 모두 '닿지 않음'
    .finally(() => clearTimeout(t));
}

/** 이름표로 확인(같은 것을 동시에 물으면 한 번만) → 'ok' | 'blocked' | 'offline' | 'unknown'(모르는 이름) */
export function reach(id, { fresh = false } = {}) {
  const spot = SPOTS[id]; if (!spot) return Promise.resolve('unknown');
  const m = !fresh && remembered(id); if (m) return Promise.resolve(m);
  if (inflight.has(id)) return inflight.get(id);
  const p = probe(spot).then((s) => { if (s !== 'offline') remember(id, s); inflight.delete(id); return s; });
  inflight.set(id, p); return p;
}
/** 이미 확인한 결과만(물어보지 않음) */
export const known = (id) => remembered(id);
/** 다른 길로 바꾼 사실을 쉬운 한 줄로 */
export function netLine(id, to) { return `이 망에서 ${spotName(id)}에 닿지 않아 ${to}로 바꿨어요.`; }
