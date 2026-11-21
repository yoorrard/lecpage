// 사이트 구성의 '항목': 참여 기능 자리 표시(data-lp)와 실습 단계(data-lp-step)의 설정 칸(skills/lecpage/references/kit.md).
// 속성 ↔ 입력 값만 바꾸는 순수 함수(DOM 없음, 노드 시험 engine/test/app-studio.test.mjs에서 바로 부름).
// 읽기(readKit)는 조립(engine kit/assemble.js)이 읽는 규칙과 같게, 쓰기(writeKit)는 바꿀 속성만 { 이름: 값 | null(뺌) }으로.

export const KIT_LABEL = { poll: '투표', qa: '질문', board: '나눔 보드', attend: '출석', survey: '설문', deck: '교재 넘기기', materials: '자료실', join: '접속 QR', share: 'QR 공유', notebook: '모음', dock: '참여 막대', now: '지금 줄', step: '실습 단계' };
/** 설정 칸이 있는 것(나머지는 이름표만) */
export const SETTABLE = new Set(['poll', 'board', 'survey', 'deck', 'materials', 'step']);
/** [＋ 기능 넣기]로 섹션 끝에 넣을 수 있는 것 */
export const INSERTABLE = ['poll', 'qa', 'board', 'survey'];
export const POLL_KINDS = [['choice', '보기 고르기'], ['word', '낱말 모으기'], ['scale', '점수(1~5)']];
export const SURVEY_KINDS = [['scale', '점수'], ['choice', '고르기'], ['text', '글']];
export const LIMIT = { question: 200, option: 60, options: 6, prompt: 300, title: 100, items: 20, href: 300 };

const one = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
/** JSON 값(깨졌으면 undefined) */
function json(v) { if (v === undefined || v === null || v === '') return undefined; try { return JSON.parse(v); } catch { return undefined; } }
/** 보기 목록: JSON 배열 또는 '|'·줄바꿈으로 나눈 글(엔진 optionList와 같게) */
export function optionsOf(v) {
  const j = json(v);
  if (Array.isArray(j)) return j.map((x) => one(x).slice(0, LIMIT.option)).filter(Boolean);
  if (j === undefined && v) { const parts = String(v).split(/\s*[|\n]\s*/).map(one).filter(Boolean); if (parts.length >= 2) return parts; }
  return [];
}
/** 교재 쪽 범위 글: '1-12, 15' (빈 글은 모든 쪽) */
export const PAGES_RE = /^\s*\d{1,4}(\s*[-~–]\s*\d{1,4})?(\s*[,\s]\s*\d{1,4}(\s*[-~–]\s*\d{1,4})?)*\s*$/;

/** 속성(attrs: { 'data-…': 값 }) → 입력 값 */
export function readKit(type, a = {}) {
  switch (type) {
    case 'poll': {
      const kind = ['choice', 'word', 'scale'].includes(a['data-kind']) ? a['data-kind'] : 'choice';
      const options = optionsOf(a['data-options']);
      const av = one(a['data-answer']);
      let answer = -1;
      if (av) { const no = /^\d{1,2}$/.test(av) ? +av - 1 : -1; answer = no >= 0 && no < options.length && !options.includes(av) ? no : options.indexOf(av); }
      return { question: one(a['data-question']), kind, options, answer: kind === 'choice' ? answer : -1 };
    }
    case 'board': return { prompt: one(a['data-prompt']) };
    case 'survey': {
      const j = json(a['data-questions']);
      const list = Array.isArray(j) ? j.filter((q) => q && typeof q === 'object').map((q) => ({ q: one(q.q || q.question), kind: ['scale', 'choice', 'text'].includes(q.kind || q.type) ? (q.kind || q.type) : 'scale', options: Array.isArray(q.options) ? q.options.map((x) => one(x)).filter(Boolean) : [] })) : null;
      return { custom: !!(list && list.length), questions: list && list.length ? list : [] };
    }
    case 'deck': return { pages: one(a['data-pages']) };
    case 'materials': {
      const j = json(a['data-items']);
      return { items: Array.isArray(j) ? j.filter((x) => x && typeof x === 'object').map((x) => ({ title: one(x.title), href: one(x.href) })) : [] };
    }
    case 'step': {
      const m = one(a['data-minutes']);
      return { title: one(a['data-title']), minutes: /^\d{1,3}$/.test(m) ? m : '' };
    }
    default: return {};
  }
}

