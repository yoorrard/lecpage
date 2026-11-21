// 연수 정보의 날짜·시간을 바꾸면 사이트 글에 적힌 같은 날짜·시간을 같은 꼴로 바꿈(강사가 고친 값을 글에도 그대로).
// 글 조각(문자열)만 다룸: 가져오는 것이 없어 노드 시험에서 바로 부름. 문서(DOM)에 쓰는 것은 site-doc.js replaceSchedule.
//   날짜: 2026년 12월 3일(목) · 12월 3일 목요일 · 2026. 12. 3.(목) · 2026.12.03 · 2026-12-03 · 2026/12/03 · 12.3(목)
//         (연도도 요일도 없는 12.3·12/3은 날짜인지 몰라 그대로)
//   시간: 14:00~17:00 · 14:00 - 17:00 · 오후 2시~5시 · 오후 2시 30분부터 5시 · 2:00~5:00(오후로 읽음) — 시작~끝이 함께 있는 곳만

const DAYS = '일월화수목금토';

/** 'YYYY-MM-DD' → { y, m, d, w(요일 한 글자) } · 달력에 없는 날이면 null */
export function parseIso(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return { y, m: mo, d, w: DAYS[dt.getUTCDay()] };
}
const pad = (n, like) => (String(like).length === 2 && String(like)[0] === '0' ? String(n).padStart(2, '0') : String(n));

const DATE_RE = /(^|[^\d])(?:(\d{4})(\s*년\s*|\s*[.\-/]\s*))?(\d{1,2})(\s*월\s*|\s*[.\-/]\s*)(\d{1,2})(\s*일|\.(?!\d))?(\s*\(\s*[일월화수목금토](?:요일)?\s*\)|\s+[일월화수목금토]요일)?(?!\d)/g;

/** 글 속 from 날짜(YYYY-MM-DD)를 to 날짜로(적힌 꼴·0 채우기·요일 그대로) */
export function swapDate(text, from, to) {
  const a = parseIso(from), b = parseIso(to);
  const s = String(text ?? '');
  if (!a || !b || from === to || !s) return s;
  return s.replace(DATE_RE, (all, pre, Y, s1 = '', M, s2, D, sfx = '', wd = '') => {
    if (+M !== a.m || +D !== a.d || (Y && +Y !== a.y)) return all;
    const kor = /월/.test(s2);
    if (Y && /년/.test(s1) !== kor) return all; // '2026년 12.3'처럼 섞인 꼴은 그대로
    if (!Y && !kor && !wd) return all; // 연도·요일 없는 12.3 · 12/3
    if (kor ? sfx && !/일/.test(sfx) : /일/.test(sfx)) return all;
    if (!Y && !kor && s2.trim() === '-') return all; // 12-3(목) 같은 꼴은 드물고 번호와 헷갈림
    const day = wd ? wd.replace(/[일월화수목금토](요일)?(\s*\))?\s*$/, (x, yo = '', cl = '') => b.w + yo + cl) : '';
    return pre + (Y ? String(b.y) + s1 : '') + pad(b.m, M) + s2 + pad(b.d, D) + sfx + day;
  });
}

const TOK = '(?:(?:오전|오후)\\s*)?\\d{1,2}(?::\\d{2}|\\s*시(?:\\s*\\d{1,2}\\s*분|\\s*반)?)';
const RANGE_RE = new RegExp(`(^|[^\\d:])(${TOK})(\\s*[~∼〜\\-–—]\\s*|\\s*부터\\s*)(${TOK})(?![\\d:])`, 'g');
const ONE = /^(?:(오전|오후)(\s*))?(\d{1,2})(?::(\d{2})|\s*시(?:\s*(\d{1,2})\s*분|\s*(반))?)$/;
const hm = (s) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '')); return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null; };
function readTok(s) {
  const m = ONE.exec(s); if (!m) return null;
  const [, ap = '', gap = '', h, mm, mk, half] = m;
  if (+h > 24) return null;
  return { ap, gap, h: +h, hRaw: h, colon: mm !== undefined, min: mm !== undefined ? +mm : mk !== undefined ? +mk : half ? 30 : 0, half: !!half };
}
/** 이 토막이 나타낼 수 있는 분(오전·오후가 없고 12시 전이면 오후로도 읽음) */
function minsOf(t, ap) {
  const base = t.min + (t.h % 24) * 60;
  if (ap === '오후') return [((t.h % 12) + 12) * 60 + t.min];
  if (ap === '오전') return [(t.h % 12) * 60 + t.min];
  return t.h < 12 ? [base, base + 720] : [base];
}
function fmtTok(t, mins, { ap = '', twelve = false } = {}) {
  let h = Math.floor(mins / 60) % 24; const m = mins % 60;
  let head = '';
  if (ap) { head = (h < 12 ? '오전' : '오후') + (t.gap || ' '); h = h % 12 || 12; } else if (twelve) h = h % 12 || 12;
  if (t.colon) return head + pad(h, t.hRaw) + ':' + String(m).padStart(2, '0');
  return head + h + '시' + (!m ? '' : m === 30 && t.half ? ' 반' : ` ${m}분`);
}

/** 글 속 '시작~끝' 시간(from: ['HH:MM','HH:MM'])을 to로. 시작·끝이 함께 적힌 곳만 바꿈 */
export function swapTimeRange(text, from = [], to = []) {
  const os = hm(from[0]), oe = hm(from[1]), ns = hm(to[0]), ne = hm(to[1]);
  const s = String(text ?? '');
  if (os === null || oe === null || ns === null || ne === null || !s || (os === ns && oe === ne)) return s;
  return s.replace(RANGE_RE, (all, pre, x, sep, y) => {
    const t1 = readTok(x), t2 = readTok(y); if (!t1 || !t2) return all;
    // 끝에 오전·오후가 없으면 시작 것을 이어 읽음(오전 10시~12시의 12시는 낮 12시도 됨)
    const c1 = minsOf(t1, t1.ap), c2 = t2.ap ? minsOf(t2, t2.ap) : t1.ap ? [...minsOf(t2, t1.ap), ...minsOf(t2, '')] : minsOf(t2, '');
    const i1 = c1.indexOf(os), i2 = c2.indexOf(oe);
    if (i1 < 0 || i2 < 0) return all;
    const first = fmtTok(t1, ns, { ap: t1.ap, twelve: !t1.ap && i1 === 1 });
    // 끝에 오전·오후가 없고 시작 것을 이어 쓴 꼴(오후 2시~5시): 새 끝이 시작과 같은 때(오전·오후)면 그대로 생략
    const inherit = !t2.ap && t1.ap;
    const sameHalf = (ns < 720) === (ne < 720);
    const second = fmtTok(t2, ne, { ap: t2.ap || (inherit && !sameHalf ? 'x' : ''), twelve: (!t2.ap && i2 === 1) || (inherit && sameHalf) });
    return pre + first + sep + second;
  });
}
