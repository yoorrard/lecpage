// lecpage 커넥트: 이 PC에 깔린 프로그램으로 교재를 PDF로 바꿈. 앱이 그 PDF로 쪽 그림을 그리고 AI에게 원본처럼 건넴(글자·그림·디자인을 그대로 읽게).
//   GET  /bridge/convert              → { ok, platform, apps:[{ id, name }], exts:{ pptx:['powerpoint','libreoffice'], … } }
//   POST /bridge/convert?name=<파일 이름>  본문: 파일 바이트 → { ok, via, app, pdf: base64 } | { ok:false, error:'no-app'|'convert-failed'|…, message_ko }
// 순서(그 형식을 만든 프로그램이 가장 정확): Windows PowerPoint·Word·한글(COM) / macOS PowerPoint·Keynote·Word·Pages(AppleScript) / LibreOffice(모든 OS)
// 프로그램이 없으면 그렇다고 알림(앱은 브라우저 안 그리기나 글자만으로 넘어감). 한 번에 하나씩 바꿈(같은 프로그램을 두 번 열지 않게)
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, statSync, mkdirSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sofficePath } from './render-slides.mjs';

const MB = 1024 * 1024;
export const CONVERT_LIMIT_MB = 100;
const TIMEOUT_MS = 4 * 60000;

/**
 * 프로그램마다 여는 형식. 매크로를 담는 형식(pptm·ppsm·potm·docm·dotm 등)은 받지 않음(앱은 그 파일을 글자로만 읽음).
 * 다른 형식도 매크로가 돌지 않게 엶: Office는 AutomationSecurity=3(모두 끔)·읽기 전용, LibreOffice는 매크로 끈 새 프로필
 */
export const APPS = {
  powerpoint: { name: 'PowerPoint', exts: ['pptx', 'ppt', 'ppsx', 'pps', 'potx', 'odp'] },
  keynote: { name: 'Keynote', exts: ['key', 'pptx', 'ppt', 'ppsx'] },
  word: { name: 'Word', exts: ['docx', 'doc', 'odt', 'rtf'] },
  pages: { name: 'Pages', exts: ['docx', 'doc'] },
  hwp: { name: '한글', exts: ['hwp', 'hwpx', 'hwt'] },
  libreoffice: { name: 'LibreOffice', exts: ['pptx', 'ppt', 'ppsx', 'pps', 'potx', 'odp', 'key', 'docx', 'doc', 'odt', 'rtf', 'hwp'] },
};
/** 매크로를 담는 Office 형식(바꾸지 않음) */
export const MACRO_EXTS = ['pptm', 'ppsm', 'potm', 'ppam', 'docm', 'dotm', 'xlsm', 'xltm', 'xlam'];
const MACRO_KO = '매크로가 든 파일(.pptm·.docm 등)은 안전을 위해 이 PC의 프로그램으로 열지 않아요. 그 프로그램에서 PDF나 .pptx·.docx로 저장해 올려 주세요.';
/** 운영 체제별 시도 순서 */
export const ORDER = {
  win32: ['powerpoint', 'word', 'hwp', 'libreoffice'],
  darwin: ['powerpoint', 'keynote', 'word', 'pages', 'libreoffice'],
  linux: ['libreoffice'],
};
const MAC_APP = { powerpoint: 'Microsoft PowerPoint', keynote: 'Keynote', word: 'Microsoft Word', pages: 'Pages' };
const WIN_PROGID = { powerpoint: 'PowerPoint.Application', word: 'Word.Application', hwp: 'HWPFrame.HwpObject' };

/** 이 PC에서 쓸 수 있는 프로그램 id 목록(1분 동안 기억) */
let cache = null;
export function detectApps({ platform = process.platform, env = process.env, home = homedir(), exists = existsSync, run = spawnSync, soffice = sofficePath, fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cache.at < 60000) return cache.ids;
  const ids = [];
  for (const id of ORDER[platform] || ORDER.linux) {
    if (id === 'libreoffice') { if (soffice()) ids.push(id); continue; }
    if (platform === 'win32') {
      const r = run('reg', ['query', `HKCR\\${WIN_PROGID[id]}\\CLSID`], { timeout: 10000, windowsHide: true });
      if (!r.error && r.status === 0) ids.push(id);
    } else if (platform === 'darwin') {
      const app = MAC_APP[id] + '.app';
      if (exists(join('/Applications', app)) || exists(join(home, 'Applications', app))) ids.push(id);
    }
  }
  cache = { at: Date.now(), ids };
  return ids;
}

