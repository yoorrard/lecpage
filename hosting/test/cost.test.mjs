// 운영 비용 단위 시험(VIEW=pages, 로컬 workerd + 흉내 Cloudflare API): 실제 모양의 사이트(2026-11-23 운영 실측: 파일 573개 중 537개가 글꼴 조각)로
// 새 배포·다시 배포·배포하기 화면 열기에 드는 Worker 요청·Durable Object 요청·Pages API 호출·쓴 행 수를 재고, 넘지 말아야 할 선을 고정함.
//  1 새 사이트(참여 기능 방 포함, 앱처럼 작은 파일을 묶어 올림): Worker 요청 열 번 안쪽(파일마다 올리면 570번대), 쓴 행 수가 Gate의 오늘 숫자(rw)에 잡힘
//  2 다시 배포(글 한 줄): 요청 몇 번, 쓴 행 몇 줄
//  3 /api/info는 isolate가 기억하는 동안 Gate를 다시 깨우지 않음, /api/status도 같은 물음은 한 번만
//  4 쓴 행 수는 Gate의 오늘 숫자(rw)에 잡힘: 무료 하루 10만 행의 85%를 넘으면 새 사이트·새 방을 넘김(gate.test.mjs)
// COST_OUT=<파일>이면 잰 값을 JSON으로 씀(src/capacity.js UNIT과 docs의 표가 이 값을 씀).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { HOSTING, startHost } from './helpers.mjs';
import { startFakeCf, ACCOUNT, TOKEN } from './fake-cf.mjs';
import { req, appPublish, today, diff, settle, liveFor } from './load-helpers.mjs';

