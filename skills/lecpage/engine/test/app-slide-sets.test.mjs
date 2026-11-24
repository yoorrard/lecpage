// 교재가 여럿일 때 교재마다 쪽 그림(이어 매긴 번호): 앱의 묶음 계산(app/src/lib/gen/slide-sets.js) · AI에게 알리는 줄(prompts.js) ·
// lecpage 커넥트로 넘기는 값(local.js bridgeFiles·fitSiteImages) · 커넥트의 미리 읽기가 묶음마다 쪽에 맞추는지(prepare, LECPAGE_GIVEN_IMAGES_SETS).
// 교재가 하나일 때는 예전과 같은 값·같은 글이어야 함.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as SS from '../../../../app/src/lib/gen/slide-sets.js';
import { buildMaterialPrompt } from '../../../../app/src/lib/gen/prompts.js';
import { taskText, CAPS } from '../../scripts/studio.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, '..', '..', 'scripts', 'lecpage.mjs');
const fx = (n) => join(HERE, 'fixtures', n);
const T = mkdtempSync(join(tmpdir(), 'lp-sets-'));
after(() => rmSync(T, { recursive: true, force: true }));
const pad3 = (n) => String(n).padStart(3, '0');
const paths = (from, to, ext = 'webp') => Array.from({ length: to - from + 1 }, (_, i) => `material/p-${pad3(from + i)}.${ext}`);

test('묶음: 예전 연수(slidesFrom·slidesMade)는 묶음 하나 · 이어 붙이기 · 교재 하나면 예전 칸과 같은 값', () => {
  assert.deepEqual(SS.slideSetsOf({ slidesFrom: '강의.pdf', slidesMade: 13 }), [{ name: '강의.pdf', first: 1, count: 13 }]);
  assert.deepEqual(SS.slideSetsOf({ slidesFrom: '', slidesMade: 0 }), []);
  assert.deepEqual(SS.slideSetsOf({}), []);
  // 새 연수는 slideSets를 믿음(예전 칸이 함께 있어도)
  const two = SS.addSet(SS.addSet([], '강의.pptx', 13), '안내.docx', 5);
  assert.deepEqual(two, [{ name: '강의.pptx', first: 1, count: 13 }, { name: '안내.docx', first: 14, count: 5 }]);
  assert.deepEqual(SS.slideSetsOf({ slideSets: two, slidesFrom: '옛.pdf', slidesMade: 3 }), two);
  assert.equal(SS.setsEnd(two), 18);
  assert.deepEqual(SS.addSet(two, '빈.pptx', 0), two, '그리지 못한 교재는 묶음을 만들지 않음');
  // 연수에 적는 칸: 하나면 예전과 같게, 여럿이면 slidesFrom은 비움(한 교재의 것이 아님)
  assert.deepEqual(SS.setsFields(SS.addSet([], '강의.pdf', 13)), { slideSets: [{ name: '강의.pdf', first: 1, count: 13 }], slidesMade: 13, slidesFrom: '강의.pdf' });
  assert.deepEqual(SS.setsFields(two), { slideSets: two, slidesMade: 18, slidesFrom: '' });
  assert.deepEqual(SS.setsFields([]), { slideSets: [], slidesMade: 0, slidesFrom: '' });
  // 깨진 값은 버림(겹치는 번호·이름 없음·0장)
  assert.deepEqual(SS.normSets([{ name: 'a', first: 1, count: 3 }, { name: 'b', first: 3, count: 2 }, { name: '', first: 9, count: 1 }, { name: 'c', first: 6, count: 0 }, null]), [{ name: 'a', first: 1, count: 3 }]);
  assert.equal(SS.numOf('material/p-014.webp'), 14); assert.equal(SS.numOf('assets/slides/slide-007.png'), 7); assert.equal(SS.numOf('assets/img/a.png'), 0);
});

