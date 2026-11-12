// 본문 배치 변형: 섹션 종류마다 '구조가 다른' 배치 2~5가지(정렬만 다른 것은 변형으로 세지 않음).
// 설계도의 섹션에 layout을 적으면 그 배치를, 없으면 프리셋의 본문 계획(PRESET_BODY)을 따릅니다.
//
// 변형 하나 = V(이름, 주인공, 틀, 등장 낱개(차분 단계), 등장 낱개(스크롤 연동 단계 — 스크롤이 직접 움직이는 요소는 뺌), 고르는 기준, 기본 자세, 등장 방식, 어울림)
//   주인공(lead): text 글 · number 실제 값의 큰 숫자(순번 숫자는 글로 셈) · figure 그림 · diagram 도식(교재의 값으로 그린 그림) · tool 조작(쓰고 누르는 칸)
//   틀(frame): '' 섹션 종류의 기본(머리 위 stack, 줄 목록은 split/wide) · full 머리 위 + 내용이 전체 폭(두 단 정렬 문법의 영향을 받지 않음)
//   자세(stance): 계획에서 '종류:변형@c'처럼 적으면 그 섹션만 가운데(@c)·오른쪽(@r)에 섬. 변형의 기본 자세는 [7]
//   등장 방식(mode): 프리셋 계획이 그 섹션 종류의 방식을 따로 정하지 않았을 때 이 배치에 어울리는 방식(reveal-up의 mode)
//   어울림(tags): 프리셋 분위기와 맞추는 낱말(calm formal playful editorial tech bold warm) — 프리셋 계획을 짤 때 참고(scripts/plan-body.mjs)
const V = (ko, lead = 'text', frame = '', enter = '', enter2, use = '', stance = '', mode = '', tags = '') => ({ ko, lead, frame, enter, enter2: enter2 === undefined ? enter : enter2, use, stance, mode, tags: tags.split(' ').filter(Boolean) });
const TOOL = (ko, use, tags = '') => V(ko, 'tool', '', '', undefined, use, '', '', tags);

