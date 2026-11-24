// 앱이 lecpage 커넥트로 고치기(AI로 수정·검수에서 나온 것 고치기)를 보낼 때(app/src/lib/gen/local.js fitSiteForEdit·fitSiteImages·pagesUsed):
// 지금 사이트의 바이트 파일(저장소 'site/…') 전체가 커넥트의 사이트 한도(limits.siteMB)를 넘으면 교재 쪽 그림만 고르게 줄여 보냄.
// 예전에는 통째로 보내 커넥트가 크기로 거절했음(쪽 그림이 많은 교재로 만든 사이트는 커넥트로 고칠 수 없었음).
//  - 자료실 파일·사진과, 사이트 글이 가리키는 쪽 그림(경로·data-pages)은 꼭 보냄(빠지면 커넥트의 검수가 '그림이 사이트에 없어요'로 알려 AI가 그 자리를 지울 수 있음)
//  - 보내지 않은 쪽 그림은 저장소에 그대로(이 함수들은 읽기만 함) · 작업 지시(TASK.md)는 쪽 그림의 처음~끝 번호와 '그중 몇 장'을 그대로 알림
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateJob, taskText } from '../../scripts/studio.mjs';

const MiB = 1048576;
async function local() {
  const BC = globalThis.BroadcastChannel; globalThis.BroadcastChannel = undefined; // 앱 저장소 모듈이 여는 채널(시험이 끝나지 않음)을 막음
  try { return await import('../../../../app/src/lib/gen/local.js'); } finally { globalThis.BroadcastChannel = BC; }
}
const pad3 = (n) => String(n).padStart(3, '0');
/** 쪽 그림 n장(장당 kb) + 덧붙일 파일 → 저장소(읽기만 되는 가짜: 지우는 길이 없어, 지우려 하면 시험이 깨짐) */
function fake(n, kb, more = {}) {
  const m = new Map();
  for (let i = 1; i <= n; i++) m.set(`site/material/p-${pad3(i)}.webp`, new Uint8Array(kb * 1024));
  for (const [k, v] of Object.entries(more)) m.set(k, v);
  return { m, blobs: { get: async (pid, k) => m.get(k) || null, keys: async () => [...m.keys()] } };
}
const bytesOf = (m, only) => only.reduce((s, k) => s + m.get('site/' + k).length, 0);
const DECK = '<!doctype html><html><body><main><section id="a"><h1>제목</h1></section><section id="d"><div data-lp="deck"></div></section></main></body></html>';

test('pagesUsed: 사이트 글이 가리키는 교재 쪽(경로·교재 슬라이드의 data-pages), 경로를 코드로 만드는 사이트는 모든 쪽', async () => {
  const L = await local();
  const u = L.pagesUsed({ 'index.html': '<img src="material/p-005.webp" alt=""><a href="./material/p-012.png">크게</a>', 'assets/style.css': '.hero{background:url(../material/p-001.jpg)}', 'x.bin': new Uint8Array(3) });
  assert.deepEqual([...u.nums].sort((a, b) => a - b), [1, 5, 12]); assert.equal(u.all, false);
  const d = L.pagesUsed({ 'index.html': '<div data-lp="deck" data-pages="1-3, 7"></div><div data-lp=\'deck\' data-pages=\'20~21\'></div>' });
  assert.deepEqual([...d.nums].sort((a, b) => a - b), [1, 2, 3, 7, 20, 21]);
  assert.equal(L.pagesUsed({ 'index.html': DECK }).nums.size, 0, '쪽을 고르지 않은 교재 슬라이드는 가리키는 쪽이 없음(놓인 쪽을 모두 보여 줌)');
  assert.equal(L.pagesUsed({ 'assets/site.js': "img.src = 'material/p-' + String(n).padStart(3, '0') + '.webp';" }).all, true);
  assert.equal(L.pagesUsed({ 'assets/site.js': 'img.src = `material/p-${id}.webp`;' }).all, true);
  assert.equal(L.pagesUsed({ 'index.html': '<!-- 쪽 그림은 material/p-001.webp ~ material/p-013.webp -->' }).all, false);
});

