// 구성 정하기: 교재의 신호(+ 강사가 고른 형식, 컨셉) → 흐름 → 칸 순서 · 이유 · 권하는 기능.
// 유형 하나를 골라 고정 순서에 끼우는 대신, 흐름이 머리·꼬리 순서를 정하고 본문은 신호가 있는 칸을 교재 순서로 놓습니다.
// 가드레일(references/modules.md §1): 첫 화면 → 목표 → 준비 → 본문 → 자료·연수 후 → 강사 → 설문 → 마무리. 설문은 마무리 앞.
// 실시간 기능은 권하기만 하고 켜지 않습니다(강사가 고를 때만 켜짐).
//
// 설계도 최상위 structure(초안·AI 답·앱이 같은 모양을 씀):
//   flow       흐름 id(FLOWS) / label 흐름 이름
//   reasons    왜 이렇게 구성했는지 한 줄씩(4줄까지)
//   suggested  권하는 참여 기능 [{ feature, label, reason }] — 강사가 누르면 켜짐
//   leftovers  교재에 있는데 싣지 못한 것 { count, items[{file,page,title,text,kind}] } (ingest/compose.js findLeftovers)
//   source     'auto'(엔진이 정함) · 'ai'(AI가 정한 흐름·이유)
import { FLOWS, LIVE_FEATURES, SECTION_DEFS, TAIL_TYPES } from '../schema/sections.js';

/**
 * 흐름: 이름, 언제, 큰 줄기(path — 첫 화면 다음부터. 꼬리의 자료·연수 후·강사·설문·마무리는 모두 같음),
 * 맞는 유형(archetype — 디자인 추천·기존 설계도와 맞추는 값), 칸 순서. '*'는 본문 자리(교재 순서로 놓는 칸)
 */
