// 단계별 지시(AI에게 주는 글). 원칙: 교재에 없는 사실은 지어내지 않기, 교재의 디자인 정체성 존중, 레퍼런스는 분위기만 참고,
// 지시는 짧고 분명하게, 사이트 글은 한국어 해요체.
// 모든 단계가 같은 SYSTEM과 같은 교재 앞부분을 쓰고 단계 글만 뒤에 붙임 → 회사들의 프롬프트 캐시가 교재를 다시 읽는 값을 줄임.
// 키트 설명서: skills/lecpage/references/kit.md(키트 작업자가 만드는 중)를 빌드 때 글로 가져옴. 아직 없으면 아래 임시 글.

// 키트 설명서(엔진 작업자가 씀)를 빌드 때 글로 가져와 그대로 넣음
import KIT_MD from '../../../../skills/lecpage/references/kit.md?raw';
export const KIT_DOC = String(KIT_MD).trim();

export const SYSTEM_GEN = `당신은 연수·강의용 웹사이트를 설계하고 HTML·CSS·JS를 직접 쓰는 웹 디자이너이자 개발자예요. lecpage(강의 사이트 작업대)가 일을 단계로 나눠 맡겨요.

원칙
1. 첨부한 교재 원본(파일·쪽 그림)을 직접 읽고 교재에 있는 내용만 써요. 교재에 없는 사실(날짜·시간·장소·강사·숫자·주소·인용)은 지어내지 말고 비워 두거나 쓰지 않아요. '보조 글자'는 코드가 뽑은 참고용이라 틀릴 수 있어요. 원본과 다르면 원본을 따라요.
2. 교재의 디자인 정체성(색·글꼴 느낌·그림·도식·말투)을 살려 사이트로 옮겨요. 흔한 템플릿처럼 보이지 않게, 이 교재만의 사이트로 만들어요.
3. 레퍼런스 분위기가 주어지면 참고만 하고 따를 의무는 없어요.
4. 사이트 글은 한국어 해요체로 짧고 분명하게 써요. 번역투·과장·이모지 장식은 쓰지 않아요.
5. 참가자가 연수 중 휴대폰(390px)과 교실 화면(1280px 이상)에서 봐요. 가로로 넘치지 않고, 글자 대비 4.5:1 이상, 본문 16px 이상, 그림에는 alt를 달아요.

기술 규칙
- 정적 사이트예요. 추적 코드·남의 사이트 틀·비밀번호 칸·다른 곳으로 보내는 form은 쓰지 않아요. 꼭 필요한 동작만 작은 JS로 쓰고, 바깥 스크립트·CSS는 아래 키트 설명서가 허락한 것만 써요.
- 그림은 lecpage가 만든 교재 쪽 그림(material/p-NNN.webp, 목록을 줌)을 <img>로 써요. 바깥 그림 주소는 막혀요. 작은 도식·아이콘은 HTML 안에 <svg>로 그려도 돼요.
- 글꼴은 시스템 글꼴 묶음(예: Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif)을 먼저 써요.
- 참여 기능은 직접 만들지 말고 아래 키트 설명서의 자리 표시를 넣어요.

${KIT_DOC}`;

const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const j = (v) => JSON.stringify(v, null, 1);
const buildRefPrompt = (reference) => {
  const mood = typeof reference === 'string' ? reference : reference?.mood || reference?.desc || '';
  return mood ? `\n레퍼런스 분위기(참고만, 따르지 않아도 돼요): ${String(mood).slice(0, 600)}` : '';
};
const buildReqPrompt = (request) => (request && String(request).trim() ? `\n강사 요청: ${String(request).trim().slice(0, 2000)}` : '');
const buildKnownPrompt = (info) => {
  const pairs = Object.entries(info || {}).filter(([, v]) => v && (typeof v === 'string' || typeof v === 'number'));
  return pairs.length ? `\n강사가 직접 적은 연수 정보(교재보다 우선): ${pairs.map(([k, v]) => `${k}=${String(v).slice(0, 120)}`).join(', ')}` : '';
};

/**
 * 교재 앞부분 글(단계마다 같음): 무엇을 첨부했는지와 쓸 수 있는 쪽 그림 목록, 보조 글자
 * pack: material.js packMaterial 결과
 */
