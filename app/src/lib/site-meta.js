// 새 판(v2) 연수: AI가 만든 사이트(p.site) + 연수 정보(p.meta = lecpage.json, docs/plan-ai-first.md §3·§15).
// 배포 화면(Share·Publish·LiveSetup·VenueCheck)은 예전 설계도(blueprint)의 칸 이름(meta·live·access·privacy)으로 짜여 있어,
// 같은 칸 이름의 '배포용 보기'(deployView)를 만들어 주고, 고친 것은 p.meta의 강사 칸(live·siteUrl·shortUrl·access·privacy)에 돌려 씀(patchDeploy).
import { LIVE_KEYS, FEATURES } from '@engine/src/intake.js';
import { randomCode } from '@engine/src/validate.js';
import { keepTeacherValues } from '@engine/src/kit/index.js';
import { blobs } from './db.js';

export { LIVE_KEYS, FEATURES };

/** AI가 만든 사이트가 있는 새 판 연수인지 */
export const isV2 = (p) => !!p && (p.v === 2 || !!p.site);
/** 예전 방식(설계도만 있는 v1)으로 만든 연수인지 */
export const isLegacy = (p) => !!p?.blueprint && !isV2(p);

export const firstSession = (m = {}) => (m.sessions || []).find((s) => s?.date) || (m.sessions || [])[0] || { date: '', start: '', end: '' };
export const featuresOf = (p) => (isV2(p) ? p.meta?.features || [] : p.info?.features || []);

/** 배포용 보기: 예전 설계도와 같은 칸 이름. 새 판이 아니면 설계도 그대로 */
export function deployView(p) {
  if (!isV2(p)) return p?.blueprint || null;
  const m = p.meta || {}; const s0 = firstSession(m); const lv = m.live || {};
  return {
    v2: true,
    meta: { title: m.title || p.title || '', subtitle: m.subtitle || '', date: s0.date || '', start: s0.start || '', end: s0.end || '', sessions: (m.sessions || []).filter((s) => s?.date), venue: m.venue || '', siteUrl: m.siteUrl || '', shortUrl: m.shortUrl || '', admin: m.admin || null, organizer: m.organizer || '' },
    live: { provider: lv.provider || 'local', url: lv.url || '', anonKey: lv.anonKey || '', code: lv.code || '', anonymous: lv.anonymous !== false, features: (m.features || []).filter((f) => LIVE_KEYS.includes(f)) },
    access: { mode: m.access || 'link' },
    privacy: m.privacy || {},
    audience: { size: p.info?.size || 30, minor: m.audience === 'students' && !!p.info?.minor },
    sections: [],
  };
}

/** 배포용 보기를 고친 함수(fn: view → view)를 연수 patch로. update((cur) => patchDeploy(cur, fn)) */
export function patchDeploy(cur, fn) {
  if (!isV2(cur)) return { blueprint: fn(cur.blueprint) };
  const before = deployView(cur); const b = fn(before); const m = { ...(cur.meta || {}) };
  if (b.live !== before.live) {
    const l = b.live || {};
    m.live = { provider: l.provider || 'local', url: l.url || '', anonKey: l.anonKey || '', code: l.code || m.live?.code || randomCode(), ...(l.anonymous === false ? { anonymous: false } : {}) };
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

/** 조립에 넣을 사이트 파일: p.site(글) + 이 연수 저장소의 site/…(그림: 교재 쪽 그림·올린 사진) */
export async function siteFiles(p) {
  const out = { ...(p.site || {}) };
  const keys = await blobs.keys(p.id).catch(() => []);
  for (const k of keys) {
    if (!k.startsWith('site/')) continue;
    const v = await blobs.get(p.id, k);
    out[k.slice(5)] = v instanceof Blob ? new Uint8Array(await v.arrayBuffer()) : v;
  }
  return out;
}

/**
 * 교재 쪽 그림(교재 넣기에서 만든 assets/slides/slide-NNN.*)을 사이트 폴더 자리(site/material/p-NNN.*)로 옮겨 둠(약속 A).
 * 가짜 생성·먼저 해보기 녹화가 씀(진짜 생성 파이프라인은 스스로 함). @returns [{ n: 쪽 번호, path: 사이트 안 경로 }]
 */
export async function copyPages(pid) {
  const keys = await blobs.keys(pid).catch(() => []);
  const out = [];
  for (const k of keys) {
    const m = /^assets\/slides\/slide-(\d+)\.(webp|png|jpg)$/.exec(k); if (!m) continue;
    const to = `site/material/p-${m[1]}.${m[2]}`;
    if (!keys.includes(to)) await blobs.put(pid, to, await blobs.get(pid, k));
    out.push({ n: +m[1], path: to.slice(5) });
  }
  return out.sort((a, b) => a.n - b.n);
}

/** 판 기록(되돌리기)에 지금 판을 넣은 versions(최근 10판) */
export function pushVersion(cur, label) {
  if (!cur.site) return cur.versions || [];
  return [{ id: Math.random().toString(36).slice(2, 10), at: Date.now(), label, site: cur.site, meta: cur.meta }, ...(cur.versions || [])].slice(0, 10);
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
  if (c.liveAdminKey && c.live.url) import('./ai.js').then((m) => m.saveKey('live-admin:' + c.live.url.replace(/\/+$/, ''), c.liveAdminKey, true)).catch(() => { });
  const moved = isV2(cur) || cur.blueprint ? patchDeploy(cur, (b) => ({ ...b, live: { ...(b.live || {}), provider: c.live.provider, url: c.live.url, anonKey: c.live.anonKey, ...(c.live.code ? { code: c.live.code } : {}) }, meta: { ...(b.meta || {}), siteUrl: c.deploy.lastUrl } })) : {};
  return { deploy: c.deploy, ...moved, liveOk: c.liveOk, ...(c.sitePassword ? { sitePassword: c.sitePassword } : {}), carryPending: undefined, pastDeploy: undefined };
}


/** AI가 쓴 사이트에 사이트 스크립트가 있는지(.js 파일·인라인 <script>·onclick 같은 속성). 바로 배포 서버가 사이트 스크립트를 받지 않으면 미리 알릴 때 */
export function hasSiteScripts(p) {
  if (!isV2(p)) return false;
  return Object.entries(p.site || {}).some(([k, v]) => /\.m?js$/i.test(k) || (typeof v === 'string' && /\.html$/i.test(k)
    && (/<script\b(?![^>]*\bsrc=)(?![^>]*\btype=["']?application\/(?:ld\+)?json)[^>]*>\s*\S/i.test(v) || /<[a-z][^>]*\son[a-z]+\s*=/i.test(v))));
}
