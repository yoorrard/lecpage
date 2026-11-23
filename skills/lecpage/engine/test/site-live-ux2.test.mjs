// 참가자·강사 화면 실측에서 고친 것(2026-11-23)을 실제 브라우저로 고정:
// '지금' 줄 [투표하기]가 보기를 가려지지 않는 곳에 보여 줌, 교재 전체 화면의 단추 색·이름과 그 안의 공지 띠,
// 강사 화면 출석 명단(좁은 칸에서 사람마다 세 줄, 여러 날 연수는 날짜를 골라 그 날의 시각을 고침, 강사가 적은 날만 표시),
// 출석 뒤 보드 별명을 서버가 거절하면 창 안 오류, 연수 날 전의 입실 확인, 보드 사진 보기.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { writeFiles } from '../node.js';
import { kitBuild } from './kit-site.mjs';
import { startNodeServer, api, LAN_ARGS, viaLan } from './live-helpers.mjs';

const require = createRequire(import.meta.url);
let chromium = null;
try { ({ chromium } = require('playwright')); } catch { try { ({ chromium } = createRequire('/opt/node-tools/')('playwright')); } catch { /* 없음 */ } }
const skip = !chromium && 'playwright is not installed';
const ADMIN = '실측-고침-시험용-관리자키-23';
// 날짜는 서버·강사 화면과 같은 기준(Asia/Seoul)
const kstDay = (ms) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);
const zoned = (day, hm) => Date.parse(`${day}T${hm}:00+09:00`);
const NOW = Date.now(), TODAY = kstDay(NOW), YEST = kstDay(NOW - 864e5), TOMO = kstDay(NOW + 864e5), LATER = kstDay(NOW + 10 * 864e5);
const day = (date) => ({ date, start: '00:00', end: '23:59' });
const build = (code, sessions) => kitBuild({ meta: { sessions }, prev: { live: { provider: 'http', url: '', code } }, today: TODAY }).files;

let srv, browser, site;
before(async () => {
  if (skip) return;
  site = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-live-ux2-'));
  srv = await startNodeServer({ adminKey: ADMIN, staticDir: site });
  writeFiles(site, build('UXTWO', [day(TODAY)]));
  writeFiles(path.join(site, 'days'), build('UXDAY', [day(YEST), day(TODAY), day(TOMO)]));
  writeFiles(path.join(site, 'early'), build('UXEARLY', [day(LATER)]));
  browser = await chromium.launch({ args: LAN_ARGS });
});
after(async () => { await browser?.close(); await srv?.close(); if (site) fs.rmSync(site, { recursive: true, force: true }); });

const A = (code = 'UXTWO') => api(srv.url, code);
const put = (body, code) => A(code).call('PUT', '/state', { admin: ADMIN, body });
async function page(url, { width = 390, height = 844, mobile = true, live = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile });
  const p = await ctx.newPage(); p._errs = []; p.on('pageerror', (e) => p._errs.push(String(e)));
  await p.goto(viaLan(srv.url) + url);
  if (live) await p.waitForFunction(() => document.querySelector('[data-live-status]')?.getAttribute('data-state') === 'live', null, { timeout: 15000 });
  return { ctx, p };
}
async function consolePage(dir = '', size = {}) {
  const { ctx, p } = await page(dir + '/console.html', { live: false, ...size });
  await p.fill('#lp-key', ADMIN); await p.click('[data-key-go]');
  await p.waitForSelector('[data-console-main]:not([hidden])'); await p.waitForTimeout(1200);
  return { ctx, p };
}

