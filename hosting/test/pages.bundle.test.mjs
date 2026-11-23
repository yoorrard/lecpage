// 통합 시험: 작은 파일 묶어 받기(PUT /api/sites/:id/blobs). 로컬 workerd + 흉내 Cloudflare API.
// 실제 사이트(2026-11-23 운영 실측)는 파일 573개 중 537개가 글꼴 조각(작은 woff2)이라, 파일마다 받으면 새 배포 한 번에 올리기 요청이 568번이었음.
//  1 실제와 같은 모양의 사이트(글꼴 조각 537개 + 쪽 그림 14장 + 사이트 파일)를 앱과 같은 방식으로 올리면 올리기 요청이 열 번 안쪽, Pages API도 몇 번뿐
//  2 묶음 안 한 파일의 내용이 sha256과 다르면 그 파일만 failed로 돌려주고 나머지는 받음 → 그 파일을 하나씩 다시 보내면 공개됨
//  3 묶음 요청이 끊기거나(길이가 모자람) 모양이 틀리면 까닭 있는 오류로 끝나고, 다시 배포하면 이어서 됨(앞에서 받은 파일은 다시 보내지 않음)
//  4 예전 방식(파일마다 PUT)과 섞여도 됨: 묶음을 모르는 예전 앱은 그대로 올림
//  5 묶음에 넣을 수 없는 것(목록에 없는 파일·한도보다 큰 파일·너무 큰 묶음)은 거절, BUNDLE_BYTES 0이면 끝점도 /api/info의 표시도 없음
//  6 Worker 보기(파일을 이 객체에 둠)에서도 같은 끝점으로 받음
//  7 작은 파일이 2,000개를 넘는 사이트: Pages 자산 올리기 한 번에 2,000개까지만 실음(흉내 Pages는 그보다 많으면 거절)
//  8 묶음 하나를 받는 도중에 모아 둔 파일이 여러 번 차도(그때마다 Pages에 올림) 끝까지 받음. 빈 파일·같은 내용의 다른 이름·확장자도 그대로
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { HOSTING, REPO, startHost, call, deploy, manifestOf, sha256, bytesOf } from './helpers.mjs';
import { startFakeCf, ACCOUNT, TOKEN } from './fake-cf.mjs';

// 앱이 실제로 쓰는 묶음 나누기·본문 만들기(app/src/lib/site-size.js)를 그대로 불러 씀
const { bundlesOf, packBundle } = await import(join(REPO, 'app', 'src', 'lib', 'site-size.js'));

