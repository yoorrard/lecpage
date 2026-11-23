// 참여 기능 연결 화면(LiveSetup): 추천 하나가 먼저 + 접힌 '다른 방법으로 연결', 구글 시트·Supabase의 줄인 단계를 가짜 시트·가짜 Supabase로 끝까지.
//   구글 시트: [lecpage 코드 복사]에 이 연수의 설정(설치 코드)이 들어 있음 → 새로 고쳐도 같은 코드 → 다른 연수의 시트·설정 없는 시트는 까닭을 알려 줌 → 연결
//   Supabase: [설치 SQL 복사]에 연수 등록까지 → 복사한 글에서 주소·publishable 키를 찾아 바로 연결, secret 키는 받지 않음, 멈춘 프로젝트 안내
//   이미 연결한 예전 설치 + 여러 날 연수: 한 번 바꾸라는 안내(필요한 사람에게만)와 [새 코드 복사]·[설치 SQL 복사]
// 실행: BASE=<앱 미리보기 주소> node tests/e2e/live-setup.js
const { chromium, fs, BASE, mockAll, openShare, watch, ANSWER } = require('./h3.js');
const OUT = require('path').resolve(process.env.OUT || require('path').resolve(__dirname, '../../.out/verify/shots'), 'live-setup') + '/'; fs.mkdirSync(OUT, { recursive: true });
const ok = (name, cond, extra = '') => console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' :: ' + extra : ''}`);
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const SHEET = 'https://script.google.com/macros/s/FAKE_SHEET_ID_1234567890/exec';
const SB = 'https://abcdefghijklmnopqrst.supabase.co';
const PUB = 'sb_publishable_FakeKey1234567890_ab';
const TWO_DAYS = ANSWER.replace('"sessions":[{"date":"2027-03-17","start":"14:00","end":"15:30"}]', '"sessions":[{"date":"2027-03-17","start":"14:00","end":"15:30"},{"date":"2027-03-18","start":"14:00","end":"15:30"}]');

/** 가짜 구글 시트(웹 앱)와 가짜 Supabase. st로 상태를 바꿈 */
async function fakes(ctx, st) {
  Object.assign(st, { code: '', ready: true, adminOk: true, oldSheet: false, oldSb: false, paused: false, keys: [], admins: 0 });
  await ctx.route(/^https:\/\/script\.google\.com\/macros\/s\//, async (r) => {
    const req = r.request(); const u = new URL(req.url());
    const json = (o) => r.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(o) });
    if (req.method() === 'GET' && u.searchParams.get('a') === 'ping') return json({ ok: true, data: st.oldSheet ? { ok: true, version: '1.0.0', protocol: 1 } : { ok: true, version: '1.1.0', protocol: 1, days: true, ready: st.ready } });
    if (req.method() === 'GET' && u.searchParams.get('a') === 'state') return json(st.code && u.searchParams.get('code') !== st.code ? { ok: false, status: 404, error: 'unknown_training', message: '이 시트는 다른 연수 코드용입니다.' } : { ok: true, data: {} });
    if (req.method() === 'POST') { const b = JSON.parse(req.postData() || '{}'); if (b.a === 'checkAdmin') { st.admins++; return json({ ok: true, data: st.adminOk }); } }
    return json({ ok: false, status: 400, error: 'bad_action' });
  });
  await ctx.route(/^https:\/\/[a-z0-9]+\.supabase\.co\//, async (r) => {
    const req = r.request(); const u = new URL(req.url());
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    st.keys.push(req.headers().apikey || '');
    const json = (o, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(o) });
    if (st.paused) return json({ message: 'project paused' }, 540);
    if (/\/rpc\/lec_snapshot$/.test(u.pathname)) return json({ state: {}, now: 0 });
    if (/\/rpc\/lec_check_admin$/.test(u.pathname)) { st.admins++; return json(st.adminOk); }
    if (/\/rpc\/lec_caps$/.test(u.pathname)) return st.oldSb ? json({ code: 'PGRST202', message: 'Could not find the function public.lec_caps' }, 404) : json({ schema: 2, days: true });
    return json({ message: 'not found' }, 404);
  });
}
const openLive = async (p) => {
  if (await p.locator('#live-setup > summary').count()) await p.click('#live-setup > summary');
  if (await p.locator('#live-setup .ready-h button:text-is("연결")').count()) await p.click('#live-setup .ready-h button:text-is("연결")');
  await p.waitForSelector('#live-setup .live-others', { timeout: 15000 });
};
const pickWay = async (p, method) => {
  const b = p.locator(`#live-setup .live-others .live-pick[data-method="${method}"]`);
  if (await b.count()) { if (!(await p.locator('#live-setup .live-others[open]').count())) await p.click('#live-setup .live-others > summary'); await b.click(); }
  await p.waitForTimeout(200);
};
const step = async (p, i) => { const h = p.locator('#live-setup .walk-h').nth(i); if ((await h.getAttribute('aria-expanded')) !== 'true') await h.click(); await p.waitForTimeout(80); };
const clip = (p) => p.evaluate(() => navigator.clipboard.readText());
const setClip = (p, t) => p.evaluate((x) => navigator.clipboard.writeText(x), t);
const text = async (p) => (await p.locator('#live-setup').innerText()).replace(/\s+/g, ' ');
const badMsg = (p, re) => p.waitForFunction((src) => new RegExp(src).test(document.querySelector('#live-setup .notice.bad')?.textContent || ''), re.source, { timeout: 15000 }).then(() => true, () => false);
const readInstall = (code) => { try { return JSON.parse(Buffer.from(code.slice(5), 'base64url').toString('utf8')); } catch { return null; } };