export const BODY_VARIANTS = {
  goals: {
    ledger: V('큰 번호 줄', 'text', '', '.lp-goal-list > li, .lp-goal-meta', undefined, '목표가 3~6개이고 한 줄씩 또박또박 읽히게 할 때(기본)', '', '', 'formal calm'),
    manifesto: V('선언문(한 문장씩 크게)', 'text', 'full', '.lp-say > li, .lp-goal-meta', '.lp-goal-meta', '목표가 2~4개로 짧고, 다짐처럼 크게 읽히게 할 때', 'c', 'fade', 'bold editorial warm'),
    journey: V('여정(길 위의 정류장)', 'diagram', 'full', '.lp-jr > li, .lp-goal-meta', '.lp-goal-meta', '목표에 순서가 있어 하나씩 거쳐 가는 길로 보일 때', '', 'clip', 'warm playful calm'),
    bento: V('체크 카드 벤토', 'text', '', '.lp-gb > li, .lp-goal-meta', undefined, '목표가 4~6개이고 서로 독립이라 카드로 나눠 볼 때', '', 'scale', 'playful tech'),
    columns: V('세로 단(큰 윤곽 숫자)', 'text', 'full', '.lp-gc > li, .lp-goal-meta', undefined, '목표가 2~4개라 옆으로 나란히 견줄 때', '', 'side', 'editorial formal bold'),
  },
  glance: {
    figures: V('큰 숫자 줄', 'number', '', '.lp-glance-item', undefined, '숫자 서너 개를 크게(기본)', '', '', 'formal bold'),
    tally: V('그림 숫자(점·고리로 그린 수)', 'diagram', 'full', '.lp-tl-item', undefined, '분·시간·퍼센트·개수처럼 양이 눈에 보이면 좋을 때', '', 'scale', 'playful warm tech'),
    spec: V('점선 사양표', 'number', '', '.lp-spec > div', undefined, '항목이 다섯 넘거나 공식 문서처럼 차분해야 할 때', '', 'wipe', 'formal tech calm'),
  },
  message: {
    band: V('띠 문장', 'text', '', '', '', '문장을 화면 폭 띠에 크게(기본)', '', '', 'bold formal'),
    stage: V('가운데 무대(모티프 그림)', 'figure', '', '', '', '한 문장이 짧고, 컨셉 그림과 함께 보여 줄 때', 'c', '', 'warm playful editorial'),
  },
  steps5: {
    steps: V('계단', 'text', '', '.lp-steps5 > li, .lp-close-line', '.lp-close-line', '단계가 차례로 올라가는 느낌일 때(기본)', '', '', 'calm formal'),
    wheel: V('둥근 고리 도식', 'diagram', 'full', '.lp-wh-ring, .lp-wh-list > li, .lp-close-line', '.lp-wh-list > li, .lp-close-line', '순서보다 서로 맞물린 요소(역량·원칙)일 때', '', 'scale', 'warm calm'),
    flow: V('화살표 흐름도', 'diagram', 'full', '.lp-fl > li, .lp-close-line', undefined, '앞 단계가 다음 단계로 이어지는 과정일 때', '', 'side', 'tech formal'),
    tabs: V('낱말 넘김(눌러 보는 풀이)', 'text', 'full', '.lp-tb-list, .lp-tb-panels, .lp-close-line', undefined, '풀이가 길어 한 번에 하나씩 읽게 할 때', '', 'fade', 'editorial tech'),
  },
  outline: {
    stack: V('겹쳐 쌓이는 판', 'text', '', '.lp-outline-item', '', '부가 2~4개이고 큰 번호로 구분할 때(기본)', '', '', 'bold formal'),
    zigzag: V('좌우 번갈아(그림과 글)', 'figure', 'full', '.lp-zz-item', '.lp-zz-body', '교재 쪽 그림이 있거나 부마다 그림을 곁들일 때', '', 'side', 'warm editorial playful'),
    bento: V('벤토 격자', 'text', 'full', '.lp-ob > li', undefined, '부가 4개 넘고 한 화면에 모아 볼 때', '', 'scale', 'tech playful'),
    toc: V('책 차례(점선과 쪽)', 'text', '', '.lp-toc > li', undefined, '글이 주인공인 연수, 교재 쪽 번호를 따라갈 때', '', 'wipe', 'editorial calm formal'),
    filmstrip: V('필름 띠(가로로 넘김)', 'figure', 'full', '.lp-film', undefined, '부가 4개 넘거나 교재 쪽 그림을 크게 보여 줄 때', '', 'side', 'bold playful tech'),
  },
  schedule: {
    timeline: V('세로 시간 레일', 'text', '', '.lp-sched-bar, .lp-schedule > li', '.lp-sched-bar', '순서가 많고 설명이 긴 일정(기본)', '', '', 'calm formal'),
    track: V('가로 트랙(시간 축)', 'diagram', 'full', '.lp-trk-list > li', undefined, '하루 안 일정이고 지금 순서를 한눈에 보일 때', '', 'wipe', 'tech bold'),
    clock: V('시계판', 'diagram', 'full', '.lp-clk-list > li', undefined, '순서가 2~8개이고 시간 비율이 중요한 짧은 연수', '', 'scale', 'warm tech'),
    table: V('시간표(표)', 'text', '', '.lp-stbl tbody tr', undefined, '공식 문서·여러 날 일정처럼 표가 익숙할 때', '', 'wipe', 'formal'),
    blocks: V('블록 쌓기(길이만큼 높이)', 'diagram', '', '.lp-blk > li', undefined, '순서마다 길이 차이가 커서 덩어리로 보이게 할 때', '', 'clip', 'playful tech'),
  },
  tools: {
    bento: V('벤토 칸', 'text', '', '.lp-tools-item', undefined, '도구 2~6개를 크기가 다른 칸으로(기본)', '', 'scale', 'playful tech'),
    rows: V('줄 색인', 'text', '', '.lp-trw > li', undefined, '도구가 많거나 설명이 길 때', '', 'wipe', 'formal editorial calm'),
    tiles: V('표 타일(떼는 쪽에 주소)', 'text', 'full', '.lp-tt > li', undefined, '도구 이름이 짧고 3~8개일 때', '', 'drop', 'playful warm'),
  },
  materials: {
    files: V('줄 목록', 'text', '', '.lp-materials > li, .lp-wrap > .lp-note', undefined, '자료가 많을 때(기본)', '', '', 'formal calm'),
    shelf: V('책장', 'figure', 'full', '.lp-shelf-list > li', undefined, '자료가 3~8개이고 읽을거리가 중심일 때', '', 'rise', 'editorial warm'),
    pile: V('파일 더미(겹친 종이 카드)', 'text', 'full', '.lp-pile > li', undefined, '자료가 2~6개이고 하나씩 집어 들게 할 때', '', 'drop', 'playful warm'),
  },
  instructor: {
    profile: V('이름과 이력표', 'text', '', '.lp-person-card, .lp-tl-group', undefined, '이력이 길 때(기본)', '', '', 'formal calm'),
    card: V('명함', 'text', 'full', '.lp-bc, .lp-bc-tl > div', undefined, '연락처·소속이 중심일 때', '', 'flip', 'formal tech'),
    portrait: V('큰 얼굴과 소개말', 'figure', 'full', '.lp-pt-body > *', undefined, '소개말이 있고 사진이나 이름을 크게 보일 때', '', 'side', 'editorial warm bold'),
  },
  speakers: {
    people: V('얼굴 격자', 'text', '', '.lp-speakers > li', undefined, '연사가 여럿일 때(기본)', '', '', 'warm playful'),
    lineup: V('발표 순서 줄', 'text', '', '.lp-lineup > li', undefined, '발표 시간·순서가 중요할 때', '', 'wipe', 'formal tech'),
  },
  sessions: {
    course: V('줄 목록', 'text', '', '.lp-sessions > li', undefined, '차시가 많을 때(기본)', '', '', 'formal calm'),
    map: V('진행 지도', 'diagram', 'full', '.lp-smap > li', undefined, '차시 3~8개의 흐름과 지금 위치를 보일 때', '', 'side', 'tech playful warm'),
    grid: V('달력 칸', 'number', 'full', '.lp-sgrid > li', undefined, '날짜가 중요한 과정일 때', '', 'scale', 'formal tech'),
  },
  faq: {
    accordion: V('아코디언', 'text', '', '.lp-faq > details', undefined, '질문이 많을 때(기본)', '', '', 'calm formal'),
    twocol: V('두 단 펼침', 'text', 'full', '.lp-fq2 > div', undefined, '질문이 2~6개이고 답이 짧아 다 펼쳐 둘 때', '', 'fade', 'editorial warm'),
    index: V('질문 색인(왼쪽 질문·오른쪽 답)', 'text', 'full', '.lp-fqi-list > div', undefined, '답이 길어 골라 읽게 할 때', '', 'wipe', 'tech editorial formal'),
  },
  glossary: {
    index: V('색인 줄', 'text', '', '.lp-glossary > div', undefined, '낱말이 많을 때(기본)', '', '', 'formal calm'),
    cards: V('낱말 카드(큰 첫 글자)', 'text', 'full', '.lp-gcards > div', undefined, '낱말이 3~8개일 때', '', 'drop', 'playful warm'),
    dict: V('사전 두 단', 'text', 'full', '.lp-dict > div', undefined, '풀이가 긴 낱말이 여럿일 때', '', 'fade', 'editorial calm'),
    web: V('낱말 그물(연수 제목을 가운데 둔 도식)', 'diagram', 'full', '.lp-gw-list > div', undefined, '낱말 3~8개가 한 주제에 묶일 때', '', 'scale', 'tech warm'),
  },
  procedure: {
    rail: V('번호 줄', 'text', '', '.lp-proc > li', undefined, '단계 설명이 길 때(기본)', '', '', 'formal calm'),
    flow: V('단계 흐름도', 'diagram', 'full', '.lp-pf > li', undefined, '단계 3~8개가 차례로 이어질 때', '', 'side', 'tech formal'),
    cards: V('번호 카드', 'text', 'full', '.lp-pc > li', undefined, '단계마다 담당·시간이 달라 나눠 볼 때', '', 'flip', 'playful bold'),
  },
  cases: {
    rows: V('번호 줄', 'text', '', '.lp-case', undefined, '사례 본문이 길 때(기본)', '', '', 'formal calm'),
    quote: V('인용 카드', 'text', 'full', '.lp-cq', undefined, '사례마다 인용(말)이 있을 때', '', 'fade', 'editorial warm'),
    notes: V('붙인 쪽지', 'text', 'full', '.lp-cn', undefined, '짧은 사례 여럿을 벽에 붙이듯 보일 때', '', 'drop', 'playful warm'),
  },
  discuss: {
    list: V('번호 질문', 'text', '', '.lp-discuss-q > li, .lp-discuss-rules', undefined, '질문이 많을 때(기본)', '', '', 'formal calm'),
    bigq: V('큰 물음표', 'figure', 'full', '.lp-bq2-list > li, .lp-discuss-rules', undefined, '질문이 1~4개이고 화면에 크게 띄울 때', 'c', 'scale', 'bold editorial'),
    bubbles: V('말풍선', 'text', 'full', '.lp-bub > li', undefined, '서로 주고받는 대화처럼 보이게 할 때', '', 'side', 'playful warm'),
  },
  table: {
    table: V('표', 'text', '', '', '', '칸이 많은 표(기본)', '', '', 'formal'),
    rowcards: V('줄 카드', 'text', 'full', '.lp-rc > div', undefined, '줄마다 한 묶음으로 읽는 표(칸 2~5개)', '', 'scale', 'playful warm'),
    compare: V('비교 열', 'text', 'full', '.lp-cmp > div', undefined, '2~4가지를 같은 기준으로 견줄 때', '', 'side', 'tech formal editorial'),
  },
  closing: {
    finale: V('큰 문장', 'text', '', '', '', '마지막 문장을 크게(기본)', '', '', 'bold'),
    poster: V('그래픽 가득', 'figure', '', '', '', '컨셉 그림으로 끝을 맺을 때', '', '', 'playful tech bold warm'),
    card: V('서명 카드', 'text', '', '', '', '인사·서명을 편지처럼 건넬 때', 'c', '', 'warm calm formal editorial'),
  },
  // 따라 하는 칸(조작이 중심): 쓰는 법은 같고 놓이는 구조만 다름(CSS만 바뀜)
  readiness: { checklist: TOOL('체크 줄', '기본', 'formal calm'), tiles: TOOL('체크 타일', '준비물이 2~6개일 때', 'playful warm'), steps: TOOL('가로 단계', '준비가 순서대로 이어질 때', 'tech editorial') },
  deck: { viewer: TOOL('한 장씩 보기', '기본', 'calm formal'), rail: TOOL('쪽 색인 곁들임', '쪽 제목으로 찾아 들어가게 할 때', 'editorial tech'), stage: TOOL('어두운 무대', '교재 쪽 그림을 크게 보일 때', 'bold playful warm') },
  qa: { thread: TOOL('위에서 쓰고 아래로 쌓임', '기본', 'calm formal'), split: TOOL('왼쪽에서 쓰고 오른쪽에 쌓임', '넓은 화면에서 질문이 많이 쌓일 때', 'tech editorial'), wall: TOOL('쪽지 벽', '짧은 질문이 많을 때', 'playful warm') },
  quiz: { list: TOOL('문항 줄', '기본', 'formal calm'), cards: TOOL('문항 카드', '문항이 2~6개일 때', 'playful tech'), big: TOOL('한 문항씩 크게', '문항이 적고 보기가 짧을 때', 'bold editorial warm') },
  reflection: { journal: TOOL('기록지', '기본', 'formal calm'), notes: TOOL('나란한 쪽지', '물음이 2~4개일 때', 'playful warm'), letter: TOOL('가운데 편지지', '돌아보는 글을 길게 쓸 때', 'editorial warm calm') },
  survey: { form: TOOL('문항 줄', '기본', 'formal calm'), cards: TOOL('문항 카드', '문항이 적을 때', 'playful tech'), sheet: TOOL('가운데 종이', '설문을 차분히 한 장으로', 'editorial warm') },
  board: { wall: TOOL('벽(격자)', '기본', 'playful warm'), feed: TOOL('한 줄 흐름', '글이 긴 나눔일 때', 'calm editorial formal'), mosaic: TOOL('크기가 다른 모자이크', '사진·결과물이 많은 나눔', 'bold tech') },
  poll: { panel: TOOL('판', '기본', 'calm formal'), split: TOOL('질문 목록 곁들임', '준비된 질문을 옆에 보일 때', 'tech editorial'), stage: TOOL('가운데 무대', '한 질문을 크게 띄울 때', 'bold warm playful') },
  gallery: { grid: V('고른 격자', 'figure', '', '.lp-gallery > li', undefined, '기본', '', '', 'calm formal'), mosaic: V('크기가 다른 모자이크', 'figure', 'full', '.lp-gallery > li', undefined, '사진이 5장 넘을 때', '', 'scale', 'bold playful') },
};
export const VARIANT_TYPES = Object.keys(BODY_VARIANTS);
export const variantIds = (type) => Object.keys(BODY_VARIANTS[type] || {});
export const defaultVariant = (type) => variantIds(type)[0] || '';
/** 연수 후 안내는 자료와 같은 배치를 씀 */
const ALIAS = { followup: 'materials' };
export const variantType = (type) => ALIAS[type] || type;

