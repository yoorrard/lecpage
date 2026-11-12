#!/usr/bin/env node
// 프리셋별 본문 계획 짜기(design/layouts.js PRESET_BODY): 프리셋 분위기(moods)에 어울리는 배치 변형을 고르되,
//   ① 어느 두 프리셋도 같은 설계도에서 본문 섹션의 배치가 절반 넘게 같지 않음(자세·정렬은 빼고 변형만 견줌)
//   ② 프리셋마다 그래픽(그림·도식)이 주인공인 본문 2개 이상 ③ 글만 있는 섹션 절반 이하 ④ 왼쪽 정렬이 아닌 섹션 2개 이상
// 을 시험 설계도 셋(예시 2종 + 모든 본문 칸 engine/test/fixtures/body-all)에서 모두 지키게 합니다. 담금질(무작위 탐색)이라 씨앗을 고정해 늘 같은 답.
//   node scripts/plan-body.mjs            → 계획 줄을 출력(--why: 남은 위반)
//   node scripts/plan-body.mjs --write    → layouts.js의 PRESET_BODY를 바꿔 씀
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENGINE = join(HERE, '..', 'engine');
const L = await import(join(ENGINE, 'src/design/layouts.js'));
const { PRESETS } = await import(join(ENGINE, 'src/design/presets.js'));
const { validate } = await import(join(ENGINE, 'src/validate.js'));

const BPS = { 'sel-story': join(HERE, '..', 'examples/sel-story.blueprint.json'), 'data-lab': join(HERE, '..', 'examples/data-lab.blueprint.json'), 'body-all': join(ENGINE, 'test/fixtures/body-all.blueprint.json') };
const secs = Object.fromEntries(Object.entries(BPS).map(([k, p]) => [k, validate(JSON.parse(readFileSync(p, 'utf8'))).blueprint.sections.filter((s) => s.type !== 'hero')]));
const lists = Object.fromEntries(Object.entries(secs).map(([k, list]) => [k, list.map((s) => L.variantType(s.type))]));
const TYPES = [...new Set(Object.values(lists).flat())].filter((t) => L.variantIds(t).length > 1);
// 내용이 배치에 맞지 않으면 기본 배치로 그려지고(layouts.js FITS), 같은 종류가 두 번째로 나오면 앞 칸과 다른 배치가 되므로(variantOf)
// 설계도의 자리마다 '실제로 그려지는 배치'를 미리 셈: EFF[설계도][자리] = { 계획의 변형 → 그려지는 변형 }
const fits = (s, v) => L.variantOf({ ...s, layout: v }, '').variant === v;
const EFF = Object.fromEntries(Object.entries(secs).map(([k, list]) => [k, list.map((s, pos) => {
  const t = L.variantType(s.type); if (!TYPES.includes(t)) return null;
  const first = list.findIndex((x) => L.variantType(x.type) === t), ids = L.variantIds(t), def = L.defaultVariant(t);
  return Object.fromEntries(ids.map((v) => {
    if (first === pos) return [v, fits(s, v) ? v : def];
    const before = fits(list[first], v) ? v : def, order = ids.slice(ids.indexOf(v)).concat(ids.slice(0, ids.indexOf(v)));
    return [v, order.find((w) => fits(s, w) && w !== before) || (fits(s, v) ? v : def)];
  }));
})]));
const lead = (t, v) => L.BODY_VARIANTS[t]?.[v]?.lead || (/^(stations|attendance|prompts)$/.test(t) ? 'tool' : 'text');
export const GRAPHIC = (t, v) => !['deck', 'gallery'].includes(t) && /^(figure|diagram)$/.test(lead(t, v));
export const TEXT = (t, v) => lead(t, v) === 'text';
const MOOD_TAGS = { emotional: 'warm', warm: 'warm', calm: 'calm', natural: 'calm', minimal: 'calm formal', formal: 'formal', playful: 'playful', energetic: 'playful bold', retro: 'playful', handmade: 'editorial playful', editorial: 'editorial', tech: 'tech', futuristic: 'tech bold', bold: 'bold' };
const tagsOf = (p) => { const m = {}; p.moods.forEach((x, i) => (MOOD_TAGS[x] || '').split(' ').filter(Boolean).forEach((t) => { m[t] = (m[t] || 0) + (i === 0 ? 1.5 : 1); })); return m; };
const fit = (tags, t, v) => (L.BODY_VARIANTS[t][v].tags || []).reduce((a, x) => a + (tags[x] || 0), 0);
const nonLeftAll = (p) => ['center', 'right'].includes(p.variants.align); // 가운데·오른쪽 정렬 문법은 모든 섹션이 왼쪽이 아님

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const R = rng(20261112);
const P = PRESETS.map((p) => ({ id: p.id, tags: tagsOf(p), p }));
const plan = P.map((x) => Object.fromEntries(TYPES.map((t) => [t, L.variantIds(t).slice().sort((a, b) => fit(x.tags, t, b) - fit(x.tags, t, a))[0]]))); // 처음: 분위기에 가장 맞는 변형