test('fitSiteImages(새로 만들 때): 한도 안이면 전부, 넘으면 고르게 줄이고 처음·끝 쪽은 남김(예전과 같음)', async () => {
  const L = await local();
  const { blobs } = fake(100, 100);
  const list = Array.from({ length: 100 }, (_, i) => `material/p-${pad3(i + 1)}.webp`);
  const all = await L.fitSiteImages(blobs, 'p', list, [], null, { siteMB: 40 });
  assert.equal(all.cut, false); assert.equal(all.list.length, 100); assert.equal(all.last, 100);
  const cut = await L.fitSiteImages(blobs, 'p', list, [{ name: 'a.pdf', first: 1, count: 100 }], null, { siteMB: 5 }); // 4MiB까지: 100KB짜리 40장쯤
  assert.equal(cut.cut, true); assert.equal(cut.total, 100); assert.equal(cut.last, 100, '마지막 쪽 번호(커넥트에 알림: 배포한 사이트에는 여기까지 모두 있음)');
  assert.ok(cut.list.length >= 30 && cut.list.length <= 40, String(cut.list.length));
  assert.ok(cut.list.includes('material/p-001.webp') && cut.list.includes('material/p-100.webp'), '처음·끝 쪽은 감(작업 지시의 쪽 범위가 그대로)');
});

test('fitSiteForEdit: 한도 안이면 전부(only 없음), 넘으면 자료·사진·사이트가 가리키는 쪽 그림은 꼭 보내고 나머지 쪽 그림만 줄임 · 저장소는 그대로', async () => {
  const L = await local();
  const more = { 'site/files/활동지 (2).pdf': new Uint8Array(500 * 1024), 'site/assets/img/photo-ab12cd.png': new Uint8Array(100 * 1024) };
  const { m, blobs } = fake(100, 100, more);
  const before = [...m.keys()].sort();
  const site = { 'index.html': DECK.replace('<h1>제목</h1>', '<h1>제목</h1><img src="material/p-050.webp" alt="50쪽"><img src="material/p-051.webp" alt="51쪽">') };
  const sets = [{ name: 'a.pdf', first: 1, count: 60 }, { name: 'b.pptx', first: 61, count: 40 }];
  // 넉넉한 커넥트(200MB): 예전처럼 전부
  assert.deepEqual(await L.fitSiteForEdit(blobs, 'p', site, sets, { siteMB: 200 }), { only: null, total: 100, sent: 100, over: false, mb: 0, last: 100 });
  // 좁은 커넥트(5MB → 4MiB까지): 쪽 그림만 줄임
  const fit = await L.fitSiteForEdit(blobs, 'p', site, sets, { siteMB: 5 });
  assert.equal(fit.over, false); assert.equal(fit.total, 100); assert.ok(fit.sent < 100 && fit.sent >= 25, String(fit.sent));
  assert.ok(fit.only.includes('files/활동지 (2).pdf') && fit.only.includes('assets/img/photo-ab12cd.png'), '자료실 파일·사진은 꼭 감');
  assert.ok(fit.only.includes('material/p-050.webp') && fit.only.includes('material/p-051.webp'), '사이트 글이 가리키는 쪽 그림은 꼭 감');
  assert.ok(fit.only.includes('material/p-001.webp') && fit.only.includes('material/p-100.webp'), '처음·끝 쪽도 감');
  assert.ok(fit.only.some((k) => /p-0(6[1-9]|[7-9]\d)\.webp$/.test(k)) && fit.only.some((k) => /p-0[0-5]\d\.webp$/.test(k)), '두 교재에서 고르게');
  assert.ok(bytesOf(m, fit.only) <= 4 * MiB, `${bytesOf(m, fit.only)}바이트가 커넥트 한도(4MiB) 안`);
  assert.equal(fit.only.filter((k) => k.startsWith('material/')).length, fit.sent);
  // 보낼 본문(bridgeSite)은 고른 것만, 커넥트가 받음(고치기는 지금 사이트의 index.html과 함께)
  const payload = await L.bridgeSite(blobs, 'p', fit.only);
  assert.deepEqual(Object.keys(payload).sort(), [...fit.only].sort());
  const job = await validateJob({ agent: 'claude', kind: 'edit', request: '제목을 짧게', site: { ...payload, ...site } });
  assert.equal(job.error, undefined, job.error);
  assert.equal(Object.keys(job.site).filter((k) => k.startsWith('material/')).length, fit.sent);
  // 저장소는 그대로: 보내지 않은 쪽 그림도 연수에 남아 있음(고친 사이트의 교재 슬라이드에는 모든 쪽)
  assert.deepEqual([...m.keys()].sort(), before);
  assert.equal([...m.keys()].filter((k) => k.startsWith('site/material/')).length, 100);
});

