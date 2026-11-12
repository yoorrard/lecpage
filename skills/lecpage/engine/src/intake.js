// 연수 정보(강사 답) → 설계도. 앱(교재 넣기·고치기·AI 초안)과 skill CLI(make·patch -i)가 같은 규칙을 씁니다.
// 원칙: 강사가 준 값이 언제나 우선. 실시간 서버 주소·키·코드와 QR·접속 대상 주소는 AI 답·가져온 파일·교재에서 받지 않고
// 강사가 정한 값(prev 설계도, info)만 씁니다.
import { decideArchetype } from './decide/archetype.js';
import { detectTopics, moodsForTopics, moodFromWords } from './decide/topic.js';
import { rankPresets } from './decide/design.js';
import { cleanConcept, deriveConcept } from './decide/concept.js';
import { PRESET_IDS } from './design/presets.js';
import { DEFAULT_SURVEY } from './schema/sections.js';
import { randomCode } from './validate.js';

export const LIVE_KEYS = ['qa', 'help', 'progress', 'board', 'poll', 'attendance', 'reactions', 'signal'];

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

/** 강사 정보로만 정하는 meta(교재 감지·AI가 채운 값은 강사가 확인한 info로 덮음) */
export const META_KEYS = ['title', 'subtitle', 'organizer', 'date', 'start', 'end', 'venue', 'mode', 'contact'];
/** QR·링크 대상: AI 답·남이 준 파일·교재가 정하지 못하게(joinUrl은 강사가 적은 info.joinUrl만) */
export const UNTRUSTED_META = ['siteUrl', 'shortUrl', 'joinUrl'];

const clone = (x) => JSON.parse(JSON.stringify(x || {}));
const has = (o, k) => o && o[k] !== undefined && o[k] !== null;

export function minutesBetween(a, b) {
  const m = (t) => { const x = /^(\d{1,2}):(\d{2})/.exec(t || ''); return x ? +x[1] * 60 + +x[2] : null; };
  const s = m(a), e = m(b); return s !== null && e !== null && e > s ? e - s : 0;
}

/**
 * 강사 정보 → materialToDraft 입력.
 * @param info 앱 연수 정보 또는 info.json(references/intake.md 키)
 * @param slidesMade 쪽 그림을 assets/slides/slide-001.webp…로 만들었는지(앱). CLI는 교재 해석이 쪽마다 경로를 적어 둠
 */
export function draftInfo(info = {}, slidesMade = false) {
  const ins = info.instructor || (info.instructorName ? { name: info.instructorName, org: info.instructorOrg, email: info.instructorEmail, bio: info.instructorBio } : undefined);
  return {
    title: info.title, subtitle: info.subtitle, organizer: info.organizer, date: info.date, start: info.start, end: info.end, venue: info.venue,
    mode: info.mode, joinUrl: info.joinUrl || '', contact: info.contact, size: info.size, adminKind: info.admin, surveyUrl: info.surveyUrl,
    goals: info.goals, who: info.who, dates: info.dates, archetype: info.archetype, today: info.today,
    audience: {
      ...(info.audience || {}),
      ...(has(info, 'devices') ? { devices: [].concat(info.devices) } : {}),
      ...(has(info, 'network') ? { network: info.network === 'offline' ? 'restricted' : info.network } : {}),
      ...(has(info, 'minor') ? { minor: !!info.minor } : {}),
    },
    instructor: ins,
    slidesBase: slidesMade ? 'assets/slides/' : '', imageBase: 'assets/media/',
  };
}

/** 강사가 고른 연수 형식으로 사이트 유형(칸 순서)을 정함. format이 없으면 '' */
export function archetypeFor(info = {}, material = null) {
  const format = info.format || (info.request ? requestHints(info.request).format : '');
  if (!format) return '';
  const ev = material?.detected?.event || {};
  return decideArchetype({ format, durationMin: minutesBetween(info.start || ev.start, info.end || ev.end) || undefined, size: info.size, practiceRatio: material?.detected?.practice?.ratio }).primary;
}

