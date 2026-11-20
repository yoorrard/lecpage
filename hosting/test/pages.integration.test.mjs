// 통합 시험(VIEW=pages): 로컬 workerd + 흉내 Cloudflare API(test/fake-cf.mjs).
// 앱과 같은 순서로 올리면 → 서버가 검사하고 Pages에 직접 올려 브랜치 s-<id>에 배포 → Pages 주소를 돌려줌.
// 흉내 서버는 manifest의 열쇠가 내용의 blake3(base64 + 확장자)와 맞는지(wrangler와 같은지) 확인합니다.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { HOSTING, buildSite, aiSite, AI_SITE_JS, manifestOf, sha256, startHost, call, deploy } from './helpers.mjs';
import { startFakeCf, ACCOUNT, TOKEN } from './fake-cf.mjs';
import { siteCsp, auxCsp, LIB_SCRIPT_SOURCES } from '../src/csp.js';

const ADMIN = 'it-admin-' + randomBytes(12).toString('hex');
const te = new TextEncoder();
const closers = [];
after(async () => { for (const c of closers.reverse()) await c(); });
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
const MP4 = new Uint8Array(3000).map((_, i) => i % 251);
const get = async (url, init) => { const r = await fetch(url, { redirect: 'manual', ...init }); return { status: r.status, headers: r.headers, text: await r.text() }; };

