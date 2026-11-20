// 가짜 생성 API(lib/gen/mock.js)와 먼저 해보기 녹화(data/demo-run.js)가 돌려주는 'AI가 만든 사이트'.
// kit 작업자가 AI 에이전트 방식(Skill)으로 만든 서로 다른 두 사이트(교재: 엔진 시험용 workshop.pdf, 13쪽)를 그대로 씀.
//   mag: 잡지형(밝은 바탕·명조 제목) · lab: 실습실형(어두운 바탕·형광 강조)
// 교재 쪽 그림(material/p-NNN.webp)은 넣은 교재에서 앱이 만든 것을 씀. 레퍼런스 사이트·진짜 생성이 오면 이 파일은 지움.
import magHtml from './fixtures/mag/index.html?raw';
import magCss from './fixtures/mag/style.css?raw';
import magMeta from './fixtures/mag/lecpage.json';
import labHtml from './fixtures/lab/index.html?raw';
import labMeta from './fixtures/lab/lecpage.json';
import labGrid from './fixtures/lab/grid.webp?url';

export const MOCK_KINDS = ['mag', 'lab'];

/** @returns {Promise<{ site: Record<string, string|Uint8Array>, meta: object }>} meta는 AI 답 그대로(강사 칸이 섞여 있을 수 있음: 조립·readMeta가 버림) */
export async function mockSite(kind = 'mag') {
  if (kind === 'lab') {
    const grid = await fetch(labGrid).then((r) => r.arrayBuffer()).then((b) => new Uint8Array(b)).catch(() => null);
    return { site: { 'index.html': labHtml, ...(grid ? { 'assets/img/grid.webp': grid } : {}) }, meta: JSON.parse(JSON.stringify(labMeta)) };
  }
  return { site: { 'index.html': magHtml, 'assets/style.css': magCss }, meta: JSON.parse(JSON.stringify(magMeta)) };
}
