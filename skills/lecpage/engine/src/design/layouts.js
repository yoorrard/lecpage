// 본문 배치 변형: 섹션 종류마다 '구조가 다른' 배치 3~5가지(정렬만 다른 것은 변형으로 세지 않음).
// 설계도의 섹션에 layout을 적으면 그 배치를, 없으면 프리셋의 본문 계획(PRESET_BODY → presetPlan(preset).body)을 따릅니다.
//
// 변형 하나 = [이름, 주인공, 틀, 등장 낱개(차분 단계), 등장 낱개(스크롤 연동 단계 — 스크롤이 직접 움직이는 요소는 뺌), 고르는 기준]
//   주인공(lead): text 글 · number 큰 숫자 · figure 그림 · diagram 도식(교재의 값으로 그린 그림) · tool 조작(쓰고 누르는 칸)
//   틀(frame): '' 섹션 종류의 기본(머리 위 stack, 줄 목록은 split/wide) · full 머리 위 + 내용이 전체 폭(두 단 문법의 영향을 받지 않음)
//   계획에서 '종류:변형@c'처럼 적으면 그 섹션만 가운데(@c)·오른쪽(@r)에 섬(자세 stance). 변형에 기본 자세가 있으면 [6]에 적음
const V = (ko, lead = 'text', frame = '', enter = '', enter2 = enter, use = '', stance = '') => ({ ko, lead, frame, enter, enter2, use, stance });

