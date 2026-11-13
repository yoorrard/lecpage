import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as E from '../src/index.js';
import { pruneFxCss } from '../src/build.js';
const await_import_prune = (css, ids) => pruneFxCss(css, ids);
import { nodeRuntime } from '../node.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const EX = (id) => JSON.parse(readFileSync(join(HERE, '..', '..', 'examples', `${id}.blueprint.json`), 'utf8'));

test('검증: 위험한 링크·HTML을 걸러 낸다', () => {
  const { blueprint, warnings } = E.validate({
    meta: { title: '<img src=x onerror=alert(1)> 연수' },
    sections: [
      { type: 'hero', ctas: [{ label: '나쁜 링크', href: 'javascript:alert(1)' }, { label: '좋은 링크', href: 'gemini.google.com' }] },
      { type: 'tools', items: [{ name: 'x', url: 'data:text/html,<script>' }] },
      { type: 'nope' },
    ],
  });
  assert.equal(blueprint.sections[0].ctas.find((c) => c.label === '나쁜 링크').href, '#main');
  assert.match(blueprint.sections[0].ctas.find((c) => c.label === '좋은 링크').href, /^https:\/\/gemini\.google\.com\/?$/);
  assert.equal(blueprint.sections[1].items[0].url, '');
  assert.ok(warnings.some((w) => /알 수 없는 섹션/.test(w.message_ko)));
});

test('렌더: 내용 속 HTML은 이스케이프된다', () => {
  const r = E.build({ meta: { title: '<script>alert(1)</script>' }, sections: [{ type: 'hero' }, { type: 'text', md: '**굵게** <b>x</b> [링크](javascript:alert(1))' }] }, { runtime: nodeRuntime() });
  const html = r.files['index.html'];
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!/href="javascript:/i.test(html));
  assert.ok(html.includes('<strong>굵게</strong>'));
});