/** 입력 값이 조립에서 걸리는 곳(첫 한 가지, 없으면 '') */
export function checkKit(type, v = {}) {
  switch (type) {
    case 'poll': {
      if (!one(v.question)) return '질문을 적어 주세요.';
      if (v.kind === 'choice') { const n = (v.options || []).map(one).filter(Boolean).length; if (n < 2 || n > LIMIT.options) return '보기는 2~6개를 적어 주세요.'; }
      return '';
    }
    case 'survey': {
      if (!v.custom) return '';
      const qs = (v.questions || []).filter((q) => one(q.q));
      if (!qs.length) return '문항을 하나 이상 적어 주세요.';
      return qs.some((q) => q.kind === 'choice' && (q.options || []).map(one).filter(Boolean).length < 2) ? '고르기 문항에는 보기를 두 개 이상 적어 주세요.' : '';
    }
    case 'deck': return v.pages && !PAGES_RE.test(v.pages) ? '쪽은 1-12처럼 적어 주세요. 여러 범위는 쉼표로 나눠요.' : '';
    case 'materials': {
      const used = (v.items || []).filter((x) => one(x.title) || one(x.href));
      if (used.some((x) => !one(x.title) || !one(x.href))) return '자료마다 이름과 주소를 모두 적어 주세요.';
      return used.some((x) => !/^(files\/|https?:\/\/)/i.test(one(x.href))) ? '주소는 files/로 시작하는 사이트 파일이나 https:// 주소로 적어 주세요.' : '';
    }
    case 'step': {
      if (!one(v.title)) return '단계 이름을 적어 주세요.';
      const m = one(v.minutes); if (m && !(/^\d{1,3}$/.test(m) && +m >= 1 && +m <= 600)) return '시간은 1~600 사이 숫자(분)로 적어 주세요.';
      return '';
    }
    default: return '';
  }
}
/** '네, 조금, 아니요' → ['네','조금','아니요'] */
export const splitList = (s) => String(s || '').split(/\s*,\s*/).map(one).filter(Boolean);

/** 입력 값 → 바꿀 속성({ 이름: 글 | null(뺌) }). prev: 지금 속성(바꾸지 않을 것을 그대로 두려고) */
export function writeKit(type, v = {}, prev = {}) {
  switch (type) {
    case 'poll': {
      const options = (v.options || []).map((x) => one(x).slice(0, LIMIT.option)).filter(Boolean);
      const out = { 'data-question': one(v.question).slice(0, LIMIT.question), 'data-kind': v.kind === 'choice' ? null : v.kind };
      if (v.kind === 'choice') {
        out['data-options'] = JSON.stringify(options);
        const ans = v.answer >= 0 ? one((v.options || [])[v.answer]) : '';
        out['data-answer'] = ans && options.includes(ans) ? ans : null;
      } else {
        out['data-answer'] = null;
        // 점수: 처음부터 점수였으면 보기(점수 이름표)는 그대로, 바꿨으면 뺌(1~5) · 낱말: 보기 없음
        if (!(v.kind === 'scale' && prev['data-kind'] === 'scale')) out['data-options'] = null;
      }
      return out;
    }
    case 'board': return { 'data-prompt': one(v.prompt).slice(0, LIMIT.prompt) || null };
    case 'survey': {
      if (!v.custom) return { 'data-questions': null };
      const qs = (v.questions || []).filter((q) => one(q.q)).slice(0, LIMIT.items).map((q) => {
        const kind = ['scale', 'choice', 'text'].includes(q.kind) ? q.kind : 'scale';
        const opts = (q.options || []).map(one).filter(Boolean);
        return kind === 'choice' ? { q: one(q.q).slice(0, LIMIT.question), kind, options: opts.slice(0, 8) } : { q: one(q.q).slice(0, LIMIT.question), kind };
      });
      return { 'data-questions': qs.length ? JSON.stringify(qs) : null };
    }
    case 'deck': return { 'data-pages': one(v.pages) || null };
    case 'materials': {
      const items = (v.items || []).map((x) => ({ title: one(x.title).slice(0, 100), href: one(x.href).slice(0, LIMIT.href) })).filter((x) => x.title && x.href).slice(0, LIMIT.items);
      return { 'data-items': items.length ? JSON.stringify(items) : null };
    }
    case 'step': return { 'data-title': one(v.title).slice(0, LIMIT.title), 'data-minutes': one(v.minutes) || null };
    default: return {};
  }
}

/** 목록 한 줄 요약: 투표 질문·보드 안내 글·문항 수·쪽 범위·단계 이름 */
export function kitSummary(type, a = {}) {
  const v = readKit(type, a);
  switch (type) {
    case 'poll': return [v.question || '질문 없음', v.kind === 'choice' ? `보기 ${v.options.length}개` : POLL_KINDS.find((k) => k[0] === v.kind)?.[1], v.answer >= 0 ? '정답 있음' : ''].filter(Boolean).join(' · ');
    case 'board': return v.prompt || '안내 글 없음';
    case 'survey': return v.custom ? `문항 ${v.questions.length}개` : '기본 문항';
    case 'deck': return v.pages ? `${v.pages}쪽` : '모든 쪽';
    case 'materials': return v.items.length ? `링크 ${v.items.length}개 + 올린 자료` : '올린 자료';
    case 'step': return [v.title || '이름 없음', v.minutes ? `${v.minutes}분` : ''].filter(Boolean).join(' · ');
    default: return '';
  }
}
