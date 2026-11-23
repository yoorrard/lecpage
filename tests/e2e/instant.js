// 바로 배포(가짜 서버, 앱은 VITE_PUBLISH_API=http://publish.mock.test로 띄운 것): AI가 쓴 사이트를
//  ① 사이트 스크립트를 받지 않는 서버(/api/info siteScripts:false)면 처음부터 안내하고 내 계정 쪽으로
//  ② 받지 않는 내용(422 unsafe_site)이면 서버 문구(message_ko)를 배포 화면에 그대로
const L = require('./lib.js');
const BASE = process.env.BASE2 || 'http://localhost:6302/';
const ANSWER = (script) => '```html\n<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><title>바로 배포 시험</title></head><body><main><section id="a" data-title="첫 화면"><h1>바로 배포 시험</h1><div data-lp="qa"></div></section></main>' + (script ? '<script>document.documentElement.classList.add("js")</script>' : '') + '</body></html>\n```\n```json\n{"v":2,"title":"바로 배포 시험","sessions":[{"date":"2027-02-10","start":"10:00","end":"12:00"}],"features":["qa"]}\n```';
const UNSAFE = 'index.html에 비밀번호 입력 칸이 있어요. 참가자의 비밀번호를 받는 사이트는 바로 배포할 수 없어요.';
async function server(ctx, { siteScripts, unsafe, down }) {
  const st = { calls: [] };
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, async (r) => {
    const u = new URL(r.request().url()); const m = r.request().method();
    const json = (o, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(o) });
    if (u.host !== 'publish.mock.test') return r.abort();
    if (down) return r.abort('connectionrefused'); // 이 망에서 바로 배포 서버에 닿지 않음
    if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    st.calls.push(`${m} ${u.pathname}`);
    if (u.pathname === '/api/info') return json({ ok: true, v: 1, plan: 'free', accepting: true, view: siteScripts ? 'pages' : 'worker', keepAlive: !siteScripts, siteScripts, limits: { maxBytes: 30e6, maxFileBytes: 10e6, maxFiles: 400, days: 60 }, report: 'https://publish.mock.test/report' });
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
  await b.close();
  process.exit(L.summary() ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
