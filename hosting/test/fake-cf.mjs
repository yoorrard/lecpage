// 흉내 Cloudflare API(시험용). 실제 계정 없이 바로 공개 서버(VIEW=pages)와 설정 스크립트를 시험합니다.
//  - Pages 직접 올리기: upload-token(JWT) · assets check-missing/upload/upsert-hashes · deployments 만들기/보기/지우기 · 프로젝트
//    배포를 만들 때 manifest의 열쇠가 실제 내용의 blake3(base64 + 확장자)와 맞는지 확인합니다(wrangler와 같은 계산인지).
//  - 보기: http://<브랜치>.localhost:<포트>/… 또는 http://127.0.0.1:<포트>/__view/<브랜치>/… 로 그 브랜치의 마지막 배포를 내보냄
//    (_headers·_redirects·404.html·.html 떼기 흉내)
//  - 설정 스크립트가 부르는 것: 계정·workers.dev 하위 도메인·Worker·비밀 값·Access(조직·앱)·토큰(권한 묶음)·zone·rulesets·Worker 도메인
// 혼자 띄우기: node test/fake-cf.mjs [포트]  → 주소를 찍고 계속 돎(e2e용)
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { randomUUID, randomBytes } from 'node:crypto';
import { blake3Hex } from '../src/blake3.js';

const require = createRequire(import.meta.url);
let wasm = null;
try { wasm = require('blake3-wasm'); } catch { /* 없으면 우리 구현으로 */ }
const b3 = (s) => (wasm ? wasm.hash(s).toString('hex') : blake3Hex(s));

export const ACCOUNT = '0123456789abcdef0123456789abcdef';
export const TOKEN = 'fake-cf-token-0123456789abcdefghij';

