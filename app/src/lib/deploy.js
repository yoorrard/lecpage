// 브라우저에서 바로 배포(사용자 토큰). 토큰은 이 탭에서만 쓰고 저장하지 않는 것이 기본입니다.
const GH = 'https://api.github.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isText = (p) => /\.(html|css|js|json|md|svg|txt|webmanifest)$/i.test(p);

export const GITHUB_TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new?name=lecpage-deploy&description=lecpage%EB%A1%9C%20%EB%A7%8C%EB%93%A0%20%EC%97%B0%EC%88%98%20%EC%82%AC%EC%9D%B4%ED%8A%B8%20%EB%B0%B0%ED%8F%AC&expires_in=30&administration=write&contents=write&pages=write';
export const NETLIFY_TOKEN_URL = 'https://app.netlify.com/user/applications#personal-access-tokens';

async function gh(token, method, path, body) {
  const r = await fetch(GH + path, { method, headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = r.status === 204 ? {} : await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.message || `GitHub 오류 ${r.status}`); e.status = r.status; throw e; }
  return j;
}
function b64(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }

/**
 * GitHub Pages 배포: 저장소 만들기(없으면) → 이미지 등 바이너리 blob(분당 80회 제한 고려해 천천히) → 글 파일은 tree에 바로 → 커밋 → Pages 켜기
 */
export async function deployGitHub({ token, repo, files, onProgress = () => { } }) {
  const me = await gh(token, 'GET', '/user');
  const owner = me.login;
  onProgress({ step: '저장소 확인', pct: 3 });
  let r;
  try { r = await gh(token, 'GET', `/repos/${owner}/${repo}`); }
  catch (e) {
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
  onProgress({ step: '파일 묶기', pct: 84 });
  const t = await gh(token, 'POST', `/repos/${owner}/${repo}/git/trees`, { tree }); // base_tree 없이: 사이트 파일만 남김
  const c = await gh(token, 'POST', `/repos/${owner}/${repo}/git/commits`, { message: 'lecpage로 연수 사이트 배포', tree: t.sha, parents: [baseSha] });
  await gh(token, 'PATCH', `/repos/${owner}/${repo}/git/refs/heads/${branch}`, { sha: c.sha, force: true });
  onProgress({ step: 'Pages 켜기', pct: 92 });
  try { await gh(token, 'POST', `/repos/${owner}/${repo}/pages`, { source: { branch, path: '/' } }); }
  catch (e) { if (e.status !== 409 && e.status !== 422) throw e; }
  let url = `https://${owner}.github.io/${repo}/`;
  try { const pg = await gh(token, 'GET', `/repos/${owner}/${repo}/pages`); if (pg.html_url) url = pg.html_url; } catch { }
  onProgress({ step: '완료(첫 배포는 1~2분 뒤 열려요)', pct: 100 });
  return { url, repoUrl: `https://github.com/${owner}/${repo}` };
}

/** Netlify: 사이트 만들기와 배포를 zip 한 번으로 */
export async function deployNetlify({ token, siteId, zip, name, onProgress = () => { } }) {
  onProgress({ step: siteId ? '새 버전 올리기' : '사이트 만들기', pct: 10 });
  const url = siteId ? `https://api.netlify.com/api/v1/sites/${siteId}/deploys` : `https://api.netlify.com/api/v1/sites${name ? `?name=${encodeURIComponent(name)}` : ''}`;
  const r = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/zip' }, body: zip });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.message || `Netlify 오류 ${r.status}`);
  onProgress({ step: '처리 중', pct: 70 });
  const site = siteId || j.site_id || j.id;
  const deployId = j.deploy_id || j.id;
  for (let i = 0; i < 30; i++) {
    await sleep(2000);
    const s = await fetch(`https://api.netlify.com/api/v1/sites/${site}/deploys/${deployId}`, { headers: { authorization: `Bearer ${token}` } }).then((x) => x.json()).catch(() => ({}));
    if (s.state === 'ready') { onProgress({ step: '완료', pct: 100 }); return { url: s.ssl_url || s.url || j.ssl_url, siteId: site }; }
    if (s.state === 'error') throw new Error(s.error_message || 'Netlify 배포 실패');
  }
  return { url: j.ssl_url || j.url, siteId: site };
}
