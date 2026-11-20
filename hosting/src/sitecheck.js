// 올릴 때 거절하는 내용(422 unsafe_site). 단순하고 잘못 걸리는 일이 적은 규칙만 둡니다. 오류의 message_ko는 앱이 그대로 보여 줍니다.
//  HTML  비밀번호 칸(input type=password) · 비밀번호를 받는 칸(이름·안내 글이 '비밀번호'뿐인 칸) · 로그인 화면 흉내(아이디 칸 + '로그인' 단추)
//        · 다른 사이트로 보내는 양식(form action·formaction이 바깥 주소) · 입력 글자 가림(-webkit-text-security)
//        · 보조 쪽(강사 화면 등)에 사이트가 직접 쓴 스크립트
//  사이트가 직접 쓴 스크립트(.js, 엔진 런타임이 아닌 것)  서비스 워커 등록 · 비밀번호 칸 만들기 · 글자 가림 · 크기(1MB)·UTF-8
//  CSS   글자 가림
// 엔진이 만드는 비밀번호 칸 둘(강사 화면의 관리자 키, 암호 잠금 화면)은 모양이 정확히 같고 그 쪽에 사이트 스크립트가 없을 때만 받습니다.
// CSP로 막을 수 없는 것(주소 이동으로 빼내기 등)은 이 검사로도 다 막지 못하므로 신고·가리기로 대응합니다(README §6).
import { HttpError } from './http.js';
import { isLocalSrc, isDataScript, resolveIn } from './rewrite.js';
import { AUX_PAGES } from './csp.js';
import { MAX_JS_BYTES } from './runtime.js';

/** 사이트가 직접 쓴 스크립트 파일 하나의 한도(엔진 런타임 묶음과 같음) */
export const OWN_JS_MAX = MAX_JS_BYTES;

const where = (path) => String(path).replace(/[\u0000-\u001f\u007f]/g, '?').slice(0, 120);
const MESSAGES = {
  password: (p) => `비밀번호 입력 칸이 있어요(${p}). 바로 배포 사이트에서는 비밀번호를 입력받을 수 없어요. 그 칸을 지운 뒤 다시 배포해 주세요.`,
  password_label: (p) => `비밀번호를 받는 칸으로 보여요(${p}). 바로 배포 사이트에서는 비밀번호를 입력받을 수 없어요. 칸을 지우거나 칸 이름·안내 글에서 '비밀번호'를 빼 주세요.`,
  login: (p) => `로그인 화면처럼 보여요(${p}: 아이디 칸과 '로그인' 단추). 바로 배포에서는 로그인 화면을 올릴 수 없어요. 참가자 이름이 필요하면 lecpage의 출석·참여하기 기능을 써 주세요.`,
  form: (p, d) => `입력한 내용을 다른 사이트로 보내는 양식이 있어요(${p}${d ? `, ${d}` : ''}). 바로 배포 사이트는 입력한 내용을 바깥으로 보낼 수 없어요. form의 action을 지워 주세요.`,
  masked: (p) => `입력한 글자를 가리는 칸(-webkit-text-security)이 있어요(${p}). 비밀번호 칸처럼 보이는 칸은 바로 배포에 올릴 수 없어요.`,
  service_worker: (p) => `서비스 워커를 등록하는 코드가 있어요(${p}). 바로 배포 사이트에서는 서비스 워커를 쓸 수 없어요. navigator.serviceWorker.register 부분을 지워 주세요.`,
  aux_script: (p, d) => `강사 화면·발표 화면·QR 안내문·접속 확인·개인정보 안내 쪽(${p})에는 사이트가 직접 쓴 스크립트(${d})를 넣을 수 없어요. 이 쪽은 lecpage가 만든 그대로 두어 주세요.`,
};
/** @param {keyof typeof MESSAGES} rule */
export function unsafe(rule, path, detail = '') {
  return new HttpError('unsafe_site', MESSAGES[rule](where(path), detail ? where(detail) : ''), { rule, path: where(path) });
}

// ── HTML 읽기 ───────────────────────────────────────────────────
// 브라우저처럼 시작 태그와 속성을 읽음: 이름은 소문자, 같은 속성은 처음 것, 빗금(/)은 칸 나눔, 따옴표 안의 '>'는 값의 일부,
// 값의 문자 참조(&#112; &amp; …)는 풂. 주석은 건너뛰고, 안쪽을 태그로 읽지 않는 요소(script·style·textarea 등)는 글로 둠.
const RAW_TEXT = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes']);
const isSpace = (c) => c === 32 || c === 9 || c === 10 || c === 12 || c === 13;
const isAlpha = (c) => (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', tab: '\t', newline: '\n', colon: ':', sol: '/', equals: '=', period: '.', lowbar: '_', hyphen: '-', dash: '-' };
export function decodeEntities(s) {
  if (s.indexOf('&') < 0) return s;
  return s.replace(/&(#[xX][0-9a-fA-F]{1,8}|#[0-9]{1,9}|[a-zA-Z]{2,10});?/g, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '�';
    }
    return Object.hasOwn(NAMED, e.toLowerCase()) ? NAMED[e.toLowerCase()] : m;
  });
}

