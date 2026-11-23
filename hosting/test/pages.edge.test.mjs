// 통합 시험(VIEW=pages): 바로 배포가 경계·고장 상황에서도 끝나는지(성공하거나, 까닭이 있는 오류로 끝나고 다시 하면 이어서 됨).
// 로컬 workerd + 흉내 Cloudflare API(test/fake-cf.mjs의 faults로 고장을 끼워 넣음).
//  1 한도 경계(파일 수·파일 하나·사이트 전체): 딱 맞으면 되고, 넘으면 올리기 전에 까닭과 함께 거절
//  2 메모리에 두는 작은 파일 합계(16MB)를 넘는 사이트도 한 번에 공개
//  3 Cloudflare API의 순간 오류(5xx·답 없음)는 서버가 한 번 더 해서 강사에게 보이지 않음. 이어지는 오류는 502로 끝나고 다시 하면 이어서 됨
//  4 배포 만들기의 답이 끊긴 경우(Cloudflare에는 생겼는데 우리는 모름): 다시 하면 되고, 그 배포는 목록에서 찾아 지우며, 내리면 그 주소가 안내 화면으로 덮임.
//    내린 뒤에 늦게 생긴 배포가 주소를 가져가도 조금 뒤 다시 확인해 되돌림. 목록을 못 받아도 내리기는 끝남
//  5 같은 배포를 동시에 두 번 공개, 다시 배포(같은 파일·일부만 바뀜·파일이 줄어듦), 내린 뒤 새로 만들기
//  6 Cloudflare가 429로 막으면 까닭(pages_api)·다시 될 때와 함께 거절(앱이 줄을 섬)
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { HOSTING, startHost, call, deploy, manifestOf } from './helpers.mjs';
import { startFakeCf, ACCOUNT, TOKEN } from './fake-cf.mjs';

