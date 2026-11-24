// 꼭 고칠 곳의 한 줄 요약에 보일 말(pages/steps/studio/Parts.jsx IssueLine): 검수 문구에서 개발자용 정보(괄호 속 CSS 선택자
// 'section#hero > div.wrap > img', 픽셀 수 '1114px')를 뺌. 파일 이름(material/p-001.webp, files/…)은 강사가 알아볼 수 있으니 둠.
// 온전한 문구는 [자세히 보기]와 AI에게 보내는 글에 그대로.
// 검수가 적는 선택자(엔진 inspect-rendered.js의 sel())의 꼴: 'tag#id' · 'a.b > c' · 클래스가 없으면 'img:nth-of-type(2)'(괄호가 한 겹 더 듦) ·
// 요소 이름만('img', 'body') · '[data-lp="deck"]' · 여럿이면 쉼표로 이음. 화면 조각이 아니라 Node에서도 불러 시험함(app-plain-issue.test.mjs)
const FILE_NAME = /\.(html?|css|m?js|json|png|jpe?g|webp|gif|svg|avif|pdf|txt|hwpx?|pptx?|docx?|xlsx?|zip|woff2?|mp[34])\b/i;
// 요소 이름만 적힌 선택자
const TAG = /^(html|body|main|header|footer|nav|section|article|aside|div|span|p|a|b|i|em|strong|small|img|picture|figure|figcaption|ul|ol|li|dl|dt|dd|table|thead|tbody|tfoot|tr|td|th|h[1-6]|button|input|select|textarea|label|form|fieldset|details|summary|dialog|video|audio|canvas|svg|iframe|blockquote|pre|code|br|hr)$/i;
const cssOne = (s) => /\s>\s|[\w\])]#[\w-]|:nth-|^#[\w-]|^[a-z][a-z0-9]*[.#[]|^\.[a-z_-]|^\[/i.test(s) || TAG.test(s);
/** 괄호 속 글이 CSS 선택자인지(파일 이름이 들어 있으면 아님). 쉼표로 이은 것은 하나하나가 모두 선택자일 때 */
const looksCss = (s0) => { const s = s0.trim(); return !FILE_NAME.test(s) && (cssOne(s) || (s.includes(',') && s.split(/\s*,\s*/).every(cssOne))); };
// 괄호는 안에 한 겹 더 든 것까지 한 덩어리로 봄(:nth-of-type(2)가 든 선택자, '사진 (1).png' 같은 파일 이름)
export const plainIssue = (m) => String(m || '').replace(/\s*\(((?:[^()]|\([^()]*\))*)\)/g, (all, inner) => (looksCss(inner) || /\dpx\b/.test(inner) ? '' : all)).replace(/\s?\d+(\.\d+)?px(?![\w-])/g, '').replace(/\s+([.,])/g, '$1').trim();
