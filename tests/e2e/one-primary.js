// 배포하기·참여 기능 연결: 어떤 상태에서도 고른 카드 안에 '지금 누를 큰 버튼'이 정확히 하나(원칙: 화면마다 누를 곳 하나).
//   배포할 곳(Netlify·Vercel·GitHub Pages·Cloudflare·ZIP) × lecpage 커넥트 없음/켜짐 × 연결해 둠/아님
//   + 커넥트가 없을 때는 지금 버튼 하나로 되는 곳(Netlify)이, 켜져 있으면 Cloudflare가 추천·기본
//   + 커넥트가 꺼진 Cloudflare 카드: 안내 하나(커넥트를 켜면 …) · 참여 기능을 따로 연결하라는 상자 없음 · 켜지면 버튼이 저절로 나옴
// 실행: BASE=<앱 미리보기 주소> node tests/e2e/one-primary.js   (가짜 커넥트: 주소만 흉내, 포트 6623)
const { chromium, fs, mockAll, openShare, connect, watch } = require('./h3.js');
const path = require('path');
const OUT = path.resolve(process.env.OUT || path.join(__dirname, '../../.out/verify/shots'), 'one-primary') + '/'; fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' :: ' + extra : ''}`); };
const TOKEN = 'f'.repeat(64); const PORT = 6623;
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const PLACES = ['Netlify', 'Vercel', 'GitHub Pages', 'Cloudflare', 'ZIP 다운로드'];
const pick = async (p, label) => { if (!(await p.locator('.pub-opt').count()) && await p.locator('.pub-mode').count()) await p.click('.pub-mode:has-text("다른 곳에 배포")'); await p.click(`.pub-opt:has-text("${label}")`); await p.waitForTimeout(250); };
// 지금 보이는(접힌 칸 안이 아닌) 누를 수 있는 큰 버튼
const primaries = (p, scope = '.publish') => p.locator(`${scope} .btn-primary:visible:not([disabled])`).allInnerTexts().then((a) => a.map((t) => t.replace(/\s+/g, ' ').trim()));
/** 가짜 커넥트: 켜져 있으면 Cloudflare·Vercel 일을 할 수 있다고 답함. B.off면 꺼진 것(연결 거절) */
async function bridge(ctx, off = false) {
  const B = { off };
  await ctx.addInitScript(([tk, port]) => { try { if (!sessionStorage.getItem('lp-seeded')) { localStorage.setItem('lecpage:pc', JSON.stringify({ token: tk, port, at: Date.now() })); sessionStorage.setItem('lp-seeded', '1'); } } catch { /* 넘김 */ } }, [TOKEN, PORT]);
  await ctx.route(new RegExp(`^http://127\\.0\\.0\\.1:${PORT}/`), (r) => {
    const req = r.request(); const u = new URL(req.url());
    if (B.off) return r.abort('connectionrefused');
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    const send = (o, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(o) });
    if (req.headers()['x-lecpage-bridge'] !== TOKEN) return send({ ok: false, error: 'token' }, 401);
    if (u.pathname === '/bridge/status') return send({ ok: true, version: '1.1.0', caps: ['status-caps', 'cloudflare', 'vercel'], agents: [{ id: 'claude', installed: false }, { id: 'codex', installed: false }] });
    return send({ ok: true, cf: { running: false, phase: 'idle' }, vc: { running: false, phase: 'idle' } });
  });
  return B;
}