export function buildMaterialPrompt(pack) {
  const files = pack.files.map((f) => `- ${f.name}${f.pages ? ` (${f.pages}쪽)` : ''}: ${f.sent === 'original' ? '원본 그대로 첨부' : f.sent === 'images' ? '쪽 그림으로 첨부' : f.sent === 'text' ? '글자만(원본을 보낼 수 없는 형식)' : '보내지 못함'}`).join('\n');
  const imgs = pack.siteImages.length ? `사이트에 쓸 수 있는 교재 쪽 그림: ${pack.siteImages.length}장, material/p-001.webp ~ material/p-${String(pack.siteImages.length).padStart(3, '0')}.webp (번호 = 교재 쪽 번호${pack.siteImagesFrom ? `, ${pack.siteImagesFrom}` : ''})` : '사이트에 쓸 교재 쪽 그림은 없어요(그림 없이 만들어요).';
  const shots = pack.sentPages.length ? `\n쪽 그림으로 함께 보낸 쪽: ${pack.sentPages.join(', ')}` : '';
  const text = pack.text ? `\n\n[보조 글자 — 코드가 교재에서 뽑은 글이에요. 참고용이고 틀릴 수 있어요]\n${pack.text}` : '';
  const note = pack.notes.length ? `\n참고: ${pack.notes.join(' ')}` : '';
  return `[교재]\n${files}${shots}\n${imgs}${note}${text}`;
}

/** 1단계: 읽기·설계(JSON) */
export function buildPlanPrompt({ request, reference, info, prevMeta } = {}) {
  return `작업 단계: plan (읽기·설계)
오늘 날짜: ${today()}(연도가 없는 날짜를 읽을 때 기준)${buildKnownPrompt(info)}${prevMeta?.title ? `\n지난번에 확인한 연수 정보: ${j({ title: prevMeta.title, sessions: prevMeta.sessions, venue: prevMeta.venue })}` : ''}${buildReqPrompt(request)}${buildRefPrompt(reference)}

교재를 처음부터 끝까지 읽고, 강의 흐름과 사이트 구성을 설계해 JSON 하나로만 답해 주세요(설명 없이). 꼴:
{
 "title": "연수 제목", "subtitle": "부제(없으면 빈 글)", "organizer": "주최(교재에 있을 때만)",
 "sessions": [{"date": "YYYY-MM-DD", "start": "HH:MM", "end": "HH:MM"}],
 "venue": "장소", "mode": "offline|online|blended", "audience": "teachers|students|parents|staff|other",
 "instructors": [{"name": "강사 이름", "org": "소속"}],
 "facts": [{"label": "날짜|시간|장소|강사|대상|준비물 …", "value": "교재에 적힌 그대로", "page": 교재 쪽 번호}],
 "summary": "교재가 무엇을 가르치는지 3~5문장",
 "audienceNote": "누가 어떤 상황에서 이 사이트를 보는지 한 문장",
 "flow": ["강의 흐름 한 단계씩"],
 "designBrief": {"mood": "분위기", "fromMaterial": "교재 디자인에서 가져올 색·글꼴 느낌·모양·그림", "layout": "배치 방향", "typography": "글자 위계", "motifs": "반복해 쓸 모양·도식"},
 "theme": {"accent": "#RRGGBB", "ink": "#RRGGBB", "paper": "#RRGGBB", "font": "글꼴 묶음"},
 "features": ["qa","poll","board","attendance","survey","help","reactions","deck","materials","timer" 중 이 연수에 맞는 것],
 "sections": [{"id": "영문-소문자-id", "title": "섹션 이름", "purpose": "이 섹션이 참가자에게 주는 것", "outline": ["담을 내용(교재 쪽 번호와 함께)"], "widgets": ["poll" 같은 키트 표시], "pages": [교재 쪽 번호], "images": ["material/p-003.webp"]}]
}
- 섹션은 6~12개. 첫 섹션은 첫 화면(id "hero"). 실습이 있으면 실습 단계를 섹션으로, 교재 쪽 그림을 보여 줄 곳을 정해요.
- facts에는 교재에서 직접 찾은 것만, 쪽 번호와 함께. 찾지 못한 칸은 빈 글이나 빈 목록으로 둬요.
- theme 색은 교재에서 가져오고, ink와 paper의 대비는 4.5:1 이상으로.`;
}

/** 2단계: 디자인(CSS + 문서 틀) */
export function buildDesignPrompt({ plan }) {
  return `작업 단계: design (디자인)
설계:
${j(plan)}

이 설계와 교재의 디자인 정체성으로 사이트의 디자인을 만들어 주세요. 코드 블록 두 개로만 답해요(설명 없이).
1) \`\`\`css — assets/style.css 전체
- 맨 위 :root에 키트 변수 --lp-accent --lp-ink --lp-paper --lp-font --lp-radius와 사이트 변수(색·간격·글자 크기)를 둬요.
- 바탕·글자·제목 위계·링크·버튼·카드·그림·표·코드·인용·섹션 간격·내비게이션·첫 화면 등 섹션들이 쓸 부품 클래스를 미리 다 만들어요. 휴대폰(390px)부터 넓은 화면까지 반응형으로.
- 맨 위 주석에 부품 클래스 목록을 한 줄씩 적어요: /* 클래스: .hero 첫 화면, .card 카드 … */ (다음 단계가 이 클래스만 써요)
- 움직임은 짧고 절제해서, prefers-reduced-motion에서는 끄고요. JS가 없어도 내용이 다 보여야 해요(처음부터 opacity:0으로 숨기지 않기).
2) \`\`\`html — index.html 틀
- <!DOCTYPE html>, <html lang="ko">, head(<meta charset="utf-8">, viewport, <title>, <link rel="stylesheet" href="assets/style.css">), 머리(제목·섹션으로 가는 내비게이션), <main> 안에 <!-- lp:sections --> 한 줄, 바닥글.
- 섹션 내용은 쓰지 마세요(다음 단계에서 섹션 id에 맞춰 넣어요). 내비게이션 링크는 설계의 섹션 id(#id)로.`;
}

