#!/usr/bin/env node
// 본문 다양성 진단: 모든 프리셋 × 예시 설계도로 사이트를 만들어 섹션마다 '구성 지문'을 뽑고, 프리셋 쌍마다 지문이 같은 섹션 수를 셉니다.
//   구성 지문 = DOM 뼈대 · 격자 열 수 · 머리 자리 · 정렬 · 주인공(글 text / 숫자 number / 그림 figure / 도식 diagram)
//   함께 냄: 글만 있는 섹션 비율 · 그래픽이 주인공인 섹션 수 · 왼쪽 정렬이 아닌 섹션 수 · 첫 화면 밖에서 움직임이 있는 섹션 수
// 쓰는 법: node scripts/body-diversity.mjs [--presets a,b] [--examples sel-story,data-lab] [--width 1440] [--out 폴더] [--md]
//   Playwright가 있어야 합니다(없으면 HTML만 읽는 정적 지문으로 셈: --static)
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

/** HTML만으로 뽑는 지문(테스트용): 섹션 종류 → 'variant|frame|뼈대'. 브라우저가 없어도 됨 */
export function staticFingerprints(html) {
  const out = [];
  for (const m of String(html).matchAll(/<section id="([^"]*)" class="lp-sec ([^"]*)"([^>]*)>([\s\S]*?)<\/section>/g)) {
    const cls = m[2].split(/\s+/)[0]; if (cls === 'lp-hero') continue;
    const type = cls.replace(/^lp-sec-/, '').replace(/^lp-/, '');
    const attr = (k) => new RegExp(`\\bdata-${k}="([^"]*)"`).exec(m[3])?.[1] || '';
    const body = m[4].replace(/<header class="lp-head"[\s\S]*?<\/header>/, '');
    // 뼈대: 여는 태그의 '태그.첫 클래스'를 차례로(같은 것이 이어지면 한 번만), 앞 60개
    const tags = [...body.matchAll(/<([a-z0-9]+)(?:\s+class="([^" ]*)[^"]*")?[^>]*>/g)].map((t) => `${t[1]}${t[2] ? '.' + t[2] : ''}`).filter((t) => !/^(br|b|i|em|small|span|a|path|circle|rect|g|line|text|tspan|use|defs|svg\.lp-ic)\b/.test(t));
    const sk = []; for (const t of tags) if (!sk.includes(t)) sk.push(t);
    out.push({ id: m[1], type, variant: attr('variant'), frame: attr('frame'), align: attr('stance'), lead: attr('lead'), skeleton: sk.slice(0, 40).join('>') });
  }
  return out;
}

