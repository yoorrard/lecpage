// 암호 보호: 만든 사이트의 페이지와 교재 그림·원본 자료를 암호로 잠급니다.
// 방식은 StatiCrypt(MIT)와 같습니다: PBKDF2-SHA256(60만 회)으로 암호에서 열쇠를 만들고 AES-GCM으로 암호화.
// 서버 없이 동작하며, 암호를 모르면 내용(교재 그림 포함)을 볼 수 없습니다. 브라우저·Node 모두 WebCrypto를 씁니다.
import { esc } from './render/html.js';

export const PROTECT_ITERATIONS = 600000;
/** 잠그는 페이지(접속 진단·개인정보 안내는 누구나 볼 수 있게 둠) */
export const PROTECTED_PAGES = ['index.html', 'console.html', 'screen.html', 'poster.html'];
const ENC_FILE = /^(?:assets\/)?(?:slides|media)\/[^"'?#]+$/;
const te = new TextEncoder();

function toBytes(v) { return typeof v === 'string' ? te.encode(v) : v instanceof Uint8Array ? v : new Uint8Array(v); }
function b64(u8) {
  if (typeof Buffer !== 'undefined') return Buffer.from(u8).toString('base64');
  let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}

function lockPage({ title, page, payload }) {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<title>${esc(title)} · 암호가 필요해요</title>
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="assets/theme.css">
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--background,#fff);color:var(--foreground,#111);font-family:var(--font-sans,system-ui,sans-serif);padding:20px;word-break:keep-all}
.lk{box-sizing:border-box;width:min(420px,100%);display:grid;gap:14px;padding:28px;border-radius:var(--radius,16px);background:var(--card,#fff);border:var(--border-w,1px) solid var(--border,#ddd)}
.lk h1{margin:0;font-size:1.35rem;line-height:1.35}
.lk p{margin:0;color:var(--muted-foreground,#555);line-height:1.6}
.lk label{display:grid;gap:6px;font-weight:600}
.lk input[type=password]{font:inherit;padding:12px;border-radius:var(--radius-sm,10px);border:var(--border-w,1px) solid var(--border,#bbb);background:var(--background,#fff);color:inherit}
.lk .rm{display:flex;gap:8px;align-items:center;font-weight:400}
.lk button{font:inherit;font-weight:700;min-height:48px;border:0;border-radius:var(--radius-sm,10px);background:var(--primary,#333);color:var(--primary-foreground,#fff);cursor:pointer}
.lk button:focus-visible,.lk input:focus-visible{outline:3px solid var(--ring,#5b49b0);outline-offset:2px}
.lk [role=alert]{min-height:1.4em;color:var(--danger,#b42318);font-weight:600}
</style>
</head>
<body>
<main class="lk">
<form data-lp-lock>
  <h1>${esc(title)}</h1>
  <p>연수에서 안내받은 암호를 넣어 주세요. 안내 QR로 들어오면 저절로 열려요.</p>
  <label>암호<input type="password" name="pw" autocomplete="current-password" required></label>
  <label class="rm"><input type="checkbox" name="remember"> 이 기기에서 기억하기(공용 컴퓨터에서는 끄세요)</label>
  <button type="submit">열기</button>
  <p role="alert" data-lp-lock-msg></p>
</form>
<noscript><p>이 페이지는 자바스크립트를 켜야 열 수 있어요.</p></noscript>
</main>
<script type="application/json" id="lp-locked">${JSON.stringify(payload).replace(/</g, '\\u003c')}</script>
<script src="assets/unlock.js"></script>
</body>
</html>
`;
}

/**
 * 빌드 결과(files)를 암호로 잠근 새 files를 돌려줍니다.
 * @param {Object<string,string|Uint8Array>} files build().files
 * @param {string} password 4자 이상
 * @param {{ runtime:{read(p)}, title?:string, crypto?:Crypto, iterations?:number }} opts
 */
export async function protectSite(files, password, opts = {}) {
  const pw = String(password || '');
  if ([...pw].length < 4) throw new Error('암호는 4자 이상이어야 해요.');
  const crypto = opts.crypto || globalThis.crypto;
  if (!crypto?.subtle) throw new Error('이 환경에서는 암호화(WebCrypto)를 쓸 수 없어요.');
  const runtime = opts.runtime;
  const unlockJs = runtime && typeof runtime.read === 'function' ? runtime.read('unlock.js') : '';
  if (!unlockJs) throw new Error('unlock.js를 찾지 못했어요.');
  const iterations = opts.iterations || PROTECT_ITERATIONS;
  const subtle = crypto.subtle;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const base = await subtle.importKey('raw', te.encode(pw.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  const key = await subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  async function enc(bytes) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes));
    const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12); return out;
  }

  const out = {};
  const encrypted = new Set();
  for (const [p, data] of Object.entries(files)) {
    if (ENC_FILE.test(p) && !/\.(css|js)$/i.test(p)) { out[p + '.enc'] = await enc(toBytes(data)); encrypted.add(p); }
    else out[p] = data;
  }
  const meta = { v: 1, salt: b64(salt), iter: iterations };
  for (const page of PROTECTED_PAGES) {
    if (typeof files[page] !== 'string') continue;
    let html = files[page];
    // 잠근 파일을 가리키는 주소는 풀린 뒤 unlock.js가 채움
    html = html.replace(/\s(src|href)="([^"]+)"/g, (m, attr, p) => (encrypted.has(p)
      ? (attr === 'src' ? ` data-lp-enc-src="${p}.enc" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="` : ` data-lp-enc-href="${p}.enc" href="#"`)
      : m));
    // 풀린 페이지 안의 QR·공유 주소가 '#k=암호'를 붙여 바로 열리게(풀린 사람만 보는 곳이라 안전)
    const unlockMeta = `<meta name="lp-unlock" content="k=${encodeURIComponent(pw)}">`;
    html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + unlockMeta) : unlockMeta + html;
    const tag = `<script src="assets/unlock.js" data-lp-assets="${meta.salt}"></script>`;
    html = html.includes('</body>') ? html.replace('</body>', tag + '\n</body>') : html + tag;
    const blob = await enc(te.encode(html));
    out[page] = lockPage({ title: opts.title || '연수 사이트', page, payload: { ...meta, data: b64(blob) } });
  }
  out['assets/unlock.js'] = unlockJs;
  out['robots.txt'] = 'User-agent: *\nDisallow: /\n';
  return out;
}

/** QR·링크에 붙이면 저절로 열리는 주소(#k=암호). 암호를 아는 사람에게만 나눠 주세요. */
export function unlockUrl(url, password) {
  const u = String(url || '').split('#')[0];
  return `${u}#k=${encodeURIComponent(String(password || ''))}`;
}