// 빠른 셈: 프리셋 쌍마다 같은 배치 수(설계도별), 프리셋마다 그래픽·글만 수를 들고 다니며 바꾼 자리만 고침
const LK = Object.keys(lists), half = Object.fromEntries(LK.map((k) => [k, Math.floor(lists[k].length / 2)]));
const POS = Object.fromEntries(LK.map((k) => [k, Object.fromEntries(TYPES.map((t) => [t, lists[k].map((x, n) => (x === t ? n : -1)).filter((n) => n >= 0)]))]));
const ev = (k, pos, v) => (EFF[k][pos] ? EFF[k][pos][v] : 'x');
const vt = (k, i, pos) => ev(k, pos, plan[i]?.[lists[k][pos]]);
const same = {}, gr = {}, tx = {};
for (const k of LK) {
  const ps = lists[k].map((_, n) => n);
  same[k] = P.map((_, i) => P.map((__, j) => (i === j ? 0 : ps.filter((n) => vt(k, i, n) === vt(k, j, n)).length)));
  gr[k] = P.map((_, i) => ps.filter((n) => GRAPHIC(lists[k][n], vt(k, i, n))).length);
  tx[k] = P.map((_, i) => ps.filter((n) => TEXT(lists[k][n], vt(k, i, n))).length);
}
const pen = { pair: (k, n) => Math.max(0, n - half[k]) * 2, g: (n) => Math.max(0, 2 - n) * 3, t: (k, n) => Math.max(0, n - half[k]) * 3 };
function total() { let bad = 0, pref = 0; for (let i = 0; i < P.length; i++) for (const t of TYPES) pref += fit(P[i].tags, t, plan[i][t]); for (const k of LK) for (let i = 0; i < P.length; i++) { bad += pen.g(gr[k][i]) + pen.t(k, tx[k][i]); for (let j = i + 1; j < P.length; j++) bad += pen.pair(k, same[k][i][j]); } return { bad, pref }; }
/** (i, t)를 nv로 바꿨을 때 위반·어울림의 변화(apply면 실제로 바꿈) */
function delta(i, t, nv, apply) {
  const old = plan[i][t]; let db = 0;
  const dp = fit(P[i].tags, t, nv) - fit(P[i].tags, t, old);
  for (const k of LK) {
    // 같은 종류가 여러 자리에 있으면(자료·연수 후) 자리마다의 변화를 모아 한 번에 셈
    let dg = 0, dt = 0; const ds = new Array(P.length).fill(0);
    for (const pos of POS[k][t]) {
      const eo = ev(k, pos, old), en = ev(k, pos, nv); if (eo === en) continue;
      dg += (GRAPHIC(t, en) ? 1 : 0) - (GRAPHIC(t, eo) ? 1 : 0); dt += (TEXT(t, en) ? 1 : 0) - (TEXT(t, eo) ? 1 : 0);
      for (let j = 0; j < P.length; j++) { if (j === i) continue; const ej = vt(k, j, pos); ds[j] += (ej === en ? 1 : 0) - (ej === eo ? 1 : 0); }
    }
    db += pen.g(gr[k][i] + dg) - pen.g(gr[k][i]) + pen.t(k, tx[k][i] + dt) - pen.t(k, tx[k][i]);
    if (apply) { gr[k][i] += dg; tx[k][i] += dt; }
    for (let j = 0; j < P.length; j++) {
      if (!ds[j]) continue;
      db += pen.pair(k, same[k][i][j] + ds[j]) - pen.pair(k, same[k][i][j]);
      if (apply) { same[k][i][j] += ds[j]; same[k][j][i] += ds[j]; }
    }
  }
  if (apply) plan[i][t] = nv;
  return { db, dp };
}
let cur = total(), T = 3;
for (let it = 0; it < 3000000 && (cur.bad > 0 || it < 600000); it++) {
  const i = Math.floor(R() * P.length), t = TYPES[Math.floor(R() * TYPES.length)], ids = L.variantIds(t), nv = ids[Math.floor(R() * ids.length)];
  if (nv === plan[i][t]) continue;
  const { db, dp } = delta(i, t, nv, false), d = db * 40 - dp;
  if (d <= 0 || R() < Math.exp(-d / T)) { delta(i, t, nv, true); cur = { bad: cur.bad + db, pref: cur.pref + dp }; }
  T = Math.max(0.05, T * 0.99998);
  if (it % 250000 === 249999 && cur.bad > 0) T = 40; // 막히면 다시 데움
}
// 다듬기: 위반이 없는 채로 어울림만 올림(위반을 늘리는 수는 받지 않음)
for (let it = 0, T2 = 1.5; it < 800000 && cur.bad === 0; it++) {
  const i = Math.floor(R() * P.length), t = TYPES[Math.floor(R() * TYPES.length)], ids = L.variantIds(t), nv = ids[Math.floor(R() * ids.length)];
  if (nv === plan[i][t]) continue;
  const { db, dp } = delta(i, t, nv, false);
  if (db > 0) continue;
  if (dp >= 0 || R() < Math.exp(dp / T2)) { delta(i, t, nv, true); cur = { bad: cur.bad + db, pref: cur.pref + dp }; }
  T2 = Math.max(0.02, T2 * 0.999993);
}
if (process.argv.includes('--why')) for (const k of LK) for (let i = 0; i < P.length; i++) { if (pen.g(gr[k][i]) || pen.t(k, tx[k][i])) console.error(k, P[i].id, '그래픽', gr[k][i], '글만', tx[k][i], '/', lists[k].length); for (let j = i + 1; j < P.length; j++) if (pen.pair(k, same[k][i][j])) console.error(k, P[i].id, P[j].id, '같음', same[k][i][j], '/', lists[k].length); }