const insertBefore = (bp, types, sec) => { const i = bp.sections.findIndex((s) => types.includes(s?.type)); bp.sections.splice(i < 0 ? bp.sections.length : i, 0, sec); };
const hasType = (bp, t) => bp.sections.some((s) => s?.type === t);

/** 참여 기능 → 칸 추가·빼기, 실시간 설정, 개인정보 범위. info.features가 없으면 그대로 */
export function applyFeatures(bp, info = {}) {
  if (!Array.isArray(info.features)) return bp;
  bp.sections = Array.isArray(bp.sections) ? bp.sections : [];
  const f = info.features.flatMap((x) => String(x).split('+'));
  const on = (k) => f.includes(k);
  const hadAttendance = hasType(bp, 'attendance');
  if (on('qa') && !hasType(bp, 'qa')) insertBefore(bp, ['board', 'materials', 'followup', 'instructor', 'survey', 'closing'], { id: 'qa', type: 'qa', nav: '질문', title: '질문' });
  if (on('board') && !hasType(bp, 'board')) insertBefore(bp, ['materials', 'followup', 'instructor', 'survey', 'closing'], { id: 'board', type: 'board', nav: '보드', title: '나눔 보드', categories: [{ id: 'work', label: '결과물' }, { id: 'reflection', label: '소감' }], allowFiles: !info.minor });
  if (on('attendance') && !hasType(bp, 'attendance')) insertBefore(bp, ['readiness', 'outline', 'stations'], { id: 'attendance', type: 'attendance', nav: '출석', title: '출석 확인' });
  if (on('poll') && !hasType(bp, 'poll')) insertBefore(bp, ['qa', 'board', 'materials', 'followup', 'instructor', 'survey', 'closing'], { id: 'poll', type: 'poll', nav: '투표', title: '투표', items: [{ id: 'word', question: '오늘 연수를 한 낱말로 말하면?', kind: 'word', options: [] }] });
  // 끈 기능의 칸은 뺌(내용이 거의 없는 칸만)
  const off = ['qa', 'board', 'attendance', 'poll'].filter((t) => !on(t));
  bp.sections = bp.sections.filter((s) => !off.includes(s?.type));
  if (info.minor) bp.sections.forEach((s) => { if (s?.type === 'board') s.allowFiles = false; });
  const liveOn = f.some((x) => LIVE_KEYS.includes(x));
  // 만족도 조사: 실시간이 켜져 있으면 사이트 안 기본 설문, 아니면 설문 주소가 있을 때만. 마무리 칸 앞에
  if (!hasType(bp, 'survey') && (liveOn || info.surveyUrl)) insertBefore(bp, ['closing'], { id: 'survey', type: 'survey', nav: '설문', title: '만족도 조사', url: info.surveyUrl || '', qr: true, questions: liveOn ? DEFAULT_SURVEY.map((q) => ({ ...q })) : [] });
  if (info.surveyUrl) bp.sections.forEach((s) => { if (s?.type === 'survey' && !s.url) s.url = info.surveyUrl; });
  if (liveOn) bp.sections.forEach((s) => { if (s?.type === 'survey' && !s.url && !s.questions?.length) s.questions = DEFAULT_SURVEY.map((q) => ({ ...q })); });
  if (!liveOn) bp.sections = bp.sections.filter((s) => !(s?.type === 'survey' && !s.url && s.questions?.length));
  const prev = bp.live || {};
  bp.live = { ...prev, features: f.filter((x) => LIVE_KEYS.includes(x)), provider: liveOn ? (prev.provider && prev.provider !== 'none' ? prev.provider : 'local') : 'none', code: prev.code || randomCode() };
  // 받을 정보: 미성년은 별명만. 출석을 새로 켤 때만 이름·소속으로 바꾸고, 그 밖에는 강사가 고른 값을 지킴
  const cur = bp.privacy?.collect;
  const collect = info.minor ? ['nickname'] : on('attendance') && !hadAttendance ? ['nickname', 'name', 'school'] : Array.isArray(cur) && cur.length ? cur : ['nickname'];
  bp.privacy = { ...(bp.privacy || {}), collect, retentionDays: bp.privacy?.retentionDays || 30 };
  return bp;
}

