// references/design.md를 프리셋·효과 카탈로그에서 다시 만듭니다: node scripts/gen-design-doc.mjs
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const E = await import(pathToFileURL(join(HERE, '..', 'engine', 'src', 'index.js')).href);
const LV = ['정적', '차분', '보통', '스크롤 연출'];
const SLOT = { 'hero.title': '첫 화면 제목', 'hero.graphic': '첫 화면 그래픽', 'hero.cta': '시작 버튼', 'section.title': '섹션 제목', 'section.enter': '섹션 등장', divider: '구분 띠', cards: '카드', list: '목록', numbers: '숫자', message: '핵심 문장', schedule: '일정', gallery: '사진', 'closing.title': '마무리 문장', 'closing.graphic': '마무리 그래픽', cursor: '커서', scroll: '스크롤', progress: '진행 표시', celebrate: '축하' };
const ENTER = { rise: '떠오름', fade: '번짐', side: '옆에서', wipe: '왼쪽부터 펼침', clip: '위에서 펼침', scale: '살짝 커짐', drop: '내려앉음', flip: '넘어옴' };
const planLine = (p) => { const pl = E.presetPlan(p); return `${[...new Set(Object.values(pl.enter))].map((m) => ENTER[m]).join('·')}${Object.keys(pl.slots).length ? ` + ${[...new Set(Object.values(pl.slots).map((l) => l[0]))].join(', ')}` : ''}`; };
const fonts = (p) => [p.fonts.display, p.fonts.body, p.fonts.num].map((k) => E.FONTS[k]?.label).filter(Boolean).join(' / ');
let md = `# 디자인: 프리셋·효과·연출·글꼴

> 이 파일은 \`scripts/gen-design-doc.mjs\`가 엔진 카탈로그에서 자동으로 만듭니다. 직접 고치지 말고 카탈로그를 고친 뒤 다시 만드세요.

## 1. 정하는 순서
0. **컨셉**: 디자인보다 먼저. 이 연수가 참가자에게 주는 경험 한 줄(\`concept.idea\`)과 화면에 되풀이할 그림(\`concept.motif\`)을 세운다. 프리셋은 그 모티프와 가장 가까운 것을 고른다(\`references/concept.md\`).
1. **프리셋**: 분위기(mood)·주제(topic)·유형으로 점수를 매겨 3안을 제안한다(\`lecpage.mjs design\`). 강사가 고른다.
2. **토큰**: 프리셋의 색·글꼴·모양. 기관 색이 있으면 \`design.accent\`(대비 자동 보정).
3. **페이지 연출(모션 단계)**: 0 정적 · 1 차분 · 2 보통 · 3 스크롤 연출(시차·덮기·쌓임·고정 장면. 넓은 화면에서만 움직이고, 저사양·휴대폰·동작 줄이기에서는 완성된 정지 모습). 크롬북이 있으면 2까지, 휴대폰뿐이면 기본 2(강사가 3을 고르면 허용), 공식 연수는 1. 실습형은 첫 화면만. 학교망 제한(\`audience.network: restricted\`)이면 외부 라이브러리 효과를 쓰지 않는다.
4. **슬롯별 효과**: 프리셋 기본값에서 출발해 상한·환경에 맞게 바꾸고, 제목·카드 효과는 연수마다 조금씩 변주한다(\`design.seed\`를 바꾸면 다른 조합). 직접 정하려면 \`design.effects\`에 \`{"슬롯":"효과id"}\`.
5. **대표 효과**: 사이트 전체에서 두드러지는 효과는 하나(\`design.signature\`).
5-1. **페이지 연출 계획**: 프리셋마다 첫 화면 밖 전 구간의 연출이 정해져 있다(아래 표의 '본문 연출'). 섹션이 들어오는 방식은 섹션 종류마다 다르고(모두 같은 떠오르기를 쓰지 않음), 일정 선·카드·사진·목록·섹션 제목 칸은 본문 단계가 허락하는 만큼 채운다. 0단계 정적 · 1단계 등장과 가리킴 반응 · 2단계 스크롤 연동 · 3단계 장면 연출. 칸을 비우려면 \`design.effects\`에 \`{"칸":""}\`.
6. **글꼴 네 벌**: 한글 제목(\`display\`) · 한글 본문(\`body\`) · 숫자·영문용 라틴 제목(\`num\`: 큰 번호·날짜·통계·시각) · 고정폭(\`mono\`). 기본은 교재 글꼴을 따르고, 없으면 프리셋 글꼴. 직접 정하려면 \`design.fonts\`.

## 2. 지킬 것
- 실습·질문·교재 화면은 모션 1단계를 넘지 않는다(머리만 조용히 등장). 화려함은 첫 화면·마무리에, 본문은 섹션마다 한 번 등장하고 멈춘다. 한 화면에 큰 움직임은 하나.
- 같은 요소를 두 효과가 움직이지 않는다(등장 + 시차 + 붙박이 겹침 금지). \`scripts/overlap-lint.mjs\`가 스크롤 자리마다 겹침·잘림·덮임·숨은 채 남은 내용·효과 꼬임을 검사한다(\`qa\`에 포함).
- 쉬는 상태가 완성 상태: 효과가 실패해도 글은 보인다. 동작 줄이기·'움직임 멈춤'을 늘 존중.
- 피할 기본값: 보라→파랑 그라데이션 첫 화면, 똑같은 카드 3장, 흔한 AI 이미지, 섹션마다 다른 화려한 효과, 스크롤 납치, 같은 배치의 섹션을 세 번 넘게 잇기(디자인 검사 \`layout-repeat\`).
- 한글: word-break: keep-all, 본문 행간 1.6~1.8, 제목 text-wrap: balance. 글꼴은 아래 목록(상업 이용 가능)만.

## 3. 무드 프리셋 ${E.PRESETS.length}종
| id | 이름 | 어울리는 연수 | 분위기 | 글꼴(제목/본문/숫자) | 연출 | 첫 화면 | 글 배치 | 본문 연출(등장 + 칸별 효과) | 대표 효과 |
|---|---|---|---|---|---|---|---|---|---|
${E.PRESETS.map((p) => `| \`${p.id}\` | ${p.name_ko} | ${p.desc_ko} | ${p.moods.join(', ')} | ${fonts(p)} | ${LV[p.motion]} | ${p.variants?.hero || '-'} | ${E.LAYOUT_KO[p.layout] || '왼쪽 정렬'}${p.variants?.align && p.variants.align !== (p.layout || 'left') && p.variants.align !== 'left' ? `(본문 ${p.variants.align})` : ''} | ${planLine(p)} | ${p.signature || (p.showcase ? `${p.graphic || '제목에서 나온 그림'}(첫 화면 그림)` : '-')} |`).join('\n')}