/** 브라우저 안에서 도는 지문 뽑기 */
export function pageFingerprints() {
  const cs = (e) => getComputedStyle(e);
  const area = (r) => Math.max(0, r.width) * Math.max(0, r.height);
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
  const sig = (el, d) => {
    if (d > 4) return '';
    const kids = [...el.children].filter((c) => !/^(BR|B|I|EM|SMALL|STRONG|TIME)$/.test(c.tagName) && cs(c).display !== 'none');
    const parts = []; for (const k of kids) { const s = `${k.tagName.toLowerCase()}${typeof k.className === 'string' && k.className ? '.' + k.className.trim().split(/\s+/)[0] : ''}${sig(k, d + 1)}`; if (parts[parts.length - 1] !== s) parts.push(s); }
    return parts.length ? `(${parts.join(',')})` : '';
  };
  const anims = document.getAnimations ? document.getAnimations() : [];
  const out = [];
  for (const sec of document.querySelectorAll('main > section')) {
    if (sec.classList.contains('lp-hero')) continue;
    const type = (sec.className.split(/\s+/).find((c) => /^lp-sec-|^lp-closing$/.test(c)) || '').replace(/^lp-sec-/, '').replace(/^lp-/, '');
    const wrap = sec.querySelector(':scope > .lp-wrap') || sec, head = wrap.querySelector(':scope > .lp-head');
    const content = [...wrap.children].filter((c) => c !== head && cs(c).display !== 'none' && c.getBoundingClientRect().height > 0);
    const cr = content.reduce((a, c) => { const r = c.getBoundingClientRect(); return { l: Math.min(a.l, r.left), t: Math.min(a.t, r.top), r: Math.max(a.r, r.right), b: Math.max(a.b, r.bottom) }; }, { l: 1e9, t: 1e9, r: -1e9, b: -1e9 });
    const cArea = Math.max(1, (cr.r - cr.l) * (cr.b - cr.t));
    // 격자 열 수: 낱개가 가장 많은 묶음에서 서로 다른 왼쪽 자리의 수
    let best = null, bestN = 1;
    for (const c of content) for (const box of [c, ...c.querySelectorAll('ol,ul,dl,div')]) { const n = [...box.children].filter((k) => k.getBoundingClientRect().height > 8 && !k.matches('[aria-hidden="true"]')).length; if (n > bestN) { bestN = n; best = box; } }
    const xs = new Set(); if (best) for (const k of best.children) { const r = k.getBoundingClientRect(); if (r.height > 8) xs.add(Math.round(r.left / 12)); }
    const cols = Math.max(1, xs.size);
    // 머리 자리
    let headSide = 'none';
    if (head && content.length) { const h = head.getBoundingClientRect(); headSide = h.right <= cr.l + 8 ? 'left' : h.left >= cr.r - 8 ? 'right' : 'top'; }
    const ta = (e) => { const a = e ? cs(e).textAlign : ''; return /center/.test(a) ? 'c' : /right|end/.test(a) ? 'r' : 'l'; };
    const h2 = head && head.querySelector('.lp-h2');
    const firstText = (() => { const tw = document.createTreeWalker(wrap, NodeFilter.SHOW_TEXT); for (let t; (t = tw.nextNode());) { const p = t.parentElement; if (t.nodeValue.trim().length > 6 && p && !p.closest('.lp-head,[aria-hidden="true"],.lp-sr') && cs(p).visibility !== 'hidden') return p; } return null; })();
    const align = `${ta(h2 || head)}${ta(firstText)}`;
    // 주인공: 그림·도식의 넓이, 큰 숫자의 넓이
    let gfx = 0, diagram = 0, bigNum = 0;
    for (const g of sec.querySelectorAll('svg, img, canvas, [data-art], .lp-sched-bar')) {
      if (g.closest('.lp-ic,button,.lp-btn,a.lp-link,.lp-head') || g.classList.contains('lp-ic')) continue;
      if (g.parentElement.closest('svg')) continue;
      const r = g.getBoundingClientRect(); if (r.width < 56 || r.height < 10) continue;
      const a = Math.min(area(r), cArea); gfx += a; if (g.closest('[data-diagram]') || g.matches('[data-diagram]')) diagram += a;
    }
    for (const n of sec.querySelectorAll('span,b,p,dd,dt,time,i,li')) {
      if (n.children.length || n.closest('.lp-head,svg')) continue;
      const t = n.textContent.trim(); if (!t || t.length > 6 || !/\d/.test(t)) continue;
      const f = parseFloat(cs(n).fontSize); if (f < 40) continue;
      bigNum += area(n.getBoundingClientRect());
    }
    const prot = gfx / cArea >= 0.2 ? (diagram >= gfx * 0.5 ? 'diagram' : 'figure') : bigNum / cArea >= 0.05 ? 'number' : 'text';
    const moving = sec.hasAttribute('data-fx') || !!sec.querySelector('[data-fx]') || anims.some((a) => a.effect && a.effect.target && sec.contains(a.effect.target));
    const sk = hash(content.map((c) => `${c.tagName.toLowerCase()}${typeof c.className === 'string' && c.className ? '.' + c.className.trim().split(/\s+/)[0] : ''}${sig(c, 1)}`).join('|'));
    out.push({ id: sec.id, type, variant: sec.getAttribute('data-variant') || '', skeleton: sk, cols, headSide, align, prot, moving, fp: `${sk}|${cols}|${headSide}|${align}|${prot}`, gfx: +(gfx / cArea).toFixed(2), num: +(bigNum / cArea).toFixed(2) });
  }
  return out;
}

