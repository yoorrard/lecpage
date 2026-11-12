// 본문 배치 변형(design/layouts.js · render/body-variants.js · runtime/body.css):
// 프리셋마다 본문 구성 자체가 다르고(정렬만 다른 것은 같다고 셈), 그림·도식이 주인공인 본문이 있고, 움직임이 꺼져도 다 보이는지
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import * as E from '../src/index.js';
import { nodeRuntime } from '../node.js';
import { validate } from '../src/validate.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const BPS = { 'sel-story': join(HERE, '..', '..', 'examples', 'sel-story.blueprint.json'), 'data-lab': join(HERE, '..', '..', 'examples', 'data-lab.blueprint.json'), 'body-all': join(HERE, 'fixtures', 'body-all.blueprint.json') };
const load = (k) => JSON.parse(readFileSync(BPS[k], 'utf8'));
const build = (bp) => E.build(bp, { runtime: nodeRuntime() });
const sectionsOf = (k) => validate(load(k)).blueprint;
const sec = (html, id) => new RegExp(`<section id="${id}"[\\s\\S]*?</section>`).exec(html)?.[0] || '';

describe('프리셋마다 본문 구성이 다름(설계도 셋 × 프리셋 27개)', () => {
  for (const k of Object.keys(BPS)) {
    test(`${k}: 어느 두 프리셋도 본문 섹션 배치가 절반 넘게 같지 않고, 그래픽 주인공 2개 이상·글만 절반 이하·왼쪽이 아닌 섹션 2개 이상`, () => {
      const bp = sectionsOf(k), body = bp.sections.filter((s) => s.type !== 'hero'), half = Math.floor(body.length / 2), site = { sections: bp.sections, flow: bp.structure?.flow };
      const fp = Object.fromEntries(E.PRESET_IDS.map((id) => [id, E.bodyFingerprint(bp.sections, id, bp.structure?.flow)]));
      for (let i = 0; i < E.PRESET_IDS.length; i++) for (let j = i + 1; j < E.PRESET_IDS.length; j++) {
        const a = fp[E.PRESET_IDS[i]], b = fp[E.PRESET_IDS[j]], same = a.filter((x, n) => x === b[n]).length;
        assert.ok(same <= half, `${k}: ${E.PRESET_IDS[i]} × ${E.PRESET_IDS[j]} 같은 배치 ${same}/${body.length}`);
      }
      for (const p of E.PRESETS) {
        const vs = body.map((s) => E.variantOf(s, p.id, site)), lead = vs.map((v, n) => v.meta?.lead || (/^(stations|attendance|prompts)$/.test(body[n].type) ? 'tool' : 'text'));
        const graphic = vs.filter((v, n) => !['deck', 'gallery'].includes(v.type) && /^(figure|diagram)$/.test(lead[n])).length;
        const textOnly = lead.filter((x) => x === 'text').length;
        const nonLeft = ['center', 'right'].includes(p.variants.align) ? body.length : vs.filter((v) => v.stance).length;
        assert.ok(graphic >= 2, `${k}/${p.id}: 그래픽 주인공 ${graphic}`);
        assert.ok(textOnly <= half, `${k}/${p.id}: 글만 ${textOnly}/${body.length}`);
        assert.ok(nonLeft >= 2, `${k}/${p.id}: 왼쪽이 아닌 섹션 ${nonLeft}`);
      }
    });
  }
  test('섹션 종류마다 구조가 다른 배치가 둘 넘게(주요 본문 칸은 셋 넘게), 프리셋 계획은 있는 변형만 씀', () => {
    for (const t of ['goals', 'glance', 'steps5', 'outline', 'schedule', 'tools', 'materials', 'instructor', 'sessions', 'faq', 'glossary', 'procedure', 'cases', 'discuss', 'table', 'closing']) assert.ok(E.variantIds(t).length >= 3, t);
    for (const t of ['goals', 'outline', 'schedule']) assert.ok(E.variantIds(t).length >= 5, t);
    for (const [id, [fam, spec]] of Object.entries(E.PRESET_BODY)) {
      assert.ok(E.PRESET_IDS.includes(id), id); assert.match(fam, /^(rings|dots|tiles|waves|arcs|blocks|stars|glyph|grid)$/);
      for (const w of spec.split(/\s+/)) { const [t, v] = w.split(':'); assert.ok(E.BODY_VARIANTS[t]?.[v.split('@')[0]], `${id}: ${w}`); }
    }
    assert.equal(Object.keys(E.PRESET_BODY).length, E.PRESETS.length);
  });
});

