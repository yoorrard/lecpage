// 교재 해석 공통 도구: 글자 정리(NFC·공백), 오류 객체, 파일 형식 판별, 바이트 변환.
// 브라우저와 Node 모두에서 동작하는 순수 ESM입니다(외부 의존성 없음).

export const DEFAULT_LIMITS = Object.freeze({
  maxBytes: 100 * 1024 * 1024,        // 입력 파일 최대 100MB
  maxUncompressed: 600 * 1024 * 1024, // ZIP 안 파일들의 선언 크기 합계(압축 폭탄 방지)
  maxEntryBytes: 200 * 1024 * 1024,   // ZIP 안 파일 하나의 최대 크기
  maxEntries: 20000,                  // ZIP 안 파일 개수
  maxXmlBytes: 64 * 1024 * 1024,      // XML 하나의 최대 크기
  maxPages: 1000,                     // 읽을 최대 쪽(슬라이드) 수
});

// ── 오류 ─────────────────────────────────────────────
const MESSAGES = {
  'empty': () => '파일이 비어 있어요. 내용이 있는 파일을 다시 올려 주세요.',
  'too-large': (d) => `파일이 너무 커요(${d.mb}MB). ${d.limitMb}MB 이하로 줄이거나, 그림을 압축하거나, PDF로 저장해 올려 주세요.`,
  'legacy-hwp': () => '한글 97 이전에 만든 아주 예전 한글 파일이라 바로 읽을 수 없어요. 한글에서 [파일 → 다른 이름으로 저장하기]를 눌러 HWP·HWPX·PDF 가운데 하나로 저장한 뒤 올려 주세요.',
  'hwp-distribution': () => '배포용 문서로 저장된 한글 파일이라 내용을 읽을 수 없어요. 배포용으로 저장하기 전의 원본 파일이나 PDF로 저장한 파일을 올려 주세요.',
  'legacy-ppt': () => '예전 파워포인트 파일(.ppt)은 바로 읽을 수 없어요. 파워포인트에서 [다른 이름으로 저장]을 눌러 "PowerPoint 프레젠테이션(.pptx)" 또는 "PDF"로 저장한 뒤 올려 주세요.',
  'legacy-doc': () => '예전 워드 파일(.doc)은 바로 읽을 수 없어요. 워드에서 [다른 이름으로 저장]을 눌러 "Word 문서(.docx)" 또는 "PDF"로 저장한 뒤 올려 주세요.',
  'legacy-office': () => '예전 형식의 오피스 파일이라 바로 읽을 수 없어요. PPTX·DOCX·PDF 가운데 하나로 다시 저장해 올려 주세요.',
  'encrypted': () => '암호가 걸린 파일이에요. 원본 프로그램에서 암호를 해제하고 다시 저장한 뒤 올려 주세요.',
  'drm': () => '문서 보안(DRM)이 걸린 파일 같아요. 학교 문서보안 프로그램에서 보안을 해제하거나, PDF로 인쇄(저장)한 뒤 올려 주세요.',
  'corrupt': () => '파일을 열 수 없어요. 파일이 손상되었거나 다른 형식일 수 있어요. 원본 프로그램에서 다시 저장해 올려 주세요.',
  'zip-bomb': () => '압축을 풀면 지나치게 커지는 파일이라 안전을 위해 읽지 않았어요. 그림을 줄이거나 PDF로 저장해 올려 주세요.',
  'unsupported': (d) => `이 형식${d.ext ? `(.${d.ext})` : ''}은 아직 읽을 수 없어요. PPTX·PDF·HWP·HWPX·DOCX·TXT 가운데 하나로 저장해 올려 주세요.`,
  'keynote': () => '키노트 파일은 바로 읽을 수 없어요. 키노트에서 [파일 → 내보내기 → PowerPoint 또는 PDF]로 저장해 올려 주세요.',
  'odf': () => 'ODF(오픈오피스·리브레오피스) 파일은 바로 읽을 수 없어요. [다른 이름으로 저장]에서 PPTX·DOCX 또는 PDF로 저장해 올려 주세요.',
  'spreadsheet': () => '엑셀·스프레드시트 파일은 교재로 읽지 않아요. 필요한 표는 PDF로 저장하거나 교재 안에 넣어 올려 주세요.',
  'needs-pdfjs': (d) => d.node
    ? 'PDF를 읽는 도구(pdf.js)가 없어요. `npm i pdfjs-dist`로 설치하거나, 파이썬 보조 스크립트(scripts/ingest.py)를 써 주세요.'
    : 'PDF를 읽는 도구(pdf.js)를 불러오지 못했어요. 인터넷 연결을 확인하고 새로 고침한 뒤 다시 올려 주세요. 계속 안 되면 PPTX로 올려 주세요.',
  'pdf-encrypted': () => '암호가 걸린 PDF예요. 암호를 해제한 PDF로 다시 저장해 올려 주세요.',
  'pdf-failed': () => 'PDF를 읽다가 문제가 생겼어요. 다른 프로그램에서 PDF로 다시 저장하거나 원본(PPTX·HWP·HWPX)을 올려 주세요.',
  'no-text': () => '글자를 읽을 수 없는 PDF예요(스캔본이나 그림으로 된 PDF). 쪽 그림은 쓸 수 있지만, 내용은 직접 적어 주시거나 원본 파일을 올려 주세요.',
  'parse-failed': () => '파일 내용을 읽다가 문제가 생겼어요. 원본 프로그램에서 다시 저장해 올려 주세요. 계속 안 되면 PDF로 올려 주세요.',
  'too-many-pages': (d) => `쪽 수가 많아(${d.pages}쪽) 앞의 ${d.limit}쪽만 읽었어요.`,
  'hidden-slides': (d) => `숨긴 슬라이드 ${d.count}장은 내용 분석에서 뺐어요.`,
  'link-only': () => '링크만으로는 내용을 읽을 수 없어요. 파일로 내려받아(예: 구글 슬라이드 → 파일 → 다운로드 → PPTX) 올려 주시면 더 정확해요.',
  'link-fetch-failed': () => '링크의 내용을 가져오지 못했어요. 공개 범위를 "링크가 있는 모든 사용자"로 바꾸거나, 파일로 내려받아 올려 주세요.',
  'bad-url': () => '올바른 주소(https://…)가 아니에요.',
  'no-content': () => '읽을 수 있는 글이 거의 없어요. 그림 위주의 교재라면 연수 정보를 직접 적어 주세요.',
  'images-unsupported': (d) => `웹에서 바로 보이지 않는 그림 형식(${d.exts})이 있어 일부 그림은 빠질 수 있어요.`,
  'unknown': () => '알 수 없는 문제로 파일을 읽지 못했어요. 다른 형식(PDF·PPTX)으로 다시 올려 주세요.',
};

