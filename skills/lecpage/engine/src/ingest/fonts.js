// 교재 글꼴 감지: 제목(display)·본문(body)에 쓴 글꼴을 글자 수로 세어 가장 많이 쓴 것을 고릅니다.
// 각 해석기(PPTX·DOCX·HWPX·PDF)가 FontRoles에 모아 file.fonts에 둡니다.
import { fontFamilyName } from '../design/fonts.js';

const HANGUL = /[ㄱ-ㆎ가-힣]/;
export const hasHangul = (t) => HANGUL.test(t || '');

/** 글 조각에 맞는 테마 글꼴 고르기: 한글이 있으면 ea(동아시아) 먼저 */
export function pickScript(pair, text) {
  if (!pair) return '';
  return hasHangul(text) ? (pair.ea || pair.latin || '') : (pair.latin || pair.ea || '');
}

export class FontRoles {
  constructor() { this.display = new Map(); this.body = new Map(); }
  add(role, name, n = 1) {
    const fam = fontFamilyName(name);
    if (!fam || !(n > 0)) return;
    const m = role === 'display' ? this.display : this.body;
    m.set(fam, (m.get(fam) || 0) + n);
  }
  get size() { return this.display.size + this.body.size; }
  result(max = 8) {
    const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([name, n]) => ({ name, n: Math.round(n) }));
    return { display: top(this.display), body: top(this.body) };
  }
}
