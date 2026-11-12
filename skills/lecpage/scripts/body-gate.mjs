#!/usr/bin/env node
// 본문 겹침·꼬임 게이트: 모든 프리셋 × 설계도(예시 2종 + 모든 본문 칸 + 극단 입력) × 폭 360·390·768·1280·1440 × 밝게·어둡게 × 움직임 0~3 × 동작 줄이기 × 인쇄.
// 자리마다(0·25·50·75·100% + 처음으로 돌아옴) 움직이는 도중과 멈춘 뒤를 검사(overlap-lint.mjs scanPage) + 콘솔 오류. 배치 변형은 설계도 layout으로 하나하나 강제해서도 훑음.
//   node scripts/body-gate.mjs [--presets a,b] [--quick] [--only all-print,sel,force] [--out 결과.json] [--conc 6]
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let chromium; try { ({ chromium } = await import('playwright')); } catch { ({ chromium } = createRequire('/opt/node-tools/')('playwright')); }
const E = await import(pathToFileURL(join(ROOT, 'engine/src/index.js')).href);
const { nodeRuntime } = await import(pathToFileURL(join(ROOT, 'engine/node.js')).href);
const { scanPage, pageCheck } = await import(pathToFileURL(join(ROOT, 'scripts/overlap-lint.mjs')).href);
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const quick = process.argv.includes('--quick');
const presets = (arg('presets', '') || E.PRESET_IDS.join(',')).split(',');
const conc = +arg('conc', 6), out = arg('out', 'body-gate.json');
const SRC = { sel: join(ROOT, 'examples/sel-story.blueprint.json'), lab: join(ROOT, 'examples/data-lab.blueprint.json'), all: join(ROOT, 'engine/test/fixtures/body-all.blueprint.json') };
const LONG = ' 긴 제목이 화면 끝까지 이어질 때도 글이 겹치거나 잘리지 않는지 보는 문장';
/** 극단 입력: max = 항목 12개(칸마다 받는 만큼)·긴 제목·긴 항목, min = 항목 하나 */
function extreme(bp, kind) {
  bp = JSON.parse(JSON.stringify(bp));
  for (const s of bp.sections) {
    if (s.type === 'hero') { if (kind === 'max') s.title = '학교 안전사고, 첫 10분의 대응과 그 뒤 한 달의 기록을 함께 정리하는 직무연수'; continue; }
    if (kind === 'max' && s.title) s.title += LONG.slice(0, 26);
    for (const k of ['items', 'rows']) {
      if (!Array.isArray(s[k]) || !s[k].length) continue;
      if (kind === 'min') { s[k] = s[k].slice(0, 1); continue; }
      const src = s[k]; s[k] = Array.from({ length: 12 }, (_, i) => { const x = JSON.parse(JSON.stringify(src[i % src.length])); if (typeof x === 'string') return i < src.length ? x + LONG : x; for (const f of ['title', 'desc', 'body', 'q', 'a', 'term', 'label', 'word']) if (typeof x[f] === 'string' && i === 0) x[f] += f === 'word' ? '' : LONG; if (s.type === 'schedule' && x.start) { const m = 9 * 60 + i * 30; x.start = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; x.end = `${String(Math.floor((m + 30) / 60)).padStart(2, '0')}:${String((m + 30) % 60).padStart(2, '0')}`; } if (s.type === 'sessions') { x.no = i + 1; delete x.date; } return x; });
    }
    if (kind === 'max' && Array.isArray(s.head) && s.rows) s.rows = s.rows.map((r) => r.map((c, n) => (n ? c + LONG.slice(0, 20) : c)));
  }
  return bp;
}
// 조합: [이름, 설계도, 폭들, 테마, 움직임(''=기본), 동작 줄이기, 인쇄, layout 강제(k)]
const W5 = [360, 390, 768, 1280, 1440];
const PLAN = quick ? [['all', 'all', [1440, 390], 'light', '', false, false, null]] : [
  ['sel', 'sel', W5, 'light', '', false, false, null], ['lab', 'lab', W5, 'light', '', false, false, null], ['all', 'all', W5, 'light', '', false, false, null],
  ['all-dark', 'all', [390, 1440], 'dark', '', false, false, null], ['sel-dark', 'sel', [1280], 'dark', '', false, false, null],
  ...[0, 1, 2, 3].map((m) => [`all-m${m}`, 'all', [390, 1280], 'light', m, false, false, null]),
  ['all-rm', 'all', [1440], 'light', '', true, false, null], ['all-print', 'all', [1280], 'light', '', false, true, null],
  ['xmax', 'xmax', [360, 1440], 'light', '', false, false, null], ['xmin', 'xmin', [360, 1440], 'light', '', false, false, null],
];
const only = arg('only', '') ? arg('only').split(',') : null; // --only all-print,sel: 이 조건만
if (only) PLAN.splice(0, PLAN.length, ...PLAN.filter((x) => only.includes(x[0])));
const FORCE = quick || (only && !only.includes('force')) ? [] : [0, 1, 2, 3, 4].flatMap((k) => [['all', k], ['sel', k], ['lab', k]]);
const tmp = mkdtempSync(join(tmpdir(), 'lpbgate-')), jobs = [];
const loadBp = (key) => key === 'xmax' || key === 'xmin' ? extreme(JSON.parse(readFileSync(SRC.all, 'utf8')), key.slice(1)) : JSON.parse(readFileSync(SRC[key], 'utf8'));
function put(key, bp) { const r = E.build(bp, { runtime: nodeRuntime() }); if (r.errors?.length) { console.log('빌드 오류', key, JSON.stringify(r.errors).slice(0, 200)); return false; } for (const [f, c] of Object.entries(r.files)) { const p = join(tmp, key, f); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, c); } return r; }
for (const id of presets) {
  for (const [name, src, widths, theme, motion, rm, print] of PLAN) {
    const bp = loadBp(src); bp.design = { preset: id, theme, ...(motion === '' ? {} : { motion }) };
    if (motion !== '') bp.audience = { ...(bp.audience || {}), devices: ['laptop'] }; // 휴대폰 대상이면 3단계가 2로 낮아지므로
    const key = `${id}__${name}`, r = put(key, bp); if (!r) continue;
    for (const w of widths) jobs.push({ id, name, theme, motion: motion === '' ? `기본(${r.design.motion})` : String(r.design.motion), rm, print, w, key });
  }
}
// 배치 변형 강제: 섹션마다 k번째 변형(두 프리셋: 밝은 기본·어두운 장식형)으로 사이트를 만들어 360·1440에서
for (const id of quick ? [] : ['corporate-clean', 'night-story']) for (const [src, k] of FORCE) {
  const bp = loadBp(src); bp.design = { preset: id }; let any = false;
  for (const s of bp.sections) { const t = s.type === 'followup' ? 'materials' : s.type, ids = E.variantIds(t); if (ids[k] && s.type !== 'stations') { s.layout = ids[k]; any = true; } }
  if (!any) continue;
  const key = `${id}__force-${src}${k}`; if (!put(key, bp)) continue;
  for (const w of [360, 1440]) jobs.push({ id, name: `force-${src}${k}`, theme: 'light', motion: '기본', rm: false, print: false, w, key });
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.woff2': 'font/woff2' };
const srv = createServer(async (q, r) => { try { const p = join(tmp, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(p); r.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }); r.end(b); } catch { r.writeHead(404); r.end(); } });
await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${srv.address().port}/`;
const browser = await chromium.launch();
const results = [], queue = jobs.slice(), t0 = Date.now();
console.log(`조합 ${jobs.length}개(사이트 ${new Set(jobs.map((j) => j.key)).size}개) 검사 시작`);
await Promise.all(Array.from({ length: conc }, async () => {
  for (let j; (j = queue.shift());) {
    const ctx = await browser.newContext({ viewport: { width: j.w, height: j.w < 700 ? 780 : j.w < 1000 ? 1100 : 900 }, deviceScaleFactor: 1, colorScheme: j.theme, reducedMotion: j.rm ? 'reduce' : 'no-preference' });
    const page = await ctx.newPage(), errs = [];
    page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 100)));
    page.on('console', (m) => { if (m.type() === 'error' && !/net::ERR|Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 100)); });
    try {
      await page.goto(base + j.key + '/index.html', { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(800);
      let findings;
      if (j.print) {
        // 인쇄: 끝까지 한 번 내려 효과를 모두 들인 뒤 인쇄 화면으로 바꿔, 숨은 채 남음·가로 넘침·잘림을 봄
        await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } scrollTo(0, 0); });
        await page.emulateMedia({ media: 'print' }); await page.waitForTimeout(400);
        const o = await page.evaluate(pageCheck, false);
        const hidden = await page.evaluate(() => [...document.querySelectorAll('main :is(h2,h3,p,li,dt,dd)')].filter((e) => e.textContent.trim() && !e.closest('[aria-hidden="true"],.lp-sr,[hidden],details:not([open]),dialog,[data-live-off],[data-phase-show],[data-phase-hide]') && getComputedStyle(e).display !== 'contents' && (getComputedStyle(e).visibility === 'hidden' || +getComputedStyle(e).opacity < 0.2 || e.getClientRects().length === 0)).map((e) => `${e.closest('section')?.id || ''} ${e.tagName} "${e.textContent.trim().slice(0, 14)}"`).slice(0, 6));
        if (hidden.length) o['print-hidden'] = hidden;
        findings = Object.entries(o).map(([rule, samples]) => ({ rule, count: samples.length, samples }));
      } else ({ findings } = await scanPage(page));
      results.push({ ...j, findings, errs });
    } catch (e) { results.push({ ...j, findings: [], errs: ['검사 실패: ' + String(e.message).slice(0, 80)] }); }
    await ctx.close();
    if (results.length % 50 === 0) console.log(`  … ${results.length}/${jobs.length} (${Math.round((Date.now() - t0) / 1000)}초)`);
  }
}));
await browser.close(); srv.close(); rmSync(tmp, { recursive: true, force: true });
writeFileSync(out, JSON.stringify(results, null, 1));
const bad = results.filter((r) => r.findings.length || r.errs.length);
const total = bad.reduce((n, r) => n + r.findings.reduce((m, f) => m + f.count, 0) + r.errs.length, 0);
const stops = results.filter((r) => !r.print).length * 6 * 2 + results.filter((r) => r.print).length;
console.log(`조합 ${results.length}개(프리셋 ${presets.length} × 조건, 검사 자리 ${stops}곳: 스크롤 6자리 × 도중·멈춘 뒤) · 문제 있는 조합 ${bad.length} · 문제 ${total}개 · ${Math.round((Date.now() - t0) / 1000)}초`);
const byRule = {};
for (const r of bad) { for (const f of r.findings) for (const s of f.samples) ((byRule[f.rule] ||= {})[`${r.id}: ${s.replace(/ @.*/, '')}`] ||= []).push(`${r.name}/${r.w}/${r.theme[0]}/m${r.motion}${r.rm ? '/rm' : ''}${/@(.*)/.exec(s) ? ' ' + /@(.*)/.exec(s)[1] : ''}`); for (const e of r.errs) ((byRule.console ||= {})[`${r.id}: ${e}`] ||= []).push(`${r.name}/${r.w}`); }
for (const [rule, map] of Object.entries(byRule)) { const ent = Object.entries(map); console.log(`\n■ ${rule} (${ent.length}가지)`); for (const [k, where] of ent.slice(0, +(arg('max', 40)))) console.log(`  ${k}  ← ${where.length}곳: ${where.slice(0, 3).join(' | ')}`); }
process.exitCode = total ? 1 : 0;
