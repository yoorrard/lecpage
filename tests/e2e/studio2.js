// 2. 만들기·수정 한 화면 e2e(가짜 AI): 만들기 → 한 화면에서 AI로 세 번 이어서 수정(대화가 남고 새로 고쳐도 이어짐)
// → 연수 정보의 날짜 바꾸기(사이트 글·발표 화면·QR 안내문·일정 파일) → 버전 기록(새것이 앞, 바뀔 때마다)과 복원
// → 자료 2개 추가(사이트 자료실) → 배포(가짜 Vercel)한 사이트에 다운로드 링크와 파일. 1280·390 화면 그림
const L = require('./lib.js');
const H = require('./h2.js');
const OUT = process.env.OUT || L.OUT;
const noScroll = async (p, where) => L.ok(`${where}: no horizontal page scroll`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), String(await p.evaluate(() => document.documentElement.scrollWidth)));
const REQS = ['첫 번째 요청: 제목을 짧게', '두 번째 요청: 실습 안내를 친절하게', '세 번째 요청: 마무리 인사 넣기'];

async function build(b, w, h) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(L.BASE).origin });
  const st = await H.mockAll(ctx);
  await L.mockAi(ctx, null, { fallback: true });
  const p = await ctx.newPage(); const errs = L.watch(p);
  await L.startWithFile(p);
  await L.connectAi(p);
  await L.waitStudio(p, 90000);
  return { ctx, st, p, errs, pid: L.pidOf(p) };
}
async function sendEdit(p, text) {
  await p.fill('.st-compose textarea', text);
  await p.click('.st-compose button:has-text("보내기")');
  await p.waitForSelector('.st-bubble.is-working', { timeout: 10000 });
  await p.waitForSelector('.st-bubble.is-working', { state: 'detached', timeout: 40000 });
  await p.waitForFunction((n) => document.querySelectorAll('.st-log .st-msg.is-ai').length >= n, REQS.indexOf(text) + 1, { timeout: 15000 });
  await p.waitForTimeout(600);
}

