// AI에게 주는 글. 원칙: lecpage는 AI의 디자인·구성에 끼어들지 않음. 교재 원본과 짧은 요청 하나, 강사 요청만 보내고
// AI가 사이트 전체(index.html·CSS·JS·그림을 원하는 대로)를 한 답으로 돌려줌. 지시에 넣는 것은 목표 한 줄, 강사 요청,
// 필요한 자리에 넣는 연수 기능 자리 표시, 배포에 꼭 필요한 조건, 끝의 짧은 연수 정보(JSON)뿐.
// 목표는 사이트가 하는 일(참가자가 강의 중·뒤에 실제로 하는 일)을 먼저: 교재 내용은 교재 넘기기와 강사가 전함.
// 내 PC의 Claude Code·Codex(skills/lecpage/scripts/studio.mjs taskText)도 같은 뜻의 지시를 씀.

const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const j = (v) => JSON.stringify(v, null, 1);

/** 목표(사용자의 요구 한 문장 포함) */
export const GOAL = `연수 당일 참가자가 휴대폰에 열어 두고 쓰는 강의 사이트를 만들어 주세요.
교재 슬라이드는 교재 넘기기(쪽 그림을 강사 따라 넘겨 보는 \`<div data-lp="deck"></div>\`)로 이미 사이트에 다 들어가고, 내용은 강사가 강의로 전해요. 그래서 사이트는 교재를 다시 옮겨 적지 않고(교재의 설명·원칙·표는 교재 넘기기의 그 쪽으로 이어 줘요), 참가자가 강의 중과 뒤에 실제로 하는 일을 도와요: 지금 어디쯤인지와 오늘 흐름, 접속·출석, 교재 보기, 실습 안내와 그대로 복사할 원문(프롬프트·주소), 질문·투표·나눔 같은 참여, 자료 내려받기, 과제·설문, 나중에 다시 찾을 정보. 교재 내용은 이 일에 필요한 핵심 한두 줄만 넣어요.
강사는 이 사이트로 진행을 이끌고, 연수 운영 담당자는 출석·설문·과제가 빠짐없이 모이길 바라요.
디자인은 교재 모양(색·배치·글머리표)을 따라 하지 않고 교재와는 차원이 다르게 새로 만들어요. 교재에서는 주제·대상·분위기 같은 컨셉만 읽고, 교재가 아무리 평범하거나 딱딱해도 웹 디자인 수상작처럼 화려하고 세련된 최신 기법과 모션으로 만들어요. 들어오자마자 '이건 다르다'고 느낄 만큼, 컨셉을 상징하는 살아 움직이는 첫 화면 장면(셰이더·캔버스·SVG·3D 같은 직접 그린 그래픽), 움직이는 글자, 스크롤에 따라 펼쳐지는 연출로 이 연수만의 정체성을 보여 주고, 흔한 카드·상자 나열이나 차분한 문서 같은 지면에 머물지 않아요. 실습·복사·참여 자리는 휴대폰에서 읽고 누르기 쉽게 둬요.
한 쪽이든 여러 쪽이든, 순서·배치·디자인은 이 연수에 맞게 마음껏 정해요. 첫 쪽은 휴대폰에서 짧게 훑을 수 있게, 실습처럼 긴 내용은 따로 쪽으로 나눠도 돼요.`;

/** 배포 조건(만든 사이트의 CSP·바로 배포가 막는 것)과 사실 지키기 */
export const RULES = `배포 조건(이것만은 꼭)
- 스크립트는 사이트 안에(인라인 <script>도 돼요). 바깥 스크립트는 jsDelivr의 gsap@3.15.1·lenis@1.3.27·ogl@1.0.11만, 바깥 CSS는 웹 글꼴만.
- 그림은 교재 쪽 그림(material/p-001.webp처럼 쪽 번호)이나 HTML 안 <svg>·CSS·canvas로. 바깥 그림 주소와 .svg 파일은 막혀요.
- 비밀번호 칸·바깥으로 보내는 form은 쓰지 않아요. 틀(iframe)은 유튜브·비메오만.
- 교재에 없는 날짜·장소·이름·숫자는 지어내지 않아요.`;