test('묶음: 파일 이름으로 찾기(같은 이름의 PDF 짝 포함) · 사이트에 놓인 그림에 맞는 묶음만', () => {
  const sets = [{ name: '강의.pdf', first: 1, count: 13 }, { name: '안내.docx', first: 14, count: 5 }];
  assert.equal(SS.setFor(sets, '안내.docx').first, 14);
  assert.equal(SS.setFor(sets, '강의.pptx').first, 1, '같은 이름의 PDF에서 그린 쪽 그림');
  assert.equal(SS.setFor(sets, '다른.pptx'), null);
  assert.equal(SS.setFor([{ name: '강의.pptx', first: 1, count: 3 }, { name: '강의.docx', first: 4, count: 2 }], '강의.pdf'), null, '짝이 둘이면 어느 것인지 모름');
  const nums = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  assert.deepEqual(SS.setsWithin(sets, nums(1, 18)), sets);
  assert.deepEqual(SS.setsWithin(sets, nums(1, 13)), [sets[0]], '교재를 더 넣기 전에 만든 사이트: 그때 옮긴 교재만');
  assert.deepEqual(SS.setsWithin(sets, nums(1, 20)), [], '교재를 바꿨는데 사이트는 예전 것: 모르는 것으로');
  assert.deepEqual(SS.setsWithin(sets, nums(1, 9)), []);
  assert.deepEqual(SS.setsWithin([], nums(1, 9)), []);
});

test('한도 나누기: 쪽이 적은 교재는 다 넣고 남는 몫을 많은 교재에 · 교재마다 앞·끝쪽을 넣어 고르게', () => {
  assert.deepEqual(SS.splitCap([13, 5], 60), [13, 5]);
  assert.deepEqual(SS.splitCap([100, 5, 30], 60), [28, 5, 27]);
  assert.deepEqual(SS.splitCap([100, 100], 12), [6, 6]);
  assert.deepEqual(SS.splitCap([100, 100, 100], 2), [1, 1, 0]);
  assert.deepEqual(SS.splitCap([0, 7], 60), [0, 7]);
  for (const [counts, cap] of [[[400, 3, 90, 41], 60], [[9, 9, 9], 5], [[1], 0], [[250, 250], 200]]) {
    const out = SS.splitCap(counts, cap);
    assert.ok(out.reduce((a, b) => a + b, 0) <= cap && out.every((n, i) => n >= 0 && n <= counts[i]), JSON.stringify([counts, cap, out]));
    assert.equal(out.reduce((a, b) => a + b, 0), Math.min(cap, counts.reduce((a, b) => a + b, 0)), '한도를 남기지 않음');
  }
  // 교재 하나는 예전 고르기 그대로
  assert.deepEqual(SS.pickFromSets([{ name: 'a', first: 1, count: 13 }], 60), [SS.pickPages(13, 60)]);
  assert.deepEqual(SS.pickFromSets([{ name: 'a', first: 1, count: 200 }], 12), [SS.pickPages(200, 12)]);
  const [a, b] = SS.pickFromSets([{ name: 'a', first: 1, count: 100 }, { name: 'b', first: 101, count: 5 }], 12);
  assert.deepEqual(b, [101, 102, 103, 104, 105]);
  assert.equal(a.length, 7); assert.ok(a.includes(1) && a.includes(100) && a.every((n) => n >= 1 && n <= 100));
});

