// 2. 만들기·수정 한 화면의 바탕(되풀이 시험): 버전 기록(바뀔 때마다·새것이 앞·복원), 연수 날짜·시간을 사이트 글에 같은 꼴로,
// 강사가 올린 자료(자료실 자리 표시가 없으면 키트가 자료 칸을 붙임), Skill의 site/files/ 자료
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordVersion, sameState, mergeVersions, restoreLabel, aiVersionLabel, addChat, aiReply, MAX_VERSIONS } from '../../../../app/src/lib/versions.js';
import { swapDate, swapTimeRange, parseIso } from '../../../../app/src/lib/date-text.js';
import * as K from '../src/kit/index.js';
import { nodeRuntime } from '../node.js';
import { unlistedFiles } from '../../scripts/kit-cmds.mjs';

const S = (n) => ({ 'index.html': `<!doctype html><title>t</title><p>${n}</p>` });

test('버전 기록: 바뀔 때마다 바뀐 뒤의 사이트가 맨 위에, 새것이 앞', () => {
  let p = { site: S(0), meta: { title: 'a' }, versions: [] };
  const step = (site, meta, o) => { const next = { site, meta }; p = { ...p, ...next, versions: recordVersion(p, next, o) }; };
  p.versions = recordVersion({}, p, { kind: 'make', label: 'AI가 만든 버전', at: 1000 });
  step(S(1), p.meta, { kind: 'ai', label: aiVersionLabel('edit', { request: '첫 요청' }), at: 2000 });
  step(S(2), p.meta, { kind: 'ai', label: aiVersionLabel('edit', { request: '둘째 요청' }), at: 3000 });
  step(S(2), { title: 'b' }, { kind: 'info', label: '연수명', at: 4000 });
  assert.deepEqual(p.versions.map((v) => v.label), ['연수 정보 수정 · 연수명', 'AI로 수정 · 둘째 요청', 'AI로 수정 · 첫 요청', 'AI가 만든 버전']);
  assert.ok(p.versions.every((v, i, a) => i === 0 || a[i - 1].at >= v.at));
  assert.ok(sameState(p.versions[0], p), '맨 위가 지금 사이트');
  // 같은 판이면 더하지 않음
  assert.equal(recordVersion(p, { site: p.site, meta: p.meta }, { kind: 'ai' }).length, p.versions.length);
});

test('버전 기록: 잇따른 직접 수정은 하나로(5분 안), 20개까지, 기록 없던 판은 이전 상태로 먼저', () => {
  let p = { site: S(0), meta: {}, versions: [] };
  p.versions = recordVersion({}, p, { kind: 'make', label: 'AI가 만든 버전', at: 0 });
  for (let i = 1; i <= 3; i++) { const next = { site: S(i), meta: {} }; p = { ...p, ...next, versions: recordVersion(p, next, { kind: 'edit', label: i === 2 ? '순서 바꾸기' : '글 수정', at: i * 1000 }) }; }
  assert.equal(p.versions.length, 2);
  assert.equal(p.versions[0].label, '직접 수정 · 글 수정, 순서 바꾸기');
  assert.equal(p.versions[0].site['index.html'], S(3)['index.html']);
  const later = { site: S(9), meta: {} };
  assert.equal(recordVersion(p, later, { kind: 'edit', label: '글 수정', at: 3000 + 6 * 60e3 }).length, 3, '5분 지나면 새 버전');
  // 예전 기록(고치기 전 판만 남김)이 맨 위와 다르면 지금 판을 먼저 남김
  const old = { site: S(5), meta: {}, versions: [{ id: 'x', at: 1, label: 'AI 수정 전', site: S(4), meta: {} }] };
  const v = recordVersion(old, { site: S(6), meta: {} }, { kind: 'ai', label: 'AI로 수정', at: 10 });
  assert.deepEqual(v.map((x) => x.label), ['AI로 수정', '이전 상태', 'AI 수정 전']);
  let q = { site: S(0), meta: {}, versions: [] };
  for (let i = 1; i < 40; i++) { const next = { site: S(i), meta: {} }; q = { ...q, ...next, versions: recordVersion(q, next, { kind: 'ai', label: `${i}`, at: i }) }; }
  assert.equal(q.versions.length, MAX_VERSIONS);
  assert.equal(q.versions[0].label, '39');
});

test('버전 기록: 복원 이름, 임시본 합치기, 대화 답', () => {
  assert.equal(restoreLabel({ label: '복원 · 복원 · AI로 수정' }), '복원 · AI로 수정');
  const a = { id: 'a', at: 3 }, b = { id: 'b', at: 2 }, c = { id: 'c', at: 1 };
  assert.deepEqual(mergeVersions([a, b], [b, c]).map((x) => x.id), ['a', 'b', 'c']);
  const chat = addChat({ chat: [] }, { role: 'user', text: '요청' });
  const r = aiReply({ kind: 'edit', versionId: 'v1', changed: [{ id: 'hero', name: '첫 화면' }], design: true });
  assert.equal(chat[0].role, 'user');
  assert.equal(r.role, 'ai'); assert.equal(r.versionId, 'v1'); assert.equal(r.text, '요청대로 고쳤어요.'); assert.ok(r.design);
});

