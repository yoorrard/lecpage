// 새 흐름 e2e: 먼저 해보기(같은 화면), 쓰던 앱(끊긴 답 이어 붙이기), 실패 안내와 이어 하기, 내 PC 연결 프로그램 감지, 예전 방식 연수
const L = require('./lib.js');
const W = Number(process.env.W || 1366), HH = Number(process.env.H || 860);
const tag = process.env.TAG || String(W);
const CUT1 = '좋아요. 교재를 읽고 만들었어요.\n```html\n<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><title>쓰던 앱 연수</title><style>:root{--lp-accent:#9a3412;--lp-ink:#1f1a17;--lp-paper:#fff7ed}body{font-family:sans-serif;background:var(--lp-paper);color:var(--lp-ink)}</style></head><body><main>\n<section id="hello" data-title="첫 화면"><h1>쓰던 앱으로 만든 연수</h1><p>교재를 바탕으로 만들었어요.</p></section>\n<section id="ask" data-title="질문"><h2>질문</h2>';
const CUT2 = '<div data-lp="qa"></div></section>\n</main></body></html>\n```\n```json\n{"v":2,"title":"쓰던 앱으로 만든 연수","sessions":[{"date":"2027-01-15","start":"10:00","end":"12:00"}],"venue":"강당","features":["qa"],"facts":[{"label":"장소","value":"강당","page":2}],"live":{"provider":"http","url":"https://evil.example"}}\n```';
(async () => {
  const b = await L.chromium.launch();
  const ctx = await b.newContext({ viewport: { width: W, height: HH }, deviceScaleFactor: 1 });
  await L.mockAi(ctx);
  await ctx.addInitScript(() => { window.open = () => null; }); // 쓰던 앱 창은 열지 않음(복사만 확인)
  const p = await ctx.newPage(); const errs = L.watch(p);

  // ── A. 먼저 해보기: 같은 연수 화면 ──
  await p.goto(L.BASE + '#/demo', { waitUntil: 'load' });
  await p.waitForSelector('.demo-bar', { timeout: 20000 });
  await p.waitForFunction(() => /(17|18|30)쪽/.test(document.querySelector('.files')?.textContent || ''), null, { timeout: 90000 });
  await p.waitForSelector('.ai-nokey .btn:not([disabled])');
  L.ok('demo: same Project screen (stepper 3 + AI pick + files)', await p.locator('.wiz .stepper li').count() === 3 && await p.locator('.ai-pick .ai-card').count() === 2 && await p.locator('.files li').count() === 1);
  L.ok('demo: no separate mini screen', await p.locator('.demo-ai, .demo-tip').count() === 0);
  await p.screenshot({ path: L.OUT + `${tag}-demo-01-start.png`, fullPage: true });
  await p.click('details.ai-more:not([open]) > summary').catch(() => {}); await p.click('.ai-card:has(h3:text-is("Claude")) button:has-text("API 키 연결")');
  await p.waitForSelector('.making', { timeout: 10000 }); await p.waitForTimeout(1200);
  L.ok('demo: real pipeline steps, pre-made answers note', /미리 만든 AI 답/.test(await p.locator('.step-head').innerText()) && /교재 읽고 사이트 만들기/.test(await p.locator('.making-steps').innerText()));
  L.ok('demo: no preview while making', await p.locator('.preview, .pv-device').count() === 0);
  await p.screenshot({ path: L.OUT + `${tag}-demo-02-making.png`, fullPage: true });
  await L.waitStudio(p, 90000);
  const fr = p.frameLocator('.pv-device iframe');
  L.ok('demo: reference site shown', /기록은 쌓였는데|생성형 AI로|질문이 먼저/.test(await fr.locator('h1').first().innerText()));
  L.ok('demo: page image used', await fr.locator('img[src^="data:image"]').count() >= 1);
  await p.screenshot({ path: L.OUT + `${tag}-demo-03-studio.png` });
  await p.click('#panel-info button:has-text("이 정보가 맞아요")');
  await p.click('.head-tools button:has-text("배포하기")');
  await p.waitForSelector('.demo-pub button:has-text("배포 연습하기")', { timeout: 20000 });
  L.ok('demo: real share checklist kept', await p.locator('.ready-i').count() >= 3);
  await p.click('.demo-pub button:has-text("배포 연습하기")');
  await p.waitForSelector('.demo-pub .demo-done-main', { timeout: 20000 });
  L.ok('demo: practice publish says not uploaded', /체험이라|실제로는/.test(await p.locator('.demo-pub').innerText()));
  await p.screenshot({ path: L.OUT + `${tag}-demo-04-share.png`, fullPage: true });
  await p.goto(L.BASE, { waitUntil: 'load' }); await p.waitForTimeout(1500);
  L.ok('demo: not in my list', !/체험 연수|데이터로 읽는|생성형 AI로 수업|질문이 먼저/.test(await p.locator('.ld-mine').innerText().catch(() => '')));

  // ── B. 쓰던 앱(키 없이): 프롬프트 복사 → 첨부 안내 → 끊긴 답 → 이어진 답 ──
  await L.startWithFile(p);
  await p.click('.ai-nokey button:has-text("쓰던 Claude로")');
  await p.waitForSelector('#chat-way');
  L.ok('chat: attach original file guide', /교재 원본 파일을 그 창에 첨부/.test(await p.locator('#chat-way').innerText()));
  await p.waitForFunction(() => !document.querySelector('#chat-way .btn-link')?.disabled);
  await p.click('#chat-way button:has-text("프롬프트 복사")');
  await p.screenshot({ path: L.OUT + `${tag}-chat-01.png`, fullPage: true });
  await p.fill('#chat-way textarea', CUT1); await p.click('#chat-way button:has-text("이 답으로 만들기")');
  await p.waitForSelector('#chat-way button:has-text("이어쓰기 프롬프트 복사")', { timeout: 10000 });
  L.ok('chat: cut answer → continue prompt', /중간에 끊겼어요/.test(await p.locator('#chat-way [role=alert]').innerText()));
  await p.screenshot({ path: L.OUT + `${tag}-chat-02-cut.png`, fullPage: true });
  await p.fill('#chat-way textarea', CUT2); await p.click('#chat-way button:has-text("이 답으로 만들기")');
  await L.waitStudio(p);
  const pid = L.pidOf(p); const pr = await L.readProject(p, pid);
  L.ok('chat: joined answer became site', /쓰던 앱으로 만든 연수/.test(pr.site['index.html']) && /data-lp="qa"/.test(pr.site['index.html']));
  L.ok('chat: teacher values not taken from answer', !pr.meta.live || !/evil/.test(JSON.stringify(pr.meta.live)), JSON.stringify(pr.meta.live));
  L.ok('chat: sections got ids', /id="hello"/.test(pr.site['index.html']));
  await p.screenshot({ path: L.OUT + `${tag}-chat-03-studio.png` });
  // 수정 요청(쓰던 앱): 요청 글 → 답의 섹션만 갈아 끼움
  await p.click('#tab-ask');
  await p.selectOption('#panel-ask select', { label: '질문' });
  await p.fill('#panel-ask textarea', '질문 칸 위에 안내 한 줄을 더해 줘');
  if (await p.locator('#panel-ask .seg button:has-text("쓰던 AI로")').count()) await p.click('#panel-ask .seg button:has-text("쓰던 AI로")');
  await p.fill('#panel-ask textarea[aria-label="AI의 답"]', '```html\n<section id="ask" data-title="질문"><h2>질문</h2><p>편하게 물어보세요.</p><div data-lp="qa"></div></section>\n```');
  await p.click('#panel-ask button:has-text("이 답으로 수정")'); await p.waitForTimeout(1200);
  L.ok('chat edit: section replaced', /편하게 물어보세요/.test((await L.readProject(p, pid)).site['index.html']));

  // ── C. 실패 안내 → 이어서 하기 ──
  await L.startWithFile(p);
  L.geminiFails.on = true;
  await p.fill('.start-files input.input', '#실패');
  await p.waitForTimeout(300);
  const conn = await p.locator('.ai-card:has(h3:text-is("Claude")) button:has-text("Claude로 만들기")').count();
  if (conn) await p.click('.ai-card:has(h3:text-is("Claude")) button:has-text("Claude로 만들기")'); else await L.connectAi(p);
  await p.waitForSelector('.making .ai-job.bad', { timeout: 30000 });
  L.ok('error: title + actions', /멈췄어요/.test(await p.locator('h1').innerText()) && await p.locator('.making .ai-job.bad button').count() >= 2);
  await p.screenshot({ path: L.OUT + `${tag}-error.png`, fullPage: true });
  L.geminiFails.on = false;
  await p.click('.making .ai-job.bad button:has-text("계속 만들기")');
  await L.waitStudio(p);
  L.ok('error: resumed to studio', true);

  // ── E. 예전 방식 연수(설계도만) ──
  const legacyId = 'legacy0001';
  await p.evaluate((id) => new Promise((res) => { const q = indexedDB.open('lecpage'); q.onsuccess = () => { const t = q.result.transaction('projects', 'readwrite'); t.objectStore('projects').put({ id, title: '예전 연수', stage: 2, blueprint: { version: 1, meta: { title: '예전 연수' }, sections: [], live: { provider: 'http', url: 'https://live.example', code: 'ABCD1234' } }, deploy: { lastUrl: 'https://old-site.vercel.app/', target: 'vercel', at: 1 }, files: [], info: {} }); t.oncomplete = res; }; }), legacyId);
  await p.goto(L.BASE + `#/p/${legacyId}/2`, { waitUntil: 'load' }); await p.waitForSelector('.legacy');
  L.ok('legacy: notice + remake + deploy info kept', /예전 방식/.test(await p.locator('h1').innerText()) && /old-site\.vercel\.app/.test(await p.locator('.legacy').innerText()) && await p.locator('.legacy button:has-text("AI로 새로 만들기")').count() === 1);
  await p.screenshot({ path: L.OUT + `${tag}-legacy.png`, fullPage: true });
  L.ok('no page errors', errs.length === 0, JSON.stringify(errs));
  await ctx.close();

  // ── D. 내 PC 연결 프로그램(127.0.0.1에서 응답하면 바로 쓰기) ──
  const c2 = await b.newContext({ viewport: { width: W, height: HH } });
  await L.mockAi(c2);
  // 연결 프로그램 흉내: HTML에 토큰 meta, GET /bridge/status는 머리글 X-Lecpage-Bridge가 맞을 때만
  await c2.addInitScript(() => { const add = () => { const m = document.createElement('meta'); m.name = 'lecpage-bridge'; m.content = 'tok-123'; document.head.appendChild(m); }; if (document.head) add(); else document.addEventListener('DOMContentLoaded', add); });
  let bridgeHdr = '';
  await c2.route(/\/bridge\/status$/, (r) => { bridgeHdr = r.request().headers()['x-lecpage-bridge'] || ''; return bridgeHdr === 'tok-123' ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, version: '0.1.0', agents: [{ id: 'claude', installed: true, version: '2.1', auth: 'subscription' }, { id: 'codex', installed: true, version: '0.9', auth: 'api-key' }] }) }) : r.fulfill({ status: 401, body: '' }); });
  const q = await c2.newPage(); const e2 = L.watch(q);
  const base2 = L.BASE.replace('localhost', '127.0.0.1');
  await q.goto(base2, { waitUntil: 'load' });
  await q.setInputFiles('.ld-hero input[type=file][multiple]', [L.FIX + '/workshop.pdf']);
  await q.waitForSelector('.ai-sub button:has-text("Claude로 만들기"):not([disabled])', { timeout: 90000 });
  await q.screenshot({ path: L.OUT + `${tag}-local.png`, fullPage: true });
  await q.click('.ai-sub button:has-text("Claude로 만들기")');
  await q.waitForSelector('.making, .workspace', { timeout: 20000 });
  L.ok('local: token header sent', bridgeHdr === 'tok-123');
  L.ok('local: generation via local agent', /Claude Code/.test(await q.locator('.step-head').innerText()) || await q.locator('.workspace').count() === 1);
  L.ok('local: no page errors', e2.length === 0, JSON.stringify(e2));
  await b.close();
  process.exit(L.summary() ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
