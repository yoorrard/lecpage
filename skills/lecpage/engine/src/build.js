// 설계도 → 연수 사이트 파일 묶음. Node(skill)와 브라우저(앱) 모두에서 같은 함수를 씁니다.
// runtime.read(path): engine/runtime 아래 파일 내용을 문자열로 돌려주는 함수(환경마다 다르게 주입)
import { validate } from './validate.js';
import { resolveDesign } from './decide/design.js';
import { decideInfra } from './decide/infra.js';
import { themeCSS, themeTokens, presetWithOverrides } from './design/tokens.js';
import { getPreset } from './design/presets.js';
import { designTokens } from './design/dtcg.js';
import { renderIndex, renderConsole, renderScreen, renderCheck, renderPrivacy, renderPoster, designDoc, opsDoc } from './render/pages.js';
import { esc } from './render/html.js';
import { usedVariants } from './design/layouts.js';
import { pruneUnusedCss } from './css-prune.js';
import { deferFontLinks } from './font-bundle.js';

/** 사이트에 넣을 수 있는 사용자 자료(교재 그림·원본·사진·소리·영상) */
// 사용자 자료: 교재 쪽 그림(slides)·교재 속 그림과 원본(media)·강사가 올린 내려받기 자료(files). 스크립트·SVG·HTML은 받지 않음
export const USER_ASSET = /^(?:assets\/)?(?:slides|media|files)\/[\w가-힣ㄱ-ㅎㅏ-ㅣ.\-()\[\] ]{1,140}\.(png|jpe?g|gif|webp|avif|pdf|mp3|m4a|mp4|webm|pptx?|ppsx|docx?|hwpx?|xlsx?|csv|txt|md|zip|key|pages|numbers|odt|odp|ods)$/i;

const LIVE_FILES = { local: 'live/local.js', http: 'live/http.js', supabase: 'live/supabase.js', sheets: 'live/sheets.js' };

// fx.css에서 쓰는 효과 묶음만 남김(표지: 줄 맨 앞의 @fx:id 주석, 아이디가 별표면 공통)
export function pruneFxCss(css, ids) { return pruneMarked(css, ids, 'fx'); }
/** 표지(줄 맨 앞의 @태그:id 주석)로 나눈 CSS에서 쓰는 묶음만 남김. 별표면 늘 남김 */
export function pruneMarked(css, ids, tag) {
  const used = new Set(ids);
  return String(css || '').split(new RegExp(`^(?=\\/\\*@${tag}:)`, 'm')).filter((chunk, i) => {
    const m = new RegExp(`^\\/\\*@${tag}:(.*?)\\*\\/`).exec(chunk);
    if (!m) return i === 0;
    const list = m[1].trim().split(/[\s,]+/).filter(Boolean);
    return list.includes('*') || list.some((x) => used.has(x));
  }).join('');
}

/**
 * 내 달력에 넣기(iCalendar 한 건): 연수 날짜와 시작 시각을 알 때만(한국 시각 → 세계 표준시로 적어 어느 달력에서나 같은 시각).
 * 끝 시각이 없으면 끝을 적지 않음(길이를 지어내지 않음)
 */
export function icsFile(meta = {}, today = '') {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(meta.date || ''), t = (x) => /^(\d{1,2}):(\d{2})$/.exec(x || '');
  if (!d || !t(meta.start)) return '';
  const utc = (hm) => { const x = new Date(Date.UTC(+d[1], +d[2] - 1, +d[3], +t(hm)[1] - 9, +t(hm)[2])); return x.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); };
  const txt = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/[,;]/g, (c) => '\\' + c);
  const stamp = (/^\d{4}-\d{2}-\d{2}/.exec(today || new Date().toISOString())?.[0] || '2026-01-01').replace(/-/g, '') + 'T000000Z';
  let h = 2166136261; for (const c of `${meta.title}|${meta.date}|${meta.start}`) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  const end = t(meta.end) && utc(meta.end) > utc(meta.start) ? `DTEND:${utc(meta.end)}` : '';
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//lecpage//KO', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:${(h >>> 0).toString(36)}-${d[1]}${d[2]}${d[3]}@lecpage`, `DTSTAMP:${stamp}`, `DTSTART:${utc(meta.start)}`, end, `SUMMARY:${txt(meta.title)}`, meta.venue ? `LOCATION:${txt(meta.venue)}` : '', meta.organizer ? `DESCRIPTION:${txt(meta.organizer)}` : '', 'END:VEVENT', 'END:VCALENDAR', ''].filter((x, i, a) => x || i === a.length - 1).join('\r\n');
}

