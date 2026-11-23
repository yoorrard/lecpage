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
  assert.deepEqual(L.fitFilesInfo(small), { keep: small, dropped: [], asText: [] });
  const big = [item('강의.pptx', 90), item('강의.pdf', 20), item('실습.pptx', 50), item('실습.pdf', 10), item('안내.docx', 1)];
  const r = L.fitFilesInfo(big);
  assert.deepEqual(r.dropped, ['강의.pptx'], '합계 120MB를 넘어 가장 큰 원본을 뺌(같은 이름의 PDF가 감)');
  assert.deepEqual(r.keep.map((x) => x.name), ['강의.pdf', '실습.pptx', '실습.pdf', '안내.docx']);
  assert.deepEqual(L.fitFiles(big).map((x) => x.name), r.keep.map((x) => x.name));
  // 파일 하나가 100MB를 넘는 원본도 PDF 짝이 있으면 빼고 보냄
  assert.deepEqual(L.fitFilesInfo([item('큰.pptx', 101), item('큰.pdf', 30)]).dropped, ['큰.pptx']);
  // PDF 짝이 없는 큰 파일·합계 초과: 오류로 멈추지 않고 그 교재를 '글·쪽 그림으로 보낼 것'(asText)으로 돌려줌(큰 것부터)
  const one = L.fitFilesInfo([item('큰.pptx', 101), item('안내.docx', 1)]);
  assert.deepEqual(one.keep.map((x) => x.name), ['안내.docx']); assert.deepEqual(one.dropped, []); assert.deepEqual(one.asText, [{ name: '큰.pptx', size: 101 * MiB }]);
  // 합계 초과: 원본을 되도록 많이 보내게, 큰 것부터 들어가는 만큼 두고 들어가지 않는 것만 글로
  const two = L.fitFilesInfo([item('a.pptx', 70), item('b.pptx', 60)]);
  assert.deepEqual(two.keep.map((x) => x.name), ['a.pptx']); assert.deepEqual(two.asText.map((x) => x.name), ['b.pptx'], '합계 120MB: 70MB는 가고 60MB만 글로');
  const big90 = L.fitFilesInfo([item('A.pdf', 90), item('B.pdf', 40)]);
  assert.deepEqual(big90.keep.map((x) => x.name), ['A.pdf'], '90MB 원본은 그대로 감(예전에는 큰 것부터 빼서 40MB만 갔음)'); assert.deepEqual(big90.asText.map((x) => x.name), ['B.pdf']);
  const three = L.fitFilesInfo([item('a.pdf', 50), item('b.pdf', 50), item('c.pdf', 50)]);
  assert.deepEqual(three.keep.map((x) => x.name), ['a.pdf', 'b.pdf']); assert.deepEqual(three.asText.map((x) => x.name), ['c.pdf']);
  // 큰 것이 못 들어가도 뒤의 작은 것은 들어감(넣은 순서는 그대로)
  const mix = L.fitFilesInfo([item('s.pdf', 10), item('x.pdf', 80), item('y.pdf', 70), item('z.pdf', 25)]);
  assert.deepEqual(mix.keep.map((x) => x.name), ['s.pdf', 'x.pdf', 'z.pdf']); assert.deepEqual(mix.asText.map((x) => x.name), ['y.pdf']);
  // 원본도 같은 이름의 PDF도 큰 교재: 교재 하나로(원본 이름), dropped에는 넣지 않음(PDF가 가지 않으므로)
  const both = L.fitFilesInfo([item('큰.pptx', 300), item('큰.pdf', 150), item('안내.docx', 1)]);
  assert.deepEqual(both.keep.map((x) => x.name), ['안내.docx']); assert.deepEqual(both.dropped, []); assert.deepEqual(both.asText.map((x) => x.name), ['큰.pptx']);
  // 개수 한도는 지금처럼 보내기 전에 알림
  assert.throws(() => L.fitFilesInfo(Array.from({ length: 21 }, (_, i) => item(`m${i}.pdf`, 1)), { files: 20, twinPdf: true }), /20개/);
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

