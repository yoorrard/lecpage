// Training-site runtime upgrades: completion CSV (이수 확인), word-cloud cleaning, state extensions,
// page visibility metadata, the printable poster and the mobile/console markup.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { liveDir, skillDir, startNodeServer, api } from './live-helpers.mjs';
import * as E from '../src/index.js';
import { renderPoster, splitNav } from '../src/render/pages.js';
import { themeCSS } from '../src/design/tokens.js';
import { nodeRuntime } from '../node.js';

const protoNode = path.join(skillDir, 'backends/node-server/lib/protocol.js');
const runtimeDir = path.join(skillDir, 'engine/runtime');
const EX = (id) => JSON.parse(readFileSync(path.join(skillDir, 'examples', `${id}.blueprint.json`), 'utf8'));

function fakeStorage() {
  const m = new Map();
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, clear: () => m.clear() };
}
function core(scripts = []) {
  const win = { console, setTimeout, clearTimeout, setInterval, clearInterval, Promise, URL, TextEncoder, TextDecoder, Intl, JSON, Math, Date, crypto: globalThis.crypto, isSecureContext: true, BroadcastChannel, Uint8Array, Array, Object, String, Number, RegExp, Error, localStorage: fakeStorage(), sessionStorage: fakeStorage(), addEventListener() {}, removeEventListener() {} };
  win.window = win; win.globalThis = win;
  vm.createContext(win);
  for (const f of ['core.js', ...scripts]) vm.runInContext(fs.readFileSync(path.join(liveDir, f), 'utf8'), win, { filename: f });
  return win.LecLive;
}
const plain = (x) => JSON.parse(JSON.stringify(x));
const KST = (date, hm) => Date.parse(`${date}T${hm}:00+09:00`);

// 15:30~17:00 (90분), 90% → 81분 이상 머물러야 O
const DAY = '2027-04-22';
const DATA = {
  participants: [
    { id: 'p1', nickname: '숲', name: '김선생', school: '늘봄초', createdAt: 1 },
    { id: 'p2', nickname: '=bad', name: '이선생', school: '한빛중', createdAt: 2 },
    { id: 'p3', nickname: '바람', createdAt: 3 },
    { id: 'p4', nickname: '나무', createdAt: 4 },
    { id: 'p5', nickname: '늦게', createdAt: 5 },
  ],
  attendance: [
    { by: 'p1', kind: 'in', at: KST(DAY, '15:20') }, { by: 'p1', kind: 'out', at: KST(DAY, '17:05') }, // 머문 시간은 연수 시간으로 잘라 90분
    { by: 'p2', kind: 'in', at: KST(DAY, '15:30') }, { by: 'p2', kind: 'out', at: KST(DAY, '16:40') }, // 70분 → X
    { by: 'p3', kind: 'in', at: KST(DAY, '15:31') }, // 퇴실 없음 → 확인 필요
    { by: 'p5', kind: 'in', at: KST(DAY, '15:39') }, { by: 'p5', kind: 'out', at: KST(DAY, '17:00') }, // 81분 → 경계 O(설문 안 냄 → X)
  ],
  progress: [{ by: 'p1', station: 's1', status: 'done' }, { by: 'p1', station: 's2', status: 'done' }, { by: 'p2', station: 's1', status: 'doing' }],
  survey: [{ by: 'p1', answers: { q: 5 }, updatedAt: 9 }, { by: 'p2', answers: {}, updatedAt: 9 }],
};
const OPTS = { date: DAY, start: '15:30', end: '17:00', rate: 90, survey: true, stations: 4 };

