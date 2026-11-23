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

test('lateFilesMsg: 못 담은 그림만 Blob으로(글·모르는 형식은 넘기지 않음), 없으면 null', async () => {
  const files = { 'material/p-003.webp': webp(1000, 3), 'material/p-004.webp': webp(800, 4), 'assets/style.css': 'a{}', 'assets/font.woff2': new Uint8Array(10) };
  assert.equal(late.lateFilesMsg(files, new Set()), null);
  assert.equal(late.lateFilesMsg(files, new Set(['assets/style.css', 'assets/font.woff2', 'nope.webp'])), null);
  const m = late.lateFilesMsg(files, new Set(['material/p-003.webp', 'material/p-004.webp', 'assets/style.css']));
  assert.equal(m.type, 'lp-late-files');
  assert.deepEqual(Object.keys(m.files).sort(), ['material/p-003.webp', 'material/p-004.webp']);
  assert.ok(m.files['material/p-003.webp'] instanceof Blob);
  assert.equal(m.files['material/p-003.webp'].type, 'image/webp'); assert.equal(m.files['material/p-003.webp'].size, 1000);
  assert.equal(new Uint8Array(await m.files['material/p-004.webp'].arrayBuffer())[20], 4);
  // 같은 바이트는 Blob을 다시 만들지 않음(폭마다 틀이 둘이어도 한 번)
  assert.equal(late.lateFilesMsg(files, new Set(['material/p-003.webp'])).files['material/p-003.webp'], m.files['material/p-003.webp']);
});

test('LATE_JS: 틀 안 코드가 부모가 보낸 것만 받고(e.source), 이미 있는 그림·나중에 넣는 주소·열다 실패한 그림을 모두 바꿈', () => {
  const js = late.LATE_JS;
  assert.match(js, /^<script>/); assert.match(js, /<\/script>$/);
  assert.match(js, /e\.source!==parent/); assert.match(js, /lp-late-files/); assert.match(js, /#lp-late=/);
  assert.match(js, /URL\.createObjectURL/); assert.match(js, /addEventListener\('error'/); assert.match(js, /HTMLImageElement\.prototype,'src'/); assert.match(js, /setAttribute/);
  assert.doesNotMatch(js.slice(8, -9), /<\/script/i, '글 안에서 script를 닫지 않음');
});
