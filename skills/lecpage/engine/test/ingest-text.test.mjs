// 교재 읽기·런타임 CSS 덜기 단위 시험(예전 fidelity·journey 시험에서 남는 코드의 것만 옮김)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tidyPdfLine } from '../src/ingest/pdf.js';
import { pagesForImages } from '../src/ingest/util.js';
import { pruneUnusedCss } from '../src/css-prune.js';

const HERE = dirname(fileURLToPath(import.meta.url));

test('PDF 글 조각 틈: 영문 뒤 조사·숫자 뒤 단위·요일 괄호(pdf.js 길과 파이썬 길이 같음)', () => {
  const cases = [['생성형 AI 로 수업 자료 만들기', '생성형 AI로 수업 자료 만들기'], ['결과물을 11 월 27일 (금) 까지', '결과물을 11월 27일(금) 까지'], ['수업 지도안 1 부', '수업 지도안 1부'], ['AI 로봇 만들기', 'AI 로봇 만들기'], ['PPT 를 열고', 'PPT를 열고']];
  for (const [a, b] of cases) assert.equal(tidyPdfLine(a), b, a);
  const py = spawnSync('python3', ['-I', '-c', `import importlib.util,json,sys\nspec=importlib.util.spec_from_file_location('i', ${JSON.stringify(join(HERE, '../../scripts/ingest.py'))}); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)\nprint(json.dumps([m.tidy(x) for x in json.loads(sys.argv[1])], ensure_ascii=False))`, JSON.stringify(cases.map((c) => c[0]))], { encoding: 'utf8' });
  if (py.status === 0) assert.deepEqual(JSON.parse(py.stdout), cases.map((c) => c[1]), '파이썬 보조 길도 같은 결과');
});

test('6. 숨긴 쪽을 그리지 않은 변환이면 숨긴 쪽을 건너뛰고 그림을 맞춤', () => {
  const pages = Array.from({ length: 21 }, (_, i) => ({ page: i + 1, hidden: i + 1 === 20 }));
  assert.deepEqual(pagesForImages(pages, 20).map((p) => p.page).slice(-2), [19, 21], '그림 20장 = 보이는 쪽 20개');
  assert.equal(pagesForImages(pages, 21).length, 21, '숨긴 쪽도 그렸으면 모든 쪽');
  assert.equal(pagesForImages(pages, 21, true).length, 20, '짝 PDF가 숨긴 쪽을 뺐으면 보이는 쪽만');
});

test('가볍게: 런타임 CSS에서 이 사이트가 쓰지 않는 규칙만 뺌', () => {
  const css = '/*@v:goals.x*/.lp-a{color:red}.lp-b{color:blue}.lp-a:not(.lp-zz){x:1}[data-preset="p1"] .lp-a{x:2}[data-preset="p2"] .lp-a{x:3}'
    + '.lp-rip-g3{x:4}@media (min-width:9px){.lp-b{x:5}.lp-a{x:6}}@keyframes used{to{x:1}}@keyframes gone{to{x:1}}.lp-a{animation:used 1s}[data-theme="dark"] .lp-a{x:7}';
  const used = '<html data-preset="p1"><p class="lp-a">…</p><script>el.className = \'lp-rip-g\' + n;</script>';
  const out = pruneUnusedCss(css, used);
  for (const keep of ['/*@v:goals.x*/', '.lp-a{color:red}', '.lp-a:not(.lp-zz)', '[data-preset="p1"] .lp-a', '.lp-rip-g3', '@media (min-width:9px){.lp-a{x:6}}', '@keyframes used', '[data-theme="dark"] .lp-a']) assert.ok(out.includes(keep), keep);
  for (const drop of ['.lp-b', '[data-preset="p2"]', '@keyframes gone']) assert.ok(!out.includes(drop), drop);
});