test('\'지금\' 줄 [투표하기]: 보기가 띠·막대에 가리지 않는 곳에 오고 첫 보기에 초점, 띠의 단추는 빠짐(좁고 낮은 화면)', { skip }, async () => {
  await put({ openPoll: '', notice: null, timer: null, slide: 0, ui: { reveal: null } });
  const { ctx, p } = await page('/', { width: 320, height: 568 });
  try {
    const ids = await p.evaluate(() => [...document.querySelectorAll('[data-poll]')].flatMap((n) => JSON.parse(n.getAttribute('data-poll') || '[]')).filter((x) => x.kind !== 'word' && (x.options || []).length).map((x) => x.id));
    assert.ok(ids.length, '보기가 있는 투표 문항');
    await p.evaluate(() => window.scrollTo(0, 0));
    await put({ openPoll: ids[0] });
    await p.waitForFunction(() => { const c = document.querySelector('[data-now-cta]'); return c && !c.hidden && /투표하기/.test(c.textContent); }, null, { timeout: 8000 });
    await p.click('[data-now-cta]'); await p.waitForTimeout(1600);
    const m = await p.evaluate(() => {
      const live = [...document.querySelectorAll('[data-poll-live]')].find((x) => x.querySelector('input,button'));
      const opts = [...live.querySelectorAll('input,button')].map((n) => (n.closest('label') || n).getBoundingClientRect());
      const cover = Math.min(...[document.querySelector('.lpk.lpk-now'), document.querySelector('[data-dock]')].filter(Boolean).map((n) => n.getBoundingClientRect()).filter((r) => r.height).map((r) => r.top));
      return { first: Math.round(opts[0].top), firstBottom: Math.round(opts[0].bottom), seen: opts.filter((r) => r.top >= 0 && r.bottom <= cover + 1).length, n: opts.length, cover: Math.round(cover), focusIn: live.contains(document.activeElement), cta: document.querySelector('[data-now-cta]').hidden };
    });
    assert.ok(m.first >= 0 && m.firstBottom <= m.cover, '첫 보기가 가려지지 않은 곳에 있음 ' + JSON.stringify(m));
    assert.ok(m.seen >= Math.min(3, m.n), '보기 대부분이 보임 ' + JSON.stringify(m));
    assert.equal(m.focusIn, true, '초점이 투표 칸 안');
    assert.equal(m.cta, true, '투표 칸을 보고 있으면 띠의 [투표하기]는 빠짐');
    assert.deepEqual(p._errs, []);
  } finally { await ctx.close(); await put({ openPoll: '' }); }
});

