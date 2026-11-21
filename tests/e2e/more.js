// 새 흐름 e2e: 먼저 해보기(같은 화면), AI 답의 강사 값은 받지 않기, 실패 안내와 이어 하기, 내 PC 연결 프로그램 감지, 예전 방식 연수,
// lecpage 커넥트: Claude 계정 연결(터미널 없이) · 예전 판이면 원문 오류 대신 새 판 안내 · [새 버전으로 바꾸기] → 다시 붙어 이어 하기
const L = require('./lib.js');
const W = Number(process.env.W || 1366), HH = Number(process.env.H || 860);
const tag = process.env.TAG || String(W);
const CUT1 = '좋아요. 교재를 읽고 만들었어요.\n```html\n<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><title>정해 둔 답 연수</title><style>:root{--lp-accent:#9a3412;--lp-ink:#1f1a17;--lp-paper:#fff7ed}body{font-family:sans-serif;background:var(--lp-paper);color:var(--lp-ink)}</style></head><body><main>\n<section id="hello" data-title="첫 화면"><h1>정해 둔 답으로 만든 연수</h1><p>교재를 바탕으로 만들었어요.</p></section>\n<section id="ask" data-title="질문"><h2>질문</h2>';
const CUT2 = '<div data-lp="qa"></div></section>\n</main></body></html>\n```\n```json\n{"v":2,"title":"정해 둔 답으로 만든 연수","sessions":[{"date":"2027-01-15","start":"10:00","end":"12:00"}],"venue":"강당","features":["qa"],"facts":[{"label":"장소","value":"강당","page":2}],"live":{"provider":"http","url":"https://evil.example"}}\n```';
(async () => {
  const b = await L.chromium.launch();
  const ctx = await b.newContext({ viewport: { width: W, height: HH }, deviceScaleFactor: 1 });
  await L.mockAi(ctx);
  await ctx.addInitScript(() => { window.open = () => null; }); // 새 창은 열지 않음
  const p = await ctx.newPage(); const errs = L.watch(p);

  // ── A. 먼저 해보기: 같은 연수 화면 ──
  await p.goto(L.BASE + '#/demo', { waitUntil: 'load' });
  await p.waitForSelector('.demo-bar', { timeout: 20000 });
  await p.waitForFunction(() => /(17|18|30)쪽/.test(document.querySelector('.files')?.textContent || ''), null, { timeout: 90000 });
  await L.aiReady(p);
  L.ok('demo: one primary button (체험 시작), connect is secondary', await p.locator('.coach .btn-primary:has-text("체험 시작")').count() === 1 && await p.locator('.ai-sub .btn-primary').count() === 0 && await p.locator('.ai-sub button:has-text("ChatGPT·Claude 계정으로 연결")').count() === 1);
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
  await p.click('.st-info button:has-text("이 정보가 맞아요")');
  await p.click('.head-tools button:has-text("배포하기")');
  await p.waitForSelector('.demo-pub button:has-text("배포 연습하기")', { timeout: 20000 });
  L.ok('demo: real share checklist kept', await p.locator('.ready-i').count() >= 3);
  await p.click('.demo-pub button:has-text("배포 연습하기")');
  await p.waitForSelector('.demo-pub .demo-done-main', { timeout: 20000 });
  L.ok('demo: practice publish says not uploaded', /체험이라|실제로는/.test(await p.locator('.demo-pub').innerText()));
  await p.screenshot({ path: L.OUT + `${tag}-demo-04-share.png`, fullPage: true });
  await p.goto(L.BASE, { waitUntil: 'load' }); await p.waitForTimeout(1500);
  L.ok('demo: not in my list', !/체험 연수|데이터로 읽는|생성형 AI로 수업|질문이 먼저/.test(await p.locator('.ld-mine').innerText().catch(() => '')));

  // ── B. 복사·붙여넣기 길은 없음 · AI 답에 든 강사 값(live 등)은 받지 않음 ──
  await L.startWithFile(p);
  L.ok('no copy-paste way: one primary action to connect a subscription', await p.locator('.ai-nokey, #chat-way').count() === 0 && !/쓰던 (AI|ChatGPT|Claude)/.test(await p.locator('.ai-pick').innerText()) && await p.locator('.ai-sub .btn-primary').count() === 1 && await p.locator('.ai-sub .btn-primary:has-text("ChatGPT·Claude 계정으로 연결")').count() === 1);
  await L.makeWith(p, CUT1 + CUT2);
  await L.waitStudio(p);
  const pid = L.pidOf(p); const pr = await L.readProject(p, pid);
  L.ok('answer: became site', /정해 둔 답으로 만든 연수/.test(pr.site['index.html']) && /data-lp="qa"/.test(pr.site['index.html']));
  L.ok('answer: teacher values not taken from answer', !pr.meta.live || !/evil/.test(JSON.stringify(pr.meta.live)), JSON.stringify(pr.meta.live));
  L.ok('answer: sections got ids', /id="hello"/.test(pr.site['index.html']));
  L.ok('edit: no copy-paste way in AI 수정', await p.locator('.st-chatway').count() === 0 && !(await p.locator('.st-compose select[aria-label="보낼 곳"] option[value="chat"]').count()));
  await p.screenshot({ path: L.OUT + `${tag}-answer-studio.png` });

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
  L.ok('local: badge names lecpage 커넥트', /lecpage 커넥트 켜짐/.test(await q.locator('.ai-pick .conn-badge').first().innerText()));
  await q.click('.ai-sub button:has-text("Claude로 만들기")');
  await q.waitForSelector('dialog[open] .consent', { timeout: 5000 });
  L.ok('local: consent says where it goes', /lecpage 커넥트에서 Anthropic으로/.test(await q.locator('dialog[open] .consent').innerText()));
  L.ok('local: consent once before first use', await L.consent(q));
  await q.waitForSelector('.making, .st', { timeout: 20000 });
  L.ok('local: token header sent', bridgeHdr === 'tok-123');
  L.ok('local: generation via local agent', /Claude Code/.test(await q.locator('.step-head').innerText()) || await q.locator('.st').count() === 1);
  L.ok('local: no page errors', e2.length === 0, JSON.stringify(e2));

  // ── D2. Claude 계정 연결(터미널 없이): 두 로그인 버튼은 같은 모양 · 세 단계 안내(설치 진행 막대 → 브라우저 로그인 → 코드 칸) → 연결되면 바로 만들기 ──
  const c4 = await b.newContext({ viewport: { width: W, height: HH } });
  await L.mockAi(c4);
  await c4.addInitScript(() => { const add = () => { const m = document.createElement('meta'); m.name = 'lecpage-bridge'; m.content = 'tok-123'; document.head.appendChild(m); }; if (document.head) add(); else document.addEventListener('DOMContentLoaded', add); });
  let connected = false; let polls = 0; let gotCode = '';
  const sv = (o) => ({ agent: 'claude', running: true, startedAt: 1, install: '', progress: null, loginUrl: '', waitingCode: false, codeSent: false, from: '', error: null, ...o });
  const view = () => (connected ? sv({ step: 'done', running: false, install: 'done' }) : polls < 3 ? sv({ step: 'install', install: 'run', progress: { phase: 'download', done: 60e6, total: 120e6 } }) : sv({ step: 'login', install: 'done', loginUrl: base2 + '#claude-login', waitingCode: true }));
  await c4.route(/\/bridge\/status(\?fresh)?$/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, version: '0.1.0', build: '1.1.0-new', caps: ['status-caps', 'claude-setup', 'update'], update: { can: true, state: 'idle' }, chatgpt: { connected: false }, agents: [connected ? { id: 'claude', installed: true, version: '2.1.330', auth: 'subscription', loggedIn: true, ready: true } : { id: 'claude', installed: false, need: 'install', ready: false }, { id: 'codex', installed: false, ready: false }] }) }));
  await c4.route(/\/bridge\/agents\/claude\/setup$/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, setup: sv({ step: 'check' }) }) }));
  await c4.route(/\/bridge\/setup$/, (r) => { polls++; return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, setup: view() }) }); });
  await c4.route(/\/bridge\/setup\/code$/, (r) => { gotCode = JSON.parse(r.request().postData() || '{}').code || ''; connected = true; return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });
  const u = await c4.newPage(); const e4 = L.watch(u);
  await u.goto(base2, { waitUntil: 'load' });
  await u.setInputFiles('.ld-hero input[type=file][multiple]', [L.FIX + '/workshop.pdf']);
  await u.waitForSelector('.ai-sub button:has-text("Claude 계정으로 로그인")', { timeout: 90000 });
  L.ok('claude: same button style as ChatGPT', await u.locator('.ai-sub-row button.btn-primary:has-text("ChatGPT 계정으로 로그인")').count() === 1 && await u.locator('.ai-sub-row button.btn-primary:has-text("Claude 계정으로 로그인")').count() === 1);
  L.ok('claude: short install hint', /처음 한 번 Claude Code를 자동으로 설치해요\(1~3분\)\./.test(await u.locator('.ai-sub').innerText()) && !/터미널은 쓰지 않아요/.test(await u.locator('.ai-sub').innerText()));
  L.ok('claude: no update notice on a current 커넥트', await u.locator('.connect-old').count() === 0);
  L.ok('claude: terminal way only under other ways', await u.locator('.ai-sub button:has-text("터미널 창에서 하기")').count() === 0 && await u.locator('details.ai-more .ai-alt-row:has-text("Claude Code 터미널로") button:has-text("터미널 창에서 하기")').count() === 1);
  await u.click('.ai-sub button:has-text("Claude 계정으로 로그인")');
  L.ok('claude: consent once', await L.consent(u));
  await u.waitForSelector('.setup .setup-bar[aria-valuenow="50"]', { timeout: 10000 });
  L.ok('claude: 3-step guide + install progress', await u.locator('.setup-step').count() === 3 && /50%/.test(await u.locator('.setup-step').first().innerText()));
  await u.screenshot({ path: L.OUT + `${tag}-claude-install.png`, fullPage: true });
  await u.waitForSelector('.setup-step.is-now:has-text("브라우저에서 로그인")', { timeout: 10000 });
  const [pop] = await Promise.all([c4.waitForEvent('page', { timeout: 5000 }).catch(() => null), u.click('.setup-login a:has-text("로그인 창 열기")')]);
  if (pop) await pop.close();
  await u.waitForSelector('.setup-code input', { timeout: 5000 });
  await u.fill('.setup-code input', 'abcd1234#efgh5678');
  await u.screenshot({ path: L.OUT + `${tag}-claude-login.png`, fullPage: true });
  await u.click('.setup-code button:has-text("연결")');
  await u.waitForSelector('.making, .st, .ai-sub button:has-text("Claude로 만들기")', { timeout: 20000 });
  L.ok('claude: code sent to lecpage 커넥트', gotCode === 'abcd1234#efgh5678');
  L.ok('claude: connected → starts making', await u.locator('.making, .st').count() > 0 || await u.locator('.ai-sub button:has-text("Claude로 만들기")').count() === 1);
  L.ok('claude: no page errors', e4.length === 0, JSON.stringify(e4));
  await c4.close();

  // ── D3. 예전 판 lecpage 커넥트: caps가 없으면 [로그인] 대신 다시 켜는 법 · caps는 있어도 그 경로가 404면 원문('없는 주소예요') 대신 같은 안내 ──
  const bridgeCtx = async (status, routes = {}) => {
    const c = await b.newContext({ viewport: { width: W, height: HH }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' });
    await L.mockAi(c);
    await c.addInitScript(() => { try { Object.defineProperty(navigator, 'userAgentData', { get: () => undefined }); } catch { } const add = () => { const m = document.createElement('meta'); m.name = 'lecpage-bridge'; m.content = 'tok-123'; document.head.appendChild(m); }; if (document.head) add(); else document.addEventListener('DOMContentLoaded', add); });
    await c.route(/\/bridge\/status(\?fresh)?$/, (r) => { const v = status(); return v ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(v) }) : r.abort(); });
    for (const [re, f] of Object.entries(routes)) await c.route(new RegExp(re), f);
    const pg = await c.newPage();
    await pg.goto(base2, { waitUntil: 'load' });
    await pg.setInputFiles('.ld-hero input[type=file][multiple]', [L.FIX + '/workshop.pdf']);
    await L.aiReady(pg);
    return { c, pg, errs: L.watch(pg) };
  };
  const AG = [{ id: 'claude', installed: false, need: 'install', ready: false }, { id: 'codex', installed: false, ready: false }];
  {
    const { c, pg } = await bridgeCtx(() => ({ ok: true, version: '1.1.0', chatgpt: { connected: false }, agents: AG }));
    await pg.waitForSelector('.ai-sub .connect-old', { timeout: 20000 });
    const t = await pg.locator('.ai-sub').innerText();
    L.ok('old 커넥트 (no caps): update guidance instead of login', /lecpage 커넥트를 새 버전으로 바꿔야 해요/.test(t) && /창\(작업 표시줄\)을 닫고/.test(t) && await pg.locator('.ai-sub button:has-text("Claude 계정으로 로그인")').count() === 0);
    L.ok('old 커넥트: ChatGPT login still offered', await pg.locator('.ai-sub button:has-text("ChatGPT 계정으로 로그인")').count() === 1);
    await pg.screenshot({ path: L.OUT + `${tag}-connect-old.png`, fullPage: true });
    await c.close();
  }
  {
    const { c, pg } = await bridgeCtx(() => ({ ok: true, version: '1.1.0', build: '1.1.0-x', caps: ['status-caps', 'claude-setup'], chatgpt: { connected: false }, agents: AG }), {
      '/bridge/agents/claude/setup$': (r) => r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'not-found', message_ko: '없는 주소예요.' }) }),
    });
    await pg.click('.ai-sub button:has-text("Claude 계정으로 로그인")');
    await L.consent(pg);
    await pg.waitForSelector('.ai-sub .connect-old', { timeout: 10000 });
    L.ok('old route 404: guidance, never the raw message', !/없는 주소예요/.test(await pg.locator('body').innerText()) && /새 버전으로 바꿔야 해요/.test(await pg.locator('.ai-sub').innerText()));
    await c.close();
  }

  // ── D4. [새 버전으로 바꾸기]: 커넥트가 받아 바꾸고 다시 켜지는 동안(잠깐 닿지 않음) '꺼짐'으로 그리지 않고, 새 판이 답하면 [Claude 계정으로 로그인]으로 ──
  {
    let phase = 'old'; let posted = 0; let gap = 0;
    const st = () => {
      if (phase === 'restart' && gap++ < 2) return null; // 다시 켜는 중: 닿지 않음
      const fresh = phase !== 'old';
      return { ok: true, version: '1.1.0', build: fresh ? '1.1.0-new' : '1.1.0-old', caps: fresh ? ['status-caps', 'claude-setup', 'update'] : ['status-caps', 'update'], update: { can: true, state: 'idle' }, chatgpt: { connected: false }, agents: AG };
    };
    const { c, pg, errs: e5 } = await bridgeCtx(st, { '/bridge/update$': (r) => { if (r.request().method() === 'POST') { posted++; phase = 'restart'; } return r.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ ok: true, update: { can: true, state: 'download' } }) }); } });
    await pg.waitForSelector('.ai-sub .connect-old button.btn-primary:has-text("새 버전으로 바꾸기")', { timeout: 20000 });
    L.ok('update: one primary button, no login yet', await pg.locator('.ai-sub button:has-text("Claude 계정으로 로그인")').count() === 0);
    await pg.click('.ai-sub button:has-text("새 버전으로 바꾸기")');
    await pg.waitForSelector('.ai-sub button:has-text("바꾸는 중")', { timeout: 5000 }).catch(() => {});
    let flippedOff = false;
    for (let i = 0; i < 40 && !(await pg.locator('.ai-sub button:has-text("Claude 계정으로 로그인")').count()); i++) { if (await pg.locator('.ai-sub-off').count()) flippedOff = true; await pg.waitForTimeout(250); }
    L.ok('update: POST /bridge/update once', posted === 1);
    L.ok('update: not drawn as off while restarting', !flippedOff);
    L.ok('update: new build → Claude login offered', await pg.locator('.ai-sub button:has-text("Claude 계정으로 로그인")').count() === 1 && await pg.locator('.connect-old').count() === 0);
    L.ok('update: no page errors', e5.length === 0, JSON.stringify(e5));
    await c.close();
  }

  // ── E. lecpage 커넥트 받기: 지금 운영체제 방법 하나만, 나머지는 [다른 운영체제]에 ──
  for (const [os, ua] of [['win', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'], ['mac', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36']]) {
    const c3 = await b.newContext({ viewport: { width: W, height: HH }, userAgent: ua });
    await c3.addInitScript(() => { try { Object.defineProperty(navigator, 'userAgentData', { get: () => undefined }); } catch { } });
    const r = await c3.newPage();
    await r.goto(L.BASE, { waitUntil: 'load' });
    await r.setInputFiles('.ld-hero input[type=file][multiple]', [L.FIX + '/workshop.pdf']);
    await r.click('.ai-sub button:has-text("ChatGPT·Claude 계정으로 연결")');
    const way = r.locator('.ai-sub .connect-way').first();
    if (os === 'win') L.ok('connect win: one download button', await way.locator('a:has-text("lecpage 커넥트 받기 (Windows)")').count() === 1 && /lecpage-connect\.cmd$/.test(await way.locator('a').getAttribute('href')));
    else L.ok('connect mac: one terminal line + 3 steps', /lecpage-connect\.sh \| bash/.test(await way.locator('code').innerText()) && await way.locator('li').count() === 3 && /터미널/.test(await way.innerText()));
    L.ok(`connect ${os}: other OS folded`, await r.locator('.ai-sub details.connect-os:not([open])').count() === 1);
    await r.screenshot({ path: L.OUT + `${tag}-connect-${os}.png` });
    await c3.close();
  }
  await b.close();
  process.exit(L.summary() ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
