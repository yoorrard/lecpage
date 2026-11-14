// 교재 글꼴 → 사이트 글꼴: 감지(PPTX 테마·글자 조각), 이름 맞추기, 빌드 반영
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync, zipSync, strFromU8, strToU8 } from '../vendor/fflate.js';
import { ingestFile, materialToDraft } from '../src/ingest/index.js';
import * as E from '../src/index.js';
import { nodeRuntime } from '../node.js';

const FX = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

/** workshop.pptx의 테마 글꼴을 바꾸고, 글자 조각에 직접 적힌 글꼴은 지워 테마 글꼴을 따르게 함 */
function pptxWithThemeFonts(major, minor) {
  const files = unzipSync(new Uint8Array(readFileSync(join(FX, 'workshop.pptx'))));
  const theme = strFromU8(files['ppt/theme/theme1.xml'])
    .replace(/(<a:majorFont>[\s\S]*?<a:font script="Hang" typeface=")[^"]*"/, `$1${major}"`)
    .replace(/(<a:minorFont>[\s\S]*?<a:font script="Hang" typeface=")[^"]*"/, `$1${minor}"`);
  files['ppt/theme/theme1.xml'] = strToU8(theme);
  for (const n of Object.keys(files)) if (/^ppt\/slides\/slide\d+\.xml$/.test(n)) files[n] = strToU8(strFromU8(files[n]).replace(/<a:(latin|ea) typeface="[^"]*"\/>/g, ''));
  return zipSync(files);
}

test('PPTX: 테마 제목·본문 글꼴을 제목/본문 역할로 센다', async () => {
  const m = await ingestFile('deck.pptx', pptxWithThemeFonts('HY헤드라인M', '나눔고딕'));
  assert.deepEqual(m.errors, []);
  const f = m.detected.fonts;
  assert.equal(f.display.name, 'HY헤드라인M');
  assert.equal(f.body.name, '나눔고딕');
  assert.ok(f.body.share > 0.9 && f.all.length >= 2);
});

test('PPTX: 글자 조각에 적힌 글꼴(맑은 고딕)도 센다', async () => {
  const m = await ingestFile('workshop.pptx', readFileSync(join(FX, 'workshop.pptx')));
  assert.equal(m.detected.fonts.body.name, '맑은 고딕');
  assert.equal(m.files[0].fonts.body[0].name, '맑은 고딕');
});

test('글꼴 이름 맞추기: 같은 글꼴·비슷한 무료 글꼴·기본 글꼴', () => {
  const cases = [
    ['ABCDEF+NanumGothicBold', 'body', 'nanumGothic', true],
    ['Pretendard-SemiBold', 'display', 'pretendard', true],
    ['NanumSquareOTF_acEB', 'display', 'nanumSquare', true],
    ['G마켓 산스 TTF Bold', 'display', 'gmarket', true],
    ['Noto Sans CJK KR', 'body', 'notoSans', true],
    ['본명조', 'display', 'notoSerif', true],
    ['배달의민족 도현', 'display', 'doHyeon', true],
    ['HY헤드라인M', 'display', 'blackHan', false],
    ['HY헤드라인M', 'body', 'pretendard', false],
    ['HY신명조', 'body', 'notoSerif', false],
    ['함초롬돋움', 'body', 'notoSans', false],
    ['나눔손글씨 펜', 'body', 'gowunDodum', false],
    ['어떤 붓글씨체', 'display', 'gaegu', false],
  ];
  for (const [name, role, id, exact] of cases) {
    const m = E.matchFont(name, role);
    assert.equal(m.id, id, name);
    assert.equal(m.exact, exact, name + ' exact');
    assert.ok(E.FONTS[m.id], m.id + ' 글꼴 목록에 있어야 함');
  }
  assert.equal(E.matchFont('맑은 고딕').system, true);
  assert.equal(E.matchFont('함초롬바탕').system, true);
  assert.equal(E.matchFont(''), null);
});

test('빌드: 교재 글꼴이 사이트 글꼴이 되고, 기본 글꼴은 프리셋을 지킨다', async () => {
  const m = await ingestFile('deck.pptx', pptxWithThemeFonts('HY헤드라인M', '나눔고딕'));
  const draft = materialToDraft(m, { title: '글꼴 연수' });
  assert.equal(draft.design.sourceFonts.display.name, 'HY헤드라인M');
  const bp = { ...draft, design: { ...draft.design, preset: 'calm-forest' } };
  const css = E.build(bp, { runtime: nodeRuntime() }).files['assets/theme.css'];
  assert.match(css, /--font-display:'Black Han Sans'/);
  assert.match(css, /--font-sans:'Nanum Gothic'/);
  assert.match(css, /--display-weight:400/, '한 굵기뿐인 글꼴은 가짜 굵게를 쓰지 않음');
  // 선생님이 프리셋 글꼴을 고르면 교재 글꼴을 쓰지 않음
  const css2 = E.build({ ...bp, design: { ...bp.design, fontFrom: 'preset' } }, { runtime: nodeRuntime() }).files['assets/theme.css'];
  assert.match(css2, /--font-display:'MaruBuri'/);
  // 맑은 고딕(프로그램 기본)은 '고른 글꼴'이 아니므로 프리셋 제목 글꼴 유지
  const css3 = E.build({ meta: { title: 'x' }, design: { preset: 'calm-forest', sourceFonts: { display: { name: '맑은 고딕', share: 1 }, body: { name: '맑은 고딕', share: 1 } } }, sections: [{ type: 'hero' }] }, { runtime: nodeRuntime() }).files['assets/theme.css'];
  assert.match(css3, /--font-display:'MaruBuri'/);
  // 글꼴 파일은 무료 웹 글꼴 주소만(버전 고정 CDN·구글·네이버)
  const r = E.build(bp, { runtime: nodeRuntime() });
  for (const u of r.files['index.html'].match(/<link rel="stylesheet" href="https:[^"]+"/g) || []) assert.match(u, /fonts\.googleapis\.com|cdn\.jsdelivr\.net\/(gh|npm)\/[^/]+@|hangeul\.pstatic\.net/, u);
});

test('글꼴 함께 담기(P2-4): 사이트에 쓰인 글자가 든 조각과 한글 조각만 사이트 안으로, 쪽은 외부 글꼴 주소 대신 assets/fonts.css', async () => {
  const r = E.build({ meta: { title: '가나다 연수' }, design: { preset: 'calm-forest' }, sections: [{ type: 'hero' }, { type: 'goals', items: ['가나다'] }] }, { runtime: nodeRuntime() });
  assert.ok(/<link rel="stylesheet" href="https:/.test(r.files['index.html']));
  const asked = [];
  // 가짜 CDN: 스타일시트마다 한글 조각(쓰인 글자 '가') · 사이트에 없는 글자만 든 한글 조각('챗' 등) · 안 쓰는 조각(일본 가나) · 라틴 조각
  let n = 0;
  const fakeFetch = async (url) => {
    asked.push(url);
    if (/\.woff2?$/.test(url)) return { ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3, n++]).buffer };
    return { ok: true, text: async () => `@font-face{font-family:'X';src:url(./a/ko.woff2) format('woff2');unicode-range:U+AC00-AC0F}\n@font-face{font-family:'X';src:url(./a/ko2.woff2) format('woff2');unicode-range:U+CC57-CC60}\n@font-face{font-family:'X';src:url(./a/kana.woff2) format('woff2');unicode-range:U+3040-309F}\n@font-face{font-family:'X';src:url(https://fonts.gstatic.com/s/x/latin.woff2) format('woff2');unicode-range:U+0000-00FF}` };
  };
  const { files, report } = await E.bundleFonts(r.files, { fetch: fakeFetch });
  assert.ok(report.ok, report.skipped.join());
  assert.ok(!asked.some((u) => u.endsWith('kana.woff2')), '쓰지 않는 글자 조각(한글 아님)은 받지 않음');
  assert.ok(asked.some((u) => u.endsWith('/a/ko.woff2')) && asked.some((u) => u.endsWith('latin.woff2')));
  // 한글 조각은 사이트에 없는 글자뿐이어도 담음: 참가자가 '챗'을 써도 같은 글꼴로(unicode-range라 첫 로딩에는 받지 않음)
  assert.ok(asked.some((u) => u.endsWith('/a/ko2.woff2')));
  assert.match(files['assets/fonts.css'], /unicode-range:\s*U\+CC57-CC60/);
  assert.equal(report.hangul, 'all');
  // 배포할 곳의 한도를 넘으면 한글 조각을 단계마다 덜 담음(마지막은 쓰인 글자가 든 조각만)
  const small = await E.bundleFonts(r.files, { fetch: fakeFetch, fits: (f) => Object.keys(f).filter((k) => k.startsWith('assets/fonts/')).length < 3 });
  assert.equal(small.report.hangul, 'none');
  assert.doesNotMatch(small.files['assets/fonts.css'], /U\+CC57/);
  assert.doesNotMatch(files['index.html'], /<link rel="stylesheet" href="https:/);
  assert.doesNotMatch(files['index.html'], /preconnect" href="https:\/\/fonts\.gstatic\.com/);
  assert.match(files['index.html'], /<link rel="stylesheet" href="assets\/fonts\.css">/);
  const css = files['assets/fonts.css'];
  for (const u of css.match(/url\(([^)]+)\)/g)) { const p = 'assets/' + u.slice(4, -1); assert.ok(files[p] instanceof Uint8Array, p); }
  assert.doesNotMatch(css, /kana/);
  // 하나라도 못 받으면 반쯤 담긴 사이트를 만들지 않고 원래대로
  const bad = await E.bundleFonts(r.files, { fetch: async () => ({ ok: false, status: 503 }) });
  assert.equal(bad.report.ok, false); assert.equal(bad.files, r.files);
  assert.deepEqual(E.parseRange('U+AC00-D7A3, U+0041, U+4??'), [[0xac00, 0xd7a3], [0x41, 0x41], [0x400, 0x4ff]]);
});

test('바깥 글꼴 스타일시트는 첫 화면을 붙잡지 않음(media="print" → 받은 뒤 boot.js가 all로): 글꼴 CDN이 응답 없이 막힌 망에서도 쪽이 뜸', () => {
  const r = E.build({ meta: { title: '가나다 연수' }, design: { preset: 'calm-forest' }, sections: [{ type: 'hero' }] }, { runtime: nodeRuntime() });
  for (const page of Object.keys(r.files).filter((k) => k.endsWith('.html'))) {
    const links = r.files[page].match(/<link rel="stylesheet" href="https:[^>]+>/g) || [];
    assert.ok(links.length, page);
    for (const l of links) assert.match(l, / media="print" data-lp-font>$/, page + ': ' + l);
    assert.ok(r.files[page].indexOf('data-lp-font') < r.files[page].indexOf('assets/boot.js'), 'boot.js가 글꼴 링크 뒤에 있어야 찾음');
  }
  assert.match(r.files['assets/boot.js'], /link\[data-lp-font\][\s\S]*media = 'all'/);
});

test('글꼴 함께 담기(학교망 기본값): woff2만 담고, 사이트가 쓰는 굵기로 브라우저가 고를 굵기만 남긴다(가변 굵기는 그대로)', async () => {
  const r = E.build({ meta: { title: '가나다 연수' }, design: { preset: 'calm-forest' }, sections: [{ type: 'hero' }] }, { runtime: nodeRuntime() });
  const w = E.usedWeights(r.files);
  assert.ok(w.includes(400) && w.includes(700));
  const asked = [];
  const face = (wt, n) => `@font-face{font-family:'S';font-weight:${wt};src:local('S'),url(./s${n}.woff2) format('woff2'),url(./s${n}.woff) format('woff'),url(./s${n}.ttf) format('truetype')}`;
  const fakeFetch = async (url) => {
    asked.push(url);
    if (/\.(woff2?|ttf)$/.test(url)) return { ok: true, arrayBuffer: async () => new Uint8Array([1]).buffer };
    return { ok: true, text: async () => [face(100, 1), face(300, 3), face(400, 4), face(700, 7), "@font-face{font-family:'V';font-weight:100 900;src:url(./v.woff2) format('woff2')}"].join('\n') };
  };
  // 사이트가 100·300을 쓰지 않으면(보통 400·700, 600은 700으로) 그 굵기 파일은 받지 않음
  const only = { ...r.files, 'assets/x.css': '.a{font-weight:600}' };
  for (const k of Object.keys(only)) if (typeof only[k] === 'string' && /\.(css|html)$/.test(k)) only[k] = only[k].replace(/weight\s*:\s*(100|200|300)\b/g, 'weight:400');
  const { files, report } = await E.bundleFonts(only, { fetch: fakeFetch });
  assert.ok(report.ok, report.skipped.join());
  assert.ok(!asked.some((u) => /\/s\d\.(woff|ttf)$/.test(u)), 'woff2가 있으면 woff·ttf는 받지 않음: ' + asked.join());
  assert.ok(!asked.some((u) => /s1\.woff2|s3\.woff2/.test(u)), '쓰지 않는 굵기는 받지 않음');
  assert.ok(asked.some((u) => /s4\.woff2/.test(u)) && asked.some((u) => /s7\.woff2/.test(u)) && asked.some((u) => /v\.woff2/.test(u)));
  assert.doesNotMatch(files['assets/fonts.css'], /format\('woff'\)|truetype/);
  assert.match(files['assets/fonts.css'], /local\('S'\)/, 'local()은 남김');
});
