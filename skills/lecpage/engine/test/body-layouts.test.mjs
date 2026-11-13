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
  'schedule.track': /<div class="lp-trk" data-diagram data-linked><div class="lp-trk-bar" data-art aria-hidden="true"><i data-seg class="c0" style="--min:20;--k:0">/, 'schedule.clock': /<div class="lp-clk" data-diagram data-linked>[\s\S]*?class="lp-clk-seg c0" data-seg/, 'schedule.table': /<table class="lp-tbl lp-stbl" data-sched/, 'schedule.blocks': /<ol class="lp-blk" data-sched data-diagram/,
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
  // 몰림을 푼 두 번째 그림 배치 · 수치 도표
  'message.split': /<div class="lp-msplit"><div class="lp-msplit-art" aria-hidden="true"><svg class="lp-motif/,
  'procedure.lanes': /<div class="lp-pl" data-diagram data-linked style="--lanes:3;--n:4"><ol class="lp-pl-heads" aria-hidden="true"><li class="c0" style="--c:1">발견한 교사<\/li>[\s\S]*?<svg class="lp-pl-svg"[\s\S]*?<li class="c2" style="--c:3;--r:4">/,
  'discuss.round': /<div class="lp-rt" data-diagram data-linked style="--n:3"><div class="lp-rt-art" aria-hidden="true"><svg class="lp-rt-svg"[\s\S]*?<span class="lp-rt-c"><b>3<\/b>가지 질문<\/span>/,
  'instructor.career': /<ol class="lp-cr-line" style="--n:3;--cols:3"><li style="--i:0"><span class="lp-cr-dot" aria-hidden="true"><\/span><b class="lp-cr-y">2009~2021<\/b>[\s\S]*?<li class="is-now"/,
  'goals.target': /<div class="lp-tg" data-diagram data-linked style="--n:3"><div class="lp-tg-art" aria-hidden="true"><svg class="lp-tg-svg"/,
  'closing.recap': /<div class="lp-recap"><p class="lp-recap-k">오늘 지나온 길<\/p><ol class="lp-recap-path"/,
  'speakers.axis': /<ol class="lp-sax" data-diagram><li style="--gap:0"><time class="lp-sax-t">14:00<\/time>[\s\S]*?<li style="--gap:20">/,
  'table.chart': /<div class="lp-chart lp-chart--bars[\s\S]*?<details class="lp-chart-tbl" data-print-open><summary>표로 보기<\/summary>/,
  'glance.bars': /<div class="lp-chart lp-chart--bars" role="list"[\s\S]*?<b class="lp-chart-v">173건<\/b>/,
};
/** 수치 도표를 시험할 칸(모든 본문 칸 설계도에는 숫자 표·같은 단위의 한눈에 칸이 없어 이 시험에만 덧붙임) */
const NUMERIC = [
  { id: 'tnum', type: 'table', title: '학교급별 참여 학교', head: ['학교급', '2025', '2026'], rows: [['초등학교', '48곳', '62곳'], ['중학교', '21곳', '30곳'], ['고등학교', '12곳', '19곳']] },
  { id: 'gnum', type: 'glance', title: '해마다 늘어난 신고', items: [{ value: '128건', label: '2024년' }, { value: '173건', label: '2025년' }, { value: '210건', label: '2026년' }] },
];
describe('배치 변형 하나하나', () => {
  test('설계도 layout으로 고르면 그 구조가 그려지고(내용 그대로), 그림은 꾸밈(aria-hidden)', () => {
    const base = load('body-all');
    const seen = new Set();
    for (let k = 1; k < 6; k++) {
      const bp = JSON.parse(JSON.stringify(base)); bp.design = { preset: 'corporate-clean' };
      bp.sections.splice(bp.sections.findIndex((s) => s.type === 'cases'), 0, ...JSON.parse(JSON.stringify(NUMERIC)));
      const site = { sections: bp.sections, instructors: bp.instructors };
      // 내용이 그 배치에 맞을 때만 고름(숫자가 없는 표에 도표를 강제하지 않음 — 그런 칸은 기본 배치로 그려짐, 아래 시험)
      for (const s of bp.sections) { const t = s.type === 'followup' ? 'materials' : s.type; const ids = E.variantIds(t); if (NUMERIC.some((x) => x.id === s.id) && !['chart', 'bars'].includes(ids[k])) continue; if (ids[k] && E.variantOf({ ...s, layout: ids[k] }, 'corporate-clean', site).variant === ids[k]) { s.layout = ids[k]; seen.add(`${t}.${ids[k]}`); } }
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
        for (const svg of h.match(/<svg class="lp-(?:motif|jr-road|wh-ring|tl-svg|gw-svg|pl-svg|rt-svg|tg-svg|donut|bar)\b[^>]*>/g) || []) assert.match(svg, /aria-hidden="true"/, key);
      }
      // 이 사이트에 쓰인 배치의 CSS만 붙음(표지 하나에 배치 여럿을 적을 수 있음)
      const css = r.files['assets/lecpage.css'];
      for (const v of E.usedVariants(validate(bp).blueprint.sections, 'corporate-clean', '', bp.instructors)) if (!E.variantIds(v.split('.')[0])[0] || !v.endsWith('.' + E.variantIds(v.split('.')[0])[0])) assert.match(css, new RegExp(`/\\*@v:[^*]*(?<![\\w.])${v.replace('.', '\\.')}(?![\\w.])[^*]*\\*/`), `CSS ${v}`);
    }
    // 모든 배치가 한 번씩은 시험됨(기본 배치 빼고)
    for (const t of Object.keys(E.BODY_VARIANTS)) for (const v of E.variantIds(t).slice(1)) if (MARK[`${t}.${v}`]) assert.ok(seen.has(`${t}.${v}`), `시험되지 않은 배치 ${t}.${v}`);
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

describe('몰림 풀기 · 수치 도표 · 빈 칸', () => {
  test('한 배치를 27개 프리셋 중 10개 넘게 쓰지 않음(배치가 셋 넘는 종류), 그림 배치가 하나뿐인 칸이 없음', () => {
    const use = {};
    for (const [, spec] of Object.values(E.PRESET_BODY)) for (const w of spec.split(/\s+/)) { const [t, v] = w.split(':'); const k = `${t}.${v.split('@')[0]}`; use[k] = (use[k] || 0) + 1; }
    for (const [k, c] of Object.entries(use)) { const n = E.variantIds(k.split('.')[0]).length; assert.ok(c <= (n >= 3 ? 10 : Math.ceil(E.PRESETS.length / n)), `${k} ${c}/${E.PRESETS.length}`); }
    const graphic = (t) => E.variantIds(t).filter((v) => /^(figure|diagram)$/.test(E.BODY_VARIANTS[t][v].lead)).length;
    for (const t of ['message', 'procedure', 'discuss', 'instructor', 'closing', 'goals']) assert.ok(graphic(t) >= 2, `${t}: 그림 배치 ${graphic(t)}`);
  });
  test('수치 도표는 교재 값이 "숫자 + 같은 단위"일 때만(지어내지 않음): 합이 100%면 도넛, 그 밖은 막대, 글이 섞인 표는 표 그대로', () => {
    const { parseNum, tableChart, glanceSeries } = E;
    assert.deepEqual(parseNum('1,234명'), { n: 1234, unit: '명', raw: '1,234명' });
    assert.deepEqual(parseNum('**45%**'), { n: 45, unit: '%', raw: '45%' });
    for (const x of ['약 30분 안', '3~5명', '2025년', '즉시', '', '10분 이내']) assert.equal(parseNum(x), null, x);
    assert.equal(tableChart(['장소', '비율'], [['운동장', '41%'], ['교실', '27%'], ['복도', '19%'], ['그 밖', '13%']]).kind, 'donut');
    assert.equal(tableChart(['장소', '비율'], [['운동장', '41%'], ['교실', '27%']]).kind, 'bars', '합이 100이 아니면 막대');
    assert.deepEqual(tableChart(['학교급', '2025', '2026'], [['초', '48곳', '62곳'], ['중', '21곳', '30곳']]).cols, [1, 2]);
    assert.equal(tableChart(['정도', '기준', '건수'], [['가벼움', '보건실 처치', '41건'], ['보통', '병원 진료', '12건']]), null, '글 칸이 섞인 표');
    assert.equal(tableChart(['구분', '값'], [['가', '3시간'], ['나', '40분']]), null, '단위가 다름');
    assert.equal(tableChart(['구분', '값'], [['가', '3']]), null, '한 줄');
    assert.equal(glanceSeries([{ value: '150분' }, { value: '4' }, { value: '80%' }]), null, '섞인 단위');
    assert.equal(glanceSeries([{ value: '4' }, { value: '3' }]), null, '단위가 없는 수(단계 수·사례 수는 견주지 않음)');
    assert.ok(glanceSeries([{ value: '128건' }, { value: '173건' }]));
    // 숫자 표는 프리셋이 기본(표)을 골랐으면 도표로, 숫자가 없으면 그대로
    const num = { type: 'table', head: ['학교급', '수'], rows: [['초', '48곳'], ['중', '21곳']] }, txt = { type: 'table', head: ['정도', '조치'], rows: [['가벼움', '기록'], ['보통', '연락']] };
    const plainPreset = E.PRESET_IDS.find((id) => E.variantOf(txt, id).variant === 'table');
    assert.equal(E.variantOf(num, plainPreset).variant, 'chart');
    // 도표: 값은 글로, 원래 표는 '표로 보기'(인쇄할 때 펼침)
    const html = build({ meta: { title: 't' }, sections: [{ type: 'hero' }, { id: 'tn', type: 'table', layout: 'chart', title: '사고 장소', head: ['장소', '비율'], rows: [['운동장', '41%'], ['교실', '27%'], ['복도', '19%'], ['그 밖', '13%']] }] }).files['index.html'];
    const h = sec(html, 'tn');
    assert.match(h, /<svg class="lp-donut" viewBox="0 0 42 42" aria-hidden="true"/);
    assert.match(h, /<ul class="lp-chart-leg" aria-label="사고 장소 \(단위 %\)"><li><i class="lp-sw c0" aria-hidden="true"><\/i><span>운동장<\/span><b class="lp-chart-v">41%<\/b>/);
    assert.match(h, /<details class="lp-chart-tbl" data-print-open><summary>표로 보기<\/summary>[\s\S]*?<th[^>]*>비율<\/th>/);
  });
  test('새 그림 배치는 교재 값이 그 그림을 채울 때만', () => {
    const v = (s, site) => E.variantOf(s, 'x', site).variant;
    const steps = (who) => who.map((w, i) => ({ title: `s${i}`, who: w }));
    assert.equal(v({ type: 'procedure', layout: 'lanes', items: steps(['담임', '보건', '담임']) }), 'lanes');
    assert.equal(v({ type: 'procedure', layout: 'lanes', items: steps(['담임', '담임']) }), 'rail', '담당이 하나');
    assert.equal(v({ type: 'procedure', layout: 'lanes', items: [{ title: 'a', who: '담임' }, { title: 'b' }] }), 'rail', '담당이 빈 단계');
    assert.equal(v({ type: 'speakers', layout: 'axis', items: [{ name: 'a', time: '14:00' }, { name: 'b', time: '13:00' }] }), 'people', '시각이 거꾸로');
    assert.equal(v({ type: 'instructor', layout: 'career' }, { sections: [], instructors: [{ name: 'a', timeline: [{ group: 'g', items: [{ text: 'x' }] }] }] }), 'profile', '이력 하나');
    assert.equal(v({ type: 'closing', layout: 'recap' }, { sections: [{ type: 'outline', items: [{ title: 'a' }, { title: 'b' }] }] }), 'finale', '차례 둘');
    assert.deepEqual(E.recapWords([{ type: 'stations', items: [{ name: '하나' }, { name: '둘' }, { name: '셋' }] }]), ['하나', '둘', '셋']);
    assert.equal(v({ type: 'materials', layout: 'pile', items: [{ title: 'a' }] }), 'files', '한 장은 더미가 아님');
  });
  test('빈 설문 칸(주소·받을 문항 없음)은 참가자 화면·차례에서 빠지고, 강사 미리보기에서는 채울 곳으로', () => {
    const bp = { meta: { title: 't' }, sections: [{ type: 'hero' }, { type: 'goals', items: ['a'] }, { id: 'sv', type: 'survey', nav: '설문', title: '만족도 조사' }] };
    const out = build(bp).files['index.html'];
    assert.ok(!out.includes('id="sv"') && !out.includes('href="#sv"'));
    assert.doesNotMatch(out, /설문 주소가 아직 없어요/);
    const pre = E.build(bp, { runtime: nodeRuntime(), preview: true }).files['index.html'];
    assert.match(sec(pre, 'sv'), /<p class="lp-note lp-todo" data-todo>채울 곳: 설문 주소를 넣으면/);
    assert.match(build({ ...bp, sections: [...bp.sections.slice(0, 2), { id: 'sv', type: 'survey', url: 'https://forms.gle/x' }] }).files['index.html'], /id="sv"/);
  });
  test('실습 프롬프트: 글이 다 보이는 높이로 시작(잘리지 않음), 막히면 도움말 상자', () => {
    assert.equal(E.promptRows('짧은 글'), 2);
    assert.equal(E.promptRows('가'.repeat(63)), 3);
    assert.equal(E.promptRows('역할: 가\n조건: 나\n형식: 다'), 3);
    const html = build({ meta: { title: 't' }, sections: [{ type: 'hero' }, { type: 'stations', items: [{ title: '실습', steps: ['a'], note: '막히면: 새로 고침', prompts: [{ text: '너는 초등학교 5학년 과학 교사야. 학습 목표를 학생이 이해할 말로 3개 써 줘. 각 목표는 한 문장으로 써 줘.' }] }] }] }).files['index.html'];
    assert.match(html, /<textarea class="lp-prompt-text"[^>]*rows="3"/);
    assert.match(html, /<div class="lp-st-help" role="note"><b>[\s\S]*?<span>도움말<\/span><\/b><p>막히면: 새로 고침<\/p><\/div>/);
    assert.doesNotMatch(html, /<h4>프롬프트<\/h4>/, '하나뿐인 이름 없는 프롬프트는 머리를 두 번 쓰지 않음');
    assert.match(nodeRuntime().read('lecpage.css'), /\.lp-prompt-text\{[^}]*field-sizing:content/);
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
