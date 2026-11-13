// 2026-11 보안 검토(3차, docs/research/security-review-2026-11c.md)의 회귀 시험: 참가자 글 거르기·속도 제한·잠그기·닫힌 투표·CSV 수식 막기·
// 관리자 키 확인·쪽별 CSP와 응답 헤더·만 14세 미만 파일 끔·약한 암호 알림·잠금 화면 CSP. 브라우저가 필요한 것은 aux-pages.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import * as E from '../src/index.js';
import { nodeRuntime } from '../node.js';
import { liveDir, here } from './live-helpers.mjs';

const EX = JSON.parse(fs.readFileSync(path.join(here, '../../examples/data-lab.blueprint.json'), 'utf8'));
const ch = (...c) => String.fromCharCode(...c);
function client() {
  const mem = {};
  const ls = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; }, key: (i) => Object.keys(mem)[i], get length() { return Object.keys(mem).length; } };
  const w = { console, setTimeout, clearTimeout, setInterval, clearInterval, Promise, URL, TextEncoder, Intl, JSON, Math, Date, crypto: globalThis.crypto, Uint8Array, Uint32Array, Array, Object, String, Number, RegExp, Error, localStorage: ls, sessionStorage: ls, addEventListener() {}, removeEventListener() {} };
  w.window = w; vm.createContext(w);
  for (const f of ['core.js', 'local.js']) vm.runInContext(fs.readFileSync(path.join(liveDir, f), 'utf8'), w);
  return w;
}

test('참가자 글 거르기: 보이지 않는 글자·방향 바꿈·한글 채움·태그 문자·쌓인 결합 부호, 이모지 잇기는 남김', () => {
  const U = client().LecLive.util;
  assert.equal(U.cleanText('강' + ch(0x3164) + '사', 20), '강사');
  assert.equal(U.cleanText('a' + ch(0x202e) + 'b' + ch(0x2066) + 'c' + ch(0x200b, 0xad, 0x61c) + 'd', 20), 'abcd');
  assert.equal(U.cleanText('x' + ch(0xdb40, 0xdc41) + 'y', 20), 'xy');
  assert.equal(U.cleanText('Z' + ch(0x301, 0x302, 0x303, 0x304, 0x305), 20), 'Ź' + ch(0x302, 0x303));
  const fam = ch(0xd83d, 0xdc68, 0x200d, 0xd83d, 0xdc69, 0x200d, 0xd83d, 0xdc67);
  assert.equal(U.cleanText(fam + ' 좋아요 ' + ch(0x2764, 0xfe0f), 30), fam + ' 좋아요 ' + ch(0x2764, 0xfe0f));
  const t0 = Date.now(); U.cleanText('a'.repeat(200000) + ch(0x301).repeat(100000), 0, true); U.linkless('a.'.repeat(60000)); assert.ok(Date.now() - t0 < 1000, '긴 글도 빠름');
  assert.equal(U.hasLink('자료는 bit.ly/abc 에서'), true); assert.equal(U.hasLink('피벗 1.5배, node.js'), false);
  assert.equal(U.linkless('공식 https://evil.example.com/a?b 와 www.x.kr'), '공식 (링크) 와 (링크)');
});

test('받은 기록도 다시 거름: 예전 서버·직접 넣은 기록이 강사·발표 화면을 깨뜨리지 못함', async () => {
  const w = client(); const L = w.LecLive;
  const bad = { id: 'q1', text: '가' + ch(0x202e) + '나' + 'Z' + ch(0x301, 0x302, 0x303, 0x304) + 'x'.repeat(900), nickname: '운' + ch(0x200b) + '영자', status: 'open', votes: 0, createdAt: 1, updatedAt: 1 };
  L.register('evil', () => ({ connect: () => Promise.resolve({ mode: 'polling' }), list: (col) => Promise.resolve(col === 'questions' ? [bad] : col === 'polls' ? [{ id: 'p1', question: 'q', options: ['a' + ch(0x202e), 'b'.repeat(500)], open: true, createdAt: 1, updatedAt: 1 }] : []), getState: () => Promise.resolve({}) }));
  const c = L.create({ provider: 'evil', code: 'EVIL1' });
  await c.connect();
  const q = (await c.list('questions', {}))[0];
  assert.ok(!/[\u202E\u200B]/.test(q.text + q.nickname)); assert.ok([...q.text].length <= L.limits.question); assert.equal(q.nickname, '운영자');
  const p = (await c.list('polls', {}))[0];
  assert.equal(p.options[0], 'a'); assert.equal([...p.options[1]].length, L.limits.option);
});

