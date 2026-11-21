// '참여 기능 없이 배포'(live.provider 'none'): 연습 모드(이 기기에만 저장)로 바뀌지 않고, 보내지지 않는 입력 칸 대신 한 줄 안내
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as K from '../src/kit/index.js';
import { nodeRuntime } from '../node.js';

const rt = nodeRuntime();
const PAGE = (b) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>t</title></head><body><main>${b}</main></body></html>`;
const site = { 'index.html': PAGE('<section><h2>참여</h2><div data-lp="qa"></div><div data-lp="poll" data-question="좋아요?" data-options=\'["네","아니요"]\'></div><div data-lp="board"></div><div data-lp="attend"></div></section>') };
const build = (provider) => K.assemble(site, { v: 2, title: '시험', features: [] }, { runtime: rt, target: 'hosted', prev: { live: { provider, url: provider === 'http' ? 'https://x.workers.dev' : '', anonKey: '', code: 'ABCDEFGH23' }, access: 'link' } });

test('참여 기능 없이: 연습 모드가 아니고 참여 스크립트·강사 화면이 없음', () => {
  const r = build('none');
  assert.equal(r.report.live, 'none');
  assert.equal(r.files['assets/live.js'], undefined);
  assert.equal(r.files['console.html'], undefined);
});
test('참여 기능 없이: 질문·투표·보드·출석 자리에는 입력 칸·버튼 대신 안내 한 줄', () => {
  const h = String(build('none').files['index.html']);
  assert.ok(!/data-qa-form|data-board-form|data-attend="in"/.test(h), '보내지지 않는 입력 칸이 남음');
  assert.equal((h.match(/data-live-off/g) || []).length, 4);
});
test('참여 기능을 연결하면 그대로 켜짐(바뀌지 않음)', () => {
  const r = build('http');
  assert.equal(r.report.live, 'http');
  assert.ok(r.files['assets/live.js'] && r.files['console.html']);
  assert.ok(/data-qa-form/.test(String(r.files['index.html'])));
});
