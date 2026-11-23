// lecpage 커넥트의 교재 → PDF(/bridge/convert): 프로그램 고르는 순서, 운영 체제별 부르는 꼴(가짜 실행), 매크로 살피기(한글·macOS Office), 실제 LibreOffice(있을 때), 경로의 짝 맞춤 확인
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCipheriv } from 'node:crypto';
import * as C from '../../scripts/studio-convert.mjs';
import * as M from '../../scripts/studio-macro.mjs';
import { writeCfb } from './fixtures/make_hwp.mjs';
import { zipSync, unzipSync, deflateSync } from '../vendor/fflate.js';
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
  // macOS: Office는 AppleScript로 매크로를 끌 수 없어 VBA를 담을 수 없는 .pptx·.docx 꾸러미만. 옛 형식·ODF·RTF는 Keynote·Pages·LibreOffice로
  // (Windows는 그대로: 매크로를 끄고 엶)
  assert.deepEqual(C.appsFor('ppt', C.ORDER.darwin, 'darwin'), ['keynote', 'libreoffice']);
  assert.deepEqual(C.appsFor('pps', C.ORDER.darwin, 'darwin'), ['libreoffice']);
  assert.deepEqual(C.appsFor('doc', C.ORDER.darwin, 'darwin'), ['pages', 'libreoffice']);
  assert.deepEqual(C.appsFor('odt', C.ORDER.darwin, 'darwin'), ['libreoffice']);
  assert.deepEqual(C.appsFor('rtf', C.ORDER.darwin, 'darwin'), ['libreoffice']);
  assert.deepEqual(C.appsFor('pptx', C.ORDER.darwin, 'darwin'), ['powerpoint', 'keynote', 'libreoffice']);
  assert.deepEqual(C.appsFor('docx', C.ORDER.darwin, 'darwin'), ['word', 'pages', 'libreoffice']);
  assert.deepEqual(C.appsFor('ppt', C.ORDER.win32, 'win32'), ['powerpoint', 'libreoffice']);
  assert.deepEqual(C.appsFor('doc', C.ORDER.win32, 'win32'), ['word', 'libreoffice']);
  // 앱에 알리는 목록도 같게(macOS에 Office만 있으면 .ppt·.doc는 바꿀 수 있다고 알리지 않음 → 앱이 바로 브라우저 안 그리기·안내로)
  const mac = C.convertibleExts(['powerpoint', 'word'], 'darwin');
  assert.deepEqual(Object.keys(mac).sort(), ['docx', 'potx', 'ppsx', 'pptx']);
  assert.ok(C.convertibleExts(['powerpoint', 'word'], 'win32').ppt.includes('powerpoint'));
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
  const r = await C.convertToPdf('a.pptx', readFileSync(join(FX, 'workshop.pptx')), { platform: 'darwin', ids: ['powerpoint', 'keynote'], runImpl, home: '/nonexistent-home' });
  assert.equal(r.ok, true); assert.equal(r.via, 'keynote'); assert.equal(r.tried.length, 2);
  assert.match(calls[0], /Microsoft PowerPoint/); assert.match(calls[1], /export d to/);
  const none = await C.convertToPdf('a.hwp', new Uint8Array([1]), { platform: 'darwin', ids: ['keynote'] });
  assert.equal(none.error, 'no-app'); assert.match(none.message_ko, /찾지 못했어요/);
});

