// 모든 쪽이 같이 쓰는 머리(<head>)·보안 정책(CSP)·사이트 데이터. 참가자 화면(pages.js)과 보조 화면(aux.js)이 함께 씁니다.
import { esc, host } from './html.js';
import { htmlAttrs } from '../design/tokens.js';
import { boardFiles } from './sections.js';
import { eventDays } from '../hero-meta.js';

export const VERSION = '1.0.0';

export function attrs(map) { return Object.entries(map).map(([k, v]) => `${k}="${esc(v)}"`).join(' '); }
export function jsonScript(id, data) {
  return `<script type="application/json" id="${id}">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

/** 검색 노출: 'public'인 참가자 화면만 허용. 나머지 페이지는 늘 noindex */
function robotsMeta(ctx, page) {
  return page === 'index' && ctx.bp.access?.mode === 'public' ? '' : '<meta name="robots" content="noindex, nofollow">';
}

/**
 * 공개 연수(access.mode 'public')의 첫 화면에만 schema.org Event(검색·AI가 일정·장소를 읽게). 날짜를 알 때만.
 * 기본(주소를 받은 사람만)·암호 사이트에는 넣지 않음. 시각은 한국 시각(+09:00), 끝 시각이 없으면 적지 않음(지어내지 않음)
 */
export function eventJsonLd(ctx, page) {
  const m = ctx.bp.meta || {};
  if (page !== 'index' || ctx.bp.access?.mode !== 'public' || !/^\d{4}-\d{2}-\d{2}$/.test(m.date || '')) return '';
  const at = (t) => (t ? `${m.date}T${t}:00+09:00` : m.date);
  const desc = m.description || m.subtitle || '';
  const ev = {
    '@context': 'https://schema.org', '@type': 'Event', name: m.title, startDate: at(m.start),
    ...(m.start && m.end && m.end > m.start ? { endDate: at(m.end) } : {}),
    ...(desc ? { description: desc } : {}),
    eventStatus: 'https://schema.org/EventScheduled',
    ...(m.venue ? { eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode', location: { '@type': 'Place', name: m.venue, address: m.venue } } : {}),
    ...(m.organizer ? { organizer: { '@type': 'Organization', name: m.organizer } } : {}),
    ...(m.siteUrl ? { url: m.siteUrl } : {}),
    inLanguage: 'ko',
  };
  return `<script type="application/ld+json">${JSON.stringify(ev).replace(/</g, '\\u003c')}</script>`;
}

/** 지문(SRI)을 고정해 불러오는 라이브러리 경로(효과·Supabase). 이 밖의 바깥 스크립트는 막힘 */
export const LIB_SCRIPT_SOURCES = ['https://cdn.jsdelivr.net/npm/gsap@3.15.1/', 'https://cdn.jsdelivr.net/npm/lenis@1.3.27/', 'https://cdn.jsdelivr.net/npm/ogl@1.0.11/', 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/'];

/**
 * 이 사이트가 실제로 연결하는 곳(connect-src): 참여 기능 서버만. 다른 곳으로 몰래 보내는 길을 닫음.
 * http·Cloudflare·바로 공개 = 그 서버(https + wss), Supabase = 프로젝트 주소(https + wss), 구글 시트 = Apps Script(리디렉션 주소 포함).
 * 교실 LAN 서버(http)는 그 주소와 ws만. 접속 확인 쪽(check)은 바깥 도구가 열리는지 재야 해서 https 전체를 둠.
 */
export function liveOrigins(bp) {
  const out = [];
  const prov = bp.live?.provider;
  let u = null; try { u = new URL(bp.live?.url || ''); } catch { /* 없음 */ }
  if (u && /^https?:$/.test(u.protocol) && (prov === 'http' || prov === 'supabase')) {
    out.push(u.origin, `${u.protocol === 'https:' ? 'wss' : 'ws'}://${u.host}`);
  }
  if (prov === 'sheets') out.push('https://script.google.com', 'https://script.googleusercontent.com');
  return out;
}

/**
 * 교실 LAN 길: 실시간 서버(Node)가 사이트도 함께 내보내며 http://<노트북 IP>:8787 로 열릴 수 있음.
 * live.provider가 'http'이고 주소가 비었거나(같은 주소) http면 그렇다고 봄. 이때 meta CSP의 upgrade-insecure-requests는
 * 같은 주소의 CSS·JS까지 https로 바꿔 받아 사이트를 통째로 깨뜨리므로 넣지 않음.
 * 같은 사이트를 https로 내보내면(Caddy 등) Node 서버가 응답 머리글로 이 지시어를 붙임(backends/node-server/server.mjs)
 */