살아 있는 첫 화면(쇼케이스) ${E.PRESETS.filter((p) => p.showcase).length}종(${E.PRESETS.filter((p) => p.showcase).map((p) => `\`${p.id}\``).join(' · ')}): 첫 화면에 그림이 들어 있다. 그림은 서버가 정지 모습(HTML·SVG)으로 먼저 그리고, 프리셋의 \`graphic\` 효과가 움직임과 반응을 더한다. 모션 1단계 이하·동작 줄이기·저사양에서는 정지 그림 그대로다. 이 그림 효과는 다른 프리셋의 첫 화면 그래픽(\`design.graphic\`)으로도 고를 수 있다.

글 배치 문법(\`layout\`, 본문은 \`variants.align\`): 왼쪽 정렬이 기본이고, 가운데(${E.PRESETS.filter((p) => p.variants.align === 'center').map((p) => p.name_ko).join('·')}) · 오른쪽·세로쓰기(${E.PRESETS.filter((p) => p.variants.align === 'right').map((p) => p.name_ko).join('·')}) · 어긋난 격자(${E.PRESETS.filter((p) => p.variants.align === 'offset').map((p) => p.name_ko).join('·')}) · 반반 화면(${E.PRESETS.filter((p) => p.variants.align === 'split').map((p) => p.name_ko).join('·')}) · 장부 격자(${E.PRESETS.filter((p) => p.variants.align === 'ledger').map((p) => p.name_ko).join('·')}) · 그림 가득(${E.PRESETS.filter((p) => p.layout === 'cover').map((p) => p.name_ko).join('·')})이 있다. 본문의 섹션 머리·구분선·번호·그림 다루기까지 같은 문법을 따른다. 좁은 화면에서는 모두 한 단이 된다.

## 3-1. 본문 배치 변형 ${Object.values(E.BODY_VARIANTS).reduce((n, v) => n + Object.keys(v).length, 0)}가지(섹션 \`layout\`)
섹션 종류마다 **구조가 다른** 배치(정렬만 다른 것은 세지 않음). 고르는 순서: 섹션에 적은 \`layout\`("변형" 또는 "변형@c·@r·@l" — 그 칸만 가운데·오른쪽·왼쪽) → 교재 구성 흐름(\`structure.flow\`)이 주인공으로 삼는 칸(절차 흐름도·큰 물음표·진행 지도·가로 트랙·무대, 프리셋이 기본 배치를 골랐을 때만) → 프리셋의 본문 계획 → 종류의 기본(첫째).
내용이 배치에 맞지 않으면 기본으로(길이를 모르거나 여러 날인 일정은 시간 도식을 쓰지 않음, 낱말이 셋 미만이면 그물 없음 등). 같은 종류 칸이 둘이면 두 번째는 다른 배치.
주인공: 글 · 숫자(실제 값) · **그림**(이 연수의 모티프 그림·교재 쪽 그림) · **도식**(교재의 값으로 그린 그림) · 조작(따라 하는 칸, 모양만 바뀜). 그림은 모두 서버가 그린 SVG·CSS이고 꾸밈(화면 낭독기에서 빠짐).
프리셋 계획은 \`scripts/plan-body.mjs\`가 짠다: 분위기에 맞는 변형 중에서, 어느 두 프리셋도 같은 설계도에서 본문 배치가 절반 넘게 같지 않게, 프리셋마다 그래픽 주인공 2개 이상·글만 있는 섹션 절반 이하·왼쪽 정렬이 아닌 섹션 2개 이상, 한 배치를 27개 프리셋 중 10개 넘게 쓰지 않게(배치가 셋 넘는 종류, \`test/body-layouts.test.mjs\`).
수치 도표(\`table:chart\`·\`glance:bars\`)는 교재 값이 '숫자 + 같은 단위'일 때만 그린다(\`design/numbers.js\`, 글 칸이 섞인 표·단위가 다른 값·연도는 도표로 바꾸지 않음). 숫자 표는 프리셋이 표를 골랐어도 도표로 그리고 원래 표는 '표로 보기'(인쇄할 때 펼침)에 둔다.

| 섹션 | 변형(첫째가 기본) — 주인공 · 고르는 기준 |
|---|---|
${Object.entries(E.BODY_VARIANTS).map(([t, vs]) => `| \`${t}\`${t === 'materials' ? '·`followup`' : ''} | ${Object.entries(vs).map(([id, v]) => `\`${id}\` ${v.ko}(${{ text: '글', number: '숫자', figure: '그림', diagram: '도식', tool: '조작' }[v.lead]}) — ${v.use}`).join('<br>')} |`).join('\n')}

움직임: 차분 단계(1)는 섹션이 들어올 때 한 번(배치마다 어울리는 방식, 그림은 길·축·고리가 제자리로), 보통·스크롤 연출(2·3)은 스크롤에 맞춰 그려짐(여정의 길·트랙 채움·시계판·고리 회전·선언문 문장·필름 띠 가운데 장면·마무리 그림 미끄러짐). 반응: 도식과 목록 잇기(가리키거나 초점이 오면 같은 번호가 켜짐)·낱말 넘김·필름 띠·질문 색인·카드 들림. 동작 줄이기·가벼운 모드·JS가 없으면 완성된 정지 모습이고 아무것도 숨지 않는다.
모티프(\`concept.motif\` → 그림 가족: 고리·점·도형 타일·물결·호·색면·별·큰 글자·모눈): 바탕이 같은 두 섹션 사이의 구분 장식, 옅은 바탕 칸 구석의 그림, 무대·좌우 번갈아·큰 얼굴·마무리 그림으로 되풀이한다.

## 3-2. 말로 고치기(디자인 낱말)
강사가 디자인을 느낌으로 말하면("좀 답답해 보여요") 아래 표로 고칠 곳 2~3가지를 골라 **지금과 바꾼 모습**을 보여 주고(\`options\`·스크린숏), 고른 것만 \`patch\`로 적용한다. 지금 설정과 같은 안은 내지 않는다. 앱의 [디자인] 탭·디자인 둘러보기가 같은 규칙을 쓴다(\`app/src/design-words/symptoms.js\`).

| 이런 말 | 고칠 곳(위에서부터) |
|---|---|
| 답답해요·빽빽해요 | 여백이 넓은 프리셋(\`calm-forest\`·\`warm-minimal\`·\`editorial-ink\`·\`ripple-center\`·\`vertical-type\`·\`sunrise-warm\`·\`corporate-clean\`) · 어두우면 \`theme=light\` · 움직임 2 이상이면 1 · 칸이 많은 배치(벤토·타일·쪽지)를 줄 목록으로 |
| 글씨가 잘 안 읽혀요 | 어두우면 \`theme=light\` · 본문이 명조면 고딕 글꼴 짝(\`pretendard-solo\` 등) · 장식이 적은 프리셋(\`official-brief\`·\`corporate-clean\`) · 움직임 1 |
| 심심해요·밋밋해요 | 글만 있는 칸을 도식·그림 배치로(일정 \`track\`·\`clock\`, 목표 \`journey\`, 단계 \`wheel\` 등 내용에 맞는 것) · 그림 첫 화면 프리셋(showcase) · 움직임 한 단계 위 |
| 움직임이 정신없어요 | 움직임 1 → 0 · 첫 화면 그래픽 빼기(\`design.graphic=''\`) |
| 학교 느낌 | \`chalkboard\`·\`paper-workbook\`·\`playground\`·\`soft-pastel\` |
| 공식적으로 | \`official-brief\`·\`swiss-offset\`·\`corporate-clean\` · 움직임 1 |
| 흔한 사이트 같아요 | 왼쪽 정렬이 아닌 프리셋(가운데·세로쓰기·반반·그림 가득·어긋난 격자·자료 그림) · 도식 배치 두 곳 |
| 일정이 한눈에 안 들어와요(섹션 이름을 말함) | 그 섹션에 맞는 다른 배치(\`variantOf\`로 맞는지 확인한 것만) |
| 따뜻하게·세련되게·깔끔하게·발랄하게 | 그 분위기 낱말로 다시 매긴 프리셋 순위 위의 둘·셋 |
| 너무 어두워요 / 눈부셔요 | \`theme=light\` / \`theme=dark\` |
| 색이 촌스러워요(색 이름을 말함) | 말한 색을 \`design.accent\`로 · 분위기가 맞는 색 조합(\`design.palette\`) |
| 휴대폰에서 길어요 | 가로로 넘기거나 접는 배치(\`outline:filmstrip\`·\`steps5:tabs\`·\`faq:accordion\`) |

디자인 둘러보기에서 낱말을 담으면 이런 요청 문장이 나온다. 괄호 속 이름이 설계도 값이다.
\`\`\`
디자인은 '숲의 숨'(calm-forest)으로 해 주세요.          → design.preset
첫 화면은 '가운데 정렬'(center)로 놓아 주세요.          → 그 글 배치(layout)를 쓰는 프리셋 가운데 주제·분위기에 가장 맞는 것
색 조합은 '숲길'(forest-walk)로 해 주세요.              → design.palette   · 화면은 어둡게 → design.theme=dark
글꼴은 '잡지 명조'(serif-editorial) 짝으로 해 주세요.   → design.fontPair
움직임은 '차분하게'(1단계)로 해 주세요.                 → design.motion=1
효과는 '형광펜 긋기'(highlight-sweep)를 써 주세요.      → 2단계 이상이면 design.signature, 첫 화면 바탕이면 design.graphic, 아니면 design.effects[칸]
본문은 일정표를 '가로 트랙(시간 축)'(schedule:track) 배치로 그려 주세요. → 그 종류 섹션의 layout(내용이 맞을 때만)
\`\`\`

## 4. 효과 ${E.FX.length}가지
| id | 이름 | 강도 | 슬롯 | 설명 |
|---|---|---|---|---|
${E.FX.map((f) => `| \`${f.id}\` | ${f.name_ko} (${f.name_en}) | ${f.level} | ${(f.slots || []).map((s) => SLOT[s] || s).join(', ')} | ${(f.desc_ko || '').replace(/\|/g, '/')}${f.libs?.length ? ' · 외부 라이브러리' : ''} |`).join('\n')}

