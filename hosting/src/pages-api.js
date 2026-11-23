// Cloudflare Pages 직접 올리기(Direct Upload) API. Worker(Site Durable Object)와 설정 스크립트(Node)가 같이 씁니다.
// 흐름(공식 API 문서 developers.cloudflare.com/api/resources/pages, 2026-11-13 확인. wrangler pages deploy와 같은 순서):
//   1. GET  /accounts/{계정}/pages/projects/{프로젝트}/upload-token        → 자산 올리기용 JWT(몇 분짜리)
//   2. POST /pages/assets/check-missing  { hashes }                          → 아직 없는 열쇠
//   3. POST /pages/assets/upload         [{ key, value(base64), metadata: { contentType }, base64: true }]
//   4. POST /pages/assets/upsert-hashes  { hashes }                          → 다음 배포에서 다시 올리지 않게
//   5. POST /accounts/{계정}/pages/projects/{프로젝트}/deployments (multipart: manifest, branch, _headers, _redirects)
//   6. GET  …/deployments/{id} 로 준비될 때까지(latest_stage deploy/success)
//   지우기: DELETE …/deployments/{id}?force=true (별칭이 걸린 미리보기 배포도 지움)
//   목록: GET …/deployments?env=preview&page=N (최근 것부터. 우리가 id를 모르는 배포를 찾을 때만)
// 2~4는 JWT로, 나머지는 API 토큰(Pages Write)으로 부릅니다. 브라우저에서 부를 수 없습니다(CORS 머리글 없음).
// JWT를 앱(브라우저)에 주지 않습니다: 열쇠가 내용과 맞는지를 Pages가 확인하지 않으면 남의 파일을 바꿔치기할 수 있어서, 내용 검사는 늘 이쪽에서 합니다.

export const CF_API = 'https://api.cloudflare.com/client/v4';

export class PagesError extends Error {
  constructor(message, { status = 0, code = 0, step = '' } = {}) { super(message); this.status = status; this.code = code; this.step = step; }
}

function jwtExp(jwt) {
  try { const p = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); return Number(p.exp) * 1000 || 0; } catch { return 0; }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 호출 하나를 기다리는 시간(밀리초). Cloudflare API가 답 없이 멈추면 배포가 끝나지 않으므로 끊고 오류로 돌려줌(앱의 [다시 배포]로 이어짐) */
export const CALL_TIMEOUT_MS = 20000;
/** 큰 본문을 보내는 호출(자산 올리기·배포 만들기) */
export const UPLOAD_TIMEOUT_MS = 90000;

/**
 * @param {{ api?: string, accountId: string, project: string, token: string, fetch?: typeof fetch, now?: () => number, wait?: (ms: number) => Promise<void>, timeout?: number }} o
 *   timeout(시험용): 모든 호출을 이 시간에 끊음
 */
export class PagesClient {
  constructor({ api = CF_API, accountId, project, token, fetch: f, now = () => Date.now(), wait = sleep, timeout = 0 }) {
    this.api = String(api).replace(/\/+$/, ''); this.accountId = accountId; this.project = project; this.token = token;
    this.f = f || ((...a) => fetch(...a)); this.now = now; this.wait = wait; this.timeout = timeout > 0 ? timeout : 0;
    this.jwt = ''; this.jwtUntil = 0;
    /** 부른 횟수(Cloudflare API 속도 제한 어림: 토큰마다 5분에 1,200번)와 그중 429 */
    this.calls = 0; this.limited = 0;
  }
  get base() { return `${this.api}/accounts/${encodeURIComponent(this.accountId)}/pages/projects/${encodeURIComponent(this.project)}`; }