// ── 매크로를 끄지 못하는 프로그램(한글·macOS Office): 넘기기 전에 파일을 살핌(studio-macro.mjs) ──
// 한글이 새 문서마다 넣는 스크립트 틀(실제 한글 파일 15개에서 같음: 머리·본문·앞·뒤 글 + 끝 표시 -1)
const HEAD = 'var Documents = XHwpDocuments;\r\nvar Document = Documents.Active_XHwpDocument;\r\n';
const STUB = 'function OnDocument_New()\r\n{\r\n\t//todo : \r\n}\r\n\r\n';
const EVIL = 'function OnDocument_Open()\r\n{\r\n\tvar sh = new ActiveXObject("WScript.Shell"); sh.Run("calc");\r\n}\r\n';
const u32 = (v) => { const b = Buffer.alloc(4); b.writeUInt32LE(v >>> 0); return b; };
const jscript = (parts) => Buffer.concat([...parts.flatMap((s) => [u32(s.length), Buffer.from(s, 'utf16le')]), u32(0xFFFFFFFF)]);
function fileHeader(props) { const b = Buffer.alloc(256); b.write('HWP Document File', 0, 'latin1'); b.writeUInt32LE(0x05000107, 32); b.writeUInt32LE(props, 36); return b; }
/** 배포용 문서의 봉투로 싸기(studio-macro.mjs undistribute의 거꾸로) */
function distribute(body, seed = 0x1234567B) {
  const data = Buffer.alloc(256); data.writeUInt32LE(seed, 0);
  for (let i = 4; i < 256; i++) data[i] = (i * 37 + 11) & 255;
  const off = 4 + (data[0] & 0x0F); const key = Buffer.from(data.subarray(off, off + 16));
  let s = seed; const rand = () => { s = (Math.imul(s, 214013) + 2531011) >>> 0; return (s >>> 16) & 0x7FFF; };
  let left = 0, k = 0;
  for (let i = 0; i < 256; i++) { if (left === 0) { k = rand() & 0xFF; left = (rand() & 0x0F) + 1; } if (i >= 4) data[i] ^= k; left--; }
  const padded = Buffer.alloc(Math.ceil(body.length / 16) * 16); Buffer.from(body).copy(padded);
  const c = createCipheriv('aes-128-ecb', key, null); c.setAutoPadding(false);
  return Buffer.concat([u32(28 | (256 << 20)), data, c.update(padded), c.final()]);
}
/** HWP 5.0(OLE 복합 문서): props 1 = 압축, 2 = 암호, 4 = 배포용 */
function hwp5({ parts = [HEAD, STUB, '', ''], props = 1, extra = [], raw } = {}) {
  const pack = (b) => (props & 1 ? Buffer.from(deflateSync(b)) : b);
  let js = pack(raw ?? jscript(parts));
  if (props & 4) js = distribute(js);
  return writeCfb([['FileHeader', fileHeader(props)], ['DocInfo', new Uint8Array(16)], ['Scripts/JScriptVersion', pack(Buffer.from([1, 0, 0, 0, 0, 0, 0, 0]))], ['Scripts/DefaultJScript', js], ...extra]);
}
const PLAN_HWPX = unzipSync(readFileSync(join(FX, 'plan.hwpx')));
const hwpx = (extra = {}) => zipSync({ ...PLAN_HWPX, ...extra });
const u16 = (s) => new Uint8Array(Buffer.from(s, 'utf16le'));

test('빈 스크립트 틀인지: 두 변수 + 몸통이 빈 함수만(주석·빈칸 무관), 그 밖은 매크로', () => {
  for (const ok of ['', HEAD, STUB, HEAD + STUB, STUB + '\r\n' /* 한글 2024 틀(끝 빈 줄 하나 더) */, 'function OnDocument_New(){}\nfunction OnDocument_Open(){ /* todo */ }', 'var Documents=XHwpDocuments\nvar Document = Documents . Active_XHwpDocument', 'function OnDocument_Close(bClose) {\n}\n']) assert.ok(M.plainScript(ok), JSON.stringify(ok));
  for (const bad of [
    EVIL, HEAD + 'Document.Run("x");', 'function OnDocument_New() { x(); }', 'function f(){}()', 'var Documents = XHwpDocumentsX;',
    '/*@cc_on @if (1) new ActiveXObject("WScript.Shell").Run("calc") @end @*/', '//@cc_on\nfunction f(){}', // JScript 조건부 컴파일(주석 속 코드가 돎)
    '//주석\u2028Run()', '/* 닫히지 않은 주석', 'function f(){} "/*"; evil(); "*/"', 'function \\u0065(){}', '<!-- x\nfunction f(){}',
  ]) assert.ok(!M.plainScript(bad), JSON.stringify(bad));
});