/** 사용자에게 보여 줄 오류 객체 {code, message_ko, file?, detail?} */
export function makeError(code, data = {}, file) {
  const fn = MESSAGES[code] || MESSAGES.unknown;
  const e = { code: MESSAGES[code] ? code : 'unknown', message_ko: fn(data) };
  if (file) e.file = file;
  if (data.detail) e.detail = String(data.detail).slice(0, 300);
  if (data.fallback) e.fallback = data.fallback;
  return e;
}

/** 내부에서 던지는 오류(밖으로 새지 않음). ingestFile이 잡아 makeError로 바꿉니다. */
export class IngestError extends Error {
  constructor(code, data = {}) { super(code); this.code = code; this.data = data; }
}

export function toUserError(err, file) {
  if (err instanceof IngestError) return makeError(err.code, err.data, file);
  return makeError('parse-failed', { detail: err && (err.message || String(err)) }, file);
}

// ── 글자 정리 ───────────────────────────────────────
const ZW = /[\u200B-\u200D\u2060\uFEFF\u00AD]/g;
const CTRL = /[\u0000-\u0008\u000E-\u001F\u007F]/g;
const SPACES = /[\t\u00A0  -   \u3000]/g;
const PUA = /[-]/g; // 한글(HWP)·워드 기호 글꼴의 사용자 정의 영역 글자(화면에서 깨짐)