export const BODY_VARIANTS = {
  goals: {
    ledger: V('큰 번호 줄', 'number', '', '.lp-goal-list > li, .lp-goal-meta', undefined, '목표가 3~6개이고 한 줄씩 또박또박 읽히게 할 때(기본)'),
    manifesto: V('선언문(한 문장씩 크게)', 'text', 'full', '.lp-say > li, .lp-goal-meta', '.lp-goal-meta', '목표가 2~4개로 짧고, 다짐처럼 크게 읽히게 할 때', 'c'),
    journey: V('여정(길 위의 정류장)', 'diagram', 'full', '.lp-jr > li, .lp-goal-meta', '.lp-jr-pin, .lp-jr > li > p, .lp-goal-meta', '목표에 순서가 있어 하나씩 거쳐 가는 길로 보일 때'),
    bento: V('체크 카드 벤토', 'text', '', '.lp-gb > li, .lp-goal-meta', undefined, '목표가 4~6개이고 서로 독립이라 카드로 나눠 볼 때'),
    columns: V('세로 단(큰 윤곽 숫자)', 'number', 'full', '.lp-gc > li, .lp-goal-meta', undefined, '목표가 2~4개라 옆으로 나란히 견줄 때'),
  },
  glance: {
    figures: V('큰 숫자 줄', 'number', '', '.lp-glance-item', undefined, '숫자 서너 개를 크게(기본)'),
    tally: V('그림 숫자(점·고리로 그린 수)', 'diagram', 'full', '.lp-tl-item', undefined, '분·시간·퍼센트·개수처럼 양이 눈에 보이면 좋을 때'),
    spec: V('점선 사양표', 'number', '', '.lp-spec > div', undefined, '항목이 다섯 넘거나 공식 문서처럼 차분해야 할 때'),
  },
  message: {
    band: V('띠 문장', 'text', '', '', '', '문장을 화면 폭 띠에 크게(기본)'),
    stage: V('가운데 무대(모티프 그림)', 'figure', '', '', '', '한 문장이 짧고, 컨셉 그림과 함께 보여 줄 때', 'c'),
  },
  steps5: {
    steps: V('계단', 'text', '', '.lp-steps5 > li, .lp-close-line', '.lp-steps5 > li, .lp-close-line', '단계가 차례로 올라가는 느낌일 때(기본)'),
    wheel: V('둥근 고리 도식', 'diagram', 'full', '.lp-wh-ring, .lp-wh-list > li, .lp-close-line', '.lp-wh-list > li, .lp-close-line', '순서보다 서로 맞물린 요소(역량·원칙)일 때'),
    flow: V('화살표 흐름도', 'diagram', 'full', '.lp-fl > li, .lp-close-line', undefined, '앞 단계가 다음 단계로 이어지는 과정일 때'),
    tabs: V('낱말 탭(눌러 보는 풀이)', 'text', 'full', '.lp-tb, .lp-close-line', undefined, '풀이가 길어 한 번에 하나씩 읽게 할 때'),
  },
  outline: {
    stack: V('겹쳐 쌓이는 판', 'number', '', '.lp-outline-item', '', '부가 2~4개이고 큰 번호로 구분할 때(기본)'),
    zigzag: V('좌우 번갈아(그림과 글)', 'figure', 'full', '.lp-zz-item', '.lp-zz-body', '교재 쪽 그림이 있거나 부마다 그림을 곁들일 때'),
    bento: V('벤토 격자', 'text', 'full', '.lp-ob > li', undefined, '부가 4개 넘고 한 화면에 모아 볼 때'),
    toc: V('책 차례(점선과 쪽)', 'text', '', '.lp-toc > li', undefined, '글이 주인공인 연수, 교재 쪽 번호를 따라갈 때'),
    filmstrip: V('필름 띠(가로로 넘김)', 'figure', 'full', '.lp-film', undefined, '부가 4개 넘거나 교재 쪽 그림을 크게 보여 줄 때'),
  },
  schedule: {
    timeline: V('세로 시간 레일', 'text', '', '.lp-sched-bar, .lp-schedule > li', '.lp-sched-bar', '순서가 많고 설명이 긴 일정(기본)'),
    track: V('가로 트랙(시간 축)', 'diagram', 'full', '.lp-trk-bar, .lp-trk-list > li', '.lp-trk-list > li', '하루 안 일정이고 지금 순서를 한눈에 보일 때'),
    clock: V('시계판', 'diagram', 'full', '.lp-clk-face, .lp-clk-list > li', '.lp-clk-list > li', '순서가 2~8개이고 시간 비율이 중요한 짧은 연수'),
    table: V('시간표(표)', 'text', '', '.lp-stbl tbody tr', undefined, '공식 문서·여러 날 일정처럼 표가 익숙할 때'),
    blocks: V('블록 쌓기(길이만큼 높이)', 'diagram', '', '.lp-blk > li', undefined, '순서마다 길이 차이가 커서 덩어리로 보이게 할 때'),
  },
  tools: {
    bento: V('벤토 칸', 'text', '', '.lp-tools-item', undefined, '도구 2~6개를 크기가 다른 칸으로(기본)'),
    rows: V('줄 색인', 'text', '', '.lp-trw > li', undefined, '도구가 많거나 설명이 길 때'),
    tiles: V('둥근 딱지 타일', 'text', 'full', '.lp-tt > li', undefined, '도구 이름이 짧고 3~8개일 때'),
  },
  materials: {
    files: V('줄 목록', 'text', '', '.lp-materials > li, .lp-wrap > .lp-note', undefined, '자료가 많을 때(기본)'),
    shelf: V('책장', 'figure', 'full', '.lp-shelf, .lp-shelf-list > li', undefined, '자료가 3~8개이고 읽을거리가 중심일 때'),
    pile: V('파일 더미(겹친 종이 카드)', 'text', 'full', '.lp-pile > li', undefined, '자료가 2~6개이고 하나씩 집어 들게 할 때'),
  },
  instructor: {
    profile: V('이름과 이력표', 'text', '', '.lp-person-card, .lp-tl-group', undefined, '이력이 길 때(기본)'),
    card: V('명함', 'text', 'full', '.lp-bc, .lp-bc-tl > div', undefined, '연락처·소속이 중심일 때'),
    portrait: V('큰 얼굴과 소개말', 'figure', 'full', '.lp-pt-face, .lp-pt-body > *', '.lp-pt-body > *', '소개말이 있고 사진이나 이름을 크게 보일 때'),
  },
  speakers: {
    people: V('얼굴 격자', 'text', '', '.lp-speakers > li', undefined, '연사가 여럿일 때(기본)'),
    lineup: V('발표 순서 줄', 'text', '', '.lp-lineup > li', undefined, '발표 시간·순서가 중요할 때'),
  },
  sessions: {
    course: V('줄 목록', 'text', '', '.lp-sessions > li', undefined, '차시가 많을 때(기본)'),
    map: V('진행 지도', 'diagram', 'full', '.lp-smap > li', undefined, '차시 3~8개의 흐름과 지금 위치를 보일 때'),
    grid: V('달력 칸', 'number', 'full', '.lp-sgrid > li', undefined, '날짜가 중요한 과정일 때'),
  },
  faq: {
    accordion: V('아코디언', 'text', '', '.lp-faq > details', undefined, '질문이 많을 때(기본)'),
    twocol: V('두 단 펼침', 'text', 'full', '.lp-fq2 > div', undefined, '질문이 2~6개이고 답이 짧아 다 펼쳐 둘 때'),
    index: V('질문 색인(왼쪽 질문·오른쪽 답)', 'text', 'full', '.lp-tb', undefined, '답이 길어 하나씩 골라 읽게 할 때'),
  },
  glossary: {
    index: V('색인 줄', 'text', '', '.lp-glossary > div', undefined, '낱말이 많을 때(기본)'),
    cards: V('낱말 카드(큰 첫 글자)', 'text', 'full', '.lp-gcards > div', undefined, '낱말이 3~8개일 때'),
    dict: V('사전 두 단', 'text', 'full', '.lp-dict > div', undefined, '풀이가 긴 낱말이 여럿일 때'),
  },
  procedure: {
    rail: V('번호 줄', 'text', '', '.lp-proc > li', undefined, '단계 설명이 길 때(기본)'),
    flow: V('단계 흐름도', 'diagram', 'full', '.lp-pf > li', undefined, '단계 3~8개가 차례로 이어질 때'),
    cards: V('번호 카드', 'number', 'full', '.lp-pc > li', undefined, '단계마다 담당·시간이 달라 나눠 볼 때'),
  },
  cases: {
    rows: V('번호 줄', 'text', '', '.lp-case', undefined, '사례 본문이 길 때(기본)'),
    quote: V('인용 카드', 'text', 'full', '.lp-cq', undefined, '사례마다 인용(말)이 있을 때'),
    notes: V('붙인 쪽지', 'text', 'full', '.lp-cn', undefined, '짧은 사례 여럿을 벽에 붙이듯 보일 때'),
  },
  discuss: {
    list: V('번호 질문', 'text', '', '.lp-discuss-q > li, .lp-discuss-rules', undefined, '질문이 많을 때(기본)'),
    bigq: V('큰 물음표', 'figure', 'full', '.lp-bq2-list > li, .lp-discuss-rules', undefined, '질문이 1~4개이고 화면에 크게 띄울 때'),
    bubbles: V('말풍선', 'text', 'full', '.lp-bub > li, .lp-discuss-rules', undefined, '서로 주고받는 대화처럼 보이게 할 때'),
  },
  table: {
    table: V('표', 'text', '', '', '', '칸이 많은 표(기본)'),
    rowcards: V('줄 카드', 'text', 'full', '.lp-rc > div', undefined, '줄마다 한 묶음으로 읽는 표(칸 2~5개)'),
    compare: V('비교 열', 'text', 'full', '.lp-cmp > div', undefined, '2~4가지를 같은 기준으로 견줄 때'),
  },
  closing: {
    finale: V('큰 문장', 'text', '', '', '', '마지막 문장을 크게(기본)'),
    poster: V('그래픽 가득', 'figure', '', '', '', '컨셉 그림으로 끝을 맺을 때'),
    card: V('서명 카드', 'text', '', '', '', '인사·서명을 편지처럼 건넬 때', 'c'),
  },
  // 따라 하는 칸(조작이 중심): 쓰는 법은 같고 놓이는 구조만 다름
  readiness: { checklist: V('체크 줄', 'tool', '', '', '', '기본'), tiles: V('체크 타일', 'tool', '', '', '', '준비물이 2~6개일 때') },
  deck: { viewer: V('한 장씩 보기', 'figure', '', '', '', '기본'), rail: V('쪽 색인 곁들임', 'figure', '', '', '', '쪽 제목으로 찾아 들어가게 할 때') },
  qa: { thread: V('위에서 쓰고 아래로 쌓임', 'tool', '', '', '', '기본'), split: V('왼쪽에서 쓰고 오른쪽에 쌓임', 'tool', '', '', '', '넓은 화면에서 질문이 많이 쌓일 때') },
  quiz: { list: V('문항 줄', 'tool', '', '', '', '기본'), cards: V('문항 카드', 'tool', '', '', '', '문항이 2~6개일 때') },
  reflection: { journal: V('기록지', 'tool', '', '', '', '기본'), notes: V('나란한 쪽지', 'tool', '', '', '', '물음이 2~4개일 때') },
  survey: { form: V('문항 줄', 'tool', '', '', '', '기본'), cards: V('문항 카드', 'tool', '', '', '', '문항이 적을 때') },
  board: { wall: V('벽(격자)', 'tool', '', '', '', '기본'), feed: V('한 줄 흐름', 'tool', '', '', '', '글이 긴 나눔일 때') },
  gallery: { grid: V('고른 격자', 'figure', '', '.lp-gallery > li', undefined, '기본'), mosaic: V('크기가 다른 모자이크', 'figure', 'full', '.lp-gallery > li', undefined, '사진이 5장 넘을 때') },
};
export const VARIANT_TYPES = Object.keys(BODY_VARIANTS);
export const variantIds = (type) => Object.keys(BODY_VARIANTS[type] || {});
export const defaultVariant = (type) => variantIds(type)[0] || '';
/** 연수 후 안내는 자료와 같은 배치를 씀 */
const ALIAS = { followup: 'materials', video: 'gallery' };
export const variantType = (type) => ALIAS[type] || type;