export const FLOW_INFO = {
  follow: { path: '목표 → 준비 → (핵심 단계) → 차례·일정 → 실습 → 프롬프트·도구 → 교재 보기 → 퀴즈·용어·FAQ', label: '따라 하기', when: '번호 단계와 도구·프롬프트가 함께 있는 실습 교재', archetype: 'lab', order: ['hero', 'goals', 'readiness', 'steps5', 'outline', 'schedule', 'stations', '*', 'prompts', 'tools', 'deck', 'quiz', 'glossary', 'faq', 'materials', 'followup', 'instructor', 'speakers', 'survey', 'closing'] },
  procedure: { path: '목표 → 수치(한눈에) → 절차 → 기준표·역할표 → FAQ → 서식·예시문', label: '절차·기준', when: '번호 단계만 있고 도구·프롬프트가 없는 절차·규정 교재', archetype: 'story', order: ['hero', 'goals', 'glance', 'schedule', '*', 'stations', 'prompts', 'tools', 'deck', 'quiz', 'glossary', 'faq', 'materials', 'followup', 'instructor', 'speakers', 'survey', 'closing'] },
  discussion: { path: '핵심 메시지 → (목표) → 사례 → 개념 → 함께 나눌 질문 → 성찰 → 읽을거리', label: '사례·토론', when: '사례·함께 나눌 질문·성찰 질문이 있는 교재', archetype: 'story', order: ['hero', 'message', 'goals', 'glance', 'schedule', '*', 'deck', 'tools', 'quiz', 'glossary', 'faq', 'materials', 'followup', 'instructor', 'speakers', 'survey', 'closing'] },
  course: { path: '목표 → 한눈에(시간·차시·이수 기준) → 차시 → 준비 → 본문 → FAQ → 과제·이수 안내', label: '과정', when: '차시가 둘 이상인 과정·직무연수', archetype: 'course', order: ['hero', 'goals', 'glance', 'sessions', 'schedule', 'readiness', '*', 'outline', 'stations', 'prompts', 'tools', 'deck', 'quiz', 'glossary', 'faq', 'materials', 'followup', 'instructor', 'speakers', 'survey'] },
  event: { path: '한눈에(참석·발표·시간) → 일정 → 발표자 → 핵심 내용(수치·표) → FAQ → 교재 보기', label: '행사', when: '참석 100명 이상이거나 발표자가 여럿인 설명회·컨퍼런스', archetype: 'live', order: ['hero', 'glance', 'goals', 'schedule', 'speakers', '*', 'outline', 'faq', 'deck', 'quiz', 'glossary', 'materials', 'followup', 'instructor', 'survey', 'closing'] },
  talk: { path: '핵심 메시지 → 목표 → (핵심 단계) → 차례·일정 → 본문 → 교재 보기', label: '강의', when: '메시지와 설명이 중심인 발표 자료', archetype: 'story', order: ['hero', 'message', 'goals', 'steps5', 'outline', 'schedule', '*', 'deck', 'tools', 'stations', 'prompts', 'quiz', 'glossary', 'faq', 'materials', 'followup', 'instructor', 'speakers', 'survey', 'closing'] },
  source: { path: '(핵심 메시지) → 목표 → 수치 → 교재의 절 순서대로 본문', label: '교재 순서대로', when: '위 신호가 없는 문서 교재(한글·워드)', archetype: 'story', order: ['hero', 'message', 'goals', 'glance', 'schedule', '*', 'stations', 'prompts', 'tools', 'deck', 'quiz', 'glossary', 'faq', 'materials', 'followup', 'instructor', 'speakers', 'survey', 'closing'] },
};
/** 신호 표(references/modules.md §1과 같음): [교재에서 보이는 것, 맞는 칸, 자리·기능]. AI 프롬프트(prompt/bridge.js)가 같은 표를 씀 */
export const SIGNAL_TABLE = [
  ['번호 단계 + 도구 주소·프롬프트가 한 쪽에', 'stations(프롬프트 원문은 prompts[], 도구는 tools, 계정·준비물은 readiness)', '목표 → 준비 → 실습을 앞쪽에. 진행 현황·도움 요청과 어울림'],
  ['번호 단계만 있고 제목이 절차·순서·대응·방법', 'procedure', '수치(glance) → 절차 → 기준표 → 역할표 → FAQ'],
  ['머리글 줄이 있는 표(기준·역할·비교·적용 일정)', 'table', '그 내용 바로 뒤'],
  ['"n분 이내", "%", "n회에서 n회로" 같은 수치 문장', 'glance', '첫 화면 바로 아래'],
  ['"사례 1·2·3", 따옴표 인용', 'cases', '본문 맨 앞'],
  ['물음표로 끝나는 목록 3개 이상, 제목이 질문·토론·나눔', 'discuss(진행 규칙은 rules[])', '사례 뒤. 나눔 보드와 어울림'],
  ['"~적어 보세요", 제목이 성찰·일지·돌아보기', 'reflection', '마무리 앞'],
  ['"n차시 + 날짜" 줄·표', 'sessions(차시별 내용·준비물·과제는 desc)', '목표 → 한눈에(시간·이수 기준) → 차시. 출석과 어울림'],
  ['이수 기준·출석 %·과제·제출 기한', 'meta.admin(kind·hours·completionRate), followup(과제 항목, completion)', '연수 후 안내'],
  ['시각 + 사람 이름, "발표 1·2·3", 발표자 소개 쪽', 'schedule + speakers', '일정 → 발표자. 강사 칸 대신 발표자 칸'],
  ['참석 100명 이상, 설명회·컨퍼런스', 'glance(참석·발표·시간), schedule, speakers', '준비 점검·실습은 빼기. 질문 받기·투표와 어울림'],
  ['서식·양식·붙임, 글상자 속 예시문', 'text의 강조 상자(> [!예시] 제목)', '뒤쪽'],
  ['"낱말: 뜻", "Q. … A. …", 보기와 정답', 'glossary · faq · quiz', '본문 뒤'],
  ['발표자 노트의 "막히면·안 되면·주의"', 'stations[].note(진행 메모는 싣지 않음)', '그 실습 안'],
  ['위 어디에도 맞지 않는 문단·표', 'text(문단·목록·표·인용 그대로)', '교재 순서 그 자리에(버리지 않음)'],
];
const FORMAT_FLOW = { practice: 'follow', workshop: 'follow', conference: 'event', course: 'course', discussion: 'discussion', lecture: 'talk' };
const ARCH_FLOW = { lab: 'follow', live: 'event', course: 'course', story: 'talk' };
const FORMAT_KO = { practice: '실습·워크숍', workshop: '실습·워크숍', conference: '설명회·컨퍼런스', course: '여러 차시 과정', discussion: '토론', lecture: '강의·특강' };
const CONCEPT_CUES = [['discussion', /토론|성찰|나눔|사례|이야기|대화|돌아보/], ['procedure', /절차|규정|매뉴얼|대응|지침|기준/], ['follow', /실습|따라\s*하|워크숍|만들어\s*보/], ['event', /행사|설명회|컨퍼런스|포럼/], ['course', /과정|차시|직무연수/]];
/** 컨셉이 고른 칸(concept.sections) → 흐름 실마리. 앞에 있을수록 먼저 */
const SECTION_CUES = [['discussion', ['cases', 'discuss', 'reflection']], ['procedure', ['procedure']], ['follow', ['stations', 'prompts']], ['course', ['sessions']], ['event', ['speakers']]];
export const FEATURE_LABEL = { qa: '질문 받기', help: '도움 요청', progress: '진행 현황', poll: '투표·워드클라우드', board: '나눔 보드', attendance: '출석·이수 확인', signal: '신호등', reactions: '박수·반응' };
/** 컨셉만으로 권할 때의 까닭(신호에서 이유를 못 찾았을 때) */
const FEATURE_WHY = { qa: '손 들기 어려운 질문을 휴대폰으로 모아요.', help: '막힌 사람이 버튼 하나로 알려요.', progress: '누가 어디까지 했는지 강사 화면에서 봐요.', poll: '생각을 한 번에 모아 화면에 띄워요.', board: '결과물과 소감을 올리고 서로 봐요.', attendance: '입실·퇴실을 받아 이수자 명단을 만들어요.', signal: '이해했는지 색으로 알려요.', reactions: '박수와 하트가 발표 화면에 떠올라요.' };

