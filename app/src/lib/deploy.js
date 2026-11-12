// 브라우저에서 바로 공개(사용자 토큰). 토큰은 이 브라우저에서 올릴 곳으로만 갑니다. '기억하기'를 켜면 암호화해 이 기기에 둡니다.
const GH = 'https://api.github.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isText = (p) => /\.(html|css|js|json|md|svg|txt|webmanifest)$/i.test(p);

export const GITHUB_TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new?name=lecpage-deploy&description=lecpage%EB%A1%9C%20%EB%A7%8C%EB%93%A0%20%EC%97%B0%EC%88%98%20%EC%82%AC%EC%9D%B4%ED%8A%B8%20%EB%B0%B0%ED%8F%AC&expires_in=30&administration=write&contents=write&pages=write';
export const VERCEL_TOKEN_URL = 'https://vercel.com/account/tokens';
export const NETLIFY_TOKEN_URL = 'https://app.netlify.com/user/applications#personal-access-tokens';

/** 인터넷에 닿지 못한 오류(fetch가 던지는 TypeError)를 쉬운 말로 */
const OFFLINE = '인터넷에 닿지 못했어요. 연결을 확인하고 다시 해 주세요. 학교망이 막았다면 휴대폰 핫스팟으로 바꿔 보세요.';
async function net(url, init) {
  try { return await fetch(url, init); }
  catch (e0) { const e = new Error(OFFLINE); e.status = 0; e.cause = e0; throw e; }
}
// GitHub가 영어로 주는 오류를 강사가 고칠 수 있는 말로
function ghError(status, msg) {
  if (status === 401) return 'GitHub 토큰이 맞지 않거나 기한이 지났어요. 토큰을 다시 만들어 주세요.';
  if (status === 403 && /rate limit|abuse|secondary/i.test(msg)) return 'GitHub에 요청이 너무 많았어요. 몇 분 뒤 다시 해 주세요.';
  if (status === 403 || /not accessible by personal access token/i.test(msg)) return 'GitHub 토큰에 권한이 모자라요. 토큰을 만들 때 Repository access를 All repositories로 골랐는지 확인해 주세요.';
  if (status === 422 && /verif/i.test(msg)) return 'GitHub 메일 인증을 먼저 마쳐 주세요.';
  return msg || `GitHub 오류 ${status}`;
}
async function gh(token, method, path, body) {
  const r = await net(GH + path, { method, headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = r.status === 204 ? {} : await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(r.status === 404 ? j.message || 'GitHub 오류 404' : ghError(r.status, j.message || '')); e.status = r.status; throw e; }
  return j;
}
function b64(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }

/**
 * GitHub Pages 배포: 저장소 만들기(없으면) → 이미지 등 바이너리 blob(분당 80회 제한 고려해 천천히) → 글 파일은 tree에 바로 → 커밋 → Pages 켜기
 */
export async function deployGitHub({ token, repo, files, onProgress = () => { }, allowExisting = false }) {
  const me = await gh(token, 'GET', '/user');
  const owner = me.login;
  onProgress({ step: '저장소 확인', pct: 3 });
  let r;
  try {
    r = await gh(token, 'GET', `/repos/${owner}/${repo}`);
    // 이미 있는 저장소는 lecpage가 만든 것(표지 파일)이거나 강사가 덮어쓰기를 확인했을 때만
    if (!allowExisting) {
      let mine = false;
      try { await gh(token, 'GET', `/repos/${owner}/${repo}/contents/.lecpage-site`); mine = true; } catch (e2) { if (e2.status !== 404) throw e2; }
      if (!mine) { const e3 = new Error('이미 있는 저장소예요.'); e3.code = 'exists'; throw e3; }
    }
  }
  catch (e) {
    if (e.code === 'exists') throw e;
    if (e.status !== 404) throw e;
    onProgress({ step: '저장소 만들기', pct: 6 });
    r = await gh(token, 'POST', '/user/repos', { name: repo, description: 'lecpage로 만든 연수 사이트', auto_init: true, has_issues: false, has_wiki: false, has_projects: false });
    await sleep(1500);
  }
  const branch = r.default_branch || 'main';
  const ref = await gh(token, 'GET', `/repos/${owner}/${repo}/git/ref/heads/${branch}`);
  const baseSha = ref.object.sha;
  const entries = Object.entries(files);
  const tree = [];
  const bins = entries.filter(([p]) => !isText(p));
  let done = 0;
  for (const [p, data] of entries) {
    if (isText(p)) tree.push({ path: p, mode: '100644', type: 'blob', content: typeof data === 'string' ? data : new TextDecoder().decode(data) });
  }
  for (const [p, data] of bins) {
    const blob = await gh(token, 'POST', `/repos/${owner}/${repo}/git/blobs`, { content: b64(data instanceof Uint8Array ? data : new Uint8Array(data)), encoding: 'base64' });
    tree.push({ path: p, mode: '100644', type: 'blob', sha: blob.sha });
    done++; onProgress({ step: `이미지 올리기 ${done}/${bins.length}`, pct: 8 + Math.round(done / Math.max(1, bins.length) * 72) });
    if (bins.length > 40) await sleep(800); // 콘텐츠 생성 요청 분당 80회 제한
  }
  tree.push({ path: '.nojekyll', mode: '100644', type: 'blob', content: '' });
  tree.push({ path: '.lecpage-site', mode: '100644', type: 'blob', content: 'lecpage로 만든 연수 사이트 저장소예요. 다시 올리면 이 저장소의 파일이 바뀌어요.\n' });
  onProgress({ step: '파일 묶기', pct: 84 });
  const t = await gh(token, 'POST', `/repos/${owner}/${repo}/git/trees`, { tree }); // base_tree 없이: 사이트 파일만 남김
  const c = await gh(token, 'POST', `/repos/${owner}/${repo}/git/commits`, { message: 'lecpage로 연수 사이트 배포', tree: t.sha, parents: [baseSha] });
  await gh(token, 'PATCH', `/repos/${owner}/${repo}/git/refs/heads/${branch}`, { sha: c.sha, force: true });
  onProgress({ step: 'Pages 켜기', pct: 92 });
  try { await gh(token, 'POST', `/repos/${owner}/${repo}/pages`, { source: { branch, path: '/' } }); }
  catch (e) { if (e.status !== 409 && e.status !== 422) throw e; }
  let url = `https://${owner}.github.io/${repo}/`;
  try { const pg = await gh(token, 'GET', `/repos/${owner}/${repo}/pages`); if (pg.html_url) url = pg.html_url; } catch { }
  onProgress({ step: '완료(처음에는 1~2분, 길면 10분 뒤 열려요)', pct: 100 });
  return { url, repoUrl: `https://github.com/${owner}/${repo}` };
}

const NF_ERR = {
  401: 'Netlify 토큰이 맞지 않거나 기한이 지났어요. 토큰을 다시 만들어 주세요.',
  403: 'Netlify 토큰이 맞지 않거나 기한이 지났어요. 토큰을 다시 만들어 주세요.',
  429: 'Netlify에 요청이 너무 많았어요. 잠시 뒤 다시 해 주세요.',
};
/** Netlify: 사이트 만들기와 배포를 zip 한 번으로 */
export async function deployNetlify({ token, siteId, zip, name, onProgress = () => { } }) {
  onProgress({ step: siteId ? '새 버전 올리기' : '사이트 만들기', pct: 10 });
  const url = siteId ? `https://api.netlify.com/api/v1/sites/${siteId}/deploys` : `https://api.netlify.com/api/v1/sites${name ? `?name=${encodeURIComponent(name)}` : ''}`;
  const r = await net(url, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/zip' }, body: zip });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(/must be unique|already/i.test(j.message || '') ? j.message : NF_ERR[r.status] || j.message || `Netlify 오류 ${r.status}`); e.status = r.status; throw e; }
  onProgress({ step: '처리 중', pct: 70 });
  const site = siteId || j.site_id || j.id;
  const deployId = j.deploy_id || j.id;
  for (let i = 0; i < 30; i++) {
    await sleep(2000);
    const s = await fetch(`https://api.netlify.com/api/v1/sites/${site}/deploys/${deployId}`, { headers: { authorization: `Bearer ${token}` } }).then((x) => x.json()).catch(() => ({}));
    if (s.state === 'ready') { onProgress({ step: '완료', pct: 100 }); return { url: s.ssl_url || s.url || j.ssl_url, siteId: site }; }
    if (s.state === 'error') throw new Error(s.error_message || 'Netlify에서 사이트를 만들지 못했어요. 잠시 뒤 다시 해 주세요.');
  }
  return { url: j.ssl_url || j.url, siteId: site };
}

// ── Vercel: 토큰 하나로 파일을 올리고 프로젝트 주소(<이름>.vercel.app)에 공개. 다시 올리면 같은 주소 ──
// 순서·헤더 근거: docs/research/hosting-2026-11.md §10 (preflight가 허용하는 요청 헤더는 Authorization·Accept·Content-Type·x-vercel-digest)
const VC = 'https://api.vercel.com';
const VC_ERR = {
  401: 'Vercel 토큰이 맞지 않거나 기한이 지났어요. 토큰을 다시 만들어 주세요.',
  403: 'Vercel 토큰이 맞지 않거나 기한이 지났어요. 토큰을 다시 만들어 주세요.',
  402: 'Vercel 계정의 결제 상태를 확인해 주세요.',
  409: 'Vercel 프로젝트를 옮기는 중이에요. 잠시 뒤 다시 해 주세요.',
  429: '오늘 올릴 수 있는 횟수를 넘었어요. 내일 다시 하거나 다른 곳에 올려 주세요.',
};
async function vc(token, method, path, body, headers = {}) {
  const raw = body instanceof Uint8Array;
  const r = await net(VC + path, { method, headers: { authorization: `Bearer ${token}`, ...(body && !raw ? { 'content-type': 'application/json' } : {}), ...headers }, body: body ? (raw ? body : JSON.stringify(body)) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const code = j.error?.code || '';
    const e = new Error(code === 'missing_files' ? '파일을 더 올려야 해요.' : VC_ERR[r.status] || j.error?.message || `Vercel 오류 ${r.status}`);
    e.status = r.status; e.code = code; e.missing = j.error?.missing || []; throw e;
  }
  return j;
}
async function hex(algo, bytes) { const d = await crypto.subtle.digest(algo, bytes); return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join(''); }
const toBytes = (v) => (typeof v === 'string' ? new TextEncoder().encode(v) : v instanceof Uint8Array ? v : new Uint8Array(v));
/** 여러 개를 n개씩 나란히. 네트워크·서버 오류는 두 번까지 다시 */
async function pool(items, n, fn) {
  const q = items.slice();
  await Promise.all(Array.from({ length: Math.min(n, q.length) }, async () => {
    while (q.length) {
      const it = q.shift();
      for (let t = 0; ; t++) { try { await fn(it); break; } catch (e) { if (t >= 2 || (e.status && e.status < 500)) throw e; await sleep(800 * (t + 1)); } }
    }
  }));
}

/** 사이트의 _headers(Cloudflare·Netlify 형식)를 Vercel의 vercel.json headers로 옮김. 검색 제외 사이트는 X-Robots-Tag도 */
export function vercelConfig(files) {
  const rules = []; let cur = null;
  for (const line of String(files._headers || '').split('\n')) {
    if (!line.trim()) continue;
    if (!/^\s/.test(line)) { cur = { source: line.trim().replace(/\/\*$/, '/(.*)'), headers: [] }; rules.push(cur); }
    else if (cur) { const i = line.indexOf(':'); if (i > 0) cur.headers.push({ key: line.slice(0, i).trim(), value: line.slice(i + 1).trim() }); }
  }
  if (/Disallow:\s*\/\s*$/m.test(String(files['robots.txt'] || ''))) rules.push({ source: '/(.*)', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] });
  return JSON.stringify({ cleanUrls: false, trailingSlash: false, headers: rules.filter((r) => r.headers.length) }, null, 2);
}

/** Vercel 프로젝트 이름: 영문 소문자·숫자·-만 */
export const vercelName = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

/** 토큰이 맞는지(팀 범위 토큰은 /v2/user가 막힐 수 있어 프로젝트 목록으로 확인) */
export const checkVercel = (token) => vc(token, 'GET', '/v9/projects?limit=1');

/**
 * @param {object} o { token, name(처음 올릴 때 주소 이름), projectId(다시 올릴 때), files: {경로: 글|Uint8Array}, onProgress }
 * @returns {Promise<{url, projectId, name, opened}>} opened: 로그인 없이 열리게 보호를 풀었는지
 */
export async function deployVercel({ token, name, projectId, files, onProgress = () => { } }) {
  onProgress({ step: '계정 확인', pct: 2 });
  await checkVercel(token);
  const wanted = vercelName(name) || `lecpage-${Date.now().toString(36)}`;
  if (!projectId) {
    // 같은 이름의 프로젝트가 내 계정에 이미 있으면 그 사이트를 덮어쓰게 되므로 막음
    let taken = false;
    try { await vc(token, 'GET', `/v9/projects/${encodeURIComponent(wanted)}`); taken = true; } catch (e) { if (e.status !== 404) throw e; }
    if (taken) { const e = new Error('내 Vercel에 같은 이름의 프로젝트가 이미 있어요. 다른 주소 이름을 적어 주세요.'); e.code = 'exists'; throw e; }
  }
  const all = { ...files, 'vercel.json': vercelConfig(files) };
  delete all._headers;
  const blobs = new Map(); const list = [];
  for (const [path, v] of Object.entries(all)) { const bytes = toBytes(v); const sha = await hex('SHA-1', bytes); blobs.set(sha, bytes); list.push({ file: path, sha, size: bytes.length }); }
  // 배포를 먼저 요청하고, Vercel에 아직 없는 파일만 올림(다시 올릴 때는 바뀐 파일만 감)
  const body = { name: wanted, ...(projectId ? { project: projectId } : {}), files: list, projectSettings: { framework: null }, target: 'production' };
  let d;
  for (let round = 0; !d; round++) {
    onProgress({ step: round ? '사이트 만들기' : '바뀐 파일 확인', pct: round ? 72 : 6 });
    try { d = await vc(token, 'POST', '/v13/deployments?skipAutoDetectionConfirmation=1', body); }
    catch (e) {
      if (e.code !== 'missing_files' || !e.missing.length || round >= 2) throw e;
      const need = [...new Set(e.missing)].filter((sha) => blobs.has(sha)); let done = 0;
      await pool(need, 6, async (sha) => {
        await vc(token, 'POST', '/v2/files', blobs.get(sha), { 'content-type': 'application/octet-stream', 'x-vercel-digest': sha });
        done++; onProgress({ step: `파일 올리기 ${done}/${need.length}`, pct: 8 + Math.round(done / need.length * 62) });
      });
    }
  }
  let dep = d;
  for (let i = 0; i < 150 && !(dep.readyState === 'READY' && (dep.aliasAssigned || (dep.alias || []).length)) && !['ERROR', 'CANCELED'].includes(dep.readyState); i++) {
    await sleep(2000);
    dep = await vc(token, 'GET', `/v13/deployments/${d.id}`);
    onProgress({ step: '처리 중', pct: Math.min(94, 76 + i) });
  }
  if (dep.readyState !== 'READY') throw new Error(dep.errorMessage || dep.aliasError?.message || 'Vercel에서 사이트를 만들지 못했어요. 잠시 뒤 다시 해 주세요.');
  const pid = dep.projectId || d.projectId || projectId || wanted;
  // 팀 기본값에 따라 새 프로젝트의 주소에 Vercel 로그인 창이 뜰 수 있음 → 처음 만들 때만 참가자가 열 수 있게 풂
  let opened = false;
  if (!projectId) { try { const pj = await vc(token, 'GET', `/v9/projects/${encodeURIComponent(pid)}`); if (pj.ssoProtection) { await vc(token, 'PATCH', `/v9/projects/${encodeURIComponent(pid)}`, { ssoProtection: null }); opened = true; } } catch { } }
  // 참가자에게 줄 주소는 프로젝트 주소(<이름>.vercel.app). 배포마다 생기는 주소(dep.url)는 로그인이 걸릴 수 있어 쓰지 않음
  const pname = dep.name || wanted;
  let hosts = (dep.alias || []).filter((a) => /\.vercel\.app$/.test(a));
  if (!hosts.length) { try { const dm = await vc(token, 'GET', `/v9/projects/${encodeURIComponent(pid)}/domains`); hosts = (dm.domains || []).map((x) => x.name); } catch { } }
  const host = hosts.find((h) => h === `${pname}.vercel.app`) || hosts.sort((a, b) => a.length - b.length)[0] || `${pname}.vercel.app`;
  onProgress({ step: '완료', pct: 100 });
  return { url: `https://${host}/`, projectId: pid, name: pname, opened };
}

/** 이미 올린 Vercel 프로젝트에 로그인 창이 뜰 때: 참가자가 열 수 있게 보호(Vercel Authentication)를 끔 */
export const openVercel = (token, projectId) => vc(token, 'PATCH', `/v9/projects/${encodeURIComponent(projectId)}`, { ssoProtection: null });

// ── lecpage 바로 공개: 운영자가 켜 둔 경우에만(빌드 변수 VITE_PUBLISH_API). 가입·토큰 없이 올림. 방문이 있으면 계속 열려 있고 30일 동안 방문이 없으면 지워짐 ──
export const PUBLISH_API = String(import.meta.env?.VITE_PUBLISH_API || '').replace(/\/+$/, '');
let infoP = null;
/** 바로 공개를 쓸 수 있으면 { plan: 'free'|'paid', accepting, limits: {maxBytes, maxFileBytes, maxFiles, days}, report, live? }, 아니면 null.
 * plan이 free면 운영자가 무료 요금제로 돌리는 것(하루 한도에 닿으면 그날 멈출 수 있음), accepting이 false면 오늘은 새 사이트를 받지 않음 */
export function instantInfo() {
  if (!PUBLISH_API) return Promise.resolve(null);
  return (infoP ||= fetch(`${PUBLISH_API}/api/info`).then((r) => (r.ok ? r.json() : null)).then((j) => (j?.ok ? j : null)).catch(() => null));
}
async function ip(method, path, { key, json, raw } = {}) {
  let r;
  try { r = await fetch(PUBLISH_API + path, { method, headers: { ...(key ? { authorization: `Bearer ${key}` } : {}), ...(json ? { 'content-type': 'application/json' } : raw ? { 'content-type': 'application/octet-stream' } : {}) }, body: json ? JSON.stringify(json) : raw }); }
  catch { const e = new Error('바로 공개 서버에 닿지 못했어요. 인터넷을 확인하고 다시 해 주세요.'); e.status = 0; throw e; }
  const j = r.status === 204 ? {} : await r.json().catch(() => ({}));
  if (!r.ok) {
    const code = j.error?.code || '';
    const e = new Error(code === 'runtime_mismatch' ? '앱이 새 버전으로 바뀌는 중이에요. 화면을 새로 고친 뒤 다시 해 주세요.' : j.error?.message_ko || `바로 공개 오류 ${r.status}`);
    e.status = r.status; e.code = code; throw e;
  }
  return j;
}
/**
 * @param {object} o { site: {id, key}(다시 올릴 때), title, files, onProgress,
 *   live?: { code, adminKeyHash, settings } 참여 기능 방을 이 사이트에 묶어 만듦(서버가 지원할 때) }
 * @returns {Promise<{url, id, key, expiresAt, liveUrl?}>}
 */
export async function deployInstant({ site, title, files, live = null, onProgress = () => { } }) {
  onProgress({ step: '준비', pct: 2 });
  let s = site?.id && site?.key ? site : null;
  if (!s) s = await ip('POST', '/api/sites', { json: { title: String(title || '').slice(0, 120) } });
  const blobs = new Map(); const manifest = {};
  for (const [path, v] of Object.entries(files)) {
    if (path === '_headers') continue; // 응답 헤더는 서버가 정함
    const bytes = toBytes(v); const sha256 = await hex('SHA-256', bytes); blobs.set(sha256, bytes); manifest[path] = { sha256, size: bytes.length };
  }
  onProgress({ step: '바뀐 파일 확인', pct: 6 });
  let dp;
  try { dp = await ip('POST', `/api/sites/${s.id}/deploys`, { key: s.key, json: { files: manifest } }); }
  catch (e) {
    // 공개 기간이 끝나 지워진 사이트면 새 주소로 다시 만듦
    if (!(site && (e.status === 404 || e.status === 401))) throw e;
    s = await ip('POST', '/api/sites', { json: { title: String(title || '').slice(0, 120) } });
    dp = await ip('POST', `/api/sites/${s.id}/deploys`, { key: s.key, json: { files: manifest } });
  }
  const need = (dp.missing || []).filter((h) => blobs.has(h)); let done = 0;
  await pool(need, 4, async (h) => {
    await ip('PUT', `/api/sites/${s.id}/blobs/${h}`, { key: s.key, raw: blobs.get(h) });
    done++; onProgress({ step: `파일 올리기 ${done}/${need.length}`, pct: 8 + Math.round(done / need.length * 80) });
  });
  let liveUrl = '';
  if (live) { onProgress({ step: '참여 기능 준비', pct: 90 }); liveUrl = (await ip('POST', `/api/sites/${s.id}/live`, { key: s.key, json: live })).url || ''; }
  onProgress({ step: '공개하는 중', pct: 94 });
  const out = await ip('POST', `/api/sites/${s.id}/deploys/${dp.deploy}/publish`, { key: s.key });
  onProgress({ step: '완료', pct: 100 });
  return { url: out.url || s.url, id: s.id, key: s.key, expiresAt: out.expiresAt || s.expiresAt || 0, liveUrl };
}
/** 바로 공개한 사이트 지우기 */
export const deleteInstant = (site) => ip('DELETE', `/api/sites/${site.id}`, { key: site.key });

// ── 올린 주소가 실제로 열리는지: 사이트의 작은 그림을 불러 봄(다른 출처라 응답 내용은 못 읽지만 그림은 열림/막힘을 알 수 있음) ──
/** @returns {Promise<boolean>} */
export function probeSite(url, timeout = 8000) {
  return new Promise((res) => {
    const img = new Image(); const t = setTimeout(() => { img.src = ''; res(false); }, timeout);
    img.onload = () => { clearTimeout(t); res(true); };
    img.onerror = () => { clearTimeout(t); res(false); };
    img.referrerPolicy = 'no-referrer';
    img.src = `${url.replace(/\/?$/, '/')}assets/favicon.svg?t=${Date.now()}`;
  });
}

/** 붙여 넣은 글이 토큰처럼 생겼는지(주소·문장·빈칸을 붙여 넣은 실수를 먼저 거름). 맞으면 '' */
export function tokenLooksWrong(token) {
  const t = String(token || '');
  if (!t) return '복사한 토큰이 없어요. 토큰 페이지에서 토큰을 복사해 주세요.';
  if (/\s/.test(t) || /^https?:/i.test(t) || t.length < 16) return '토큰이 아닌 글이 붙었어요. 토큰 페이지에서 만든 토큰을 복사해 주세요.';
  return '';
}

/** 연결할 때: 토큰이 맞는지 확인 */
export async function checkToken(kind, token) {
  if (kind === 'vercel') return checkVercel(token);
  if (kind === 'github') return gh(token, 'GET', '/user');
  const r = await net('https://api.netlify.com/api/v1/user', { headers: { authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(NF_ERR[r.status] || `Netlify 오류 ${r.status}`);
  return r.json();
}

// ── 짧은 주소 ──
// 근거: docs/research/share-links-2026-11.md. is.gd는 가입·키 없이 브라우저에서 바로 부를 수 있고(access-control-allow-origin: *),
// 광고·중간 화면 없이 바로 넘어가며 주소가 지워지지 않습니다. QR과 [주소 복사]는 언제나 원래 주소라서 짧은 주소가 막혀도 사이트는 열립니다.
const ISGD = 'https://is.gd/create.php';
const bareUrl = (u) => String(u || '').replace(/^https?:\/\//i, '').replace(/\/+$/, '');
/** 보여 줄 때: https://와 끝의 /를 떼고 한글 주소는 한글로 */
export function showUrl(u) { const s = bareUrl(u); try { return decodeURI(s); } catch { return s; } }

/** 치기 쉬운 이름: 영문 소문자만, 자음·모음을 번갈아(대문자·숫자가 섞인 이름은 휴대폰에서 치기 어려움). 7자면 is.gd에서 거의 겹치지 않음(6자는 열에 넷이 이미 쓰임, 2026-11 확인) */
function easyName(len = 7) {
  const C = 'bdgjklmnprstvz', V = 'aeiou', BAD = /sex|sek|fuk|fak|dik|kum|jot|sib|sip|nom|nig|tit|pis|pup|pus|kak|kok|bum|dum|nud|por|pen|vag|rap|kil|ded|die|gay|lez|jiz|ped|naz|sat|dam|god|jap|bit|but|pot|git/;
  for (;;) {
    const r = crypto.getRandomValues(new Uint8Array(len)); let s = '';
    for (let i = 0; i < len; i++) s += i % 2 ? V[r[i] % V.length] : C[r[i] % C.length];
    if (!BAD.test(s)) return s;
  }
}
/** 강사가 적은 이름을 is.gd가 받는 모양으로(영문·숫자·_ 5~30자) */
export const shortName = (v) => String(v || '').toLowerCase().replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 30);

async function isgd(target, alias) {
  let r;
  try { r = await fetch(`${ISGD}?format=json&url=${encodeURIComponent(target)}${alias ? `&shorturl=${encodeURIComponent(alias)}` : ''}`, { referrerPolicy: 'no-referrer', signal: AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined }); }
  catch { const e = new Error('is.gd에 닿지 못했어요. 학교망이 막았을 수 있어요. 다른 서비스로 만들어 붙여 넣어 주세요.'); e.code = 'network'; throw e; }
  const j = await r.json().catch(() => ({}));
  if (/^https:\/\/is\.gd\/\w{3,40}$/.test(String(j.shorturl || ''))) return j.shorturl;
  const e = new Error({ 1: 'is.gd가 이 주소를 받지 않아요. 다른 서비스로 만들어 붙여 넣어 주세요.', 3: '지금은 요청이 많아요. 잠시 뒤 다시 해 주세요.' }[j.errorcode] || 'is.gd가 잠시 쉬고 있어요. 잠시 뒤 다시 하거나 다른 서비스로 만들어 주세요.');
  e.code = j.errorcode === 2 ? 'name' : 'service'; throw e;
}
/**
 * 짧은 주소 만들기(is.gd). name을 주면 그 이름으로, 없으면 치기 쉬운 이름을 지어 봄(겹치면 몇 번 다시).
 * 암호 보호 사이트의 #k=…는 보내지 않습니다.
 * @returns {Promise<string>} https://is.gd/…
 */
export async function shortenUrl(url, name = '') {
  const target = String(url || '').split('#')[0];
  if (!/^https:\/\/[^\s/]+\.[^\s]+$/.test(target)) throw new Error('인터넷에 올린 주소(https://)만 줄일 수 있어요.');
  if (name) {
    if (!/^[a-z0-9_]{5,30}$/.test(name)) { const e = new Error('이름은 영문·숫자 5~30자로 적어 주세요.'); e.code = 'name'; throw e; }
    try { return await isgd(target, name); }
    catch (e) { if (e.code === 'name') e.message = '이미 쓰는 이름이에요. 다른 이름을 적어 주세요.'; throw e; }
  }
  for (let i = 0; i < 4; i++) {
    try { return await isgd(target, easyName(i < 3 ? 7 : 8)); }
    catch (e) { if (e.code !== 'name') throw e; }
  }
  return isgd(target, ''); // 이름이 계속 겹치면 is.gd가 지어 주는 이름으로
}

/** 다른 곳에서 만들어 올 때 여는 서비스(누르면 사이트 주소를 복사하고 새 탭으로 엶) */
export const SHORTENERS = [
  { id: 'joo', name: 'joo.is', url: 'https://joo.is/', note: '한글 주소도 돼요(로그인 필요).' },
  { id: 'bitly', name: 'bit.ly', url: 'https://bitly.com/', note: '무료는 광고 화면이 먼저 나와요.' },
];
const SHORT_HOME = /^(joo\.is|bit\.ly|bitly\.com|is\.gd|v\.gd|vo\.la|han\.gl|buly\.kr|me2\.do|naver\.me|url\.kr|tinyurl\.com|lrl\.kr)$/i;
/**
 * 붙여 넣은 짧은 주소 확인. https만, 계정·포트·스크립트 주소는 받지 않음.
 * @returns {{ url?: string, error?: string }} url은 https://… 로 맞춘 값
 */
export function checkShortUrl(input, siteUrl = '') {
  let s = String(input || '').trim();
  if (!s) return { error: '짧은 주소를 넣어 주세요.' };
  if (/\s/.test(s)) return { error: '주소만 넣어 주세요(빈칸이 들어 있어요).' };
  if (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^https?:\/\//i.test(s)) return { error: 'https://로 시작하는 주소만 쓸 수 있어요.' };
  s = /^https?:\/\//i.test(s) ? s.replace(/^http:/i, 'https:') : 'https://' + s;
  let u; try { u = new URL(s); } catch { return { error: '주소 모양이 아니에요. 예: joo.is/우리연수' }; }
  const host = u.hostname;
  if (u.protocol !== 'https:' || u.username || u.password || u.port || !/^[^.]+(\.[^.]+)+$/.test(host) || /^[\d.]+$/.test(host) || host.startsWith('[')) return { error: '주소 모양이 아니에요. 예: joo.is/우리연수' };
  u.hash = '';
  if (u.href.length > 200) return { error: '너무 길어요. 짧은 주소를 넣어 주세요.' };
  if (SHORT_HOME.test(host) && u.pathname === '/' && !u.search) return { error: '만든 짧은 주소를 끝까지 넣어 주세요. 예: joo.is/우리연수' };
  if (siteUrl && bareUrl(u.href) === bareUrl(siteUrl)) return { error: '사이트 주소와 같아요. 줄인 주소를 넣어 주세요.' };
  return { url: u.href };
}

/** 사이트 파일의 크기 정보(올릴 곳 한도 확인용) */
export function siteStat(files) {
  let bytes = 0, maxFile = 0, binaries = 0; const names = Object.keys(files);
  for (const k of names) { const n = typeof files[k] === 'string' ? new TextEncoder().encode(files[k]).length : files[k].byteLength ?? files[k].length ?? 0; bytes += n; if (n > maxFile) maxFile = n; if (!isText(k)) binaries++; }
  return { bytes, maxFile, files: names.length, binaries };
}