/** 3단계: 섹션 몇 개씩 */
export function buildSectionsPrompt({ plan, classes, batch, index, total, done = [] }) {
  return `작업 단계: sections ${index}/${total} (섹션 만들기)
연수: ${plan.title || ''}
디자인 방향: ${j(plan.designBrief || {})}
쓸 수 있는 CSS 클래스(디자인 단계에서 만든 것): ${classes.join(' ') || '(없음)'}
${done.length ? `이미 만든 섹션: ${done.join(', ')}\n` : ''}이번에 만들 섹션(이 순서대로):
${j(batch)}

이 섹션들의 HTML을 써 주세요. \`\`\`html 코드 블록 하나로만 답해요(설명 없이).
- 섹션마다 <section id="설계의 id" data-title="섹션 이름">…</section>. 다른 섹션·head·main은 쓰지 않아요.
- 내용은 교재에서 가져와요(outline의 쪽을 읽고). 교재 쪽 그림은 <img src="material/p-NNN.webp" alt="무엇이 보이는지" loading="lazy">로.
- 위 CSS 클래스만 써요. 꼭 새 모양이 필요하면 그 섹션 id로 범위를 좁힌 규칙을 \`\`\`css 블록으로 덧붙여요(30줄 이내). style 속성은 쓰지 않아요.
- widgets에 적힌 키트 표시를 알맞은 자리에 넣어요. 실습 단계는 data-lp-step을 써요.`;
}

/** 검수 문제 → 그 섹션만 고치기 */
export function buildFixPrompt({ issuesText, sections, classes }) {
  return `작업 단계: fix (검수 문제 고치기)
lecpage 검수에서 아래 문제가 나왔어요:
${issuesText}

문제가 있는 섹션의 지금 HTML:
\`\`\`html
${sections.map((s) => s.html).join('\n\n')}
\`\`\`
쓸 수 있는 CSS 클래스: ${classes.join(' ')}

문제를 고친 섹션 전체를 \`\`\`html 코드 블록 하나로만 답해요(같은 id, 설명 없이). CSS를 고쳐야 하면 덧붙일 규칙만 \`\`\`css 블록으로. 내용은 바꾸지 말고 문제만 고쳐요.`;
}