test('한 기기 속도 제한·잠그기·닫힌 투표: 보내기 전에 알려 주고(대기열에 넣었다 조용히 버리지 않음), 리허설도 같은 규칙', async () => {
  const L = client().LecLive;
  const adm = L.create({ provider: 'local', code: 'RULES1', adminKey: 'x' }); await adm.connect();
  const p = L.create({ provider: 'local', code: 'RULES1', identity: 'session' }); await p.connect();
  await p.join({ nickname: '하나' });
  await p.add('questions', { text: '첫 질문' });
  await assert.rejects(p.add('questions', { text: '바로 또' }), (e) => e.code === 'rate_limited' && e.status === 429 && /초 뒤에/.test(e.message));
  await adm.setState({ ui: { lockQa: true } }); await p.sync(true);
  assert.equal(L.util.ext.locked(p.state, 'qa'), true);
  await assert.rejects(p.add('questions', { text: '잠긴 뒤' }), (e) => e.code === 'locked');
  const poll = await adm.add('polls', { question: '좋았나요?', options: ['예', '아니요'], open: true });
  await p.sync(true); await p.add('answers', { poll: poll.id, value: '예' });
  await adm.update('polls', poll.id, { open: false }); await p.sync(true);
  await new Promise((r) => setTimeout(r, 350));
  await assert.rejects(p.add('answers', { poll: poll.id, value: '아니요' }), (e) => e.code === 'poll_closed');
  // 서버(리허설 저장소)도 같은 규칙: 클라이언트 검사를 건너뛰어도 거절
  const raw = L.create({ provider: 'local', code: 'RULES1', identity: 'session', throttle: false });
  await raw.connect(); await raw.join({ nickname: '둘' }); raw._state = L.util.defaultState(); // 잠금을 모르는 척
  await assert.rejects(raw.add('questions', { text: '몰래' }), (e) => e.code === 'locked');
});

test('관리자 키: useAdminKey는 맞을 때만 이 연결에 쓰고 저장소에 두지 않음', async () => {
  const w = client(); const L = w.LecLive;
  let checks = 0;
  L.register('gate', () => ({ connect: () => Promise.resolve({ mode: 'polling' }), list: () => Promise.resolve([]), getState: () => Promise.resolve({}), checkAdmin: () => { checks++; return Promise.resolve(false); } }));
  const c = L.create({ provider: 'gate', code: 'GATE1' }); await c.connect();
  assert.equal(await c.useAdminKey('틀린-키-00000000'), false);
  assert.equal(c.isAdmin(), false); assert.equal(checks, 1, '한 번만 물음');
  for (let i = 0; i < w.localStorage.length; i++) assert.ok(!/틀린-키/.test(w.localStorage.getItem(w.localStorage.key(i))));
});

test('CSV 수식 막기: = + - @ 탭·CR, 앞 빈칸·전각 기호까지. 받은 CSV를 칸마다 다시 거름', () => {
  const U = client().LecLive.util;
  const csv = U.toCsv(['h'], [[' =1'], ['\t1'], ['＝1'], ['@SUM(A1)'], ['-2'], ['+3'], ['보통']]);
  for (const v of ["' =1", "'\t1", "'＝1", "'@SUM(A1)", "'-2", "'+3"]) assert.ok(csv.includes(v), v);
  const old = '\uFEFF질문,작성자\r\n=HYPERLINK("x"),"a,b"\r\n"=1\n2",ok\r\n\'=safe,x\r\n';
  const g = U.csvGuard(old);
  assert.ok(g.includes(`"'=HYPERLINK(""x"")"`) && g.includes(`"'=1\n2"`) && g.includes("'=safe") && !g.includes("''=safe"), g);
  assert.ok(g.startsWith('\uFEFF질문,작성자\r\n'));
});