/**
 * 확장자 → 시도할 프로그램(있는 것만, 순서대로).
 * macOS의 Office는 AppleScript로 열 때 매크로를 끌 수 없어서(Windows는 AutomationSecurity로 끔), 매크로를 담을 수 있는 옛 형식(.ppt·.pps·.doc)은
 * 매크로가 없는 Keynote·Pages·LibreOffice(매크로 끈 새 프로필)를 먼저 쓰고 Office는 마지막에
 */
const LEGACY_EXTS = ['ppt', 'pps', 'doc'];
export function appsFor(ext, ids, platform = process.platform) {
  const e = String(ext).toLowerCase();
  const list = ids.filter((id) => APPS[id]?.exts.includes(e));
  if (platform !== 'darwin' || !LEGACY_EXTS.includes(e)) return list;
  const office = (id) => id === 'powerpoint' || id === 'word';
  return [...list.filter((id) => !office(id)), ...list.filter(office)];
}

function run(cmd, args, { timeoutMs = TIMEOUT_MS, env } = {}) {
  return new Promise((ok) => {
    let out = ''; let done = false;
    const p = spawn(cmd, args, { windowsHide: true, env: { ...process.env, ...(env || {}) } });
    p.stdout?.on('data', (d) => { out += d; }); p.stderr?.on('data', (d) => { out += d; });
    const kill = setTimeout(() => { if (!done) { try { p.kill(); } catch { /* 이미 끝남 */ } out += '\n시간 초과'; } }, timeoutMs);
    const end = (code) => { if (done) return; done = true; clearTimeout(kill); ok({ code, out: out.slice(-2000) }); };
    p.on('error', (e) => { out += String(e.message); end(-1); });
    p.on('close', end);
  });
}

// 경로는 환경 변수로 넘김(따옴표·한글 이름이 명령 글에 섞이지 않게). 사람이 열어 둔 다른 문서는 닫지 않음(우리가 연 것만 닫고, 남은 문서가 없을 때만 끝냄)
// 매크로: 프로그램으로 연 Office는 AutomationSecurity가 기본 '낮음'(매크로가 그냥 돎)이라 열기 전에 3(msoAutomationSecurityForceDisable, 모두 끔)으로.
// Word는 자동 매크로(AutoOpen 등)도 끔(DisableAutoMacros). 읽기 전용으로 열고, 끝나면 예전 값으로 되돌림(켜 둔 PowerPoint를 함께 쓸 수 있어서)
export const PS = {
  powerpoint: `$ErrorActionPreference='Stop'
$app = New-Object -ComObject PowerPoint.Application
$sec = $app.AutomationSecurity
$app.AutomationSecurity = 3
try {
  $p = $app.Presentations.Open($env:LP_IN, -1, 0, 0)
  try { $p.SaveAs($env:LP_OUT, 32) } finally { $p.Close() }
} finally { try { $app.AutomationSecurity = $sec } catch {} }
if ($app.Presentations.Count -eq 0) { $app.Quit() }`,
  word: `$ErrorActionPreference='Stop'
$w = New-Object -ComObject Word.Application
$w.DisplayAlerts = 0
$sec = $w.AutomationSecurity
$w.AutomationSecurity = 3
try { [void]$w.WordBasic.GetType().InvokeMember('DisableAutoMacros', [Reflection.BindingFlags]::InvokeMethod, $null, $w.WordBasic, @(1)) } catch {}
try {
  $d = $w.Documents.Open($env:LP_IN, $false, $true, $false)
  try { $d.ExportAsFixedFormat($env:LP_OUT, 17) } finally { $d.Close(0) }
} finally { try { $w.AutomationSecurity = $sec } catch {} }
if ($w.Documents.Count -eq 0) { $w.Quit() }`,
  // 한글: 보안 모듈(FilePathCheckerModule)이 등록돼 있지 않으면 한글이 '파일에 접근하려는 시도' 창을 띄움 → 사람이 [모두 허용]을 누르면 이어짐
  hwp: `$ErrorActionPreference='Stop'
$h = New-Object -ComObject HWPFrame.HwpObject
try { $h.RegisterModule('FilePathCheckDLL', 'FilePathCheckerModule') | Out-Null } catch {}
try { $h.XHwpWindows.Item(0).Visible = $false } catch {}
try {
  if (-not $h.Open($env:LP_IN, '', 'forceopen:true')) { throw 'open failed' }
  if (-not $h.SaveAs($env:LP_OUT, 'PDF', '')) { throw 'save failed' }
} finally { try { $h.Clear(1) } catch {}; $h.Quit() }`,
};
// macOS: 앱이 꺼져 있었으면 다 바꾼 뒤 끔. PowerPoint·Word는 샌드박스라 그 앱의 컨테이너 폴더 안에서 열고 씀(파일 접근 창이 뜨지 않게)
export const OSA = {
  keynote: `on run argv
set wasOn to application "Keynote" is running
tell application "Keynote"
set d to open (POSIX file (item 1 of argv))
export d to (POSIX file (item 2 of argv)) as PDF
close d saving no
if not wasOn then quit
end tell
end run`,
  pages: `on run argv
set wasOn to application "Pages" is running
tell application "Pages"
set d to open (POSIX file (item 1 of argv))
export d to (POSIX file (item 2 of argv)) as PDF
close d saving no
if not wasOn then quit
end tell
end run`,
  powerpoint: `on run argv
set wasOn to application "Microsoft PowerPoint" is running
tell application "Microsoft PowerPoint"
open (POSIX file (item 1 of argv))
set p to active presentation
save p in ((POSIX file (item 2 of argv)) as string) as save as PDF
close p saving no
if not wasOn and (count of presentations) is 0 then quit
end tell
end run`,
  word: `on run argv
set wasOn to application "Microsoft Word" is running
tell application "Microsoft Word"
open (POSIX file (item 1 of argv))
set d to active document
save as d file name ((POSIX file (item 2 of argv)) as string) file format format PDF
close d saving no
if not wasOn and (count of documents) is 0 then quit
end tell
end run`,
};
const MAC_CONTAINER = { powerpoint: 'com.microsoft.Powerpoint', word: 'com.microsoft.Word' };
/**
 * LibreOffice: 바꿀 때마다 새 프로필(-env:UserInstallation)에 이 설정을 먼저 둠 → 매크로 보안 '매우 높음'(3) + 매크로 실행 끔.
 * (머리 없는 변환은 새 프로필의 기본값도 서명 없는 매크로를 막지만, 문서 속 매크로·이벤트 스크립트가 돌지 않게 못 박아 둠)
 */
