// lecpage 커넥트의 교재 → PDF(/bridge/convert): 프로그램 고르는 순서, 운영 체제별 부르는 꼴(가짜 실행), 실제 LibreOffice(있을 때), 경로의 짝 맞춤 확인
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as C from '../../scripts/studio-convert.mjs';
import { startStudio } from '../../scripts/studio.mjs';
import { sofficePath } from '../../scripts/render-slides.mjs';

const FX = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const isPdf = (b) => Buffer.from(b).subarray(0, 5).toString('latin1') === '%PDF-';

test('형식마다 그 형식을 만든 프로그램을 먼저(없는 프로그램은 빼고)', () => {
  assert.deepEqual(C.appsFor('pptx', C.ORDER.win32), ['powerpoint', 'libreoffice']);
  assert.deepEqual(C.appsFor('key', C.ORDER.darwin), ['keynote', 'libreoffice']);
  assert.deepEqual(C.appsFor('pptx', C.ORDER.darwin), ['powerpoint', 'keynote', 'libreoffice']);
  assert.deepEqual(C.appsFor('hwpx', C.ORDER.win32), ['hwp']);
  assert.deepEqual(C.appsFor('docx', ['pages', 'libreoffice']), ['pages', 'libreoffice']);
  assert.deepEqual(C.appsFor('pdf', C.ORDER.win32), []);
  // macOS: 매크로를 담을 수 있는 옛 형식은 매크로를 끌 수 있는 프로그램 먼저, Office는 마지막(Windows는 그대로: 매크로를 끄고 엶)
  assert.deepEqual(C.appsFor('ppt', C.ORDER.darwin, 'darwin'), ['keynote', 'libreoffice', 'powerpoint']);
  assert.deepEqual(C.appsFor('doc', C.ORDER.darwin, 'darwin'), ['pages', 'libreoffice', 'word']);
  assert.deepEqual(C.appsFor('pptx', C.ORDER.darwin, 'darwin'), ['powerpoint', 'keynote', 'libreoffice']);
  assert.deepEqual(C.appsFor('ppt', C.ORDER.win32, 'win32'), ['powerpoint', 'libreoffice']);
});

test('설치 확인: 윈도우는 COM 등록(reg query), macOS는 /Applications', () => {
  const asked = [];
  const win = C.detectApps({ platform: 'win32', fresh: true, soffice: () => '', run: (cmd, args) => { asked.push(args[1]); return { status: /PowerPoint|HWPFrame/.test(args[1]) ? 0 : 1 }; } });
  assert.deepEqual(win, ['powerpoint', 'hwp']);
  assert.ok(asked.includes('HKCR\\PowerPoint.Application\\CLSID'));
  const mac = C.detectApps({ platform: 'darwin', fresh: true, home: '/Users/t', soffice: () => '/x/soffice', exists: (p) => /Keynote\.app$/.test(p) || p === '/Users/t/Applications/Microsoft Word.app' });
  assert.deepEqual(mac, ['keynote', 'word', 'libreoffice']);
  C.detectApps({ fresh: true }); // 다음 시험을 위해 이 PC 값으로 되돌림
});

test('윈도우: PowerShell -EncodedCommand + 경로는 환경 변수로(한글·따옴표가 명령 글에 섞이지 않게)', async () => {
  let call = null;
  const r = await C.convertWith('powerpoint', '교재 "1".pptx', new Uint8Array([1, 2]), { platform: 'win32', runImpl: async (cmd, args, o) => { call = { cmd, args, env: o.env }; writeFileSync(o.env.LP_OUT, '%PDF-1.4\n'); return { code: 0, out: '' }; } });
  assert.ok(r.ok && isPdf(r.pdf));
  assert.equal(call.cmd, 'powershell.exe');
  const script = Buffer.from(call.args[call.args.indexOf('-EncodedCommand') + 1], 'base64').toString('utf16le');
  assert.match(script, /PowerPoint\.Application/); assert.match(script, /SaveAs\(\$env:LP_OUT, 32\)/);
  assert.match(script, /Presentations\.Count -eq 0/); // 사람이 열어 둔 발표는 닫지 않음
  assert.match(call.env.LP_IN, /input\.pptx$/);
});

