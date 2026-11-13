// 수용량·부하 시험(VIEW=pages, 로컬 workerd + 흉내 Cloudflare API).
//  1. 단위 비용: 새 사이트 배포 한 번·다시 배포·참여 기능(실시간 연결·묻기·긴 대기)에 드는 Worker 요청·DO 요청·Pages API 호출을 잼
//     → src/capacity.js의 UNIT 값과 docs/research/scale-2026-11.md의 표
//  2. 부하: 강사 TEACHERS명이 동시에 배포(참여 기능 방 묶기)하고, 방마다 참가자 PER_ROOM명이 동시에 들어와 글·투표·묻기·긴 대기
//     → 실패·5xx 없음, 글이 빠지지 않음, Gate(하나뿐인 DO)가 받는 몫, 응답 시간
// 크기: LOAD_TEACHERS(기본 50)·LOAD_PER_ROOM(기본 60). SCALE_OUT=<파일>이면 잰 값을 JSON으로 씀.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { HOSTING, buildSite, startHost } from './helpers.mjs';
import { startFakeCf, ACCOUNT, TOKEN } from './fake-cf.mjs';
import { pool, req, appPublish, today, diff, settle, pct, liveFor, teacherKey } from './load-helpers.mjs';

const ADMIN = 'scale-admin-' + randomBytes(12).toString('hex');
const TEACHERS = Number(process.env.LOAD_TEACHERS) || 50;
const PER_ROOM = Number(process.env.LOAD_PER_ROOM) || 60;
const KEYS = ['req', 'site', 'api', 'live', 'ds', 'dr', 'dg', 'g', 'gt', 'rc', 'pc', 'pz', 'new', 'pub', 'room', 'err', 'lim'];
const closers = [];
after(async () => { for (const c of closers.reverse()) await c(); });
const out = {};

const kst = (n) => new Date(Date.now() + 9 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
const te = new TextEncoder();

let env = null;
async function setup(t) {
  if (env) return env;
  if (!existsSync(join(HOSTING, 'node_modules', 'wrangler', 'bin', 'wrangler.js'))) { t.skip('wrangler가 설치되지 않았어요'); return null; }
  const cf = await startFakeCf();
  closers.push(cf.stop);
  let h;
  try {
    h = await startHost({
      ADMIN_KEY: ADMIN, TALLY_EVERY: 1, VIEW: 'pages', CF_ACCOUNT_ID: ACCOUNT, PAGES_PROJECT: 'lecpage-view', PAGES_TOKEN: TOKEN, PAGES_HOST: `127.0.0.1:${cf.port}`,
      PAGES_SITE_URL: `${cf.url}/__view/{branch}/`, CF_API_BASE: cf.api,
      // 부하 시험: 하루 상한·IP 상한은 넉넉히(전부 127.0.0.1에서 옴), 예산은 크게(멈춤 판단은 단위 시험이 따로 봄)
      SITES_PER_HOUR: 100000, SITES_PER_DAY: 100000, DAILY_SITE_CAP: 100000, DAILY_ROOM_CAP: 100000, DAILY_REQUEST_BUDGET: 100000000,
      LIVE_SOCKETS_PER_IP: 100000, LIVE_MAX_PARTICIPANTS: 1000, DEPLOYS_PER_HOUR: 1000,
      POLL_RELAY: 'on', // 긴 대기를 Worker가 대신 기다림(유료 기본). 무료 기본(방 안에서 기다림)은 pages.integration이 봄
    });
  } catch (e) { t.skip(`workerd를 띄우지 못함: ${String(e.message).split('\n')[0]}`); return null; }
  closers.push(h.stop);
  const files = await buildSite('sel-story');
  env = { cf, h, base: h.url, files };
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
  d.cfApi = e.cf.state.calls.length - pc0;
  d.doReq = d.ds + d.dr + d.g + d.rc; // Worker가 부른 Site·Room + Gate가 받은 것(Site·Room이 부른 것 포함) + Site가 부른 Room. 숫자 모으기(gt)는 따로
  return { d, r };
}

/** 참가자 하나: 상태 → 들어오기 → 처음 받기 → (방식별) → 질문 하나 */
async function participant(lv, origin, mode, { polls = 3, gapMs = 150, wait = 2 } = {}) {
  const H = { origin };
  const st = await req(lv, 'GET', '/state', { headers: H });
  const j = await req(lv, 'POST', '/join', { json: { nickname: '참가' + randomBytes(2).toString('hex') }, headers: H });
  if (j.status !== 200 && j.status !== 201) return { ok: false, step: 'join', res: j, lat: [st.ms, j.ms] };
  const tok = { ...H, 'x-lec-token': j.body.token };
  const lat = [st.ms, j.ms];
  let snap = await req(lv, 'GET', '/snapshot?since=0', { headers: tok });
  lat.push(snap.ms);
  let cursor = snap.body?.now || 0;
  let ws = null;
  if (mode === 'ws') {
    ws = new WebSocket(`${lv.replace(/^http/, 'ws')}/ws`);
    await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('ws hello 시간 초과')), 15000); ws.onmessage = (m) => { if (String(m.data).includes('"hello"')) { clearTimeout(t); res(); } }; ws.onerror = () => { clearTimeout(t); rej(new Error('ws 실패')); }; });
  }
  const q = await req(lv, 'POST', '/questions', { json: { text: '부하 시험 질문' }, headers: tok });
  lat.push(q.ms);
  if (q.status !== 201) { ws?.close(); return { ok: false, step: 'question', res: q, lat }; }
  if (mode === 'poll') {
    for (let i = 0; i < polls; i++) {
      await new Promise((r) => setTimeout(r, gapMs));
      snap = await req(lv, 'GET', `/snapshot?since=${cursor}`, { headers: tok });
      lat.push(snap.ms);
      if (snap.status !== 200) return { ok: false, step: 'poll', res: snap, lat };
      cursor = snap.body.now || cursor;
    }
  }
  if (mode === 'long') {
    snap = await req(lv, 'GET', `/snapshot?since=${cursor}&wait=${wait}`, { headers: tok });
    if (snap.status !== 200) return { ok: false, step: 'long', res: snap, lat };
  }
  ws?.close();
  return { ok: true, lat, id: j.body.id };
}

