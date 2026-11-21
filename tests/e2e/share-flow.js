// 공개하기 e2e(Vercel): 연결 → 올리기 → 짧은 주소 → 다시 올리기 → 자료 올리기. 가짜 API로 요청 모양과 화면 흐름을 확인
const { chromium, fs, ROOT, mockAll, openShare, connect, publish, toastHas, watch } = require('./h3.js');
const OUT = require('path').resolve(__dirname, '../../.out/verify/shots/share-flow') + '/'; fs.mkdirSync(OUT, { recursive: true });
const ok = (name, cond, extra = '') => console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' :: ' + extra : ''}`);
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(require('./h3.js').BASE).origin });
  const st = await mockAll(ctx);
  const p = await ctx.newPage(); const errs = watch(p);
  await openShare(p);
  console.log('targets:', (await p.locator('.pub-opt').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ')).join(' | '));
  console.log('about:', (await p.locator('.pub-about').innerText()).replace(/\s+/g, ' '));
  ok('limit line shown', await p.locator('.pub-limit').count() === 1);
  ok('one step open at a time', await p.locator('.publish .walk-b').count() === 1, (await p.locator('.publish .walk-h').allInnerTexts()).join(' / '));
  ok('no publish button before connect', await p.locator('.publish .btn-lg').count() === 0);
  await p.locator('.publish').scrollIntoViewIfNeeded(); await p.screenshot({ path: OUT + '01-publish.png' });
  // 순서: 가입 → 토큰 만들기(그림) → 붙여넣기
  await p.click('.publish .walk-b button:has-text("이미 가입했어요")');
  ok('step 2 has click map + open link', await p.locator('.publish .walk-b .clk').count() === 1 && /vercel\.com\/account\/tokens/.test(await p.locator('.publish .walk-b a.btn-primary').getAttribute('href')));
  await p.screenshot({ path: OUT + '02-token-step.png' });
  // 잘못 붙여 넣은 글 → 토큰이 아님
  await connect(p, 'https://vercel.com/account/tokens');
  ok('not-a-token error', /토큰이 아닌 글/.test(await p.locator('.publish .err').innerText().catch(() => '')));
  // 틀린 토큰 → 쉬운 말 오류
  await connect(p, 'vcp_WRONG_TOKEN_000000000');
  await p.waitForFunction(() => /토큰이 맞지/.test(document.querySelector('.publish .err')?.textContent || ''), null, { timeout: 15000 }).then(() => ok('bad token error', true)).catch(() => ok('bad token error', false, st.calls.join(',')));
  // 붙여넣기 단추: 클립보드의 토큰으로 바로 연결
  await p.evaluate(() => navigator.clipboard.writeText('  vcp_FAKE_TOKEN_1234567890\n'));
  await p.click('.publish .walk-b button:has-text("붙여넣기")');
  await p.waitForSelector('.publish .conn-line', { timeout: 15000 });
  ok('connected by paste', /연결돼 있어요/.test(await p.locator('.publish .conn-line').innerText()), await p.locator('.toast').innerText().catch(() => ''));
  // 주소 이름
  await p.fill('.publish .addr-name input', 'Maum Class');
  ok('name cleaned', await p.inputValue('.publish .addr-name input') === 'maum-class', await p.inputValue('.publish .addr-name input'));
  await p.screenshot({ path: OUT + '03-connected.png' });
  await publish(p);
  await p.waitForSelector('.success .big-url', { timeout: 60000 });
  ok('url shown', await p.locator('.success .big-url').innerText() === 'https://maum-class.vercel.app/', await p.locator('.success .big-url').innerText());
  const d = st.deployBody;
  console.log('deploy body:', JSON.stringify({ name: d.name, project: d.project, target: d.target, projectSettings: d.projectSettings, files: d.files.length }));
  ok('vercel.json in / _headers out', d.files.some((f) => f.file === 'vercel.json') && !d.files.some((f) => f.file === '_headers'));
  console.log('toast:', await p.locator('.toast').innerText().catch(() => ''), '| calls:', [...new Set(st.calls)].join(' , '));
  await p.waitForTimeout(1200); await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(400);
  ok('open state', /지금 열려요/.test(await p.locator('.success .open-state').innerText().catch(() => '')));
  ok('no stale hint before short link', await p.locator('.short-stale').count() === 0);
  await p.screenshot({ path: OUT + '04-success.png' });

  // ── 짧은 주소: 한 번에 만들기(is.gd) ──
  await p.click('.short button:has-text("짧은 주소 만들기")');
  await p.waitForSelector('.short-url', { timeout: 10000 });
  const made = await p.locator('.short-url').innerText();
  ok('short made with easy name', /^is\.gd\/[a-z]{7,8}$/.test(made), made);
  ok('is.gd got plain site url, no referrer', st.isgd[0].url === 'https://maum-class.vercel.app/' && !st.isgd[0].ref, JSON.stringify(st.isgd[0]));
  ok('stale hint after short link', await p.locator('.short-stale').count() === 1);
  ok('big url and QR still the full address', await p.locator('.success .big-url').innerText() === 'https://maum-class.vercel.app/');
  await p.screenshot({ path: OUT + '05-short.png' });
  // 다시 올리기(성공 카드에서 바로)
  st.polls = 0; st.deployBody = null; st.projectExists = true; const before = st.uploads.length;
  await p.click('.short-stale button:has-text("다시 배포"), .short-stale button:has-text("다시 올리기")');
  await p.waitForSelector('dialog[open] button:has-text("참여 기능 없이")', { timeout: 2500 }).then((x) => x.click()).catch(() => {});
  await toastHas(p, /같은 주소/);
  ok('republish from card → same project', st.deployBody && st.deployBody.project === 'prj_1', `new uploads ${st.uploads.length - before}`);
  await p.waitForTimeout(600);
  ok('stale hint gone after republish', await p.locator('.short-stale').count() === 0);
  ok('short kept after republish (same url)', await p.locator('.short-url').innerText() === made);
  // 올린 사이트의 안내문·발표 화면에 짧은 주소가 크게, 원래 주소가 작게. QR은 원래 주소
  for (const page of ['poster.html', 'screen.html']) {
    const q = await ctx.newPage(); const e2 = watch(q);
    await q.goto('https://maum-class.vercel.app/' + page, { waitUntil: 'load' }); await q.waitForTimeout(900);
    const big = await q.locator(page === 'poster.html' ? '[data-url-self]' : '[data-join-url]').first().innerText();
    const full = await q.locator(page === 'poster.html' ? '[data-url-full]' : '[data-join-full]').first().innerText();
    ok(`${page} shows short big + full small`, big === made && full === 'maum-class.vercel.app', `${big} / ${full}`);
    ok(`${page} QR drawn`, await q.locator('.lp-qr svg').count() >= 1, 'errs ' + JSON.stringify(e2));
    await q.screenshot({ path: OUT + `06-site-${page.replace('.html', '')}.png` });
    if (page === 'screen.html') {
      await q.click('[data-join-zoom]'); await q.waitForTimeout(300);
      ok('screen big QR dialog', await q.locator('dialog.lp-joinbig[open] [data-qr-big] svg').count() === 1);
      await q.screenshot({ path: OUT + '07-site-screen-big.png' });
    }
    await q.close();
  }
  // 이름 정하기: 이미 쓰는 이름 → 오류, 새 이름 → 바뀜
  await p.click('.short button:has-text("바꾸기")');
  await p.fill('.short-more .affix input', 'Taken1');
  await p.click('.short-more button:has-text("만들기")');
  await p.waitForFunction(() => /이미 쓰는 이름/.test(document.querySelector('.short .err')?.textContent || ''), null, { timeout: 8000 }).then(() => ok('alias taken error', true)).catch(() => ok('alias taken error', false));
  await p.fill('.short-more .affix input', 'maum 2026'); // 빈칸은 _로
  await p.click('.short-more button:has-text("만들기")');
  await p.waitForFunction(() => document.querySelector('.short-url')?.textContent === 'is.gd/maum_2026', null, { timeout: 8000 }).then(() => ok('custom alias', true)).catch(async () => ok('custom alias', false, await p.locator('.short').innerText()));
  // 다른 서비스에서 만든 주소 넣기: 나쁜 주소는 거르고, 한글 주소는 한글로 보여 줌
  await p.click('.short button:has-text("바꾸기")');
  await p.screenshot({ path: OUT + '08-short-more.png' });
  for (const [bad, re] of [['javascript:alert(1)', /https:\/\/로 시작/], ['https://user:pw@evil.example/x', /주소 모양/], ['joo.is', /끝까지/], ['maum-class.vercel.app', /사이트 주소와 같아요/], ['http://1.2.3.4/a', /주소 모양/]]) {
    await p.fill('.short-more input.input', bad); await p.click('.short-more button:has-text("저장")');
    ok(`reject ${bad}`, re.test(await p.locator('.short .err').innerText().catch(() => '')), await p.locator('.short .err').innerText().catch(() => '(no error)'));
  }
  await p.evaluate(() => navigator.clipboard.writeText('joo.is/우리연수'));
  await p.fill('.short-more input.input', '');
  await p.click('.short-more button:has-text("붙여넣기")');
  await p.waitForFunction(() => document.querySelector('.short-url')?.textContent === 'joo.is/우리연수', null, { timeout: 8000 }).then(() => ok('pasted korean short link', true)).catch(async () => ok('pasted korean short link', false, await p.locator('.short').innerText()));
  const stored = await p.evaluate(async () => { const dbs = await indexedDB.databases(); return dbs.map((x) => x.name).join(','); });
  console.log('idb:', stored);
  // QR 크게 보기
  await p.click('.qr-zoom'); await p.waitForSelector('dialog.join-big[open]');
  ok('big view shows short + full', await p.locator('.join-big-url').innerText() === 'joo.is/우리연수' && await p.locator('.join-big-full').innerText() === 'maum-class.vercel.app');
  await p.screenshot({ path: OUT + '09-big.png' });
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  ok('big view closes with Esc', await p.locator('dialog.join-big[open]').count() === 0);
  // is.gd에 닿지 못할 때: 쉬운 말 + 다른 방법이 펼쳐짐
  await p.click('.short button:has-text("바꾸기")'); await p.click('.short-more button:has-text("짧은 주소 삭제")');
  st.isgdDown = true;
  await p.click('.short button:has-text("짧은 주소 만들기")');
  await p.waitForFunction(() => /닿지 못했어요/.test(document.querySelector('.short .err')?.textContent || ''), null, { timeout: 15000 }).then(async () => ok('is.gd unreachable → plain error + other ways open', await p.locator('.short-more').count() === 1)).catch(() => ok('is.gd unreachable error', false));
  st.isgdDown = false;

  // 360px 넘침
  await p.setViewportSize({ width: 360, height: 800 }); await p.waitForTimeout(500);
  ok('no overflow @360 (after publish)', !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
  await p.screenshot({ path: OUT + '10-360.png', fullPage: true });
  // (새 흐름) 공개 범위에서 '교재 원본도 내려받게' → 다시 배포하면 원본이 자료실(files/)로 함께 감
  await p.setViewportSize({ width: 1440, height: 900 }); await p.evaluate(() => scrollTo(0, 0));
  await p.click('.ready-i:has(.ready-t:has-text("공개 범위")) button:has-text("바꾸기")');
  await p.check('.ready-i label:has-text("교재 원본") input[type=checkbox]');
  st.polls = 0; st.deployBody = null; const up0 = st.uploads.length;
  ok('button says re-upload', /다시 (올리기|배포)/.test(await p.locator('.publish .btn-lg').innerText()));
  await publish(p);
  await toastHas(p, /같은 주소/);
  const mat = st.deployBody.files.filter((f) => f.file.startsWith('files/'));
  ok('original in redeploy (files/)', mat.length === 1, JSON.stringify(mat) + ` new uploads ${st.uploads.length - up0}`);
  // 토큰 기한이 지났을 때: 쉬운 말 + 연결 순서가 '토큰 만들기'부터 다시 보임
  st.revoked = true;
  await publish(p);
  await toastHas(p, /토큰이 맞지 않거나 기한이 지났어요/, 20000).then(() => ok('expired token → plain toast', true)).catch(async () => ok('expired token → plain toast', false, await p.locator('.toast').innerText().catch(() => '')));
  await p.waitForSelector('.publish .walk', { timeout: 5000 }).catch(() => {});
  ok('connect steps come back at "토큰 만들기"', /토큰 만들기/.test(await p.locator('.publish .walk li.on .walk-h').innerText().catch(() => '')) && await p.locator('.publish .btn-lg').count() === 0);
  st.revoked = false;
  await connect(p, 'vcp_FAKE_TOKEN_1234567890'); await p.waitForSelector('.publish .conn-line');
  st.polls = 0; await publish(p); await toastHas(p, /같은 주소/);
  ok('reconnect → redeploy to the same project', st.deployBody.project === 'prj_1');
  console.log('errors', errs); await b.close();
})().catch((e) => { console.log('SCRIPT ERROR', e.message.split('\n').slice(0, 4).join(' | ')); process.exit(1); });
