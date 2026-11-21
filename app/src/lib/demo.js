// 먼저 해보기: 별도 화면 없이 '같은 연수 화면'(Project)을 체험 연수로 엶. 체험 교재 PDF(data/demo/)가 미리 들어가 있고
// (교재 넣기 화면이 실제로 읽고 쪽 그림을 그림), AI 고르기에서 아무 길이나 누르면 진짜 생성 파이프라인이 way:'demo'로 돎
// (AI 답 자리만 이 교재로 실제로 받은 답: data/demo-run.js, 어디로도 보내지 않음). 그 밖의 화면은 실제와 같음.
// 체험 연수는 이 브라우저에 하나만 두고(p.demo), '내 연수' 목록에는 보이지 않음. 다시 체험하면 새로 만듦.
import { projects, blobs } from './db.js';
import { uid } from './util.js';
import { DEFAULT_INFO } from '@engine/src/project-file.js';
import { startGeneration, stopGeneration } from './studio.js';

/** 체험 연수를 새로 만들어 엶(예전 체험 연수는 지움) */
export async function openDemo() {
  const { DEMO_FILE } = await import('../data/demo-run.js');
  for (const p of await projects.all()) if (p.demo) { stopGeneration(p.id); await projects.remove(p.id).catch(() => { }); }
  const r = await fetch(DEMO_FILE.url); if (!r.ok) throw new Error('demo file');
  const bytes = new Uint8Array(await r.arrayBuffer());
  const id = uid(10); const key = 'src/demo.pdf';
  await blobs.put(id, key, bytes);
  await projects.put({ id, demo: true, title: '체험 연수', step: 1, stage: 1, createdAt: Date.now(), info: { ...DEFAULT_INFO }, deploy: {},
    files: [{ name: DEMO_FILE.name, key, size: bytes.length, ext: 'pdf', pages: 0, errors: [], pending: true }] });
  return id;
}

/** 체험 끝내기: 체험 연수를 지움 */
export async function endDemo(pid) { stopGeneration(pid); await projects.remove(pid).catch(() => { }); }

/** 체험 연수에서 AI 고르기의 어느 길을 눌러도: 같은 파이프라인을 미리 만든 답으로 */
export function startDemo(pid, { request = '' } = {}) { return startGeneration(pid, { way: 'demo', request }); }
