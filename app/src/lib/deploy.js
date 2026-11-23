// 브라우저에서 바로 배포(사용자 토큰). 토큰은 이 브라우저에서 배포할 곳으로만 갑니다. '기억하기'를 켜면 암호화해 이 기기에 둡니다.
import { PUBLISH_API } from './publish-api.js';
import { liveKind } from '@hosting/csp.js';
import { track } from './stats.js';
import { koTime } from './util.js';

const GH = 'https://api.github.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isText = (p) => /\.(html|css|js|json|md|svg|txt|webmanifest)$/i.test(p);

export const GITHUB_TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new?name=lecpage-deploy&description=lecpage%EB%A1%9C%20%EB%A7%8C%EB%93%A0%20%EC%97%B0%EC%88%98%20%EC%82%AC%EC%9D%B4%ED%8A%B8%20%EB%B0%B0%ED%8F%AC&expires_in=30&administration=write&contents=write&pages=write';
export const VERCEL_TOKEN_URL = 'https://vercel.com/account/tokens';
export const NETLIFY_TOKEN_URL = 'https://app.netlify.com/user/applications#personal-access-tokens';

/** 인터넷에 닿지 못한 오류(fetch가 던지는 TypeError)를 쉬운 말로 */
const OFFLINE = '인터넷에 닿지 못했어요. 연결을 확인하고 다시 해 주세요. 기관·회사 망이 막았다면 휴대폰 핫스팟으로 바꿔 보세요.';
// 학교·기관 망의 차단 화면: API 주소인데 웹 페이지(HTML)가 옴 → 영어·빈 값 대신 같은 안내(인터넷·핫스팟)
const BLOCKED = '이 망에서 배포할 곳에 닿지 않아요. 회사·학교·기관 망이 막은 것 같아요. 휴대폰 핫스팟으로 바꾼 뒤 다시 해 주세요.';
const blockPage = (r) => r.status < 500 && r.status !== 429 && /text\/html|application\/xhtml/i.test(r.headers?.get?.('content-type') || '');
async function net(url, init) {
  let r;
  try { r = await fetch(url, init); }
  catch (e0) { const e = new Error(OFFLINE); e.status = 0; e.cause = e0; throw e; }
  if (blockPage(r)) { const e = new Error(BLOCKED); e.status = 0; e.blocked = true; throw e; }
  return r;
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
    done++; onProgress({ step: `그림·파일 올리기 ${done}/${bins.length}`, pct: 8 + Math.round(done / Math.max(1, bins.length) * 72) });
    if (bins.length > 40) await sleep(800); // 콘텐츠 생성 요청 분당 80회 제한
  }
  tree.push({ path: '.nojekyll', mode: '100644', type: 'blob', content: '' });
  tree.push({ path: '.lecpage-site', mode: '100644', type: 'blob', content: 'lecpage로 만든 연수 사이트 저장소예요. 다시 배포하면 이 저장소의 파일이 바뀌어요.\n' });
  onProgress({ step: '파일 묶기', pct: 84 });
  const t = await gh(token, 'POST', `/repos/${owner}/${repo}/git/trees`, { tree }); // base_tree 없이: 사이트 파일만 남김
  // copy-ok: GitHub 커밋 메시지(화면에 보이지 않음. GitHub의 '배포' 화면과 맞춤)
  const c = await gh(token, 'POST', `/repos/${owner}/${repo}/git/commits`, { message: 'lecpage로 연수 사이트 배포', tree: t.sha, parents: [baseSha] });
  await gh(token, 'PATCH', `/repos/${owner}/${repo}/git/refs/heads/${branch}`, { sha: c.sha, force: true });
  onProgress({ step: 'Pages 켜기', pct: 92 });
  try { await gh(token, 'POST', `/repos/${owner}/${repo}/pages`, { source: { branch, path: '/' } }); }
  catch (e) { if (e.status !== 409 && e.status !== 422) throw e; }
  let url = `https://${owner}.github.io/${repo}/`;
  try { const pg = await gh(token, 'GET', `/repos/${owner}/${repo}/pages`); if (pg.html_url) url = pg.html_url; } catch { }
  onProgress({ step: '완료(처음에는 1~2분, 길면 10분 뒤 열려요)', pct: 100 });
  track('publish', 'github'); // 익명 이용 합계(올릴 곳 종류만)
  return { url, repoUrl: `https://github.com/${owner}/${repo}` };
}