/** 사이트를 만든 날(개인정보 처리 안내의 시행일). opts.today('YYYY-MM-DD')가 없으면 오늘 */
function builtOn(today) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(today || new Date().toISOString());
  return m ? `${+m[1]}. ${+m[2]}. ${+m[3]}.` : '';
}

export function collectEffects(design, bp) {
  const ids = new Set();
  for (const v of Object.values(design.effects || {})) if (v) ids.add(v);
  for (const v of [design.graphic, design.closingGraphic, design.signature]) if (v) ids.add(v);
  if (design.motion > 0) ids.add('reveal-up');
  if (bp.sections.some((s) => s.type === 'stations')) ids.add('micro-copy');
  return [...ids];
}

function favicon(design) {
  const p = presetWithOverrides(design);
  const t = themeTokens(p, p.theme, { accent: design.accent });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${esc(t['--primary'])}"/><path d="M20 18h17l9 9v19a2 2 0 0 1-2 2H20a2 2 0 0 1-2-2V20a2 2 0 0 1 2-2z" fill="${esc(t['--primary-foreground'])}" opacity=".95"/><path d="M37 18v9h9" fill="none" stroke="${esc(t['--primary'])}" stroke-width="3"/></svg>`;
}

/**
 * @param {object} input 설계도(검증 전이어도 됨)
 * @param {object} opts { runtime: {read(path)}, assets: {path: Uint8Array|string}, infra: decideInfra 입력, include: { blueprint: true, teacherFiles: false } }
 * @returns {{ files: Object<string,string|Uint8Array>, teacher: Object<string,string>, blueprint, design, warnings, errors, infra, report }}
 * files = 올릴 사이트, teacher = 강사만 볼 파일(DESIGN.md·tokens.json·운영안내.md·설계도). include.teacherFiles=true면 files에도 넣음
 */
