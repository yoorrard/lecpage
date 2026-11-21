// 2. 만들기·수정의 직접 수정 e2e(가짜 AI): 연수 정보 속성 줄(눌러서 바로 고침, Esc 취소, 일시 칸, 강사·주최)
// → 사이트 구성(섹션 목록: 펼치기·눈·두 번 눌러 이름·Alt+↓·끌기) → 항목 설정(투표 질문·보기 추가·순서·정답, 실습 단계 이름·시간, 보드 안내 글)
// → [＋ 기능 넣기](투표)·이름표 삭제(질문) → 실행 취소 → 미리보기와 서로 가리킴(줄에 올리면 테두리, 미리보기를 누르면 그 줄) → 축(axe) · 1280·390 그림
const L = require('./lib.js');
const OUT = process.env.OUT || L.OUT;
let axeSrc = '';
try { axeSrc = L.fs.readFileSync(process.env.AXE || require.resolve('axe-core/axe.min.js'), 'utf8'); } catch { console.log('NOTE: axe-core를 찾지 못해 접근성 검사는 건너뜀(AXE=…/axe.min.js)'); }
const noScroll = async (p, where) => L.ok(`${where}: no horizontal page scroll`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), String(await p.evaluate(() => document.documentElement.scrollWidth)));
async function axe(p, label) {
  if (!axeSrc) return;
  await p.addScriptTag({ content: axeSrc });
  const v = await p.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] }, resultTypes: ['violations'], exclude: [['iframe']] })).violations.map((x) => `${x.id}(${x.nodes.length}): ${x.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`));
  L.ok(`axe: ${label}`, v.length === 0, v.join(' ; '));
}
async function build(b, w, h) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await L.mockAi(ctx, null, { fallback: true });
  const p = await ctx.newPage(); const errs = L.watch(p);
  await L.startWithFile(p);
  await L.connectAi(p);
  await L.waitStudio(p, 90000, { folds: false });
  // 처음에는 연수 정보·사이트 구성·자료·색·글꼴이 접혀 있고 AI 수정 대화가 보임. 접힌 줄에도 요약과 [이 정보가 맞아요]
  const folds = await p.$$eval('.st-panel .st-fold-t', (b) => b.map((x) => [x.getAttribute('aria-expanded'), x.querySelector('.st-fold-s')?.textContent || '']));
  L.ok(`[${w}] folds: 4 sections start folded with a summary`, folds.length === 4 && folds.every(([e, sum]) => e === 'false' && sum.length > 0), JSON.stringify(folds).slice(0, 160));
  L.ok(`[${w}] folds: confirm button visible while folded`, await p.locator('.st-info button:has-text("이 정보가 맞아요")').isVisible());
  L.ok(`[${w}] folds: chat composer visible`, w < 960 || await p.locator('.st-composer textarea').isVisible());
  // 미리보기에서 섹션을 누르면 사이트 구성이 저절로 펼쳐짐
  if (w > 960) {
    await p.frameLocator('.pv-device iframe').locator('section').first().click({ position: { x: 20, y: 20 } }).catch(() => { });
    await p.waitForTimeout(500);
    L.ok(`[${w}] folds: picking in the preview opens 사이트 구성`, await p.getAttribute('#st-outline-h .st-fold-t', 'aria-expanded') === 'true');
  }
  await L.openFolds(p);
  // 펼친 칸은 이 탭에서 기억(새로 고쳐도 펼친 채)
  await p.reload({ waitUntil: 'load' }); await L.waitStudio(p, 90000, { folds: false });
  L.ok(`[${w}] folds: opened sections stay open after reload`, await p.locator('.st-panel .st-fold-t[aria-expanded="false"]').count() === 0);
  return { ctx, p, errs, pid: L.pidOf(p) };
}
const html = async (p, pid) => (await L.readProject(p, pid)).site['index.html'];
const sec = (id) => `.st-outline .sec2[data-sec="${id}"]`;
const shot = async (p, name, o = {}) => { if (!o.fullPage && p.viewportSize().width > 960) await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(150); await p.screenshot({ path: OUT + name, ...o }); };

