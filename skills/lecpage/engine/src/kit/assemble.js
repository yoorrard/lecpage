// 조립(약속 C): AI가 쓴 사이트 폴더 + lecpage.json → 배포할 파일 묶음. Node(skill)와 브라우저(앱) 모두에서 같은 함수를 씁니다.
//   인라인 <script> → assets/site.js(순서 유지, type=module도), 인라인 이벤트 속성 옮기기(경고), 자리 표시 펼치기,
//   키트 CSS·런타임·#lp-data, 강사·발표 화면용 목록(#lp-blueprint), CSP meta·_headers, 보조 쪽(console·screen·poster·check·privacy),
//   일정 파일(.ics)·favicon·robots·noindex, 교재 쪽 그림 경로 확인, 허용 목록 밖 외부 스크립트 빼기.
import { scanTags, elementAt, rewriteOpen, applyEdits, attr, hasAttr, escAttr, escHtml, textOf, resolvePath } from './html.js';
import { readMeta, firstSession, liveFeatures, themeFromCss, isHex, tangledTitle } from './meta.js';
import * as W from './widgets.js';
import { normAux, buildAux, auxLive } from './aux-build.js';
import { preflight } from './preflight.js';
import { makeCode } from '../util.js';
import { siteData, LIB_SCRIPT_SOURCES, liveOrigins, servedOverLan, jsonScript, boardFiles } from '../render/shell.js';
import { wordsFor, surveyFor } from '../words.js';
import { contrast, readableOn, mix, ensureContrast, luminance, alpha } from '../design/color.js';
import { matchFont } from '../design/fonts.js';
import { VERSION } from '../version.js';
import { icon } from '../render/html.js';

import { ENGINE_PAGES, ENGINE_FILES, siteFileOk } from './paths.js';
export { ENGINE_PAGES, siteFileOk };
/** 글꼴 스타일시트를 받는 곳(CSP style-src·font-src와 같음) */
export const FONT_CSS_HOSTS = ['fonts.googleapis.com', 'cdn.jsdelivr.net', 'hangeul.pstatic.net'];
/** 틀(iframe)로 넣을 수 있는 영상 */
export const FRAME_SOURCES = ['https://www.youtube-nocookie.com', 'https://player.vimeo.com'];
const enc = (v) => (typeof v === 'string' ? new TextEncoder().encode(v).length : v?.byteLength || 0);
const asText = (v) => (typeof v === 'string' ? v : v instanceof Uint8Array || v instanceof ArrayBuffer ? new TextDecoder().decode(v) : '');
/** 그림 머리만 읽어 크기(webp·png·jpeg). 모르면 null — 교재 넘기기가 A4 세로 교재를 16:9 칸에 작게 넣지 않게 비율을 알려 줌 */
function imageSize(v) {
  const b = v instanceof ArrayBuffer ? new Uint8Array(v) : v instanceof Uint8Array ? v : null;
  if (!b || b.length < 30) return null;
  const s = (i, n) => String.fromCharCode(...b.subarray(i, i + n));
  const le = (i, n) => b.subarray(i, i + n).reduceRight((a, x) => a * 256 + x, 0);
  if (s(0, 4) === 'RIFF' && s(8, 4) === 'WEBP') {
    const k = s(12, 4);
    if (k === 'VP8X') return { w: le(24, 3) + 1, h: le(27, 3) + 1 };
    if (k === 'VP8L') { const x = le(21, 4); return { w: (x & 0x3fff) + 1, h: ((x >>> 14) & 0x3fff) + 1 }; }
    if (k === 'VP8 ') return { w: le(26, 2) & 0x3fff, h: le(28, 2) & 0x3fff };
    return null;
  }
  if (b[0] === 0x89 && s(1, 3) === 'PNG') return { w: (b[16] << 24 | b[17] << 16 | b[18] << 8 | b[19]) >>> 0, h: (b[20] << 24 | b[21] << 16 | b[22] << 8 | b[23]) >>> 0 };
  if (b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i + 9 < b.length;) {
      if (b[i] !== 0xff) return null;
      const m = b[i + 1], len = b[i + 2] * 256 + b[i + 3];
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { w: b[i + 7] * 256 + b[i + 8], h: b[i + 5] * 256 + b[i + 6] };
      i += 2 + len;
    }
  }
  return null;
}

/** 글꼴 스타일시트 곳 → 글꼴 파일 곳(font-src) */
const FONT_FILE_HOST = { 'fonts.googleapis.com': 'fonts.gstatic.com', 'cdn.jsdelivr.net': 'cdn.jsdelivr.net', 'hangeul.pstatic.net': 'hangeul.pstatic.net' };
/**
 * 사이트가 실제로 부르는 바깥 곳(CSP에 이것만 엶): 허용 목록 라이브러리·글꼴 CDN·영상 틀.
 * @param texts AI 쪽 HTML·CSS·JS 글(조립 뒤), provider: 참여 기능 방식(supabase면 런타임이 supabase-js를 부름)
 */