/** 연수 기능(필요한 자리에) */
export const KIT = `연수 기능(필요한 자리에 넣어요): 자리 표시를 넣으면 lecpage가 실제로 동작하는 기능으로 채우고 강사 화면·발표 화면·QR도 만들어요.
<div data-lp="qa"></div> 질문 · <div data-lp="poll" data-question="…" data-options='["…","…"]'></div> 투표 · <div data-lp="board" data-prompt="…"></div> 보드 · <div data-lp="attend"></div> 출석 · <div data-lp="survey"></div> 설문 · <div data-lp="deck" data-pages="1-12"></div> 교재 넘기기 · 실습 단계 <section data-lp-step="s1" data-title="…">. 자리 표시 안은 비워 둬요. 기능의 색은 :root의 --lp-accent·--lp-ink·--lp-paper(#RRGGBB)를 따라요.`;

/**
 * 디자인 서재(짧은 판): skills/lecpage/references/design-library.md를 줄인 것. 고를 수 있는 낱말·기법을 넓혀 줄 뿐 규칙이 아님.
 * 키 길·쓰던 AI 창의 만들기와 고치기에 모두 넣음. 에이전트 길(lecpage 커넥트·Skill)은 전체 파일을 작업 폴더에 둠
 */
export const LIBRARY = `디자인 서재(필요하면 참고, 따를 의무 없음. 이 연수의 컨셉이 먼저고, 섞거나 여기 없는 방식을 써도 돼요)
- 노릴 수준: 들어오자마자 공들인 최신 사이트로 느끼는 첫 화면. lecpage 견본(교재 표지의 신경망을 WebGL로 살린 첫 화면, 3D로 넘기는 그림책, 하루 1,440분 격자가 채워지는 첫 화면)이 바닥 기준이에요. 베끼지 말고, 지금 교재의 컨셉에서만 나올 장면으로 그보다 한 단계 위를 노려요. 교재가 평범하거나 딱딱해도 사이트까지 차분한 문서처럼 만들 이유는 없어요.
- 컨셉에서 장면으로: 교재 장르(슬라이드·공문·보고서)가 아니라 연수가 다루는 변화·행동에서 은유 하나 → 첫 화면에서 살아 움직이는 장면 하나(셰이더·캔버스 생성 그림·SVG·3D CSS·움직이는 글자) → 그 모티프를 '지금' 표시·진행 막대·장 바뀜·버튼 반응으로 이어요.
- 결(바탕 하나 + 강조 한 점): 편집·잡지 · 스위스 격자 · 포스터·움직이는 글자 · 리소그래프(mix-blend-mode, 어긋난 판, 그레인) · 셰이더 빛·유체 · 네온·유리 · 3D 공간 · 생성 예술 · 손그림 공책 · 설계도 · 데이터 시각화 · 콜라주 · 픽셀 아케이드 · 칠판 · 지도·답사 · 따뜻한 미니멀.
- 한글 글꼴 짝(구글 폰트 css2, 확인함): Noto Serif KR·Hahmlet + Asta Sans(편집) · Gowun Batang + Gowun Dodum(편지) · Black Han Sans·Gasoek One + Gothic A1(포스터) · IBM Plex Sans KR + IBM Plex Mono(기술) · Gaegu·Nanum Pen Script 메모(손그림) · Jua·Do Hyeon(친근) · Orbit(미래) · Song Myung·Nanum Myeongjo(인문). 숫자·영문: Fraunces·Instrument Serif·Bricolage Grotesque·Anton·Anybody·Unbounded·Caveat. 가변 글꼴은 범위로(Hahmlet:wght@100..900). Pretendard는 jsDelivr(orioncactus/pretendard@v1.3.9). word-break:keep-all, 제목 text-wrap:balance.
- 첫 화면 기법: WebGL 셰이더 배경(라이브러리 없이 화면을 덮는 삼각형 하나 + 조각 셰이더, 해상도 0.6배, 손끝 위치를 uniform으로, 화면 밖·숨김이면 멈춤) · 캔버스 생성 그림(씨앗 있는 무작위, 손끝 반응) · 움직이는 글자(낱말 단위로 감싸고 글자마다 --i로 차례로 접혀 오르기, 가변 굵기·폭, 띠 글자) · 스크롤 이야기(GSAP ScrollTrigger pin + scrub, 또는 @supports (animation-timeline: view()) 안에서 animation-range) · 3D(perspective + preserve-3d, 손끝 기울기, 넘기는 쪽) · 쪽 사이 이음(@view-transition{navigation:auto} + view-transition-name) · SVG 선 그리기(pathLength="1")·morph · 그레인(data: SVG feTurbulence)·유리·원근 격자. 라이브러리는 jsDelivr의 gsap@3.15.1(+ScrollTrigger)·lenis@1.3.27·ogl@1.0.11(+esm). 움직임은 첫 화면과 장 바뀜에 크게, 실습·복사·키트 자리는 차분히. prefers-reduced-motion이면 끄고, JS 없이도 내용이 처음부터 다 보이게.
- 강의 무늬: 길이에 비례한 시간 막대와 '지금' 표시 · 실습 레일 · 원문 + 복사 버튼(data-copy-text) 프롬프트 카드와 조립기 · '교재 N쪽' 꼬리표(#deck-pN) · 나쁜 예/좋은 예 · 체크리스트 · 타이머 · 실습이 길면 쪽 나누기.
- AI 티(무심코 나왔다면 이 연수의 컨셉에서 나온 결정으로): 보라→파랑 그라데이션 · 가운데 정렬 제목 + 버튼 둘 + 같은 카드 세 장 · 같은 크기 카드 격자·상자 속 상자 · 이모지 아이콘 · 알약 꼬리표 남발 · 모든 섹션이 떠오르는 등장 · 곳곳의 glow·뜻 없는 3D 덩어리 · 시스템 글꼴 한 벌 · 모든 섹션 같은 리듬 · 안전하게만 고른 지면(줄과 상자뿐, 움직이는 첫 장면 없음, 교재 장르 흉내) · 빈 구호·가짜 수치. 사람이 만든 티: 교재에서 나온 구체적인 말·숫자, 컨셉에서만 나올 살아 있는 첫 화면 장면, 큰 크기 대비, 비대칭과 리듬 있는 여백, 대담한 결정 하나.`;

