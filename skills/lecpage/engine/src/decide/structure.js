// 구성 정하기: 교재의 신호(+ 강사가 고른 형식, 컨셉) → 흐름 → 칸 순서 · 이유 · 권하는 기능.
// 유형 하나를 골라 고정 순서에 끼우는 대신, 흐름이 머리·꼬리 순서를 정하고 본문은 신호가 있는 칸을 교재 순서로 놓습니다.
// 가드레일(references/modules.md §1): 첫 화면 → 목표 → 준비 → 본문 → 자료·연수 후 → 강사 → 설문 → 마무리. 설문은 마무리 앞.
// 실시간 기능은 권하기만 하고 켜지 않습니다(강사가 고를 때만 켜짐).
import { FLOWS } from '../schema/sections.js';

/** 흐름: 이름, 맞는 유형(archetype — 디자인 추천·기존 설계도와 맞추는 값), 칸 순서. '*'는 본문 자리(교재 순서로 놓는 칸) */
export const FLOW_INFO = {
  follow: { label: '따라 하기', archetype: 'lab', order: ['hero', 'goals', 'readiness', 'steps5', 'outline', 'schedule', 'stations', '*', 'prompts', 'tools', 'deck', 'quiz', 'glossary', 'faq', 'materials', 'followup', 'instructor', 'speakers', 'survey', 'closing'] },
  procedure: { label: '절차·기준', archetype: 'story', order: ['hero', 'goals', 'glance', 'schedule', '*', 'stations', 'prompts', 'tools', 'deck', 'quiz', 'glossary', 'faq', 'materials', 'followup', 'instructor', 'speakers', 'survey', 'closing'] },
  discussion: { label: '사례·토론', archetype: 'story', order: ['hero', 'message', 'goals', 'glance', 'schedule', '*', 'deck', 'tools', 'quiz', 'glossary', 'faq', 'materials', 'followup', 'instructor', 'speakers', 'survey', 'closing'] },
  course: { label: '과정', archetype: 'course', order: ['hero', 'goals', 'glance', 'sessions', 'schedule', 'readiness', '*', 'outline', 'stations', 'prompts', 'tools', 'deck', 'quiz', 'glossary', 'faq', 'materials', 'followup', 'instructor', 'speakers', 'survey'] },
  event: { label: '행사', archetype: 'live', order: ['hero', 'glance', 'goals', 'schedule', 'speakers', '*', 'outline', 'faq', 'deck', 'quiz', 'glossary', 'materials', 'followup', 'instructor', 'survey', 'closing'] },
  talk: { label: '강의', archetype: 'story', order: ['hero', 'message', 'goals', 'steps5', 'outline', 'schedule', '*', 'deck', 'tools', 'stations', 'prompts', 'quiz', 'glossary', 'faq', 'materials', 'followup', 'instructor', 'speakers', 'survey', 'closing'] },
  source: { label: '교재 순서대로', archetype: 'story', order: ['hero', 'message', 'goals', 'glance', 'schedule', '*', 'stations', 'prompts', 'tools', 'deck', 'quiz', 'glossary', 'faq', 'materials', 'followup', 'instructor', 'speakers', 'survey', 'closing'] },
};
const FORMAT_FLOW = { practice: 'follow', workshop: 'follow', conference: 'event', course: 'course', discussion: 'discussion', lecture: 'talk' };
const ARCH_FLOW = { lab: 'follow', live: 'event', course: 'course', story: 'talk' };
const CONCEPT_CUES = [['discussion', /토론|성찰|나눔|사례|이야기|대화|돌아보/], ['procedure', /절차|규정|매뉴얼|대응|지침|기준/], ['follow', /실습|따라\s*하|워크숍|만들어\s*보/], ['event', /행사|설명회|컨퍼런스|포럼/], ['course', /과정|차시|직무연수/]];
const FEATURE_LABEL = { qa: '질문 받기', help: '도움 요청', progress: '진행 현황', poll: '투표·워드클라우드', board: '나눔 보드', attendance: '출석·이수 확인', signal: '신호등', reactions: '박수·반응' };