export function usedSources(texts = [], { provider = '' } = {}) {
  const all = texts.join('\n');
  const scripts = LIB_SCRIPT_SOURCES.filter((p) => all.includes(p) || (provider === 'supabase' && /supabase-js/.test(p)));
  // 글꼴: <link rel=stylesheet|preload>의 곳과 CSS의 @import·url()이 가리키는 곳만(같은 CDN의 스크립트는 글꼴로 세지 않음)
  const styleHosts = new Set();
  for (const m of all.matchAll(/<link\b[^>]*>/gi)) {
    if (!/\brel\s*=\s*["']?[^"'>]*(?:stylesheet|preload)/i.test(m[0])) continue;
    const h = /\bhref\s*=\s*["']?(?:https?:)?\/\/([^/"'\s>]+)/i.exec(m[0]); if (h) styleHosts.add(h[1].toLowerCase());
  }
  for (const m of all.matchAll(/(?:@import\s+(?:url\(\s*)?|url\(\s*)["']?(?:https?:)?\/\/([^/"'\s)]+)/gi)) styleHosts.add(m[1].toLowerCase());
  const fonts = FONT_CSS_HOSTS.filter((h) => styleHosts.has(h));
  const fontFiles = [...new Set([...fonts.map((h) => FONT_FILE_HOST[h] || h), ...[...styleHosts].filter((h) => Object.values(FONT_FILE_HOST).includes(h))])];
  const frames = FRAME_SOURCES.filter((o) => all.includes(o.replace(/^https:/, '')) || (o.includes('youtube') && /\/\/(?:www\.)?(?:youtube\.com\/embed|youtu\.be)\//.test(all)));
  return { scripts, fonts, fontFiles, frames };
}
/** 사이트 CSP(AI 쪽용). 엔진 보조 쪽은 엔진 CSP(render/shell.js cspPolicy)를 그대로 씀. used(usedSources 결과)가 없으면 허용 목록 전부 */
export function kitCsp(bp, { live = true, used = null } = {}) {
  const lan = servedOverLan(bp);
  const origins = live ? liveOrigins(bp) : [];
  const httpLive = origins.filter((x) => /^https?:/.test(x));
  const sheetsImg = bp.live?.provider === 'sheets' ? ['https://drive.google.com', 'https://*.googleusercontent.com'] : [];
  const u = used || { scripts: LIB_SCRIPT_SOURCES, fonts: FONT_CSS_HOSTS, frames: FRAME_SOURCES };
  const fontFiles = u.fontFiles || [...new Set(u.fonts.map((h) => FONT_FILE_HOST[h] || h))];
  const p = [
    "default-src 'self' file:",
    ['script-src', "'self'", 'file:', ...u.scripts].join(' '),
    ['style-src', "'self'", 'file:', "'unsafe-inline'", ...u.fonts.map((h) => 'https://' + h)].join(' '),
    ['font-src', "'self'", 'file:', 'data:', ...fontFiles.map((h) => 'https://' + h)].join(' '),
    `img-src ${["'self'", 'file:', 'data:', 'blob:', ...httpLive, ...sheetsImg].join(' ')}`,
    `media-src ${["'self'", 'file:', 'blob:', ...httpLive].join(' ')}`,
    `connect-src ${[...new Set(["'self'", 'file:', ...origins])].join(' ')}`,
    `frame-src ${u.frames.length ? u.frames.join(' ') : "'none'"}`,
    "worker-src 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'none'",
  ];
  if (!lan) p.push('upgrade-insecure-requests');
  return p.join('; ');
}

/** 글꼴 이름 → 엔진 글꼴 열쇠(같은 글꼴을 아는 것만) */
function fontKey(name, role) {
  if (!name) return '';
  const f = matchFont(String(name).split(',')[0].replace(/["']/g, '').trim(), role);
  return f && !f.system && f.exact ? f.id : '';
}
/** 연수 정보 → 보조 쪽 테마(밝은·어두운 바탕에 맞는 프리셋 + 강조색·본문 글꼴·제목 글꼴) */
function auxDesign(theme) {
  const dark = isHex(theme.paper) && luminance(theme.paper) < 0.25;
  const d = { preset: dark ? 'keynote-dark' : 'corporate-clean', theme: dark ? 'dark' : 'light', motion: 0, graphic: '', closingGraphic: '', signature: '', effects: {} };
  if (isHex(theme.accent)) d.accent = theme.accent;
  const body = fontKey(theme.font, 'body'), head = fontKey(theme.fontHeading, 'display');
  if (body || head) d.fonts = { display: head || body, ...(body ? { body } : {}) };
  return d;
}
/** 바탕·글자·강조색 셋으로 보조 쪽 색 묶음 하나(장식색 accent·accent-2·accent-3도 이 셋에서만: 프리셋의 파랑·주황이 섞이지 않게) */
function auxPalette(bg, fg, accent, dark) {
  const on = (c) => readableOn(c, '#ffffff', '#111111');
  const prim = isHex(accent) ? ensureContrast(accent, bg, 4.5) : '';
  const key = prim || fg; // 강조색이 없으면 글자색이 장식을 맡음
  const a1 = mix(key, bg, dark ? 0.3 : 0.42), a2 = mix(fg, bg, dark ? 0.22 : 0.18), a3 = mix(key, bg, dark ? 0.55 : 0.72);
  return {
    '--background': bg, '--foreground': fg, '--card': dark ? mix(bg, fg, 0.06) : mix(bg, '#ffffff', 0.6), '--card-foreground': fg,
    '--muted': mix(bg, fg, 0.06), '--muted-foreground': ensureContrast(mix(fg, bg, 0.35), bg, 4.6), '--secondary': mix(bg, fg, 0.08), '--secondary-foreground': fg,
    '--border': mix(bg, fg, dark ? 0.18 : 0.14), '--surface-2': mix(bg, fg, 0.035),
    ...(prim ? { '--primary': prim, '--primary-foreground': on(prim), '--ring': prim } : {}),
    '--accent': a1, '--accent-foreground': on(a1), '--accent-2': a2, '--accent-2-foreground': on(a2), '--accent-3': a3, '--accent-3-foreground': on(a3),
    '--hero-from': key, '--hero-to': bg, '--selection': alpha(key, 0.28), '--stage': dark ? mix(bg, '#000000', 0.35) : mix(fg, '#000000', 0.2), '--on-stage': dark ? fg : bg,
  };
}
/**
 * 보조 쪽 테마에 사이트 색을 덮음: 바탕(paper)·글자(ink)·강조(accent)와 그 섞음만. 사이트 쪽 밝기(밝은·어두운)와 반대쪽(밝게·어둡게 단추)도
 * 반대쪽은 바탕과 글자를 맞바꿔 만듦(밝은 사이트의 어두운 화면 = 잉크 바탕 + 종이 글자)
 */
function auxThemeOverride(theme) {
  const has = (k) => isHex(theme[k]);
  if (!has('paper') && !has('ink') && !has('accent')) return '';
  const bg = has('paper') ? theme.paper : has('ink') && luminance(theme.ink) > 0.4 ? '#141414' : '#ffffff';
  const fg = has('ink') && contrast(theme.ink, bg) >= 7 ? theme.ink : readableOn(bg, '#ffffff', '#141414');
  const dark = luminance(bg) < 0.25;
  // 반대쪽: 밝은 사이트면 잉크(충분히 어두우면) 바탕, 어두운 사이트면 잉크(충분히 밝으면) 바탕
  const altBg = dark ? (luminance(fg) > 0.6 ? mix(fg, '#ffffff', 0.4) : '#fafafa') : (luminance(fg) < 0.05 ? fg : '#141414');
  const altFg = contrast(bg, altBg) >= 7 ? bg : readableOn(altBg, '#ffffff', '#141414');
  const css = (sel, t) => `${sel}{${Object.entries(t).map(([k, v]) => `${k}:${v}`).join(';')}}`;
  const main = dark ? 'dark' : 'light', alt = dark ? 'light' : 'dark';
  return `\n/* 사이트 색(연수 정보 theme: 바탕·글자·강조와 그 섞음만) */\n${css(`:root[data-theme="${main}"]`, auxPalette(bg, fg, theme.accent, dark))}\n${css(`:root[data-theme="${alt}"]`, auxPalette(altBg, altFg, theme.accent, !dark))}\n`;
}
/** 키트 CSS 앞에 붙는 값: 연수 정보 theme(+ 사이트 CSS의 --lp-*)에서. 강조색 위 글자색은 키트 CSS가 강조색 밝기로 다시 고름(이 값은 그걸 못 하는 옛 브라우저용) */
function kitVars(theme) {
  const v = {};
  if (isHex(theme.accent)) { v['--lpk-accent'] = theme.accent; v['--lpk-on-accent'] = readableOn(theme.accent, '#ffffff', '#000000'); }
  const paper = isHex(theme.paper) ? theme.paper : '';
  let ink = isHex(theme.ink) ? theme.ink : '';
  if (paper && (!ink || contrast(ink, paper) < 4.5)) ink = readableOn(paper, '#ffffff', '#141414');
  if (paper) { v['--lpk-paper'] = paper; v['--lpk-surf'] = paper; }
  else if (ink) v['--lpk-paper'] = luminance(ink) > 0.4 ? '#141414' : '#ffffff';
  if (ink) v['--lpk-ink'] = ink;
  if (theme.font) v['--lpk-font'] = String(theme.font).replace(/[;{}<>]/g, '');
  if (theme.radius) v['--lpk-radius'] = theme.radius;
  return Object.keys(v).length ? `:root{${Object.entries(v).map(([k, x]) => `${k}:${x}`).join(';')}}\n` : '';
}

/** 연수 정보·모은 기능 → 보조 쪽 모양(kit/aux-build.js normAux가 다듬음). 보조 쪽·#lp-data·강사 화면 목록(#lp-blueprint)을 만들 때 씀 */
function synthBlueprint(meta, col, { preview = false, theme = meta.theme || {}, deploy = {} } = {}) {
  const s1 = firstSession(meta);
  // 자리 표시가 있으면 그 기능은 켬. 실습 단계가 있고 참여 기능이 켜져 있으면 진행 현황도(강사 화면이 단계별 진행을 셈)
  const extra = [col.qa && 'qa', col.board.length && 'board', col.polls.length && 'poll', col.attend && 'attendance'].filter(Boolean);
  const features = liveFeatures(meta, extra);
  if (col.steps.length && features.length && !features.includes('progress')) features.push('progress');
  const on = features.length > 0 || col.survey.length > 0;
  const code = meta.live?.code || makeCode(`${meta.title}|${s1.date}`);
  let live;
  if (!on) live = { provider: 'none', features: [] };
  else if (preview || !meta.live) live = { provider: 'local', url: '', code, features, anonymous: meta.live?.anonymous !== false };
  else live = { ...meta.live, code, features };
  const minor = meta.audience === 'students';
  const kind = meta.admin?.kind || (meta.audience === 'students' ? 'student' : meta.audience === 'parents' ? 'conference' : 'school');
  const collect = meta.privacy?.collect || (features.includes('attendance') && !minor ? ['nickname', 'name', 'school'] : ['nickname']);
  // 배포할 곳(host)에 맞는 개인정보 안내: 바로 배포(lecpage)는 운영자가 강사를 대신해 저장(처리 위탁), 참여 기록은 사이트 보관 기간보다 오래 두지 않음(hosting room.js)
  const host = deploy.host || '', days = host === 'lecpage' && +deploy.days > 0 ? +deploy.days : 0;
  let retentionDays = meta.privacy?.retentionDays || 30;
  if (days) retentionDays = Math.min(retentionDays, Math.max(1, Math.ceil(days)));
  let processors = meta.privacy?.processors || [];
  if (!processors.length && host === 'lecpage' && live.provider === 'http') processors = [lecpageProcessor(days, deploy.keepAlive)];
  const sections = [{ id: 'hero', type: 'hero', title: meta.title }];
  if (col.steps.length) sections.push({ id: 'stations', type: 'stations', layout: 'scroll', items: col.steps.map((s) => ({ id: s.id, name: s.name, title: s.title })) });
  if (col.deck.length) sections.push({ id: 'deck', type: 'deck', slides: col.deck.map((p) => ({ page: p.page, title: p.title || '' })) });
  if (col.polls.length) sections.push({ id: 'poll', type: 'poll', title: '투표', items: col.polls });
  if (col.qa) sections.push({ id: 'qa', type: 'qa', anonymous: meta.live?.anonymous !== false });
  col.board.forEach((b) => sections.push({ id: b.id, type: 'board', categories: b.cats, allowFiles: b.allowFiles, maxFiles: b.maxFiles, moderation: b.moderation }));
  if (col.attend || features.includes('attendance')) sections.push({ id: 'attendance', type: 'attendance' });
  col.survey.forEach((s) => sections.push({ id: s.id, type: 'survey', title: '만족도 조사', url: meta.surveyUrl || '', questions: s.questions }));
  if (col.materials.length) sections.push({ id: 'materials', type: 'materials', items: col.materials.map((m) => ({ title: m.title, href: m.href, desc: m.desc })) });
  if (col.tools.length) sections.push({ id: 'tools', type: 'tools', items: col.tools.slice(0, 12) });
  return {
    meta: {
      title: meta.title || '연수', subtitle: meta.subtitle, organizer: meta.organizer, description: meta.description, contact: meta.contact,
      date: s1.date, start: s1.start, end: s1.end, venue: meta.venue, mode: meta.mode === 'blended' ? 'hybrid' : meta.mode,
      joinUrl: meta.joinUrl, shortUrl: meta.shortUrl, siteUrl: meta.siteUrl, keepUntil: meta.keepUntil,
      admin: meta.admin ? { ...meta.admin, kind } : { kind }, sessions: meta.sessions.length > 1 ? meta.sessions : [],
    },
    audience: { type: meta.audience, minor },
    design: auxDesign(theme), // 연수 정보 theme + 사이트 CSS의 --lp-*(글꼴·제목 글꼴·강조색)
    instructors: meta.instructors,
    sections, live,
    privacy: { collect, retentionDays, consent: meta.privacy?.consent !== false, processors, contact: meta.privacy?.contact || '' },
    access: { mode: meta.access || 'link' },
    deploy: { host, days, keepAlive: !!deploy.keepAlive },
  };
}
/** 바로 배포 서버가 참여 기록을 맡을 때의 처리 위탁(앱 Publish.jsx와 같은 글). days: 사이트 보관 기간(/api/info limits.days) */
export function lecpageProcessor(days = 0, keepAlive = false) {
  return { name: 'lecpage 운영자(바로 배포 서버 · Cloudflare)', contact: 'hello@lecpage.com', country: '미국 등 Cloudflare 데이터센터가 있는 국가', purpose: `강사를 대신해 사이트와 참여 기록 저장${days ? `(사이트는 마지막 ${keepAlive ? '배포나 방문' : '배포'} 뒤 ${days}일 보관)` : ''}` };
}

// ── 쪽 하나 다듬기 ─────────────────────────────────────────
/** 인라인 이벤트 처리기 하나가 문법상 맞는지(브라우저 CSP가 eval을 막으면 맞다고 봄) */
function handlerOk(code) {
  try { new Function('event', code); return true; } catch (e) { return !(e instanceof SyntaxError); }
}

/**
 * 1단계: 머리·스크립트·금지 요소. 인라인 <script>는 파일로, on* 속성은 옮길 목록으로.
 * @returns { html, scripts:{경로:글}, handlers:[{n, ev, code}], warnings }
 */
function cleanPage(html, page, files, warn) {
  const tags = scanTags(html);
  const edits = []; const scripts = {}; const handlers = [];
  const base = page === 'index.html' ? 'site' : page.replace(/\.html$/, '');
  let nInline = 0, nOn = 0;
  const scriptName = (module) => {
    nInline++;
    for (let k = nInline; ; k++) {
      const name = `assets/${base}${k > 1 ? '-' + k : ''}${module ? '.module' : ''}.js`;
      const taken = name in files || name in scripts;
      if (!taken) return name;
      if (k > 200) return `assets/${base}-inline-${nInline}.js`;
    }
  };
  for (let k = 0; k < tags.length; k++) {
    const t = tags[k];
    if (t.kind !== 'open') continue;
    if (t.name === 'meta') {
      const he = (attr(t, 'http-equiv') || '').toLowerCase();
      if (he === 'content-security-policy' || he === 'refresh' || he === 'set-cookie') { edits.push({ start: t.start, end: t.end, text: '' }); if (he !== 'content-security-policy') warn('meta-' + he, `${page}: <meta http-equiv="${he}">는 뺐어요.`); }
      continue;
    }
    if (t.name === 'base') { edits.push({ start: t.start, end: t.end, text: '' }); warn('base', `${page}: <base>는 뺐어요(경로가 바뀌어 그림·스크립트가 깨짐).`); continue; }
    if (['object', 'embed', 'applet'].includes(t.name)) { const el = elementAt(tags, k, html); edits.push({ start: t.start, end: el.end, text: '' }); warn('object', `${page}: <${t.name}>은 막혀 있어 뺐어요.`); continue; }
    if (t.name === 'script') {
      const el = elementAt(tags, k, html);
      const type = (attr(t, 'type') || '').toLowerCase().trim();
      const src = attr(t, 'src');
      if (src !== undefined) {
        if (/^(?:https?:)?\/\//i.test(src)) {
          const abs = src.startsWith('//') ? 'https:' + src : src;
          if (!LIB_SCRIPT_SOURCES.some((p) => abs.startsWith(p))) { edits.push({ start: t.start, end: el.end, text: '' }); warn('external-script', `${page}: 바깥 스크립트 ${src.slice(0, 80)}는 허용 목록에 없어 뺐어요.`); }
        }
        continue;
      }
      if (/json$|^text\/(template|x-|plain|markdown|html)/.test(type) && type !== 'importmap') continue; // 데이터(실행하지 않음)
      if (type === 'importmap') { edits.push({ start: t.start, end: el.end, text: '' }); warn('importmap', `${page}: importmap은 CSP에 막혀 뺐어요. 상대 경로로 import해 주세요.`); continue; }
      if (type && !['module', 'text/javascript', 'application/javascript', 'javascript', 'text/ecmascript'].includes(type)) continue;
      const code = html.slice(el.innerStart, el.innerEnd);
      if (!code.trim()) { edits.push({ start: t.start, end: el.end, text: '' }); continue; }
      const module = type === 'module';
      const name = scriptName(module);
      scripts[name] = code.replace(/^\s*\n/, '') + (code.endsWith('\n') ? '' : '\n');
      const keep = t.attrs.filter((a) => ['nomodule', 'crossorigin', 'referrerpolicy'].includes(a.name));
      edits.push({ start: t.start, end: el.end, text: `<script${module ? ' type="module"' : ''} src="${name}"${keep.map((a) => (a.bare ? ` ${a.name}` : ` ${a.name}="${escAttr(a.value)}"`)).join('')}></script>` });
      continue;
    }
    if (t.name === 'link') {
      const rel = (attr(t, 'rel') || '').toLowerCase(); const href = attr(t, 'href') || '';
      if (/stylesheet|preload|modulepreload/.test(rel) && /^(?:https?:)?\/\//i.test(href)) {
        let host = ''; try { host = new URL(href.startsWith('//') ? 'https:' + href : href).hostname; } catch { /* 빈 */ }
        if (!FONT_CSS_HOSTS.includes(host) && !(rel.includes('modulepreload') && LIB_SCRIPT_SOURCES.some((p) => href.startsWith(p)))) { edits.push({ start: t.start, end: t.end, text: '' }); warn('external-css', `${page}: 바깥 스타일 ${href.slice(0, 80)}는 글꼴 CDN이 아니라 뺐어요.`); }
      }
      continue;
    }
    // 인라인 이벤트 속성(onclick 등) → 옮김. javascript: 주소 → 막힘
    const on = t.attrs.filter((a) => /^on[a-z]+$/.test(a.name));
    const jsUrl = t.attrs.filter((a) => ['href', 'src', 'action', 'formaction'].includes(a.name) && /^\s*javascript:/i.test(a.value));
    let set = null;
    if (t.name === 'iframe') {
      const src = attr(t, 'src') || '';
      const yt = /^(?:https?:)?\/\/(?:www\.)?(?:youtube\.com\/embed\/|youtu\.be\/)([\w-]{6,20})(.*)$/i.exec(src);
      if (yt) { set = { src: `https://www.youtube-nocookie.com/embed/${yt[1]}${yt[2] || ''}` }; }
    }
    if (on.length || jsUrl.length || set) {
      set = set || {};
      const list = [];
      for (const a of on) {
        if (!handlerOk(a.value)) { warn('inline-handler-bad', `${page}: <${t.name} ${a.name}>의 코드가 문법에 맞지 않아 뺐어요.`); set[a.name] = null; continue; }
        list.push({ ev: a.name.slice(2), code: a.value }); set[a.name] = null;
      }
      for (const a of jsUrl) { set[a.name] = a.name === 'href' ? '#' : null; warn('javascript-url', `${page}: javascript: 주소는 CSP에 막혀 뺐어요. 버튼과 addEventListener로 바꿔 주세요.`); }
      if (list.length) { nOn++; set['data-lpk-on'] = String(nOn); handlers.push({ n: nOn, tag: t.name, list }); }
      edits.push({ start: t.start, end: t.end, text: rewriteOpen(t, { set }) });
    }
  }
  if (handlers.length) warn('inline-handler', `${page}: 인라인 이벤트 속성(onclick 등) ${handlers.reduce((a, h) => a + h.list.length, 0)}개는 CSP에 막혀 assets/${base}-events.js로 옮겼어요. 다음부터는 addEventListener로 써 주세요.`);
  return { html: applyEdits(html, edits), scripts, handlers };
}

/** 옮긴 이벤트 처리기 파일(defer로 마지막에 실림) */
function handlersJs(handlers) {
  const body = handlers.map((h) => `${h.n}:{${h.list.map((x) => `${JSON.stringify(x.ev)}:function(event){${x.code}\n}`).join(',')}}`).join(',\n');
  return `/* lecpage가 옮긴 인라인 이벤트 처리기(CSP 때문에). 사이트 코드에서는 addEventListener를 써 주세요. */
(function(){var H={${body}};
document.querySelectorAll('[data-lpk-on]').forEach(function(el){var h=H[el.getAttribute('data-lpk-on')];if(!h)return;Object.keys(h).forEach(function(t){var f=h[t];
if(t==='load'&&el===document.body){window.addEventListener('load',function(e){f.call(el,e)});return;}
el.addEventListener(t,function(e){if(f.call(el,e)===false)e.preventDefault();});});});})();
`;
}

/**
 * 2단계: 자리 표시 펼치기·실습 단계. 모은 것은 col에 더함.
 * ctx: { meta, words, live, code, material, files, minor, uploads, provider, materials }
 */
function expandPage(html, page, ctx, col, warn) {
  const tags = scanTags(html);
  const edits = []; const covered = [];
  const inside = (pos) => covered.some(([a, b]) => pos > a && pos < b);
  for (let k = 0; k < tags.length; k++) {
    const t = tags[k];
    if (t.kind !== 'open') continue;
    const type = attr(t, 'data-lp');
    const step = attr(t, 'data-lp-step');
    if (type === undefined && step === undefined) continue;
    if (inside(t.start)) { warn('nested', `${page}: 자리 표시 안의 자리 표시(${type || 'step'})는 펼치지 않았어요.`); continue; }
    const el = elementAt(tags, k, html);
    if (step !== undefined) {
      if (type !== undefined) warn('step-and-lp', `${page}: data-lp-step과 data-lp를 한 요소에 같이 쓰지 말아 주세요.`);
      const n = col.steps.length + 1;
      let id = W.kitSlug(step, `s${n}`); while (col.steps.some((s) => s.id === id)) id += '-' + n;
      const inner = html.slice(el.innerStart, el.innerEnd);
      const h = /<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/i.exec(inner);
      const title = String(attr(t, 'data-title') || (h ? textOf(h[1]) : '') || `${n}단계`).replace(/\s+/g, ' ').trim().slice(0, 100);
      const name = title.replace(/^\s*\d+\s*단계\s*[:.·]\s*/, '').slice(0, 30) || title.slice(0, 30);
      // 실습 시간(분): 강사 화면의 타이머 단추로(교재에 적힌 시간만)
      const mv = attr(t, 'data-minutes'), minutes = mv !== undefined && /^\s*\d{1,3}\s*$/.test(mv) && +mv >= 1 && +mv <= 600 ? +mv : 0;
      if (mv !== undefined && !minutes) warn('step-minutes', `${page}: 실습 단계 "${title}"의 data-minutes는 1~600 사이 숫자(분)로 써 주세요.`);
      col.steps.push({ id, name, title, page, ...(minutes ? { minutes } : {}) });
      const curId = attr(t, 'id');
      const set = { 'data-st': id, 'data-title': title };
      if (!curId) set.id = `st-${id}`;
      edits.push({ start: t.start, end: t.end, text: rewriteOpen(t, { set, addClass: 'lp-st' }) + (curId && curId !== `st-${id}` ? `<span class="lpk-anchor" id="st-${escAttr(id)}"></span>` : '') });
      if (el.empty) warn('step-empty', `${page}: 실습 단계 "${title}"가 비었어요.`);
      else edits.push({ start: el.innerEnd, end: el.innerEnd, text: W.stepFooter() });
      continue;
    }
    if (!W.KIT_TYPES.includes(type)) { warn('unknown-lp', `${page}: 모르는 자리 표시 data-lp="${String(type).slice(0, 20)}"는 그대로 뒀어요(쓸 수 있는 값: ${W.KIT_TYPES.join(', ')}).`); continue; }
    if (el.empty && !['div', 'section', 'aside', 'article', 'span', 'p', 'nav', 'figure'].includes(t.name)) { warn('lp-void', `${page}: data-lp="${type}"는 <div>에 써 주세요.`); continue; }
    const r = widgetFor(type, t, html.slice(el.innerStart, el.innerEnd), ctx, col, page, warn);
    if (r === null) continue;
    const id = attr(t, 'id') ? null : `lpk-${type}${col.count[type] > 1 ? '-' + col.count[type] : ''}`;
    // 설정 속성(JSON 등)은 펼친 뒤 뺌(data-lp는 남겨 검수·앱이 자리를 찾게)
    const strip = Object.fromEntries(['data-question', 'data-options', 'data-kind', 'data-id', 'data-prompt', 'data-categories', 'data-files', 'data-moderation', 'data-questions', 'data-pages', 'data-items', 'data-answer', 'data-page'].map((a) => [a, null]));
    const open = rewriteOpen(t, { set: { ...strip, 'data-lpk': type, ...(id ? { id } : {}) }, addClass: r.cls || `lpk lpk-w lpk-${type}` });
    edits.push({ start: t.start, end: el.end, text: `${open}${r.html}</${t.name}>` });
    covered.push([t.start, el.end]);
  }
  return applyEdits(html, edits);
}

/** 자리 표시 하나 → { html, cls } (null이면 그대로 둠) */
function widgetFor(type, t, inner, ctx, col, page, warn) {
  col.count[type] = (col.count[type] || 0) + 1;
  const n = col.count[type];
  const live = ctx.liveOn;
  const where = `${page}: data-lp="${type}"`;
  switch (type) {
    case 'qa':
      if (!live) return { html: W.liveOffNote('qa') }; // 참여 기능 없이: 보내지지 않는 입력 칸을 두지 않음
      col.qa = true;
      return { html: W.qaBox({ id: `lpk-qa${n > 1 ? '-' + n : ''}`, anonymous: ctx.anonymous, live }) };
    case 'poll': {
      if (!live) return { html: W.liveOffNote('poll') };
      const q = String(attr(t, 'data-question') || '').replace(/\s+/g, ' ').trim().slice(0, 200);
      const kind = ['choice', 'word', 'scale'].includes(attr(t, 'data-kind')) ? attr(t, 'data-kind') : 'choice';
      const o = W.optionList(attr(t, 'data-options'));
      if (o.error) warn('poll-options-json', `${where}의 data-options를 JSON으로 읽지 못했어요(${o.error}). 예: data-options='["예","아니요"]'`);
      const options = (o.value || []).slice(0, 10);
      if (!q) warn('poll-question', `${where}에 data-question이 없어요.`);
      if (kind === 'choice' && (options.length < 2 || options.length > 6)) warn('poll-options-count', `${where}: 보기는 2~6개여야 해요(지금 ${options.length}개).`);
      let id = W.kitSlug(attr(t, 'data-id'), `p${col.polls.length + 1}`); while (col.polls.some((p) => p.id === id)) id += '-' + (col.polls.length + 1);
      const item = { id, question: q || `투표 ${col.polls.length + 1}`, kind, options: kind === 'word' ? [] : options };
      col.polls.push(item);
      // 교재 쪽(data-page: 강사 화면이 쪽 순서로 보이고 그 쪽에서 바로 열게)·퀴즈 정답(data-answer: 보기 번호나 보기 글. 강사 화면에만 두고 공개할 때 보냄)
      const pv = attr(t, 'data-page'), av = attr(t, 'data-answer'), extra = {};
      if (pv !== undefined) { if (/^\s*\d{1,4}\s*$/.test(pv) && +pv >= 1) extra.page = +pv; else warn('poll-page', `${where}의 data-page는 교재 쪽 번호(숫자)로 써 주세요.`); }
      if (av !== undefined && String(av).trim()) {
        const a = String(av).trim(), byNo = /^\d{1,2}$/.test(a) ? +a - 1 : -1;
        const k = kind === 'word' ? -1 : byNo >= 0 && byNo < item.options.length && !item.options.includes(a) ? byNo : item.options.indexOf(a.replace(/\s+/g, ' '));
        if (k >= 0) extra.answer = k; else warn('poll-answer', `${where}의 data-answer "${a.slice(0, 20)}"가 보기에 없어요. 보기 번호(1부터)나 보기 글 그대로 써 주세요.`);
      }
      if (Object.keys(extra).length) (col.pollExtra || (col.pollExtra = {}))[id] = extra;
      return { html: W.pollBox([item], { live, list: false, ask: item.question, host: ctx.words.host }) };
    }
    case 'board': {
      if (!live) return { html: W.liveOffNote('board') };
      const prompt = String(attr(t, 'data-prompt') || '').replace(/\s+/g, ' ').trim().slice(0, 300);
      let cats = W.DEFAULT_BOARD_CATS;
      const cv = attr(t, 'data-categories');
      if (cv) {
        const j = W.optionList(cv);
        const list = (Array.isArray(j.value) ? j.value : []).slice(0, 6);
        if (j.error) warn('board-categories-json', `${where}의 data-categories를 읽지 못했어요(${j.error}).`);
        if (list.length) cats = list.map((x, i) => ({ id: W.kitSlug(x, `c${i + 1}`), label: String(x).slice(0, 20) }));
      }
      const want = attr(t, 'data-files');
      const maxFiles = want === undefined ? 4 : Math.max(0, Math.min(8, Math.round(+want || 0)));
      const moderation = /^(1|true|yes|on)$/i.test(attr(t, 'data-moderation') || '');
      const id = `board${n > 1 ? '-' + n : ''}`;
      const files = boardFiles({ allowFiles: maxFiles > 0, maxFiles }, { audience: { minor: ctx.minor }, live: { uploads: ctx.uploads, provider: ctx.provider } });
      col.board.push({ id, cats, allowFiles: maxFiles > 0, maxFiles, moderation });
      if (n > 1) warn('board-many', `${where}: 보드가 둘 이상이면 참가자 화면은 첫 보드만 실시간으로 이어져요.`);
      return { html: `${prompt ? `<p class="lpk-prompt">${escHtml(prompt)}</p>` : ''}${W.boardBox({ cats, files, maxFiles, moderation, live })}` };
    }
    case 'attend':
      if (!live) return { html: W.liveOffNote('attend') };
      col.attend = true;
      return { html: W.attendBox({ lead: ctx.words.attendLead, after: ctx.words.attendAfter, live }) };
    case 'survey': {
      let qs = null;
      const j = W.jsonAttr(attr(t, 'data-questions'));
      if (j.error) warn('survey-json', `${where}의 data-questions를 JSON으로 읽지 못했어요(${j.error}). 기본 문항을 넣었어요.`);
      if (Array.isArray(j.value)) {
        qs = j.value.filter((q) => q && typeof q === 'object').slice(0, 20).map((q) => {
          const kind = ['scale', 'choice', 'text'].includes(q.kind || q.type) ? (q.kind || q.type) : 'scale';
          return { q: String(q.q || q.question || '').replace(/\s+/g, ' ').trim().slice(0, 200), kind, options: Array.isArray(q.options) ? q.options.map((x) => String(x).slice(0, 60)).filter(Boolean).slice(0, 8) : [] };
        }).filter((q) => q.q);
        if (!qs.length) qs = null;
      }
      if (!qs) qs = surveyFor(ctx.words).map((q) => ({ ...q, options: q.options || [] }));
      const id = W.kitSlug(attr(t, 'data-id'), `survey${n > 1 ? '-' + n : ''}`);
      col.survey.push({ id, questions: qs });
      if (!live) return { html: W.liveOffNote('survey') };
      // 이수 조건(설문을 내야 이수 등)은 키트가 지어 쓰지 않음: 교재·강사가 정한 조건은 AI가 사이트 글로
      return { html: `${W.surveyForm({ id, questions: qs })}${ctx.surveyUrl ? `<p class="lp-small">기관 설문도 있어요. <a class="lp-link" href="${escAttr(ctx.surveyUrl)}" target="_blank" rel="noopener">기관 설문 열기</a></p>` : ''}` };
    }
    case 'deck': {
      const avail = ctx.materialPages;
      let pages = W.parsePages(attr(t, 'data-pages'));
      if (!pages.length) pages = avail.slice();
      const missing = pages.filter((p) => !avail.includes(p));
      if (missing.length) warn('deck-missing', `${where}: 교재 쪽 그림이 없는 쪽이 있어요(${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ' …' : ''}). material/p-NNN.webp를 확인해 주세요.`);
      pages = pages.filter((p) => avail.includes(p));
      if (!pages.length) { warn('deck-empty', `${where}: 보여 줄 교재 쪽 그림이 없어요.`); return { html: '<p class="lp-note">교재 쪽 그림을 준비하면 여기서 넘겨 볼 수 있어요.</p>' }; }
      if (col.deck.length) { warn('deck-many', `${where}: 교재 넘기기는 한 사이트에 하나만 강사를 따라 넘겨요.`); }
      const info = ctx.pageInfo;
      const list = pages.map((p) => ({ page: p, src: ctx.pageSrc(p), title: info[p]?.title || '', text: info[p]?.text || '' }));
      if (!col.deck.length) col.deck = list;
      // 첫 쪽 그림 비율이 16:9와 다르면(A4 세로 자료집·4:3 슬라이드) 키트 CSS가 그 비율로 그림 칸을 잡음(--lpk-deck-ratio)
      const dim = ctx.pageSize(list[0].page);
      if (dim && dim.w > 0 && dim.h > 0 && Math.abs(dim.w / dim.h - 16 / 9) > 0.05) col.deckRatio = `${dim.w}/${dim.h}`;
      return { html: W.deckBox(list, { label: ctx.words.deck, host: ctx.words.host }) };
    }
    case 'materials': {
      const j = W.jsonAttr(attr(t, 'data-items'));
      if (j.error) warn('materials-json', `${where}의 data-items를 JSON으로 읽지 못했어요(${j.error}).`);
      const items = normMaterials([...(Array.isArray(j.value) ? j.value : []), ...(n === 1 ? ctx.materials : [])]);
      col.materials.push(...items);
      return { html: W.materialsBox(items, { inner, host: ctx.words.host }) };
    }
    case 'join':
      return { html: W.joinBox({ live, code: ctx.code, codeWord: ctx.words.code }) };
    case 'notebook':
      col.notebook = true;
      if (n > 1) warn('notebook-many', `${where}: 모음은 한 사이트에 하나면 돼요(모두 같은 모음을 보여요).`);
      return { html: W.notebookBox({ id: `lpk-nb${n > 1 ? '-' + n : ''}` }) };
    case 'dock':
      col.dockPlaced = true;
      return { html: ctx.liveOn ? `<aside class="lp-dock" data-dock hidden aria-label="참여 도구">${W.dockInner(ctx.dock)}</aside>` : '', cls: 'lpk lpk-dock lpk-dock--placed' };
    case 'now':
      col.nowPlaced = true;
      return { html: nowHtml(ctx), cls: 'lpk lpk-now lpk-now--placed' };
    case 'share':
      col.sharePlaced = true;
      return { html: W.shareButton(), cls: 'lpk lpk-share-w' };
    default: return null;
  }
}
/** 자료 주소: http(s)·사이트 안 상대 경로만 */
/** 자료실 목록 꼴 맞추기: [{ title, href, desc, kind, size }] (60개까지, 이름 없는 것 빼기) */
function normMaterials(list = []) {
  return list.filter((m) => m && typeof m === 'object').slice(0, 60).map((m) => ({
    title: String(m.title || m.name || '').trim().slice(0, 100), href: safeHref(m.href || m.url || ''), desc: String(m.desc || '').trim().slice(0, 200), kind: String(m.kind || '').toUpperCase().slice(0, 8), size: String(m.size || '').slice(0, 20),
  })).filter((m) => m.title);
}
function safeHref(v) {
  const s = String(v || '').trim();
  if (/^https?:\/\//i.test(s)) { try { return new URL(s).href; } catch { return ''; } }
  // 자료실 파일: 이름의 빈칸은 %20으로(활동지 1.pdf처럼 강사가 올린 이름 그대로 받게)
  if (/^(?:assets\/)?files\/[^"'<>\n\r\t]+$/.test(s) && !s.includes('..')) return s.replace(/ /g, '%20');
  return '';
}
function nowHtml(ctx) {
  const phase = ctx.phaseText ? `<div class="lp-now lp-phase" data-phase-bar hidden>${W.phaseInner(ctx.phaseText)}</div>` : '';
  return `${ctx.liveOn ? `<div class="lp-now" data-now hidden>${W.nowInner()}</div>` : ''}${phase}`;
}

/** 사이트 안 바깥 링크(접속 확인 쪽이 열리는지 재는 실습 도구) */
function externalTools(pages) {
  const seen = new Map();
  for (const html of pages) {
    for (const t of scanTags(html)) {
      if (t.kind !== 'open' || t.name !== 'a') continue;
      const href = attr(t, 'href') || '';
      if (!/^https:\/\//i.test(href)) continue;
      let host; try { host = new URL(href).hostname; } catch { continue; }
      if (seen.has(host) || /(^|\.)(youtube\.com|youtu\.be|lecpage\.com)$/.test(host)) continue;
      seen.set(host, { name: host.replace(/^www\./, ''), url: href });
    }
  }
  return [...seen.values()];
}

/** 첫날·끝난 뒤 문구 */
function endedText(bp, words) {
  const days = (bp.meta.sessions?.length ? bp.meta.sessions.map((s) => s.date) : [bp.meta.date]).filter(Boolean).sort();
  const last = days[days.length - 1];
  if (!last) return '';
  const [y, m, d] = last.split('-').map(Number);
  return words.endedOn(`${y}. ${m}. ${d}.`);
}

/**
 * 조립.
 * @param site { 경로: 글|Uint8Array } — index.html 필수, assets/*, material/p-NNN.webp, files/*
 * @param meta lecpage.json(객체·글). 강사 칸은 opts.prev(강사 값)에서만 받음
 * @param opts { runtime:{read(path)}(필수), preview:false, target:'zip'|'hosted'|'preview', prev:null, today:'YYYY-MM-DD',
 *               material:{ pages:[{page,title,text}] }, materials:[{title,href,desc,size}],
 *               host: 배포할 곳(decide/infra.js HOSTS의 id: 'lecpage'(바로 배포)·'cloudflare'·'vercel'·'github-pages'·'netlify'·'onpod'·'lan'(노트북 서버)·'server'·'zip'…),
 *               hostDays: 바로 배포 사이트 보관 기간(/api/info limits.days), keepAlive: 방문이 보관 기간을 늘리는지(/api/info keepAlive) }
 *   host가 있으면 개인정보 안내(처리 위탁·보관 기간·국외 이전·사이트를 보내 주는 곳)와 운영안내가 그 방식에 맞게 바뀜
 * @returns { files, warnings:[{code,message_ko}], meta, collected, blueprint, csp, report, teacher:{'운영안내.md'}, preflight:[{code,message_ko}] }
 */
export function assemble(site, meta0, opts = {}) {
  const runtime = opts.runtime;
  if (!runtime || typeof runtime.read !== 'function') throw new Error('assemble(): runtime.read 함수가 필요해요.');
  const read = (p) => { try { return runtime.read(p); } catch { return ''; } };
  const warnings = [];
  const warn = (code, message_ko) => { if (!warnings.some((w) => w.message_ko === message_ko)) warnings.push({ code, message_ko }); };

  const r = readMeta(meta0 && typeof meta0 === 'object' && meta0.meta && meta0.v === undefined ? meta0.meta : meta0, { prev: opts.prev || null });
  for (const e of r.errors) warn('meta-' + e.code, e.message_ko);
  for (const w of r.warnings) warn('meta-' + w.code, w.message_ko);
  const meta = r.meta;

  // 사이트 파일 받기
  const src = {};
  for (const [p0, v] of Object.entries(site || {})) {
    const p = String(p0).replace(/^\.?\//, '');
    if (siteFileOk(p)) src[p] = v;
    else if (!/(^|\/)\.[^/]*$/.test(p)) warn('file-dropped', `${p}는 사이트에 넣지 않았어요(${/\.svg$/i.test(p) ? 'SVG는 받지 않아요. png·jpg·webp로 바꿔 주세요' : ENGINE_PAGES.includes(p) || ENGINE_FILES.has(p) ? 'lecpage가 만드는 파일 이름이에요' : '형식·경로를 받지 않아요'}).`);
  }
  if (typeof src['index.html'] !== 'string' && !(src['index.html'] instanceof Uint8Array)) {
    return { files: {}, warnings: [...warnings, { code: 'no-index', message_ko: 'index.html이 없어요. 사이트의 첫 쪽을 index.html로 써 주세요.' }], meta, collected: null, blueprint: null, csp: '', report: null, errors: [{ code: 'no-index', message_ko: 'index.html이 없어요.' }] };
  }
  const pages = Object.keys(src).filter((p) => p.endsWith('.html')).sort((a, b) => (a === 'index.html' ? -1 : b === 'index.html' ? 1 : a.localeCompare(b)));
  const cssText = Object.entries(src).filter(([p]) => /\.css$/.test(p)).map(([, v]) => asText(v)).join('\n') + pages.map((p) => [...asText(src[p]).matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n')).join('\n');
  const theme = { ...themeFromCss(cssText), ...meta.theme };

  // 교재 쪽 그림
  const materialPages = Object.keys(src).map((p) => /^material\/p-(\d{3,4})\.(webp|png|jpe?g)$/i.exec(p)).filter(Boolean).map((m) => +m[1]).sort((a, b) => a - b);
  const pageFile = Object.fromEntries(Object.keys(src).map((p) => [/^material\/p-(\d{3,4})\./i.exec(p)?.[1], p]).filter(([k]) => k).map(([k, p]) => [+k, p]));
  // 쪽 제목: 교재에서 뽑은 제목(material.pages, 엉킨 것은 비움) 위에 AI가 고친 제목(lecpage.json pages)을 덮음
  const pageInfo = Object.fromEntries((opts.material?.pages || []).map((p) => [+p.page, { title: tangledTitle(p.title) ? '' : String(p.title || '').slice(0, 120), text: String(p.text || '').slice(0, 400) }]));
  for (const p of meta.pages || []) pageInfo[p.page] = { text: '', ...pageInfo[p.page], title: p.title };

  // 1단계: 쪽마다 머리·스크립트 정리
  const out = {}; const cleaned = {};
  for (const p of pages) {
    const c = cleanPage(asText(src[p]), p, src, warn);
    cleaned[p] = c;
    Object.assign(out, c.scripts);
    if (c.handlers.length) out[`assets/${p === 'index.html' ? 'site' : p.replace(/\.html$/, '')}-events.js`] = handlersJs(c.handlers);
  }

  // 미리 모으기(자리 표시만 훑어 기능 결정: 펼치기 전에 실시간 켜짐·코드가 정해져야 함)
  const pre = { qa: false, board: [], polls: [], attend: false, survey: [], steps: [], deck: [], materials: [], tools: [] };
  for (const p of pages) for (const t of scanTags(cleaned[p].html)) {
    if (t.kind !== 'open') continue;
    const ty = attr(t, 'data-lp');
    if (ty === 'qa') pre.qa = true; else if (ty === 'board') pre.board.push(1); else if (ty === 'poll') pre.polls.push(1);
    else if (ty === 'attend') pre.attend = true; else if (ty === 'survey') pre.survey.push(1);
    if (attr(t, 'data-lp-step') !== undefined) pre.steps.push(1);
  }
  const preview = !!opts.preview || opts.target === 'preview';
  const deploy = { host: typeof opts.host === 'string' ? opts.host : '', days: +opts.hostDays || 0, keepAlive: !!opts.keepAlive };
  const v0 = normAux(synthBlueprint(meta, pre, { preview, theme, deploy }));
  const words = wordsFor(v0);
  const liveOn = v0.live.provider !== 'none';
  const f = v0.live.features;
  // 출석 한 번 누르기: 학부모 설명회(audience parents)에는 붙이지 않음(이수가 없는데 '출석'이 보이면 꼭 눌러야 하는 줄 앎. render/aux-pages.js quickAttendOn과 같은 규칙)
  const quick = liveOn && f.length > 0 && !pre.attend && !f.includes('attendance') && meta.audience !== 'parents';
  const ctx = {
    meta, words, liveOn, code: v0.live.code, anonymous: v0.live.anonymous !== false, minor: v0.audience.minor, uploads: v0.live.uploads, provider: v0.live.provider,
    done: v0.meta.admin.kind === 'official' && !!(v0.meta.admin.completionRate || v0.meta.admin.hours), surveyUrl: meta.surveyUrl, materialPages, pageInfo,
    pageSrc: (n) => pageFile[n] || W.pagePath(n), pageSize: (n) => (pageFile[n] ? imageSize(src[pageFile[n]]) : null), materials: Array.isArray(opts.materials) ? opts.materials : [],
    dock: { attend: (quick || pre.attend || f.includes('attendance')) && (quick ? 'quick' : 'in'), help: f.includes('help'), qa: f.includes('qa') && pre.qa, signal: f.includes('signal'), reactions: f.includes('reactions') },
    phaseText: endedText(v0, words), // 끝난 연수 줄: 자리를 정한 '지금' 줄(data-lp="now")에도 들어가게 펼치기 전에
  };

  // 2단계: 자리 표시 펼치기
  const col = { qa: false, board: [], polls: [], attend: false, survey: [], steps: [], deck: [], materials: [], tools: [], count: {} };
  const expanded = {};
  for (const p of pages) expanded[p] = expandPage(cleaned[p].html, p, ctx, col, warn);
  col.tools = externalTools(Object.values(expanded));
  // 강사가 올린 자료(opts.materials: 앱의 [자료 추가]·교재 원본)인데 사이트에 자료실 자리 표시가 없으면: 첫 쪽 <main> 끝에 자료실 칸을 붙임
  // (참가자가 꼭 받을 수 있게. 자리를 옮기려면 AI가 <div data-lp="materials"></div>를 원하는 곳에 넣으면 그 자리로 감). 런타임이 연수 중 더한 자료도 이 칸 아래에 그림
  if (ctx.materials.length && !col.count.materials && pages.includes('index.html')) {
    const items = normMaterials(ctx.materials);
    if (items.length) {
      col.materials.push(...items);
      col.autoMaterials = `<section class="lp-sec lp-sec-materials" id="lpk-files" data-layout="files" data-frame="plain"><div class="lp-wrap"><header class="lp-head"><h2 class="lp-h2">${escHtml(words.materials || '자료')}</h2></header>${W.materialsBox(items, { host: words.host })}</div></section>`;
    }
  }

  // 기능과 자리 표시가 맞는지
  for (const [feat, has, label] of [['qa', col.qa, '질문'], ['board', col.board.length, '보드'], ['survey', col.survey.length, '설문'], ['deck', col.deck.length, '교재 넘기기'], ['attendance', col.attend, '출석']]) {
    if (meta.features.includes(feat) && !has && feat !== 'attendance') warn('feature-no-slot', `features에 ${feat}가 있는데 ${label} 자리 표시(data-lp)가 없어요.`);
  }

  // 모은 것 전부 → 보조 쪽·런타임(kit/aux-build.js)
  const vb = normAux(synthBlueprint(meta, col, { preview, theme, deploy }));
  // 배포 전 확인(운영안내.md 맨 위·check 요약): 예시 링크·지난 날짜·설문 없는 이수 조건·연습 모드·사진
  const today = /^\d{4}-\d{2}-\d{2}$/.test(opts.today || '') ? opts.today : new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const checks = preflight(src, meta, { today, provider: vb.live.provider, preview, surveyIn: col.survey.length > 0 }); // 사이트 안 설문이 연습 모드면 '연습 모드' 줄이 따로 알림
  // 사이트에 AI가 쓴 스크립트가 있나(엔진 런타임 밖의 JS): 있으면 강사 화면이 관리자 키를 그 탭에만 둠(같은 출처의 사이트 스크립트가 이 기기 저장소를 읽을 수 있어서)
  const siteJs = Object.keys(src).some((p) => /\.m?js$/i.test(p)) || pages.some((p) => cleaned[p].handlers.length || scanTags(cleaned[p].html).some((t) => t.kind === 'open' && t.name === 'script' && (attr(t, 'src') !== undefined || /^(|module|text\/javascript|application\/javascript)$/i.test((attr(t, 'type') || '').trim()))));
  kitExtras(vb, col, { siteJs, materialPages, pageSrc: ctx.pageSrc, pageInfo });
  const built = buildAux(vb, { runtime, today: opts.today, preflight: checks });
  const live = auxLive(vb);
  const sctx = { bp: vb, words, design: built.design, live };
  ctx.phaseText = endedText(vb, words);
  const data = siteData(sctx);
  // CSP: 사이트가 실제로 부르는 바깥 곳만(허용 목록 라이브러리·글꼴 CDN·영상 틀)
  const aiTexts = [...Object.values(expanded), ...Object.entries(src).filter(([p]) => /\.(css|m?js)$/.test(p)).map(([, v]) => asText(v)), ...Object.values(out).filter((v) => typeof v === 'string')];
  const csp = kitCsp(vb, { live, used: usedSources(aiTexts, { provider: vb.live.provider }) });
  Object.assign(out, built.files);
  out['assets/theme.css'] = (out['assets/theme.css'] || '') + auxThemeOverride(theme);
  out['assets/kit.css'] = `/* lecpage 키트 ${VERSION} */\n${kitVars(theme)}${col.deckRatio ? `:root{--lpk-deck-ratio:${col.deckRatio}}\n` : ''}${read('kit.css')}`;
  if (!out['assets/lecpage.js']) out['assets/lecpage.js'] = read('lecpage.js');
  if (!out['assets/qr.js']) out['assets/qr.js'] = read('vendor/qrcode.js');
  if (live && !out['assets/live.js']) warn('live-js', '참여 기능 런타임(live.js)을 만들지 못했어요.');

  // 3단계: 쪽마다 머리·꼬리 넣기
  const noindex = meta.access !== 'public';
  for (const p of pages) out[p] = finishPage(expanded[p], p, { ctx, col, data, csp, noindex, live, meta, title: meta.title, hasIcon: false });

  // 사이트 파일(쪽 말고) 그대로. 교재 쪽 그림은 쓰는 쪽만(교재 넘기기·전체 보기·<img>·링크·CSS·스크립트가 가리키는 쪽): 배포 용량·안 보여 줄 쪽을 줄임.
  // 미리보기(앱 화면)는 그대로 다 둠. 스크립트가 쪽 그림 주소를 이어 붙여 만들면(material/p- 뒤에 숫자가 없음) 다 둠
  const usedText = [...pages.map((p) => out[p]), ...Object.entries(src).filter(([p]) => /\.(css|m?js|json)$/.test(p)).map(([, v]) => asText(v)), ...Object.entries(out).filter(([p, v]) => typeof v === 'string' && /\.(css|m?js)$/.test(p)).map(([, v]) => v)].join('\n');
  const keepAll = preview || /material\/p-(?!\d{3,4}\.)/.test(usedText.replace(/material\/p-NNN/g, ''));
  // 발표 화면·강사 화면이 띄우는 교재 쪽(교재 넘기기 자리가 없으면 교재 전체)도 쓰는 쪽
  const usedPages = new Set([...col.deck.map((x) => x.page), ...(vb.kit?.deck || []).map((x) => +x[0]), ...[...usedText.matchAll(/material\/p-(\d{3,4})\.(?:webp|png|jpe?g)/gi)].map((m) => +m[1])]);
  const droppedPages = [];
  for (const [p, v] of Object.entries(src)) {
    if (p.endsWith('.html') || p in out) continue;
    const mp = /^material\/p-(\d{3,4})\.(?:webp|png|jpe?g)$/i.exec(p);
    if (mp && !keepAll && !usedPages.has(+mp[1])) { droppedPages.push(+mp[1]); continue; }
    out[p] = v;
  }

  // 응답 머리글·검색
  const kitPaths = pages.flatMap((p) => (p === 'index.html' ? ['/', '/index.html'] : [`/${p}`, `/${p.replace(/\.html$/, '')}`]));
  const auxPaths = ['/console', '/screen', '/poster'].flatMap((x) => [x + '.html', x]);
  out['_headers'] = [
    '/*', '  X-Content-Type-Options: nosniff', '  Referrer-Policy: strict-origin-when-cross-origin', '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()', '  Strict-Transport-Security: max-age=31536000', ...(noindex ? ['  X-Robots-Tag: noindex, nofollow'] : []), '',
    ...kitPaths.flatMap((x) => [x, `  Content-Security-Policy: ${csp}`, '']),
    ...auxPaths.flatMap((x) => [x, "  Content-Security-Policy: frame-ancestors 'none'", '  X-Frame-Options: DENY', ...(/^\/(console|screen)/.test(x) ? ['  Cross-Origin-Opener-Policy: same-origin'] : []), ...(noindex ? [] : ['  X-Robots-Tag: noindex, nofollow']), '']),
    ...(noindex ? [] : ['/check', '/check.html', '/privacy', '/privacy.html'].flatMap((x) => [x, '  X-Robots-Tag: noindex, nofollow', ''])),
    '/assets/*', '  X-Content-Type-Options: nosniff', '',
  ].join('\n');
  out['robots.txt'] = noindex ? 'User-agent: *\nDisallow: /\n' : 'User-agent: *\nAllow: /\n';

  // 교재 쪽 그림 경로 확인(쪽마다 <img src="material/…">)
  for (const p of pages) {
    for (const t of scanTags(out[p])) {
      if (t.kind !== 'open' || !['img', 'source'].includes(t.name)) continue;
      for (const a of ['src', 'srcset']) {
        const v = attr(t, a); if (!v) continue;
        for (const ref of a === 'srcset' ? v.split(',').map((x) => x.trim().split(/\s+/)[0]) : [v]) {
          const rp = resolvePath(ref, p);
          if (rp && !(rp in out)) warn('broken-image', `${p}: 그림 ${ref.slice(0, 80)}가 사이트에 없어요.`);
          if (/^https?:/i.test(ref)) warn('external-image', `${p}: 바깥 그림 ${ref.slice(0, 80)}는 CSP에 막혀요. assets/img/에 넣고 상대 경로로 써 주세요.`);
        }
      }
    }
  }

  const collected = {
    polls: col.polls, steps: col.steps.map(({ id, name, title }) => ({ id, name, title })), deck: col.deck.map((x) => x.page), untitled: col.deck.filter((x) => !x.title).map((x) => x.page), qa: col.qa, board: col.board, attend: col.attend,
    survey: col.survey, materials: col.materials, tools: col.tools, liveFeatures: vb.live.features, provider: vb.live.provider, code: vb.live.code,
  };
  const report = { pages, files: Object.keys(out).length, sizeKB: Math.round(Object.values(out).reduce((a, v) => a + enc(v), 0) / 1024), live: live ? vb.live.provider : 'none', features: vb.live.features, ...(droppedPages.length ? { droppedPages: droppedPages.sort((a, b) => a - b) } : {}), host: deploy.host };
  // 강사용 파일(올리지 않음): 연수 전·중·후 할 일(강사 화면 도움말과 같은 글)
  const teacher = built.teacher;
  return { files: out, warnings, errors: [], meta, collected, blueprint: vb, csp, report, words, teacher, preflight: checks };
}

/**
 * 보조 쪽 모양(normAux가 아는 칸만 남김)에 키트가 모은 것을 더함: 투표의 교재 쪽·퀴즈 정답, 실습 시간(분),
 * 발표 화면이 띄울 교재 쪽 그림(교재 넘기기가 있으면 그 쪽들, 없으면 교재 쪽 그림 전부), 모음 위젯·사이트 스크립트 여부.
 * shell.js(#lp-data·#lp-blueprint)가 읽음. 정답은 강사 화면에만 실림
 */
function kitExtras(vb, col, { siteJs, materialPages, pageSrc, pageInfo }) {
  const px = col.pollExtra || {};
  for (const s of vb.sections) {
    if (s.type === 'poll') s.items = s.items.map((p) => (px[p.id] ? { ...p, ...px[p.id] } : p));
    if (s.type === 'stations') s.items = s.items.map((x) => { const st = col.steps.find((c) => c.id === x.id); return st?.minutes ? { ...x, minutes: st.minutes } : x; });
  }
  const list = col.deck.length ? col.deck.map((x) => x.page) : materialPages.slice(0, 400);
  vb.kit = { siteJs: !!siteJs, notebook: !!col.notebook, deck: list.map((n) => [n, pageSrc(n), String(pageInfo[n]?.title || '').slice(0, 80)]) };
}

/** 쪽 하나 마무리: CSP·머리 태그·키트 CSS·'지금' 줄·키트 부품·#lp-data·런타임 */
function finishPage(html, page, { ctx, col, data, csp, noindex, live, title }) {
  let s = html;
  const tags = scanTags(s);
  const edits = [];
  const find = (name, kind = 'open') => tags.find((t) => t.kind === kind && t.name === name);
  const htmlT = find('html'), head = find('head'), headEnd = find('head', 'close'), body = find('body'), bodyEnd = tags.filter((t) => t.kind === 'close' && t.name === 'body').pop();
  const mainEnd = tags.filter((t) => t.kind === 'close' && t.name === 'main').pop();
  const has = (pred) => tags.some((t) => t.kind === 'open' && pred(t));
  const metaCharset = has((t) => t.name === 'meta' && hasAttr(t, 'charset'));
  const viewport = has((t) => t.name === 'meta' && attr(t, 'name') === 'viewport');
  const hasIcon = has((t) => t.name === 'link' && /icon/.test(attr(t, 'rel') || ''));
  const firstStyle = tags.find((t) => t.kind === 'open' && ((t.name === 'link' && /stylesheet/.test(attr(t, 'rel') || '')) || t.name === 'style'));
  const headTop = [
    metaCharset ? '' : '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${escAttr(csp)}">`,
    '<meta name="referrer" content="strict-origin-when-cross-origin">',
    viewport ? '' : '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    noindex ? '<meta name="robots" content="noindex, nofollow">' : '',
    `<meta name="generator" content="lecpage ${VERSION}">`,
    hasIcon ? '' : '<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">',
  ].filter(Boolean).join('\n');
  const kitCss = '<link rel="stylesheet" href="assets/kit.css">';
  // <html>: lang·키트 표시
  if (htmlT) edits.push({ start: htmlT.start, end: htmlT.end, text: rewriteOpen(htmlT, { set: { ...(attr(htmlT, 'lang') ? {} : { lang: 'ko' }), 'data-lpk': '1' } }) });
  // 머리: charset 다음(없으면 head 맨 앞)에 CSP 등, 첫 스타일 앞에 키트 CSS(사이트 CSS가 뒤에 와서 키트를 고쳐 쓸 수 있게)
  const charsetT = tags.find((t) => t.kind === 'open' && t.name === 'meta' && hasAttr(t, 'charset'));
  const doctype = tags.find((t) => t.kind === 'decl' && t.name === 'doctype');
  const at = charsetT ? charsetT.end : head ? head.end : htmlT ? htmlT.end : doctype ? doctype.end : 0;
  edits.push({ start: at, end: at, text: '\n' + headTop + (firstStyle && firstStyle.start > at ? '' : '\n' + kitCss) + '\n' });
  if (firstStyle && firstStyle.start > at) edits.push({ start: firstStyle.start, end: firstStyle.start, text: kitCss + '\n' });
  // 몸: 실습 단계가 있으면 data-stations(키트), '지금' 줄(자리를 정하지 않았으면 맨 앞)
  const stepsHere = /data-st="/.test(s);
  if (body) {
    const set = stepsHere ? { 'data-stations': 'kit', 'data-layout': 'kit' } : {};
    edits.push({ start: body.start, end: body.end, text: (Object.keys(set).length ? rewriteOpen(body, { set }) : s.slice(body.start, body.end)) + (col.nowPlaced ? '' : `\n<div class="lpk lpk-now">${nowHtml(ctx)}</div>`) });
  }
  // 키트가 연수 중에 더하는 칸 자리: <main> 끝(없으면 키트 부품 앞)
  const extra = `<div class="lpk lpk-extra" data-lp-extra>${page === 'index.html' && col.autoMaterials ? col.autoMaterials : ''}</div>`;
  if (mainEnd) edits.push({ start: mainEnd.start, end: mainEnd.start, text: extra });
  const f = ctx.dock;
  const chrome = [
    `<div class="lpk lpk-chrome">`,
    W.madeWith(), // 'Made with Lecpage'(참가자 쪽에만. 강사·발표 화면·안내문은 보조 쪽이라 이 길을 거치지 않음)
    W.shareDialog({ live, code: ctx.code, codeWord: ctx.words.code }),
    live ? W.joinDialog({ anonymous: ctx.anonymous, collect: data.privacy.collect, consent: data.privacy.consent, official: ctx.done, keep: data.privacy.keep, local: ctx.provider === 'local' }) : '',
    live && !col.dockPlaced ? `<aside class="lp-dock" data-dock hidden aria-label="참여 도구">${W.dockInner({ ...f, extra: col.sharePlaced ? '' : `<button class="lp-fold-btn lpk-dock-share" type="button" data-share aria-haspopup="dialog" aria-label="QR 코드로 공유" title="QR 공유">${icon('qr')}</button>` })}</aside>` : '',
    live ? '<div class="lp-reactions" data-reactions aria-hidden="true"></div>' : '',
    live && f.help ? W.helpSheet() : '',
    W.TOAST,
    '</div>',
  ].filter(Boolean).join('\n');
  const events = `assets/${page === 'index.html' ? 'site' : page.replace(/\.html$/, '')}-events.js`;
  const tail = [
    mainEnd ? '' : extra,
    chrome,
    jsonScript('lp-data', data),
    /data-lpk-on="/.test(s) ? `<script src="${events}" defer></script>` : '',
    live ? '<script src="assets/live.js" defer></script>' : '',
    '<script src="assets/lecpage.js" defer></script>',
  ].filter(Boolean).join('\n');
  const endAt = bodyEnd ? bodyEnd.start : s.length;
  edits.push({ start: endAt, end: endAt, text: '\n' + tail + '\n' });
  s = applyEdits(s, edits);
  if (!/^\s*<!doctype html/i.test(s)) s = '<!doctype html>\n' + s;
  return s;
}

// ── 미리보기: 조립 결과를 한 장 HTML로(앱의 숨은 틀·미리보기 틀에 srcdoc으로 넣음) ──
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', svg: 'image/svg+xml', pdf: 'application/pdf', mp3: 'audio/mpeg', mp4: 'video/mp4', webm: 'video/webm', woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf', json: 'application/json' };
function dataUrl(path, data) {
  const type = MIME[(path.split('.').pop() || '').toLowerCase()] || 'application/octet-stream';
  if (typeof data === 'string') return `data:${type};charset=utf-8,${encodeURIComponent(data)}`;
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data); let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return `data:${type};base64,${btoa(bin)}`;
}
/**
 * 미리보기 한 장 HTML의 CSP: 밖으로 아무것도 보내지 않음(connect-src 'none', 참여 기능은 연습 모드로만), 그림·글꼴은 안에 담은 data:,
 * 스크립트는 안에 넣은 것과 허용 목록 라이브러리, 글꼴 CDN·영상 틀만. 사이트 CSP(kitCsp)와 따로(미리보기는 앱 안의 틀이라 'self'가 없음)
 */
export function previewCsp() {
  return [
    "default-src 'none'",
    `script-src 'unsafe-inline' ${LIB_SCRIPT_SOURCES.join(' ')}`,
    `style-src 'unsafe-inline' ${FONT_CSS_HOSTS.map((h) => 'https://' + h).join(' ')}`,
    `font-src data: ${[...new Set(Object.values(FONT_FILE_HOST))].map((h) => 'https://' + h).join(' ')}`,
    'img-src data: blob:', 'media-src data: blob:',
    "connect-src 'none'", `frame-src ${FRAME_SOURCES.join(' ')}`,
    "worker-src 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'none'",
  ].join('; ');
}
/**
 * 조립 결과(files) → 한 장 HTML. CSS·JS는 안으로, 그림·글꼴은 data: 주소로(maxImageBytes까지), 사이트 CSP meta는 미리보기 전용 CSP(previewCsp)로 바꿈.
 * @param opts { maxImageBytes: 8e6, extraHead: '', extraBody: '', phase: '' } — extraHead·extraBody: 앱이 넣을 글(예: 검수 스크립트), phase: 연수 전·중·후 모습(before|during|after)
 */
export function previewHtml(files, page = 'index.html', { maxImageBytes = 8e6, extraHead = '', extraBody = '', phase = '' } = {}) {
  let html = asText(files[page]);
  if (!html) return '<!doctype html><meta charset="utf-8"><p>미리볼 쪽이 없어요.</p>';
  let budget = maxImageBytes;
  const inline = (p) => {
    const data = files[p]; if (data === undefined) return null;
    const size = enc(data); if (size > budget) return null;
    budget -= size; return dataUrl(p, data);
  };
  const cssUrls = (css, from) => css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, q, u) => { const p = resolvePath(u, from); const d = p && !/\.css$/.test(p) ? inline(p) : null; return d ? `url("${d}")` : m; });
  const escClose = (s) => String(s).replace(/<\/(script)/gi, '<\\/$1');
  const tags = scanTags(html); const edits = [];
  for (let k = 0; k < tags.length; k++) {
    const t = tags[k]; if (t.kind !== 'open') continue;
    if (t.name === 'meta' && (attr(t, 'http-equiv') || '').toLowerCase() === 'content-security-policy') { edits.push({ start: t.start, end: t.end, text: '' }); continue; }
    if (t.name === 'link' && /stylesheet/.test(attr(t, 'rel') || '')) {
      const p = resolvePath(attr(t, 'href'), page);
      if (p && files[p] !== undefined) edits.push({ start: t.start, end: t.end, text: `<style>${cssUrls(asText(files[p]), p).replace(/<\/style/gi, '<\\/style')}</style>` });
      continue;
    }
    if (t.name === 'script' && attr(t, 'src') !== undefined) {
      const p = resolvePath(attr(t, 'src'), page); const el = elementAt(tags, k, html);
      if (p && files[p] !== undefined) edits.push({ start: t.start, end: el.end, text: `<script${(attr(t, 'type') || '') === 'module' ? ' type="module"' : ''}>${escClose(asText(files[p]))}</script>` });
      continue;
    }
    if (t.name === 'style') { const el = elementAt(tags, k, html); edits.push({ start: el.innerStart, end: el.innerEnd, text: cssUrls(html.slice(el.innerStart, el.innerEnd), page) }); continue; }
    const set = {};
    for (const a of ['src', 'poster', 'href']) {
      const v = attr(t, a); if (!v || (a === 'href' && !/\.(png|jpe?g|webp|gif|avif|svg)$/i.test(v))) continue;
      const p = resolvePath(v, page); if (!p || /\.(css|js|html)$/.test(p)) continue;
      const d = inline(p); if (d) set[a] = d;
    }
    const ss = attr(t, 'srcset');
    if (ss) set.srcset = ss.split(',').map((x) => { const [u, ...rest] = x.trim().split(/\s+/); const p = resolvePath(u, page); const d = p && inline(p); return [d || u, ...rest].join(' '); }).join(', ');
    if (t.attrs.some((a) => a.name === 'style' && /url\(/.test(a.value))) set.style = cssUrls(attr(t, 'style'), page);
    if (Object.keys(set).length) edits.push({ start: t.start, end: t.end, text: rewriteOpen(t, { set }) });
  }
  html = applyEdits(html, edits);
  // 참가자 쪽의 lecpage.js는 QR(assets/qr.js)을 필요할 때 따로 불러요. 미리보기 틀(한 장 HTML)에서는 그 주소가 열리지 않으니 미리 안에 담아 둠
  if (files['assets/qr.js'] !== undefined && /\bassets\/lecpage\.js\b/.test(asText(files[page])) && !/\bassets\/qr\.js\b/.test(asText(files[page]))) {
    const qr = `<script>${escClose(asText(files['assets/qr.js']))}</script>`;
    html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, () => qr + '</head>') : qr + html;
  }
  // 발표 화면·강사 화면이 띄우는 교재 쪽 그림(#lp-blueprint deck)도 남은 크기만큼 담음(미리보기 틀에서는 상대 경로가 열리지 않음)
  html = html.replace(/(<script type="application\/json" id="lp-blueprint">)([\s\S]*?)(<\/script>)/, (m, a, json, b) => {
    let bp; try { bp = JSON.parse(json); } catch { return m; }
    if (!Array.isArray(bp.deck) || !bp.deck.length) return m;
    bp.deck = bp.deck.map((x) => { const p = Array.isArray(x) && resolvePath(String(x[1] || ''), page); const d = p && inline(p); return d ? [x[0], d, x[2]] : x; });
    return a + JSON.stringify(bp).replace(/</g, '\\u003c') + b;
  });
  const cspMeta = `<meta http-equiv="Content-Security-Policy" content="${escAttr(previewCsp())}">`;
  html = /<head\b[^>]*>/i.test(html) ? html.replace(/<head\b[^>]*>/i, (m) => m + cspMeta) : cspMeta + html;
  html = html.replace(/<body\b/i, '<body data-lp-preview="1"');
  // phase(before·during·after): 연수 전·중·후 모습으로 미리 보기(런타임이 <html data-lp-phase>를 ?phase=처럼 씀)
  if (/^(before|during|after)$/.test(phase)) html = html.replace(/<html\b/i, `<html data-lp-phase="${phase}"`);
  if (extraHead) html = html.replace(/<\/head>/i, () => `${extraHead}</head>`);
  if (extraBody) { const i = html.toLowerCase().lastIndexOf('</body>'); html = i < 0 ? html + extraBody : html.slice(0, i) + extraBody + html.slice(i); }
  return html;
}
