// 배치가 다른 디자인(글 정렬·그림이 이끄는 첫 화면) · 페이지 연출 계획(첫 화면 밖 전 구간) · 컨셉 먼저
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as E from '../src/index.js';
import { nodeRuntime } from '../node.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const EX = (id) => JSON.parse(readFileSync(join(HERE, '..', '..', 'examples', `${id}.blueprint.json`), 'utf8'));
const heroOf = (html) => /<section[^>]*class="[^"]*\blp-hero\b[^"]*"[^>]*>[\s\S]*?<\/section>/.exec(html)[0];
const sections = (html) => [...html.matchAll(/<section id="[^"]*" class="lp-sec ([^" ]*)[^"]*"([^>]*)>([\s\S]*?)<\/section>/g)].map((m) => ({ type: m[1].replace(/^lp-sec-/, '').replace(/^lp-/, ''), tag: m[2], body: m[3] }));
const build = (ex, design, patch) => { const bp = EX(ex); bp.design = design; if (patch) patch(bp); return E.build(bp, { runtime: nodeRuntime() }); };

// 프리셋 → [첫 화면 구성, 글 배치, 본문 정렬 문법, 첫 화면에 서버가 그려 둔 것]
const LAYOUT = {
  'ripple-center': ['ripple', 'center', 'center', /<div class="lp-rip"[^>]*aria-hidden="true"><svg[^>]*><g class="lp-rip-g0"/],
  'minute-map': ['minutes', 'data', 'ledger', /<div class="lp-minmap"[\s\S]*?<span class="lp-min-dots"[^>]*><i class="c0 g0">/],
  'mosaic-split': ['mosaic', 'split', 'split', /<div class="lp-mosaic"><svg class="lp-mosaic-svg"[^>]*><g class="lp-tile"/],
  'cover-sheet': ['cover', 'cover', 'left', /<figure class="lp-cover-fig"[^>]*aria-hidden="true">[\s\S]*?<span class="lp-cover-glyph">/],
  'vertical-type': ['vertical', 'right', 'right', /<h1 class="lp-h1 lp-vt-h"[^>]*><span class="lp-vt-l">/],
  'swiss-offset': ['offset', 'offset', 'offset', /<h1 class="lp-h1 lp-off-h"[^>]*><span class="lp-off-l" style="--n:0">/],
};

test('배치가 다른 디자인 여섯 가지: 첫 화면 구성·글 배치·본문 정렬 문법이 프리셋마다 다르고, 그림은 서버가 정지 모습으로 그려 둔다', () => {
  assert.equal(E.PRESETS.length, 27);
  for (const [id, [hero, layout, align, art]] of Object.entries(LAYOUT)) {
    const p = E.getPreset(id);
    assert.equal(p.id, id); assert.equal(p.variants.hero, hero); assert.equal(p.layout, layout); assert.equal(p.variants.align, align);
    for (const ex of ['sel-story', 'data-lab']) {
      const r = build(ex, { preset: id }), html = r.files['index.html'], h = heroOf(html);
      assert.deepEqual(r.errors || [], [], id);
      assert.match(h, art, `${id}/${ex}: 정지 그림`);
      assert.equal((h.match(/<h1/g) || []).length, 1, id);
      assert.ok(h.includes('lp-ctas'), `${id}: 버튼`);
      assert.equal(/<html[^>]*data-align="([a-z]+)"/.exec(html)?.[1] || 'left', align, `${id}: 본문 정렬 문법`);
    }
  }
  // 글 배치가 한쪽으로 몰리지 않음: 왼쪽이 아닌 배치가 여섯 가지 넘게, 가운데 본문은 기존 프리셋에도
  const layouts = new Set(E.PRESETS.map((p) => p.layout || 'left'));
  assert.ok(layouts.size >= 7, [...layouts].join());
  assert.ok(E.PRESETS.filter((p) => p.variants.align === 'center').length >= 4);
  for (const id of ['sunrise-warm', 'soft-pastel', 'keynote-dark']) assert.equal(E.getPreset(id).variants.align, 'center', id);
});

test('그림이 이끄는 첫 화면: 같은 제목이면 같은 그림, 교재 쪽 그림이 있으면 그 그림, 세로쓰기는 라틴 글자가 길면 가로로', async () => {
  const G = await import('../src/render/hero-graphic.js');
  const H = await import('../src/render/hero.js');
  const a = G.rippleArt(H.titleRandom('마음이 먼저 도착하는 교실')), b = G.rippleArt(H.titleRandom('마음이 먼저 도착하는 교실')), c = G.rippleArt(H.titleRandom('데이터로 읽는 우리 반'));
  assert.equal(a, b); assert.notEqual(a, c);
  assert.ok(Buffer.byteLength(a) < 5000, '파문 그림 크기');
  assert.equal(G.mosaicSvg(H.titleRandom('가'), 5, 6), G.mosaicSvg(H.titleRandom('가'), 5, 6));
  assert.equal((G.mosaicSvg(H.titleRandom('가'), 5, 6).match(/class="lp-tile"/g) || []).length, 30);
  // 번지는 고리: 안쪽은 0에서 나타나고 바깥쪽은 0으로 사라짐(되풀이해도 튀지 않음)
  assert.equal(G.rippleAlpha(0, 11, 0.5), 0); assert.equal(G.rippleAlpha(11, 11, 0.5), 0); assert.ok(G.rippleAlpha(3, 11, 0.5) > 0.2);
  assert.deepEqual(G.verticalLines('마음이 먼저\n도착하는 교실'), ['마음이 먼저', '도착하는 교실']);
  assert.equal(G.verticalLines('Understanding by Design 수업 설계'), null);
  assert.ok(G.verticalLines('그림책으로 여는 감정 수업 이야기').every((l) => [...l].length <= 11));
  // 표지 한 장: 교재 쪽 그림이 있으면 그 그림이 화면 위를 채움
  const r = build('sel-story', { preset: 'cover-sheet' }, (bp) => { bp.sections.find((s) => s.type === 'deck').slides[0].src = 'slides/p1.png'; });
  assert.match(heroOf(r.files['index.html']), /<figure class="lp-cover-fig has-img" aria-hidden="true"><img src="slides\/p1\.png" alt=""/);
  // 시간 점묘: 점의 수 = 연수의 분(1분 단위), 쉬는 시간은 빈 점
  const lab = heroOf(build('data-lab', { preset: 'minute-map' }).files['index.html']);
  assert.equal((lab.match(/<i class="(?:c\d|r) g\d+"><\/i>/g) || []).length, 180);
  assert.ok(/<i class="r g\d+">/.test(lab), '쉬는 시간');
  assert.ok(lab.includes('data-fx="minute-map"'), '공식 연수(차분 단계)에서도 가리킴 반응');
  // 번지는 파문은 보통 단계부터 움직임(차분 단계에서는 정지 그림만)
  assert.ok(heroOf(build('sel-story', { preset: 'ripple-center' }).files['index.html']).includes('data-fx="arc-ripple"'));
  assert.ok(!heroOf(build('data-lab', { preset: 'ripple-center' }).files['index.html']).includes('data-fx="arc-ripple"'));
  for (const id of ['arc-ripple', 'minute-map']) {
    const src = nodeRuntime().read(`fx/effects/${id}.js`);
    assert.ok(src.includes(`LecFX.define('${id}'`) && Buffer.byteLength(src) < 7500 && !/https?:\/\/(?!www\.w3\.org)/.test(src), id);
  }
});

test('페이지 연출 계획: 프리셋마다 다르고(모두 같은 떠오르기 금지), 계획의 효과는 카탈로그에 있다', () => {
  const ids = new Set(E.FX.map((f) => f.id)), seen = new Map();
  for (const p of E.PRESETS) {
    assert.ok(Array.isArray(p.plan), `${p.id}: plan`);
    const plan = E.presetPlan(p), modes = new Set(Object.values(plan.enter));
    for (const m of modes) assert.ok(E.ENTER_MODES.includes(m), `${p.id}: ${m}`);
    assert.ok(modes.size >= 3, `${p.id}: 등장 방식이 세 가지 넘게(${[...modes].join()})`);
    for (const list of Object.values(plan.slots)) for (const id of list) assert.ok(ids.has(id), `${p.id}: ${id}`);
    assert.ok(!Object.values(plan.slots).flat().some((id) => id === 'tilt' || id === 'marquee' || id === 'gradient-text'), `${p.id}: 흔한 생성 화면의 버릇`);
    const key = p.plan[0];
    assert.ok(!seen.has(key), `${p.id}와 ${seen.get(key)}의 등장 계획이 같음`);
    seen.set(key, p.id);
  }
  assert.ok(new Set(E.PRESETS.map((p) => E.presetPlan(p).enter.default)).size >= 6, '기본 등장 방식이 여섯 가지 넘게');
});

test('첫 화면 밖 전 구간 연출: 단계마다(0 정적 · 1 등장과 가리킴 · 2 스크롤 연동) 실리는 것이 다르고, 같은 요소를 두 효과가 움직이지 않는다', () => {
  const school = (bp) => { bp.audience.devices = ['laptop']; };
  for (const p of E.PRESETS) {
    // 0단계: 본문에 등장 효과 없음
    const r0 = build('sel-story', { preset: p.id, motion: 0 }, school);
    assert.equal(r0.design.motion, 0);
    assert.ok(!sections(r0.files['index.html']).some((s) => s.type !== 'hero' && /data-fx="reveal-up"/.test(s.tag + s.body)), `${p.id}: 0단계는 정적`);
    // 1단계: 섹션마다 등장(따라 하는 칸은 머리만), 본문 효과는 1단계 이하
    const r1 = build('sel-story', { preset: p.id, motion: 1 }, school), s1 = sections(r1.files['index.html']).filter((s) => s.type !== 'hero');
    for (const [slot, id] of Object.entries(r1.design.effects)) if (!slot.startsWith('hero.')) assert.ok(E.fxInfo(id).level <= 1, `${p.id} 1단계: ${slot}=${id}`);
    for (const s of s1.filter((x) => /data-calm/.test(x.tag))) { assert.ok(!/data-fx=/.test(s.tag), `${p.id}: 따라 하는 칸 자체에는 효과 없음`); assert.match(s.body, /<header class="lp-head(?: lp-head--sm)?" data-fx="reveal-up"/, `${p.id}: 머리만 등장`); }
    const modes = new Set(s1.map((s) => /data-fx="reveal-up" data-fx-opts='\{&quot;mode&quot;:&quot;(\w+)&quot;/.exec(s.tag)?.[1]).filter(Boolean));
    assert.ok(modes.size >= 3, `${p.id}: 한 페이지 안에서도 등장 방식이 세 가지 넘게(${[...modes].join()})`);
    // 2단계: 첫 화면 밖에서 효과가 있는 섹션 종류가 셋 넘게, 효과 가짓수도 셋 넘게
    const r2 = build('sel-story', { preset: p.id, motion: 2 }, school), s2 = sections(r2.files['index.html']).filter((s) => s.type !== 'hero');
    assert.equal(r2.design.rest, 2);
    // 배치 변형 중 제 그림이 움직이는 것(design/layouts.js MOTION_VARIANTS: 스크롤에 맞춰 그려지는 길·축·고리 등)도 본문 연출로 셈
    const mv = (s) => { const v = /data-variant="([a-z0-9]+)"/.exec(s.tag)?.[1]; return v && E.MOTION_VARIANTS.includes(`${s.type === 'followup' ? 'materials' : s.type}.${v}`) ? `variant:${v}` : ''; };
    const kinds = s2.filter((s) => /data-fx=/.test(s.tag + s.body) || mv(s)).map((s) => s.type);
    const fxs = new Set(s2.flatMap((s) => [...(s.tag + s.body).matchAll(/data-fx="([a-z0-9-]+)"/g)].map((m) => m[1]).concat(mv(s) || [])));
    assert.ok(new Set(kinds).size >= 3, `${p.id}: 연출이 있는 섹션 종류 ${new Set(kinds).size}`);
    assert.ok(fxs.size >= 3, `${p.id}: 본문 효과 가짓수 ${[...fxs].join()}`);
    // 겹침 방지: 스크롤에 맞춰 겹쳐 쌓이는 차례의 판, 선이 그려지는 일정 줄은 등장 대상에서 빠짐
    const outline = s2.find((s) => s.type === 'outline'), sched = s2.find((s) => s.type === 'schedule');
    assert.ok(!/lp-outline-item/.test(outline.tag), `${p.id}: 차례 판은 등장 대상이 아님`);
    if (r2.design.effects.schedule) assert.ok(!/lp-schedule &gt; li/.test(sched.tag), `${p.id}: 일정 줄은 등장 대상이 아님`);
    if (r2.design.effects['section.title']) assert.ok(/:not\(\.lp-h2\)/.test(outline.tag), `${p.id}: 제 효과가 있는 제목은 등장 대상이 아님`);
  }
  // 실습형은 본문이 차분 단계: 스크롤 연출을 골라도 본문 효과는 1단계 이하
  const lab = build('data-lab', { preset: 'keynote-dark', motion: 3 }, (bp) => { bp.meta.admin = { kind: 'school' }; });
  assert.equal(lab.design.rest, 1);
  for (const [slot, id] of Object.entries(lab.design.effects)) if (!slot.startsWith('hero.')) assert.ok(E.fxInfo(id).level <= 1, `${slot}=${id}`);
  // 선생님이 비운 칸은 계획이 다시 채우지 않음
  const off = build('sel-story', { preset: 'keynote-dark', motion: 2, effects: { schedule: '' } }, school);
  assert.ok(!off.design.effects.schedule);
});

test('효과의 대기 상태: 곧바로 들어가고(전환 없이), 인쇄·동작 줄이기에서는 숨은 채 남지 않는다', () => {
  const rt = nodeRuntime(), core = rt.read('fx/core.js'), css = rt.read('fx/fx.css');
  assert.match(core, /setAttribute\('data-fx-snap', ''\);\s*t\.setAttribute\('data-fx-pre', ''\);\s*void t\.offsetWidth;\s*t\.removeAttribute\('data-fx-snap'\)/);
  assert.match(css, /\[data-fx-snap\][^{]*\{ transition: none !important; \}/);
  assert.match(css, /@media print \{\s*\[data-fx-pre\], \[data-fx-pre\] :is\(\.fx-reveal-item, \.fx-wi, \.fx-c\), \.fx-wait \{ opacity: 1 !important;/);
  for (const m of E.ENTER_MODES.filter((x) => x !== 'rise')) assert.ok(css.includes(`.fx-rv-${m}[data-fx-pre]`), m);
  for (const f of ['chalkboard', 'doodle-scribbles']) assert.ok(rt.read(`fx/effects/${f}.js`).includes("'data-fx-snap'"), f);
});

test('컨셉 먼저: 주제에서 컨셉을 세우고(같은 입력이면 같은 결과), 설계도 최상위 concept가 디자인을 이끈다', () => {
  const a = E.deriveConcept({ title: '마음이 먼저 도착하는 교실', subtitle: '아침 5분 감정 체크인에서 시작하는 사회정서학습 수업 이야기', archetype: 'story' });
  assert.deepEqual(a, E.deriveConcept({ title: '마음이 먼저 도착하는 교실', subtitle: '아침 5분 감정 체크인에서 시작하는 사회정서학습 수업 이야기', archetype: 'story' }));
  assert.equal(a.preset, 'ripple-center'); assert.equal(a.source, 'auto');
  assert.ok(a.idea.length > 10 && a.motif && a.why.includes('마음') && a.keywords.length >= 2);
  assert.equal(E.deriveConcept({ title: '데이터로 읽는 우리 반', topics: ['data', 'edutech'], archetype: 'lab', admin: 'official' }).preset, 'minute-map');
  assert.equal(E.deriveConcept({ title: '데이터로 읽는 우리 반', topics: ['data'], admin: 'official' }).motion, 1, '공식 연수는 차분 단계');
  assert.equal(E.deriveConcept({ title: '2027 봄 나들이' }).preset, 'cover-sheet', '주제를 모르면 일반 컨셉');
  for (const [t, c] of Object.entries(E.TOPIC_CONCEPTS)) {
    assert.ok(E.PRESET_IDS.includes(c.preset), `${t}: ${c.preset}`);
    assert.ok(/시간$/.test(c.idea) && !/글꼴|폰트|팔레트|레이아웃/.test(c.idea), `${t}: 한 줄 컨셉은 참가자가 겪는 경험(디자인 낱말이 아님)`);
  }
  // 설계도: 최상위 concept는 정리되어 남고, 디자인을 고르지 않았으면 컨셉이 권한 디자인·분위기·움직임을 씀
  const v = E.validate({ meta: { title: '그림책으로 여는 감정 수업' }, concept: { idea: '한 줄씩 천천히 읽는 <b>시간</b>', motif: '세로로 쓴 책 표지', preset: 'vertical-type', moods: ['calm', '없는값'], motion: 9, sections: ['reflection', 'nope'], features: ['board', 'x'], source: 'ai', extra: 1 }, sections: [{ type: 'hero' }] });
  assert.deepEqual(v.blueprint.concept, { idea: '한 줄씩 천천히 읽는 b시간/b', why: '', motif: '세로로 쓴 책 표지', keywords: [], moods: ['calm'], preset: 'vertical-type', motion: 3, sections: ['reflection'], features: ['board'], source: 'ai' });
  assert.equal(v.blueprint.design.preset, 'vertical-type'); assert.deepEqual(v.blueprint.design.mood, ['calm']);
  assert.equal(v.blueprint.design.motion, 2, '컨셉이 바라는 움직임은 보통 단계까지만(스크롤 연출은 직접 골랐을 때만)');
  // 선생님이 디자인을 골랐으면 그대로
  assert.equal(E.validate({ meta: { title: 'x' }, concept: { idea: '가', preset: 'vertical-type' }, design: { preset: 'glass-lab' }, sections: [{ type: 'hero' }] }).blueprint.design.preset, 'glass-lab');
  // 컨셉이 없으면 설계도에 concept를 지어 넣지 않음(예전 설계도 그대로)
  assert.ok(!('concept' in E.validate({ meta: { title: 'x' }, sections: [{ type: 'hero' }] }).blueprint));
  assert.equal(E.cleanConcept({ idea: '  ' }), null);
});

test('컨셉 먼저: 초안·AI 답에 컨셉이 서고, 프롬프트가 컨셉을 먼저 세우게 하며, DESIGN.md에 적힌다', () => {
  const info = { title: '마음이 먼저 도착하는 교실', subtitle: '사회정서학습 수업 이야기', date: '2027-05-13', start: '15:30', end: '17:00' };
  const bp = E.applyInfo({ meta: {}, sections: [{ type: 'hero' }] }, info);
  assert.equal(bp.concept.source, 'auto'); assert.equal(bp.design.preset, bp.concept.preset); assert.equal(bp._presetAuto, true);
  // AI가 세운 컨셉은 그대로 두고(정리만), 선생님이 고친 컨셉은 다시 만들어도 지킴
  const ai = E.applyInfo({ meta: {}, concept: { idea: '숲을 걷듯 천천히 살피는 시간', motif: '돌과 물결', preset: 'stone-stream' }, sections: [{ type: 'hero' }] }, info);
  assert.equal(ai.concept.idea, '숲을 걷듯 천천히 살피는 시간'); assert.equal(ai.concept.source, 'ai'); assert.equal(ai.design.preset, 'stone-stream');
  const kept = E.applyInfo({ meta: {}, sections: [{ type: 'hero' }] }, info, null, { ...ai, concept: { ...ai.concept, idea: '내가 고친 컨셉', source: 'teacher' }, _presetAuto: true });
  assert.equal(kept.concept.idea, '내가 고친 컨셉');
  // 분위기를 따로 말하면 분위기·주제 순위가 먼저
  const mood = E.applyInfo({ meta: {}, sections: [{ type: 'hero' }] }, { ...info, mood: ['공식'] });
  assert.ok(E.getPreset(mood.design.preset).moods.includes('formal'), mood.design.preset);
  const prompt = E.buildPrompt({ context: '1쪽: 마음 날씨', info });
  assert.ok(prompt.includes('"concept":{idea') && prompt.includes('### 컨셉 먼저(concept)') && prompt.includes('참가자에게 주는 경험'));
  assert.ok(prompt.includes('ripple-center: 번지는 파문(가운데 정렬)'), '프리셋 목록에 글 배치');
  const r = E.build({ ...EX('sel-story'), concept: { idea: '한 사람의 마음이 번져 교실에 닿는 시간', motif: '번지는 물결', why: '교재 3쪽 마음 날씨', source: 'ai' } }, { runtime: nodeRuntime() });
  const doc = r.teacher['DESIGN.md'];
  assert.ok(doc.includes('## 컨셉') && doc.includes('한 사람의 마음이 번져 교실에 닿는 시간') && doc.includes('## 페이지 연출 계획'), 'DESIGN.md');
});