/** 변형마다 그 구조를 알아볼 수 있는 표식(서버가 그린 HTML) */
const MARK = {
  'goals.manifesto': /<ol class="lp-say"/, 'goals.journey': /<ol class="lp-jr" data-diagram[\s\S]*?<svg class="lp-jr-road"/, 'goals.bento': /<ol class="lp-gb"[\s\S]*?data-w="7"/, 'goals.columns': /<ol class="lp-gc" style="--n:3;--c:3"/,
  'glance.tally': /<dl class="lp-tl" data-diagram[\s\S]*?<svg class="lp-tl-svg"/, 'glance.spec': /<dl class="lp-spec">/,
  'message.stage': /<div class="lp-stage-art" aria-hidden="true"><svg class="lp-motif/,
  'steps5.wheel': /<div class="lp-wh" data-diagram data-linked[\s\S]*?<g class="lp-wh-node" data-seg/, 'steps5.flow': /<ol class="lp-fl" data-diagram/, 'steps5.tabs': /<div class="lp-tb lp-tb--words" data-pager><nav class="lp-tb-list"[^>]*><a href="#steps-p0" aria-current="true">/,
  'outline.zigzag': /<ol class="lp-zz"[\s\S]*?<div class="lp-ol-art" aria-hidden="true"><svg class="lp-motif/, 'outline.bento': /<ol class="lp-ob"/, 'outline.toc': /<ol class="lp-toc"/, 'outline.filmstrip': /<div class="lp-film" data-film><ol class="lp-film-track" tabindex="0"/,
  'schedule.track': /<div class="lp-trk" data-diagram data-linked><div class="lp-trk-bar" aria-hidden="true"><i data-seg class="c0" style="--min:20;--k:0">/, 'schedule.clock': /<div class="lp-clk" data-diagram data-linked>[\s\S]*?class="lp-clk-seg c0" data-seg/, 'schedule.table': /<table class="lp-tbl lp-stbl" data-sched/, 'schedule.blocks': /<ol class="lp-blk" data-sched data-diagram/,
  'procedure.flow': /<ol class="lp-pf" data-diagram/, 'procedure.cards': /<ol class="lp-pc"/,
  'table.rowcards': /<div class="lp-rc" role="list"/, 'table.compare': /<div class="lp-cmp" role="list"[^>]*style="--n:2;--rows:3"/,
  'cases.quote': /<div class="lp-cqs"/, 'cases.notes': /<div class="lp-cns"/,
  'discuss.bigq': /<span class="lp-bq2-mark" data-art aria-hidden="true">\?<\/span>/, 'discuss.bubbles': /<ol class="lp-bub">/,
  'tools.rows': /<ol class="lp-trw"/, 'tools.tiles': /<ol class="lp-tt"/,
  'materials.shelf': /<div class="lp-shelfw" data-linked><div class="lp-shelf" data-art aria-hidden="true"><span class="lp-book c0" data-seg/, 'materials.pile': /<ul class="lp-pile"/,
  'instructor.card': /<div class="lp-bc">/, 'instructor.portrait': /<div class="lp-pt-face" data-art aria-hidden="true"><svg class="lp-motif/,
  'speakers.lineup': /<ol class="lp-lineup">/, 'sessions.map': /<ol class="lp-smap" data-diagram/, 'sessions.grid': /<ol class="lp-sgrid"[^>]*>[\s\S]*?<b>3\.18<\/b>/,
  'faq.twocol': /<dl class="lp-fq2">/, 'faq.index': /<div class="lp-fqi" data-spy><nav class="lp-fqi-nav"/,
  'glossary.cards': /<dl class="lp-gcards"/, 'glossary.dict': /<dl class="lp-dict">/, 'glossary.web': /<div class="lp-gw" data-diagram data-linked[\s\S]*?<span class="lp-gw-n" data-node/,
  'closing.poster': /data-variant="poster"[\s\S]*?<div class="lp-poster-art" aria-hidden="true"><svg class="lp-motif/, 'closing.card': /<div class="lp-closing-card">/,
};
describe('배치 변형 하나하나', () => {
  test('설계도 layout으로 고르면 그 구조가 그려지고(내용 그대로), 그림은 꾸밈(aria-hidden)', () => {
    const base = load('body-all');
    for (let k = 1; k < 5; k++) {
      const bp = JSON.parse(JSON.stringify(base)); bp.design = { preset: 'corporate-clean' };
      for (const s of bp.sections) { const t = s.type === 'followup' ? 'materials' : s.type; const ids = E.variantIds(t); if (ids[k]) s.layout = ids[k]; }
      const r = build(bp), html = r.files['index.html'];
      assert.deepEqual(r.errors || [], []);
      for (const s of bp.sections) {
        if (!s.layout) continue;
        const t = s.type === 'followup' ? 'materials' : s.type, key = `${t}.${s.layout}`, h = sec(html, s.id || s.type);
        assert.match(h, new RegExp(`data-variant="${s.layout}"`), key);
        if (MARK[key]) assert.match(h, MARK[key], key);
        // 내용이 빠지지 않음: 섹션 제목과 첫 항목
        if (s.title) assert.ok(h.includes(s.title.split('\n')[0]), `${key}: 제목`);
        const first = s.items?.[0]; const word = typeof first === 'string' ? first : first?.title || first?.term || first?.q || first?.word || first?.name || first?.label;
        if (word && s.type !== 'glance') assert.ok(h.includes(word), `${key}: 첫 항목 "${word}"`);
        // 꾸밈 그림은 화면 낭독기에서 빠짐
        for (const svg of h.match(/<svg class="lp-(?:motif|jr-road|wh-ring|tl-svg|gw-svg)[^>]*>/g) || []) assert.match(svg, /aria-hidden="true"/, key);
      }
      // 이 사이트에 쓰인 배치의 CSS만 붙음
      const css = r.files['assets/lecpage.css'];
      for (const v of E.usedVariants(validate(bp).blueprint.sections, 'corporate-clean')) if (!E.variantIds(v.split('.')[0])[0] || !v.endsWith('.' + E.variantIds(v.split('.')[0])[0])) assert.ok(css.includes(`/*@v:${v}*/`), `CSS ${v}`);
    }
  });
  test('설계도 layout 값: 그 섹션 종류의 변형만 받고(자세 @c·@r·@l 포함), 실습의 layout은 그대로', () => {
    const { blueprint: b } = validate({ meta: { title: 't' }, sections: [{ type: 'goals', layout: 'journey@c', items: ['a', 'b'] }, { type: 'faq', layout: 'journey', items: [{ q: 'q', a: 'a' }] }, { type: 'stations', layout: 'tabs', items: [{ title: 'x', steps: ['y'] }] }] });
    assert.equal(b.sections.find((s) => s.type === 'goals').layout, 'journey@c');
    assert.equal(b.sections.find((s) => s.type === 'faq').layout, undefined);
    assert.equal(b.sections.find((s) => s.type === 'stations').layout, 'tabs');
    const v = E.variantOf(b.sections.find((s) => s.type === 'goals'), 'paper-workbook');
    assert.equal(v.variant, 'journey'); assert.equal(v.stance, 'center'); assert.ok(v.own);
  });
  test('내용이 배치에 맞지 않으면 기본 배치로(길이를 모르는 일정·여러 날 일정은 시간 도식을 쓰지 않음)', () => {
    const s = { type: 'schedule', layout: 'track', items: [{ start: '09:00', title: 'a', date: '2027-01-01' }, { start: '10:00', title: 'b', date: '2027-01-02' }] };
    assert.equal(E.variantOf(s, 'time-dial').variant, 'timeline');
    assert.equal(E.variantOf({ ...s, items: [{ start: '09:00', end: '09:30', title: 'a' }, { start: '09:30', end: '10:00', title: 'b' }] }, 'x').variant, 'track');
    assert.equal(E.variantOf({ type: 'glossary', layout: 'web', items: [{ term: 'a' }, { term: 'b' }] }, 'x').variant, 'index');
  });
  test('같은 종류의 칸이 둘이면(한눈에 보기 둘) 두 번째는 다른 배치', () => {
    for (const p of E.PRESET_IDS) {
      const bp = { meta: { title: 't' }, design: { preset: p }, sections: [{ type: 'hero' }, { id: 'g1', type: 'glance', items: [{ value: '120명', label: '참석' }, { value: '3', label: '분과' }] }, { type: 'goals', items: ['a', 'b'] }, { id: 'g2', type: 'glance', items: [{ value: '45%', label: '증가' }, { value: '12', label: '학교' }] }] };
      const html = build(bp).files['index.html'], v = (id) => /data-variant="([a-z]+)"/.exec(sec(html, id))?.[1];
      assert.ok(v('g1') && v('g2') && v('g1') !== v('g2'), `${p}: ${v('g1')} / ${v('g2')}`);
    }
  });
  test('교재 구성 흐름(structure.flow)의 주인공 칸: 프리셋이 기본 배치를 골랐을 때만 그림·도식으로', () => {
    const proc = { type: 'procedure', items: [{ title: 'a' }, { title: 'b' }, { title: 'c' }] };
    const rail = E.PRESET_IDS.find((id) => E.variantOf(proc, id).variant === 'rail');
    assert.ok(rail, '절차를 기본 배치로 두는 프리셋');
    assert.equal(E.variantOf(proc, rail, { sections: [proc], flow: 'procedure' }).variant, 'flow');
    const other = E.PRESET_IDS.find((id) => E.variantOf(proc, id).variant === 'cards');
    if (other) assert.equal(E.variantOf(proc, other, { sections: [proc], flow: 'procedure' }).variant, 'cards');
  });
});

describe('움직임: 본문 전 구간, 꺼지면 다 보임', () => {
  const css = nodeRuntime().read('body.css'), js = nodeRuntime().read('lecpage.js');
  test('스크롤 연동은 동작 줄이기가 아닐 때·지원하는 브라우저·html.lp-sdt에서만, 들어올 때 한 번은 lp-sdt가 아닐 때만(같은 요소를 두 움직임이 움직이지 않게)', () => {
    for (const m of css.matchAll(/animation-timeline:view\((?:inline)?\)[;}]/g)) {
      const before = css.slice(0, m.index), line = before.slice(before.lastIndexOf('\n'));
      assert.match(line, /html\.lp-sdt:not\(\.lp-paused\):not\(\.fx-paused\)/, line.slice(0, 80));
      assert.ok(before.lastIndexOf('@supports (animation-timeline:view())') > before.lastIndexOf('/*@v:'), '지원 검사 안');
      assert.ok(before.lastIndexOf('@media (prefers-reduced-motion:no-preference)') > before.lastIndexOf('/*@v:'), '동작 줄이기 검사 안');
    }
    for (const line of css.split('\n').filter((l) => /\[data-fx-pre\][^{]*\{/.test(l))) assert.match(line, /html:not\((?:\.lp-sdt\)|\[data-rest="0"\]\))/, line.slice(0, 80));
    assert.match(js, /CSS\.supports\('animation-timeline: view\(\)'\)/); assert.match(js, /root\.classList\.add\('lp-sdt'\)/);
    // 스크롤 연동 단계의 등장 낱개는 스크롤이 직접 움직이는 요소를 뺌(선언문 문장·여정 정류장·고리)
    for (const [t, v] of [['goals', 'manifesto'], ['goals', 'journey'], ['steps5', 'wheel']]) assert.ok(!/lp-say > li|lp-jr > li|lp-wh-ring/.test(E.BODY_VARIANTS[t][v].enter2), `${t}.${v}`);
    // 붙박이(sticky) 요소는 등장 낱개가 아님
    for (const [t, v] of [['instructor', 'portrait'], ['faq', 'index'], ['discuss', 'bubbles']]) assert.ok(!/lp-pt-face|lp-fqi-nav|lp-discuss-rules/.test(E.BODY_VARIANTS[t][v].enter), `${t}.${v}`);
  });
  test('섹션 종류마다 등장 방식이 다르고(떠오르기 하나로 몰리지 않음), 제 그림이 움직이는 배치가 프리셋마다 셋 넘게', () => {
    const bp = sectionsOf('body-all');
    for (const p of E.PRESETS) {
      const html = build({ ...load('body-all'), design: { preset: p.id, motion: 2 }, audience: { ...load('body-all').audience, devices: ['laptop'] } }).files['index.html'];
      const modes = [...html.matchAll(/data-fx-opts='\{&quot;mode&quot;:&quot;(\w+)&quot;/g)].map((m) => m[1]);
      assert.ok(new Set(modes).size >= 3, `${p.id}: ${[...new Set(modes)]}`);
      assert.ok(modes.filter((m) => m === 'rise').length <= modes.length / 2, `${p.id}: 떠오르기 ${modes.filter((m) => m === 'rise').length}/${modes.length}`);
      const moving = bp.sections.filter((s) => E.MOTION_VARIANTS.includes(`${s.type === 'followup' ? 'materials' : s.type}.${E.variantOf(s, p.id, bp.sections).variant}`)).length;
      assert.ok(moving >= 3, `${p.id}: 움직이는 배치 ${moving}`);
    }
  });
  test('넘김·필름 띠·질문 색인은 아무것도 숨기지 않음(링크·가로 스크롤이 JS 없이 동작), 인쇄에서는 세로로 다 펼침', () => {
    assert.doesNotMatch(css, /\.lp-tb-panel\{[^}]*(display:none|visibility:hidden)/);
    assert.match(css, /@media print\{\.lp-tb-panels\{grid-auto-flow:row;overflow:visible\}/);
    assert.match(css, /@media print\{\.lp-film-track\{grid-auto-flow:row;overflow:visible\}/);
    assert.match(css, /html\.js \.lp-film-nav\{visibility:visible\}/, '단추 자리는 처음부터 잡아 둠(밀림 없음)');
    // 디자인 규칙: 한쪽 색 띠·알약·그라데이션 글자 없음, 가짜 로고(이름 첫 글자 딱지) 없음
    assert.doesNotMatch(css, /border-left:\s*[2-9]px\s+solid\s+var\(--(primary|accent)/); assert.doesNotMatch(css, /border-radius:\s*999/); assert.doesNotMatch(css, /background-clip:\s*text/);
    assert.doesNotMatch(build({ ...load('body-all'), design: { preset: 'playground' } }).files['index.html'], /lp-tt-mark/);
  });
  test('숫자 세기: 세기 전·처음부터 보이던 숫자는 실제 값 그대로', () => {
    const c = nodeRuntime().read('fx/effects/counter.js');
    assert.ok(c.indexOf('num.textContent = fmt(from)') > c.indexOf('ctx.visible(el'), '0으로 바꾸는 것은 화면에 들어온 뒤');
    assert.match(c, /r0\.top < \(window\.innerHeight/);
  });
});

// 겹침 검사 축약판: Playwright가 있으면 두 프리셋 × 두 폭에서 모든 본문 칸 설계도를 훑음(전 프리셋·폭·테마·단계는 docs/research/design-body-2026-11.md의 게이트)
test('겹침·꼬임 축약 검사(모든 본문 칸 × 2프리셋 × 1280·390)', { timeout: 240000 }, async (t) => {
  let chromium; try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { try { ({ chromium } = createRequire('/opt/node-tools/')('playwright')); } catch { return t.skip('Playwright 없음'); } }
  const { scanPage } = await import('../../scripts/overlap-lint.mjs');
  const { createServer } = await import('node:http'); const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs'); const { tmpdir } = await import('node:os'); const { readFile } = await import('node:fs/promises'); const { extname } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'lpbody-'));
  for (const p of ['night-story', 'swiss-offset']) { const r = build({ ...load('body-all'), design: { preset: p } }); for (const [f, c] of Object.entries(r.files)) { const fp = join(dir, p, f); mkdirSync(dirname(fp), { recursive: true }); writeFileSync(fp, c); } }
  const srv = createServer(async (q, r) => { try { const b = await readFile(join(dir, decodeURIComponent(q.url.split('?')[0]))); r.writeHead(200, { 'content-type': { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript' }[extname(q.url.split('?')[0])] || 'application/octet-stream' }); r.end(b); } catch { r.writeHead(404); r.end(); } });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  let browser; try { browser = await chromium.launch(); } catch { srv.close(); rmSync(dir, { recursive: true, force: true }); return t.skip('Chromium 실행 실패'); }
  try {
    for (const p of ['night-story', 'swiss-offset']) for (const w of [1280, 390]) {
      const page = await browser.newPage({ viewport: { width: w, height: w < 700 ? 780 : 860 } });
      await page.goto(`http://127.0.0.1:${srv.address().port}/${p}/index.html`, { waitUntil: 'load' }); await page.waitForTimeout(600);
      const { findings } = await scanPage(page, { stops: [0, 0.25, 0.5, 0.75, 1], settle: 700, mid: 140 });
      assert.deepEqual(findings.map((f) => `${f.rule}: ${f.samples[0]}`), [], `${p}/${w}`);
      await page.close();
    }
  } finally { await browser.close(); srv.close(); rmSync(dir, { recursive: true, force: true }); }
});
