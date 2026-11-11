import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkPath, typeOf, extOf, requestPath, TYPES, IGNORED } from '../src/paths.js';
import { buildSite, ENGINE } from './helpers.mjs';

test('받는 경로', () => {
  for (const p of ['index.html', 'robots.txt', 'assets/lecpage.js', 'assets/favicon.svg', 'assets/files/연수_활동지_최종_.pdf', 'assets/files/2027 연수 안내(수정).hwpx', 'assets/media/사진 (1).png', 'assets/media/교재[최종]_v2.pdf', 'assets/media/a.png.enc', 'assets/slides/slide-01.webp', 'assets/media/ㅋㅋ.png', 'a/b/c/d/e/f/g/h.png', 'x'.repeat(195) + '.html']) {
    assert.equal(checkPath(p), '', p);
  }
});

test('안 받는 경로', () => {
  const bad = ['', '/index.html', 'a//b.html', 'a/', '../a.html', 'a/../b.html', 'a/./b.html', '..', '.', '.env', 'a/.hidden.txt', '.well-known/x.json', 'a\\b.html', 'a\u0000.html', 'a\nb.html', 'a?.html', 'a#b.html',
    'a%2e.html', 'a<b>.html', 'a"b.html', "a'b.html", 'a&b.html', 'a+b.html', 'a:b.html', 'a;b.html', 'a|b.html', 'a*b.html', ' a.html', 'a.html ', 'dir /a.html', 'a.', 'a..html', 'x'.repeat(197) + '.html',
    'a/b/c/d/e/f/g/h/i.png', '사진.png'.normalize('NFD'), 'ｆｕｌｌ.html', 'é.html', '日本.html', 'a​b.html', 'a‮b.html'];
  for (const p of bad) assert.notEqual(checkPath(p), '', JSON.stringify(p));
  for (const p of [null, undefined, 1, {}, ['a.html']]) assert.notEqual(checkPath(p), '');
});

