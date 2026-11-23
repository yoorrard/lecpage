// 통합 시험(VIEW=pages): 큰 사이트(300MB·3,000개 — pages 보기의 기본 한도 그대로)를 끝까지 올림.
// 교재 쪽 그림 수백 장(장당 수백 KB)과 큰 파일이 든 사이트가 한도 때문에 막히지 않고, 서버가 그만큼 무거워지지도 않는지:
//  1 한 번에 공개됨(없는 파일이라며 다시 올리게 하지 않음), 파일이 그 주소에서 열림
//  2 Pages API를 파일 수만큼 부르지 않음: 작은 파일은 16MB씩 모아 한 번에(모일 때마다 3번). Cloudflare API 5분 한도(1,200번)·Gate의 5분 창(900)에 닿지 않음
//  3 Worker(Site 객체)의 메모리가 사이트 크기에 비례해 늘지 않음: 올리는 동안 프로세스 메모리가 늘어난 양이 사이트 크기보다 훨씬 작음(운영의 객체 메모리 한도는 128MB)
//  3-2 쓴 행 수(무료 하루 10만 행)가 파일 수를 따라 늘지 않음: 자산 표를 묶음 몇 줄로 씀(파일 3,000개에 수십 줄)
//  4 한도를 넘으면 올리기 전에 까닭과 함께 거절(사이트 전체 300MB·파일 수 3,000개), 이 저장소에 두는 영상·소리는 합계 40MB까지
// 로컬 workerd + 흉내 Cloudflare API(test/fake-cf.mjs). 300MB를 실제로 주고받아 1~2분 걸림
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { HOSTING, startHost, call, deploy, manifestOf } from './helpers.mjs';
import { startFakeCf, ACCOUNT, TOKEN } from './fake-cf.mjs';
import { today, settle } from './load-helpers.mjs';