/**
 * @param {string} html
 * @returns {{ tags: Array<{ name: string, attrs: Map<string,string>, start: number, end: number, text?: string }>, styles: string[] }}
 *   text: script 안쪽 글(자료 블록 읽기용), styles: <style> 안쪽 글
 */
export function scanHtml(html, depth = 0) {
  const tags = []; const styles = [];
  const n = html.length; let i = 0;
  while (i < n) {
    const lt = html.indexOf('<', i);
    if (lt < 0 || lt + 1 >= n) break;
    if (html.startsWith('<!--', lt)) { const e = html.indexOf('-->', lt + 4); i = e < 0 ? n : e + 3; continue; }
    const c = html.charCodeAt(lt + 1);
    if (c === 33 || c === 63 || c === 47) { const e = html.indexOf('>', lt + 2); i = e < 0 ? n : e + 1; continue; } // <! <? </
    if (!isAlpha(c)) { i = lt + 1; continue; }
    let j = lt + 1;
    while (j < n && !isSpace(html.charCodeAt(j)) && html[j] !== '/' && html[j] !== '>') j++;
    const name = html.slice(lt + 1, j).toLowerCase();
    const attrs = new Map();
    for (;;) {
      while (j < n && (isSpace(html.charCodeAt(j)) || html[j] === '/')) j++;
      if (j >= n || html[j] === '>') break;
      let k = j + 1; // 첫 글자는 '='여도 이름의 일부(브라우저와 같음)
      while (k < n && !isSpace(html.charCodeAt(k)) && html[k] !== '/' && html[k] !== '>' && html[k] !== '=') k++;
      const an = html.slice(j, k).toLowerCase();
      j = k;
      while (j < n && isSpace(html.charCodeAt(j))) j++;
      let val = '';
      if (html[j] === '=') {
        j++;
        while (j < n && isSpace(html.charCodeAt(j))) j++;
        const q = html[j];
        if (q === '"' || q === "'") { const e = html.indexOf(q, j + 1); val = html.slice(j + 1, e < 0 ? n : e); j = e < 0 ? n : e + 1; }
        else { let e = j; while (e < n && !isSpace(html.charCodeAt(e)) && html[e] !== '>') e++; val = html.slice(j, e); j = e; }
      }
      if (!attrs.has(an)) attrs.set(an, decodeEntities(val));
    }
    const end = Math.min(j + 1, n);
    const tag = { name, attrs, start: lt, end };
    tags.push(tag);
    i = end;
    if (RAW_TEXT.has(name)) {
      const re = new RegExp(`</${name}[\\s/>]`, 'ig'); re.lastIndex = i;
      const m = re.exec(html); const close = m ? m.index : n;
      const body = html.slice(i, close);
      if (name === 'style') styles.push(body);
      if (name === 'script') tag.text = body;
      i = close;
    }
    // iframe srcdoc: 같은 CSP로 그려지는 HTML이라 같이 읽음(한 겹만)
    if (name === 'iframe' && attrs.has('srcdoc') && depth < 1) {
      const inner = scanHtml(attrs.get('srcdoc'), depth + 1);
      tags.push(...inner.tags.map((t) => ({ ...t, start: lt, end, srcdoc: true }))); styles.push(...inner.styles);
    }
    if (name === 'plaintext') break;
  }
  return { tags, styles };
}

/** 사이트 자료 블록(<script type="application/json" id="lp-data">)의 JSON. 없거나 깨졌으면 null */
export function pageData(html) {
  for (const t of scanHtml(html).tags) {
    if (t.name === 'script' && t.attrs.get('id') === 'lp-data' && isDataScript(t.attrs.get('type'))) {
      try { const d = JSON.parse(t.text || ''); return d && typeof d === 'object' ? d : null; } catch { return null; }
    }
  }
  return null;
}