(async () => {
  const b = await L.chromium.launch();
  // ── 1280: 전체 흐름 ──
  const { ctx, st, p, errs, pid } = await build(b, 1280, 860);
  L.ok('one screen: preview + panel side by side, no tabs', await p.locator('[role=tablist]').count() === 0 && await p.evaluate(() => { const a = document.querySelector('.st .preview').getBoundingClientRect(), c = document.querySelector('.st-panel').getBoundingClientRect(); return a.right <= c.left + 1 && a.width > c.width; }));
  L.ok('one screen: info · files · sections · chat in one panel, composer pinned', await p.locator('.st-scroll .st-info').count() === 1 && await p.locator('.st-scroll .st-files').count() === 1 && await p.locator('.st-scroll .st-fold').count() === 2 && await p.locator('.st-scroll .st-chat').count() === 1 && await p.locator('.st-composer .st-compose textarea').count() === 1);
  await p.click('.st-info button:has-text("이 정보가 맞아요")');
  await noScroll(p, 'studio 1280');
  await p.screenshot({ path: OUT + '1280-01-studio.png' });
  // AI로 세 번 이어서
  for (const r of REQS) await sendEdit(p, r);
  let pr = await L.readProject(p, pid);
  L.ok('chat: 3 requests + 3 replies kept in order', (pr.chat || []).map((m) => m.role).join() === 'user,ai,user,ai,user,ai' && pr.chat[4].text === REQS[2], JSON.stringify((pr.chat || []).map((m) => m.role)));
  const vOf = (m) => (pr.versions || []).find((v) => v.id === m.versionId);
  L.ok('chat: each edit applied (its version has its change, latest is the site)', pr.chat.filter((m) => m.role === 'ai').every((m, i) => vOf(m)?.site['index.html'].includes('요청 반영: ' + REQS[i])) && pr.site['index.html'].includes('요청 반영: ' + REQS[2]));
  L.ok('chat: replies link a version and changed section', pr.chat.filter((m) => m.role === 'ai').every((m) => m.versionId && (pr.versions || []).some((v) => v.id === m.versionId)) && /첫 화면/.test(await p.locator('.st-msg.is-ai').last().innerText()));
  L.ok('chat: composer cleared and ready for the next edit', (await p.inputValue('.st-compose textarea')) === '' && !(await p.locator('.st-compose textarea').isDisabled()));
  await p.screenshot({ path: OUT + '1280-02-chat.png' });
  await p.reload({ waitUntil: 'load' }); await L.waitStudio(p);
  L.ok('chat: history survives refresh', await p.locator('.st-log .st-msg').count() === 6 && /세 번째 요청/.test(await p.locator('.st-log').innerText()));
  // 연수 정보: 날짜
  await p.click('.st-info .st-card-h button:has-text("수정")');
  await p.fill('.st-info-form input[type=date]', '2026-12-22'); await p.waitForTimeout(1500);
  pr = await L.readProject(p, pid);
  const idx = pr.site['index.html'];
  L.ok('date: meta changed', pr.meta.sessions?.[0]?.date === '2026-12-22', JSON.stringify(pr.meta.sessions));
  L.ok('date: same date in site text changed (format kept, weekday fixed)', /2026년 12월 22일\(화\)/.test(idx) && !/12월 3일/.test(idx), (idx.match(/2026년 12월 \d+일[^<]{0,6}/g) || []).join(' | '));
  await p.click('.st-info .st-card-h button:has-text("접기")');
  L.ok('date: summary line shows new date', /12월 22일\(화\)/.test(await p.locator('.st-info').innerText()));
  const frame = p.frameLocator('.pv-device iframe');
  for (const [pg, name] of [['screen.html', 'presenter'], ['poster.html', 'poster'], ['console.html', 'console']]) {
    await p.selectOption('.pv-page select', pg); await p.waitForTimeout(1300);
    const t = await frame.locator('html').evaluate((el) => el.outerHTML);
    L.ok(`date: ${name} screen uses new date`, /2026-12-22|12월 22일/.test(t) && !/2026-12-03|12월 3일/.test(t), (t.match(/2026-12-\d\d|12월 \d+일/g) || []).slice(0, 4).join(','));
  }
  await p.selectOption('.pv-page select', 'index.html'); await p.waitForTimeout(800);
  // 버전 기록: 새것이 앞, AI 수정·연수 정보 수정이 모두
  await p.click('.head-tools button:has-text("버전 기록")'); await p.waitForSelector('dialog[open] .versions li');
  const labels = await p.locator('dialog[open] .versions li .ver-t b').allInnerTexts();
  L.ok('versions: every change, newest first', /연수 정보 수정 · 날짜/.test(labels[0]) && labels[1].includes('세 번째') && labels[2].includes('두 번째') && labels[3].includes('첫 번째') && labels.some((x) => /AI가 만든 버전/.test(x)), labels.join(' | '));
  L.ok('versions: top marked as current', /지금 버전/.test(await p.locator('dialog[open] .versions li').first().innerText()));
  const ats = await p.evaluate((id) => new Promise((res) => { const q = indexedDB.open('lecpage'); q.onsuccess = () => { const t = q.result.transaction('projects').objectStore('projects').get(id); t.onsuccess = () => res((t.result.versions || []).map((v) => v.at)); }; }), pid);
  L.ok('versions: times in order', ats.every((a, i) => i === 0 || ats[i - 1] >= a), ats.join(','));
  await p.screenshot({ path: OUT + '1280-03-versions.png' });
  await p.locator('dialog[open] .versions li').nth(2).locator('button:has-text("이 버전으로 복원")').click(); await p.waitForTimeout(900);
  pr = await L.readProject(p, pid);
  L.ok('restore: older version back (2nd edit, old date)', pr.site['index.html'].includes(REQS[1]) && !pr.site['index.html'].includes(REQS[2]) && pr.meta.sessions[0].date === '2026-12-03');
  L.ok('restore: recorded as a new version on top', /^복원 · AI로 수정 · 두 번째/.test(pr.versions[0].label) && pr.versions.length >= 6, pr.versions.map((v) => v.label).join(' | '));
  await p.click('.head-tools button:has-text("버전 기록")'); await p.waitForSelector('dialog[open] .versions li');
  await p.locator('dialog[open] .versions li').nth(1).locator('button:has-text("이 버전으로 복원")').click(); await p.waitForTimeout(900);
  pr = await L.readProject(p, pid);
  L.ok('restore: back to latest (3rd edit + new date)', pr.site['index.html'].includes(REQS[2]) && pr.meta.sessions[0].date === '2026-12-22' && /2026년 12월 22일/.test(pr.site['index.html']));
  // 자료 2개
  // 한글 이름 파일은 메모리에서(이 환경의 Chromium은 한글 경로 파일 고르기를 넘기지 못함)
  await p.setInputFiles('.st-files input[type=file]', [{ name: '활동지 1.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% e2e\n') }, { name: '참고 자료.hwpx', mimeType: 'application/octet-stream', buffer: Buffer.from('PK\u0003\u0004hwpx-e2e') }]);
  await p.waitForTimeout(1200);
  pr = await L.readProject(p, pid);
  L.ok('files: two added to the list (name, size, order)', (pr.materials || []).map((m) => m.href).join() === 'files/활동지 1.pdf,files/참고 자료.hwpx' && await p.locator('.st-files-list li').count() === 2, JSON.stringify(pr.materials));
  await p.click('.st-file-name >> nth=1'); await p.fill('.st-file-edit input[aria-label="자료 설명"]', '실습 2에서 써요'); await p.click('.st-file-edit button:has-text("저장")');
  await p.click('.st-files-list li >> nth=1 >> button[aria-label$="위로"]'); await p.waitForTimeout(1500);
  pr = await L.readProject(p, pid);
  L.ok('files: description + reorder saved', pr.materials[0].title === '참고 자료' && pr.materials[0].desc === '실습 2에서 써요');
  const mats = await frame.locator('#lpk-files .lp-materials li, [data-lpk="materials"] .lp-materials li').allInnerTexts();
  L.ok('files: site shows a downloads section with both', mats.length === 2 && /참고 자료/.test(mats[0]) && /실습 2에서 써요/.test(mats[0]) && /활동지 1/.test(mats[1]), mats.join(' | '));
  await p.screenshot({ path: OUT + '1280-04-files.png' });
  // 배포(가짜 Vercel)
  await p.click('.head-tools button:has-text("배포하기")');
  await p.waitForSelector('.publish', { timeout: 20000 });
  if (!(await p.locator('.publish .conn-line').count())) {
    await p.locator('.pub-opt:has-text("Vercel"), .pub-pick button:has-text("Vercel")').first().click().catch(() => {});
    await p.click('.publish .walk-b button:has-text("이미 가입했어요")').catch(() => {});
    await H.connect(p, 'vcp_FAKE_TOKEN_1234567890');
    await p.waitForSelector('.publish .conn-line', { timeout: 15000 });
  }
  await p.fill('.publish .addr-name input', 'studio-two').catch(() => {});
  await H.publish(p);
  await p.waitForSelector('.success .big-url', { timeout: 60000 });
  const files = (st.deployBody?.files || []).map((f) => f.file);
  const site = st.site['index.html'] ? st.site['index.html'].toString() : '';
  L.ok('deploy: files uploaded with the site', files.includes('files/활동지 1.pdf') && files.includes('files/참고 자료.hwpx'), files.filter((f) => f.startsWith('files/')).join(','));
  L.ok('deploy: downloads section links both files', /href="files\/참고%20자료\.hwpx" download/.test(site) && /href="files\/활동지%201\.pdf" download/.test(site), (site.match(/href="files\/[^"]+"/g) || []).join(','));
  const ics = st.site['assets/event.ics'] ? st.site['assets/event.ics'].toString() : '';
  L.ok('deploy: calendar file has the new date', /DTSTART[^:\n]*:20261222/.test(ics), (ics.match(/DTSTART[^\n]*/) || [''])[0]);
  L.ok('deploy: site text has the new date', /2026년 12월 22일/.test(site));
  // 미리보기에서 강사 화면을 열면 Chromium이 틀 안 자동 초점을 막았다고 알림(사이트 문제 아님)
  const real = errs.filter((e) => !/Blocked autofocusing/.test(e));
  L.ok('1280: no page errors', real.length === 0, JSON.stringify(real));
  await ctx.close();

  // ── 390: 같은 흐름이 한 줄로 + [수정 | 미리보기] ──
  const m = await build(b, 390, 844);
  const q = m.p;
  L.ok('390: edit view first (panel), preview hidden', await q.locator('.st-panel').isVisible() && !(await q.locator('.st .preview').isVisible()));
  await noScroll(q, 'studio 390');
  await q.screenshot({ path: OUT + '390-01-edit.png' });
  await q.click('.st-info button:has-text("이 정보가 맞아요")');
  await sendEdit(q, REQS[0]);
  L.ok('390: composer pinned at bottom of screen', await q.evaluate(() => { const r = document.querySelector('.st-composer').getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.top > innerHeight / 2; }));
  await q.screenshot({ path: OUT + '390-02-chat.png' });
  await q.click('.st-switch button:has-text("미리보기")');
  await q.waitForSelector('.pv-device iframe', { timeout: 20000 }); await q.waitForTimeout(1200);
  L.ok('390: preview toggle shows the site', await q.locator('.st .preview').isVisible() && !(await q.locator('.st-panel').isVisible()));
  await noScroll(q, 'preview 390');
  await q.screenshot({ path: OUT + '390-03-preview.png' });
  await q.click('.st-switch button:has-text("수정")');
  await q.screenshot({ path: OUT + '390-04-full.png', fullPage: true });
  L.ok('390: no page errors', m.errs.length === 0, JSON.stringify(m.errs));
  await b.close();
  process.exit(L.summary() ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