export function servedOverLan(bp) {
  if (bp.live?.provider !== 'http') return false;
  const url = String(bp.live?.url || '').trim();
  if (!url) return true;
  try { return new URL(url).protocol === 'http:'; } catch { return false; }
}

/** 생성 사이트 보안 정책(CSP): 스크립트는 이 사이트와 지문을 고정한 라이브러리 경로만, 플러그인·base 바꾸기·틀 넣기 금지.
 * file:은 USB·ZIP으로 열 때를 위해. 실시간 서버가 http(교실 LAN)면 그 주소도 허용 */
export function cspPolicy(ctx, page = 'app') {
  const lan = servedOverLan(ctx.bp);
  const fonts = 'https://fonts.googleapis.com https://cdn.jsdelivr.net https://hangeul.pstatic.net';
  const live = ctx.live ? liveOrigins(ctx.bp) : [];
  const connect = page === 'check' ? ["'self'", 'file:', 'https:', 'wss:', ...live.filter((x) => /^(http|ws):/.test(x))] : ["'self'", 'file:', ...live];
  const p = [
    "default-src 'self' file:",
    `script-src 'self' file: ${LIB_SCRIPT_SOURCES.join(' ')}`,
    `style-src 'self' file: 'unsafe-inline' ${fonts}`,
    "font-src 'self' file: data: https://fonts.gstatic.com https://cdn.jsdelivr.net https://hangeul.pstatic.net",
    "img-src 'self' file: data: blob: https:",
    "media-src 'self' file: blob: https:",
    `connect-src ${[...new Set(connect)].join(' ')}`,
    "frame-src 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'self'",
  ];
  // 섞인 콘텐츠: 교실 LAN 길(http)이 아니면 http 주소를 https로 올려 받음(LAN 길을 https로 내보낼 때는 서버 머리글이 붙임)
  if (!lan) p.push('upgrade-insecure-requests');
  return p.join('; ');
}
function cspMeta(ctx, page) { return `<meta http-equiv="Content-Security-Policy" content="${cspPolicy(ctx, page)}">`; }

export function headTags(ctx, title, extraCss = [], page = 'app') {
  const m = ctx.bp.meta;
  const desc = m.description || m.subtitle || `${m.title} ${ctx.words?.ev || '연수'} 안내`;
  const bg = ctx.themeColor;
  // 보조 화면(강사·발표·안내문·접속 확인)은 공유 미리보기(og)를 싣지 않음: 메신저에 붙여도 연수 사이트 첫 화면이 아니라는 것만 보임
  const og = page === 'index' || page === 'app' ? `<meta property="og:type" content="website"><meta property="og:locale" content="ko_KR">
<meta property="og:title" content="${esc(m.title)}"><meta property="og:description" content="${esc(desc)}">
${ctx.ogImage ? `<meta property="og:image" content="${esc(ctx.ogImage)}"><meta name="twitter:card" content="summary_large_image">` : ''}` : '';
  return `<meta charset="utf-8">
${cspMeta(ctx, page)}
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${og}
<meta name="theme-color" content="${esc(bg)}">
<meta name="generator" content="lecpage ${VERSION}">
${robotsMeta(ctx, page)}
${eventJsonLd(ctx, page)}
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
${ctx.fontLinks.some((u) => u.includes('fonts.googleapis.com')) ? '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' : ''}${ctx.fontLinks.map((u) => `<link rel="stylesheet" href="${esc(u)}" crossorigin>`).join('\n')}
<link rel="stylesheet" href="assets/theme.css">
<link rel="stylesheet" href="assets/lecpage.css">
${ctx.hasFx && page === 'index' ? '<link rel="stylesheet" href="assets/fx.css">' : ''}
${extraCss.map((c) => `<link rel="stylesheet" href="${c}">`).join('\n')}
<script src="assets/boot.js"></script>`;
}

export const byOperator = (bp) => (bp.privacy.processors || []).some((p) => /^lecpage 운영자/.test(p.name));
/**
 * 참여 기록을 언제 지우는지: 개인정보 안내(한눈에·3)·참여하기 동의·운영 안내·강사 화면(DATA.privacy.keep)이 이 한 문장을 씀.
 * 서버마다 '마지막 기록 뒤 N일'이 지나면 지움(node·Cloudflare·바로 배포·Supabase pg_cron·시트 트리거). 바로 배포는 사이트를 지울 때 늦어도 함께
 */
export function keepRule(bp) {
  const d = bp.privacy.retentionDays;
  return { short: `마지막 기록 뒤 ${d}일`, site: byOperator(bp) ? '사이트 보관 기간이 먼저 끝나면 사이트와 함께' : '' };
}