const META_FORM ='{"title":"…","sessions":[{"date":"YYYY-MM-DD","start":"HH:MM","end":"HH:MM"}],"venue":"…","instructors":[{"name":"…","org":"…"}]}';

/** 답하는 꼴(파일마다 코드 블록 하나, 여는 줄에 경로) */
const FORMAT = `답하는 꼴(lecpage가 읽어요): 파일마다 코드 블록 하나로, 여는 줄에 경로를 적어요. 설명 글은 쓰지 않아요.
\`\`\`index.html
<!DOCTYPE html>…
\`\`\`
\`\`\`assets/style.css
…
\`\`\`
JS·다른 쪽(.html)도 필요하면 같은 꼴로(assets/site.js 등). 맨 끝에 교재에서 찾은 연수 정보만(없는 칸은 빼요):
\`\`\`lecpage.json
${META_FORM}
\`\`\``;

/** 시스템 글(짧게): 모든 요청이 같은 글을 써서 회사들의 프롬프트 캐시가 교재를 다시 읽는 값을 줄임 */
export const SYSTEM_GEN = '당신은 교재를 직접 읽고 웹사이트를 디자인해 코드까지 쓰는 사람이에요. 사이트 글은 한국어로 써요.';

/**
 * 강사가 참고 디자인에서 담은 디자인(lib/design-cart.js → p.reference.picks) → 짧은 목록. 강사가 고른 것이라 강사 요청의 일부로 넣음
 * 내 PC의 AI(skills/lecpage/scripts/studio.mjs picksText)도 같은 꼴
 */
export function picksText(picks) {
  const list = (Array.isArray(picks) ? picks : []).filter((x) => x && x.ko).slice(0, 10);
  if (!list.length) return '';
  const c = (v, n) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, n);
  return `강사가 고른 디자인 참고(이 연수에 맞게 녹여 써요):\n${list.map((x) => `- ${c(x.ko, 30)}${x.en ? `(${c(x.en, 40)})` : ''} — ${c(x.desc, 70)} — ${c(x.tech, 70)}`).join('\n')}`;
}