test('AI에게 알리는 쪽 그림 줄: 교재 하나면 예전과 같은 글 · 교재마다 그렸으면 어느 번호가 어느 교재의 몇 쪽인지', () => {
  const base = { files: [{ name: '강의.pdf', pages: 13, sent: 'original', ext: 'pdf' }], sentPages: [], text: '', notes: [] };
  const old = `[교재]\n- 강의.pdf (13쪽): 원본 그대로 첨부\n사이트에 쓸 수 있는 교재 쪽 그림: material/p-001.webp ~ material/p-013.webp (번호 = 교재 쪽 번호, 강의.pdf)`;
  // 예전 꾸러미(siteSets·links 없음)와 새 꾸러미(묶음 하나)가 같은 글
  assert.equal(buildMaterialPrompt({ ...base, siteImages: paths(1, 13), siteImagesFrom: '강의.pdf' }), old);
  assert.equal(buildMaterialPrompt({ ...base, siteImages: paths(1, 13), siteImagesFrom: '강의.pdf', siteSets: [{ name: '강의.pdf', first: 1, count: 13 }], links: '' }), old);
  assert.match(buildMaterialPrompt({ ...base, siteImages: [], siteImagesFrom: '' }), /\n교재 쪽 그림은 없어요\.$/);
  assert.match(buildMaterialPrompt({ ...base, siteImages: paths(1, 13), siteImagesFrom: '', siteSets: [] }), /material\/p-013\.webp \(번호 = 교재 쪽 번호\)$/);
  const two = buildMaterialPrompt({
    files: [...base.files, { name: '안내.docx', pages: 5, sent: 'images', ext: 'docx' }], notes: [], text: '',
    siteImages: [...paths(1, 13), ...paths(14, 18, 'png')], siteImagesFrom: '', siteSets: [{ name: '강의.pdf', first: 1, count: 13 }, { name: '안내.docx', first: 14, count: 5 }],
    sentPages: [14, 15, 16, 17, 18], links: '- 강의.pdf 11쪽: NotebookLM 열기 → https://notebooklm.google.com/',
  });
  assert.match(two, /쪽 그림으로 함께 보낸 그림\(material\/p- 번호\): 14, 15, 16, 17, 18\n/);
  assert.match(two, /사이트에 쓸 수 있는 교재 쪽 그림: material\/p-001 ~ material\/p-018 \(교재마다 이어서 매긴 번호\)\n- 강의\.pdf: material\/p-001\.webp ~ material\/p-013\.webp \(이 교재의 1~13쪽\)\n- 안내\.docx: material\/p-014\.png ~ material\/p-018\.png \(이 교재의 1~5쪽\)/);
  assert.ok(!/번호 = 교재 쪽 번호/.test(two), '여러 교재면 그림 번호가 곧 쪽 번호라고 하지 않음');
  // 6-②: 원본(PDF)으로 보낸 교재에 걸린 링크 주소를 자료로
  assert.match(two, /\n\n\[교재의 글자·단추·그림에 걸린 링크 주소 — PDF에서는 주소가 보이지 않아요\. 교재 파일에 적힌 그대로예요\]\n- 강의\.pdf 11쪽: NotebookLM 열기 → https:\/\/notebooklm\.google\.com\/$/);
});

