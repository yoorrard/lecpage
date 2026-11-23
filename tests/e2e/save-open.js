// [파일로 저장] → 다른 브라우저에서 [저장한 파일 열기] 왕복 + 읽다가 멈춘 교재.
// 1 저장한 파일은 반드시 다시 열림: 교재 원본·쪽 그림·사이트용 쪽 그림이 바이트까지 같게 돌아옴(큰 값은 Blob 그대로, 저장소에 32MiB 넘는 값도 왕복).
//   쪽 그림은 넣을 때 그린 것(assets/slides)과 사이트용(site/material)이 같은 내용이면 파일에 사이트용 한 벌만 담고(same), 열 때 되살림.
//   예전: 저장에는 한도가 없고 열기만 300MB 한도 → 큰 교재를 넣은 연수는 저장한 뒤 지우면 다시 열 수 없었음(한도·조각 읽기는 engine/test/project-file-big.test.mjs)
// 2 읽다가 끝을 보지 못한 교재(줄에 시도 횟수가 남음)는 연수를 열 때 저절로 다시 읽지 않고 [이어서 읽기]·삭제를 고르게 함(큰 교재가 탭을 거듭 죽이지 않게).
//   한 번도 끝을 못 본 적 없는 줄(작은 교재)은 예전처럼 저절로 이어 읽음.
//   BASE=http://localhost:4175/ node tests/e2e/save-open.js
const L = require('./lib.js');
const { chromium, ok, summary, BASE, fs } = L;
const path = require('path'); const os = require('os'); const { pathToFileURL } = require('url');
const ROOT = path.resolve(__dirname, '../..');
const ANSWER = '```html\n<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>저장 왕복</title></head><body><main><section id="top" data-title="첫 화면"><h1>저장 왕복</h1><p>교재 슬라이드로 봐요.</p></section><section id="deck" data-title="교재"><h2>교재</h2><div data-lp="deck"></div></section></main></body></html>\n```\n\n```json\n{"title":"저장 왕복","sessions":[{"date":"2026-12-09","start":"14:00","end":"17:00"}]}\n```';
const BIG = 40 * 1024 * 1024; // 저장소에 Blob으로 담기는 크기(32MiB 넘음)
// 앱이 저장소에 둘 수 있는 이름·형식: 자료실 파일(띄어쓰기·괄호·엑셀·CSV·ZIP·소리), 사진(이름에 띄어쓰기·괄호), 매크로 PPT·키노트 원본. 저장 → 열기에서 빠지면 안 됨
const EXTRA = { 'site/files/실습 자료 (2).xlsx': 'xlsx bytes', 'site/files/명단[최종].csv': 'a,b\n1,2\n', 'site/files/묶음.zip': 'zip bytes', 'site/files/소리.mp3': 'mp3 bytes', 'site/assets/img/내 사진 (1).jpg': 'jpg bytes', 'src/매크로_교재.pptm': 'pptm bytes', 'src/발표.key': 'key bytes' };

/** 그 연수의 저장소 값: { 키: { size, blob(Blob으로 저장됐는지), sha } } */
const dump = (p, id) => p.evaluate(async (pid) => {
  const db = await new Promise((res) => { const q = indexedDB.open('lecpage'); q.onsuccess = () => res(q.result); });
  const keys = await new Promise((res) => { const r = db.transaction('blobs').objectStore('blobs').getAllKeys(IDBKeyRange.bound(pid + ':', pid + ':￿')); r.onsuccess = () => res(r.result.map(String)); });
  const out = {};
  for (const k of keys) {
    const v = await new Promise((res) => { const r = db.transaction('blobs').objectStore('blobs').get(k); r.onsuccess = () => res(r.result); });
    const blob = v instanceof Blob; const buf = blob ? await v.arrayBuffer() : typeof v === 'string' ? new TextEncoder().encode(v).buffer : v.buffer ? v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength) : v;
    const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))].map((b) => b.toString(16).padStart(2, '0')).join('');
    out[k.slice(pid.length + 1)] = { size: buf.byteLength, blob, sha: h };
  }
  return out;
}, id);

