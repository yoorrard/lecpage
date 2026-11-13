// 글꼴 함께 담기(P2-4): 망이 막힌 학교에서도 사이트의 글꼴이 보이게, 글꼴 CDN의 스타일시트와 글꼴 파일을 사이트 안(assets/fonts/)으로 옮깁니다.
// 쪽을 열 때 외부 요청이 0이 되고, 받은 글꼴 파일은 사이트에 쓰인 글자가 든 조각(unicode-range)만 담습니다(한글 글꼴 전체를 싣지 않음).
// 나눠 받기가 없는 글꼴도 사이트 글자만 남긴 같은 글꼴 파일을 먼저 받게 하고(font-subset.js), 파일 이름은 내용 해시라 1년 캐시합니다.
// 빌드 결과(files)를 받아 새 files를 돌려주는 비동기 함수라 CLI(Node fetch)·앱(브라우저 fetch) 모두에서 씁니다. 네트워크가 안 되면 그대로 돌려줌.
//   const { files, report } = await bundleFonts(build.files, { fetch })
import { subsetFont, unicodeRange, canBrotli } from './font-subset.js';
import { FONTS } from './design/fonts.js';

// 우리 글꼴 목록(FONTS)의 woff2 → 같은 글꼴로 확인해 둔 woff(alt). brotli를 못 푸는 곳에서 글자를 줄일 때 읽음
const ALT = new Map(Object.values(FONTS).flatMap((f) => (f.face || []).filter((x) => x.alt).map((x) => [x.url, x.alt])));

const FONT_HOSTS = /^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net|hangeul\.pstatic\.net)\//;
// 구글 글꼴은 브라우저 종류에 따라 다른 형식을 줌 → 요즘 브라우저처럼 물어 woff2 조각을 받음
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/** 'U+AC00-D7A3, U+0041' → [[0xAC00, 0xD7A3], [0x41, 0x41]] */
export function parseRange(s) {
  return String(s || '').split(',').map((x) => x.trim().replace(/^U\+/i, '')).filter(Boolean).map((x) => {
    if (x.includes('?')) return [parseInt(x.replace(/\?/g, '0'), 16), parseInt(x.replace(/\?/g, 'F'), 16)];
    const [a, b] = x.split('-'); return [parseInt(a, 16), parseInt(b || a, 16)];
  }).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
}
/** 사이트의 글자(쪽의 글·자료 JSON, 태그·주석 빼고) + 기본 영숫자·문장부호 */
export function siteCodepoints(files) {
  const set = new Set();
  for (let c = 0x20; c < 0x7f; c++) set.add(c);
  for (const ch of '·…“”‘’→←↑↓✓×−–—•※') set.add(ch.codePointAt(0));
  for (const [p, v] of Object.entries(files)) {
    if (typeof v !== 'string' || !/\.(html|js)$/.test(p) || /^assets\/(fx|qr)\b/.test(p)) continue; // 화면에 글을 쓰는 스크립트(안내·참여·강사 화면)의 글자도
    const t = p.endsWith('.html') ? v.replace(/<script(?![^>]*application\/json)[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ') : v;
    for (const ch of t.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))) { const c = ch.codePointAt(0); if (c >= 0x80) set.add(c); }
  }
  return set;
}
const needed = (range, cps) => { if (!range.length) return true; for (const c of cps) for (const [a, b] of range) if (c >= a && c <= b) return true; return false; };

/**
 * 바깥 글꼴 스타일시트가 첫 화면을 붙잡지 않게: media="print"로 받아 두고, 다 받으면 boot.js가 'all'로 바꿈.
 * 학교·기관 망이 글꼴 CDN을 응답 없이 버리면(패킷 버림) 머리의 스타일시트를 기다리느라 쪽이 하얗게 멈췄음(8초 뒤에도 첫 화면 없음, school-network-2026-11 §7).
 * 이제는 기본 글꼴로 바로 뜨고 글꼴이 오면 바뀜. 스크립트가 꺼진 브라우저는 기본 글꼴 그대로(인쇄에는 글꼴이 씀)
 */
export function deferFontLinks(files) {
  for (const p of Object.keys(files)) {
    if (!p.endsWith('.html') || typeof files[p] !== 'string') continue;
    files[p] = files[p].replace(/<link rel="stylesheet" href="(https:\/\/[^"]+)" crossorigin>/g, (all, u) => (FONT_HOSTS.test(u.replace(/&amp;/g, '&')) ? `<link rel="stylesheet" href="${u}" crossorigin media="print" data-lp-font>` : all));
  }
  return files;
}

