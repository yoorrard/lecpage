// 새 판(v2) 연수: AI가 만든 사이트(p.site) + 연수 정보(p.meta = lecpage.json, docs/plan-ai-first.md §3·§15).
// 배포 화면(Share·Publish·LiveSetup·VenueCheck)은 예전 설계도(blueprint)의 칸 이름(meta·live·access·privacy)으로 짜여 있어,
// 같은 칸 이름의 '배포용 보기'(deployView)를 만들어 주고, 고친 것은 p.meta의 강사 칸(live·siteUrl·shortUrl·access·privacy)에 돌려 씀(patchDeploy).
import { randomCode } from '@engine/src/util.js';
import { keepTeacherValues, LIVE_FEATURE_KEYS as LIVE_KEYS } from '@engine/src/kit/index.js';
import { MAX_VERSIONS as MAX_V } from './versions.js';

export { LIVE_KEYS };
/** 참여 기능(강사에게 보이는 이름·설명). quick=첫 화면에서 바로 고르는 세 가지 */
export const FEATURES = [
  { value: 'qa', label: '질문 받기', desc: '이름 없이 질문하고 공감을 눌러요. 많이 궁금한 것부터 답해요.', quick: true },
  { value: 'help', label: '도움 요청', desc: '실습하다 막히면 버튼 하나로 자리와 함께 알려요.', quick: true },
  { value: 'progress', label: '진행 현황', desc: '실습마다 완료를 누르면 강사 화면에 진행 현황이 보여요.', quick: true },
  { value: 'poll', label: '투표·워드클라우드', desc: '고르기 투표와 한 낱말 답을 모아 화면에 띄워요.' },
  { value: 'board', label: '나눔 보드', desc: '완성한 결과물과 소감을 올리고 서로 봐요.' },
  { value: 'signal', label: '신호등', desc: '이해했어요·헷갈려요·모르겠어요를 색으로 알려요.' },
  { value: 'attendance', label: '출석·이수 확인', desc: '입실·퇴실을 누르고, 이수자 명단(CSV)을 받아요.' },
  { value: 'reactions', label: '박수·반응', desc: '박수와 하트가 발표 화면에 떠올라요.' },
];

/** AI가 만든 사이트가 있는 새 판 연수인지 */
export const isV2 = (p) => !!p && (p.v === 2 || !!p.site);
/** 예전 방식(설계도만 있는 v1)으로 만든 연수인지 */
export const isLegacy = (p) => !!p?.blueprint && !isV2(p);

export const firstSession = (m = {}) => (m.sessions || []).find((s) => s?.date) || (m.sessions || [])[0] || { date: '', start: '', end: '' };
/**
 * 켜진 참여 기능: 연수 정보의 features + 사이트에 AI가 넣은 자리 표시(질문·투표·보드·출석, 실습 단계가 있으면 진행 현황).
 * 엔진 조립(kit/assemble.js synthBlueprint)이 자리 표시가 있으면 그 기능을 켜는 규칙과 같게 셈 → AI가 lecpage.json에 features를 적지 않아도
 * 배포 화면이 참여 기능을 알아보고 바로 배포 방을 붙임(안 그러면 입력칸은 있는데 기록이 각자 기기에만 남는 연습 모드로 나감)
 */