/** 컨셉(설계도 최상위 concept)에서 흐름 실마리 찾기: 고른 칸(sections) → 한 줄 컨셉의 낱말 순 */
function conceptHint(concept) {
  if (!concept) return { cue: '', text: '', features: [], auto: true };
  const c = typeof concept === 'string' ? { idea: concept } : concept;
  const secs = Array.isArray(c.sections) ? c.sections : [];
  const auto = !c.source || c.source === 'auto';
  // 규칙으로 세운 컨셉(주제 표)의 칸 목록은 주제의 기본값이라 낱말만 봄
  const bySection = auto ? '' : (SECTION_CUES.find(([, types]) => types.some((t) => secs.includes(t))) || [''])[0];
  const words = [c.idea, c.why, c.motif].filter((x) => typeof x === 'string' && x.trim()).join(' ').slice(0, 300);
  const byWord = (CONCEPT_CUES.find(([, re]) => re.test(words)) || [''])[0];
  const feats = (Array.isArray(c.features) ? c.features : []).filter((f) => LIVE_FEATURES.includes(f));
  return { cue: bySection || byWord, text: String(c.idea || '').trim().slice(0, 40), features: auto ? [] : feats, auto };
}

/**
 * @param {object} info 연수 정보(강사 답): format, size, admin, features, start·end …
 * @param {object|null} material 교재 해석(material.detected의 신호를 봄)
 * @param {object|string|null} concept 컨셉(있으면 흐름 이유에 반영, 없어도 됨)
 * @returns {{ flow, label, archetype:{primary,mix}, body:'source'|'slots', order:string[], reasons:string[], suggested:Array<{feature,label,reason}>, signals:object }}
 */