test('fitSiteForEdit: 사이트가 쪽을 모두 가리키면(data-pages로 전부 고름·경로를 코드로 만듦) 줄이지 않고 over로 알림(보내기 전에 까닭을 말함)', async () => {
  const L = await local();
  const { blobs } = fake(100, 100);
  const picked = await L.fitSiteForEdit(blobs, 'p', { 'index.html': '<div data-lp="deck" data-pages="1-100"></div>' }, [], { siteMB: 5 });
  assert.equal(picked.over, true); assert.equal(picked.sent, 100); assert.ok(picked.mb >= 9 && picked.mb <= 11, String(picked.mb));
  const dyn = await L.fitSiteForEdit(blobs, 'p', { 'index.html': DECK, 'assets/site.js': "x.src = 'material/p-' + n + '.webp'" }, [], { siteMB: 5 });
  assert.equal(dyn.over, true);
  // 일부만 고른 교재 슬라이드: 그 쪽들은 꼭 보내고 나머지에서 줄임
  const some = await L.fitSiteForEdit(blobs, 'p', { 'index.html': '<div data-lp="deck" data-pages="1-20"></div>' }, [], { siteMB: 5 });
  assert.equal(some.over, false);
  for (let n = 1; n <= 20; n++) assert.ok(some.only.includes(`material/p-${pad3(n)}.webp`), `p-${pad3(n)}`);
  // 쪽 그림이 없는 사이트·예전 커넥트(siteMB를 알려 주지 않음 → 40MB): 예전 그대로
  const none = fake(0, 0, { 'site/files/a.pdf': new Uint8Array(1000) });
  assert.deepEqual(await L.fitSiteForEdit(none.blobs, 'p', { 'index.html': DECK }, [], null), { only: null, total: 0, sent: 0, over: false, mb: 0, last: 0 });
  const old = await L.fitSiteForEdit(fake(500, 100).blobs, 'p', { 'index.html': DECK }, [], { materialMB: 120 }); // 약 49MiB → 39MiB까지
  assert.equal(old.over, false); assert.ok(old.sent < 500 && old.sent > 300, String(old.sent));
});

test('작업 지시(고치기): 쪽 그림의 처음~끝 번호와 폴더에 있는 장수를 그대로 알림(AI가 빠진 번호의 쪽이 없다고 여기지 않게)', () => {
  const task = taskText({ kind: 'edit', materials: ['a.pdf'], pageImages: { first: 1, last: 100, count: 37, exts: ['webp'], sample: 'p-001.webp' }, request: '제목을 짧게' });
  assert.match(task, /교재 쪽 그림: `work\/site\/material\/` \(p-001 ~ p-100, 그중 37장, \.webp\)/);
  assert.doesNotMatch(taskText({ kind: 'edit', materials: ['a.pdf'], pageImages: { first: 1, last: 100, count: 100, exts: ['webp'], sample: 'p-001.webp' }, request: '' }), /그중/);
});

// 실제 AI 300쪽 사이트(2026-11-24): '그중 78장'만 보고 AI가 사이트에 "바로 열리는 쪽 78장"이라 적고 나머지 222쪽을 흐리게 함(실제로는 300쪽이 모두 배포됨).
// 앱이 골라 보냈을 때는 배포한 사이트에 모든 쪽이 들어간다는 사실을 그대로 한 줄(kept: 마지막 쪽 번호 — 앱이 pagesKept로 보냄)
test('작업 지시: 앱이 쪽 그림을 골라 보냈으면 "배포한 사이트에는 모든 쪽 그림이 들어가요"를 알림(받지 않았다고 사이트에 없는 것이 아님)', () => {
  const pi = { first: 1, last: 300, count: 78, exts: ['webp'], sample: 'p-001.webp' };
  for (const kind of ['make', 'edit']) {
    const t = taskText({ kind, materials: ['big.pdf'], pageImages: pi, request: '', kept: 300 });
    assert.match(t, /p-001 ~ p-300, 그중 78장, \.webp\).*크기 때문에 여기에는 78장만 받았고, 배포한 사이트에는 p-001~p-300 모든 쪽 그림이 들어가요\n/, kind);
  }
  // 알림이 없으면(예전 앱·정말 그림이 없는 쪽) 전과 같은 줄, 모두 받았으면 덧붙이지 않음
  assert.doesNotMatch(taskText({ kind: 'make', materials: ['big.pdf'], pageImages: pi, request: '' }), /배포한 사이트에는/);
  assert.doesNotMatch(taskText({ kind: 'make', materials: ['big.pdf'], pageImages: { ...pi, count: 300 }, request: '', kept: 300 }), /배포한 사이트에는|그중/);
});