test('한글: 빈 틀이면 한글로, 실제 스크립트 매크로가 있으면 한글을 건너뜀(HWP 5.0)', async () => {
  assert.deepEqual(M.hwpCheck(hwp5()), { ok: true }, '한글이 넣는 빈 틀(압축)');
  assert.deepEqual(M.hwpCheck(hwp5({ props: 0 })), { ok: true }, '압축하지 않은 파일');
  assert.deepEqual(M.hwpCheck(hwp5({ parts: [HEAD, STUB + 'function OnDocument_Open()\r\n{\r\n\t//todo : \r\n}\r\n', '', ''] })), { ok: true });
  assert.deepEqual(M.hwpCheck(readFileSync(join(FX, 'plan.hwp'))), { ok: true }, 'Scripts가 없는 파일');
  assert.deepEqual(M.hwpCheck(hwp5({ props: 1 | 4 })), { ok: true }, '배포용 문서(봉투를 풀어 봄)');
  for (const [what, o] of [
    ['본문 함수 속 코드', { parts: [HEAD, EVIL, '', ''] }], ['머리(전역 코드)', { parts: [HEAD + 'new ActiveXObject("WScript.Shell");', STUB, '', ''] }],
    ['앞 글', { parts: [HEAD, STUB, 'Run();', ''] }], ['뒤 글', { parts: [HEAD, STUB, '', 'Run();'] }],
    ['배포용 문서 속 매크로', { props: 1 | 4, parts: [HEAD, EVIL, '', ''] }], ['모르는 스크립트 스트림', { extra: [['Scripts/Other', new Uint8Array(4)]] }],
  ]) assert.equal(M.hwpCheck(hwp5(o)).why, 'script', what);
  for (const [what, b] of [
    ['암호 문서(스크립트를 못 읽음)', hwp5({ props: 1 | 2, raw: Buffer.from('암호로 싸인 바이트'.repeat(4)) })], ['스크립트 모양이 깨짐', hwp5({ raw: Buffer.concat([u32(9999), Buffer.from('ab')]) })],
    ['HWPML 같은 모르는 모양', new TextEncoder().encode('<?xml version="1.0"?><HWPML><SCRIPTCODE/></HWPML>')], ['HWP가 아닌 OLE(.doc 등)', writeCfb([['WordDocument', new Uint8Array(64)]])],
  ]) assert.equal(M.hwpCheck(b).why, 'unreadable', what);
  // 암호 문서에 Scripts 스트림이 없어도 열지 않음(한글이 암호를 묻는 창에서 4분 멈춤). 배포용(4)·DRM 표시만 있는 파일은 지금처럼 봄
  const noScripts = (props) => writeCfb([['FileHeader', fileHeader(props)], ['DocInfo', new Uint8Array(16)]]);
  assert.deepEqual(M.hwpCheck(noScripts(1)), { ok: true });
  assert.deepEqual(M.hwpCheck(noScripts(1 | 2)), { ok: false, why: 'unreadable', detail: 'password' }, '문서 암호');
  assert.deepEqual(M.hwpCheck(noScripts(1 | 0x100)), { ok: false, why: 'unreadable', detail: 'password' }, '공인 인증서 암호화');
  assert.deepEqual(M.hwpCheck(noScripts(1 | 4)), { ok: true }, '배포용 문서');
  assert.deepEqual(M.hwpCheck(new TextEncoder().encode('HWP Document File V3.00 \x1a\x01\x02\x03\x04\x05')), { ok: true }, 'HWP 3.0: 스크립트 자리가 없는 형식');

  // 실제 흐름: 매크로가 있으면 한글(PowerShell)을 부르지 않고 다음 프로그램, 그래도 못 바꾸면 까닭을 알림
  const calls = [];
  const runImpl = async (cmd, args) => { calls.push(cmd); return { code: 1, out: '' }; };
  const bad = await C.convertToPdf('교재.hwp', hwp5({ parts: [HEAD, EVIL, '', ''] }), { platform: 'win32', ids: ['hwp', 'libreoffice'], runImpl });
  assert.equal(bad.error, 'hwp-script'); assert.match(bad.message_ko, /스크립트 매크로/); assert.match(bad.message_ko, /PDF로 저장해/);
  assert.ok(!calls.includes('powershell.exe'), '한글을 열지 않음'); assert.deepEqual(bad.tried.map((t) => t.id), ['hwp', 'libreoffice']);
  const locked = await C.convertToPdf('교재.hwp', hwp5({ props: 3, raw: Buffer.alloc(40, 7) }), { platform: 'win32', ids: ['hwp'], runImpl });
  assert.equal(locked.error, 'hwp-unreadable');
  calls.length = 0;
  const good = await C.convertToPdf('교재.hwp', hwp5(), { platform: 'win32', ids: ['hwp'], runImpl: async (cmd, args, o) => { calls.push(cmd); writeFileSync(o.env.LP_OUT, '%PDF-1.4\n'); return { code: 0, out: '' }; } });
  assert.equal(good.via, 'hwp'); assert.deepEqual(calls, ['powershell.exe'], '빈 틀이면 그대로 한글로(가장 정확)');
});