// ── 규칙 ────────────────────────────────────────────────────────
const norm = (v) => String(v ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
/** 칸 이름·안내 글이 그 낱말뿐인지: 끝의 '입력'·'을 입력하세요'·'(필수)'·문장 부호, 앞의 'enter your' 같은 말을 떼고 봄 */
const TAIL = /\s*(?:\([^)]*\)|\[[^\]]*\]|[:：.*!?]|입력(?:하세요|해 ?주세요|해주십시오)?|확인|재입력|다시 입력|(?:을|를) ?입력(?:하세요|해 ?주세요|해주십시오)?|here)\s*$/;
const HEAD = /^\s*(?:enter|please enter|type|your|enter your|please enter your|input)\s+/;
function labelIs(v, word) {
  let s = norm(v);
  for (let k = 0; k < 6 && s; k++) {
    if (word.test(s)) return true;
    const t = s.replace(TAIL, '').replace(HEAD, '');
    if (t === s) return false;
    s = t;
  }
  return word.test(s);
}
const PW_WORD = /^(?:비밀 ?번호|비번|패스워드|password|passwd|pass word|passcode|pw|pwd)$/;
const PW_NAME = /passw(?:or)?d|^(?:pw|pwd|userpw|user_?pw|login_?pw)$/i;
const ACCOUNT_WORD = /^(?:아이디|id|사용자 ?(?:이름|아이디)|user ?name|username|user ?id|login ?id|계정|account|이메일(?: 주소)?|e-?mail(?: address)?|(?:아이디|이메일) 또는 (?:이메일|전화 ?번호|휴대(?:폰|전화) ?번호|아이디)|(?:휴대(?:폰|전화) ?번호|전화 ?번호) 또는 이메일|email or phone(?: number)?|phone or email)$/;
const ACCOUNT_NAME = /^(?:id|user_?id|userid|user_?name|username|login_?id|loginid|uid|login|account)$/i;
const LOGIN_WORD = /^(?:로그인|로그인 ?하기|log ?-?in|login|sign ?-?in|signin)$/;
/** 글을 받는 칸(단추·고르기·숨김 칸이 아닌 input) */
const TEXT_INPUT = new Set(['', 'text', 'email', 'tel', 'search', 'url', 'number', 'password']);
const MASK_CSS = /-webkit-text-security\s*:\s*(?!none\b)[a-z]/i;

const attr = (t, k) => t.attrs.get(k) ?? '';
const fieldLabels = (t) => ['placeholder', 'aria-label', 'title'].map((k) => attr(t, k)).filter(Boolean);
const autocompleteHas = (t, re) => norm(attr(t, 'autocomplete')).split(' ').some((x) => re.test(x));
function isPasswordish(t) {
  if (t.name === 'input' && norm(attr(t, 'type')) === 'password') return 'password';
  if (t.name !== 'input' && t.name !== 'textarea') return '';
  if (t.name === 'input' && !TEXT_INPUT.has(norm(attr(t, 'type')))) return '';
  if (fieldLabels(t).some((v) => labelIs(v, PW_WORD)) || PW_NAME.test(attr(t, 'name')) || PW_NAME.test(attr(t, 'id')) || autocompleteHas(t, /^(?:current|new)-password$/)) return 'password_label';
  return '';
}
const isAccountField = (t) => t.name === 'input' && TEXT_INPUT.has(norm(attr(t, 'type'))) && norm(attr(t, 'type')) !== 'password'
  && (fieldLabels(t).some((v) => labelIs(v, ACCOUNT_WORD)) || ACCOUNT_NAME.test(attr(t, 'name')) || ACCOUNT_NAME.test(attr(t, 'id')) || autocompleteHas(t, /^username$/));
/** 단추 글: 태그·아이콘 화살표를 떼고 */
const strip = (s) => norm(decodeEntities(String(s ?? '').replace(/<[^>]*>/g, ' ')).replace(/[→›>»▶\s]+$/u, '').replace(/^[←‹<«\s]+/u, ''));
/** '로그인' 단추: <input type=submit|button|image value=로그인> 또는 글이 '로그인'뿐인 <button> */
function isLoginControl(t, html) {
  if (t.name === 'input') return /^(?:submit|button|image)$/.test(norm(attr(t, 'type'))) && [attr(t, 'value'), attr(t, 'alt'), attr(t, 'aria-label')].some((v) => LOGIN_WORD.test(strip(v)));
  if (t.name !== 'button') return false;
  if (LOGIN_WORD.test(strip(attr(t, 'aria-label')))) return true;
  if (t.srcdoc) return false;
  const near = html.slice(t.end, t.end + 400); const close = near.search(/<\/button/i);
  return LOGIN_WORD.test(strip(close < 0 ? near : near.slice(0, close)));
}
/** 바깥 주소인지(스킴·//·역빗금으로 시작). 빈 값·#·상대 경로는 이 사이트 안 */
const isExternalUrl = (v) => { const s = String(v ?? '').replace(/[\u0000- \u007f]/g, ''); return /^[a-z][a-z0-9+.-]*:/i.test(s) || /^[\\/]{2}/.test(s); };

/**
 * 엔진이 만드는 비밀번호 칸(모양이 정확히 같을 때만): 강사 화면 console.html의 관리자 키, 암호 잠금 화면(engine protect.js)의 암호 칸
 * @param {string} path @param {{ attrs: Map }} t @param {{ lock: boolean }} page
 */