for (const id of ['sel-story', 'data-lab']) {
  test(`견본 빌드: ${id}`, () => {
    const r = E.build(EX(id), { runtime: nodeRuntime() });
    assert.deepEqual(r.errors, []);
    for (const f of ['index.html', 'console.html', 'screen.html', 'check.html', 'privacy.html', 'robots.txt', 'assets/theme.css', 'assets/lecpage.js', 'assets/live.js', 'assets/fx.js']) assert.ok(r.files[f], f + ' 없음');
    for (const f of ['DESIGN.md', '운영안내.md', 'lecpage.blueprint.json']) { assert.ok(r.teacher[f], f + ' 없음'); assert.ok(!r.files[f], f + '는 올리는 파일에 없어야 함'); }
    assert.match(r.files['robots.txt'], /Disallow: \//);
    assert.ok(r.report.effects.length > 3);
    assert.equal((r.files['index.html'].match(/<h1/g) || []).length, 1);
    const data = /<script type="application\/json" id="lp-data">([\s\S]*?)<\/script>/.exec(r.files['index.html'])[1];
    assert.ok(JSON.parse(data).live.code.length === 6);
  });
}

test('프리셋: 모든 글자 대비 4.5:1 이상', () => {
  for (const p of E.PRESETS) for (const t of ['light', 'dark']) {
    const k = E.themeTokens(p, t);
    assert.ok(E.contrast(k['--foreground'], k['--background']) >= 4.5, p.id + t + ' fg');
    assert.ok(E.contrast(k['--muted-foreground'], k['--background']) >= 4.5, p.id + t + ' muted');
    assert.ok(E.contrast(k['--primary-foreground'], k['--primary']) >= 4.5, p.id + t + ' primary');
  }
});

test('프리셋 효과는 모두 카탈로그에 있다', () => {
  const ids = new Set(E.FX.map((f) => f.id));
  for (const p of E.PRESETS) {
    for (const v of [...Object.values(p.effects), p.graphic, p.closingGraphic, p.signature].filter(Boolean)) assert.ok(ids.has(v), `${p.id}: ${v}`);
  }
});

test('디자인 결정: 네트워크 제한이면 외부 라이브러리 효과를 쓰지 않는다', () => {
  const bp = E.validate({ meta: { title: 'AI 연수' }, audience: { network: 'restricted' }, design: { preset: 'night-story', motion: 3 }, sections: [{ type: 'hero' }] }).blueprint;
  const d = E.resolveDesign(bp);
  for (const id of Object.values(d.effects)) assert.ok(!(E.fxInfo(id)?.libs || []).length, id);
  assert.ok(d.motion <= 2);
});

test('운영 결정 규칙', () => {
  assert.equal(E.decideInfra({ size: 25, features: [] }).backend, 'none');
  assert.equal(E.decideInfra({ size: 25, features: ['attendance'] }).backend, 'sheets');
  assert.equal(E.decideInfra({ size: 60, features: ['qa', 'progress'] }).backend, 'supabase');
  assert.equal(E.decideInfra({ size: 30, features: ['qa', 'help', 'progress'] }).backend, 'sheets', '클릭만 하는 30명 실습은 구글 시트');
  // skill이 Cloudflare에 올리면 참여 기능도 같은 계정(가입 하나, 7일 멈춤 없음). 이미 Vercel에 연결해 두었으면 Supabase
  assert.equal(E.decideInfra({ size: 30, features: ['qa', 'help', 'progress'], skill: 'set' }).backend, 'cloudflare');
  assert.equal(E.decideInfra({ size: 25, features: ['attendance'], skill: 'set' }).backend, 'cloudflare');
  assert.equal(E.decideInfra({ size: 30, features: ['qa', 'poll'], skill: 'set', connected: ['vercel'] }).backend, 'supabase');
  assert.equal(E.decideInfra({ size: 30, features: ['qa', 'poll'], skill: 'set', maxFileMB: 40 }).backend, 'supabase', '25MB 넘는 파일이 있어 Cloudflare에 못 올리면 Supabase');
  assert.equal(E.decideInfra({ size: 500, features: ['qa', 'poll'] }).backend, 'cloudflare');
  assert.equal(E.decideInfra({ size: 30, features: ['qa'], network: 'offline' }).backend, 'lan');
  assert.equal(E.decideInfra({ size: 80, features: ['qa'], infra: ['nas'], skill: 'set' }).backend, 'server');
  assert.ok(!E.decideInfra({ size: 30, features: ['qa'], commercial: true }).hosts.includes('vercel'));
});

test('유형 결정', () => {
  assert.equal(E.decideArchetype({ format: 'course' }).primary, 'course');
  assert.equal(E.decideArchetype({ size: 400 }).primary, 'live');
  assert.equal(E.decideArchetype({ practiceRatio: 0.6, durationMin: 120 }).primary, 'lab');
});

test('AI 답에서 JSON 꺼내기', () => {
  assert.equal(E.extractJson('설명입니다\n```json\n{"a":1,}\n```\n끝').a, 1);
  assert.equal(E.extractJson('앞말 {"meta":{"title":"연수"}} 뒷말').meta.title, '연수');
  assert.throws(() => E.extractJson('JSON 없음'));
});

test('프롬프트에 규칙·스키마·교재가 들어간다', () => {
  const p = E.buildPrompt({ context: '[쪽 1] 교재', info: { title: '연수' } });
  assert.ok(p.includes('JSON 하나만'));
  assert.ok(p.includes('stations'));
  assert.ok(p.includes('[쪽 1] 교재'));
});

test('ZIP 쓰기: 서명과 파일 수', () => {
  const z = E.zipFiles({ 'a.txt': '가나다', 'b/c.bin': new Uint8Array([1, 2, 3]) });
  const dv = new DataView(z.buffer);
  assert.equal(dv.getUint32(0, true), 0x04034b50);
  assert.equal(dv.getUint16(z.length - 22 + 10, true), 2);
});

test('효과 CSS는 쓰는 효과 묶음만 남긴다', () => {
  const css = '/* 공통 */.a{}\n/*@fx:marquee*/.m{}\n/*@fx:aurora blobs-morph*/.b{}\n/*@fx:**/.c{}\n';
  const out = E.build ? (await_import_prune(css, ['blobs-morph'])) : '';
  assert.ok(out.includes('.a{}') && out.includes('.b{}') && out.includes('.c{}') && !out.includes('.m{}'));
});

test('색 조합 34가지 × 라이트·다크 대비', () => {
  for (const s of E.PALETTE_SEEDS) for (const t of ['light', 'dark']) {
    const k = E.themeTokens(E.presetWithOverrides({ preset: 'paper-workbook', palette: s.id }), t);
    assert.ok(E.contrast(k['--foreground'], k['--background']) >= 4.5, s.id + t);
    assert.ok(E.contrast(k['--muted-foreground'], k['--background']) >= 4.5, s.id + t + ' muted');
    assert.ok(E.contrast(k['--primary-foreground'], k['--primary']) >= 4.5, s.id + t + ' primary');
  }
});

test('암호 보호: 페이지·교재 그림을 잠그고 같은 암호로 풀린다', async () => {
  const { protectSite } = await import('../src/protect.js');
  const r = E.build(EX('data-lab'), { runtime: nodeRuntime(), assets: { 'assets/slides/slide-001.webp': new Uint8Array([1, 2, 3, 4]) } });
  r.files['index.html'] = r.files['index.html'].replace('</main>', '<img src="assets/slides/slide-001.webp" alt="1쪽"></main>');
  const out = await protectSite(r.files, '숲속1234', { runtime: nodeRuntime(), title: '데이터로 읽는 우리 반', iterations: 1000 });
  assert.ok(out['assets/unlock.js']);
  assert.ok(!out['assets/slides/slide-001.webp'] && out['assets/slides/slide-001.webp.enc']);
  assert.ok(!out['index.html'].includes('스프레드시트'), '잠긴 페이지에 본문이 보이면 안 됨');
  assert.match(out['robots.txt'], /Disallow/);
  const payload = JSON.parse(/<script type="application\/json" id="lp-locked">([\s\S]*?)<\/script>/.exec(out['index.html'])[1]);
  const subtle = globalThis.crypto.subtle;
  const derive = async (pw) => subtle.deriveKey({ name: 'PBKDF2', salt: Buffer.from(payload.salt, 'base64'), iterations: payload.iter, hash: 'SHA-256' }, await subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']), { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const dec = (key, u8) => subtle.decrypt({ name: 'AES-GCM', iv: u8.subarray(0, 12) }, key, u8.subarray(12));
  const key = await derive('숲속1234');
  const html = new TextDecoder().decode(await dec(key, new Uint8Array(Buffer.from(payload.data, 'base64'))));
  assert.ok(html.includes('스프레드시트') && html.includes('data-lp-enc-src="assets/slides/slide-001.webp.enc"'));
  assert.deepEqual([...new Uint8Array(await dec(key, out['assets/slides/slide-001.webp.enc']))], [1, 2, 3, 4]);
  await assert.rejects(async () => dec(await derive('틀린암호'), new Uint8Array(Buffer.from(payload.data, 'base64'))));
  await assert.rejects(() => protectSite(r.files, '12', { runtime: nodeRuntime() }));
});

test('보안: 사용자 자료가 엔진 파일을 덮어쓰지 못하고 스크립트·SVG는 빠진다', () => {
  const r = E.build(EX('sel-story'), { runtime: nodeRuntime(), assets: { 'assets/console.js': 'evil()', 'assets/lecpage.js': 'evil()', 'assets/theme.css': 'x', 'assets/media/a.svg': '<svg onload=alert(1)>', 'assets/media/x.html': '<script>', 'assets/media/교재.pptx': new Uint8Array([1]), 'assets/slides/slide-001.webp': new Uint8Array([2]) } });
  assert.ok(!String(r.files['assets/lecpage.js']).includes('evil()'));
  assert.ok(!String(r.files['assets/console.js'] || '').includes('evil()'));
  assert.ok(!r.files['assets/media/a.svg'] && !r.files['assets/media/x.html']);
  assert.ok(r.files['assets/media/교재.pptx'] && r.files['assets/slides/slide-001.webp']);
  assert.ok(r.warnings.some((w) => /허용되지 않는 자료/.test(w.message_ko)));
});

const BOARD_BP = (live) => ({ meta: { title: 't' }, live: { features: ['board'], url: 'https://example.org/x', ...live }, sections: [{ type: 'hero' }, { type: 'board' }] });
const fileInput = (r) => /<input type="file" name="files"/.test(r.files['index.html']);
const consoleBoard = (r) => JSON.parse(/<script type="application\/json" id="lp-blueprint">([\s\S]*?)<\/script>/.exec(r.files['console.html'])[1]).sections.find((s) => s.type === 'board');

test('보드 파일: 구글 시트는 live.uploads=true일 때만 파일 칸을 보이고, 강사 화면도 같은 값을 받음', () => {
  const sheets = E.build(BOARD_BP({ provider: 'sheets' }), { runtime: nodeRuntime() });
  assert.ok(!fileInput(sheets), '시트 기본(파일 올리기 꺼짐)에는 파일 칸이 없음');
  assert.match(sheets.files['index.html'], /data-max-files="0"/);
  assert.equal(consoleBoard(sheets).allowFiles, false, '강사 화면이 서버에 파일 끄기(ui.uploads=false)를 알림');
  const on = E.build(BOARD_BP({ provider: 'sheets', uploads: true }), { runtime: nodeRuntime() });
  assert.ok(fileInput(on) && consoleBoard(on).allowFiles === true, '시트에서 파일 올리기를 켰으면 보임');
  for (const provider of ['supabase', 'http', 'local']) assert.ok(fileInput(E.build(BOARD_BP({ provider }), { runtime: nodeRuntime() })), provider);
  assert.ok(!fileInput(E.build(BOARD_BP({ provider: 'http', uploads: false }), { runtime: nodeRuntime() })), '다른 서버도 uploads=false면 숨김');
  const off = BOARD_BP({ provider: 'supabase' }); off.sections[1].allowFiles = false;
  const r = E.build(off, { runtime: nodeRuntime() });
  assert.ok(!fileInput(r) && consoleBoard(r).allowFiles === false, 'allowFiles:false는 그대로');
});

test('개인정보 안내: 실제로 모으는 기록(설문·투표·입실·퇴실)과 익명 질문의 한계를 밝힘', () => {
  const bp = { meta: { title: 't' }, live: { provider: 'local', features: ['qa', 'help', 'progress', 'poll', 'attendance'] },
    sections: [{ type: 'hero' }, { type: 'qa' }, { type: 'poll', items: [{ id: 'p', question: '?', kind: 'word' }] }, { type: 'attendance' }, { type: 'survey', questions: [{ q: '좋았나요?', kind: 'scale' }] }] };
  const html = E.build(bp, { runtime: nodeRuntime() }).files['privacy.html'];
  for (const w of ['질문', '도움 요청', '실습 진행 상태', '투표 응답', '설문 응답', '입실·퇴실 시각', '임의 번호']) assert.ok(html.includes(w), w);
  assert.match(html, /익명 질문은 다른 참가자와 발표 화면에 이름이 보이지 않습니다\. 다만 서버에는/);
  const named = E.build({ ...bp, live: { ...bp.live, anonymous: false } }, { runtime: nodeRuntime() }).files['privacy.html'];
  assert.ok(!named.includes('익명 질문'), '익명이 아니면 문장을 넣지 않음');
  assert.ok(!html.includes('나눔 보드'), '보드가 없으면 보드 글을 적지 않음');
});

test('운영안내: 연결한 방식(live.provider)을 따르고 QR 안내문을 파일 목록에 넣음', () => {
  const base = { meta: { title: 't' }, sections: [{ type: 'hero' }, { type: 'qa' }] };
  const doc = (live, infra) => E.build({ ...base, live: { features: ['qa'], ...live } }, { runtime: nodeRuntime(), infra }).teacher['운영안내.md'];
  const sheets = doc({ provider: 'sheets', url: 'https://script.google.com/macros/s/x/exec' }, { size: 60, features: ['qa', 'progress'] });
  assert.match(sheets, /실시간 방식: 구글 시트/);
  assert.match(sheets, /## 운영 방식: 구글 시트/);
  assert.match(sheets, /추천한 방식: Supabase/, '추천과 다르면 추천을 한 줄로');
  assert.ok(!/실시간 방식: sheets/.test(sheets));
  assert.ok(sheets.includes('`poster.html` QR 안내문 인쇄') && sheets.includes('`console.html` 강사 화면'));
  const supa = doc({ provider: 'supabase', url: 'https://x.supabase.co', anonKey: 'k' }, { size: 60, features: ['qa'], duration: 'month' });
  assert.match(supa, /## 운영 방식: Supabase/);
  assert.ok(!supa.includes('추천한 방식') && supa.includes('주의'), '추천과 같으면 주의만');
  assert.match(doc({ provider: 'http', url: 'https://live.example.org' }), /실시간 방식: 내 서버·Cloudflare/);
  assert.match(doc({ provider: 'local' }), /실시간 방식: 이 컴퓨터에서만 시험[\s\S]*참가자 기기끼리는 이어지지 않습니다/);
  const none = E.build({ meta: { title: 't' }, sections: [{ type: 'hero' }] }, { runtime: nodeRuntime() }).teacher['운영안내.md'];
  assert.match(none, /실시간 방식: 없음/);
  assert.ok(!none.includes('console.html') && none.includes('poster.html'), '강사 화면이 없으면 목록에서 뺌');
});

test('짧은 주소: 사이트 주소와 따로 넘기고(QR·복사는 원래 주소), 안내문·발표 화면·공유 창에 원래 주소 자리를 둠', () => {
  const data = (html) => JSON.parse(/<script type="application\/json" id="lp-data">([\s\S]*?)<\/script>/.exec(html)[1].replace(/\\u003c/g, '<'));
  const bp = (meta) => ({ meta: { title: 't', ...meta }, sections: [{ type: 'hero' }, { type: 'qa' }], live: { provider: 'local', features: ['qa'] } });
  const r = E.build(bp({ siteUrl: 'https://maum.vercel.app/', shortUrl: 'https://joo.is/우리연수' }), { runtime: nodeRuntime() });
  const d = data(r.files['index.html']);
  assert.equal(d.siteUrl, 'https://maum.vercel.app/', 'QR에 들어갈 주소는 사이트 주소');
  assert.equal(decodeURI(d.shortUrl), 'https://joo.is/우리연수');
  assert.equal(data(r.files['screen.html']).shortUrl, d.shortUrl);
  // 짧은 주소만 받았을 때(skill에서 사이트 주소를 모를 때)도 siteUrl에 섞지 않음: 올린 뒤에는 그 페이지의 주소가 QR에 들어감
  const only = data(E.build(bp({ shortUrl: 'https://is.gd/tomika' }), { runtime: nodeRuntime() }).files['index.html']);
  assert.equal(only.siteUrl, ''); assert.equal(only.shortUrl, 'https://is.gd/tomika');
  assert.equal(data(E.build(bp({ shortUrl: 'javascript:alert(1)' }), { runtime: nodeRuntime() }).files['index.html']).shortUrl, '', '주소가 아닌 값은 버림');
  for (const [f, attr] of [['poster.html', 'data-url-full'], ['screen.html', 'data-join-full'], ['index.html', 'data-url-full']]) assert.ok(r.files[f].includes(attr), `${f}에 원래 주소 자리`);
  assert.ok(r.files['screen.html'].includes('data-join-zoom') && r.files['screen.html'].includes('data-joinbig'), '발표 화면에 QR 크게 보기');
  // 런타임: QR 둘레 여백 4칸(cellSize의 4배)을 그림 안에 넣음
  assert.match(r.files['assets/lecpage.js'], /createSvgTag\(\{ cellSize: 6, margin: 24/);
  assert.match(r.files['assets/screen.js'], /createSvgTag\(\{ cellSize: 6, margin: 24/);
});

test('올릴 곳 고르기: 앱은 Vercel, 명령을 쓰면 Cloudflare, 강사료가 있으면 Vercel 제외, 연결·지난번에 올린 곳 먼저', () => {
  assert.equal(E.decideHost({}).pick, 'vercel');
  assert.equal(E.decideHost({ skill: 'dev' }).pick, 'cloudflare');
  const paid = E.decideHost({ commercial: true });
  assert.ok(!paid.hosts.includes('vercel')); assert.equal(paid.pick, 'cloudflare'); assert.equal(paid.hosts[1], 'github-pages'); assert.ok(paid.warnings.length);
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
  assert.equal(E.decideHost({ commercial: true, maxFileMB: 40 }).pick, 'github-pages');
  assert.equal(E.decideHost({ skill: 'dev', files: 1500 }).pick, 'cloudflare', '명령으로 올리면 20,000개까지');
  assert.equal(E.decideHost({ skill: 'dev', files: 25000 }).pick, 'github-pages');
  assert.equal(E.decideHost({ files: 1500 }).pick, 'github-pages', '앱(끌어 놓기)은 1,000개까지');
  assert.ok(E.decideHost({ network: 'restricted' }).warnings.some((w) => /전날/.test(w)));
  assert.match(E.HOSTS.cloudflare.cli, /mktemp -d/);
  for (const h of E.decideHost({ instant: true }).hosts) assert.ok(E.HOSTS[h], h);
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
});