const NF_ERR = {
  401: 'Netlify 토큰이 맞지 않거나 기한이 지났어요. 토큰을 다시 만들어 주세요.',
  403: 'Netlify 토큰이 맞지 않거나 기한이 지났어요. 토큰을 다시 만들어 주세요.',
  429: 'Netlify에 요청이 너무 많았어요. 잠시 뒤 다시 해 주세요.',
};
/** Netlify: 참가자가 로그인 없이 열 수 있게 팀 기본 접근 제한(sso_login)을 풂. 못 풀면 던짐 */
export async function openNetlify(token, siteId) {
  const r = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}`, { method: 'PATCH', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ sso_login: false }) });
  if (!r.ok) { const e = new Error(NF_ERR[r.status] || `Netlify 오류 ${r.status}`); e.status = r.status; throw e; }
  return true;
}
/** Netlify: 사이트 만들기와 배포를 zip 한 번으로 */
export async function deployNetlify({ token, siteId, zip, name, onProgress = () => { } }) {
  onProgress({ step: siteId ? '새 버전 배포' : '사이트 만들기', pct: 10 });
  const url = siteId ? `https://api.netlify.com/api/v1/sites/${siteId}/deploys` : `https://api.netlify.com/api/v1/sites${name ? `?name=${encodeURIComponent(name)}` : ''}`;
  const r = await net(url, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/zip' }, body: zip });
  const j = await r.json().catch(() => ({}));
  // 지난번 사이트를 Netlify에서 지웠거나 다른 계정 토큰으로 바꿨으면(404) 새 사이트로 만듦(계속 'Not Found'로 막히지 않게)
  if (siteId && r.status === 404) return deployNetlify({ token, siteId: '', zip, name, onProgress });
  if (!r.ok) { const e = new Error(/must be unique|already/i.test(j.message || '') ? j.message : NF_ERR[r.status] || j.message || `Netlify 오류 ${r.status}`); e.status = r.status; throw e; }
  onProgress({ step: '처리 중', pct: 70 });
  const site = siteId || j.site_id || j.id;
  const deployId = j.deploy_id || j.id;
  // 팀 기본값에 따라 새 사이트에 'Netlify 팀 로그인' 보호(sso_login)가 걸려 참가자에게 로그인 창(401)이 뜸(2026-11 실계정 확인)
  // → 처음 만들 때만 참가자가 열 수 있게 풂(Vercel의 배포 보호 풀기와 같은 뜻)
  // opened: 걸려 있던 보호를 풀었음 · locked: 걸려 있는데 풀지 못함(카드에 [로그인 없이 열리게 하기]가 남음). 걸린 것이 없던 계정은 둘 다 false(아무 안내도 하지 않음)
  let opened = false, locked = false;
  if (!siteId && site) {
    try {
      const info = j.sso_login !== undefined ? j : await fetch(`https://api.netlify.com/api/v1/sites/${site}`, { headers: { authorization: `Bearer ${token}` } }).then((x) => x.json());
      if (info.sso_login) { try { await openNetlify(token, site); opened = true; } catch { locked = true; } }
    } catch { /* 보호가 걸렸는지 확인하지 못함: 걸렸다고 단정하지 않음 */ }
  }
  for (let i = 0; i < 30; i++) {
    await sleep(2000);
    const s = await fetch(`https://api.netlify.com/api/v1/sites/${site}/deploys/${deployId}`, { headers: { authorization: `Bearer ${token}` } }).then((x) => x.json()).catch(() => ({}));
    if (s.state === 'ready') { onProgress({ step: '완료', pct: 100 }); track('publish', 'netlify'); return { url: s.ssl_url || s.url || j.ssl_url, siteId: site, opened, locked }; }
    if (s.state === 'error') throw new Error(s.error_message || 'Netlify에서 사이트를 만들지 못했어요. 잠시 뒤 다시 해 주세요.');
  }
  track('publish', 'netlify');
  return { url: j.ssl_url || j.url, siteId: site, opened, locked };
}

