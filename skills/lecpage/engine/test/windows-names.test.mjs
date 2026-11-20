// 윈도우에서 만들 수 없는 파일 이름(AUX·CON·PRN·NUL·COM1~9·LPT1~9, 확장자가 붙어도 안 됨)이 저장소와 생성 사이트에 없는지.
// 저장소에 있으면 윈도우에서 내려받기(git clone)부터 실패하고, 사이트에 있으면 받은 ZIP을 풀 때 그 파일에서 오류가 남.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as E from '../src/index.js';
import { nodeRuntime } from '../node.js';
import { here } from './live-helpers.mjs';

const RESERVED = /(^|\/)(aux|con|prn|nul|com[1-9¹²³]|lpt[1-9¹²³])(\.[^/]*)?(\/|$)/i;
const BAD_CHARS = /[<>:"|?*\\]/;

test('생성 사이트의 파일 이름은 윈도우에서도 풀림', () => {
  for (const ex of ['data-lab', 'sel-story']) {
    const bp = JSON.parse(fs.readFileSync(path.join(here, `../../examples/${ex}.blueprint.json`), 'utf8'));
    bp.live = { provider: 'local', code: 'WINNAMES', features: ['qa', 'poll', 'board', 'attendance'] };
    const { files } = E.build(bp, { runtime: nodeRuntime() });
    const bad = Object.keys(files).filter((p) => RESERVED.test(p) || BAD_CHARS.test(p));
    assert.deepEqual(bad, [], `${ex}: 윈도우에서 만들 수 없는 이름`);
  }
});

test('저장소 파일 이름은 윈도우에서도 내려받아짐', (t) => {
  let list;
  try { list = execFileSync('git', ['ls-files'], { cwd: path.join(here, '../../../..'), encoding: 'utf8' }).split('\n').filter(Boolean); } catch { t.skip('git 저장소가 아님(설치본)'); return; }
  const bad = list.filter((p) => RESERVED.test(p) || BAD_CHARS.test(p));
  assert.deepEqual(bad, [], '윈도우에서 만들 수 없는 이름');
  // 대소문자만 다른 두 파일도 윈도우·macOS에서는 하나로 겹침
  const seen = new Map(); const dup = [];
  for (const p of list) { const k = p.toLowerCase(); if (seen.has(k)) dup.push(`${seen.get(k)} ↔ ${p}`); else seen.set(k, p); }
  assert.deepEqual(dup, [], '대소문자만 다른 파일');
});
