// 연수 정보(강사가 고른 값) ↔ 설계도 연결. 규칙은 엔진(engine/src/intake.js)에 있고 skill CLI와 함께 씁니다.
// 강사 입력이 언제나 우선이고, 실시간 주소·키·코드와 QR·접속 주소는 AI 답·가져온 파일에서 받지 않습니다.
import { E } from './engine.js';
import { draftInfo, applyInfo, keepDraftParts } from '@engine/src/intake.js';

export { LIVE_KEYS, FEATURES, minutesBetween, draftInfo, applyInfo, syncInfo, sanitizeImported } from '@engine/src/intake.js';

export function makeDraft(p, ing) {
  const draft = ing.materialToDraft(p.material || { pages: [], files: [] }, draftInfo(p.info, p.slidesMade));
  return applyInfo({ ...draft, _presetAuto: true }, p.info, p.material, p.blueprint);
}

/**
 * AI 답(키 연결·쓰던 AI 창)에 강사 값을 반영(applyInfo)한 뒤, 강사가 정하지 않은 링크성 칸을 비움:
 * 설문 칸 주소(survey.url)는 강사가 적은 설문 주소(info.surveyUrl)나 지금 사이트에 이미 있던 주소만, 로고(design.logo)는 강사 값이나 지금 값만.
 * (live.*·meta.siteUrl/joinUrl/shortUrl는 applyInfo가 이미 막음. 엔진 공용 규칙이 생기면 그쪽으로 합침)
 */
export function applyAnswer(bp, info, material, prev) {
  const keepLogo = [info?.logo, prev?.design?.logo].filter(Boolean);
  const okSurvey = new Set([info?.surveyUrl, ...(prev?.sections || []).filter((s) => s?.type === 'survey').map((s) => s.url)].filter(Boolean));
  const ai = { ...bp };
  if (ai.design?.logo && !keepLogo.includes(ai.design.logo)) { ai.design = { ...ai.design }; delete ai.design.logo; }
  if (Array.isArray(ai.sections)) ai.sections = ai.sections.map((s) => (s?.type === 'survey' && s.url && !okSurvey.has(s.url) ? { ...s, url: '' } : s));
  const out = applyInfo(ai, info, material, prev); // 참여 기능이 켜져 있으면 주소를 비운 설문 칸에 기본 문항을 채움
  out.sections = (out.sections || []).filter((s) => !(s?.type === 'survey' && !s.url && !s.questions?.length)); // 주소도 문항도 없는 설문 칸은 뺌
  return out;
}

/**
 * 쓰던 AI 창·키에 보내는 프롬프트의 전체 상한(글자). 긴 문서형 교재(해설서·자료집)는 초안 JSON이 수십만 자가 되어
 * 쓰던 AI 창에 넣을 수 없고 키 비용도 커짐(점검 2026-11: 60장 DOCX 37.6만 자). 한글 1자 ≈ 1토큰으로 어림하면
 * 무료·개인 요금제 AI 창의 문맥(수만 토큰)과 답(설계도 1~3만 토큰)을 함께 담는 크기. 보통 교재(1~1.5만 자)는 그대로
 */
export const PROMPT_MAX = 30000;
/** 초안의 긴 글 칸을 앞부분만 보낼 때 끝에 붙이는 표시. 답에 이 표시가 남은 칸은 앱이 교재 원문으로 되돌림(restoreShrunk) */
export const SHRUNK = '…(줄임)';
const SHRINK_NOTE = `참고 초안에서 '${SHRUNK}'으로 끝나는 칸은 교재 글이 길어 앞부분만 보낸 것이다. 그 칸은 고쳐 쓰지 말고 '${SHRUNK}'까지 그대로 둔다(앱이 교재 원문으로 채운다).`;

/** 초안 섹션의 긴 글(주소 아닌 글자) 칸을 max자 + 표시로. 원문 표(머리 → 원문)도 돌려줌 */
function shrinkDraft(draft, max) {
  const full = new Map();
  const cut = (v) => {
    if (typeof v === 'string') {
      if (v.length <= max + SHRUNK.length || /^https?:\/\//.test(v)) return v;
      const head = v.slice(0, max).trimEnd();
      full.set(head, v);
      return head + SHRUNK;
    }
    if (Array.isArray(v)) return v.map(cut);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, cut(x)]));
    return v;
  };
  return { draft: { ...draft, sections: (draft.sections || []).map(cut) }, full };
}
const longFields = (draft, n) => { let c = 0; const walk = (v) => { if (typeof v === 'string') { if (v.length > n) c++; } else if (v && typeof v === 'object') Object.values(v).forEach(walk); }; walk(draft?.sections || []); return c; };

/**
 * 프롬프트와 줄였는지. 상한(PROMPT_MAX)을 넘으면: ① 초안의 긴 글 칸을 앞부분만(긴 칸 수에 맞춰 80~300자),
 * ② 그래도 넘으면 교재 요약을 남은 자리만큼(엔진 materialToAIContext가 쪽 단위로 줄이고 뒤쪽 제목 목록을 붙임).
 * 교재를 막거나 '나눠 넣으세요'로 미루지 않음. 줄인 칸은 답을 받은 뒤 교재 원문으로 되돌림(guardAnswer → restoreShrunk)
 */