test('lecpage 커넥트로 넘기는 값: 교재 하나의 쪽 그림이면 예전처럼 true · 교재마다 그렸으면 { first, count } · 한도를 넘으면 교재마다 고르게', async () => {
  const BC = globalThis.BroadcastChannel; globalThis.BroadcastChannel = undefined; // 앱 저장소 모듈이 여는 채널(시험이 끝나지 않음)을 막음
  const L = await import('../../../../app/src/lib/gen/local.js');
  globalThis.BroadcastChannel = BC;
  const store = new Map();
  const blobs = { get: async (pid, k) => store.get(k) || null, keys: async () => [...store.keys()] };
  const put = (k, n = 10) => store.set(k, new Uint8Array(n));
  for (const k of ['src/강의.pptx', 'src/강의.pdf', 'src/안내.docx', 'src/메모.txt']) put(k);
  const files = [{ name: '강의.pptx', key: 'src/강의.pptx', ext: 'pptx' }, { name: '강의.pdf', key: 'src/강의.pdf', ext: 'pdf' }, { name: '안내.docx', key: 'src/안내.docx', ext: 'docx' }, { name: '메모.txt', key: 'src/메모.txt', ext: 'txt' }];
  const flags = (list) => Object.fromEntries(list.map((f) => [f.name, f.pageImages ?? null]));
  // 예전 연수(쪽 그림은 한 교재의 것): 그 교재와 같은 이름의 PDF 짝에 true(예전과 같음)
  assert.deepEqual(flags(await L.bridgeFiles(blobs, 'p', { files, slidesFrom: '강의.pdf', slidesMade: 13 })), { '강의.pptx': true, '강의.pdf': true, '안내.docx': null, '메모.txt': null });
  assert.deepEqual(flags(await L.bridgeFiles(blobs, 'p', { files })), { '강의.pptx': null, '강의.pdf': null, '안내.docx': null, '메모.txt': null });
  // 교재마다 그림(묶음 둘): 어느 번호가 그 교재의 것인지
  const sets = [{ name: '강의.pdf', first: 1, count: 13 }, { name: '안내.docx', first: 14, count: 5 }];
  const want = { '강의.pptx': { first: 1, count: 13 }, '강의.pdf': { first: 1, count: 13 }, '안내.docx': { first: 14, count: 5 }, '메모.txt': null };
  assert.deepEqual(flags(await L.bridgeFiles(blobs, 'p', { files, slideSets: sets })), want);
  assert.deepEqual(flags(await L.bridgeFiles(blobs, 'p', { files, slidesFrom: '옛.pdf', slidesMade: 2 }, null, sets)), want, '보낼 쪽 그림의 묶음을 주면 그것으로');
  // 예전 커넥트에는 첫 교재의 것만 보냄 → 묶음 하나 → true
  assert.deepEqual(flags(await L.bridgeFiles(blobs, 'p', { files, slideSets: sets }, null, sets.slice(0, 1))), { '강의.pptx': true, '강의.pdf': true, '안내.docx': null, '메모.txt': null });
  assert.equal(L.PAGE_SETS_CAP, 'page-sets'); assert.ok(CAPS.includes(L.PAGE_SETS_CAP), '커넥트가 그 형식을 안다고 알림');

  // 쪽 그림 고르기: 한도 안이면 전부, 넘으면 교재마다 고르게(쪽이 적은 교재는 다), 예전 커넥트에는 첫 교재의 것만
  const MiB = 1048576; const list = [...paths(1, 30), ...paths(31, 34)];
  for (const p of list) put('site/' + p, MiB);
  const big = [{ name: 'a.pdf', first: 1, count: 30 }, { name: 'b.pptx', first: 31, count: 4 }];
  let fit = await L.fitSiteImages(blobs, 'p', list, big, null, { siteMB: 40 });
  assert.deepEqual([fit.list.length, fit.total, fit.cut], [34, 34, false]);
  fit = await L.fitSiteImages(blobs, 'p', list, big, null, { siteMB: 20 });
  assert.equal(fit.cut, true); assert.equal(fit.total, 34);
  assert.ok(fit.list.length <= 19 && fit.list.length >= 14, String(fit.list.length));
  const nums = fit.list.map(SS.numOf);
  assert.deepEqual(nums.filter((n) => n > 30), [31, 32, 33, 34], '쪽이 적은 교재는 다 보냄');
  assert.ok(nums.includes(1) && nums.includes(30), '많은 교재는 앞·끝쪽을 넣어 고르게');
  fit = await L.fitSiteImages(blobs, 'p', list, big, big.slice(1), null);
  assert.deepEqual(fit.list, paths(31, 34)); assert.equal(fit.total, 4); assert.equal(fit.cut, false);
  fit = await L.fitSiteImages(blobs, 'p', list, [], null, { siteMB: 11 }); // 어느 교재의 것인지 모르는 쪽 그림도 고르게 줄임
  assert.ok(fit.cut && fit.list.length <= 10 && fit.list.includes('material/p-001.webp') && fit.list.includes('material/p-034.webp'));
});

test('커넥트 작업 지시: 교재마다 그려 보낸 쪽 그림은 어느 번호가 어느 교재의 것인지 그대로 · 교재 하나의 것은 예전과 같은 글', () => {
  const pi = { first: 1, last: 18, count: 18, exts: ['webp', 'png'], sample: 'p-001.webp', multi: true, given: true, owner: '' };
  const multi = taskText({ kind: 'make', materials: ['강의.pptx', '안내.docx'], pageImages: { ...pi, sets: [{ owner: '강의.pptx', first: 1, last: 13 }, { owner: '안내.docx', first: 14, last: 18 }] } });
  assert.match(multi, /- 교재 쪽 그림: `work\/site\/material\/` \(p-001 ~ p-018, \.webp·\.png\) — 교재마다 이어서 번호를 매겼어요\(`강의\.pptx` p-001~p-013, `안내\.docx` p-014~p-018\)\. 사이트에 그대로 써도 돼요\(`material\/p-001\.webp`\)\n/);
  const one = taskText({ kind: 'make', materials: ['강의.pptx', '안내.docx'], pageImages: { ...pi, owner: '안내.docx' } });
  assert.match(one, /\(p-001 ~ p-018, \.webp·\.png\) — `안내\.docx`의 쪽 그림이에요\. 사이트에 그대로/);
});