## 5. 색 조합 ${E.PALETTE_SEEDS.length}가지(\`design.palette\`)
프리셋의 모양·효과는 그대로 두고 색만 바꾼다. 모두 라이트·다크에서 글자 대비 4.5:1 이상.
| id | 이름 | 분위기 | 주제 |
|---|---|---|---|
${E.PALETTE_SEEDS.map((s) => `| \`${s.id}\` | ${s.name_ko} | ${(s.moods || []).join(', ')} | ${(s.topics || []).join(', ')} |`).join('\n')}

## 6. 글꼴 짝 ${E.FONT_PAIRS.length}가지(\`design.fontPair\`)
| id | 이름 | 제목 | 본문 | 분위기 |
|---|---|---|---|---|
${E.FONT_PAIRS.map((f) => `| \`${f.id}\` | ${f.name_ko} | ${f.display.family} | ${f.body.family} | ${(f.moods || []).join(', ')} |`).join('\n')}

## 7. 글꼴
| 키 | 글꼴 | 종류 | 라이선스 |
|---|---|---|---|
${Object.entries(E.FONTS).map(([k, f]) => `| \`${k}\` | ${f.label} | ${f.kind} | ${f.license} |`).join('\n')}

글꼴을 바꾸려면 \`design.fonts\`에 \`{"display":"키","body":"키"}\`. 학교망에서 CDN이 막히면 글꼴 파일을 \`assets/fonts/\`에 내려받아 쓰도록 안내한다.
`;
writeFileSync(join(HERE, '..', 'references', 'design.md'), md);
console.log('references/design.md', md.length);
