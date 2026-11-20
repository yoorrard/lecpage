// 쓰던 AI 창에서 복사해 온 답 읽기(엔진 readAnswer 위에 한 겹).
// 복사하는 곳(앱·브라우저·메모장)에 따라 답이 조금 깨져 오는 일이 있음: 보이지 않는 글자(BOM·제로폭), 들여쓰기의 NBSP,
// 문자열 안의 날 줄바꿈·탭, 줄 앞 번호(코드 블록을 줄 번호째 복사), 키 뒤 전각 콜론, 두 번 감싼 JSON 문자열, undefined·NaN.
// 엔진이 못 읽으면 이것들을 고쳐 한 번 더 읽고, 그래도 JSON 덩어리가 보이는데 못 읽으면 'broken'(설명만 했다고 잘못 말하지 않게)
import { E } from './engine.js';

const INVISIBLE = /[​-‍⁠﻿]/g;
const SPACES = /[   ]/g;

/** 문자열 안의 날 줄바꿈·탭을 \n·\t로(따옴표 안팎을 셈). 첫 { 부터 마지막 } 까지만 */
function escapeRawInStrings(s) {
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b < a) return s;
  let out = ''; let inStr = false; let esc = false;
  for (let i = a; i <= b; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) { esc = false; out += c; continue; }
      if (c === '\\') { esc = true; out += c; continue; }
      if (c === '"') { inStr = false; out += c; continue; }
      if (c === '\n') { out += '\\n'; continue; }
      if (c === '\r') continue;
      if (c === '\t') { out += '\\t'; continue; }
      out += c; continue;
    }
    if (c === '"') inStr = true;
    out += c;
  }
  return s.slice(0, a) + out + s.slice(b + 1);
}

/** 줄마다 앞에 붙은 번호(1 {, 2.   "meta", 3 | …)를 뗌. 글이 있는 줄의 8할 넘게 번호로 시작하고 1이나 0부터일 때만 */
function dropLineNumbers(s) {
  const lines = s.split('\n'); const re = /^\s*(\d{1,5})(?:[.:|)]\s?|\s)/;
  const full = lines.filter((l) => l.trim());
  const hit = full.filter((l) => re.test(l));
  if (full.length < 3 || hit.length < full.length * 0.8 || +re.exec(hit[0])[1] > 1) return s;
  return lines.map((l) => l.replace(re, '')).join('\n');
}

/** 조금 깨진 답을 고친 글(대화 전체를 붙여 넣었으면 프롬프트 끝 줄 뒤 답 부분만. 고칠 것이 없으면 그 글 그대로) */
export function tidyAnswer(text) {
  let s = E.answerPart(String(text || '')).replace(INVISIBLE, '').replace(SPACES, ' ').replace(/\r\n?/g, '\n');
  // 통째로 한 번 더 감싼 JSON 문자열("{\"meta\":…}")
  const t = s.trim();
  if (/^"\{[\s\S]*\}"$/.test(t)) { try { const v = JSON.parse(t); if (typeof v === 'string') s = v; } catch { /* 그대로 */ } }
  s = dropLineNumbers(s);
  s = s.replace(/("[^"\n]*")\s*：/g, '$1:').replace(/:\s*(?:undefined|NaN)\b/g, ': null');
  return escapeRawInStrings(s);
}

/**
 * 붙여 넣은 답 → 엔진 readAnswer와 같은 모양({ kind, json }) + 'broken'(JSON 덩어리가 보이는데 고쳐도 못 읽음).
 * 고쳐서 읽었으면 text에 고친 글
 */
export function readAnswer(text) {
  const r = E.readAnswer(text);
  if (r.kind === 'ok' || r.kind === 'empty' || r.kind === 'prompt') return r;
  const fixed = tidyAnswer(text);
  if (fixed !== text) { const r2 = E.readAnswer(fixed); if (r2.kind === 'ok' || (r2.kind === 'cut' && r.kind !== 'cut')) return { ...r2, text: fixed }; }
  if (r.kind !== 'cut' && /\{[\s\S]*["']?\b(?:sections|meta|changes|concept|design)["']?\s*[:：]/.test(fixed)) return { kind: 'broken' };
  return r;
}

/** 키 연결로 받은 답에서 설계도 꺼내기: 엔진이 못 읽으면 고쳐서 한 번 더(못 읽으면 던짐) */
export function extractAnswer(text) {
  try { return E.extractJson(text); } catch (e) { const fixed = tidyAnswer(text); if (fixed === text) throw e; return E.extractJson(fixed); }
}