/** 강사 요청(+ 강사가 고른 참고 분위기·담은 디자인, 강사가 직접 적은 연수 정보) */
function askOf({ request, reference, info } = {}) {
  const out = [];
  if (request && String(request).trim()) out.push(String(request).trim().slice(0, 4000));
  const mood = typeof reference === 'string' ? reference : reference?.mood || reference?.desc || '';
  if (mood && String(mood).trim()) out.push(`분위기: ${String(mood).trim().slice(0, 600)}`);
  const picks = picksText(reference?.picks);
  if (picks) out.push(picks);
  const pairs = Object.entries(info || {}).filter(([, v]) => v && (typeof v === 'string' || typeof v === 'number'));
  if (pairs.length) out.push(`강사가 적은 연수 정보(교재보다 우선): ${pairs.map(([k, v]) => `${k}=${String(v).slice(0, 120)}`).join(', ')}`);
  return out.length ? out.join('\n') : '(따로 없음)';
}

/**
 * 교재 앞부분 글(요청마다 같음): 무엇을 첨부했는지, 사이트에 쓸 수 있는 쪽 그림. 원본을 못 보낸 교재가 있으면 그 교재에서 코드가 뽑은 글자도
 * pack: material.js packMaterial 결과
 */
export function buildMaterialPrompt(pack) {
  const files = pack.files.map((f) => `- ${f.name}${f.pages ? ` (${f.pages}쪽)` : ''}: ${f.sent === 'original' ? (f.ext === 'pdf' || !f.via ? '원본 그대로 첨부' : `${f.via}로 만든 PDF로 첨부`) : f.sent === 'twin' ? '같은 이름의 PDF로 함께 첨부' : f.sent === 'images' ? '쪽 그림으로 첨부' : f.sent === 'text' ? '글자만(원본을 보낼 수 없는 형식)' : '보내지 못함'}`).join('\n');
  const imgs = pack.siteImages.length ? `사이트에 쓸 수 있는 교재 쪽 그림: material/p-001.webp ~ material/p-${String(pack.siteImages.length).padStart(3, '0')}.webp (번호 = 교재 쪽 번호${pack.siteImagesFrom ? `, ${pack.siteImagesFrom}` : ''})` : '교재 쪽 그림은 없어요.';
  const shots = pack.sentPages.length ? `\n쪽 그림으로 함께 보낸 쪽: ${pack.sentPages.join(', ')}` : '';
  // 코드가 뽑은 글자는 원본을 보내지 못한 교재의 쪽만(material.js packMaterial). 원본으로 보낸 교재의 글은 넣지 않음
  const text = pack.text ? `\n\n[원본을 보내지 못한 교재에서 코드가 뽑은 글자 — 틀릴 수 있어요. 쪽 그림과 다르면 쪽 그림이 맞아요]\n${pack.text}` : '';
  const note = pack.notes.length ? `\n참고: ${pack.notes.join(' ')}` : '';
  return `[교재]\n${files}${shots}\n${imgs}${note}${text}`;
}

/** 새로 만들기(한 번에): 목표 · 강사 요청 · 강의 기능 · 배포 조건 · 답하는 꼴 */
export function buildBuildPrompt({ request, reference, info } = {}) {
  return `작업 단계: build
${GOAL}
오늘 날짜: ${today()}

강사 요청:
${askOf({ request, reference, info })}

${KIT}

${LIBRARY}

${RULES}

${FORMAT}`;
}

/** 사이트의 글 파일(html·css·js) → 코드 블록들(여는 줄에 경로) */
export function siteBlocks(site = {}, { max = 400000 } = {}) {
  let left = max;
  return Object.keys(site).filter((k) => typeof site[k] === 'string' && /\.(html?|css|m?js)$/i.test(k)).sort((a, b) => (a === 'index.html' ? -1 : b === 'index.html' ? 1 : a.localeCompare(b)))
    .map((k) => { const v = String(site[k]).slice(0, Math.max(0, left)); left -= v.length; return `\`\`\`${k}\n${v}\n\`\`\``; }).join('\n\n');
}