export function decideStructure(info = {}, material = null, concept = null) {
  const d = material?.detected || {};
  const sg = d.signals || {};
  const ar = d.archetype || {};
  const practice = d.practice || { count: 0, ratio: 0 };
  // 앱의 인원은 구간 값(30명 이하=25 …)이 기본으로 들어 있어 교재에 적힌 참석 인원("300명")이 더 크면 그것을 씀
  const size = Math.max(Number(info.size) || 0, d.event?.size || 0);
  const reasons = [];
  const hint = conceptHint(concept);
  let flow = '';

  // 교재의 신호로 먼저 고르고, 강사가 고른 형식이 그와 다르면 형식을 따름(강의형은 신호로 더 나눔: 사례·토론, 절차·기준, 교재 순서대로)
  const autoReasons = [];
  const auto = pickBySignals(sg, ar, practice, size, autoReasons);
  const fmt = (info.format && FORMAT_FLOW[info.format]) || (info.archetype && info.archetype !== 'story' && ARCH_FLOW[info.archetype]) || '';
  if (fmt && fmt !== auto && (fmt !== 'talk' || ['follow', 'event', 'course'].includes(auto))) { flow = fmt; reasons.push(`${FORMAT_KO[info.format] ? `연수 형식(${FORMAT_KO[info.format]})` : '고르신 유형'}에 맞춰 ${FLOW_INFO[flow].label} 흐름으로 잡았어요.`); }
  else { flow = auto || 'talk'; reasons.push(...autoReasons); }
  // 컨셉은 신호가 약할 때(강의·교재 순서대로)만 흐름을 바꿈. 교재에 그 흐름의 재료가 있어야 함
  if (hint.cue && (flow === 'talk' || flow === 'source') && hint.cue !== flow && canFollow(hint.cue, sg, practice)) {
    flow = hint.cue; reasons.push(`컨셉("${hint.text}")에 맞춰 ${FLOW_INFO[flow].label} 흐름으로 잡았어요.`);
  }
  if (!reasons.length) reasons.push('발표 자료라 메시지 → 차례 → 교재 보기 순서로 잡았어요.');

  const body = sg.doc ? 'source' : 'slots';
  if (body === 'source' && flow !== 'source') reasons.push('문서 교재라 본문은 교재의 절 순서를 그대로 따랐어요.');
  if (sg.speakers >= 2) reasons.push(`발표자가 ${sg.speakers}명이라 강사 소개 대신 발표자 칸을 넣었어요.`);
  if (body === 'source' && (d.figures || []).length >= 2 && flow !== 'course') reasons.push('꼭 기억할 수치를 첫 화면 아래에 올렸어요.');

  const mix = [];
  const arch = FLOW_INFO[flow].archetype;
  if (arch === 'lab' && practice.ratio < 0.8) mix.push('story');
  if (arch === 'story' && practice.ratio >= 0.2) mix.push('lab');
  if (arch === 'course' && practice.ratio >= 0.3) mix.push('lab');

  return { flow, label: FLOW_INFO[flow].label, archetype: { primary: arch, mix }, body, order: FLOW_INFO[flow].order.slice(), reasons: reasons.slice(0, 4), suggested: suggestFeatures(flow, sg, d, size, info, hint), signals: sg };
}

function canFollow(flow, sg, practice) {
  if (flow === 'follow') return practice.count >= 1;
  if (flow === 'course') return sg.sessions >= 2;
  if (flow === 'discussion') return sg.cases >= 1 || sg.questions >= 2 || sg.reflection >= 1;
  if (flow === 'procedure') return sg.procedure >= 3;
  if (flow === 'event') return sg.speakers >= 2 || !!sg.qaTime;
  return true;
}

function pickBySignals(sg, ar, practice, size, reasons) {
  if (sg.sessions >= 2 || ar.primary === 'course') { reasons.push(sg.sessions >= 2 ? `차시가 ${sg.sessions}개 있어 과정 흐름(목표 → 한눈에 → 차시)으로 잡았어요.` : '여러 날 이어지는 연수라 과정 흐름으로 잡았어요.'); return 'course'; }
  if (ar.primary === 'live' || (sg.speakers >= 2 && size >= 100)) { reasons.push(size >= 100 ? `${size}명이 모이는 행사라 일정 → 발표자 → 내용 순서로 잡았어요.` : '발표자가 여럿인 행사라 일정 → 발표자 → 내용 순서로 잡았어요.'); return 'event'; }
  if (ar.primary === 'lab') { reasons.push(`따라 하는 실습이 ${practice.count}쪽 있어 목표 → 준비 → 실습 순서로 잡았어요.`); return 'follow'; }
  if (sg.cases >= 2 || sg.questions >= 3 || sg.reflection >= 1) {
    const bits = [sg.cases >= 2 && `사례 ${sg.cases}개`, sg.questions >= 2 && `함께 나눌 질문 ${sg.questions}개`, sg.reflection >= 1 && '성찰 질문'].filter(Boolean);
    reasons.push(`${bits.join('·')}이 있어 사례 → 질문 → 성찰 순서로 잡았어요.`); return 'discussion';
  }
  if (sg.procedure >= 3) { reasons.push(`번호 단계 ${sg.procedure}개${sg.tables ? `와 표 ${sg.tables}개` : ''}가 있어 절차 → 기준 순서로 잡았어요.`); return 'procedure'; }
  if (sg.doc) { reasons.push('문서 교재라 교재의 절 순서를 그대로 따랐어요.'); return 'source'; }
  return '';
}