(async () => {
  const b = await L.chromium.launch();
  const { ctx, p, errs, pid } = await build(b, 1280, 860);
  const frame = p.frameLocator('.pv-device iframe');
  await shot(p, '1280-01-panel.png');
  // ── 연수 정보: 속성 줄 ──
  // 확인 전에는 [이 정보가 맞아요]가 머리 줄 바로 아래(머리 줄은 접기 버튼 하나라 요약이 다 보임)
  L.ok('info: rows shown when opened, one fold toggle in the header + confirm right below', await p.locator('.st-info .prop').count() >= 4 && await p.locator('.st-info .st-card-h button').count() === 1 && await p.locator('.st-info .st-card-h .st-fold-t').count() === 1 && await p.locator('.st-info > .confirm-bar button:has-text("이 정보가 맞아요")').isVisible());
  L.ok('info: found-in-textbook hint shown before confirming', /쪽에서 찾았어요/.test(await p.locator('.st-info').innerText()));
  const venue0 = await p.inputValue('#prop-venue');
  await p.click('#prop-venue'); await p.fill('#prop-venue', '아무 데나'); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  L.ok('info: Esc cancels', (await L.readProject(p, pid)).meta.venue === venue0 && await p.inputValue('#prop-venue') === venue0, venue0);
  await p.click('#prop-venue'); await p.fill('#prop-venue', '본청 5층 강당'); await p.keyboard.press('Enter'); await p.waitForTimeout(700);
  let pr = await L.readProject(p, pid);
  L.ok('info: venue saved on Enter + same text in site', pr.meta.venue === '본청 5층 강당' && pr.site['index.html'].includes('본청 5층 강당') && !pr.site['index.html'].includes(venue0), venue0);
  const title0 = await p.inputValue('#prop-title');
  await p.fill('#prop-title', ''); await p.keyboard.press('Tab'); await p.waitForTimeout(400);
  L.ok('info: empty title is not saved and the field shows the title again', (await L.readProject(p, pid)).meta.title === title0 && await p.inputValue('#prop-title') === title0, title0);
  await p.click('.st-info [data-k="when-0"] .prop-v');
  await p.fill('.st-info .prop-when input[type=date]', '2026-12-10'); await p.keyboard.press('Enter'); await p.waitForTimeout(700);
  pr = await L.readProject(p, pid);
  L.ok('info: date typed then Enter at once still saved (closes editor)', pr.meta.sessions?.[0]?.date === '2026-12-10' && /2026년 12월 10일\(목\)/.test(pr.site['index.html']) && await p.locator('.st-info .prop-when').count() === 0, JSON.stringify(pr.meta.sessions));
  L.ok('info: when row shows new date, focus back on it', /12월 10일\(목\)/.test(await p.locator('.st-info [data-k="when-0"]').innerText()) && await p.evaluate(() => !!document.activeElement?.closest('[data-k="when-0"]')));
  await p.fill('.st-info [data-k="inst-0"] input[aria-label$="소속"]', '한빛중학교'); await p.keyboard.press('Tab'); await p.waitForTimeout(600);
  pr = await L.readProject(p, pid);
  L.ok('info: instructor org edited in place', pr.meta.instructors?.[0]?.org === '한빛중학교', JSON.stringify(pr.meta.instructors));
  await p.click('.st-info .prop-more');
  await p.waitForTimeout(200);
  L.ok('info: optional rows appear with focus', await p.locator('.st-info [data-k="organizer"]').count() === 1 && await p.evaluate(() => document.activeElement?.classList.contains('prop-in')), await p.evaluate(() => document.activeElement?.outerHTML.slice(0, 120)));
  await p.fill('#prop-organizer', 'OO교육청'); await p.keyboard.press('Tab'); await p.waitForTimeout(600);
  L.ok('info: organizer saved', (await L.readProject(p, pid)).meta.organizer === 'OO교육청');
  await p.click('.st-info button:has-text("이 정보가 맞아요")');
  await p.waitForTimeout(300);
  L.ok('info: confirmed, hints hidden, rows stay', await p.locator('.st-info.is-todo').count() === 0 && !/쪽에서 찾았어요/.test(await p.locator('.st-info').innerText()) && await p.locator('.st-info .prop').count() >= 4, (await p.locator('.st-info').innerText()).replace(/\n/g, ' | '));

  await p.evaluate(() => { document.querySelector('.st-scroll').scrollTop = 0; });
  await shot(p, '1280-01b-confirmed.png');
  // ── 사이트 구성: 섹션 ──
  await p.locator('.st-outline').scrollIntoViewIfNeeded();
  const names = () => p.locator('.st-outline .sec2-name .ttl').allInnerTexts();
  const n0 = await names();
  L.ok('outline: sections listed, collapsed, with item summary', n0.length === 7 && await p.locator('.st-outline .kit-list').count() === 0 && /투표/.test(await p.locator(sec('share')).innerText()), n0.join(','));
  await p.hover(`${sec('concepts')} .sec2-name`); await p.waitForTimeout(250);
  L.ok('outline: hovering a row outlines that section in the preview', await frame.locator('[data-lp-hl]').getAttribute('data-lps') === 'concepts');
  await shot(p, '1280-02-hover.png');
  await p.click(`${sec('practice')} .sec2-name`);
  await frame.locator('[data-lps="practice"]').evaluate((el) => new Promise((ok) => { let n = 0; const t = setInterval(() => { if (Math.abs(el.getBoundingClientRect().top) < 40 || ++n > 40) { clearInterval(t); ok(); } }, 50); }));
  L.ok('outline: clicking a row selects it and scrolls the preview there', await p.locator(`${sec('practice')}.is-sel`).count() === 1 && await frame.locator('[data-lps="practice"]').evaluate((el) => Math.abs(el.getBoundingClientRect().top) < 40), String(await frame.locator('[data-lps="practice"]').evaluate((el) => el.getBoundingClientRect().top)) + ' ' + await p.evaluate(() => [...document.querySelectorAll('.st-outline .is-sel')].map((e) => e.className + ' ' + (e.dataset.sec || e.dataset.item)).join(';')));
  await p.click(`${sec('practice')} .sec2-tw`);
  // 눈 버튼
  await p.click(`${sec('concepts')} .sec2-eye`); await p.waitForTimeout(500);
  L.ok('outline: eye hides the section', /<section id="concepts"[^>]*hidden/.test(await html(p, pid)) && await p.getAttribute(`${sec('concepts')} .sec2-eye`, 'aria-pressed') === 'true');
  await p.click(`${sec('concepts')} .sec2-eye`); await p.waitForTimeout(500);
  // 두 번 눌러 이름 바꾸기
  await p.dblclick(`${sec('deck')} .sec2-name`); await p.fill(`${sec('deck')} .sec2-rename input`, '교재 넘겨 보기'); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  L.ok('outline: double-click renames (heading + data-title)', /<section id="deck" data-title="교재 넘겨 보기">[\s\S]*?<h2>교재 넘겨 보기<\/h2>/.test(await html(p, pid)));
  L.ok('outline: focus back on the renamed row', await p.evaluate(() => document.activeElement?.closest('.sec2')?.dataset.sec) === 'deck');
  // 키보드: Alt+↓
  await p.focus(`${sec('flow')} .sec2-name`); await p.keyboard.press('Alt+ArrowDown'); await p.waitForTimeout(400);
  const n1 = await names();
  L.ok('outline: Alt+Down moves the section, focus follows', n1[2] === n0[1] && await p.evaluate(() => document.activeElement?.closest('.sec2')?.dataset.sec) === 'flow', n1.join(','));
  await p.keyboard.press('Alt+ArrowUp'); await p.waitForTimeout(400);
  // F2 → Esc 취소
  await p.keyboard.press('F2'); await p.waitForSelector('.sec2-rename input:focus'); await p.keyboard.type('xx'); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  L.ok('outline: F2 rename, Esc cancels', (await names())[1] === n0[1] && await p.locator('.sec2-rename').count() === 0, (await names()).join(','));

  // ── 항목: 투표 ──
  await p.click(`${sec('share')} .sec2-tw`);
  L.ok('items: expanding a section lists its items (poll row + qa chip + add)', await p.locator(`${sec('share')} .kit-row`).count() === 1 && /질문/.test(await p.locator(`${sec('share')} .kit-chips`).innerText()) && await p.locator(`${sec('share')} .kit-add`).count() === 1);
  await p.evaluate(() => scrollTo(0, 0));
  await p.click(`${sec('share')} .kit-row`); await p.waitForTimeout(300);
  L.ok('items: opening a form scrolls only the panel, not the page', await p.evaluate(() => scrollY) === 0, String(await p.evaluate(() => scrollY)));
  const form = `${sec('share')} .kit-form`;
  L.ok('items: poll form shows question, options, answer', await p.inputValue(`${form} input >> nth=0`) === 'AI로 가장 먼저 만들어 보고 싶은 자료는?' && await p.locator(`${form} .lr-row`).count() === 4);
  await p.fill(`${form} label:has-text("질문") input`, '가장 먼저 만들 자료는?');
  await p.click(`${form} .lr-add`); await p.fill(`${form} input[aria-label="보기 5"]`, '퀴즈');
  await p.click(`${form} button[aria-label="보기 1 아래로"]`);
  await p.selectOption(`${form} label:has-text("정답") select`, { label: '5. 퀴즈' });
  await p.click(`${form} button[aria-label="보기 3 삭제"]`); // 가정통신문
  await shot(p, '1280-03-poll-form.png');
  await p.click(`${form} button:has-text("저장")`); await p.waitForTimeout(900);
  let h = await html(p, pid);
  const tag = (/<div data-lp="poll"[^>]*>/.exec(h) || [''])[0];
  L.ok('items: poll saved (question, reordered options, answer follows its option)', /data-question="가장 먼저 만들 자료는\?"/.test(tag) && tag.includes('[&quot;평가 문항&quot;,&quot;학습지&quot;,&quot;수업 슬라이드&quot;,&quot;퀴즈&quot;]') && /data-answer="퀴즈"/.test(tag), tag);
  await p.waitForTimeout(800);
  L.ok('items: preview shows the new question', /가장 먼저 만들 자료는\?/.test(await frame.locator('[data-lpk="poll"]').innerText()));
  L.ok('items: form closed, focusable row stays', await p.locator(form).count() === 0);
  await p.click('.head-tools button:has-text("실행 취소")'); await p.waitForTimeout(600);
  L.ok('items: undo restores the poll', /data-question="AI로 가장 먼저 만들어 보고 싶은 자료는\?"/.test(await html(p, pid)));
  // 이름표 삭제(질문)
  await p.click(`${sec('share')} .kit-chip-x[aria-label="질문 삭제"]`); await p.waitForTimeout(500);
  L.ok('items: chip delete removes the qa placeholder', !/data-lp="qa"/.test(await html(p, pid)));
  // 실습 단계
  await p.click(`${sec('practice')} .sec2-tw`);
  L.ok('items: practice lists 3 steps + board', await p.locator(`${sec('practice')} .kit-row`).count() === 4 && /실습 단계/.test(await p.locator(`${sec('practice')} .kit-list`).innerText()));
  await p.click(`${sec('practice')} .kit-row >> nth=1`);
  await p.fill(`${sec('practice')} .kit-form label:has-text("단계 이름") input`, '2단계: 프롬프트 붙여 넣기');
  await p.fill(`${sec('practice')} .kit-form input[type=number]`, '20');
  await p.keyboard.press('Enter'); await p.waitForTimeout(900);
  h = await html(p, pid);
  L.ok('items: step title + minutes saved, visible heading too', /data-lp-step="s2" data-title="2단계: 프롬프트 붙여 넣기" data-minutes="20">\s*<h3>2단계: 프롬프트 붙여 넣기<\/h3>/.test(h), (/<section class="step" data-lp-step="s2"[^>]*>\s*<h3>[^<]*/.exec(h) || [''])[0].replace(/\s+/g, ' '));
  await p.click(`${sec('practice')} .kit-row:has-text("나눔 보드")`);
  await p.fill(`${sec('practice')} .kit-form textarea`, '만든 학습지를 사진으로 올려 주세요');
  await p.click(`${sec('practice')} .kit-form button:has-text("저장")`); await p.waitForTimeout(700);
  L.ok('items: board prompt saved', /data-lp="board" data-prompt="만든 학습지를 사진으로 올려 주세요"/.test(await html(p, pid)));
  // ＋ 기능 넣기: 투표(빈 질문은 막음)
  await p.click(`${sec('flow')} .sec2-tw`);
  await p.click(`${sec('flow')} .kit-add > summary`); await p.keyboard.press('Escape');
  L.ok('add: menu closes with Esc, focus back on its button', await p.locator(`${sec('flow')} .kit-add[open]`).count() === 0 && await p.evaluate(() => document.activeElement?.tagName === 'SUMMARY'));
  await p.click(`${sec('flow')} .kit-add > summary`); await p.click(`${sec('flow')} .kit-add .sec2-menu button:has-text("투표")`);
  await p.click(`${sec('flow')} .kit-form button:text-is("추가")`);
  L.ok('add: empty poll is not inserted, message shown', /질문을 적어 주세요/.test(await p.locator(`${sec('flow')} .kit-form [role=alert]`).innerText()) && (await html(p, pid)).match(/data-lp="poll"/g).length === 1);
  await p.fill(`${sec('flow')} .kit-form label:has-text("질문") input`, '오늘 기대되는 것은?');
  await p.fill(`${sec('flow')} .kit-form input[aria-label="보기 1"]`, '실습');
  await p.fill(`${sec('flow')} .kit-form input[aria-label="보기 2"]`, '나눔');
  await p.click(`${sec('flow')} .kit-form button:text-is("추가")`); await p.waitForTimeout(900);
  h = await html(p, pid);
  L.ok('add: poll placed at the end of the section content box', /<section id="flow"[\s\S]*?<div data-lp="attend"><\/div>\s*<div data-lp="poll" data-question="오늘 기대되는 것은\?" data-options="\[&quot;실습&quot;,&quot;나눔&quot;\]"><\/div><\/div>\s*<\/section>/.test(h), (/<section id="flow"[\s\S]*?<\/section>/.exec(h) || [''])[0].slice(-260));
  await p.waitForTimeout(700);
  L.ok('add: new poll in the preview + listed', await frame.locator('[data-lps="flow"] [data-lpk="poll"]').count() === 1 && await p.locator(`${sec('flow')} .kit-row`).count() === 1);
  // 미리보기 → 사이트 구성(누른 곳의 줄)
  await frame.locator('[data-lps="concepts"] p').first().click(); await p.waitForTimeout(400);
  L.ok('pick: clicking content in the preview selects its section row', await p.locator(`${sec('concepts')}.is-sel`).count() === 1);
  await frame.locator('[data-lps="share"] [data-lpk="poll"]').click({ position: { x: 3, y: 3 } }); await p.waitForTimeout(500);
  L.ok('pick: clicking a kit selects and reveals its item row', await p.locator(`${sec('share')} .kit.is-sel`).count() === 1);
  await noScroll(p, 'studio 1280');
  await p.locator(`${sec('practice')}`).scrollIntoViewIfNeeded();
  await shot(p, '1280-04-outline.png');
  await axe(p, '1280 studio with outline open');
  await p.click(`${sec('share')} .kit-row`); await axe(p, '1280 poll form open');
  const real = errs.filter((e) => !/Blocked autofocusing/.test(e));
  L.ok('1280: no page errors', real.length === 0, JSON.stringify(real));
  await ctx.close();

  // ── 390: 수정 칸에서 같은 일 ──
  const m = await build(b, 390, 844);
  const q = m.p;
  L.ok('390: info rows + outline in the edit view', await q.locator('.st-info .prop').count() >= 4 && await q.locator('.st-outline .sec2').count() === 7);
  await shot(q, '390-01-edit.png');
  await q.click(`${sec('share')} .sec2-name`); await q.waitForTimeout(300);
  L.ok('390: tapping a row expands it and stays in the edit view', await q.locator('.st-panel').isVisible() && await q.locator(`${sec('share')} .kit-list`).count() === 1);
  await q.click(`${sec('share')} .kit-row`);
  await q.locator(`${sec('share')} .kit-form`).scrollIntoViewIfNeeded();
  await noScroll(q, 'studio 390 with poll form');
  await shot(q, '390-02-form.png');
  await axe(q, '390 poll form open');
  await q.click(`${sec('share')} .kit-form button:has-text("취소")`);
  await shot(q, '390-03-full.png', { fullPage: true });
  L.ok('390: no page errors', m.errs.length === 0, JSON.stringify(m.errs));
  await b.close();
  process.exit(L.summary() ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
