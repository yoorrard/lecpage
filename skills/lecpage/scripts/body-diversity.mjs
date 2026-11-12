#!/usr/bin/env node
// 본문 다양성 진단: 모든 프리셋 × 예시 설계도로 사이트를 만들어 섹션마다 '구성 지문'을 뽑고, 프리셋 쌍마다 지문이 같은 섹션 수를 셉니다.
//   구성 지문 = DOM 뼈대 · 격자 열 수 · 머리 자리 · 정렬 · 주인공(글 text / 숫자 number / 그림 figure / 도식 diagram / 조작 tool)
//   함께 냄: 글만 있는 섹션 비율 · 그래픽이 주인공인 섹션 수 · 왼쪽 정렬이 아닌 섹션 수 · 첫 화면 밖에서 움직임이 있는 섹션 수
// 쓰는 법: node scripts/body-diversity.mjs [--presets a,b] [--examples sel-story,data-lab,body-all] [--width 1440] [--out 폴더]
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
  // 가리킴·초점에 반응하는 규칙(:hover·:focus-within)의 대상: 링크·단추 같은 공통 부품은 뺌
  const hoverSel = [];
  for (const sh of document.styleSheets) { let rules; try { rules = sh.cssRules; } catch { continue; } const walk = (list) => { for (const r of list) { if (r.cssRules && !r.selectorText) walk(r.cssRules); else if (r.selectorText && /:hover|:focus-within/.test(r.selectorText) && /transform|translate|rotate|scale|box-shadow|border-color|background/.test(r.style.cssText)) for (const part of r.selectorText.split(',')) { if (!/:hover|:focus-within/.test(part)) continue; const q = part.replace(/:(hover|focus-within|focus-visible|active)/g, '').replace(/\s*>\s*$/, '').trim(); const last = q.split(/\s+|>/).pop() || ''; if (!q || /lp-btn|lp-link|lp-nav|lp-icon-btn|lp-dock|lp-react|lp-signal|lp-textbtn|^a$|button|summary|input|label|fx-|lp-hero|lp-sheet|lp-toc|\bsvg\b/.test(last)) continue; hoverSel.push(q); } } }; walk(rules); }
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
      if (n.children.length || n.closest('.lp-head,svg') || (n.closest('[aria-hidden="true"]') && !n.closest('.fx-counter'))) continue; // 순번(꾸밈 숫자)은 세지 않음: 실제 값만(숫자 세기가 화면용으로 감싼 값은 셈)
      const t = n.textContent.trim(); if (!t || t.length > 6 || !/\d/.test(t)) continue;
      const f = parseFloat(cs(n).fontSize); if (f < 40) continue;
      bigNum += area(n.getBoundingClientRect());
    }
    // 조작(tool): 따라 하는 칸(data-calm)이거나 쓰고 고르는 입력칸이 주인 칸 — 글만 있는 섹션으로 세지 않음
    const tool = sec.hasAttribute('data-calm') || sec.querySelectorAll('input:not([type=hidden]),textarea,select').length >= 2;
    const prot = gfx / cArea >= 0.2 ? (diagram >= gfx * 0.5 ? 'diagram' : 'figure') : bigNum / cArea >= 0.05 ? 'number' : tool ? 'tool' : 'text';
    // 움직임: 등장(enter) · 스크롤 연동(scroll: 스크롤이 직접 움직이는 CSS·효과) · 반응(react: 가리킴·누름에 답하는 카드·탭·아코디언·넘김)
    const all = [sec, ...sec.querySelectorAll('*')];
    const fxIds = all.map((e) => e.getAttribute('data-fx')).filter(Boolean);
    const enterMode = (() => { try { return JSON.parse(sec.getAttribute('data-fx-opts') || '{}').mode || (sec.getAttribute('data-fx') === 'reveal-up' ? 'rise' : sec.getAttribute('data-fx') || ''); } catch { return ''; } })();
    const scroll = fxIds.some((x) => /^(line-draw|scroll-fill|stack-cards|sticky-scrolly|parallax-soft|counter)$/.test(x)) || all.some((e) => { const s = cs(e); return (s.animationTimeline && !/^(auto|none)?$/.test(s.animationTimeline)) || (s.position === 'sticky' && e !== head && !e.closest('.lp-head')); });
    const react = !!sec.querySelector('[data-tabs],[data-film],[data-linked],details,[data-fx="spotlight"],[data-fx="tilt"],[data-flip]') || all.some((e) => !/^(A|BUTTON|SUMMARY|INPUT|TEXTAREA|LABEL)$/.test(e.tagName) && !e.closest('.lp-head') && hoverSel.some((q) => { try { return e.matches(q); } catch { return false; } }));
    const moving = !sec.hasAttribute('data-calm') && (scroll || react);
    const sk = hash(content.map((c) => `${c.tagName.toLowerCase()}${typeof c.className === 'string' && c.className ? '.' + c.className.trim().split(/\s+/)[0] : ''}${sig(c, 1)}`).join('|'));
    out.push({ id: sec.id, type, variant: sec.getAttribute('data-variant') || '', skeleton: sk, cols, headSide, align, prot, moving, scroll, react, enterMode, calm: sec.hasAttribute('data-calm'), fp: `${sk}|${cols}|${headSide}|${align}|${prot}`, gfx: +(gfx / cArea).toFixed(2), num: +(bigNum / cArea).toFixed(2) });
  }
  return out;
}

