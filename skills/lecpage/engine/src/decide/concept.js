// 컨셉 먼저: 연수 주제·교재에서 "이 연수가 참가자에게 주는 경험"을 한 줄로 세우고, 그 컨셉이 디자인(프리셋·분위기·움직임·첫 화면 그림)과 구성(섹션·참여 기능)을 이끕니다.
//
// 설계도 최상위 concept(디자인뿐 아니라 구성 쪽도 읽으므로 design 밖에 둠):
//   idea      한 줄 컨셉 = 참가자가 이 연수에서 겪는 경험(색·글꼴 낱말이 아니라 경험을 적음)
//   why       주제·교재의 어디에서 나왔는지(근거 한두 문장)
//   motif     화면에 되풀이되는 은유·그림(첫 화면 그림 → 본문 구분선 → 마무리)
//   keywords  핵심 낱말 3~5개(제목·교재에서)
//   moods     분위기(내부 값). design.mood가 비었을 때 씀
//   preset    컨셉에 맞는 디자인 id. 강사가 디자인을 직접 고르지 않았을 때 디자인이 이것을 씀(validate.js, intake.js)
//   motion    컨셉이 바라는 페이지 연출 단계 0~3(환경 상한이 먼저 — decide/design.js motionCap)
//   sections  컨셉에 어울리는 섹션 종류 / features  어울리는 참여 기능 — 구성 쪽이 근거로 읽음(디자인은 읽지 않음)
//   source    'ai'(AI가 세움) · 'auto'(아래 규칙으로 세움) · 'teacher'(강사가 고침)
//
// AI가 있으면 프롬프트(prompt/bridge.js)가 컨셉을 먼저 세우게 하고, 없으면 deriveConcept가 주제 표로 세웁니다(같은 입력이면 늘 같은 결과).
import { PRESET_IDS, getPreset } from '../design/presets.js';
import { TOPIC_LABELS } from '../design/fx-catalog.js';
import { SECTION_TYPES, LIVE_FEATURES } from '../schema/sections.js';
import { detectTopics, topicWords } from './topic.js';