/** 여러 줄 글 정리: NFC, 보이지 않는 글자 제거, 공백 접기, 줄바꿈은 의미 있게 유지(빈 줄 최대 1개) */
export function normText(s) {
  if (s === undefined || s === null) return '';
  let t = String(s);
  try { t = t.normalize('NFC'); } catch { /* 잘못된 서로게이트 */ }
  t = t.replace(/\r\n?/g, '\n').replace(/[\u000B\u000C\u2028\u2029]/g, '\n');
  t = t.replace(ZW, '').replace(CTRL, '').replace(PUA, '').replace(SPACES, ' ');
  t = t.replace(/ {2,}/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n');
  return t.trim();
}

/** 한 줄 글 정리: normText + 줄바꿈을 공백으로 */
export function normLine(s) {
  return normText(s).replace(/\s*\n+\s*/g, ' ').trim();
}

/** 비교용 키: 공백·문장부호·따옴표를 빼고 소문자 */
export function textKey(s) {
  return normLine(s).toLowerCase().replace(/[\s"'“”‘’「」『』`.,!?~·:;()[\]{}<>\-–—…]/g, '');
}

export function truncate(s, max) {
  const t = String(s || '');
  return t.length > max ? t.slice(0, Math.max(0, max - 1)) + '…' : t;
}

// ── 바이트 ───────────────────────────────────────────
/** ArrayBuffer·TypedArray·Buffer·Blob(File) → Uint8Array */
export async function toBytes(input) {
  if (!input) return new Uint8Array(0);
  if (input instanceof Uint8Array) return input.constructor === Uint8Array ? input : new Uint8Array(input.buffer, input.byteOffset, input.byteLength); // Node Buffer → 일반 Uint8Array
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  if (typeof input.arrayBuffer === 'function') return new Uint8Array(await input.arrayBuffer());
  if (typeof input === 'string') return new TextEncoder().encode(input);
  return new Uint8Array(0);
}

/** 바이트 → 문자열. BOM을 보고 UTF-8/UTF-16을 고르고, UTF-8이 아니면 EUC-KR(CP949)로 다시 시도 */
export function decodeText(bytes, { fallbackKorean = true } = {}) {
  if (!bytes || !bytes.length) return '';
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if (bytes[0] === 0xFE && bytes[1] === 0xFF) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  // BOM 없는 UTF-16LE(윈도우 메모장·한글 미리보기 글): 홀수 자리에 0이 많거나 한글 상위 바이트(0xAC~0xD7)가 많음
  if (bytes.length >= 4 && bytes.length % 2 === 0) {
    let zeroOdd = 0, hangulOdd = 0;
    const n = Math.min(bytes.length, 2048);
    for (let i = 1; i < n; i += 2) { if (bytes[i] === 0) zeroOdd++; else if (bytes[i] >= 0xAC && bytes[i] <= 0xD7) hangulOdd++; }
    if ((zeroOdd + hangulOdd) / (n / 2) > 0.6 && zeroOdd > 0) return new TextDecoder('utf-16le').decode(bytes);
  }
  const start = (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) ? 3 : 0;
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(start)); } catch { /* 아래 */ }
  if (fallbackKorean) {
    try { return new TextDecoder('euc-kr').decode(bytes); } catch { /* 지원 안 함 */ }
  }
  return new TextDecoder('utf-8').decode(bytes.subarray(start));
}

export function extOf(name) {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(String(name || '').trim());
  return m ? m[1].toLowerCase() : '';
}

export function baseName(p) {
  return String(p || '').split(/[\\/]/).pop();
}

export function stripExt(name) {
  return baseName(name).replace(/\.[A-Za-z0-9]{1,8}$/, '');
}

const MIME = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp',
  svg: 'image/svg+xml', tif: 'image/tiff', tiff: 'image/tiff', emf: 'image/x-emf', wmf: 'image/x-wmf', ico: 'image/x-icon',
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav',
};
export function mimeOf(name) { return MIME[extOf(name)] || 'application/octet-stream'; }
export const WEB_IMAGE = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp']);

