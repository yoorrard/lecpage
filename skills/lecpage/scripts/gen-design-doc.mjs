// references/design.md를 프리셋·효과 카탈로그에서 다시 만듭니다: node scripts/gen-design-doc.mjs
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const E = await import(pathToFileURL(join(HERE, '..', 'engine', 'src', 'index.js')).href);
const LV = ['정적', '차분', '보통', '스크롤 연출'];
const SLOT = { 'hero.title': '첫 화면 제목', 'hero.graphic': '첫 화면 그래픽', 'hero.cta': '시작 버튼', 'section.title': '섹션 제목', 'section.enter': '섹션 등장', divider: '구분 띠', cards: '카드', list: '목록', numbers: '숫자', message: '핵심 문장', schedule: '일정', gallery: '사진', 'closing.title': '마무리 문장', 'closing.graphic': '마무리 그래픽', cursor: '커서', scroll: '스크롤', progress: '진행 표시', celebrate: '축하' };
const fonts = (p) => [p.fonts.display, p.fonts.body, p.fonts.num].map((k) => E.FONTS[k]?.label).filter(Boolean).join(' / ');
let md = `# 디자인: 프리셋·효과·연출·글꼴

> 이 파일은 \`scripts/gen-design-doc.mjs\`가 엔진 카탈로그에서 자동으로 만듭니다. 직접 고치지 말고 카탈로그를 고친 뒤 다시 만드세요.

## 1. 정하는 순서
1. **프리셋**: 분위기(mood)·주제(topic)·유형으로 점수를 매겨 3안을 제안한다(\`lecpage.mjs design\`). 강사가 고른다.
2. **토큰**: 프리셋의 색·글꼴·모양. 기관 색이 있으면 \`design.accent\`(대비 자동 보정).
3. **페이지 연출(모션 단계)**: 0 정적 · 1 차분 · 2 보통 · 3 스크롤 연출(시차·덮기·쌓임·고정 장면. 넓은 화면에서만 움직이고, 저사양·휴대폰·동작 줄이기에서는 완성된 정지 모습). 크롬북이 있으면 2까지, 휴대폰뿐이면 기본 2(강사가 3을 고르면 허용), 공식 연수는 1. 실습형은 첫 화면만. 학교망 제한(\`audience.network: restricted\`)이면 외부 라이브러리 효과를 쓰지 않는다.
4. **슬롯별 효과**: 프리셋 기본값에서 출발해 상한·환경에 맞게 바꾸고, 제목·카드 효과는 연수마다 조금씩 변주한다(\`design.seed\`를 바꾸면 다른 조합). 직접 정하려면 \`design.effects\`에 \`{"슬롯":"효과id"}\`.
5. **대표 효과**: 사이트 전체에서 두드러지는 효과는 하나(\`design.signature\`).
6. **글꼴 네 벌**: 한글 제목(\`display\`) · 한글 본문(\`body\`) · 숫자·영문용 라틴 제목(\`num\`: 큰 번호·날짜·통계·시각) · 고정폭(\`mono\`). 기본은 교재 글꼴을 따르고, 없으면 프리셋 글꼴. 직접 정하려면 \`design.fonts\`.

## 2. 지킬 것
- 실습·질문·교재 화면은 모션 1단계를 넘지 않는다. 화려함은 첫 화면·섹션 시작·마무리에만.
- 쉬는 상태가 완성 상태: 효과가 실패해도 글은 보인다. 동작 줄이기·'움직임 멈춤'을 늘 존중.
- 피할 기본값: 보라→파랑 그라데이션 첫 화면, 똑같은 카드 3장, 흔한 AI 이미지, 섹션마다 다른 화려한 효과, 스크롤 납치, 같은 배치의 섹션을 세 번 넘게 잇기(디자인 검사 \`layout-repeat\`).
- 한글: word-break: keep-all, 본문 행간 1.6~1.8, 제목 text-wrap: balance. 글꼴은 아래 목록(상업 이용 가능)만.

## 3. 무드 프리셋 ${E.PRESETS.length}종
| id | 이름 | 어울리는 연수 | 분위기 | 글꼴(제목/본문/숫자) | 연출 | 첫 화면 | 대표 효과 |
|---|---|---|---|---|---|---|---|
${E.PRESETS.map((p) => `| \`${p.id}\` | ${p.name_ko} | ${p.desc_ko} | ${p.moods.join(', ')} | ${fonts(p)} | ${LV[p.motion]} | ${p.variants?.hero || '-'} | ${p.signature || '-'} |`).join('\n')}

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
