// 임시 함수(얇은 대역): 엔진 키트(skills/lecpage/engine/src/kit/ — 다른 작업자가 만드는 중)의 assemble·inspect·inspectRendered·readMeta가
// 들어오기 전까지 같은 이름·같은 꼴로 씁니다. 생성 파이프라인은 이 파일(kit.js를 거쳐)에서만 부르므로, 합칠 때는 kit.js의
// import 한 줄을 엔진 키트로 바꾸면 됩니다. TODO(kit 합치기): kit.js에서 '@engine/src/kit/index.js'로 바꾸고 이 파일을 지움.
// 약속: docs/plan-ai-first.md §3(사이트 형식)·§4(키트 표시)·§5(조립·검수)
import { scanTags, attrOf, htmlCut, extractSections, siteMap, cssCut } from './parse.js';

export const KIT_TYPES = ['qa', 'poll', 'board', 'attend', 'survey', 'deck', 'materials', 'join', 'dock', 'now', 'share'];
export const KIT_FEATURES = ['qa', 'poll', 'board', 'attendance', 'survey', 'help', 'reactions', 'signal', 'progress', 'deck', 'materials', 'timer'];
const TEACHER_KEYS = ['live', 'siteUrl', 'joinUrl', 'shortUrl', 'access', 'surveyUrl', 'privacy', 'keepUntil'];
const LABEL = { qa: '질문 받기', poll: '투표', board: '보드', attend: '출석', survey: '설문', deck: '교재 넘기기', materials: '자료실', join: '접속 QR', dock: '참여 막대', now: '지금 알림', share: '공유' };

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v, max = 400) => (typeof v === 'string' || typeof v === 'number' ? String(v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : '');
const isHex = (v) => typeof v === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim());

/** 사이트 CSS의 --lp-accent·--lp-ink·--lp-paper·--lp-font·--lp-radius(처음 나온 값) */
export function themeFromCss(css = '') {
  const out = {};
  for (const k of ['accent', 'ink', 'paper', 'font', 'radius']) {
    const m = new RegExp(`--lp-${k}\\s*:\\s*([^;}{]+)`).exec(String(css));
    if (!m) continue;
    const v = m[1].replace(/!important/, '').trim();
    if (['accent', 'ink', 'paper'].includes(k)) { if (isHex(v)) out[k] = v.toLowerCase(); } else if (k === 'font') out.font = str(v, 120); else if (/^\d+(\.\d+)?(px|rem|em)$|^0$/.test(v)) out.radius = v;
  }
  return out;
}

