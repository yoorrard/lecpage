// 부하·수용량 시험 도우미: 앱과 같은 순서로 올리기, 참가자 흉내, 하루 숫자 읽기.
import { bytesOf, manifestOf, sha256 } from './helpers.mjs';

/** 동시에 n개까지 */
export async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

/** API 한 번(JSON). 걸린 시간도 */
export async function req(base, method, path, { key, json, raw, headers = {} } = {}) {
  const h = { ...headers };
  if (key) h.authorization = `Bearer ${key}`;
  if (json !== undefined) h['content-type'] = 'application/json';
  else if (raw !== undefined) h['content-type'] = 'application/octet-stream';
  const t0 = performance.now();
  let r;
  try { r = await fetch(base + path, { method, headers: h, body: json !== undefined ? JSON.stringify(json) : raw, redirect: 'manual' }); }
  catch (e) { return { status: 0, ms: performance.now() - t0, body: { error: { code: 'network', message_ko: String(e.message) } }, headers: new Headers() }; }
  const text = r.status === 204 || r.status === 304 ? '' : await r.text();
  let body = text; try { body = JSON.parse(text); } catch { /* 글자 */ }
  return { status: r.status, headers: r.headers, body, ms: performance.now() - t0 };
}

/**
 * 앱(app/src/lib/deploy.js deployInstant)과 같은 순서: 만들기(예약) → 목록 → 파일 4개씩 → 방 묶기 → 공개(사라진 파일이면 그것만 다시, 2번까지)
 * @returns {Promise<{ ok: boolean, site?: {id,key,url}, step?: string, res?: any, puts: number, calls: number }>}
 */
export async function appPublish(base, files, { site = null, title = '부하 시험', live = null, booking = null, device = '', caps = null, onCall = () => { } } = {}) {
  let calls = 0; let puts = 0;
  const go = async (...a) => { calls++; const r = await req(base, ...a); onCall(r); return r; };
  let s = site;
  if (!s) {
    const made = await go('POST', '/api/sites', { json: { title, ...(booking ? { booking } : {}), ...(device ? { device } : {}), ...(caps ? { caps } : {}) } });
    if (made.status !== 201) return { ok: false, step: 'create', res: made, calls, puts };
    s = made.body;
  }
  const manifest = manifestOf(files);
  const blobs = new Map(Object.entries(files).map(([p, v]) => [manifest[p].sha256, bytesOf(v)]));
  const d = await go('POST', `/api/sites/${s.id}/deploys`, { key: s.key, json: { files: manifest, ...(booking ? { booking } : {}) } });
  if (d.status !== 200) return { ok: false, step: 'deploys', res: d, site: s, calls, puts };
  const upload = async (list) => {
    let bad = null;
    await pool(list.filter((h) => blobs.has(h)), 4, async (h) => {
      puts++;
      const u = await go('PUT', `/api/sites/${s.id}/blobs/${h}`, { key: s.key, raw: blobs.get(h) });
      if (u.status !== 204 && !bad) bad = u;
    });
    return bad;
  };
  const bad = await upload(d.body.missing || []);
  if (bad) return { ok: false, step: 'blobs', res: bad, site: s, calls, puts };
  if (live) {
    const l = await go('POST', `/api/sites/${s.id}/live`, { key: s.key, json: live });
    if (l.status !== 200) return { ok: false, step: 'live', res: l, site: s, calls, puts };
  }
  for (let t = 0; ; t++) {
    const p = await go('POST', `/api/sites/${s.id}/deploys/${d.body.deploy}/publish`, { key: s.key });
    if (p.status === 200) return { ok: true, site: { ...s, url: p.body.url }, res: p, calls, puts };
    if (p.body?.error?.code !== 'missing_blobs' || t >= 2) return { ok: false, step: 'publish', res: p, site: s, calls, puts };
    const again = await upload(p.body.error.missing || []);
    if (again) return { ok: false, step: 'blobs-again', res: again, site: s, calls, puts };
  }
}

/** 관리자 열쇠로 오늘 숫자(하루 줄) */
export async function today(base, adminKey) {
  const r = await req(base, 'GET', '/api/admin/stats', { headers: { authorization: `Bearer ${adminKey}` } });
  if (r.status !== 200) throw new Error(`stats ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
  return { ...(r.body.today || {}) };
}
/** 두 숫자 묶음의 차이(키별) */
export function diff(after, before, keys) {
  const out = {};
  for (const k of keys) out[k] = (after[k] || 0) - (before[k] || 0);
  return out;
}
/** Worker 하루 숫자를 Gate에 다 보낼 때까지 잠깐(TALLY_EVERY=1이면 요청마다 보내지만 waitUntil이라 조금 늦음) */
export const settle = (ms = 400) => new Promise((r) => setTimeout(r, ms));

/** 백분위(밀리초) */
export function pct(list, p) {
  if (!list.length) return 0;
  const a = [...list].sort((x, y) => x - y);
  return Math.round(a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))]);
}

export const teacherKey = (code) => `load-teacher-key-${code}`;
export const liveFor = (code) => ({ code, adminKeyHash: sha256(teacherKey(code)) });