/** 묶음만 있는 PC처럼 prepare(앱이 그려 보낸 쪽 그림을 미리 놓고). nums: 놓을 그림 번호, sets: LECPAGE_GIVEN_IMAGES_SETS */
function prepare(files, nums, sets) {
  const work = mkdtempSync(join(T, 'w-'));
  mkdirSync(join(work, 'site', 'material'), { recursive: true });
  for (const n of nums) writeFileSync(join(work, 'site', 'material', `p-${pad3(n)}.webp`), 'RIFF');
  const r = spawnSync(process.execPath, [CLI, 'prepare', ...files, '-o', work, '--json', '--no-python', '--no-slides'], { encoding: 'utf8', env: { ...process.env, LECPAGE_GIVEN_IMAGES: '1', LECPAGE_GIVEN_IMAGES_OF: '', LECPAGE_GIVEN_IMAGES_SETS: JSON.stringify(sets) } });
  const j = JSON.parse(String(r.stdout).trim().split('\n').pop());
  const md = existsSync(join(work, 'material.md')) ? readFileSync(join(work, 'material.md'), 'utf8') : '';
  return { j, md, pages: JSON.parse(readFileSync(join(work, '.lecpage', 'pages.json'), 'utf8')), heads: md.split('\n').filter((l) => l.startsWith('## ')) };
}
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

