// 완성된 사이트 한 벌(레퍼런스) → 생성 파이프라인 단계의 'AI 답'(build: 사이트 전체를 파일마다 코드 블록으로 + 끝의 연수 정보).
// 도움말 그림 찍기(scripts/help-shots.mjs)가 씀. 먼저 해보기는 실제로 받은 답을 그대로 써요(data/demo-run.js). 브라우저·Node 어디서나 도는 순수 함수.

/**
 * @param {{ html: string, css: string, js?: string, meta: object }} ref  사이트 index.html·assets/style.css·assets/site.js·lecpage.json
 * @returns {(step: { name: string }) => string}
 */
export function demoAnswers({ html, css, js = '', meta = {} }) {
  const block = (path, body) => '```' + path + '\n' + String(body).replace(/\s+$/, '') + '\n```';
  const build = () => {
    const { v, ...m } = meta;
    return [block('index.html', html), block('assets/style.css', css), js ? block('assets/site.js', js) : '', block('lecpage.json', JSON.stringify(m, null, 1))].filter(Boolean).join('\n\n');
  };
  return (step = {}) => (step.name === 'build' ? build() : '');
}
