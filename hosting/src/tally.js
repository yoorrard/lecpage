// 하루 단위 숫자 세기. 바깥 분석 도구·토큰 없이 Worker 안에서 세고, Gate(Durable Object)의 하루 한 줄에 더합니다.
// 요청마다 Gate를 부르면 그것도 요청이라, Worker(isolate)마다 모아 두었다가 50건이나 30초마다 한 번에 보냅니다.
// 그래서 숫자는 어림입니다(isolate가 사라지면 보내지 못한 몇십 건이 빠질 수 있음).
// 개인을 알아볼 수 있는 것(IP·식별자·주소·내용)은 세지도 저장하지도 않습니다.

/** Worker가 세는 것. req(전체)는 따로 */
export const WORKER_KEYS = ['site', 'api', 'live', 'admin', 'err', 'lim', 'edge', 'bot'];
/** Gate가 스스로 세는 것 */
export const GATE_KEYS = ['new', 'room', 'pub', 'rep'];

/** 앱이 보내는 익명 이용 합계: { e, k } → 저장 열쇠. 이 표에 없는 것은 버림 */
export const APP_EVENTS = {
  open: { '': 'a:open' },
  make: { key: 'a:make:key', chat: 'a:make:chat' },
  publish: { instant: 'a:pub:instant', vercel: 'a:pub:vercel', github: 'a:pub:github', netlify: 'a:pub:netlify', cloudflare: 'a:pub:cloudflare', zip: 'a:pub:zip' },
};
export const APP_KEYS = new Set(Object.values(APP_EVENTS).flatMap((m) => Object.values(m)));

/** 앱이 보낸 본문(글자, 200바이트 안) → 열쇠 하나 또는 '' */
export function appStatKey(text) {
  if (typeof text !== 'string' || !text || text.length > 200) return '';
  let j;
  try { j = JSON.parse(text); } catch { return ''; }
  if (!j || typeof j !== 'object' || Array.isArray(j)) return '';
  const m = Object.hasOwn(APP_EVENTS, j.e) ? APP_EVENTS[j.e] : null;
  const k = typeof j.k === 'string' ? j.k : '';
  return m && Object.hasOwn(m, k) ? m[k] : '';
}

export class Tally {
  constructor({ every = 50, ms = 30000 } = {}) {
    this.every = every; this.ms = ms;
    this.n = 0; this.c = {}; this.s = {}; this.at = Date.now();
  }
  /** 요청 하나(kind: WORKER_KEYS 중 하나) */
  hit(kind) { this.n++; if (kind) this.c[kind] = (this.c[kind] || 0) + 1; }
  /** 요청 수는 그대로 두고 갈래만 더함(err·lim·edge·bot) */
  mark(kind) { this.c[kind] = (this.c[kind] || 0) + 1; }
  stat(key) { if (APP_KEYS.has(key)) this.s[key] = (this.s[key] || 0) + 1; }
  /** 보낼 때가 됐으면 모은 것을 꺼내고 비움, 아니면 null */
  take(now = Date.now(), force = false) {
    if (!force && this.n < this.every && now - this.at < this.ms) return null;
    if (!this.n && !Object.keys(this.c).length && !Object.keys(this.s).length) { this.at = now; return null; }
    const out = { n: this.n, c: this.c, s: this.s };
    this.n = 0; this.c = {}; this.s = {}; this.at = now;
    return out;
  }
}

/** 같은 곳에서 1분에 limit번까지(메모리에서만, 저장하지 않음). 앱 이용 합계 부풀리기를 조금 어렵게 */
export class MinuteLimiter {
  constructor(limit = 20) { this.limit = limit; this.map = new Map(); this.minute = 0; }
  ok(who, now = Date.now()) {
    const m = Math.floor(now / 60000);
    if (m !== this.minute || this.map.size > 5000) { this.map.clear(); this.minute = m; }
    const n = (this.map.get(who) || 0) + 1;
    this.map.set(who, n);
    return n <= this.limit;
  }
}

/** 최근 days일 중 하루 예산의 share를 넘은 날 수 → 유료 전환을 권할지 한 줄 */
export function paidAdvice(days, budget, { share = 0.5, window = 7, need = 2 } = {}) {
  const recent = days.slice(-window);
  if (!budget) return { over: 0, of: recent.length, recommend: false, text: '유료 요금제(PLAN=paid)로 돌고 있어요. 하루 한도로 멈추지 않아요.' };
  const over = recent.filter((d) => (d.req || 0) >= budget * share).length;
  const peak = recent.reduce((m, d) => Math.max(m, d.req || 0), 0);
  const recommend = over >= need;
  const pct = Math.round((peak / budget) * 100);
  return {
    over, of: recent.length, peakPct: pct, recommend,
    text: recommend
      ? `최근 ${recent.length}일 중 ${over}일이 하루 예산의 ${Math.round(share * 100)}%를 넘었어요. Workers Paid(월 $5)로 올리면 사이트가 멈출 걱정이 없어요.`
      : `최근 ${recent.length}일 중 하루 예산의 ${Math.round(share * 100)}%를 넘은 날은 ${over}일이에요(가장 많은 날 ${pct}%). 아직 무료로 충분해요.`,
  };
}
