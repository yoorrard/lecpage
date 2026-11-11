import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { matchRuntime, isRuntimeJs, prepare, JOIN, MAX_JS_BYTES } from '../src/runtime.js';
import { RUNTIME_SEGMENTS } from '../src/runtime-allow.js';
import { segment, currentSegments } from '../scripts/gen-runtime.mjs';
import { buildSite, blueprint, ENGINE, HOSTING } from './helpers.mjs';

const te = new TextEncoder(); const td = new TextDecoder();
const rt = (p) => readFileSync(join(ENGINE, 'runtime', p), 'utf8');
const jsOf = (files) => Object.entries(files).filter(([p]) => p.endsWith('.js'));

test('목록이 지금 엔진 런타임과 같음', () => {
  execFileSync(process.execPath, [join(HOSTING, 'scripts', 'gen-runtime.mjs'), '--check'], { stdio: 'pipe' });
  const cur = currentSegments();
  assert.ok(cur.length > 40);
  const names = new Set(RUNTIME_SEGMENTS.map((s) => s[0]));
  for (const n of ['boot.js', 'lecpage.js', 'screen.js', 'console.js', 'unlock.js', 'vendor/qrcode.js', 'live/core.js', 'live/local.js', 'live/http.js', 'live/supabase.js', 'live/sheets.js', 'fx/core.js', 'build.js#fx-start']) assert.ok(names.has(n), n);
  assert.ok(![...names].some((n) => n.startsWith('review/')), '앱 미리보기용 검토 도구는 받지 않음');
});

test('엔진이 만든 사이트의 .js는 모두 통과(예시 둘, 실시간 제공자 넷, 암호 사이트)', async () => {
  const sites = [await buildSite('sel-story'), await buildSite('data-lab'), await buildSite('sel-story', { password: '봄날1234' })];
  for (const provider of ['local', 'http', 'supabase', 'sheets']) {
    sites.push(await buildSite('data-lab', { patch: (bp) => { bp.live = { ...bp.live, provider, url: provider === 'sheets' ? 'https://script.google.com/macros/s/abc/exec' : 'https://live.example.com', anonKey: 'k' }; } }));
  }
  // 움직임을 가장 높게: CDN 라이브러리 효과까지 fx.js에 들어감
  sites.push(await buildSite('sel-story', { patch: (bp) => { bp.design.motion = 3; bp.audience.devices = ['laptop']; bp.design.effects = { scroll: 'smooth-scroll', schedule: 'gsap-scroll', 'hero.graphic': 'three-hero' }; } }));
  let n = 0; const seenNames = new Set();
  for (const files of sites) {
    for (const [p, bytes] of jsOf(files)) {
      const parts = await matchRuntime(bytes);
      assert.ok(parts, `통과해야 함: ${p}`);
      parts.forEach((x) => seenNames.add(x)); n++;
    }
  }
  assert.ok(n >= 40);
  for (const want of ['unlock.js', 'live/core.js', 'live/supabase.js', 'live/sheets.js', 'fx/core.js', 'build.js#fx-start', 'vendor/qrcode.js']) assert.ok(seenNames.has(want), want);
  const live = await matchRuntime(sites[0]['assets/live.js']);
  assert.deepEqual(live, ['live/core.js', `live/${blueprint('sel-story').live.provider}.js`]);
  const fx = await matchRuntime(sites[0]['assets/fx.js']);
  assert.equal(fx[0], 'fx/core.js');
  assert.equal(fx.at(-1), 'build.js#fx-start');
});

test('손댄 스크립트는 거절', async () => {
  const lec = rt('lecpage.js'); const core = rt('live/core.js'); const local = rt('live/local.js');
  const bad = {
    '끝에 덧붙임': lec + '\nalert(1)',
    '끝에 조각 구분 뒤 덧붙임': lec + JOIN + 'alert(1)',
    '앞에 덧붙임': 'alert(1);' + lec,
    '앞에 조각처럼 덧붙임': 'alert(1)' + JOIN + lec,
    '가운데 한 글자': lec.slice(0, 2000) + 'X' + lec.slice(2001),
    '마지막 글자 빠짐': lec.slice(0, -1),
    '끝에 줄바꿈 하나': lec + '\n',
    '구분만 남음': lec + JOIN,
    '구분이 다름': core + '\n' + local,
    '구분에 빈칸': core + '\n; \n' + local,
    '사이에 끼움': core + JOIN + 'fetch("https://evil.example")' + JOIN + local,
    '빈 내용': '',
    '빈칸뿐': ' ',
    '아예 다른 코드': 'console.log(document.cookie)',
    '앞머리만 같음': lec.slice(0, 40) + 'alert(1)',
    '눈에 안 보이는 글자': lec.replace('use strict', 'use​ strict'),
  };
  for (const [name, text] of Object.entries(bad)) assert.equal(await matchRuntime(te.encode(text)), null, name);
  // 통과하는 짝
  assert.ok(await isRuntimeJs(te.encode(lec)));
  assert.ok(await isRuntimeJs(te.encode(core + JOIN + local)));
  assert.ok(await isRuntimeJs(lec), '글자열로 넣어도 됨');
});