const REQUEST_COLORS = [
  [/남색|네이비|군청/, '#1E3A8A'], [/하늘색|스카이/, '#0284C7'], [/파란|파랑|블루|푸른/, '#2563EB'], [/청록|민트|틸/, '#0D9488'], [/초록|녹색|그린/, '#15803D'],
  [/보라|퍼플|바이올렛/, '#6D28D9'], [/분홍|핑크/, '#DB2777'], [/빨간|빨강|레드|붉은/, '#DC2626'], [/주황|오렌지/, '#EA580C'], [/노란|노랑|옐로/, '#CA8A04'],
  [/갈색|브라운|베이지/, '#92400E'], [/검정|검은|블랙|흑백|모노/, '#111827'],
];
/**
 * 요청 사항(자유 글)에서 바로 반영할 수 있는 것만 뽑음: 분위기·강조색·밝기·움직임·형식.
 * AI 없이 만든 기본 초안도 요청에 맞추려는 것이고, 나머지 내용은 AI 프롬프트(buildPrompt)로 갑니다.
 */
export function requestHints(text) {
  const t = String(text || '').slice(0, 1000); const out = { mood: moodFromWords([t]) };
  const c = REQUEST_COLORS.find(([re]) => re.test(t)); if (c) out.accent = c[1];
  if (/어둡게|어두운|다크/.test(t)) out.theme = 'dark'; else if (/밝게|밝은 (?:화면|배경|바탕)|화이트|라이트/.test(t)) out.theme = 'light';
  if (/(?:움직임|모션|효과|애니메이션)(?:은|이|을)? ?(?:없|빼|끄)|정적/.test(t)) out.motion = 0;
  else if (/스크롤 ?(?:연출|텔링)|스크롤리텔링|패럴랙스|시차|인터랙티브|화려|역동|다이내믹/.test(t)) out.motion = 3;
  else if (/차분|잔잔|조용|담백/.test(t)) out.motion = 1;
  if (/실습 ?(?:위주|중심)|워크숍/.test(t)) out.format = 'practice'; else if (/강의 ?(?:위주|중심)|특강/.test(t)) out.format = 'lecture';
  return out;
}

/** 강사 답의 디자인 값(있을 때만): 분위기 낱말·움직임·강조색·로고·프리셋. 따로 고르지 않은 것은 요청 사항에서 읽음 */
function applyDesignAnswers(bp, info) {
  bp.design = bp.design || {};
  const hint = info.request ? requestHints(info.request) : {};
  const mood = info.mood ? moodFromWords([].concat(info.mood)) : hint.mood || [];
  if (mood.length) { bp.design.mood = [...new Set([...mood, ...(info.mood ? [] : bp.design.mood || [])])].slice(0, 4); if (bp._presetAuto) delete bp.design.preset; }
  if (has(info, 'motion') && info.motion !== '') bp.design.motion = +info.motion; else if (hint.motion !== undefined && bp.design.motion === undefined) bp.design.motion = hint.motion;
  if ('accent' in info) { if (info.accent) bp.design.accent = info.accent; else delete bp.design.accent; }
  else if (hint.accent && bp._presetAuto) bp.design.accent = hint.accent;
  if (hint.theme && (!bp.design.theme || bp.design.theme === 'preset') && bp._presetAuto) bp.design.theme = hint.theme;
  if (info.logo) bp.design.logo = info.logo;
  if (info.preset && PRESET_IDS.includes(info.preset)) { bp.design.preset = info.preset; delete bp._presetAuto; }
}

/**
 * meta·대상을 info에 맞춤. fill=true(새 초안): 빈 값은 초안 값을 그대로 두고, false(고치기): info에 있는 키는 빈 값도 반영
 */
