// 보조 쪽(강사 화면·발표 화면·QR 안내문·접속 확인·개인정보 안내)·런타임 파일·일정 파일·강사용 운영안내.
// 조립(assemble.js)이 연수 정보와 사이트에서 모은 것(투표·실습 단계·교재 쪽·보드·설문 …)으로 '보조 쪽 모양'을 만들면
// normAux가 꼴을 맞추고 buildAux가 그립니다. AI가 쓴 참가자 쪽(index.html 등)은 여기서 그리지 않습니다.
import { themeCSS, themeTokens, presetWithOverrides } from '../design/tokens.js';
import { renderConsole, renderScreen, renderPoster, renderCheck, renderPrivacy, opsDoc } from '../render/aux-pages.js';
import { esc } from '../render/html.js';
import { pruneUnusedCss } from '../css-prune.js';
import { deferFontLinks } from '../font-bundle.js';
import { eventDays } from '../hero-meta.js';
import { wordsFor } from '../words.js';
import { str, safeUrl, makeCode } from '../util.js';
import { LIVE_FEATURE_KEYS } from './meta.js';

const LIVE_PROVIDERS = ['none', 'local', 'supabase', 'sheets', 'http'];
const LIVE_FILES = { local: 'live/local.js', http: 'live/http.js', supabase: 'live/supabase.js', sheets: 'live/sheets.js' };

const arr = (v) => (Array.isArray(v) ? v.slice(0, 200) : []);
const objs = (v) => arr(v).filter((x) => x && typeof x === 'object' && !Array.isArray(x));
const strArr = (v, max = 80) => arr(v).map((x) => str(x, max)).filter(Boolean);
const num = (v, d = 0, min = -Infinity, max = Infinity) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };
const pick = (v, allowed, d) => (allowed.includes(v) ? v : d);
const slug = (s, i) => (str(s, 40).toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-|-$/g, '') || `s${i}`);
const time = (v) => { const m = /^(\d{1,2}):(\d{2})/.exec(str(v, 8)); return m ? `${m[1].padStart(2, '0')}:${m[2]}` : ''; };
const date = (v) => { const m = /^(\d{4})[-./ ]\s*(\d{1,2})[-./ ]\s*(\d{1,2})/.exec(str(v, 20)); return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : ''; };

/** 보조 쪽이 읽는 칸(종류마다): 강사 화면 목록(#lp-blueprint)·발표 화면·접속 확인·개인정보 안내 */
const SECTION = {
  hero: (s) => ({ title: str(s.title, 160) }),
  stations: (s) => ({ items: objs(s.items).slice(0, 60).map((i, n) => ({ id: slug(i.id || i.name || i.title, n + 1), name: str(i.name, 30) || str(i.title, 30), title: str(i.title || i.name, 100) })).filter((i) => i.title) }),
  deck: (s) => ({ slides: objs(s.slides).slice(0, 400).map((sl, n) => ({ page: num(sl.page, n + 1, 1, 9999), title: str(sl.title, 120) })) }),
  poll: (s) => ({ items: objs(s.items).slice(0, 20).map((p, n) => ({ id: slug(p.id, n + 1), question: str(p.question, 200), kind: pick(p.kind, ['choice', 'word', 'scale'], 'choice'), options: strArr(p.options, 60).slice(0, 10) })).filter((p) => p.question) }),
  qa: (s) => ({ anonymous: s.anonymous !== false }),
  board: (s) => ({ categories: objs(s.categories).slice(0, 6).map((c, n) => ({ id: slug(c.id || c.label, n + 1), label: str(c.label, 20) })).filter((c) => c.label), allowFiles: s.allowFiles !== false, maxFiles: num(s.maxFiles, 4, 0, 8), moderation: !!s.moderation }),
  attendance: () => ({}),
  survey: (s) => ({ url: safeUrl(s.url), questions: objs(s.questions).slice(0, 20).map((q) => ({ q: str(q.q, 200), kind: pick(q.kind, ['scale', 'choice', 'text'], 'scale'), options: strArr(q.options, 60).slice(0, 8) })).filter((q) => q.q) }),
  materials: (s) => ({ items: objs(s.items).map((i) => ({ title: str(i.title, 100), desc: str(i.desc, 300), href: safeUrl(i.href ?? i.url) })).filter((i) => i.title) }),
  tools: (s) => ({ items: objs(s.items).map((i) => ({ name: str(i.name, 40), url: safeUrl(i.url) })).filter((i) => i.name) }),
};
/** 목록이 비면 빼는 칸 */
const LIST = { stations: 'items', deck: 'slides', poll: 'items', materials: 'items', tools: 'items' };