test('교재 전체 화면: 단추·쪽 번호가 어두운 바탕에서 보이는 색, 단추 이름은 \'전체 화면 끝내기\', 공지 띠가 그 안에 보이고(쪽 그림을 가리지 않음) 끝나면 제자리', { skip }, async () => {
  await put({ openPoll: '', notice: null, timer: null, slide: 0 });
  const { ctx, p } = await page('/', { width: 844, height: 390 });
  try {
    await p.evaluate(() => document.querySelector('[data-deck]').scrollIntoView({ block: 'center' }));
    const before = await p.textContent('[data-deck-full]');
    await p.click('[data-deck-full]');
    await p.waitForFunction(() => document.fullscreenElement && document.fullscreenElement.matches('[data-deck]'));
    await p.waitForTimeout(300);
    const lum = (rgb) => { const [r, g, b] = rgb.match(/[\d.]+/g).map(Number).map((v) => { v = v > 1 ? v / 255 : v; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const fs1 = await p.evaluate(() => { const d = document.fullscreenElement, b = d.querySelector('[data-deck-full]'), n = d.querySelector('.lp-slide-no'); return { text: b.textContent.trim(), btn: getComputedStyle(b).color, no: n ? getComputedStyle(n).color : '', labelShown: getComputedStyle(b.querySelector('span')).position }; });
    assert.equal(fs1.text, '전체 화면 끝내기');
    assert.equal(fs1.labelShown, 'static', '나가는 단추는 글자가 보임');
    assert.ok(lum(fs1.btn) > 0.6, '단추 글자가 밝음 ' + fs1.btn);
    // 공지 → 전체 화면 안에서 보이고 쪽 그림과 겹치지 않음
    await put({ notice: { text: '10분 쉬고 다시 시작해요.', level: 'info' } });
    await p.waitForFunction(() => { const n = document.querySelector('.lpk.lpk-now [data-now]'); return n && !n.hidden && /10분 쉬고/.test(n.textContent); }, null, { timeout: 8000 });
    await p.waitForTimeout(400);
    const fs2 = await p.evaluate(() => { const d = document.fullscreenElement, now = document.querySelector('.lpk.lpk-now'), r = now.getBoundingClientRect(), im = d.querySelector('.lp-slide.is-active img').getBoundingClientRect(), bar = d.querySelector('.lp-deck-bar').getBoundingClientRect(); return { inside: d.contains(now), bandBottom: r.bottom, imgTop: im.top, barBottom: bar.bottom, vh: innerHeight }; });
    assert.equal(fs2.inside, true, '띠가 전체 화면 요소 안에 있음');
    assert.ok(fs2.bandBottom <= fs2.imgTop + 1, '띠가 쪽 그림을 가리지 않음 ' + JSON.stringify(fs2));
    assert.ok(fs2.barBottom <= fs2.vh, '넘김 단추가 화면 안 ' + JSON.stringify(fs2));
    // 강사가 보는 쪽만 있을 때는 전체 화면에 띠를 띄우지 않음
    await put({ notice: null, slide: 2 });
    await p.waitForFunction(() => document.querySelector('.lpk.lpk-now [data-now]').hidden, null, { timeout: 8000 });
    await p.evaluate(() => document.exitFullscreen());
    await p.waitForFunction(() => !document.fullscreenElement);
    await p.waitForTimeout(300);
    const back = await p.evaluate(() => ({ text: document.querySelector('[data-deck-full]').textContent.trim(), inDeck: document.querySelector('[data-deck]').contains(document.querySelector('.lpk.lpk-now')), toastInDeck: document.querySelector('[data-deck]').contains(document.querySelector('[data-toast]')), now: !document.querySelector('.lpk.lpk-now [data-now]').hidden }));
    assert.deepEqual(back, { text: before.trim(), inDeck: false, toastInDeck: false, now: true }, '끝나면 단추 이름·띠·알림이 제자리(강사가 보는 쪽 줄도 다시 보임)');
    assert.deepEqual(p._errs, []);
  } finally { await ctx.close(); await put({ notice: null, slide: 0 }); }
});

test('강사 화면 출석 명단: 좁은 칸에서는 사람마다 세 줄(이름이 쪼개지지 않고 가로로 밀지 않음), 표 역할은 그대로, 고친 뒤 초점은 [고치기]로', { skip }, async () => {
  const call = A().call;
  for (const [nickname, name, school] of [['모둠장', '김하루', '새솔중'], ['긴소속', '남궁민수아리', '서울특별시교육청 미래교육연구정보원 융합교육지원부 정보교육팀']]) {
    const j = await call('POST', '/join', { body: { nickname, name, school, consent: true } });
    assert.equal((await call('POST', '/attendance', { token: j.body.token, body: { kind: 'in' } })).status, 201);
  }
  for (const size of [{ width: 390, height: 844 }, { width: 1280, height: 800, mobile: false }]) {
    const { ctx, p } = await consolePage('', size);
    try {
      await p.locator('section[data-area=att]').scrollIntoViewIfNeeded();
      const m = await p.evaluate(() => {
        const s = document.querySelector('section[data-area=att]'), wrap = s.querySelector('.lp-con-tbl-w'), tb = s.querySelector('table');
        const rows = [...tb.querySelectorAll('tbody tr')].map((tr) => { const th = tr.querySelector('th'); const r = th.getBoundingClientRect(); return { name: th.firstChild.textContent, lines: Math.round(r.height / (parseFloat(getComputedStyle(th).lineHeight) || 20)), btnRight: Math.max(...[...tr.querySelectorAll('button')].map((b) => b.getBoundingClientRect().right)) }; });
        return { display: getComputedStyle(tb).display, over: wrap.scrollWidth - wrap.clientWidth, rows, vw: innerWidth, roles: [tb.getAttribute('role'), tb.querySelector('tbody tr').getAttribute('role'), tb.querySelector('tbody th').getAttribute('role'), tb.querySelector('tbody td').getAttribute('role')].join(), docOver: document.scrollingElement.scrollWidth - innerWidth };
      });
      assert.equal(m.over, 0, `가로로 밀지 않음(${size.width}) ` + JSON.stringify(m));
      assert.ok(m.docOver <= 0, '화면 넘침 없음');
      assert.equal(m.roles, 'table,row,rowheader,cell');
      for (const r of m.rows) { assert.equal(r.lines, 1, '이름이 한 줄 ' + JSON.stringify(r)); assert.ok(r.btnRight <= m.vw, '단추가 화면 안 ' + JSON.stringify(r)); }
      if (size.width === 390) {
        assert.equal(m.display, 'block', '좁은 칸에서는 표 대신 줄 묶음');
        const row = p.locator('section[data-area=att] tbody tr', { hasText: '김하루' }).first();
        await row.locator('button', { hasText: '고치기' }).click();
        await p.locator('tr.lp-con-edit button[type=submit]').click(); await p.waitForTimeout(700);
        assert.equal(await p.evaluate(() => (document.activeElement?.getAttribute('data-k') || '').slice(0, 3)), 'aed', '고친 뒤 초점은 그 사람의 [고치기]');
      }
      assert.deepEqual(p._errs, []);
    } finally { await ctx.close(); }
  }
});

test('여러 날 연수: 강사 화면에서 날짜를 골라 지난 날의 빠진 퇴실을 적으면 그 날에 저장되고, 강사가 적은 날만 표시되며, 한 날만 지우기는 막고 까닭을 알림', { skip }, async () => {
  const call = A('UXDAY').call;
  const pr = await call('POST', '/participants', { admin: ADMIN, body: { name: '박이틀', school: '한빛초', consent: true } });
  assert.equal(pr.status, 201);
  assert.equal((await call('POST', '/attendance', { admin: ADMIN, body: { by: pr.body.id, kind: 'in', at: zoned(YEST, '09:00') } })).status, 201);
  const j = await call('POST', '/join', { body: { nickname: '오늘이', name: '오늘이', school: '새솔중', consent: true } });
  assert.equal((await call('POST', '/attendance', { token: j.body.token, body: { kind: 'in' } })).status, 201);
  const { ctx, p } = await consolePage('/days');
  try {
    const sec = p.locator('section[data-area=att]'); await sec.scrollIntoViewIfNeeded();
    const sel = sec.locator('select[aria-label="명단을 볼 날짜"]');
    assert.equal(await sel.inputValue(), TODAY, '기본은 오늘');
    assert.deepEqual(await sel.evaluate((s) => [...s.options].map((o) => o.value)), [YEST, TODAY, TOMO]);
    const row = (name) => sec.locator('tbody tr', { hasText: name }).first();
    await sel.selectOption(YEST); await p.waitForTimeout(300);
    assert.deepEqual(await row('박이틀').locator('button').allTextContents(), ['고치기'], '지난 날에는 지금 시각으로 적는 [입실]·[퇴실]이 없음');
    await row('박이틀').locator('button', { hasText: '고치기' }).click();
    const ed = sec.locator('tr.lp-con-edit');
    assert.equal(await ed.locator('input[type=time]').nth(0).inputValue(), '09:00');
    await ed.locator('input[type=time]').nth(1).fill('10:00');
    await ed.locator('button[type=submit]').click(); await p.waitForTimeout(900);
    assert.equal(await row('박이틀').locator('.lp-con-at').nth(1).getAttribute('title'), '강사가 적은 시각');
    // 오늘 스스로 입실한 사람의 어제 입실을 강사가 적음 → 어제만 강사 표시, 오늘 입실은 표시 없음
    await row('오늘이').locator('button', { hasText: '고치기' }).click();
    await sec.locator('tr.lp-con-edit input[type=time]').nth(0).fill('09:10');
    await sec.locator('tr.lp-con-edit button[type=submit]').click(); await p.waitForTimeout(900);
    assert.equal(await row('오늘이').locator('.lp-con-at').nth(0).getAttribute('title'), '강사가 적은 시각');
    // 어제 것만 지우기: 다른 날 기록이 함께 있어 막음
    await row('오늘이').locator('button', { hasText: '고치기' }).click();
    await sec.locator('tr.lp-con-edit input[type=time]').nth(0).fill('');
    await sec.locator('tr.lp-con-edit button[type=submit]').click(); await p.waitForTimeout(700);
    assert.match(await p.textContent('[data-toast]'), /이 날만 지울 수 없어요/);
    await sec.locator('tr.lp-con-edit').locator('xpath=preceding-sibling::tr[1]').locator('button', { hasText: '닫기' }).click().catch(() => {});
    await sel.selectOption(TODAY); await p.waitForTimeout(300);
    assert.equal(await row('오늘이').locator('.lp-con-at').nth(0).getAttribute('title'), null, '오늘 스스로 누른 입실은 강사 표시가 아님');
    const got = (await call('GET', '/attendance', { admin: ADMIN })).body, items = Array.isArray(got) ? got : got.items || [];
    const of = (by, kind) => items.find((a) => a.by === by && a.kind === kind);
    const out = of(pr.body.id, 'out');
    assert.deepEqual(Object.keys(out.days), [YEST], '퇴실은 어제에 저장');
    assert.equal(out.days[YEST], zoned(YEST, '10:00'));
    assert.deepEqual(Object.keys(out.hostDays), [YEST]);
    const inn = of(j.body.id, 'in');
    assert.deepEqual(Object.keys(inn.days).sort(), [YEST, TODAY]);
    assert.deepEqual(Object.keys(inn.hostDays), [YEST], '강사가 적은 날만');
    assert.deepEqual(p._errs, []);
  } finally { await ctx.close(); }
});

test('출석 뒤 보드 별명을 서버가 거절하면 창 안에 오류가 나오고 닫히지 않음, 올린 사진은 누르면 크게(새 탭), 강사 화면에서도 보임', { skip }, async () => {
  const { ctx, p } = await page('/');
  try {
    await p.locator('button[data-attend="in"]').first().click();
    const dlg = p.locator('[data-join-dialog]');
    await dlg.locator('input[name=name]').fill('김보드'); if (await dlg.locator('input[name=school]').count()) await dlg.locator('input[name=school]').fill('한빛초');
    await dlg.locator('input[name=consent]').check(); await p.click('[data-join-go]'); await p.waitForTimeout(800);
    const bw = p.locator('[data-board-write]');
    assert.equal(await bw.getAttribute('aria-expanded'), 'false');
    await bw.click(); await p.waitForTimeout(400);
    await dlg.locator('input[name=nickname]').fill('강사'); await p.click('[data-join-go]'); await p.waitForTimeout(800);
    assert.equal(await dlg.evaluate((d) => d.open), true, '창이 닫히지 않음');
    assert.match(await dlg.locator('[data-join-err]').textContent(), /쓸 수 없어요/);
    await dlg.locator('input[name=nickname]').fill('보드맨'); await p.click('[data-join-go]'); await p.waitForTimeout(800);
    assert.equal(await bw.getAttribute('aria-expanded'), 'true');
    const form = p.locator('[data-board-form]');
    await form.locator('textarea').fill('사진 올리기');
    // 올릴 사진은 브라우저에서 바로 그림(런타임이 올리기 전에 줄여 다시 그리므로 제대로 된 그림이어야 함)
    const png = Buffer.from((await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 64; c.height = 48; const x = c.getContext('2d'); x.fillStyle = '#c33'; x.fillRect(0, 0, 64, 48); return c.toDataURL('image/png'); })).split(',')[1], 'base64');
    const fi = form.locator('input[type=file]');
    if (await fi.count()) await fi.setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: png });
    await form.locator('button[type=submit]').click();
    await p.waitForFunction(() => /사진 올리기/.test(document.querySelector('[data-board]')?.textContent || ''), null, { timeout: 8000 }).catch(async () => { throw new Error('글이 올라오지 않음: ' + await p.evaluate(() => (document.querySelector('[data-toast]')?.textContent || '') + ' | ' + (document.querySelector('[data-board]')?.textContent || '').replace(/\s+/g, ' ').slice(0, 200))); });
    assert.equal(await bw.getAttribute('aria-expanded'), 'false');
    if (await fi.count()) {
      const a = p.locator('.lp-post-files a.lp-post-img').first();
      assert.equal(await a.getAttribute('target'), '_blank');
      assert.match(await a.getAttribute('aria-label'), /사진 크게 보기/);
      const c = await consolePage('');
      try {
        const con = await c.p.evaluate(() => { const a = document.querySelector('.lp-con-files a'), im = a && a.querySelector('img'); return { href: !!(a && /^https?:/.test(a.href)), target: a && a.target, alt: im ? im.alt : '' }; });
        assert.deepEqual({ href: con.href, target: con.target }, { href: true, target: '_blank' });
        assert.match(con.alt, /보드맨 님이 올린 사진 1 크게 보기/);
        assert.deepEqual(c.p._errs, []);
      } finally { await c.ctx.close(); }
    }
    assert.deepEqual(p._errs, []);
  } finally { await ctx.close(); }
});