// ── Vercel: 토큰 하나로 파일을 올리고 프로젝트 주소(<이름>.vercel.app)에 배포. 다시 배포하면 같은 주소 ──
// 순서·헤더 근거: docs/research/hosting-2026-11.md §10 (preflight가 허용하는 요청 헤더는 Authorization·Accept·Content-Type·x-vercel-digest)
const VC = 'https://api.vercel.com';
const VC_ERR = {
  401: 'Vercel 토큰이 맞지 않거나 기한이 지났어요. 토큰을 다시 만들어 주세요.',
  403: 'Vercel 토큰이 맞지 않거나 기한이 지났어요. 토큰을 다시 만들어 주세요.',
  402: 'Vercel 계정의 결제 상태를 확인해 주세요.',
  409: 'Vercel 프로젝트를 옮기는 중이에요. 잠시 뒤 다시 해 주세요.',
  429: '오늘 배포할 수 있는 횟수를 넘었어요. 내일 다시 하거나 다른 곳에 배포해 주세요.',
};
const VC_SCOPE = '이 Vercel 토큰으로는 이 계정에 배포할 수 없어요. 토큰을 만들 때 Scope를 Full Account로 골라 다시 만들어 주세요.';
async function vc(token, method, path, body, headers = {}) {
  const raw = body instanceof Uint8Array;
  const r = await net(VC + path, { method, headers: { authorization: `Bearer ${token}`, ...(body && !raw ? { 'content-type': 'application/json' } : {}), ...headers }, body: body ? (raw ? body : JSON.stringify(body)) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const code = j.error?.code || '';
    // 403 + 'scope': 토큰을 만들 때 Scope를 팀 하나로 골랐거나 권한이 좁은 토큰(실측 2026-11-23: "Trying to access resource under scope …") → 무엇을 다시 할지 알려 줌
    const scope = r.status === 403 && /scope/i.test(j.error?.message || '');
    const e = new Error(code === 'missing_files' ? '파일을 더 올려야 해요.' : scope ? VC_SCOPE : VC_ERR[r.status] || j.error?.message || `Vercel 오류 ${r.status}`);
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
      // 지난번 프로젝트를 Vercel에서 지웠거나 다른 계정 토큰이면(404) 새 프로젝트로 다시(계속 'Not Found'로 막히지 않게)
      if (projectId && e.status === 404 && e.code !== 'missing_files') return deployVercel({ token, name: name || wanted, projectId: '', files, onProgress });
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
  track('publish', 'vercel');
  return { url: `https://${host}/`, projectId: pid, name: pname, opened };
}

/** 이미 올린 Vercel 프로젝트에 로그인 창이 뜰 때: 참가자가 열 수 있게 보호(Vercel Authentication)를 끔 */
export const openVercel = (token, projectId) => vc(token, 'PATCH', `/v9/projects/${encodeURIComponent(projectId)}`, { ssoProtection: null });

// ── lecpage 바로 배포: 운영자가 켜 둔 경우에만(publish-api.js). 가입·토큰 없이 배포.
// 서버의 보기가 worker면 방문이 있는 동안 열려 있고(30일), pages면 사이트마다 다른 주소(s-<id>.….pages.dev)로 마지막으로 올린 날부터 정해진 날까지(info.keepAlive=false) ──
// 붐빌 때(넘침 처리, hosting/src/fair.js): 서버가 단계(info.capacity)·까닭(reason)·누구 몫인지(scope)·넘길 곳(next)을 알려 주고,
// 앱은 같은 파일 그대로 강사 계정에 배포하는 길로 넘김. 평소(open)에는 화면에 아무것도 더하지 않음
export { PUBLISH_API };
let infoP = null; let infoAt = 0;
/** 바로 배포를 쓸 수 있으면 { plan: 'free'|'paid', accepting, capacity?, limits: {maxBytes, maxFileBytes, maxFiles, days}, report, live? }, 아니면 null.
 * plan이 free면 운영자가 무료 요금제로 돌리는 것(하루 한도에 닿으면 그날 멈출 수 있음). capacity(붐빔 단계)는 instantGate가 읽음.
 * 배포 화면을 열 때 단계가 맞게 1분만 기억(서버·브라우저도 30초 기억) */
export function instantInfo(fresh = false) {
  if (!PUBLISH_API) return Promise.resolve(null);
  if (fresh || !infoP || Date.now() - infoAt > 60000) {
    infoAt = Date.now();
    // 느리게 막힌 망(응답 없이 붙잡힘)에서도 8초 안에 '닿지 않음'으로 끝냄. 못 받은 결과(null)는 오래 기억하지 않음(망이 돌아오면 다시 물음)
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 8000);
    infoP = fetch(`${PUBLISH_API}/api/info`, { signal: c.signal }).then((r) => (r.ok ? r.json() : null)).then((j) => (j?.ok ? j : null)).catch(() => null)
      .finally(() => clearTimeout(t)).then((j) => { if (!j) infoAt = Date.now() - 50000; else quotaNow = j.quota; return j; });
  }
  return infoP;
}
/**
 * 강사가 연결한 참여 기능 서버를 바로 배포한 사이트에서도 쓸 수 있는지: 바로 배포 서버가 사이트 CSP에 그 서버를 여는지(hosting/src/csp.js liveKind와 같은 코드).
 * 강사 계정 서버 모양(https의 *.workers.dev·*.supabase.co, 구글 시트)은 늘, 자기 도메인의 https 참여 기능 서버(node-server·cloudflare)는
 * 그것을 여는 서버(info.ownLive)일 때만. 예전 서버는 자기 도메인을 막으므로 그때는 바로 배포의 참여 기능 방을 씀
 * @param {{ provider?: string, url?: string }} live 연수의 참여 기능 연결
 * @param {{ ownLive?: boolean }|null} [info] instantInfo() 결과
 */
export function instantLiveOk(live, info = null) {
  if (!live?.url) return false;
  if (live.provider === 'sheets') return /^https:\/\/script\.google\.com\//.test(live.url);
  const kind = liveKind(live);
  return kind === 'account' || (kind === 'own' && !!info?.ownLive);
}

/** 앱이 알아듣는 것: 'split' = 그날 참여 기능 방이 차면 사이트는 받고 참여 기능만 강사 계정으로 넘기기 */
const CAPS = ['split'];
const DAY = 864e5;
/** 서버의 하루 몫이 다시 차는 때(00:00 UTC = 한국 시간 오전 9시) */
const nextReset = (now = Date.now()) => (Math.floor(now / DAY) + 1) * DAY;
/**
 * 기기 표: 계정이 없는 바로 배포가 기기마다 하루 몫을 세는 무작위 22자. 이 브라우저에만 두고 새 사이트를 만들 때만 보냄.
 * 이름·계정·다른 값과 묶지 않음(서버는 날짜와 함께 해시해 그날만 셈). 저장이 막힌 브라우저면 이번 탭 동안만
 */
/** 기기 표는 개인정보 처리방침에 알린 뒤 7일이 지난 날부터 보냄(그전에는 서버가 인터넷 주소로 셈). 근거: docs/legal/privacy.md 12 */
const DEVICE_FROM = Date.parse('2026-11-20T00:00:00+09:00');
let deviceMem = '';
export function deviceId() {
  if (deviceMem) return deviceMem;
  try { const v = localStorage.getItem('lecpage:device') || ''; if (/^[A-Za-z0-9_-]{22}$/.test(v)) return (deviceMem = v); } catch { /* 저장 막힘 */ }
  const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  deviceMem = Array.from(crypto.getRandomValues(new Uint8Array(22)), (x) => a[x & 63]).join('');
  try { localStorage.setItem('lecpage:device', deviceMem); } catch { /* 이번 탭 동안만 */ }
  return deviceMem;
}
/** 이 기기의 오늘 남은 새 사이트 몫(서버가 새 사이트를 만들 때 알려 줌). { left, scope: 'device'|'ip' } 또는 null(모름·하루가 바뀜) */
export function instantShare(now = Date.now(), quota = undefined) {
  try {
    const s = JSON.parse(localStorage.getItem('lecpage:instant-share') || 'null');
    if (!(s && s.until > now && Number.isFinite(s.left))) return null;
    // 서버가 횟수를 새로 세기 시작했으면(/api/info quota가 적어 둔 것과 다름) 예전에 적어 둔 몫은 버림. quota를 주지 않는 예전 서버는 견주지 않음
    if (quota !== undefined && quota !== null && s.quota !== quota) { localStorage.removeItem('lecpage:instant-share'); return null; }
    return s;
  } catch { return null; }
}
let quotaNow; // 마지막으로 받은 /api/info의 quota(횟수 초기화 번호). 몫을 적어 둘 때 같이 적음
function keepShare(left, scope, until = nextReset()) {
  try { localStorage.setItem('lecpage:instant-share', JSON.stringify({ left, scope, until, ...(quotaNow !== undefined && quotaNow !== null ? { quota: quotaNow } : {}) })); } catch { /* 몰라도 배포는 됨 */ }
}
/**
 * 바로 배포 서버가 지금 새 참여 기능 방을 여는지(/api/info live). live가 없으면 참여 기능을 쓰지 않는 서버,
 * accepting이 false면 지금은 방을 열지 않음, onlyBooked면 연수 날짜가 있는 사이트의 방만. 이 값들이 없는 예전 서버는 연다고 봄
 */
export const instantLiveOpen = (info, date = '') => !!info?.live?.url && info.live.accepting !== false && (!info.live.onlyBooked || !!date);
/** 'YYYY-MM-DD' + 'HH:MM'(한국 시간) → 그 시각. 시각이 없으면 오전 10시(서버와 같게) */
function kstAt(date, time = '') {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || '')); if (!m) return NaN;
  const t = /^(\d{1,2}):(\d{2})$/.exec(String(time || '')) || [0, '10', '00'];
  return Date.UTC(+m[1], +m[2] - 1, +m[3], Math.min(23, +t[1]) - 9, Math.min(59, +t[2]));
}
const MINE = '내 계정에 배포하면 같은 파일 그대로예요.';
/**
 * 배포 화면을 열 때: 서버의 붐빔 단계(info.capacity)로 바로 배포를 쓸 수 있는지(ok)와 한 줄(note).
 * note는 ok면 바로 배포 카드에, 아니면 내 계정으로 넘기는 자리에. hint는 작게(남은 몫이 1개일 때만).
 * 이미 배포한 사이트(hasSite)는 붐벼도 다시 배포가 됨(운영자가 멈춘 때만 빼고). 평소에는 { ok: true, note: '', hint: '' }
 * @param {object|null} info instantInfo()
 * @param {{ hasSite?: boolean, date?: string, start?: string, share?: { left: number, scope: string }|null, now?: number }} o
 */