/** 주제별 컨셉: [한 줄 컨셉(경험), 모티프, 디자인, 분위기, 움직임, 어울리는 섹션, 어울리는 참여 기능] */
const T = (idea, motif, preset, moods, motion, sections, features) => ({ idea, motif, preset, moods, motion, sections, features });
export const TOPIC_CONCEPTS = {
  sel: T('한 사람의 마음이 물결처럼 번져 교실 전체에 닿는 것을 함께 겪는 시간', '번지는 물결', 'ripple-center', ['emotional', 'calm', 'warm'], 2, ['message', 'steps5', 'board', 'poll', 'reflection'], ['board', 'poll', 'reactions']),
  counseling: T('서두르지 않고 숨을 고르며 서로의 이야기를 끝까지 듣는 시간', '숲과 숨', 'calm-forest', ['calm', 'warm', 'natural'], 1, ['message', 'steps5', 'faq', 'reflection'], ['qa', 'board']),
  parent: T('초대받은 자리에서 아이의 하루를 함께 들여다보는 시간', '떠오르는 해와 초대장', 'sunrise-warm', ['warm', 'calm', 'emotional'], 2, ['message', 'schedule', 'faq', 'followup'], ['qa', 'poll']),
  ai: T('낯선 기술을 손으로 돌려 보며 내 수업의 도구로 바꾸는 시간', '점으로 짠 입체 매듭', 'knot-orbit', ['tech', 'futuristic', 'bold'], 2, ['goals', 'stations', 'prompts', 'tools', 'glossary'], ['help', 'progress', 'qa']),
  edutech: T('교재를 한 장씩 넘기며 그 자리에서 따라 해 보는 시간', '펼친 교재', 'deck-collage', ['editorial', 'handmade', 'bold'], 2, ['readiness', 'deck', 'stations', 'tools', 'materials'], ['help', 'progress', 'board']),
  coding: T('설계도를 그리듯 한 단계씩 만들어 끝내 돌아가게 하는 시간', '도면과 모눈', 'blueprint-tech', ['tech', 'minimal'], 1, ['goals', 'readiness', 'stations', 'glossary', 'quiz'], ['help', 'progress', 'signal']),
  maker: T('손으로 조립하고 고쳐 가며 작동하는 것을 만드는 시간', '도면과 모눈', 'blueprint-tech', ['tech', 'handmade'], 1, ['readiness', 'stations', 'gallery', 'materials'], ['help', 'progress', 'board']),
  science: T('질문에서 출발해 관찰하고 기록하며 까닭을 찾는 시간', '유리 실험실', 'glass-lab', ['tech', 'natural', 'minimal'], 2, ['goals', 'stations', 'glossary', 'quiz'], ['poll', 'qa', 'progress']),
  data: T('흩어진 기록이 점 하나하나로 모여 무늬가 되는 것을 보는 시간', '1분을 점 하나로 찍은 시간 지도', 'minute-map', ['tech', 'minimal', 'formal'], 1, ['goals', 'readiness', 'stations', 'glossary', 'quiz'], ['progress', 'help', 'poll']),
  math: T('도형과 규칙을 직접 맞춰 보며 패턴을 발견하는 시간', '도형 모자이크', 'mosaic-split', ['playful', 'bold'], 2, ['goals', 'stations', 'quiz', 'gallery'], ['poll', 'board', 'progress']),
  art: T('색과 모양을 직접 놓아 보며 내 표현을 찾는 시간', '도형 모자이크', 'mosaic-split', ['playful', 'handmade', 'bold'], 2, ['outline', 'stations', 'gallery', 'board'], ['board', 'reactions']),
  reading: T('한 줄씩 천천히 읽고 여백에 내 생각을 적어 보는 시간', '세로로 쓴 책 표지', 'vertical-type', ['editorial', 'calm'], 1, ['message', 'outline', 'reflection', 'glossary'], ['board', 'qa']),
  korean: T('낱말 하나, 문장 하나를 또박또박 다시 읽어 보는 시간', '세로로 쓴 책 표지', 'vertical-type', ['editorial', 'calm'], 1, ['goals', 'outline', 'glossary', 'quiz'], ['poll', 'qa']),
  history: T('오래된 기록을 한 장씩 넘기며 지금의 교실과 잇는 시간', '세로쓰기와 도장', 'vertical-type', ['editorial', 'calm'], 1, ['outline', 'schedule', 'glossary', 'gallery'], ['qa', 'poll']),
  environment: T('돌을 돌아 흐르는 물처럼 느리게 살피고 기록하는 시간', '돌과 물결', 'stone-stream', ['natural', 'calm', 'editorial'], 2, ['message', 'outline', 'gallery', 'reflection'], ['board', 'poll']),
  music: T('리듬에 몸을 맡기고 함께 소리를 맞춰 보는 시간', '통통 튀는 스티커', 'retro-pop', ['energetic', 'retro', 'playful'], 2, ['outline', 'video', 'gallery', 'board'], ['reactions', 'board', 'poll']),
  pe: T('몸으로 먼저 해 보고 규칙은 놀면서 익히는 시간', '원색 놀이터', 'playground', ['energetic', 'playful', 'bold'], 2, ['schedule', 'stations', 'video', 'gallery'], ['reactions', 'poll']),
  english: T('틀려도 괜찮은 분위기에서 말을 주고받아 보는 시간', '원색 놀이터', 'playground', ['playful', 'energetic'], 2, ['outline', 'stations', 'quiz', 'tools'], ['poll', 'reactions', 'board']),
  career: T('내일의 내 모습을 무대 위에 먼저 올려 보는 시간', '무대 조명과 지평선', 'keynote-dark', ['futuristic', 'bold', 'warm'], 3, ['message', 'steps5', 'speakers', 'followup'], ['qa', 'poll']),
  safety: T('무엇을, 언제, 어떤 순서로 하는지 한눈에 확인하는 시간', '정보 표와 큰 숫자', 'official-brief', ['formal', 'minimal'], 1, ['goals', 'schedule', 'faq', 'materials'], ['attendance', 'qa']),
  policy: T('바뀌는 것과 그대로인 것을 한눈에 갈라 보는 시간', '어긋난 격자', 'swiss-offset', ['formal', 'minimal', 'bold'], 2, ['glance', 'schedule', 'faq', 'materials'], ['qa', 'attendance']),
  admin: T('흩어진 일의 순서를 정리해 내일 바로 쓰는 시간', '겹쳐 놓인 일정 카드', 'corporate-clean', ['formal', 'minimal', 'calm'], 1, ['goals', 'schedule', 'materials', 'faq'], ['qa', 'attendance']),
  conference: T('하루의 흐름을 시계처럼 한눈에 보며 자리를 옮겨 다니는 시간', '하루 시계', 'time-dial', ['futuristic', 'bold'], 2, ['schedule', 'speakers', 'sessions', 'followup'], ['qa', 'poll', 'attendance']),
  elementary: T('아이들 눈높이에서 직접 해 보고 내일 교실에 옮기는 시간', '칠판과 분필', 'chalkboard', ['warm', 'handmade', 'playful'], 2, ['outline', 'stations', 'tools', 'gallery'], ['board', 'poll', 'reactions']),
  general: T('교재의 첫 장을 표지 삼아 오늘 배울 것을 한눈에 보는 시간', '표지 한 장', 'cover-sheet', ['bold', 'editorial', 'minimal'], 2, ['goals', 'outline', 'schedule', 'materials'], ['qa', 'poll']),
};

