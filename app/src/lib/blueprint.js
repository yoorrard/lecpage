// 연수 정보(마법사 답) ↔ 설계도 연결
import { E } from './engine.js';

const LIVE_KEYS = ['qa', 'help', 'progress', 'board', 'poll', 'attendance', 'reactions', 'chat', 'signal'];

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

/** AI·초안 설계도에 강사가 고른 값을 반영(강사 입력이 우선) */
export function applyInfo(bp0, info, material) {
  const bp = JSON.parse(JSON.stringify(bp0 || {}));
  bp.version = 1;
  bp.meta = bp.meta || {};
  for (const k of ['title', 'subtitle', 'organizer', 'date', 'start', 'end', 'venue']) if (info[k]) bp.meta[k] = info[k];
  bp.meta.admin = { ...(bp.meta.admin || {}), kind: info.admin || 'school' };
  bp.audience = { ...(bp.audience || {}), size: info.size, devices: info.devices, network: info.network === 'offline' ? 'restricted' : info.network, minor: !!info.minor };
  const practiceRatio = material?.detected?.practice?.ratio;
  if (!bp.archetype?.primary) bp.archetype = E.decideArchetype({ format: info.format, durationMin: minutesBetween(info.start, info.end), size: info.size, practiceRatio });
  const words = E.moodFromWords(info.mood || []);
  const topics = E.detectTopics([info.title, info.subtitle, (material?.pages || []).slice(0, 30).map((p) => p.title || '').join(' ')].join(' '));
  bp.design = { ...(bp.design || {}), mood: words.length ? words : (bp.design?.mood?.length ? bp.design.mood : E.moodsForTopics(topics)), topics: bp.design?.topics?.length ? bp.design.topics : topics, motion: info.motion, accent: info.accent || '' };
  if (!bp.design.preset || !E.PRESET_IDS.includes(bp.design.preset) || bp._presetAuto) {
    bp.design.preset = E.rankPresets({ moods: bp.design.mood, topics: bp.design.topics, archetype: bp.archetype.primary, admin: info.admin, minor: info.minor })[0].id;
    bp._presetAuto = true;
  }
  if ((!bp.instructors || !bp.instructors.length) && info.instructorName) bp.instructors = [{ name: info.instructorName, org: info.instructorOrg, email: info.instructorEmail, showEmail: !!info.instructorEmail, bio: info.instructorBio }];
  bp.sections = Array.isArray(bp.sections) ? bp.sections : [];
  const has = (t) => bp.sections.some((s) => s.type === t);
  const insertBefore = (types, sec) => { const i = bp.sections.findIndex((s) => types.includes(s.type)); if (i < 0) bp.sections.push(sec); else bp.sections.splice(i, 0, sec); };
  const f = info.features || [];
  if (f.includes('qa') && !has('qa')) insertBefore(['board', 'materials', 'instructor', 'closing', 'survey'], { id: 'qa', type: 'qa', nav: '질문', title: '궁금한 점을 남겨 주세요' });
  if (f.includes('board') && !has('board')) insertBefore(['materials', 'instructor', 'closing', 'survey'], { id: 'board', type: 'board', nav: '보드', title: '함께 나누는 보드', categories: [{ id: 'work', label: '결과물' }, { id: 'reflection', label: '소감' }], allowFiles: !info.minor, maxFiles: 3 });
  if (f.includes('attendance') && !has('attendance')) insertBefore(['readiness', 'outline', 'stations'], { id: 'attendance', type: 'attendance', nav: '출석', title: '출석 확인' });
  if (info.surveyUrl && !has('survey')) bp.sections.push({ id: 'survey', type: 'survey', nav: '설문', url: info.surveyUrl, qr: true });
  if (info.surveyUrl) bp.sections.forEach((s) => { if (s.type === 'survey' && !s.url) s.url = info.surveyUrl; });
  if (!has('instructor') && bp.instructors?.length) insertBefore(['closing', 'survey'], { id: 'instructor', type: 'instructor', nav: '강사', title: '강사 소개' });
  const liveFeatures = f.filter((x) => LIVE_KEYS.includes(x));
  bp.live = { ...(bp.live || {}), features: liveFeatures, provider: liveFeatures.length ? (bp.live?.provider && bp.live.provider !== 'none' ? bp.live.provider : 'local') : 'none' };
  bp.privacy = { ...(bp.privacy || {}), collect: info.minor ? ['nickname'] : f.includes('attendance') ? ['nickname', 'name', 'school'] : ['nickname'], retentionDays: bp.privacy?.retentionDays || 30 };
  return bp;
}

export function makeDraft(p, ing) {
  const draft = ing.materialToDraft(p.material || { pages: [], files: [] }, draftInfo(p.info, p.slidesMade));
  return applyInfo({ ...draft, _presetAuto: true }, p.info, p.material);
}

export function makePrompt(p, ing) {
  const context = p.material ? ing.materialToAIContext(p.material, { maxChars: 50000 }) : '';
  const info = { ...p.info }; delete info.instructorEmail;
  const draft = p.material ? ing.materialToDraft(p.material, draftInfo(p.info, p.slidesMade)) : null;
  return E.buildPrompt({ context, info, draft });
}