export function build(input, opts = {}) {
  const { blueprint: bp, errors, warnings } = validate(input);
  if (errors.length) return { files: {}, blueprint: bp, errors, warnings };
  const runtime = opts.runtime;
  if (!runtime || typeof runtime.read !== 'function') throw new Error('build(): runtime.read 함수가 필요합니다.');
  const read = (p) => { try { return runtime.read(p); } catch { return ''; } };

  const design = resolveDesign(bp);
  const hasLiveSections = bp.sections.some((s) => ['qa', 'board', 'poll', 'attendance'].includes(s.type) || (s.type === 'survey' && s.questions?.length));
  const live = bp.live.provider !== 'none' && (hasLiveSections || bp.live.features.length > 0);
  const theme = themeCSS(design);
  const preset = presetWithOverrides(design);
  const themeName = design.theme && design.theme !== 'preset' ? design.theme : preset.theme;
  const tok = themeTokens(preset, themeName === 'dark' ? 'dark' : 'light', { accent: design.accent });
  const effectIds = design.motion > 0 || design.graphic ? collectEffects(design, bp) : [];
  // 빈 설문 칸(주소도, 사이트 안에서 받을 문항도 없음)은 참가자 화면에 싣지 않음(차례·바닥글 메뉴에서도 빠짐).
  // 강사 미리보기(opts.preview)에서는 '채울 곳'으로 남겨 무엇을 넣으면 되는지 보임
  const emptySurvey = (s) => s.type === 'survey' && !s.url && !(s.questions?.length && live);
  const view = opts.preview || !bp.sections.some(emptySurvey) ? bp : { ...bp, sections: bp.sections.filter((s) => !emptySurvey(s)) };
  const ics = icsFile(bp.meta, opts.today);
  const ctx = { bp: view, design, live, preview: !!opts.preview, ics: !!ics, fontLinks: theme.fontLinks, themeColor: tok['--background'], hasFx: effectIds.length > 0, ogImage: opts.ogImage || '', builtOn: builtOn(opts.today) };

  const files = {};
  if (ics) files['assets/event.ics'] = ics;
  files['index.html'] = renderIndex(ctx);
  files['check.html'] = renderCheck(ctx);
  files['screen.html'] = renderScreen(ctx);
  files['poster.html'] = renderPoster(ctx); // A4 QR 안내문(인쇄용) + 강사용 카드
  if (live) { files['console.html'] = renderConsole(ctx); files['privacy.html'] = renderPrivacy(ctx); }

  files['assets/theme.css'] = theme.css;
  // 본문 배치 변형의 CSS는 이 사이트에 쓰인 배치만 붙임(runtime/body.css, 표지 @v:종류.변형)
  files['assets/lecpage.css'] = read('lecpage.css') + pruneMarked(read('body.css'), usedVariants(ctx.bp.sections, design.preset, bp.structure?.flow, bp.instructors), 'v');
  files['assets/boot.js'] = read('boot.js');
  files['assets/lecpage.js'] = read('lecpage.js');
  files['assets/screen.js'] = read('screen.js');
  files['assets/check.js'] = read('check.js'); // 접속 확인 결과 그리기(+ 보조 쪽의 밝게·어둡게)
  files['assets/aux.css'] = read('aux.css');   // 보조 화면(강사·발표·안내문·접속 확인·개인정보)만 싣는 배치
  files['assets/qr.js'] = read('vendor/qrcode.js');
  files['assets/favicon.svg'] = favicon(design);
  if (live) {
    files['assets/console.js'] = read('console.js');
    files['assets/live.js'] = [read('live/core.js'), read(LIVE_FILES[bp.live.provider] || LIVE_FILES.local)].join('\n;\n');
  }

  const missingFx = [];
  if (effectIds.length) {
    const parts = [read('fx/core.js')];
    for (const id of effectIds) {
      const src = read(`fx/effects/${id}.js`);
      if (src) parts.push(src); else missingFx.push(id);
    }
    parts.push('if(window.LecFX){document.readyState!=="loading"?LecFX.start():document.addEventListener("DOMContentLoaded",function(){LecFX.start()})}');
    files['assets/fx.js'] = parts.join('\n;\n');
    files['assets/fx.css'] = pruneFxCss(read('fx/fx.css'), effectIds);
  }

  // 런타임 CSS에서 이 사이트의 쪽·스크립트 어디에도 없는 클래스·프리셋 규칙을 뺌(학교망·휴대폰에서 가볍게).
  // 모든 쪽과 스크립트를 만든 뒤에 해야 함. opts.keepAllCss면 그대로(디버깅용)
  if (!opts.keepAllCss) {
    const used = Object.entries(files).filter(([p, v]) => typeof v === 'string' && /\.(html|js)$/.test(p)).map(([, v]) => v).join('\n');
    files['assets/lecpage.css'] = pruneUnusedCss(files['assets/lecpage.css'], used);
    files['assets/aux.css'] = pruneUnusedCss(files['assets/aux.css'], used);
  }

  // 이미 연결한 참여 기능 방식은 '할 일 0번'으로 셈(같으면 추천을 따로 적지 않음)
  const linked = { sheets: 'sheets', supabase: 'supabase', http: 'cloudflare' }[bp.live?.provider];
  const infra = opts.infra ? decideInfra(linked ? { ...opts.infra, connected: [...new Set([].concat(opts.infra.connected || [], linked))] } : opts.infra) : null;
  // Netlify·Cloudflare가 읽는 응답 헤더(GitHub Pages는 무시): 강사 화면을 다른 사이트 틀(iframe)에 못 넣게.
  // Cloudflare는 /console.html을 /console로 넘기므로 두 주소 모두에 적음
  // HTTPS만(HSTS 1년, 하위 도메인은 건드리지 않음), 검색 제외(공개 범위가 '누구나'가 아니면 모든 쪽, '누구나'여도 강사용 쪽은 제외).
  // 강사 화면은 다른 창이 붙잡지 못하게(COOP). 발표 화면도 같은 값이라 강사 화면이 연 발표 창을 다시 찾아 앞으로 가져올 수 있음.
  // 쪽마다 meta CSP가 따로 있어 _headers를 읽지 않는 곳(GitHub Pages·Onpod)도 같은 정책
  const noIndex = bp.access.mode !== 'public';
  const auxPaths = ['/console', '/screen', '/poster', '/check', '/privacy'].flatMap((p) => [p + '.html', p]);
  files['_headers'] = ['/*', '  X-Content-Type-Options: nosniff', '  Referrer-Policy: strict-origin-when-cross-origin', '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()', '  Strict-Transport-Security: max-age=31536000', ...(noIndex ? ['  X-Robots-Tag: noindex, nofollow'] : []), '',
    ...['/console', '/screen', '/poster'].flatMap((p) => [p + '.html', p]).flatMap((p) => [p, "  Content-Security-Policy: frame-ancestors 'none'", '  X-Frame-Options: DENY', ...(/^\/(console|screen)/.test(p) ? ['  Cross-Origin-Opener-Policy: same-origin'] : []), ...(noIndex ? [] : ['  X-Robots-Tag: noindex, nofollow']), '']),
    ...(noIndex ? [] : auxPaths.filter((p) => /check|privacy/.test(p)).flatMap((p) => [p, '  X-Robots-Tag: noindex, nofollow', ''])),
    '/assets/*', '  X-Content-Type-Options: nosniff', ''].join('\n');
  // 검색 노출: 'public'일 때만 허용(기본은 주소·QR을 받은 사람만)
  files['robots.txt'] = bp.access.mode === 'public' ? 'User-agent: *\nAllow: /\n' : 'User-agent: *\nDisallow: /\n';
  // 강사용 파일은 올리는 사이트와 따로 돌려줌(설계도에는 강사 메일 등 공개하지 않을 값이 있을 수 있음)
  const teacher = { 'DESIGN.md': designDoc(ctx), '운영안내.md': opsDoc(ctx, infra), 'tokens.json': JSON.stringify(designTokens(design), null, 2) };
  if (opts.include?.blueprint !== false) teacher['lecpage.blueprint.json'] = JSON.stringify(bp, null, 2);
  if (opts.include?.teacherFiles) Object.assign(files, teacher);

  // 사용자 자료는 정해진 폴더·형식만(엔진이 만든 파일은 절대 덮어쓰지 않음, 스크립트·SVG·HTML 금지)
  for (const [p, data] of Object.entries(opts.assets || {})) {
    if (!USER_ASSET.test(p) || p.includes('..') || p in files) { warnings.push({ path: p, message_ko: `허용되지 않는 자료라 뺐습니다: ${p}` }); continue; }
    files[p] = data;
  }
  if (missingFx.length) warnings.push({ path: 'design.effects', message_ko: `효과 파일이 없어 뺐습니다: ${missingFx.join(', ')}` });

  deferFontLinks(files); // 글꼴 CDN이 막혀도 첫 화면이 기다리지 않게(boot.js가 받은 뒤 적용)

  const report = {
    preset: design.preset, motion: design.motion, effects: effectIds.filter((x) => !missingFx.includes(x)), live: live ? bp.live.provider : 'none',
    pages: Object.keys(files).filter((f) => f.endsWith('.html')), sizeKB: Math.round(Object.values(files).reduce((a, v) => a + (typeof v === 'string' ? new TextEncoder().encode(v).length : v.byteLength || 0), 0) / 1024),
    notes: design._notes || [],
  };
  return { files, teacher, blueprint: bp, design, warnings, errors, infra, report };
}