// 컨셉 모티프의 그림 가족(render/body-graphic.js motifSvg): 첫 화면 그림과 한 식구로 본문·마무리에 되풀이
//   rings 고리 · dots 점 · tiles 도형 타일 · waves 물결 · arcs 호 · blocks 색면 · stars 별 · glyph 큰 글자 · grid 모눈
// 컨셉의 motif 글에 가족을 가리키는 낱말이 있으면 그 가족, 없으면 프리셋의 가족
const MOTIF_WORDS = [[/물결|파문|파도|강|흐름|바다|숨/, 'waves'], [/별|밤|우주|새벽|달/, 'stars'], [/점|점묘|픽셀|씨앗|모래/, 'dots'], [/고리|원|동그라미|매듭|궤도|바퀴/, 'rings'], [/길|여정|시계|호|무지개|해/, 'arcs'], [/모눈|격자|도면|설계|칸/, 'grid'], [/도형|타일|모자이크|조각|퍼즐/, 'tiles'], [/색면|블록|벽돌|상자|면/, 'blocks'], [/글자|활자|글씨|책|낱말/, 'glyph']];
export function conceptMotif(text) { for (const [re, f] of MOTIF_WORDS) if (re.test(String(text || ''))) return f; return ''; }
/** 이 사이트의 모티프 가족: 컨셉의 motif 글 → 프리셋의 가족 */
export const motifFamily = (bp, presetId) => conceptMotif(bp?.concept?.motif) || presetMotif(presetId);