export function instantGate(info, { hasSite = false, date = '', start = '', share = null, now = Date.now() } = {}) {
  const out = (ok, note = '', hint = '') => ({ ok, note, hint });
  if (!info) return out(false);
  const c = info.capacity; const reason = c?.reason || '';
  if (c?.state === 'paused' || info.paused) return out(false, `운영자가 잠시 새 배포를 멈췄어요. 이미 배포한 사이트는 그대로 열려요. ${MINE}`);
  if (reason === 'pages_api') return out(true, `배포하는 사람이 많아 잠깐 줄을 서고 있어요. 지금 누르면 ${koTime(c.retryAt || now + 60000, { now, day: false })}쯤 이어서 배포해요.`);
  if (hasSite) return out(true);
  if (c ? c.state === 'full' : info.accepting === false) {
    return out(false, reason === 'storage' ? `바로 배포 저장 공간이 가득 찼어요. ${MINE}` : `오늘은 바로 배포 자리가 다 찼어요. ${c?.resetAt ? `${koTime(c.resetAt, { now })}에 다시 받아요. ` : ''}${MINE}`);
  }
  // 이 브라우저에 적어 둔 '오늘 몫 0'만으로 막지 않음(망을 바꿨거나 운영자가 한도를 늘렸을 수 있음): 알리기만 하고 서버가 정함. 정말 다 썼으면 서버의 거절 문구가 카드에 나옴
  if (share?.left === 0) return out(true, '', `${share.scope === 'ip' ? '이 인터넷(공유기)' : '이 기기'}에서 오늘 만들 수 있는 새 사이트를 다 썼을 수 있어요. 안 되면 아래 [다른 곳에 배포]로 같은 파일을 배포할 수 있어요.`);
  if (c?.state === 'tight') {
    const busy = '오늘은 바로 배포가 붐벼서 연수 날짜가 2주 안인 사이트부터 받아요.';
    if (!date) return out(true, `${busy} 연수 날짜를 넣으면 먼저 받아요.`);
    const at = kstAt(date, start);
    if (!(at >= now - 12 * 3600e3 && at - now < 14 * DAY)) return out(false, `${busy} ${MINE}`);
  }
  return out(true, '', share?.left === 1 ? `${share.scope === 'ip' ? '이 인터넷' : '이 기기'}에서 오늘 바로 배포로 새 사이트를 1개 더 만들 수 있어요.` : '');
}
async function ip(method, path, { key, json, raw } = {}) {
  let r;
  try { r = await fetch(PUBLISH_API + path, { method, headers: { ...(key ? { authorization: `Bearer ${key}` } : {}), ...(json ? { 'content-type': 'application/json' } : raw ? { 'content-type': 'application/octet-stream' } : {}) }, body: json ? JSON.stringify(json) : raw }); }
  catch { const e = new Error('바로 배포 서버에 닿지 못했어요. 인터넷을 확인하고 다시 해 주세요.'); e.status = 0; throw e; }
  if (blockPage(r)) { const e = new Error('이 망에서 바로 배포 서버에 닿지 않아요. 회사·학교·기관 망이 막은 것 같아요. 휴대폰 핫스팟으로 바꾼 뒤 다시 해 주세요.'); e.status = 0; e.blocked = true; throw e; }
  const j = r.status === 204 ? {} : await r.json().catch(() => ({}));
  if (!r.ok) {
    const x = j.error || {}; const code = x.code || '';
    const e = new Error(code === 'runtime_mismatch' ? '앱이 새 버전으로 바뀌는 중이에요. 화면을 새로 고친 뒤 다시 해 주세요.' : x.message_ko || `바로 배포 오류 ${r.status}`);
    // 붐빔이면 까닭(reason)·누구 몫(scope: you 이 기기·이 인터넷만 | everyone 오늘 모두)·넘길 곳(next·liveNext)·다시 될 때(retryAt)·그날(day)
    Object.assign(e, { status: r.status, code, reason: x.reason || '', missing: x.missing || [], scope: x.scope || '', next: x.next || [], liveNext: x.liveNext || null, retryAt: Number(x.retryAt) || 0, day: x.day || '' });
    throw e;
  }
  return j;
}
/**
 * 줄 서기: Pages API 5분 창이 차면(reason 'pages_api') 서버가 알려 준 때까지 기다렸다가 저절로 다시 함.
 * 나란히 올리는 파일들은 같은 줄을 기다림. 세 번까지, 한 번에 6분까지
 */
