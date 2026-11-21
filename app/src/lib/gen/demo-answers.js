// 완성된 사이트 한 벌(레퍼런스) → 생성 파이프라인 단계의 'AI 답'(build: 사이트 전체를 파일마다 코드 블록으로 + 끝의 연수 정보).
// 키 길의 한 번 요청이 받는 꼴(prompts.js FORMAT, parse.js parseSiteAnswer)과 같아요: 여는 줄에 경로, 맨 끝에 ```lecpage.json.
// 먼저 해보기(data/demo-run.js)와 도움말 그림 찍기(scripts/help-shots.mjs)가 씀. 브라우저·Node 어디서나 도는 순수 함수.

/** 답에 넣는 순서: index.html → 다른 쪽(.html) → CSS → JS (AI가 보내는 순서와 같게) */
const rank = (p) => (p === 'index.html' ? 0 : /\.html?$/i.test(p) ? 1 : /\.css$/i.test(p) ? 2 : 3);

/**
 * @param {{ files?: Record<string, string>, html?: string, css?: string, js?: string, meta?: object }} ref
 *   files: 사이트의 글 파일({ 'index.html': …, 'lab.html': …, 'assets/style.css': … }). 없으면 html·css·js 셋으로
 * @returns {(step: { name: string }) => string}
 */
export function demoAnswers({ files, html, css, js = '', meta = {} }) {
  const list = files ? { ...files } : { 'index.html': html, 'assets/style.css': css, ...(js ? { 'assets/site.js': js } : {}) };
  const block = (path, body) => '```' + path + '\n' + String(body).replace(/\s+$/, '') + '\n```';
  const build = () => {
    const { v, ...m } = meta;
    const paths = Object.keys(list).filter((p) => /\.(html?|css|m?js)$/i.test(p) && list[p] != null).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
    return [...paths.map((p) => block(p, list[p])), block('lecpage.json', JSON.stringify(m, null, 1))].join('\n\n');
  };
  return (step = {}) => (step.name === 'build' ? build() : '');
}
