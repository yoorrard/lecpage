// 연수 정보(강사가 고른 값) ↔ 설계도 연결. 강사 입력이 언제나 우선이고, 설계도가 사이트의 단일 원본입니다.
import { E } from './engine.js';

export const LIVE_KEYS = ['qa', 'help', 'progress', 'board', 'poll', 'attendance', 'reactions', 'chat', 'signal'];

/** 참여 기능(강사에게 보이는 이름·설명). quick=첫 화면에서 바로 고르는 세 가지 */
export const FEATURES = [
  { value: 'qa', label: '질문 받기', desc: '이름 없이 질문하고 공감을 눌러요. 많이 궁금한 것부터 답해요.', quick: true },
  { value: 'help', label: '막혔어요', desc: '실습하다 막히면 버튼 하나로 자리와 함께 알려요.', quick: true },
  { value: 'progress', label: '진행 체크', desc: '실습마다 완료를 누르면 강사 화면에 진행 현황이 보여요.', quick: true },
  { value: 'poll', label: '투표·낱말 구름', desc: '고르기 투표와 한 낱말 답을 모아 화면에 띄워요.' },
  { value: 'board', label: '결과물 나눔 보드', desc: '완성한 결과물과 소감을 올리고 서로 봐요.' },
  { value: 'signal', label: '신호등', desc: '이해했어요·헷갈려요·도와주세요를 색으로 알려요.' },
  { value: 'attendance', label: '출석·이수 확인', desc: '입실·퇴실을 누르고, 이수 확인표(CSV)를 받아요.' },
  { value: 'reactions', label: '박수·반응', desc: '박수와 하트가 발표 화면에 떠올라요.' },
];

export function minutesBetween(a, b) {
  const m = (t) => { const x = /^(\d{1,2}):(\d{2})/.exec(t || ''); return x ? +x[1] * 60 + +x[2] : null; };
  const s = m(a), e = m(b); return s !== null && e !== null && e > s ? e - s : 0;
}

export function draftInfo(info, slidesMade) {
  return {
    title: info.title, subtitle: info.subtitle, organizer: info.organizer, date: info.date, start: info.start, end: info.end, venue: info.venue,
    mode: info.mode, size: info.size, adminKind: info.admin, surveyUrl: info.surveyUrl,
    instructor: info.instructorName ? { name: info.instructorName, org: info.instructorOrg, email: info.instructorEmail, bio: info.instructorBio } : undefined,
    slidesBase: slidesMade ? 'assets/slides/' : '', imageBase: 'assets/media/',
  };
}

const META_KEYS = ['title', 'subtitle', 'organizer', 'date', 'start', 'end', 'venue'];
const UNTRUSTED_META = ['siteUrl', 'shortUrl', 'joinUrl']; // QR·링크 대상: AI나 남이 준 파일이 정하지 못하게
const clone = (x) => JSON.parse(JSON.stringify(x || {}));