(async () => {
  const { readStoredZip } = await import(pathToFileURL(path.join(ROOT, 'skills/lecpage/engine/src/project-file.js')).href);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-save-'));
  const b = await chromium.launch();
  // ── 1 저장 → 다른 브라우저에서 열기 ──
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage(); const errs = L.watch(p);
  await L.mockAi(ctx, null, { fallback: true });
  await L.startWithFile(p, [L.FIX + '/workshop.pptx']);
  const pid = L.pidOf(p);
  await L.makeWith(p, ANSWER, 120000);
  await L.waitStudio(p, 120000, { folds: false });
  // 저장소에 큰 값(교재 원본 자리)을 하나 더: 32MiB 넘는 값은 Blob으로 담김(Chromium은 한 값 127MiB까지) → 저장·열기도 Blob 조각으로
  await p.evaluate(async ([id, n, EXTRA]) => {
    const u = new Uint8Array(n); for (let i = 0; i < n; i += 4096) u[i] = (i / 4096) & 255;
    const db = await new Promise((res) => { const q = indexedDB.open('lecpage'); q.onsuccess = () => res(q.result); });
    await new Promise((res, rej) => { const t = db.transaction('blobs', 'readwrite'); t.objectStore('blobs').put(new Blob([u]), id + ':src/big-extra.pdf'); t.oncomplete = res; t.onerror = () => rej(t.error); });
    // 앱이 그 자리에 둘 수 있는 이름·형식(자료실 파일의 띄어쓰기·괄호·엑셀·소리, 사진 이름, 매크로 PPT 원본): 예전에는 열 때 말없이 빠졌음
    const small = (s) => new TextEncoder().encode(s);
    await new Promise((res, rej) => {
      const t = db.transaction('blobs', 'readwrite'); const st = t.objectStore('blobs');
      for (const [k, v] of Object.entries(EXTRA)) st.put(small(v), id + ':' + k);
      t.oncomplete = res; t.onerror = () => rej(t.error);
    });
  }, [pid, BIG, EXTRA]);
  const before = await dump(p, pid);
  const slides = Object.keys(before).filter((k) => k.startsWith('assets/slides/')); const mats = Object.keys(before).filter((k) => k.startsWith('site/material/'));
  ok('fixture: page images exist twice in the browser (assets/slides and site/material), plus the original and a >32MiB value', slides.length === 13 && mats.length === 13 && !!before['src/workshop.pptx'] && before['src/big-extra.pdf']?.size === BIG && before['src/big-extra.pdf'].blob === true, JSON.stringify({ slides: slides.length, mats: mats.length }));
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click('.btn:has-text("파일로 저장")')]);
  const file = path.join(tmp, 'saved.lecpage'); await dl.saveAs(file); // 경로는 영문으로(이 시험 도구는 한글 경로의 파일을 입력칸에 넣지 못할 때가 있음)
  ok('saved file: named after the project with the .lecpage ending', /\.lecpage$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  const zip = readStoredZip(fs.readFileSync(file));
  const pj = JSON.parse(Buffer.from(zip['project.json']).toString('utf8'));
  ok('saved file: the original and site page images are inside', !!zip['src/workshop.pptx'] && Object.keys(zip).filter((k) => k.startsWith('site/material/')).length === 13 && zip['src/big-extra.pdf']?.length === BIG);
  ok('saved file: page images are stored once (assets/slides left out, pairs recorded in "same")', !Object.keys(zip).some((k) => k.startsWith('assets/slides/')) && Object.keys(pj.same || {}).length === 13 && pj.same['assets/slides/slide-001.webp'] === 'site/material/p-001.webp', JSON.stringify(Object.keys(pj.same || {}).slice(0, 2)));
  ok('saved file: smaller than the browser copy by the duplicated page images', fs.statSync(file).size < Object.values(before).reduce((n, v) => n + v.size, 0) - slides.reduce((n, k) => n + before[k].size, 0) + 200000, String(fs.statSync(file).size));
  ok('saved file: no secrets and no converted-PDF cache entries', !Object.keys(zip).some((k) => k.startsWith('conv/')) && pj.project.deploy === undefined && pj.project.sitePassword === undefined);
  // 다른 브라우저(빈 저장소)에서 열기
  const ctx2 = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const q = await ctx2.newPage(); const errs2 = L.watch(q);
  await L.mockAi(ctx2, null, { fallback: true });
  await q.goto(BASE, { waitUntil: 'load' });
  await q.setInputFiles('.ld-hero input[type=file][multiple]', file);
  await q.waitForFunction(() => /#\/p\/[^/]+\/2/.test(location.hash), null, { timeout: 60000 });
  await L.waitStudio(q, 120000, { folds: false });
  const pid2 = L.pidOf(q);
  const after = await dump(q, pid2);
  const diff = Object.keys(before).filter((k) => !k.startsWith('conv/') && (!after[k] || after[k].sha !== before[k].sha || after[k].size !== before[k].size));
  ok('reopened: every stored file comes back byte for byte (originals, both copies of the page images)', pid2 && pid2 !== pid && diff.length === 0, diff.slice(0, 4).join(', '));
  ok('reopened: the >32MiB value is stored as a Blob again (not loaded whole into memory)', after['src/big-extra.pdf']?.blob === true && after['src/big-extra.pdf'].size === BIG);
  const lostExtra = Object.keys(EXTRA).filter((k) => !after[k] || after[k].sha !== before[k]?.sha);
  ok('reopened: materials-room files with spaces, brackets and xlsx/csv/zip/mp3 types, a photo and .pptm/.key originals all come back', lostExtra.length === 0, lostExtra.join(', '));
  const fr = q.frameLocator('.pv-device iframe').frameLocator('iframe');
  await fr.locator('img').first().waitFor({ timeout: 30000 });
  let st = { total: 0, broken: 1 };
  for (let i = 0; i < 40; i++) { st = await fr.locator('img').evaluateAll((els) => ({ total: els.length, broken: els.filter((x) => x.complete && x.naturalWidth === 0).length, pending: els.filter((x) => !x.complete && x.loading !== 'lazy').length })); if (st.total && !st.broken && !st.pending) break; await q.waitForTimeout(250); }
  ok('reopened: the preview shows the material pages (no broken images)', st.total >= 13 && st.broken === 0, JSON.stringify(st));
  const proj2 = await L.readProject(q, pid2);
  ok('reopened: material list and slide sets are intact', proj2.files?.[0]?.name === 'workshop.pptx' && (proj2.slideSets || []).reduce((n, s) => n + s.count, 0) === 13, JSON.stringify(proj2.slideSets));
  // 같은 파일을 한 번 더 열면 그때 연 연수를 다시 엶(둘이 생기지 않음)
  await q.goto(BASE, { waitUntil: 'load' });
  await q.setInputFiles('.ld-hero input[type=file][multiple]', file);
  await q.waitForFunction(() => /#\/p\/[^/]+\/2/.test(location.hash), null, { timeout: 60000 });
  ok('reopening the same file returns to the same project', L.pidOf(q) === pid2);
  ok('no page errors while saving and reopening', errs.length === 0 && errs2.length === 0, [...errs, ...errs2].slice(0, 2).join(' | '));
  await ctx2.close();

  // ── 1b 열다가 저장 공간이 꽉 참(여섯째 파일부터 담지 못함): 반쯤 열린 연수가 남지 않고, 까닭을 그대로 알리고, 같은 파일을 다시 열면 처음부터 다시 엶 ──
  {
    const ctx5 = await b.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx5.addInitScript(() => {
      const put = IDBObjectStore.prototype.put; let n = 0;
      IDBObjectStore.prototype.put = function (...a) {
        let on = false; try { on = localStorage.getItem('lp-fail-put') === '1'; } catch { /* 저장소가 막힘 */ }
        if (on && this.name === 'blobs' && ++n > 5) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
        return put.apply(this, a);
      };
    });
    const f5 = await ctx5.newPage(); const errs5 = L.watch(f5);
    await L.mockAi(ctx5, null, { fallback: true });
    const stored = () => f5.evaluate(() => new Promise((res) => {
      const q = indexedDB.open('lecpage');
      q.onsuccess = () => { const t = q.result.transaction(['projects', 'blobs']); const a = t.objectStore('projects').getAllKeys(); const c = t.objectStore('blobs').getAllKeys(); t.oncomplete = () => res({ projects: a.result.length, blobs: c.result.length }); };
    }));
    await f5.goto(BASE, { waitUntil: 'load' });
    await f5.evaluate(() => localStorage.setItem('lp-fail-put', '1'));
    await f5.setInputFiles('.ld-hero input[type=file][multiple]', file);
    await f5.waitForFunction(() => /저장 공간이 꽉 찼어요/.test(document.querySelector('.toast')?.textContent || ''), null, { timeout: 60000 }).catch(() => {});
    const said = (await f5.locator('.toast').first().innerText().catch(() => '')).replace(/\s+/g, ' ');
    await f5.waitForTimeout(500);
    const left5 = await stored();
    ok('open stops midway (storage full): the toast says storage is full, not "is this a lecpage file?"', /저장 공간이 꽉 찼어요/.test(said) && !/저장한 \.lecpage 파일인지/.test(said), said.slice(0, 100));
    ok('open stops midway: no half-opened project and no stored files are left behind', left5.projects === 0 && left5.blobs === 0 && !/#\/p\//.test(f5.url()), JSON.stringify(left5));
    await f5.evaluate(() => localStorage.removeItem('lp-fail-put'));
    await f5.goto(BASE, { waitUntil: 'load' });
    await f5.setInputFiles('.ld-hero input[type=file][multiple]', file);
    await f5.waitForFunction(() => /#\/p\/[^/]+\/2/.test(location.hash), null, { timeout: 60000 }).catch(() => {});
    const said2 = (await f5.locator('.toast').first().innerText().catch(() => '')).replace(/\s+/g, ' ');
    await f5.waitForTimeout(800);
    const pid5 = L.pidOf(f5); const again5 = pid5 ? await dump(f5, pid5) : {};
    const miss5 = Object.keys(before).filter((k) => !k.startsWith('conv/') && again5[k]?.sha !== before[k].sha);
    ok('opening the same file again imports it from scratch (not "already opened"), with every file', !!pid5 && !/이미 연|이미 열었던/.test(said2) && miss5.length === 0 && (await stored()).projects === 1, `${said2.slice(0, 60)} · missing ${miss5.length}`);
    ok('no page errors when opening fails midway', errs5.length === 0, errs5.slice(0, 2).join(' | '));
    await ctx5.close();
  }

  // ── 2 읽다가 멈춘 교재 ──
  const ctx3 = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const r = await ctx3.newPage(); const errs3 = L.watch(r);
  await L.mockAi(ctx3, null, { fallback: true });
  await L.startWithFile(r, [L.FIX + '/workshop.pdf']);
  const pid3 = L.pidOf(r);
  const setRow = (patch) => r.evaluate(([id, pt]) => new Promise((res, rej) => {
    const q2 = indexedDB.open('lecpage'); q2.onsuccess = () => {
      const t = q2.result.transaction('projects', 'readwrite'); const s = t.objectStore('projects'); const g = s.get(id);
      g.onsuccess = () => { const pr = g.result; pr.files = pr.files.map((f, i) => (i === 0 ? { ...f, pages: 0, pending: true, ...pt } : f)); pr.material = null; pr.slideSets = []; pr.slidesFrom = ''; pr.slidesMade = 0; pr.updatedAt = Date.now() + 5000; s.put(pr); };
      t.oncomplete = res; t.onerror = () => rej(t.error);
    };
  }), [pid3, patch]);
  // (가) 한 번 끝을 못 본 줄(tries 1): 열어도 저절로 읽지 않음
  await r.goto('about:blank'); await r.goto(BASE, { waitUntil: 'load' }); // 저장소를 고칠 동안 앱이 덮어쓰지 않게 떠났다가
  await setRow({ tries: 1 });
  await r.goto(`${BASE}#/p/${pid3}/1`, { waitUntil: 'load' });
  await r.waitForSelector('.files li', { timeout: 30000 });
  await r.waitForTimeout(3000);
  const held = await r.locator('.files li').first().innerText();
  const mid = await L.readProject(r, pid3);
  ok('held row: not re-read automatically on open', /읽다가 멈춤/.test(held) && mid.files[0].pending === true && !mid.material, held.replace(/\s+/g, ' ').slice(0, 120));
  ok('held row: says why and offers [이어서 읽기]; the remove button works on it', /읽다가 멈췄어요/.test(held) && await r.locator('.files li .file-held button:has-text("이어서 읽기")').count() === 1 && !(await r.locator('.files li .icon-btn').first().isDisabled()));
  ok('held row: the make button waits (no material read yet), the screen is not stuck in "reading"', await r.locator('.drop-busy').count() === 0);
  await r.click('.files li .file-held button:has-text("이어서 읽기")');
  await r.waitForFunction(() => /13쪽/.test(document.querySelector('.files li')?.innerText || ''), null, { timeout: 120000 });
  const settled = async () => { let x; for (let i = 0; i < 40; i++) { x = await L.readProject(r, pid3); if (!x.files?.[0]?.pending) break; await r.waitForTimeout(250); } return x; }; // 화면이 먼저 바뀌고 저장은 조금 뒤
  const done = await settled();
  ok('held row: [이어서 읽기] reads it to the end (pages, page images, no pending mark)', !done.files[0].pending && done.files[0].pages === 13 && !done.files[0].tries && (done.slideSets || []).reduce((n, s) => n + s.count, 0) === 13, JSON.stringify(done.files[0]).slice(0, 160));
  // (나) 끝을 못 본 적 없는 줄(tries 없음): 예전처럼 저절로 이어 읽음
  await r.goto('about:blank'); await r.goto(BASE, { waitUntil: 'load' });
  await setRow({ tries: undefined });
  await r.goto(`${BASE}#/p/${pid3}/1`, { waitUntil: 'load' });
  await r.waitForFunction(() => /13쪽/.test(document.querySelector('.files li')?.innerText || ''), null, { timeout: 120000 });
  const auto = await settled();
  ok('fresh pending row (small material): still resumes by itself as before', !auto.files[0].pending && auto.files[0].pages === 13);
  // (다) 멈춘 줄을 삭제: 그 줄과 담아 둔 원본만 지워지고 화면이 멈추지 않음
  await r.goto('about:blank'); await r.goto(BASE, { waitUntil: 'load' });
  await setRow({ tries: 2 });
  await r.goto(`${BASE}#/p/${pid3}/1`, { waitUntil: 'load' });
  await r.waitForSelector('.files li .file-held', { timeout: 30000 });
  await r.click('.files li .icon-btn');
  await r.waitForFunction(() => !document.querySelector('.files li'), null, { timeout: 30000 });
  const gone = await L.readProject(r, pid3); const left = await dump(r, pid3);
  ok('held row: removing it drops the row and its stored original', (gone.files || []).length === 0 && !left['src/workshop.pdf'], JSON.stringify(Object.keys(left)).slice(0, 120));
  ok('no page errors in the held-row flows', errs3.length === 0, errs3.slice(0, 2).join(' | '));
  await ctx3.close();
  // (라) 교재 둘을 함께 읽다 멈춤(큰 것은 시도 횟수가 적혔고 작은 것은 아직): 한 줄만 '읽는 중'으로 남아 기다리게 하지 않고 두 줄 모두 고를 수 있게
  const ctx4 = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const m = await ctx4.newPage(); const errs4 = L.watch(m);
  await L.mockAi(ctx4, null, { fallback: true });
  await L.startWithFile(m, [L.FIX + '/workshop.pdf', L.FIX + '/notes.md']);
  const pid4 = L.pidOf(m);
  await m.goto('about:blank'); await m.goto(BASE, { waitUntil: 'load' });
  await m.evaluate((id) => new Promise((res, rej) => {
    const q2 = indexedDB.open('lecpage'); q2.onsuccess = () => {
      const t = q2.result.transaction('projects', 'readwrite'); const st = t.objectStore('projects'); const g = st.get(id);
      g.onsuccess = () => { const pr = g.result; pr.files = pr.files.map((f, i) => (f.photos ? f : { ...f, pages: 0, pending: true, ...(i === 0 ? { tries: 1 } : {}) })); pr.material = null; pr.slideSets = []; pr.slidesFrom = ''; pr.slidesMade = 0; pr.updatedAt = Date.now() + 5000; st.put(pr); };
      t.oncomplete = res; t.onerror = () => rej(t.error);
    };
  }), pid4);
  await m.goto(`${BASE}#/p/${pid4}/1`, { waitUntil: 'load' });
  await m.waitForSelector('.files li .file-held', { timeout: 30000 });
  await m.waitForFunction(() => document.querySelectorAll('.files li .file-held').length === 2, null, { timeout: 15000 }).catch(() => {});
  ok('two materials stopped together: both rows offer [이어서 읽기], none is left waiting as "reading"', await m.locator('.files li .file-held button:has-text("이어서 읽기")').count() === 2 && !/읽는 중/.test(await m.locator('.files').innerText()), (await m.locator('.files').innerText()).replace(/\s+/g, ' ').slice(0, 160));
  await m.locator('.files li .file-held button:has-text("이어서 읽기")').nth(1).click();
  let both; for (let i = 0; i < 240; i++) { both = await L.readProject(m, pid4); if (!(both.files || []).some((f) => f.pending)) break; await m.waitForTimeout(500); }
  ok('two materials stopped together: one press reads both to the end', both.files.length === 2 && !both.files.some((f) => f.pending || f.tries) && both.files[0].pages === 13 && !!both.material, JSON.stringify(both.files.map((f) => [f.name, f.pages, !!f.pending, f.tries])));
  // (마) 다 읽은 교재가 있어도 읽다가 멈춘 교재가 남아 있으면 만들 수 없음(그 교재가 사이트에서 말없이 빠지지 않게): 까닭을 AI 선택 칸에 알리고, 그 줄을 삭제하면 다시 만들 수 있음
  await m.goto('about:blank'); await m.goto(BASE, { waitUntil: 'load' });
  await m.evaluate((id) => new Promise((res, rej) => {
    const q2 = indexedDB.open('lecpage'); q2.onsuccess = () => {
      const t = q2.result.transaction('projects', 'readwrite'); const st = t.objectStore('projects'); const g = st.get(id);
      g.onsuccess = () => { const pr = g.result; pr.files = pr.files.map((f, i) => (i === 0 ? { ...f, pending: true, tries: 1 } : f)); pr.updatedAt = Date.now() + 5000; st.put(pr); };
      t.oncomplete = res; t.onerror = () => rej(t.error);
    };
  }), pid4);
  await m.goto(`${BASE}#/p/${pid4}/1`, { waitUntil: 'load' });
  await m.waitForSelector('.files li .file-held', { timeout: 30000 });
  await m.waitForTimeout(800);
  const gate = async () => m.evaluate(() => ({ wait: document.querySelector('.ai-pick .ai-pick-wait')?.textContent || '', go: [...document.querySelectorAll('.ai-pick .ai-card-go')].map((x) => x.disabled) }));
  const g1 = await gate();
  ok('one material read + one stopped: making is held back, and the AI box says why and what to do', /읽다가 멈춘 교재가 있어요/.test(g1.wait) && /이어서 읽기/.test(g1.wait) && g1.go.length > 0 && g1.go.every(Boolean), JSON.stringify(g1));
  await m.locator('.files li:has(.file-held) .icon-btn').click();
  await m.waitForFunction(() => !document.querySelector('.files li .file-held'), null, { timeout: 30000 });
  await m.waitForTimeout(500);
  const g2 = await gate();
  ok('after removing the stopped material: making is possible again with what was read', g2.wait === '' && g2.go.length > 0 && g2.go.every((x) => !x) && (await L.readProject(m, pid4)).files.length === 1, JSON.stringify(g2));
  ok('no page errors with two stopped materials', errs4.length === 0, errs4.slice(0, 2).join(' | '));
  await b.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  summary();
})().catch((e) => { console.log('SCRIPT ERROR', e.message); process.exit(1); });