const STOP = /^(연수|교사|교원|선생님|수업|이야기|우리|함께|위한|하는|되는|있는|없는|대한|통해|시작|과정|직무|연구회|나눔|강의|특강|안내|예시|그리고|에서|으로)$/;
/** 제목·부제에서 핵심 낱말(조사를 떼고, 흔한 말은 빼고) 최대 n개 */
export function conceptKeywords(text, n = 4) {
  const out = [];
  for (const raw of String(text || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/)) {
    let w = raw.trim(); if ([...w].length < 2) continue;
    if ([...w].length >= 3) w = w.replace(/(에서|으로|에게|부터|까지|하는|하기|이|가|은|는|을|를|의|에|로|와|과|도)$/, '');
    if ([...w].length < 2 || STOP.test(w) || /^\d+$/.test(w) || out.includes(w)) continue;
    out.push(w); if (out.length === n) break;
  }
  return out;
}

const ARCH_KO = { story: '이야기를 따라가는', lab: '직접 해 보는 실습', live: '함께 참여하는 발표', course: '여러 차시로 이어지는' };
/**
 * 규칙으로 컨셉 세우기(AI 없이). 같은 입력이면 늘 같은 결과.
 * 주제는 design.topics → 제목·부제·교재 글 순으로 읽고, 공식 직무연수는 움직임을 차분 단계로 낮춤.
 */
export function deriveConcept({ title = '', subtitle = '', text = '', topics = [], archetype = 'story', admin = 'school' } = {}) {
  const found = topics.length ? topics : detectTopics([title, subtitle, text].join(' '));
  const topic = found.find((t) => TOPIC_CONCEPTS[t]) || 'general';
  const c = TOPIC_CONCEPTS[topic];
  const keywords = conceptKeywords(`${title} ${subtitle}`);
  const label = TOPIC_LABELS[topic] || (topic === 'data' ? '데이터' : topic === 'conference' ? '행사·발표' : topic === 'elementary' ? '초등' : '일반');
  const seen = topicWords(`${title} ${subtitle} ${text}`, topic);
  const why = `${seen.length ? `제목과 교재의 "${seen.join('", "')}"에서 ` : ''}${label} 주제를 읽었어요. ${ARCH_KO[archetype] || ARCH_KO.story} 연수에 맞춰 화면에 되풀이할 그림으로 고른 것: ${c.motif}.`;
  return { idea: c.idea, why, motif: c.motif, keywords, moods: c.moods.slice(), preset: c.preset, motion: admin === 'official' ? Math.min(1, c.motion) : c.motion, sections: c.sections.slice(), features: c.features.slice(), source: 'auto' };
}

const str = (v, n) => (typeof v === 'string' ? v.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n) : '');
const list = (v, n, len, ok) => (Array.isArray(v) ? [...new Set(v.map((x) => str(x, len)).filter((x) => x && (!ok || ok(x))))].slice(0, n) : []);
const MOOD_IDS = ['emotional', 'warm', 'futuristic', 'bold', 'minimal', 'playful', 'handmade', 'tech', 'energetic', 'retro', 'calm', 'natural', 'formal', 'editorial'];
/** 설계도의 concept를 안전한 값으로(없거나 한 줄 컨셉이 비면 null). AI 답·가져온 설계도·강사가 고친 값 모두 여기를 지남 */
export function cleanConcept(c) {
  if (!c || typeof c !== 'object') return null;
  const idea = str(c.idea, 90);
  if (!idea) return null;
  const motion = Number.isFinite(+c.motion) && c.motion !== '' && c.motion !== null && c.motion !== undefined ? Math.max(0, Math.min(3, Math.round(+c.motion))) : undefined;
  return {
    idea, why: str(c.why, 220), motif: str(c.motif, 30), keywords: list(c.keywords, 5, 16),
    moods: list(c.moods, 4, 16, (x) => MOOD_IDS.includes(x)), preset: PRESET_IDS.includes(c.preset) ? c.preset : '',
    ...(motion === undefined ? {} : { motion }),
    sections: list(c.sections, 8, 20, (x) => SECTION_TYPES.includes(x)), features: list(c.features, 6, 20, (x) => LIVE_FEATURES.includes(x)),
    source: ['ai', 'auto', 'teacher'].includes(c.source) ? c.source : 'ai',
  };
}

/** 컨셉이 이끄는 디자인 값: 강사가 직접 고르지 않은 것만 채울 때 씀 */
export function conceptDesign(concept) {
  if (!concept) return {};
  const moods = concept.moods?.length ? concept.moods : concept.preset ? getPreset(concept.preset).moods.slice(0, 3) : [];
  return { ...(concept.preset ? { preset: concept.preset } : {}), ...(moods.length ? { mood: moods } : {}), ...(concept.motion !== undefined ? { motion: concept.motion } : {}) };
}

/** 강사·문서에 보여 줄 한 줄: "컨셉 — 모티프" */
export function conceptLine(concept) {
  if (!concept?.idea) return '';
  return `${concept.idea}${concept.motif ? ` — 모티프: ${concept.motif}` : ''}`;
}