  async call(step, url, init = {}, bearer = this.token) {
    this.calls++;
    const { timeout = CALL_TIMEOUT_MS, ...rest } = init;
    let res; let j = null;
    try {
      res = await this.f(url, { ...rest, signal: AbortSignal.timeout(this.timeout || timeout), headers: { authorization: `Bearer ${bearer}`, ...(rest.headers || {}) } });
      try { j = await res.json(); } catch (e) { if (e?.name === 'TimeoutError' || e?.name === 'AbortError') throw e; /* 빈 응답 */ }
    } catch (e) { throw new PagesError(`Cloudflare API에 닿지 못했어요(${step}).`, { step }); }
    if (!res.ok || (j && j.success === false)) {
      if (res.status === 429) this.limited++;
      const err = j?.errors?.[0] || {};
      throw new PagesError(`Cloudflare Pages ${step} 실패(${res.status}${err.code ? ` · ${err.code}` : ''}): ${String(err.message || '').slice(0, 200)}`, { status: res.status, code: err.code || 0, step });
    }
    return j ? j.result : null;
  }

  /**
   * 다시 보내도 결과가 같은 호출(토큰 받기·자산 확인·올리기·열쇠 적기)만: 닿지 못했거나(시간 초과 포함) 5xx면 잠깐 뒤 한 번 더.
   * Cloudflare API의 순간 오류로 배포가 실패로 끝나지 않게(wrangler도 자산 올리기를 여러 번 다시 함). 429(계정 API가 5분 막힘)·4xx는 그대로 돌려줌.
   * 배포 만들기는 다시 하지 않음(두 번 만들어질 수 있음)
   */
  async twice(fn) {
    try { return await fn(); }
    catch (e) {
      if (!(e instanceof PagesError) || (e.status && e.status < 500)) throw e;
      await this.wait(400);
      return fn();
    }
  }
  /** 자산 올리기용 JWT. 만료 1분 전이면 새로 받음 */
  async uploadJwt(force = false) {
    if (!force && this.jwt && this.jwtUntil - this.now() > 60000) return this.jwt;
    const r = await this.twice(() => this.call('upload-token', `${this.base}/upload-token`));
    if (!r || typeof r.jwt !== 'string') throw new PagesError('upload-token 응답에 jwt가 없어요.', { step: 'upload-token' });
    this.jwt = r.jwt; this.jwtUntil = jwtExp(r.jwt) || this.now() + 4 * 60000;
    return this.jwt;
  }
  /** JWT로 부르는 자산 API. 401(만료)이면 JWT를 새로 받아 한 번 더 */
  async assets(step, path, body, timeout = CALL_TIMEOUT_MS) {
    for (let t = 0; ; t++) {
      const jwt = await this.uploadJwt(t > 0);
      try { return await this.twice(() => this.call(step, `${this.api}/pages/assets/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body, timeout }, jwt)); }
      catch (e) { if (t === 0 && (e.status === 401 || e.code === 8000013)) continue; throw e; }
    }
  }
  /** @param {string[]} hashes @returns {Promise<string[]>} 없는 열쇠 */
  async checkMissing(hashes) {
    if (!hashes.length) return [];
    const r = await this.assets('check-missing', 'check-missing', JSON.stringify({ hashes }));
    return Array.isArray(r) ? r : [];
  }
  /**
   * @param {{ hash: string, parts: string[], contentType: string }[]} items parts = base64 조각(합치면 전체)
   * 본문을 글자열 하나로 만들지 않고 Blob으로 이어 붙임(큰 파일도 메모리를 두 번 쓰지 않게)
   */
  async upload(items) {
    if (!items.length) return;
    const chunks = ['['];
    items.forEach((it, i) => {
      chunks.push(`${i ? ',' : ''}{"key":${JSON.stringify(it.hash)},"value":"`, ...it.parts, `","metadata":{"contentType":${JSON.stringify(it.contentType || 'application/octet-stream')}},"base64":true}`);
    });
    chunks.push(']');
    await this.assets('upload', 'upload', new Blob(chunks), UPLOAD_TIMEOUT_MS);
  }
  async upsertHashes(hashes) {
    if (!hashes.length) return;
    await this.assets('upsert-hashes', 'upsert-hashes', JSON.stringify({ hashes }));
  }

  /**
   * @param {{ branch: string, manifest: Record<string,string>, headers?: string, redirects?: string, message?: string }} o
   * @returns {Promise<{ id: string, url: string, aliases?: string[], latest_stage?: { name: string, status: string } }>}
   */
  async createDeployment({ branch, manifest, headers = '', redirects = '', message = '' }) {
    const form = new FormData();
    form.append('manifest', JSON.stringify(manifest));
    if (branch) form.append('branch', branch);
    if (message) form.append('commit_message', message.slice(0, 300));
    if (headers) form.append('_headers', new File([headers], '_headers'));
    if (redirects) form.append('_redirects', new File([redirects], '_redirects'));
    return this.call('deployments', `${this.base}/deployments`, { method: 'POST', body: form, timeout: UPLOAD_TIMEOUT_MS });
  }
  getDeployment(id) { return this.call('deployment', `${this.base}/deployments/${encodeURIComponent(id)}`); }
  /** 준비될 때까지 기다림(1·2·4·8초). 실패면 PagesError, 끝까지 모르면 마지막 상태를 돌려줌 */
  async waitReady(dep, { tries = 5 } = {}) {
    let d = dep;
    for (let i = 0; i < tries; i++) {
      const st = d?.latest_stage;
      if (st?.name === 'deploy' && st.status === 'success') return d;
      if (st?.status === 'failure') throw new PagesError('Cloudflare Pages가 배포를 끝내지 못했어요.', { step: 'deploy' });
      await this.wait(1000 * 2 ** i);
      try { d = await this.getDeployment(dep.id); } catch { /* 다음에 다시 */ }
    }
    return d;
  }
  /** force: 별칭이 걸린(가장 최근) 미리보기 배포도 지움 */
  deleteDeployment(id, force = true) {
    return this.call('delete', `${this.base}/deployments/${encodeURIComponent(id)}${force ? '?force=true' : ''}`, { method: 'DELETE' });
  }
  /**
   * 프로젝트의 미리보기 배포 목록 한 쪽(최근에 만든 것부터, 한 쪽 25개). 브랜치로 거르는 인자가 없어 받은 쪽에서 고름
   * (배포마다 deployment_trigger.metadata.branch · created_on). 답이 끊긴 '배포 만들기'가 남긴 배포를 찾을 때만 부름(Site.strays)
   */
  listDeployments(page = 1) { return this.call('deployments-list', `${this.base}/deployments?env=preview&page=${Math.max(1, Math.floor(page) || 1)}`); }
  getProject() { return this.call('project', this.base); }
}

/**
 * 사이트 하나를 올리기: 없는 자산만 올리고 배포를 만든 뒤 준비될 때까지 기다림.
 * @param {PagesClient} pc
 * @param {{ branch: string, manifest: Record<string,string>, extra?: { hash: string, parts: string[], contentType: string }[], headers?: string, redirects?: string, known?: string[] }} o
 *   extra: 이번에 새로 만든 파일(바뀐 HTML·안내 화면). known: 이미 올렸다고 알고 있는 열쇠(사라졌으면 missing으로 알려 줌)
 * @returns {Promise<{ deployment: any, lost: string[] }>} lost = known 중 Pages에 없는 열쇠(다시 받아야 함). lost가 있으면 배포하지 않음
 */
export async function deploySite(pc, { branch, manifest, extra = [], headers = '', redirects = '', message = '' }) {
  const extraHashes = new Set(extra.map((x) => x.hash));
  const all = [...new Set(Object.values(manifest))];
  const missing = new Set(await pc.checkMissing(all));
  const lost = all.filter((h) => missing.has(h) && !extraHashes.has(h));
  if (lost.length) return { deployment: null, lost };
  const need = extra.filter((x) => missing.has(x.hash));
  // 한 번에 너무 크지 않게(wrangler는 40MiB씩)
  let batch = []; let size = 0;
  for (const x of need) {
    const n = x.parts.reduce((a, p) => a + p.length, 0);
    if (batch.length && size + n > 30 * 1024 * 1024) { await pc.upload(batch); batch = []; size = 0; }
    batch.push(x); size += n;
  }
  if (batch.length) await pc.upload(batch);
  try { await pc.upsertHashes(all); } catch { /* 다음 배포가 조금 느려질 뿐 */ }
  const dep = await pc.createDeployment({ branch, manifest, headers, redirects, message });
  const ready = await pc.waitReady(dep);
  return { deployment: ready || dep, lost: [] };
}