test('단위 비용: 새 사이트·다시 배포·참여 기능 한 자리', async (t) => {
  const e = await setup(t); if (!e) return;
  const { base, files } = e;
  // 앱이 켜질 때(한 번): info
  out.info = (await measure(e, () => req(base, 'GET', '/api/info'))).d;
  // 새 사이트(예약 + 참여 기능 방). 같은 런타임을 처음 올리는 서버라 Pages에 아무것도 없는 상태
  const code0 = 'UC' + randomBytes(3).toString('hex').toUpperCase();
  const booking = { date: kst(3), start: '10:00', end: '12:00', people: 40, live: true, network: 'restricted' };
  const first = await measure(e, () => appPublish(base, files, { live: liveFor(code0), booking }));
  assert.ok(first.r.ok, JSON.stringify(first.r.res?.body));
  out.firstEver = { ...first.d, puts: first.r.puts, calls: first.r.calls };
  // 두 번째 새 사이트(런타임은 이미 Pages에 있음) = 보통의 새 사이트
  const code1 = 'UD' + randomBytes(3).toString('hex').toUpperCase();
  const files2 = { ...files, 'index.html': te.encode(new TextDecoder().decode(files['index.html']).replace('</body>', '<!-- 2 --></body>')) };
  const second = await measure(e, () => appPublish(base, files2, { live: liveFor(code1), booking }));
  assert.ok(second.r.ok, JSON.stringify(second.r.res?.body));
  out.newSite = { ...second.d, puts: second.r.puts, calls: second.r.calls };
  // 다시 배포(첫 화면 글 한 줄 고침, 방은 그대로)
  const files3 = { ...files2, 'index.html': te.encode(new TextDecoder().decode(files2['index.html']).replace('<!-- 2 -->', '<!-- 3 -->')) };
  const again = await measure(e, () => appPublish(base, files3, { site: second.r.site, booking }));
  assert.ok(again.r.ok, JSON.stringify(again.r.res?.body));
  out.republish = { ...again.d, puts: again.r.puts, calls: again.r.calls };

  // 참여 기능: 실시간 연결 한 자리, 묻기 한 번, 긴 대기 한 번(바뀐 것 없음)
  const lv = `${base}/live/api/${code1}`;
  const origin = new URL(second.r.site.url).origin;
  const ws = await measure(e, () => participant(lv, origin, 'ws'));
  assert.ok(ws.r.ok, JSON.stringify(ws.r.res?.body));
  out.seatWs = ws.d;
  const tokenRes = await req(lv, 'POST', '/join', { json: { nickname: '묻기' }, headers: { origin } });
  const tok = { origin, 'x-lec-token': tokenRes.body.token };
  const now = (await req(lv, 'GET', '/snapshot?since=0', { headers: tok })).body.now;
  out.poll = (await measure(e, () => req(lv, 'GET', `/snapshot?since=${now}`, { headers: tok }))).d;
  const lp = await measure(e, () => req(lv, 'GET', `/snapshot?since=${now}&wait=1`, { headers: tok }));
  assert.equal(lp.r.status, 200); assert.ok(lp.r.ms >= 900, '바뀐 것이 없으면 기다림'); assert.equal(lp.r.body.questions.length, 0);
  out.longPollIdle = lp.d;
  // Worker가 기다리는 긴 대기: 글이 올라오면 바로 깨어 바뀐 것을 줌(방은 그동안 잠들 수 있음)
  const cur = lp.r.body.now;
  const t0 = performance.now();
  const waiting = req(lv, 'GET', `/snapshot?since=${cur}&wait=15`, { headers: tok });
  await new Promise((r) => setTimeout(r, 400));
  assert.equal((await req(lv, 'POST', '/questions', { json: { text: '깨우기' }, headers: tok })).status, 201);
  const woke = await waiting;
  assert.equal(woke.status, 200); assert.ok(performance.now() - t0 < 5000, '글이 올라오면 바로 답');
  assert.deepEqual(woke.body.questions.map((q) => q.text), ['깨우기']);
  // 기다리는 동안 사이트를 가리면 바로 끊고 가림을 알림
  const now2 = woke.body.now;
  const hold = req(lv, 'GET', `/snapshot?since=${now2}&wait=15`, { headers: tok });
  await new Promise((r) => setTimeout(r, 400));
  assert.equal((await req(base, 'POST', `/api/admin/sites/${second.r.site.id}/block`, { json: { blocked: true, reason: '시험' }, headers: { authorization: `Bearer ${ADMIN}` } })).status, 200);
  const cut = await hold;
  assert.equal(cut.status, 403); assert.equal(cut.body.error, 'blocked');
  assert.equal((await req(base, 'POST', `/api/admin/sites/${second.r.site.id}/block`, { json: { blocked: false }, headers: { authorization: `Bearer ${ADMIN}` } })).status, 200);
  t.diagnostic(JSON.stringify(out));
});