/** 사이트 CSS·쪽이 쓰는 굵기(font-weight·--…weight 변수·font 줄임 속성). 400·700(보통·굵게)은 늘 */
export function usedWeights(files) {
  const set = new Set([400, 700]);
  for (const [p, v] of Object.entries(files)) {
    if (typeof v !== 'string' || !/\.(css|html)$/.test(p) || p === 'assets/fonts.css') continue;
    const t = p.endsWith('.html') ? v.replace(/@font-face\s*\{[^}]*\}/g, '') : v.replace(/@font-face\s*\{[^}]*\}/g, '');
    for (const m of t.matchAll(/weight\s*:\s*(\d{3})\b/gi)) set.add(Number(m[1]));
    for (const m of t.matchAll(/\bfont\s*:\s*(?:(?:italic|oblique|normal|small-caps)\s+)*(\d{3})\s/gi)) set.add(Number(m[1]));
    if (/weight\s*:\s*(bold|bolder)\b/i.test(t)) set.add(700);
  }
  return [...set].filter((w) => w >= 1 && w <= 1000);
}
/** CSS 글꼴 고르기 규칙(굵기만): 바라는 굵기 d에 대해 브라우저가 고를 굵기 */
function pickWeight(d, ws) {
  if (ws.includes(d)) return d;
  const asc = ws.filter((w) => w > d).sort((a, b) => a - b), desc = ws.filter((w) => w < d).sort((a, b) => b - a);
  if (d >= 400 && d <= 500) { const mid = asc.filter((w) => w <= 500); return mid.length ? mid[0] : desc.length ? desc[0] : asc[0]; }
  if (d < 400) return desc.length ? desc[0] : asc[0];
  return asc.length ? asc[0] : desc[0];
}
const faceFamily = (b) => ((/font-family\s*:\s*([^;}]+)/.exec(b) || [])[1] || '').trim().replace(/^['"]|['"]$/g, '').toLowerCase();
const faceStyle = (b) => (/font-style\s*:\s*(italic|oblique)/i.test(b) ? 'i' : 'n');
/** font-weight: 700 → [700,700], 100 900(가변) → [100,900], 없으면 [400,400] */
function faceWeight(b) { const m = /font-weight\s*:\s*(\d{3})(?:\s+(\d{3}))?/.exec(b); return m ? [Number(m[1]), Number(m[2] || m[1])] : /font-weight\s*:\s*bold/i.test(b) ? [700, 700] : [400, 400]; }
/**
 * 한 스타일시트의 @font-face 가운데 사이트가 쓰는 굵기로 브라우저가 고를 것만 남김(같은 글꼴·같은 기울기 안에서).
 * 가변 굵기(100 900) 덩어리와 굵기가 하나뿐인 글꼴은 그대로. 돌려주는 값: 남길 덩어리(Set)
 */
function keepByWeight(list, weights) {
  const groups = new Map();
  for (const f of list) { const k = faceFamily(f.block) + '|' + faceStyle(f.block); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(f); }
  const keep = new Set();
  for (const g of groups.values()) {
    const statics = g.filter((f) => { const [a, b] = faceWeight(f.block); return a === b; });
    const ws = [...new Set(statics.map((f) => faceWeight(f.block)[0]))];
    if (ws.length <= 1) { g.forEach((f) => keep.add(f)); continue; }
    const want = new Set(weights.map((d) => pickWeight(d, ws)));
    for (const f of g) { const [a, b] = faceWeight(f.block); if (a !== b || want.has(a)) keep.add(f); }
  }
  return keep;
}
/** src에 woff2가 있으면 woff2(와 local)만 남김: 요즘 브라우저는 모두 woff2를 읽음(같은 글꼴의 woff·ttf를 함께 담으면 서너 배로 커짐) */
function woff2Only(block) {
  const m = /src\s*:\s*([^;}]+)/.exec(block); if (!m) return block;
  const parts = [...m[1].matchAll(/(local\([^)]*\)|url\([^)]*\))(\s*format\([^)]*\))?/g)].map((x) => x[0].trim());
  const w2 = parts.filter((x) => /^url\(/.test(x) && (/format\(\s*['"]?woff2/i.test(x) || /\.woff2(?:[?#][^'")]*)?['"]?\s*\)/i.test(x)));
  const others = parts.filter((x) => /^url\(/.test(x) && !w2.includes(x));
  if (!w2.length || !others.length) return block;
  return block.replace(m[0], 'src: ' + parts.filter((x) => /^local\(/.test(x)).concat(w2).join(', '));
}
/** @font-face 덩어리마다 { block, urls[], range[] } */
function faces(css) {
  return [...String(css).matchAll(/@font-face\s*\{[^}]*\}/g)].map((m) => {
    const block = m[0];
    const urls = [...block.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)].map((u) => u[2]);
    const r = /unicode-range\s*:\s*([^;}]+)/.exec(block);
    return { block, urls, range: r ? parseRange(r[1]) : [] };
  });
}

