// 교재가 여럿일 때 교재마다 쪽 그림(이어 매긴 번호): 넣기 → 저장(slideSets·assets/slides) → AI에게 알리는 글·보낸 그림 → 사이트(site/material)·교재 슬라이드
// → 교재 더 넣기(이어 붙임) → 교재 빼기(번호를 다시 매김) → 다시 열기. 교재 하나는 예전과 같은 값·같은 글.
//   BASE=http://localhost:4401/ node tests/e2e/multi-material.js
const L = require('./lib.js');
const { chromium, FIX, OUT, ok, summary, BASE } = L;
// 한글 그리기 도구 본체(jsDelivr의 @rhwp/core rhwp_bg.wasm)는 설치한 파일로 대신 답함(바깥 망 없이, doc-render.js와 같게)
const RHWP = require('path').resolve(__dirname, '../../app/node_modules/@rhwp/core/rhwp_bg.wasm');
const rhwp = async (r, u) => {
  if (!/^https:\/\/cdn\.jsdelivr\.net\/npm\/@rhwp\/core@[\d.]+\/rhwp_bg\.wasm$/.test(u)) return false;
  await r.fulfill({ status: 200, contentType: 'application/wasm', headers: { 'access-control-allow-origin': '*' }, body: L.fs.readFileSync(RHWP) });
  return true;
};

/** 그 연수의 저장소 열쇠(앞머리로 고름) */
const blobKeys = (p, pid, prefix) => p.evaluate(([id, pre]) => new Promise((res) => {
  const q = indexedDB.open('lecpage');
  q.onsuccess = () => { const t = q.result.transaction('blobs').objectStore('blobs').getAllKeys(IDBKeyRange.bound(id + ':' + pre, id + ':' + pre + '￿')); t.onsuccess = () => res(t.result.map((k) => String(k).slice(id.length + 1)).sort()); };
}), [pid, prefix]);
const nums = (keys) => keys.map((k) => +/(\d{3,4})\.\w+$/.exec(k)[1]);
const seq = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const answer = (pages) => '```html\n<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><title>교재 둘 시험</title></head><body><main><section id="top" data-title="첫 화면"><h1>교재 둘 시험</h1><p>교재 두 개를 넣은 연수예요.</p></section>'
  + `<section id="deck" data-title="교재"><h2>교재</h2><div data-lp="deck" data-pages="1-${pages}"></div></section></main></body></html>\n` + '```\n\n```json\n{"title":"교재 둘 시험","sessions":[{"date":"2026-12-01","start":"10:00","end":"12:00"}],"venue":"3층 연수실","instructors":[{"name":"김강사","org":""}]}\n```';
/** 만들 때 AI에게 간 요청(가짜 Claude가 받은 본문)을 잡아 둠 */
function capture(p) {
  const got = [];
  p.on('request', (r) => { if (/api\.anthropic\.com\/v1\/messages/.test(r.url()) && r.method() === 'POST') { try { got.push(JSON.parse(r.postData() || '{}')); } catch { /* 그대로 */ } } });
  const parts = () => (got.at(-1)?.messages || []).flatMap((m) => (Array.isArray(m.content) ? m.content : [{ type: 'text', text: m.content }]));
  return { text: () => parts().map((x) => x.text || '').join('\n'), images: () => parts().filter((x) => x.type === 'image').length, docs: () => parts().filter((x) => x.type === 'document').length };
}
/** 연수가 저장될 때까지(모아 쓰기라 조금 늦음): want(연수)가 참일 때까지 기다렸다가 그 연수를 돌려줌 */
async function saved(p, pid, want, ms = 8000) {
  let pr = null;
  for (const t0 = Date.now(); Date.now() - t0 < ms;) { pr = await L.readProject(p, pid); if (pr && want(pr)) break; await p.waitForTimeout(200); }
  return pr || {};
}
const addFiles = async (p, files) => { await p.setInputFiles('.start-files input[type=file]', files); await p.waitForTimeout(300); await L.aiReady(p, 120000); };

