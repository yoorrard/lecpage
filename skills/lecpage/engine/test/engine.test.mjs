// 엔진 공통: 배포할 곳·참여 기능 서버 고르기, ZIP, 암호 잠그기, 보조 쪽(보드 파일·개인정보 안내·운영안내·짧은 주소)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/index.js';
import { nodeRuntime } from '../node.js';
import { kitBuild, tinySite } from './kit-site.mjs';

const rt = nodeRuntime();
/** 작은 키트 사이트 조립: body = 자리 표시가 든 본문, meta = lecpage.json, prev = 강사 값 */
const kit = (body, meta = {}, prev = null) => E.assemble(tinySite(body), { v: 2, title: 't', ...meta }, { runtime: rt, prev, today: '2026-11-20' });
const data = (html) => JSON.parse(/<script type="application\/json" id="lp-data">([\s\S]*?)<\/script>/.exec(html)[1].replace(/\\u003c/g, '<'));

test('운영 결정 규칙', () => {
  assert.equal(E.decideInfra({ size: 25, features: [] }).backend, 'none');
  assert.equal(E.decideInfra({ size: 25, features: ['attendance'] }).backend, 'cloudflare', '강사 할 일이 가장 적은 곳(시트 약 23번 → Cloudflare 약 7번)');
  assert.equal(E.decideInfra({ size: 60, features: ['qa', 'progress'] }).backend, 'cloudflare', '60명 실시간도 할 일이 가장 적은 Cloudflare');
  assert.equal(E.decideInfra({ size: 60, features: ['qa', 'progress'], connected: ['supabase'] }).backend, 'supabase', '이미 연결한 Supabase는 그대로');
  // ⑥ Supabase는 80명까지(글 하나에 받는 사람 수만큼 메시지가 나가 100명이면 초당 100건을 넘음)
  assert.equal(E.decideInfra({ size: 80, features: ['qa'], connected: ['supabase'] }).backend, 'supabase');
  assert.equal(E.decideInfra({ size: 90, features: ['qa'], connected: ['supabase'] }).backend, 'cloudflare', '81명부터는 Cloudflare');
  assert.equal(E.decideInfra({ size: 30, features: ['qa', 'help', 'progress'] }).backend, 'cloudflare', '클릭만 하는 30명 실습도 할 일이 가장 적은 Cloudflare');
  assert.equal(E.decideInfra({ size: 30, features: ['qa'], connected: ['sheets'] }).backend, 'sheets', '이미 연결해 둔 시트는 그대로');
  // skill이 Cloudflare에 올리면 참여 기능도 같은 계정(가입 하나, 7일 멈춤 없음). 이미 Vercel에 연결해 두었으면 Supabase
  assert.equal(E.decideInfra({ size: 30, features: ['qa', 'help', 'progress'], skill: 'set' }).backend, 'cloudflare');
  assert.equal(E.decideInfra({ size: 25, features: ['attendance'], skill: 'set' }).backend, 'cloudflare');
  // 기준은 강사가 할 일 수(TEACHER_STEPS): 사이트가 다른 곳이어도 Cloudflare 중계(가입·로그인 2번) < Supabase(3번). Supabase를 이미 연결해 두었으면 Supabase
  assert.equal(E.decideInfra({ size: 30, features: ['qa', 'poll'], skill: 'set', connected: ['vercel'] }).backend, 'cloudflare');
  assert.equal(E.decideInfra({ size: 30, features: ['qa', 'poll'], skill: 'set', connected: ['supabase'] }).backend, 'supabase');
  assert.equal(E.decideInfra({ size: 30, features: ['qa', 'poll'], skill: 'set' }).teacherSteps, 2);
  assert.equal(E.decideInfra({ size: 30, features: ['qa', 'poll'] }).teacherSteps, 7, '앱(클릭만)도 할 일이 가장 적은 Cloudflare(앱 화면 추천과 같음)');
  assert.equal(E.decideInfra({ size: 500, features: ['qa', 'poll'] }).backend, 'cloudflare');
  assert.equal(E.decideInfra({ size: 30, features: ['qa'], network: 'offline' }).backend, 'lan');
  assert.equal(E.decideInfra({ size: 80, features: ['qa'], infra: ['nas'], skill: 'set' }).backend, 'server');
});