/** 컨셉(설계도 최상위 concept, 필드는 느슨하게 읽음)에서 흐름 실마리 찾기 */
function conceptHint(concept) {
  if (!concept) return { flow: '', text: '' };
  const c = typeof concept === 'string' ? { idea: concept } : concept;
  const named = [c.flow, c.structure, c.format].map((x) => String(x || '').trim()).find(Boolean) || '';
  const byName = FLOWS.includes(named) ? named : (Object.entries(FLOW_INFO).find(([, v]) => v.label === named) || [''])[0];
  const text = [c.idea, c.title, c.summary, c.why, c.message, c.oneLine].filter((x) => typeof x === 'string' && x.trim()).join(' ').slice(0, 300);
  const byCue = byName ? '' : (CONCEPT_CUES.find(([, re]) => re.test(text)) || [''])[0];
  return { flow: byName, cue: byCue, text: String(c.idea || c.title || c.summary || '').trim().slice(0, 40) };
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
  const size = Number(info.size) || d.event?.size || 0;
  const reasons = [];
  const hint = conceptHint(concept);
  let flow = '';

  // 교재의 신호로 먼저 고르고, 강사가 고른 형식이 그와 다르면 형식을 따름(강의형은 신호로 더 나눔: 사례·토론, 절차·기준, 교재 순서대로)
  const autoReasons = [];
  const auto = pickBySignals(sg, ar, practice, size, autoReasons);
  const fmt = (info.format && FORMAT_FLOW[info.format]) || (info.archetype && info.archetype !== 'story' && ARCH_FLOW[info.archetype]) || '';
  const FORMAT_KO = { practice: '실습·워크숍', workshop: '실습·워크숍', conference: '설명회·컨퍼런스', course: '여러 차시 과정', discussion: '토론', lecture: '강의·특강' };
  if (hint.flow) { flow = hint.flow; reasons.push(`컨셉에서 정한 대로 ${FLOW_INFO[flow].label} 흐름으로 잡았어요.`); }
  else if (fmt && fmt !== auto && (fmt !== 'talk' || ['follow', 'event', 'course'].includes(auto))) { flow = fmt; reasons.push(`${FORMAT_KO[info.format] ? `연수 형식(${FORMAT_KO[info.format]})` : '고르신 유형'}에 맞춰 ${FLOW_INFO[flow].label} 흐름으로 잡았어요.`); }
  else { flow = auto || 'talk'; reasons.push(...autoReasons); }
  // 컨셉의 낱말은 신호가 약할 때(강의·교재 순서대로)만 흐름을 바꿈
  if (!hint.flow && hint.cue && (flow === 'talk' || flow === 'source') && hint.cue !== flow && canFollow(hint.cue, sg, practice)) {
    flow = hint.cue; reasons.push(`컨셉("${hint.text}")에 맞춰 ${FLOW_INFO[flow].label} 흐름으로 잡았어요.`);
  } else if (hint.text && !hint.flow) reasons.push(`컨셉("${hint.text}")은 첫 화면과 문구에 반영해요.`);
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

  return { flow, label: FLOW_INFO[flow].label, archetype: { primary: arch, mix }, body, order: FLOW_INFO[flow].order.slice(), reasons: reasons.slice(0, 4), suggested: suggestFeatures(flow, sg, d, size, info), signals: sg };
}

function canFollow(flow, sg, practice) {
  if (flow === 'follow') return practice.count >= 1;
  if (flow === 'course') return sg.sessions >= 2;
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

/** 권하는 기능: 신호에서 이유를 찾을 수 있는 것만. 이미 켠 기능은 뺌 */
function suggestFeatures(flow, sg, d, size, info) {
  const on = new Set(Array.isArray(info.features) ? info.features : []);
  const out = [];
  const add = (feature, reason) => { if (!on.has(feature) && !out.some((x) => x.feature === feature)) out.push({ feature, label: FEATURE_LABEL[feature], reason }); };
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
  return out.slice(0, 4);
}