test(`부하: 강사 ${TEACHERS}명 동시 배포 + 방 ${TEACHERS}개 × 참가자 ${PER_ROOM}명`, async (t) => {
  const e = await setup(t); if (!e) return;
  const { base, files } = e;
  const t0 = performance.now();
  const before = await today(base, ADMIN); const cf0 = e.cf.state.calls.length;
  // 1) 동시 배포
  const codes = Array.from({ length: TEACHERS }, (_, i) => 'LD' + String(i).padStart(3, '0') + randomBytes(2).toString('hex').toUpperCase());
  const pubLat = [];
  const pubs = await Promise.all(codes.map((code, i) => {
    const f = { ...files, 'index.html': te.encode(new TextDecoder().decode(files['index.html']).replace('</body>', `<!-- t${i} --></body>`)) };
    return appPublish(base, f, { live: liveFor(code), booking: { date: kst(1 + (i % 5)), start: '10:00', end: '12:00', people: PER_ROOM, live: true, network: i % 3 ? 'good' : 'restricted' }, onCall: (r) => pubLat.push(r.ms) });
  }));
  const failedPubs = pubs.filter((p) => !p.ok);
  assert.equal(failedPubs.length, 0, JSON.stringify(failedPubs.slice(0, 3).map((p) => ({ step: p.step, status: p.res?.status, body: p.res?.body }))));
  const pubMs = performance.now() - t0;
  // 2) 참가자: 방마다 PER_ROOM명. 셋 중 하나는 실시간 연결, 하나는 묻기, 하나는 긴 대기(학교망)
  const modes = ['ws', 'poll', 'long'];
  const people = [];
  pubs.forEach((p, i) => { for (let k = 0; k < PER_ROOM; k++) people.push({ code: codes[i], origin: new URL(p.site.url).origin, mode: modes[(i + k) % 3] }); });
  const t1 = performance.now();
  const lat = [];
  const res = await pool(people, Number(process.env.LOAD_CONCURRENCY) || 600, async (p) => {
    const r = await participant(`${base}/live/api/${p.code}`, p.origin, p.mode).catch((err) => ({ ok: false, step: 'throw', res: { status: 0, body: String(err.message) } }));
    if (r.lat) lat.push(...r.lat);
    return r;
  });
  const liveMs = performance.now() - t1;
  const bad = res.filter((r) => !r.ok);
  // 3) 글이 빠지지 않음: 방마다 강사 키로 질문 수 = 참가자 수(+0)
  const counts = await pool(codes, 20, async (code) => {
    const s = await req(`${base}/live/api/${code}`, 'GET', '/snapshot?since=0', { headers: { 'x-lec-admin': encodeURIComponent(teacherKey(code)) } });
    return { q: s.body?.questions?.length || 0, p: s.body?.participants?.length || 0 };
  });
  await settle(1500);
  const after = await today(base, ADMIN);
  const d = diff(after, before, KEYS); d.cfApi = e.cf.state.calls.length - cf0;
  const doReq = d.ds + d.dr + d.g + d.rc;
  out.load = {
    teachers: TEACHERS, perRoom: PER_ROOM, participants: people.length, publishSeconds: Math.round(pubMs / 100) / 10, liveSeconds: Math.round(liveMs / 100) / 10,
    publishP50: pct(pubLat, 50), publishP95: pct(pubLat, 95), liveP50: pct(lat, 50), liveP95: pct(lat, 95), liveMax: pct(lat, 100),
    failed: bad.length, errors5xx: d.err, limited: d.lim, workerReq: d.req, doReq, gateReq: d.g, gateTicks: d.gt, gateShare: Math.round((d.g / Math.max(1, doReq)) * 1000) / 10, pagesApi: d.cfApi,
    lostQuestions: counts.reduce((a, c) => a + Math.max(0, PER_ROOM - c.q), 0), lostParticipants: counts.reduce((a, c) => a + Math.max(0, PER_ROOM - c.p), 0),
  };
  t.diagnostic(JSON.stringify(out.load));
  if (process.env.SCALE_OUT) writeFileSync(process.env.SCALE_OUT, JSON.stringify(out, null, 2));
  assert.equal(bad.length, 0, JSON.stringify(bad.slice(0, 3).map((r) => ({ step: r.step, status: r.res?.status, body: r.res?.body }))));
  assert.equal(d.err, 0, '5xx 없음');
  assert.equal(out.load.lostQuestions, 0, '질문이 빠지지 않음');
  assert.equal(out.load.lostParticipants, 0, '참가자가 빠지지 않음');
  assert.ok(!/Uncaught|overloaded/i.test(e.h.log()), e.h.log().slice(-1500));
});

