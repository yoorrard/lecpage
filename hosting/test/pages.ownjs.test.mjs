// 통합 시험: Pages 보기 사이트가 직접 쓴 스크립트는 두 번째 주소(이 호스트의 /s/<id>/ — 모든 사이트가 같이 쓰는 출처)로 나가지 않음. 로컬 workerd + 흉내 Cloudflare API.
//  1 모아 올리기(flushPool)가 Pages API를 기다리는 사이 스크립트를 뺀 목록이 와서 치웠다가(sweep: 사이트 스크립트 표시 jsk도 지움) 다시 스크립트가 든 목록이 오면,
//    그 스크립트는 처음부터 다시 받아 검사함(표시 없이 자산 표에만 남지 않음) → 두 번째 주소에서 404
//  2 예전 판 런타임(runtime-history.json에 적힌 조각, 조각 하나짜리와 둘을 이은 것)은 두 번째 주소로 그대로 나감
//  3 표시(jsk) 줄이 없어도 사이트가 직접 쓴 스크립트는 두 번째 주소에서 404(Worker가 가져온 내용이 엔진 런타임인지 확인한 뒤에만 내보냄)
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { HOSTING, startHost, call, deploy, manifestOf, bytesOf, AI_SITE_JS } from './helpers.mjs';
import { startFakeCf, ACCOUNT, TOKEN } from './fake-cf.mjs';

const closers = [];
after(async () => { for (const c of closers.reverse()) await c(); });
const te = new TextEncoder();
const td = new TextDecoder();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const page = (t, script) => te.encode(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${t}</title></head><body><main><h1>${t}</h1></main>${script ? `<script src="${script}" defer></script>` : ''}</body></html>`);
const img = (n = 3900 * 1024) => { const b = new Uint8Array(randomBytes(n)); b.set(te.encode('RIFF'), 0); return b; };
const get = async (u, init) => { const r = await fetch(u, { redirect: 'manual', ...init }); return { status: r.status, text: await r.text(), type: r.headers.get('content-type') }; };
const own = () => te.encode(AI_SITE_JS + `\n// ${randomBytes(4).toString('hex')}\n`);

// 엔진에서 지운 예전 효과 조각(2026-11-20 runtime-history.json에 적어 둠) 그대로
const AURORA = `/* aurora — 주 색·강조 색의 부드러운 빛띠가 아주 천천히 흐른다(CSS만, 흐림 필터 없음) */
LecFX.define('aurora', {
  level: 2,
  loop: true,
  init: function (el, o, ctx) {
    if (o.surface === 'dark') ctx.surface(el, 'dark');
    var ly = ctx.layer(el);
    ly.innerHTML = '<i class="fx-au-a"></i><i class="fx-au-b"></i><i class="fx-au-c"></i><i class="fx-au-d"></i>';
    if (o.intensity) ly.style.setProperty('--fx-au-o', o.intensity);
    if (ctx.reduced || ctx.lowPower) ly.classList.add('fx-still');
    ctx.visible(ly, function (on) { ly.classList.toggle('fx-off', !on); }, { once: false, rootMargin: '100px' });
  }
});
`;
const GRAIN = `/* grain — SVG feTurbulence 잡음을 얇게 덮어 종이·필름 질감을 준다(정지, 비용 거의 없음) */
LecFX.define('grain', {
  level: 1,
  init: function (el, o, ctx) {
    var ly = ctx.layer(el);
    if (o.amount != null) ly.style.setProperty('--fx-grain', ctx.util.clamp(+o.amount, 0, 0.4));
    if (o.front) ly.classList.add('fx-grain--front');
  }
});
`;

function sqliteFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) { const p = join(dir, name); if (statSync(p).isDirectory()) out.push(...sqliteFiles(p)); else if (name.endsWith('.sqlite')) out.push(p); }
  return out;
}

