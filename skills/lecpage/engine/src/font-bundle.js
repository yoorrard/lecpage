// 글꼴 함께 담기(P2-4): 망이 막힌 학교에서도 사이트의 글꼴이 보이게, 글꼴 CDN의 스타일시트와 글꼴 파일을 사이트 안(assets/fonts/)으로 옮깁니다.
// 쪽을 열 때 외부 요청이 0이 되고, 받은 글꼴 파일은 사이트에 쓰인 글자가 든 조각(unicode-range)만 담습니다(한글 글꼴 전체를 싣지 않음).
// 빌드 결과(files)를 받아 새 files를 돌려주는 비동기 함수라 CLI(Node fetch)·앱(브라우저 fetch) 모두에서 씁니다. 네트워크가 안 되면 그대로 돌려줌.
//   const { files, report } = await bundleFonts(build.files, { fetch })

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
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };

/** @font-face 덩어리마다 { block, urls[], range[] } */
function faces(css) {
  return [...String(css).matchAll(/@font-face\s*\{[^}]*\}/g)].map((m) => {
    const block = m[0];
    const urls = [...block.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)].map((u) => u[2]);
    const r = /unicode-range\s*:\s*([^;}]+)/.exec(block);
    return { block, urls, range: r ? parseRange(r[1]) : [] };
  });
}

/**
 * @param files build()가 만든 파일들
 * @param o.fetch (url, init) → Response. 없으면 globalThis.fetch
 * @returns {{ files, report: { ok, external, bundled, bytes, skipped[] } }}
 */
export async function bundleFonts(files, o = {}) {
  const get = o.fetch || globalThis.fetch;
  const out = { ...files }, report = { ok: false, external: 0, bundled: 0, bytes: 0, skipped: [] };
  if (typeof get !== 'function') { report.skipped.push('fetch 없음'); return { files: out, report }; }
  const htmls = Object.keys(out).filter((p) => p.endsWith('.html') && typeof out[p] === 'string');
  const linkRe = /<link rel="stylesheet" href="(https:\/\/[^"]+)" crossorigin>\n?/g;
  const sheets = [...new Set(htmls.flatMap((p) => [...out[p].matchAll(linkRe)].map((m) => m[1].replace(/&amp;/g, '&')).filter((u) => FONT_HOSTS.test(u))))];
  const theme = typeof out['assets/theme.css'] === 'string' ? out['assets/theme.css'] : '';
  report.external = sheets.length + faces(theme).filter((f) => f.urls.some((u) => FONT_HOSTS.test(u))).length;
  if (!report.external) { report.ok = true; return { files: out, report }; }
  const cps = siteCodepoints(out), saved = new Map();
  const grab = async (url) => {
    if (saved.has(url)) return saved.get(url);
    const r = await get(url, { headers: { 'user-agent': UA } });
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    const buf = new Uint8Array(await r.arrayBuffer());
    const ext = (/\.(woff2|woff|ttf|otf)(?:$|\?)/.exec(url) || [, 'woff2'])[1];
    const name = `assets/fonts/${hash(url)}.${ext}`;
    out[name] = buf; report.bundled++; report.bytes += buf.byteLength; saved.set(url, name);
    return name;
  };
  // 한 덩어리: 쓰는 글자가 든 조각만 받아 주소를 사이트 안으로 바꿈(경로는 assets/fonts.css·theme.css 기준이라 fonts/…)
  const localize = async (css, base) => {
    let res = '';
    for (const f of faces(css)) {
      if (!needed(f.range, cps)) continue;
      let block = f.block;
      for (const u of f.urls) {
        const abs = new URL(u, base).href;
        if (!/^https:/.test(abs)) continue;
        const local = await grab(abs);
        block = block.split(u).join(local.replace(/^assets\//, ''));
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
    out['assets/fonts.css'] = `/* 글꼴 함께 담기: 사이트에 쓰인 글자가 든 조각만(라이선스는 각 글꼴의 OFL 등, 원본 주소는 주석) */\n${bundle}`;
    for (const p of htmls) {
      let h = out[p], first = true;
      h = h.replace(linkRe, (all, u) => { if (!FONT_HOSTS.test(u.replace(/&amp;/g, '&'))) return all; if (!first) return ''; first = false; return `<link rel="stylesheet" href="${p.includes('/') ? '../' : ''}assets/fonts.css">\n`; });
      h = h.replace(/<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\n?/g, '');
      out[p] = h;
    }
    report.ok = true;
    return { files: out, report };
  } catch (e) {
    report.skipped.push(String(e.message || e));
    return { files, report }; // 하나라도 못 받으면 원래대로(반쯤 담긴 사이트를 만들지 않음)
  }
}