test('ZIP 쓰기: 서명과 파일 수', () => {
  const z = E.zipFiles({ 'a.txt': '가나다', 'b/c.bin': new Uint8Array([1, 2, 3]) });
  const dv = new DataView(z.buffer);
  assert.equal(dv.getUint32(0, true), 0x04034b50);
  assert.equal(dv.getUint16(z.length - 22 + 10, true), 2);
});

test('올릴 곳 고르기: 앱은 Vercel, 명령을 쓰면 Cloudflare, 연결·지난번에 올린 곳 먼저', () => {
  assert.equal(E.decideHost({}).pick, 'vercel');
  assert.equal(E.decideHost({ skill: 'dev' }).pick, 'cloudflare');
  assert.ok(E.decideHost({}).hosts.includes('vercel'), '강사료를 받는 강의여도 올릴 곳을 빼지 않음');
  assert.equal(E.decideHost({ previous: 'netlify' }).pick, 'netlify');
  assert.equal(E.decideHost({ connected: ['github-pages'] }).pick, 'github-pages');
  assert.equal(E.decideHost({ instant: true }).pick, 'lecpage');
  const long = E.decideHost({ instant: true, keep: 'long' });
  assert.equal(long.pick, 'vercel'); assert.equal(long.hosts[1], 'lecpage', '오래 둘 사이트는 본인 계정이 먼저');
  assert.equal(E.decideHost({ instant: true, siteMB: 60 }).pick, 'vercel', '바로 공개 한도를 넘으면 빼요');
  assert.deepEqual(E.decideHost({ network: 'offline' }).hosts, ['lan', 'zip']);
  assert.equal(E.decideHost({ customDomain: true }).pick, 'cloudflare');
  const bigFile = E.decideHost({ maxFileMB: 40 });
  assert.equal(bigFile.pick, 'github-pages', '25MB가 넘는 파일은 GitHub Pages(파일 100MB까지)'); assert.ok(bigFile.warnings.some((w) => /25MB/.test(w)));
  const big = E.decideHost({ siteMB: 180 });
  assert.equal(big.pick, 'cloudflare', '100MB가 넘는 사이트는 Cloudflare 먼저'); assert.ok(big.warnings.some((w) => /100MB/.test(w)));
  assert.equal(big.hosts.at(-3), 'vercel', 'Vercel은 맨 뒤(뒤에 firebase·zip)');
  assert.equal(E.decideHost({ skill: 'dev', files: 1500 }).pick, 'cloudflare', '명령으로 올리면 20,000개까지');
  assert.equal(E.decideHost({ skill: 'dev', files: 25000 }).pick, 'github-pages');
  assert.equal(E.decideHost({ files: 1500 }).pick, 'github-pages', '앱(끌어 놓기)은 1,000개까지');
  assert.ok(E.decideHost({ network: 'restricted' }).warnings.some((w) => /전날/.test(w)));
  assert.match(E.HOSTS.cloudflare.cli, /mktemp -d/);
  for (const h of E.decideHost({ instant: true }).hosts) assert.ok(E.HOSTS[h], h);
});

test('올릴 곳 Onpod: 명령(skill)에서만, Cloudflare 뒤. 이미 쓰면 먼저이고 할 일 0번, 한도 밖이면 뒤로', () => {
  assert.ok(!E.decideHost({}).hosts.includes('onpod'), '앱에서는 못 올림(REST CORS 없음)');
  const dev = E.decideHost({ skill: 'dev' });
  assert.ok(dev.hosts.indexOf('onpod') > dev.hosts.indexOf('cloudflare'));
  assert.equal(dev.steps, 2, 'Cloudflare: 가입·로그인 승인');
  const mine = E.decideHost({ skill: 'dev', connected: ['onpod'] });
  assert.equal(mine.pick, 'onpod'); assert.equal(mine.steps, 0);
  assert.ok(E.decideHost({ skill: 'dev' }).hosts.includes('onpod'));
  const big = E.decideHost({ skill: 'dev', siteMB: 150 }).hosts;
  assert.equal(big.indexOf('onpod'), big.indexOf('firebase') - 1, '사이트 100MB를 넘으면 맨 뒤(firebase·zip 앞)');
  assert.equal(E.HOST_STEPS.onpod.skill, 4); assert.equal(E.HOST_STEPS.onpod.app, null);
  assert.equal(E.decideInfra({ size: 30, skill: 'set' }).hostSteps, 2);
  assert.equal(E.decideInfra({ size: 30 }).hostSteps, 6, '앱 기본(Vercel 가입·토큰) 측정값');
  const MB = 1024 * 1024;
  assert.ok(E.checkHost('onpod', { bytes: 90 * MB, files: 4000, maxFile: 40 * MB }).ok);
  assert.equal(E.checkHost('onpod', { bytes: 120 * MB, files: 6000, maxFile: 60 * MB }).errors.length, 3);
  assert.match(E.HOSTS.onpod.cli, /onpod@latest static deploy .* --no-spa/);
});

