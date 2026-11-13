// 실시간 방을 이 호스트에 얹는 데 필요한 판단들(Worker 없이도 시험할 수 있게 따로 둠).
// 방의 규칙·저장은 skills/lecpage/backends/cloudflare/src 의 코드를 그대로 씁니다.
import { HttpError as LiveError, normCode, sha256hex } from '../../../skills/lecpage/backends/cloudflare/src/protocol.js';
import { HttpError } from '../http.js';

export { LiveError, normCode };

/** 방 주소는 /live 아래. 사이트는 live.url = "<출처>/live" 로 부름 → /live/api/<코드>/… */
export const LIVE_PREFIX = '/live';
/** 보드 파일은 규칙상 '/api/<코드>/files/<이름>'으로 적히고 화면이 출처 맨 위 기준으로 엽니다. 그래서 이 주소만 /live 없이도 받습니다. */
export const FILE_ALIAS = /^\/api\/([A-Z0-9][A-Z0-9_-]{2,39})\/files\/([a-f0-9]{24}\.(?:png|jpg|gif|webp|pdf|mp3|mp4))$/;
/** 밖에서 부를 수 없는 방 주소. 방 등록은 POST /api/sites/:id/live 로만 합니다. */
const CLOSED_OPS = new Set(['init']);

/**
 * 주소 → 어디로 보낼지.
 * @returns {null | { kind: 'health' } | { kind: 'room', code: string, path: string, op: string }}  path는 방(Durable Object)에 넘길 '/api/…' 경로
 * 코드 모양이 틀리면 LiveError(400 bad_code), 닫힌 주소면 LiveError(404)
 */
export function liveTarget(pathname) {
  const alias = FILE_ALIAS.exec(pathname);
  if (alias) return { kind: 'room', code: alias[1], path: pathname, op: 'files' };
  if (pathname !== LIVE_PREFIX && !pathname.startsWith(`${LIVE_PREFIX}/`)) return null;
  const path = pathname.slice(LIVE_PREFIX.length);
  if (path === '/api/health') return { kind: 'health' };
  if (!path.startsWith('/api/')) return null;
  const [raw, op = ''] = path.slice(5).split('/');
  let code;
  try { code = normCode(decodeURIComponent(raw)); } catch (e) { throw e instanceof LiveError ? e : new LiveError(400, 'bad_code', '연수 코드가 올바르지 않습니다.'); }
  if (CLOSED_OPS.has(op)) throw new LiveError(404, 'not_found', '이 서버에서는 사이트를 공개할 때 연수가 등록됩니다.');
  return { kind: 'room', code, path, op };
}

/**
 * 브라우저가 보낸 요청이면 이 호스트의 사이트에서 온 것만(읽기 전용 GET은 규칙대로 그냥 받음: 다른 출처는 어차피 응답을 못 읽음).
 * sites: VIEW=pages 사이트 출처(https://s-<id>.<프로젝트>.pages.dev)를 받는 정규식
 */
export function liveOriginOk({ method, op, origin, self, sites = null }) {
  if (!origin || origin === self || (sites && sites.test(origin))) return true;
  return (method === 'GET' || method === 'HEAD') && op !== 'ws';
}

/**
 * LiveRoom에 넘길 환경. 호스트의 env를 그대로 주지 않습니다:
 * 호스트의 ADMIN_KEY(운영자 열쇠)가 넘어가면 모든 방의 관리자 키가 되고, 아무 코드나 저절로 생기는 "한 강사 전용" 방식이 켜집니다.
 */
export function roomEnv(env, cfg, { uploads, setupToken }) {
  return {
    GUARD: env.GUARD,
    UPLOADS: cfg.liveUploads ? uploads : undefined,
    SETUP_TOKEN: setupToken, // 이 객체 안에서만 쓰는 값. 밖으로 나가지 않음
    OPEN_INIT: 'false',
    ALLOWED_CODES: '',
    RETENTION_DAYS: String(maxRetentionDays(cfg)),
    MAX_UPLOAD_MB: String(cfg.liveMaxUploadMb),
    MAX_PARTICIPANTS: String(cfg.liveMaxParticipants),
    MAX_SOCKETS_PER_IP: String(cfg.liveSocketsPerIp),
  };
}
/** 방 자료를 두는 날 수는 사이트 공개 기간을 넘지 않음 */
export const maxRetentionDays = (cfg) => Math.max(1, Math.ceil(cfg.days));

