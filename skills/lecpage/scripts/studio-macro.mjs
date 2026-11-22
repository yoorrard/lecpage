// lecpage 커넥트: 교재를 이 PC의 프로그램에 넘기기 전에 파일 속 매크로를 바이트로 살핌(studio-convert.mjs가 부름).
// 매크로를 끄는 스위치가 없는 두 길만 해당해요. Windows Office(AutomationSecurity=3)·LibreOffice(매크로 끈 새 프로필)·Keynote·Pages는 살피지 않음.
//   - 한글(COM): 오토메이션에 매크로 보안을 끄는 설정이 없음(ScrMacroSecurity는 대화 상자, SetMessageBoxMode는 묻는 창의 답만 정하고
//     사용자가 보안을 '낮음'으로 두면 묻지 않고 돎) → 스크립트 매크로가 한글이 새 문서마다 넣는 빈 틀뿐일 때만 한글로 엶
//   - macOS PowerPoint·Word(AppleScript): 매크로를 끌 수 없음(VisualBasicMacroExecutionState는 앱을 다시 켜야 먹고 defaults로는 잘 안 먹음)
//     → 매크로가 없는 .pptx·.docx 꾸러미(OOXML)일 때만 엶. 확장자가 아니라 바이트로 봄(이름만 바꾼 .docm·.doc도 걸러짐)
// 모르는 모양·읽지 못한 파일은 '안전하지 않음'으로 봄(그 프로그램을 건너뛰고 다음 프로그램이나 앱의 그리기로).
import { inflateRawSync } from 'node:zlib';
import { createDecipheriv } from 'node:crypto';
import { Cfb } from '../engine/src/ingest/cfb.js';
import { Zip } from '../engine/src/ingest/zip.js';
import { parseXml, all, attr } from '../engine/src/ingest/xml.js';
import { decodeText } from '../engine/src/ingest/util.js';

const SCRIPT_MAX = 1024 * 1024; // 스크립트 하나(풀었을 때). 빈 틀은 300바이트 안팎
const startsWith = (b, sig) => b.length >= sig.length && sig.every((x, i) => b[i] === x);
const CFB_SIG = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
const ZIP_SIG = [0x50, 0x4B, 0x03, 0x04];
const latin1 = (b, n) => Buffer.from(b.subarray(0, n)).toString('latin1');

// ── 스크립트가 빈 틀뿐인지 ──────────────────────────────
// 한글이 새 문서에 넣는 틀(실제 한글 파일 15개에서 같음):
//   머리: var Documents = XHwpDocuments; var Document = Documents.Active_XHwpDocument;
//   본문: function OnDocument_New() { //todo : }  (OnDocument_Open이 함께 있기도)
// 주석을 걷어 낸 뒤 이 두 변수와 '몸통이 빈 함수'만 남으면 빈 틀. @가 든 주석은 JScript 조건부 컴파일(/*@cc_on … @*/)로 실행될 수 있어 코드로 봄.
const ID = '[A-Za-z_$][\\w$]*';
const STMT = new RegExp(`\\s*(?:var\\s+Documents\\s*=\\s*XHwpDocuments|var\\s+Document\\s*=\\s*Documents\\s*\\.\\s*Active_XHwpDocument|function\\s+${ID}\\s*\\(\\s*(?:${ID}\\s*(?:,\\s*${ID}\\s*)*)?\\)\\s*\\{\\s*\\})\\s*;?`, 'y');
const EOL = '\n\r\u2028\u2029'; // 줄 주석이 끝나는 자리를 넓게 잡을수록 엄격(뒤를 코드로 봄)
export function plainScript(text) {
  const s = String(text ?? '').replace(/^\uFEFF/, '');
  if (s.length > SCRIPT_MAX) return false;
  let code = '';
  for (let i = 0; i < s.length;) {
    if (s.startsWith('//', i)) {
      let j = i + 2; while (j < s.length && !EOL.includes(s[j])) j++;
      if (s.slice(i, j).includes('@')) return false;
      code += ' '; i = j;
    } else if (s.startsWith('/*', i)) {
      const j = s.indexOf('*/', i + 2);
      if (j < 0 || s.slice(i, j).includes('@')) return false;
      code += ' '; i = j + 2;
    } else code += s[i++];
  }
  let at = 0;
  for (;;) { STMT.lastIndex = at; const m = STMT.exec(code); if (!m || !m[0].length) break; at = STMT.lastIndex; }
  return /^\s*$/.test(code.slice(at));
}