test('prepare: 교재마다 그려 보낸 쪽 그림을 묶음마다 그 교재의 쪽에 맞춤(둘째 교재는 이어진 번호) · 한글·워드의 부분에는 붙이지 않음', { timeout: 120000 }, () => {
  // PDF 둘: 첫 교재 p-001~013, 둘째 p-014~016 → 둘째 교재의 1쪽이 p-014
  const a = prepare([fx('workshop.pdf'), fx('ko-cid.pdf')], range(1, 16), [{ name: 'workshop.pdf', first: 1, count: 13 }, { name: 'ko-cid.pdf', first: 14, count: 3 }]);
  assert.equal(a.j.ok, true);
  assert.deepEqual(a.j.given, { owner: '', mapped: 16, sets: [{ owner: 'workshop.pdf', first: 1, last: 13, count: 13, mapped: 13 }, { owner: 'ko-cid.pdf', first: 14, last: 16, count: 3, mapped: 3 }] });
  assert.deepEqual(a.j.files.map((f) => [f.name, f.pages, f.images]), [['workshop.pdf', 13, 13], ['ko-cid.pdf', 3, 3]]);
  assert.deepEqual(a.pages.map((p) => p.page), range(1, 16));
  // 슬라이드 + 워드: 슬라이드는 쪽마다, 워드는 '부분'이라 번호를 붙이지 않되 그 교재의 그림이 몇 장인지는 앎
  const b = prepare([fx('workshop.pptx'), fx('guide.docx')], range(1, 16), [{ name: 'workshop.pptx', first: 1, count: 13 }, { name: 'guide.docx', first: 14, count: 3 }]);
  assert.deepEqual(b.j.given.sets.map((x) => [x.owner, x.first, x.last, x.mapped]), [['workshop.pptx', 1, 13, 13], ['guide.docx', 14, 16, 0]]);
  assert.deepEqual(b.j.files.map((f) => [f.name, f.images]), [['workshop.pptx', 13], ['guide.docx', 3]]);
  assert.match(b.md, /쪽 그림은 교재마다 이어서 번호를 매겼어요\(workshop\.pptx p-001~p-013, guide\.docx p-014~p-016\)\. 쪽마다 맞춘 것은 제목 앞에 p-NNN을 적었어요\./);
  assert.ok(b.heads.some((h) => /^## p-013 · workshop\.pptx 13쪽/.test(h)) && b.heads.filter((h) => /guide\.docx/.test(h)).every((h) => !/^## p-/.test(h)), b.heads.join(' / '));
  // 순서가 바뀌어도(둘째로 넣은 교재가 앞 번호) 이름으로 맞춤 · 한도 때문에 골라 보낸 그림(번호가 띄엄띄엄)도 제 쪽에
  const c = prepare([fx('ko-cid.pdf'), fx('workshop.pdf')], [1, 2, 3, 7, 13, 14, 16], [{ name: 'workshop.pdf', first: 1, count: 13 }, { name: 'ko-cid.pdf', first: 14, count: 3 }]);
  assert.deepEqual(c.j.given.sets.map((x) => [x.owner, x.count, x.mapped]), [['workshop.pdf', 5, 5], ['ko-cid.pdf', 2, 2]]);
  assert.deepEqual(c.pages.map((p) => p.page), [1, 2, 3, 7, 13, 14, 16]);
  // 같은 이름의 PDF 짝(슬라이드 + 그 PDF): 한 묶음으로 그 슬라이드에
  const d = prepare([fx('workshop.pptx'), fx('workshop.pdf'), fx('ko-cid.pdf')], range(1, 16), [{ name: 'workshop.pdf', first: 1, count: 13 }, { name: 'ko-cid.pdf', first: 14, count: 3 }]);
  assert.deepEqual(d.j.given.sets.map((x) => [x.owner, x.mapped]), [['workshop.pptx', 13], ['ko-cid.pdf', 3]]);
  // 그림이 하나도 오지 않은 묶음은 적지 않음(없는 것을 있다고 하지 않게)
  const e = prepare([fx('workshop.pdf'), fx('ko-cid.pdf')], range(1, 13), [{ name: 'workshop.pdf', first: 1, count: 13 }, { name: 'ko-cid.pdf', first: 14, count: 3 }]);
  assert.deepEqual(e.j.given.sets.map((x) => x.owner), ['workshop.pdf']);
  assert.deepEqual(e.j.files.map((f) => [f.name, f.images]), [['workshop.pdf', 13], ['ko-cid.pdf', 0]]);
});

// 교재 쪽 이름(교재 슬라이드의 제목·검색): 쪽 그림 번호는 묶음을 따르는데, 제목은 '먼저 읽기가 끝난 교재'의 쪽 번호 그대로 붙여
// 큰 PDF 뒤에 넣은 PPT가 먼저 읽히면 PPT 슬라이드의 제목이 PDF 쪽(1~13쪽)에 붙었음(실제 AI 300쪽 PDF + PPT 사이트의 품질 평가에서 찾음)
test('쪽 이름은 묶음 번호에 맞춤: 먼저 읽힌 교재가 뒤 묶음이어도 그 교재의 쪽에만, 맞출 수 없는 교재는 비움', () => {
  const pg = (file, page, title, more = {}) => ({ file, page, title, paragraphs: [{ text: title + ' 본문' }], ...more });
  const material = {
    files: [{ id: 'deck2', name: 'workshop.pptx', unit: 'slide' }, { id: 'deck1', name: 'big.pdf', unit: 'page' }, { id: 'doc1', name: 'guide.docx', unit: 'section' }],
    pages: [pg('deck2', 1, '표지'), pg('deck2', 2, '강사 소개'), pg('deck2', 3, '차례'), pg('deck1', 1, 'PDF 1쪽'), pg('deck1', 2, 'PDF 2쪽'), pg('doc1', 1, '운영 안내'), pg('doc1', 2, '준비물')],
  };
  const sets = [{ name: 'big.pdf', first: 1, count: 2 }, { name: 'workshop.pptx', first: 3, count: 3 }, { name: 'guide.docx', first: 6, count: 2 }];
  const rows = SS.pagesBySets(material, sets);
  assert.deepEqual(rows.map((r) => [r.page, r.title]), [[1, 'PDF 1쪽'], [2, 'PDF 2쪽'], [3, '표지'], [4, '강사 소개'], [5, '차례']], '묶음 번호대로(문서형 교재는 부분과 쪽이 달라 비움)');
  assert.equal(rows[2].text, '표지 본문');
  // 교재 하나(예전과 같은 결과)
  assert.deepEqual(SS.pagesBySets({ files: [material.files[0]], pages: material.pages.slice(0, 3) }, [{ name: 'workshop.pptx', first: 1, count: 3 }]).map((r) => r.page), [1, 2, 3]);
  // 숨긴 슬라이드: 그림을 보이는 쪽만 그렸으면 보이는 쪽 차례로, 숨긴 쪽까지 그렸으면 쪽 차례 그대로(숨긴 쪽 이름은 뺌)
  const hid = { files: [material.files[0]], pages: [pg('deck2', 1, '가'), pg('deck2', 2, '나(숨김)', { hidden: true }), pg('deck2', 3, '다')] };
  assert.deepEqual(SS.pagesBySets(hid, [{ name: 'workshop.pptx', first: 1, count: 2 }]).map((r) => [r.page, r.title]), [[1, '가'], [2, '다']]);
  assert.deepEqual(SS.pagesBySets(hid, [{ name: 'workshop.pptx', first: 1, count: 3 }]).map((r) => [r.page, r.title]), [[1, '가'], [3, '다']]);
  // 교재가 그림보다 길면(쪽 그림 한도·그리다 멈춤) 앞에서부터 그린 만큼만
  const long = { files: [{ id: 'deck1', name: 'big.pdf', unit: 'page' }], pages: [1, 2, 3, 4, 5].map((n) => pg('deck1', n, 'PDF ' + n + '쪽')) };
  assert.deepEqual(SS.pagesBySets(long, [{ name: 'big.pdf', first: 1, count: 3 }]).map((r) => [r.page, r.title]), [[1, 'PDF 1쪽'], [2, 'PDF 2쪽'], [3, 'PDF 3쪽']]);
  // 그림이 교재 쪽보다 많거나 묶음의 교재를 찾지 못하면 비움, 같은 이름의 PDF 짝(이 PC에서 만든 PDF)은 그 교재로
  assert.deepEqual(SS.pagesBySets(hid, [{ name: 'workshop.pptx', first: 1, count: 7 }]), []);
  assert.deepEqual(SS.pagesBySets(hid, [{ name: 'other.pdf', first: 1, count: 2 }]), []);
  assert.deepEqual(SS.pagesBySets(hid, [{ name: 'workshop.pdf', first: 1, count: 2 }]).map((r) => r.page), [1, 2]);
  // 다른 교재를 그린 PDF(renderOf)의 묶음: 쪽 이름은 그 원본 교재의 것(이름이 달라도, 같은 이름의 문서형 교재가 더 있어도)
  const twin = { files: [{ id: 'deck1', name: 'deck.pptx', unit: 'slide' }, { id: 'pdf1', name: 'deck_handout.pdf', unit: 'page', renderOf: 'deck1' }], pages: [pg('deck1', 1, '가'), pg('deck1', 2, '나')] };
  assert.deepEqual(SS.pagesBySets(twin, [{ name: 'deck_handout.pdf', first: 1, count: 2 }, { name: 'deck.pptx', first: 3, count: 2 }]).map((r) => [r.page, r.title]), [[1, '가'], [2, '나'], [3, '가'], [4, '나']]);
  const three = { files: [{ id: 'd1', name: 'x.pptx', unit: 'slide' }, { id: 'p1', name: 'x.pdf', unit: 'page', renderOf: 'd1' }, { id: 'w1', name: 'x.docx', unit: 'section' }], pages: [pg('d1', 1, '가'), pg('d1', 2, '나'), pg('w1', 1, '문서')] };
  assert.deepEqual(SS.pagesBySets(three, [{ name: 'x.pdf', first: 1, count: 2 }]).map((r) => [r.page, r.title]), [[1, '가'], [2, '나']]);
  assert.deepEqual(SS.pagesBySets(three, [{ name: 'x.ppt', first: 1, count: 2 }]), [], '확장자만 다른 짝이 서로 다른 교재를 가리키면(슬라이드와 문서) 비움');
  // 묶음이 없으면(예전 연수) null → 부른 쪽이 예전 규칙을 씀
  assert.equal(SS.pagesBySets(material, []), null);
});