/** 고치기(수정 요청·검수 결과): 지금 사이트 전체 + 요청 → 바뀐 파일만 */
export function buildEditPrompt({ request, target, site, meta }) {
  const where = target && target !== 'all' ? `\n고칠 곳: id="${target}"인 부분. 다른 곳은 그대로 둬요.` : '';
  return `작업 단계: edit
강사가 만든 강의 사이트를 아래 요청대로 고쳐 주세요. 요청과 상관없는 곳은 그대로 둬요.

강사 요청:
${String(request || '').trim().slice(0, 6000)}${where}
${meta ? `\n지금 연수 정보: ${j({ title: meta.title, sessions: meta.sessions, venue: meta.venue, instructors: meta.instructors })}\n` : ''}
지금 사이트 파일:
${siteBlocks(site)}

${LIBRARY}

${RULES}

답하는 꼴: 바뀐 파일만, 파일 전체를 코드 블록 하나씩(여는 줄에 경로, 예: \`\`\`index.html). 설명 글은 쓰지 않아요. 연수 정보가 바뀌면 \`\`\`lecpage.json 블록에 바뀐 칸만.`;
}

/** 검수 결과 → 고치기 요청 글([AI에게 고쳐 달라기]) */
export function fixRequest(issuesText) {
  return `lecpage 검수에서 아래 문제가 나왔어요. 디자인은 그대로 두고 이 문제만 고쳐 주세요.\n${issuesText}`;
}

/** 쓰던 AI 창(키 없이): 한 번에 index.html 한 파일(CSS·JS는 안에) + 맨 끝 lecpage.json */
export function buildChatPrompt({ request, reference, info, files = [] } = {}) {
  const names = files.map((f) => f.name).filter(Boolean);
  return `${GOAL}
이 대화에 교재 파일${names.length ? `(${names.join(', ')})` : ''}을 첨부했어요. 첨부한 교재를 직접 읽고 만들어 주세요. 교재 파일이 첨부되지 않았으면 만들지 말고 "교재 파일(PDF)을 첨부해 주세요."라고만 답해 주세요.
오늘 날짜: ${today()}

강사 요청:
${askOf({ request, reference, info })}

${KIT}

${LIBRARY}

${RULES}

답하는 꼴(lecpage에 붙여 넣어요): 설명 없이 코드 블록 두 개.
1) \`\`\`html — index.html 한 파일(<!DOCTYPE html>부터 </html>까지, CSS는 <style>, JS는 <script>로 안에)
2) 바로 이어서 \`\`\`json — 교재에서 찾은 연수 정보만: ${META_FORM}
답이 길어 중간에 끊기면, 제가 "이어서"라고 하면 끊긴 바로 다음 글자부터 이어 써 주세요.`;
}

/** 쓰던 AI 창: 잘린 답 이어서 */
export function buildContinuePrompt(tail) {
  const last = String(tail || '').replace(/\s+$/, '').split('\n').slice(-3).join('\n').slice(-300);
  return `앞 답이 중간에 끊겼어요. 끊긴 바로 다음 글자부터 이어서 써 주세요. 앞부분을 되풀이하지 말고, 설명 없이 \`\`\`html 코드 블록 하나로만요. 끝에 연수 정보(\`\`\`json)도 잊지 마세요.
앞 답의 마지막 부분:
${last}`;
}

/** 쓰던 AI 창: 수정 요청(지금 사이트 전체 + 요청 → 고친 index.html 전체) */
export function buildChatEditPrompt({ request, target, site }) {
  const where = target && target !== 'all' ? `\n고칠 곳: id="${target}"인 부분. 다른 곳은 그대로 둬요.` : '';
  return `제가 만든 강의 사이트를 고치고 싶어요. 요청과 상관없는 곳은 그대로 둬 주세요.
요청: ${String(request || '').trim().slice(0, 4000)}${where}

지금 사이트 파일:
${siteBlocks(site, { max: 120000 })}

${LIBRARY}

고친 사이트를 index.html 한 파일(CSS·JS는 안에)로, 설명 없이 \`\`\`html 코드 블록 하나로 답해 주세요. 교재에 없는 사실은 지어내지 마세요.`;
}

/** 단계 이름 → 화면 글(단계 목록에 '끝·하는 중·기다림'과 함께 보이므로 이름꼴) */
export function stepLabel(name) {
  if (name === 'build') return 'AI가 교재 읽고 사이트 만들기';
  if (name === 'assemble') return '조립하고 검수하기';
  if (name === 'fix') return '검수에서 찾은 곳 고치기';
  if (name === 'edit') return '요청대로 고치기';
  if (name === 'agent') return '내 PC의 AI에게 맡기기';
  return '마무리하기';
}
