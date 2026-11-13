// 암호 보호: 만든 사이트의 페이지와 교재 그림·원본 자료를 암호로 잠급니다.
// 방식은 StatiCrypt(MIT)와 같습니다: PBKDF2-SHA256(60만 회)으로 암호에서 열쇠를 만들고 AES-GCM으로 암호화.
// 서버 없이 동작하며, 암호를 모르면 내용(교재 그림 포함)을 볼 수 없습니다. 브라우저·Node 모두 WebCrypto를 씁니다.
import { esc } from './render/html.js';

export const PROTECT_ITERATIONS = 600000;
/** 잠그는 페이지(접속 진단·개인정보 안내는 누구나 볼 수 있게 둠) */
export const PROTECTED_PAGES = ['index.html', 'console.html', 'screen.html', 'poster.html'];

/**
 * ③ 잠그지 않는 쪽(접속 확인·개인정보 안내)의 사이트 정보에서 참여 기능 서버 주소·연수 코드·Supabase 키를 뺌.
 * 그 셋이 있으면 암호를 모르는 사람도 질문·투표를 읽고 쓸 수 있음. 접속 확인은 서버가 닿는지만 봄:
 * http(Cloudflare·자체 서버·바로 배포) = 서버의 /api/health(연수 코드 없는 주소), Supabase = 프로젝트의 health 주소,
 * 구글 시트 = script.google.com(배포 주소는 남기지 않음)
 */
export function publicSiteData(d) {
  if (!d || !d.live) return d;
  const { provider, url } = d.live;
  let health = '';
  try {
    const u = new URL(url);
    if (provider === 'http') health = String(url).replace(/\/+$/, '').replace(/\/api$/, '') + '/api/health';
    else if (provider === 'supabase') health = u.origin + '/auth/v1/health';
    else if (provider === 'sheets') health = 'https://script.google.com/';
  } catch { /* 주소 없음(리허설) */ }
  return { ...d, key: '', live: { provider, features: d.live.features, health } };
}
const LP_DATA = /(<script type="application\/json" id="lp-data">)([\s\S]*?)(<\/script>)/;
const ENC_FILE = /^(?:assets\/)?(?:slides|media)\/[^"'?#]+$/;
const te = new TextEncoder();

function toBytes(v) { return typeof v === 'string' ? te.encode(v) : v instanceof Uint8Array ? v : new Uint8Array(v); }
function b64(u8) {
  if (typeof Buffer !== 'undefined') return Buffer.from(u8).toString('base64');
  let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}

function lockPage({ title, page, payload, csp = '' }) {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
${csp}
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
    else if (/\.html$/i.test(p) && !PROTECTED_PAGES.includes(p) && typeof data === 'string' && LP_DATA.test(data)) {
      out[p] = data.replace(LP_DATA, (m, a, json, b) => { let d; try { d = JSON.parse(json); } catch { return m; } return a + JSON.stringify(publicSiteData(d)).replace(/</g, '\\u003c') + b; });
    } else out[p] = data;
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
    // 잠금 화면도 원래 쪽과 같은 보안 정책(CSP): 풀린 글이 같은 문서에 쓰이므로 정책이 이어짐
    const csp = (/<meta http-equiv="Content-Security-Policy"[^>]*>/i.exec(files[page]) || [''])[0];
    out[page] = lockPage({ title: opts.title || '연수 사이트', page, payload: { ...meta, data: b64(blob) }, csp });
  }
  out['assets/unlock.js'] = unlockJs;
  out['robots.txt'] = 'User-agent: *\nDisallow: /\n';
  return out;
}

/**
 * 사이트 암호가 얼마나 버티는지 어림합니다. 잠근 파일은 누구나 내려받아 집에서 암호를 맞춰 볼 수 있어서
 * (PBKDF2 60만 회라도 그래픽 카드 한 장이 초당 1만 번 넘게 시도) 짧은 숫자·흔한 말은 금방 풀립니다.
 * → { level: 'weak'|'fair'|'good', message } (message는 화면에 그대로 씀)
 */
const COMMON_PW = ['1234', '12345', '123456', '1234567', '12345678', '123456789', '0000', '1111', 'password', 'qwerty', 'abcd1234', 'lecpage', '연수', '연수1234', '암호', '비밀번호', '선생님', '학교'];
export function passwordAdvice(password) {
  const s = String(password || '').normalize('NFC').trim(), n = [...s].length, low = s.toLowerCase();
  const kinds = [/[0-9]/, /[a-z]/, /[A-Z]/, /[가-힣]/, /[^0-9a-zA-Z가-힣]/].filter((re) => re.test(s)).length;
  if (!n) return { level: 'weak', message: '암호를 정해 주세요.' };
  if (n < 6 || new Set(s).size <= 2 || COMMON_PW.includes(low) || (/^\d+$/.test(s) && n < 10) || /^(.)\1+$|^(?:0123|1234|2345|abcd|qwer)/i.test(s)) {
    return { level: 'weak', message: '쉽게 풀리는 암호예요. 잠근 파일은 누구나 내려받아 맞춰 볼 수 있으니, [새로 만들기]로 바꾸거나 10자 이상으로 길게 해 주세요.' };
  }
  if (n < 10 || kinds < 2) return { level: 'fair', message: '조금 더 길게(10자 이상, 글자와 숫자를 섞어) 하면 더 안전해요. 참가자는 QR로 들어와 따로 칠 일이 드물어요.' };
  return { level: 'good', message: '' };
}
/** 사람이 읽고 칠 수 있는 암호: 낱말 셋 + 숫자 넷(64낱말 → 약 24억 가지). 생성기가 공개돼 있어도 금방 맞추기 어렵게 */
const PW_WORDS = ['숲속', '바다', '햇살', '별빛', '구름', '나무', '노을', '새싹', '바람', '물결', '연필', '공책', '하늘', '들꽃', '시냇물', '봄비', '여름', '가을', '겨울', '아침', '저녁', '달빛', '은하', '파도', '모래', '조약돌', '등대', '나침반', '지도', '책장', '종이', '물감', '도토리', '솔방울', '오솔길', '언덕', '호수', '섬마을', '무지개', '안개', '이슬', '서리', '눈꽃', '단풍', '새벽', '노래', '피리', '북소리', '징검다리', '울타리', '창문', '마당', '골목', '정원', '꽃밭', '열매', '씨앗', '뿌리', '줄기', '나뭇잎', '돌담', '풍선', '연날리기', '종소리'];
export function friendlyPassword(rand = (n) => { const a = new Uint32Array(1); globalThis.crypto.getRandomValues(a); return a[0] % n; }) {
  return `${PW_WORDS[rand(PW_WORDS.length)]}${PW_WORDS[rand(PW_WORDS.length)]}${PW_WORDS[rand(PW_WORDS.length)]}${String(1000 + rand(9000))}`;
}

/** QR·링크에 붙이면 저절로 열리는 주소(#k=암호). 암호를 아는 사람에게만 나눠 주세요. */
export function unlockUrl(url, password) {
  const u = String(url || '').split('#')[0];
  return `${u}#k=${encodeURIComponent(String(password || ''))}`;
}