function applyMeta(bp, info, fill = false) {
  bp.meta = bp.meta || {};
  const use = (k) => (fill ? !!info[k] : has(info, k));
  for (const k of META_KEYS) if (use(k)) bp.meta[k] = info[k];
  if (use('joinUrl')) bp.meta.joinUrl = info.joinUrl || ''; // 온라인 접속 주소: 강사가 적은 값만
  if (has(info, 'admin') || info.completionRate) bp.meta.admin = { ...(bp.meta.admin || {}), ...(has(info, 'admin') ? { kind: info.admin || 'school' } : {}), ...(info.completionRate ? { completionRate: +info.completionRate } : {}) };
  bp.audience = {
    ...(bp.audience || {}),
    ...(has(info, 'size') ? { size: info.size } : {}),
    ...(has(info, 'devices') ? { devices: info.devices } : {}),
    ...(has(info, 'network') ? { network: info.network === 'offline' ? 'restricted' : info.network } : {}),
    ...(has(info, 'minor') ? { minor: !!info.minor } : {}),
  };
}

function ensureInstructorSection(bp) {
  if (!bp.instructors?.length || hasType(bp, 'instructor')) return;
  insertBefore(bp, ['survey', 'closing'], { id: 'instructor', type: 'instructor', nav: '강사', title: '강사 소개' });
}

/**
 * AI 답·자동 초안·가져온 설계도에 강사가 고른 값을 반영합니다.
 * 보안: 실시간 서버 주소·키·코드와 QR·접속 대상 주소는 설계도에서 받지 않고, 강사가 정한 값(prev, info.joinUrl)만 씁니다.
 * @param bp0 새 설계도(초안·AI 답·가져온 것)  @param info 연수 정보  @param material 교재 해석(유형·주제 추정)
 * @param prev 지금 프로젝트의 설계도(강사가 연결한 실시간 설정·고른 디자인을 지키려고)
 */
export function applyInfo(bp0, info = {}, material = null, prev = null) {
  const bp = clone(bp0);
  bp.version = 1;
  bp.meta = bp.meta || {};
  for (const k of UNTRUSTED_META) delete bp.meta[k];
  applyMeta(bp, info, true);
  if (!has(info, 'admin') && !bp.meta.admin?.kind) bp.meta.admin = { ...(bp.meta.admin || {}), kind: 'school' };
  if (!bp.archetype?.primary) bp.archetype = decideArchetype({ format: info.format, durationMin: minutesBetween(info.start, info.end), size: info.size, practiceRatio: material?.detected?.practice?.ratio });
  const topics = detectTopics([info.title || bp.meta.title, info.subtitle || bp.meta.subtitle, (material?.pages || []).slice(0, 30).map((p) => p.title || '').join(' ')].join(' '));
  const keepDesign = prev?.design && !prev._presetAuto ? prev.design : null;
  bp.design = keepDesign ? clone(keepDesign) : { ...(bp.design || {}), mood: bp.design?.mood?.length ? bp.design.mood : moodsForTopics(topics), topics: bp.design?.topics?.length ? bp.design.topics : topics };
  // 교재 글꼴(엔진이 교재에서 찾아 초안에 넣음): 새 초안 값이 있으면 그것을, 없으면(AI 답 등) 이전 값을 지킴
  const srcFonts = bp0?.design?.sourceFonts || prev?.design?.sourceFonts;
  if (srcFonts) bp.design.sourceFonts = clone(srcFonts);
  applyDesignAnswers(bp, info);
  // 컨셉 먼저: 선생님이 고친 컨셉이 있으면 그것을, 아니면 AI 답·가져온 설계도의 컨셉을, 그것도 없으면 주제에서 규칙으로 세움
  bp.concept = cleanConcept(prev?.concept?.source === 'teacher' ? prev.concept : bp.concept)
    || deriveConcept({ title: info.title || bp.meta.title, subtitle: info.subtitle || bp.meta.subtitle, topics: bp.design.topics?.length ? bp.design.topics : topics, archetype: bp.archetype.primary, admin: info.admin || bp.meta.admin?.kind });
  if (!keepDesign && (!bp.design.preset || !PRESET_IDS.includes(bp.design.preset) || bp._presetAuto)) {
    // 디자인을 자동으로 고를 때: 선생님이 분위기를 따로 말했으면 분위기·주제 순위로, 아니면 컨셉이 권하는 디자인으로(없으면 순위로)
    const ranked = rankPresets({ moods: bp.design.mood, topics: bp.design.topics, archetype: bp.archetype.primary, admin: info.admin, minor: info.minor })[0].id;
    bp.design.preset = !info.mood && !requestHints(info.request).mood?.length && bp.concept.preset ? bp.concept.preset : ranked;
    bp._presetAuto = true;
  }
  if ((!bp.instructors || !bp.instructors.length) && info.instructorName) bp.instructors = [{ name: info.instructorName, org: info.instructorOrg, email: info.instructorEmail, showEmail: !!info.instructorEmail, bio: info.instructorBio }];
  bp.sections = Array.isArray(bp.sections) ? bp.sections : [];
  ensureInstructorSection(bp);
  // 실시간 설정은 강사가 연결한 값만(설계도 속 값은 버림)
  const pl = prev?.live || {};
  bp.live = { provider: pl.provider || 'none', url: pl.url || '', anonKey: pl.anonKey || '', code: pl.code || randomCode(), anonymous: true, features: pl.features || [] };
  bp.access = prev?.access || { mode: 'link' };
  return applyFeatures(bp, info);
}