/** 지문 묶음(프리셋 → 섹션 지문 목록)에서 비슷함 표와 요약을 냄 */
export function summarize(byPreset) {
  const ids = Object.keys(byPreset), pairs = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = byPreset[ids[i]], b = byPreset[ids[j]], n = Math.min(a.length, b.length);
    // same: 지문 전체(뼈대·열·머리 자리·정렬·주인공)가 같음 · sameS: 구조만(뼈대·주인공) 같음 — 정렬만 바꾼 것은 다르다고 세지 않음
    // 구조가 같음 = 뼈대·열 수·주인공이 같음(정렬·머리 자리는 뺌). 읽는 칸 = 따라 하는 칸(조작)을 뺀 섹션
    let same = 0, sameS = 0, sameR = 0, nR = 0; for (let k = 0; k < n; k++) { if (a[k].type !== b[k].type) continue; const st = a[k].skeleton === b[k].skeleton && a[k].prot === b[k].prot && a[k].cols === b[k].cols; if (a[k].fp === b[k].fp) same++; if (st) sameS++; if (a[k].prot !== 'tool' && b[k].prot !== 'tool') { nR++; if (st) sameR++; } }
    pairs.push({ a: ids[i], b: ids[j], same, sameS, sameR, n, nR, ratio: n ? same / n : 0, sratio: n ? sameS / n : 0, rratio: nR ? sameR / nR : 0 });
  }
  const per = ids.map((id) => {
    const s = byPreset[id], n = s.length || 1;
    return { id, sections: s.length, textOnly: s.filter((x) => x.prot === 'text').length, graphic: s.filter((x) => (x.prot === 'figure' || x.prot === 'diagram') && !/^(deck|gallery)$/.test(x.type)).length, number: s.filter((x) => x.prot === 'number').length, tool: s.filter((x) => x.prot === 'tool').length, nonLeft: s.filter((x) => /c|r/.test(x.align) || x.headSide === 'right').length, moving: s.filter((x) => x.moving).length, scroll: s.filter((x) => x.scroll && !x.calm).length, react: s.filter((x) => x.react && !x.calm).length, enterKinds: new Set(s.map((x) => x.enterMode).filter(Boolean)).size, textRatio: +(s.filter((x) => x.prot === 'text').length / n).toFixed(2) };
  });
  const types = {}; for (const id of ids) for (const x of byPreset[id]) (types[x.type] ||= new Set()).add(`${x.skeleton}|${x.prot}|${x.cols}`);
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  return {
    presets: ids.length, pairs: pairs.length,
    over50: pairs.filter((p) => p.ratio > 0.5).length, maxRatio: +Math.max(0, ...pairs.map((p) => p.ratio)).toFixed(2), meanRatio: +mean(pairs.map((p) => p.ratio)).toFixed(2),
    sOver50: pairs.filter((p) => p.sratio > 0.5).length, sMaxRatio: +Math.max(0, ...pairs.map((p) => p.sratio)).toFixed(2), sMeanRatio: +mean(pairs.map((p) => p.sratio)).toFixed(2),
    rOver50: pairs.filter((p) => p.rratio > 0.5).length, rMaxRatio: +Math.max(0, ...pairs.map((p) => p.rratio)).toFixed(2), rMeanRatio: +mean(pairs.map((p) => p.rratio)).toFixed(2),
    worst: pairs.slice().sort((x, y) => y.sratio - x.sratio || y.ratio - x.ratio).slice(0, 5).map((p) => `${p.a}×${p.b} 구조 ${p.sameS}/${p.n}`),
    meanTextRatio: +mean(per.map((p) => p.textRatio)).toFixed(2), meanGraphic: +mean(per.map((p) => p.graphic)).toFixed(1), minGraphic: Math.min(...per.map((p) => p.graphic)),
    meanNonLeft: +mean(per.map((p) => p.nonLeft)).toFixed(1), minNonLeft: Math.min(...per.map((p) => p.nonLeft)), meanMoving: +mean(per.map((p) => p.moving)).toFixed(1), meanScroll: +mean(per.map((p) => p.scroll)).toFixed(1), meanReact: +mean(per.map((p) => p.react)).toFixed(1), meanEnterKinds: +mean(per.map((p) => p.enterKinds)).toFixed(1), meanSections: +mean(per.map((p) => p.sections)).toFixed(1),
    maxTextRatio: Math.max(...per.map((p) => p.textRatio)),
    distinctByType: Object.fromEntries(Object.entries(types).map(([t, s]) => [t, s.size])), per, pairsAll: pairs,
  };
}

