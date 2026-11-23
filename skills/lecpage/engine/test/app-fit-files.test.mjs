// 앱이 lecpage 커넥트로 교재를 보낼 때(app/src/lib/gen/local.js fitFilesInfo·bridgeFiles): 한도에 맞추느라 원본을 빼고 같은 이름의 PDF만 보내면
// 말없이 빼지 않고 무엇을 뺐는지 돌려주고(강사 안내), PDF에 없는 발표자 노트는 글 파일로 함께 보냄. 커넥트는 그 글 파일을 교재로 받음(validateJob).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateJob, materialItems } from '../../scripts/studio.mjs';

const MiB = 1048576;
async function local() {
  const BC = globalThis.BroadcastChannel; globalThis.BroadcastChannel = undefined; // 앱 저장소 모듈이 여는 채널(시험이 끝나지 않음)을 막음
  try { return await import('../../../../app/src/lib/gen/local.js'); } finally { globalThis.BroadcastChannel = BC; }
}
const item = (name, mb) => ({ name, type: 'application/octet-stream', v: { size: mb * MiB } });

test('fitFilesInfo: 넘치지 않으면 그대로 · 넘치면 같은 이름의 PDF가 있는 원본을 큰 것부터 빼고 그 이름을 돌려줌 · fitFiles는 예전과 같은 값', async () => {
  const L = await local();
  const small = [item('강의.pptx', 30), item('강의.pdf', 20), item('안내.docx', 1)];
  assert.deepEqual(L.fitFilesInfo(small), { keep: small, dropped: [] });
  const big = [item('강의.pptx', 90), item('강의.pdf', 20), item('실습.pptx', 50), item('실습.pdf', 10), item('안내.docx', 1)];
  const r = L.fitFilesInfo(big);
  assert.deepEqual(r.dropped, ['강의.pptx'], '합계 120MB를 넘어 가장 큰 원본을 뺌(같은 이름의 PDF가 감)');
  assert.deepEqual(r.keep.map((x) => x.name), ['강의.pdf', '실습.pptx', '실습.pdf', '안내.docx']);
  assert.deepEqual(L.fitFiles(big).map((x) => x.name), r.keep.map((x) => x.name));
  // 파일 하나가 100MB를 넘는 원본도 PDF 짝이 있으면 빼고 보냄
  assert.deepEqual(L.fitFilesInfo([item('큰.pptx', 101), item('큰.pdf', 30)]).dropped, ['큰.pptx']);
  // PDF 짝이 없는 큰 파일·합계 초과는 지금처럼 보내기 전에 알림
  assert.throws(() => L.fitFilesInfo([item('큰.pptx', 101)]), (e) => e.kind === 'too-big' || /100MB/.test(e.message));
  assert.throws(() => L.fitFilesInfo([item('a.pptx', 70), item('b.pptx', 70)]), /120MB/);
});

test('bridgeFiles: 뺀 원본의 이름을 돌려주고(dropped) 발표자 노트는 같은 이름의 글 파일로 함께 보냄 · 커넥트가 그 글 파일을 교재로 받고 개수는 그대로', async () => {
  const L = await local();
  const store = new Map([['src/강의.pptx', new Uint8Array(3 * MiB)], ['src/강의.pdf', new Uint8Array(MiB)], ['src/안내.docx', new Uint8Array(10)]]);
  const blobs = { get: async (pid, k) => store.get(k) || null, keys: async () => [...store.keys()] };
  const project = { files: [{ name: '강의.pptx', key: 'src/강의.pptx', ext: 'pptx' }, { name: '강의.pdf', key: 'src/강의.pdf', ext: 'pdf' }, { name: '안내.docx', key: 'src/안내.docx', ext: 'docx' }] };
  const notes = (name) => (name === '강의.pptx' ? '- 강의.pptx 3쪽 발표자 노트: 여기서 5분 쉬어요' : '');
  // 넘치지 않으면 예전과 같음
  const all = await L.bridgeFiles(blobs, 'p', project, null, null, notes);
  assert.deepEqual(all.map((f) => f.name), ['강의.pptx', '강의.pdf', '안내.docx']); assert.deepEqual(all.dropped, []); assert.deepEqual(all.notesSent, []);
  // 합계 한도 3MB(시험용): 원본을 빼고 PDF + 발표자 노트 글
  const lim = { files: 20, materialMB: 3, fileMB: 100, twinPdf: true };
  const out = await L.bridgeFiles(blobs, 'p', project, lim, null, notes);
  assert.deepEqual(out.map((f) => f.name), ['강의.pdf', '안내.docx', '강의.md']);
  assert.deepEqual(out.dropped, ['강의.pptx']); assert.deepEqual(out.notesSent, ['강의.pptx']);
  const md = Buffer.from(out.at(-1).base64, 'base64').toString('utf8');
  assert.match(md, /^# 강의\.pptx의 발표자 노트/); assert.match(md, /같은 내용의 강의\.pdf로 보냈어요/); assert.match(md, /3쪽 발표자 노트: 여기서 5분 쉬어요/);
  assert.equal(JSON.parse(JSON.stringify(out)).dropped, undefined, '보내는 본문에는 섞이지 않음');
  // 커넥트가 받음: 글 파일도 교재, 같은 이름이라 개수는 둘(강의·안내)
  const job = await validateJob({ agent: 'claude', kind: 'make', request: '', files: JSON.parse(JSON.stringify(out)) });
  assert.equal(job.error, undefined, job.error);
  assert.deepEqual(job.materials.map((m) => m.name), ['강의.pdf', '안내.docx', '강의.md']);
  assert.equal(materialItems(job.materials.map((m) => m.name)), 2);
  // 발표자 노트가 없으면 글 파일 없이 이름만 · notesOf를 주지 않으면(예전 호출) 예전과 같은 값 + dropped
  const none = await L.bridgeFiles(blobs, 'p', project, lim, null, () => '');
  assert.deepEqual(none.map((f) => f.name), ['강의.pdf', '안내.docx']); assert.deepEqual(none.dropped, ['강의.pptx']); assert.deepEqual(none.notesSent, []);
  assert.deepEqual((await L.bridgeFiles(blobs, 'p', project, lim)).map((f) => f.name), ['강의.pdf', '안내.docx']);
  // 강사가 같은 이름의 글 파일을 이미 넣었으면 덮지 않음
  store.set('src/강의.md', new Uint8Array(5));
  const own = await L.bridgeFiles(blobs, 'p', { files: [...project.files, { name: '강의.md', key: 'src/강의.md', ext: 'md' }] }, lim, null, notes);
  assert.equal(own.filter((f) => f.name === '강의.md').length, 1); assert.deepEqual(own.notesSent, []);
});