export const featuresOf = (p) => {
  if (!isV2(p)) return p?.info?.features || [];
  const own = p.meta?.features || [], site = siteFeatures(p.site);
  return site.every((f) => own.includes(f)) ? own : [...own, ...site.filter((f) => !own.includes(f))];
};
const SITE_FEAT = { qa: 'qa', poll: 'poll', board: 'board', attend: 'attendance' };
const siteFeatMemo = new WeakMap();
/** 사이트 글의 참여 기능 자리 표시 → 기능 키(엔진 live.features 꼴) */
export function siteFeatures(site) {
  if (!site || typeof site !== 'object') return [];
  if (siteFeatMemo.has(site)) return siteFeatMemo.get(site);
  const f = new Set(); let steps = false;
  for (const [k, v] of Object.entries(site)) {
    if (!/\.html?$/i.test(k) || typeof v !== 'string') continue;
    for (const m of v.matchAll(/<[a-z][^>]*\sdata-lp\s*=\s*["'](qa|poll|board|attend)["']/gi)) f.add(SITE_FEAT[m[1].toLowerCase()]);
    if (!steps && /<[a-z][^>]*\sdata-lp-step\s*=/i.test(v)) steps = true;
  }
  if (steps && f.size) f.add('progress');
  const out = [...f]; siteFeatMemo.set(site, out); return out;
}

/** 배포용 보기: 예전 설계도와 같은 칸 이름. 새 판이 아니면 설계도 그대로 */
export function deployView(p) {
  if (!isV2(p)) return p?.blueprint || null;
  const m = p.meta || {}; const s0 = firstSession(m); const lv = m.live || {};
  return {
    v2: true,
    meta: { title: m.title || p.title || '', subtitle: m.subtitle || '', date: s0.date || '', start: s0.start || '', end: s0.end || '', sessions: (m.sessions || []).filter((s) => s?.date), venue: m.venue || '', siteUrl: m.siteUrl || '', shortUrl: m.shortUrl || '', admin: m.admin || null, organizer: m.organizer || '' },
    live: { provider: lv.provider || 'local', url: lv.url || '', anonKey: lv.anonKey || '', code: lv.code || '', anonymous: lv.anonymous !== false, features: featuresOf(p).filter((f) => LIVE_KEYS.includes(f)), ...(typeof lv.uploads === 'boolean' ? { uploads: lv.uploads } : {}) },
    access: { mode: m.access || 'link' },
    privacy: m.privacy || {},
    audience: { size: p.info?.size || 30, minor: m.audience === 'students' && !!p.info?.minor },
    // 새 판은 설계도 섹션이 없음: 참여 기능 방 설정(파일 올리기·사전 검토, LiveSetup liveSettings)은 사이트 글의 보드 자리 표시에서 읽음
    sections: siteBoards(p.site),
  };
}
/** 사이트 글의 보드 자리 표시(data-lp="board") → [{ type:'board', allowFiles, moderation }]. 엔진 조립과 같은 규칙: data-files가 없으면 4개, 0이면 끔 */
export function siteBoards(site) {
  for (const [k, v] of Object.entries(site || {})) {
    if (!/\.html?$/i.test(k) || typeof v !== 'string') continue;
    const tag = /<[a-z][^>]*\sdata-lp\s*=\s*["']board["'][^>]*>/i.exec(v)?.[0];
    if (!tag) continue;
    const a = (n) => new RegExp(`\\s${n}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag)?.[1];
    const want = a('data-files');
    const max = want === undefined ? 4 : Math.max(0, Math.min(8, Math.round(+want || 0)));
    return [{ type: 'board', allowFiles: max > 0, moderation: /^(1|true|yes|on)$/i.test(a('data-moderation') || '') }];
  }
  return [];
}

/** 배포용 보기를 고친 함수(fn: view → view)를 연수 patch로. update((cur) => patchDeploy(cur, fn)) */
export function patchDeploy(cur, fn) {
  if (!isV2(cur)) return { blueprint: fn(cur.blueprint) };
  const before = deployView(cur); const b = fn(before); const m = { ...(cur.meta || {}) };
  if (b.live !== before.live) {
    const l = b.live || {};
    m.live = { provider: l.provider || 'local', url: l.url || '', anonKey: l.anonKey || '', code: l.code || m.live?.code || randomCode(), ...(l.anonymous === false ? { anonymous: false } : {}), ...(typeof l.uploads === 'boolean' && l.provider !== 'local' ? { uploads: l.uploads } : {}) };
    if (Array.isArray(l.features) && l.features !== before.live.features) m.features = [...(m.features || []).filter((f) => !LIVE_KEYS.includes(f)), ...l.features];
  }
  if (b.access !== before.access) m.access = b.access?.mode || 'link';
  if (b.privacy !== before.privacy) m.privacy = b.privacy;
  if (b.meta !== before.meta) { m.siteUrl = b.meta?.siteUrl || ''; m.shortUrl = b.meta?.shortUrl || ''; }
  return { meta: m };
}

/** AI 답·가져온 파일의 연수 정보에서 강사 칸은 버리고 지금 값(prev)을 지킴(엔진 keepTeacherValues) */
export const keepTeacher = (next = {}, prev = {}) => keepTeacherValues(next || {}, prev || {}).meta;
/** 예전 방식 연수를 AI로 새로 만들 때: 설계도의 배포 연결(참여 기능 방·공개 범위·짧은 주소)을 새 판 연수 정보로 옮김 */
export function carryLegacy(cur) {
  const b = cur.blueprint; if (!b || cur.meta?.live) return {};
  const l = b.live || {};
  return { meta: { ...(cur.meta || {}), live: { provider: l.provider && l.provider !== 'none' ? l.provider : 'local', url: l.url || '', anonKey: l.anonKey || '', code: l.code || randomCode() }, access: b.access?.mode || 'link', siteUrl: b.meta?.siteUrl || cur.meta?.siteUrl || '', shortUrl: b.meta?.shortUrl || '', ...(b.privacy ? { privacy: b.privacy } : {}) } };
}

/** 실시간 방 코드(없으면 하나 정해 둠: 처음 배포 화면에 올 때) */
export const liveCode = (p) => deployView(p)?.live?.code || '';
export function ensureCode(cur) {
  if (!isV2(cur) || cur.meta?.live?.code) return null;
  return { meta: { ...(cur.meta || {}), live: { provider: 'local', url: '', anonKey: '', ...(cur.meta?.live || {}), code: randomCode() } } };
}

/** 참여 기능 켜고 끄기 patch */
export function toggleFeature(cur, v) {
  const f = featuresOf(cur); const next = f.includes(v) ? f.filter((x) => x !== v) : [...f, v];
  return { meta: { ...(cur.meta || {}), features: next } };
}

// 버전 기록·AI 수정 대화: lib/versions.js(바뀐 뒤의 사이트를 맨 위에 남김)
export { recordVersion, sameState, aiVersionLabel, restoreLabel, addChat, aiReply, MAX_VERSIONS } from './versions.js';
/** 버전 기록에 지금 판을 그대로 넣은 versions(최근 20개). 새 기록은 recordVersion(바뀐 뒤의 판) */
export function pushVersion(cur, label) {
  if (!cur.site) return cur.versions || [];
  return [{ id: Math.random().toString(36).slice(2, 10), at: Date.now(), label, site: cur.site, meta: cur.meta }, ...(cur.versions || [])].slice(0, MAX_V);
}

/** 사이트의 실습 단계 글(인쇄본: 인터넷이 안 될 때 나눠 줄 실습 프롬프트 모음) */
export function printSiteHtml(p) {
  const m = p.meta || {};
  const doc = new DOMParser().parseFromString(p.site?.['index.html'] || '', 'text/html');
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const steps = [...doc.querySelectorAll('[data-lp-step]')].map((s) => `<section><h2>${esc(s.getAttribute('data-title') || s.querySelector('h1,h2,h3,h4')?.textContent || '실습')}</h2>${[...s.querySelectorAll('li,p,pre')].filter((e) => !e.closest('li') || e.tagName === 'LI').map((e) => (e.tagName === 'PRE' ? `<pre>${esc(e.textContent)}</pre>` : `<p>${esc(e.textContent.trim())}</p>`)).join('')}</section>`);
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(m.title)} · 실습 모음</title><style>body{font:16px/1.7 system-ui,'Malgun Gothic',sans-serif;max-width:46em;margin:32px auto;padding:0 16px;word-break:keep-all}pre{white-space:pre-wrap;background:#f3f0ee;padding:10px 12px;border-radius:8px}section{break-inside:avoid;margin-top:24px}</style><h1>${esc(m.title)}</h1>${steps.join('') || '<p>실습 단계가 없어요.</p>'}</html>`;
}

/**
 * 배포하기 화면의 [이 주소에 이어서 배포]: 파일에 담아 온 배포 정보를 이 연수에 씀(같은 주소·같은 참여 기능 방·같은 관리자 키).
 * @returns {object} update()에 넘길 patch
 */
export function carryPatch(cur) {
  const c = cur.carryPending; if (!c) return {};
  if (c.liveAdminKey && c.live.url) import('./ai.js').then((m) => { const slot = 'live-admin:' + c.live.url.replace(/\/+$/, ''); m.saveKey(slot, c.liveAdminKey, true); if (c.live.code) m.saveKey(slot + '#' + c.live.code, c.liveAdminKey, true); }).catch(() => { });
  const moved = isV2(cur) || cur.blueprint ? patchDeploy(cur, (b) => ({ ...b, live: { ...(b.live || {}), provider: c.live.provider, url: c.live.url, anonKey: c.live.anonKey, ...(c.live.code ? { code: c.live.code } : {}) }, meta: { ...(b.meta || {}), siteUrl: c.deploy.lastUrl } })) : {};
  return { deploy: c.deploy, ...moved, liveOk: c.liveOk, ...(c.sitePassword ? { sitePassword: c.sitePassword } : {}), carryPending: undefined, pastDeploy: undefined };
}


/** AI가 쓴 사이트에 사이트 스크립트가 있는지(.js 파일·인라인 <script>·onclick 같은 속성). 바로 배포 서버가 사이트 스크립트를 받지 않으면 미리 알릴 때 */
export function hasSiteScripts(p) {
  if (!isV2(p)) return false;
  return Object.entries(p.site || {}).some(([k, v]) => /\.m?js$/i.test(k) || (typeof v === 'string' && /\.html$/i.test(k)
    && (/<script\b(?![^>]*\bsrc=)(?![^>]*\btype=["']?application\/(?:ld\+)?json)[^>]*>\s*\S/i.test(v) || /<[a-z][^>]*\son[a-z]+\s*=/i.test(v))));
}
