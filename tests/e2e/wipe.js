// 지우기와 도는 AI 작업: [모든 데이터 삭제](이 탭·다른 탭에서 만드는 중)·만드는 중인 연수 삭제.
// 지운 뒤에 작업이 AI를 더 부르거나 작업 기록(IndexedDB lecpage-gen)을 다시 쓰지 않아야 하고, 다른 탭도 처음 화면으로 돌아가야 함.
//   BASE=http://localhost:4175/ node wipe.js
process.env.AI_DELAY = process.env.AI_DELAY || '4000'; // 가짜 AI가 답을 늦게 줌: 지우는 순간 작업이 도는 중이게
const L = require('./lib.js');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WAIT = Number(process.env.AI_DELAY) + 3500; // 멈추지 않았다면 그사이 답이 오고 기록을 다시 씀
const dump = (p) => p.evaluate(async () => {
  const all = (name, store) => new Promise((res) => { const q = indexedDB.open(name); q.onsuccess = () => { const db = q.result; if (!db.objectStoreNames.contains(store)) { db.close(); return res(0); } const t = db.transaction(store).objectStore(store).getAll(); t.onsuccess = () => { db.close(); res(t.result.length); }; t.onerror = () => { db.close(); res(-1); }; }; q.onerror = () => res(-2); });
  const own = (st) => Object.keys(st).filter((k) => /^(lecpage[:-]|lp-)/.test(k));
  return { projects: await all('lecpage', 'projects'), blobs: await all('lecpage', 'blobs'), kv: await all('lecpage', 'kv'), jobs: await all('lecpage-gen', 'jobs'), chat: await all('lecpage-gen', 'chat'), ls: own(localStorage), ss: own(sessionStorage), busy: !!globalThis.lecpageGenBusy?.() };
});
/** 교재를 넣고 가짜 AI로 만들기 시작(도는 중)까지. posts: AI를 부른 횟수 */
async function making(b) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const posts = { n: 0 };
  await L.mockAi(ctx, async (r, u) => { if (/api\.anthropic\.com\/v1\/messages/.test(u) && r.request().method() === 'POST') posts.n++; return false; });
  const p = await ctx.newPage(); const errs = L.watch(p);
  await L.startWithFile(p);
  await L.connectAi(p);
  await p.waitForFunction(() => globalThis.lecpageGenBusy?.(), null, { timeout: 30000 });
  await sleep(600);
  return { ctx, p, errs, posts };
}
(async () => {
  const b = await L.chromium.launch();
  // ── 1·2. [모든 데이터 삭제]: 만드는 탭에서 / 다른 탭에서 ──
  for (const mode of ['same', 'other']) {
    const { ctx, p, errs, posts } = await making(b);
    const s = mode === 'other' ? await ctx.newPage() : p;
    if (mode === 'other') await s.goto(L.BASE + '#/settings', { waitUntil: 'load' }); else await s.evaluate(() => { location.hash = '#/settings'; });
    await s.waitForSelector('.settings button:has-text("모든 데이터 삭제")', { timeout: 20000 });
    await s.click('.settings button:has-text("모든 데이터 삭제")');
    await s.click('.settings button:has-text("한 번 더 눌러 삭제")');
    await s.waitForSelector('.settings button:has-text("모든 데이터 삭제"):not([disabled])', { timeout: 20000 });
    const at = posts.n;
    await sleep(WAIT);
    const a = await dump(s);
    L.ok(`wipe ${mode}: 연수·파일·키 저장소가 비었음`, a.projects === 0 && a.blobs === 0 && a.kv === 0, JSON.stringify(a));
    L.ok(`wipe ${mode}: AI 작업 기록(lecpage-gen)도 비었음`, a.jobs === 0 && a.chat === 0, `jobs ${a.jobs} chat ${a.chat}`);
    // 지운 설정 화면이 바로 지운 모습: 연결했던 AI 줄('… 연결됨')과 예전 사용량이 남아 보이지 않음(새로 고쳐야 바뀌면 안 지워진 것처럼 보임)
    const shown = (await s.locator('.settings').innerText()).replace(/\s+/g, ' ');
    L.ok(`wipe ${mode}: 설정 화면이 바로 지운 모습(연결됨 없음·'방금 모두 지웠어요')`, !/연결됨/.test(shown) && /API 키 연결 안 됨/.test(shown) && /방금 모두 지웠어요/.test(shown), (shown.match(/AI .{0,60}/) || [''])[0]);
    L.ok(`wipe ${mode}: 지운 뒤 AI를 더 부르지 않고 도는 작업이 없음`, posts.n === at && !a.busy, `${at} → ${posts.n}`);
    L.ok(`wipe ${mode}: 이 브라우저에 화면 밝기·통계 끄기만 남음`, a.ls.every((k) => ['lecpage:theme', 'lecpage:stats-off'].includes(k)) && a.ss.length === 0, [...a.ls, ...a.ss].join(','));
    if (mode === 'other') {
      const t = await dump(p).catch(() => null);
      L.ok('wipe other: 만들던 탭도 멈추고 처음 화면으로 돌아감(탭 저장소도 비움)', !!t && !t.busy && t.ss.length === 0 && /#\/?$/.test(new URL(p.url()).hash || '#/'), `${p.url()} ${JSON.stringify(t)}`);
    }
    L.ok(`wipe ${mode}: 화면 오류 없음`, errs.length === 0, errs.join(' | ').slice(0, 300));
    await ctx.close();
  }
  // ── 3. 만드는 중인 연수를 첫 화면에서 삭제 ──
  {
    const { ctx, p, errs, posts } = await making(b);
    await p.evaluate(() => { location.hash = '#/'; }); await p.waitForSelector('.proj-actions');
    await p.click('.proj-actions button:has-text("삭제")'); await p.waitForSelector('dialog[open]');
    await p.click('dialog[open] button.btn-danger');
    await p.waitForFunction(() => !document.querySelector('.proj-actions'), null, { timeout: 20000 });
    const at = posts.n;
    await sleep(WAIT);
    const a = await dump(p);
    L.ok('delete: 만드는 중인 연수를 지우면 작업이 멈추고 기록이 남지 않음', a.projects === 0 && a.blobs === 0 && a.jobs === 0 && !a.busy && posts.n === at, JSON.stringify(a));
    const f = await p.evaluate(() => document.activeElement?.tagName);
    L.ok('delete: 마지막 연수를 지운 뒤 초점이 본문에 있음', f && f !== 'BODY', f);
    L.ok('delete: 화면 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 300));
    await ctx.close();
  }
  await b.close();
  process.exit(L.summary() ? 1 : 0);
})().catch((e) => { console.error('ERR', e); process.exit(2); });