// 프리셋 → [모티프 가족, 본문 계획]. 계획은 scripts/plan-body.mjs가 짬(분위기에 맞는 변형 중에서, 어느 두 프리셋도 절반 넘게 같지 않게,
// 프리셋마다 그래픽 주인공 본문 2개 이상·글만 있는 섹션 절반 이하·왼쪽 정렬이 아닌 섹션 2개 이상). test/body-layouts.test.mjs가 지킴
export const PRESET_BODY = {
  'night-story': ['stars', 'message:stage goals:journey@c steps5:flow outline:zigzag schedule:table deck:stage tools:rows poll:stage board:mosaic qa:wall faq:accordion materials:shelf instructor:portrait survey:sheet closing:poster@c readiness:tiles glossary:cards quiz:list reflection:notes glance:figures procedure:flow table:rowcards cases:notes discuss:list sessions:map speakers:people'],
  'paper-workbook': ['grid', 'message:stage goals:journey@c steps5:wheel outline:filmstrip schedule:timeline deck:stage tools:tiles poll:split board:feed qa:wall faq:index materials:files instructor:profile survey:form closing:poster@c readiness:checklist glossary:web quiz:cards reflection:letter glance:tally procedure:rail table:table cases:rows discuss:bigq sessions:grid speakers:people'],
  'glass-lab': ['dots', 'message:band@c goals:journey@c steps5:flow outline:filmstrip schedule:blocks deck:rail tools:tiles poll:split board:mosaic qa:thread faq:index materials:files instructor:portrait survey:cards closing:finale@c readiness:steps glossary:dict quiz:cards reflection:notes glance:figures procedure:flow table:compare cases:rows discuss:bigq sessions:map speakers:lineup'],
  'playground': ['tiles', 'message:stage goals:columns@c steps5:flow outline:bento schedule:clock deck:stage tools:bento poll:stage board:wall qa:thread faq:accordion materials:files instructor:portrait survey:cards closing:poster@c readiness:tiles glossary:index quiz:list reflection:notes glance:spec procedure:flow table:compare cases:quote discuss:bigq sessions:grid speakers:lineup'],
  'calm-forest': ['waves', 'message:stage goals:journey@c steps5:steps outline:zigzag schedule:track deck:viewer tools:bento poll:stage board:feed qa:wall faq:twocol materials:files instructor:portrait survey:sheet closing:card readiness:checklist glossary:web quiz:list reflection:notes glance:figures procedure:rail table:compare cases:quote discuss:bigq sessions:grid speakers:people'],
  'official-brief': ['blocks', 'message:stage goals:bento@c steps5:flow outline:zigzag schedule:blocks deck:viewer tools:rows poll:panel board:feed qa:thread faq:index materials:files instructor:card survey:cards closing:poster@c readiness:tiles glossary:web quiz:list reflection:journal glance:figures procedure:flow table:compare cases:notes discuss:list sessions:grid speakers:lineup'],
  'editorial-ink': ['glyph', 'message:stage goals:journey@c steps5:wheel outline:filmstrip schedule:clock deck:stage tools:bento poll:split board:mosaic qa:thread faq:accordion materials:pile instructor:portrait survey:form closing:card readiness:steps glossary:web quiz:list reflection:letter glance:figures procedure:flow table:table cases:notes discuss:list sessions:map speakers:lineup'],
  'retro-pop': ['rings', 'message:band@c goals:manifesto steps5:wheel outline:zigzag schedule:blocks deck:stage tools:tiles poll:stage board:mosaic qa:split faq:twocol materials:files instructor:portrait survey:cards closing:poster@c readiness:tiles glossary:web quiz:cards reflection:letter glance:tally procedure:cards table:rowcards cases:notes discuss:bigq sessions:grid speakers:lineup'],
  'chalkboard': ['waves', 'message:stage goals:journey@c steps5:wheel outline:zigzag schedule:clock deck:rail tools:tiles poll:panel board:wall qa:wall faq:twocol materials:files instructor:card survey:sheet closing:poster@c readiness:tiles glossary:dict quiz:cards reflection:journal glance:spec procedure:flow table:rowcards cases:quote discuss:bubbles sessions:map speakers:people'],
  'blueprint-tech': ['grid', 'message:band@c goals:journey@c steps5:flow outline:filmstrip schedule:clock deck:stage tools:bento poll:panel board:feed qa:split faq:index materials:shelf instructor:portrait survey:sheet closing:poster@c readiness:steps glossary:cards quiz:big reflection:letter glance:spec procedure:flow table:table cases:rows discuss:list sessions:grid speakers:lineup'],
  'riso-zine': ['dots', 'message:stage goals:columns@c steps5:wheel outline:zigzag schedule:blocks deck:stage tools:rows poll:split board:wall qa:wall faq:twocol materials:pile instructor:portrait survey:form closing:poster@c readiness:tiles glossary:dict quiz:cards reflection:notes glance:tally procedure:flow table:compare cases:notes discuss:bigq sessions:map speakers:people'],
  'sunrise-warm': ['arcs', 'message:stage goals:ledger steps5:wheel outline:filmstrip schedule:blocks deck:rail tools:bento poll:panel board:wall qa:thread faq:index materials:files instructor:portrait survey:form closing:poster readiness:checklist glossary:cards quiz:big reflection:letter glance:tally procedure:flow table:table cases:quote discuss:bubbles sessions:map speakers:lineup'],
  'keynote-dark': ['stars', 'message:band goals:journey steps5:flow outline:filmstrip schedule:track deck:rail tools:rows poll:stage board:wall qa:wall faq:index materials:pile instructor:card survey:cards closing:poster readiness:steps glossary:web quiz:list reflection:letter glance:spec procedure:flow table:rowcards cases:notes discuss:bigq sessions:map speakers:lineup'],
  'corporate-clean': ['blocks', 'message:stage goals:journey@c steps5:flow outline:zigzag schedule:blocks deck:viewer tools:tiles poll:panel board:feed qa:split faq:accordion materials:pile instructor:profile survey:form closing:card readiness:checklist glossary:web quiz:cards reflection:journal glance:spec procedure:flow table:compare cases:rows discuss:bigq sessions:grid speakers:people'],
  'soft-pastel': ['tiles', 'message:stage goals:journey steps5:flow outline:zigzag schedule:blocks deck:stage tools:bento poll:stage board:wall qa:thread faq:twocol materials:shelf instructor:card survey:form closing:finale readiness:tiles glossary:web quiz:big reflection:notes glance:tally procedure:flow table:table cases:quote discuss:list sessions:grid speakers:people'],
  'kinetic-type': ['glyph', 'message:stage goals:manifesto steps5:flow outline:filmstrip schedule:clock deck:rail tools:tiles poll:stage board:mosaic qa:thread faq:twocol materials:shelf instructor:profile survey:form closing:poster@c readiness:steps glossary:cards quiz:big reflection:notes glance:tally procedure:flow table:compare cases:quote discuss:bigq sessions:map speakers:people'],
  'warm-minimal': ['waves', 'message:stage goals:ledger@c steps5:flow outline:zigzag schedule:clock deck:rail tools:rows poll:stage board:feed qa:split faq:accordion materials:files instructor:portrait survey:form closing:finale@c readiness:checklist glossary:web quiz:list reflection:letter glance:spec procedure:rail table:table cases:rows discuss:bigq sessions:map speakers:people'],
  'deck-collage': ['blocks', 'message:stage goals:bento@c steps5:wheel outline:zigzag schedule:blocks deck:rail tools:rows poll:panel board:mosaic qa:split faq:index materials:shelf instructor:portrait survey:sheet closing:card readiness:tiles glossary:web quiz:big reflection:notes glance:figures procedure:cards table:table cases:quote discuss:bigq sessions:map speakers:people'],
  'time-dial': ['arcs', 'message:stage goals:journey@c steps5:tabs outline:bento schedule:track deck:rail tools:bento poll:stage board:mosaic qa:thread faq:index materials:shelf instructor:portrait survey:sheet closing:finale@c readiness:checklist glossary:web quiz:cards reflection:journal glance:tally procedure:flow table:compare cases:notes discuss:bigq sessions:map speakers:lineup'],
  'knot-orbit': ['rings', 'message:stage goals:bento@c steps5:tabs outline:filmstrip schedule:track deck:viewer tools:tiles poll:split board:feed qa:split faq:accordion materials:files instructor:portrait survey:sheet closing:poster@c readiness:steps glossary:index quiz:cards reflection:journal glance:figures procedure:flow table:table cases:notes discuss:bigq sessions:map speakers:people'],
  'stone-stream': ['waves', 'message:stage goals:journey@c steps5:wheel outline:filmstrip schedule:track deck:rail tools:bento poll:panel board:feed qa:thread faq:twocol materials:shelf instructor:card survey:cards closing:card readiness:checklist glossary:index quiz:list reflection:letter glance:figures procedure:flow table:rowcards cases:rows discuss:bigq sessions:map speakers:people'],
  'ripple-center': ['rings', 'message:stage goals:manifesto steps5:wheel outline:toc schedule:clock deck:viewer tools:tiles poll:stage board:feed qa:wall faq:index materials:pile instructor:portrait survey:sheet closing:poster readiness:tiles glossary:web quiz:big reflection:letter glance:figures procedure:flow table:rowcards cases:quote discuss:bigq sessions:grid speakers:people'],
  'minute-map': ['dots', 'message:stage goals:ledger@c steps5:flow outline:filmstrip schedule:track deck:stage tools:tiles poll:panel board:wall qa:split faq:twocol materials:files instructor:portrait survey:cards closing:card readiness:steps glossary:web quiz:cards reflection:notes glance:spec procedure:flow table:rowcards cases:rows discuss:bubbles sessions:grid speakers:lineup'],
  'mosaic-split': ['tiles', 'message:stage goals:bento@c steps5:flow outline:zigzag schedule:track deck:rail tools:bento poll:split board:feed qa:wall faq:index materials:shelf instructor:portrait survey:form closing:poster@c readiness:tiles glossary:dict quiz:big reflection:journal glance:tally procedure:rail table:rowcards cases:rows discuss:bigq sessions:grid speakers:people'],
  'cover-sheet': ['glyph', 'message:band@c goals:columns@c steps5:wheel outline:zigzag schedule:track deck:viewer tools:bento poll:split board:mosaic qa:thread faq:index materials:files instructor:portrait survey:sheet closing:poster@c readiness:checklist glossary:web quiz:big reflection:letter glance:figures procedure:flow table:rowcards cases:rows discuss:list sessions:map speakers:people'],
  'vertical-type': ['glyph', 'message:stage goals:journey steps5:wheel outline:filmstrip schedule:blocks deck:viewer tools:rows poll:stage board:wall qa:split faq:twocol materials:shelf instructor:profile survey:cards closing:poster readiness:checklist glossary:dict quiz:big reflection:letter glance:spec procedure:rail table:rowcards cases:quote discuss:bigq sessions:grid speakers:lineup'],
  'swiss-offset': ['blocks', 'message:band@c goals:ledger@r steps5:wheel outline:zigzag schedule:clock deck:viewer tools:rows poll:panel board:mosaic qa:wall faq:accordion materials:shelf instructor:profile survey:form closing:poster@c readiness:checklist glossary:web quiz:list reflection:journal glance:figures procedure:flow table:compare cases:rows discuss:bigq sessions:grid speakers:lineup'],
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

const toMin = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; };
const n = (s, k = 'items') => (Array.isArray(s?.[k]) ? s[k].length : 0);
/** 하루 안 일정이고 순서마다 길이를 알 때만 시간 도식(트랙·시계판·블록): 모르는 길이를 지어내지 않음 */
function knownDay(s) {
  const it = s.items || [];
  return it.length >= 2 && it.length <= 12 && !it.some((i) => i.date) && it.every((i, k) => { const a = toMin(i.start), b = toMin(i.end) ?? toMin(it[k + 1]?.start); return a !== null && b !== null && b > a && b - a <= 600; });
}
/** 내용이 그 배치에 맞는지(맞지 않으면 섹션 종류의 기본 배치로): 개수·값이 배치의 그림을 정직하게 채울 수 있을 때만 */
const FITS = {
  'goals.journey': (s) => n(s) >= 2 && n(s) <= 6, 'goals.columns': (s) => n(s) >= 2, 'goals.manifesto': (s) => n(s) <= 5,
  'steps5.wheel': (s) => n(s) >= 3 && n(s) <= 8, 'steps5.flow': (s) => n(s) >= 2 && n(s) <= 6, 'steps5.tabs': (s) => n(s) >= 2,
  'outline.filmstrip': (s) => n(s) >= 2, 'outline.zigzag': (s) => n(s) <= 6,
  'schedule.track': knownDay, 'schedule.clock': (s) => knownDay(s) && n(s) <= 8, 'schedule.blocks': knownDay,
  'sessions.map': (s) => n(s) >= 2 && n(s) <= 10, 'faq.index': (s) => n(s) >= 2, 'faq.twocol': (s) => n(s) <= 10,
  'glossary.web': (s) => n(s) >= 3 && n(s) <= 8, 'procedure.flow': (s) => n(s) >= 2 && n(s) <= 8, 'discuss.bigq': (s) => n(s) <= 6,
  'table.compare': (s) => n(s, 'head') >= 3 && n(s, 'head') <= 5 && n(s, 'rows') <= 10, 'table.rowcards': (s) => n(s, 'head') >= 2 && n(s, 'head') <= 6,
  'materials.shelf': (s) => n(s) >= 1 && n(s) <= 10, 'deck.rail': (s) => n(s, 'slides') >= 3, 'cases.notes': (s) => n(s) <= 8,
};
/**
 * 교재 구성의 흐름(설계도 structure.flow, decide/structure.js)이 주인공으로 삼는 칸: 프리셋 계획이 그 칸에 기본(글) 배치를 골랐을 때만
 * 그림·도식 배치로 바꿈(이미 다른 배치를 고른 프리셋은 그대로 — 프리셋끼리의 차이를 지킴)
 */
