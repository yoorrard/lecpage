// 바로 배포(가짜 서버, 앱은 VITE_PUBLISH_API=http://publish.mock.test로 띄운 것): AI가 쓴 사이트를
//  ① 사이트 스크립트를 받지 않는 서버(/api/info siteScripts:false)면 처음부터 안내하고 내 계정 쪽으로
//  ② 받지 않는 내용(422 unsafe_site)이면 서버 문구(message_ko)를 배포 화면에 그대로
const L = require('./lib.js');
const BASE = process.env.BASE2 || 'http://localhost:6302/';
const ANSWER = (script) => '```html\n<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><title>바로 배포 시험</title></head><body><main><section id="a" data-title="첫 화면"><h1>바로 배포 시험</h1><div data-lp="qa"></div></section></main>' + (script ? '<script>document.documentElement.classList.add("js")</script>' : '') + '</body></html>\n```\n```json\n{"v":2,"title":"바로 배포 시험","sessions":[{"date":"2027-02-10","start":"10:00","end":"12:00"}],"features":["qa"]}\n```';
const UNSAFE = 'index.html에 비밀번호 입력 칸이 있어요. 참가자의 비밀번호를 받는 사이트는 바로 배포할 수 없어요.';
const TOO_LARGE = '사이트가 너무 커요(30MB까지). 큰 영상은 유튜브 링크로 바꿔 주세요.';
async function server(ctx, { siteScripts, unsafe, down, failPublish = 0, tooLarge = false, info = {}, reachable = false, takeAll = false, failOne = false, bundleRefuse = 0 }) {
  const st = { calls: [], manifests: [], puts: 0, putBytes: 0, bundles: 0, bundleFiles: 0, resent: [] };
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, async (r) => {
    const u = new URL(r.request().url()); const m = r.request().method();
    const json = (o, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(o) });
    // reachable: 다른 배포할 곳의 API가 이 망에서 닿음(막힌 망이 아님). 기본은 예전처럼 모두 끊음(막힌 망)
    if (reachable && /^api\.(netlify|vercel|github)\.com$/.test(u.host)) return m === 'OPTIONS' ? r.fulfill({ status: 204, headers: cors }) : json({ message: 'unauthorized' }, 401);
    if (u.host !== 'publish.mock.test') return r.abort();
    if (down) return r.abort('connectionrefused'); // 이 망에서 바로 배포 서버에 닿지 않음
    if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    st.calls.push(`${m} ${u.pathname}`);
    if (u.pathname === '/api/info') return json({ ok: true, v: 1, plan: 'free', accepting: true, view: siteScripts ? 'pages' : 'worker', keepAlive: !siteScripts, siteScripts, limits: { maxBytes: 30e6, maxFileBytes: 10e6, maxFiles: 400, days: 60 }, report: 'https://publish.mock.test/report', ...info });
    if (u.pathname === '/api/sites' && m === 'POST') { st.sites = (st.sites || 0) + 1; return json({ id: 'site' + st.sites, key: 'k' + st.sites, url: `https://s-site${st.sites}.example.pages.dev/`, expiresAt: Date.now() + 60 * 864e5 }); }
    if (/^\/api\/sites\/site\d+$/.test(u.pathname) && m === 'DELETE') { st.deleted = (st.deleted || 0) + 1; return r.fulfill({ status: 204, headers: cors }); }
    if (/\/deploys$/.test(u.pathname) && tooLarge) return json({ error: { code: 'too_large', message_ko: TOO_LARGE } }, 413);
    // st.gone: 보관 기간이 끝나 지워진 사이트(그 사이트에 올리려 하면 404) · st.failPublish: 다음 N번의 공개가 서버 오류(시험이 도중에 켬)
    if (/\/deploys$/.test(u.pathname) && st.gone?.has(u.pathname.split('/')[3])) return json({ error: { code: 'not_found', message_ko: '없는 사이트예요.' } }, 404);
    if (/\/publish$/.test(u.pathname) && st.failPublish > 0) { st.failPublish--; return json({ error: { code: 'internal', message_ko: '서버 오류' } }, 500); }
    if (/\/publish$/.test(u.pathname) && failPublish > 0) { failPublish--; return json({ error: { code: 'internal', message_ko: '서버 오류' } }, 500); }
    if (/\/publish$/.test(u.pathname) && !unsafe) return json({ url: `https://s-${u.pathname.split('/')[3]}.example.pages.dev/`, expiresAt: Date.now() + 60 * 864e5 });
    if (u.pathname === '/api/sites' && m === 'POST') return json({ id: 'site1', key: 'k1', url: 'https://s-site1.example.pages.dev/', expiresAt: Date.now() + 60 * 864e5 });
    // 받은 배포 목록을 적어 둠(시험이 무엇이 올라갔는지 봄). takeAll: 목록의 파일을 모두 올려받는 서버(처음 배포처럼)
    if (/\/deploys$/.test(u.pathname)) { const files = r.request().postDataJSON()?.files || {}; st.manifests.push(files); return json({ deploy: 'd1', missing: takeAll ? [...new Set(Object.values(files).map((f) => f.sha256))] : [] }); }
    if (/\/blobs\/[0-9a-f]{64}$/.test(u.pathname) && m === 'PUT') { st.puts++; st.putBytes += (r.request().postDataBuffer() || Buffer.alloc(0)).length; if (st.failedSha === u.pathname.split('/').pop()) st.resent.push(st.failedSha); return r.fulfill({ status: 204, headers: cors }); }
    // 작은 파일 묶음(진짜 서버 hosting/src/site.js uploadBundle과 같은 모양): 머리 길이 4바이트 + 머리 JSON [[sha256, 크기], …] + 내용. /api/info에 limits.bundle을 준 서버만 받음
    if (/^\/api\/sites\/[^/]+\/blobs$/.test(u.pathname) && m === 'PUT') {
      if (!info?.limits?.bundle) return json({ error: { code: 'not_found', message_ko: '없는 주소예요.' } }, 404);
      // bundleRefuse: 운영자가 묶음 한도를 줄인 직후처럼(앱은 예전 한도를 기억 중) 묶음 자체를 거절(413 too_large 또는 400 bad_request)
      if (bundleRefuse) { st.bundleRefused = (st.bundleRefused || 0) + 1; return json({ error: bundleRefuse === 413 ? { code: 'too_large', message_ko: '묶음이 너무 커요.' } : { code: 'bad_request', message_ko: '묶음 모양이 맞지 않아요.' } }, bundleRefuse); }
      const body = r.request().postDataBuffer() || Buffer.alloc(0); const n = body.readUInt32BE(0); const list = JSON.parse(body.subarray(4, 4 + n).toString('utf8'));
      const total = list.reduce((a, x) => a + x[1], 0);
      if (4 + n + total !== body.length) return json({ error: { code: 'bad_request', message_ko: '묶음에 적은 크기와 내용의 길이가 달라요.' } }, 400);
      st.bundles++; st.bundleFiles += list.length; st.putBytes += total;
      // failOne: 첫 묶음의 첫 파일을 '내용이 달라요'로 돌려줌(앱이 그 파일만 하나씩 다시 보내는지)
      const failed = failOne && !st.failedSha ? [{ sha256: (st.failedSha = list[0][0]), code: 'bad_request', message_ko: '파일 내용이 sha256과 달라요.' }] : [];
      return json({ ok: true, got: list.length - failed.length, failed });
    }
    if (/\/publish$/.test(u.pathname)) return unsafe ? json({ error: { code: 'unsafe_site', message_ko: UNSAFE, rule: 'password', path: 'index.html' } }, 422) : json({ url: 'https://s-site1.example.pages.dev/', expiresAt: Date.now() + 60 * 864e5 });
    return json({}, 404);
  });
  return st;
}
async function seed(p, script) {
  await p.goto(BASE, { waitUntil: 'load' });
  await p.setInputFiles('.ld-hero input[type=file][multiple]', [L.FIX + '/workshop.pdf']);
  await L.makeWith(p, ANSWER(script)); await p.click('.st-info button:has-text("이 정보가 맞아요")');
  await p.click('.head-tools button:has-text("배포하기")'); await p.waitForSelector('.publish', { timeout: 30000 }); await p.waitForTimeout(1500);
}
(async () => {
  const b = await L.chromium.launch();
  { // ① 사이트 스크립트를 받지 않는 서버 + 스크립트가 있는 사이트
    const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } }); await server(ctx, { siteScripts: false });
    const p = await ctx.newPage(); const errs = L.watch(p);
    await seed(p, true);
    const txt = await p.locator('.publish').innerText();
    L.ok('siteScripts:false → notice up front', /사이트가 직접 쓴 스크립트/.test(txt), txt.slice(0, 200).replace(/\s+/g, ' '));
    // 감추지 않고 흐린 카드(누를 수 없음)로 까닭을 보이고, 배포할 곳으로 고르지 않음
    L.ok('siteScripts:false → 바로 배포 shown disabled, not picked', await p.locator('.pub-mode-main.is-off[aria-disabled="true"]').count() === 1 && await p.locator('.pub-mode-main.is-on').count() === 0);
    // 이 시험의 망은 다른 곳의 API가 모두 막힌 망: 그래도 저절로 고른 곳의 카드에 누를 큰 버튼은 정확히 하나
    L.ok('instant unavailable (blocked network) → the picked card still has exactly one primary button', await p.locator('.publish .btn-primary:visible:not([disabled])').count() === 1, (await p.locator('.publish .btn-primary:visible').allInnerTexts()).join(' | '));
    await p.locator('.publish').scrollIntoViewIfNeeded(); await p.screenshot({ path: L.OUT + 'instant-noscripts.png' });
    L.ok('no page errors ①', errs.length === 0, JSON.stringify(errs)); await ctx.close();
  }
  { // ② 받는 서버지만 내용이 거절됨(422 unsafe_site)
    const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } }); const st = await server(ctx, { siteScripts: true, unsafe: true });
    const p = await ctx.newPage(); const errs = L.watch(p);
    await seed(p, true);
    L.ok('siteScripts:true → instant offered', /바로 배포/.test(await p.locator('.publish').innerText()));
    await p.click('.publish .btn-primary.btn-lg');
    await p.waitForSelector('dialog[open] button:has-text("참여 기능 없이")', { timeout: 2500 }).then((x) => x.click()).catch(() => {});
    await p.waitForSelector('.publish [role=alert]:has-text("바로 배포가 이 사이트를 받지 않았어요")', { timeout: 30000 });
    L.ok('unsafe_site → server message shown as is', (await p.locator('.publish [role=alert]').first().innerText()).includes(UNSAFE), st.calls.join(','));
    await p.locator('.publish [role=alert]').first().scrollIntoViewIfNeeded(); await p.screenshot({ path: L.OUT + 'instant-unsafe.png' });
    L.ok('no page errors ②', errs.length === 0, JSON.stringify(errs)); await ctx.close();
  }
  { // ③ 이 망에서 바로 배포 서버에 닿지 않음: 바로 배포를 감추지 않고 흐린 카드에 까닭·할 일(핫스팟)을 보임
    const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } }); await server(ctx, { siteScripts: true, down: true });
    const p = await ctx.newPage(); const errs = L.watch(p);
    await seed(p, false); await p.waitForTimeout(2500);
    const card = await p.locator('.pub-mode-main.is-off').innerText().catch(() => '');
    L.ok('server unreachable → 바로 배포 card stays, disabled with the reason', /바로 배포/.test(card) && /핫스팟/.test(card), card.replace(/\s+/g, ' ').slice(0, 160));
    L.ok('server unreachable → other places open below', await p.locator('.pub-pick .pub-opt').count() > 0);
    L.ok('no page errors ③', errs.length === 0, JSON.stringify(errs)); await ctx.close();
  }
  { // ④ 배포가 중간에 실패(서버 오류) → 까닭이 화면에 남고 [다시 배포]는 같은 사이트에 이어서(새 사이트를 또 만들지 않음) → 배포 취소 → 다시 배포
    const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } }); const st = await server(ctx, { siteScripts: true, failPublish: 1 });
    const p = await ctx.newPage(); const errs = L.watch(p);
    await seed(p, false);
    await p.click('.publish .btn-primary.btn-lg');
    await p.waitForSelector('dialog[open] button:has-text("참여 기능 없이")', { timeout: 2500 }).then((x) => x.click()).catch(() => {});
    await p.waitForSelector('.publish [role=alert]:has-text("배포를 끝내지 못했어요")', { timeout: 30000 });
    const note = await p.locator('.publish [role=alert]').first().innerText();
    L.ok('failed publish → reason and next step stay on screen, instant not hidden', /응답하지 못해/.test(note) && /다시 배포/.test(note) && await p.locator('.pub-mode-main.is-on').count() === 1, note.replace(/\s+/g, ' ').slice(0, 160));
    // 큰 버튼은 하나만: 알림의 [다시 배포]가 지금 누를 곳(아래 큰 [배포하기]를 같이 띄우지 않음), 초점은 알림으로
    L.ok('failed publish → one primary ([다시 배포] in the notice), no second big button, focus on the notice', await p.locator('.publish .btn-primary:visible:not([disabled])').count() === 1 && await p.locator('.publish .btn-lg:visible').count() === 0 && await p.evaluate(() => document.activeElement?.getAttribute('role') === 'alert'), `primary ${await p.locator('.publish .btn-primary:visible:not([disabled])').count()} lg ${await p.locator('.publish .btn-lg:visible').count()}`);
    await p.locator('.publish [role=alert]').first().scrollIntoViewIfNeeded(); await p.screenshot({ path: L.OUT + 'instant-failed.png' });
    await p.click('.publish [role=alert] button:has-text("다시 배포")');
    await p.waitForSelector('dialog[open] button:has-text("참여 기능 없이")', { timeout: 2500 }).then((x) => x.click()).catch(() => {});
    await p.waitForSelector('.success .big-url', { timeout: 60000 });
    L.ok('retry reuses the same site (one new site only)', st.sites === 1 && /s-site1\./.test(await p.locator('.success .big-url').innerText()), `sites ${st.sites}`);
    // 배포한 뒤 체크리스트와 바로 배포 카드가 같은 '참여 기록 수'를 함께 묻더라도 서버에는 한 번만 감(전에는 두 번: 요청 하나 + 사이트 객체 요청 하나씩 더 썼음)
    await p.waitForTimeout(600);
    const recCalls = st.calls.filter((c) => c === 'GET /api/sites/site1/records').length;
    L.ok('records asked once per open, not twice', recCalls === 1, `records calls ${recCalls}`);
    // 배포 취소: 배포한 곳 줄의 [배포 취소] → 확인 → 실제로 지움(DELETE) → 완료 카드가 사라지고 다시 배포할 수 있음
    await p.click('.sites .sites-x');
    await p.waitForSelector('dialog[open]:has-text("배포를 취소할까요")', { timeout: 10000 });
    // 지우기 전 확인 창은 기억해 둔 수를 쓰지 않고 지금 기록 수를 새로 물음(방금 올라온 글이 빠진 수로 확인하지 않게)
    await p.waitForTimeout(500);
    L.ok('cancel dialog asks the record count afresh', st.calls.filter((c) => c === 'GET /api/sites/site1/records').length === recCalls + 1, `records calls ${st.calls.filter((c) => c === 'GET /api/sites/site1/records').length}`);
    L.ok('cancel dialog explains what stays', /다시 배포할 수 있어요/.test(await p.locator('dialog[open]').innerText()));
    L.ok('cancel dialog title reads naturally', /바로 배포를 취소할까요\?/.test(await p.locator('dialog[open] h2').innerText()) && !/바로 배포 배포를/.test(await p.locator('dialog[open]').innerText()));
    // [닫기]로 닫으면 초점이 연 버튼([배포 취소])으로 돌아옴(키보드·화면 읽기 프로그램이 길을 잃지 않게)
    await p.click('dialog[open] button:has-text("닫기")'); await p.waitForTimeout(300);
    L.ok('closing the cancel dialog returns focus to the button that opened it', await p.evaluate(() => document.activeElement?.classList.contains('sites-x')), await p.evaluate(() => document.activeElement?.tagName + '.' + document.activeElement?.className));
    await p.click('.sites .sites-x');
    await p.waitForSelector('dialog[open]:has-text("배포를 취소할까요")', { timeout: 10000 });
    await p.screenshot({ path: L.OUT + 'instant-cancel.png' });
    await p.click('dialog[open] button.btn-danger');
    await p.waitForFunction(() => !document.querySelector('.success .big-url'), null, { timeout: 15000 });
    L.ok('cancel → site really deleted and deploy record cleared', st.deleted === 1 && await p.locator('.sites .sites-x').count() === 0, `deleted ${st.deleted}`);
    await p.click('.publish .btn-primary.btn-lg');
    await p.waitForSelector('dialog[open] button:has-text("참여 기능 없이")', { timeout: 2500 }).then((x) => x.click()).catch(() => {});
    await p.waitForSelector('.success .big-url', { timeout: 60000 });
    L.ok('redeploy after cancel works (new site)', st.sites === 2 && /s-site2\./.test(await p.locator('.success .big-url').innerText()), `sites ${st.sites}`);
    L.ok('no page errors ④', errs.filter((e) => !/Failed to load resource/.test(e)).length === 0, JSON.stringify(errs)); await ctx.close();
  }
  { // ⑤ 실패한 뒤 새로 고쳐도 [배포하기]는 만들다 만 그 사이트를 다시 씀(실패할 때마다 하루 몫을 쓰지 않게: 연수 기록에 남김)
    const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } }); const st = await server(ctx, { siteScripts: true, failPublish: 1 });
    const p = await ctx.newPage(); const errs = L.watch(p);
    await seed(p, false);
    await p.click('.publish .btn-primary.btn-lg');
    await p.waitForSelector('dialog[open] button:has-text("참여 기능 없이")', { timeout: 2500 }).then((x) => x.click()).catch(() => {});
    await p.waitForSelector('.publish [role=alert]:has-text("배포를 끝내지 못했어요")', { timeout: 30000 });
    await p.waitForTimeout(1200); // 연수 기록 저장
    await p.reload({ waitUntil: 'load' }); await p.waitForSelector('.publish .btn-primary.btn-lg', { timeout: 30000 }); await p.waitForTimeout(1200);
    await p.click('.publish .btn-primary.btn-lg');
    await p.waitForSelector('dialog[open] button:has-text("참여 기능 없이")', { timeout: 2500 }).then((x) => x.click()).catch(() => {});
    await p.waitForSelector('.success .big-url', { timeout: 60000 });
    L.ok('after a reload the retry still reuses the same site', st.sites === 1 && /s-site1\./.test(await p.locator('.success .big-url').innerText()), `sites ${st.sites}`);
    L.ok('no page errors ⑤', errs.filter((e) => !/Failed to load resource/.test(e)).length === 0, JSON.stringify(errs)); await ctx.close();
  }
  { // ⑥ 다시 해도 같은 거절(413 too_large): 서버 문구만 보이고 [다시 배포] 없이 [다른 곳에 배포]로
    const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } }); await server(ctx, { siteScripts: true, tooLarge: true });
    const p = await ctx.newPage(); const errs = L.watch(p);
    await seed(p, false);
    await p.click('.publish .btn-primary.btn-lg');
    await p.waitForSelector('dialog[open] button:has-text("참여 기능 없이")', { timeout: 2500 }).then((x) => x.click()).catch(() => {});
    await p.waitForSelector('.publish [role=alert]:has-text("받지 않았어요")', { timeout: 30000 });
    const note = (await p.locator('.publish [role=alert]').first().innerText()).replace(/\s+/g, ' ');
    L.ok('too_large → server message, no "retry continues" promise', note.includes(TOO_LARGE) && !/이어서 해요/.test(note), note.slice(0, 200));
    L.ok('too_large → only [다른 곳에 배포] as the next step', await p.locator('.publish [role=alert] button:has-text("다시 배포")').count() === 0 && await p.locator('.publish [role=alert] button.btn-primary:has-text("다른 곳에 배포")').count() === 1);
    // 다시 해도 같은 거절: 큰 [배포하기]를 내지 않음(누르면 같은 거절이 되풀이됨). 누를 큰 버튼은 알림의 [다른 곳에 배포] 하나
    L.ok('too_large → the big [배포하기] is gone, exactly one primary, focus on the notice', await p.locator('.publish .btn-primary:visible:not([disabled])').count() === 1 && await p.locator('.publish .btn-lg:visible').count() === 0 && await p.evaluate(() => document.activeElement?.getAttribute('role') === 'alert'));
    L.ok('no page errors ⑥', errs.filter((e) => !/Failed to load resource/.test(e)).length === 0, JSON.stringify(errs)); await ctx.close();
  }
  { // ⑧ 지워진(보관 기간이 끝난) 사이트에 다시 배포하다 실패를 거듭해도: 누를 때마다 새 사이트를 만들지 않고, 그 대신 만들다 만 사이트에 이어서(하루 몫을 실패마다 쓰지 않게)
    const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } }); const st = await server(ctx, { siteScripts: true });
    const p = await ctx.newPage(); const errs = L.watch(p);
    await seed(p, false);
    await p.click('.publish .btn-primary.btn-lg');
    await p.waitForSelector('dialog[open] button:has-text("참여 기능 없이")', { timeout: 2500 }).then((x) => x.click()).catch(() => {});
    await p.waitForSelector('.success .big-url', { timeout: 60000 });
    st.gone = new Set(['site1']); st.failPublish = 2; // 그 사이트가 서버에서 지워짐 + 다음 두 번의 공개가 서버 오류
    const publishes = () => st.calls.filter((c) => /\/publish$/.test(c)).length;
    const waitPublishes = async (n) => { for (const t0 = Date.now(); publishes() < n && Date.now() - t0 < 30000;) await p.waitForTimeout(150); };
    await p.locator('.publish .btn-primary.btn-lg').scrollIntoViewIfNeeded();
    await p.click('.publish .btn-primary.btn-lg'); // [다시 배포하기] → 지워진 사이트(404) → 새 사이트(site2) → 공개 실패
    await p.waitForSelector('dialog[open] button:has-text("참여 기능 없이")', { timeout: 2500 }).then((x) => x.click()).catch(() => {});
    await waitPublishes(2); await p.waitForSelector('.publish [role=alert]:has-text("배포를 끝내지 못했어요")', { timeout: 30000 });
    await p.click('.publish [role=alert] button:has-text("다시 배포")'); // 또 지워진 사이트(404) → 만들다 만 site2에 이어서 → 공개 실패
    await p.waitForSelector('dialog[open] button:has-text("참여 기능 없이")', { timeout: 2500 }).then((x) => x.click()).catch(() => {});
    await waitPublishes(3); await p.waitForSelector('.publish [role=alert]:has-text("배포를 끝내지 못했어요")', { timeout: 30000 });
    const mid = st.sites;
    await p.click('.publish [role=alert] button:has-text("다시 배포")'); // 이번에는 공개까지
    await p.waitForSelector('dialog[open] button:has-text("참여 기능 없이")', { timeout: 2500 }).then((x) => x.click()).catch(() => {});
    await p.waitForFunction(() => /s-site2\./.test(document.querySelector('.success .big-url')?.textContent || ''), null, { timeout: 60000 }).catch(() => {});
    L.ok('expired site: repeated failed retries make only one replacement site', mid === 2 && st.sites === 2 && /s-site2\./.test(await p.locator('.success .big-url').innerText().catch(() => '')), `sites ${mid}→${st.sites} publishes ${publishes()}`);
    L.ok('no page errors ⑧', errs.filter((e) => !/Failed to load resource/.test(e)).length === 0, JSON.stringify(errs)); await ctx.close();
  }
  for (const [quota, want] of [[7, true], [8, false]]) { // ⑦ 적어 둔 '오늘 몫 0'은 서버의 횟수 초기화 번호(quota)가 같을 때만 알림 · 방을 지금 열지 않는 서버면 '참여 기능까지'라고 하지 않음
    const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
    await ctx.addInitScript(() => { try { localStorage.setItem('lecpage:instant-share', JSON.stringify({ left: 0, scope: 'device', until: Date.now() + 3600e3, quota: 7 })); } catch { /* 없음 */ } });
    await server(ctx, { siteScripts: true, info: { quota, live: { url: 'https://publish.mock.test/live', accepting: quota === 7 } } });
    const p = await ctx.newPage(); const errs = L.watch(p);
    await seed(p, false);
    const txt = (await p.locator('.publish').innerText()).replace(/\s+/g, ' ');
    L.ok(`quota ${quota}: remembered "used up" hint ${want ? 'kept' : 'dropped after the counter reset'}`, /다 썼을 수 있어요/.test(txt) === want, txt.slice(0, 160));
    L.ok(`live.accepting ${quota === 7}: card ${quota === 7 ? 'promises' : 'does not promise'} participation`, /참여 기능까지 바로 켜져요/.test(txt) === (quota === 7));
    // 배포 준비 체크리스트의 참여 기능 줄도 같은 기준(배포 카드만이 아니라): 방을 새로 열 수 없는 서버면 '함께 켜져요'라고 하지 않음
    const whole = (await p.locator('body').innerText()).replace(/\s+/g, ' ');
    L.ok(`live.accepting ${quota === 7}: checklist ${quota === 7 ? 'says' : 'does not say'} "deploys together"`, /바로 배포하면 함께 켜져요/.test(whole) === (quota === 7) && (quota === 7 || /참여 기능 방을 새로 열 수 없어요/.test(whole)), (whole.match(/.{0,40}(함께 켜져요|새로 열 수 없어요).{0,20}/) || [''])[0]);
    L.ok(`no page errors ⑦-${quota}`, errs.filter((e) => !/Failed to load resource/.test(e)).length === 0, JSON.stringify(errs)); await ctx.close();
  }
  { // ⑨ 오늘 자리가 차서 서버가 넘길 곳의 순서(next: cloudflare → vercel → github → netlify)를 줘도: 커넥트가 없으면 지금 버튼 하나로 되는 Netlify(브라우저 로그인 한 번)가 추천·기본
    const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
    await server(ctx, { siteScripts: true, reachable: true, info: { accepting: false, capacity: { state: 'full', reason: 'sites', resetAt: Date.now() + 6 * 3600e3, next: ['cloudflare', 'vercel', 'github', 'netlify'] } } });
    const p = await ctx.newPage(); const errs = L.watch(p);
    await seed(p, false);
    await p.waitForSelector('.pub-opt', { timeout: 15000 }); await p.waitForTimeout(1500);
    const opts = (await p.locator('.pub-opt').allInnerTexts()).map((t) => t.replace(/\s+/g, ' '));
    const first = (await p.locator('.pub-opt:has(input:checked)').innerText()).replace(/\s+/g, ' ');
    L.ok('instant full + server order → the place that works with one button now (Netlify) is picked and recommended, not "connector needed"', /^Netlify/.test(first) && /추천/.test(first) && /로그인 한 번/.test(first) && /^Netlify/.test(opts[0] || ''), opts.join(' | '));
    const box = (await p.locator('.publish').innerText()).replace(/\s+/g, ' ');
    L.ok('instant full → exactly one primary button and one message about what to do', await p.locator('.publish .btn-primary:visible:not([disabled])').count() === 1 && await p.locator('.publish button.btn-primary:has-text("Netlify 계정으로 배포")').count() === 1 && !/받은 ZIP을 끌어다 놓아요/.test(box), (await p.locator('.publish .btn-primary:visible').allInnerTexts()).join(' | '));
    await p.locator('.publish').scrollIntoViewIfNeeded(); await p.screenshot({ path: L.OUT + 'instant-full-netlify.png' });
    L.ok('no page errors ⑨', errs.filter((e) => !/Failed to load resource/.test(e)).length === 0, JSON.stringify(errs)); await ctx.close();
  }
  // 진짜 서버의 한도(pages 보기): 사이트 300MB·3,000개·파일 하나 20MB, 작은 파일(512KB 이하)은 8MiB씩 묶어 받음
  const REAL_LIMITS = { maxBytes: 300 * 1024 * 1024, maxFileBytes: 20 * 1024 * 1024, maxFiles: 3000, days: 60, bundle: { bytes: 8 * 1024 * 1024, itemBytes: 512 * 1024, files: 700 } };
  /** 이 연수의 저장소(IndexedDB)에 파일을 넣음: [경로, 바이트 수][] — 내용은 경로마다 다르게 */
  const putBlobs = (p, list) => p.evaluate(async (items) => {
    const pid = (location.hash.match(/#\/p\/([^/]+)/) || [])[1];
    const db = await new Promise((ok, no) => { const q = indexedDB.open('lecpage'); q.onsuccess = () => ok(q.result); q.onerror = () => no(q.error); });
    for (let i = 0; i < items.length; i += 25) {
      await new Promise((ok, no) => {
        const t = db.transaction('blobs', 'readwrite'); const s = t.objectStore('blobs');
        for (const [path, n] of items.slice(i, i + 25)) { const u = new Uint8Array(n); crypto.getRandomValues(u.subarray(0, Math.min(n, 4096))); new TextEncoder().encodeInto(path, u.subarray(0, Math.min(n, 200))); s.put(u, pid + ':' + path); }
        t.oncomplete = ok; t.onerror = () => no(t.error);
      });
    }
    return pid;
  }, list);
  { // ⑩ 큰 사이트(교재 쪽 그림 300장, 45MB: 예전 한도 40MB를 넘음)가 그대로 올라감 — 쪽 그림은 한 장도 빠지지 않음
    const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
    const st = await server(ctx, { siteScripts: true, takeAll: true, info: { limits: REAL_LIMITS } });
    const p = await ctx.newPage(); const errs = L.watch(p);
    await seed(p, false);
    const pages = []; for (let i = 14; i <= 313; i++) pages.push([`site/material/p-${String(i).padStart(3, '0')}.webp`, 150 * 1024]);
    await putBlobs(p, pages);
    await p.click('.publish .btn-primary.btn-lg');
    await p.waitForSelector('dialog[open] button:has-text("참여 기능 없이")', { timeout: 2500 }).then((x) => x.click()).catch(() => {});
    await p.waitForSelector('.success .big-url', { timeout: 180000 });
    const man = st.manifests.at(-1) || {}; const imgs = Object.keys(man).filter((k) => /^material\/p-\d+\.webp$/.test(k));
    const bytes = Object.values(man).reduce((n, f) => n + f.size, 0);
    L.ok('big site (300 added page images, over the old 40MB limit) deploys as is: every page image is in the deploy list', imgs.length >= 300 && bytes > 44 * 1024 * 1024 && Object.keys(man).length < 3000, `${imgs.length} page images, ${Math.round(bytes / 1048576)}MB, ${Object.keys(man).length} files`);
    const uniq = new Set(Object.values(man).map((f) => f.sha256)).size;
    L.ok('big site → all files uploaded and the address appears', st.bundleFiles + st.puts === uniq && st.putBytes > 44 * 1024 * 1024 && /example\.pages\.dev/.test(await p.locator('.success .big-url').innerText()), `${st.bundleFiles} in bundles + ${st.puts} single = ${uniq} files, ${Math.round(st.putBytes / 1048576)}MB`);
    // 작은 파일은 묶어 보냄: 올리기 요청이 파일 수(300개 넘음)가 아니라 열 번 안팎
    L.ok('big site → small files go in bundles: upload requests are about ten, not one per file', st.bundles >= 1 && st.bundles + st.puts <= 12 && st.bundleFiles >= 300, `${st.bundles} bundle requests + ${st.puts} single for ${uniq} files`);
    L.ok('big site → nothing was left out, no size note', await p.locator('.success .left-note').count() === 0);
    L.ok('no page errors ⑩', errs.length === 0, JSON.stringify(errs)); await ctx.close();
  }
  { // ⑪ '교재 원본 다운로드 허용'을 켰는데 원본이 서버의 파일 한도(20MB)보다 큼(60MB): 원본만 빼고 배포는 성공, 미리 한 줄 + 배포 뒤에도 남는 한 줄
    const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
    const st = await server(ctx, { siteScripts: true, takeAll: true, info: { limits: REAL_LIMITS } });
    const p = await ctx.newPage(); const errs = L.watch(p);
    await seed(p, false);
    // 넣은 교재(workshop.pdf)의 원본을 60MB짜리로 바꿈(저장소의 원본 내용과 연수 기록의 크기) → 새로 고쳐 그 연수를 다시 엶
    const big = 60 * 1024 * 1024;
    const key = await p.evaluate(async (n) => {
      const pid = (location.hash.match(/#\/p\/([^/]+)/) || [])[1];
      const db = await new Promise((ok, no) => { const q = indexedDB.open('lecpage'); q.onsuccess = () => ok(q.result); q.onerror = () => no(q.error); });
      const rec = await new Promise((ok, no) => { const q = db.transaction('projects').objectStore('projects').get(pid); q.onsuccess = () => ok(q.result); q.onerror = () => no(q.error); });
      const f = (rec.files || []).find((x) => x.key); if (!f) return '';
      f.size = n;
      await new Promise((ok, no) => { const t = db.transaction(['projects', 'blobs'], 'readwrite'); t.objectStore('projects').put(rec); const u = new Uint8Array(n); u.set(new TextEncoder().encode('%PDF-1.4 big original'), 0); t.objectStore('blobs').put(u, pid + ':' + f.key); t.oncomplete = ok; t.onerror = () => no(t.error); });
      return f.key;
    }, big);
    await p.reload({ waitUntil: 'load' }); await p.waitForSelector('.publish', { timeout: 30000 }); await p.waitForTimeout(1500);
    // 공개 범위 줄을 펼쳐 '교재 원본 다운로드 허용'을 켬 → 체크 옆에 미리 한 줄(큰 원본이 있을 때만)
    await p.locator('li:has-text("공개 범위") button:has-text("변경"), li:has-text("공개 범위") button:has-text("바꾸기")').first().click().catch(() => {});
    const box = p.locator('label.check:has-text("교재 원본 다운로드 허용") input');
    await box.waitFor({ timeout: 10000 });
    L.ok('before checking: no size line', await p.locator('.left-note').count() === 0);
    await box.check();
    await p.waitForSelector('.left-note', { timeout: 10000 });
    const pre = (await p.locator('.left-note').first().innerText()).replace(/\s+/g, ' ');
    L.ok('originals checked + 60MB original → one line next to the checkbox says it will not be put in the site', /workshop\.pdf\(60MB\)는 커서 사이트에 넣지 않아요\./.test(pre) && /교재 슬라이드에서 모든 쪽을 볼 수 있어요/.test(pre) === /data-lp="deck"/.test(ANSWER(false)), pre.slice(0, 120));
    await p.click('.publish .btn-primary.btn-lg');
    await p.waitForSelector('dialog[open] button:has-text("참여 기능 없이")', { timeout: 2500 }).then((x) => x.click()).catch(() => {});
    await p.waitForSelector('.success .big-url', { timeout: 120000 });
    const man = st.manifests.at(-1) || {};
    const maxFile = Math.max(...Object.values(man).map((f) => f.size));
    L.ok('60MB original is left out of the site (not in the deploy list), deploy succeeds, page images kept', key !== '' && !Object.keys(man).some((k) => k.startsWith('files/')) && maxFile <= REAL_LIMITS.maxFileBytes && Object.keys(man).some((k) => /^material\/p-\d+\./.test(k)), `files: ${Object.keys(man).filter((k) => k.startsWith('files/')).join(',') || '(none)'}, biggest ${Math.round(maxFile / 1024)}KB`);
    const note = (await p.locator('.success .left-note').innerText().catch(() => '')).replace(/\s+/g, ' ');
    L.ok('after deploy: the line stays on the success card (not a toast)', /workshop\.pdf\(60MB\)는 커서 사이트에 넣지 않았어요\./.test(note), note.slice(0, 120));
    await p.waitForTimeout(3500); // 토스트가 사라진 뒤에도 남아 있음
    L.ok('the line is still there after toasts are gone, and survives a reload', await p.locator('.success .left-note').count() === 1 && (await p.reload({ waitUntil: 'load' }), await p.waitForSelector('.success .big-url', { timeout: 30000 }), await p.locator('.success .left-note').count()) === 1);
    await p.locator('.success').first().scrollIntoViewIfNeeded(); await p.screenshot({ path: L.OUT + 'instant-left-original.png' });
    L.ok('no page errors ⑪', errs.length === 0, JSON.stringify(errs)); await ctx.close();
  }
  { // ⑫ 묶음을 받지 않는 예전 서버(/api/info에 limits.bundle 없음)면 지금처럼 파일마다 올림
    const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
    const { bundle, ...OLD } = REAL_LIMITS; void bundle;
    const st = await server(ctx, { siteScripts: true, takeAll: true, info: { limits: OLD } });
    const p = await ctx.newPage(); const errs = L.watch(p);
    await seed(p, false);
    await p.click('.publish .btn-primary.btn-lg');
    await p.waitForSelector('dialog[open] button:has-text("참여 기능 없이")', { timeout: 2500 }).then((x) => x.click()).catch(() => {});
    await p.waitForSelector('.success .big-url', { timeout: 120000 });
    const uniq = new Set(Object.values(st.manifests.at(-1) || {}).map((f) => f.sha256)).size;
    L.ok('old server (no bundle in /api/info) → one request per file, no bundle request', st.bundles === 0 && st.puts === uniq && uniq > 5, `${st.puts} single for ${uniq} files`);
    L.ok('no page errors ⑫', errs.length === 0, JSON.stringify(errs)); await ctx.close();
  }
  { // ⑬ 묶음에서 서버가 한 파일만 못 받았다고 하면(내용이 달라요) 그 파일만 하나씩 다시 보내고 배포는 끝남
    const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
    const st = await server(ctx, { siteScripts: true, takeAll: true, failOne: true, info: { limits: REAL_LIMITS } });
    const p = await ctx.newPage(); const errs = L.watch(p);
    await seed(p, false);
    await p.click('.publish .btn-primary.btn-lg');
    await p.waitForSelector('dialog[open] button:has-text("참여 기능 없이")', { timeout: 2500 }).then((x) => x.click()).catch(() => {});
    await p.waitForSelector('.success .big-url', { timeout: 120000 });
    const uniq = new Set(Object.values(st.manifests.at(-1) || {}).map((f) => f.sha256)).size;
    L.ok('one file refused inside a bundle → only that file is sent again on its own, deploy finishes', !!st.failedSha && st.resent.length === 1 && st.resent[0] === st.failedSha && st.bundles >= 1 && st.bundleFiles + st.puts === uniq + 1, `${st.bundles} bundle(s) with ${st.bundleFiles} files, ${st.puts} single, resent ${st.resent.length}`);
    L.ok('no page errors ⑬', errs.length === 0, JSON.stringify(errs)); await ctx.close();
  }
  for (const code of [413, 400]) { // ⑭ 묶음 요청을 서버가 거절하면(413 묶음이 너무 커요 · 400 묶음 모양) 파일마다 올리기로 넘어가 배포는 끝남(예전에는 그대로 실패)
    const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
    const st = await server(ctx, { siteScripts: true, takeAll: true, bundleRefuse: code, info: { limits: REAL_LIMITS } });
    const p = await ctx.newPage(); const errs = L.watch(p);
    await seed(p, false);
    await p.click('.publish .btn-primary.btn-lg');
    await p.waitForSelector('dialog[open] button:has-text("참여 기능 없이")', { timeout: 2500 }).then((x) => x.click()).catch(() => {});
    await p.waitForSelector('.success .big-url', { timeout: 120000 });
    const uniq = new Set(Object.values(st.manifests.at(-1) || {}).map((f) => f.sha256)).size;
    L.ok(`bundle refused with ${code} → falls back to one request per file, deploy finishes`, st.bundleRefused >= 1 && st.bundles === 0 && st.puts === uniq && uniq > 5, `${st.bundleRefused} refused, ${st.puts} single for ${uniq} files`);
    L.ok(`no page errors ⑭ ${code}`, errs.length === 0, JSON.stringify(errs)); await ctx.close();
  }
  await b.close();
  process.exit(L.summary() ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