const ADMIN = 'cost-admin-' + randomBytes(12).toString('hex');
const KEYS = ['req', 'api', 'live', 'ds', 'dr', 'dg', 'g', 'gt', 'rc', 'pc', 'rw', 'gw', 'new', 'pub'];
const te = new TextEncoder();
const closers = [];
after(async () => { for (const c of closers.reverse()) await c(); });
const out = {};
let salt = 0;
const blob = (n, tag = 'wOF2') => { const b = new Uint8Array(randomBytes(n)); b.set(te.encode(`${tag}${String(++salt).padStart(8, '0')}`), 0); return b; };
const html = (t) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${t}</title><link rel="stylesheet" href="assets/site.css"></head><body><main><h1>${t}</h1></main></body></html>`;
/** 실제 사이트와 같은 모양(573개): 글꼴 조각 537개(약 9KB) + 쪽 그림 14장(약 150KB) + 사이트 파일 */
function realSite(title) {
  const files = { 'index.html': html(title), 'assets/site.css': `main{max-width:60rem}/*${++salt}*/` };
  for (let i = 0; i < 537; i++) files[`assets/fonts/${String(i).padStart(4, '0')}-${salt}.woff2`] = blob(9 * 1024);
  for (let i = 1; i <= 14; i++) files[`material/p-${String(i).padStart(3, '0')}.webp`] = blob(150 * 1024, 'RIFF');
  for (let i = 0; i < 18; i++) files[`assets/img/i-${i}.webp`] = blob(20 * 1024, 'RIFF');
  files['assets/img/cover.webp'] = blob(700 * 1024, 'RIFF');
  files['assets/event.ics'] = 'BEGIN:VCALENDAR\nEND:VCALENDAR\n';
  return files;
}
const kst = (n) => new Date(Date.now() + 9 * 3600e3 + n * 864e5).toISOString().slice(0, 10);

let env = null;
async function setup(t, vars = {}) {
  if (env) return env;
  if (!existsSync(join(HOSTING, 'node_modules', 'wrangler', 'bin', 'wrangler.js'))) { t.skip('wrangler가 설치되지 않았어요'); return null; }
  const cf = await startFakeCf();
  closers.push(cf.stop);
  let h;
  try {
    h = await startHost({
      ADMIN_KEY: ADMIN, TALLY_EVERY: 1, VIEW: 'pages', CF_ACCOUNT_ID: ACCOUNT, PAGES_PROJECT: 'lecpage-view', PAGES_TOKEN: TOKEN, PAGES_HOST: `127.0.0.1:${cf.port}`,
      PAGES_SITE_URL: `${cf.url}/__view/{branch}/`, CF_API_BASE: cf.api,
      SITES_PER_HOUR: 1000, SITES_PER_DAY: 1000, SITES_PER_DEVICE: 1000, DAILY_SITE_CAP: 1000, DAILY_ROOM_CAP: 1000, DEPLOYS_PER_HOUR: 1000, ...vars,
    });
  } catch (e) { t.skip(`workerd를 띄우지 못함: ${String(e.message).split('\n')[0]}`); return null; }
  closers.push(h.stop);
  env = { cf, h, base: h.url };
  return env;
}
async function measure(e, fn) {
  await settle();
  const b = await today(e.base, ADMIN); const pc0 = e.cf.state.calls.length;
  const r = await fn();
  await settle(800);
  const a = await today(e.base, ADMIN);
  const d = diff(a, b, KEYS);
  d.req -= 1; d.api -= 1; d.dg -= 1; d.g -= 1; // today() 자신
  // rw = 사이트·방이 알린 쓴 행. Gate가 스스로 쓴 행(gw: 하루 줄·사이트 줄)은 따로 둠 — 이 시험은 TALLY_EVERY=1이라 요청마다 하루 줄을 쓰지만 운영에서는 요청 50번에 한 번
  d.rw -= d.gw;
  d.cfApi = e.cf.state.calls.length - pc0;
  d.doReq = d.ds + d.dr + d.g + d.rc; // 숫자 모으기(gt)는 따로: 운영에서는 요청 50번이나 30초에 한 번
  return { d, r };
}

test('실제 모양의 사이트: 새 배포·다시 배포·배포하기 화면 열기에 드는 몫', async (t) => {
  const e = await setup(t); if (!e) return;
  const { base } = e;
  const info = (await req(base, 'GET', '/api/info')).body;
  assert.ok(info.limits.bundle, '묶어 받기 표시');
  const booking = { date: kst(3), start: '10:00', end: '12:00', people: 40, live: true, network: 'good' };

  // 새 사이트(참여 기능 방 포함): 앱과 같은 순서 — 만들기 → 목록 → 묶음 올리기 → 방 묶기 → 공개
  const files = realSite('비용 시험');
  const code = 'CA' + randomBytes(3).toString('hex').toUpperCase();
  const first = await measure(e, () => appPublish(base, files, { live: liveFor(code), booking, bundle: info.limits.bundle }));
  assert.ok(first.r.ok, JSON.stringify(first.r.res?.body));
  out.newSite = { files: Object.keys(files).length, ...first.d, puts: first.r.puts, calls: first.r.calls };
  assert.ok(first.d.req <= 10, `새 배포의 Worker 요청은 열 번 안쪽: ${first.d.req}`);
  assert.ok(first.d.doReq <= 22, `새 배포의 Durable Object 요청: ${first.d.doReq}`);
  assert.ok(first.d.cfApi <= 12, `Pages API 호출: ${first.d.cfApi}`);
  // 쓴 행 수: Pages에 올린 파일 표를 묶음 몇 줄로 쓰므로 파일이 573개여도 스무 줄 안쪽(예전에는 파일 하나에 한 줄이라 약 580줄). Gate의 오늘 숫자에 잡힘
  assert.ok(first.d.rw >= 5 && first.d.rw <= 20, `새 배포가 쓴 행 수(파일 573개): ${first.d.rw}`);

  // 같은 사이트를 묶지 않고 올리면(예전 앱): 파일마다 요청
  const files0 = realSite('비용 시험 0');
  const old = await measure(e, () => appPublish(base, files0, { booking }));
  assert.ok(old.r.ok, JSON.stringify(old.r.res?.body));
  out.newSiteUnbundled = { ...old.d, puts: old.r.puts, calls: old.r.calls };
  assert.ok(old.d.req >= 500, `파일마다 올리면 요청이 수백 번: ${old.d.req}`);
  assert.ok(old.d.rw <= 20, `파일마다 올려도(예전 앱) 쓴 행은 스무 줄 안쪽: ${old.d.rw}`);

  // 다시 배포(첫 화면 글 한 줄)
  const files2 = { ...files, 'index.html': html('비용 시험 고침') };
  const again = await measure(e, () => appPublish(base, files2, { site: first.r.site, booking, bundle: info.limits.bundle }));
  assert.ok(again.r.ok, JSON.stringify(again.r.res?.body));
  out.republish = { ...again.d, puts: again.r.puts, calls: again.r.calls };
  assert.ok(again.d.req <= 4 && again.d.rw <= 25, `다시 배포는 몇 번·몇 줄: 요청 ${again.d.req}, 행 ${again.d.rw}`);

  // 배포하기 화면을 열 때 앱이 묻는 것: info(isolate가 20초 기억), status(30초 기억), 참여 기록 수
  const i2 = await measure(e, async () => { for (let i = 0; i < 5; i++) await req(base, 'GET', '/api/info'); });
  out.info5 = i2.d;
  assert.ok(i2.d.g <= 1, `/api/info 다섯 번에 Gate는 한 번까지: ${i2.d.g}`);
  const s2 = await measure(e, async () => { for (let i = 0; i < 3; i++) await req(base, 'GET', `/api/status?site=${first.r.site.id}`); });
  out.status3 = s2.d;
  assert.ok(s2.d.g <= 1, `/api/status 세 번에 Gate는 한 번까지: ${s2.d.g}`);
  const rec = await measure(e, () => req(base, 'GET', `/api/sites/${first.r.site.id}/records`, { key: first.r.site.key }));
  assert.equal(rec.r.status, 200);
  out.records = rec.d;

  // 배포 취소: 요청 한 번, 지우기도 쓴 행
  const del = await measure(e, () => req(base, 'DELETE', `/api/sites/${first.r.site.id}`, { key: first.r.site.key }));
  assert.ok([202, 204].includes(del.r.status), String(del.r.status));
  out.remove = del.d;
  // 지울 때 쓴 행(지우기도 쓴 행으로 청구됨): 통째 지우기 전에 줄 수를 세어 알림. 묶음으로 쓴 뒤로는 사이트 하나가 스무 줄 안쪽.
  // 배포 목록을 받을 때 나중에 지울 줄까지 미리 셌으므로(deploy-check rows) 그 몫 안이면 여기서는 0일 수 있음 — 세 번을 합쳐 봄
  assert.ok(del.d.rw <= 25, `배포 취소가 쓴 행 수: ${del.d.rw}`);
  assert.ok(first.d.rw + again.d.rw + del.d.rw >= 10, `새 배포·다시 배포·취소에 센 행: ${first.d.rw} + ${again.d.rw} + ${del.d.rw}`);

  if (process.env.COST_OUT) writeFileSync(process.env.COST_OUT, JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out));
});
