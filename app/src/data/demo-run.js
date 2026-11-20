// 먼저 해보기: 대표 레퍼런스 '데이터로 읽는 우리 반'(skills/lecpage/references/designs/data-lab/)을 진짜 생성 파이프라인으로 다시 보여 주는 재료.
// 교재(material/교재.pdf)는 빌드 때 public/demo/로 옮겨지고(scripts/prepare.mjs), 체험 연수에 넣어 실제로 읽음(쪽 그림까지).
// AI 답 자리만 이 사이트에서 떼어 낸 글로 채움: 설계(plan JSON) → 디자인(CSS + 틀 HTML) → 섹션 묶음(HTML).
// 파이프라인(lib/gen/job.js)이 실제와 똑같이 받아 나누고·합치고·조립·검수·저장하므로, 끝난 뒤 화면·편집·검수·배포 연습이 진짜와 같음.
import html from '../../../skills/lecpage/references/designs/data-lab/site/index.html?raw';
import css from '../../../skills/lecpage/references/designs/data-lab/site/assets/style.css?raw';
import js from '../../../skills/lecpage/references/designs/data-lab/site/assets/site.js?raw';
import meta from '../../../skills/lecpage/references/designs/data-lab/lecpage.json';
import { extractSections, headingOf, SECTIONS_MARK } from '../lib/gen/parse.js';

export const DEMO_FILE = { name: '데이터로 읽는 우리 반_교재.pdf', url: 'demo/data-lab.pdf' };
/** 단계마다 AI 답을 받는 데 쓰는 시간(초, 체험이라 짧게). 섹션 묶음은 sections */
export const DEMO_PACE = { plan: 3.2, design: 2.6, sections: 2.8 };

const main = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html);
const body = main ? main[1] : html;
const found = extractSections(body);
const slug = (s, i) => (/class="([\w-]+)/.exec(s.html.slice(0, 200)) || [])[1] || `s${i + 1}`;
const SECTIONS = found.map((s, i) => {
  const id = s.id || slug(s, i);
  const fx = (/data-fx-text="([^"]*)"/.exec(s.html.slice(0, 400)) || [])[1] || '';
  return { id, title: s.title || headingOf(s.html) || fx || id, html: s.id ? s.html : s.html.replace(/<section\b/i, `<section id="${id}"`) };
});

/** 설계 단계의 답(JSON): 연수 정보 + 섹션 차례 */
function planAnswer() {
  const { v, ...m } = meta;
  return '```json\n' + JSON.stringify({ ...m, summary: m.description, sections: SECTIONS.map((s) => ({ id: s.id, title: s.title, purpose: s.title })) }, null, 1) + '\n```';
}
/** 디자인 단계의 답: CSS + 틀 HTML(섹션 자리 표시, 사이트 스크립트는 안에) */
function designAnswer() {
  let shell = html;
  if (main) {
    const inner = main[1];
    const first = inner.indexOf(found[0]?.html || '\u0000'); const last = found.length ? inner.lastIndexOf(found[found.length - 1].html) + found[found.length - 1].html.length : -1;
    const mid = first >= 0 && last > first ? inner.slice(0, first) + SECTIONS_MARK + inner.slice(last) : inner + SECTIONS_MARK;
    shell = html.replace(inner, () => mid);
  }
  shell = shell.replace(/<script src="assets\/site\.js"[^>]*><\/script>/i, () => `<script>\n${js}\n</script>`);
  return '```css\n' + css + '\n```\n\n```html\n' + shell + '\n```';
}
/** 섹션 묶음의 답(ids 순서대로) */
function sectionsAnswer(ids) {
  return '```html\n' + ids.map((id) => SECTIONS.find((s) => s.id === id)?.html || '').filter(Boolean).join('\n\n') + '\n```';
}

/** 단계 이름(+섹션 묶음 ids) → 그 단계의 AI 답 */
export function demoAnswer(step = {}) {
  if (step.name === 'plan') return planAnswer();
  if (step.name === 'design') return designAnswer();
  if (String(step.name || '').startsWith('sections:')) return sectionsAnswer(step.batch || []);
  return '';
}