function inLine(progress) {
  let tries = 0; let wait = null;
  return async (fn) => {
    for (;;) {
      if (wait) await wait;
      try { return await fn(); }
      catch (e) {
        if (e.reason !== 'pages_api') throw e;
        if (!wait) {
          if (++tries > 3) throw e;
          const now = Date.now(); const at = Math.min(now + 360e3, Math.max(now + 5000, e.retryAt || now + 60000));
          progress(`배포하는 사람이 많아 잠깐 줄을 서고 있어요. ${koTime(at, { now, day: false })}쯤 다시 해 볼게요.`);
          wait = sleep(at - now).then(() => { wait = null; });
        }
      }
    }
  };
}
/** 오늘·그날(date: 'YYYY-MM-DD') 바로 배포에 남은 몫과 사이트 상태(site: id). 못 물어보면 null */
export function instantStatus({ date = '', site = '' } = {}) {
  if (!PUBLISH_API) return Promise.resolve(null);
  const q = new URLSearchParams(); if (date) q.set('date', date); if (site) q.set('site', site);
  return fetch(`${PUBLISH_API}/api/status?${q}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
}
/**
 * @param {object} o { site: {id, key}(다시 올릴 때), title, files, onProgress,
 *   live?: { code, adminKeyHash, settings } 참여 기능 방을 이 사이트에 묶어 만듦(서버가 지원할 때),
 *   booking?: { date, start, end, people, network, live } 연수 날짜·인원(서버가 그날 몫을 미리 셈. 차면 만들 때 알려 줌),
 *   onLiveOff?: (liveOff) => Promise<files> 그날 참여 기능 방이 차서 서버가 참여 기능만 넘기라고 하면, 이 서버의 참여 기능을 뺀 파일을 다시 만듦 }
 * @returns {Promise<{url, altUrl?, view?, id, key, expiresAt, liveUrl?, liveOff?, advice?}>} altUrl: 학교망에서 첫 주소가 막힐 때 쓸 두 번째 주소,
 *   liveOff: { reason, day, next } 사이트는 바로 배포, 참여 기능은 강사 계정(next 순서), advice: 오래 쓸 사이트면 내 계정을 권함(새로 만들 때)
 */
/**
 * 배포를 끝내지 못한 바로 배포 사이트(연수마다 하나): 다시 누르면 새로 만들지 않고 이 사이트에 이어서 올림(실패할 때마다 하루 몫을 쓰지 않게).
 * 이 탭 동안은 여기에, 새로 고친 뒤에는 부른 쪽이 연수 기록에 남긴 것(onTry로 받아 tried로 다시 줌. 수정 키를 두는 곳과 같은 보관)
 */
const instantTries = new Map();
export async function deployInstant(o) {
  let step = '준비';
  const onProgress = o.onProgress || (() => { });
  try { return await deployInstantRun({ ...o, onProgress: (x) => { if (x?.step) step = x.step; onProgress(x); } }); }
  catch (e) {
    // 어디서 멈췄는지(개발자용 기록. 키·파일 내용은 적지 않음). 화면에는 Publish.jsx가 쉬운 말로 보임
    try { e.step = e.step || step; console.warn('[lecpage] 바로 배포 실패', { step: e.step, code: e.code || '', status: e.status ?? '', reason: e.reason || '' }); } catch { /* 기록만 */ }
    throw e;
  }
}
async function deployInstantRun({ site, title, files, live = null, booking = null, onLiveOff = null, onProgress = () => { }, tryKey = '', tried = null, onTry = null }) {
  let pct = 2;
  const progress = (step, at = pct) => { pct = at; onProgress({ step, pct }); };
  const queued = inLine(progress);
  progress('준비');
  // 지난번에 만들다 만 사이트: 이 탭의 기억 → 부른 쪽이 연수 기록에 남겨 둔 것(tried, 새로 고친 뒤에도 같은 사이트를 다시 씀)
  const first = site?.id && site?.key ? site : (tryKey && instantTries.get(tryKey)) || (tried?.id && tried?.key ? tried : null);
  let s = first;
  let liveOff = null; let advice = null;
  const off = (x) => { liveOff = { reason: x.reason || 'booked', day: x.day || booking?.date || '', next: x.next || x.liveNext || ['cloudflare', 'supabase'] }; };
  const newSite = async () => {
    try {
      const r = await queued(() => ip('POST', '/api/sites', { json: { title: String(title || '').slice(0, 120), ...(Date.now() >= DEVICE_FROM ? { device: deviceId() } : {}), caps: CAPS, ...(booking ? { booking } : {}) } }));
      if (r.share && Number.isFinite(r.share.left)) keepShare(r.share.left, r.share.scope);
      if (live && onLiveOff && r.live?.ok === false) off(r.live);
      if (r.advice?.code === 'long_term') advice = r.advice;
      return r;
    } catch (e) {
      // 이 기기·이 인터넷의 오늘 몫을 다 씀: 다른 연수의 배포 화면도 처음부터 내 계정으로
      if (e.scope === 'you' && (e.reason === 'device' || e.reason === 'ip')) keepShare(0, e.reason, e.retryAt || nextReset());
      throw e;
    }
  };
  const keep = (x) => {
    if (tryKey && x?.id && x?.key) { const t = { id: x.id, key: x.key, url: x.url, expiresAt: x.expiresAt }; instantTries.set(tryKey, t); try { onTry?.(t); } catch { /* 기억 못 해도 배포는 이어 감 */ } }
    return x;
  };
  if (!s) s = keep(await newSite());
  let blobs; let manifest;
  /** 올릴 파일 목록(sha256). 참여 기능을 넘겨야 하면 이 서버의 참여 기능을 뺀 파일로 먼저 다시 만듦 */
  const prepare = async () => {
    if (live && liveOff) { files = await onLiveOff(liveOff); live = null; }
    blobs = new Map(); manifest = {};
    for (const [path, v] of Object.entries(files)) {
      if (path === '_headers') continue; // 응답 헤더는 서버가 정함
      const bytes = toBytes(v); const sha256 = await hex('SHA-256', bytes); blobs.set(sha256, bytes); manifest[path] = { sha256, size: bytes.length };
    }
  };
  const deploys = async () => {
    const dp = await queued(() => ip('POST', `/api/sites/${s.id}/deploys`, { key: s.key, json: { files: manifest, caps: CAPS, ...(booking ? { booking } : {}) } }));
    // 다시 배포할 때 그날 방이 찼다고 하면: 참여 기능을 뺀 파일로 목록을 다시
    if (live && onLiveOff && dp.live?.ok === false) { off(dp.live); await prepare(); return deploys(); }
    return dp;
  };
  await prepare();
  progress('바뀐 파일 확인', 6);
  let dp;
  try { dp = await deploys(); }
  catch (e) {
    // 보관 기간이 끝나 지워진 사이트면 새 주소로 다시 만듦
    if (!(first && (e.status === 404 || e.status === 401))) throw e;
    // 다만 지난번에 그 대신 만들다 만 사이트가 있으면(지워진 사이트를 다시 배포하다 도중에 실패함) 그 사이트에 이어서: 누를 때마다 새로 만들어 하루 몫을 쓰지 않게
    const alt = [tryKey && instantTries.get(tryKey), tried].find((x) => x?.id && x?.key && x.id !== first.id) || null;
    if (tryKey) instantTries.delete(tryKey);
    dp = null;
    if (alt) {
      s = keep(alt);
      try { dp = await deploys(); }
      catch (e2) { if (!(e2.status === 404 || e2.status === 401)) throw e2; if (tryKey) instantTries.delete(tryKey); } // 그 사이트도 지워졌으면 아래에서 새로
    }
    if (!dp) {
      s = keep(await newSite());
      await prepare();
      dp = await deploys();
    }
  }
  const upload = async (list) => {
    const need = list.filter((h) => blobs.has(h)); let done = 0;
    // 진행 막대는 올린 크기로(쪽 그림 수백 장 사이에 큰 파일이 있어도 멈춘 것처럼 보이지 않게)
    const total = need.reduce((n, h) => n + blobs.get(h).length, 0) || 1; let sent = 0;
    const tick = (h) => { done++; sent += blobs.get(h).length; progress(`파일 올리기 ${done}/${need.length}`, 8 + Math.round(sent / total * 80)); };
    // 작은 파일(글꼴 조각·작은 그림 수백 개)은 요청 하나에 여럿 묶어 보냄: 서버가 받는다고 알려 줄 때만(/api/info limits.bundle). 예전 서버면 파일마다
    const bun = (await instantInfo())?.limits?.bundle;
    let single = need;
    if (bun?.bytes > 0 && bun.itemBytes > 0) {
      const groups = bundlesOf(need.filter((h) => blobs.get(h).length <= bun.itemBytes).map((h) => [h, blobs.get(h).length]), bun);
      const again = []; let off = false; const lost = new Map(); // 묶음 → 가는 길에 끊긴 횟수
      await pool(groups, 2, async (g) => {
        if (off) { again.push(...g.map(([h]) => h)); return; }
        let res;
        try { res = await queued(() => ip('PUT', `/api/sites/${s.id}/blobs`, { key: s.key, raw: packBundle(g.map(([h, n]) => [h, n, blobs.get(h)])) })); }
        catch (e) {
          // 가는 길에 끊긴 묶음(status 0: 망의 올리기 크기 제한·연결 끊김·시간 초과): pool이 두 번 더 해 보고, 그래도 안 되면 배포를 멈추지 않고
          // 이 묶음과 남은 묶음을 파일마다 올림(묶음 하나가 못 가서 사이트 전체가 실패하지 않게. 파일마다 올리면 끊겨도 그 파일 하나만 다시 감)
          if (!e.status) { const n = (lost.get(g) || 0) + 1; lost.set(g, n); if (n < 3) throw e; }
          // 묶음을 받지 않는 서버(404·405)이거나 묶음 한도·모양이 이 앱이 아는 것과 달라졌으면(413·400: 운영자가 한도를 줄인 직후 등) 파일마다 올림 → 진짜 거절이면 그때 까닭이 그대로 나옴
          else if (![404, 405, 413, 400].includes(e.status)) throw e;
          off = true; again.push(...g.map(([h]) => h)); return;
        }
        // 서버가 받지 못했다고 한 파일(내용이 틀림·받을 수 없는 내용)은 아래에서 하나씩 다시 보냄 → 진짜 거절이면 그때 까닭이 그대로 나옴
        const failed = new Set((res.failed || []).map((x) => x.sha256));
        for (const [h] of g) { if (failed.has(h)) again.push(h); else tick(h); }
      });
      const inGroup = new Set(groups.flat().map(([h]) => h));
      single = [...again, ...need.filter((h) => !inGroup.has(h))];
    }
    await pool(single, 4, async (h) => {
      await queued(() => ip('PUT', `/api/sites/${s.id}/blobs/${h}`, { key: s.key, raw: blobs.get(h) }));
      tick(h);
    });
  };
  await upload(dp.missing || []);
  let liveUrl = '';
  if (live) {
    progress('참여 기능 준비', 90);
    try { liveUrl = (await ip('POST', `/api/sites/${s.id}/live`, { key: s.key, json: live })).url || ''; }
    catch (e) {
      // 방 자리가 없음(붐빔·오늘 방 상한·그날 방이 참): 사이트는 그대로 배포하고 참여 기능만 강사 계정으로
      if (!e.liveNext || !onLiveOff) throw e;
      off({ reason: e.reason, day: e.day, next: e.liveNext });
      await prepare(); dp = await deploys(); await upload(dp.missing || []);
    }
  }
  progress('배포하는 중', 94);
  let out;
  for (let t = 0; ; t++) {
    try { out = await queued(() => ip('POST', `/api/sites/${s.id}/deploys/${dp.deploy}/publish`, { key: s.key })); break; }
    catch (e) {
      // 서버가 맡긴 곳(Pages)에서 파일이 사라졌으면 그 파일만 다시 올리고 한 번 더
      if (e.code !== 'missing_blobs' || !e.missing?.length || t >= 2) throw e;
      await upload(e.missing);
    }
  }
  progress('완료', 100);
  if (tryKey) instantTries.delete(tryKey);
  forgetRecords(s.id); // 다시 배포로 방이 바뀌었을 수 있음: 기록 수를 새로 받게
  track('publish', 'instant');
  return { url: out.url || s.url, ...(out.altUrl ? { altUrl: out.altUrl } : {}), ...(out.view ? { view: out.view } : {}), id: s.id, key: s.key, expiresAt: out.expiresAt || s.expiresAt || 0, liveUrl, ...(liveOff ? { liveOff } : {}), ...(advice ? { advice } : {}) };
}
/**
 * 배포 취소(Vercel): 이 연수가 만든 프로젝트를 지움(주소가 더 열리지 않음). 이미 없으면 그대로 끝.
 * strict: '없음(404)'도 실패로 돌려줌 — lecpage 커넥트로 올린 프로젝트는 다른 팀에 있을 수 있어, 이 토큰에는 404여도 사이트는 그대로 열림
 */
export async function undeployVercel({ token, projectId, strict = false }) {
  try { await vc(token, 'DELETE', `/v9/projects/${encodeURIComponent(projectId)}`); } catch (e) { if (e.status !== 404 || strict) throw e; }
}
/** 배포 취소(Netlify): 이 연수가 만든 사이트를 지움 */
export async function undeployNetlify({ token, siteId }) {
  const r = await net(`https://api.netlify.com/api/v1/sites/${encodeURIComponent(siteId)}`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });
  if (!r.ok && r.status !== 404) { const e = new Error(NF_ERR[r.status] || `Netlify 오류 ${r.status}`); e.status = r.status; throw e; }
}
/** 배포 취소(GitHub Pages): Pages만 끔(주소가 더 열리지 않음). 저장소와 파일은 내 GitHub에 그대로 남음 */
export async function undeployGitHub({ token, repo }) {
  const me = await gh(token, 'GET', '/user');
  try { await gh(token, 'DELETE', `/repos/${me.login}/${encodeURIComponent(repo)}/pages`); } catch (e) { if (e.status !== 404) throw e; }
}
/** 바로 배포한 사이트 지우기 */
export const deleteInstant = (site) => ip('DELETE', `/api/sites/${site.id}`, { key: site.key }).finally(() => forgetRecords(site.id));
/**
 * 바로 배포한 사이트의 참여 기록 수(내리기·다시 배포 전에 알려 줄 때). 내용은 받지 않음.
 * @returns {Promise<{ live: boolean, counts?: { participants, attendance, questions, posts, answers, survey }, last?: number }|null>} 못 물어보면 null(망·지워진 사이트·옛 서버)
 */
export function instantRecords(site) {
  if (!PUBLISH_API || !site?.id || !site?.key) return Promise.resolve(null);
  // 배포하기 화면을 열면 체크리스트와 바로 배포 카드가 같은 것을 함께 물음 → 15초 안의 같은 물음은 한 번만 보냄(서버 요청·객체 요청을 줄임).
  // 배포·배포 취소 뒤에는 forgetRecords로 버려 바로 새 값을 받음. 못 받은 답(null)은 기억하지 않음
  const hit = recordsMem.get(site.id);
  if (hit && Date.now() - hit.at < 15000) return hit.p;
  const p = ip('GET', `/api/sites/${site.id}/records`, { key: site.key }).catch(() => null).then((r) => { if (!r && recordsMem.get(site.id)?.p === p) recordsMem.delete(site.id); return r; });
  if (recordsMem.size > 50) recordsMem.clear();
  recordsMem.set(site.id, { at: Date.now(), p });
  return p;
}
const recordsMem = new Map(); // 사이트 id → { at, p }
/** 그 사이트의 참여 기록 수를 다시 묻게 함(배포·배포 취소 뒤) */
export function forgetRecords(id) { if (id) recordsMem.delete(id); else recordsMem.clear(); }
/** 기록 수 → 한 줄 조각("참가자 12명 · 질문 8개 · 보드 글 3개"). 하나도 없으면 '' */
export function recordsLine(r) {
  const c = r?.counts; if (!c) return '';
  return [['participants', '참가자', '명'], ['questions', '질문', '개'], ['posts', '보드 글', '개'], ['survey', '설문 응답', '개']].filter(([k]) => c[k] > 0).map(([k, t, u]) => `${t} ${c[k]}${u}`).join(' · ');
}

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
  catch { const e = new Error('is.gd에 닿지 못했어요. 기관·회사 망이 막았을 수 있어요. 다른 서비스로 만들어 붙여 넣어 주세요.'); e.code = 'network'; throw e; }
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
  if (!/^https:\/\/[^\s/]+\.[^\s]+$/.test(target)) throw new Error('배포한 주소(https://)만 줄일 수 있어요.');
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
  let shown = u.pathname + u.search; try { shown = decodeURIComponent(shown); } catch { /* 그대로 */ }
  if (/[\u200B-\u200F\u202A-\u202E\u2060-\u2069\u00AD\uFEFF]/.test(s + shown)) return { error: '보이지 않는 글자가 들어 있어요. 주소를 직접 다시 쳐 주세요.' };
  if (u.href.length > 200) return { error: '너무 길어요. 짧은 주소를 넣어 주세요.' };
  if (SHORT_HOME.test(host) && u.pathname === '/' && !u.search) return { error: '만든 짧은 주소를 끝까지 넣어 주세요. 예: joo.is/우리연수' };
  if (siteUrl && bareUrl(u.href) === bareUrl(siteUrl)) return { error: '사이트 주소와 같아요. 줄인 주소를 넣어 주세요.' };
  return { url: u.href };
}

