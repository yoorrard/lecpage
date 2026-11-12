// 설계도 검증·자동 보정. AI나 사람이 만든 설계도를 안전하고 일관된 모양으로 바꿉니다.
// 원칙: 고칠 수 있으면 고치고(warnings), 진행할 수 없을 때만 errors.
import { SECTION_DEFS, SECTION_TYPES, LIVE_FEATURES, LIVE_PROVIDERS, ARCHETYPES, DEPLOY_TARGETS, FOLLOWUP_KINDS } from './schema/sections.js';
import { cleanStructure, checkOrder } from './decide/structure.js';
import { mdIssues } from './md-syntax.js';
import { PRESET_IDS, getPreset } from './design/presets.js';
import { isHex } from './design/color.js';
import { rankPresets } from './decide/design.js';
import { cleanConcept, conceptDesign } from './decide/concept.js';
import { PALETTE_BY_ID, FONT_PAIR_BY_ID } from './design/seeds.js';
import { detectTopics, moodsForTopics } from './decide/topic.js';

const LIMITS = { short: 80, title: 160, text: 1200, long: 6000, items: 200 };

export function str(v, max = LIMITS.text) {
  if (v === undefined || v === null) return '';
  let s = typeof v === 'string' ? v : (typeof v === 'number' ? String(v) : '');
  s = s.normalize('NFC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/** 링크 허용 목록: http(s), mailto, 같은 문서 안 앵커(#...), 상대 경로(assets/...) */
export function safeUrl(v) {
  const s = str(v, 2048);
  if (!s) return '';
  if (/^#[\w\-:.가-힣]*$/.test(s)) return s;
  if (/^(assets|media|slides)\/[\w\-./가-힣%]+$/i.test(s)) return s;
  if (/^mailto:[^\s<>"]+$/i.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.href;
  } catch { /* 아래로 */ }
  if (/^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(s)) return 'https://' + s; // gemini.google.com 처럼 프로토콜 없이 쓴 경우
  return '';
}

const arr = (v) => (Array.isArray(v) ? v.slice(0, LIMITS.items) : []);
const strArr = (v, max = LIMITS.short) => arr(v).map((x) => str(x, max)).filter(Boolean);
const num = (v, d = 0, min = -Infinity, max = Infinity) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };
const pick = (v, allowed, d) => (allowed.includes(v) ? v : d);
const slug = (s, i) => (str(s, 40).toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-|-$/g, '') || `s${i}`);
const time = (v) => { const m = /^(\d{1,2}):(\d{2})/.exec(str(v, 8)); return m ? `${m[1].padStart(2, '0')}:${m[2]}` : ''; };
const date = (v) => { const m = /^(\d{4})[-./ ]\s*(\d{1,2})[-./ ]\s*(\d{1,2})/.exec(str(v, 20)); return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : ''; };

function link(l) { return { label: str(l?.label ?? l?.title, LIMITS.short), url: safeUrl(l?.url ?? l?.href) }; }
function links(v) { return arr(v).map(link).filter((l) => l.url); }
/** 연수 후 안내 항목 종류: 주소로 짐작(다시 보기 영상·소통방), 모르면 link */
export function followupKind(url) {
  const u = String(url || '').toLowerCase();
  if (/youtube\.com|youtu\.be|vimeo\.com|tv\.naver\.com|zoom\.us\/rec|drive\.google\.com\/file\/[^?]*\/view.*(mp4|video)/.test(u)) return 'recording';
  if (/open\.kakao\.com|band\.us|padlet\.com|cafe\.naver\.com|discord\.(gg|com)|slack\.com|teams\.microsoft\.com\/l\/(team|channel)/.test(u)) return 'community';
  return 'link';
}
const textItem = (x, max) => str(x && typeof x === 'object' ? (x.text ?? x.title) : x, max);
function source(v) { if (!v || typeof v !== 'object') return undefined; const pages = arr(v.pages).map((n) => num(n, 0, 1, 9999)).filter(Boolean); return pages.length || v.file ? { file: str(v.file, 40), pages } : undefined; }

// 섹션별 정리 함수
const SECTION_FIX = {
  hero: (s) => ({ eyebrow: str(s.eyebrow, LIMITS.short), title: str(s.title, LIMITS.title), subtitle: str(s.subtitle, 400),
    ctas: arr(s.ctas).slice(0, 3).map((c) => ({ label: str(c.label, 30), href: safeUrl(c.href) || '#main' })).filter((c) => c.label),
    meta: arr(s.meta).slice(0, 6).map((m) => ({ label: str(m.label, 20), value: str(m.value, 80), url: safeUrl(m.url) || undefined })).filter((m) => m.value) }),
  goals: (s) => ({ lead: str(s.lead, 300), items: arr(s.items).map((x) => textItem(x, 120)).filter(Boolean).slice(0, 6), who: str(s.who, 160) }),
  glance: (s) => ({ items: arr(s.items).slice(0, 8).map((i) => ({ value: str(i.value, 20), label: str(i.label, 40), note: str(i.note, 80) })).filter((i) => i.value) }),
  message: (s) => ({ text: str(s.text, 600), note: str(s.note, 300), style: pick(s.style, ['statement', 'formula', 'quote'], 'statement'), parts: strArr(s.parts, 30).slice(0, 6), result: str(s.result, 40), cite: str(s.cite, 80) }),
  steps5: (s) => ({ lead: str(s.lead, 200), items: arr(s.items).slice(0, 8).map((i) => ({ word: str(i.word ?? i.title, 20), desc: str(i.desc, 120) })).filter((i) => i.word), close: str(s.close, 200) }),
  outline: (s) => ({ lead: str(s.lead, 300), items: arr(s.items).slice(0, 8).map((i, n) => ({ part: str(i.part, 20) || `PART ${n + 1}`, title: str(i.title, 80), desc: str(i.desc, 200), tags: strArr(i.tags, 20).slice(0, 6), target: str(i.target, 40) })).filter((i) => i.title) }),
  schedule: (s) => ({ items: arr(s.items).map((i) => ({ start: time(i.start), end: time(i.end), title: str(i.title, 100), desc: str(i.desc, 200), part: str(i.part, 20), date: date(i.date) })).filter((i) => i.title) }),
  readiness: (s) => ({ lead: str(s.lead, 300), items: arr(s.items).map((i) => ({ label: str(i.label ?? i.title, 120), detail: str(i.detail, 300), url: safeUrl(i.url) })).filter((i) => i.label), checks: arr(s.checks).slice(0, 20).map((c) => ({ name: str(c.name, 40), url: safeUrl(c.url) })).filter((c) => c.url) }),
  deck: (s) => ({ lead: str(s.lead, 300), slides: arr(s.slides).slice(0, 400).map((sl, n) => ({ src: safeUrl(sl.src), page: num(sl.page, n + 1, 1, 9999), title: str(sl.title, 120), text: str(sl.text, 1500), tools: strArr(sl.tools, 40).slice(0, 8) })), download: s.download ? { href: safeUrl(s.download.href), size: str(s.download.size, 20), label: str(s.download.label, 60) } : undefined, notice: str(s.notice, 400) }),
  stations: (s) => ({ layout: pick(s.layout, ['sidebar', 'tabs', 'scroll'], 'sidebar'), lead: str(s.lead, 300), items: arr(s.items).slice(0, 60).map((i, n) => ({
    id: slug(i.id || i.name || i.title, n + 1), name: str(i.name || i.title, 30), title: str(i.title || i.name, 100), tag: str(i.tag, 16).toUpperCase(), desc: str(i.desc ?? i.sub, 400),
    steps: strArr(i.steps, 500).slice(0, 20), prompts: arr(i.prompts).slice(0, 12).map((p) => ({ title: str(p.title, 80), text: str(p.text, 4000) })).filter((p) => p.text),
    images: arr(i.images).slice(0, 20).map((im) => ({ src: safeUrl(im.src), caption: str(im.caption, 120) })).filter((im) => im.src),
    links: links(i.links), outcome: str(i.outcome ?? i.out, 300), note: str(i.note, 400), minutes: num(i.minutes, 0, 0, 600), source: source(i.source) })).filter((i) => i.title) }),
  tools: (s) => ({ lead: str(s.lead, 300), notice: str(s.notice, 300), items: arr(s.items).map((i) => ({ name: str(i.name, 40), url: safeUrl(i.url), desc: str(i.desc, 200), pages: arr(i.pages).map((p) => num(p, 0, 1, 9999)).filter(Boolean).slice(0, 12), icon: str(i.icon, 20) })).filter((i) => i.name) }),
  prompts: (s) => ({ lead: str(s.lead, 300), items: arr(s.items).map((i) => ({ title: str(i.title, 80), text: str(i.text, 4000), tags: strArr(i.tags, 20).slice(0, 6) })).filter((i) => i.text) }),
  qa: (s) => ({ lead: str(s.lead, 300), anonymous: s.anonymous !== false }),
  board: (s) => ({ lead: str(s.lead, 300), categories: arr(s.categories).slice(0, 6).map((c, n) => ({ id: slug(c.id || c.label, n + 1), label: str(c.label, 20) })).filter((c) => c.label), allowFiles: s.allowFiles !== false, maxFiles: num(s.maxFiles, 4, 0, 8), moderation: !!s.moderation, externalUrl: safeUrl(s.externalUrl), notice: str(s.notice, 300) }),
  poll: (s) => ({ items: arr(s.items).slice(0, 20).map((p, n) => ({ id: slug(p.id, n + 1), question: str(p.question, 200), kind: pick(p.kind, ['choice', 'word', 'scale'], 'choice'), options: strArr(p.options, 60).slice(0, 10) })).filter((p) => p.question) }),
  quiz: (s) => ({ lead: str(s.lead, 300), items: arr(s.items).slice(0, 30).map((q) => ({ q: str(q.q ?? q.question, 300), options: strArr(q.options, 120).slice(0, 6), answer: num(q.answer, 0, 0, 5), explain: str(q.explain, 400) })).filter((q) => q.q && q.options.length >= 2) }),
  materials: (s) => ({ lead: str(s.lead, 300), notice: str(s.notice, 500), items: arr(s.items).map((i) => ({ title: str(i.title, 100), desc: str(i.desc, 300), href: safeUrl(i.href ?? i.url), kind: str(i.kind, 12).toUpperCase(), size: str(i.size, 20) })).filter((i) => i.title) }),
  instructor: (s) => ({ lead: str(s.lead, 300) }),
  speakers: (s) => ({ items: arr(s.items).map((i) => ({ name: str(i.name, 40), role: str(i.role, 60), org: str(i.org, 60), photo: safeUrl(i.photo), talk: str(i.talk, 120), time: str(i.time, 20) })).filter((i) => i.name) }),
  sessions: (s) => ({ items: arr(s.items).map((i, n) => ({ no: num(i.no, n + 1, 1, 999), date: date(i.date), title: str(i.title, 120), desc: str(i.desc, 300), status: pick(i.status, ['done', 'now', 'next', ''], ''), links: links(i.links) })).filter((i) => i.title) }),
  survey: (s) => ({ lead: str(s.lead, 300), url: safeUrl(s.url), qr: s.qr !== false, questions: arr(s.questions).slice(0, 20).map((q) => ({ q: str(q.q, 200), kind: pick(q.kind, ['scale', 'choice', 'text'], 'scale'), options: strArr(q.options, 60).slice(0, 8) })).filter((q) => q.q) }),
  followup: (s) => ({ lead: str(s.lead, 300), completion: str(s.completion, 300),
    items: arr(s.items).slice(0, 12).map((i) => { const url = safeUrl(i?.url ?? i?.href); return { title: str(i?.title ?? i?.label, 80), desc: str(i?.desc, 200), url, kind: pick(i?.kind, FOLLOWUP_KINDS, followupKind(url)) }; }).filter((i) => i.title && (i.url || i.desc)) }),
  closing: (s) => ({ lead: str(s.lead, 200), text: str(s.text, 200), thanks: str(s.thanks, 200) }),
  faq: (s) => ({ items: arr(s.items).map((i) => ({ q: str(i.q, 200), a: str(i.a, 1200) })).filter((i) => i.q && i.a) }),
  glossary: (s) => ({ items: arr(s.items).map((i) => ({ term: str(i.term, 60), desc: str(i.desc, 400) })).filter((i) => i.term) }),
  video: (s) => ({ items: arr(s.items).map((i) => ({ title: str(i.title, 120), url: safeUrl(i.url), thumb: safeUrl(i.thumb), length: str(i.length, 12) })).filter((i) => i.url) }),
  gallery: (s) => ({ items: arr(s.items).map((i) => ({ src: safeUrl(i.src), caption: str(i.caption, 160) })).filter((i) => i.src) }),
  reflection: (s) => ({ lead: str(s.lead, 300), prompts: strArr(s.prompts, 200).slice(0, 8) }),
  attendance: (s) => ({ lead: str(s.lead, 300) }),
  text: (s) => ({ md: str(s.md, LIMITS.long) }),
  // 본문 칸. 항목을 글자만 적어도 받음(절차 ["단계", …], 사례 본문만 등)
  procedure: (s) => ({ lead: str(s.lead, 300), close: str(s.close, 300), items: arr(s.items).slice(0, 20).map((i) => (i && typeof i === 'object'
    ? { title: str(i.title ?? i.step ?? i.word ?? i.name, 160), desc: str(i.desc ?? i.text ?? i.detail, 500), time: str(i.time ?? i.when, 24), who: str(i.who ?? i.owner, 40) }
    : { title: str(i, 160), desc: '', time: '', who: '' })).filter((i) => i.title) }),
  cases: (s) => ({ lead: str(s.lead, 300), items: arr(s.items).slice(0, 12).map((i) => (i && typeof i === 'object'
    ? { title: str(i.title ?? i.name, 100), body: str(i.body ?? i.text ?? i.desc, 1200), quote: str(i.quote, 300), cite: str(i.cite ?? i.by, 60) }
    : { title: '', body: str(i, 1200), quote: '', cite: '' })).filter((i) => i.title || i.body || i.quote) }),
  discuss: (s) => ({ lead: str(s.lead, 300), items: arr(s.items ?? s.questions).map((x) => str(x && typeof x === 'object' ? (x.q ?? x.question ?? x.text ?? x.title) : x, 240)).filter(Boolean).slice(0, 12), rules: strArr(s.rules, 200).slice(0, 8), note: str(s.note, 300) }),
  table: (s) => {
    const row = (r) => arr(Array.isArray(r) ? r : r && typeof r === 'object' ? Object.values(r) : [r]).slice(0, 8).map((c) => str(c, 400));
    const rows = arr(s.rows).slice(0, 60).map(row).filter((r) => r.some(Boolean));
    return { lead: str(s.lead, 300), head: arr(s.head ?? s.columns).slice(0, 8).map((c) => str(c, 60)), rows, note: str(s.note ?? s.caption, 400) };
  },
};

export function validate(input) {
  const errors = [], warnings = [];
  const b = (input && typeof input === 'object') ? input : {};
  if (!input || typeof input !== 'object') errors.push({ path: '', message_ko: '설계도가 JSON 객체가 아니에요.' });

  const m = b.meta || {};
  const meta = {
    title: str(m.title, LIMITS.title), subtitle: str(m.subtitle, 400), organizer: str(m.organizer, 120),
    date: date(m.date), start: time(m.start), end: time(m.end), venue: str(m.venue, 120),
    mode: pick(m.mode, ['offline', 'online', 'hybrid'], 'offline'), joinUrl: safeUrl(m.joinUrl), shortUrl: safeUrl(m.shortUrl), siteUrl: safeUrl(m.siteUrl),
    lang: 'ko', description: str(m.description, 300), contact: str(m.contact, 120),
    admin: { kind: pick(m.admin?.kind, ['school', 'official', 'conference', 'student'], 'school'), completionRate: num(m.admin?.completionRate, 90, 0, 100), hours: num(m.admin?.hours, 0, 0, 200) },
    sessions: arr(m.sessions).map((s, n) => ({ no: num(s.no, n + 1, 1, 999), date: date(s.date), start: time(s.start), end: time(s.end), title: str(s.title, 120) })),
  };
  if (!meta.title) { meta.title = '연수'; warnings.push({ path: 'meta.title', message_ko: '연수명이 없어 "연수"로 채웠어요.' }); }

  const a = b.audience || {};
  const audience = {
    type: str(a.type, 40) || 'teachers', size: num(a.size, 30, 1, 100000), level: pick(a.level, ['beginner', 'intermediate', 'advanced'], 'beginner'),
    devices: strArr(a.devices, 20).filter((d) => ['laptop', 'chromebook', 'tablet', 'phone', 'desktop'].includes(d)), network: pick(a.network, ['good', 'slow', 'restricted'], 'good'),
    blocked: strArr(a.blocked, 80).slice(0, 30), projector: a.projector !== false, minor: !!a.minor,
  };

  const ar = b.archetype || {};
  const archetype = { primary: pick(ar.primary, ARCHETYPES, 'story'), mix: strArr(ar.mix, 10).filter((x) => ARCHETYPES.includes(x)) };

  const d = b.design || {};
  // 컨셉(최상위): 한 줄 컨셉·모티프·근거. 디자인을 직접 고르지 않았으면 컨셉이 권하는 디자인·분위기·움직임을 씀(decide/concept.js)
  const concept = cleanConcept(b.concept);
  const lead = conceptDesign(concept);
  const design = {
    preset: pick(d.preset, PRESET_IDS, PRESET_IDS[0]), mood: strArr(d.mood, 20).slice(0, 6), topics: strArr(d.topics, 20).slice(0, 6),
    theme: pick(d.theme, ['auto', 'light', 'dark', 'preset'], 'preset'), motion: d.motion === undefined ? undefined : num(d.motion, 2, 0, 3),
    accent: isHex(d.accent) ? d.accent : '', fonts: d.fonts && typeof d.fonts === 'object' ? { display: str(d.fonts.display, 30), body: str(d.fonts.body, 30), num: str(d.fonts.num, 30), mono: str(d.fonts.mono, 30) } : undefined,
    signature: str(d.signature, 40), graphic: d.graphic === undefined ? undefined : str(d.graphic, 40), closingGraphic: d.closingGraphic === undefined ? undefined : str(d.closingGraphic, 40),
    effects: (d.effects && typeof d.effects === 'object') ? Object.fromEntries(Object.entries(d.effects).slice(0, 40).map(([k, v]) => [str(k, 40), str(v, 40)])) : {},
    logo: safeUrl(d.logo), brandName: str(d.brandName, 40), seed: str(d.seed, 20),
    palette: PALETTE_BY_ID[d.palette] ? d.palette : '', fontPair: FONT_PAIR_BY_ID[d.fontPair] ? d.fontPair : '',
    sourceFonts: sourceFonts(d.sourceFonts), fontFrom: pick(d.fontFrom, ['material', 'preset'], 'material'),
  };
  if (!design.mood.length && lead.mood) design.mood = lead.mood.slice();
  // 컨셉이 바라는 움직임은 보통 단계(2)까지만 받아들임: 스크롤 연출(3)은 선생님이 design.motion으로 직접 골랐을 때만
  if (d.motion === undefined && lead.motion !== undefined) design.motion = Math.min(lead.motion, 2);
  if ((!d.preset || !PRESET_IDS.includes(d.preset)) && lead.preset) {
    // 디자인을 고르지 않았고 컨셉이 권하는 디자인이 있으면 그것을
    design.preset = lead.preset;
  } else if (!d.preset || !PRESET_IDS.includes(d.preset)) {
    // 프리셋도 컨셉도 없으면 주제·분위기·유형으로 1순위를 고른다
    if (!design.topics.length) design.topics = detectTopics([meta.title, meta.subtitle, ...arr(b.sections).map((s) => s?.title || '')].join(' '));
    const moods = design.mood.length ? design.mood : moodsForTopics(design.topics);
    design.preset = rankPresets({ moods, topics: design.topics, archetype: pick(b.archetype?.primary, ARCHETYPES, 'story'), admin: meta.admin.kind, minor: !!b.audience?.minor })[0].id;
    if (d.preset) warnings.push({ path: 'design.preset', message_ko: `"${str(d.preset, 30)}" 디자인을 찾지 못해 "${getPreset(design.preset).name_ko}" 디자인으로 골랐어요.` });
  }

  const instructors = arr(b.instructors || (b.instructor ? [b.instructor] : [])).slice(0, 12).map((p) => ({
    name: str(p.name, 40), role: str(p.role, 80), org: str(p.org, 80), photo: safeUrl(p.photo), bio: str(p.bio, 800),
    email: /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(str(p.email, 120)) ? str(p.email, 120) : '', showEmail: p.showEmail !== false,
    tags: strArr(p.tags, 20).slice(0, 8), links: links(p.links).slice(0, 10),
    timeline: arr(p.timeline).slice(0, 6).map((g) => ({ group: str(g.group, 40), items: arr(g.items).slice(0, 12).map((it) => ({ text: str(it.text ?? it, 160), year: str(it.year, 20), url: safeUrl(it.url) })).filter((it) => it.text) })).filter((g) => g.items.length),
  })).filter((p) => p.name);

  const lv = b.live || {};
  const live = {
    provider: pick(lv.provider, LIVE_PROVIDERS, 'none'), url: safeUrl(lv.url), anonKey: str(lv.anonKey, 400),
    code: (str(lv.code, 12).toUpperCase().replace(/[^A-Z0-9]/g, '') || makeCode(meta.title + meta.date)),
    features: strArr(lv.features, 20).filter((f) => LIVE_FEATURES.includes(f)), anonymous: lv.anonymous !== false, pollMs: num(lv.pollMs, 7000, 3000, 60000),
    // 서버가 보드 파일을 받는지. 없으면 구글 시트만 꺼짐(시트에서 '파일 올리기 켜기'를 눌렀으면 true)
    ...(typeof lv.uploads === 'boolean' ? { uploads: lv.uploads } : {}),
  };

  const pv = b.privacy || {};
  const privacy = { collect: strArr(pv.collect, 20).filter((c) => ['nickname', 'name', 'school', 'email'].includes(c)), retentionDays: num(pv.retentionDays, 30, 1, 365), consent: pv.consent !== false, processors: arr(pv.processors).slice(0, 10).map((x) => ({ name: str(x.name, 60), contact: str(x.contact, 120), country: str(x.country, 40), purpose: str(x.purpose, 120) })), contact: str(pv.contact, 120) };
  if (!privacy.collect.length) privacy.collect = ['nickname'];
  if (audience.minor) { privacy.collect = ['nickname']; warnings.push({ path: 'privacy.collect', message_ko: '만 14세 미만이 참여해 별명만 받도록 바꿨어요.' }); }

  const dp = b.deploy || {};
  const deploy = { target: pick(dp.target, DEPLOY_TARGETS, 'zip'), base: str(dp.base, 120) || '/' };
  // 누가 볼 수 있나: link(주소·QR을 받은 사람, 검색 제외, 기본) · public(검색 허용) · password(암호를 아는 사람, 내용 암호화)
  const access = { mode: pick(b.access?.mode, ['link', 'public', 'password'], 'link') };

  // 섹션
  const seen = new Set();
  const sections = [];
  arr(b.sections).forEach((s, i) => {
    if (!s || typeof s !== 'object') return;
    if (s.hidden === true) return; // 강사가 숨긴 칸(내용은 설계도에 남김)
    const type = s.type;
    if (!SECTION_TYPES.includes(type)) { warnings.push({ path: `sections[${i}]`, message_ko: `알 수 없는 섹션 종류 "${str(type, 20)}"를 뺐어요.` }); return; }
    let id = slug(s.id || type, i + 1);
    while (seen.has(id)) id += '-' + (i + 1);
    seen.add(id);
    const def = SECTION_DEFS[type];
    const fixed = SECTION_FIX[type](s);
    const out = { id, type, title: str(s.title, LIMITS.title), nav: s.nav === undefined ? def.nav : str(s.nav, 12), tone: pick(s.tone, ['night', 'dawn', 'day', ''], ''), lead: fixed.lead ?? str(s.lead, 300), ...fixed, source: source(s.source) };
    if (def.list && !out[def.list]?.length && !['board', 'qa'].includes(type) && !(type === 'followup' && out.completion)) { warnings.push({ path: `sections[${i}]`, message_ko: `"${def.label}" 섹션에 내용이 없어 뺐어요.` }); return; }
    if (def.live && live.provider === 'none' && type !== 'board') warnings.push({ path: `sections[${i}]`, message_ko: `"${def.label}" 섹션은 참여 기능을 연결해야 동작해요. 연결 전에는 안내 문구만 보여요.` });
    // 글 칸·FAQ 답: 그리지 못하는 문법은 알림(글자는 그대로 보임)
    for (const [text, where] of type === 'text' ? [[out.md, 'md']] : type === 'faq' ? out.items.map((x, k) => [x.a, `items[${k}].a`]) : []) {
      for (const it of mdIssues(text)) warnings.push({ path: `sections[${i}].${where}`, kind: 'md', message_ko: `"${out.title || def.label}": ${it.message_ko}` });
    }
    if (type === 'text' && !out.md) { warnings.push({ path: `sections[${i}]`, message_ko: `"${out.title || def.label}" 섹션에 내용이 없어 뺐어요.` }); return; }
    sections.push(out);
  });
  if (!sections.length) errors.push({ path: 'sections', message_ko: '섹션이 하나도 없어요.' });
  if (!sections.find((s) => s.type === 'hero')) {
    sections.unshift({ id: 'hero', type: 'hero', nav: '처음', title: '', tone: '', ...SECTION_FIX.hero({ title: meta.title, subtitle: meta.subtitle }) });
    warnings.push({ path: 'sections', message_ko: '첫 화면이 없어 넣었어요.' });
  }
  // 순서 가드레일(첫 화면 → 목표 → 본문 → 자료·연수 후 → 설문 → 마무리): 알리기만 하고 옮기지 않음
  warnings.push(...checkOrder(sections));
  // 구성 결과(흐름·이유·권하는 기능·싣지 못한 것): 있으면 정리해 남김
  const structure = cleanStructure(b.structure);

  return { blueprint: { version: 1, meta, audience, archetype, ...(concept ? { concept } : {}), ...(structure ? { structure } : {}), design, instructors, sections, live, privacy, deploy, access, sources: arr(b.sources).slice(0, 20).map((x) => ({ id: str(x.id, 40), name: str(x.name, 120), pages: num(x.pages, 0, 0, 9999) })) }, errors, warnings };
}

/** 무작위 연수 코드(헷갈리는 글자 제외, 기본 10자 ≈ 50비트). 같은 서버를 여러 연수가 함께 써도 남이 짐작할 수 없게 */
export function randomCode(n = 10) {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const u = new Uint32Array(n);
  (globalThis.crypto || {}).getRandomValues ? globalThis.crypto.getRandomValues(u) : u.forEach((_, i) => { u[i] = Math.floor(Math.random() * 2 ** 32); });
  return Array.from(u, (x) => A[x % A.length]).join('');
}

/** 6자리 참여 코드(헷갈리는 글자 제외). 설계도에 코드가 없을 때만 쓰는 예비값(제목·날짜로 정해지므로 짐작될 수 있음) */
export function makeCode(seed = '') {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let h = 2166136261 >>> 0;
  const s = String(seed) + (seed ? '' : Math.random());
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  let out = '';
  for (let i = 0; i < 6; i++) { out += A[h % A.length]; h = Math.imul(h ^ (h >>> 13), 2654435761) >>> 0; }
  return out;
}

/** 교재 글꼴(감지 결과) → { display:{name,share}, body:{name,share} } | undefined */
function sourceFonts(v) {
  if (!v || typeof v !== 'object') return undefined;
  const one = (x) => (x && typeof x === 'object' && str(x.name, 60) ? { name: str(x.name, 60), share: num(x.share, 0, 0, 1) } : undefined);
  const out = { display: one(v.display), body: one(v.body) };
  return out.display || out.body ? out : undefined;
}