// ── 한글 ─────────────────────────────────────────────
/**
 * 한글로 열어도 되는지 → { ok:true } | { ok:false, why:'script'|'unreadable', detail }
 *  - HWP 5.0(OLE 복합 문서): Scripts/DefaultJScript(머리·본문·앞·뒤 글 네 개, 압축이면 raw deflate, 배포용이면 AES로 싸임)가 빈 틀뿐이어야 함
 *  - HWPX(ZIP): Scripts/ 아래 글(headerScripts·sourceScripts 등)과 content.hpf가 JavaScript로 적은 항목이 빈 틀뿐이어야 함
 *  - HWP 3.0 이전(한글 97 등): 스크립트를 담는 자리가 없는 형식이라 그대로
 *  - 그 밖의 모양(HWPML 등)·망가진 파일·암호/DRM으로 스크립트를 못 읽음 → unreadable
 */
export function hwpCheck(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  try {
    if (startsWith(b, CFB_SIG)) return hwp5Check(b);
    if (startsWith(b, ZIP_SIG)) return hwpxCheck(b);
    if (/^HWP Document File V[1-3]/.test(latin1(b, 20))) return { ok: true };
  } catch (e) { return { ok: false, why: 'unreadable', detail: String(e?.message || e).slice(0, 120) }; }
  return { ok: false, why: 'unreadable', detail: 'unknown format' };
}

const DIST_HEAD = (28 | (256 << 20)) >>> 0; // HWPTAG_DISTRIBUTE_DOC_DATA(0x10+12), 수준 0, 256바이트
function hwp5Check(b) {
  const cfb = new Cfb(b);
  const fh = cfb.get('FileHeader');
  if (!fh || fh.length < 40 || latin1(fh, 17) !== 'HWP Document File') return { ok: false, why: 'unreadable', detail: 'not HWP 5' };
  const props = Buffer.from(fh).readUInt32LE(36);
  const compressed = !!(props & 1);
  const locked = !!(props & (0x2 | 0x10 | 0x100 | 0x400)); // 암호 · DRM · 공인 인증서 암호화 · 공인 인증서 DRM
  for (const [path, e] of cfb.paths) {
    if (e.type !== 2 || !/^scripts\//i.test(path)) continue;
    const name = path.slice(8).toLowerCase();
    if (name === 'jscriptversion') continue; // 판 번호 8바이트
    if (name !== 'defaultjscript') return { ok: false, why: 'script', detail: path };
    let raw = cfb.get(path);
    if (!raw?.length) continue;
    if (Buffer.from(raw.subarray(0, 4)).readUInt32LE(0) === DIST_HEAD && raw.length >= 260) raw = undistribute(raw);
    else if (locked) return { ok: false, why: 'unreadable', detail: 'locked' };
    if (compressed) raw = inflateRawSync(raw, { maxOutputLength: SCRIPT_MAX });
    const parts = scriptParts(raw);
    if (!parts) return { ok: false, why: 'unreadable', detail: 'script stream' };
    if (!parts.every(plainScript)) return { ok: false, why: 'script', detail: path };
  }
  return { ok: true };
}

/** DWORD 글자 수 + UTF-16LE 글 … 끝 표시(-1). 모양이 어긋나면 null */
function scriptParts(raw) {
  const d = Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength);
  const parts = []; let o = 0;
  const zeros = (from) => d.subarray(from).every((x) => x === 0);
  while (o + 4 <= d.length && parts.length < 8) {
    const n = d.readInt32LE(o); o += 4;
    if (n === -1) return zeros(o) ? parts : null;
    if (n < 0 || o + n * 2 > d.length) return null;
    parts.push(d.subarray(o, o + n * 2).toString('utf16le')); o += n * 2;
  }
  return parts.length < 8 && zeros(o) ? parts : null;
}

/** 배포용 문서의 봉투(HWP 5.0 4.2.13): 256바이트를 MSVC rand()로 풀어 AES-128 키를 얻고 뒤를 ECB로 풂(rhwp crypto.rs와 같은 셈) */
function undistribute(raw) {
  const head = Uint8Array.from(raw.subarray(4, 260));
  let seed = Buffer.from(head).readUInt32LE(0);
  const rand = () => { seed = (Math.imul(seed, 214013) + 2531011) >>> 0; return (seed >>> 16) & 0x7FFF; };
  let left = 0, key = 0;
  for (let i = 0; i < 256; i++) {
    if (left === 0) { key = rand() & 0xFF; left = (rand() & 0x0F) + 1; }
    if (i >= 4) head[i] ^= key;
    left--;
  }
  const off = 4 + (head[0] & 0x0F);
  const body = raw.subarray(260);
  const padded = new Uint8Array(Math.ceil(body.length / 16) * 16); padded.set(body);
  const dec = createDecipheriv('aes-128-ecb', head.subarray(off, off + 16), null); dec.setAutoPadding(false);
  return new Uint8Array(Buffer.concat([dec.update(padded), dec.final()]));
}