test('연수 날이 오기 전: 출석 칸에 연수 날을 알리고, 누르면 한 번 확인(취소하면 기록하지 않음, 확인하면 그대로 입실)', { skip }, async () => {
  const { ctx, p } = await page('/early/');
  try {
    const d = new Date(LATER + 'T00:00:00+09:00'), want = `${+LATER.slice(5, 7)}월 ${+LATER.slice(8, 10)}일`;
    assert.ok(d, want);
    assert.match(await p.locator('[data-attend-state]').first().textContent(), new RegExp(`연수 날은 ${want}이에요\\. 그날 눌러 주세요\\.`));
    const asked = []; let answer = false;
    p.on('dialog', (dl) => { asked.push(dl.message()); answer ? dl.accept() : dl.dismiss(); });
    await p.locator('button[data-attend="in"]').first().click(); await p.waitForTimeout(600);
    assert.equal(asked.length, 1); assert.match(asked[0], new RegExp(`연수 날은 ${want}이에요\\. 그래도 지금 입실을 기록할까요\\?`));
    assert.equal(await p.locator('[data-join-dialog]').evaluate((x) => x.open), false, '취소하면 아무 일도 없음');
    answer = true;
    await p.locator('button[data-attend="in"]').first().click(); await p.waitForTimeout(600);
    assert.equal(await p.locator('[data-join-dialog]').evaluate((x) => x.open), true, '확인하면 입실 창');
    assert.deepEqual(p._errs, []);
  } finally { await ctx.close(); }
});