test('올릴 곳 한도: 크기·파일 수가 넘으면 올리기 전에 알려 줌', () => {
  const MB = 1024 * 1024;
  assert.ok(E.checkHost('vercel', { bytes: 20 * MB, files: 200, maxFile: 2 * MB }).ok);
  assert.match(E.checkHost('vercel', { bytes: 120 * MB, files: 200 }).errors[0], /100MB/);
  assert.match(E.checkHost('cloudflare', { bytes: 30 * MB, files: 1200, maxFile: MB }).errors[0], /1000개/);
  assert.match(E.checkHost('cloudflare', { bytes: 30 * MB, files: 10, maxFile: 26 * MB }).errors[0], /25MB/);
  assert.ok(E.checkHost('github-pages', { bytes: 30 * MB, files: 600, binaries: 500 }).warnings.length);
  assert.ok(E.checkHost('zip', { bytes: 900 * MB }).ok, '한도가 없는 곳은 통과');
});

test('올릴 곳: 멈추지 않는 것이 먼저(한도 안내, 참가자가 많은 큰 사이트, 무료로 도는 바로 공개)', () => {
  // 고른 곳마다 무료 한도를 넘으면 어떻게 되는지 한 줄
  for (const h of ['vercel', 'github-pages', 'cloudflare', 'netlify', 'lecpage']) assert.ok(/[가-힣]/.test(E.HOSTS[h].atLimit_ko), h);
  assert.equal(E.HOSTS.cloudflare.stops, false); assert.equal(E.HOSTS.vercel.stops, true);
  // 보통 연수(5MB, 40명)는 그대로 Vercel
  assert.equal(E.decideHost({ skill: 'click', siteMB: 5, size: 40 }).pick, 'vercel');
  // 30MB 사이트에 500명: 한 달 약 88GB → 전송량 한도에서 멈추는 곳(Vercel·Netlify)을 뒤로
  const big = E.decideHost({ skill: 'click', siteMB: 30, size: 500 });
  assert.ok(!['vercel', 'netlify'].includes(big.pick), big.pick);
  assert.ok(big.hosts.indexOf('vercel') > big.hosts.indexOf('cloudflare') && big.hosts.indexOf('netlify') > big.hosts.indexOf('github-pages'));
  assert.match(big.reasons[0], /GB/); assert.ok(big.warnings.some((w) => /멈춰요/.test(w)));
  // 바로 공개: 운영자가 유료로 돌리면 첫째, 무료로 돌리면(하루 한도에서 멈출 수 있음) 둘째
  assert.equal(E.decideHost({ skill: 'click', instant: 'stable' }).pick, 'lecpage');
  assert.equal(E.decideHost({ skill: 'click', instant: true }).pick, 'lecpage');
  const lim = E.decideHost({ skill: 'click', instant: 'limited' });
  assert.equal(lim.pick, 'vercel'); assert.equal(lim.hosts[1], 'lecpage');
  // 사이트를 Pages로 내보내는 서버: 무료여도 사이트는 멈추지 않아 첫째, 공개 기간 문구는 방문 기준이 아님
  const pg = E.decideHost({ skill: 'click', instant: 'pages' });
  assert.equal(pg.pick, 'lecpage'); assert.match(pg.reasons[0], /멈추지 않아요/); assert.doesNotMatch(pg.reasons[0], /방문이 있는 동안/);
});

