// 교재 형식마다(PPTX·DOCX·HWP·HWPX·한글 PDF·그림으로 된 PDF) 넣기 → 쪽 그림(교재 슬라이드) → AI에게 보내는 것(가짜 Claude가 받은 요청을 기록) → 조립한 사이트의 교재 쪽 그림.
// 그림으로 된 PDF(스캔본)는 경고 없이 원본 그대로 AI에게 감. PPTX·DOCX·한글은 브라우저 안에서 그린 쪽 그림 + 보조 글자.
// 한글 그리기 도구 본체(jsDelivr의 @rhwp/core rhwp_bg.wasm)는 설치한 파일로 대신 답함(바깥 망 없이). 못 받으면 글자 + 'PDF로 저장하는 법'.
// 사용: BASE=http://localhost:4175/ node doc-render.js  (FIX2: 시험 교재 폴더, 기본 skills/lecpage/engine/test/fixtures)
const L = require('./lib.js');
const path = require('path');
const FX = L.FIX;
const RHWP = path.resolve(__dirname, '../../app/node_modules/@rhwp/core/rhwp_bg.wasm');
const CASES = [
  { file: 'workshop.pptx', slides: 13, sent: 'images', images: 13 },
  { file: 'guide.docx', slides: 1, sent: 'images', images: 1 },
  { file: 'plan.hwpx', slides: 2, sent: 'images', images: 2, hwp: true },
  { file: 'plan.hwp', slides: 2, sent: 'images', images: 2, hwp: true },
  { file: 'plan.hwpx', slides: 0, sent: 'text', howto: true, cdn: 'blocked' }, // 그리기 도구를 못 받으면(학교망 차단 등) 글자 + 안내
  { file: 'plan.hwpx', slides: 0, sent: 'text', howto: true, cdn: 'tampered' }, // 받은 파일이 다르면(SHA-256) 쓰지 않음
  { file: 'workshop.pdf', slides: 13, sent: 'original', pdf: 1 },
  { file: 'ko-cid.pdf', slides: 3, sent: 'original', pdf: 1, chars: 40 }, // 글꼴을 담지 않은 한글 PDF(CMap 필요)
  { file: 'scan.pdf', slides: 2, sent: 'original', pdf: 1, quiet: true }, // 그림으로 된 PDF: 경고 없음
  // lecpage 커넥트가 켜져 있으면 이 PC의 PowerPoint로 PDF를 만들어 씀(가짜 커넥트가 workshop.pdf를 돌려줌) → 그 PDF가 쪽 그림·AI 첨부로
  { file: 'workshop.pptx', connect: true, slides: 13, sent: 'converted', pdf: 1, images: 0 },
];
const fs = require('fs');
const TOKEN = 'a'.repeat(64); const PORT = 6611;
/** 가짜 lecpage 커넥트: 짝은 이 브라우저에 기억된 것으로, /bridge/convert만 답함(나머지 상태는 '꺼짐'처럼 최소로) */
async function mockConnect(ctx) {
  await ctx.addInitScript(([t, port]) => { try { localStorage.setItem('lecpage:pc', JSON.stringify({ token: t, port, at: Date.now() })); } catch { /* 넘김 */ } }, [TOKEN, PORT]);
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  await ctx.route(new RegExp(`^http://127\\.0\\.0\\.1:${PORT}/`), (r) => {
    const u = new URL(r.request().url()); const m = r.request().method();
    if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    const json = (o, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(o) });
    // 짝 증명(/bridge/prove): 증명 길이 없는 예전 판처럼 401 token으로 답함 → 앱이 이 짝에 토큰을 보내도 된다고 봄(진짜 커넥트는 증명으로 답함: engine/test/studio-prove.test.mjs)
    if (u.pathname === '/bridge/prove') return json({ ok: false, error: 'token' }, 401);
    if (u.pathname === '/bridge/convert' && m === 'GET') return json({ ok: true, platform: 'win32', apps: [{ id: 'powerpoint', name: 'PowerPoint' }], exts: { pptx: ['powerpoint'] } });
    if (u.pathname === '/bridge/convert' && m === 'POST') return json({ ok: true, via: 'powerpoint', app: 'PowerPoint', pdf: fs.readFileSync(path.join(FX, 'workshop.pdf')).toString('base64') });
    return r.abort();
  });
}
const blobKeys = (p, id) => p.evaluate((pid) => new Promise((res) => { const q = indexedDB.open('lecpage'); q.onsuccess = () => { const t = q.result.transaction('blobs').objectStore('blobs').getAllKeys(IDBKeyRange.bound(pid + ':', pid + ':￿')); t.onsuccess = () => res(t.result.map(String).map((k) => k.slice(pid.length + 1))); }; }), id);

