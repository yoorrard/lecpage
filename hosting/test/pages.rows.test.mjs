// 통합 시험: 바로 배포 사이트 하나가 하루 무료 쓴 행(10만)을 태우지 못함. 로컬 workerd + 흉내 Cloudflare API.
//  1 이 객체 저장소에 줄을 쓰는 파일(HTML·영상·소리·.js)이 상한(MAX_KEPT_FILES)을 넘는 목록은 아무것도 쓰기 전에 거절(too_many_files)
//  2 공개하지 않고 HTML 수백 개짜리 목록 → 묶음 올리기를 되풀이하면 이 사이트의 하루 몫(SITE_ROWS_PER_DAY)에서 거절(rate_limited · site_rows).
//    그동안 쓴 행은 목록을 받을 때마다 Gate의 오늘 숫자(rw)에 이미 들어 있음(지우거나 공개할 때가 아니라)
//  3 보통 사이트(HTML 60쪽 + 보조 쪽 + 글꼴 조각 + 쪽 그림 + 사이트 스크립트)를 강의 날처럼 마흔 번 넘게 다시 배포해도 모두 받음
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { HOSTING, REPO, startHost, call, deploy, manifestOf, bytesOf, AI_SITE_JS } from './helpers.mjs';
import { startFakeCf, ACCOUNT, TOKEN } from './fake-cf.mjs';
import { today, settle } from './load-helpers.mjs';