/** lecpage.json 읽기(얇은 판). 강사 칸(live·siteUrl·joinUrl·shortUrl·access …)은 AI 값을 버리고 prev 값을 씀 → { meta, errors, warnings } */
export function readMeta(input, { prev = null } = {}) {
  const errors = []; const warnings = [];
  let raw = input;
  if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { errors.push({ path: '', code: 'json', message_ko: 'lecpage.json을 JSON으로 읽지 못했어요.' }); raw = {}; } }
  if (!isObj(raw)) raw = {};
  const normDate = (v) => { const m = /^(\d{4})[-./]\s*(\d{1,2})[-./]\s*(\d{1,2})/.exec(str(v, 20)); return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : ''; };
  const normTime = (v) => { const m = /^(\d{1,2}):(\d{2})/.exec(str(v, 10)); return m && +m[1] < 24 && +m[2] < 60 ? `${m[1].padStart(2, '0')}:${m[2]}` : ''; };
  const ses = Array.isArray(raw.sessions) ? raw.sessions : raw.date ? [{ date: raw.date, start: raw.start, end: raw.end }] : [];
  const sessions = ses.filter(isObj).slice(0, 40).map((s) => ({ date: normDate(s.date), start: normTime(s.start), end: normTime(s.end) })).filter((s) => s.date || s.start);
  const features = [...new Set((Array.isArray(raw.features) ? raw.features : []).map((f) => (f === 'attend' ? 'attendance' : f)).filter((f) => KIT_FEATURES.includes(f)))];
  const theme = {};
  if (isObj(raw.theme)) { for (const k of ['accent', 'ink', 'paper']) if (isHex(raw.theme[k])) theme[k] = raw.theme[k].trim().toLowerCase(); if (str(raw.theme.font, 120)) theme.font = str(raw.theme.font, 120).replace(/[;{}<>]/g, ''); }
  const facts = (Array.isArray(raw.facts) ? raw.facts : []).filter(isObj).slice(0, 60).map((f) => ({ label: str(f.label, 60), value: str(f.value, 300), ...(Number.isFinite(+f.page) && +f.page > 0 ? { page: Math.round(+f.page) } : {}), ...(str(f.file, 120) ? { file: str(f.file, 120) } : {}) })).filter((f) => f.label && f.value);
  const p = isObj(prev) ? prev : {};
  const meta = {
    v: 2, title: str(raw.title, 160), subtitle: str(raw.subtitle, 400), organizer: str(raw.organizer, 120), sessions, venue: str(raw.venue, 120),
    mode: ['offline', 'online', 'blended'].includes(raw.mode) ? raw.mode : raw.mode === 'hybrid' ? 'blended' : 'offline',
    audience: ['teachers', 'students', 'parents', 'staff', 'other'].includes(raw.audience) ? raw.audience : 'teachers',
    instructors: (Array.isArray(raw.instructors) ? raw.instructors : []).filter(isObj).slice(0, 12).map((x) => ({ name: str(x.name, 40), org: str(x.org, 80) })).filter((x) => x.name),
    features, theme, facts,
  };
  for (const k of TEACHER_KEYS) meta[k] = p[k] !== undefined ? p[k] : (k === 'live' ? null : k === 'access' ? 'public' : '');
  if (!meta.title) warnings.push({ path: 'title', code: 'title-empty', message_ko: '제목(title)이 비었어요.' });
  return { meta, errors, warnings };
}

const KIT_CSS = `.lpk{font-family:var(--lp-font,inherit);color:var(--lp-ink,inherit);border:1px dashed color-mix(in srgb,var(--lp-accent,currentColor) 55%,transparent);border-radius:var(--lp-radius,12px);padding:14px 16px;margin:12px 0;background:color-mix(in srgb,var(--lp-paper,#fff) 92%,var(--lp-accent,#888))}.lpk .lpk-ph{margin:0;font-weight:600}.lpk .lpk-ph small{display:block;font-weight:400;opacity:.75}`;

/**
 * 조립(얇은 판): 인라인 <script> → assets/site.js, 바깥 스크립트 빼기, 키트 자리 표시를 보이는 상자로(실제 기능은 엔진 키트가 채움),
 * lang·charset·viewport, lecpage.json. material: 있는 교재 쪽 그림 경로(material/p-001.webp …)
 * @returns {{ files, warnings: [{ code, message_ko }] }}
 */
