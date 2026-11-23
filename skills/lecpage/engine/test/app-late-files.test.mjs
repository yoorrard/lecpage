// 미리보기·그려서 검사에서 '한 장 HTML에 못 담은 그림'(쪽이 많은 교재의 뒤쪽 쪽 그림): 엔진 previewHtml이 못 담은 경로를 알리고(skipped),
// 앱(app/src/lib/late-files.js)이 그 그림만 Blob으로 틀 안에 넘김. 예전에는 뒤쪽 쪽 그림이 미리보기에서 깨지고
// 검사가 "그림이 열리지 않아요(material/p-113.webp)"를 폭마다 8곳씩(16곳) 꼭 고칠 곳으로 알렸음(사이트 파일에는 그림이 다 있었음).
import test from 'node:test';
import assert from 'node:assert/strict';
import { previewHtml } from '../src/kit/index.js';

const late = await import(new URL('../../../../app/src/lib/late-files.js', import.meta.url).href);
const webp = (n, fill) => { const b = new Uint8Array(n).fill(fill); b.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]); return b; };

test('previewHtml: 크기 한도를 넘어 못 담은 그림을 skipped에 적고 그 주소는 그대로 둠', () => {
  const files = { 'index.html': '<!doctype html><html><head></head><body>' + [1, 2, 3, 4].map((n) => `<img src="material/p-00${n}.webp">`).join('') + '</body></html>' };
  for (const n of [1, 2, 3, 4]) files[`material/p-00${n}.webp`] = webp(1000, n);
  const skipped = new Set();
  const html = previewHtml(files, 'index.html', { maxImageBytes: 2500, skipped });
  assert.deepEqual([...skipped].sort(), ['material/p-003.webp', 'material/p-004.webp'], '한도(2500바이트) 안의 둘은 담고 뒤의 둘은 못 담음');
  assert.equal((html.match(/src="data:image\/webp/g) || []).length, 2);
  // 못 담은 그림은 빈 그림 주소 뒤에 경로를 달아 둠(깨진 주소로 열어 보지 않게): 틀 안 코드가 그 경로의 그림으로 바꿈
  assert.match(html, /src="data:image\/gif;base64,[A-Za-z0-9+/=]+#lp-late=material\/p-003\.webp"/); assert.match(html, /#lp-late=material\/p-004\.webp"/);
  assert.doesNotMatch(html, /src="material\//);
  // skipped를 주지 않으면(예전 부르는 쪽) 예전처럼 주소를 그대로 둠
  const old = previewHtml(files, 'index.html', { maxImageBytes: 2500 });
  assert.match(old, /src="material\/p-003\.webp"/); assert.doesNotMatch(old, /lp-late/);
  // 다 담기면 비어 있음
  const none = new Set(); previewHtml(files, 'index.html', { skipped: none }); assert.equal(none.size, 0);
});

test('lateFilesMsg: 사이트의 그림을 모두 Blob으로(못 담은 것만이 아님 — 스크립트가 실행 중에 만든 주소도 열리게), 글·모르는 형식은 넘기지 않음', async () => {
  const files = { 'material/p-003.webp': webp(1000, 3), 'material/p-004.webp': webp(800, 4), 'assets/style.css': 'a{}', 'assets/font.woff2': new Uint8Array(10) };
  assert.deepEqual(late.lateFilesMsg({ 'assets/style.css': 'a{}', 'assets/font.woff2': new Uint8Array(10) }, new Set(['assets/style.css', 'nope.webp'])), { type: 'lp-late-files', files: {} }); // 그림이 없어도 보냄('다 받았다')
  // 한 장 HTML에 다 담긴 사이트(skipped 없음)도 그림은 모두 넘김: AI 스크립트의 img.src = 'material/p-' + 쪽 + '.webp'가 미리보기에서 열림
  const all = late.lateFilesMsg(files, new Set());
  assert.deepEqual(Object.keys(all.files).sort(), ['material/p-003.webp', 'material/p-004.webp']);
  const m = late.lateFilesMsg(files, new Set(['material/p-003.webp', 'assets/style.css', 'nope.webp']));
  assert.equal(m.type, 'lp-late-files');
  assert.deepEqual(Object.keys(m.files).sort(), ['material/p-003.webp', 'material/p-004.webp']);
  assert.ok(m.files['material/p-003.webp'] instanceof Blob);
  assert.equal(m.files['material/p-003.webp'].type, 'image/webp'); assert.equal(m.files['material/p-003.webp'].size, 1000);
  assert.equal(new Uint8Array(await m.files['material/p-004.webp'].arrayBuffer())[20], 4);
  // 같은 바이트는 Blob을 다시 만들지 않음(폭마다 틀이 둘이어도 한 번)
  assert.equal(late.lateFilesMsg(files, new Set(['material/p-003.webp'])).files['material/p-003.webp'], m.files['material/p-003.webp']);
});

test('inSite: 사이트 파일에 있는 그림을 가리키는 주소만 참(미리보기에서만 못 여는 그림을 깨졌다고 알리지 않게), 없는 그림·바깥 주소·빈 파일은 거짓', () => {
  const files = { 'material/p-001.webp': webp(500, 1), 'assets/photo 1.png': new Uint8Array(40), 'material/empty.webp': new Uint8Array(0), 'index.html': '<html>', 'days/a.html': '<html>' };
  for (const src of ['material/p-001.webp', './material/p-001.webp', 'material/p-001.webp?v=2', '/material/p-001.webp', 'assets/photo%201.png', 'material/../material/p-001.webp']) assert.equal(late.inSite(files, src), true, src);
  assert.equal(late.inSite(files, '../material/p-001.webp', 'days/a.html'), true);
  for (const src of ['material/p-999.webp', 'material/empty.webp', 'https://example.com/material/p-001.webp', 'data:image/webp;base64,AA', 'blob:null/abc', '../material/p-001.webp', 'index.html', '', undefined]) assert.equal(late.inSite(files, src), false, String(src));
});

test('LATE_JS: 틀 안 코드가 부모가 보낸 것만 받고(e.source), 이미 있는 그림·나중에 넣는 주소·열다 실패한 그림을 모두 바꿈', () => {
  const js = late.LATE_JS;
  assert.match(js, /^<script>/); assert.match(js, /<\/script>$/);
  assert.match(js, /e\.source!==parent/); assert.match(js, /lp-late-files/); assert.match(js, /#lp-late=/);
  assert.match(js, /URL\.createObjectURL/); assert.match(js, /addEventListener\('error'/); assert.match(js, /HTMLImageElement\.prototype,'src'/); assert.match(js, /setAttribute/);
  assert.doesNotMatch(js.slice(8, -9), /<\/script/i, '글 안에서 script를 닫지 않음');
});

test('previewHtml: 담는 순서 — CSS·poster·srcset(틀 안에서 바꿔 주기 어려운 자리)을 먼저, <img src>·링크는 남은 크기만큼. 빈 그림은 <img src>에만', () => {
  const big = (n, f) => webp(n, f);
  const files = {
    'index.html': '<!doctype html><html><head><link rel="stylesheet" href="a.css"></head><body>'
      + '<img src="material/p-001.webp"><img src="material/p-002.webp">'
      + '<a href="material/p-002.webp">크게 보기</a>'
      + '<img src="pic/s1.webp" srcset="pic/s1.webp 1x, pic/s2.webp 2x"><video poster="pic/poster.webp"></video>'
      + '<div style="background:url(pic/bg2.webp)"></div></body></html>',
    'a.css': 'body{background:url(pic/bg.webp)}',
    'pic/bg.webp': big(300, 1), 'pic/bg2.webp': big(300, 2), 'pic/poster.webp': big(200, 3), 'pic/s1.webp': big(100, 4), 'pic/s2.webp': big(100, 5),
    'material/p-001.webp': big(900, 6), 'material/p-002.webp': big(900, 7),
  };
  // hard 합계 1,000바이트(배경 둘·poster·srcset 둘) + 쪽 그림 둘 1,800 → 한도 1,500이면 hard는 모두 담고 쪽 그림만 나중으로
  const skipped = new Set();
  const html = previewHtml(files, 'index.html', { maxImageBytes: 1500, skipped });
  assert.match(html, /body\{background:url\("data:image\/webp/, '문서 앞의 쪽 그림이 한도를 먼저 쓰지 않아 CSS 배경이 담김');
  assert.match(html, /<div style="background:url\(&quot;data:image\/webp|<div style="background:url\(&#34;data:image\/webp|<div style='background:url\("data:image\/webp/);
  assert.match(html, /poster="data:image\/webp/);
  assert.match(html, /srcset="data:image\/webp[^"]* 1x, data:image\/webp[^"]* 2x"/);
  assert.deepEqual([...skipped].sort(), ['material/p-001.webp', 'material/p-002.webp']);
  assert.equal((html.match(/#lp-late=/g) || []).length, 2, '빈 그림 주소는 <img src> 둘에만');
  assert.match(html, /<a href="material\/p-002\.webp">/, '링크는 빈 그림으로 바꾸지 않고 주소 그대로(앱이 새 탭에 실제 그림을 엶)');
  assert.doesNotMatch(html, /(href|srcset|poster|url\()[^>]{0,40}lp-late/);
  // 한도가 넉넉하면 전부 담김(예전과 같음)
  const none = new Set(); const full = previewHtml(files, 'index.html', { skipped: none });
  assert.equal(none.size, 0); assert.doesNotMatch(full, /lp-late|src="material\//); assert.match(full, /<a href="data:image\/webp/);
  // hard 자리 자체가 한도를 넘으면: 주소를 그대로 두고(빈 그림 아님) 그 그림을 따로 넘길 목록에 넣음 → 틀 안 코드가 srcset·poster를 바꿈
  const sk2 = new Set();
  const tight = previewHtml(files, 'index.html', { maxImageBytes: 350, skipped: sk2 });
  assert.match(tight, /poster="pic\/poster\.webp"/); assert.ok(sk2.has('pic/poster.webp') && sk2.has('pic/s2.webp'));
  assert.doesNotMatch(tight, /(href|srcset|poster|url\()[^>]{0,40}lp-late/);
});

test('LATE_JS: srcset·poster·링크 주소(a.href)로 쓴 같은 경로도 바꿈 · 예전 브라우저에서 글을 못 읽는 문법(뒤돌아보기 정규식)을 쓰지 않음', () => {
  const js = late.LATE_JS.replace(/^<script>/, '').replace(/<\/script>$/, '');
  assert.doesNotThrow(() => new Function(js), '스크립트로 읽힘');
  assert.match(js, /srcset/); assert.match(js, /poster/); assert.match(js, /source\[srcset\]/); assert.match(js, /baseURI/);
  assert.doesNotMatch(js, /\(\?<[=!]/, '뒤돌아보기 정규식 없음(Safari 16.3 이하에서 스크립트 전체가 읽히지 않음)');
  // srcset 고쳐 쓰기(fixSet)를 가짜 문서에서 돌려 봄: 여러 꼴의 srcset에서 따로 넘긴 경로만 Blob 주소로 바뀜
  const made = []; const attrs = { srcset: 'material/p-113.webp 1x,material/p-114.webp 2x, pic/x.png 3x' };
  const el = { tagName: 'IMG', getAttribute: (n) => attrs[n] ?? null };
  const listeners = {};
  const env = {
    document: { baseURI: 'https://lecpage.com/frame/?v=abc', images: [el], querySelectorAll: () => [] },
    HTMLImageElement: function () {}, Element: function () {}, URL: { createObjectURL: (b) => { made.push(b); return 'blob:null/' + made.length; } },
    addEventListener: (t, f) => { listeners[t] = f; }, parent: { postMessage() {} },
  };
  env.Element.prototype.setAttribute = function (n, v) { attrs[n] = v; };
  env.HTMLImageElement.prototype = {};
  new Function(...Object.keys(env), js)(...Object.values(env));
  listeners.message({ source: env.parent, data: { type: 'lp-late-files', files: { 'material/p-113.webp': {}, 'material/p-114.webp': {} } } });
  assert.equal(attrs.srcset, 'blob:null/1 1x, blob:null/2 2x, pic/x.png 3x');
  // 부모가 아닌 곳에서 온 것은 받지 않음
  attrs.srcset = 'material/p-115.webp 1x'; listeners.message({ source: {}, data: { type: 'lp-late-files', files: { 'material/p-115.webp': {} } } });
  assert.equal(attrs.srcset, 'material/p-115.webp 1x');
});