test('암호 보호: 페이지·교재 쪽 그림을 잠그고 같은 암호로 풀린다', async () => {
  const { protectSite } = await import('../src/protect.js');
  const r = kitBuild();
  assert.ok(r.files['material/p-001.webp'] && r.files['index.html'].includes('스프레드시트'));
  const out = await protectSite(r.files, '숲속1234', { runtime: rt, title: '데이터로 읽는 우리 반', iterations: 1000 });
  assert.ok(out['assets/unlock.js']);
  assert.ok(!out['material/p-001.webp'] && out['material/p-001.webp.enc']);
  assert.ok(!out['index.html'].includes('스프레드시트'), '잠긴 페이지에 본문이 보이면 안 됨');
  assert.match(out['robots.txt'], /Disallow/);
  const payload = JSON.parse(/<script type="application\/json" id="lp-locked">([\s\S]*?)<\/script>/.exec(out['index.html'])[1]);
  const subtle = globalThis.crypto.subtle;
  const derive = async (pw) => subtle.deriveKey({ name: 'PBKDF2', salt: Buffer.from(payload.salt, 'base64'), iterations: payload.iter, hash: 'SHA-256' }, await subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']), { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const dec = (key, u8) => subtle.decrypt({ name: 'AES-GCM', iv: u8.subarray(0, 12) }, key, u8.subarray(12));
  const key = await derive('숲속1234');
  const html = new TextDecoder().decode(await dec(key, new Uint8Array(Buffer.from(payload.data, 'base64'))));
  assert.ok(html.includes('스프레드시트') && html.includes('data-lp-enc-src="material/p-001.webp.enc"'));
  assert.deepEqual([...new Uint8Array(await dec(key, out['material/p-001.webp.enc']))], [...r.files['material/p-001.webp']]);
  await assert.rejects(async () => dec(await derive('틀린암호'), new Uint8Array(Buffer.from(payload.data, 'base64'))));
  await assert.rejects(() => protectSite(r.files, '12', { runtime: rt }));
  // 잠그지 않는 쪽(접속 확인·개인정보 안내)에는 참여 기능 서버 주소·연수 코드·키가 없음. 접속 확인은 /api/health만
  const r2 = kitBuild({ prev: { live: { provider: 'supabase', url: 'https://abcd1234.supabase.co', anonKey: 'sb_publishable_SECRETKEY', code: 'SUPA5678' } } });
  const out2 = await protectSite(r2.files, '숲속1234', { runtime: rt, iterations: 1000 });
  for (const page of ['check.html', 'privacy.html']) {
    const d = data(out2[page]);
    assert.ok(!JSON.stringify(d).includes('SUPA5678') && !out2[page].includes('sb_publishable_SECRETKEY'), page);
    assert.equal(d.live.url, undefined, page); assert.equal(d.live.health, 'https://abcd1234.supabase.co/auth/v1/health');
  }
  assert.ok(r2.files['check.html'].includes('SUPA5678'), '잠그지 않을 때(암호 없음)는 그대로');
});

const BOARD = '<div data-lp="board"></div>';
const fileInput = (r) => /<input type="file" name="files"/.test(r.files['index.html']);
const consoleBoard = (r) => JSON.parse(/<script type="application\/json" id="lp-blueprint">([\s\S]*?)<\/script>/.exec(r.files['console.html'])[1]).sections.find((s) => s.type === 'board');
const board = (live, attrs = '') => kit(attrs ? BOARD.replace('data-lp="board"', `data-lp="board" ${attrs}`) : BOARD, { features: ['board'] }, { live: { url: 'https://example.org/x', code: 'BOARD123', ...live } });

test('보드 파일: 구글 시트는 live.uploads=true일 때만 파일 칸을 보이고, 강사 화면도 같은 값을 받음', () => {
  const sheets = board({ provider: 'sheets' });
  assert.ok(!fileInput(sheets), '시트 기본(파일 올리기 꺼짐)에는 파일 칸이 없음');
  assert.match(sheets.files['index.html'], /data-max-files="0"/);
  assert.equal(consoleBoard(sheets).allowFiles, false, '강사 화면이 서버에 파일 끄기(ui.uploads=false)를 알림');
  const on = board({ provider: 'sheets', uploads: true });
  assert.ok(fileInput(on) && consoleBoard(on).allowFiles === true, '시트에서 파일 올리기를 켰으면 보임');
  for (const provider of ['supabase', 'http', 'local']) assert.ok(fileInput(board({ provider })), provider);
  assert.ok(!fileInput(board({ provider: 'http', uploads: false })), '다른 서버도 uploads=false면 숨김');
  const off = board({ provider: 'supabase' }, 'data-files="0"');
  assert.ok(!fileInput(off) && consoleBoard(off).allowFiles === false, '파일 0개(data-files="0")는 그대로');
});

test('개인정보 안내: 실제로 모으는 기록(설문·투표·입실·퇴실)과 익명 질문의 한계를 밝힘', () => {
  const body = '<div data-lp="qa"></div><div data-lp="poll" data-kind="word" data-question="?"></div><div data-lp="attend"></div><div data-lp="survey" data-questions=\'[{"q":"좋았나요?","kind":"scale"}]\'></div>';
  const feats = ['qa', 'help', 'progress', 'poll', 'attendance', 'survey'];
  const html = kit(body, { features: feats }).files['privacy.html'];
  for (const w of ['질문', '도움 요청', '실습 진행 상태', '투표 응답', '설문 응답', '입실·퇴실 시각', '임의 번호']) assert.ok(html.includes(w), w);
  assert.match(html, /익명 질문은 다른 참가자와 발표 화면에 이름이 보이지 않습니다\. 다만 기록에는/); // 리허설(local)은 서버가 없음
  const named = kit(body, { features: feats }, { live: { provider: 'local', anonymous: false } }).files['privacy.html'];
  assert.ok(!named.includes('익명 질문'), '익명이 아니면 문장을 넣지 않음');
  assert.ok(!html.includes('나눔 보드'), '보드가 없으면 보드 글을 적지 않음');
});

test('개인정보 안내: 바로 배포 서버가 참여 기록을 맡으면 운영자를 수탁자로 밝힘(받지 않는다고 쓰지 않음)', () => {
  const QA = '<div data-lp="qa"></div>';
  const lec = kit(QA, { features: ['qa'] }, { live: { provider: 'http', url: 'https://lecpage-sites.lecpage.workers.dev/live', code: 'LEC12345' },
    privacy: { processors: [{ name: 'lecpage 운영자(바로 배포 서버 · Cloudflare)', contact: 'hello@lecpage.com', country: '미국 등', purpose: '강사를 대신해 사이트와 참여 기록 저장' }] } }).files['privacy.html'];
  assert.ok(!lec.includes('받거나 보관하지 않습니다'));
  assert.match(lec, /lecpage 운영자가 강사를 대신해 저장만 합니다/);
  assert.ok(lec.includes('hello@lecpage.com'));
  const own = kit(QA, { features: ['qa'] }, { live: { provider: 'supabase', url: 'https://x.supabase.co', code: 'SUPA1234' } }).files['privacy.html'];
  assert.match(own, /lecpage의 운영자는 참가자 정보를 받거나 보관하지 않습니다/);
  // 보관 기간은 한 기준(마지막 기록 뒤 N일)으로 한눈에·3·참여 동의가 같은 말. 바로 배포는 늦어도 사이트와 함께
  const days = (h) => [...new Set(h.replace(/<[^>]+>/g, ' ').match(/(연수가 끝나고|연수 종료 후|마지막 [가-힣 ]{1,8}뒤) ?\d+일/g) || [])];
  assert.deepEqual(days(lec), ['마지막 기록 뒤 30일']);
  assert.match(lec, /사이트 보관 기간이 먼저 끝나면 사이트와 함께/);
  assert.match(lec, /모든 전송은 암호화\(HTTPS\)됩니다/);
  // 자체 서버: 맡기는 곳·국외 이전 없음, http 주소면 암호화했다고 쓰지 않음. 강사의 workers.dev는 Cloudflare
  const self = (url) => kit(QA + '<div data-lp="attend"></div>', { features: ['qa', 'attendance'] }, { live: { provider: 'http', url, code: 'SELF1234' }, privacy: { collect: ['nickname', 'name', 'school'], retentionDays: 14 } }).files;
  const s1 = self('http://192.168.0.10:8787')['privacy.html'];
  assert.match(s1, /처리를 맡기는 곳도 없습니다/); assert.doesNotMatch(s1, /이전 국가|HTTPS|Cloudflare/); assert.deepEqual(days(s1), ['마지막 기록 뒤 14일']);
  assert.match(self('https://lec.teacher.workers.dev')['privacy.html'], /Cloudflare, Inc\./);
  // 참여하기 동의: 이름·소속은 입실 때만 받으니 동의하지 않아도 질문·투표는 그대로
  const idx = self('https://live.school.kr')['index.html'];
  assert.match(idx, /이름·소속을 출석 확인에만 쓰고 마지막 기록 뒤 14일 안에 지우는 데 동의합니다\. 동의하지 않으면 입실 기록만 남지 않아요\(질문·투표는 그대로\)/);
  assert.doesNotMatch(idx, /참여 기능을 쓸 수 없어요/);
});

test('운영안내: 연결한 방식(live.provider)을 따르고 QR 안내문을 파일 목록에 넣음', () => {
  const doc = (live) => kit('<div data-lp="qa"></div>', { features: ['qa'] }, { live: { code: 'OPS12345', ...live } }).teacher['운영안내.md'];
  const sheets = doc({ provider: 'sheets', url: 'https://script.google.com/macros/s/x/exec' });
  assert.match(sheets, /참여 기능 연결: 구글 시트/);
  assert.match(sheets, /## 운영 방식: 구글 시트/);
  assert.ok(!/참여 기능 연결: sheets/.test(sheets));
  assert.ok(sheets.includes('`poster.html` QR 안내문 인쇄') && sheets.includes('`console.html` 강사 화면'));
  assert.match(doc({ provider: 'supabase', url: 'https://x.supabase.co', anonKey: 'k' }), /## 운영 방식: Supabase/);
  assert.match(doc({ provider: 'http', url: 'https://live.example.org' }), /참여 기능 연결: 내 서버·Cloudflare/);
  assert.match(doc({ provider: 'local' }), /참여 기능 연결: 이 컴퓨터에서 테스트[\s\S]*참가자 기기끼리는 이어지지 않아요/);
  const none = kit('<p>안내</p>', { features: [] }).teacher['운영안내.md'];
  assert.match(none, /참여 기능 연결: 없음/);
  assert.ok(!none.includes('console.html') && none.includes('poster.html'), '강사 화면이 없으면 목록에서 뺌');
});

test('짧은 주소: 사이트 주소와 따로 넘기고(QR·복사는 원래 주소), 안내문·발표 화면·공유 창에 원래 주소 자리를 둠', () => {
  const site = (prev) => kit('<div data-lp="qa"></div>', { features: ['qa'] }, prev);
  const r = site({ siteUrl: 'https://maum.vercel.app/', shortUrl: 'https://joo.is/우리연수' });
  const d = data(r.files['index.html']);
  assert.equal(d.siteUrl, 'https://maum.vercel.app/', 'QR에 들어갈 주소는 사이트 주소');
  assert.equal(decodeURI(d.shortUrl), 'https://joo.is/우리연수');
  assert.equal(data(r.files['screen.html']).shortUrl, d.shortUrl);
  // 짧은 주소만 받았을 때(사이트 주소를 모를 때)도 siteUrl에 섞지 않음: 올린 뒤에는 그 페이지의 주소가 QR에 들어감
  const only = data(site({ shortUrl: 'https://is.gd/tomika' }).files['index.html']);
  assert.equal(only.siteUrl, ''); assert.equal(only.shortUrl, 'https://is.gd/tomika');
  assert.equal(data(site({ shortUrl: 'javascript:alert(1)' }).files['index.html']).shortUrl, '', '주소가 아닌 값은 버림');
  for (const [f, attr] of [['poster.html', 'data-url-full'], ['screen.html', 'data-join-full'], ['index.html', 'data-url-full']]) assert.ok(r.files[f].includes(attr), `${f}에 원래 주소 자리`);
  assert.ok(r.files['screen.html'].includes('data-join-zoom') && r.files['screen.html'].includes('data-joinbig'), '발표 화면에 QR 크게 보기');
  // 런타임: QR 둘레 여백 4칸(cellSize의 4배)을 그림 안에 넣음
  assert.match(r.files['assets/lecpage.js'], /createSvgTag\(\{ cellSize: 6, margin: 24/);
  assert.match(r.files['assets/screen.js'], /createSvgTag\(\{ cellSize: 6, margin: 24/);
});