const ADMIN = 'it-admin-' + randomBytes(12).toString('hex');
const te = new TextEncoder();
const closers = [];
after(async () => { for (const c of closers.reverse()) await c(); });
const MB = 1024 * 1024;
let salt = 0;
/** 내용이 서로 다른 그림 모양 파일(n바이트) */
const webp = (n) => { const b = new Uint8Array(n); const k = ++salt; for (let i = 0; i < n; i++) b[i] = ((i + k) * 2654435761) >>> 24; b.set(te.encode(`RIFF\0\0\0\0WEBPVP8 ${String(k).padStart(6, '0')}`), 0); return b; };
const html = (t) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${t}</title></head><body><main><h1>${t}</h1></main></body></html>`;
const get = async (url) => { const r = await fetch(url, { redirect: 'manual' }); return { status: r.status, text: await r.text() }; };

async function host(cf, vars = {}) {
  return startHost({
    ADMIN_KEY: ADMIN, SITES_PER_HOUR: 1000, SITES_PER_DAY: 1000, DEPLOYS_PER_HOUR: 1000, CATALOG_URL: 'off',
    VIEW: 'pages', CF_ACCOUNT_ID: ACCOUNT, PAGES_PROJECT: 'lecpage-view', PAGES_TOKEN: TOKEN, PAGES_HOST: `127.0.0.1:${cf.port}`,
    PAGES_SITE_URL: `${cf.url}/__view/{branch}/`, CF_API_BASE: cf.api, ...vars,
  });
}

test('VIEW=pages 경계·고장: 한도 딱 맞음/넘음, 순간 오류, 답이 끊긴 배포, 동시 공개, 다시 배포', async (t) => {
  if (!existsSync(join(HOSTING, 'node_modules', 'wrangler', 'bin', 'wrangler.js'))) return t.skip('wrangler가 설치되지 않았어요');
  const cf = await startFakeCf();
  closers.push(cf.stop);
  let h;
  // CF_ORPHAN_SETTLE_MS: 답이 끊긴 '배포 만들기'가 늦게 끝날 수 있다고 보는 시간(실제 5분)을 시험에서는 1.5초로
  // DEFER_MAX_BYTES: 메모리에 모아 올리는 작은 파일의 기준(실제 4MB)을 512KB로 — 700KB짜리를 '받을 때 바로 Pages에 올리는 큰 파일'로 써서 올리기 단계의 고장을 봄
  try { h = await host(cf, { MAX_FILES: 40, MAX_FILE_BYTES: 2 * MB, MAX_BYTES: 24 * MB, CF_API_TIMEOUT_MS: 1500, CF_ORPHAN_SETTLE_MS: 1500, DEFER_MAX_BYTES: 512 * 1024 }); }
  catch (e) { return t.skip(`workerd를 띄우지 못함: ${String(e.message).split('\n')[0]}`); }
  closers.push(h.stop);
  const base = h.url;
  const make = async (title = '경계') => { const r = await call(base, 'POST', '/api/sites', { json: { title } }); assert.equal(r.status, 201, JSON.stringify(r.body)); return r.body; };
  const callsOf = (step) => cf.state.calls.filter(([, p]) => p.endsWith(step)).length;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (fn, ms = 6000) => { const t0 = Date.now(); for (;;) { if (await fn()) return true; if (Date.now() - t0 > ms) return false; await wait(150); } };
  const listCalls = () => cf.state.calls.filter(([m, p]) => m === 'GET' && p.endsWith('/deployments')).length;
  /**
   * 내리기. 답이 끊긴 '배포 만들기'가 있은 지 얼마 안 됐으면 서버는 '지우는 중'(202)으로 두고 조금 뒤 다시 확인함(실제로는 알람, 여기서는 다시 불러서).
   * 다 지울 때까지 다시 부름. 처음 답·마지막 답·부른 횟수
   */
  const takeDown = async (path, key) => {
    const first = await call(base, 'DELETE', path, { key });
    let last = first; let n = 1;
    while (last.status === 202 && n < 14) { await wait(600); last = await call(base, 'DELETE', path, { key }); n++; }
    return { first: first.status, last: last.status, n };
  };

  await t.test('파일 수: 40개는 되고 41개는 올리기 전에 까닭과 함께 거절', async () => {
    const files = { 'index.html': html('파일 수') };
    for (let i = 0; i < 39; i++) files[`assets/img/p-${i}.webp`] = webp(2000 + i);
    const site = await make();
    const ok = await deploy(base, site, files);
    assert.equal(ok.status, 200, JSON.stringify(ok.body)); assert.equal(ok.again, 0);
    const over = await deploy(base, site, { ...files, 'assets/img/one-more.webp': webp(2000) });
    assert.equal(over.step, 'deploys'); assert.equal(over.status, 413); assert.equal(over.body.error.code, 'too_many_files'); assert.match(over.body.error.message_ko, /40개까지/);
    assert.equal((await get(ok.body.url)).status, 200, '거절한 뒤에도 공개한 사이트는 그대로 열림');
  });

  await t.test('파일 하나: 2MB 딱 맞으면 되고 1바이트 넘으면 어느 파일인지와 함께 거절', async () => {
    const site = await make();
    const ok = await deploy(base, site, { 'index.html': html('파일 크기'), 'files/교재 원본.pdf': webp(2 * MB) });
    assert.equal(ok.status, 200, JSON.stringify(ok.body)); assert.equal(ok.again, 0);
    const over = await deploy(base, site, { 'index.html': html('파일 크기'), 'files/너무 큰 교재.pdf': webp(2 * MB + 1) });
    assert.equal(over.step, 'deploys'); assert.equal(over.status, 413); assert.equal(over.body.error.code, 'too_large');
    assert.equal(over.body.error.path, 'files/너무 큰 교재.pdf'); assert.match(over.body.error.message_ko, /파일 하나가 너무 커요\(2MB까지\)/);
  });

  await t.test('사이트 전체: 24MB 딱 맞으면 되고(작은 파일 합계가 16MB를 넘어도 한 번에 공개) 넘으면 거절', async () => {
    const index = te.encode(html('전체 크기'));
    // 500KB 작은 파일 35개(17MB: 메모리에 두는 합계 16MB를 넘김) + 2MB 큰 파일들로 24MB를 딱 맞춤(파일 40개)
    const files = { 'index.html': index };
    for (let i = 0; i < 35; i++) files[`assets/img/s-${i}.webp`] = webp(500 * 1024);
    let left = 24 * MB - index.length - 35 * 500 * 1024;
    for (let i = 0; left > 0; i++) { const n = Math.min(2 * MB, left); files[`files/b-${i}.pdf`] = webp(n); left -= n; }
    assert.equal(Object.keys(files).length, 40); assert.equal(Object.values(files).reduce((n, v) => n + v.length, 0), 24 * MB);
    const uploadsBefore = callsOf('/pages/assets/upload');
    const site = await make();
    const ok = await deploy(base, site, files);
    assert.equal(ok.status, 200, JSON.stringify(ok.body).slice(0, 300)); assert.equal(ok.again, 0, '없는 파일이라며 다시 올리게 하지 않음');
    const dep = cf.deploymentsOf(`s-${site.id}`).at(-1);
    assert.equal(Object.keys(dep.manifest).filter((p) => p.startsWith('/assets/img/s-')).length, 35);
    assert.ok(callsOf('/pages/assets/upload') - uploadsBefore >= 5, '16MB를 넘은 작은 파일과 큰 파일은 받을 때 바로 Pages로');
    const one = await get(`${ok.body.url}assets/img/s-34.webp`);
    assert.equal(one.status, 200);
    const over = await deploy(base, site, { ...files, 'index.html': html('전체 크기 조금 더 큼') });
    assert.equal(over.step, 'deploys'); assert.equal(over.status, 413); assert.equal(over.body.error.code, 'too_large'); assert.match(over.body.error.message_ko, /사이트가 너무 커요\(24MB까지\)/);
  });

  await t.test('순간 오류(자산 확인·올리기·열쇠 적기·토큰이 한 번 5xx)는 서버가 한 번 더 해서 배포가 그대로 끝남', async () => {
    for (const on of ['check-missing', 'upload', 'upsert-hashes']) {
      const site = await make();
      cf.state.faults.push({ on, status: 503, times: 1 });
      const r = await deploy(base, site, { 'index.html': html(`순간 ${on}`), 'assets/img/big.webp': webp(700 * 1024) });
      assert.equal(r.status, 200, `${on}: ${JSON.stringify(r.body).slice(0, 200)}`); assert.equal(r.again, 0);
      assert.equal(cf.state.faults.filter((x) => x.times > 0).length, 0, `${on}: 고장을 실제로 지나감`);
    }
  });

  await t.test('답 없음(시간 초과): 기다리다 끊고, 한 번 더 해서 되면 그대로 끝남. 계속 답이 없으면 502로 끝나고 다시 하면 이어서 됨', async () => {
    const site = await make();
    cf.state.faults.push({ on: 'check-missing', hang: 2500, times: 1 });
    const t0 = Date.now();
    const r = await deploy(base, site, { 'index.html': html('답 없음'), 'assets/img/big.webp': webp(700 * 1024) });
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
    assert.ok(Date.now() - t0 < 15000, '끝없이 기다리지 않음');
    // 계속 답이 없음: 큰 파일 받기가 502(사람이 읽을 까닭 + 어느 호출인지)로 끝남
    const site2 = await make();
    const files = { 'index.html': html('답 없음 2'), 'assets/img/big.webp': webp(700 * 1024) };
    cf.state.faults.push({ on: 'check-missing', hang: 2500, times: 2 });
    const bad = await deploy(base, site2, files);
    assert.equal(bad.step, 'blobs'); assert.equal(bad.status, 502);
    assert.match(bad.body.error.message_ko, /Cloudflare Pages에 올리지 못했어요\. 잠시 뒤 다시 배포해 주세요\.$/); assert.equal(bad.body.error.step, 'check-missing');
    assert.equal(bad.body.error.reason, undefined, '붐빔(reason)이 아님: 앱이 다른 곳으로 넘기지 않고 [다시 배포]로 이어 감');
    await new Promise((r2) => setTimeout(r2, 2600)); // 흉내 서버에 걸려 있던 답이 끝나게
    const again = await deploy(base, site2, files);
    assert.equal(again.status, 200, JSON.stringify(again.body).slice(0, 200));
  });

  await t.test('공개할 때 Cloudflare가 5xx(배포 만들기 실패): 502로 끝나고, 같은 배포를 다시 공개하면 됨(파일을 다시 올리지 않음)', async () => {
    const site = await make();
    cf.state.faults.push({ on: 'deployments', status: 500, times: 1 });
    const files = { 'index.html': html('공개 실패'), 'assets/img/a.webp': webp(30000) };
    const bad = await deploy(base, site, files);
    assert.equal(bad.step, 'publish'); assert.equal(bad.status, 502); assert.match(bad.body.error.message_ko, /Cloudflare Pages에 배포하지 못했어요/);
    const again = await call(base, 'POST', `/api/sites/${site.id}/deploys/${bad.deploy}/publish`, { key: site.key });
    assert.equal(again.status, 200, JSON.stringify(again.body).slice(0, 200));
    assert.equal((await get(again.body.url)).status, 200);
  });

  await t.test('배포 만들기의 답이 끊김(Cloudflare에는 생김): 다시 하면 되고 모르는 배포는 찾아 지움, 한 번도 못 끝낸 사이트를 내려도 그 주소는 안내 화면', async () => {
    // (가) 다시 해서 끝낸 뒤 내리기
    const site = await make(); const branch = `s-${site.id}`;
    cf.state.faults.push({ on: 'deployments', status: 502, times: 1, after: true });
    const files = { 'index.html': html('끊긴 답 비밀 내용'), 'assets/img/a.webp': webp(30000) };
    const bad = await deploy(base, site, files);
    assert.equal(bad.step, 'publish'); assert.equal(bad.status, 502);
    assert.equal(cf.deploymentsOf(branch).length, 1, 'Cloudflare에는 배포가 생겼음(우리는 id를 모름)');
    const ok = await deploy(base, site, files);
    assert.equal(ok.status, 200);
    // 다음 성공 배포 직후: 모르는 배포를 목록에서 찾아 지움(그 배포의 고유 주소 <해시>.…pages.dev에 내용이 남지 않게)
    assert.ok(await until(() => cf.deploymentsOf(branch).length === 1), `모르는 배포를 지움(남은 배포 ${cf.deploymentsOf(branch).length}개)`);
    assert.match((await get(site.url)).text, /끊긴 답 비밀 내용/, '공개한 사이트는 그대로 열림');
    const down = await takeDown(`/api/sites/${site.id}`, site.key);
    assert.ok([204, 404].includes(down.last), JSON.stringify(down));
    const gone = await get(site.url);
    assert.match(gone.text, /강사가 사이트를 내렸어요/); assert.doesNotMatch(gone.text, /끊긴 답 비밀 내용/);
    assert.equal(cf.deploymentsOf(branch).length, 1, '안내 화면 하나만 남음');
    // (나) 한 번도 끝내지 못하고 내리기: 우리가 아는 배포가 없어도 그 주소를 안내 화면으로 덮고, 모르는 배포는 찾아 지움
    const site2 = await make(); const branch2 = `s-${site2.id}`;
    cf.state.faults.push({ on: 'deployments', status: 502, times: 1, after: true });
    const bad2 = await deploy(base, site2, { 'index.html': html('둘째 비밀 내용') });
    assert.equal(bad2.status, 502);
    assert.match((await get(site2.url)).text, /둘째 비밀 내용/, '답은 끊겼지만 Cloudflare 쪽 주소에는 내용이 나감');
    const first2 = await call(base, 'DELETE', `/api/sites/${site2.id}`, { key: site2.key });
    assert.ok([202, 204].includes(first2.status), JSON.stringify(first2.body));
    const gone2 = await get(site2.url);
    assert.match(gone2.text, /강사가 사이트를 내렸어요/, '처음 내릴 때 바로 안내 화면'); assert.doesNotMatch(gone2.text, /둘째 비밀 내용/);
    assert.equal(cf.deploymentsOf(branch2).length, 1, '내용이 든 모르는 배포는 바로 지움(안내 화면 하나만)');
    if (first2.status === 202) assert.ok([204, 404].includes((await takeDown(`/api/sites/${site2.id}`, site2.key)).last));
    assert.match((await get(site2.url)).text, /강사가 사이트를 내렸어요/);
    // (다) 운영자가 지울 때도(안내 화면 없이 배포만 지우던 길) 모르는 배포로 돌아가지 않음
    const site3 = await make();
    cf.state.faults.push({ on: 'deployments', status: 502, times: 1, after: true });
    const f3 = { 'index.html': html('셋째 비밀 내용') };
    assert.equal((await deploy(base, site3, f3)).status, 502);
    assert.equal((await deploy(base, site3, f3)).status, 200);
    const del = await takeDown(`/api/admin/sites/${site3.id}`, ADMIN);
    assert.ok([200, 202, 204].includes(del.first) && [200, 204, 404].includes(del.last), JSON.stringify(del));
    assert.doesNotMatch((await get(site3.url)).text, /셋째 비밀 내용/);
    assert.ok(cf.deploymentsOf(`s-${site3.id}`).length <= 1, '내용이 든 배포가 남지 않음');
  });

  await t.test('늦게 끝난 배포 만들기: 내린 뒤에 Cloudflare에 생겨 브랜치 주소를 가져가도, 조금 뒤 다시 확인해 지우고 안내 화면으로 되돌림', async () => {
    const site = await make(); const branch = `s-${site.id}`;
    assert.equal((await deploy(base, site, { 'index.html': html('처음 내용') })).status, 200);
    // 우리는 1.5초에 끊고(답 없음 → 실패로 앎), 흉내 Cloudflare는 2.6초 뒤에 그 배포를 만듦
    cf.state.faults.push({ on: 'deployments', hang: 2600, times: 1, after: true });
    const bad = await deploy(base, site, { 'index.html': html('늦게 끝난 비밀 내용') });
    assert.equal(bad.status, 502);
    const first = await call(base, 'DELETE', `/api/sites/${site.id}`, { key: site.key });
    assert.equal(first.status, 202, '더 생길 수 있는 동안은 지우는 중으로 두고 조금 뒤 다시 확인');
    assert.match((await get(site.url)).text, /강사가 사이트를 내렸어요/);
    // 늦게 생긴 배포가 브랜치 주소를 가져감(Pages는 브랜치 주소를 가장 최근 배포에 붙임). 다시 확인하지 않으면 내린 사이트 내용이 이대로 남음
    assert.ok(await until(async () => cf.deploymentsOf(branch).length === 2, 5000), '흉내 Cloudflare가 늦게 배포를 만듦');
    const down = await takeDown(`/api/sites/${site.id}`, site.key);
    assert.ok([204, 404].includes(down.last), JSON.stringify(down));
    const gone = await get(site.url);
    assert.match(gone.text, /강사가 사이트를 내렸어요/); assert.doesNotMatch(gone.text, /늦게 끝난 비밀 내용/);
    assert.equal(cf.deploymentsOf(branch).length, 1, '안내 화면 하나만 남음(늦게 생긴 배포는 지움)');
    assert.equal(cf.state.faults.filter((x) => x.times > 0).length, 0, '고장을 실제로 지나감');
  });

  await t.test('내릴 때 배포 목록을 못 받아도(Cloudflare 오류) 내리기는 끝남: 주소는 안내 화면, 몇 번만 다시 해 봄', async () => {
    const site = await make();
    cf.state.faults.push({ on: 'deployments', status: 502, times: 1, after: true });
    assert.equal((await deploy(base, site, { 'index.html': html('목록 실패 비밀 내용') })).status, 502);
    cf.state.faults.push({ on: 'deployments-list', status: 500, times: 99 });
    const down = await takeDown(`/api/sites/${site.id}`, site.key);
    cf.state.faults = cf.state.faults.filter((x) => x.on !== 'deployments-list');
    assert.ok([204, 404].includes(down.last), `끝없이 다시 하지 않음: ${JSON.stringify(down)}`);
    const gone = await get(site.url);
    assert.match(gone.text, /강사가 사이트를 내렸어요/); assert.doesNotMatch(gone.text, /목록 실패 비밀 내용/);
  });

  await t.test('다시 배포하지 않아도 조금 뒤 서버가 스스로(알람) 모르는 배포를 찾아 적어 둠 → 내리면 한 번에 함께 지움', async () => {
    const site = await make(); const branch = `s-${site.id}`;
    assert.equal((await deploy(base, site, { 'index.html': html('알람 처음 내용') })).status, 200);
    cf.state.faults.push({ on: 'deployments', status: 502, times: 1, after: true });
    assert.equal((await deploy(base, site, { 'index.html': html('알람 비밀 내용') })).status, 502);
    assert.equal(cf.deploymentsOf(branch).length, 2, '지금 배포 + 모르는 배포');
    const before = listCalls();
    await wait(3400); // 생길 수 있는 시간(1.5초) + 1초 뒤에 알람이 울림
    assert.ok(listCalls() > before, '알람이 배포 목록을 봄');
    assert.equal(cf.deploymentsOf(branch).length, 2, '지금 배포보다 나중에 생긴 것은 주소가 붙어 있을 수 있어 지우지 않고 적어만 둠');
    const mid = listCalls();
    const first = await call(base, 'DELETE', `/api/sites/${site.id}`, { key: site.key });
    assert.equal(first.status, 204, '정리가 끝났으니 내리기는 한 번에 끝남');
    assert.equal(listCalls(), mid, '알람이 이미 적어 둬서 내릴 때는 목록을 다시 보지 않음(적어 둔 id로 지움)');
    const gone = await get(site.url);
    assert.match(gone.text, /강사가 사이트를 내렸어요/); assert.doesNotMatch(gone.text, /알람 (처음|비밀) 내용/);
    assert.equal(cf.deploymentsOf(branch).length, 1, '안내 화면 하나만 남음');
  });

  await t.test('Cloudflare가 배포를 실패 상태로 돌려줌: 502로 끝나고 다시 공개하면 됨', async () => {
    const site = await make();
    cf.state.faults.push({ on: 'deployments', stage: 'failure', times: 1 });
    const bad = await deploy(base, site, { 'index.html': html('실패 상태') });
    assert.equal(bad.status, 502); assert.equal(bad.body.error.step, 'deploy');
    const again = await call(base, 'POST', `/api/sites/${site.id}/deploys/${bad.deploy}/publish`, { key: site.key });
    assert.equal(again.status, 200);
    assert.match((await get(again.body.url)).text, /실패 상태/);
  });

  await t.test('같은 배포를 동시에 두 번 공개해도 둘 다 같은 답, 배포는 하나', async () => {
    const site = await make();
    const files = { 'index.html': html('동시 공개'), 'assets/img/a.webp': webp(40000) };
    assert.equal((await deploy(base, site, files)).status, 200);
    // 새 배포 목록을 만들고(첫 화면만 바뀜) 공개를 나란히 두 번
    const d = await call(base, 'POST', `/api/sites/${site.id}/deploys`, { key: site.key, json: { files: manifestOf({ ...files, 'index.html': html('동시 공개 2') }) } });
    assert.equal(d.status, 200); assert.equal(d.body.missing.length, 1);
    assert.equal((await call(base, 'PUT', `/api/sites/${site.id}/blobs/${d.body.missing[0]}`, { key: site.key, raw: te.encode(html('동시 공개 2')) })).status, 204);
    const before = cf.deploymentsOf(`s-${site.id}`).length;
    const both = await Promise.all([0, 1].map(() => call(base, 'POST', `/api/sites/${site.id}/deploys/${d.body.deploy}/publish`, { key: site.key })));
    assert.deepEqual(both.map((x) => x.status), [200, 200]); assert.equal(both[0].body.url, both[1].body.url);
    assert.equal(cf.deploymentsOf(`s-${site.id}`).length, before, '지난 배포를 지우고 새 배포 하나만 남음(두 번 만들지 않음)');
    assert.match((await get(site.url)).text, /동시 공개 2/);
  });

  await t.test('다시 배포: 같은 파일(올릴 것 없음) · 일부만 바뀜(바뀐 것만) · 파일이 줄어듦 · 내린 뒤 새로 만들기', async () => {
    const site = await make();
    const files = { 'index.html': html('다시 배포'), 'assets/img/a.webp': webp(40000), 'assets/img/big.webp': webp(600 * 1024), 'about.html': html('소개') };
    const first = await deploy(base, site, files);
    assert.equal(first.status, 200); assert.equal(first.missing.length, 4);
    const same = await deploy(base, site, files);
    assert.equal(same.status, 200); assert.deepEqual(same.missing, [], '같은 파일이면 다시 올리지 않음');
    const changed = await deploy(base, site, { ...files, 'assets/img/a.webp': webp(41000) });
    assert.equal(changed.status, 200); assert.equal(changed.missing.length, 1, '바뀐 파일만');
    const fewer = await deploy(base, site, { 'index.html': html('줄어든 사이트') });
    assert.equal(fewer.status, 200);
    const dep = cf.deploymentsOf(`s-${site.id}`);
    assert.equal(dep.length, 1, '지난 배포는 지움'); assert.ok(!dep[0].manifest['/assets/img/big.webp'] && !dep[0].manifest['/about.html']);
    assert.match((await get(site.url)).text, /줄어든 사이트/);
    // 줄였던 파일을 다시 넣어도(서버가 기록을 지웠음) 그 파일만 다시 받아 끝남
    const back = await deploy(base, site, files);
    assert.equal(back.status, 200); assert.equal(back.again, 0);
    assert.equal((await call(base, 'DELETE', `/api/sites/${site.id}`, { key: site.key })).status, 204);
    assert.match((await get(site.url)).text, /강사가 사이트를 내렸어요/);
    const gone = await deploy(base, site, files);
    assert.equal(gone.step, 'deploys'); assert.equal(gone.status, 404, '내린 사이트는 고칠 수 없음(앱은 새 주소로 다시 만듦)');
    const fresh = await make('다시 만들기');
    assert.notEqual(fresh.id, site.id);
    assert.equal((await deploy(base, fresh, files)).status, 200);
  });

  await t.test('Cloudflare가 429로 막음: 까닭(pages_api)·다시 될 때와 함께 거절하고, 그동안 새 배포도 줄을 세움', async () => {
    const site = await make();
    cf.state.faults.push({ on: 'check-missing', status: 429, times: 1 });
    const bad = await deploy(base, site, { 'index.html': html('막힘'), 'assets/img/big.webp': webp(700 * 1024) });
    assert.equal(bad.status, 429); assert.equal(bad.body.error.code, 'rate_limited'); assert.equal(bad.body.error.reason, 'pages_api');
    assert.ok(bad.body.error.retryAt > Date.now()); assert.ok(Number(bad.headers.get('retry-after')) > 0);
    const next = await deploy(base, site, { 'index.html': html('막힘') });
    assert.equal(next.step, 'deploys'); assert.equal(next.status, 429); assert.equal(next.body.error.reason, 'pages_api');
    assert.match(next.body.error.message_ko, /잠깐 줄을 서 있어요/);
  });
});