/** 지문 묶음(프리셋 → 섹션 지문 목록)에서 비슷함 표와 요약을 냄 */
export function summarize(byPreset) {
  const ids = Object.keys(byPreset), pairs = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = byPreset[ids[i]], b = byPreset[ids[j]], n = Math.min(a.length, b.length);
    let same = 0; for (let k = 0; k < n; k++) if (a[k].type === b[k].type && a[k].fp === b[k].fp) same++;
    pairs.push({ a: ids[i], b: ids[j], same, n, ratio: n ? same / n : 0 });
  }
  const per = ids.map((id) => {
    const s = byPreset[id], n = s.length || 1;
    return { id, sections: s.length, textOnly: s.filter((x) => x.prot === 'text').length, graphic: s.filter((x) => x.prot === 'figure' || x.prot === 'diagram').length, number: s.filter((x) => x.prot === 'number').length, nonLeft: s.filter((x) => /c|r/.test(x.align) || x.headSide === 'right').length, moving: s.filter((x) => x.moving).length, textRatio: +(s.filter((x) => x.prot === 'text').length / n).toFixed(2) };
  });
  const types = {}; for (const id of ids) for (const x of byPreset[id]) (types[x.type] ||= new Set()).add(x.fp);
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  return {
    presets: ids.length, pairs: pairs.length,
    over50: pairs.filter((p) => p.ratio > 0.5).length, maxRatio: +Math.max(0, ...pairs.map((p) => p.ratio)).toFixed(2), meanRatio: +mean(pairs.map((p) => p.ratio)).toFixed(2),
    worst: pairs.slice().sort((x, y) => y.ratio - x.ratio).slice(0, 5).map((p) => `${p.a}×${p.b} ${p.same}/${p.n}`),
    meanTextRatio: +mean(per.map((p) => p.textRatio)).toFixed(2), meanGraphic: +mean(per.map((p) => p.graphic)).toFixed(1), minGraphic: Math.min(...per.map((p) => p.graphic)),
    meanNonLeft: +mean(per.map((p) => p.nonLeft)).toFixed(1), minNonLeft: Math.min(...per.map((p) => p.nonLeft)), meanMoving: +mean(per.map((p) => p.moving)).toFixed(1), meanSections: +mean(per.map((p) => p.sections)).toFixed(1),
    distinctByType: Object.fromEntries(Object.entries(types).map(([t, s]) => [t, s.size])), per, pairsAll: pairs,
  };
}

export function markdown(name, S) {
  const L = [`### ${name}`, '', `- 프리셋 ${S.presets}개 · 쌍 ${S.pairs}개 · 본문 섹션 평균 ${S.meanSections}개`, `- 지문이 절반 넘게 같은 쌍: **${S.over50}** · 가장 비슷한 쌍의 같은 비율: **${Math.round(S.maxRatio * 100)}%** · 평균 ${Math.round(S.meanRatio * 100)}%`, `- 가장 비슷한 쌍: ${S.worst.join(' · ')}`, `- 글만 있는 섹션 비율(평균): **${Math.round(S.meanTextRatio * 100)}%** · 그래픽이 주인공인 섹션(평균/최소): **${S.meanGraphic} / ${S.minGraphic}** · 왼쪽 정렬이 아닌 섹션(평균/최소): **${S.meanNonLeft} / ${S.minNonLeft}** · 첫 화면 밖에서 움직임이 있는 섹션(평균): **${S.meanMoving}**`, `- 섹션 종류별 서로 다른 지문 수(프리셋 ${S.presets}개 가운데): ${Object.entries(S.distinctByType).map(([t, n]) => `${t} ${n}`).join(' · ')}`, '', '| 프리셋 | 섹션 | 글만 | 숫자 | 그래픽 | 왼쪽 아님 | 움직임 |', '|---|--:|--:|--:|--:|--:|--:|'];
  for (const p of S.per) L.push(`| ${p.id} | ${p.sections} | ${p.textOnly} | ${p.number} | ${p.graphic} | ${p.nonLeft} | ${p.moving} |`);
  return L.join('\n');
}