/** 참여 기능 → 섹션 추가·빼기, 실시간 설정, 개인정보 범위 */
function applyFeatures(bp, info) {
  const has = (t) => bp.sections.some((s) => s.type === t);
  const insertBefore = (types, sec) => { const i = bp.sections.findIndex((s) => types.includes(s.type)); if (i < 0) bp.sections.push(sec); else bp.sections.splice(i, 0, sec); };
  const f = info.features || [];
  const on = (k) => f.includes(k);
  if (on('qa') && !has('qa')) insertBefore(['board', 'materials', 'instructor', 'closing', 'survey'], { id: 'qa', type: 'qa', nav: '질문', title: '궁금한 점을 남겨 주세요' });
  if (on('board') && !has('board')) insertBefore(['materials', 'instructor', 'closing', 'survey'], { id: 'board', type: 'board', nav: '보드', title: '함께 나누는 보드', categories: [{ id: 'work', label: '결과물' }, { id: 'reflection', label: '소감' }], allowFiles: !info.minor });
  if (on('attendance') && !has('attendance')) insertBefore(['readiness', 'outline', 'stations'], { id: 'attendance', type: 'attendance', nav: '출석', title: '출석 확인' });
  if (on('poll') && !has('poll')) insertBefore(['qa', 'board', 'materials', 'instructor', 'closing', 'survey'], { id: 'poll', type: 'poll', nav: '투표', title: '함께 답해요', items: [{ id: 'word', question: '오늘 연수를 한 낱말로 말하면?', kind: 'word', options: [] }] });
  // 끈 기능의 섹션은 뺌(내용이 거의 없는 섹션만)
  const offTypes = ['qa', 'board', 'attendance'].filter((t) => !on(t));
  bp.sections = bp.sections.filter((s) => !offTypes.includes(s.type));
  if (info.minor) bp.sections.forEach((s) => { if (s.type === 'board') s.allowFiles = false; });
  const liveOn = f.some((x) => LIVE_KEYS.includes(x));
  // 만족도 설문: 실시간이 켜져 있으면 사이트 안 기본 설문, 아니면 설문 주소가 있을 때만
  if (!has('survey') && (liveOn || info.surveyUrl)) bp.sections.push({ id: 'survey', type: 'survey', nav: '설문', title: '만족도 조사에 참여해 주세요', url: info.surveyUrl || '', qr: true, questions: liveOn ? E.DEFAULT_SURVEY.map((q) => ({ ...q })) : [] });
  if (info.surveyUrl) bp.sections.forEach((s) => { if (s.type === 'survey' && !s.url) s.url = info.surveyUrl; });
  if (!liveOn) bp.sections = bp.sections.filter((s) => !(s.type === 'survey' && !s.url && s.questions?.length));
  const prev = bp.live || {};
  bp.live = { ...prev, features: f.filter((x) => LIVE_KEYS.includes(x)), provider: liveOn ? (prev.provider && prev.provider !== 'none' ? prev.provider : 'local') : 'none', code: prev.code || E.randomCode() };
  bp.privacy = { ...(bp.privacy || {}), collect: info.minor ? ['nickname'] : on('attendance') ? ['nickname', 'name', 'school'] : ['nickname'], retentionDays: bp.privacy?.retentionDays || 30 };
  return bp;
}

/**
 * AI·자동 초안·가져온 설계도에 강사가 고른 값을 반영합니다.
 * 보안: 실시간 서버 주소·키·코드와 QR 대상 주소는 설계도(=AI 답·남의 파일)에서 받지 않고, 강사가 앱에서 정한 값(prev)만 씁니다.
 * @param prev 지금 프로젝트의 설계도(강사가 연결한 실시간 설정을 지키기 위해)
 */
export function applyInfo(bp0, info, material, prev = null) {
  const bp = clone(bp0);
  bp.version = 1;
  bp.meta = bp.meta || {};
  for (const k of UNTRUSTED_META) delete bp.meta[k];
  for (const k of META_KEYS) if (info[k]) bp.meta[k] = info[k];
  bp.meta.admin = { ...(bp.meta.admin || {}), kind: info.admin || 'school', ...(info.completionRate ? { completionRate: +info.completionRate } : {}) };
  bp.audience = { ...(bp.audience || {}), size: info.size, devices: info.devices, network: info.network === 'offline' ? 'restricted' : info.network, minor: !!info.minor };
  const practiceRatio = material?.detected?.practice?.ratio;
  if (!bp.archetype?.primary) bp.archetype = E.decideArchetype({ format: info.format, durationMin: minutesBetween(info.start, info.end), size: info.size, practiceRatio });
  const topics = E.detectTopics([info.title, info.subtitle, (material?.pages || []).slice(0, 30).map((p) => p.title || '').join(' ')].join(' '));
  const keepDesign = prev?.design && !prev._presetAuto ? prev.design : null;
  bp.design = keepDesign ? clone(keepDesign) : { ...(bp.design || {}), mood: bp.design?.mood?.length ? bp.design.mood : E.moodsForTopics(topics), topics: bp.design?.topics?.length ? bp.design.topics : topics };
  if (!keepDesign && (!bp.design.preset || !E.PRESET_IDS.includes(bp.design.preset) || bp._presetAuto)) {
    bp.design.preset = E.rankPresets({ moods: bp.design.mood, topics: bp.design.topics, archetype: bp.archetype.primary, admin: info.admin, minor: info.minor })[0].id;
    bp._presetAuto = true;
  }
  if ((!bp.instructors || !bp.instructors.length) && info.instructorName) bp.instructors = [{ name: info.instructorName, org: info.instructorOrg, email: info.instructorEmail, showEmail: !!info.instructorEmail, bio: info.instructorBio }];
  bp.sections = Array.isArray(bp.sections) ? bp.sections : [];
  if (!bp.sections.some((s) => s.type === 'instructor') && bp.instructors?.length) {
    const i = bp.sections.findIndex((s) => ['closing', 'survey'].includes(s.type));
    bp.sections.splice(i < 0 ? bp.sections.length : i, 0, { id: 'instructor', type: 'instructor', nav: '강사', title: '강사 소개' });
  }
  // 실시간 설정은 강사가 앱에서 연결한 값만(설계도 속 값은 버림)
  const pl = prev?.live || {};
  bp.live = { provider: pl.provider || 'none', url: pl.url || '', anonKey: pl.anonKey || '', code: pl.code || E.randomCode(), anonymous: true };
  bp.access = prev?.access || { mode: 'link' };
  return applyFeatures(bp, info);
}