/** 연수 기간(현지 시각): 첫날 시작 ~ 마지막 날 끝. 끝난 뒤에는 참가자 화면이 '연수 후' 보기로 바뀜 */
export function phaseWindow(bp) {
  const m = bp.meta, days = eventDays(m);
  const dates = [...days.map((x) => x.date), ...bp.sections.filter((s) => s.type === 'sessions').flatMap((s) => s.items.map((x) => x.date))].filter(Boolean).sort();
  if (!dates.length) return null;
  const last = dates[dates.length - 1], lastDay = days.find((x) => x.date === last), firstDay = days.find((x) => x.date === dates[0]);
  // days: 연수 날마다의 시작·끝(여러 날이면 참가자 화면이 그날 시간에만 [출석]을 띄움)
  return { start: `${dates[0]}T${firstDay?.start || m.start || '00:00'}`, end: `${last}T${lastDay?.end || m.end || '23:59'}`, ...(days.length >= 2 ? { days: days.map((d) => ({ start: `${d.date}T${d.start || m.start || '00:00'}`, end: `${d.date}T${d.end || m.end || '23:59'}` })) } : {}) };
}

export function siteData(ctx) {
  const bp = ctx.bp;
  const st = bp.sections.find((s) => s.type === 'stations');
  return {
    v: VERSION, title: bp.meta.title, date: bp.meta.date, start: bp.meta.start, end: bp.meta.end, siteUrl: bp.meta.siteUrl || '', keepUntil: bp.meta.keepUntil || '',
    // 짧은 주소(강사가 직접 넣은 것)는 손으로 칠 글자에만 씀. QR·복사는 언제나 원래 주소라 짧은 주소 서비스가 멈춰도 열림
    shortUrl: bp.meta.shortUrl || '',
    key: 'lp-' + bp.live.code,
    live: ctx.live ? { provider: bp.live.provider, url: bp.live.url, anonKey: bp.live.anonKey, code: bp.live.code, features: bp.live.features, anonymous: bp.live.anonymous, pollMs: bp.live.pollMs } : null,
    privacy: { collect: bp.privacy.collect, consent: bp.privacy.consent, retentionDays: bp.privacy.retentionDays, keep: keepRule(bp).short },
    stations: st ? st.items.map((x) => ({ id: x.id, name: x.name })) : [],
    motion: ctx.design.motion,
    base: bp.meta.siteUrl || '',
    // 이수 기준(출석 %): 교재·강사가 정한 값. 정하지 않았으면 0 → 강사 화면의 이수자 명단은 90%로 세고 그 사실을 적음
    admin: { completionRate: bp.meta.admin?.completionRate || 90, rateSet: !!bp.meta.admin?.completionRate },
    survey: ctx.live ? bp.sections.filter((s) => s.type === 'survey').reduce((n, s) => n + (s.questions?.length || 0), 0) : 0,
    phase: phaseWindow(bp),
    // 참가자 화면이 스스로 쓰는 낱말(끝난 연수·수업, 자료 칸, 연수·수업 코드)
    words: ctx.words ? { ev: ctx.words.ev, ended: ctx.words.ended, materials: ctx.words.materials, code: ctx.words.code } : undefined,
  };
}

/** 보조 화면(강사·발표·안내문·접속 확인·개인정보)의 틀: 같은 테마·글꼴·단추 모양을 이어받고, 쪽마다 aux.css를 더함 */
export function appShell(ctx, { title, page, bodyClass, inner, scripts = [], blueprint = false }) {
  const bp = ctx.bp;
  // pages: 교재의 실제 쪽 번호(교재 일부만 담으면 1,2,4,8…). 강사 화면은 이 번호를 보내고 참가자 화면은 같은 번호(data-page)로 찾음
  const bpData = blueprint ? jsonScript('lp-blueprint', { sections: bp.sections.map((s) => ({ id: s.id, type: s.type, title: s.title, items: s.type === 'poll' ? s.items : undefined, slides: s.type === 'deck' ? s.slides.length : undefined, moderation: s.type === 'board' ? !!s.moderation : undefined, allowFiles: s.type === 'board' ? boardFiles(s, bp) : undefined })), stations: (bp.sections.find((s) => s.type === 'stations')?.items || []).map((x) => ({ id: x.id, name: x.name, title: x.title })), pages: (bp.sections.find((s) => s.type === 'deck')?.slides || []).map((x) => x.page) }) : '';
  return `<!doctype html>
<html lang="ko" ${attrs({ ...htmlAttrs(ctx.design), 'data-motion': '1', 'data-page': page })}>
<head>
${headTags(ctx, title, ['assets/aux.css'], page)}
</head>
<body class="${bodyClass}">
${inner}
${jsonScript('lp-data', siteData(ctx))}
${bpData}
${scripts.map((s) => `<script src="${s}" defer></script>`).join('\n')}
</body>
</html>
`;
}

export { host };
