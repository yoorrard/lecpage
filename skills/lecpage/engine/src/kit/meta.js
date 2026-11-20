// 연수 정보 lecpage.json(v2, docs/plan-ai-first.md 약속 A): 읽기·검증·기본값, 강사 값 지키기, 날짜·시각 꼴, facts 꼴.
// AI가 채우는 칸(제목·날짜·장소·강사·기능·색·facts)과 강사만 정하는 칸(live·siteUrl·joinUrl·shortUrl·access·surveyUrl·privacy·keepUntil)이 나뉩니다.
// 강사 칸은 AI 답·남이 준 파일에 있어도 버리고 이전 값(prev)을 지킵니다(엔진 keepTeacherLinks와 같은 규칙).

export const META_VERSION = 2;
/** lecpage.json features에 쓸 수 있는 값 */
export const KIT_FEATURES = ['qa', 'poll', 'board', 'attendance', 'survey', 'help', 'reactions', 'signal', 'progress', 'deck', 'materials', 'timer'];
/** 실시간 서버가 필요한 기능(엔진 live.features와 같은 이름) */
export const LIVE_FEATURE_KEYS = ['qa', 'help', 'progress', 'board', 'poll', 'attendance', 'reactions', 'signal'];
/** 강사만 정하는 칸(AI 답·가져온 파일의 값은 버림) */
export const TEACHER_KEYS = ['live', 'siteUrl', 'joinUrl', 'shortUrl', 'access', 'surveyUrl', 'privacy', 'keepUntil'];
export const MODES = ['offline', 'online', 'blended'];
export const AUDIENCES = ['teachers', 'students', 'parents', 'staff', 'other'];
const PROVIDERS = ['local', 'http', 'supabase', 'sheets'];

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
export function str(v, max = 400) {
  if (v === undefined || v === null) return '';
  let s = typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';
  s = s.normalize('NFC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
export const isHex = (v) => typeof v === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim());

/** 날짜 꼴: 'YYYY-MM-DD'(달력에 있는 날)만. 2026.12.3·2026/12/03도 고쳐 받음. 아니면 '' */
export function normDate(v) {
  const m = /^(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})\s*일?$/.exec(str(v, 20));
  if (!m) return '';
  const y = +m[1], mo = +m[2], d = +m[3];
  if (y < 2000 || y > 2100 || mo < 1 || mo > 12 || d < 1) return '';
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  if (d > last) return '';
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
/** 시각 꼴: 'HH:MM'(00:00~23:59). 9:00·09시 30분도 고쳐 받음. 아니면 '' */
export function normTime(v) {
  const m = /^(\d{1,2})\s*(?::|시)\s*(\d{2})?\s*분?$/.exec(str(v, 12)) || /^(\d{1,2})시$/.exec(str(v, 12));
  if (!m) return '';
  const h = +m[1], mi = +(m[2] || 0);
  if (h > 23 || mi > 59) return '';
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
}
export const isDate = (v) => typeof v === 'string' && normDate(v) === v;
export const isTime = (v) => typeof v === 'string' && normTime(v) === v;

/** 안전한 주소(강사 값): http(s)만 */
function httpUrl(v) {
  const s = str(v, 2048); if (!s) return '';
  try { const u = new URL(s); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch { return ''; }
}

/** facts 꼴: [{ label, value, page? }] — AI가 교재 몇 쪽에서 찾았는지(확인 화면·검수) */
export function cleanFacts(v, warn = () => {}) {
  if (v === undefined) return [];
  if (!Array.isArray(v)) { warn('facts', 'facts-shape', 'facts는 [{"label":"장소","value":"…","page":3}] 꼴의 목록이어야 해요.'); return []; }
  const out = [];
  v.slice(0, 80).forEach((f, i) => {
    if (!isObj(f)) { warn(`facts[${i}]`, 'facts-shape', `facts ${i + 1}번째가 {label, value, page} 꼴이 아니라 뺐어요.`); return; }
    const label = str(f.label, 40), value = str(f.value, 300);
    if (!label || !value) { warn(`facts[${i}]`, 'facts-empty', `facts ${i + 1}번째에 label·value가 비어 뺐어요.`); return; }
    const page = f.page === undefined || f.page === null || f.page === '' ? null : Math.round(Number(f.page));
    if (page !== null && !(page >= 1 && page <= 9999)) warn(`facts[${i}].page`, 'facts-page', `facts "${label}"의 쪽 번호(${str(f.page, 10)})가 숫자가 아니라 뺐어요.`);
    out.push({ label, value, ...(page >= 1 && page <= 9999 ? { page } : {}) });
  });
  return out;
}

/** 강사 값 정리(이전 판·CLI·앱이 준 값) */
function teacherPart(src = {}) {
  const lv = isObj(src.live) ? src.live : null;
  const live = lv && PROVIDERS.includes(lv.provider) ? {
    provider: lv.provider, url: httpUrl(lv.url), anonKey: str(lv.anonKey, 400),
    code: str(lv.code, 12).toUpperCase().replace(/[^A-Z0-9]/g, ''),
    ...(lv.anonymous === false ? { anonymous: false } : {}), ...(Number.isFinite(+lv.pollMs) && +lv.pollMs > 0 ? { pollMs: Math.min(60000, Math.max(3000, +lv.pollMs)) } : {}),
    ...(typeof lv.uploads === 'boolean' ? { uploads: lv.uploads } : {}),
  } : null;
  const pv = isObj(src.privacy) ? src.privacy : null;
  const privacy = pv ? {
    collect: (Array.isArray(pv.collect) ? pv.collect : []).filter((c) => ['nickname', 'name', 'school'].includes(c)),
    retentionDays: Math.min(365, Math.max(1, Math.round(+pv.retentionDays || 30))), consent: pv.consent !== false,
    processors: (Array.isArray(pv.processors) ? pv.processors : []).filter(isObj).slice(0, 10).map((x) => ({ name: str(x.name, 60), contact: str(x.contact, 120), country: str(x.country, 40), purpose: str(x.purpose, 120) })).filter((x) => x.name),
    contact: str(pv.contact, 120),
  } : null;
  if (privacy && !privacy.collect.length) privacy.collect = ['nickname'];
  return {
    live, siteUrl: httpUrl(src.siteUrl), joinUrl: httpUrl(src.joinUrl), shortUrl: httpUrl(src.shortUrl),
    access: ['link', 'public', 'password'].includes(src.access) ? src.access : isObj(src.access) && ['link', 'public', 'password'].includes(src.access.mode) ? src.access.mode : 'link',
    surveyUrl: httpUrl(src.surveyUrl), privacy, keepUntil: normDate(src.keepUntil),
  };
}

/**
 * 강사 값 지키기: next(AI 답·가져온 파일)의 강사 칸은 버리고 prev(강사가 정한 이전 값)를 씀.
 * @returns { meta, dropped: [칸 이름] } — dropped: next가 prev와 다른 값을 적어 버린 칸
 */
export function keepTeacherValues(next = {}, prev = null) {
  const t = teacherPart(isObj(prev) ? prev : {});
  const n = teacherPart(isObj(next) ? next : {});
  const dropped = TEACHER_KEYS.filter((k) => isObj(next) && next[k] !== undefined && next[k] !== null && next[k] !== '' && JSON.stringify(n[k]) !== JSON.stringify(t[k]));
  return { meta: { ...(isObj(next) ? next : {}), ...t }, dropped };
}

/** 사이트 CSS의 --lp-accent·--lp-ink·--lp-paper·--lp-font·--lp-radius 값(처음 나온 것) */
export function themeFromCss(css = '') {
  const out = {};
  for (const [k, name] of [['accent', 'accent'], ['ink', 'ink'], ['paper', 'paper'], ['font', 'font'], ['radius', 'radius']]) {
    const m = new RegExp(`--lp-${name}\\s*:\\s*([^;}{]+)`).exec(String(css));
    if (!m) continue;
    const v = m[1].replace(/!important/, '').trim();
    if (['accent', 'ink', 'paper'].includes(k)) { if (isHex(v)) out[k] = v.toLowerCase(); }
    else if (k === 'font') out.font = str(v, 120);
    else if (/^\d+(\.\d+)?(px|rem|em)$|^0$/.test(v)) out.radius = v;
  }
  return out;
}

/**
 * lecpage.json 읽기. input: 객체 또는 JSON 글. prev: 강사가 정한 이전 값(강사 칸은 여기서만 받음)
 * @returns { meta, errors:[{path,code,message_ko}], warnings:[…], old:boolean }
 *   old: 예전 판(v1 설계도)이라 이 형식이 아님 → 부른 쪽이 '예전 판' 안내
 */
export function readMeta(input, { prev = null } = {}) {
  const errors = [], warnings = [];
  const warn = (path, code, message_ko) => warnings.push({ path, code, message_ko });
  let raw = input;
  if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch (e) { errors.push({ path: '', code: 'json', message_ko: `lecpage.json을 JSON으로 읽지 못했어요(${String(e.message).slice(0, 80)}).` }); raw = {}; } }
  if (!isObj(raw)) { if (!errors.length) errors.push({ path: '', code: 'shape', message_ko: 'lecpage.json은 { … } 꼴의 객체여야 해요.' }); raw = {}; }
  const old = raw.version === 1 || Array.isArray(raw.sections) && isObj(raw.meta);
  if (old) errors.push({ path: 'v', code: 'v1', message_ko: '예전 판(설계도 v1) 파일이에요. 새 판(v2)은 사이트 폴더와 lecpage.json으로 만들어요.' });
  else if (raw.v !== undefined && raw.v !== 2) warn('v', 'version', `판 번호가 ${str(raw.v, 8)}이라 2로 읽었어요.`);

  const title = str(raw.title, 160);
  if (!title && !old) warn('title', 'title-empty', '제목(title)이 비었어요. QR 안내문·강사 화면·일정 파일에 쓰여요.');

  // 일정: sessions[] (하루면 하나). date·start·end는 꼴을 맞추고, 틀리면 그 칸만 비움
  const sessions = [];
  const ses = Array.isArray(raw.sessions) ? raw.sessions : raw.date ? [{ date: raw.date, start: raw.start, end: raw.end }] : [];
  if (raw.sessions !== undefined && !Array.isArray(raw.sessions)) warn('sessions', 'sessions-shape', 'sessions는 [{"date":"2026-12-03","start":"14:00","end":"17:00"}] 꼴의 목록이어야 해요.');
  ses.slice(0, 40).forEach((s, i) => {
    if (!isObj(s)) return;
    const date = normDate(s.date), start = normTime(s.start), end = normTime(s.end);
    if (s.date && !date) warn(`sessions[${i}].date`, 'date', `날짜 "${str(s.date, 20)}"는 YYYY-MM-DD 꼴(달력에 있는 날)이 아니라 비웠어요.`);
    if (s.start && !start) warn(`sessions[${i}].start`, 'time', `시작 시각 "${str(s.start, 12)}"는 HH:MM 꼴이 아니라 비웠어요.`);
    if (s.end && !end) warn(`sessions[${i}].end`, 'time', `끝 시각 "${str(s.end, 12)}"는 HH:MM 꼴이 아니라 비웠어요.`);
    if (start && end && end <= start) warn(`sessions[${i}]`, 'time-order', `끝 시각(${end})이 시작(${start})보다 빨라요.`);
    if (date || start) sessions.push({ date, start, end, ...(str(s.title, 120) ? { title: str(s.title, 120) } : {}) });
  });
  sessions.sort((a, b) => (a.date || '9').localeCompare(b.date || '9') || (a.start || '').localeCompare(b.start || ''));

  const mode = raw.mode === 'hybrid' ? 'blended' : MODES.includes(raw.mode) ? raw.mode : 'offline';
  if (raw.mode && !MODES.includes(raw.mode) && raw.mode !== 'hybrid') warn('mode', 'mode', `mode "${str(raw.mode, 20)}"는 offline·online·blended 중 하나여야 해요.`);
  const audience = AUDIENCES.includes(raw.audience) ? raw.audience : 'teachers';
  if (raw.audience && !AUDIENCES.includes(raw.audience)) warn('audience', 'audience', `audience "${str(raw.audience, 20)}"는 teachers·students·parents·staff·other 중 하나여야 해요.`);

  const instructors = (Array.isArray(raw.instructors) ? raw.instructors : []).filter(isObj).slice(0, 12)
    .map((p) => ({ name: str(p.name, 40), org: str(p.org, 80), ...(str(p.role, 80) ? { role: str(p.role, 80) } : {}) })).filter((p) => p.name);

  const features = [];
  for (const f of Array.isArray(raw.features) ? raw.features : []) {
    const k = f === 'attend' ? 'attendance' : f;
    if (KIT_FEATURES.includes(k)) { if (!features.includes(k)) features.push(k); } else warn('features', 'feature-unknown', `모르는 기능 "${str(f, 20)}"를 뺐어요(쓸 수 있는 값: ${KIT_FEATURES.join(', ')}).`);
  }

  const theme = {};
  if (isObj(raw.theme)) {
    for (const k of ['accent', 'ink', 'paper']) {
      if (raw.theme[k] === undefined) continue;
      if (isHex(raw.theme[k])) theme[k] = raw.theme[k].trim().toLowerCase(); else warn(`theme.${k}`, 'theme-color', `theme.${k} "${str(raw.theme[k], 20)}"는 #RRGGBB 꼴이 아니라 뺐어요.`);
    }
    if (str(raw.theme.font, 120)) theme.font = str(raw.theme.font, 120).replace(/[;{}<>]/g, '');
    if (raw.theme.radius !== undefined) { const r = str(raw.theme.radius, 12); if (/^\d+(\.\d+)?(px|rem|em)$|^0$/.test(r)) theme.radius = r; }
  }

  const ad = isObj(raw.admin) ? raw.admin : {};
  const admin = ['school', 'official', 'conference', 'student'].includes(ad.kind) ? { kind: ad.kind, hours: Math.min(200, Math.max(0, +ad.hours || 0)), completionRate: Math.min(100, Math.max(0, Math.round(+ad.completionRate || 0))) } : null;

  const base = {
    v: 2, title, subtitle: str(raw.subtitle, 400), organizer: str(raw.organizer, 120), description: str(raw.description, 300), contact: str(raw.contact, 120),
    sessions, venue: str(raw.venue, 120), mode, audience, ...(admin ? { admin } : {}), instructors, features, theme,
    facts: cleanFacts(raw.facts, warn),
  };
  const { meta: kept, dropped } = keepTeacherValues(raw, prev);
  for (const k of dropped) warn(k, 'teacher-value', `${k}는 강사가 정하는 칸이라 파일의 값을 쓰지 않았어요.`);
  const meta = { ...base };
  for (const k of TEACHER_KEYS) meta[k] = kept[k];
  return { meta, errors, warnings, old };
}

/** 새 연수 정보(빈 칸) */
export function defaultMeta(over = {}) { return readMeta({ v: 2, title: '', ...over }).meta; }

/** 첫날(가장 이른 날)의 날짜·시각 */
export function firstSession(meta = {}) { return (meta.sessions || []).find((s) => s.date) || (meta.sessions || [])[0] || { date: '', start: '', end: '' }; }

/** 실시간 서버가 필요한 기능만(엔진 live.features 꼴) */
export function liveFeatures(meta = {}, extra = []) {
  const f = new Set([...(meta.features || []), ...extra].filter((x) => LIVE_FEATURE_KEYS.includes(x)));
  return LIVE_FEATURE_KEYS.filter((x) => f.has(x));
}
