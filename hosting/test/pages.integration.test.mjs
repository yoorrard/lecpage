// 통합 시험(VIEW=pages): 로컬 workerd + 흉내 Cloudflare API(test/fake-cf.mjs).
// 앱과 같은 순서로 올리면 → 서버가 검사하고 Pages에 직접 올려 브랜치 s-<id>에 배포 → Pages 주소를 돌려줌.
// 흉내 서버는 manifest의 열쇠가 내용의 blake3(base64 + 확장자)와 맞는지(wrangler와 같은지) 확인합니다.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { HOSTING, buildSite, manifestOf, sha256, startHost, call, deploy } from './helpers.mjs';
import { startFakeCf, ACCOUNT, TOKEN } from './fake-cf.mjs';

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
      ADMIN_KEY: ADMIN, SITES_PER_HOUR: 100, SITES_PER_DAY: 1000, MAX_FILES: 80,
      VIEW: 'pages', CF_ACCOUNT_ID: ACCOUNT, PAGES_PROJECT: 'lecpage-view', PAGES_TOKEN: TOKEN, PAGES_HOST: `127.0.0.1:${cf.port}`,
      PAGES_SITE_URL: `${cf.url}/__view/{branch}/`, CF_API_BASE: cf.api,
    });
  } catch (e) { return t.skip(`workerd를 띄우지 못함: ${String(e.message).split('\n')[0]}`); }
  closers.push(h.stop);
  const base = h.url;

  const info = await call(base, 'GET', '/api/info');
  assert.equal(info.body.view, 'pages');
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

  await t.test('올리기: 런타임이 아닌 .js는 Pages에 가기 전에 막음', async () => {
    const bad = { ...files, 'assets/evil.js': te.encode('alert(1)') };
    const r = await deploy(base, site, bad);
    assert.equal(r.step, 'blobs'); assert.equal(r.body.error.code, 'runtime_mismatch');
    assert.ok(![...cf.state.assets.values()].some((a) => a.bytes.toString() === 'alert(1)'), '검사에 걸린 파일은 Pages에 올리지 않음');
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
    assert.match(first.headers, /^\/\*\n {2}! Access-Control-Allow-Origin\n {2}Content-Security-Policy: default-src 'none'; script-src 'self';/);
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
    assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
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

  await t.test('다시 배포: 바뀐 파일만 받고 지난 배포는 지움', async () => {
    const changed = { ...files, 'index.html': te.encode(new TextDecoder().decode(files['index.html']).replace('</body>', '<p>고침</p></body>')) };
    const r = await deploy(base, site, changed);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(r.missing, [sha256(changed['index.html'])], '바뀐 HTML만');
    const deps = cf.deploymentsOf(`s-${site.id}`);
    assert.equal(deps.length, 1, '지난 배포를 지움'); assert.notEqual(deps[0].id, first.id);
    assert.ok((await get(site.url)).text.includes('<p>고침</p>'));
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
});