(async () => {
  const b = await chromium.launch();
  // ── A. lecpage 커넥트 없음(짝을 맞춘 적 없음) ──
  for (const w of [1280, 390]) {
    try {
      const ctx = await b.newContext({ viewport: { width: w, height: 844 }, deviceScaleFactor: 1 }); await mockAll(ctx);
      const p = await ctx.newPage(); const errs = watch(p);
      await openShare(p);
      await p.waitForSelector('.pub-opt', { timeout: 15000 });
      const first = (await p.locator('.pub-opt:has(input:checked)').innerText()).replace(/\s+/g, ' ');
      ok(`${w} no connector: the place picked first works with one button now (Netlify, login once)`, /^Netlify/.test(first) && /추천/.test(first) && /로그인 한 번/.test(first), first);
      const chips = (await p.locator('.pub-opt').allInnerTexts()).join(' | ').replace(/\s+/g, ' ');
      ok(`${w} no connector: chips use plain words`, /토큰 붙여넣기/.test(chips) && /lecpage 커넥트 필요/.test(chips) && !/토큰 연결|[^e] 커넥트 필요/.test(chips), chips);
      for (const place of PLACES) {
        await pick(p, place);
        const btns = await primaries(p);
        ok(`${w} no connector · ${place}: exactly one primary button`, btns.length === 1, btns.join(' | ') || '(none)');
      }
      // Cloudflare(커넥트 없음): 안내는 하나, 참여 기능을 따로 연결하라는 상자는 없음, 직접 올리기는 접힘
      await pick(p, 'Cloudflare');
      const cf = (await p.locator('.publish').innerText()).replace(/\s+/g, ' ');
      ok(`${w} no connector · Cloudflare: one message (turn on the connector), no "connect participation separately" box, no ZIP lead`,
        /lecpage 커넥트를 켜면 Cloudflare 로그인 한 번으로 사이트와 참여 기능을 함께 배포해요/.test(cf) && /켜지면 이 화면에 \[Cloudflare 계정으로 배포\] 버튼이 저절로 나와요/.test(cf)
        && !/참여 기능을 따로 연결해야 해요/.test(cf) && !/받은 ZIP을 끌어다 놓아요/.test(cf) && await p.locator('.publish .pub-live').count() === 0
        && await p.locator('.publish .run-alt:not([open]) > summary:has-text("직접 배포")').count() === 1, cf.slice(0, 260));
      ok(`${w} no connector · Cloudflare: no overflow`, !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
      await p.locator('.publish').scrollIntoViewIfNeeded(); await p.screenshot({ path: OUT + `A-cloudflare-off-${w}.png` });
      // 연결해 둔 곳(Netlify 토큰): [배포하기] 하나
      if (w === 1280) {
        await pick(p, 'Netlify'); await connect(p, 'nfp_FAKE_TOKEN_1234567890');
        await p.waitForSelector('.publish .conn-line', { timeout: 10000 });
        const btns = await primaries(p);
        ok('connected Netlify: only [배포하기]', btns.length === 1 && /배포하기/.test(btns[0]), btns.join(' | '));
        const chip = (await p.locator('.pub-opt:has-text("Netlify")').innerText()).replace(/\s+/g, ' ');
        ok('connected Netlify: chip says 연결됨', /연결됨/.test(chip), chip);
      }
      ok(`${w} no script errors (A)`, errs.length === 0, JSON.stringify(errs).slice(0, 300));
      await ctx.close();
    } catch (e) { fails++; console.log(`FAIL exception(A ${w}) :: ` + String(e && e.message || e).slice(0, 400)); }
  }
  // ── B. lecpage 커넥트 켜짐 ──
  try {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 844 }, deviceScaleFactor: 1 }); await mockAll(ctx); await bridge(ctx);
    const p = await ctx.newPage(); const errs = watch(p);
    await openShare(p);
    await p.waitForSelector('.publish button:has-text("Cloudflare 계정으로 배포")', { timeout: 15000 });
    const first = (await p.locator('.pub-opt:has(input:checked)').innerText()).replace(/\s+/g, ' ');
    ok('connector on: Cloudflare (site + participation in one go) is picked and recommended', /^Cloudflare/.test(first) && /추천/.test(first) && /로그인 한 번/.test(first), first);
    for (const place of PLACES) {
      await pick(p, place);
      const btns = await primaries(p);
      ok(`connector on · ${place}: exactly one primary button`, btns.length === 1, btns.join(' | ') || '(none)');
    }
    await pick(p, 'Vercel');
    ok('connector on · Vercel: the one button is [Vercel 계정으로 배포]', (await primaries(p)).join() === 'Vercel 계정으로 배포');
    ok('no script errors (B)', errs.length === 0, JSON.stringify(errs).slice(0, 300));
    await ctx.close();
  } catch (e) { fails++; console.log('FAIL exception(B) :: ' + String(e && e.message || e).slice(0, 400)); }
  // ── C. 짝은 있는데 꺼져 있음 → 켜지면 누르지 않아도 버튼이 나옴 ──
  try {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 844 }, deviceScaleFactor: 1 }); await mockAll(ctx); const B = await bridge(ctx, true);
    const p = await ctx.newPage(); const errs = watch(p);
    await openShare(p);
    await p.waitForSelector('.pub-opt', { timeout: 15000 });
    await pick(p, 'Cloudflare');
    await p.waitForFunction(() => /lecpage 커넥트가 꺼져 있어요/.test(document.querySelector('.publish')?.textContent || ''), null, { timeout: 15000 });
    const btns = await primaries(p);
    ok('connector off (paired before) · Cloudflare: says it is off, one primary button', btns.length === 1, btns.join(' | '));
    B.off = false; // 커넥트를 켬
    const came = await p.waitForSelector('.publish button.btn-primary:has-text("Cloudflare 계정으로 배포")', { timeout: 15000 }).then(() => true, () => false);
    ok('when the connector comes on, [Cloudflare 계정으로 배포] appears by itself', came && (await primaries(p)).length === 1, (await primaries(p)).join(' | '));
    ok('no script errors (C)', errs.filter((e) => !/Failed to load resource|ERR_CONNECTION_REFUSED/.test(e)).length === 0, JSON.stringify(errs).slice(0, 300));
    await ctx.close();
  } catch (e) { fails++; console.log('FAIL exception(C) :: ' + String(e && e.message || e).slice(0, 400)); }
  await b.close();
  process.exit(fails ? 1 : 0);
})();
