// 연수 정보(강사가 고른 값) ↔ 설계도 연결. 규칙은 엔진(engine/src/intake.js)에 있고 skill CLI와 함께 씁니다.
// 강사 입력이 언제나 우선이고, 실시간 주소·키·코드와 QR·접속 주소는 AI 답·가져온 파일에서 받지 않습니다.
import { E } from './engine.js';
import { draftInfo, applyInfo, keepDraftParts } from '@engine/src/intake.js';

export { LIVE_KEYS, FEATURES, minutesBetween, draftInfo, applyInfo, syncInfo, sanitizeImported } from '@engine/src/intake.js';

export function makeDraft(p, ing) {
  const draft = ing.materialToDraft(p.material || { pages: [], files: [] }, draftInfo(p.info, p.slidesMade));
  return applyInfo({ ...draft, _presetAuto: true }, p.info, p.material, p.blueprint);
}

export function makePrompt(p, ing) {
  const context = p.material ? ing.materialToAIContext(p.material, { maxChars: 50000 }) : '';
  const info = { ...p.info }; delete info.instructorEmail;
  const draft = p.material ? ing.materialToDraft(p.material, draftInfo(p.info, p.slidesMade)) : null;
  return E.buildPrompt({ context, info, draft, material: p.material });
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
export function guardAnswer(bp, p, ing, base = null, { assets = null } = {}) {
  const draft = p?.material && ing ? ing.materialToDraft(p.material, draftInfo(p.info, p.slidesMade)) : null;
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
