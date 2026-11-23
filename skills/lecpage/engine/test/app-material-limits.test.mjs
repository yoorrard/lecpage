// 교재 넣기 한도(app/src/lib/material-limits.js): 올린 한도는 잰 조건의 기기에서만.
// 실측은 메모리 16GB 데스크톱 Chromium뿐이라, 메모리 8GB 이상으로 알려 주는 Chromium 계열 데스크톱에서만 PDF 500·PPTX 300·DOCX 200MB,
// 그 밖(메모리가 적음·Safari·Firefox·휴대폰)은 예전 한도(100MB)와 예전 도구 한도 그대로 — 탭이 죽는 대신 예전처럼 알리거나 글자만 읽게.
import test from 'node:test';
import assert from 'node:assert/strict';

const L = await import(new URL('../../../../app/src/lib/material-limits.js', import.meta.url).href);
const desktop = { deviceMemory: 8, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36', userAgentData: { mobile: false } };
const lowMem = { ...desktop, deviceMemory: 4 };
const safari = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15' }; // deviceMemory 없음
const phone = { deviceMemory: 8, userAgent: 'Mozilla/5.0 (Linux; Android 15; SM-S938N) AppleWebKit/537.36 Chrome/142.0.0.0 Mobile Safari/537.36', userAgentData: { mobile: true } };
const tablet = { deviceMemory: 8, userAgent: 'Mozilla/5.0 (Linux; Android 15; SM-X910) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36', userAgentData: { mobile: false } };

test('roomy: 메모리 8GB 이상으로 알려 주는 Chromium 계열 데스크톱만', () => {
  assert.equal(L.roomy(desktop), true);
  for (const [name, nav] of Object.entries({ lowMem, safari, phone, tablet, none: undefined, empty: {} })) assert.equal(L.roomy(nav), false, name);
  assert.equal(L.roomy({ deviceMemory: 8, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148' }), false, 'userAgentData가 없어도 이름표로 휴대폰을 가림');
});

test('fileMaxMB: 조건의 기기는 PDF 500·PPTX 300·DOCX 200, 한글·그 밖은 100 / 조건 밖 기기는 모두 예전 100', () => {
  const at = (name, nav) => L.fileMaxMB(name, nav);
  assert.equal(at('a.pdf', desktop), 500); assert.equal(at('a.PPTX', desktop), 300); assert.equal(at('a.ppsx', desktop), 300); assert.equal(at('a.docx', desktop), 200);
  for (const n of ['a.hwp', 'a.hwpx', 'a.txt', 'a.md', 'a.ppt', 'a.key']) assert.equal(at(n, desktop), 100, n);
  for (const nav of [lowMem, safari, phone, tablet]) for (const n of ['a.pdf', 'a.pptx', 'a.docx', 'a.hwp']) assert.equal(at(n, nav), 100, n);
  assert.equal(L.OLD_MAX_MB, 100);
});

test('읽기·그리기 도구 한도: 조건의 기기에서만 넓히고, 그 밖은 null(도구의 기본 한도 그대로 → 예전처럼 알리거나 글자만 읽음)', () => {
  for (const nav of [lowMem, safari, phone, tablet]) { assert.equal(L.readLimits(nav), null); assert.equal(L.pptxZipLimits(nav), null); }
  const r = L.readLimits(desktop);
  assert.equal(r.maxBytes, 500 * L.MB); assert.equal(r.limits.maxEntryBytes, 500 * L.MB); assert.ok(r.limits.maxUncompressed >= r.maxBytes);
  const z = L.pptxZipLimits(desktop);
  assert.equal(z.maxMediaBytes, 300 * L.MB, 'PPTX 그림 합계는 PPTX 넣기 한도까지만'); assert.equal(z.maxEntryUncompressedBytes, 300 * L.MB);
});

test('이 시험이 도는 곳(Node)은 조건 밖 → 문구의 숫자도 예전 100MB', () => {
  assert.equal(L.roomy(), false);
  assert.equal(L.tooBigFile({ name: 'a.pdf', size: 101 * L.MB }), true); assert.equal(L.tooBigFile({ name: 'a.pdf', size: 99 * L.MB }), false);
  assert.equal(L.tooBigNote({ name: 'a.pdf', size: 101 * L.MB }), '100MB가 넘어 읽지 않았어요. 나눠서 올려 주세요.');
});