test('사이트가 직접 쓴 스크립트는 두 번째 주소로 나가지 않고, 엔진 런타임(예전 판 포함)은 나감', { timeout: 600000 }, async (t) => {
  if (!existsSync(join(HOSTING, 'node_modules', 'wrangler', 'bin', 'wrangler.js'))) { t.skip('wrangler가 설치되지 않았어요'); return; }
  const cf = await startFakeCf(); closers.push(cf.stop);
  const state = mkdtempSync(join(tmpdir(), 'lecpage-ownjs-'));
  closers.push(async () => rmSync(state, { recursive: true, force: true }));
  const vars = { CATALOG_URL: 'off', VIEW: 'pages', CF_ACCOUNT_ID: ACCOUNT, PAGES_PROJECT: 'lecpage-view', PAGES_TOKEN: TOKEN, PAGES_HOST: `127.0.0.1:${cf.port}`, PAGES_SITE_URL: `${cf.url}/__view/{branch}/`, CF_API_BASE: cf.api, SITES_PER_DEVICE: 100, SITES_PER_HOUR: 100, SITES_PER_DAY: 100 };
  let h;
  try { h = await startHost(vars, { state }); } catch (e) { t.skip(`workerd를 띄우지 못함: ${String(e.message).split('\n')[0]}`); return; }
  let stopped = false;
  closers.push(async () => { if (!stopped) await h.stop(); });
  let base = h.url;

  await t.test('모아 올리는 사이 목록이 바뀌어도 스크립트는 다시 받아 검사함 → 두 번째 주소에서 404', async () => {
    const script = own();
    const small = { 'index.html': page('A', 'assets/app.js'), 'assets/app.js': script };
    const s = (await call(base, 'POST', '/api/sites', { json: { title: 'race' } })).body;
    const A = { ...small };
    for (let i = 1; i <= 5; i++) A[`assets/img/f${i}.webp`] = img(); // 4MB 아래 다섯 장 = 모아 두는 합계(16MB)를 넘김
    const put = (files, p) => call(base, 'PUT', `/api/sites/${s.id}/blobs/${manifestOf(files)[p].sha256}`, { key: s.key, raw: bytesOf(files[p]) });
    let d = await call(base, 'POST', `/api/sites/${s.id}/deploys`, { key: s.key, json: { files: manifestOf(A) } });
    assert.equal(d.status, 200, JSON.stringify(d.body));
    for (const p of ['assets/app.js', 'index.html', 'assets/img/f1.webp', 'assets/img/f2.webp', 'assets/img/f3.webp', 'assets/img/f4.webp']) assert.equal((await put(A, p)).status, 204, p);
    cf.state.faults.push({ on: 'upload', hang: 3000, stage: 'none', times: 1 }); // Pages 올리기가 한 번 늦게 답함(실제 16MB 올리기는 몇 초)
    const p5 = put(A, 'assets/img/f5.webp'); // 합계가 차서 모아 둔 것(스크립트 포함)을 올림(flushPool)
    await sleep(1200);
    d = await call(base, 'POST', `/api/sites/${s.id}/deploys`, { key: s.key, json: { files: manifestOf({ 'index.html': page('B') }) } }); // 그사이 스크립트가 없는 목록 → 치움
    assert.equal(d.status, 200, JSON.stringify(d.body));
    assert.equal((await p5).status, 204);
    d = await call(base, 'POST', `/api/sites/${s.id}/deploys`, { key: s.key, json: { files: manifestOf(small) } });
    assert.equal(d.status, 200, JSON.stringify(d.body));
    const sha = manifestOf(small)['assets/app.js'].sha256;
    assert.ok(d.body.missing.includes(sha), '치운 스크립트는 다시 받음(다시 검사해 표시를 적음)');
    for (const x of d.body.missing) { const p = Object.keys(small).find((k) => manifestOf(small)[k].sha256 === x); assert.equal((await put(small, p)).status, 204, p); }
    const pub = await call(base, 'POST', `/api/sites/${s.id}/deploys/${d.body.deploy}/publish`, { key: s.key });
    assert.equal(pub.status, 200, JSON.stringify(pub.body));
    assert.equal((await get(`${base}/s/${s.id}/assets/app.js`)).status, 404, '두 번째 주소는 사이트 스크립트를 내보내지 않음');
    const first = await get(`${pub.body.url}assets/app.js`);
    assert.equal(first.status, 200); assert.equal(first.text, td.decode(script), '사이트 주소(pages.dev)에서는 그대로');
  });

  let ownSite; let rtSite;
  await t.test('예전 판 런타임 조각(조각 하나·둘을 이은 것)은 두 번째 주소로 나감(지금 판은 pages.integration.test.mjs)', async () => {
    const hist = JSON.parse(readFileSync(join(HOSTING, 'runtime-history.json'), 'utf8')).segments;
    const sha = (x) => createHash('sha256').update(x).digest('hex');
    for (const [name, text] of [['fx/effects/aurora.js', AURORA], ['fx/effects/grain.js', GRAIN]]) assert.ok(hist.some((x) => x.name === name && x.sha256 === sha(text)), `${name}이 runtime-history.json에 그대로 있음`);
    const files = {
      'index.html': page('예전 판', 'assets/fx.js'), 'assets/aurora.js': te.encode(AURORA), 'assets/fx.js': te.encode(AURORA + '\n;\n' + GRAIN),
      'assets/app.js': own(),
    };
    const s = (await call(base, 'POST', '/api/sites', { json: { title: '예전 판' } })).body;
    const r = await deploy(base, s, files);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    for (const p of ['assets/aurora.js', 'assets/fx.js']) {
      const g = await get(`${base}/s/${s.id}/${p}`);
      assert.equal(g.status, 200, p); assert.equal(g.text, td.decode(files[p]), p); assert.match(g.type, /javascript/, p);
      const again = await get(`${base}/s/${s.id}/${p}`); // 한 번 확인한 내용은 기억(같은 답)
      assert.equal(again.status, 200, p); assert.equal(again.text, td.decode(files[p]), p);
      const hd = await fetch(`${base}/s/${s.id}/${p}`, { method: 'HEAD' });
      assert.equal(hd.status, 200, `HEAD ${p}`);
    }
    assert.equal((await get(`${base}/s/${s.id}/assets/app.js`)).status, 404);
    rtSite = { s, files };
    ownSite = s;
  });

  await t.test('표시(jsk) 줄이 없어도 사이트 스크립트는 두 번째 주소에서 404, 런타임은 그대로', async () => {
    await h.stop(); stopped = true;
    let gone = 0;
    for (const f of sqliteFiles(state)) {
      const db = new DatabaseSync(f);
      try {
        const has = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'jsk'").get();
        if (has) gone += Number(db.prepare('DELETE FROM jsk').run().changes);
      } finally { db.close(); }
    }
    assert.ok(gone >= 2, `지운 표시 ${gone}줄`);
    h = await startHost(vars, { state }); stopped = false; base = h.url;
    assert.equal((await get(`${base}/s/${ownSite.id}/assets/app.js`)).status, 404, '표시가 없어도 엔진 런타임이 아니면 내보내지 않음');
    assert.equal((await fetch(`${base}/s/${ownSite.id}/assets/app.js`, { method: 'HEAD' })).status, 404);
    const fx = await get(`${base}/s/${rtSite.s.id}/assets/fx.js`);
    assert.equal(fx.status, 200); assert.equal(fx.text, td.decode(rtSite.files['assets/fx.js']));
    assert.equal((await get(`${base}/s/${rtSite.s.id}/`)).status, 200, '첫 화면은 그대로');
  });
});