test('bridgeFiles: 원본이 커넥트 한도를 넘고 같은 이름의 PDF도 없는 교재 → 멈추지 않고 앱이 뽑은 글(.md)과 쪽 그림 표시로 보냄 · 커넥트가 받음', async () => {
  const L = await local();
  const store = new Map([['src/큰.pptx', new Uint8Array(3 * MiB)], ['src/안내.docx', new Uint8Array(10)]]);
  const blobs = { get: async (pid, k) => store.get(k) || null, keys: async () => [...store.keys()] };
  const project = { files: [{ name: '큰.pptx', key: 'src/큰.pptx', ext: 'pptx' }, { name: '안내.docx', key: 'src/안내.docx', ext: 'docx' }] };
  const lim = { files: 20, materialMB: 120, fileMB: 2, twinPdf: true }; // 파일 하나 2MB(시험용)
  const sets = [{ name: '큰.pptx', first: 1, count: 30 }];
  const textOf = (name) => (name === '큰.pptx' ? '## 1쪽\n첫 쪽 글\n\n- 큰.pptx 3쪽 발표자 노트: 쉬어요' : '');
  const out = await L.bridgeFiles(blobs, 'p', project, lim, sets, null, textOf);
  assert.deepEqual(out.map((f) => f.name), ['큰.md', '안내.docx'].sort((a, b) => out.findIndex((f) => f.name === a) - out.findIndex((f) => f.name === b)));
  assert.deepEqual(out.asText, ['큰.pptx']); assert.deepEqual(out.dropped, []);
  assert.deepEqual(out.asTextOnly, [], '이 교재의 쪽 그림이 함께 감');
  // 쪽 그림 묶음이 없는 교재(글자만 읽음): 글만 간다고 따로 알림(강사 안내가 '쪽 그림과'라고 하지 않게)
  const only = await L.bridgeFiles(blobs, 'p', project, lim, [], null, textOf);
  assert.deepEqual(only.asText, ['큰.pptx']); assert.deepEqual(only.asTextOnly, ['큰.pptx']);
  assert.doesNotMatch(Buffer.from(only.find((f) => f.name === '큰.md').base64, 'base64').toString('utf8'), /쪽 그림\(work/);
  const mdFile = out.find((f) => f.name === '큰.md');
  assert.equal(mdFile.pageImages, true, '쪽 그림 표시는 그 글 파일에(교재 하나의 것)');
  const md = Buffer.from(mdFile.base64, 'base64').toString('utf8');
  assert.match(md, /^# 큰\.pptx\n/); assert.match(md, /원본 큰\.pptx 파일이 커서\(3MB\) 원본 대신 쪽 그림\(work\/site\/material\/\)과 코드가 뽑은 글을 보냈어요/); assert.match(md, /첫 쪽 글/); assert.match(md, /3쪽 발표자 노트: 쉬어요/);
  const job = await validateJob({ agent: 'claude', kind: 'make', request: '', files: JSON.parse(JSON.stringify(out)) });
  assert.equal(job.error, undefined, job.error);
  assert.equal(job.materials.find((m) => m.name === '큰.md').pageImages, true);
  // 교재가 여럿이고 묶음도 여럿이면 { first, count }
  const sets2 = [{ name: '큰.pptx', first: 1, count: 30 }, { name: '안내.docx', first: 31, count: 2 }];
  const out2 = await L.bridgeFiles(blobs, 'p', project, lim, sets2, null, textOf);
  assert.deepEqual(out2.find((f) => f.name === '큰.md').pageImages, { first: 1, count: 30 });
  // 글도 쪽 그림도 없는 교재만 보내기 전에 알림(보낼 것이 없음)
  await assert.rejects(() => L.bridgeFiles(blobs, 'p', project, lim, [], null, () => ''), (e) => /큰\.pptx/.test(e.message) && /보낼 수 없어요/.test(e.message));
  // 쪽 그림만 있어도(글을 못 뽑은 스캔본) 보냄
  const img = await L.bridgeFiles(blobs, 'p', project, lim, sets, null, () => '');
  assert.match(Buffer.from(img.find((f) => f.name === '큰.md').base64, 'base64').toString('utf8'), /쪽 그림\(work\/site\/material\/\)과/);
});

test('bridgeFiles: 원본 대신 보내는 글 — 같은 이름의 .md 교재와 겹치지 않고, 원본 이름(standsFor)을 알리며, 글 크기도 합계에 넣음 · 작업 지시는 사실대로', async () => {
  const L = await local();
  const { taskText } = await import('../../scripts/studio.mjs');
  // ① 같은 줄기의 .md 교재가 이미 있음 → '(뽑은 글)'을 붙임
  const store = new Map([['src/큰.pptx', new Uint8Array(3 * MiB)], ['src/큰.md', new Uint8Array(10)]]);
  const blobs = { get: async (pid, k) => store.get(k) || null, keys: async () => [...store.keys()] };
  const project = { files: [{ name: '큰.pptx', key: 'src/큰.pptx', ext: 'pptx' }, { name: '큰.md', key: 'src/큰.md', ext: 'md' }] };
  const lim = { files: 20, materialMB: 120, fileMB: 2, twinPdf: true };
  const out = await L.bridgeFiles(blobs, 'p', project, lim, [{ name: '큰.pptx', first: 1, count: 5 }], null, () => '글');
  const names = out.map((f) => f.name);
  assert.equal(new Set(names.map((n) => n.toLowerCase())).size, names.length, '이름이 겹치지 않음: ' + names.join(', '));
  const stand = out.find((f) => f.standsFor);
  assert.equal(stand.name, '큰 (뽑은 글).md'); assert.equal(stand.standsFor, '큰.pptx'); assert.equal(stand.pageImages, true);
  assert.ok(names.includes('큰.md'), '강사가 넣은 큰.md는 그대로 감');
  // 커넥트가 받고(validateJob), 작업 지시에는 교재 원본이 아니라 '원본 대신 받은 글'로 적힘
  const job = await validateJob({ agent: 'claude', kind: 'make', request: '', files: JSON.parse(JSON.stringify(out)) });
  assert.equal(job.error, undefined, job.error);
  const m = job.materials.find((x) => x.standsFor);
  assert.equal(m.standsFor, '큰.pptx');
  const task = taskText({ kind: 'make', materials: job.materials.map((x) => x.name), standIns: job.materials.filter((x) => x.standsFor).map((x) => ({ name: x.name, for: x.standsFor })), images: 5, pages: 5 });
  const orig = task.split('\n').find((l) => l.startsWith('- 교재 원본:')) || '';
  assert.match(orig, /material\/큰\.md/); assert.doesNotMatch(orig, /뽑은 글/, '대신 보낸 글은 교재 원본 줄에 없음');
  assert.match(task, /- 원본 대신 받은 글: `material\/큰 \(뽑은 글\)\.md`\(원본 `큰\.pptx`는 커서 받지 못했어요\)/);
  // standsFor가 없는 예전 앱의 요청은 예전 그대로(따로 적는 줄 없음)
  assert.doesNotMatch(taskText({ kind: 'make', materials: ['a.pdf'], images: 1, pages: 1 }), /원본 대신 받은 글/);
  // ② 글 크기도 합계에: 남은 교재가 합계 한도에 바짝 붙어 있으면 큰 것부터 글로 바꿔 한도 안에 들게 함(커넥트가 합계로 거절하지 않게)
  const store2 = new Map([['src/a.pptx', new Uint8Array(3 * MiB)], ['src/b.docx', new Uint8Array(1 * MiB + 900 * 1024)], ['src/c.docx', new Uint8Array(100)]]);
  const blobs2 = { get: async (pid, k) => store2.get(k) || null, keys: async () => [...store2.keys()] };
  const project2 = { files: [{ name: 'a.pptx', key: 'src/a.pptx', ext: 'pptx' }, { name: 'b.docx', key: 'src/b.docx', ext: 'docx' }, { name: 'c.docx', key: 'src/c.docx', ext: 'docx' }] };
  const lim2 = { files: 20, materialMB: 2, fileMB: 2, twinPdf: true }; // 합계 2MB(시험용): a는 파일 한도로 글이 되고, 그 글(300KB)과 b(1.9MB)를 더하면 2MB를 넘음
  const out2 = await L.bridgeFiles(blobs2, 'p', project2, lim2, [], null, (name) => (name === 'a.pptx' ? '가'.repeat(100 * 1024) : '나'.repeat(1000)));
  const total = out2.reduce((n, f) => n + Buffer.from(f.base64, 'base64').length, 0);
  assert.ok(total <= 2 * MiB, `합계 ${total}바이트가 한도 안`);
  assert.deepEqual(out2.asText.sort(), ['a.pptx', 'b.docx']); assert.ok(out2.some((f) => f.name === 'c.docx'));
  const job2 = await validateJob({ agent: 'claude', kind: 'make', request: '', files: JSON.parse(JSON.stringify(out2)) }, { ...lim2 }).catch(() => null);
  if (job2) assert.equal(job2.error, undefined, job2.error);
});