(async () => {
  const b = await chromium.launch();
  // ── 1) PPTX + 워드: 둘 다 브라우저 안에서 그림 ──
  {
    const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
    await L.mockAi(ctx, rhwp);
    const p = await ctx.newPage(); const errs = L.watch(p); const cap = capture(p);
    await L.startWithFile(p, [FIX + '/workshop.pptx', FIX + '/guide.docx']);
    const pid = L.pidOf(p);
    let pr = await saved(p, pid, (x) => (x.slideSets || []).length === 2 && !(x.files || []).some((f) => f.pending));
    const sets = pr.slideSets || [];
    if (sets.length !== 2) { ok('교재 둘: 교재마다 쪽 그림 묶음(이어 매긴 번호)', false, JSON.stringify([sets, pr.files])); await b.close(); process.exit(1); }
    ok('교재 둘: 교재마다 쪽 그림 묶음(이어 매긴 번호)', sets.length === 2 && sets[0].name === 'workshop.pptx' && sets[0].first === 1 && sets[0].count === 13 && sets[1].name === 'guide.docx' && sets[1].first === 14 && sets[1].count >= 1, JSON.stringify(sets));
    const total = sets.reduce((n, s) => n + s.count, 0);
    ok('예전 칸도 맞춤(slidesMade 합계 · slidesFrom은 한 교재가 아니라 비움)', pr.slidesMade === total && pr.slidesFrom === '', `${pr.slidesMade} ${pr.slidesFrom}`);
    let slides = await blobKeys(p, pid, 'assets/slides/');
    ok('쪽 그림 파일이 1번부터 끝까지 빠짐없이', JSON.stringify(nums(slides)) === JSON.stringify(seq(1, total)), slides.join(' ').slice(0, 200));
    await p.screenshot({ path: OUT + 'multi-1-start.png', fullPage: true });

    await L.makeWith(p, answer(total)); await p.click('.st-info button:has-text("이 정보가 맞아요")');
    await L.waitStudio(p);
    const text = cap.text();
    ok('AI에게: 교재마다 어느 번호가 몇 쪽인지 있는 그대로', new RegExp(`사이트에 쓸 수 있는 교재 쪽 그림: material/p-001 ~ material/p-${String(total).padStart(3, '0')} \\(교재마다 이어서 매긴 번호\\)\\n- workshop\\.pptx: material/p-001\\.\\w+ ~ material/p-013\\.\\w+ \\(이 교재의 1~13쪽\\)\\n- guide\\.docx: material/p-014\\.\\w+ ~ material/p-${String(total).padStart(3, '0')}\\.\\w+ \\(이 교재의 1~${sets[1].count}쪽\\)`).test(text), (/사이트에 쓸[^[]*/.exec(text) || [''])[0].slice(0, 400));
    ok('AI에게: 두 교재 모두 쪽 그림으로 첨부(그림 수 = 두 교재의 쪽 수)', /- workshop\.pptx \(13쪽\): 쪽 그림으로 첨부/.test(text) && /- guide\.docx[^\n]*: 쪽 그림으로 첨부/.test(text) && cap.images() === total, `${cap.images()} / ${total}`);
    ok('요청문은 그대로(교재 넘기기 설명 줄이 있음)', /교재 슬라이드는 교재 넘기기\(/.test(text));
    const mat = await blobKeys(p, pid, 'site/material/');
    ok('사이트의 교재 쪽 그림도 같은 번호로 모두', JSON.stringify(nums(mat)) === JSON.stringify(seq(1, total)), mat.join(' ').slice(0, 200));
    // 미리보기의 교재 슬라이드: 두 교재의 쪽이 모두 나오고 둘째 교재의 첫 쪽(p-014) 그림이 열림
    let deck = null;
    for (let i = 0; i < 40 && !deck; i++) { for (const f of p.frames()) { if (await f.locator('.lp-deck figure.lp-slide').count().catch(() => 0)) { deck = f; break; } } if (!deck) await p.waitForTimeout(250); }
    const slidesInDeck = deck ? await deck.locator('.lp-deck figure.lp-slide').count() : 0;
    ok('미리보기: 교재 슬라이드에 두 교재의 쪽이 모두', slidesInDeck === total, String(slidesInDeck));
    const img14 = deck ? await deck.evaluate(async () => { const im = document.querySelector('#deck-p14 img'); if (!im) return 'none'; im.loading = 'eager'; try { await im.decode(); } catch { /* 아래에서 봄 */ } return im.naturalWidth > 0 ? 'ok' : 'broken'; }) : 'no-deck';
    ok('미리보기: 둘째 교재의 첫 쪽 그림(p-014)이 열림', img14 === 'ok', img14);
    if (deck) { await deck.locator('#deck').scrollIntoViewIfNeeded().catch(() => {}); await p.waitForTimeout(400); }
    await p.screenshot({ path: OUT + 'multi-2-preview.png' });

    // 교재를 더 넣으면 있던 묶음 뒤에 이어 붙임(앞 교재의 번호는 그대로)
    await p.click('.wiz-steps a, .wiz-steps button', { timeout: 3000 }).catch(() => {});
    await p.goto(BASE + '#/p/' + pid + '/1'); await p.waitForSelector('.start-files .files li');
    await addFiles(p, [FIX + '/ko-cid.pdf', FIX + '/plan.hwp']);
    pr = await saved(p, pid, (x) => (x.slideSets || []).length === 4);
    const s2 = pr.slideSets || [];
    ok('더 넣기: 앞 묶음은 그대로, PDF·한글이 뒤에 이어짐', s2.length === 4 && JSON.stringify(s2.slice(0, 2)) === JSON.stringify(sets) && s2[2].name === 'ko-cid.pdf' && s2[2].first === total + 1 && s2[2].count === 3 && s2[3].name === 'plan.hwp' && s2[3].first === total + 4 && s2[3].count >= 1, JSON.stringify(s2));
    const total2 = s2.reduce((n, s) => n + s.count, 0);
    slides = await blobKeys(p, pid, 'assets/slides/');
    ok('더 넣기: 쪽 그림 파일이 끝까지 이어짐', JSON.stringify(nums(slides)) === JSON.stringify(seq(1, total2)), `${slides.length} / ${total2}`);
    const mat2 = await blobKeys(p, pid, 'site/material/');
    ok('더 넣기: 만든 사이트의 쪽 그림은 그대로(다시 만들 때 옮김)', mat2.length === total);
    await p.screenshot({ path: OUT + 'multi-3-four.png', fullPage: true });

    // 교재를 빼면 남은 교재를 다시 읽으며 번호를 처음부터 다시 매김
    await p.click('.start-files .files li:has-text("workshop.pptx") .icon-btn');
    await p.waitForFunction(() => !/workshop\.pptx/.test(document.querySelector('.files')?.textContent || ''), null, { timeout: 60000 });
    await L.aiReady(p, 120000);
    pr = await saved(p, pid, (x) => (x.slideSets || []).length === 3 && (x.files || []).length === 3);
    const s3 = pr.slideSets || [];
    ok('빼기: 남은 교재만, 1번부터 다시', s3.length === 3 && s3[0].name === 'guide.docx' && s3[0].first === 1 && s3[1].name === 'ko-cid.pdf' && s3[1].first === s3[0].count + 1 && s3[2].name === 'plan.hwp' && s3[2].first === s3[0].count + 4, JSON.stringify(s3));
    const total3 = s3.reduce((n, s) => n + s.count, 0);
    slides = await blobKeys(p, pid, 'assets/slides/');
    ok('빼기: 뺀 교재의 쪽 그림이 남지 않음', JSON.stringify(nums(slides)) === JSON.stringify(seq(1, total3)), `${slides.length} / ${total3}`);
    // 새로 고쳐 다시 열어도 그대로
    await p.reload(); await p.waitForSelector('.start-files .files li'); await L.aiReady(p, 60000);
    pr = await L.readProject(p, pid);
    ok('다시 열기: 묶음이 그대로', JSON.stringify(pr.slideSets) === JSON.stringify(s3));
    // 교재를 빼고 남은 교재를 다시 읽는 중에 새로 고침: 다시 열면 이어서 읽어 쪽 그림이 남은 교재 것으로 다시 생김(조용히 사라지지 않음)
    await p.click('.start-files .files li:has-text("ko-cid.pdf") .icon-btn');
    const mid = await saved(p, pid, (x) => (x.slideSets || []).length === 0 && (x.files || []).some((f) => f.pending), 20000);
    ok('빼는 중: 다시 읽을 교재를 "읽는 중"으로 적어 둠(뺀 교재는 목록에 없음)', (mid.slideSets || []).length === 0 && (mid.files || []).filter((f) => f.pending).map((f) => f.name).join() === 'guide.docx,plan.hwp' && !(mid.files || []).some((f) => f.name === 'ko-cid.pdf') && !mid.material, JSON.stringify([mid.slideSets, (mid.files || []).map((f) => [f.name, !!f.pending])]));
    await p.reload(); await p.waitForSelector('.start-files .files li'); await L.aiReady(p, 120000);
    pr = await saved(p, pid, (x) => (x.slideSets || []).length === 2 && !(x.files || []).some((f) => f.pending), 60000);
    const s4 = pr.slideSets || []; const total4 = s4.reduce((n, s) => n + s.count, 0);
    ok('빼는 중에 새로 고침: 다시 열면 남은 교재를 이어서 읽음(묶음·글)', s4.length === 2 && s4[0].name === 'guide.docx' && s4[0].first === 1 && s4[1].name === 'plan.hwp' && s4[1].first === s4[0].count + 1 && (pr.files || []).filter((f) => !f.photos).length === 2 && !!pr.material, JSON.stringify([s4, (pr.files || []).map((f) => [f.name, !!f.pending])]));
    slides = await blobKeys(p, pid, 'assets/slides/');
    ok('빼는 중에 새로 고침: 쪽 그림이 1번부터 빠짐없이', total4 > 0 && JSON.stringify(nums(slides)) === JSON.stringify(seq(1, total4)), `${slides.length} / ${total4}`);
    ok('화면 오류 없음(교재 둘)', errs.length === 0, errs.join(' | ').slice(0, 300));
    await ctx.close();
  }
  // ── 2) 교재 하나(PDF): 예전과 같은 값·같은 글 ──
  {
    const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
    await L.mockAi(ctx, rhwp);
    const p = await ctx.newPage(); const errs = L.watch(p); const cap = capture(p);
    await L.startWithFile(p);
    const pid = L.pidOf(p);
    const pr = await saved(p, pid, (x) => (x.slideSets || []).length === 1);
    ok('교재 하나: 묶음 하나(1번부터) · 예전 칸은 예전과 같은 값', JSON.stringify(pr.slideSets) === JSON.stringify([{ name: 'workshop.pdf', first: 1, count: 13 }]) && pr.slidesMade === 13 && pr.slidesFrom === 'workshop.pdf', JSON.stringify([pr.slideSets, pr.slidesMade, pr.slidesFrom]));
    // 같은 이름의 교재를 다시 넣으면 예전 것을 바꿈(목록·쪽 그림이 두 번 들어가지 않음)
    await addFiles(p, [FIX + '/workshop.pdf']); await p.waitForTimeout(600);
    const re = await saved(p, pid, (x) => (x.files || []).length === 1 && (x.slideSets || []).length === 1 && !(x.files || []).some((f) => f.pending));
    const reSlides = await blobKeys(p, pid, 'assets/slides/');
    ok('같은 이름의 교재를 다시 넣음: 한 줄·쪽 그림 13장 그대로', (re.files || []).length === 1 && JSON.stringify(re.slideSets) === JSON.stringify([{ name: 'workshop.pdf', first: 1, count: 13 }]) && reSlides.length === 13 && (re.material?.files || []).length === 1, JSON.stringify([(re.files || []).map((f) => f.name), re.slideSets, reSlides.length, (re.material?.files || []).length]));
    await L.makeWith(p, answer(13)); await p.click('.st-info button:has-text("이 정보가 맞아요")');
    await L.waitStudio(p);
    const text = cap.text();
    ok('교재 하나: AI에게 가는 쪽 그림 줄이 예전과 같음', /\n사이트에 쓸 수 있는 교재 쪽 그림: material\/p-001\.webp ~ material\/p-013\.webp \(번호 = 교재 쪽 번호, workshop\.pdf\)/.test(text) && !/이어서 매긴 번호/.test(text), (/사이트에 쓸[^\n]*/.exec(text) || [''])[0]);
    ok('교재 하나: PDF는 원본 그대로(쪽 그림을 따로 보내지 않음)', /- workshop\.pdf \(13쪽\): 원본 그대로 첨부/.test(text) && cap.docs() === 1 && cap.images() === 0, `${cap.docs()} ${cap.images()}`);
    ok('원본으로 보낸 PDF에 걸린 링크 주소를 자료로 붙임', /\[교재의 글자·단추·그림에 걸린 링크 주소 — PDF에서는 주소가 보이지 않아요\. 교재 파일에 적힌 그대로예요\]\n- workshop\.pdf \d+쪽: [^\n]*https?:\/\//.test(text), (/\[교재의 글자[^]*?(?=\n\n|$)/.exec(text) || ['(없음)'])[0].slice(0, 300));
    const mat = await blobKeys(p, pid, 'site/material/');
    ok('교재 하나: 사이트의 쪽 그림 13장', mat.length === 13 && mat[0] === 'site/material/p-001.webp');
    ok('화면 오류 없음(교재 하나)', errs.length === 0, errs.join(' | ').slice(0, 300));
    await ctx.close();
  }
  // ── 2-2) 예전 연수(쪽 그림은 한 교재의 것: slidesFrom·slidesMade만 있음)에 교재를 더 넣음: 있던 쪽 그림 뒤에 이어 붙임 ──
  {
    const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
    await L.mockAi(ctx, rhwp);
    const p = await ctx.newPage(); const errs = L.watch(p);
    await L.startWithFile(p);
    const pid = L.pidOf(p);
    await saved(p, pid, (x) => (x.slideSets || []).length === 1);
    await p.waitForTimeout(800);
    await p.evaluate((id) => new Promise((res, rej) => { // 저장된 연수를 예전 꼴로(묶음 칸 없음)
      const q = indexedDB.open('lecpage');
      q.onsuccess = () => { const st = q.result.transaction('projects', 'readwrite').objectStore('projects'); const g = st.get(id); g.onsuccess = () => { const v = g.result; delete v.slideSets; const w = st.put(v); w.onsuccess = () => res(); w.onerror = rej; }; };
    }), pid);
    await p.reload(); await p.waitForSelector('.start-files .files li'); await L.aiReady(p, 60000);
    const old = await L.readProject(p, pid);
    ok('예전 연수: 묶음 칸 없이도 그대로 열림', !('slideSets' in old) && old.slidesFrom === 'workshop.pdf' && old.slidesMade === 13 && await p.locator('.start-files .files li').count() === 1);
    await addFiles(p, [FIX + '/ko-cid.pdf']);
    const pr = await saved(p, pid, (x) => (x.slideSets || []).length === 2);
    const slides = await blobKeys(p, pid, 'assets/slides/');
    ok('예전 연수에 교재를 더 넣음: 있던 쪽 그림(1~13) 뒤에 이어 붙임', JSON.stringify(pr.slideSets) === JSON.stringify([{ name: 'workshop.pdf', first: 1, count: 13 }, { name: 'ko-cid.pdf', first: 14, count: 3 }]) && JSON.stringify(nums(slides)) === JSON.stringify(seq(1, 16)), JSON.stringify([pr.slideSets, slides.length]));
    ok('화면 오류 없음(예전 연수)', errs.length === 0, errs.join(' | ').slice(0, 300));
    await ctx.close();
  }
  // ── 3) lecpage 커넥트 길(Claude 계정, 가짜 커넥트): 교재마다 그린 쪽 그림과 묶음 표시가 그대로 감. 예전 커넥트에는 첫 교재의 것만 ──
  for (const caps of [['status-caps', 'jobs', 'claude-setup', 'update', 'page-sets'], ['status-caps', 'jobs', 'claude-setup', 'update']]) {
    const modern = caps.includes('page-sets');
    const T = 'c'.repeat(64); const PORT = 6620; const jobs = [];
    const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
    await ctx.addInitScript(([tk, port]) => {
      try { if (!localStorage.getItem('lp-seeded')) { localStorage.setItem('lecpage:pc', JSON.stringify({ token: tk, port, ok: true })); localStorage.setItem('lp-seeded', '1'); } } catch { /* 넘김 */ }
      const q = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = (d) => (/network/.test(d?.name || '') ? Promise.resolve({ state: 'granted' }) : q(d));
    }, [T, PORT]);
    const STATUS = JSON.stringify({ ok: true, version: '1.1.0', build: '1.1.0-x', caps, update: { can: false, state: 'idle' }, platform: 'win32', port: PORT, chatgpt: { connected: false }, limits: { materialMB: 120, fileMB: 100, files: 20, twinPdf: true, minutes: 30 },
      agents: [{ id: 'claude', name: 'Claude Code', installed: true, version: '2.2.0', auth: 'account', ready: true }, { id: 'codex', installed: false, ready: false }] });
    await L.mockAi(ctx, rhwp);
    await ctx.route(/^http:\/\/127\.0\.0\.1:66\d\d\//, (r) => {
      const u = new URL(r.request().url()); const m = r.request().method();
      const json = (o, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: L.cors, body: typeof o === 'string' ? o : JSON.stringify(o) });
      if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: L.cors });
      if (+u.port !== PORT) return r.abort();
      if (r.request().headers()['x-lecpage-bridge'] !== T) return json({ ok: false, error: 'token' }, 401);
      if (u.pathname === '/bridge/status') return json(STATUS);
      if (u.pathname === '/bridge/jobs' && m === 'POST') { jobs.push(JSON.parse(r.request().postData() || '{}')); return json({ ok: true, jobId: 'j1' }, 202); }
      if (u.pathname === '/bridge/jobs/j1/events') return r.fulfill({ status: 200, contentType: 'text/event-stream', headers: L.cors, body: 'data: {"type":"step","name":"agent","label_ko":"만드는 중"}\n\ndata: {"type":"done"}\n\n' });
      if (u.pathname === '/bridge/jobs/j1/result') {
        const n = Object.keys(jobs.at(-1)?.site || {}).length;
        return json({ ok: true, site: { 'index.html': /```html\n([^]*?)\n```/.exec(answer(n))[1] }, meta: { title: '교재 둘 시험', sessions: [{ date: '2026-12-01', start: '10:00', end: '12:00' }], venue: '3층 연수실', instructors: [{ name: '김강사', org: '' }] }, issues: [] });
      }
      if (m === 'DELETE') return json({ ok: true });
      return json({ ok: false, error: 'not-found' }, 404);
    });
    const p = await ctx.newPage(); const errs = L.watch(p);
    await L.startWithFile(p, [FIX + '/workshop.pptx', FIX + '/ko-cid.pdf', FIX + '/notes.md']);
    const pid = L.pidOf(p);
    const pr = await saved(p, pid, (x) => (x.slideSets || []).length === 2);
    const btn = p.locator('.ai-pick button:has-text("Claude로 만들기")').first();
    const shown = await btn.waitFor({ timeout: 15000 }).then(() => true, () => false);
    if (!shown) { ok(`커넥트 길(${modern ? '새' : '예전'} 커넥트): [Claude로 만들기]가 보임`, false, (await p.locator('.ai-pick').innerText().catch(() => '')).slice(0, 300)); await ctx.close(); continue; }
    await btn.click(); await L.consent(p);
    await p.waitForSelector('.st-info button:has-text("이 정보가 맞아요")', { timeout: 60000 });
    const job = jobs.at(-1) || {};
    const flags = Object.fromEntries((job.files || []).map((f) => [f.name, f.pageImages ?? null]));
    const keys = Object.keys(job.site || {}).sort();
    if (modern) {
      ok('커넥트 길: 교재마다 어느 번호의 쪽 그림인지 표시({ first, count })', JSON.stringify(flags) === JSON.stringify({ 'workshop.pptx': { first: 1, count: 13 }, 'ko-cid.pdf': { first: 14, count: 3 }, 'notes.md': null }), JSON.stringify(flags));
      ok('커넥트 길: 두 교재의 쪽 그림을 모두 보냄(p-001~p-016)', JSON.stringify(keys.map((k) => +/p-(\d+)/.exec(k)[1])) === JSON.stringify(seq(1, 16)) && keys.every((k) => typeof job.site[k]?.base64 === 'string' && job.site[k].base64.length > 100), keys.join(' ').slice(0, 200));
      const mat = await blobKeys(p, pid, 'site/material/');
      ok('커넥트 길: 만든 사이트에 두 교재의 쪽 그림이 모두', mat.length === 16 && (pr.slideSets || []).length === 2, String(mat.length));
    } else {
      ok('예전 커넥트: 첫 교재의 쪽 그림만, 예전 표시(true)로', JSON.stringify(flags) === JSON.stringify({ 'workshop.pptx': true, 'ko-cid.pdf': null, 'notes.md': null }) && JSON.stringify(keys.map((k) => +/p-(\d+)/.exec(k)[1])) === JSON.stringify(seq(1, 13)), JSON.stringify(flags) + ' ' + keys.length);
      const done = await saved(p, pid, (x) => (x.notes || []).length > 0, 4000);
      ok('예전 커넥트: 줄여 보낸 사실을 기록에 남김', (done.notes || []).some((n) => /예전 버전이라 workshop\.pptx의 쪽 그림만 보냈어요/.test(n)), JSON.stringify(done.notes || []));
    }
    ok(`화면 오류 없음(커넥트 길, ${modern ? '새' : '예전'} 커넥트)`, errs.length === 0, errs.join(' | ').slice(0, 300));
    await ctx.close();
  }
  await b.close();
  process.exit(summary() ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