const FLOW_LEAD = {
  procedure: { procedure: 'flow', steps5: 'flow' }, discussion: { discuss: 'bigq', cases: 'quote' }, course: { sessions: 'map' },
  event: { schedule: 'track', glance: 'tally' }, talk: { message: 'stage', speakers: 'lineup' },
};
const fitsV = (t, v, s) => !FITS[`${t}.${v}`] || FITS[`${t}.${v}`](s);
/**
 * 이 섹션의 배치: 설계도에 적은 layout → (흐름의 주인공 칸) → 프리셋의 본문 계획 → 섹션 종류의 기본. 내용이 배치에 맞지 않으면 기본으로.
 * 같은 종류의 칸이 앞에 또 있으면(한눈에 보기 둘 등) 앞 칸과 다른 배치를 계획 순서대로 골라 같은 모양이 되풀이되지 않게 함.
 * @param site 사이트의 섹션 목록 또는 { sections, flow } — 없으면 이 섹션만 보고 정함
 * @returns {{ type, variant, stance, meta, own, isDefault }} own = 설계도에서 직접 고름
 */
export function variantOf(s, presetId, site) {
  const t = variantType(s.type), all = BODY_VARIANTS[t];
  if (!all) return { type: t, variant: '', stance: '', meta: null, own: false, isDefault: true };
  const list = Array.isArray(site) ? site : site?.sections || null, flow = Array.isArray(site) ? '' : site?.flow || '';
  const own = typeof s.layout === 'string' && s.type !== 'stations' ? s.layout.split('@') : [];
  const plan = presetBody(presetId)[t], def = defaultVariant(t);
  let variant;
  if (all[own[0]]) variant = fitsV(t, own[0], s) ? own[0] : def;
  else {
    let base = plan?.variant || def;
    const lead = FLOW_LEAD[flow]?.[t];
    if (lead && base === def && fitsV(t, lead, s)) base = lead;
    const prev = list ? list.slice(0, Math.max(0, list.indexOf(s))).filter((x) => variantType(x.type) === t) : [];
    if (!prev.length) variant = fitsV(t, base, s) ? base : def;
    else {
      const used = new Set(prev.map((x) => variantOf(x, presetId, site).variant)), ids = variantIds(t), k = ids.indexOf(base);
      const order = ids.slice(k).concat(ids.slice(0, k));
      variant = order.find((v) => fitsV(t, v, s) && !used.has(v)) || (fitsV(t, base, s) ? base : def);
    }
  }
  const meta = all[variant];
  const stance = all[own[0]] ? (STANCES[own[1]] || (own[1] === 'l' ? '' : STANCES[meta.stance] || '')) : (variant === plan?.variant ? plan?.stance : '') || STANCES[meta.stance] || '';
  return { type: t, variant, stance, meta, own: !!all[own[0]], isDefault: variant === def };
}
/** 설계도 검증용: 섹션 종류에 맞는 layout 값이면 그대로('변형' 또는 '변형@c|r|l'), 아니면 '' */
export function cleanLayout(type, v) {
  if (typeof v !== 'string' || type === 'stations') return '';
  const [id, st = ''] = v.trim().split('@');
  return BODY_VARIANTS[variantType(type)]?.[id] ? id + (/^[crl]$/.test(st) ? '@' + st : '') : '';
}
/** 이 사이트에 쓰인 배치 이름들('종류.변형'): 런타임 CSS(runtime/body.css)에서 쓰는 묶음만 남길 때 */
export function usedVariants(sections, presetId, flow = '') {
  const out = new Set(), site = { sections, flow };
  for (const s of sections) { const v = variantOf(s, presetId, site); if (v.variant) out.add(`${v.type}.${v.variant}`); }
  return [...out];
}
/** 제 그림이 움직이는 배치(runtime/body.css): 스크롤 연동 단계에서는 스크롤에 맞춰, 차분 단계에서는 들어올 때 한 번. 연출 검사가 효과처럼 셈 */
export const MOTION_VARIANTS = ['goals.manifesto', 'goals.journey', 'glance.tally', 'message.stage', 'steps5.wheel', 'steps5.flow', 'outline.zigzag', 'outline.filmstrip', 'schedule.track', 'schedule.clock', 'materials.shelf', 'sessions.map', 'glossary.web', 'procedure.flow', 'discuss.bigq', 'closing.poster'];
/** 정적 지문(테스트·문서): 섹션마다 '종류:변형'(자세는 뺌 — 정렬만 다른 것은 같은 구조로 셈) */
export function bodyFingerprint(sections, presetId, flow = '') {
  const site = { sections, flow };
  return sections.filter((s) => s.type !== 'hero').map((s) => { const v = variantOf(s, presetId, site); return `${s.type}:${v.variant || '-'}`; });
}
