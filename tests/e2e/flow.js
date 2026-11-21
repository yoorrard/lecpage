// 새 흐름 e2e(PC 1366): 교재 넣기 → AI 고르기(Claude 키, 진짜 생성 파이프라인 + 가짜 Claude 스트림) → 만드는 중(목록·미리보기 없음) → 완성
// → 한 화면(연수 정보 확인·글 고치기·섹션 순서(↓·끌기)·숨기기·그림 바꾸기·AI 수정 대화·되돌리기·버전 기록) → 배포(가짜 Vercel)
const L = require('./lib.js');
const H = require('./h2.js');
const W = Number(process.env.W || 1366), HH = Number(process.env.H || 860);
const tag = process.env.TAG || String(W);
const noScroll = async (p, where) => L.ok(`${where}: no horizontal page scroll`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), String(await p.evaluate(() => document.documentElement.scrollWidth)));
(async () => {
  const b = await L.chromium.launch(); const ctx = await b.newContext({ viewport: { width: W, height: HH }, deviceScaleFactor: 1 });
  const origin = new URL(L.BASE).origin;
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
  const st = await H.mockAll(ctx); // 가짜 Vercel·is.gd(배포) — AI 키 확인은 아래에서 먼저 가로챔
  await L.mockAi(ctx, null, { fallback: true });
  const p = await ctx.newPage(); const errs = L.watch(p);
  // ① 교재 넣기
  await L.startWithFile(p);
  L.ok('start: no preview/list before AI', await p.locator('.preview, .sec2-list, .pv-device').count() === 0);
  L.ok('start: no info fields / found summary / draft button', await p.locator('.found, .start-info, button:has-text("기본 초안")').count() === 0);
  L.ok('start: file pages shown', /13쪽/.test(await p.locator('.files li').first().innerText()));
  const ws = await p.locator('.ai-card').evaluateAll((els) => els.map((e) => [e.querySelector('h3').textContent, Math.round(e.getBoundingClientRect().width), Math.round(e.getBoundingClientRect().height), Math.round(e.getBoundingClientRect().top)]));
  L.ok(W >= 760 ? 'start: two AI cards (GPT·Claude) same size, one row' : 'start: two AI cards same width, two rows', ws.length === 2 && ws.map((x) => x[0]).join() === 'GPT,Claude' && new Set(ws.map((x) => x[1])).size === 1 && (W >= 760 ? new Set(ws.map((x) => x[2])).size === 1 && new Set(ws.map((x) => x[3])).size === 1 : ws[0][3] < ws[1][3]), JSON.stringify(ws));
  L.ok('start: key cards under collapsed other ways + no-key chat buttons', await p.locator('details.ai-more:not([open]) .ai-card button:has-text("API 키 연결")').count() === 2 && await p.locator('.ai-nokey button:has-text("쓰던 ChatGPT로")').count() === 1 && await p.locator('.ai-nokey button:has-text("쓰던 Claude로")').count() === 1);
  L.ok('start: subscription card first (above no-key, other ways last)', await p.locator('.ai-alt').count() === 1 && await p.evaluate(() => { const r = document.querySelector('.ai-sub'), n = document.querySelector('.ai-nokey'), c = document.querySelector('.ai-more'); return !!r && !!n && !!c && r.getBoundingClientRect().top < n.getBoundingClientRect().top && n.getBoundingClientRect().top < c.getBoundingClientRect().top; }));
  await noScroll(p, 'start');
  await p.screenshot({ path: L.OUT + `${tag}-01-start.png`, fullPage: true });
  await p.fill('.start-files input.input', '실습 위주로');
  // ② AI 고르기 → ③ 만드는 중
  await L.connectGemini(p);
  await p.waitForSelector('.making', { timeout: 20000 });
  await p.waitForTimeout(700);
  L.ok('making: no preview/list while making', await p.locator('.preview, .sec2-list, .pv-device').count() === 0);
  L.ok('making: steps + elapsed + stop', await p.locator('.making-steps li').count() >= 2 && /걸린 시간/.test(await p.locator('.making-time').innerText()) && await p.locator('.making button:has-text("중지")').count() === 1);
  await noScroll(p, 'making');
  await p.screenshot({ path: L.OUT + `${tag}-02-making.png`, fullPage: true });
  // 멈추기 → 이어서 하기
  await p.click('.making button:has-text("중지")'); await p.waitForSelector('.making button:has-text("계속 만들기")');
  L.ok('making: paused', /멈췄어요/.test(await p.locator('h1').innerText()));
  await p.click('.making button:has-text("계속 만들기")');
  // ④ 완성
  await L.waitStudio(p);
  const pid = L.pidOf(p);
  L.ok('studio: one screen (info card + files + chat composer, no tabs)', await p.locator('.st-info.is-todo').count() === 1 && await p.locator('.st-files').count() === 1 && await p.locator('.st-compose textarea').count() === 1 && await p.locator('[role=tablist]').count() === 0);
  await noScroll(p, 'studio');
  await p.screenshot({ path: L.OUT + `${tag}-03-studio.png` });
  const frame = p.frameLocator('.pv-device iframe');
  L.ok('studio: preview shows assembled site with kit', await frame.locator('.lpk').count() >= 3, String(await frame.locator('.lpk').count()));
  // 연수 정보: 제목 바꾸면 사이트 글도
  const t0 = await p.inputValue('#prop-title');
  await p.fill('#prop-title', '우리 반 데이터 연수'); await p.keyboard.press('Tab');
  await p.waitForTimeout(900);
  let pr0 = await L.readProject(p, pid);
  L.ok('info: title change updates meta + same text in site', pr0.meta.title === '우리 반 데이터 연수' && /<title>우리 반 데이터 연수<\/title>/.test(pr0.site['index.html']), t0);
  L.ok('info: fact page shown', /쪽에서 찾았어요/.test(await p.locator('.st-info').innerText()));
  await p.click('.st-info button:has-text("이 정보가 맞아요")');
  // 글 고치기(미리보기에서 바로)
  await p.click('.pv-bar button:has-text("글 수정")');
  await frame.locator('main p[data-lpe]').first().click(); await p.keyboard.press('End'); await p.keyboard.type(' 함께 해요.'); await p.keyboard.press('Enter');
  await p.waitForTimeout(800);
  let pr = await L.readProject(p, pid);
  L.ok('edit: inline text saved to site html', pr.site['index.html'].includes('함께 해요.'));
  L.ok('edit: source has no preview markers', !/data-lpe|data-lps/.test(pr.site['index.html']));
  // 그림 바꾸기: 그림을 누르면 창 → 교재 2쪽
  const hasImg = await frame.locator('img[data-lpe]').count();
  if (hasImg) {
    await frame.locator('img[data-lpe]').first().click();
    await p.waitForSelector('dialog[open] .page-pick', { timeout: 10000 });
    await p.screenshot({ path: L.OUT + `${tag}-04-image.png` });
    await p.click('dialog[open] .page-pick >> nth=1');
    await p.waitForTimeout(800); pr = await L.readProject(p, pid);
    L.ok('image: replaced with page 2', /material\/p-002\.webp/.test(pr.site['index.html']));
  } else L.ok('image: site has an image', false);
  await p.click('.pv-bar button:has-text("글 수정 중")');
  // 목록: ↓, 끌기, 숨기기
  const names = async () => p.locator('.sec2-name .ttl').allInnerTexts();
  const n0 = await names();
  await p.click('.sec2 >> nth=1 >> button[aria-label$="아래로"]'); await p.waitForTimeout(300);
  const n1 = await names();
  L.ok('list: move down', n1[2] === n0[1] && n1[1] === n0[2], n1.join(','));
  await p.locator('.sec2 >> nth=4').dragTo(p.locator('.sec2 >> nth=1')); await p.waitForTimeout(400);
  const n2 = await names();
  L.ok('list: drag reorder', n2[1] === n1[4], n2.join(','));
  const hiddenN = (h) => (h.match(/<section\b[^>]*\bhidden\b/g) || []).length;
  const h0 = hiddenN((await L.readProject(p, pid)).site['index.html']);
  await p.click('.sec2 >> nth=3 >> summary'); await p.click('.sec2 >> nth=3 >> .sec2-menu button:has-text("숨기기")'); await p.waitForTimeout(500);
  pr = await L.readProject(p, pid);
  L.ok('list: hide sets hidden', hiddenN(pr.site['index.html']) === h0 + 1 && await p.locator('.sec2.is-hidden').count() === 1);
  await p.screenshot({ path: L.OUT + `${tag}-05-list.png` });
  // 되돌리기(숨기기 되돌림)
  await p.click('.head-tools button:has-text("실행 취소")'); await p.waitForTimeout(500);
  pr = await L.readProject(p, pid);
  L.ok('undo: hide reverted', hiddenN(pr.site['index.html']) === h0);
  // 수정 요청(키): 섹션 하나
  await p.selectOption('.st-compose select[aria-label="고칠 곳"]', 'hero'); const askId = await p.inputValue('.st-compose select[aria-label="고칠 곳"]');
  await p.fill('.st-compose textarea', '카드마다 예시 한 줄을 더해 줘');
  await p.click('.st-compose button:has-text("보내기")');
  await p.waitForSelector('.st-bubble.is-working', { timeout: 10000 });
  await p.screenshot({ path: L.OUT + `${tag}-06-ask-running.png` });
  await H.toastHas(p, /요청한 대로 고쳤어요/, 30000); await p.waitForTimeout(1200);
  L.ok('ask: section edited by AI (가짜 Claude의 수정 답)', (await frame.locator('#' + askId).innerText()).includes('제미나이로 20분 만에'), askId);
  L.ok('ask: reply in conversation with changed section', /요청대로 고쳤어요/.test(await p.locator('.st-msg.is-ai').last().innerText()) && /첫 화면/.test(await p.locator('.st-msg.is-ai').last().innerText()));
  L.ok('check: no inspection tab, only serious issues line', await p.locator('#tab-check, #panel-check').count() === 0);
  await p.screenshot({ path: L.OUT + `${tag}-07-chat.png` });
  // 판 기록
  await p.click('.head-tools button:has-text("버전 기록")'); await p.waitForSelector('dialog[open] .versions li');
  L.ok('versions: AI made + edits listed, newest first', (await p.locator('dialog[open] .versions li').count()) >= 3 && /AI로 수정/.test(await p.locator('dialog[open] .versions li').first().innerText()));
  await p.screenshot({ path: L.OUT + `${tag}-08-versions.png` });
  await p.keyboard.press('Escape');
  // 미리보기 다른 화면: QR 안내문
  await p.selectOption('.pv-page select', 'poster.html'); await p.waitForTimeout(1000);
  L.ok('preview: poster page', /우리 반 데이터 연수/.test(await frame.locator('body').innerText()));
  await p.screenshot({ path: L.OUT + `${tag}-09-poster.png` });
  await p.selectOption('.pv-page select', 'index.html');
  // ⑤ 배포(가짜 Vercel)
  await p.click('.head-tools button:has-text("배포하기")');
  await p.waitForSelector('.publish', { timeout: 20000 });
  L.ok('share: checklist rows', await p.locator('.ready-i').count() >= 3);
  await noScroll(p, 'share');
  await p.screenshot({ path: L.OUT + `${tag}-10-share.png`, fullPage: true });
  if (!(await p.locator('.publish .conn-line').count())) {
    await p.locator('.pub-opt:has-text("Vercel"), .pub-pick button:has-text("Vercel")').first().click().catch(() => {});
    await p.click('.publish .walk-b button:has-text("이미 가입했어요")').catch(() => {});
    await H.connect(p, 'vcp_FAKE_TOKEN_1234567890');
    await p.waitForSelector('.publish .conn-line', { timeout: 15000 });
  }
  await p.fill('.publish .addr-name input', 'maum-class').catch(() => {});
  await H.publish(p);
  await p.waitForSelector('.success .big-url', { timeout: 60000 });
  const files = (st.deployBody?.files || []).map((f) => f.file);
  console.log('deployed files:', files.join(', '));
  L.ok('share: deployed assembled site', ['index.html', 'poster.html', 'screen.html', 'console.html', 'check.html', 'assets/style.css', 'assets/lecpage.js', 'assets/kit.css'].every((f) => files.includes(f)));
  const idx = st.site['index.html'] ? st.site['index.html'].toString() : '';
  L.ok('share: deployed html has edits, no preview markers', idx.includes('제미나이로 20분 만에') && idx.includes('우리 반 데이터 연수') && !/data-lpe|data-lp-preview/.test(idx));
  await p.waitForTimeout(800); await p.evaluate(() => scrollTo(0, 0));
  await p.screenshot({ path: L.OUT + `${tag}-11-share-done.png`, fullPage: true });
  L.ok('no page errors', errs.length === 0, JSON.stringify(errs));
  await b.close();
  process.exit(L.summary() ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