const ADMIN = 'it-admin-' + randomBytes(12).toString('hex');
const te = new TextEncoder();
const closers = [];
after(async () => { for (const c of closers.reverse()) await c(); });
let salt = 0;
/** 내용이 서로 다른 파일(n바이트) */
const blob = (n, tag = 'wOF2') => { const b = new Uint8Array(randomBytes(n)); b.set(te.encode(`${tag}${String(++salt).padStart(8, '0')}`), 0); return b; };
const html = (t) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${t}</title><link rel="stylesheet" href="assets/site.css"></head><body><main><h1>${t}</h1></main></body></html>`;

/** 실제 사이트와 같은 모양: 글꼴 조각 537개(가족 6벌 × 89개 + 3, 약 9KB씩 = 5MB) + 쪽 그림 14장(약 150KB) + 사이트 파일(HTML·CSS·작은 그림) = 573개 */
function realSite(title = '실제 모양') {
  const files = { 'index.html': html(title), 'assets/site.css': `main{max-width:60rem}/*${++salt}*/` };
  for (let i = 0; i < 537; i++) files[`assets/fonts/${String(i).padStart(4, '0')}-${salt}.woff2`] = blob(9 * 1024);
  for (let i = 1; i <= 14; i++) files[`material/p-${String(i).padStart(3, '0')}.webp`] = blob(150 * 1024, 'RIFF');
  for (let i = 0; i < 18; i++) files[`assets/img/i-${i}.webp`] = blob(20 * 1024, 'RIFF');
  files['assets/img/cover.webp'] = blob(700 * 1024, 'RIFF'); // 묶음에 넣지 않는 크기(512KB 넘음)
  files['assets/event.ics'] = 'BEGIN:VCALENDAR\nEND:VCALENDAR\n';
  return files;
}

/**
 * 앱(app/src/lib/deploy.js deployInstantRun의 upload)과 같은 순서로 올림: 목록 → 작은 파일은 묶어서, 서버가 failed로 돌려준 것과 큰 파일은 하나씩 → 공개.
 * @returns {{ status, body, puts: { bundle: number, single: number }, failed: string[], missing: string[], step?: string }}
 */
async function deployBundled(base, site, files, { limits, tamper = null, stopAfter = '' } = {}) {
  const manifest = manifestOf(files);
  const blobs = new Map(Object.entries(files).map(([p, v]) => [manifest[p].sha256, bytesOf(v)]));
  const puts = { bundle: 0, single: 0 }; const failedAll = [];
  const d = await call(base, 'POST', `/api/sites/${site.id}/deploys`, { key: site.key, json: { files: manifest } });
  if (d.status !== 200) return { step: 'deploys', puts, failed: failedAll, missing: [], ...d };
  const need = d.body.missing;
  const bun = limits?.bundle;
  let single = need;
  if (bun) {
    const groups = bundlesOf(need.filter((h) => blobs.get(h).length <= bun.itemBytes).map((h) => [h, blobs.get(h).length]), bun);
    const again = [];
    for (const g of groups) {
      const items = g.map(([h, n]) => [h, n, blobs.get(h)]);
      if (tamper) tamper(items);
      const raw = new Uint8Array(await packBundle(items).arrayBuffer());
      const r = await call(base, 'PUT', `/api/sites/${site.id}/blobs`, { key: site.key, raw });
      puts.bundle++;
      if (r.status !== 200) return { step: 'bundle', puts, failed: failedAll, missing: need, ...r };
      for (const f of r.body.failed) { again.push(f.sha256); failedAll.push(f); }
      if (stopAfter === 'first-bundle') return { step: 'stopped', puts, failed: failedAll, missing: need, status: 0, body: null };
    }
    const inGroup = new Set(groups.flat().map(([h]) => h));
    single = [...again, ...need.filter((h) => !inGroup.has(h))];
  }
  for (const sha of single) {
    const u = await call(base, 'PUT', `/api/sites/${site.id}/blobs/${sha}`, { key: site.key, raw: blobs.get(sha) });
    puts.single++;
    if (u.status !== 204) return { step: 'blobs', sha, puts, failed: failedAll, missing: need, ...u };
  }
  const p = await call(base, 'POST', `/api/sites/${site.id}/deploys/${d.body.deploy}/publish`, { key: site.key });
  return { step: 'publish', puts, failed: failedAll, missing: need, ...p };
}

const pagesHost = (cf, vars = {}) => startHost({
  ADMIN_KEY: ADMIN, SITES_PER_HOUR: 1000, SITES_PER_DAY: 1000, DEPLOYS_PER_HOUR: 1000, CATALOG_URL: 'off',
  VIEW: 'pages', CF_ACCOUNT_ID: ACCOUNT, PAGES_PROJECT: 'lecpage-view', PAGES_TOKEN: TOKEN, PAGES_HOST: `127.0.0.1:${cf.port}`,
  PAGES_SITE_URL: `${cf.url}/__view/{branch}/`, CF_API_BASE: cf.api, ...vars,
});

test('작은 파일 묶어 받기(VIEW=pages): 실제 모양 사이트의 올리기 요청이 568번 → 열 번 안쪽, 틀린 파일·끊긴 묶음·예전 방식과 섞임', { timeout: 600000 }, async (t) => {
  if (!existsSync(join(HOSTING, 'node_modules', 'wrangler', 'bin', 'wrangler.js'))) return t.skip('wrangler가 설치되지 않았어요');
  const cf = await startFakeCf();
  closers.push(cf.stop);
  let h;
  try { h = await pagesHost(cf); } catch (e) { return t.skip(`workerd를 띄우지 못함: ${String(e.message).split('\n')[0]}`); }
  closers.push(h.stop);
  const base = h.url;
  const limits = (await call(base, 'GET', '/api/info')).body.limits;
  assert.deepEqual(limits.bundle, { bytes: 8 * 1024 * 1024, itemBytes: 512 * 1024, files: 700 }, '/api/info가 묶음 한도를 알려 줌');
  const make = async (title = '묶음') => { const r = await call(base, 'POST', '/api/sites', { json: { title } }); assert.equal(r.status, 201, JSON.stringify(r.body)); return r.body; };
  const pagesCalls = () => cf.state.calls.filter(([, p]) => p.includes('/pages/')).length;
  const opens = async (url, path, bytes) => { const r = await fetch(`${url}${path}`); const b = new Uint8Array(await r.arrayBuffer()); assert.equal(r.status, 200, path); assert.equal(sha256(b), sha256(bytes), `${path} 내용이 올린 것과 같음`); };

  await t.test('실제 모양 사이트(파일 573개: 글꼴 조각 537 + 쪽 그림 14 + 사이트 파일): 올리기 요청 열 번 안쪽, 파일은 모두 그 주소에서 열림', async () => {
    const files = realSite();
    assert.equal(Object.keys(files).length, 573);
    const site = await make();
    const c0 = pagesCalls();
    const r = await deployBundled(base, site, files, { limits });
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
    // index.html·site.css·event.ics까지 새로 받을 것은 573개. 파일마다였다면 573번(실제 실측 568번)
    assert.equal(r.missing.length, 573);
    assert.equal(r.failed.length, 0);
    assert.ok(r.puts.bundle + r.puts.single <= 10, `올리기 요청 ${r.puts.bundle + r.puts.single}번(묶음 ${r.puts.bundle} + 하나씩 ${r.puts.single})`);
    assert.equal(r.puts.single, 1, '512KB를 넘는 그림 하나만 따로');
    assert.ok(pagesCalls() - c0 <= 20, `Pages API ${pagesCalls() - c0}번`);
    const dep = cf.deploymentsOf(`s-${site.id}`).at(-1);
    assert.equal(Object.keys(dep.manifest).filter((p) => p.startsWith('/assets/fonts/')).length, 537);
    assert.equal(cf.state.badHash?.length || 0, 0, 'Pages 열쇠가 내용과 맞음');
    const names = Object.keys(files);
    for (const p of [names.find((x) => x.startsWith('assets/fonts/')), names.filter((x) => x.startsWith('assets/fonts/')).at(-1), 'material/p-014.webp', 'assets/img/cover.webp', 'assets/site.css']) await opens(r.body.url, p, bytesOf(files[p]));
    t.diagnostic(`파일 573개: 올리기 요청 ${r.puts.bundle + r.puts.single}번(묶음 ${r.puts.bundle} + 하나씩 ${r.puts.single}), Pages API ${pagesCalls() - c0}번`);
    // 다시 배포(쪽 하나만 바뀜): 묶을 것이 없어도 그대로 됨
    const again = await deployBundled(base, site, { ...files, 'index.html': html('실제 모양 2') }, { limits });
    assert.equal(again.status, 200); assert.equal(again.missing.length, 1); assert.equal(again.puts.bundle + again.puts.single, 1);
  });

  await t.test('묶음 안 한 파일의 내용이 sha256과 다르면 그 파일만 failed, 나머지는 받음 → 그 파일을 하나씩 다시 보내면 공개됨', async () => {
    const files = realSite('틀린 파일');
    const site = await make();
    let bad = '';
    // 첫 묶음의 셋째 파일 내용을 바꿔 보냄(전송 중 깨진 것처럼). 목록의 sha256·크기는 그대로
    const r = await deployBundled(base, site, files, { limits, tamper: (items) => { if (!bad) { bad = items[2][0]; const b = new Uint8Array(items[2][2]); b[b.length - 1] ^= 0xff; items[2][2] = b; } } });
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
    assert.deepEqual(r.failed.map((f) => [f.sha256, f.code]), [[bad, 'bad_request']], '틀린 파일 하나만 알려 줌');
    assert.match(r.failed[0].message_ko, /sha256과 달라요/);
    assert.equal(r.puts.single, 2, '틀린 파일 + 512KB 넘는 그림');
    const path = Object.keys(files).find((p) => sha256(files[p]) === bad);
    await opens(r.body.url, path, bytesOf(files[path]));
  });

  await t.test('묶음 요청이 끊기거나 모양이 틀리면 까닭 있는 오류, 다시 배포하면 앞에서 받은 것은 다시 보내지 않고 이어서 됨', async () => {
    const files = realSite('끊긴 묶음');
    const site = await make();
    const manifest = manifestOf(files);
    const blobs = new Map(Object.entries(files).map(([p, v]) => [manifest[p].sha256, bytesOf(v)]));
    const d = await call(base, 'POST', `/api/sites/${site.id}/deploys`, { key: site.key, json: { files: manifest } });
    assert.equal(d.status, 200);
    // 이 사이트는 묶음 하나(8MiB·700개)에 다 들어가므로, 여기서는 묶음을 작게(3MB·300개) 나눠 둘 이상으로 보냄(서버 한도보다 작은 묶음은 언제나 됨)
    const groups = bundlesOf(d.body.missing.filter((x) => blobs.get(x).length <= limits.bundle.itemBytes).map((x) => [x, blobs.get(x).length]), { bytes: 3 * 1024 * 1024, files: 300 });
    assert.ok(groups.length >= 2, `묶음 ${groups.length}개`);
    const pack = async (g) => new Uint8Array(await packBundle(g.map(([x, n]) => [x, n, blobs.get(x)])).arrayBuffer());
    // 첫 묶음은 제대로, 둘째 묶음은 끝이 잘린 채로
    const ok1 = await call(base, 'PUT', `/api/sites/${site.id}/blobs`, { key: site.key, raw: await pack(groups[0]) });
    assert.equal(ok1.status, 200); assert.deepEqual([ok1.body.got, ok1.body.failed.length], [groups[0].length, 0]);
    const cut = (await pack(groups[1])).subarray(0, -100);
    const broken = await call(base, 'PUT', `/api/sites/${site.id}/blobs`, { key: site.key, raw: cut });
    assert.equal(broken.status, 400); assert.equal(broken.body.error.code, 'bad_request'); assert.match(broken.body.error.message_ko, /묶음에 적은 크기와 내용의 길이가 달라요/);
    for (const [raw, why] of [[new Uint8Array([0, 0]), '너무 짧음'], [new Uint8Array([0, 0, 0, 5, 1, 2, 3, 4, 5]), '머리가 JSON이 아님'], [new Uint8Array([0xff, 0xff, 0xff, 0xff, 1]), '머리 길이가 틀림']]) {
      const r = await call(base, 'PUT', `/api/sites/${site.id}/blobs`, { key: site.key, raw });
      assert.equal(r.status, 400, why); assert.equal(r.body.error.code, 'bad_request', why);
    }
    // 아직 다 올리지 않았는데 공개하면 없는 파일을 알려 줌
    const early = await call(base, 'POST', `/api/sites/${site.id}/deploys/${d.body.deploy}/publish`, { key: site.key });
    assert.equal(early.status, 409); assert.equal(early.body.error.code, 'missing_blobs');
    // 다시 배포: 첫 묶음에서 받은 파일은 새로 받을 목록에 없음
    const again = await deployBundled(base, site, files, { limits });
    assert.equal(again.status, 200, JSON.stringify(again.body).slice(0, 300));
    assert.equal(again.missing.length, 573 - groups[0].length, '앞에서 받은 파일은 다시 보내지 않음');
    await opens(again.body.url, 'material/p-001.webp', bytesOf(files['material/p-001.webp']));
  });

  await t.test('예전 방식과 섞임: 묶음을 모르는 앱(파일마다 PUT)은 그대로 되고, 묶음으로 일부만 보낸 뒤 나머지를 파일마다 보내도 됨', async () => {
    const old = realSite('예전 앱');
    const s1 = await make();
    const r1 = await deploy(base, s1, old); // helpers.mjs deploy: 파일마다 PUT
    assert.equal(r1.status, 200, JSON.stringify(r1.body).slice(0, 300)); assert.equal(r1.again, 0);
    const files = realSite('섞임');
    const s2 = await make();
    const part = await deployBundled(base, s2, files, { limits, stopAfter: 'first-bundle' });
    assert.equal(part.step, 'stopped');
    const rest = await deploy(base, s2, files); // 나머지를 파일마다
    assert.equal(rest.status, 200, JSON.stringify(rest.body).slice(0, 300));
    assert.ok(rest.missing.length < 573 && rest.missing.length > 0, `묶음으로 받은 것을 뺀 ${rest.missing.length}개만 새로`);
  });

  await t.test('묶음에 넣을 수 없는 것: 목록에 없는 파일·크기가 다른 파일은 그 파일만 failed, 한도보다 큰 파일·너무 큰 묶음은 거절', async () => {
    const site = await make();
    const files = { 'index.html': html('거절'), 'assets/img/a.webp': blob(1000, 'RIFF'), 'assets/img/b.webp': blob(2000, 'RIFF'), 'assets/img/big.webp': blob(600 * 1024, 'RIFF') };
    const man = manifestOf(files);
    const d = await call(base, 'POST', `/api/sites/${site.id}/deploys`, { key: site.key, json: { files: man } });
    assert.equal(d.status, 200);
    const stranger = blob(500, 'RIFF');
    const pack = async (items) => new Uint8Array(await packBundle(items).arrayBuffer());
    const r = await call(base, 'PUT', `/api/sites/${site.id}/blobs`, { key: site.key, raw: await pack([[man['assets/img/a.webp'].sha256, 1000, files['assets/img/a.webp']], [sha256(stranger), 500, stranger]]) });
    assert.equal(r.status, 200); assert.equal(r.body.got, 1);
    assert.deepEqual(r.body.failed.map((f) => f.sha256), [sha256(stranger)]); assert.match(r.body.failed[0].message_ko, /배포 목록에 없는 파일/);
    // 묶음에 넣을 수 있는 크기(512KB)를 넘는 파일, 같은 파일을 두 번: 묶음 모양 오류
    const big = await call(base, 'PUT', `/api/sites/${site.id}/blobs`, { key: site.key, raw: await pack([[man['assets/img/big.webp'].sha256, 600 * 1024, files['assets/img/big.webp']]]) });
    assert.equal(big.status, 400);
    const twice = await call(base, 'PUT', `/api/sites/${site.id}/blobs`, { key: site.key, raw: await pack([[man['assets/img/b.webp'].sha256, 2000, files['assets/img/b.webp']], [man['assets/img/b.webp'].sha256, 2000, files['assets/img/b.webp']]]) });
    assert.equal(twice.status, 400);
    // 묶음 전체 한도(8MiB)를 넘는 요청은 읽기 전에 거절
    const huge = await call(base, 'PUT', `/api/sites/${site.id}/blobs`, { key: site.key, raw: new Uint8Array(8 * 1024 * 1024 + 80 * 1024) });
    assert.equal(huge.status, 413); assert.equal(huge.body.error.code, 'too_large');
    // 열쇠 없이는 받지 않음
    const noKey = await call(base, 'PUT', `/api/sites/${site.id}/blobs`, { raw: await pack([[man['assets/img/b.webp'].sha256, 2000, files['assets/img/b.webp']]]) });
    assert.equal(noKey.status, 401);
    const fin = await deployBundled(base, site, files, { limits });
    assert.equal(fin.status, 200, JSON.stringify(fin.body).slice(0, 300));
  });

  await t.test('작은 파일이 2,000개를 넘는 사이트: Pages 자산 올리기 한 번에 2,000개까지만 실어 보내고 끝까지 공개됨', async () => {
    // 200바이트짜리 2,100개(420KB)는 모으는 자리(16MB)에 다 들어가 공개할 때 한꺼번에 올라감 → 나누지 않으면 올리기 한 번에 2,100개가 넘게 실림.
    // wrangler는 한 번에 2,000개까지만 보내므로 같은 선에서 나눔(pages-api.js UPLOAD_MAX_FILES). 흉내 Pages는 2,000개를 넘는 올리기를 400으로 거절함
    const files = { 'index.html': html('작은 파일 많이') };
    for (let i = 0; i < 2100; i++) files[`assets/fonts/t-${i}.woff2`] = blob(200);
    const site = await make('작은 파일 많이');
    const u0 = (cf.state.uploads || []).length;
    const r = await deployBundled(base, site, files, { limits });
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
    assert.equal(r.failed.length, 0);
    const ups = cf.state.uploads.slice(u0);
    assert.ok(ups.length >= 2, `올리기를 나눠 보냄: ${JSON.stringify(ups)}`);
    assert.ok(Math.max(...ups) <= 2000, `한 번에 2,000개까지: ${JSON.stringify(ups)}`);
    assert.ok(ups.reduce((a, n) => a + n, 0) >= 2100, `모두 올라감: ${JSON.stringify(ups)}`);
    const dep = cf.deploymentsOf(`s-${site.id}`).at(-1);
    assert.equal(Object.keys(dep.manifest).filter((p) => p.startsWith('/assets/fonts/t-')).length, 2100);
    for (const p of ['assets/fonts/t-0.woff2', 'assets/fonts/t-1999.woff2', 'assets/fonts/t-2000.woff2', 'assets/fonts/t-2099.woff2']) await opens(r.body.url, p, bytesOf(files[p]));
  });
});

test('묶어 받기를 끈 서버(BUNDLE_BYTES 0)와 Worker 보기', { timeout: 300000 }, async (t) => {
  if (!existsSync(join(HOSTING, 'node_modules', 'wrangler', 'bin', 'wrangler.js'))) return t.skip('wrangler가 설치되지 않았어요');
  await t.test('끈 서버: /api/info에 표시가 없고 끝점도 없는 주소 → 앱은 파일마다 올림', async () => {
    let h;
    try { h = await startHost({ ADMIN_KEY: ADMIN, SITES_PER_HOUR: 1000, SITES_PER_DAY: 1000, CATALOG_URL: 'off', BUNDLE_BYTES: 0 }); } catch (e) { return t.skip(`workerd를 띄우지 못함: ${String(e.message).split('\n')[0]}`); }
    closers.push(h.stop);
    const info = (await call(h.url, 'GET', '/api/info')).body;
    assert.equal(info.limits.bundle, undefined);
    const site = (await call(h.url, 'POST', '/api/sites', { json: { title: '끔' } })).body;
    const r = await call(h.url, 'PUT', `/api/sites/${site.id}/blobs`, { key: site.key, raw: new Uint8Array(10) });
    assert.equal(r.status, 404);
    const files = { 'index.html': html('끔'), 'assets/site.css': 'main{}', 'assets/img/a.webp': blob(3000, 'RIFF') };
    const d = await deployBundled(h.url, site, files, { limits: info.limits });
    assert.equal(d.status, 200, JSON.stringify(d.body).slice(0, 300)); assert.deepEqual(d.puts, { bundle: 0, single: 3 });
  });
  await t.test('Worker 보기(파일을 이 객체 저장소에 둠): 같은 끝점으로 받고 사이트가 열림, 틀린 파일은 그 파일만 failed', async () => {
    let h;
    try { h = await startHost({ ADMIN_KEY: ADMIN, SITES_PER_HOUR: 1000, SITES_PER_DAY: 1000, CATALOG_URL: 'off' }); } catch (e) { return t.skip(`workerd를 띄우지 못함: ${String(e.message).split('\n')[0]}`); }
    closers.push(h.stop);
    const info = (await call(h.url, 'GET', '/api/info')).body;
    assert.equal(info.view, 'worker'); assert.ok(info.limits.bundle);
    const site = (await call(h.url, 'POST', '/api/sites', { json: { title: 'worker 보기' } })).body;
    const files = { 'index.html': html('worker 보기'), 'assets/site.css': 'main{max-width:50rem}' };
    for (let i = 0; i < 40; i++) files[`assets/fonts/f-${i}.woff2`] = blob(9 * 1024);
    let bad = '';
    const r = await deployBundled(h.url, site, files, { limits: info.limits, tamper: (items) => { if (!bad) { bad = items[1][0]; const b = new Uint8Array(items[1][2]); b[0] ^= 0xff; items[1][2] = b; } } });
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
    assert.deepEqual(r.failed.map((f) => f.sha256), [bad]);
    assert.deepEqual(r.puts, { bundle: 1, single: 1 });
    const css = await fetch(`${r.body.url}assets/site.css`);
    assert.equal(css.status, 200); assert.equal(await css.text(), 'main{max-width:50rem}');
    const font = await fetch(`${r.body.url}assets/fonts/f-39.woff2`);
    assert.equal(font.status, 200); assert.equal(sha256(new Uint8Array(await font.arrayBuffer())), sha256(files['assets/fonts/f-39.woff2']));
  });
  await t.test('묶음 하나를 받는 도중에 모아 둔 파일이 여러 번 참(VIEW=pages): 그때마다 Pages에 올리고 이어 받음. 빈 파일·같은 내용의 다른 이름·확장자도 그대로 열림', async () => {
    const cf = await startFakeCf();
    closers.push(cf.stop);
    // 모으는 자리를 300KB로 줄임(운영 기본은 16MB): 50KB 그림 30장이 든 묶음 하나를 받는 동안 다섯 번쯤 참
    let h;
    try { h = await pagesHost(cf, { DEFER_TOTAL_BYTES: 300 * 1024, DEFER_MAX_BYTES: 200 * 1024 }); } catch (e) { return t.skip(`workerd를 띄우지 못함: ${String(e.message).split('\n')[0]}`); }
    closers.push(h.stop);
    const site = (await call(h.url, 'POST', '/api/sites', { json: { title: '모으다 참' } })).body;
    const same = blob(40 * 1024, 'RIFF');
    const files = {
      'index.html': html('모으다 참'), 'assets/site.css': 'main{max-width:40rem}', 'assets/empty.txt': new Uint8Array(0), 'assets/empty.css': new Uint8Array(0),
      'assets/a.png': same, 'assets/a.webp': same, 'assets/copy/a.webp': same, 'assets/UP.PNG': same,
    };
    for (let i = 0; i < 30; i++) files[`material/p-${i}.webp`] = blob(50 * 1024, 'RIFF');
    const manifest = manifestOf(files);
    const blobs = new Map(Object.entries(files).map(([p, v]) => [manifest[p].sha256, bytesOf(v)]));
    const d = await call(h.url, 'POST', `/api/sites/${site.id}/deploys`, { key: site.key, json: { files: manifest } });
    assert.equal(d.status, 200, JSON.stringify(d.body).slice(0, 300));
    assert.equal(d.body.missing.length, 34, '첫 화면 + CSS + 빈 내용 하나(빈 파일 둘이 같은 내용) + 같은 내용 하나 + 그림 30장');
    // 모두 묶음 하나에(1.5MB)
    const u0 = (cf.state.uploads || []).length;
    const raw = new Uint8Array(await packBundle(d.body.missing.map((x) => [x, blobs.get(x).length, blobs.get(x)])).arrayBuffer());
    const up = await call(h.url, 'PUT', `/api/sites/${site.id}/blobs`, { key: site.key, raw });
    assert.equal(up.status, 200, JSON.stringify(up.body).slice(0, 300));
    assert.deepEqual([up.body.got, up.body.failed.length], [34, 0]);
    const mid = cf.state.uploads.length - u0;
    assert.ok(mid >= 3, `묶음 하나를 받는 동안 모은 것을 Pages에 ${mid}번 올림`);
    const p = await call(h.url, 'POST', `/api/sites/${site.id}/deploys/${d.body.deploy}/publish`, { key: site.key });
    assert.equal(p.status, 200, JSON.stringify(p.body).slice(0, 300));
    assert.equal(cf.state.badHash?.length || 0, 0, 'Pages 열쇠가 내용과 맞음');
    for (const [path, v] of Object.entries(files)) {
      if (path === 'index.html') continue; // 첫 화면은 서버가 손봐서 올림
      const r = await fetch(`${p.body.url}${path}`); const b = new Uint8Array(await r.arrayBuffer());
      assert.equal(r.status, 200, path); assert.equal(sha256(b), sha256(bytesOf(v)), `${path} 내용이 올린 것과 같음`);
    }
    // 같은 내용으로 다시: 도중에 올린 것도 공개할 때 올린 것도 모두 받은 것으로 적혀 있음
    const d2 = await call(h.url, 'POST', `/api/sites/${site.id}/deploys`, { key: site.key, json: { files: manifest } });
    assert.equal(d2.status, 200); assert.deepEqual(d2.body.missing, []);
  });
});