export function assemble(site, meta, { runtime = null, preview = false, target = 'preview', material = [] } = {}) { // eslint-disable-line no-unused-vars
  const files = { ...site }; const warnings = [];
  const pages = Object.keys(files).filter((p) => /\.html?$/i.test(p) && typeof files[p] === 'string');
  let js = typeof files['assets/site.js'] === 'string' ? files['assets/site.js'] : '';
  for (const page of pages) {
    let h = files[page];
    if (!/<html[^>]*\blang=/i.test(h)) h = h.replace(/<html(\s|>)/i, '<html lang="ko"$1');
    if (!/<meta[^>]+charset/i.test(h)) h = h.replace(/<head([^>]*)>/i, '<head$1>\n<meta charset="utf-8">');
    if (!/<meta[^>]+name=["']viewport/i.test(h)) h = h.replace(/<head([^>]*)>/i, '<head$1>\n<meta name="viewport" content="width=device-width, initial-scale=1">');
    if (files['assets/style.css'] && !/href=["'](?:\.\/)?assets\/style\.css/i.test(h)) h = h.replace(/<\/head>/i, '<link rel="stylesheet" href="assets/style.css">\n</head>');
    // 인라인 스크립트 → assets/site.js (JSON 자료 스크립트는 그대로)
    h = h.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (m, attrs, body) => {
      const src = attrOf(attrs, 'src'); const type = (attrOf(attrs, 'type') || '').toLowerCase();
      if (src) {
        if (/^(https?:)?\/\//i.test(src)) { warnings.push({ code: 'external-script', message_ko: `바깥 스크립트(${src.slice(0, 80)})는 뺐어요.` }); return ''; }
        return m;
      }
      if (type && !/javascript|module/.test(type)) return m;
      if (body.trim()) js += `\n;/* ${page} */\n${body.trim()}\n`;
      return '';
    });
    files[page] = h;
  }
  // 키트 자리 표시(빈 것만): 보이는 상자 + 이름(실제 위젯은 엔진 키트가 펼침)
  for (const page of pages) {
    files[page] = files[page].replace(/<(div|section|aside)\b([^>]*\bdata-lp\s*=\s*["']([\w-]+)["'][^>]*)>(\s*)<\/\1>/gi, (m, tag, attrs, type) => {
      const cls = attrOf(attrs, 'class');
      const a2 = cls === null ? `${attrs} class="lpk lpk-${type}"` : attrs.replace(/\bclass\s*=\s*(["'])([^"']*)\1/i, (x, q, v) => `class=${q}${v} lpk lpk-${type}${q}`);
      const q = attrOf(attrs, 'data-question') || attrOf(attrs, 'data-prompt') || '';
      return `<${tag}${a2}><p class="lpk-ph">${LABEL[type] || type}${q ? `<small>${q.replace(/</g, '&lt;')}</small>` : ''}</p></${tag}>`;
    });
    if (/class="[^"]*\blpk\b/.test(files[page]) && !/lpk-shim-css/.test(files[page])) files[page] = files[page].replace(/<\/head>/i, `<style id="lpk-shim-css">${KIT_CSS}</style>\n</head>`);
    if (js.trim() && !/src=["'](?:\.\/)?assets\/site\.js/i.test(files[page])) files[page] = files[page].replace(/<\/body>/i, '<script src="assets/site.js" defer></script>\n</body>');
  }
  if (js.trim()) files['assets/site.js'] = js.trim() + '\n';
  for (const r of siteMap(files, { material }).missing) warnings.push({ code: 'broken-ref', message_ko: `${r.from}의 ${r.ref} 파일이 없어요.` });
  files['lecpage.json'] = JSON.stringify(meta || {}, null, 2);
  return { files, warnings };
}

const issue = (code, level, where, message_ko, fix_hint_ko, n = 0) => ({ id: `${code}:${where.file || ''}:${where.section || ''}:${n}`, level, where, message_ko, fix_hint_ko });
const sectionAt = (html, pos) => { let id = ''; for (const s of extractSections(html)) { const a = html.indexOf(s.html); if (a <= pos && pos < a + s.html.length) id = s.id; } return id; };

/** 글자색 대비(WCAG). #rgb·#rrggbb만 */
function contrast(a, b) {
  const lum = (h) => { let x = h.replace('#', ''); if (x.length === 3) x = x.split('').map((c) => c + c).join(''); const v = [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/**
 * 정적 검사(얇은 판) → issues[]. issue: { id, level:'error'|'warn', where:{ file, selector, section }, message_ko, fix_hint_ko }
 * files: assemble 결과(교재 쪽 그림은 경로만 있어도 됨)
 */
export function inspect(files, meta = {}) { // eslint-disable-line no-unused-vars
  const out = [];
  const html = files['index.html'];
  if (typeof html !== 'string' || !html.trim()) return [issue('no-index', 'error', { file: 'index.html' }, 'index.html이 없어요.', '사이트 첫 쪽(index.html)을 만들어 주세요.')];
  if (htmlCut(html)) out.push(issue('html-cut', 'error', { file: 'index.html' }, 'HTML이 중간에 끊겼어요.', '끊긴 뒷부분을 이어서 써 주세요.'));
  if (!/<title>[^<]{2,}<\/title>/i.test(html)) out.push(issue('no-title', 'warn', { file: 'index.html', selector: 'title' }, '쪽 제목(<title>)이 없어요.', '<title>에 연수 제목을 넣어 주세요.'));
  if (!/<main[\s>]/i.test(html)) out.push(issue('no-main', 'warn', { file: 'index.html', selector: 'main' }, '본문(<main>)이 없어요.', '섹션들을 <main>으로 감싸 주세요.'));
  const secs = extractSections(html);
  if (!secs.length) out.push(issue('no-sections', 'error', { file: 'index.html' }, '섹션(<section>)이 하나도 없어요.', '내용을 <section id="…">로 나눠 주세요.'));
  const ids = new Set();
  secs.forEach((s, i) => {
    if (!s.id) out.push(issue('section-id', 'warn', { file: 'index.html', selector: `section:nth-of-type(${i + 1})` }, `${i + 1}번째 섹션에 id가 없어요.`, '섹션마다 id를 붙여 주세요(목록·수정 요청에 씀).', i));
    else if (ids.has(s.id)) out.push(issue('section-dup', 'error', { file: 'index.html', section: s.id, selector: `#${s.id}` }, `섹션 id "${s.id}"가 겹쳐요.`, '섹션 id를 서로 다르게 해 주세요.', i));
    ids.add(s.id);
    const text = s.html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, '').replace(/\s+/g, '');
    if (text.length < 12 && !/<img|data-lp=/i.test(s.html)) out.push(issue('empty-section', 'warn', { file: 'index.html', section: s.id, selector: s.id ? `#${s.id}` : '' }, `섹션 ${s.title || s.id || i + 1}이 거의 비었어요.`, '교재 내용으로 채우거나 섹션을 빼 주세요.', i));
  });
  const { tags } = scanTags(html);
  let n = 0;
  for (const t of tags) {
    if (t.close) continue;
    const type = attrOf(t.attrs, 'data-lp');
    const where = () => ({ file: 'index.html', section: sectionAt(html, t.start), selector: `[data-lp="${type}"]` });
    if (type !== null) {
      if (!KIT_TYPES.includes(type)) out.push(issue('kit-unknown', 'error', where(), `모르는 키트 표시 data-lp="${type}"예요.`, `쓸 수 있는 것: ${KIT_TYPES.join(', ')}`, n++));
      if (type === 'poll') {
        const q = attrOf(t.attrs, 'data-question'); let opts = null; try { opts = JSON.parse(attrOf(t.attrs, 'data-options') || 'null'); } catch { opts = null; }
        if (!q || !Array.isArray(opts) || opts.length < 2) out.push(issue('kit-poll', 'error', where(), '투표에 질문이나 선택지가 없어요.', 'data-question="…"과 data-options=\'["가","나"]\'(두 개 이상)를 넣어 주세요.', n++));
      }
      if (type === 'survey') { let qs = null; try { qs = JSON.parse(attrOf(t.attrs, 'data-questions') || 'null'); } catch { qs = null; } if (!Array.isArray(qs) || !qs.length) out.push(issue('kit-survey', 'error', where(), '설문 문항(data-questions)을 읽지 못했어요.', "data-questions='[{\"q\":\"…\",\"type\":\"scale\"}]' 꼴로 넣어 주세요.", n++)); }
      if (type === 'deck' && attrOf(t.attrs, 'data-pages') && !/^\d+(-\d+)?(,\d+(-\d+)?)*$/.test(attrOf(t.attrs, 'data-pages'))) out.push(issue('kit-deck', 'warn', where(), '교재 넘기기의 쪽 범위가 이상해요.', 'data-pages="1-12" 꼴로 넣어 주세요.', n++));
    }
    if (t.name === 'input' && /type\s*=\s*["']?password/i.test(t.attrs)) out.push(issue('forbidden-password', 'error', { file: 'index.html', section: sectionAt(html, t.start), selector: 'input[type=password]' }, '비밀번호 칸은 쓸 수 없어요.', '비밀번호 칸을 빼 주세요.', n++));
    if (t.name === 'form' && attrOf(t.attrs, 'action')) out.push(issue('forbidden-form', 'error', { file: 'index.html', section: sectionAt(html, t.start), selector: 'form[action]' }, '다른 곳으로 보내는 입력 양식은 쓸 수 없어요.', '참여 기능은 키트 표시(data-lp)로 넣어 주세요.', n++));
    if (t.name === 'script' && /^(https?:)?\/\//i.test(attrOf(t.attrs, 'src') || '')) out.push(issue('external-script', 'warn', { file: 'index.html', selector: 'script[src]' }, '바깥 스크립트는 배포할 때 빠져요.', '필요한 동작은 assets/site.js에 직접 써 주세요.', n++));
  }
  const ph = /lorem ipsum|TODO|\[(강사|이름|날짜|장소)[^\]]*\]|○○○|XXX/i.exec(html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ''));
  if (ph) out.push(issue('placeholder-text', 'warn', { file: 'index.html', section: sectionAt(html, html.indexOf(ph[0])) }, `채우지 않은 자리 글("${ph[0]}")이 있어요.`, '교재에 있는 내용으로 바꾸거나 빼 주세요.'));
  for (const r of siteMap(files, {}).missing) out.push(issue('broken-ref', 'error', { file: r.from, selector: `[src="${r.ref}"]`, section: r.from === 'index.html' ? sectionAt(html, html.indexOf(r.ref)) : '' }, `${r.ref} 파일이 없어요.`, '있는 파일(교재 쪽 그림 material/p-NNN.webp 등)로 바꾸거나 빼 주세요.', n++));
  const css = typeof files['assets/style.css'] === 'string' ? files['assets/style.css'] : '';
  if (css && cssCut(css)) out.push(issue('css-cut', 'error', { file: 'assets/style.css' }, 'CSS가 중간에 끊겼어요.', '끊긴 규칙을 닫아 주세요.'));
  const th = themeFromCss(css + (html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || []).join('\n'));
  if (!th.accent) out.push(issue('no-lp-vars', 'warn', { file: 'assets/style.css', selector: ':root' }, 'CSS에 --lp-accent 같은 키트 색 변수가 없어요.', ':root에 --lp-accent·--lp-ink·--lp-paper·--lp-font·--lp-radius를 넣어 주세요.'));
  if (th.ink && th.paper && contrast(th.ink, th.paper) < 4.5) out.push(issue('contrast-vars', 'warn', { file: 'assets/style.css', selector: ':root' }, `글자색(${th.ink})과 바탕색(${th.paper})의 대비가 낮아요.`, '대비가 4.5:1 이상이 되게 바꿔 주세요.'));
  if (html.length > 1.5e6) out.push(issue('too-big', 'warn', { file: 'index.html' }, 'index.html이 너무 커요.', '그림은 파일로 빼 주세요(data: 주소 대신).'));
  return out;
}

/**
 * 그려서 검사(얇은 판): 보이는 창(window)에서 가로 넘침·깨진 그림·잘린 글·낮은 대비·너무 작은 글.
 * 숨은 틀 안에서 그대로 돌리도록 이 함수는 바깥 것을 하나도 쓰지 않음(문자열로 만들어 틀에 넣음: render-check.js)
 */
export function inspectRendered(win) {
  const doc = win.document; const W = win.innerWidth; const out = [];
  const sel = (el) => { if (!el || el === doc.body) return 'body'; if (el.id) return '#' + el.id; const c = (el.getAttribute('class') || '').trim().split(/\s+/)[0]; return el.tagName.toLowerCase() + (c ? '.' + c : ''); };
  const sec = (el) => { const s = el && el.closest && el.closest('section[id]'); return s ? s.id : ''; };
  const add = (code, level, el, message_ko, fix_hint_ko) => out.push({ id: `${code}:index.html:${sec(el)}:${W}:${out.length}`, level, where: { file: 'index.html', selector: sel(el), section: sec(el), width: W }, message_ko, fix_hint_ko });
  const visible = (el) => { const cs = win.getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getClientRects().length > 0; };
  const all = Array.from(doc.body ? doc.body.querySelectorAll('*') : []).slice(0, 4000);
  if (doc.documentElement.scrollWidth > W + 1) {
    const wide = all.filter((el) => { if (!visible(el)) return false; const r = el.getBoundingClientRect(); return r.right > W + 1 && r.width > 0; });
    const leaf = wide.filter((el) => !wide.some((o) => o !== el && el.contains(o))).slice(0, 3);
    if (leaf.length) leaf.forEach((el) => add('overflow-x', 'error', el, `화면 폭 ${W}px에서 옆으로 넘쳐요.`, '고정 폭(width·min-width)을 max-width:100%로 바꿔 주세요. 긴 낱말은 overflow-wrap:anywhere로 줄바꿈해요.'));
    else add('overflow-x', 'error', doc.body, `화면 폭 ${W}px에서 옆으로 넘쳐요.`, '넘치는 요소의 폭을 줄여 주세요.');
  }
  for (const img of Array.from(doc.images)) if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) add('img-broken', 'error', img, `그림을 불러오지 못했어요(${String(img.getAttribute('src')).slice(0, 60)}).`, '있는 그림 경로로 바꾸거나 빼 주세요.');
  const rgb = (c) => { const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(c || ''); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; };
  const lum = (v) => { const a = v.slice(0, 3).map((x) => x / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; };
  const bgOf = (el) => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const cs = win.getComputedStyle(e); if (cs.backgroundImage && cs.backgroundImage !== 'none') return null; const c = rgb(cs.backgroundColor); if (c && c[3] > 0.9) return c; } return [255, 255, 255, 1]; };
  let low = 0; let small = 0; let clip = 0;
  for (const el of all) {
    if (!el.firstChild || !Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim().length > 1)) continue;
    if (!visible(el)) continue;
    const cs = win.getComputedStyle(el);
    if (+cs.opacity === 0) continue;
    const fg = rgb(cs.color); const bg = bgOf(el);
    if (fg && bg && low < 5) {
      const l1 = lum(fg); const l2 = lum(bg); const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const big = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.6 && +cs.fontWeight >= 700);
      if (ratio < (big ? 3 : 4.5) && fg[3] > 0.5) { low++; add('low-contrast', 'warn', el, `글자와 바탕의 대비가 낮아요(${ratio.toFixed(1)}:1).`, '글자색이나 바탕색을 바꿔 대비를 4.5:1 이상으로 해 주세요.'); }
    }
    if (parseFloat(cs.fontSize) < 12 && small < 3) { small++; add('tiny-text', 'warn', el, `글자가 너무 작아요(${parseFloat(cs.fontSize)}px).`, '본문 글자는 14px 이상으로 해 주세요.'); }
    if (clip < 4 && /hidden|clip/.test(cs.overflowX + cs.overflow) && el.scrollWidth > el.clientWidth + 2 && cs.textOverflow !== 'ellipsis') { clip++; add('text-clipped', 'warn', el, '글이 상자 밖으로 잘려요.', '상자 폭을 늘리거나 줄바꿈되게 해 주세요.'); }
  }
  return out;
}