/**
 * 이미 만든 설계도에 바뀐 연수 정보를 반영(내용·디자인은 그대로). info에 있는 키만 바꿈.
 * changed(바뀐 키 목록 또는 객체)를 주면 참여 기능은 features·minor·surveyUrl이 바뀌었을 때만 다시 반영합니다
 * (연수명만 고쳤는데 강사가 뺀 칸이 되살아나지 않게).
 */
export function syncInfo(bp0, info = {}, changed = null) {
  const bp = clone(bp0);
  applyMeta(bp, info);
  applyDesignAnswers(bp, info);
  bp.sections = Array.isArray(bp.sections) ? bp.sections : [];
  if (info.instructorName) {
    const cur = bp.instructors?.[0] || {};
    bp.instructors = [{ ...cur, name: info.instructorName, org: info.instructorOrg, email: info.instructorEmail, showEmail: !!info.instructorEmail, bio: info.instructorBio }, ...(bp.instructors || []).slice(1)];
  }
  ensureInstructorSection(bp);
  const keys = changed ? (Array.isArray(changed) ? changed : Object.keys(changed)) : null;
  if (keys && !keys.some((k) => ['features', 'minor', 'surveyUrl'].includes(k))) return bp;
  return applyFeatures(bp, info);
}

/** 가져온 프로젝트·설계도 정리: 실시간 연결·QR·접속 대상은 다시 정하게 비움 */
export function sanitizeImported(bp0) {
  if (!bp0) return bp0;
  const bp = clone(bp0);
  bp.meta = bp.meta || {};
  for (const k of UNTRUSTED_META) delete bp.meta[k];
  const f = bp.live?.features || [];
  bp.live = { provider: f.length ? 'local' : 'none', url: '', anonKey: '', code: randomCode(), features: f, anonymous: true };
  return bp;
}

/**
 * 강사가 직접 준 값(info.json·CLI 옵션)만 넣는 자리: 공개 범위, 사이트·참여·짧은 주소, 실시간 연결.
 * 패치·AI 답·교재로는 바꿀 수 없는 값입니다(applyBlueprintPatch가 막음).
 */
export function applyTeacherValues(bp, info = {}, { access = '', password = '' } = {}) {
  const mode = access || info.access || (password ? 'password' : '');
  if (['link', 'public', 'password'].includes(mode)) bp.access = { mode };
  bp.meta = bp.meta || {};
  for (const k of ['siteUrl', 'joinUrl', 'shortUrl']) if (info[k]) bp.meta[k] = info[k];
  if (info.live && typeof info.live === 'object') {
    bp.live = { ...(bp.live || {}) };
    for (const k of ['provider', 'url', 'anonKey', 'code', 'features']) if (info.live[k] !== undefined) bp.live[k] = info.live[k];
  }
  return bp;
}