/** 권하는 기능: 신호에서 이유를 찾을 수 있는 것 먼저, 그다음 컨셉(AI·강사가 세운 것)이 고른 기능. 이미 켠 기능은 뺌 */
function suggestFeatures(flow, sg, d, size, info, hint = { features: [], text: '' }) {
  const on = new Set((Array.isArray(info.features) ? info.features : []).flatMap((x) => String(x).split('+')));
  const out = [];
  const add = (feature, reason) => { if (FEATURE_LABEL[feature] && !on.has(feature) && !out.some((x) => x.feature === feature)) out.push({ feature, label: FEATURE_LABEL[feature], reason }); };
  const practice = d.practice?.count || 0;
  if (flow === 'follow' || practice >= 2) {
    add('progress', `실습이 ${practice}쪽 있어요. 누가 어디까지 했는지 강사 화면에서 볼 수 있어요.`);
    add('help', '실습하다 막힌 사람이 버튼 하나로 알릴 수 있어요.');
  }
  if (sg.questions >= 2 || sg.cases >= 2 || sg.reflection >= 1) add('board', sg.questions >= 2 ? `함께 나눌 질문이 ${sg.questions}개 있어요. 모둠 생각을 보드에 모을 수 있어요.` : '사례를 읽고 든 생각을 보드에 모을 수 있어요.');
  if (size >= 100 || sg.qaTime || flow === 'event') {
    add('qa', sg.qaTime ? `질의응답 시간이 있어요${size >= 100 ? `(참석 ${size}명)` : ''}. 휴대폰으로 질문을 모으고 공감순으로 볼 수 있어요.` : `${size || '많은'}명이 모여요. 손 들기 어려운 자리에서 질문을 모을 수 있어요.`);
    if (size >= 100) add('poll', '사람이 많을 때는 투표로 생각을 한 번에 볼 수 있어요.');
  }
  if (sg.official || info.admin === 'official' || flow === 'course') add('attendance', sg.official ? '이수 기준이 있는 직무연수예요. 입실·퇴실을 받아 이수자 명단을 만들 수 있어요.' : '여러 차시라 차시마다 출석을 받을 수 있어요.');
  for (const f of hint.features || []) add(f, `컨셉("${hint.text}")에 어울려요. ${FEATURE_WHY[f] || ''}`.trim());
  return out.slice(0, 4);
}

// ── 설계도의 structure 다루기 ─────────────────────────────
const txt = (v, n) => (typeof v === 'string' ? v.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n) : '');
/** 설계도의 structure를 안전한 값으로(없거나 흐름을 모르면 null). AI 답·가져온 설계도·초안 모두 여기를 지남 */
export function cleanStructure(s) {
  if (!s || typeof s !== 'object' || !FLOWS.includes(s.flow)) return null;
  const lo = s.leftovers && typeof s.leftovers === 'object' ? s.leftovers : {};
  const items = (Array.isArray(lo.items) ? lo.items : []).slice(0, 40).map((x) => ({ file: txt(x?.file, 40), page: Number.isFinite(+x?.page) ? Math.max(0, Math.round(+x.page)) : 0, title: txt(x?.title, 120), text: txt(x?.text, 200), kind: x?.kind === 'row' ? 'row' : 'para' })).filter((x) => x.text);
  return {
    flow: s.flow, label: FLOW_INFO[s.flow].label,
    reasons: (Array.isArray(s.reasons) ? s.reasons : []).map((r) => txt(r, 160)).filter(Boolean).slice(0, 4),
    suggested: (Array.isArray(s.suggested) ? s.suggested : []).filter((x) => x && FEATURE_LABEL[x.feature]).slice(0, 4).map((x) => ({ feature: x.feature, label: FEATURE_LABEL[x.feature], reason: txt(x.reason, 160) })),
    leftovers: { count: Math.max(items.length, Number.isFinite(+lo.count) ? Math.round(+lo.count) : 0), items },
    source: s.source === 'ai' ? 'ai' : 'auto',
  };
}

const HEAD_TYPES = ['hero', 'message', 'goals', 'glance', 'attendance'];
const END_TYPES = [...TAIL_TYPES, 'speakers', 'qa', 'board', 'poll', 'reflection'];
/**
 * 순서 가드레일(references/modules.md §1) 확인. 고치지 않고 알리기만 함(강사가 일부러 옮긴 순서를 되돌리지 않음).
 * @returns {Array<{path:string, kind:'order', message_ko:string}>}
 */
