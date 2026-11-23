// 바로 배포(가짜 서버, 앱은 VITE_PUBLISH_API=http://publish.mock.test로 띄운 것): AI가 쓴 사이트를
//  ① 사이트 스크립트를 받지 않는 서버(/api/info siteScripts:false)면 처음부터 안내하고 내 계정 쪽으로
//  ② 받지 않는 내용(422 unsafe_site)이면 서버 문구(message_ko)를 배포 화면에 그대로
const L = require('./lib.js');
const BASE = process.env.BASE2 || 'http://localhost:6302/';
const ANSWER = (script) => '```html\n<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><title>바로 배포 시험</title></head><body><main><section id="a" data-title="첫 화면"><h1>바로 배포 시험</h1><div data-lp="qa"></div></section></main>' + (script ? '<script>document.documentElement.classList.add("js")</script>' : '') + '</body></html>\n```\n```json\n{"v":2,"title":"바로 배포 시험","sessions":[{"date":"2027-02-10","start":"10:00","end":"12:00"}],"features":["qa"]}\n```';
const UNSAFE = 'index.html에 비밀번호 입력 칸이 있어요. 참가자의 비밀번호를 받는 사이트는 바로 배포할 수 없어요.';
const TOO_LARGE = '사이트가 너무 커요(30MB까지). 큰 영상은 유튜브 링크로 바꿔 주세요.';
async function server(ctx, { siteScripts, unsafe, down, failPublish = 0, tooLarge = false, info = {} }) {
  const st = { calls: [] };
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, async (r) => {
    const u = new URL(r.request().url()); const m = r.request().method();
    const json = (o, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(o) });
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
    if (/\/deploys$/.test(u.pathname)) return json({ deploy: 'd1', missing: [] });
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
    await p.locator('.publish [role=alert]').first().scrollIntoViewIfNeeded(); await p.screenshot({ path: L.OUT + 'instant-failed.png' });
    await p.click('.publish [role=alert] button:has-text("다시 배포")');
    await p.waitForSelector('dialog[open] button:has-text("참여 기능 없이")', { timeout: 2500 }).then((x) => x.click()).catch(() => {});
    await p.waitForSelector('.success .big-url', { timeout: 60000 });
    L.ok('retry reuses the same site (one new site only)', st.sites === 1 && /s-site1\./.test(await p.locator('.success .big-url').innerText()), `sites ${st.sites}`);
    // 배포 취소: 배포한 곳 줄의 [배포 취소] → 확인 → 실제로 지움(DELETE) → 완료 카드가 사라지고 다시 배포할 수 있음
    await p.click('.sites .sites-x');
    await p.waitForSelector('dialog[open]:has-text("배포를 취소할까요")', { timeout: 10000 });
    L.ok('cancel dialog explains what stays', /다시 배포할 수 있어요/.test(await p.locator('dialog[open]').innerText()));
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
  await b.close();
  process.exit(L.summary() ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
