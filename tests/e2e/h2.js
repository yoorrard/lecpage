// 공용: 가짜 Vercel·GitHub·Netlify·is.gd API + 예시로 시작해 공개하기 화면까지 가기
const { chromium } = require('./pw.js');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:4182/';
const ROOT = require('path').resolve(__dirname, '../../.out/verify/share') + '/';
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const mime = (f) => (/\.html$/.test(f) ? 'text/html; charset=utf-8' : /\.css$/.test(f) ? 'text/css' : /\.js$/.test(f) ? 'text/javascript' : /\.svg$/.test(f) ? 'image/svg+xml' : /\.json|\.webmanifest$/.test(f) ? 'application/json' : /\.png$/.test(f) ? 'image/png' : /\.woff2$/.test(f) ? 'font/woff2' : 'application/octet-stream');

async function mockAll(ctx, state = {}) {
  Object.assign(state, { calls: [], deployBody: null, polls: 0, uploads: [], have: new Set(), posts: 0, patched: null, projectExists: false, site: {}, blobs: {}, isgd: [], isgdTaken: new Set(['taken1']), isgdDown: false, gh: { repos: {}, calls: [] }, nf: { calls: [], deploys: 0 } });
  await ctx.route(/^https?:\/\/(?!localhost)/, async (r) => {
    const req = r.request(); const u = new URL(req.url()); const m = req.method();
    const json = (o, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(o) });
    if (u.host === 'maum-class.vercel.app') {
      // 올린 파일을 그대로 돌려줘서 poster.html·screen.html을 실제로 열어 볼 수 있게
      const path = decodeURIComponent(u.pathname.replace(/^\//, '')) || 'index.html';
      const f = state.site[path];
      if (f) return r.fulfill({ status: 200, contentType: mime(path), body: f });
      if (/favicon\.svg/.test(path)) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>' });
      return r.fulfill({ status: 404, body: 'not found' });
    }
    if (/\.(github\.io|netlify\.app)$/.test(u.host)) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>' });
    if (u.host === 'is.gd') {
      if (state.isgdDown) return r.abort();
      // 앱의 망 확인(netcheck: 주소 없이 한 번 물음)은 진짜 is.gd처럼 '주소가 없어요'로 답하고 기록하지 않음
      if (!u.searchParams.get('url')) return json({ errorcode: 1, errormessage: 'Please specify a URL to shorten.' });
      const alias = u.searchParams.get('shorturl') || ''; state.isgd.push({ url: u.searchParams.get('url'), alias, ref: req.headers().referer || '' });
      if (alias && state.isgdTaken.has(alias)) return json({ errorcode: 2, errormessage: 'The shortened URL you picked already exists, please choose another.' });
      return json({ shorturl: 'https://is.gd/' + (alias || 'AbC123') });
    }
    if (u.host === 'api.github.com') {
      if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
      const g = state.gh; g.calls.push(`${m} ${u.pathname}`);
      const tok = req.headers().authorization;
      if (tok !== 'Bearer github_pat_FAKE_TOKEN_1234567890') return json({ message: 'Bad credentials' }, 401);
      const mm = u.pathname.match(/^\/repos\/teacher\/([^/]+)(\/.*)?$/);
      if (u.pathname === '/user') return json({ login: 'teacher' });
      if (u.pathname === '/user/repos' && m === 'POST') { const b = JSON.parse(req.postData()); g.repos[b.name] = { files: null }; return json({ name: b.name, default_branch: 'main' }, 201); }
      if (mm) {
        const repo = g.repos[mm[1]]; const rest = mm[2] || '';
        if (!repo) return json({ message: 'Not Found' }, 404);
        if (!rest) return json({ name: mm[1], default_branch: 'main' });
        if (rest === '/contents/.lecpage-site') return repo.files ? json({ name: '.lecpage-site' }) : json({ message: 'Not Found' }, 404);
        if (rest === '/git/ref/heads/main') return json({ object: { sha: 'base0' } });
        if (rest === '/git/blobs') return json({ sha: 'blob' + (g.calls.length) }, 201);
        if (rest === '/git/trees') { repo.files = JSON.parse(req.postData()).tree.map((t) => t.path); return json({ sha: 'tree1' }, 201); }
        if (rest === '/git/commits') return json({ sha: 'commit1' }, 201);
        if (rest === '/git/refs/heads/main') return json({ ref: 'refs/heads/main' });
        if (rest === '/pages' && m === 'POST') return json({ html_url: `https://teacher.github.io/${mm[1]}/` }, 201);
        if (rest === '/pages') return json({ html_url: `https://teacher.github.io/${mm[1]}/` });
      }
      return json({ message: 'Not Found' }, 404);
    }
    if (u.host === 'api.netlify.com') {
      if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
      const n = state.nf; n.calls.push(`${m} ${u.pathname}${u.search}`);
      if (req.headers().authorization !== 'Bearer nfp_FAKE_TOKEN_1234567890') return json({ message: 'Access Denied' }, 401);
      if (u.pathname === '/api/v1/user') return json({ id: 'u1' });
      if (u.pathname === '/api/v1/sites' && m === 'POST') { n.deploys++; n.zip = (req.postDataBuffer() || Buffer.alloc(0)).length; return json({ id: 'site1', site_id: 'site1', deploy_id: 'd1', ssl_url: 'https://maum-nf.netlify.app' }, 201); }
      if (u.pathname === '/api/v1/sites/site1/deploys' && m === 'POST') { n.deploys++; return json({ id: 'd2', site_id: 'site1' }); }
      if (/^\/api\/v1\/sites\/site1\/deploys\/d\d$/.test(u.pathname)) return json({ state: 'ready', ssl_url: 'https://maum-nf.netlify.app' });
      return json({}, 404);
    }
    if (u.host !== 'api.vercel.com') return process.env.E2E_REMOTE === '1' ? r.continue() : r.abort(); // E2E_REMOTE=1: 운영 주소로 돌릴 때 앱 파일·CDN은 그대로 받음
    if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    state.calls.push(`${m} ${u.pathname}`);
    const authed = !state.revoked && req.headers().authorization === 'Bearer vcp_FAKE_TOKEN_1234567890';
    if (!authed) return json({ error: { code: 'forbidden', message: 'Not authorized', invalidToken: true } }, 403);
    if (u.pathname === '/v9/projects' && m === 'GET') return json({ projects: [] });
    if (u.pathname === '/v9/projects/maum-class' && m === 'GET') return state.projectExists ? json({ id: 'prj_1', name: 'maum-class' }) : json({ error: { code: 'not_found' } }, 404);
    if (u.pathname === '/v2/files') { const d = req.headers()['x-vercel-digest']; state.have.add(d); const buf = req.postDataBuffer() || Buffer.alloc(0); state.blobs[d] = buf; state.uploads.push({ digest: d, type: req.headers()['content-type'], size: buf.length }); return json({ urls: [] }); }
    if (u.pathname === '/v13/deployments' && m === 'POST') {
      state.posts++; state.deployBody = JSON.parse(req.postData());
      const missing = state.deployBody.files.map((f) => f.sha).filter((s) => !state.have.has(s));
      if (missing.length) return json({ error: { code: 'missing_files', message: 'Missing files', missing } }, 400);
      for (const f of state.deployBody.files) if (state.blobs[f.sha]) state.site[f.file] = state.blobs[f.sha];
      return json({ id: 'dpl_1', url: 'maum-class-abc123.vercel.app', name: state.deployBody.name, projectId: 'prj_1', readyState: 'QUEUED' });
    }
    if (u.pathname === '/v13/deployments/dpl_1') { state.polls++; return json(state.polls < 2 ? { id: 'dpl_1', readyState: 'BUILDING' } : { id: 'dpl_1', readyState: 'READY', aliasAssigned: true, url: 'maum-class-abc123.vercel.app', alias: ['maum-class-teacher.vercel.app', 'maum-class.vercel.app'], name: 'maum-class', projectId: 'prj_1' }); }
    if (u.pathname === '/v9/projects/prj_1' && m === 'GET') return json({ id: 'prj_1', name: 'maum-class', ssoProtection: { deploymentType: 'all' } });
    if (u.pathname === '/v9/projects/prj_1' && m === 'PATCH') { state.patched = JSON.parse(req.postData()); return json({ id: 'prj_1' }); }
    return json({}, 404);
  });
  return state;
}

async function openShare(p, example = '마음이 먼저') {
  await p.goto(BASE, { waitUntil: 'load' });
  await p.click(`.ex-card:has-text("${example}") button:has-text("이 예시로 시작")`);
  await p.waitForSelector('.pv-device iframe', { timeout: 30000 });
  await p.click('button:has-text("배포하기 →"), button:has-text("공개하기 →")'); await p.waitForSelector('.publish');
}
/** 고른 곳에 토큰으로 연결(순서의 마지막 단계에서 토큰을 넣고 [연결]) */
async function connect(p, token, scope = '.publish') {
  // 로그인 한 번이 먼저인 곳(Netlify, 커넥트가 켜진 Vercel)은 토큰 순서가 접힌 '다른 방법: 토큰으로 연결' 안에 있음
  const alt = p.locator(`${scope} details.run-alt:not([open]) > summary:has-text("토큰으로 연결")`);
  if (await alt.count()) await alt.first().click();
  await p.click(`${scope} .walk-h:has-text("토큰 붙여넣기")`);
  await p.fill(`${scope} .walk input[type=password]`, token);
  await p.click(`${scope} .walk-b button:has-text("연결")`);
}
/** [공개하기]를 누르고, 참여 기능 확인 창이 뜨면 '없이 올리기' */
async function publish(p) {
  await p.click('.publish .btn-primary.btn-lg');
  await p.waitForSelector('dialog[open] button:has-text("참여 기능 없이")', { timeout: 2500 }).then((b) => b.click()).catch(() => {});
}
const toastHas = (p, re, timeout = 60000) => p.waitForFunction((src) => new RegExp(src).test(document.querySelector('.toast')?.textContent || ''), re.source, { timeout });

function watch(p) {
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/ERR_|net::|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
  return errs;
}

module.exports = { chromium, fs, BASE, ROOT, mockAll, openShare, connect, publish, toastHas, watch };