export function checkOrder(sections = []) {
  const list = sections.filter((s) => s && !s.hidden);
  const at = (t) => list.findIndex((s) => s.type === t);
  const out = [];
  const warn = (path, message_ko) => out.push({ path, kind: 'order', message_ko });
  const hero = at('hero'), goals = at('goals'), survey = at('survey'), closing = at('closing'), ready = at('readiness'), stations = at('stations');
  if (hero > 0) warn('sections', '첫 화면이 맨 위가 아니에요. 맨 위로 올려 주세요.');
  const firstBody = list.findIndex((s) => !HEAD_TYPES.includes(s.type));
  if (goals >= 0 && firstBody >= 0 && goals > firstBody) warn(`sections[${goals}]`, `연수 목표가 "${SECTION_DEFS[list[firstBody].type]?.label || '본문'}" 뒤에 있어요. 첫 화면 바로 아래에 두면 무엇을 얻는지 먼저 보여요.`);
  if (survey >= 0 && closing >= 0 && survey > closing) warn(`sections[${survey}]`, '만족도 조사가 마무리 뒤에 있어요. 마무리 앞에 두면 더 많이 답해요.');
  if (closing >= 0 && list.slice(closing + 1).some((s) => !['survey'].includes(s.type))) warn(`sections[${closing}]`, '마무리 뒤에 다른 섹션이 있어요. 마무리는 맨 끝에 두세요.');
  if (ready >= 0 && stations >= 0 && ready > stations) warn(`sections[${ready}]`, '준비 점검이 실습 뒤에 있어요. 실습 앞으로 옮겨 주세요.');
  const tailStart = list.findIndex((s) => TAIL_TYPES.includes(s.type) && s.type !== 'closing' && s.type !== 'survey');
  const late = tailStart < 0 ? -1 : list.findIndex((s, i) => i > tailStart && !END_TYPES.includes(s.type) && !HEAD_TYPES.includes(s.type));
  if (late >= 0) warn(`sections[${late}]`, `"${list[late].title || SECTION_DEFS[list[late].type]?.label || '본문'}"이 자료·연수 후 안내 뒤에 있어요. 본문은 그 앞에 두세요.`);
  return out;
}

const CONCEPT_SKIP = new Set(['hero', 'closing', 'instructor', 'survey', 'materials', 'followup', 'text', 'qa', 'board', 'poll', 'attendance']);
/**
 * 컨셉과 구성을 이음: concept.sections·features가 비었거나 규칙으로 세운 컨셉이면 실제로 고른 칸·권한 기능으로 채움.
 * AI·강사가 적은 값은 그대로 둠.
 */
export function linkConcept(concept, structure, sections = []) {
  if (!concept || typeof concept !== 'object') return concept;
  const auto = !concept.source || concept.source === 'auto';
  const types = [...new Set(sections.filter((s) => s && !s.hidden && !CONCEPT_SKIP.has(s.type)).map((s) => s.type))].slice(0, 8);
  const feats = (structure?.suggested || []).map((x) => x.feature);
  return {
    ...concept,
    sections: (auto || !concept.sections?.length) && types.length ? types : concept.sections || [],
    features: (auto || !concept.features?.length) && structure ? feats : concept.features || [],
  };
}

/**
 * 설계도에 structure를 맞춤(초안의 것을 지키거나, AI 답이면 AI가 적은 흐름·이유에 엔진의 권하는 기능을 붙임).
 * @param bp 설계도(sections·concept가 정해진 뒤)  @param info 연수 정보  @param material 교재 해석(없으면 신호 없이)
 * @param leftovers 미리 센 '싣지 못한 것'(없으면 지금 값을 둠)
 */
export function structureFor(bp, info = {}, material = null, leftovers = null) {
  const st = decideStructure({ ...info, archetype: info.archetype }, material, bp?.concept || null);
  const cur = cleanStructure(bp?.structure);
  const keep = cur && cur.reasons.length ? cur : null; // 초안이 정한 것, 또는 AI가 흐름과 이유를 함께 적은 것
  return {
    flow: keep ? keep.flow : st.flow, label: FLOW_INFO[keep ? keep.flow : st.flow].label,
    reasons: keep ? keep.reasons : st.reasons,
    suggested: st.suggested,
    leftovers: leftovers || cur?.leftovers || { count: 0, items: [] },
    source: keep ? keep.source : 'auto',
  };
}

/** 흐름 안내(프롬프트·문서용): "- 따라 하기(follow): 언제 — 목표 → 준비 → …" */
export function flowGuide() {
  return Object.entries(FLOW_INFO).map(([id, f]) => `- ${f.label}(${id}): ${f.when} — ${f.path}`);
}