/** 내용 해시(SHA-256 앞 16자리): 내용이 같으면 이름이 같고, 바뀌면 이름도 바뀜 → 1년 캐시(immutable)가 안전 */
async function contentName(buf) {
  try { return [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', buf))].slice(0, 8).map((x) => x.toString(16).padStart(2, '0')).join(''); }
  catch { // crypto.subtle이 없는 곳(보안 연결이 아닌 쪽 등): FNV-1a 두 갈래
    let a = 2166136261, b = 0x9d2c5680;
    for (const x of buf) { a = Math.imul(a ^ x, 16777619); b = Math.imul(b ^ x, 16777619) ^ (b >>> 13); }
    return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
  }
}
/** 덩어리의 unicode-range를 바꾸거나 더함 */
const withRange = (block, r) => (/unicode-range\s*:/.test(block) ? block.replace(/unicode-range\s*:\s*[^;}]+/, `unicode-range:${r}`) : block.replace(/;?\s*\}$/, `;unicode-range:${r}}`));
/** 덩어리의 src를 이 파일 하나로(local()은 앞에 남김) */
const withSrc = (block, url, fmt) => block.replace(/src\s*:\s*([^;}]+)/, (all, v) => `src:${[...v.matchAll(/local\([^)]*\)/g)].map((m) => m[0]).concat(`url(${url}) format('${fmt}')`).join(',')}`);
const fmtOf = (name) => (name.endsWith('.woff2') ? 'woff2' : name.endsWith('.woff') ? 'woff' : name.endsWith('.otf') ? 'opentype' : 'truetype');
const extOf = (b) => { const s = String.fromCharCode(b[0], b[1], b[2], b[3]); return s === 'wOF2' ? 'woff2' : s === 'wOFF' ? 'woff' : s === 'OTTO' ? 'otf' : 'ttf'; };
const FONT_CACHE = '/assets/fonts/*\n  Cache-Control: public, max-age=31536000, immutable\n';

/**
 * @param files build()가 만든 파일들
 * @param o.fetch (url, init) → Response. 없으면 globalThis.fetch
 * @param o.subset false면 글자 줄이기를 하지 않음(받은 파일 그대로)
 * @returns {{ files, report: { ok, external, bundled, bytes, subset, saved, preload[], skipped[] } }}
 *
 * 글자 줄이기(font-subset.js): 글꼴 파일마다 사이트에 쓰인 글자만 남긴 같은 글꼴 파일을 만들고, 원본도 함께 담아 @font-face 둘로 선언합니다
 * (원본 먼저, 줄인 것 나중 → 겹치는 글자는 나중 것이 맡아 원본은 받지 않음). 사이트에 없던 글자(참가자가 올린 질문·보드 글)가 나오면
 * 그때 원본을 받아 같은 글꼴로 그립니다(글꼴이 섞이지 않음). 나눠 받기가 없는 원본의 unicode-range는 그 글꼴에 있는 글자로 좁힘(이모지 등으로 받지 않게).
 * 줄이지 못하면(형식·압축 풀기 불가·이득 작음) 지금처럼 원본만.
 */