test('한글: HWPX는 Scripts/ 글과 꾸러미 목록이 JavaScript로 적은 항목을 살핌', () => {
  assert.deepEqual(M.hwpCheck(readFileSync(join(FX, 'plan.hwpx'))), { ok: true });
  assert.deepEqual(M.hwpCheck(hwpx({ 'Scripts/headerScripts': u16(HEAD), 'Scripts/sourceScripts': u16(STUB) })), { ok: true }, '한글이 넣는 빈 틀(UTF-16LE)');
  assert.deepEqual(M.hwpCheck(hwpx({ 'Scripts/headerScripts': u16('\uFEFF' + HEAD), 'Scripts/sourceScripts': new TextEncoder().encode(STUB) })), { ok: true }, 'BOM·UTF-8');
  assert.equal(M.hwpCheck(hwpx({ 'Scripts/headerScripts': u16(HEAD), 'Scripts/sourceScripts': u16(EVIL) })).why, 'script');
  assert.equal(M.hwpCheck(hwpx({ 'Scripts/postScripts.js': new TextEncoder().encode('Run();') })).why, 'script', '한컴 OWPML 모델의 이름(.js)');
  const hpf = new TextDecoder().decode(PLAN_HWPX['Contents/content.hpf']).replace('</opf:manifest>', '<opf:item id="sourcesc" href="Contents/run.txt" media-type="application/x-javascript"/></opf:manifest>');
  assert.equal(M.hwpCheck(hwpx({ 'Contents/content.hpf': new TextEncoder().encode(hpf), 'Contents/run.txt': u16(EVIL) })).why, 'script', '목록이 스크립트라고 적은 다른 이름');
  assert.equal(M.hwpCheck(zipSync({ 'word/document.xml': new Uint8Array(1) })).why, 'unreadable', 'HWPX가 아닌 ZIP');
  // 암호를 건 HWPX(꾸러미 목록에 암호화 정보): 스크립트가 없어도 열지 않음 · 암호화 정보가 없는 목록은 그대로
  const manifest = (inner) => new TextEncoder().encode(`<?xml version="1.0" encoding="UTF-8"?><odf:manifest xmlns:odf="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"><odf:file-entry odf:full-path="Contents/section0.xml" odf:media-type="application/xml">${inner}</odf:file-entry></odf:manifest>`);
  assert.deepEqual(M.hwpCheck(hwpx({ 'META-INF/manifest.xml': manifest('<odf:encryption-data odf:checksum-type="SHA1"/>') })), { ok: false, why: 'unreadable', detail: 'password' });
  assert.deepEqual(M.hwpCheck(hwpx({ 'META-INF/manifest.xml': manifest('') })), { ok: true });
});

