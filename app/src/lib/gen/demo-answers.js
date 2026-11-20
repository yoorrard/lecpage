// 완성된 사이트 한 벌(레퍼런스) → 생성 파이프라인 단계마다의 'AI 답'(설계 JSON · 디자인 CSS+틀 · 섹션 묶음 HTML).
// 먼저 해보기(data/demo-run.js → providers/demo.js)와 도움말 그림 찍기(scripts/help-shots.mjs)가 함께 씀. 브라우저·Node 어디서나 도는 순수 함수.
import { extractSections, headingOf, SECTIONS_MARK } from './parse.js';

/**
 * @param {{ html: string, css: string, js?: string, meta: object }} ref  사이트 index.html·assets/style.css·assets/site.js·lecpage.json
 * @returns {(step: { name: string, batch?: string[] }) => string}
 */
export function demoAnswers({ html, css, js = '', meta = {} }) {
  const main = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html);
  const found = extractSections(main ? main[1] : html);
  const slug = (s, i) => (/class="([\w-]+)/.exec(s.html.slice(0, 200)) || [])[1] || `s${i + 1}`;
  const sections = found.map((s, i) => {
    const id = s.id || slug(s, i);
    const fx = (/data-fx-text="([^"]*)"/.exec(s.html.slice(0, 400)) || [])[1] || '';
    return { id, title: s.title || headingOf(s.html) || fx || id, html: s.id ? s.html : s.html.replace(/<section\b/i, `<section id="${id}"`) };
  });
  const plan = () => {
    const { v, ...m } = meta;
    return '```json\n' + JSON.stringify({ ...m, summary: m.description || m.subtitle || '', sections: sections.map((s) => ({ id: s.id, title: s.title, purpose: s.title })) }, null, 1) + '\n```';
  };
  const design = () => {
    let shell = html;
    if (main && found.length) {
      const inner = main[1];
      const first = inner.indexOf(found[0].html); const last = inner.lastIndexOf(found[found.length - 1].html) + found[found.length - 1].html.length;
      shell = html.replace(inner, () => (first >= 0 && last > first ? inner.slice(0, first) + SECTIONS_MARK + inner.slice(last) : inner + SECTIONS_MARK));
    }
    // 사이트 스크립트는 틀 안에(조립이 assets/site.js로 옮김)
    if (js) shell = shell.replace(/<script src="assets\/site\.js"[^>]*><\/script>/i, () => `<script>\n${js}\n</script>`);
    return '```css\n' + css + '\n```\n\n```html\n' + shell + '\n```';
  };
  const batch = (ids) => '```html\n' + ids.map((id) => sections.find((s) => s.id === id)?.html || '').filter(Boolean).join('\n\n') + '\n```';
  return (step = {}) => (step.name === 'plan' ? plan() : step.name === 'design' ? design() : String(step.name || '').startsWith('sections:') ? batch(step.batch || []) : '');
}
