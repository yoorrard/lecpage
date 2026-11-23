// 앱(app/src/lib/site-size.js): 바로 배포 서버의 한도로 사이트 크기를 보고, '교재 원본 다운로드 허용'의 원본 가운데 한도에 걸리는 것만 뺌.
// 크기 때문에 배포가 실패하지 않게 하되 교재 쪽 그림·사이트 파일은 빼지 않음(뺄 수 있는 것은 원본뿐). 숫자는 서버(/api/info limits)가 준 것을 그대로 씀
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'app', 'src', 'lib');
const { fitOriginals, instantFit, leftLine, sizeText } = await import(join(APP, 'site-size.js'));
const MB = 1024 * 1024;
const LIM = { maxBytes: 300 * MB, maxFileBytes: 20 * MB, maxFiles: 1500 };
const names = (list) => list.map((o) => o.name).join(',');

test('원본 빼기 1: 파일 하나 한도를 넘는 원본만 빠지고 넣은 순서는 그대로', () => {
  const o = [{ name: 'a.pptx', size: 312 * MB }, { name: 'b.pdf', size: 15 * MB }, { name: 'c.hwp', size: 20 * MB }, { name: 'd.docx', size: 20 * MB + 1 }];
  const r = fitOriginals(o, 0, LIM);
  assert.equal(names(r.keep), 'b.pdf,c.hwp', '딱 한도인 파일은 넣음'); assert.equal(names(r.left), 'a.pptx,d.docx');
  assert.deepEqual(fitOriginals([], 0, LIM), { keep: [], left: [] });
  assert.equal(names(fitOriginals(o, 0, {}).keep), 'a.pptx,b.pdf,c.hwp,d.docx', '한도를 모르면 아무것도 빼지 않음');
});

test('원본 빼기 2: 그래도 사이트 전체를 넘으면 남은 원본을 큰 것부터, 넘지 않을 때까지만', () => {
  const o = [{ name: 'b.pdf', size: 15 * MB }, { name: 'c.pdf', size: 18 * MB }, { name: 'd.docx', size: 2 * MB }];
  assert.equal(names(fitOriginals(o, 250 * MB, LIM).left), '', '원본까지 285MB: 다 들어감');
  const r = fitOriginals(o, 280 * MB, LIM); // 원본까지 315MB → 가장 큰 18MB를 빼면 297MB
  assert.equal(names(r.left), 'c.pdf'); assert.equal(names(r.keep), 'b.pdf,d.docx');
  const r2 = fitOriginals(o, 299 * MB, LIM); // 쪽 그림·사이트 파일만으로 299MB → 원본은 1MB까지만
  assert.equal(names(r2.left), 'b.pdf,c.pdf,d.docx'); assert.equal(names(r2.keep), '');
  // 원본을 다 빼도 넘는 사이트: 원본만 빠짐(쪽 그림·사이트 파일은 여기서 건드리지 않음 → 남은 크기는 instantFit이 알림)
  assert.equal(names(fitOriginals(o, 301 * MB, LIM).keep), '');
});

test('서버 한도로 사이트 크기 보기: 숫자는 서버가 준 그대로', () => {
  assert.deepEqual(instantFit({ bytes: 300 * MB, maxFile: 20 * MB, files: 1500 }, LIM), { ok: true, errors: [] });
  const bad = instantFit({ bytes: 300 * MB + 1, maxFile: 20 * MB + 1, files: 1501 }, LIM);
  assert.equal(bad.ok, false); assert.equal(bad.errors.length, 3);
  assert.match(bad.errors[0], /사이트가 301MB예요\. 바로 배포에는 300MB까지/); assert.match(bad.errors[1], /21MB짜리 파일이 있어요\. 바로 배포에는 파일 하나가 20MB까지/); assert.match(bad.errors[2], /파일이 1,501개예요\. 바로 배포에는 1,500개까지/);
  assert.match(instantFit({ bytes: 50 * MB, maxFile: 1, files: 1 }, { maxBytes: 40 * MB }).errors[0], /40MB까지/, '서버 한도가 달라지면 그 숫자로');
  assert.equal(instantFit({ bytes: 9e9, maxFile: 9e9, files: 9e9 }, {}).ok, true, '한도를 모르면 막지 않음(서버가 봄)');
});