test('VIEW=pages: 만들기 → 검사·Pages 올리기 → 공개 → 다시 배포 → 사라진 자산 → 가리기·풀기 → 지우기', async (t) => {
  if (!existsSync(join(HOSTING, 'node_modules', 'wrangler', 'bin', 'wrangler.js'))) return t.skip('wrangler가 설치되지 않았어요');
  const cf = await startFakeCf();
  closers.push(cf.stop);
  let h;
  try {
    h = await startHost({
      ADMIN_KEY: ADMIN, SITES_PER_HOUR: 100, SITES_PER_DAY: 1000, MAX_FILES: 80, CATALOG_URL: 'off', // 하루 점검이 바깥(lecpage.com)에 묻지 않게
      VIEW: 'pages', CF_ACCOUNT_ID: ACCOUNT, PAGES_PROJECT: 'lecpage-view', PAGES_TOKEN: TOKEN, PAGES_HOST: `127.0.0.1:${cf.port}`,
      PAGES_SITE_URL: `${cf.url}/__view/{branch}/`, CF_API_BASE: cf.api,
    });
  } catch (e) { return t.skip(`workerd를 띄우지 못함: ${String(e.message).split('\n')[0]}`); }
  closers.push(h.stop);
  const base = h.url;

  const info = await call(base, 'GET', '/api/info');
  assert.equal(info.body.view, 'pages');
  assert.equal(info.body.siteScripts, true, 'AI가 쓴 사이트 스크립트를 받음');
  assert.equal(info.body.keepAlive, false, 'Pages 보기는 방문으로 기간을 늘리지 않음');
  assert.equal(info.body.limits.days, 60, '기본 보관 기간 60일(마지막으로 배포한 날부터)');

  const files = await buildSite('sel-story', { assets: { 'assets/media/사진 (1).png': PNG, 'assets/media/수업 영상.mp4': MP4, 'assets/files/명단.csv': te.encode('이름\n') } });
  // 엔진이 담은 글꼴(글꼴 함께 담기): 이름 = 내용 SHA-256 앞 16자리
  const font = te.encode('wOF2 시험 글꼴'); files[`assets/fonts/${sha256(font).slice(0, 16)}.woff2`] = font;
  const made = await call(base, 'POST', '/api/sites', { json: { title: 'Pages 시험' } });
  assert.equal(made.status, 201);
  const site = made.body;
  assert.equal(site.url, `${cf.url}/__view/s-${site.id}/`);
  assert.equal(site.altUrl, `${base}/s/${site.id}/`);

  await t.test('올리기: 서비스 워커를 등록하는 사이트 스크립트는 Pages에 가기 전에 막음', async () => {
    const evil = "navigator.serviceWorker.register('sw.js'); alert(1)";
    const bad = { ...files, 'assets/evil.js': te.encode(evil) };
    const r = await deploy(base, site, bad);
    assert.equal(r.step, 'blobs'); assert.equal(r.status, 422); assert.equal(r.body.error.code, 'unsafe_site'); assert.equal(r.body.error.rule, 'service_worker');
    assert.equal(r.body.error.path, 'assets/evil.js'); assert.match(r.body.error.message_ko, /서비스 워커를 등록하는 코드가 있어요/);
    assert.ok(![...cf.state.assets.values()].some((a) => a.bytes.toString() === evil), '검사에 걸린 파일은 Pages에 올리지 않음');
    // 런타임처럼 시작하는데 다르면(손댄 런타임·앱과 서버의 판이 어긋남) 사이트 스크립트로 받지 않고 runtime_mismatch(앱: 새로 고친 뒤 다시)
    const tampered = { ...files, 'assets/lecpage.js': te.encode(new TextDecoder().decode(files['assets/lecpage.js']) + '\n;fetch("https://evil.example/")') };
    const r2 = await deploy(base, site, tampered);
    assert.equal(r2.step, 'blobs'); assert.equal(r2.body.error.code, 'runtime_mismatch'); assert.equal(r2.body.error.path, 'assets/lecpage.js');
  });

  let first;
  await t.test('공개: Pages 배포, 주소, 머리글, 손본 HTML, 영상은 Worker로', async () => {
    const r = await deploy(base, site, files);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.url, site.url); assert.equal(r.body.altUrl, site.altUrl); assert.equal(r.body.view, 'pages');
    assert.deepEqual(cf.state.badHash, [], 'manifest 열쇠가 wrangler 계산과 같음');
    const deps = cf.deploymentsOf(`s-${site.id}`);
    assert.equal(deps.length, 1);
    first = deps[0];
    const m = first.manifest;
    assert.ok(m['/index.html'] && m['/robots.txt'] && m['/404.html'] && m['/assets/media/사진 (1).png'] && m['/assets/files/명단.csv']);
    assert.ok(!m['/assets/media/수업 영상.mp4'], '영상은 Pages에 올리지 않음');
    assert.ok(!m['/_headers'], '사이트가 보낸 _headers는 쓰지 않음');
    assert.ok(first.headers.startsWith(`/*\n  ! Access-Control-Allow-Origin\n  Content-Security-Policy: ${siteCsp({ host: base, site: site.id, pages: true })}\n`), first.headers.slice(0, 600));
    assert.ok(first.headers.includes(`/check\n  ! Content-Security-Policy\n  Content-Security-Policy: ${auxCsp()}\n`), '보조 쪽은 예전 CSP');
    assert.match(first.headers, /\/\*\.csv\n {2}Content-Disposition: attachment/);
    assert.match(first.headers, /\/console\n {2}X-Frame-Options: DENY/);
    assert.match(first.headers, /\/assets\/fonts\/\*\n {2}Cache-Control: public, max-age=31536000, immutable\n/, '이름이 내용 해시인 글꼴은 1년 캐시');
    assert.ok(first.redirects.includes(`/assets/media/%EC%88%98%EC%97%85%20%EC%98%81%EC%83%81.mp4 ${base}/s/${site.id}/assets/media/%EC%88%98%EC%97%85%20%EC%98%81%EC%83%81.mp4 302`), first.redirects);
    // 보기(Pages)
    const page = await get(site.url);
    assert.equal(page.status, 200);
    assert.ok(page.text.includes(`href="${base}/report?site=${site.id}"`), '신고 링크는 호스트 주소로');
    assert.ok(page.text.includes(`<meta property="og:url" content="${site.url}">`), '미리보기 카드 주소는 Pages 주소');
    assert.ok(!/\?v=[0-9a-f]{12}/.test(page.text) && !page.text.includes('/rt/'), '지문·정적 사본 주소는 Worker 보기에서만');
    assert.equal(page.headers.get('content-security-policy'), siteCsp({ host: base, site: site.id, pages: true }));
    assert.equal(page.headers.get('access-control-allow-origin'), null);
    const robots = await get(`${site.url}robots.txt`);
    assert.ok(robots.text.includes('kakaotalk-scrap') && /User-agent: \*\nDisallow: \//.test(robots.text));
    const mv = await get(`${site.url}assets/media/${encodeURIComponent('수업 영상.mp4')}`);
    assert.equal(mv.status, 302); assert.ok(mv.headers.get('location').startsWith(`${base}/s/${site.id}/`));
    // 영상: Worker가 Range까지
    const v = await fetch(`${base}/s/${site.id}/assets/media/${encodeURIComponent('수업 영상.mp4')}`, { headers: { range: 'bytes=0-9' } });
    assert.equal(v.status, 206); assert.equal(v.headers.get('content-range'), `bytes 0-9/${MP4.length}`);
    // 두 번째 주소(학교망에서 pages.dev가 막혔을 때): 이 호스트가 Pages에서 가져와 내보냄
    const alt = await get(site.altUrl);
    assert.equal(alt.status, 200); assert.ok(alt.text.includes(`href="${base}/report?site=${site.id}"`));
    assert.match(alt.headers.get('content-security-policy'), /script-src 'self'/);
    const altCon = await get(`${site.altUrl}console.html`);
    assert.equal(altCon.status, 308); assert.equal(altCon.headers.get('location'), `/s/${site.id}/console`);
    const con = await get(`${base}/s/${site.id}/console`);
    assert.equal(con.status, 200); assert.equal(con.headers.get('x-frame-options'), 'DENY');
  });

  await t.test('프로젝트 첫 주소: 본 배포가 없으면 처음 공개 때 안내 화면을 한 번 올림(설정 스크립트가 못 올렸을 때)', async () => {
    for (let i = 0; i < 60 && !cf.deploymentsOf('main').length; i++) await new Promise((r) => setTimeout(r, 100));
    const main = cf.deploymentsOf('main');
    assert.equal(main.length, 1);
    assert.deepEqual(Object.keys(main[0].manifest).sort(), ['/404.html', '/index.html']);
    assert.match(main[0].headers, /X-Robots-Tag: noindex, nofollow/);
    const root = await get(`${cf.url}/__view/main/`);
    assert.match(root.text, /이 사이트는 보관 기간이 끝났어요/);
  });

  await t.test('다시 배포: 바뀐 파일만 받고 지난 배포는 지움', async () => {
    const changed = { ...files, 'index.html': te.encode(new TextDecoder().decode(files['index.html']).replace('</body>', '<p>고침</p></body>')) };
    const r = await deploy(base, site, changed);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(r.missing, [sha256(changed['index.html'])], '바뀐 HTML만');
    const deps = cf.deploymentsOf(`s-${site.id}`);
    assert.equal(deps.length, 1, '지난 배포를 지움'); assert.notEqual(deps[0].id, first.id);
    assert.ok((await get(site.url)).text.includes('<p>고침</p>'));
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(cf.deploymentsOf('main').length, 1, '첫 주소 안내 화면은 한 번만');
  });

  await t.test('Pages가 자산을 지웠으면 missing_blobs로 다시 받아 공개', async () => {
    cf.state.loseAssets = true;
    const d = await call(base, 'POST', `/api/sites/${site.id}/deploys`, { key: site.key, json: { files: manifestOf(files) } });
    assert.equal(d.status, 200);
    const bySha = new Map(Object.values(files).map((v) => [sha256(v), v]));
    for (const sha of d.body.missing) assert.equal((await call(base, 'PUT', `/api/sites/${site.id}/blobs/${sha}`, { key: site.key, raw: bySha.get(sha) })).status, 204);
    const p1 = await call(base, 'POST', `/api/sites/${site.id}/deploys/${d.body.deploy}/publish`, { key: site.key });
    assert.equal(p1.status, 409); assert.equal(p1.body.error.code, 'missing_blobs');
    assert.ok(p1.body.error.missing.length > 3);
    for (const sha of p1.body.error.missing) assert.equal((await call(base, 'PUT', `/api/sites/${site.id}/blobs/${sha}`, { key: site.key, raw: bySha.get(sha) })).status, 204);
    const p2 = await call(base, 'POST', `/api/sites/${site.id}/deploys/${d.body.deploy}/publish`, { key: site.key });
    assert.equal(p2.status, 200, JSON.stringify(p2.body));
  });

  await t.test('JWT가 만료되면 새로 받아 계속', async () => {
    cf.state.jwtExpired = true;
    const r = await deploy(base, site, { ...files, 'extra.txt': te.encode(`새 파일 ${Date.now()}`) });
    assert.equal(r.status, 200, JSON.stringify(r.body));
  });

  await t.test('실시간 방: Pages 사이트 출처에서 CORS로 부를 수 있고, 다른 출처는 못 씀', async () => {
    const origin = new URL(site.url).origin; // 시험에서는 흉내 서버 출처
    const pre = await fetch(`${base}/live/api/ABCD12/join`, { method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type,x-lec-token' } });
    assert.equal(pre.status, 204); assert.equal(pre.headers.get('access-control-allow-origin'), origin);
    assert.match(pre.headers.get('access-control-allow-headers'), /X-Lec-Token/);
    const evil = await fetch(`${base}/live/api/ABCD12/join`, { method: 'OPTIONS', headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' } });
    assert.equal(evil.headers.get('access-control-allow-origin'), null);
  });

  await t.test('AI가 직접 쓴 사이트(엔진 조립 결과: index.html + assets/style.css + assets/site*.js·*-events.js·*.module.js + 키트 런타임): 받고, CSP 연결은 그 사이트의 방만', async () => {
    const CODE = 'AI' + randomBytes(3).toString('hex').toUpperCase();
    const s = (await call(base, 'POST', '/api/sites', { json: { title: 'AI 사이트' } })).body;
    const ai = await aiSite({ live: { url: `${base}/live`, code: CODE } });
    const OWN = ['assets/site.js', 'assets/site-2.module.js', 'assets/site-events.js', 'assets/about.js', 'assets/app.js']; // 조립이 옮긴 인라인 스크립트·onclick + AI가 쓴 파일
    for (const p of OWN) assert.ok(ai[p], `조립 결과에 ${p}`);
    // 조립을 거치지 않고 바깥 스크립트를 넣어도 서버가 뺌
    ai['index.html'] = te.encode(new TextDecoder().decode(ai['index.html']).replace('</head>', '<script src="https://evil.example/track.js"></script></head>'));
    const bind = async () => { const b = await call(base, 'POST', `/api/sites/${s.id}/live`, { key: s.key, json: { code: CODE, adminKeyHash: sha256('ai-teacher-key-' + CODE) } }); assert.equal(b.status, 200, JSON.stringify(b.body)); };
    const r = await deploy(base, s, ai, { beforePublish: bind });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const dep = cf.deploymentsOf(`s-${s.id}`).at(-1);
    for (const p of ['/index.html', '/about.html', '/assets/style.css', '/assets/kit.css', ...OWN.map((x) => `/${x}`), '/material/p-001.webp', '/assets/lecpage.js', '/assets/live.js', '/console.html']) assert.ok(dep.manifest[p], p);
    assert.ok(!dep.manifest['/_headers'], '조립이 만든 _headers는 쓰지 않고 서버가 정함');
    // _headers: 사이트 쪽 CSP(연결 = 이 출처 + 이 사이트의 방 경로), 보조 쪽은 예전 CSP
    const want = siteCsp({ host: base, code: CODE, site: s.id, pages: true });
    assert.ok(dep.headers.startsWith(`/*\n  ! Access-Control-Allow-Origin\n  Content-Security-Policy: ${want}\n`), dep.headers.slice(0, 900));
    const connect = / connect-src ([^;]+);/.exec(want)[1].split(' ');
    assert.deepEqual(connect, ["'self'", `${base}/live/api/${CODE}`, `${base}/live/api/${CODE}/`, `${base.replace(/^http/, 'ws')}/live/api/${CODE}/`, `${base}/api/${CODE}/files/`]);
    assert.ok(want.includes(`script-src 'self' ${LIB_SCRIPT_SOURCES.join(' ')};`) && want.includes("worker-src 'none'") && want.includes("form-action 'none'") && want.includes('frame-src https://www.youtube-nocookie.com https://player.vimeo.com;'));
    assert.ok(dep.headers.includes(`/console\n  X-Frame-Options: DENY\n  ! Content-Security-Policy\n  Content-Security-Policy: ${auxCsp({ noFrame: true })}\n`));
    // 보기(Pages 출처 = 사이트마다 다른 출처): 사이트 스크립트를 그대로 내보냄, 고정 라이브러리는 남기고 바깥 스크립트는 뺌
    const page = await get(s.url);
    assert.equal(page.status, 200); assert.equal(page.headers.get('content-security-policy'), want);
    assert.ok(page.text.includes('<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.1/dist/gsap.min.js" defer></script>'), '고정 라이브러리는 남김');
    assert.ok(!page.text.includes('evil.example'), '바깥 스크립트는 뺌');
    assert.ok(page.text.includes('<script src="assets/site.js"></script>') && page.text.includes('<script type="module" src="assets/site-2.module.js"></script>') && page.text.includes('data-host-report'));
    assert.ok(page.text.includes('<iframe src="https://www.youtube-nocookie.com/embed/abc123def"'), '유튜브 틀(쿠키 없는 주소)');
    for (const p of OWN) assert.equal((await get(s.url + p)).status, 200, p);
    const own = await get(`${s.url}assets/app.js`);
    assert.equal(own.text, AI_SITE_JS); assert.equal(own.headers.get('content-type'), 'text/javascript; charset=utf-8');
    assert.equal((await get(`${s.url}console`)).headers.get('content-security-policy'), auxCsp({ noFrame: true }));
    // 두 번째 주소(이 호스트, 모든 사이트가 같이 쓰는 출처): 사이트 스크립트는 내보내지 않고 엔진 런타임만
    const alt = `${base}/s/${s.id}/`;
    assert.equal((await get(alt)).status, 200);
    for (const p of [...OWN, 'assets/%73ite.js', 'assets/%2e/site.js', 'assets//site.js', 'assets/SITE.JS', 'assets/nope.js', 'x/../assets/site.js']) assert.equal((await get(alt + p)).status, 404, p);
    const rt = await get(`${alt}assets/lecpage.js`);
    assert.equal(rt.status, 200); assert.deepEqual(te.encode(rt.text), ai['assets/lecpage.js']);
    assert.equal((await get(`${alt}assets/style.css`)).status, 200);
  });

  await t.test('AI가 쓴 사이트도 금지 모양은 공개 전에 거절(비밀번호 칸·바깥 양식·로그인 흉내·보조 쪽 스크립트·글자 가림)', async () => {
    const s = (await call(base, 'POST', '/api/sites', { json: { title: '거절 시험' } })).body;
    const ai = await aiSite();
    const before = cf.deploymentsOf(`s-${s.id}`).length;
    const withIndex = (extra) => ({ ...ai, 'index.html': te.encode(new TextDecoder().decode(ai['index.html']).replace('</main>', `${extra}</main>`)) });
    for (const [f, rule, path] of [
      [withIndex('<input type="password" name="pw">'), 'password', 'index.html'],
      [withIndex('<form action="https://evil.example/c"><input name="q"><button>보내기</button></form>'), 'form', 'index.html'],
      [withIndex('<input placeholder="아이디"><input placeholder="비번"><button>로그인</button>'), 'password_label', 'index.html'],
      [withIndex('<input name="userid" placeholder="ID"><button type="submit">로그인</button>'), 'login', 'index.html'],
      [{ ...ai, 'console.html': te.encode(new TextDecoder().decode(ai['console.html']).replace('</body>', '<script src="assets/site.js"></script></body>')) }, 'aux_script', 'console.html'],
    ]) {
      const r = await deploy(base, s, f);
      assert.equal(r.step, 'publish', rule); assert.equal(r.status, 422, rule);
      assert.equal(r.body.error.code, 'unsafe_site'); assert.equal(r.body.error.rule, rule); assert.equal(r.body.error.path, path);
      assert.ok(/[가-힣]/.test(r.body.error.message_ko) && r.body.error.message_ko.includes(path), r.body.error.message_ko);
    }
    const css = await deploy(base, s, { ...ai, 'assets/style.css': te.encode('.pin{-webkit-text-security:disc}') });
    assert.equal(css.step, 'blobs'); assert.equal(css.body.error.rule, 'masked');
    const pw = await deploy(base, s, { ...ai, 'assets/site.js': te.encode("document.querySelector('input').type = 'password'") });
    assert.equal(pw.step, 'blobs'); assert.equal(pw.body.error.rule, 'password');
    assert.equal(cf.deploymentsOf(`s-${s.id}`).length, before, '걸린 사이트는 Pages에 배포하지 않음');
    assert.equal((await deploy(base, s, ai)).status, 200, '고치면 받음');
  });

  await t.test('가리기·풀기·지우기(관리자 열쇠)', async () => {
    const A = { authorization: `Bearer ${ADMIN}`, 'content-type': 'application/json' };
    const b = await fetch(`${base}/api/admin/sites/${site.id}/block`, { method: 'POST', headers: A, body: JSON.stringify({ blocked: true, reason: '시험' }) });
    assert.equal(b.status, 200);
    const page = await get(site.url);
    assert.ok(page.text.includes('잠시 가려 둔 사이트예요') && page.text.includes(`${base}/report?site=${site.id}`), 'Pages 주소에 가림 화면');
    assert.equal((await get(site.altUrl)).status, 451, '두 번째 주소도 가림');
    const u = await (await fetch(`${base}/api/admin/sites/${site.id}/block`, { method: 'POST', headers: A, body: JSON.stringify({ blocked: false }) })).json();
    assert.equal(u.ok, true); assert.equal(u.restored, undefined);
    assert.ok((await get(site.url)).text.includes('<meta property="og:url"'), '풀면 다시 열림');
    assert.equal(cf.deploymentsOf(`s-${site.id}`).length, 1, '가림 화면 배포는 지움');
    cf.state.failDeleteLatest = true;
    const del = await fetch(`${base}/api/admin/sites/${site.id}`, { method: 'DELETE', headers: A });
    assert.equal(del.status, 204);
    const left = cf.deploymentsOf(`s-${site.id}`);
    assert.equal(left.length, 1, '가장 최근 배포를 못 지우면 안내 화면 하나만 남김');
    assert.ok((await get(site.url)).text.includes('보관 기간이 끝났어요'));
    assert.equal((await get(site.altUrl)).status, 404);
    cf.state.failDeleteLatest = false;
  });

  await t.test('강사가 내리면(사이트 열쇠) Pages 주소에 "강사가 사이트를 내렸어요" 안내 하나만 남김(보관 기간 끝과 나눔)', async () => {
    const s4 = (await call(base, 'POST', '/api/sites', { json: { title: '내리기 시험' } })).body;
    assert.equal((await deploy(base, s4, await buildSite('data-lab'))).status, 200);
    const before = cf.deploymentsOf(`s-${s4.id}`);
    assert.equal(before.length, 1);
    assert.equal((await call(base, 'DELETE', `/api/sites/${s4.id}`, { key: s4.key })).status, 204);
    const left = cf.deploymentsOf(`s-${s4.id}`);
    assert.equal(left.length, 1, '안내 화면 하나만'); assert.notEqual(left[0].id, before[0].id, '사이트 배포는 지움');
    const page = (await get(s4.url)).text;
    assert.match(page, /강사가 사이트를 내렸어요/); assert.doesNotMatch(page, /보관 기간이 끝났어요/);
    assert.match((await get(s4.altUrl)).text, /강사가 사이트를 내렸어요/, '두 번째 주소도');
  });

  await t.test('예약·상태 API·긴 대기(학교망 묻기 줄이기)', async () => {
    const kst = (n) => new Date(Date.now() + 9 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
    const booking = { date: kst(5), start: '10:00', end: '12:00', people: 40, live: true, network: 'restricted' };
    const s3 = (await call(base, 'POST', '/api/sites', { json: { title: '예약', booking } })).body;
    const st = await call(base, 'GET', `/api/status?date=${kst(5)}&site=${s3.id}`);
    assert.equal(st.status, 200); assert.equal(st.headers.get('cache-control'), 'public, max-age=60');
    assert.equal(st.body.view, 'pages'); assert.equal(st.body.day.trainings, 1); assert.equal(st.body.day.people, 40);
    assert.equal(st.body.site.state, 'open'); assert.equal(st.body.site.booking.date, kst(5)); assert.ok(st.body.today.date);
    // 그날이 차면 만들 때 거절(예산 10만의 70%: 300명 학교망 하루 종일이면 넘음)
    const huge = await call(base, 'POST', '/api/sites', { json: { booking: { ...booking, people: 300, end: '17:00' } } });
    assert.equal(huge.status, 429); assert.equal(huge.body.error.reason, 'booked');
    // 다시 올릴 때(deploys) 날짜를 보내면 예약을 바꿈
    const f2 = await buildSite('sel-story');
    const d = await call(base, 'POST', `/api/sites/${s3.id}/deploys`, { key: s3.key, json: { files: manifestOf(f2), booking: { ...booking, date: kst(6) } } });
    assert.equal(d.status, 200);
    assert.equal((await call(base, 'GET', `/api/status?date=${kst(6)}`)).body.day.trainings, 1);
    // 긴 대기: 방을 묶고, 바뀐 것이 없으면 기다렸다가 질문이 올라오면 바로 답
    const CODE = 'LP' + randomBytes(3).toString('hex').toUpperCase();
    assert.equal((await call(base, 'POST', `/api/sites/${s3.id}/live`, { key: s3.key, json: { code: CODE, adminKeyHash: sha256('teacher-key-' + CODE) } })).status, 200);
    const origin = new URL(site.url).origin;
    const lv = `${base}/live/api/${CODE}`;
    const j = await (await fetch(`${lv}/join`, { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify({ nickname: '봄' }) })).json();
    const snap = await fetch(`${lv}/snapshot?since=0`, { headers: { origin } });
    assert.equal(snap.headers.get('x-lec-poll-ms'), '5000'); assert.match(snap.headers.get('access-control-expose-headers'), /X-Lec-Poll-Ms/i);
    const now = (await snap.json()).now;
    let t0 = Date.now();
    const idle = await (await fetch(`${lv}/snapshot?since=${now}&wait=2`, { headers: { origin } })).json();
    assert.ok(Date.now() - t0 >= 1800, '바뀐 것이 없으면 기다림'); assert.equal(idle.questions.length, 0);
    t0 = Date.now();
    const waiting = fetch(`${lv}/snapshot?since=${idle.now}&wait=20`, { headers: { origin } }).then((r) => r.json());
    await new Promise((r) => setTimeout(r, 500));
    const q = await fetch(`${lv}/questions`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-lec-token': j.token, origin }, body: JSON.stringify({ text: '긴 대기 시험' }) });
    assert.equal(q.status, 201);
    const woke = await waiting;
    assert.ok(Date.now() - t0 < 5000, '글이 올라오면 바로 답'); assert.equal(woke.questions[0].text, '긴 대기 시험');
  });

  await t.test('신고: Pages 주소로도 받음', async () => {
    const s2 = (await call(base, 'POST', '/api/sites', { json: {} })).body;
    const r = await call(base, 'POST', '/api/report', { json: { site: s2.url, reason: '시험 신고' } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
  });

  await t.test('지우기: Pages API가 막히면 "지웠어요"(204) 대신 202 지우는 중 → 관리 목록에 남고 두 번째 주소는 닫힘 → 다시 지우면 끝(204)', async () => {
    const s4 = (await call(base, 'POST', '/api/sites', { json: { title: '지우기 시험' } })).body;
    assert.equal((await deploy(base, s4, await buildSite('data-lab'))).status, 200);
    const A = { authorization: `Bearer ${ADMIN}` };
    cf.state.tokenOk = false; // Cloudflare API가 모두 403
    try {
      const d1 = await call(base, 'DELETE', `/api/sites/${s4.id}`, { key: s4.key });
      assert.equal(d1.status, 202, JSON.stringify(d1.body)); assert.equal(d1.body.state, 'wiping');
      assert.equal(cf.deploymentsOf(`s-${s4.id}`).length, 1, 'Pages에는 아직 남음');
      assert.equal((await get(s4.altUrl)).status, 404, '두 번째 주소는 바로 닫힘');
      const st = await (await fetch(`${base}/api/admin/stats`, { headers: A })).json();
      assert.equal(st.sites.wiping, 1);
      const row = (await (await fetch(`${base}/api/admin/sites`, { headers: A })).json()).sites.find((x) => x.id === s4.id);
      assert.ok(row && row.wiping > 0, '관리 목록에 지우는 중으로');
      assert.equal((await call(base, 'GET', `/api/status?site=${s4.id}`)).body.site.state, 'gone', '강사 앱에는 내린 사이트');
    } finally { cf.state.tokenOk = true; }
    const d2 = await call(base, 'DELETE', `/api/sites/${s4.id}`, { key: s4.key });
    assert.equal(d2.status, 204);
    assert.equal(cf.deploymentsOf(`s-${s4.id}`).length, 1, 'Pages 배포까지 지우고 "강사가 사이트를 내렸어요" 안내 하나만 남김');
    const list = (await (await fetch(`${base}/api/admin/sites`, { headers: A })).json()).sites;
    assert.ok(!list.some((x) => x.id === s4.id), '목록에서도 빠짐');
  });

  await t.test('하루 점검(cron): 로컬 scheduled를 부르면 Gate가 점검하고 관리 숫자에 남김', async (st) => {
    const r = await fetch(`${base}/cdn-cgi/local/scheduled?format=json`);
    if (r.status === 404) return st.skip('이 wrangler 판에는 로컬 scheduled 주소가 없어요');
    assert.equal(r.status, 200, await r.text());
    let last = null;
    for (let i = 0; i < 40 && !last; i++) {
      last = (await (await fetch(`${base}/api/admin/stats`, { headers: { authorization: `Bearer ${ADMIN}` } })).json()).ops?.last;
      if (!last) await new Promise((res) => setTimeout(res, 100));
    }
    assert.equal(last?.via, 'cron');
  });
});

test('VIEW=pages: 보관 기간이 끝나면 배포를 모두 지우고 그 주소에 "보관 기간이 끝났어요" 안내 하나만 남김(Cloudflare 영어 404가 아니게)', async (t) => {
  if (!existsSync(join(HOSTING, 'node_modules', 'wrangler', 'bin', 'wrangler.js'))) return t.skip('wrangler가 설치되지 않았어요');
  const cf = await startFakeCf();
  closers.push(cf.stop);
  let h;
  try {
    h = await startHost({
      SITE_DAYS: 10 / 86400, // 10초
      VIEW: 'pages', CF_ACCOUNT_ID: ACCOUNT, PAGES_PROJECT: 'lecpage-view', PAGES_TOKEN: TOKEN, PAGES_HOST: `127.0.0.1:${cf.port}`,
      PAGES_SITE_URL: `${cf.url}/__view/{branch}/`, CF_API_BASE: cf.api,
    });
  } catch (e) { return t.skip(`workerd를 띄우지 못함: ${String(e.message).split('\n')[0]}`); }
  closers.push(h.stop);
  const site = (await call(h.url, 'POST', '/api/sites', { json: { title: '만료 시험' } })).body;
  const r = await deploy(h.url, site, await buildSite('data-lab'));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const before = cf.deploymentsOf(`s-${site.id}`);
  assert.equal(before.length, 1);
  let left = before;
  for (let i = 0; i < 90 && (left.length !== 1 || left[0].id === before[0].id); i++) { await new Promise((res) => setTimeout(res, 500)); left = cf.deploymentsOf(`s-${site.id}`); }
  assert.equal(left.length, 1, '안내 화면 배포 하나만 남음');
  assert.notEqual(left[0].id, before[0].id, '사이트 배포는 지움');
  assert.deepEqual(Object.keys(left[0].manifest).sort(), ['/404.html', '/index.html']);
  assert.match((await get(site.url)).text, /이 사이트는 보관 기간이 끝났어요/);
  assert.equal((await get(`${site.url}assets/lecpage.js`)).status, 404, '사이트 파일은 열리지 않음');
  assert.equal((await get(site.altUrl)).status, 404, '두 번째 주소도 없음');
});