export const LO_REGISTRY = `<?xml version="1.0" encoding="UTF-8"?>
<oor:items xmlns:oor="http://openoffice.org/2001/registry" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item>
<item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="DisableMacrosExecution" oor:op="fuse"><value>true</value></prop></item>
</oor:items>
`;

/** 일할 폴더: macOS Office는 그 앱 컨테이너 안(없으면 보통 임시 폴더) */
function workDir(id, platform, home) {
  const c = platform === 'darwin' && MAC_CONTAINER[id] ? join(home, 'Library', 'Containers', MAC_CONTAINER[id], 'Data', 'tmp') : '';
  if (c) { try { mkdirSync(c, { recursive: true }); return mkdtempSync(join(c, 'lecpage-')); } catch { /* 보통 임시 폴더로 */ } }
  return mkdtempSync(join(tmpdir(), 'lecpage-convert-'));
}

/** 한 프로그램으로 바꾸기 → { ok, pdf?: Buffer, detail } */
export async function convertWith(id, name, bytes, { platform = process.platform, home = homedir(), runImpl = run } = {}) {
  const ext = (extname(name).slice(1) || 'bin').toLowerCase();
  const dir = workDir(id, platform, home);
  try {
    const src = join(dir, `input.${ext}`); const out = join(dir, 'output.pdf');
    writeFileSync(src, bytes);
    let r;
    if (id === 'libreoffice') {
      const prof = join(dir, 'profile');
      mkdirSync(join(prof, 'user'), { recursive: true });
      writeFileSync(join(prof, 'user', 'registrymodifications.xcu'), LO_REGISTRY);
      r = await runImpl(sofficePath(), [`-env:UserInstallation=${pathToFileURL(prof).href}`, '--headless', '--norestore', '--nolockcheck', '--convert-to', 'pdf', '--outdir', dir, src]);
      const lo = join(dir, 'input.pdf'); if (existsSync(lo)) writeFileSync(out, readFileSync(lo));
    } else if (platform === 'win32') r = await runImpl('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(PS[id], 'utf16le').toString('base64')], { env: { LP_IN: src, LP_OUT: out } });
    else if (platform === 'darwin') r = await runImpl('osascript', ['-e', OSA[id], src, out]);
    else return { ok: false, detail: 'unsupported' };
    const ok = existsSync(out) && statSync(out).size > 0 && readFileSync(out).subarray(0, 5).toString('latin1') === '%PDF-';
    return ok ? { ok: true, pdf: readFileSync(out), detail: '' } : { ok: false, detail: String(r?.out || '').trim().split('\n').slice(-3).join(' ').slice(0, 300) || `code ${r?.code}` };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

/** 있는 프로그램을 순서대로 시도 → { ok, via, app, pdf } | { ok:false, error, message_ko, tried } */
export async function convertToPdf(name, bytes, { platform = process.platform, ids, log = () => {}, ...o } = {}) {
  const ext = (extname(name).slice(1) || '').toLowerCase();
  if (MACRO_EXTS.includes(ext)) return { ok: false, error: 'macro', message_ko: MACRO_KO, tried: [] };
  const list = appsFor(ext, ids || detectApps({ platform }), platform);
  if (!list.length) return { ok: false, error: 'no-app', message_ko: noAppKo(ext, platform), tried: [] };
  const tried = [];
  for (const id of list) {
    const t0 = Date.now();
    const r = await convertWith(id, name, bytes, { platform, ...o }).catch((e) => ({ ok: false, detail: String(e?.message || e) }));
    tried.push({ id, ok: r.ok, ms: Date.now() - t0, ...(r.ok ? {} : { detail: r.detail }) });
    if (r.ok) { log(`교재를 PDF로 바꿨어요: ${APPS[id].name}(${((Date.now() - t0) / 1000).toFixed(1)}초)`); return { ok: true, via: id, app: APPS[id].name, pdf: r.pdf, tried }; }
    log(`${APPS[id].name}로 PDF를 만들지 못했어요: ${r.detail || ''}`.slice(0, 300));
  }
  return { ok: false, error: 'convert-failed', message_ko: `이 PC의 ${list.map((id) => APPS[id].name).join('·')}로 PDF를 만들지 못했어요. 그 프로그램에서 직접 PDF로 저장해 올려 주세요.`, tried };
}

/** 바꿀 프로그램이 없을 때 한 줄 */
export function noAppKo(ext, platform = process.platform) {
  const office = /^pp|^pot|^odp|^key/.test(ext) ? (platform === 'darwin' ? 'PowerPoint·Keynote' : 'PowerPoint') : /^hw/.test(ext) ? '한글' : platform === 'darwin' ? 'Word·Pages' : 'Word';
  return `이 PC에서 PDF로 바꿀 프로그램(${office}·LibreOffice)을 찾지 못했어요.`;
}

// 한 번에 하나씩
let chain = Promise.resolve();
const queue = (fn) => { const p = chain.then(fn, fn); chain = p.catch(() => { }); return p; };

/** studio.mjs의 /bridge/convert 경로. h: { readBody, sendJson, fail } */
export async function handleConvert(S, req, res, url, h) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    const ids = detectApps({ fresh: url.searchParams.has('fresh') });
    const exts = {};
    for (const id of ids) for (const e of APPS[id].exts) (exts[e] ||= []).push(id);
    return h.sendJson(res, 200, { ok: true, platform: process.platform, apps: ids.map((id) => ({ id, name: APPS[id].name })), exts, limitMB: CONVERT_LIMIT_MB });
  }
  if (req.method !== 'POST') return h.fail(res, 405, 'method', '이 주소에서 받지 않는 요청이에요.');
  const name = String(url.searchParams.get('name') || '').split(/[\\/]/).pop().slice(0, 200);
  const ext = (extname(name).slice(1) || '').toLowerCase();
  if (MACRO_EXTS.includes(ext)) return h.fail(res, 400, 'macro', MACRO_KO);
  if (!ext || !Object.values(APPS).some((a) => a.exts.includes(ext))) return h.fail(res, 400, 'type', 'PDF로 바꿀 수 있는 형식(PPT·워드·한글·키노트)이 아니에요.');
  let bytes;
  try { bytes = await h.readBody(req, CONVERT_LIMIT_MB * MB); } catch (e) { return e.status === 413 ? h.fail(res, 413, 'too-large', `파일이 너무 커요(${CONVERT_LIMIT_MB}MB까지).`) : h.fail(res, 400, 'body', '파일을 받지 못했어요.'); }
  if (!bytes.length) return h.fail(res, 400, 'empty', '빈 파일이에요.');
  const r = await queue(() => convertToPdf(name, bytes, { log: (t) => S.log?.(t) }));
  if (!r.ok) return h.fail(res, 422, r.error, r.message_ko, { tried: r.tried.map(({ id, ok }) => ({ id, ok })) });
  return h.sendJson(res, 200, { ok: true, via: r.via, app: r.app, pdf: r.pdf.toString('base64') });
}