test('macOS Office: 매크로 없는 .pptx·.docx 꾸러미만(이름이 아니라 바이트로), 옛 형식은 Office로 열지 않음', async () => {
  const pptx = readFileSync(join(FX, 'workshop.pptx')); const docx = readFileSync(join(FX, 'guide.docx'));
  assert.deepEqual(M.macOfficeCheck(pptx), { ok: true }); assert.deepEqual(M.macOfficeCheck(docx), { ok: true });
  const P = unzipSync(pptx); const D = unzipSync(docx);
  const ct = (files, from, to) => ({ ...files, '[Content_Types].xml': new TextEncoder().encode(new TextDecoder().decode(files['[Content_Types].xml']).replace(from, to)) });
  const rels = (target, type = 'attachedTemplate') => ({ ...D, 'word/_rels/settings.xml.rels': new TextEncoder().encode(`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}" TargetMode="External"/></Relationships>`) });
  for (const [what, b] of [
    ['이름만 바꾼 .pptm(VBA 부분)', zipSync({ ...P, 'ppt/vbaProject.bin': new Uint8Array(8) })],
    ['매크로 형식 표시', zipSync(ct(P, 'presentationml.presentation.main+xml', 'ms-powerpoint.presentation.macroEnabled.main+xml'))],
    ['ActiveX', zipSync({ ...D, 'word/activeX/activeX1.xml': new Uint8Array(1) })],
    ['원격 서식 파일(https)', zipSync(rels('https://example.com/t.dotm'))], ['원격 서식 파일(UNC)', zipSync(rels('\\\\server\\share\\t.dotm'))],
    ['원격 서식 파일(퍼센트 인코딩 UNC)', zipSync(rels('%5C%5Cserver%5Cshare%5Ct.dotm'))], ['원격 하위 문서', zipSync(rels('http://example.com/s.docm', 'subDocument'))],
  ]) assert.equal(M.macOfficeCheck(b).why, 'macro', what);
  for (const [what, b] of [['옛 형식(.ppt·.doc: OLE)', writeCfb([['PowerPoint Document', new Uint8Array(64)]])], ['RTF', new TextEncoder().encode('{\\rtf1 x}')], ['ODF', zipSync({ mimetype: new TextEncoder().encode('application/vnd.oasis.opendocument.text') })]]) {
    assert.equal(M.macOfficeCheck(b).why, 'not-ooxml', what);
  }
  assert.deepEqual(M.macOfficeCheck(zipSync(rels('file:///C:\\Users\\t\\AppData\\Roaming\\Microsoft\\Templates\\Report.dotx'))), { ok: true }, '이 PC 경로의 서식 파일(흔함)은 그대로');

  // 실제 흐름: Office를 건너뛰고 Keynote·Pages로. Office만 있으면 까닭을 알림(앱은 브라우저 안 그리기·"pptx나 PDF로 저장" 안내로)
  const calls = [];
  const runImpl = async (cmd, args) => { calls.push(args[1]); if (/Keynote|Pages/.test(args[1])) writeFileSync(args[3], '%PDF-1.4\n'); return { code: 0, out: '' }; };
  const o = { platform: 'darwin', runImpl, home: '/nonexistent-home' };
  const renamed = await C.convertToPdf('교재.pptx', zipSync({ ...P, 'ppt/vbaProject.bin': new Uint8Array(8) }), { ...o, ids: ['powerpoint', 'keynote'] });
  assert.equal(renamed.via, 'keynote'); assert.ok(!calls.some((s) => /Microsoft PowerPoint/.test(s)), 'PowerPoint를 열지 않음');
  const legacy = await C.convertToPdf('교재.ppt', writeCfb([['PowerPoint Document', new Uint8Array(64)]]), { ...o, ids: ['powerpoint'] });
  assert.equal(legacy.error, 'mac-office'); assert.match(legacy.message_ko, /매크로를 끄고 열 수 없어서/);
  const disguised = await C.convertToPdf('교재.docx', writeCfb([['WordDocument', new Uint8Array(64)]]), { ...o, ids: ['word'] });
  assert.equal(disguised.error, 'mac-office', '.doc를 .docx로 이름만 바꾼 파일');
  calls.length = 0;
  const fine = await C.convertToPdf('교재.docx', docx, { ...o, ids: ['word', 'pages'], runImpl: async (cmd, args) => { calls.push(args[1]); writeFileSync(args[3], '%PDF-1.4\n'); return { code: 0, out: '' }; } });
  assert.equal(fine.via, 'word', '매크로 없는 .docx는 Word로(가장 정확)'); assert.match(calls[0], /Microsoft Word/);
  // Windows는 Office가 매크로를 끄고 열어서 살피지 않음
  assert.deepEqual(C.safeFor('powerpoint', writeCfb([['PowerPoint Document', new Uint8Array(8)]]), 'win32'), { ok: true });
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