function startsWith(bytes, arr, offset = 0) {
  if (bytes.length < offset + arr.length) return false;
  for (let i = 0; i < arr.length; i++) if (bytes[offset + i] !== arr[i]) return false;
  return true;
}
function asciiHead(bytes, n = 1024) {
  let s = '';
  const len = Math.min(n, bytes.length);
  for (let i = 0; i < len; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

export const isZip = (b) => startsWith(b, [0x50, 0x4B, 0x03, 0x04]) || startsWith(b, [0x50, 0x4B, 0x05, 0x06]);
export const isCfb = (b) => startsWith(b, [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
export const isPdf = (b) => asciiHead(b, 1024).includes('%PDF-');

/**
 * 파일 종류 판별(확장자보다 내용의 앞부분을 먼저 봅니다).
 * 돌려줌: 'zip' | 'pdf' | 'cfb' | 'hwp3' | 'drm' | 'text' | 'unknown'
 */
export function sniff(bytes) {
  if (isZip(bytes)) return 'zip';
  if (isPdf(bytes)) return 'pdf';
  if (isCfb(bytes)) return 'cfb';
  const head = asciiHead(bytes, 512);
  if (head.startsWith('HWP Document File')) return 'hwp3';
  if (/SCDSA00|<## ?FASOO|FASOO DRM|DRMONE|MarkAny|DSDRM/i.test(head)) return 'drm';
  // 텍스트: 앞부분에 NUL이 없고 제어문자가 적으면
  const len = Math.min(bytes.length, 4096);
  let ctrl = 0;
  for (let i = 0; i < len; i++) {
    const c = bytes[i];
    if (c === 0) { ctrl += 10; continue; }
    if (c < 9 || (c > 13 && c < 32)) ctrl++;
  }
  if (len && ctrl / len < 0.01) return 'text';
  return 'unknown';
}

// ── URL ─────────────────────────────────────────────
const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<>"'“”‘’()\[\]{}|\\^`]+[^\s<>"'“”‘’()\[\]{}|\\^`.,;:!?。、])/gi;
const BARE_DOMAIN_RE = /(?<![@\w.\/-])((?:[a-z0-9-]+\.)+(?:com|net|org|io|ai|app|co\.kr|or\.kr|go\.kr|ac\.kr|re\.kr|kr|me|ly|la|gl|us|edu|dev|so|site|page)(?:\/[^\s<>"'“”‘’()\[\]{}|\\^`]*[^\s<>"'“”‘’()\[\]{}|\\^`.,;:!?])?)(?![\w@-])/gi;

/** 글 속 URL 찾기: https://… , www.… , gemini.google.com 처럼 프로토콜 없는 주소도 */
export function findUrls(text, { bare = true } = {}) {
  const out = [];
  const t = String(text || '');
  const seen = new Set();
  let m;
  URL_RE.lastIndex = 0;
  const spans = [];
  while ((m = URL_RE.exec(t))) {
    let u = m[1];
    if (/^www\./i.test(u)) u = 'https://' + u;
    spans.push([m.index, m.index + m[1].length]);
    if (!seen.has(u)) { seen.add(u); out.push({ url: u, index: m.index, raw: m[1] }); }
  }
  if (bare) {
    BARE_DOMAIN_RE.lastIndex = 0;
    while ((m = BARE_DOMAIN_RE.exec(t))) {
      const at = m.index;
      if (spans.some(([a, b]) => at >= a && at < b)) continue;
      const raw = m[1];
      if (/^\d+(\.\d+)+$/.test(raw)) continue; // 1.2.3 같은 번호
      if (/\.(png|jpe?g|gif|pptx?|docx?|hwpx?|pdf|xlsx?|zip|mp4|mp3)$/i.test(raw)) continue; // 파일 이름
      const u = 'https://' + raw;
      if (!seen.has(u)) { seen.add(u); out.push({ url: u, index: at, raw }); }
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

/** 비교용 URL 키: 프로토콜·www·끝 슬래시·추적 매개변수 제거 */
export function urlKey(u) {
  try {
    const x = new URL(u);
    for (const k of [...x.searchParams.keys()]) if (/^(utm_|fbclid|gclid|si$|feature$)/i.test(k)) x.searchParams.delete(k);
    const q = x.searchParams.toString();
    return (x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/+$/, '') + (q ? '?' + q : '') + x.hash).toLowerCase();
  } catch { return String(u || '').toLowerCase(); }
}

export function hostOf(u) {
  try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
}

/** http(s)·mailto만 허용. 그 밖에는 '' */
export function cleanUrl(u) {
  const s = normLine(u).replace(/\\:/g, ':');
  if (!s) return '';
  if (/^mailto:/i.test(s)) return s;
  let v = s;
  if (/^www\./i.test(v)) v = 'https://' + v;
  try {
    const x = new URL(v);
    if (x.protocol === 'http:' || x.protocol === 'https:') return x.href;
  } catch { /* 아래 */ }
  return '';
}

export const isNode = typeof process !== 'undefined' && !!(process.versions && process.versions.node) && typeof window === 'undefined';

/** 경로 결합: a/b/../c → a/c */
export function joinPath(dir, rel) {
  if (!rel) return dir;
  if (rel.startsWith('/')) return rel.slice(1);
  const parts = (dir ? dir.split('/') : []).concat(rel.split('/'));
  const out = [];
  for (const p of parts) {
    if (!p || p === '.') continue;
    if (p === '..') out.pop(); else out.push(p);
  }
  return out.join('/');
}
export function dirOf(path) {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i);
}

/** 반복되는 글(바닥글·머리글) 찾기: 전체 쪽의 절반 이상(최소 3쪽)에 나오는 짧은 줄 */
export function findBoilerplate(pages) {
  if (pages.length < 4) return new Set();
  const count = new Map();
  for (const p of pages) {
    const seen = new Set();
    for (const para of p.paragraphs || []) {
      // 머리글·바닥글 후보: 짧고, 번호·글머리표·본문 자리가 아닌 줄(같은 실습 단계가 반복돼도 지우지 않음)
      if (para.num || para.bullet || para.role === 'body' || para.role === 'heading' || para.text.length > 60) continue;
      if (/^(\d{1,2}\s*[.)]|[①-⑳]|step\s*\d|프롬프트)/i.test(para.text) || /(줘|주세요|하세요|합니다)[.!]?$/.test(para.text)) continue;
      const k = textKey(para.text);
      if (!k || k.length > 80 || seen.has(k)) continue;
      seen.add(k);
      count.set(k, (count.get(k) || 0) + 1);
    }
  }
  const min = Math.max(3, Math.ceil(pages.length * 0.5));
  const out = new Set();
  for (const [k, n] of count) if (n >= min) out.add(k);
  return out;
}

/** 쪽 글 합치기(제목 + 문단 + 표) */
export function pageText(p) {
  const lines = [];
  if (p.title) lines.push(p.title);
  for (const para of p.paragraphs || []) if (para.text) lines.push(para.text);
  for (const t of p.tables || []) for (const r of t.rows || []) {
    const row = r.filter(Boolean).join(' | ');
    if (row) lines.push(row);
  }
  return lines.join('\n');
}

/**
 * 쪽 그림을 어느 쪽에 붙일지. LibreOffice·PDF 내보내기는 숨긴 쪽을 그리지 않으므로,
 * 그림 수가 보이는 쪽 수와 같으면(또는 짝 PDF가 숨긴 쪽을 뺐으면) 숨긴 쪽을 건너뛰고 차례대로 맞춤.
 * 그렇지 않으면 모든 쪽에 차례대로(숨긴 쪽도 그려진 경우).
 */
export function pagesForImages(pages, count, skipsHidden = false) {
  const visible = pages.filter((p) => !p.hidden);
  return skipsHidden || (count !== pages.length && count === visible.length) ? visible : pages;
}

export function sizeLabel(n) {
  if (!n && n !== 0) return '';
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)}KB`;
  return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)}MB`;
}