export function markdown(name, S) {
  const L = [`### ${name}`, '', `- 프리셋 ${S.presets}개 · 쌍 ${S.pairs}개 · 본문 섹션 평균 ${S.meanSections}개`, `- 구조 지문(뼈대·열 수·주인공, 정렬은 뺌)이 절반 넘게 같은 쌍: **${S.sOver50}** · 가장 비슷한 쌍: **${Math.round(S.sMaxRatio * 100)}%** · 평균 **${Math.round(S.sMeanRatio * 100)}%**`, `- 읽는 칸만(따라 하는 칸 제외) 구조가 절반 넘게 같은 쌍: **${S.rOver50}** · 가장 비슷한 쌍: **${Math.round(S.rMaxRatio * 100)}%** · 평균 **${Math.round(S.rMeanRatio * 100)}%**`, `- 전체 지문(정렬·머리 자리·열 수 포함)이 절반 넘게 같은 쌍: ${S.over50} · 가장 비슷한 쌍 ${Math.round(S.maxRatio * 100)}% · 평균 ${Math.round(S.meanRatio * 100)}%`, `- 가장 비슷한 쌍: ${S.worst.join(' · ')}`, `- 글만 있는 섹션 비율(평균/최대): **${Math.round(S.meanTextRatio * 100)}% / ${Math.round(S.maxTextRatio * 100)}%** · 그래픽이 주인공인 섹션(평균/최소): **${S.meanGraphic} / ${S.minGraphic}** · 왼쪽 정렬이 아닌 섹션(평균/최소): **${S.meanNonLeft} / ${S.minNonLeft}**`,
    `- 첫 화면 밖 움직임·반응 섹션(평균): **${S.meanMoving}** (스크롤 연동 ${S.meanScroll} · 가리킴·누름 반응 ${S.meanReact}) · 등장 방식 종류(평균): ${S.meanEnterKinds}`, `- 섹션 종류별 서로 다른 구조 지문 수(프리셋 ${S.presets}개 가운데): ${Object.entries(S.distinctByType).map(([t, n]) => `${t} ${n}`).join(' · ')}`, '', '| 프리셋 | 섹션 | 글만 | 숫자 | 그래픽 | 왼쪽 아님 | 움직임·반응 | 스크롤 | 반응 | 등장 종류 |', '|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|'];
  for (const p of S.per) L.push(`| ${p.id} | ${p.sections} | ${p.textOnly} | ${p.number} | ${p.graphic} | ${p.nonLeft} | ${p.moving} | ${p.scroll} | ${p.react} | ${p.enterKinds} |`);
  return L.join('\n');
}

async function main(argv) {
  const arg = (k, d) => { const i = argv.indexOf('--' + k); return i > 0 ? argv[i + 1] : d; };
  // --from 결과.json: 브라우저 없이 저장해 둔 지문으로 표만 다시 냄
  if (arg('from', '')) { const { width, result } = JSON.parse(readFileSync(arg('from'), 'utf8')); const md = Object.entries(result).map(([ex, byPreset]) => markdown(`${ex} · 폭 ${width}px`, summarize(byPreset))); console.log(md.join('\n\n')); return; }
  const E = await import(pathToFileURL(join(ROOT, 'engine/src/index.js')).href);
  const { nodeRuntime } = await import(pathToFileURL(join(ROOT, 'engine/node.js')).href);
  const presets = (arg('presets', '') || E.PRESET_IDS.join(',')).split(',');
  const examples = arg('examples', 'sel-story,data-lab,body-all').split(',');
  const width = +arg('width', 1440), out = arg('out', ''), isStatic = argv.includes('--static');
  // body-all = 모든 본문 칸을 담은 시험 설계도(engine/test/fixtures)
  const load = (ex) => JSON.parse(readFileSync(ex.endsWith('.json') ? ex : ex === 'body-all' ? join(ROOT, 'engine/test/fixtures/body-all.blueprint.json') : join(ROOT, 'examples', `${ex}.blueprint.json`), 'utf8'));
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
        try {
          await page.goto(`http://127.0.0.1:${srv.address().port}/${j.key}/index.html`, { waitUntil: 'load', timeout: 30000 });
          // 사람이 읽듯 끝까지 내렸다가 처음으로: 들어올 때 한 번 움직이는 그림이 제자리에 온 모습을 잼
          await page.evaluate(async () => { document.documentElement.style.scrollBehavior = 'auto'; for (let y = 0; y < document.body.scrollHeight; y += 500) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } scrollTo(0, 0); });
          await page.waitForTimeout(1200); (result[j.ex] ||= {})[j.id] = await page.evaluate(pageFingerprints);
        } catch (e) { console.error('검사 실패', j.id, j.ex, String(e.message).slice(0, 80)); }
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