test('영상·소리와 웹 문서 합계(서버 maxMediaBytes): 올리기 전에 알림, 한도를 모르거나 값이 없으면 막지 않음', () => {
  const lim = { ...LIM, maxMediaBytes: 40 * MB };
  assert.equal(instantFit({ bytes: 200 * MB, maxFile: 19 * MB, files: 900, kept: 40 * MB }, lim).ok, true, '딱 한도는 올림');
  const bad = instantFit({ bytes: 200 * MB, maxFile: 19 * MB, files: 900, kept: 40 * MB + 1 }, lim);
  assert.equal(bad.ok, false); assert.equal(bad.errors.length, 1);
  assert.match(bad.errors[0], /영상·소리 파일과 웹 문서\(HTML\)가 합쳐 41MB예요\. 바로 배포에는 이 둘을 합쳐 40MB까지/);
  assert.equal(instantFit({ bytes: 200 * MB, maxFile: 19 * MB, files: 900, kept: 90 * MB }, LIM).ok, true, '서버가 이 한도를 알려 주지 않으면 막지 않음');
  assert.equal(instantFit({ bytes: 200 * MB, maxFile: 19 * MB, files: 900 }, lim).ok, true, '합계를 세지 않은 통계(예전 호출)는 막지 않음');
});

test('알리는 한 줄: 이름과 크기. "교재 슬라이드에서 모든 쪽을 볼 수 있어요"는 뺀 원본 모두가 그런 교재(full)일 때만 덧붙임', () => {
  const big = { name: '연수 교재.pptx', size: 312 * MB };
  assert.equal(leftLine([{ ...big, full: true }]), '연수 교재.pptx(312MB)는 커서 사이트에 넣지 않아요. 참가자는 교재 슬라이드에서 모든 쪽을 볼 수 있어요.');
  assert.equal(leftLine([{ ...big, full: true }], { after: true }), '연수 교재.pptx(312MB)는 커서 사이트에 넣지 않았어요. 참가자는 교재 슬라이드에서 모든 쪽을 볼 수 있어요.');
  // 확인하지 못했거나(full 없음) 아닌 교재: '넣지 않아요'에서 끝남(사실이 아닌 말을 하지 않음)
  assert.equal(leftLine([big]), '연수 교재.pptx(312MB)는 커서 사이트에 넣지 않아요.');
  assert.equal(leftLine([{ ...big, full: false }], { after: true }), '연수 교재.pptx(312MB)는 커서 사이트에 넣지 않았어요.');
  // 여럿 가운데 하나라도 아니면 덧붙이지 않음
  assert.equal(leftLine([{ ...big, full: true }, { name: 'b.hwp', size: 25 * MB, full: false }]), '연수 교재.pptx(312MB), b.hwp(25MB)는 커서 사이트에 넣지 않아요.');
  assert.match(leftLine([big, { name: 'b.pdf', size: 25 * MB }, { name: 'c.pdf', size: 30 * MB }], { after: true }), /^연수 교재\.pptx\(312MB\), b\.pdf\(25MB\) 외 1개는 커서 사이트에 넣지 않았어요\.$/);
  assert.equal(leftLine([]), ''); assert.equal(leftLine(null), '');
  assert.equal(sizeText(500 * 1024), '500KB'); assert.equal(sizeText(60 * MB), '60MB');
});