(async () => {
  const b = await chromium.launch();
  // ── 하루짜리 연수: 줄인 단계를 끝까지 ──
  {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 }); await mockAll(ctx);
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(BASE).origin });
    const st = {}; await fakes(ctx, st);
    const p = await ctx.newPage(); const errs = watch(p);
    await openShare(p); await openLive(p);
    const code = (/연수 코드\s+([A-Z0-9_-]{3,40})/.exec(await text(p)) || [])[1] || '';
    ok('one way first: recommended (Google Sheets without the connector), others folded, no method tabs', /추천: 구글 시트 · 구글 계정만 있으면 돼요/.test(await text(p)) && await p.locator('#live-setup .live-others:not([open])').count() === 1 && !(await p.locator('#live-setup .seg').count()), code);
    await p.click('#live-setup .live-others > summary');
    const picks = await p.locator('#live-setup .live-pick').allInnerTexts();
    ok('other ways say what each needs', picks.length === 3 && /Supabase 계정/.test(picks.join('|')) && /Cloudflare 계정/.test(picks.join('|')) && /이 컴퓨터에서 테스트/.test(picks.join('|')) && /이 컴퓨터에서 테스트/.test(picks[2] || ''), picks.join(' | ').replace(/\s+/g, ' '));
    await p.locator('#live-setup').scrollIntoViewIfNeeded(); await p.screenshot({ path: OUT + '1-others-open.png' });

    // 구글 시트: 코드에 설치 코드가 들어 있음
    await pickWay(p, 'sheets');
    ok('sheets (the recommended way without the connector): 4 steps', await p.locator('#live-setup .walk > li').count() === 4 && /추천: 구글 시트/.test(await text(p)));
    await step(p, 1); await p.click('#live-setup .walk-b button:has-text("lecpage 코드 복사")'); await p.waitForTimeout(400);
    const gs1 = await clip(p); const inst1 = (/var INSTALL = '(lpi1\.[A-Za-z0-9_-]+)';/.exec(gs1) || [])[1] || '';
    const o1 = readInstall(inst1);
    ok('sheets: copied code carries this training (code + admin key hash, no key)', !!o1 && o1.c === code && /^[0-9a-f]{64}$/.test(o1.h) && /function doGet/.test(gs1) && !gs1.includes("var INSTALL = '';"), JSON.stringify(o1 || {}).slice(0, 80));
    await p.screenshot({ path: OUT + '2-sheets-step2.png' });
    // 새로 고쳐도 같은 설치 코드(만든 관리자 키를 잃지 않음)
    await p.reload({ waitUntil: 'load' }); await p.waitForSelector('.publish', { timeout: 30000 }); await p.waitForTimeout(800);
    await openLive(p); await pickWay(p, 'sheets'); await step(p, 1);
    await p.click('#live-setup .walk-b button:has-text("lecpage 코드 복사")'); await p.waitForTimeout(400);
    const inst2 = (/var INSTALL = '(lpi1\.[A-Za-z0-9_-]+)';/.exec(await clip(p)) || [])[1] || '';
    ok('sheets: same install code after reload', !!inst1 && inst2 === inst1);
    // 다른 연수의 시트 → 까닭
    st.code = 'OTHER99';
    await step(p, 3); await setClip(p, SHEET); await p.click('#live-setup .walk-b button:has-text("붙여넣기")');
    ok('sheets: sheet of another training → plain reason', await badMsg(p, /다른 연수에 쓰는 시트/));
    // 설정이 없는 시트 → 까닭
    st.code = code; st.ready = false;
    await p.click('#live-setup .walk-b button:has-text("연결 확인")');
    ok('sheets: not installed yet → plain reason', await badMsg(p, /설정이 아직 없어요/));
    st.ready = true;
    await p.click('#live-setup .walk-b button:has-text("연결 확인")');
    await p.waitForFunction(() => /구글 시트에 연결돼 있어요/.test(document.querySelector('#live-setup')?.textContent || ''), null, { timeout: 15000 }).then(() => ok('sheets: connected', true), () => ok('sheets: connected', false));
    ok('sheets: admin key checked once, no upgrade note for a one-day training', st.admins === 1 && !/여러 날 연수예요/.test(await text(p)), String(st.admins));

    // Supabase: 설치 SQL에 연수 등록까지
    await p.click('#live-setup button:has-text("연결 바꾸기")'); await p.waitForSelector('#live-setup .live-others');
    // [연결 바꾸기]는 잘못 눌러도 되돌릴 수 있음: [실행 취소] → 방금 연결 그대로
    ok('[연결 바꾸기] leaves a way back ([실행 취소])', await p.locator('#live-setup button:has-text("실행 취소")').count() === 1);
    await p.click('#live-setup button:has-text("실행 취소")');
    ok('[실행 취소] restores the connection', await p.waitForFunction(() => /구글 시트에 연결돼 있어요/.test(document.querySelector('#live-setup')?.textContent || ''), null, { timeout: 8000 }).then(() => true, () => false));
    await p.click('#live-setup button:has-text("연결 바꾸기")'); await p.waitForSelector('#live-setup .live-others');
    await pickWay(p, 'supabase');
    ok('supabase: 3 steps, header names the picked way, focus moves to it', await p.locator('#live-setup .walk > li').count() === 3 && /Supabase로 연결/.test(await text(p)) && await p.evaluate(() => document.activeElement?.classList.contains('live-way-h')));
    await step(p, 1); await p.click('#live-setup .walk-b button:has-text("설치 SQL 복사")'); await p.waitForTimeout(600);
    const sql = await clip(p); const last = sql.trim().split('\n').pop();
    const m = /^select lec_private\.init_training_hash\('([A-Z0-9_-]+)', '([0-9a-f]{64})', '(\{.*\})'\);$/.exec(last) || [];
    ok('supabase: install SQL registers this training in the same run', sql.length > 50000 && /create schema if not exists lec_private/.test(sql) && m[1] === code && !!m[2], last.slice(0, 90));
    ok('supabase: SQL editor link + settings in the SQL', /dashboard\/project\/_\/sql\/new/.test(await p.locator('#live-setup .walk-b a:has-text("SQL Editor 열기")').getAttribute('href')) && /retentionDays/.test(m[3] || ''));
    await step(p, 2);
    ok('supabase: Connect link', /dashboard\/project\/_\?showConnect=true/.test(await p.locator('#live-setup .walk-b a:has-text("Connect 창 열기")').getAttribute('href')));
    await setClip(p, 'SUPABASE_SECRET_KEY=sb_secret_NEVERUSE12345'); await p.click('#live-setup .walk-b button:has-text("붙여넣기")');
    ok('supabase: secret key refused, nothing kept', await badMsg(p, /secret 키는 넣지 않아요/) && (await p.locator('#live-setup .walk-b input').nth(1).inputValue()) === '');
    await setClip(p, SB + '/'); await p.click('#live-setup .walk-b button:has-text("붙여넣기")'); await p.waitForTimeout(300);
    ok('supabase: URL alone → asks for the key (not an error)', (await p.locator('#live-setup .walk-b input[type=url]').inputValue()) === SB && /Publishable key도 복사해/.test(await p.locator('#live-setup .notice.lav').last().innerText().catch(() => '')));
    await p.screenshot({ path: OUT + '3-supabase-step3.png' });
    st.admins = 0;
    await setClip(p, `VITE_SUPABASE_URL=${SB}\nVITE_SUPABASE_PUBLISHABLE_KEY=${PUB}\nSUPABASE_SECRET_KEY=sb_secret_NEVERUSE12345\n`);
    await p.click('#live-setup .walk-b button:has-text("붙여넣기")');
    await p.waitForFunction(() => /Supabase에 연결돼 있어요/.test(document.querySelector('#live-setup')?.textContent || ''), null, { timeout: 15000 }).then(() => ok('supabase: one paste (URL + key) → connected', true), () => ok('supabase: one paste (URL + key) → connected', false));
    ok('supabase: only the publishable key ever sent', st.keys.length > 0 && st.keys.every((k) => k === PUB) && st.admins === 1, [...new Set(st.keys)].join(',').slice(0, 60));
    // 멈춘 프로젝트 → 무엇을 누르면 되는지
    st.paused = true;
    await p.click('#live-setup button:has-text("다시 확인")');
    ok('supabase: paused project → says where to resume', await badMsg(p, /Resume project/));
    st.paused = false;
    ok('no overflow', !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
    console.log('errors', errs); await ctx.close();
  }
  // ── 여러 날 연수 + 이미 연결한 예전 설치: 한 번 바꾸라는 안내 ──
  for (const w of [1280, 390]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 844 }, deviceScaleFactor: 1 }); await mockAll(ctx);
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(BASE).origin });
    const st = {}; await fakes(ctx, st);
    const p = await ctx.newPage(); const errs = watch(p);
    await openShare(p, TWO_DAYS); await openLive(p);
    st.oldSheet = true; // 예전 Code.gs: ping에 days·ready가 없음
    await pickWay(p, 'sheets'); await step(p, 3); await setClip(p, SHEET); await p.click('#live-setup .walk-b button:has-text("붙여넣기")');
    await p.waitForFunction(() => /구글 시트에 연결돼 있어요/.test(document.querySelector('#live-setup')?.textContent || ''), null, { timeout: 15000 }).catch(() => { });
    const shown = await p.waitForFunction(() => /여러 날 연수예요/.test(document.querySelector('#live-setup .live-note')?.textContent || ''), null, { timeout: 10000 }).then(() => true, () => false);
    ok(`${w} old sheet + multi-day: one note with one button`, shown && await p.locator('#live-setup .live-note .btn-primary').count() === 1 && /확인 필요/.test(await text(p)), (await text(p)).slice(0, 160));
    if (shown) {
      await p.locator('#live-setup .live-note').scrollIntoViewIfNeeded(); await p.screenshot({ path: OUT + `4-${w}-old-sheet.png` });
      await p.click('#live-setup .live-note button:has-text("새 코드 복사")'); await p.waitForTimeout(400);
      const raw = await clip(p);
      ok(`${w} upgrade copy leaves settings alone (no install code)`, /function doGet/.test(raw) && raw.includes("var INSTALL = '';"));
      ok(`${w} no overflow with the note`, !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
      st.oldSheet = false;
      await p.click('#live-setup button:has-text("다시 확인")');
      ok(`${w} note goes away after the upgrade`, await p.waitForFunction(() => !document.querySelector('#live-setup .live-note'), null, { timeout: 10000 }).then(() => true, () => false));
    }
    if (w === 1280) {
      await p.click('#live-setup button:has-text("연결 바꾸기")'); await p.waitForSelector('#live-setup .live-others');
      st.oldSb = true;
      await pickWay(p, 'supabase'); await step(p, 2);
      await setClip(p, `${SB}\n${PUB}`); await p.click('#live-setup .walk-b button:has-text("붙여넣기")');
      const sb = await p.waitForFunction(() => /설치 SQL을 한 번 새로 넣어 주세요/.test(document.querySelector('#live-setup .live-note')?.textContent || ''), null, { timeout: 15000 }).then(() => true, () => false);
      ok('old supabase install + multi-day: note', sb);
      if (sb) {
        await p.click('#live-setup .live-note button:has-text("설치 SQL 복사")'); await p.waitForTimeout(600);
        const s2 = await clip(p);
        ok('upgrade SQL has no training line (admin key untouched)', /create schema if not exists lec_private/.test(s2) && !/^select lec_private\.init_training_hash\(/m.test(s2));
      }
    }
    console.log(w, 'errors', errs); await ctx.close();
  }
  await b.close();
})().catch((e) => { console.log('SCRIPT ERROR', e.stack || e); process.exit(1); });