async function main(argv) {
  const arg = (k, d) => { const i = argv.indexOf('--' + k); return i > 0 ? argv[i + 1] : d; };
  const E = await import(pathToFileURL(join(ROOT, 'engine/src/index.js')).href);
  const { nodeRuntime } = await import(pathToFileURL(join(ROOT, 'engine/node.js')).href);
  const presets = (arg('presets', '') || E.PRESET_IDS.join(',')).split(',');
  const examples = arg('examples', 'sel-story,data-lab').split(',');
  const width = +arg('width', 1440), out = arg('out', ''), isStatic = argv.includes('--static');
  const load = (ex) => JSON.parse(readFileSync(ex.endsWith('.json') ? ex : join(ROOT, 'examples', `${ex}.blueprint.json`), 'utf8'));
  let chromium = null;
  if (!isStatic) { try { ({ chromium } = await import('playwright')); } catch { try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { try { ({ chromium } = createRequire('/opt/node-tools/')('playwright')); } catch { /* 정적 지문으로 */ } } } }
  const tmp = mkdtempSync(join(tmpdir(), 'lpdiv-')), jobs = [];
  for (const ex of examples) for (const id of presets) {
    const bp = load(ex); bp.design = { ...(bp.design || {}), preset: id }; delete bp.design.mood;
    const r = E.build(bp, { runtime: nodeRuntime() });
    if (r.errors?.length) { console.error('빌드 오류', id, ex); continue; }
    const key = `${ex.replace(/\W+/g, '_')}__${id}`;
    for (const [f, c] of Object.entries(r.files)) { const p = join(tmp, key, f); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, c); }
    jobs.push({ ex, id, key, html: r.files['index.html'] });
  }
  const result = {};
  if (!chromium) {
    for (const j of jobs) ((result[j.ex] ||= {})[j.id] = staticFingerprints(j.html).map((x) => ({ ...x, fp: `${x.variant}|${x.frame}|${x.skeleton}`, prot: 'text', align: 'll', headSide: 'top', moving: /data-fx=/.test(j.html) })));
  } else {
    const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
    const srv = createServer(async (q, r) => { try { const p = join(tmp, decodeURIComponent(q.url.split('?')[0])); const b = await readFile(p); r.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }); r.end(b); } catch { r.writeHead(404); r.end(); } });
    await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
    const browser = await chromium.launch(), queue = jobs.slice();
    await Promise.all(Array.from({ length: 6 }, async () => {
      for (let j; (j = queue.shift());) {
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        try { await page.goto(`http://127.0.0.1:${srv.address().port}/${j.key}/index.html`, { waitUntil: 'load', timeout: 30000 }); await page.waitForTimeout(700); (result[j.ex] ||= {})[j.id] = await page.evaluate(pageFingerprints); } catch (e) { console.error('검사 실패', j.id, j.ex, String(e.message).slice(0, 80)); }
        await page.close();
      }
    }));
    await browser.close(); srv.close();
  }
  rmSync(tmp, { recursive: true, force: true });
  const report = {}, md = [];
  for (const ex of examples) { const byPreset = Object.fromEntries(presets.filter((id) => result[ex]?.[id]).map((id) => [id, result[ex][id]])); report[ex] = summarize(byPreset); md.push(markdown(`${ex} · 폭 ${width}px${chromium ? '' : ' · 정적 지문'}`, report[ex])); }
  if (out) { mkdirSync(out, { recursive: true }); writeFileSync(join(out, 'body-diversity.json'), JSON.stringify({ width, result, report }, null, 1)); writeFileSync(join(out, 'body-diversity.md'), md.join('\n\n') + '\n'); }
  console.log(md.join('\n\n'));
}
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main(process.argv);