test('slidesCover: 그 교재의 모든 쪽이 사이트의 교재 슬라이드에 있을 때만 true(파일마다)', async () => {
  const { slidesCover } = await import(join(APP, 'site-size.js'));
  const nums = Array.from({ length: 30 }, (_, i) => i + 1);
  const set = { name: 'a.pdf', first: 1, count: 30 };
  const o = { pageNums: nums, deckAll: true, maxSlides: 400 };
  assert.equal(slidesCover({ pages: 30 }, set, o), true);
  assert.equal(slidesCover({ pages: 30 }, set, { ...o, deckAll: false }), false, '쪽을 모두 보여 주는 교재 슬라이드가 없는 사이트');
  assert.equal(slidesCover({ pages: 30 }, null, o), false, '쪽 그림이 없는 교재(글자만 읽음)');
  assert.equal(slidesCover({ pages: 45 }, set, o), false, '쪽 그림이 쪽 수보다 적음(그리다 멈춤·몫이 모자람)');
  assert.equal(slidesCover({ pages: 30, slidesPart: true }, set, o), false, '일부만 그렸다고 적힌 교재');
  assert.equal(slidesCover({ pages: 0 }, set, o), false, '쪽 수를 모름');
  assert.equal(slidesCover({ pages: 30 }, set, { ...o, pageNums: nums.filter((n) => n !== 17) }), false, '사이트에 놓이지 않은 쪽이 있음');
  assert.equal(slidesCover({ pages: 30 }, set, { ...o, pageNums: [] }), false, '사이트에 쪽 그림이 없음');
  // 둘째 교재(이어 매긴 번호 31~40)
  const set2 = { name: 'b.pptx', first: 31, count: 10 };
  assert.equal(slidesCover({ pages: 10 }, set2, { ...o, pageNums: Array.from({ length: 40 }, (_, i) => i + 1) }), true);
  assert.equal(slidesCover({ pages: 10 }, set2, o), false, '둘째 교재의 쪽 그림은 사이트에 없음(교재를 더 넣고 다시 만들지 않음)');
  // 쪽 그림 몫의 끝(400)에 닿은 묶음: 뒤가 잘렸을 수 있어 말하지 않음
  assert.equal(slidesCover({ pages: 100 }, { name: 'c.docx', first: 301, count: 100 }, { ...o, pageNums: Array.from({ length: 400 }, (_, i) => i + 1) }), false);
});

test('작은 파일 묶기: 묶음 하나는 합계·파일 수 한도 안, 넣은 순서 그대로, 묶음보다 큰 것은 넣지 않음', async () => {
  const { bundlesOf, packBundle } = await import(join(APP, 'site-size.js'));
  const g = bundlesOf([['a', 5], ['b', 6], ['c', 20], ['d', 4], ['e', 1]], { bytes: 10, files: 2 });
  assert.deepEqual(g, [[['a', 5]], [['b', 6], ['d', 4]], [['e', 1]]], '합계 10·2개씩, 20짜리는 빠짐');
  assert.deepEqual(bundlesOf([['a', 1], ['b', 1], ['c', 1]], { bytes: 100, files: 2 }), [[['a', 1], ['b', 1]], [['c', 1]]]);
  assert.deepEqual(bundlesOf([['a', 1]], {}), [], '한도를 모르면 묶지 않음');
  // 실제 모양: 글꼴 조각 537개(9KB) + 쪽 그림 14장(150KB) = 묶음 하나(8MiB·700개 안)
  const real = [...Array.from({ length: 537 }, (_, i) => [`f${i}`, 9 * 1024]), ...Array.from({ length: 14 }, (_, i) => [`p${i}`, 150 * 1024])];
  assert.equal(bundlesOf(real, { bytes: 8 * MB, files: 700 }).length, 1);
  // 쪽 그림 300장(150KB = 45MB)은 8MiB씩 6묶음
  assert.equal(bundlesOf(Array.from({ length: 300 }, (_, i) => [`p${i}`, 150 * 1024]), { bytes: 8 * MB, files: 700 }).length, 6);
  // 본문: [머리 길이 4바이트(큰 끝)] [머리 JSON] [내용을 그 순서대로]
  const body = new Uint8Array(await packBundle([['a'.repeat(64), 3, new Uint8Array([1, 2, 3])], ['b'.repeat(64), 2, new Uint8Array([9, 8])]]).arrayBuffer());
  const n = new DataView(body.buffer).getUint32(0);
  assert.deepEqual(JSON.parse(new TextDecoder().decode(body.subarray(4, 4 + n))), [['a'.repeat(64), 3], ['b'.repeat(64), 2]]);
  assert.deepEqual([...body.subarray(4 + n)], [1, 2, 3, 9, 8]);
});