// ── 방 ↔ 사이트 묶음 ─────────────────────────────────────────────
const BIND_TABLE = 'host_bind';
const BIND_SCHEMA = `CREATE TABLE IF NOT EXISTS ${BIND_TABLE} (id INTEGER PRIMARY KEY CHECK (id = 1), site TEXT NOT NULL, code TEXT NOT NULL, expires INTEGER NOT NULL, blocked INTEGER NOT NULL DEFAULT 0, bound_at INTEGER NOT NULL)`;

/** 방 저장소 안의 한 줄: 이 방이 어느 사이트 것인지. 묶이지 않은 방에서는 읽기만 하고 아무것도 쓰지 않음 */
export class HostBind {
  constructor(sql) { this.sql = sql; this.has = false; }
  rows(q, ...p) { return this.sql.exec(q, ...p).toArray(); }
  get() {
    if (!this.has) this.has = this.rows(`SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = ?`, BIND_TABLE).length > 0;
    if (!this.has) return null;
    return this.rows(`SELECT site, code, expires, blocked FROM ${BIND_TABLE} WHERE id = 1`)[0] || null;
  }
  set({ site, code, expires, blocked = 0 }) {
    this.rows(BIND_SCHEMA); this.has = true;
    this.rows(`INSERT INTO ${BIND_TABLE} (id, site, code, expires, blocked, bound_at) VALUES (1, ?, ?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET site = excluded.site, code = excluded.code, expires = excluded.expires, blocked = excluded.blocked`, site, code, expires, blocked ? 1 : 0, Date.now());
  }
  patch({ expires, blocked }) {
    const cur = this.get();
    if (!cur) return null;
    const next = { ...cur, expires: Number.isSafeInteger(expires) ? expires : cur.expires, blocked: blocked === undefined ? cur.blocked : blocked ? 1 : 0 };
    this.rows(`UPDATE ${BIND_TABLE} SET expires = ?, blocked = ? WHERE id = 1`, next.expires, next.blocked);
    return next;
  }
  /** deleteAll 뒤에 부름 */
  reset() { this.has = false; }
}

const SETTING_KEYS = ['retentionDays', 'uploads', 'moderation'];

/**
 * 사이트에 방을 묶고(또는 관리자 키 해시를 바꾸고) 연수를 등록합니다.
 * 규칙 코드의 init을 그대로 부르되, 설정 토큰·지금 관리자 키 확인은 "사이트 수정 열쇠로 이미 확인됨"으로 갈음합니다.
 * @param {{ core: any, bind: HostBind, setupToken: string, maxDays: number }} room
 * @param {{ site: string, code: string, adminKeyHash: string, settings?: object, expires: number, blocked?: boolean }} input
 * @returns {Promise<{ created: boolean, code: string, settings: object }>}
 */
export async function bindRoom({ core, bind, setupToken, maxDays }, input) {
  const code = normCode(input.code);
  const cur = bind.get();
  if (cur && cur.site !== input.site) throw new HttpError('code_taken');
  const existing = core.trainingOrNull(code);
  // 다시 묶을 때 settings를 안 보내면 지금 것을 그대로 둠
  const settings = {};
  const before = (existing && existing.settingsObj) || {};
  const asked = input.settings && typeof input.settings === 'object' && !Array.isArray(input.settings) ? input.settings : {};
  for (const k of SETTING_KEYS) {
    const v = asked[k] ?? before[k];
    if (v != null) settings[k] = v;
  }
  if (settings.retentionDays != null) {
    const d = Number(settings.retentionDays);
    if (!Number.isFinite(d) || d < 1) throw new HttpError('bad_request', 'settings.retentionDays는 1 이상의 숫자여야 해요.');
    settings.retentionDays = Math.min(Math.floor(d), maxDays);
  }
  let out;
  try {
    out = await core.init(code, { adminKeyHash: input.adminKeyHash, settings }, { tokenHash: null, adminHash: (existing && existing.admin_hash) || null, setupHash: await sha256hex(setupToken) });
  } catch (e) {
    throw translate(e);
  }
  bind.set({ site: input.site, code, expires: input.expires, blocked: input.blocked ? 1 : 0 });
  return { created: !cur, code, settings: out.body.settings };
}

/** 규칙 코드의 오류 → 호스트 API 오류({ error: { code, message_ko } }) */
export function translate(e) {
  if (e instanceof HttpError) return e;
  if (e instanceof LiveError) {
    if (e.status === 429) return new HttpError('rate_limited', e.message, { headers: e.extra && e.extra.retryAfter ? { 'retry-after': String(e.extra.retryAfter) } : {} });
    if (e.status >= 400 && e.status < 500) return new HttpError('bad_request', e.message);
  }
  return e;
}
