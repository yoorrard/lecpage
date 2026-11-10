// 연수 정보(강사가 고른 값) ↔ 설계도 연결. 규칙은 엔진(engine/src/intake.js)에 있고 skill CLI와 함께 씁니다.
// 강사 입력이 언제나 우선이고, 실시간 주소·키·코드와 QR·접속 주소는 AI 답·가져온 파일에서 받지 않습니다.
import { E } from './engine.js';
import { draftInfo, applyInfo } from '@engine/src/intake.js';

export { LIVE_KEYS, FEATURES, minutesBetween, draftInfo, applyInfo, syncInfo, sanitizeImported } from '@engine/src/intake.js';

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