const { bundlesOf, packBundle } = await import(join(REPO, 'app', 'src', 'lib', 'site-size.js'));
const ADMIN = 'rows-admin-' + randomBytes(12).toString('hex');
const closers = [];
after(async () => { for (const c of closers.reverse()) await c(); });
const te = new TextEncoder();
let salt = 0;
const html = (t, extra = '') => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${t}</title></head><body><main><h1>${t}</h1></main>${extra}</body></html>`;
const blob = (n, tag) => { const b = new Uint8Array(randomBytes(n)); b.set(te.encode(tag), 0); return b; };
const siteRows = (t) => (t.rw || 0) - (t.gw || 0); // 사이트·방이 알린 쓴 행(Gate가 스스로 쓴 것을 뺌)

test('사이트 하나가 하루 쓴 행 몫을 태우지 못하고, 보통 배포·다시 배포는 그대로', { timeout: 900000 }, async (t) => {
  if (!existsSync(join(HOSTING, 'node_modules', 'wrangler', 'bin', 'wrangler.js'))) { t.skip('wrangler가 설치되지 않았어요'); return; }
  const cf = await startFakeCf(); closers.push(cf.stop);
  let h;
  // 한도는 기본값 그대로(MAX_FILES 3,000 · MAX_KEPT_FILES 500 · SITE_ROWS_PER_DAY 20,000). 시간당 목록 수(30)만 올려 하루 몫이 먼저 막는지 봄
  try { h = await startHost({ ADMIN_KEY: ADMIN, TALLY_EVERY: 1, CATALOG_URL: 'off', VIEW: 'pages', CF_ACCOUNT_ID: ACCOUNT, PAGES_PROJECT: 'lecpage-view', PAGES_TOKEN: TOKEN, PAGES_HOST: `127.0.0.1:${cf.port}`, PAGES_SITE_URL: `${cf.url}/__view/{branch}/`, CF_API_BASE: cf.api, DEPLOYS_PER_HOUR: 1000 }); }
  catch (e) { t.skip(`workerd를 띄우지 못함: ${String(e.message).split('\n')[0]}`); return; }
  closers.push(h.stop);
  const base = h.url;
  const info = (await call(base, 'GET', '/api/info')).body;
  assert.equal(info.limits.maxKeptFiles, 500);
  assert.equal(info.limits.maxFiles, 3000, '파일 수 한도는 그대로(글꼴 조각)');
  const bun = info.limits.bundle;

  await t.test('줄을 쓰는 파일이 상한을 넘는 목록은 쓰기 전에 거절, 목록을 되풀이해도 하루 몫에서 멈추고 Gate가 쓰는 대로 셈', async () => {
    const s = (await call(base, 'POST', '/api/sites', { json: { title: '행 태우기' } })).body;
    const t0 = await today(base, ADMIN);
    const many = { 'index.html': html('i' + (++salt)) };
    for (let i = 0; i < 2900; i++) many[`p${i}.html`] = html(`x${++salt}`);
    const big = await call(base, 'POST', `/api/sites/${s.id}/deploys`, { key: s.key, json: { files: manifestOf(many) } });
    assert.equal(big.status, 413); assert.equal(big.body.error.code, 'too_many_files'); assert.equal(big.body.error.max, 500);
    assert.match(big.body.error.message_ko, /500개까지/);

    // 상한 바로 아래(HTML 495개)로 목록 → 묶음 올리기를 되풀이(공개하지 않음)
    let cycles = 0; let refused = null;
    for (; cycles < 40; cycles++) {
      const files = { 'index.html': html('i' + (++salt)) };
      for (let i = 0; i < 494; i++) files[`p${i}.html`] = html(`x${++salt}`);
      const man = manifestOf(files);
      const blobs = new Map(Object.entries(files).map(([p, v]) => [man[p].sha256, bytesOf(v)]));
      const d = await call(base, 'POST', `/api/sites/${s.id}/deploys`, { key: s.key, json: { files: man } });
      if (d.status !== 200) { refused = d; break; }
      for (const g of bundlesOf(d.body.missing.map((x) => [x, blobs.get(x).length]), bun)) {
        const raw = new Uint8Array(await packBundle(g.map(([x, n]) => [x, n, blobs.get(x)])).arrayBuffer());
        const r = await call(base, 'PUT', `/api/sites/${s.id}/blobs`, { key: s.key, raw });
        assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200)); assert.equal(r.body.failed.length, 0);
      }
    }
    assert.ok(refused, '하루 몫에서 멈춤');
    assert.ok(cycles >= 15 && cycles <= 21, `받은 목록 ${cycles}번`);
    assert.equal(refused.status, 429); assert.equal(refused.body.error.code, 'rate_limited'); assert.equal(refused.body.error.reason, 'site_rows');
    assert.equal(refused.body.error.scope, 'you'); assert.match(refused.body.error.message_ko, /이 사이트를 너무 여러 번/);
    assert.ok(Number(refused.headers.get('retry-after')) > 0 && Number(refused.headers.get('retry-after')) <= 86400);
    await settle(800);
    const t1 = await today(base, ADMIN);
    const seen = siteRows(t1) - siteRows(t0);
    // 지우면 사이트가 실제로 쓴 행 가운데 아직 알리지 않은 것을 알림 → 그 뒤 합계 = 이 사이트가 쓴 행(넉넉한 어림 포함)
    assert.equal((await call(base, 'DELETE', `/api/sites/${s.id}`, { key: s.key })).status, 204);
    await settle(1200);
    const t2 = await today(base, ADMIN);
    const total = siteRows(t2) - siteRows(t0);
    assert.ok(total <= 20000 + 2000, `사이트 하나가 쓴 행 ${total}`);
    assert.ok(seen >= total * 0.9, `지우기 전에 Gate가 본 행 ${seen} / 모두 ${total}`);
  });

  await t.test('보통 사이트: 새 배포는 행 몇십 줄, 강의 날처럼 마흔 번 넘게 다시 배포해도 모두 받음', async () => {
    const pages = 60;
    const make = (v) => {
      const f = {};
      const nav = Array.from({ length: pages }, (_, i) => `<a href="p${i}.html">${i + 1}</a>`).join(' ');
      f['index.html'] = html(`연수 ${v}`, `${nav}<script src="assets/app.js" defer></script>`);
      for (let i = 0; i < pages; i++) f[`p${i}.html`] = html(`쪽 ${i} · ${v}`);
      for (const aux of ['console.html', 'screen.html', 'poster.html', 'check.html', 'privacy.html']) f[aux] = html(`${aux} ${v}`);
      return f;
    };
    const fixed = { 'assets/app.js': te.encode(AI_SITE_JS), 'assets/site.css': te.encode('main{max-width:60rem}') };
    for (let i = 0; i < 120; i++) fixed[`assets/fonts/f${i}.woff2`] = blob(4 * 1024, `wOF2${i}`);
    for (let i = 1; i <= 30; i++) fixed[`material/p-${String(i).padStart(3, '0')}.webp`] = blob(40 * 1024, 'RIFF');
    const s = (await call(base, 'POST', '/api/sites', { json: { title: '보통 사이트' } })).body;
    const t0 = await today(base, ADMIN);
    const first = await deploy(base, s, { ...fixed, ...make(0) });
    assert.equal(first.status, 200, JSON.stringify(first.body));
    for (let v = 1; v <= 45; v++) {
      const r = await deploy(base, s, { ...fixed, ...make(v) });
      assert.equal(r.status, 200, `다시 배포 ${v}: ${JSON.stringify(r.body).slice(0, 300)}`);
      assert.equal(r.missing.length, pages + 6, '바뀐 HTML만 다시 받음');
    }
    await settle(800);
    const used = siteRows(await today(base, ADMIN)) - siteRows(t0);
    assert.ok(used < 20000 * 0.5, `46번 배포에 센 행 ${used}`);
  });
});