function engineSecretField(path, t, page) {
  if (path === 'console.html' && attr(t, 'id') === 'lp-key' && attr(t, 'name') === 'key') return true;
  return page.lock && attr(t, 'name') === 'pw';
}

/**
 * HTML 하나 검사. 문제가 있으면 HttpError(unsafe_site)를 던짐
 * @param {string} html
 * @param {string} path 사이트 안 경로
 * @param {{ isOwnScript?: (sitePath: string) => boolean }} [o] isOwnScript: 이 사이트 안 경로의 .js가 사이트가 직접 쓴 것인지(엔진 런타임이 아니면 true)
 */
export function checkHtml(html, path, { isOwnScript = () => false } = {}) {
  const { tags, styles } = scanHtml(html);
  const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
  // 이 쪽이 부르는 사이트 스크립트 가운데 엔진 런타임이 아닌 것
  const own = [];
  for (const t of tags) {
    if (t.name !== 'script' || !t.attrs.has('src') || isDataScript(t.attrs.get('type'))) continue;
    const src = attr(t, 'src');
    if (!isLocalSrc(src)) continue; // 바깥 주소는 내보낼 때 빼거나(rewrite.js) 고정 라이브러리
    const p = resolveIn(dir, src.trim().replace(/[?#].*$/, ''));
    if (p && isOwnScript(p)) own.push(src.trim());
  }
  if (AUX_PAGES.has(path) && own.length) throw unsafe('aux_script', path, own[0]);
  const page = { lock: tags.some((t) => t.name === 'form' && t.attrs.has('data-lp-lock')) && tags.some((t) => t.name === 'script' && attr(t, 'id') === 'lp-locked') };
  let account = false; let login = false;
  for (const t of tags) {
    const pw = isPasswordish(t);
    if (pw && !(engineSecretField(path, t, page) && !own.length)) throw unsafe(pw, path);
    if (t.name === 'form' && isExternalUrl(attr(t, 'action'))) throw unsafe('form', path, `action=${attr(t, 'action').trim().slice(0, 60)}`);
    if (t.attrs.has('formaction') && isExternalUrl(attr(t, 'formaction'))) throw unsafe('form', path, `formaction=${attr(t, 'formaction').trim().slice(0, 60)}`);
    if (MASK_CSS.test(attr(t, 'style'))) throw unsafe('masked', path);
    if (!account && isAccountField(t)) account = true;
    if (!login && isLoginControl(t, html)) login = true;
  }
  if (account && login) throw unsafe('login', path);
  if (styles.some((s) => MASK_CSS.test(s))) throw unsafe('masked', path);
}

/** CSS 하나 검사 */
export function checkCss(css, path) {
  if (MASK_CSS.test(css)) throw unsafe('masked', path);
}

// 사이트가 직접 쓴 스크립트. 서비스 워커는 CSP(worker-src 'none')가 막지만, 고칠 곳을 바로 알려 주려고 올릴 때 거절
const SW_RE = /serviceWorker['"`\]\s]*(?:\?\.|\.|\[\s*['"`])\s*register\b/;
const PW_JS = [/\.type\s*=\s*['"`]\s*password\s*['"`]/i, /setAttribute\s*\(\s*['"`]type['"`]\s*,\s*['"`]\s*password\s*['"`]/i, /<input\b[^<>]{0,300}?\btype\s*=\s*\\?["'`]?\s*password\b/i];
const MASK_JS = /-webkit-text-security\s*:\s*(?!none\b)[a-z]|webkitTextSecurity|WebkitTextSecurity/;
const utf8 = new TextDecoder('utf-8', { fatal: true });

/**
 * 사이트가 직접 쓴 스크립트(엔진 런타임이 아닌 .js) 검사. 통과하면 글자로 푼 내용을 돌려줌
 * @param {Uint8Array} bytes @param {string} path
 */
export function checkOwnScript(bytes, path) {
  if (bytes.byteLength > OWN_JS_MAX) throw new HttpError('too_large', `스크립트 파일 하나는 ${Math.round(OWN_JS_MAX / 1024 / 1024)}MB까지예요: ${where(path)}`, { path: where(path) });
  let text;
  try { text = utf8.decode(bytes); } catch { throw new HttpError('bad_request', `스크립트 파일을 UTF-8 글자로 읽지 못했어요: ${where(path)}. UTF-8로 저장해 다시 배포해 주세요.`, { path: where(path) }); }
  if (SW_RE.test(text)) throw unsafe('service_worker', path);
  if (PW_JS.some((re) => re.test(text))) throw unsafe('password', path);
  if (MASK_JS.test(text)) throw unsafe('masked', path);
  return text;
}