test('매크로가 돌지 않게: Office는 열기 전에 AutomationSecurity=3·읽기 전용(Word는 자동 매크로도 끔) · 매크로 형식은 받지 않음 · LibreOffice는 매크로 끈 새 프로필', async () => {
  for (const id of ['powerpoint', 'word']) {
    const ps = C.PS[id];
    const at = ps.indexOf('AutomationSecurity = 3'); const open = ps.search(/(Presentations|Documents)\.Open\(/);
    assert.ok(at > 0 && open > at, id + ': 여는 것보다 먼저 매크로를 끔');
    assert.match(ps, /AutomationSecurity = \$sec/, id + ': 끝나면 예전 값으로');
  }
  assert.match(C.PS.powerpoint, /Presentations\.Open\(\$env:LP_IN, -1,/, 'PowerPoint 읽기 전용(-1)');
  assert.match(C.PS.word, /Documents\.Open\(\$env:LP_IN, \$false, \$true,/, 'Word 읽기 전용');
  assert.ok(C.PS.word.indexOf('DisableAutoMacros') < C.PS.word.indexOf('Documents.Open('), 'Word 자동 매크로(AutoOpen)를 먼저 끔');
  for (const ext of ['pptm', 'ppsm', 'potm', 'docm', 'dotm']) {
    assert.ok(!Object.values(C.APPS).some((a) => a.exts.includes(ext)), ext + '는 어느 프로그램으로도 열지 않음');
    const r = await C.convertToPdf('a.' + ext, new Uint8Array([1]), { platform: 'win32', ids: C.ORDER.win32, runImpl: async () => assert.fail('열면 안 됨') });
    assert.equal(r.error, 'macro'); assert.match(r.message_ko, /매크로/);
  }
  let args = null; let reg = '';
  await C.convertWith('libreoffice', 'a.pptx', new Uint8Array([1]), { platform: 'linux', runImpl: async (cmd, a) => { args = a; const prof = new URL(a[0].split('=').slice(1).join('=')); reg = readFileSync(join(fileURLToPath(prof), 'user', 'registrymodifications.xcu'), 'utf8'); return { code: 1, out: '' }; } });
  assert.match(args[0], /^-env:UserInstallation=file:/); assert.ok(args.includes('--headless'));
  assert.match(reg, /MacroSecurityLevel[^]*?<value>3<\/value>/); assert.match(reg, /DisableMacrosExecution[^]*?<value>true<\/value>/);
});

test('macOS: osascript에 경로를 인자로, 실패하면 다음 프로그램', async () => {
  const calls = [];
  const runImpl = async (cmd, args) => { calls.push(args[1]); if (/Keynote/.test(args[1])) writeFileSync(args[3], '%PDF-1.4\n'); return { code: /Keynote/.test(args[1]) ? 0 : 1, out: 'no' }; };
  const r = await C.convertToPdf('a.pptx', new Uint8Array([1]), { platform: 'darwin', ids: ['powerpoint', 'keynote'], runImpl, home: '/nonexistent-home' });
  assert.equal(r.ok, true); assert.equal(r.via, 'keynote'); assert.equal(r.tried.length, 2);
  assert.match(calls[0], /Microsoft PowerPoint/); assert.match(calls[1], /export d to/);
  const none = await C.convertToPdf('a.hwp', new Uint8Array([1]), { platform: 'darwin', ids: ['keynote'] });
  assert.equal(none.error, 'no-app'); assert.match(none.message_ko, /찾지 못했어요/);
});

test('LibreOffice로 실제 변환(PPTX·DOCX → PDF)', { skip: !sofficePath() && 'LibreOffice 없음', timeout: 300000 }, async () => {
  for (const f of ['workshop.pptx', 'guide.docx']) {
    const r = await C.convertToPdf(f, readFileSync(join(FX, f)), { platform: 'linux', ids: ['libreoffice'] });
    assert.ok(r.ok, f + ' ' + JSON.stringify(r.tried)); assert.ok(isPdf(r.pdf)); assert.equal(r.via, 'libreoffice');
  }
});

test('/bridge/convert: 짝 토큰 확인 · 목록 · 받지 않는 형식', async () => {
  const st = await startStudio({ remote: true, appUrl: 'http://127.0.0.1:9' });
  try {
    const base = st.url + 'bridge/convert'; const h = { 'x-lecpage-bridge': st.S.token, origin: st.S.origin };
    assert.equal((await fetch(base, { headers: { origin: st.S.origin } })).status, 401);
    const g = await (await fetch(base, { headers: h })).json();
    assert.equal(g.ok, true); assert.ok(Array.isArray(g.apps)); assert.equal(typeof g.exts, 'object');
    const bad = await fetch(base + '?name=a.exe', { method: 'POST', headers: { ...h, 'content-type': 'application/octet-stream' }, body: new Uint8Array([1]) });
    assert.equal(bad.status, 400);
    const macro = await fetch(base + '?name=' + encodeURIComponent('교재.pptm'), { method: 'POST', headers: { ...h, 'content-type': 'application/octet-stream' }, body: new Uint8Array([1]) });
    assert.equal(macro.status, 400); assert.equal((await macro.json()).error, 'macro');
    assert.ok(!('pptm' in g.exts) && !('docm' in g.exts), '앱에 매크로 형식을 바꿀 수 있다고 알리지 않음');
    if (!sofficePath()) {
      const r = await fetch(base + '?name=a.pptx', { method: 'POST', headers: { ...h, 'content-type': 'application/octet-stream' }, body: new Uint8Array([1]) });
      assert.equal(r.status, 422); assert.equal((await r.json()).error, 'no-app');
    }
  } finally { await st.close(); }
});
