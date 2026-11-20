// 정적 검수(약속 C): 사이트 파일을 그리지 않고 읽어서 고칠 곳을 찾습니다. 사람(앱 화면)과 AI(고치기 요청에 그대로 붙임)가 함께 읽는 꼴.
// issue: { id, level:'error'|'warn', where:{ file, selector, section }, message_ko, fix_hint_ko }
import { scanTags, elementAt, attr, hasAttr, textOf, resolvePath, VOID } from './html.js';
import { readMeta, themeFromCss, isHex } from './meta.js';
import { KIT_TYPES, parsePages, jsonAttr, optionList, kitSlug } from './widgets.js';
import { LIB_SCRIPT_SOURCES } from '../render/shell.js';
import { contrast } from '../design/color.js';
import { ENGINE_PAGES } from './paths.js';
import { FONT_CSS_HOSTS, FRAME_SOURCES } from './assemble.js';

const ENGINE_ASSETS = /^assets\/(lecpage|live|kit|qr|boot|theme|aux-pages|screen|check|console|favicon|event|fx)\.|^assets\/site(-\d+)?-events\.js$/;
const asText = (v) => (typeof v === 'string' ? v : v instanceof Uint8Array ? new TextDecoder().decode(v) : '');
const size = (v) => (typeof v === 'string' ? new TextEncoder().encode(v).length : v?.byteLength || 0);
const KB = 1024, MB = 1024 * 1024;

/** 요소를 가리키는 짧은 선택자: tag#id · tag.class · [data-lp="…"] */
export function selectorOf(t) {
  if (!t) return '';
  const id = attr(t, 'id'); if (id) return `${t.name}#${id}`;
  const lp = attr(t, 'data-lp'); if (lp) return `[data-lp="${lp}"]`;
  const st = attr(t, 'data-lp-step'); if (st) return `[data-lp-step="${st}"]`;
  const cls = (attr(t, 'class') || '').split(/\s+/).filter(Boolean).slice(0, 2);
  return t.name + cls.map((c) => '.' + c).join('');
}

/** 태그마다 둘러싼 섹션(가장 가까운 <section>·[data-lp-step]의 id 또는 제목) */
function sectionMap(tags, html) {
  const stack = []; const out = new Map();
  for (let k = 0; k < tags.length; k++) {
    const t = tags[k];
    if (t.kind === 'open') {
      const sec = [...stack].reverse().find((x) => x.name === 'section' || hasAttr(x, 'data-lp-step'));
      out.set(k, sec ? (attr(sec, 'id') || attr(sec, 'data-lp-step') || attr(sec, 'aria-label') || secTitle(sec)) : '');
      if (!VOID.has(t.name) && !t.selfClose && t.contentStart === undefined) stack.push(t);
    } else if (t.kind === 'close') {
      for (let i = stack.length - 1; i >= 0; i--) if (stack[i].name === t.name) { stack.length = i; break; }
    }
  }
  return out;
  function secTitle(sec) {
    const k = tags.indexOf(sec); const el = elementAt(tags, k, html);
    const h = /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i.exec(html.slice(el.innerStart, Math.min(el.innerEnd, el.innerStart + 4000)));
    return h ? textOf(h[1]).slice(0, 40) : '';
  }
}