/** 이미 만든 설계도에 바뀐 연수 정보를 반영(내용·디자인은 그대로). 연수 정보와 설계도가 어긋나지 않게 */
export function syncInfo(bp0, info) {
  const bp = clone(bp0);
  bp.meta = bp.meta || {};
  for (const k of META_KEYS) if (info[k] !== undefined) bp.meta[k] = info[k];
  bp.meta.admin = { ...(bp.meta.admin || {}), kind: info.admin || 'school', ...(info.completionRate ? { completionRate: +info.completionRate } : {}) };
  bp.audience = { ...(bp.audience || {}), size: info.size, devices: info.devices, network: info.network === 'offline' ? 'restricted' : info.network, minor: !!info.minor };
  if (info.instructorName) {
    const cur = bp.instructors?.[0] || {};
    bp.instructors = [{ ...cur, name: info.instructorName, org: info.instructorOrg, email: info.instructorEmail, showEmail: !!info.instructorEmail, bio: info.instructorBio }, ...(bp.instructors || []).slice(1)];
    if (!bp.sections.some((s) => s.type === 'instructor')) {
      const i = bp.sections.findIndex((s) => ['closing', 'survey'].includes(s.type));
      bp.sections.splice(i < 0 ? bp.sections.length : i, 0, { id: 'instructor', type: 'instructor', nav: '강사', title: '강사 소개' });
    }
  }
  bp.sections = Array.isArray(bp.sections) ? bp.sections : [];
  return applyFeatures(bp, info);
}

/** 가져온 프로젝트·설계도 정리: 실시간 연결·QR 대상은 다시 정하게 비움 */
export function sanitizeImported(bp0) {
  if (!bp0) return bp0;
  const bp = clone(bp0);
  bp.meta = bp.meta || {};
  for (const k of UNTRUSTED_META) delete bp.meta[k];
  const f = bp.live?.features || [];
  bp.live = { provider: f.length ? 'local' : 'none', url: '', anonKey: '', code: E.randomCode(), features: f, anonymous: true };
  return bp;
}

export function makeDraft(p, ing) {
  const draft = ing.materialToDraft(p.material || { pages: [], files: [] }, draftInfo(p.info, p.slidesMade));
  return applyInfo({ ...draft, _presetAuto: true }, p.info, p.material, p.blueprint);
}

export function makePrompt(p, ing) {
  const context = p.material ? ing.materialToAIContext(p.material, { maxChars: 50000 }) : '';
  const info = { ...p.info }; delete info.instructorEmail;
  const draft = p.material ? ing.materialToDraft(p.material, draftInfo(p.info, p.slidesMade)) : null;
  return E.buildPrompt({ context, info, draft });
}

/** 챗봇 답이 중간에 끊겼는지(여는 괄호가 더 많음) */
export function looksTruncated(text) {
  const s = String(text || ''); const i = s.indexOf('{'); if (i < 0) return false;
  let depth = 0, inStr = false, esc = false;
  for (let k = i; k < s.length; k++) {
    const c = s[k];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true; else if (c === '{' || c === '[') depth++; else if (c === '}' || c === ']') depth--;
  }
  return depth > 0;
}