test('쪽별 CSP: 참가자·강사·발표 화면은 연결한 참여 기능 서버로만 보냄(접속 확인만 https 전체), 섞인 콘텐츠 올려 받기', () => {
  const csp = (files, f) => /Content-Security-Policy" content="([^"]+)"/.exec(files[f])[1];
  const conn = (s) => /connect-src ([^;]+)/.exec(s)[1].trim().split(/\s+/);
  const bp = (live) => ({ ...structuredClone(EX), live });
  const http = E.build(bp({ provider: 'http', url: 'https://live.example.workers.dev', code: 'CSP1', features: ['qa'] }), { runtime: nodeRuntime() }).files;
  for (const f of ['index.html', 'console.html', 'screen.html', 'poster.html', 'privacy.html']) {
    assert.deepEqual(conn(csp(http, f)), ["'self'", 'file:', 'https://live.example.workers.dev', 'wss://live.example.workers.dev'], f);
    assert.match(csp(http, f), /upgrade-insecure-requests/);
  }
  assert.ok(conn(csp(http, 'check.html')).includes('https:'));
  const sb = E.build(bp({ provider: 'supabase', url: 'https://abcd.supabase.co', anonKey: 'sb_publishable_x', code: 'CSP2', features: ['qa'] }), { runtime: nodeRuntime() }).files;
  assert.deepEqual(conn(csp(sb, 'index.html')).slice(2), ['https://abcd.supabase.co', 'wss://abcd.supabase.co']);
  const sh = E.build(bp({ provider: 'sheets', url: 'https://script.google.com/macros/s/x/exec', code: 'CSP3', features: ['qa'] }), { runtime: nodeRuntime() }).files;
  assert.deepEqual(conn(csp(sh, 'index.html')).slice(2), ['https://script.google.com', 'https://script.googleusercontent.com']);
  const lan = E.build(bp({ provider: 'http', url: 'http://192.168.0.10:8787', code: 'CSP4', features: ['qa'] }), { runtime: nodeRuntime() }).files;
  assert.ok(conn(csp(lan, 'index.html')).includes('ws://192.168.0.10:8787')); assert.doesNotMatch(csp(lan, 'index.html'), /upgrade-insecure-requests/, '교실 LAN(http)은 올려 받지 않음');
  const local = E.build(bp({ provider: 'local', code: 'CSP5', features: ['qa'] }), { runtime: nodeRuntime() }).files;
  assert.deepEqual(conn(csp(local, 'index.html')), ["'self'", 'file:']);
  // 보조 화면만 aux.css, 공유 미리보기(og)는 참가자 화면에만
  assert.ok(!http['index.html'].includes('assets/aux.css') && http['console.html'].includes('assets/aux.css'));
  assert.ok(!http['console.html'].includes('og:title') && http['index.html'].includes('og:title'));
});

test('응답 헤더(_headers): HTTPS만·검색 제외·틀 넣기 금지·강사 화면 COOP, 공개(누구나)여도 강사용 쪽은 검색 제외', () => {
  const h = E.build({ ...structuredClone(EX), live: { provider: 'local', code: 'HDR1', features: ['qa'] } }, { runtime: nodeRuntime() }).files._headers;
  assert.match(h, /^\/\*\n(?:  .*\n)*  Strict-Transport-Security: max-age=31536000\n/m);
  assert.match(h, /^\/\*\n(?:  .*\n)*  X-Robots-Tag: noindex, nofollow\n/m);
  assert.match(h, /^\/console\.html\n  Content-Security-Policy: frame-ancestors 'none'\n  X-Frame-Options: DENY\n  Cross-Origin-Opener-Policy: same-origin\n/m);
  const pub = E.build({ ...structuredClone(EX), access: { mode: 'public' }, live: { provider: 'local', code: 'HDR2', features: ['qa'] } }, { runtime: nodeRuntime() }).files._headers;
  assert.doesNotMatch(pub.split('\n\n')[0], /X-Robots-Tag/, '공개 사이트의 참가자 화면은 검색 허용');
  for (const p of ['/console.html', '/screen.html', '/poster.html', '/check.html', '/privacy.html']) assert.match(pub, new RegExp(`^${p.replace('.', '\\.')}\\n(?:  .*\\n)*  X-Robots-Tag: noindex, nofollow`, 'm'), p);
});

test('만 14세 미만: 설계도가 보드 파일을 켜 두어도 받지 않음(강사 화면이 서버에 uploads=false를 적음)', () => {
  const bp = { meta: { title: 't' }, audience: { minor: true }, live: { provider: 'local', code: 'MIN1', features: ['board'] }, sections: [{ type: 'hero' }, { type: 'board', allowFiles: true, maxFiles: 3 }] };
  const r = E.build(bp, { runtime: nodeRuntime() });
  const data = JSON.parse(/<script type="application\/json" id="lp-blueprint">([\s\S]*?)<\/script>/.exec(r.files['console.html'])[1]);
  assert.equal(data.sections.find((s) => s.type === 'board').allowFiles, false);
  assert.ok(!/type="file"/.test(r.files['index.html']));
  assert.match(r.files['privacy.html'], /만 14세 미만/);
});

test('사이트 암호: 약한 암호를 알려 주고, 만드는 암호는 낱말 셋 + 숫자 넷, 잠금 화면도 같은 CSP', async () => {
  for (const p of ['1234', '0000000', 'abcd1234', 'password', '연수1234', 'aaaaaaaaaaaa']) assert.equal(E.passwordAdvice(p).level, 'weak', p);
  assert.equal(E.passwordAdvice('숲속바다1234').level, 'fair');
  for (let i = 0; i < 20; i++) { const p = E.friendlyPassword(); assert.equal(E.passwordAdvice(p).level, 'good', p); assert.match(p, /^[가-힣]{6,}\d{4}$/); }
  const r = E.build({ ...structuredClone(EX), access: { mode: 'password' }, live: { provider: 'local', code: 'PW1', features: ['qa'] } }, { runtime: nodeRuntime() });
  const files = await E.protectSite(r.files, '숲속바다햇살4821', { runtime: nodeRuntime(), title: 't', iterations: 1000 });
  for (const f of ['index.html', 'console.html', 'screen.html', 'poster.html']) assert.match(files[f], /<meta http-equiv="Content-Security-Policy" content="default-src 'self' file:; script-src 'self'/, f);
});