(async () => {
  const b = await L.chromium.launch();
  for (const c of CASES) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    const sent = [];
    if (c.connect) await mockConnect(ctx);
    let wasmAsked = 0;
    await L.mockAi(ctx, async (r, u) => {
      if (/^https:\/\/cdn\.jsdelivr\.net\/npm\/@rhwp\/core@[\d.]+\/rhwp_bg\.wasm$/.test(u)) {
        wasmAsked++;
        if (c.cdn === 'blocked') { await r.abort(); return true; }
        const body = fs.readFileSync(RHWP); if (c.cdn === 'tampered') body[body.length - 1] ^= 1;
        await r.fulfill({ status: 200, contentType: 'application/wasm', headers: { 'access-control-allow-origin': '*' }, body });
        return true;
      }
      if (/api\.anthropic\.com\/v1\/messages/.test(u) && r.request().method() === 'POST') sent.push(JSON.parse(r.request().postData() || '{}'));
      return false;
    });
    const p = await ctx.newPage(); const errs = L.watch(p);
    try {
      await L.startWithFile(p, [path.join(FX, c.file)]);
      await p.waitForTimeout(800);
      const pid = L.pidOf(p);
      const pr = await L.readProject(p, pid);
      const row = (pr.files || [])[0] || {};
      const keys = await blobKeys(p, pid);
      const slides = keys.filter((k) => k.startsWith('assets/slides/')).length;
      L.ok(`${c.file}: page images for the deck (${c.slides})`, slides === c.slides, `slides=${slides}`);
      L.ok(`${c.file}: no red error`, !(row.errors || []).length, JSON.stringify(row.errors));
      if (c.quiet) L.ok(`${c.file}: image-only PDF shows no warning`, await p.locator('.files .file-warn').count() === 0 && !(row.warns || []).length, JSON.stringify(row.warns));
      if (c.howto) L.ok(`${c.file}${c.cdn ? ` (${c.cdn})` : ''}: text-only note + how to save as PDF`, /글자만 읽었어요/.test(await p.locator('.files li').first().innerText()) && await p.locator('.files .file-howto summary').count() === 1);
      L.ok(`${c.file}: Hangul renderer fetched ${c.hwp || c.cdn ? 'once' : 'never'} (only for .hwp/.hwpx)`, wasmAsked === (c.hwp || c.cdn ? 1 : 0), `asked=${wasmAsked}`);
      if (c.hwp) L.ok(`${c.file}: no 'save as PDF' note when pages are drawn`, await p.locator('.files .file-howto').count() === 0 && !/글자만 읽었어요/.test(await p.locator('.files li').first().innerText()));
      if (c.hwp) L.ok(`${c.file}: file row shows the drawn page count`, (await p.locator('.files li').first().innerText()).includes(`${c.slides}쪽`) && (pr.files || [])[0]?.pages === c.slides, `pages=${(pr.files || [])[0]?.pages}`);
      if (c.chars) L.ok(`${c.file}: Korean text read (CMap)`, (pr.material?.pages || []).reduce((s, x) => s + (x.title || '').length + (x.paragraphs || []).reduce((a, y) => a + y.text.length, 0), 0) >= c.chars);
      if (c.connect) L.ok(`${c.file}: converted with the PC app (커넥트)`, /PowerPoint로 PDF를 만들어 썼어요/.test(await p.locator('.files li').first().innerText()) && keys.some((k) => /^conv\/.+\.pdf$/.test(k)));
      // AI에게 보내기(가짜 Claude): 첫 요청의 첨부
      await L.connectAi(p);
      await L.waitStudio(p, 90000);
      const first = sent[0] || { messages: [] };
      const blocks = (first.messages || []).flatMap((m) => (Array.isArray(m.content) ? m.content : []));
      const imgs = blocks.filter((x) => x.type === 'image').length; const docs = blocks.filter((x) => x.type === 'document').length;
      const text = blocks.filter((x) => x.type === 'text').map((x) => x.text).join('\n');
      const label = { images: '쪽 그림으로 첨부', original: '원본 그대로 첨부', text: '글자만', converted: 'PowerPoint로 만든 PDF로 첨부' }[c.sent];
      L.ok(`${c.file}: sent to AI as ${c.sent}`, text.includes(`${c.file}`) && text.includes(label) && (c.images == null || imgs === c.images) && (c.pdf == null || docs === c.pdf) && (c.sent !== 'text' || (imgs === 0 && docs === 0)), `images=${imgs} documents=${docs}`);
      if (c.sent === 'converted') L.ok(`${c.file}: the converted PDF is attached by name`, blocks.some((x) => x.type === 'document' && x.title === 'workshop.pdf'));
      else if (c.sent !== 'original') L.ok(`${c.file}: helper text from the file`, /코드가 뽑은 글자/.test(text));
      // 조립한 사이트가 쓸 수 있는 교재 쪽 그림(site/material/p-NNN)
      const site = (await blobKeys(p, pid)).filter((k) => /^site\/material\/p-\d{3}\./.test(k)).length;
      L.ok(`${c.file}: deck images in the site (${c.slides})`, site === c.slides, `site=${site}`);
      await p.screenshot({ path: L.OUT + `doc-render-${c.file}${c.connect ? "-connect" : ""}${c.cdn ? "-" + c.cdn : ""}.png` });
    } catch (e) { L.ok(`${c.file}${c.connect ? ' (커넥트)' : ''}${c.cdn ? ` (${c.cdn})` : ''}: flow`, false, e.message.split('\n')[0]); }
    // 가짜 AI 답(mock-site)은 13쪽 교재 기준이라 material/p-003 같은 없는 쪽 그림을 부름(미리보기가 막음): 그 줄만 빼고
    const real = errs.filter((e) => !/material\/p-\d{3}\.webp' violates the following Content Security Policy directive: "img-src/.test(e));
    L.ok(`${c.file}: no script errors`, !real.length, real.slice(0, 3).join(' | '));
    await ctx.close();
  }
  await b.close();
  process.exit(L.summary() ? 1 : 0);
})();