test('completion: rule, columns and parity between the client core and the server protocol', async () => {
  const P = await import(protoNode);
  const L = core();
  assert.deepEqual([...L.util.completionColumns], ['별명', '이름', '소속', '입실', '퇴실', '머문 시간(분)', '실습 완료(n/전체)', '설문 제출', '이수']);
  const c = L.util.exportTable('completion', DATA, undefined, OPTS);
  const s = P.exportTable('completion', DATA, undefined, OPTS);
  assert.equal(L.util.toCsv(c.columns, c.rows), P.toCsv(s.columns, s.rows));
  const by = Object.fromEntries(s.rows.map((r) => [r[0], r]));
  assert.deepEqual(by['숲'].slice(5), [90, '2 / 4', 'O', 'O']);
  assert.equal(by['숲'][3], '2027-04-22 15:20:00');
  assert.deepEqual(by['=bad'].slice(5), [70, '0 / 4', 'O', 'X']);
  assert.deepEqual(by['바람'].slice(5), ['', '0 / 4', 'X', '확인 필요']);
  assert.deepEqual(by['나무'].slice(5), ['', '0 / 4', 'X', '확인 필요']);
  assert.deepEqual(by['늦게'].slice(5), [81, '0 / 4', 'X', 'X'], 'enough minutes but no survey');
  // without survey questions the survey column is '-' and does not block
  const noSurvey = P.exportTable('completion', DATA, undefined, { ...OPTS, survey: false });
  assert.deepEqual(noSurvey.rows.find((r) => r[0] === '늦게').slice(7), ['해당 없음', 'O']);
  // no schedule → 확인 필요 for everyone; date falls back to the check-in day
  assert.ok(P.exportTable('completion', DATA).rows.every((r) => r[8] === '확인 필요'));
  assert.equal(P.exportTable('completion', DATA, undefined, { start: '15:30', end: '17:00', rate: 90 }).rows[0][8], 'O');
  // formula injection guard and no personal numbers
  assert.match(P.toCsv(s.columns, s.rows), /'=bad/);
  assert.ok(!/NEIS|전화|휴대폰|phone/i.test(s.columns.join()));
  assert.ok(P.EXPORT_KINDS.includes('completion'));
  assert.equal(P.zonedMs('2027-04-22', '15:30'), KST(DAY, '15:30'));
  assert.equal(L.util.zonedMs('2027-04-22', '15:30', 'Asia/Seoul'), KST(DAY, '15:30'));
});

test('completion: local adapter passes options; core builds it from the admin store when a server lacks the kind', async () => {
  const L = core(['local.js']);
  const code = 'CMP' + Math.random().toString(36).slice(2, 6);
  const a = L.create({ provider: 'local', code, adminKey: 'k' });
  await a.connect(); await a.join({ nickname: '참가' });
  await a.add('attendance', { kind: 'in' }); await a.add('attendance', { kind: 'out' });
  const csv = await a.exportCsv('completion', { date: '2000-01-01', start: '09:00', end: '10:00', rate: 90 });
  const row = csv.trim().split('\r\n')[1].split(',');
  assert.equal(row[0], '참가'); assert.equal(row[8], 'X', 'checked in/out outside the schedule → 0 minutes');
  await a.close();
  // an older server: exportCsv('completion') → 400 bad_kind
  L.register('old', () => ({
    connect: () => Promise.resolve({ mode: 'polling' }),
    snapshot: () => Promise.resolve({ now: 1, state: {}, participants: [{ id: 'x', nickname: '옛', createdAt: 1, updatedAt: 1 }], attendance: [], progress: [], survey: [] }),
    exportCsv: (k) => (k === 'completion' ? Promise.reject(L.error('bad_kind', 'kind', { status: 400 })) : Promise.resolve('')),
  }));
  const o = L.create({ provider: 'old', code: 'OLD1', adminKey: 'k' });
  await o.connect();
  const out = await o.exportCsv('completion', { start: '09:00', end: '10:00' });
  assert.match(out, /^﻿별명,이름,소속/); assert.match(out, /옛,,,,,,해당 없음,해당 없음,확인 필요/);
  await o.close();
});

test('completion: node server reads the options from export.csv query parameters', async () => {
  const srv = await startNodeServer({ adminKey: 'admin-key-1' });
  try {
    const a = api(srv.url, 'CMPL1');
    const p = (await a.call('POST', '/join', { body: { nickname: '서버' } })).body;
    await a.call('POST', '/join', { body: { nickname: '없음' } });
    assert.equal((await a.call('POST', '/attendance', { token: p.token, body: { kind: 'in' } })).status, 201);
    await a.call('POST', '/attendance', { token: p.token, body: { kind: 'out' } });
    const plain = await a.call('GET', '/export.csv?kind=completion', { admin: 'admin-key-1' });
    assert.equal(plain.status, 200);
    assert.ok(plain.body.split('\r\n').slice(1, 3).every((l) => l.endsWith('확인 필요')));
    const q = await a.call('GET', '/export.csv?kind=completion&date=2000-01-01&start=09:00&end=10:00&rate=90&survey=1&stations=3', { admin: 'admin-key-1' });
    const lines = q.body.trim().split('\r\n');
    assert.match(lines[1], /^서버,,,.+,0,0 \/ 3,X,X$/);
    assert.match(lines[2], /^없음,,,,,,0 \/ 3,X,확인 필요$/);
    assert.equal((await a.call('GET', '/export.csv?kind=completion', {})).status, 401);
  } finally { await srv.close(); }
});

test('word cloud: normalize, strip one particle, merge, drop banned and hidden words', () => {
  const { normWord, wordCloud } = core().util;
  assert.equal(normWord('  협력이 '), '협력');
  assert.equal(normWord('ＡＩ'.normalize('NFKC') + '가'), 'ai');
  assert.equal(normWord('AI'), 'ai');
  assert.equal(normWord('소통은!'), '소통');
  assert.equal(normWord('아이'), '아이', 'would leave one letter');
  assert.equal(normWord('고양이'), '고양이', 'keep-list');
  assert.equal(normWord('행복도'), '행복');
  assert.equal(normWord('재미'), '재미');
  assert.equal(normWord('한글을'), '한글', 'NFD input is composed first');
  const answers = ['협력이', '협력', 'AI가', ' ai ', '바보', '소통은', '소통!', '**', 'Teamwork', 'teamwork.'].map((value, i) => ({ poll: 'w', by: 'p' + i, value }));
  answers.push({ poll: 'other', by: 'z', value: '협력' }, { poll: 'w', by: 'm', value: ['배움', '배움이'] });
  const cloud = wordCloud(answers, 'w', {});
  assert.deepEqual(plain(cloud.map((w) => [w.word, w.count])), [['협력', 2], ['ai', 2], ['소통', 2], ['teamwork', 2], ['배움', 2]]);
  assert.deepEqual(plain(wordCloud(answers, 'w', { hidden: ['소통은'] }).map((w) => w.word)), ['협력', 'ai', 'teamwork', '배움']);
  assert.ok(!wordCloud([{ poll: 'w', value: '씨발' }], 'w').length);
});

test('state extensions live in state.ui and stay within the server limits', () => {
  const X = core().util.ext;
  let st = { ui: {} };
  st = { ui: { ...st.ui, ...X.revealPatch(st, 'p1', true).ui } };
  assert.ok(X.revealed(st, 'p1')); assert.ok(!X.revealed(st, 'p2'));
  st = { ui: { ...st.ui, ...X.revealPatch(st, 'p2', true).ui } };
  assert.equal(st.ui.reveal, 'p1|p2');
  assert.equal(X.revealPatch(st, 'p1', false).ui.reveal, 'p2');
  assert.equal(X.revealPatch({ ui: { reveal: 'p1' } }, 'p1', false).ui.reveal, null);
  assert.ok(X.revealed({ pollReveal: { p9: true } }, 'p9'), 'top-level form is read too');
  assert.equal(X.signalReset({ ui: { signalReset: 50 } }), 50);
  let words = { ui: {} };
  for (let i = 0; i < 80; i++) words = { ui: X.hiddenPatch(words, '낱말' + i + '은', true).ui };
  assert.ok(words.ui.hiddenWords.length <= 200);
  assert.deepEqual(plain(X.hiddenWords(words).slice(-1)), ['낱말79']);
  const timers = Array.from({ length: 8 }, (_, i) => ({ label: '아주 긴 모둠 이름 ' + i, endsAt: 1762650000000 + i, remaining: 0, running: true }));
  const v = X.timersValue(timers);
  assert.ok(v.length <= 200);
  const back = X.timers({ ui: { timers: v } });
  assert.ok(back.length >= 2 && back[0].running && back[0].endsAt === 1762650000000);
  assert.equal(X.timersValue([]), null);
});

test('pages: robots meta, poster, nav split, console and screen controls', () => {
  const bp = EX('data-lab');
  const r = E.build(bp, { runtime: nodeRuntime() });
  for (const f of ['index.html', 'console.html', 'screen.html', 'check.html', 'privacy.html']) assert.match(r.files[f], /<meta name="robots" content="noindex, nofollow">/, f);
  const pub = E.build({ ...bp, access: { mode: 'public' } }, { runtime: nodeRuntime() });
  assert.ok(!/name="robots"/.test(pub.files['index.html']), 'public participant page can be indexed');
  assert.match(pub.files['screen.html'], /noindex, nofollow/);
  // participant page: mobile TOC sheet, 지금 bar, help sheet (no window.prompt), labelled dock
  const idx = r.files['index.html'];
  assert.match(idx, /data-toc-open/); assert.match(idx, /data-toc-sheet/); assert.match(idx, /data-now hidden/); assert.match(idx, /data-help-dialog/);
  assert.match(idx, /<details class="lp-more"/);
  assert.ok(!/\son[a-z]+="/i.test(idx), 'no inline event handlers');
  assert.ok(!/window\.prompt/.test(r.files['assets/lecpage.js']));
  const data = JSON.parse(/<script type="application\/json" id="lp-data">([\s\S]*?)<\/script>/.exec(idx)[1]);
  assert.equal(data.admin.completionRate, 80); assert.equal(data.start, '14:00'); assert.ok(data.survey > 0);
  // console links the poster; screen has the tools drawer
  assert.match(r.files['console.html'], /href="poster.html"/);
  assert.match(r.files['screen.html'], /data-tools-open/); assert.match(r.files['screen.html'], /href="poster.html"/);
  // poster
  const ctx = { bp: r.blueprint, design: r.design, live: true, fontLinks: themeCSS(r.design).fontLinks, themeColor: '#fff', hasFx: false, ogImage: '' };
  const poster = renderPoster(ctx);
  assert.match(poster, /noindex, nofollow/); assert.match(poster, /data-qr-self/); assert.match(poster, /강사만/); assert.match(poster, /data-qr-page="console.html"/);
  assert.match(poster, new RegExp(r.blueprint.live.code)); assert.match(poster, /Wi-Fi/); assert.match(poster, /assets\/lecpage\.js/);
  assert.ok(!/\son[a-z]+="/i.test(poster));
  const offline = renderPoster({ ...ctx, live: false });
  assert.ok(!/console\.html/.test(offline) && !/참여 코드/.test(offline));
  // nav: ≤6 + 더보기, keeps 실습/질문/교재
  const L = (types) => types.map((t, i) => ({ id: t + i, type: t, nav: t }));
  const many = L(['readiness', 'outline', 'tools', 'prompts', 'glossary', 'quiz', 'faq', 'materials', 'stations', 'deck', 'qa', 'survey']);
  const sp = splitNav(many);
  assert.equal(sp.shown.length, 6);
  for (const t of ['stations', 'deck', 'qa']) assert.ok(sp.shown.some((s) => s.type === t), t);
  assert.equal(sp.shown.length + sp.more.length, many.length);
  assert.deepEqual(sp.shown.map((s) => s.type), ['readiness', 'outline', 'tools', 'stations', 'deck', 'qa'], 'page order');
  assert.equal(splitNav(L(['a', 'b', 'c', 'd', 'e', 'f', 'g'])).more.length, 0);
});

test('runtime scripts parse as classic scripts', () => {
  for (const f of ['lecpage.js', 'console.js', 'screen.js', 'live/core.js', 'live/local.js', 'live/http.js', 'live/supabase.js', 'live/sheets.js', 'fx/effects/scramble.js']) {
    assert.doesNotThrow(() => new vm.Script(fs.readFileSync(path.join(runtimeDir, f), 'utf8'), { filename: f }), f);
  }
});