/**
 * 보조 쪽 모양 다듬기(assemble.js synthBlueprint의 결과 → 보조 쪽이 읽는 꼴). 빈 칸은 기본값, 모르는 값은 버림.
 * @returns { meta, audience, design, instructors, sections, live, privacy, access }
 */
export function normAux(b) {
  const m = b.meta || {};
  const meta = {
    title: str(m.title, 160) || '연수', subtitle: str(m.subtitle, 400), organizer: str(m.organizer, 120),
    date: date(m.date), start: time(m.start), end: time(m.end), venue: str(m.venue, 120),
    mode: pick(m.mode, ['offline', 'online', 'hybrid'], 'offline'), joinUrl: safeUrl(m.joinUrl), shortUrl: safeUrl(m.shortUrl), siteUrl: safeUrl(m.siteUrl),
    lang: 'ko', description: str(m.description, 300), contact: str(m.contact, 120),
    // 사이트 보관 끝 예정일(배포할 곳이 정함, 예: 바로 배포 60일). 강사 화면 머리에 '사이트는 X월 X일까지'
    ...(date(m.keepUntil) ? { keepUntil: date(m.keepUntil) } : {}),
    admin: { kind: pick(m.admin?.kind, ['school', 'official', 'conference', 'student'], 'school'), completionRate: num(m.admin?.completionRate, 0, 0, 100), hours: num(m.admin?.hours, 0, 0, 200) },
    sessions: arr(m.sessions).map((s, n) => ({ no: num(s.no, n + 1, 1, 999), date: date(s.date), start: time(s.start), end: time(s.end), title: str(s.title, 120) })),
  };
  const a = b.audience || {};
  const audience = { type: str(a.type, 40) || 'teachers', size: num(a.size, 30, 1, 100000), blocked: strArr(a.blocked, 80).slice(0, 30), minor: !!a.minor };
  const instructors = objs(b.instructors).slice(0, 12).map((p) => ({ name: str(p.name, 40), role: str(p.role, 80), org: str(p.org, 80) })).filter((p) => p.name);
  const lv = b.live || {};
  const live = {
    provider: pick(lv.provider, LIVE_PROVIDERS, 'none'), url: safeUrl(lv.url), anonKey: str(lv.anonKey, 400),
    code: (str(lv.code, 12).toUpperCase().replace(/[^A-Z0-9]/g, '') || makeCode(meta.title + meta.date)),
    features: strArr(lv.features, 20).filter((f) => LIVE_FEATURE_KEYS.includes(f)), anonymous: lv.anonymous !== false, pollMs: num(lv.pollMs, 7000, 3000, 60000),
    // 서버가 보드 파일을 받는지. 없으면 구글 시트만 꺼짐(시트에서 '파일 올리기 켜기'를 눌렀으면 true)
    ...(typeof lv.uploads === 'boolean' ? { uploads: lv.uploads } : {}),
  };
  const pv = b.privacy || {};
  const privacy = { collect: strArr(pv.collect, 20).filter((c) => ['nickname', 'name', 'school', 'email'].includes(c)), retentionDays: num(pv.retentionDays, 30, 1, 365), consent: pv.consent !== false, processors: objs(pv.processors).slice(0, 10).map((x) => ({ name: str(x.name, 60), contact: str(x.contact, 120), country: str(x.country, 40), purpose: str(x.purpose, 120) })), contact: str(pv.contact, 120) };
  if (!privacy.collect.length || audience.minor) privacy.collect = ['nickname']; // 만 14세 미만은 별명만
  const access = { mode: pick(b.access?.mode, ['link', 'public', 'password'], 'link') };
  const seen = new Set(), sections = [];
  arr(b.sections).forEach((s, i) => {
    if (!s || typeof s !== 'object' || !SECTION[s.type]) return;
    let id = slug(s.id || s.type, i + 1);
    while (seen.has(id)) id += '-' + (i + 1);
    seen.add(id);
    const out = { id, type: s.type, title: str(s.title, 160), ...SECTION[s.type](s) };
    if (LIST[s.type] && !out[LIST[s.type]].length) return;
    sections.push(out);
  });
  return { meta, audience, design: b.design || {}, instructors, sections, live, privacy, access };
}