// 크기 한도 도우미(바로 배포 서버의 한도로 보기·큰 교재 원본 빼기·알리는 한 줄)는 site-size.js에(다른 모듈 없이 Node 시험에서도 부를 수 있게)
export { sizeText, instantFit, fitOriginals, leftLine, slidesCover } from './site-size.js';
import { bundlesOf, packBundle } from './site-size.js';

/** 사이트 파일의 크기 정보(올릴 곳 한도 확인용) */
export function siteStat(files) {
  let bytes = 0, maxFile = 0, binaries = 0, kept = 0; const names = Object.keys(files);
  for (const k of names) {
    const n = typeof files[k] === 'string' ? new TextEncoder().encode(files[k]).length : files[k].byteLength ?? files[k].length ?? 0;
    bytes += n; if (n > maxFile) maxFile = n; if (!isText(k)) binaries++;
    if (KEPT_RE.test(k)) kept += n; // 바로 배포 서버가 따로 합계를 보는 것(웹 문서·영상·소리: hosting keepsHere)
  }
  return { bytes, maxFile, files: names.length, binaries, kept };
}
const KEPT_RE = /\.(?:html|mp3|m4a|mp4|webm)$/i;

/**
 * 여러 곳에 배포한 기록 합치기(순수 함수). deploy.lastUrl·target은 '지금 대표 주소와 그 곳'이라는 뜻 그대로,
 * deploy.sites = { 곳: { url, at } }는 곳마다 마지막 주소. QR·강사 화면은 lastUrl을 따름.
 * - 새로 배포(url 있음): 그곳이 대표가 됨. 이미 있던 다른 곳에 다시 배포하면 대표는 그대로
 * - 삭제(url ''): 그곳 기록을 지우고, 대표였으면 가장 최근에 배포한 다른 곳이 대표(없으면 비움)
 * @returns {{ sites, lastUrl, target, at }}
 */