// 자세: 왼쪽 정렬 프리셋은 설계도마다 왼쪽이 아닌 섹션이 2개 이상이 되게, 가운데가 어울리는 섹션부터 @c(어긋난 격자는 목표를 @r)
const CENTER_FIRST = ['message', 'closing', 'discuss', 'goals', 'glance', 'quiz', 'reflection', 'survey', 'poll', 'steps5', 'faq', 'glossary'];
const lines = P.map((x, i) => {
  const st = {};
  if (!nonLeftAll(x.p)) for (const list of Object.values(lists)) {
    let n = list.filter((t) => L.BODY_VARIANTS[t]?.[plan[i][t] || L.defaultVariant(t)]?.stance || st[t]).length;
    for (const t of CENTER_FIRST) { if (n >= 2) break; if (list.includes(t) && L.BODY_VARIANTS[t] && !L.BODY_VARIANTS[t][plan[i][t] || L.defaultVariant(t)]?.stance && !st[t]) { st[t] = x.p.variants.align === 'offset' && t === 'goals' ? 'r' : 'c'; n++; } }
  }
  return [x.id, TYPES.map((t) => `${t}:${plan[i][t]}${st[t] ? '@' + st[t] : ''}`).join(' ')];
});
const FAM = { 'night-story': 'stars', 'paper-workbook': 'grid', 'glass-lab': 'dots', playground: 'tiles', 'calm-forest': 'waves', 'official-brief': 'blocks', 'editorial-ink': 'glyph', 'retro-pop': 'rings', chalkboard: 'waves', 'blueprint-tech': 'grid', 'riso-zine': 'dots', 'sunrise-warm': 'arcs', 'keynote-dark': 'stars', 'corporate-clean': 'blocks', 'soft-pastel': 'tiles', 'kinetic-type': 'glyph', 'warm-minimal': 'waves', 'deck-collage': 'blocks', 'time-dial': 'arcs', 'knot-orbit': 'rings', 'stone-stream': 'waves', 'ripple-center': 'rings', 'minute-map': 'dots', 'mosaic-split': 'tiles', 'cover-sheet': 'glyph', 'vertical-type': 'glyph', 'swiss-offset': 'blocks' };
const out = lines.map(([id, spec]) => `  '${id}': ['${L.PRESET_BODY[id]?.[0] || FAM[id] || 'rings'}', '${spec}'],`).join('\n');
cur = total(); // 들고 다닌 값과 다시 센 값이 같은지
console.error(`위반 ${cur.bad} · 어울림 ${cur.pref.toFixed(1)} · 종류 ${TYPES.length}개`);
if (process.argv.includes('--write')) {
  const f = join(ENGINE, 'src/design/layouts.js'), src = readFileSync(f, 'utf8');
  writeFileSync(f, src.replace(/export const PRESET_BODY = \{[\s\S]*?\n\};/, `export const PRESET_BODY = {\n${out}\n};`));
} else console.log(out);
if (cur.bad) process.exitCode = 1;