test('UTF-8이 아니거나 너무 크면 거절, CRLF는 같은 것으로 봄', async () => {
  const boot = rt('boot.js');
  assert.equal(await matchRuntime(new Uint8Array([0xff, 0xfe, 0x00])), null);
  assert.equal(await matchRuntime(new Uint8Array(MAX_JS_BYTES + 1)), null);
  assert.equal(await matchRuntime(new Uint8Array(0)), null);
  const utf16 = new Uint8Array(new Uint16Array([...boot].map((c) => c.charCodeAt(0))).buffer);
  assert.equal(await matchRuntime(utf16), null);
  const core = rt('live/core.js'); const local = rt('live/local.js');
  const crlf = (s) => s.replace(/\r?\n/g, '\r\n');
  assert.ok(await isRuntimeJs(te.encode(crlf(core) + '\r\n;\r\n' + crlf(local))), 'Windows 줄바꿈으로 빌드한 앱');
  assert.equal(await matchRuntime(te.encode(core.replace(/\n/g, '\r'))), null, 'CR만 있는 건 다른 내용');
  assert.ok(await isRuntimeJs(te.encode(boot).buffer), 'ArrayBuffer도 받음');
});

test('조각 나누기: 짧은 조각이 긴 조각의 앞부분이어도 되돌아가서 맞춤', async () => {
  const allow = prepare([segment('P', 'ab'), segment('Q', 'ab\n;\ncd'), segment('R', 'cd\n;\nef'), segment('S', 'zz')].map((s) => [s.name, s.len, s.head, s.sha256]));
  assert.deepEqual(await matchRuntime('ab', allow), ['P']);
  assert.deepEqual(await matchRuntime('ab\n;\ncd', allow), ['Q']);
  assert.deepEqual(await matchRuntime('ab\n;\ncd\n;\nef', allow), ['P', 'R'], 'Q로 시작하면 막히므로 P+R');
  assert.deepEqual(await matchRuntime('ab\n;\ncd\n;\nzz', allow), ['Q', 'S']);
  assert.deepEqual(await matchRuntime('zz\n;\nzz\n;\nab', allow), ['S', 'S', 'P']);
  assert.equal(await matchRuntime('ab\n;\ncd\n;\nxx', allow), null);
  assert.equal(await matchRuntime('cd', allow), null);
  assert.equal(await matchRuntime('ab\n;\n', allow), null);
  // 한글·이모지가 있어도 길이·해시가 맞음
  const k = prepare([segment('K', '/* 한글 😀 주석 */\nvar a=1;'), segment('L', 'var b="끝";')].map((s) => [s.name, s.len, s.head, s.sha256]));
  assert.deepEqual(await matchRuntime(te.encode('/* 한글 😀 주석 */\nvar a=1;\n;\nvar b="끝";'), k), ['K', 'L']);
  assert.equal(await matchRuntime(te.encode('/* 한글 😀 주석 */\nvar a=2;\n;\nvar b="끝";'), k), null);
  assert.equal(td.decode(te.encode('😀')).length, 2);
});

test('이전 판 기억하기(--keep): 적어 둔 예전 런타임 조각도 받음', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lecpage-rt-'));
  try {
    const env = { ...process.env, LECPAGE_RUNTIME_OUT: join(dir, 'allow.js'), LECPAGE_RUNTIME_HISTORY: join(dir, 'history.json') };
    const run = (...args) => execFileSync(process.execPath, [join(HOSTING, 'scripts', 'gen-runtime.mjs'), ...args], { env, stdio: 'pipe' }).toString();
    // 예전 판에 있던 조각 하나를 기록에 넣어 둠
    const old = segment('lecpage.js', '/* 예전 lecpage.js */\nvar old = 1;');
    writeFileSync(env.LECPAGE_RUNTIME_HISTORY, JSON.stringify({ segments: [{ ...old, kept: '2026-10-01' }] }));
    assert.match(run('--keep'), /runtime-history\.json: \d+개 추가/);
    const hist = JSON.parse(readFileSync(env.LECPAGE_RUNTIME_HISTORY, 'utf8')).segments;
    assert.ok(hist.length > 40 && hist.some((s) => s.sha256 === old.sha256));
    assert.match(run('--keep'), /0개 추가/, '같은 판을 두 번 적지 않음');
    const mod = await import(pathToFileURL(env.LECPAGE_RUNTIME_OUT).href);
    const allow = prepare(mod.RUNTIME_SEGMENTS);
    assert.equal(mod.RUNTIME_SEGMENTS.length, currentSegments().length + 1, '지금 판 + 예전 조각 하나');
    assert.deepEqual(await matchRuntime('/* 예전 lecpage.js */\nvar old = 1;', allow), ['lecpage.js@2026-10-01']);
    assert.ok(await matchRuntime(rt('lecpage.js'), allow), '지금 판도 그대로 받음');
    assert.equal(await matchRuntime('/* 예전 lecpage.js */\nvar old = 2;', allow), null);
    assert.equal(await matchRuntime('/* 예전 lecpage.js */\nvar old = 1;'), null, '기록이 없는 기본 목록은 받지 않음');
    run('--check');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