export function mergeSite(d = {}, url, target, opts = {}) {
  // opts: { live: 이 사이트에 참여 기능이 들어갔는지(true·false, 모르면 null), keepMain: 대표 주소를 그대로 둘지, now }
  if (typeof opts === 'number') opts = { now: opts }; // 예전 호출(now만 넘김)
  const now = opts.now || Date.now();
  const sites = { ...(d.sites || {}) };
  if (!d.sites && d.lastUrl && d.target) sites[d.target] = { url: d.lastUrl, at: d.at || 0 }; // 예전 기록 옮기기
  let lastUrl = url; let tgt = target; let at = now;
  if (url) {
    const had = !!sites[target];
    const live = typeof opts.live === 'boolean' ? opts.live : sites[target]?.live; // 모르면(주소만 다시 저장) 지난 표시 그대로
    const lock = opts.lock || sites[target]?.lock; // 배포할 때의 공개 범위·암호(배포한 뒤 바꾸면 다시 배포할 때까지 사이트는 그대로)
    sites[target] = { url, at: now, ...(typeof live === 'boolean' ? { live } : {}), ...(lock ? { lock } : {}) };
    if ((had || opts.keepMain) && d.lastUrl && d.target && d.target !== target && sites[d.target]) { lastUrl = d.lastUrl; tgt = d.target; at = d.at || now; }
  } else {
    delete sites[target];
    const rest = Object.entries(sites).sort((a, b) => (b[1].at || 0) - (a[1].at || 0))[0];
    if (d.target === target || !d.lastUrl) { if (rest) { lastUrl = rest[1].url; tgt = rest[0]; at = rest[1].at || now; } else { lastUrl = ''; tgt = target; } }
    else { lastUrl = d.lastUrl; tgt = d.target; at = d.at || now; }
  }
  return { sites, lastUrl, target: tgt, at };
}