const ADMIN = 'it-admin-' + randomBytes(12).toString('hex');
const te = new TextEncoder();
const closers = [];
after(async () => { for (const c of closers.reverse()) await c(); });
const MB = 1024 * 1024;
let salt = 0;
/** 내용이 서로 다른 그림 모양 파일(n바이트). 큰 시험이라 빠르게: 무작위 4KB를 되풀이해 채우고 앞에 번호를 적음 */
const SEED = randomBytes(4096);
const blob = (n) => { const b = new Uint8Array(n); for (let o = 0; o < n; o += SEED.length) b.set(o + SEED.length <= n ? SEED : SEED.subarray(0, n - o), o); b.set(te.encode(`RIFF\0\0\0\0WEBPVP8 ${String(++salt).padStart(8, '0')}`), 0); return b; };
const html = (t) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${t}</title></head><body><main><h1>${t}</h1></main></body></html>`;

/** wrangler dev가 띄운 workerd(자식 프로세스들)의 메모리(RSS, MB). 못 재면 0 */
function rssOf(pid) {
  try {
    const rows = execFileSync('ps', ['-eo', 'pid=,ppid=,rss=,comm='], { encoding: 'utf8' }).split('\n').map((l) => l.trim().split(/\s+/)).filter((r) => r.length >= 4).map(([p, pp, rss, ...c]) => ({ pid: +p, ppid: +pp, rss: +rss, comm: c.join(' ') }));
    const kids = new Set([pid]);
    for (let grew = true; grew;) { grew = false; for (const r of rows) if (kids.has(r.ppid) && !kids.has(r.pid)) { kids.add(r.pid); grew = true; } }
    return Math.round(rows.filter((r) => kids.has(r.pid) && /workerd/.test(r.comm)).reduce((n, r) => n + r.rss, 0) / 1024);
  } catch { return 0; }
}

test('VIEW=pages 큰 사이트: 300MB·3,000개가 한 번에 올라가고, Pages API 호출·서버 메모리·쓴 행 수는 그만큼 늘지 않음', { timeout: 600000 }, async (t) => {
  if (!existsSync(join(HOSTING, 'node_modules', 'wrangler', 'bin', 'wrangler.js'))) return t.skip('wrangler가 설치되지 않았어요');
  const cf = await startFakeCf();
  closers.push(cf.stop);
  let h;
  try {
    h = await startHost({
      ADMIN_KEY: ADMIN, TALLY_EVERY: 1, SITES_PER_HOUR: 1000, SITES_PER_DAY: 1000, DEPLOYS_PER_HOUR: 1000, CATALOG_URL: 'off',
      VIEW: 'pages', CF_ACCOUNT_ID: ACCOUNT, PAGES_PROJECT: 'lecpage-view', PAGES_TOKEN: TOKEN, PAGES_HOST: `127.0.0.1:${cf.port}`,
      PAGES_SITE_URL: `${cf.url}/__view/{branch}/`, CF_API_BASE: cf.api,
    });
  } catch (e) { return t.skip(`workerd를 띄우지 못함: ${String(e.message).split('\n')[0]}`); }
  closers.push(h.stop);
  const base = h.url;
  const info = (await call(base, 'GET', '/api/info')).body;
  assert.deepEqual([info.limits.maxBytes, info.limits.maxFiles, info.limits.maxFileBytes, info.limits.maxMediaBytes], [300 * MB, 3000, 20 * MB, 40 * MB], 'pages 보기의 기본 한도');
  const make = async (title = '큰 사이트') => { const r = await call(base, 'POST', '/api/sites', { json: { title } }); assert.equal(r.status, 201, JSON.stringify(r.body)); return r.body; };
  const pagesCalls = () => cf.state.calls.filter(([, p]) => p.includes('/pages/')).length;

  // 쪽 그림 400장(300KB) + 작은 파일 2,581개(20KB: 글꼴 조각·작은 그림) + 큰 파일 18개(약 7MB, 받을 때 바로 Pages로) + index.html = 3,000개, 딱 300MB
  const SMALL = 2581;
  const index = te.encode(html('큰 사이트'));
  const files = { 'index.html': index };
  for (let i = 1; i <= 400; i++) files[`material/p-${String(i).padStart(3, '0')}.webp`] = blob(300 * 1024);
  for (let i = 0; i < SMALL; i++) files[`assets/img/s-${i}.webp`] = blob(20 * 1024);
  let left = 300 * MB - index.length - 400 * 300 * 1024 - SMALL * 20 * 1024;
  for (let i = 0; i < 18; i++) { const n = i < 17 ? Math.floor(left / (18 - i)) : left; files[`files/big-${i}.pdf`] = blob(n); left -= n; }
  assert.equal(Object.keys(files).length, 3000); assert.equal(Object.values(files).reduce((n, v) => n + v.length, 0), 300 * MB);

  const site = await make();
  // 사이트가 알린 쓴 행(rw에서 Gate가 스스로 쓴 gw를 뺌: 이 시험은 TALLY_EVERY=1이라 요청 3,000번마다 하루 줄을 쓰지만 운영에서는 요청 50번에 한 번)
  const siteRows = async () => { const d = await today(base, ADMIN); return (d.rw || 0) - (d.gw || 0); };
  await settle(); const rw0 = await siteRows();
  const rss0 = rssOf(h.pid); let peak = rss0;
  const watch = setInterval(() => { peak = Math.max(peak, rssOf(h.pid)); }, 400);
  const calls0 = pagesCalls(); const t0 = Date.now();
  let ok;
  try { ok = await deploy(base, site, files); } finally { clearInterval(watch); }
  const took = Math.round((Date.now() - t0) / 1000); const used = pagesCalls() - calls0;
  assert.equal(ok.status, 200, JSON.stringify(ok.body).slice(0, 300)); assert.equal(ok.again, 0, '없는 파일이라며 다시 올리게 하지 않음');
  const dep = cf.deploymentsOf(`s-${site.id}`).at(-1);
  assert.equal(Object.keys(dep.manifest).filter((p) => p.startsWith('/material/p-')).length, 400);
  assert.equal(Object.keys(dep.manifest).filter((p) => p.startsWith('/assets/img/s-')).length, SMALL);
  // 쓴 행 수: 파일 3,000개를 올려도 수십 줄(큰 파일을 받을 때마다·작은 파일을 모아 올릴 때마다 묶음 한 줄). 파일 하나에 한 줄이던 때는 3,000줄이 넘었음
  await settle(800); const rows = (await siteRows()) - rw0;
  assert.ok(rows > 0 && rows <= 90, `파일 3,000개 사이트가 쓴 행 수: ${rows}`);
  assert.equal(cf.state.badHash?.length || 0, 0, 'Pages 열쇠가 내용과 맞음');
  for (const p of ['material/p-001.webp', 'material/p-400.webp', `assets/img/s-${SMALL - 1}.webp`, 'files/big-17.pdf']) {
    const r = await fetch(`${ok.body.url}${p}`); const b = new Uint8Array(await r.arrayBuffer());
    assert.equal(r.status, 200, p); assert.equal(b.length, files[p].length, p);
  }
  // Pages API: 큰 파일 18개(3번씩) + 작은 파일 약 168MB를 16MB씩(10번 × 3) + 공개(7 안팎) ≈ 100. 파일마다 불렀다면 9,000번
  assert.ok(used < 160, `Pages API를 ${used}번 부름(파일 수만큼 부르지 않아야 함)`);
  // 메모리: 서버가 받은 양만큼 쌓아 두지 않는지. 로컬 workerd는 메모리 한도가 없어 쓰레기(다 쓴 base64 글자열)를 천천히 치우므로 한 번의 최대값만으로는 알 수 없음
  // → 같은 300MB를 새 사이트에 한 번 더 받게 해서(서버가 하는 일은 같음: 받기·확인·base64·열쇠 계산) 메모리가 그만큼 더 늘지 않는지 봄. 쌓아 둔다면 300MB 넘게 더 늘어남
  const peak1 = peak;
  const site2 = await make('큰 사이트 한 번 더');
  const watch2 = setInterval(() => { peak = Math.max(peak, rssOf(h.pid)); }, 400);
  let ok2;
  try { ok2 = await deploy(base, site2, files); } finally { clearInterval(watch2); }
  assert.equal(ok2.status, 200, JSON.stringify(ok2.body).slice(0, 300));
  if (!(rss0 > 0)) t.diagnostic('workerd 메모리를 재지 못함(ps 없음): 메모리 부분은 확인하지 않았어요');
  // 선 280MB: 받은 것을 쌓아 둔다면 원본 300MB + base64 400MB가 더 늘어남. 파일 3,000개(요청 3,000번)는 로컬 workerd가 치우지 않은 쓰레기만으로 150~200MB가 늘 수 있어(2026-11-24 실측 191MB, 1,500개일 때 94MB) 그보다 위에 둠
  if (rss0 > 0) assert.ok(peak - peak1 < 280, `300MB를 한 번 더 받는 동안 workerd 메모리가 ${peak - peak1}MB 더 늘었어요(처음 ${rss0}MB, 첫 사이트 ${peak1}MB, 둘째 사이트 ${peak}MB)`);
  t.diagnostic(`300MB·3,000개: ${took}초, 쓴 행 ${rows}, Pages API ${used}번, workerd 메모리 처음 ${rss0}MB → 첫 사이트 ${peak1}MB → 둘째 사이트 ${peak}MB`);

  await t.test('같은 파일로 다시 배포하면 아무것도 다시 올리지 않음, 한 장만 바꾸면 그것만', async () => {
    const c1 = pagesCalls();
    const again = await deploy(base, site, { ...files, 'index.html': html('큰 사이투') }); // 글자 수가 같아 300MB 그대로
    assert.equal(again.status, 200); assert.deepEqual(again.missing.length, 1, 'index.html만 새로');
    assert.ok(pagesCalls() - c1 < 12, `다시 배포에 Pages API ${pagesCalls() - c1}번`);
  });

  await t.test('한도를 넘으면 올리기 전에 까닭과 함께 거절: 사이트 전체·파일 수·이 저장소에 두는 영상·소리 합계', async () => {
    const s2 = await make('한도');
    // 파일 수: 3,000개까지(목록만 보냄). 작은 파일 1,501개를 더해 3,001개
    const many = { ...files }; for (let i = 0; i < 1501; i++) many[`assets/fonts/x-${i}.woff2`] = te.encode(`f${i}`);
    const over = await call(base, 'POST', `/api/sites/${s2.id}/deploys`, { key: s2.key, json: { files: manifestOf(many) } });
    assert.equal(over.status, 413); assert.equal(over.body.error.code, 'too_many_files'); assert.match(over.body.error.message_ko, /3000개까지/);
    const { 'assets/img/s-0.webp': drop, ...rest } = files; void drop;
    const big = await call(base, 'POST', `/api/sites/${s2.id}/deploys`, { key: s2.key, json: { files: manifestOf({ ...rest, 'assets/img/s-0.webp': blob(50 * 1024 + 1) }) } });
    assert.equal(big.status, 413); assert.equal(big.body.error.code, 'too_large'); assert.match(big.body.error.message_ko, /사이트가 너무 커요\(300MB까지\)/);
    // 영상·소리는 이 Worker 저장소에 둠(전체 4GB): 사이트 한도가 커져도 사이트 하나가 그 저장소를 다 쓰지 않게 합계 40MB
    const media = { 'index.html': index };
    for (let i = 0; i < 3; i++) media[`assets/media/v-${i}.mp4`] = blob(14 * MB);
    const m = await call(base, 'POST', `/api/sites/${s2.id}/deploys`, { key: s2.key, json: { files: manifestOf(media) } });
    assert.equal(m.status, 413); assert.equal(m.body.error.code, 'too_large'); assert.match(m.body.error.message_ko, /영상·소리 파일은 모두 합쳐 40MB까지/);
    const fine = await deploy(base, s2, { 'index.html': index, 'assets/media/v-0.mp4': blob(14 * MB), 'assets/media/v-1.mp4': blob(14 * MB) });
    assert.equal(fine.status, 200, JSON.stringify(fine.body).slice(0, 200));
  });
});