test('형식은 확장자로만 정함', () => {
  assert.equal(extOf('a/b.TAR.GZ'), 'gz');
  assert.equal(extOf('noext'), '');
  assert.equal(extOf('a.b/noext'), '');
  assert.equal(typeOf('index.html').kind, 'html');
  assert.equal(typeOf('assets/x.js').kind, 'js');
  assert.equal(typeOf('assets/x.js').type, 'text/javascript; charset=utf-8');
  assert.equal(typeOf('a.svg').kind, 'svg');
  assert.equal(typeOf('A.PNG').type, 'image/png');
  assert.equal(typeOf('a.png.enc').type, 'application/octet-stream');
  assert.equal(typeOf('a.webmanifest').type, 'application/manifest+json; charset=utf-8');
  // 사무용·압축·iWork·ODF 문서와 csv·md는 열지 않고 내려받기만
  for (const ext of ['ppt', 'pptx', 'ppsx', 'doc', 'docx', 'xls', 'xlsx', 'hwp', 'hwpx', 'zip', 'key', 'pages', 'numbers', 'odt', 'odp', 'ods', 'csv', 'md']) assert.equal(typeOf(`assets/files/a.${ext}`).download, true, ext);
  for (const ext of ['html', 'css', 'js', 'json', 'txt', 'svg', 'png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'ico', 'woff2', 'pdf', 'mp3', 'm4a', 'mp4', 'webm']) assert.ok(!typeOf(`a.${ext}`).download, ext);
  assert.equal(typeOf('assets/files/연수_활동지_최종_.pdf').type, 'application/pdf');
  assert.equal(typeOf('assets/files/표.csv').type, 'text/csv; charset=utf-8');
  assert.equal(typeOf('assets/files/읽어 보기.md').type, 'text/markdown; charset=utf-8');
  for (const p of ['a.php', 'a.mjs', 'a.htm', 'a.xhtml', 'a.xml', 'a.exe', 'a.wasm', 'a.rtf', 'a.dmg', 'a.apk', 'a.bat', 'a.jar', 'a', '_headers', 'a.html.bak', 'a.constructor', 'a.__proto__', 'a.toString']) assert.equal(typeOf(p), null, p);
  // 내려받기 전용 형식은 브라우저가 문서로 열 형식(html·svg·xml·js)이 아님
  for (const [ext, t] of Object.entries(TYPES)) if (t.download) assert.ok(!/html|svg|xml(?!formats)|javascript/.test(t.type.replace('openxmlformats', '')), ext);
  // 다른 출처에서 불러 쓸 일이 없는 것만 same-origin. 그림은 앱이 "열리는지 확인"할 때 불러 감
  assert.equal(typeOf('a.js').sameOrigin, true);
  assert.equal(typeOf('a.css').sameOrigin, true);
  assert.equal(typeOf('assets/favicon.svg').sameOrigin, false);
  assert.equal(typeOf('a.png').sameOrigin, false);
  assert.equal(typeOf('index.html').sameOrigin, false);
  // 형식표의 Content-Type에 스크립트로 읽힐 것은 js뿐
  const scripty = Object.entries(TYPES).filter(([, t]) => /javascript|ecmascript/.test(t.type)).map(([e]) => e);
  assert.deepEqual(scripty, ['js']);
});

test('주소 → 파일 경로', () => {
  assert.equal(requestPath(''), 'index.html');
  assert.equal(requestPath(undefined), 'index.html');
  assert.equal(requestPath('sub/'), 'sub/index.html');
  assert.equal(requestPath('console.html'), 'console.html');
  assert.equal(requestPath('assets/media/%EC%82%AC%EC%A7%84%20(1).png'), 'assets/media/사진 (1).png');
  assert.equal(requestPath('assets/media/handout%5B%EC%B5%9C%EC%A2%85%5D.pdf.enc'), 'assets/media/handout[최종].pdf.enc');
  assert.equal(requestPath(encodeURI('assets/files/연수_활동지_최종_.pdf')), 'assets/files/연수_활동지_최종_.pdf');
  for (const p of ['%2e%2e/x.html', '..%2fx.html', '%', '%zz', 'a%00.html', '%2Fetc/passwd', 'a%5Cb.html', '/x.html']) assert.equal(requestPath(p), null, p);
});

test('엔진이 실제로 만드는 파일은 모두 받음', async () => {
  const png = new Uint8Array([137, 80, 78, 71]);
  const files = await buildSite('sel-story', { password: '봄날1234', assets: { 'assets/media/사진 (1).png': png, 'assets/media/교재[최종].pptx': png, 'assets/slides/slide-01.webp': png } });
  const more = await buildSite('data-lab', { assets: { 'assets/media/수업 영상.mp4': png, 'assets/media/소리.mp3': png, 'assets/files/연수_활동지_최종_.pdf': png, 'assets/files/참고 자료(2027).hwpx': png, 'assets/files/명단.csv': png, 'assets/files/발표.key': png } });
  const all = [...Object.keys(files), ...Object.keys(more)];
  assert.ok(all.includes('assets/unlock.js') && all.some((p) => p.endsWith('.png.enc')) && all.includes('assets/media/수업 영상.mp4'), '암호 사이트·한글 이름이 들어 있어야 함');
  for (const p of ['assets/files/연수_활동지_최종_.pdf', 'assets/files/참고 자료(2027).hwpx', 'assets/files/명단.csv', 'assets/files/발표.key']) assert.ok(all.includes(p), `엔진이 내려받기 자료를 뺐어요: ${p}`);
  for (const p of all) {
    if (IGNORED.has(p)) continue;
    assert.equal(checkPath(p), '', p);
    assert.ok(typeOf(p), `형식표에 없음: ${p}`);
  }
});

test('엔진의 USER_ASSET 확장자는 형식표에 다 있음', () => {
  const src = readFileSync(join(ENGINE, 'src', 'build.js'), 'utf8');
  const m = /USER_ASSET = \/.*\\\.\(([^)]+)\)\$\/i/.exec(src);
  assert.ok(m, 'build.js에서 USER_ASSET을 찾지 못함');
  // 'pptx?' → ppt, pptx / 'jpe?g' → jpg, jpeg
  const exts = m[1].split('|').flatMap((e) => { const q = /^(.*)(.)\?(.*)$/.exec(e); return q ? [q[1] + q[3], q[1] + q[2] + q[3]] : [e]; });
  assert.ok(exts.every((e) => /^[a-z0-9]+$/.test(e)), `USER_ASSET 확장자 모양이 바뀜: ${m[1]}`);
  assert.deepEqual([...exts].sort(), ['avif', 'csv', 'doc', 'docx', 'gif', 'hwp', 'hwpx', 'jpeg', 'jpg', 'key', 'm4a', 'md', 'mp3', 'mp4', 'numbers', 'odp', 'ods', 'odt', 'pages', 'pdf', 'png', 'ppsx', 'ppt', 'pptx', 'txt', 'webm', 'webp', 'xls', 'xlsx', 'zip'], '엔진의 USER_ASSET 확장자가 바뀌면 src/paths.js의 TYPES도 맞춰 주세요');
  for (const e of exts) assert.ok(Object.hasOwn(TYPES, e), `엔진이 받는 .${e}가 호스트 형식표에 없음`);
  // 사용자 자료로 받는 형식 가운데 화면에서 바로 여는 것은 그림·소리·영상·PDF·txt뿐
  const inline = exts.filter((e) => !TYPES[e].download).sort();
  assert.deepEqual(inline, ['avif', 'gif', 'jpeg', 'jpg', 'm4a', 'mp3', 'mp4', 'pdf', 'png', 'txt', 'webm', 'webp']);
  assert.ok(/\(\?:slides\|media\|files\)/.test(src), 'USER_ASSET 폴더(slides·media·files)');
});