// 컨셉 모티프의 그림 가족(render/body-graphic.js motifSvg): 첫 화면 그림과 한 식구로 본문·마무리에 되풀이
//   rings 고리 · dots 점 · tiles 도형 타일 · waves 물결 · arcs 호 · blocks 색면 · stars 별 · glyph 큰 글자 · grid 모눈
// 프리셋 → [모티프 가족, 본문 계획]. 컨셉이 비슷한 프리셋도 조합이 다르게(test/body-layouts.test.mjs가 '어느 두 프리셋도 절반 넘게 같지 않음'을 지킴)
export const PRESET_BODY = {
  'night-story': ['stars', 'goals:manifesto message:stage steps5:wheel outline:stack schedule:track tools:rows materials:pile instructor:portrait faq:twocol glossary:cards closing:poster deck:rail quiz:cards sessions:map procedure:flow cases:quote discuss:bigq table:rowcards glance:tally reflection:notes'],
  'paper-workbook': ['grid', 'goals:bento steps5:flow outline:toc schedule:table tools:tiles materials:pile instructor:card faq:index glossary:dict closing:card readiness:tiles qa:split survey:cards sessions:grid procedure:cards cases:notes discuss:list table:rowcards glance:spec board:feed'],
  'glass-lab': ['dots', 'goals:columns steps5:tabs outline:bento schedule:blocks tools:bento materials:files instructor:card faq:index glossary:cards closing:poster deck:rail qa:split reflection:notes sessions:map procedure:flow cases:rows discuss:bubbles table:compare glance:tally'],
  'playground': ['tiles', 'goals:bento@c message:stage steps5:flow outline:zigzag schedule:blocks tools:tiles materials:shelf instructor:portrait faq:twocol glossary:cards closing:poster readiness:tiles quiz:cards board:feed sessions:grid procedure:cards cases:notes discuss:bubbles table:rowcards glance:tally'],
  'calm-forest': ['waves', 'goals:journey steps5:wheel outline:toc schedule:timeline tools:rows materials:shelf instructor:portrait faq:accordion glossary:dict closing:card reflection:notes survey:cards sessions:map procedure:rail cases:quote discuss:bigq@c table:table glance:spec'],
  'official-brief': ['blocks', 'goals:ledger steps5:flow outline:bento schedule:table tools:rows materials:files instructor:card faq:index glossary:index closing:finale deck:rail readiness:tiles quiz:cards sessions:grid procedure:flow cases:rows discuss:list table:compare glance:spec'],
  'editorial-ink': ['glyph', 'goals:columns steps5:steps outline:toc schedule:table tools:rows materials:shelf instructor:portrait faq:twocol glossary:dict closing:finale qa:split reflection:notes survey:cards sessions:course procedure:rail cases:quote discuss:bigq table:table glance:spec'],
  'retro-pop': ['rings', 'goals:manifesto@c message:stage steps5:tabs outline:filmstrip schedule:track tools:tiles materials:pile instructor:card faq:twocol glossary:cards closing:poster readiness:tiles board:feed reflection:notes sessions:grid procedure:cards cases:notes discuss:bubbles table:rowcards glance:tally'],
  'chalkboard': ['waves', 'goals:journey steps5:flow outline:zigzag schedule:blocks tools:bento materials:pile instructor:profile faq:index glossary:cards closing:card deck:rail quiz:cards survey:cards sessions:map procedure:cards cases:notes discuss:bubbles table:rowcards glance:tally'],
  'blueprint-tech': ['grid', 'goals:columns steps5:flow outline:bento schedule:track tools:rows materials:files instructor:card faq:accordion glossary:dict closing:poster deck:rail readiness:tiles qa:split sessions:map procedure:flow cases:rows discuss:list table:compare glance:spec'],
  'riso-zine': ['dots', 'goals:manifesto message:stage steps5:steps outline:zigzag schedule:blocks tools:tiles materials:shelf instructor:portrait faq:twocol glossary:index closing:poster quiz:cards board:feed survey:cards sessions:grid procedure:cards cases:notes discuss:bigq table:rowcards glance:tally'],
  'sunrise-warm': ['rings', 'goals:journey message:stage steps5:wheel outline:filmstrip schedule:clock tools:rows materials:files instructor:portrait faq:twocol glossary:cards closing:card reflection:notes readiness:tiles sessions:map procedure:rail cases:quote discuss:bubbles table:rowcards glance:tally'],
  'keynote-dark': ['stars', 'goals:manifesto message:stage steps5:tabs outline:filmstrip schedule:clock tools:bento materials:files instructor:portrait faq:index glossary:index closing:finale deck:rail qa:split quiz:cards sessions:map procedure:flow cases:quote discuss:bigq@c table:compare glance:figures'],
  'corporate-clean': ['blocks', 'goals:bento steps5:tabs outline:bento schedule:track tools:rows materials:files instructor:card faq:accordion glossary:index closing:card readiness:tiles survey:cards reflection:notes sessions:grid procedure:cards cases:rows discuss:list table:compare glance:spec'],
  'soft-pastel': ['tiles', 'goals:bento message:stage steps5:wheel outline:zigzag schedule:clock tools:tiles materials:pile instructor:card faq:accordion glossary:cards closing:card quiz:cards board:feed deck:rail sessions:map procedure:cards cases:notes discuss:bubbles table:rowcards glance:tally'],
  'kinetic-type': ['glyph', 'goals:manifesto@r steps5:steps outline:filmstrip schedule:blocks tools:rows materials:shelf instructor:profile faq:index glossary:dict closing:finale qa:split readiness:tiles survey:cards sessions:course procedure:rail cases:quote discuss:bigq table:table glance:figures'],
  'warm-minimal': ['waves', 'goals:columns steps5:steps outline:toc@r schedule:timeline tools:rows materials:shelf instructor:profile faq:twocol glossary:dict closing:card reflection:notes deck:rail quiz:cards sessions:course procedure:rail cases:quote discuss:bigq@c table:table glance:spec'],
  'deck-collage': ['blocks', 'goals:bento steps5:tabs outline:filmstrip schedule:timeline tools:tiles materials:pile instructor:card faq:index glossary:cards closing:poster deck:rail survey:cards board:feed sessions:grid procedure:cards cases:notes discuss:list table:rowcards glance:figures'],
  'time-dial': ['arcs', 'goals:journey steps5:wheel outline:bento schedule:track tools:bento materials:files instructor:card faq:index glossary:index closing:poster qa:split quiz:cards readiness:tiles sessions:map procedure:flow cases:rows discuss:bubbles table:compare glance:tally'],
  'knot-orbit': ['rings', 'goals:columns steps5:wheel outline:zigzag schedule:blocks tools:tiles materials:files instructor:portrait faq:accordion glossary:cards closing:poster deck:rail reflection:notes survey:cards sessions:map procedure:flow cases:rows discuss:bigq table:compare glance:tally'],
  'stone-stream': ['waves', 'goals:journey@c message:stage steps5:steps outline:zigzag schedule:timeline tools:rows materials:shelf instructor:portrait faq:twocol glossary:index closing:poster quiz:cards qa:split board:feed sessions:course procedure:rail cases:quote discuss:bigq table:table glance:figures'],
  'ripple-center': ['rings', 'goals:manifesto message:stage steps5:wheel outline:toc schedule:clock tools:tiles materials:shelf instructor:portrait faq:twocol glossary:cards closing:poster reflection:notes survey:cards sessions:map procedure:rail cases:quote discuss:bigq table:rowcards glance:tally'],
  'minute-map': ['dots', 'goals:ledger steps5:flow outline:toc schedule:blocks tools:rows materials:files instructor:profile faq:accordion glossary:cards closing:poster deck:rail readiness:tiles quiz:cards reflection:notes sessions:map procedure:flow cases:rows discuss:list table:compare glance:tally'],
  'mosaic-split': ['tiles', 'goals:bento steps5:tabs outline:zigzag schedule:track tools:tiles materials:pile instructor:profile faq:accordion glossary:dict closing:poster board:feed survey:cards qa:split sessions:grid procedure:cards cases:notes discuss:bubbles table:rowcards glance:figures'],
  'cover-sheet': ['glyph', 'goals:columns steps5:flow outline:zigzag schedule:table tools:bento materials:shelf instructor:portrait faq:index glossary:index closing:finale deck:rail readiness:tiles reflection:notes sessions:course procedure:cards cases:quote discuss:bigq table:rowcards glance:figures'],
  'vertical-type': ['glyph', 'goals:manifesto steps5:steps outline:toc schedule:timeline tools:rows materials:shelf instructor:profile faq:twocol glossary:dict closing:card quiz:cards survey:cards qa:split sessions:course procedure:rail cases:quote discuss:bigq table:table glance:spec'],
  'swiss-offset': ['blocks', 'goals:columns steps5:flow outline:bento schedule:track tools:rows materials:files instructor:card faq:twocol glossary:index closing:finale board:feed readiness:tiles deck:rail sessions:grid procedure:flow cases:rows discuss:list table:compare glance:spec'],
};