export async function bundleFonts(files, o = {}) {
  const get = o.fetch || globalThis.fetch;
  const out = { ...files }, report = { ok: false, external: 0, bundled: 0, bytes: 0, subset: 0, saved: 0, preload: [], skipped: [] };
  if (typeof get !== 'function') { report.skipped.push('fetch 없음'); return { files: out, report }; }
  const htmls = Object.keys(out).filter((p) => p.endsWith('.html') && typeof out[p] === 'string');
  const linkRe = /<link rel="stylesheet" href="(https:\/\/[^"]+)" crossorigin(?: media="print" data-lp-font)?>\n?/g;
  const sheets = [...new Set(htmls.flatMap((p) => [...out[p].matchAll(linkRe)].map((m) => m[1].replace(/&amp;/g, '&')).filter((u) => FONT_HOSTS.test(u))))];
  const theme = typeof out['assets/theme.css'] === 'string' ? out['assets/theme.css'] : '';
  report.external = sheets.length + faces(theme).filter((f) => f.urls.some((u) => FONT_HOSTS.test(u))).length;
  if (!report.external) { report.ok = true; return { files: out, report }; }
  const cps = siteCodepoints(out), weights = usedWeights(out), saved = new Map(), made = [];
  const fetchBytes = async (url) => {
    const r = await get(url, { headers: { 'user-agent': UA } });
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return new Uint8Array(await r.arrayBuffer());
  };
  const put = async (buf, ext) => {
    const name = `assets/fonts/${await contentName(buf)}.${ext}`;
    if (!(name in out)) { out[name] = buf; report.bundled++; report.bytes += buf.byteLength; }
    return name;
  };
  const grab = async (url) => {
    if (!saved.has(url)) { const buf = await fetchBytes(url); saved.set(url, { buf, name: await put(buf, (/\.(woff2|woff|ttf|otf)(?:$|\?)/.exec(url) || [, 'woff2'])[1]) }); }
    return saved.get(url);
  };
  // 글자 줄이기. brotli를 못 푸는 곳(지금 브라우저)은 우리 글꼴 목록이 같은 글꼴로 확인해 둔 woff(ALT)를 읽고 원본도 그 파일로. 안 되면 null
  const shrink = async (buf, url, range) => {
    if (o.subset === false) return null;
    try {
      let src = buf;
      if (!canBrotli() && extOf(buf) === 'woff2') {
        if (!ALT.has(url)) return null;
        src = await fetchBytes(ALT.get(url));
      }
      const r = await subsetFont(src, cps, { range });
      if (!r || !r.kept.length || r.kept.length === r.cover.length || r.data.byteLength > 0.7 * src.byteLength) return null;
      return { ...r, alt: src === buf ? null : src };
    } catch { return null; }
  };
  // 한 덩어리: 쓰는 글자가 든 조각만 받아 주소를 사이트 안으로 바꿈(경로는 assets/fonts.css·theme.css 기준이라 fonts/…)
  const localize = async (css, base) => {
    let res = '';
    const list = faces(css), keep = keepByWeight(list, weights);
    for (const f0 of list) {
      if (!needed(f0.range, cps) || !keep.has(f0)) { report.dropped = (report.dropped || 0) + 1; continue; }
      let block = woff2Only(f0.block);
      const urls = [...block.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)].map((u) => u[2]);
      const one = urls.length === 1 && /^https:/.test(new URL(urls[0], base).href);
      const meta = { family: faceFamily(block), style: faceStyle(block), weight: faceWeight(block)[0], split: f0.range.length > 0 };
      if (one) {
        const abs = new URL(urls[0], base).href, g = await grab(abs);
        const sub = await shrink(g.buf, abs, f0.range);
        if (sub) {
          const full = sub.alt ? await put(sub.alt, extOf(sub.alt)) : g.name;
          const fb = withSrc(block, full.replace(/^assets\//, ''), fmtOf(full));
          const name = await put(sub.data, sub.format);
          res += (meta.split ? fb : withRange(fb, unicodeRange(sub.cover, 64))) + '\n';
          res += withRange(withSrc(block, name.replace(/^assets\//, ''), sub.format), unicodeRange(sub.kept)) + '\n';
          made.push({ ...meta, name, size: sub.data.byteLength });
          report.subset++; report.saved += (sub.alt || g.buf).byteLength - sub.data.byteLength;
          continue;
        }
        made.push({ ...meta, name: g.name, size: g.buf.byteLength });
      }
      for (const u of urls) {
        const abs = new URL(u, base).href;
        if (!/^https:/.test(abs)) continue;
        block = block.split(u).join((await grab(abs)).name.replace(/^assets\//, ''));
      }
      res += block + '\n';
    }
    return res;
  };
  try {
    let bundle = '';
    for (const u of sheets) {
      const r = await get(u, { headers: { 'user-agent': UA } });
      if (!r.ok) throw new Error(`${r.status} ${u}`);
      bundle += `/* ${u} */\n` + await localize(await r.text(), u);
    }
    // theme.css 안의 @font-face(굵기별로 직접 만든 글꼴)
    let th = theme;
    for (const f of faces(theme)) {
      if (!f.urls.some((u) => FONT_HOSTS.test(u))) continue;
      const loc = needed(f.range, cps) ? await localize(f.block, 'https://x/') : '';
      th = th.split(f.block).join(loc.trim());
    }
    out['assets/theme.css'] = th;
    out['assets/fonts.css'] = `/* 글꼴 함께 담기: 사이트에 쓰인 글자가 든 조각만(라이선스는 각 글꼴의 OFL 등, 원본 주소는 주석). 원본 파일 뒤에 같은 글꼴의 사이트 글자만 남긴 파일을 선언 */\n${bundle}`;
    // alt로 줄인 글꼴의 woff2처럼 어느 CSS도 가리키지 않게 된 파일은 빼기
    const refs = out['assets/fonts.css'] + th;
    for (const k of Object.keys(out)) if (k.startsWith('assets/fonts/') && !(k in files) && !refs.includes(k.slice(7))) { report.bundled--; report.bytes -= out[k].byteLength; delete out[k]; }
    // 첫 화면 제목 글꼴(되면 본문 글꼴도) 파일을 미리 받음: 글꼴이 늦게 바뀌며 글이 밀리는 것을 줄임. 합 64KB까지(더 크면 느린 망에서 첫 화면 CSS와 다퉈 첫 그림이 늦어짐)
    const pre = critical(th, made);
    report.preload = pre;
    for (const p of htmls) {
      let h = out[p], first = true;
      const up = p.includes('/') ? '../' : '';
      h = h.replace(linkRe, (all, u) => {
        if (!FONT_HOSTS.test(u.replace(/&amp;/g, '&'))) return all;
        if (!first) return '';
        first = false;
        return pre.map((n) => `<link rel="preload" href="${up}${n}" as="font" type="font/${n.split('.').pop()}" crossorigin>\n`).join('') + `<link rel="stylesheet" href="${up}assets/fonts.css">\n`;
      });
      h = h.replace(/<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\n?/g, '');
      out[p] = h;
    }
    // 글꼴 파일 이름이 내용 해시라 1년 캐시(Cloudflare·Netlify는 _headers, Vercel은 앱이 _headers를 vercel.json으로 옮김)
    if (typeof out._headers === 'string' && !out._headers.includes('/assets/fonts/*')) out._headers = out._headers.replace(/\n*$/, '\n\n') + FONT_CACHE;
    report.ok = true;
    return { files: out, report };
  } catch (e) {
    report.skipped.push(String(e.message || e));
    return { files, report }; // 하나라도 못 받으면 원래대로(반쯤 담긴 사이트를 만들지 않음)
  }
}

/** theme.css의 --font-display·--font-sans 첫 글꼴(제목 굵기·400) 가운데 파일 하나로 정해지는 것을, 합이 budget을 넘지 않게 제목부터 */
function critical(theme, made, budget = 64 * 1024) {
  const tok = (k) => (new RegExp(`${k}\\s*:\\s*([^;}]+)`).exec(theme) || [])[1] || '';
  const fam = (v) => v.split(',')[0].trim().replace(/^['"]|['"]$/g, '').toLowerCase();
  const pick = (family, w) => {
    const fs = made.filter((f) => f.family === family && f.style === 'n');
    if (!fs.length || fs.some((f) => f.split)) return null; // 나눠 받기 조각 글꼴은 파일이 여럿이라 고르지 않음
    const best = pickWeight(w, [...new Set(fs.map((f) => f.weight))]), hit = fs.filter((f) => f.weight === best);
    return hit.length === 1 ? hit[0] : null;
  };
  const out = []; let used = 0;
  for (const f of [pick(fam(tok('--font-display')), Number(tok('--display-weight')) || 700), pick(fam(tok('--font-sans')), 400)]) {
    if (f && !out.includes(f.name) && used + f.size <= budget) { out.push(f.name); used += f.size; }
  }
  return out;
}
