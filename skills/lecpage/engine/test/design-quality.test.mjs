// 디자인 품질 규칙(references/design-quality.md)이 엔진 기본값에 들어 있는지
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as E from '../src/index.js';
import { nodeRuntime } from '../node.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const EX = (id) => JSON.parse(readFileSync(join(HERE, '..', '..', 'examples', `${id}.blueprint.json`), 'utf8'));

test('강조색은 작은 글자로 써도 바탕과 4.5:1 이상(12프리셋 × 34색 조합)', () => {
  for (const p of E.PRESETS) for (const t of ['light', 'dark']) { const k = E.themeTokens(p, t); assert.ok(E.contrast(k['--primary'], k['--background']) >= 4.5, p.id + t); }
  for (const s of E.PALETTE_SEEDS) for (const t of ['light', 'dark']) { const k = E.themeTokens(E.presetWithOverrides({ preset: 'paper-workbook', palette: s.id }), t); assert.ok(E.contrast(k['--primary'], k['--background']) >= 4.5, s.id + t); }
});

test('프리셋 기본 효과에 섹션마다 등장·카드 기울기·흐르는 띠·그라데이션 글자가 없다', () => {
  for (const p of E.PRESETS) {
    const ids = [...Object.entries(p.effects).map(([k, v]) => `${k}=${v}`)];
    for (const bad of ['section.enter=', '=tilt', '=marquee', '=gradient-text']) assert.ok(!ids.some((x) => x.includes(bad)), `${p.id}: ${bad}`);
  }
});

test('참가자 화면: 상자(lp-card)·알약 꼬리표 없이 줄·글자로 짠다', () => {
  for (const id of ['forest-story', 'data-lab']) {
    const html = E.build(EX(id), { runtime: nodeRuntime() }).files['index.html'];
    const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
    assert.ok(!/class="[^"]*\blp-card\b/.test(main), id + ': lp-card');
    assert.ok(!/class="lp-chip"/.test(main.replace(/data-session-chip/g, '')) || /data-session-chip/.test(main), id + ': lp-chip');
  }
  const css = nodeRuntime().read('lecpage.css');
  assert.doesNotMatch(css, /border-left:\s*[2-9]px\s+solid\s+var\(--(primary|accent)/, '한쪽 색 띠');
  assert.doesNotMatch(css, /background-clip:\s*text/, '그라데이션 글자');
});
