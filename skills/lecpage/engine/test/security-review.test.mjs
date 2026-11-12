// 보안 검토(2026-11b) 회귀 시험: 글 칸 소제목의 느려짐, 교재 읽기의 느려짐, 강사 확인 전 주소, 짧은 주소와 QR.
// 근거: docs/research/security-review-2026-11b.md
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { zipSync, strToU8 } from '../vendor/fflate.js';
import * as E from '../src/index.js';
import { mdStr } from '../src/validate.js';
import { ingestFile, ingestText, materialToDraft } from '../src/ingest/index.js';
import { nodeRuntime, writeFiles } from '../node.js';

const ms = (fn) => { const t = performance.now(); fn(); return performance.now() - t; };
const site = (sections, meta = {}) => E.build({ meta: { title: '연수', ...meta }, sections: [{ type: 'hero' }, ...sections] }, { runtime: nodeRuntime() });

test('글 칸·FAQ 답: 소제목 줄의 긴 빈칸이 빌드를 멈추지 않음(줄여도 보이는 글자는 같음)', () => {
  const evil = '# 제목' + ' '.repeat(5900) + '끝';
  const t = ms(() => {
    const r = site([{ type: 'text', title: '글', md: evil }, { type: 'faq', title: '묻고 답하기', items: [{ q: '질문', a: '## 답' + ' '.repeat(1100) + '끝' }] }]);
    assert.equal(r.errors?.length || 0, 0);
    assert.match(r.files['index.html'], /<h3>제목 끝<\/h3>/);
  });
  assert.ok(t < 3000, `빌드 ${Math.round(t)}ms`); // 고치기 전에는 1분 넘게 걸림
  // 소제목이 아닌 줄(코드 들여쓰기·본문 빈칸)은 그대로
  assert.equal(mdStr('```\n    code\n```\n본문   여러 칸\n# 소제목    둘', 6000), '```\n    code\n```\n본문   여러 칸\n# 소제목 둘');
  assert.equal(mdStr('문단\r\n\r\n#  a  #', 100), '문단\n\n# a #');
});
