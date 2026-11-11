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
  for (const id of ['sel-story', 'data-lab']) {
    const html = E.build(EX(id), { runtime: nodeRuntime() }).files['index.html'];
    const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
    assert.ok(!/class="[^"]*\blp-card\b/.test(main), id + ': lp-card');
    assert.ok(!/class="lp-chip"/.test(main.replace(/data-session-chip/g, '')) || /data-session-chip/.test(main), id + ': lp-chip');
  }
  const css = nodeRuntime().read('lecpage.css');
  assert.doesNotMatch(css, /border-left:\s*[2-9]px\s+solid\s+var\(--(primary|accent)/, '한쪽 색 띠');
  assert.doesNotMatch(css, /background-clip:\s*text/, '그라데이션 글자');
});

test('OKLCH 12단계 색띠: 9단계가 고른 색, 글자 단계는 바탕 위에서 읽힘, 범위 밖 색도 sRGB 안으로', () => {
  for (const hex of ['#5B49B0', '#c7364f', '#0b5cad', '#d7f75b', '#111111', '#ffffff']) {
    const r = E.ramp12(hex);
    assert.equal(r.light.length, 12); assert.equal(r.dark.length, 12);
    for (const t of ['light', 'dark']) {
      assert.ok(r[t].every((c) => /^#[0-9a-f]{6}$/.test(c)), `${hex} ${t} hex`);
      assert.ok(E.contrast(r[t][10], r[t][0]) >= 4.5, `${hex} ${t} 11단계 글자 대비`);
      assert.ok(E.contrast(r[t][11], r[t][0]) >= 7, `${hex} ${t} 12단계 글자 대비`);
    }
  }
  assert.equal(E.ramp12('#5B49B0').light[8], '#5b49b0', '중간 밝기 색은 9단계에 그대로');
  assert.equal(E.fromOklch(E.toOklch('#c7364f')), '#c7364f', '왕복 변환');
  assert.equal(E.ramp12('nope'), null);
});

test('디자인 토큰(DTCG): 사이트 CSS 변수와 같은 값, 강사용 파일 tokens.json으로 나옴', () => {
  const bp = JSON.parse(readFileSync(join(HERE, '..', '..', 'examples', 'data-lab.blueprint.json'), 'utf8'));
  bp.design = { ...bp.design, accent: '#5B49B0' };
  const r = E.build(bp, { runtime: nodeRuntime() });
  assert.deepEqual(r.errors, []);
  assert.ok(!('tokens.json' in r.files), '올리는 사이트에는 넣지 않음');
  const t = JSON.parse(r.teacher['tokens.json']);
  for (const theme of ['light', 'dark']) {
    const css = E.themeTokens(E.presetWithOverrides(r.design), theme, { accent: r.design.accent });
    assert.equal(t.color[theme].primary.$type, 'color');
    assert.equal(t.color[theme].primary.$value.hex, css['--primary'].toLowerCase());
    assert.equal(t.color[theme].background.$value.hex, css['--background'].toLowerCase());
    assert.equal(t.color[theme].primary.$value.components.length, 3);
    assert.equal(Object.keys(t.color.ramp[theme]).length, 12);
  }
  assert.equal(t.color.ramp.light['9'].$value.hex, '#5b49b0');
  assert.equal(t.font.display.$type, 'fontFamily'); assert.ok(Array.isArray(t.font.display.$value) && t.font.display.$value.length);
  assert.equal(t.radius.base.$value.unit, 'px');
  assert.equal(t.motion.duration['2'].$value.unit, 'ms');
  assert.equal(t.motion.easing.out.$value.length, 4);
});