const STANCES = { c: 'center', r: 'right' };
/** '종류:변형@자세 …' → { 종류: { variant, stance } } (없는 종류·변형은 버림) */
export function parseBody(spec) {
  const out = {};
  for (const w of String(spec || '').split(/\s+/).filter(Boolean)) {
    const [k, rest = ''] = w.split(':'); const [v, st = ''] = rest.split('@');
    if (BODY_VARIANTS[k]?.[v]) out[k] = { variant: v, stance: STANCES[st] || '' };
  }
  return out;
}
export const presetMotif = (id) => (PRESET_BODY[id] || [])[0] || 'rings';
const bodyCache = new Map();
export function presetBody(id) { if (!bodyCache.has(id)) bodyCache.set(id, parseBody((PRESET_BODY[id] || [])[1])); return bodyCache.get(id); }

/**
 * 이 섹션의 배치: 설계도에 적은 layout → 프리셋의 본문 계획 → 섹션 종류의 기본.
 * @returns {{ type, variant, stance, meta, own }} own = 설계도에서 직접 고름
 */
export function variantOf(s, presetId) {
  const t = variantType(s.type), all = BODY_VARIANTS[t];
  if (!all) return { type: t, variant: '', stance: '', meta: null, own: false };
  const own = typeof s.layout === 'string' && s.type !== 'stations' ? s.layout.split('@') : [];
  const plan = presetBody(presetId)[t];
  const variant = all[own[0]] ? own[0] : plan?.variant || defaultVariant(t);
  const meta = all[variant];
  const stance = all[own[0]] ? (STANCES[own[1]] || (own[1] === 'l' ? '' : STANCES[meta.stance] || '')) : plan?.stance || STANCES[meta.stance] || '';
  return { type: t, variant, stance, meta, own: !!all[own[0]] };
}
/** 설계도 검증용: 섹션 종류에 맞는 layout 값이면 그대로('변형' 또는 '변형@c|r|l'), 아니면 '' */
export function cleanLayout(type, v) {
  if (typeof v !== 'string' || type === 'stations') return '';
  const [id, st = ''] = v.trim().split('@');
  return BODY_VARIANTS[variantType(type)]?.[id] ? id + (/^[crl]$/.test(st) ? '@' + st : '') : '';
}
/** 정적 지문(테스트·문서): 종류:변형:자세. 자세가 없으면 프리셋의 본문 정렬 문법 */
export function bodyFingerprint(sections, preset) {
  return sections.filter((s) => s.type !== 'hero').map((s) => { const v = variantOf(s, preset.id); return `${s.type}:${v.variant || '-'}:${v.stance || preset.variants.align || 'left'}`; });
}