function hwpxCheck(b) {
  const zip = new Zip(b);
  const mime = zip.has('mimetype') ? String(zip.text('mimetype') || '').trim() : '';
  if (!/^application\/hwp/i.test(mime) && !zip.has('Contents/content.hpf')) return { ok: false, why: 'unreadable', detail: 'not HWPX' };
  const scripts = new Set(zip.names().filter((n) => /^scripts\//i.test(n) || /\.js$/i.test(n)));
  // 꾸러미 목록(content.hpf)이 JavaScript로 적은 항목은 이름이 달라도 스크립트로 봄(한컴 OWPML 모델: Scripts/headerScripts.js 등)
  for (const hpf of zip.names().filter((n) => /\.hpf$/i.test(n))) {
    if (zip.size(hpf) > SCRIPT_MAX) return { ok: false, why: 'unreadable', detail: hpf };
    for (const it of all(parseXml(zip.text(hpf) || ''), 'item')) {
      if (!/script/i.test(attr(it, 'media-type') || '')) continue;
      const href = String(attr(it, 'href') || '').replace(/^\/+/, '');
      for (const n of [href, hpf.replace(/[^/]*$/, '') + href]) if (zip.has(n)) scripts.add(n);
    }
  }
  for (const n of scripts) {
    if (zip.size(n) > SCRIPT_MAX) return { ok: false, why: 'script', detail: n };
    if (!plainScript(decodeText(zip.get(n) || new Uint8Array(0), { fallbackKorean: false }))) return { ok: false, why: 'script', detail: n };
  }
  return { ok: true };
}

// ── macOS PowerPoint·Word ───────────────────────────────
// 매크로·불러오는 코드: VBA 부분(vbaProject.bin·vbaData.xml), 매크로 형식 표시(macroEnabled), ActiveX, Office 추가 기능(webextensions),
// 밖에서 받아 오는 서식 파일·하위 문서(attachedTemplate·subDocument·frame이 http·UNC 같은 원격 주소를 가리킬 때: 그 서식 파일에 매크로가 있을 수 있음)
const ACTIVE_PART = /(^|\/)(vbaProject\.bin|vbaData\.xml)$|(^|\/)activeX\/|(^|\/)webextensions?\//i;
const PULL_REL = /\/(attachedTemplate|subDocument|frame)$/i;
const remoteTarget = (t) => {
  let s = String(t || '').replace(/[\u0000-\u0020]+/g, '');
  try { s = decodeURIComponent(s); } catch { /* 그대로 */ }
  s = s.replace(/\\/g, '/');
  if (s.startsWith('//')) return true; // UNC
  if (/^[a-z]:\//i.test(s) || /^file:\/\/\/(?!\/)/i.test(s)) return false; // 이 PC의 경로
  return /^[a-z][a-z0-9+.-]*:/i.test(s); // http·https·file://서버·mhtml 등
};
/** macOS PowerPoint·Word로 열어도 되는지 → { ok:true } | { ok:false, why:'not-ooxml'|'macro', detail } */
export function macOfficeCheck(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (!startsWith(b, ZIP_SIG)) return { ok: false, why: 'not-ooxml', detail: startsWith(b, CFB_SIG) ? 'legacy binary' : 'not zip' };
  try {
    const zip = new Zip(b);
    if (!zip.has('[Content_Types].xml') || zip.size('[Content_Types].xml') > SCRIPT_MAX) return { ok: false, why: 'not-ooxml', detail: 'no content types' };
    if (/macroEnabled|vbaProject|vbaData/i.test(zip.text('[Content_Types].xml') || '')) return { ok: false, why: 'macro', detail: 'content types' };
    const part = zip.names().find((n) => ACTIVE_PART.test(n));
    if (part) return { ok: false, why: 'macro', detail: part };
    const rels = zip.names().filter((x) => /\.rels$/i.test(x));
    if (rels.some((n) => zip.size(n) > SCRIPT_MAX)) return { ok: false, why: 'macro', detail: 'rels' };
    zip.preload((n) => /\.rels$/i.test(n)); // 한 번에 풀기
    for (const n of rels) {
      for (const r of all(parseXml(zip.text(n) || ''), 'Relationship')) {
        if (PULL_REL.test(attr(r, 'Type') || '') && /external/i.test(attr(r, 'TargetMode') || '') && remoteTarget(attr(r, 'Target'))) return { ok: false, why: 'macro', detail: n };
      }
    }
  } catch (e) { return { ok: false, why: 'not-ooxml', detail: String(e?.message || e).slice(0, 120) }; }
  return { ok: true };
}