// 실제 AI 300쪽 사이트(2026-11-24 밤): 새 안내를 받은 AI가 교재 슬라이드를 data-pages="1-300"으로 적자, 메모리 적은 PC(40MB)에서는
// AI 수정이 '꼭 함께 보내야 하는 사이트 파일이 142MB'로 거절됐음(모든 쪽을 가리키면 줄이지 않던 규칙). 커넥트가 받지 않은 번호에 빈 자리 그림을 두게 되어(caps 'pages-kept')
// 그런 사이트도 골라 보냄 — 그림 주소로 하나하나 적힌 쪽만 꼭 보냄. 예전 커넥트는 전과 같이 알리고 멈춤
test('fitSiteForEdit(loose): 사이트가 모든 쪽을 범위·코드로 가리켜도 골라 보내고, 그림 주소로 적힌 쪽은 꼭 보냄 — 예전 커넥트는 그대로 over', async () => {
  const L = await local();
  const { blobs } = fake(100, 100, { 'site/files/a.pdf': new Uint8Array(1024) });
  const site = { 'index.html': '<div data-lp="deck" data-pages="1-100"></div><img src="material/p-042.webp" alt="">', 'assets/site.js': "img.src = 'material/p-' + pad(n) + '.webp';" };
  const used = L.pagesUsed(site);
  assert.equal(used.all, true); assert.equal(used.nums.size, 100); assert.deepEqual([...used.direct], [42]);
  const old = await L.fitSiteForEdit(blobs, 'p', site, [], { siteMB: 5 });
  assert.equal(old.over, true, '예전 커넥트: 모든 쪽을 가리키면 줄이지 않고 알림');
  const loose = await L.fitSiteForEdit(blobs, 'p', site, [], { siteMB: 5 }, { loose: true });
  assert.equal(loose.over, false); assert.equal(loose.total, 100); assert.equal(loose.last, 100);
  assert.ok(loose.sent < 100 && loose.sent >= 25, String(loose.sent));
  assert.ok(loose.only.includes('material/p-042.webp') && loose.only.includes('files/a.pdf'), '그림 주소로 적힌 쪽·자료실 파일은 꼭 감');
  assert.ok(loose.only.includes('material/p-001.webp') && loose.only.includes('material/p-100.webp'), '처음·끝 쪽도 감');
});

// 독립 검토(2026-11-24 밤): loose가 '모든 쪽을 가리키는 큰 사이트'뿐 아니라 모든 사이트에 적용돼, 교재 슬라이드가 고른 몇 쪽(data-pages="12, 40, 77")이
// 꼭 보낼 쪽에서 빠지고 빈 자리 그림으로 갔음 → 전과 같은 규칙을 먼저 쓰고, 그것만으로 한도를 넘을 때만 느슨하게
test('fitSiteForEdit(loose): 교재 슬라이드가 고른 쪽은 그대로 꼭 보냄 — 느슨한 규칙은 전 규칙이 한도를 넘을 때만', async () => {
  const L = await local();
  const { blobs } = fake(300, 480);
  const site = { 'index.html': '<div data-lp="deck" data-pages="12, 40, 77, 133, 201"></div><img src="material/p-012.webp" alt="">' };
  for (const loose of [false, true]) {
    const fit = await L.fitSiteForEdit(blobs, 'p', site, [], { siteMB: 40 }, { loose });
    assert.equal(fit.over, false);
    for (const n of ['012', '040', '077', '133', '201']) assert.ok(fit.only.includes(`material/p-${n}.webp`), `loose=${loose}: 교재 슬라이드가 고른 ${n}쪽이 감`);
  }
});