/**
 * 내 달력에 넣기(iCalendar 한 건): 연수 날짜와 시작 시각을 알 때만(한국 시각 → 세계 표준시로 적어 어느 달력에서나 같은 시각).
 * 끝 시각이 없으면 끝을 적지 않음(길이를 지어내지 않음). 연수 날 사이트·온라인 입장으로 돌아올 주소(아는 것만)와 30분 전 알림.
 * 사이트 주소를 조립 때 모르면 참가자 화면(lecpage.js)이 내려받을 때 지금 주소를 넣음. 긴 줄은 75바이트에서 접음(RFC 5545)
 */
export function icsFile(meta = {}, today = '') {
  const t = (x) => /^(\d{1,2}):(\d{2})$/.exec(x || '');
  // 연수 날(하루 또는 여러 날, hero-meta.js eventDays — QR 안내문과 같은 날짜). 시작 시각을 아는 날만 한 건씩
  const days = eventDays(meta).filter((x) => t(x.start));
  if (!days.length) return '';
  const txt = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/[,;]/g, (c) => '\\' + c);
  const stamp = (/^\d{4}-\d{2}-\d{2}/.exec(today || new Date().toISOString())?.[0] || '2026-01-01').replace(/-/g, '') + 'T000000Z';
  let h = 2166136261; for (const c of `${meta.title}|${meta.date}|${meta.start}`) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  const web = (u) => (/^https?:\/\/[^\s]+$/i.test(u || '') ? u : '');
  const site = web(meta.siteUrl), join = meta.mode !== 'offline' ? web(meta.joinUrl) : '';
  const desc = [meta.organizer || '', site ? `연수 사이트: ${site}` : '', join ? `온라인 입장: ${join}` : ''].filter(Boolean).join('\n');
  const fold = (line) => {
    const enc = new TextEncoder(); if (enc.encode(line).length <= 75) return line;
    const out = []; let cur = '', n = 0;
    for (const ch of line) { const b = enc.encode(ch).length; if (n + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; n = 0; } cur += ch; n += b; }
    out.push(cur); return out.join('\r\n ');
  };
  const ev = days.flatMap((x) => {
    const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(x.date);
    const utc = (hm) => { const v = new Date(Date.UTC(+d[1], +d[2] - 1, +d[3], +t(hm)[1] - 9, +t(hm)[2])); return v.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); };
    const end = t(x.end) && utc(x.end) > utc(x.start) ? `DTEND:${utc(x.end)}` : '';
    return ['BEGIN:VEVENT', `UID:${(h >>> 0).toString(36)}-${d[1]}${d[2]}${d[3]}@lecpage`, `DTSTAMP:${stamp}`, `DTSTART:${utc(x.start)}`, end, `SUMMARY:${txt(meta.title)}`, meta.venue ? `LOCATION:${txt(meta.venue)}` : '', desc ? `DESCRIPTION:${txt(desc)}` : '', site ? `URL:${site}` : '',
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${txt(`${meta.title} 30분 전`)}`, 'TRIGGER:-PT30M', 'END:VALARM', 'END:VEVENT'];
  });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//lecpage//KO', 'CALSCALE:GREGORIAN', ...ev, 'END:VCALENDAR', ''].filter((x, i, a) => x || i === a.length - 1).map(fold).join('\r\n');
}

/** 사이트를 만든 날(개인정보 처리 안내의 시행일). today('YYYY-MM-DD')가 없으면 오늘 */
function builtOn(today) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(today || new Date().toISOString());
  return m ? `${+m[1]}. ${+m[2]}. ${+m[3]}.` : '';
}

function favicon(design) {
  const p = presetWithOverrides(design);
  const t = themeTokens(p, p.theme, { accent: design.accent });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${esc(t['--primary'])}"/><path d="M20 18h17l9 9v19a2 2 0 0 1-2 2H20a2 2 0 0 1-2-2V20a2 2 0 0 1 2-2z" fill="${esc(t['--primary-foreground'])}" opacity=".95"/><path d="M37 18v9h9" fill="none" stroke="${esc(t['--primary'])}" stroke-width="3"/></svg>`;
}

/** 참여 기능 서버가 필요한 칸 */
const LIVE_SECTION = (s) => ['qa', 'board', 'poll', 'attendance'].includes(s.type) || (s.type === 'survey' && s.questions?.length);
/** 참여 기능을 실제로 쓰는지(서버가 정해져 있고 기능이나 그런 칸이 있음) */
export const auxLive = (bp) => bp.live.provider !== 'none' && (bp.live.features.length > 0 || bp.sections.some(LIVE_SECTION));

/**
 * 보조 쪽·런타임 파일 만들기.
 * @param bp normAux 결과
 * @param opts { runtime:{read(path)}, today:'YYYY-MM-DD' }
 * @returns { files, teacher:{'운영안내.md'}, design, live }
 */
export function buildAux(bp, { runtime, today } = {}) {
  const read = (p) => { try { return runtime.read(p); } catch { return ''; } };
  const design = bp.design;
  const live = auxLive(bp);
  const theme = themeCSS(design);
  const preset = presetWithOverrides(design);
  const themeName = design.theme && design.theme !== 'preset' ? design.theme : preset.theme;
  const tok = themeTokens(preset, themeName === 'dark' ? 'dark' : 'light', { accent: design.accent });
  // 빈 설문 칸(주소도, 사이트 안에서 받을 문항도 없음)은 보조 쪽에서 셈하지 않음
  const emptySurvey = (s) => s.type === 'survey' && !s.url && !(s.questions?.length && live);
  const view = bp.sections.some(emptySurvey) ? { ...bp, sections: bp.sections.filter((s) => !emptySurvey(s)) } : bp;
  const ics = icsFile(bp.meta, today);
  const ctx = { bp: view, words: wordsFor(bp), design, live, fontLinks: theme.fontLinks, themeColor: tok['--background'], builtOn: builtOn(today) };

  const files = {};
  if (ics) files['assets/event.ics'] = ics;
  files['check.html'] = renderCheck(ctx);
  files['screen.html'] = renderScreen(ctx);
  files['poster.html'] = renderPoster(ctx); // A4 QR 안내문(인쇄용) + 강사용 카드
  if (live) { files['console.html'] = renderConsole(ctx); files['privacy.html'] = renderPrivacy(ctx); }
  files['assets/theme.css'] = theme.css;
  files['assets/lecpage.css'] = read('lecpage.css');
  files['assets/boot.js'] = read('boot.js');
  files['assets/lecpage.js'] = read('lecpage.js');
  files['assets/screen.js'] = read('screen.js');
  files['assets/check.js'] = read('check.js'); // 접속 확인 결과 그리기(+ 보조 쪽의 밝게·어둡게)
  files['assets/aux-pages.css'] = read('aux-pages.css'); // 보조 화면(강사·발표·안내문·접속 확인·개인정보)만 싣는 배치
  files['assets/qr.js'] = read('vendor/qrcode.js');
  files['assets/favicon.svg'] = favicon(design);
  if (live) {
    files['assets/console.js'] = read('console.js');
    files['assets/live.js'] = [read('live/core.js'), read(LIVE_FILES[bp.live.provider] || LIVE_FILES.local)].join('\n;\n');
  }
  // 런타임 CSS에서 보조 쪽·스크립트 어디에도 없는 클래스 규칙을 뺌(학교망·휴대폰에서 가볍게)
  const used = Object.entries(files).filter(([p, v]) => typeof v === 'string' && /\.(html|js)$/.test(p)).map(([, v]) => v).join('\n');
  files['assets/lecpage.css'] = pruneUnusedCss(files['assets/lecpage.css'], used);
  files['assets/aux-pages.css'] = pruneUnusedCss(files['assets/aux-pages.css'], used);
  deferFontLinks(files); // 글꼴 CDN이 막혀도 첫 화면이 기다리지 않게(boot.js가 받은 뒤 적용)
  return { files, teacher: { '운영안내.md': opsDoc(ctx) }, design, live };
}