export function makePromptInfo(p, ing) {
  const info = { ...p.info }; delete info.instructorEmail;
  const draft0 = p.material ? ing.materialToDraft(p.material, draftInfo(p.info, p.slidesMade)) : null;
  const ctx = (n) => (p.material ? ing.materialToAIContext(p.material, { maxChars: n }) : '');
  const build = (context, draft) => E.buildPrompt({ context, info, draft, material: p.material });
  let text = build(ctx(50000), draft0);
  if (text.length <= PROMPT_MAX || !draft0) return { text, shrunk: false };
  const n = longFields(draft0, 300);
  const max = Math.max(80, Math.min(300, Math.floor((PROMPT_MAX * 0.35) / Math.max(1, n))));
  const small = shrinkDraft(draft0, max).draft;
  text = build(ctx(50000), small);
  for (let i = 0; i < 4 && text.length > PROMPT_MAX; i++) {
    const room = PROMPT_MAX - build('', small).length - SHRINK_NOTE.length - 300;
    text = build(ctx(Math.max(1500, Math.floor(room * (1 - i * 0.12)))), small);
  }
  // 줄임 표시를 쓴 칸이 있으면 AI에게 그대로 두라고 알림(마지막 줄 PROMPT_END는 답 읽기가 쓰므로 그 앞에)
  const end = E.PROMPT_END; const at = text.lastIndexOf(end);
  if (at > 0) text = text.slice(0, at) + SHRINK_NOTE + '\n\n' + text.slice(at);
  return { text, shrunk: true };
}
export const makePrompt = (p, ing) => makePromptInfo(p, ing).text;

/**
 * 답에 줄임 표시(SHRUNK)가 남은 글 칸을 교재 원문으로(초안 draft에서). 표시 앞 글이 보낸 앞부분과 같으면 그 원문,
 * AI가 앞부분을 조금 고쳤으면 처음 40자로 찾음. 못 찾으면 표시만 뗌
 */
export function restoreShrunk(bp, draft) {
  if (!bp || !draft || !JSON.stringify(bp.sections || []).includes(SHRUNK)) return bp;
  const n = longFields(draft, 300);
  const max = Math.max(80, Math.min(300, Math.floor((PROMPT_MAX * 0.35) / Math.max(1, n))));
  const { full } = shrinkDraft(draft, max);
  const heads = [...full.keys()];
  const fix = (v) => {
    if (typeof v === 'string') {
      const i = v.indexOf(SHRUNK); if (i < 0) return v;
      const head = v.slice(0, i).trimEnd();
      const hit = full.get(head) || full.get(heads.find((h) => head.length >= 20 && h.startsWith(head.slice(0, 40))));
      return hit || (head + v.slice(i + SHRUNK.length));
    }
    if (Array.isArray(v)) return v.map(fix);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fix(x)]));
    return v;
  };
  return { ...bp, sections: fix(bp.sections) };
}

/**
 * AI가 다시 짠 설계도에 AI에게 맡기지 않는 것을 이어 줌(엔진 keepDraftParts): 교재 보기의 쪽 그림·쪽 글·쪽별 도구,
 * 실습의 교재 그림, 교재 글꼴·기관 색. 기준은 지금 교재로 새로 만든 초안(강사가 지운 칸도 쪽 그림은 교재에서 다시 옴)
 */
export function keepFontFields(bp, base, p = null, ing = null) {
  const draft = p?.material && ing ? ing.materialToDraft(p.material, draftInfo(p.info, p.slidesMade)) : base;
  return keepDraftParts(bp, draft || base);
}

/** 설계도·글 속 주소(강사가 넣은 주소는 교재에 없어도 지킴) */
const urlsIn = (v) => JSON.stringify(v || '').match(/https?:\/\/[^\s"'<>\\]+/g) || [];

/**
 * AI 답을 받은 뒤 한 번에: 교재 지킴이(엔진 guardMaterial — 프롬프트 원문·단계·일정·FAQ·목표·교재 주소를 교재대로) → keepDraftParts.
 * 키 연결·쓰던 AI 창 모두 구성까지 짠 답은 이 함수를 거칩니다(문구만 다듬기는 교재 글을 보내지 않아 거치지 않음). restored: 교재대로 되돌린 곳(앱이 한 줄로 알리고 [보기]에서 하나씩 AI 답으로 되돌림)
 * assets: 이 연수 저장소의 파일 경로(blobs.keys). 주면 그곳에 없는 그림·파일 주소를 비움(dropMissing)
 * @returns {{ blueprint, restored }}
 */
export function guardAnswer(bp0, p, ing, base = null, { assets = null } = {}) {
  const draft = p?.material && ing ? ing.materialToDraft(p.material, draftInfo(p.info, p.slidesMade)) : null;
  const bp = restoreShrunk(bp0, draft); // 긴 교재라 앞부분만 보낸 칸은 교재 원문으로
  const allowUrls = [...urlsIn(p?.info), ...urlsIn(p?.blueprint)]; // 강사가 적은 접속·설문 주소, 지금 사이트에 이미 있는 주소
  const g = draft ? E.guardMaterial(bp, draft, { material: p.material, allowUrls }) : { blueprint: bp, restored: [] };
  return { blueprint: dropMissing(keepDraftParts(g.blueprint, draft || base || p?.blueprint), assets), restored: g.restored };
}

/**
 * 이 연수 저장소(blobs)에 없는 그림·파일 주소(assets/·media/·slides/)를 비움(엔진 dropMissingAssets): AI가 지어낸 주소,
 * 교재에서 찾았지만 앱이 저장하지 않은 그림(교재 속 그림은 읽기만 함) → 미리보기·사이트에서 깨진 그림이 되지 않게.
 * keys: blobs.keys(프로젝트 id) 결과. 아직 모르면(null) 그대로
 */
export const dropMissing = (bp, keys) => (keys ? E.dropMissingAssets(bp, keys).blueprint : bp);

/** AI 답이 중간에 끊겼는지(대화 전체를 붙여 넣어도 답 부분만 봄) */
export function looksTruncated(text) { return E.isCutAnswer(text); }