function jwt(payload) {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b({ alg: 'none' })}.${b(payload)}.sig`;
}
const ok = (result) => ({ success: true, errors: [], messages: [], result });
const fail = (code, message) => ({ success: false, errors: [{ code, message }], messages: [], result: null });

/** multipart/form-data 아주 간단히 읽기(이름 → 글자) */
function parseMultipart(buf, type) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(type || '');
  if (!m) return {};
  const boundary = `--${m[1] || m[2]}`;
  const out = {};
  const s = buf.toString('latin1');
  for (const part of s.split(boundary).slice(1, -1)) {
    const i = part.indexOf('\r\n\r\n');
    const head = part.slice(0, i); const body = part.slice(i + 4, part.length - 2);
    const name = /name="([^"]+)"/.exec(head)?.[1];
    if (name) out[name] = Buffer.from(body, 'latin1').toString('utf8');
  }
  return out;
}

/** _headers 흉내: /*, /*.ext, 정확한 경로. '! 이름'은 앞에서 붙인 것을 뗌 */
function applyHeaders(text, path) {
  const out = new Map();
  let cur = null; const rules = [];
  for (const line of String(text || '').split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) { cur = { pat: line.trim(), hs: [] }; rules.push(cur); continue; }
    if (cur) cur.hs.push(line.trim());
  }
  for (const r of rules) {
    const re = new RegExp(`^${r.pat.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace('*', '.*')}$`);
    if (!re.test(path)) continue;
    for (const h of r.hs) {
      if (h.startsWith('! ')) { out.delete(h.slice(2).trim().toLowerCase()); continue; }
      const i = h.indexOf(':'); const k = h.slice(0, i).trim().toLowerCase(); const v = h.slice(i + 1).trim();
      out.set(k, out.has(k) ? `${out.get(k)}, ${v}` : v);
    }
  }
  return out;
}

export function startFakeCf({ port = 0, host = '127.0.0.1', log = false } = {}) {
  const state = {
    calls: [], // [메서드, 경로]
    assets: new Map(), // 열쇠 → { bytes, contentType }
    projects: new Map([['lecpage-view', { name: 'lecpage-view', subdomain: 'lecpage-view.pages.dev', production_branch: 'main' }]]),
    deployments: new Map(), // id → { id, branch, manifest, headers, redirects, project, created }
    jwtExpired: false, // 시험: 다음 assets 요청을 401로
    loseAssets: false, // 시험: check-missing이 모든 열쇠를 없다고 답함(Pages가 지운 것 흉내)
    failDeleteLatest: false, // 시험: 가장 최근 배포는 지우지 못함
    badHash: [], // manifest 열쇠가 내용과 안 맞은 경로
    // 설정 스크립트용
    accounts: [{ id: ACCOUNT, name: '운영 계정' }],
    subdomain: '', // workers.dev 하위 도메인(비면 아직 없음)
    scripts: new Map(), // 이름 → { id(tag), secrets: Map, workersDev }
    accessOrg: null, // { auth_domain }
    accessApps: [],
    tokens: [],
    zones: [], rulesets: new Map(), domains: [],
    tokenOk: true,
  };
  const deploymentsOf = (branch, project = 'lecpage-view') => [...state.deployments.values()].filter((d) => d.branch === branch && d.project === project).sort((a, b) => a.created - b.created);

  async function read(req) { const chunks = []; for await (const c of req) chunks.push(c); return Buffer.concat(chunks); }
  function send(res, status, body, headers = {}) {
    const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
    res.writeHead(status, { 'content-type': typeof body === 'object' && !Buffer.isBuffer(body) ? 'application/json' : 'text/plain; charset=utf-8', ...headers });
    res.end(data);
  }

  async function api(req, res, url, body) {
    const p = url.pathname.replace(/^\/client\/v4/, '');
    const m = req.method;
    state.calls.push([m, p]);
    // 흉내 wrangler가 배포를 알림(시험 전용)
    if (p === '/__fake/scripts' && m === 'POST') {
      const x = JSON.parse(body.toString('utf8'));
      if (!state.scripts.has(x.name)) state.scripts.set(x.name, { id: randomBytes(16).toString('hex'), secrets: new Map(), workersDev: true });
      state.deploys = (state.deploys || 0) + 1;
      return send(res, 200, ok(null));
    }
    const auth = req.headers.authorization || '';
    // 자산 API(JWT)
    if (p.startsWith('/pages/assets/')) {
      if (!auth.startsWith('Bearer ') || auth.slice(7) === TOKEN) return send(res, 401, fail(8000013, 'Authorization failed'));
      if (state.jwtExpired) { state.jwtExpired = false; return send(res, 401, fail(8000013, 'Authorization failed')); }
      const j = JSON.parse(body.toString('utf8') || 'null');
      if (p === '/pages/assets/check-missing') return send(res, 200, ok((j.hashes || []).filter((h) => state.loseAssets || !state.assets.has(h))));
      if (p === '/pages/assets/upload') {
        for (const it of j) {
          if (!/^[0-9a-f]{32}$/.test(it.key) || it.base64 !== true) return send(res, 400, fail(8000096, 'bad asset'));
          state.assets.set(it.key, { b64: it.value, bytes: Buffer.from(it.value, 'base64'), contentType: it.metadata?.contentType || '' });
        }
        state.loseAssets = false;
        return send(res, 200, ok(null));
      }
      if (p === '/pages/assets/upsert-hashes') return send(res, 200, ok(null));
    }
    if (auth !== `Bearer ${TOKEN}` || !state.tokenOk) return send(res, 403, fail(10000, 'Authentication error'));
    let mm;
    if ((mm = /^\/accounts\/([^/]+)\/pages\/projects\/([^/]+)(\/.*)?$/.exec(p))) {
      const [, acc, proj, rest = ''] = mm;
      if (acc !== ACCOUNT) return send(res, 403, fail(10000, 'bad account'));
      if (rest === '' && m === 'GET') {
        const pr = state.projects.get(proj);
        if (!pr) return send(res, 404, fail(8000007, 'Project not found'));
        const prod = deploymentsOf(pr.production_branch, proj).at(-1);
        return send(res, 200, ok({ ...pr, canonical_deployment: prod ? view(prod) : null, latest_deployment: prod ? view(prod) : null }));
      }
      if (!state.projects.has(proj)) return send(res, 404, fail(8000007, 'Project not found'));
      if (rest === '/upload-token' && m === 'GET') return send(res, 200, ok({ jwt: jwt({ exp: Math.floor(Date.now() / 1000) + 300, max_file_count_allowed: 20000 }) }));
      if (rest === '/deployments' && m === 'POST') {
        const f = parseMultipart(body, req.headers['content-type']);
        const manifest = JSON.parse(f.manifest || '{}');
        for (const [path, key] of Object.entries(manifest)) {
          const a = state.assets.get(key);
          if (!a) return send(res, 400, fail(8000057, `missing asset ${path}`));
          const ext = (/\.([^./]+)$/.exec(path) || [])[1] || '';
          if (b3(a.b64 + ext).slice(0, 32) !== key) state.badHash.push(path);
        }
        const id = randomUUID();
        const branch = f.branch || state.projects.get(proj).production_branch;
        const d = { id, branch, manifest, headers: f._headers || '', redirects: f._redirects || '', project: proj, created: Date.now() + state.deployments.size };
        state.deployments.set(id, d);
        return send(res, 200, ok(view(d)));
      }
      if (rest === '/deployments' && m === 'GET') return send(res, 200, ok([...state.deployments.values()].filter((d) => d.project === proj).map(view)));
      if ((mm = /^\/deployments\/([^/]+)$/.exec(rest))) {
        const d = state.deployments.get(mm[1]);
        if (!d) return send(res, 404, fail(8000009, 'Deployment not found'));
        if (m === 'GET') return send(res, 200, ok(view(d)));
        if (m === 'DELETE') {
          const latest = deploymentsOf(d.branch, d.project).at(-1);
          if (latest?.id === d.id && (state.failDeleteLatest || url.searchParams.get('force') !== 'true')) return send(res, 400, fail(8000034, 'Cannot delete the latest deployment of a branch'));
          state.deployments.delete(d.id);
          return send(res, 200, ok(null));
        }
      }
    }
    if (p === '/accounts/' + ACCOUNT + '/pages/projects' && m === 'POST') {
      const j = JSON.parse(body.toString('utf8'));
      if (state.projects.has(j.name)) return send(res, 409, fail(8000002, 'A project with this name already exists'));
      const pr = { name: j.name, subdomain: `${j.name}-x1y.pages.dev`, production_branch: j.production_branch || 'main' };
      state.projects.set(j.name, pr);
      return send(res, 200, ok(pr));
    }
    return setupApi(req, res, p, m, body);
  }

  // ── 설정 스크립트가 부르는 것 ────────────────────────────────
  function setupApi(req, res, p, m, body) {
    const j = () => JSON.parse(body.toString('utf8') || '{}');
    const A = `/accounts/${ACCOUNT}`;
    if (p === '/user/tokens/verify') return send(res, 200, ok({ status: 'active' }));
    if (p === '/accounts' && m === 'GET') return send(res, 200, ok(state.accounts));
    if (p === `${A}/tokens/verify`) return send(res, 200, ok({ status: 'active' }));
    if (p === `${A}/workers/subdomain`) {
      if (m === 'GET') return state.subdomain ? send(res, 200, ok({ subdomain: state.subdomain })) : send(res, 404, fail(10007, 'This account does not have a workers.dev subdomain'));
      if (m === 'PUT') { state.subdomain = j().subdomain; return send(res, 200, ok({ subdomain: state.subdomain })); }
    }
    let mm;
    if ((mm = new RegExp(`^${A}/workers/scripts/([^/]+)(/.*)?$`).exec(p))) {
      const [, name, rest = ''] = mm;
      const sc = state.scripts.get(name);
      if (!sc) return send(res, 404, fail(10007, 'workers.api.error.script_not_found'));
      if (rest === '/settings' && m === 'GET') return send(res, 200, ok({ tag: sc.id }));
      if (rest === '/subdomain' && m === 'GET') return send(res, 200, ok({ enabled: sc.workersDev !== false }));
      if (rest === '/subdomain' && m === 'POST') { sc.workersDev = j().enabled; return send(res, 200, ok({ enabled: sc.workersDev })); }
      if (rest === '/secrets' && m === 'GET') return send(res, 200, ok([...sc.secrets.keys()].map((n) => ({ name: n, type: 'secret_text' }))));
      if (rest === '/secrets' && m === 'PUT') { const x = j(); sc.secrets.set(x.name, x.text); return send(res, 200, ok({ name: x.name, type: 'secret_text' })); }
    }
    if ((mm = new RegExp(`^${A}/workers/workers/([^/]+)$`).exec(p)) && m === 'GET') {
      const sc = state.scripts.get(mm[1]);
      return sc ? send(res, 200, ok({ id: sc.id, name: mm[1] })) : send(res, 404, fail(10007, 'not found'));
    }
    if (p === `${A}/access/organizations` && m === 'GET') return state.accessOrg ? send(res, 200, ok(state.accessOrg)) : send(res, 404, fail(12114, 'organization not found'));
    if (p === `${A}/access/apps` && m === 'GET') return send(res, 200, ok(state.accessApps));
    if (p === `${A}/access/apps` && m === 'POST') {
      if (!state.accessOrg) return send(res, 400, fail(12114, 'access.api.error.not_enabled'));
      const x = j(); const app = { id: randomUUID(), aud: randomBytes(32).toString('hex'), ...x };
      state.accessApps.push(app); return send(res, 200, ok(app));
    }
    if ((mm = new RegExp(`^${A}/access/apps/([^/]+)$`).exec(p)) && m === 'PUT') {
      const i = state.accessApps.findIndex((a) => a.id === mm[1]);
      if (i < 0) return send(res, 404, fail(12130, 'not found'));
      state.accessApps[i] = { ...state.accessApps[i], ...j(), id: mm[1], aud: state.accessApps[i].aud };
      return send(res, 200, ok(state.accessApps[i]));
    }
    if (p === `${A}/tokens/permission_groups` && m === 'GET') return send(res, 200, ok([{ id: 'pg-pages-write', name: 'Pages Write', scopes: ['com.cloudflare.api.account'] }, { id: 'pg-pages-read', name: 'Pages Read', scopes: ['com.cloudflare.api.account'] }]));
    if (p === `${A}/tokens` && m === 'GET') return send(res, 200, ok(state.tokens.map(({ value, ...t }) => t)));
    if (p === `${A}/tokens` && m === 'POST') { const x = j(); const t = { id: randomUUID(), name: x.name, policies: x.policies, value: `tok_${randomBytes(20).toString('hex')}` }; state.tokens.push(t); return send(res, 200, ok(t)); }
    if ((mm = new RegExp(`^${A}/tokens/([^/]+)$`).exec(p)) && m === 'DELETE') { state.tokens = state.tokens.filter((t) => t.id !== mm[1]); return send(res, 200, ok(null)); }
    if (p === '/zones' && m === 'GET') { const name = new URL(`http://x${req.url}`).searchParams.get('name'); return send(res, 200, ok(state.zones.filter((z) => !name || z.name === name))); }
    if ((mm = /^\/zones\/([^/]+)\/rulesets\/phases\/http_ratelimit\/entrypoint$/.exec(p))) {
      const rs = state.rulesets.get(mm[1]);
      if (m === 'GET') return rs ? send(res, 200, ok(rs)) : send(res, 404, fail(10003, 'not found'));
      if (m === 'PUT') { const x = j(); const r = { id: 'rs1', phase: 'http_ratelimit', rules: x.rules }; state.rulesets.set(mm[1], r); return send(res, 200, ok(r)); }
    }
    if (p === `${A}/workers/domains` && m === 'GET') return send(res, 200, ok(state.domains));
    if (p === `${A}/workers/domains` && m === 'PUT') { const x = j(); state.domains = state.domains.filter((d) => d.hostname !== x.hostname); state.domains.push(x); return send(res, 200, ok(x)); }
    return send(res, 404, fail(7003, `No route for that URI (fake): ${m} ${p}`));
  }

  function view(d) {
    const pr = state.projects.get(d.project);
    const sub = pr.subdomain;
    return { id: d.id, url: `https://${d.id.slice(0, 8)}.${sub}`, aliases: d.branch === pr.production_branch ? [`https://${sub}`] : [`https://${d.branch}.${sub}`], environment: d.branch === pr.production_branch ? 'production' : 'preview', deployment_trigger: { metadata: { branch: d.branch } }, latest_stage: { name: 'deploy', status: 'success' }, created_on: new Date(d.created).toISOString() };
  }

  /** 보기: 브랜치의 마지막 배포 */
  function serveView(req, res, branch, path, prefix = '') {
    const list = deploymentsOf(branch);
    const d = list.at(-1);
    if (!d) return send(res, 404, 'no deployment for this branch (fake pages)');
    let p = decodeURIComponent(path || '/');
    if (!p.startsWith('/')) p = `/${p}`;
    // _redirects(정적)
    for (const line of d.redirects.split('\n')) {
      const [from, to, code] = line.trim().split(/\s+/);
      if (from && (from === path || from === p)) return send(res, Number(code) || 302, '', { location: to });
    }
    const hit = (q) => d.manifest[q];
    let file = null; let status = 200;
    if (p.endsWith('.html') && hit(p)) { const bare = p === '/index.html' ? '/' : p.replace(/(index)?\.html$/, ''); return send(res, 308, '', { location: prefix + bare }); }
    if (p.endsWith('/')) file = hit(`${p}index.html`) ? `${p}index.html` : null;
    else file = hit(p) ? p : hit(`${p}.html`) ? `${p}.html` : null;
    if (!file) { file = hit('/404.html') ? '/404.html' : hit('/index.html') ? '/index.html' : null; status = file === '/404.html' ? 404 : 200; }
    if (!file) return send(res, 404, 'not found');
    const a = state.assets.get(d.manifest[file]);
    const hs = applyHeaders(d.headers, p);
    const out = { 'content-type': a.contentType || 'application/octet-stream', 'cache-control': 'public, max-age=0, must-revalidate', 'access-control-allow-origin': '*', 'x-robots-tag': 'noindex', etag: `"${d.manifest[file]}"` };
    for (const [k, v] of hs) out[k] = v;
    if (!hs.has('access-control-allow-origin') && /! Access-Control-Allow-Origin/i.test(d.headers)) delete out['access-control-allow-origin'];
    res.writeHead(status, out);
    res.end(req.method === 'HEAD' ? undefined : a.bytes);
  }

  const server = createServer(async (req, res) => {
    try {
      const body = await read(req);
      const url = new URL(req.url, `http://${req.headers.host || 'x'}`);
      if (log) console.log(req.method, req.headers.host, req.url);
      const h = String(req.headers.host || '').split(':')[0];
      const sub = /^(s-[0-9a-z]{10}|main)\.localhost$/.exec(h);
      if (sub) return serveView(req, res, sub[1], url.pathname);
      const v = /^\/__view\/([^/]+)(\/.*)?$/.exec(url.pathname);
      if (v) return serveView(req, res, v[1], v[2] || '/', `/__view/${v[1]}`);
      if (url.pathname.startsWith('/client/v4/')) return await api(req, res, url, body);
      send(res, 404, 'fake cloudflare');
    } catch (e) { console.error('fake-cf error', e); send(res, 500, fail(500, String(e.message))); }
  });
  return new Promise((resolve) => server.listen(port, host, () => {
    const p = server.address().port;
    resolve({ url: `http://${host}:${p}`, api: `http://${host}:${p}/client/v4`, port: p, state, deploymentsOf, stop: () => new Promise((r) => server.close(r)) });
  }));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const f = await startFakeCf({ port: Number(process.argv[2]) || 8790, log: !!process.env.FAKE_CF_LOG });
  console.log(`fake cloudflare: ${f.url} (api ${f.api}, 보기 http://s-<id>.localhost:${f.port}/)`);
}