const BIG = Number(process.env.LOAD_BIG_ROOM) || 300;
test(`큰 방 하나(DO 하나에 몰림): 강당 연수 참가자 ${BIG}명이 한꺼번에 들어와 묻기·긴 대기`, async (t) => {
  const e = await setup(t); if (!e) return;
  const { base, files } = e;
  const code = 'BIG' + randomBytes(3).toString('hex').toUpperCase();
  const pub = await appPublish(base, files, { live: liveFor(code), booking: { date: kst(2), people: BIG, live: true, network: 'restricted' } });
  assert.ok(pub.ok, JSON.stringify(pub.res?.body));
  const origin = new URL(pub.site.url).origin; const lv = `${base}/live/api/${code}`;
  const t0 = performance.now(); const lat = [];
  const res = await pool(Array.from({ length: BIG }, (_, k) => (k % 2 ? 'poll' : 'long')), BIG, async (mode) => {
    const r = await participant(lv, origin, mode, { polls: 4, gapMs: 100 }).catch((err) => ({ ok: false, step: 'throw', res: { status: 0, body: String(err.message) } }));
    if (r.lat) lat.push(...r.lat);
    return r;
  });
  const s = await req(lv, 'GET', '/snapshot?since=0', { headers: { 'x-lec-admin': encodeURIComponent(teacherKey(code)) } });
  out.bigRoom = { participants: BIG, seconds: Math.round((performance.now() - t0) / 100) / 10, p50: pct(lat, 50), p95: pct(lat, 95), max: pct(lat, 100), failed: res.filter((r) => !r.ok).length, questions: s.body.questions.length, joined: s.body.participants.length };
  t.diagnostic(JSON.stringify(out.bigRoom));
  if (process.env.SCALE_OUT) writeFileSync(process.env.SCALE_OUT, JSON.stringify(out, null, 2));
  assert.equal(out.bigRoom.failed, 0, JSON.stringify(res.filter((r) => !r.ok).slice(0, 2).map((r) => ({ step: r.step, status: r.res?.status, body: r.res?.body }))));
  assert.equal(out.bigRoom.questions, BIG); assert.equal(out.bigRoom.joined, BIG);
});