/** CSS 사용자 변수(--이름: 값, 처음 나온 것)와 색 규칙 */
function cssInfo(css) {
  const vars = {};
  for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;}{]+)/g)) if (!(m[1] in vars)) vars[m[1]] = m[2].trim();
  const resolve = (v, depth = 0) => { const m = /^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)$/.exec(String(v || '').trim()); if (!m || depth > 4) return String(v || '').trim(); return resolve(vars[m[1]] ?? m[2] ?? '', depth + 1); };
  const rules = [];
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim(); const body = m[2];
    const color = /(?:^|;)\s*color\s*:\s*([^;]+)/.exec(body)?.[1];
    const bg = /(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/.exec(body)?.[1];
    if (color || bg) rules.push({ sel, color: color && resolve(color.replace(/!important/, '').trim()), bg: bg && resolve(bg.replace(/!important/, '').trim()) });
  }
  return { vars, resolve, rules };
}
const hex = (v) => { const s = String(v || '').trim(); if (isHex(s)) return s; const m = /^#([0-9a-f]{6})[0-9a-f]{2}$/i.exec(s); return m ? '#' + m[1] : /^(white)$/i.test(s) ? '#ffffff' : /^(black)$/i.test(s) ? '#000000' : ''; };

/**
 * 정적 검수.
 * @param files { 경로: 글|Uint8Array } — AI가 쓴 사이트 폴더(조립 전) 또는 조립 결과
 * @param meta lecpage.json(객체·글, 없어도 됨)
 * @returns issues[]
 */
export function inspect(files = {}, meta = null, { maxPerRule = 12 } = {}) {
  const issues = []; const count = {};
  const add = (id, level, where, message_ko, fix_hint_ko) => {
    count[id] = (count[id] || 0) + 1;
    if (count[id] > maxPerRule) return;
    issues.push({ id, level, where: { file: where.file || '', selector: where.selector || '', section: where.section || '' }, message_ko, fix_hint_ko });
  };
  const paths = Object.keys(files);
  const pages = paths.filter((p) => p.endsWith('.html') && !ENGINE_PAGES.includes(p)).sort((a, b) => (a === 'index.html' ? -1 : b === 'index.html' ? 1 : a.localeCompare(b)));
  const cssFiles = paths.filter((p) => p.endsWith('.css') && !ENGINE_ASSETS.test(p));
  const jsFiles = paths.filter((p) => /\.m?js$/.test(p) && !ENGINE_ASSETS.test(p));
  const material = paths.map((p) => /^material\/p-(\d{3,4})\./.exec(p)).filter(Boolean).map((m) => +m[1]);

  // 연수 정보
  if (meta) {
    const r = readMeta(meta);
    for (const e of r.errors) add(`meta-${e.code}`, 'error', { file: 'lecpage.json', selector: e.path }, e.message_ko, e.code === 'v1' ? '새 판은 사이트 폴더(site/)와 lecpage.json(v:2)으로 만들어요.' : 'lecpage.json을 고쳐 주세요(references/kit.md의 꼴).');
    for (const w of r.warnings) if (w.code !== 'teacher-value') add(`meta-${w.code}`, 'warn', { file: 'lecpage.json', selector: w.path }, w.message_ko, w.code === 'title-empty' ? '교재에 적힌 연수 이름을 title에 적어 주세요.' : 'lecpage.json의 꼴을 맞춰 주세요(날짜 YYYY-MM-DD, 시각 HH:MM).');
  }
  if (!files['index.html']) add('no-index', 'error', { file: 'index.html' }, '첫 쪽 index.html이 없어요.', '사이트의 첫 쪽을 site/index.html로 써 주세요.');

  // 파일 크기·형식
  let total = 0;
  for (const p of paths) {
    const n = size(files[p]); total += n;
    if (/\.svg$/i.test(p)) add('svg-file', 'warn', { file: p }, `SVG 파일(${p})은 사이트에 넣지 않아요.`, '그림은 png·jpg·webp로, 아이콘은 HTML 안에 <svg>로 바로 써 주세요.');
    if (/\.html$/.test(p) && n > 400 * KB) add('file-size', 'warn', { file: p }, `${p}가 ${Math.round(n / KB)}KB로 커요. 휴대폰·학교망에서 느려요.`, '긴 글은 나누고, 그림은 HTML 안(data:)이 아니라 파일로 두세요.');
    else if (/\.(png|jpe?g|webp|gif|avif)$/i.test(p) && n > 1.5 * MB) add('file-size', 'warn', { file: p }, `그림 ${p}가 ${(n / MB).toFixed(1)}MB예요.`, '1600px 폭 안팎의 webp로 줄여 주세요.');
    else if (/\.(css|m?js)$/.test(p) && !ENGINE_ASSETS.test(p) && n > 300 * KB) add('file-size', 'warn', { file: p }, `${p}가 ${Math.round(n / KB)}KB예요.`, '쓰지 않는 규칙·코드를 빼 주세요.');
    if (n > 15 * MB) add('file-too-big', 'error', { file: p }, `${p}가 ${(n / MB).toFixed(1)}MB라 배포할 수 없어요.`, '15MB 아래로 줄이거나 바깥 주소(영상 서비스 등)로 이어 주세요.');
  }
  if (total > 60 * MB) add('site-too-big', 'error', { file: '' }, `사이트 전체가 ${Math.round(total / MB)}MB예요.`, '교재 쪽 그림·사진을 줄여 60MB 아래로 맞춰 주세요.');

  // CSS: 키트 변수·글자/바탕 대비
  const inlineCss = pages.map((p) => [...asText(files[p]).matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n')).join('\n');
  const css = cssFiles.map((p) => asText(files[p])).join('\n') + '\n' + inlineCss;
  const ci = cssInfo(css);
  const theme = { ...themeFromCss(css), ...(meta ? readMeta(meta).meta.theme : {}) };
  for (const k of ['--lp-accent', '--lp-ink', '--lp-paper']) {
    const v = ci.vars[k];
    if (v !== undefined && !hex(ci.resolve(v))) add('kit-var-color', 'warn', { file: cssFiles[0] || 'index.html', selector: k }, `${k} 값(${String(v).slice(0, 30)})이 #RRGGBB 꼴이 아니라 키트가 글자색을 맞추지 못해요.`, `${k}: #1a2b3c 꼴로 적어 주세요.`);
  }
  if (isHex(theme.ink) && isHex(theme.paper)) {
    const c = contrast(theme.ink, theme.paper);
    if (c < 4.5) add('contrast', 'error', { file: cssFiles[0] || 'lecpage.json', selector: '--lp-ink / --lp-paper' }, `글자색(${theme.ink})과 바탕(${theme.paper})의 대비가 ${c.toFixed(2)}:1이에요(4.5:1 이상이어야 읽혀요).`, '글자색을 더 진하게(밝은 바탕) 또는 더 밝게(어두운 바탕) 바꿔 주세요.');
  }
  if (isHex(theme.accent) && isHex(theme.paper) && contrast(theme.accent, theme.paper) < 3) add('contrast-accent', 'warn', { file: cssFiles[0] || 'lecpage.json', selector: '--lp-accent' }, `강조색(${theme.accent})이 바탕(${theme.paper})과 ${contrast(theme.accent, theme.paper).toFixed(2)}:1이라 단추 테두리·막대가 잘 안 보여요.`, '강조색을 바탕과 3:1 이상 나게 골라 주세요.');
  const rootBg = hex(ci.vars['--lp-paper'] && ci.resolve(ci.vars['--lp-paper'])) || theme.paper || '';
  for (const r of ci.rules) {
    const fg = hex(r.color); let bg = hex(r.bg);
    if (!fg) continue;
    if (!bg && /(^|,)\s*(html|body|:root)\s*($|,)/.test(r.sel)) bg = rootBg;
    if (!bg) continue;
    const c = contrast(fg, bg);
    if (c < 4.5) add('contrast', c < 3 ? 'error' : 'warn', { file: cssFiles[0] || 'index.html', selector: r.sel.slice(0, 80) }, `"${r.sel.slice(0, 50)}"의 글자(${fg})와 바탕(${bg}) 대비가 ${c.toFixed(2)}:1이에요.`, '4.5:1 이상(큰 제목은 3:1)이 되게 색을 바꿔 주세요.');
  }

  // 스크립트 파일 문법
  for (const p of jsFiles) {
    const code = asText(files[p]);
    if (/^\s*(import|export)\b/m.test(code) || /\.module\.js$/.test(p)) continue;
    try { new Function(code); } catch (e) { if (e instanceof SyntaxError) add('script-syntax', 'error', { file: p }, `${p}에 문법 오류가 있어요: ${String(e.message).slice(0, 100)}`, '끝이 잘렸거나 괄호·따옴표가 짝이 맞지 않는지 확인해 주세요.'); }
  }

  // 쪽마다
  const ids = {}; const stepIds = new Set(); let deckCount = 0; const slots = new Set();
  for (const p of pages) {
    const html = asText(files[p]); const tags = scanTags(html); const sec = sectionMap(tags, html);
    ids[p] = new Set(tags.filter((t) => t.kind === 'open' && attr(t, 'id')).map((t) => attr(t, 'id')));
    const W = (k, t) => ({ file: p, selector: selectorOf(t), section: sec.get(k) || '' });
    if (!/^\s*<!doctype html>/i.test(html)) add('doctype', 'warn', { file: p }, `${p} 맨 앞에 <!doctype html>이 없어요.`, '첫 줄에 <!doctype html>을 적어 주세요(없으면 옛 방식으로 그려져 배치가 어긋나요).');
    const htmlT = tags.find((t) => t.kind === 'open' && t.name === 'html');
    if (!htmlT || !attr(htmlT, 'lang')) add('lang', 'warn', { file: p, selector: 'html' }, `${p}의 <html>에 lang이 없어요.`, '<html lang="ko">로 적어 주세요(화면 읽기 프로그램이 한국어로 읽어요).');
    if (!/<\/html>\s*$/i.test(html.trim()) && !/<\/body>/i.test(html)) add('truncated', 'error', { file: p }, `${p}의 끝이 잘린 것 같아요(</body>·</html>이 없음).`, '끝까지 다시 써 주세요. 길면 섹션을 나눠 이어서 쓰면 돼요.');
    const title = tags.find((t) => t.kind === 'open' && t.name === 'title');
    if (!title || !textOf(html.slice(title.contentStart, title.contentEnd))) add('title', 'error', { file: p, selector: 'title' }, `${p}에 <title>이 없거나 비었어요.`, '<title>연수 이름</title>을 <head>에 넣어 주세요(탭·공유 미리보기에 보여요).');
    if (!tags.some((t) => t.kind === 'open' && t.name === 'meta' && attr(t, 'name') === 'viewport')) add('viewport', 'error', { file: p, selector: 'head' }, `${p}에 viewport meta가 없어 휴대폰에서 아주 작게 보여요.`, '<meta name="viewport" content="width=device-width, initial-scale=1">을 넣어 주세요.');
    const h1 = tags.filter((t) => t.kind === 'open' && t.name === 'h1');
    if (!h1.length) add('h1', 'warn', { file: p }, `${p}에 <h1>이 없어요.`, '쪽의 큰 제목 하나를 <h1>로 써 주세요.');
    else if (h1.length > 1) add('h1-many', 'warn', { file: p, selector: 'h1' }, `${p}에 <h1>이 ${h1.length}개예요.`, '<h1>은 하나만, 섹션 제목은 <h2>로 써 주세요.');

    for (let k = 0; k < tags.length; k++) {
      const t = tags[k];
      if (t.kind !== 'open') continue;
      // 금지·막히는 것
      const on = t.attrs.filter((a) => /^on[a-z]+$/.test(a.name));
      if (on.length) add('inline-handler', 'warn', W(k, t), `<${t.name} ${on.map((a) => a.name).join(' ')}>: 인라인 이벤트 속성은 CSP에 막혀요(조립이 옮기지만 늦게 붙어요).`, `assets/site.js에서 document.querySelector(…).addEventListener('${on[0].name.slice(2)}', …)로 써 주세요.`);
      for (const a of t.attrs) if (['href', 'src', 'action', 'formaction'].includes(a.name) && /^\s*javascript:/i.test(a.value)) add('javascript-url', 'error', W(k, t), `${a.name}="javascript:…"는 CSP에 막혀 동작하지 않아요.`, '<button type="button">과 addEventListener로 바꿔 주세요.');
      if (t.name === 'input' && (attr(t, 'type') || '').toLowerCase() === 'password') add('password-field', 'error', W(k, t), '비밀번호 칸(type=password)은 강의 사이트에 넣을 수 없어요(바로 배포가 거절해요).', '비밀번호 칸을 빼 주세요. 참여는 키트(별명·출석)가 받아요.');
      if (t.name === 'form' && attr(t, 'data-lp') === undefined && (attr(t, 'action') !== undefined || (attr(t, 'method') || '').toLowerCase() === 'post')) add('form-action', 'warn', W(k, t), '<form action>으로 보내기는 막혀 있어요(form-action \'none\').', '보낼 것은 키트(질문·보드·설문)로 받거나, 화면 안에서만 쓰는 양식이면 submit을 막아(event.preventDefault()) 주세요.');
      if (t.name === 'script') {
        const src = attr(t, 'src');
        if (src !== undefined && /^(?:https?:)?\/\//i.test(src) && !LIB_SCRIPT_SOURCES.some((x) => (src.startsWith('//') ? 'https:' + src : src).startsWith(x))) add('external-script', 'error', W(k, t), `바깥 스크립트 ${src.slice(0, 70)}는 허용 목록에 없어 조립이 빼요.`, `직접 assets/에 쓰거나 허용된 것만 쓰세요: ${LIB_SCRIPT_SOURCES.map((x) => x.replace('https://cdn.jsdelivr.net/npm/', '')).join(', ')}`);
        else if (src !== undefined && !/^(?:[a-z]+:)?\/\//i.test(src)) { const rp = resolvePath(src, p); if (rp && !files[rp]) add('broken-script', 'error', W(k, t), `스크립트 ${src}가 사이트에 없어요.`, '경로를 확인하거나 파일을 만들어 주세요.'); }
        else if (src === undefined && t.contentStart !== undefined) {
          const ty = (attr(t, 'type') || '').toLowerCase();
          const code = html.slice(t.contentStart, t.contentEnd);
          if ((!ty || /javascript|ecmascript/.test(ty)) && code.trim()) { try { new Function(code); } catch (e) { if (e instanceof SyntaxError) add('script-syntax', 'error', W(k, t), `<script>에 문법 오류가 있어요: ${String(e.message).slice(0, 100)}`, '끝이 잘렸거나 괄호·따옴표가 짝이 맞지 않는지 확인해 주세요.'); } }
          if (ty === 'importmap') add('importmap', 'warn', W(k, t), 'importmap은 CSP에 막혀요.', '상대 경로(./assets/…)로 import해 주세요.');
        }
      }
      if (t.name === 'link' && /stylesheet/.test(attr(t, 'rel') || '')) {
        const href = attr(t, 'href') || '';
        if (/^(?:https?:)?\/\//i.test(href)) { let h = ''; try { h = new URL(href.startsWith('//') ? 'https:' + href : href).hostname; } catch { /* 빈 */ } if (!FONT_CSS_HOSTS.includes(h)) add('external-css', 'warn', W(k, t), `바깥 스타일 ${href.slice(0, 70)}는 글꼴 CDN이 아니라 조립이 빼요.`, `CSS는 assets/style.css에 쓰고, 바깥은 글꼴(${FONT_CSS_HOSTS.join('·')})만 쓰세요.`); }
        else { const rp = resolvePath(href, p); if (rp && !files[rp]) add('broken-css', 'error', W(k, t), `스타일 ${href}가 사이트에 없어요.`, '경로를 확인하거나 파일을 만들어 주세요.'); }
      }
      if (t.name === 'iframe') {
        const src = attr(t, 'src') || '';
        const ok = FRAME_SOURCES.some((x) => src.startsWith(x)) || /^(?:https?:)?\/\/(?:www\.)?(?:youtube\.com\/embed\/|youtu\.be\/)/i.test(src);
        if (!ok) add('iframe-src', 'error', W(k, t), `틀(iframe) ${src.slice(0, 70) || '(주소 없음)'}은 막혀요. 유튜브·비메오 영상만 넣을 수 있어요.`, '다른 서비스는 링크(<a target="_blank">)로 이어 주세요.');
        if (!attr(t, 'title')) add('iframe-title', 'warn', W(k, t), '틀(iframe)에 title이 없어요.', 'title="영상: …"을 적어 주세요.');
      }
      if (['object', 'embed', 'applet', 'base'].includes(t.name)) add('blocked-tag', 'warn', W(k, t), `<${t.name}>은 막혀 있어 조립이 빼요.`, '빼 주세요.');
      // 그림
      if (t.name === 'img') {
        if (!hasAttr(t, 'alt')) add('img-alt', 'warn', W(k, t), `그림 ${String(attr(t, 'src') || '').slice(0, 50)}에 alt가 없어요.`, '그림이 전하는 내용을 alt에 적고, 꾸밈 그림이면 alt=""로 두세요.');
        const src = attr(t, 'src') || '';
        if (/^https?:/i.test(src)) add('external-image', 'error', W(k, t), `바깥 그림 ${src.slice(0, 70)}은 CSP에 막혀 보이지 않아요.`, 'assets/img/에 넣고 상대 경로로 써 주세요.');
        else if (src && !/^data:/i.test(src)) { const rp = resolvePath(src, p); if (rp && !files[rp]) add('broken-image', 'error', W(k, t), `그림 ${src.slice(0, 70)}가 사이트에 없어요.`, /^material\//.test(rp) ? `교재 쪽 그림은 material/p-001.webp 꼴이에요. 있는 쪽: ${material.length ? `${material[0]}~${material[material.length - 1]}` : '없음'}` : '경로를 확인하거나 그림을 assets/img/에 넣어 주세요.'); }
      }
      // 내부 링크
      if (t.name === 'a') {
        const href = attr(t, 'href');
        if (href && href.startsWith('#') && href.length > 1 && !/^#(deck-p\d+|st-)/.test(href)) { let id = href.slice(1); try { id = decodeURIComponent(id); } catch { /* 그대로 */ } if (!ids[p].has(id) && !tags.some((x) => x.kind === 'open' && attr(x, 'id') === id)) add('broken-anchor', 'warn', W(k, t), `#${id}로 가는 링크인데 그 id가 없어요.`, '섹션에 id를 달거나 링크를 고쳐 주세요.'); }
        else if (href && !/^(?:[a-z][\w+.-]*:|\/\/|#)/i.test(href)) { const rp = resolvePath(href, p); if (rp && !files[rp] && !['console.html', 'screen.html', 'poster.html', 'check.html', 'privacy.html'].includes(rp)) add('broken-link', 'error', W(k, t), `링크 ${href.slice(0, 70)}가 가리키는 파일이 없어요.`, '경로를 확인하거나 쪽을 만들어 주세요.'); }
      }
      // 섹션: 제목·빈 섹션
      if (t.name === 'section' || attr(t, 'data-lp-step') !== undefined) {
        const el = elementAt(tags, k, html); const inner = html.slice(el.innerStart, el.innerEnd);
        if (t.name === 'section' && !/<h[1-6]\b/i.test(inner) && !attr(t, 'aria-label') && !attr(t, 'aria-labelledby')) add('section-heading', 'warn', W(k, t), '섹션에 제목(<h2> 등)이 없어요.', '섹션마다 제목 하나를 <h2>로 써 주세요(목록·화면 읽기에 쓰여요).');
        if (textOf(inner).length < 2 && !/<(img|video|iframe|picture|canvas|svg)\b|data-lp=/i.test(inner)) add('section-empty', 'warn', W(k, t), '내용이 없는 빈 섹션이에요.', '내용을 채우거나 섹션을 빼 주세요.');
      }
      // 키트 자리 표시
      const lp = attr(t, 'data-lp');
      if (lp !== undefined) {
        slots.add(lp);
        if (!KIT_TYPES.includes(lp)) { add('kit-unknown', 'error', W(k, t), `모르는 자리 표시 data-lp="${lp}"예요.`, `쓸 수 있는 값: ${KIT_TYPES.join(', ')}`); continue; }
        if (lp === 'poll') {
          if (!String(attr(t, 'data-question') || '').trim()) add('kit-poll-question', 'error', W(k, t), '투표에 질문(data-question)이 없어요.', 'data-question="오늘 가장 해 보고 싶은 것은?"처럼 적어 주세요.');
          const kind = attr(t, 'data-kind') || 'choice';
          if (!['choice', 'word', 'scale'].includes(kind)) add('kit-poll-kind', 'error', W(k, t), `투표 종류 data-kind="${kind}"를 몰라요.`, 'choice(보기)·word(낱말)·scale(1~5) 중 하나로 적어 주세요.');
          if (kind === 'choice') {
            const o = optionList(attr(t, 'data-options'));
            if (o.error) add('kit-json', 'error', W(k, t), `투표 보기(data-options)를 JSON으로 읽지 못했어요: ${o.error}`, `data-options='["보기 1","보기 2"]'처럼 작은따옴표 안에 JSON 배열로 적어 주세요.`);
            else { const n = (o.value || []).length; if (n < 2 || n > 6) add('kit-poll-options', 'error', W(k, t), `투표 보기는 2~6개여야 해요(지금 ${n}개).`, '보기를 2~6개로 맞춰 주세요.'); }
          }
        }
        for (const [a, label] of [['data-questions', '설문 문항'], ['data-items', '자료 목록'], ['data-categories', '보드 분류']]) {
          const v = attr(t, a); if (v === undefined) continue;
          const j = a === 'data-categories' ? optionList(v) : jsonAttr(v);
          if (j.error) add('kit-json', 'error', W(k, t), `${label}(${a})를 JSON으로 읽지 못했어요: ${j.error}`, `${a}='[…]'처럼 작은따옴표 안에 JSON으로 적어 주세요.`);
        }
        if (lp === 'survey' && attr(t, 'data-questions')) {
          const j = jsonAttr(attr(t, 'data-questions'));
          if (Array.isArray(j.value)) j.value.forEach((q, i) => { if (!q || !(q.q || q.question)) add('kit-survey-q', 'warn', W(k, t), `설문 ${i + 1}번 문항에 q(질문)가 없어요.`, '{"q":"…","kind":"scale|choice|text","options":[…]} 꼴로 적어 주세요.'); else if ((q.kind || q.type) === 'choice' && !(Array.isArray(q.options) && q.options.length >= 2)) add('kit-survey-q', 'warn', W(k, t), `설문 "${String(q.q || q.question).slice(0, 30)}"는 객관식인데 보기가 2개 미만이에요.`, 'options에 보기를 2개 이상 적어 주세요.'); });
        }
        if (lp === 'deck') {
          deckCount++;
          const want = parsePages(attr(t, 'data-pages'));
          const miss = (want.length ? want : []).filter((n) => !material.includes(n));
          if (!material.length) add('kit-deck-pages', 'error', W(k, t), '교재 쪽 그림(material/p-NNN.webp)이 없어 교재 넘기기를 채울 수 없어요.', 'lecpage prepare로 쪽 그림을 만들거나 deck 자리 표시를 빼 주세요.');
          else if (miss.length) add('kit-deck-pages', 'error', W(k, t), `교재 넘기기의 ${miss.slice(0, 6).join(', ')}${miss.length > 6 ? ' …' : ''}쪽 그림이 없어요.`, `data-pages를 있는 쪽(${material[0]}~${material[material.length - 1]}) 안으로 맞춰 주세요.`);
        }
        const el = elementAt(tags, k, html);
        if (lp !== 'materials' && textOf(html.slice(el.innerStart, el.innerEnd)).length > 0) add('kit-inner', 'warn', W(k, t), `data-lp="${lp}" 안에 적은 글은 조립 때 지워져요.`, '설명은 자리 표시 바깥(위)에 써 주세요.');
      }
      const step = attr(t, 'data-lp-step');
      if (step !== undefined) {
        const id = kitSlug(step, '');
        if (!id) add('kit-step-id', 'error', W(k, t), 'data-lp-step 값이 비었어요.', 'data-lp-step="s1"처럼 단계마다 다른 값을 적어 주세요.');
        else if (stepIds.has(id)) add('kit-step-id', 'error', W(k, t), `실습 단계 data-lp-step="${step}"가 겹쳐요.`, '단계마다 다른 값을 적어 주세요.');
        stepIds.add(id);
      }
    }
  }
  if (deckCount > 1) add('kit-deck-many', 'warn', { file: pages[0] || '' }, `교재 넘기기(data-lp="deck")가 ${deckCount}개예요. 강사 따라 넘기기는 첫 번째만 돼요.`, '교재 넘기기는 하나만 두세요.');

  // 기능과 자리 표시
  if (meta) {
    const m = readMeta(meta).meta;
    // 출석은 자리 표시가 없어도 도크의 [출석]으로 받으므로 빼고 셈
    const need = { qa: 'qa', poll: 'poll', board: 'board', survey: 'survey', deck: 'deck', materials: 'materials' };
    for (const f of m.features) if (need[f] && !slots.has(need[f])) add('kit-feature-slot', 'warn', { file: 'lecpage.json', selector: 'features' }, `features에 ${f}가 있는데 data-lp="${need[f]}" 자리 표시가 없어요.`, `알맞은 섹션에 <div data-lp="${need[f]}"></div>를 넣거나 features에서 빼 주세요.`);
  }
  return issues;
}

/** 검수 결과 요약 한 줄(앱·CLI) */
export function issueSummary(issues = []) {
  const e = issues.filter((x) => x.level === 'error').length, w = issues.length - e;
  return e || w ? `고칠 곳 ${e}개 · 살펴볼 곳 ${w}개` : '문제 없음';
}

/** AI에게 붙일 고치기 요청 글(한 줄에 하나) */
export function issuesForAi(issues = [], { max = 40 } = {}) {
  return issues.slice(0, max).map((x) => `- [${x.level === 'error' ? '고칠 곳' : '살펴볼 곳'}] ${x.where.file}${x.where.selector ? ` ${x.where.selector}` : ''}${x.where.section ? ` (섹션 ${x.where.section})` : ''}: ${x.message_ko} → ${x.fix_hint_ko}`).join('\n');
}