/** 수정 요청(키·로컬): 고를 섹션이나 전체 */
export function buildEditPrompt({ request, target, sections, css, meta }) {
  const all = target === 'all';
  return `작업 단계: edit (수정 요청)
강사 요청: ${String(request || '').trim().slice(0, 4000)}

${all ? '사이트의 지금 섹션들' : `고칠 섹션(#${target})`}:
\`\`\`html
${sections.map((s) => s.html).join('\n\n')}
\`\`\`
지금 CSS(assets/style.css):
\`\`\`css
${String(css || '').slice(0, 60000)}
\`\`\`
${meta ? `지금 연수 정보: ${j({ title: meta.title, subtitle: meta.subtitle, sessions: meta.sessions, venue: meta.venue, instructors: meta.instructors })}\n` : ''}
요청대로 고쳐 주세요. 답은 코드 블록으로만(설명 없이):
- \`\`\`html — 바뀐 섹션만, 섹션 전체(<section id="…">…</section>, 같은 id). 새 섹션은 새 id로. ${all ? '바뀌지 않은 섹션은 쓰지 않아요.' : ''}
- CSS를 바꿔야 하면 \`\`\`css 블록에 덧붙일 규칙만(색을 바꾸면 :root 변수를 다시 적어도 돼요).
- 연수 정보(제목·날짜·장소 등)를 바꿔야 하면 \`\`\`json 블록에 바뀐 칸만.
교재에 없는 사실은 지어내지 않아요.`;
}

/** 쓰던 AI 창(키 없이): 한 번에 index.html 전체 + 맨 끝 lecpage.json */
export function buildChatPrompt({ request, reference, info, files = [] } = {}) {
  const names = files.map((f) => f.name).filter(Boolean);
  return `${SYSTEM_GEN}

---
이 대화에 교재 파일${names.length ? `(${names.join(', ')})` : ''}을 첨부했어요. 첨부한 교재를 처음부터 끝까지 직접 읽고 강의 사이트를 만들어 주세요.
교재 파일이 첨부되지 않았으면 만들지 말고 "교재 파일(PDF)을 첨부해 주세요."라고만 답해 주세요.
오늘 날짜: ${today()}${buildKnownPrompt(info)}${buildReqPrompt(request)}${buildRefPrompt(reference)}

만드는 법
- 교재를 읽고 강의 흐름·섹션 구성(6~12개)·디자인 방향을 먼저 속으로 정한 뒤 코드를 써요.
- index.html 한 파일로: <!DOCTYPE html>로 시작해 </html>로 끝나요. CSS는 <head>의 <style> 하나에, JS는 꼭 필요할 때만 </body> 앞 <script> 하나에.
- :root에 --lp-accent --lp-ink --lp-paper --lp-font --lp-radius를 둬요. 섹션마다 <section id="영문-id" data-title="섹션 이름">.
- 교재 쪽 그림은 아직 없으니 <img>를 넣지 말고, 필요하면 인라인 SVG 도식으로 그려요.
- 캔버스·아티팩트가 있으면 거기에 만들어도 돼요. 답은 설명 없이 코드 블록으로만:
  1) \`\`\`html 코드 블록 하나에 index.html 전체
  2) 바로 이어서 \`\`\`json 코드 블록에 lecpage.json:
{"v":2,"title":"…","subtitle":"…","sessions":[{"date":"YYYY-MM-DD","start":"HH:MM","end":"HH:MM"}],"venue":"…","mode":"offline","audience":"teachers","instructors":[{"name":"…","org":"…"}],"features":["qa","poll"],"theme":{"accent":"#…","ink":"#…","paper":"#…","font":"…"},"facts":[{"label":"장소","value":"…","page":3}]}
- 답이 길어 중간에 끊기면, 제가 "이어서"라고 하면 끊긴 바로 다음 글자부터 이어 써 주세요.`;
}

/** 쓰던 AI 창: 잘린 답 이어서 */
export function buildContinuePrompt(tail) {
  const last = String(tail || '').replace(/\s+$/, '').split('\n').slice(-3).join('\n').slice(-300);
  return `앞 답이 중간에 끊겼어요. 끊긴 바로 다음 글자부터 이어서 써 주세요. 앞부분을 되풀이하지 말고, 설명 없이 \`\`\`html 코드 블록 하나로만요. 끝에 lecpage.json(\`\`\`json)도 잊지 마세요.
앞 답의 마지막 부분:
${last}`;
}

/** 쓰던 AI 창: 수정 요청(섹션 HTML만 담음) */
export function buildChatEditPrompt({ request, target, sections, css }) {
  const all = target === 'all';
  return `제가 만든 강의 사이트를 고치고 싶어요.
요청: ${String(request || '').trim().slice(0, 4000)}

${all ? '사이트의 섹션들' : `고칠 섹션(#${target})`}:
\`\`\`html
${sections.map((s) => s.html).join('\n\n')}
\`\`\`
${css ? `사이트 CSS(참고):\n\`\`\`css\n${String(css).slice(0, 20000)}\n\`\`\`\n` : ''}
요청대로 고친 섹션 전체만 \`\`\`html 코드 블록 하나로 답해 주세요(같은 id, 설명 없이). CSS를 바꿔야 하면 덧붙일 규칙만 \`\`\`css 블록으로. 교재에 없는 사실은 지어내지 마세요.`;
}

/** 단계 이름 → 화면 글 */
export function stepLabel(name, total) {
  if (name === 'plan') return '교재를 읽고 설계하는 중';
  if (name === 'design') return '디자인을 정하는 중';
  if (name.startsWith('sections:')) return `섹션을 만드는 중 (${name.split(':')[1]}/${total})`;
  if (name === 'assemble') return '조립하고 검수하는 중';
  if (name === 'fix') return '검수에서 찾은 문제를 고치는 중';
  if (name === 'edit') return '요청대로 고치는 중';
  if (name === 'agent') return '내 PC의 AI에게 맡기는 중';
  return '마무리하는 중';
}

/** CSS에서 클래스 이름 목록(디자인 단계 결과 → 섹션 단계에 줌) */
export function cssClasses(css) {
  const set = new Set();
  const s = String(css || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/url\([^)]*\)/g, '');
  for (const m of s.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) if (!/^\d/.test(m[1])) set.add('.' + m[1]);
  return [...set].slice(0, 400);
}