test('연수 날짜를 바꾸면 사이트 글의 같은 날짜를 같은 꼴로(요일도)', () => {
  const sw = (t) => swapDate(t, '2026-12-03', '2026-12-22');
  assert.equal(sw('2026년 12월 3일(목) 14:00'), '2026년 12월 22일(화) 14:00');
  assert.equal(sw('12월 3일 목요일'), '12월 22일 화요일');
  assert.equal(sw('2026. 12. 3.(목)'), '2026. 12. 22.(화)');
  assert.equal(sw('<time datetime="2026-12-03">2026.12.03</time>'), '<time datetime="2026-12-22">2026.12.22</time>');
  assert.equal(sw('12.3(목)'), '12.22(화)');
  // 날짜인지 모르는 것·다른 날은 그대로
  for (const t of ['12.3', '12/3', '3.5배', '2026년 12월 13일', '12월 30일', 'v1.12.3']) assert.equal(sw(t), t);
  assert.equal(swapDate('2026-12-03', '2026-12-03', 'bad'), '2026-12-03');
  assert.equal(parseIso('2026-02-30'), null);
});

test('시작~끝 시간을 같은 꼴로(시작·끝이 함께 적힌 곳만)', () => {
  const sw = (t, a = ['14:00', '17:00'], b = ['13:30', '16:00']) => swapTimeRange(t, a, b);
  assert.equal(sw('14:00~17:00'), '13:30~16:00');
  assert.equal(sw('14:00 - 17:00'), '13:30 - 16:00');
  assert.equal(sw('오후 2시~5시'), '오후 1시 30분~4시');
  assert.equal(sw('2:00~5:00'), '1:30~4:00');
  assert.equal(sw('오후 2시부터 5시까지'), '오후 1시 30분부터 4시까지');
  assert.equal(sw('14:00 시작 · 14:00~14:30 인사'), '14:00 시작 · 14:00~14:30 인사');
  assert.equal(sw('09:00~12:00', ['09:00', '12:00'], ['08:30', '11:00']), '08:30~11:00');
});

const rt = nodeRuntime();
const PAGE = (b = '') => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>시험</title></head><body><main><h1>시험 연수</h1>${b}</main></body></html>`;
const MATS = [{ title: '활동지', href: 'files/활동지 1.hwpx', desc: '실습 1에서 써요', kind: 'HWPX', size: '12KB' }];

test('강사가 올린 자료: 자료실 자리 표시가 없으면 첫 쪽 끝에 자료 칸, 있으면 그 자리에(이름의 빈칸은 %20)', () => {
  const site = { 'index.html': PAGE(), 'files/활동지 1.hwpx': new Uint8Array([80, 75, 3, 4]) };
  let r = K.assemble(site, { v: 2, title: '시험' }, { runtime: rt, target: 'zip', materials: MATS });
  assert.match(r.files['index.html'], /<section class="lp-sec lp-sec-materials" id="lpk-files"/);
  assert.match(r.files['index.html'], /href="files\/활동지%201\.hwpx" download/);
  assert.match(r.files['index.html'], /실습 1에서 써요/);
  assert.ok(r.files['files/활동지 1.hwpx'], '파일도 사이트에');
  assert.equal(r.collected.materials.length, 1);
  r = K.assemble({ ...site, 'index.html': PAGE('<section id="m"><h2>자료</h2><div data-lp="materials"></div></section>') }, { v: 2, title: '시험' }, { runtime: rt, target: 'zip', materials: MATS });
  assert.doesNotMatch(r.files['index.html'], /id="lpk-files"/);
  assert.match(r.files['index.html'], /data-lpk="materials"[\s\S]*href="files\/활동지%201\.hwpx"/);
  r = K.assemble(site, { v: 2, title: '시험' }, { runtime: rt, target: 'zip' });
  assert.doesNotMatch(r.files['index.html'], /lpk-files/, '자료가 없으면 칸도 없음');
});

test('Skill: site/files/에 넣고 걸지 않은 파일은 자료실 목록으로', () => {
  const site = { 'index.html': PAGE('<a href="files/plan.pdf">계획</a>'), 'files/plan.pdf': new Uint8Array(10), 'files/활동지.hwpx': new Uint8Array(2500), 'assets/img/a.png': new Uint8Array(1) };
  assert.deepEqual(unlistedFiles(site), [{ title: '활동지', href: 'files/활동지.hwpx', kind: 'HWPX', size: '3KB' }]);
  const r = K.assemble(site, { v: 2, title: '시험' }, { runtime: rt, target: 'zip', materials: unlistedFiles(site) });
  assert.match(r.files['index.html'], /id="lpk-files"[\s\S]*files\/활동지\.hwpx/);
});
