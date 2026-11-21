// AI에게 주는 글. 원칙: lecpage는 AI의 디자인·구성에 끼어들지 않음. 교재 원본과 짧은 요청 하나, 강사 요청만 보내고
// AI가 사이트 전체(index.html·CSS·JS·그림을 원하는 대로)를 한 답으로 돌려줌. 지시에 넣는 것은 목표 한 줄, 강사 요청,
// 쓰고 싶을 때만 쓰는 강의 기능 자리 표시, 배포에 꼭 필요한 조건, 끝의 짧은 연수 정보(JSON)뿐.
// 내 PC의 Claude Code·Codex(skills/lecpage/scripts/studio.mjs taskText)도 같은 뜻의 지시를 씀.

const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const j = (v) => JSON.stringify(v, null, 1);

/** 목표(사용자의 요구 한 문장 포함) */
export const GOAL = `연수·강의 중에 참가자가 곁에 두고 쓰는 웹사이트를 만들어 주세요.
교재를 다시 옮겨 적는 사이트가 아니라 강의의 동반자예요. 핵심, 해야 할 일, 그대로 복사할 원문(프롬프트·주소)이면 충분해요.
디자인과 구성은 교재와 연수에 맞게 마음껏 정해요.`;

/** 배포 조건(만든 사이트의 CSP·바로 배포가 막는 것)과 사실 지키기 */
export const RULES = `배포 조건(이것만은 꼭)
- 스크립트는 사이트 안에(인라인 <script>도 돼요). 바깥 스크립트는 jsDelivr의 gsap@3.15.1·lenis@1.3.27·ogl@1.0.11만, 바깥 CSS는 웹 글꼴만.
- 그림은 교재 쪽 그림(material/p-001.webp처럼 쪽 번호)이나 HTML 안 <svg>·CSS·canvas로. 바깥 그림 주소와 .svg 파일은 막혀요.
- 비밀번호 칸·바깥으로 보내는 form은 쓰지 않아요. 틀(iframe)은 유튜브·비메오만.
- 교재에 없는 날짜·장소·이름·숫자는 지어내지 않아요.`;

/** 강의 기능(쓰고 싶을 때만) */
export const KIT = `강의 기능(쓰고 싶을 때만): 자리 표시를 넣으면 lecpage가 실제 기능으로 채우고 강사 화면·QR도 만들어요.
<div data-lp="qa"></div> 질문 · <div data-lp="poll" data-question="…" data-options='["…","…"]'></div> 투표 · <div data-lp="board" data-prompt="…"></div> 보드 · <div data-lp="attend"></div> 출석 · <div data-lp="survey"></div> 설문 · <div data-lp="deck" data-pages="1-12"></div> 교재 넘기기 · 실습 단계 <section data-lp-step="s1" data-title="…">. 자리 표시 안은 비워 둬요. 기능의 색은 :root의 --lp-accent·--lp-ink·--lp-paper(#RRGGBB)를 따라요.`;

const META_FORM = '{"title":"…","sessions":[{"date":"YYYY-MM-DD","start":"HH:MM","end":"HH:MM"}],"venue":"…","instructors":[{"name":"…","org":"…"}]}';

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

/** 강사 요청(+ 강사가 고른 참고 분위기, 강사가 직접 적은 연수 정보) */
function askOf({ request, reference, info } = {}) {
  const out = [];
  if (request && String(request).trim()) out.push(String(request).trim().slice(0, 4000));
  const mood = typeof reference === 'string' ? reference : reference?.mood || reference?.desc || '';
  if (mood && String(mood).trim()) out.push(`분위기: ${String(mood).trim().slice(0, 600)}`);
  const pairs = Object.entries(info || {}).filter(([, v]) => v && (typeof v === 'string' || typeof v === 'number'));
  if (pairs.length) out.push(`강사가 적은 연수 정보(교재보다 우선): ${pairs.map(([k, v]) => `${k}=${String(v).slice(0, 120)}`).join(', ')}`);
  return out.length ? out.join('\n') : '(따로 없음)';
}

/**
 * 교재 앞부분 글(요청마다 같음): 무엇을 첨부했는지, 사이트에 쓸 수 있는 쪽 그림. 원본을 못 보낸 형식이면 코드가 뽑은 글자도
 * pack: material.js packMaterial 결과
 */
export function buildMaterialPrompt(pack) {
  const files = pack.files.map((f) => `- ${f.name}${f.pages ? ` (${f.pages}쪽)` : ''}: ${f.sent === 'original' ? '원본 그대로 첨부' : f.sent === 'images' ? '쪽 그림으로 첨부' : f.sent === 'text' ? '글자만(원본을 보낼 수 없는 형식)' : '보내지 못함'}`).join('\n');
  const imgs = pack.siteImages.length ? `사이트에 쓸 수 있는 교재 쪽 그림: material/p-001.webp ~ material/p-${String(pack.siteImages.length).padStart(3, '0')}.webp (번호 = 교재 쪽 번호${pack.siteImagesFrom ? `, ${pack.siteImagesFrom}` : ''})` : '교재 쪽 그림은 없어요.';
  const shots = pack.sentPages.length ? `\n쪽 그림으로 함께 보낸 쪽: ${pack.sentPages.join(', ')}` : '';
  // 원본을 다 보냈으면 AI가 원본을 읽음 → 코드가 뽑은 글자는 넣지 않음(원본을 못 보낸 것이 있을 때만)
  const needText = pack.files.some((f) => f.sent !== 'original');
  const text = pack.text && needText ? `\n\n[교재에서 뽑은 글자 — 원본을 보내지 못한 부분을 위한 참고용이에요]\n${pack.text}` : '';
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
