// 글꼴 줄이기(font-subset.js)와 글꼴 함께 담기의 결과(내용 해시 이름·캐시 머리글·unicode-range·미리 받기)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as E from '../src/index.js';
import { subsetFont, readFont, readCmap, unicodeRange } from '../src/font-subset.js';
import { nodeRuntime } from '../node.js';

// ── 시험용 작은 TrueType 글꼴: 글자마다 세모 하나(좌표가 달라 글리프가 서로 다름) ──
const be = (n, v) => { const a = []; for (let i = n - 1; i >= 0; i--) a.push((v >>> (i * 8)) & 255); return a; };
const sfnt = (tables) => {
  const tags = Object.keys(tables).sort(), n = tags.length;
  const head = [...be(4, 0x00010000), ...be(2, n), ...be(2, 16), ...be(2, 0), ...be(2, n * 16 - 16)];
  let off = 12 + n * 16; const dir = [], body = [];
  for (const t of tags) { const d = tables[t]; dir.push(...[...t].map((c) => c.charCodeAt(0)), ...be(4, 0), ...be(4, off), ...be(4, d.length)); const p = [...d]; while (p.length % 4) p.push(0); body.push(...p); off += p.length; }
  return Uint8Array.from([...head, ...dir, ...body]);
};
/**
 * chars: 글자마다 단순 글리프. extra: 글자표에 없는 글리프(GSUB 대체 결과), comp: [글자, 부품 글자] 합성 글리프, sub: [글자, extra 번째] GSUB 한 글자 대체
 */
function tinyFont(chars, { extra = 0, comp = [], sub = [] } = {}) {
  const glyphs = [[]]; // 0번 .notdef 비움
  const tri = (k) => [0, 1, ...be(2, 0), ...be(2, 0), ...be(2, 500 + k), ...be(2, 700), ...be(2, 2), ...be(2, 0), 1, 1, 1, ...be(2, 0), ...be(2, 500 + k), ...be(2, -500 - k + 0x10000).slice(0), ...be(2, 0), ...be(2, 0), ...be(2, 700)];
  const cmap = new Map();
  chars.forEach((c, i) => { cmap.set(c.codePointAt(0), glyphs.length); glyphs.push(tri(i + 1)); });
  const extraAt = glyphs.length; for (let i = 0; i < extra; i++) glyphs.push(tri(100 + i));
  for (const [c, part] of comp) { cmap.set(c.codePointAt(0), glyphs.length); glyphs.push([0xff, 0xff, ...be(2, 0), ...be(2, 0), ...be(2, 600), ...be(2, 700), ...be(2, 0x0002), ...be(2, cmap.get(part.codePointAt(0))), 0, 0]); }
  const num = glyphs.length, loca = [], glyf = [];
  for (const g of glyphs) { loca.push(...be(4, glyf.length)); glyf.push(...g); while (glyf.length % 4) glyf.push(0); }
  loca.push(...be(4, glyf.length));
  const segs = [...cmap.entries()].sort((a, b) => a[0] - b[0]).map(([c, g]) => [c, c, g]).concat([[0xffff, 0xffff, 1]]);
  const sc = segs.length, f4 = [...be(2, 4), ...be(2, 16 + sc * 8), ...be(2, 0), ...be(2, sc * 2), ...be(2, 2), ...be(2, 0), ...be(2, sc * 2 - 2)];
  segs.forEach((s) => f4.push(...be(2, s[1]))); f4.push(0, 0); segs.forEach((s) => f4.push(...be(2, s[0]))); segs.forEach((s) => f4.push(...be(2, (s[2] - s[0]) & 0xffff))); segs.forEach(() => f4.push(0, 0));
  const tables = {
    head: [...be(4, 0x00010000), ...be(4, 0x00010000), ...be(4, 0), ...be(4, 0x5f0f3cf5), ...be(2, 0), ...be(2, 1000), ...new Array(16).fill(0), ...be(2, 0), ...be(2, 0), ...be(2, 1000), ...be(2, 1000), ...be(2, 0), ...be(2, 8), ...be(2, 2), ...be(2, 1), ...be(2, 0)],
    hhea: [...be(4, 0x00010000), ...be(2, 800), ...be(2, 0xff38), ...be(2, 0), ...be(2, 1000), ...new Array(22).fill(0), ...be(2, num)],
    maxp: [...be(4, 0x00005000), ...be(2, num)],
    hmtx: glyphs.flatMap((g, i) => [...be(2, 1000), ...be(2, i ? 7 : 0)]),
    cmap: [...be(2, 0), ...be(2, 1), ...be(2, 3), ...be(2, 1), ...be(4, 12), ...f4],
    loca, glyf,
    post: [...be(4, 0x00030000), ...new Array(28).fill(0)],
  };
  if (sub.length) {
    // GSUB: 찾아보기 1개(종류 1, 형식 2): sub의 글자 → extra 글리프
    const cov = [...be(2, 1), ...be(2, sub.length), ...sub.flatMap(([c]) => be(2, cmap.get(c.codePointAt(0))))];
    const st = [...be(2, 2), ...be(2, 6 + sub.length * 2), ...be(2, sub.length), ...sub.flatMap(([, k]) => be(2, extraAt + k)), ...cov];
    const lookup = [...be(2, 1), ...be(2, 0), ...be(2, 1), ...be(2, 8), ...st];
    tables.GSUB = [...be(4, 0x00010000), ...be(2, 10), ...be(2, 12), ...be(2, 14), 0, 0, 0, 0, ...be(2, 1), ...be(2, 4), ...lookup];
  }
  for (const k of Object.keys(tables)) tables[k] = Uint8Array.from(tables[k]);
  return sfnt(tables);
}
const glyphLen = async (bytes, cp) => {
  const f = await readFont(bytes); const cm = readCmap(f.tables.get('cmap'));
  const g = cm.get(cp); if (g === undefined) return -1;
  const head = f.tables.get('head'), loca = f.tables.get('loca'), long = head[51] === 1;
  const at = (i) => (long ? new DataView(loca.buffer, loca.byteOffset).getUint32(i * 4) : new DataView(loca.buffer, loca.byteOffset).getUint16(i * 2) * 2);
  return at(g + 1) - at(g);
};

test('글꼴 줄이기: 남길 글자만 글자표·글리프에 남고(번호는 그대로), 합성 부품·GSUB 대체 글리프는 함께 남는다', async () => {
  const font = tinyFont(['A', '가', '나', '다', '라'], { extra: 2, comp: [['Ä', 'A']], sub: [['나', 1]] });
  const r = await subsetFont(font, new Set([...'가나Ä'].map((c) => c.codePointAt(0))));
  assert.ok(r, '줄인 결과');
  assert.deepEqual(r.kept, [0xc4, 0xac00, 0xb098]);
  assert.equal(r.cover.length, 6);
  const f = await readFont(r.data);
  assert.ok(f, r.format + '를 다시 읽음');
  assert.deepEqual([...readCmap(f.tables.get('cmap')).keys()].sort((a, b) => a - b), r.kept, '글자표에는 남긴 글자만(없는 글자는 다음 글꼴로 넘어감)');
  const orig = await readFont(font), n0 = new DataView(orig.tables.get('maxp').buffer, orig.tables.get('maxp').byteOffset).getUint16(4);
  assert.equal(new DataView(f.tables.get('maxp').buffer, f.tables.get('maxp').byteOffset).getUint16(4), n0, '글리프 번호(개수) 유지 → GPOS·GSUB·너비가 그대로 맞음');
  // 글리프 자료: 남긴 글자는 원본과 같은 길이, 버린 글자는 비움
  const raw = await subsetFont(font, new Set(readCmap(orig.tables.get('cmap')).keys()));
  assert.ok(raw);
  assert.ok(await glyphLen(r.data, 0xac00) > 0);
  // 버린 '다'의 글리프는 글자표에서 빠짐. 부품 'A'(글자표에서는 빠짐)와 GSUB 대체 글리프(extra 1)는 비우지 않음
  const loca = (x) => { const t = x.tables.get('loca'), long = x.tables.get('head')[51] === 1, dv = new DataView(t.buffer, t.byteOffset); return (i) => (long ? dv.getUint32(i * 4 + 4) - dv.getUint32(i * 4) : (dv.getUint16(i * 2 + 2) - dv.getUint16(i * 2)) * 2); };
  const len = loca(f);
  assert.ok(len(1) > 0, '합성 글리프의 부품(A)은 남김');
  assert.equal(len(4), 0, '쓰지 않는 다는 비움');
  assert.equal(len(5), 0, '쓰지 않는 라는 비움');
  assert.ok(len(7) > 0, 'GSUB로 나에서 바뀌는 글리프는 남김');
  assert.equal(len(6), 0, '아무도 부르지 않는 대체 글리프는 비움');
  // 범위(나눠 받기 조각): 그 범위의 글자만 맡음
  const part = await subsetFont(font, new Set([0xac00, 0xb098]), { range: [[0xac00, 0xac00]] });
  assert.deepEqual(part.cover, [0xac00]); assert.deepEqual(part.kept, [0xac00]);
  assert.equal(await subsetFont(new Uint8Array([1, 2, 3]), new Set([65])), null, '글꼴이 아니면 null(통째로 둠)');
  assert.equal(unicodeRange([0x20, 0x21, 0x22, 0xac00, 0xac02]), 'U+20-22,U+ac00,U+ac02');
  assert.equal(unicodeRange([0xac00, 0xac02, 0xad00], 64), 'U+ac00-ac02,U+ad00');
});

test('글꼴 함께 담기: 파일 이름은 내용 해시, 원본 뒤에 사이트 글자만 남긴 같은 글꼴, 미리 받기·1년 캐시 머리글', async () => {
  const r = E.build({ meta: { title: '가나다 연수' }, design: { preset: 'calm-forest' }, sections: [{ type: 'hero' }, { type: 'goals', items: ['가나다'] }] }, { runtime: nodeRuntime() });
  const font = tinyFont(['A', ...'가나다뷁똠쀍휅꿻뙠땷쏾쭯']); // 가나다만 사이트 글자
  const asked = [];
  const fakeFetch = async (url) => {
    asked.push(url);
    if (/\.(woff2?|ttf)$/.test(url)) return { ok: true, arrayBuffer: async () => font.slice().buffer };
    return { ok: true, text: async () => "@font-face{font-family:'X';font-weight:400;src:url(./x.ttf) format('truetype');font-display:swap}" };
  };
  const { files, report } = await E.bundleFonts(r.files, { fetch: fakeFetch });
  assert.ok(report.ok, report.skipped.join());
  assert.ok(report.subset >= 1, '줄인 글꼴이 있음');
  const names = Object.keys(files).filter((k) => k.startsWith('assets/fonts/'));
  for (const n of names) {
    const want = createHash('sha256').update(files[n]).digest('hex').slice(0, 16);
    assert.match(n, new RegExp(`^assets/fonts/${want}\\.(woff2|woff|ttf)$`), '이름 = 내용 SHA-256 앞 16자리(내용이 바뀌면 이름도 바뀜)');
  }
  // fonts.css: 원본(그 글꼴에 있는 글자 범위) 다음에 줄인 것(사이트 글자만)
  const css = files['assets/fonts.css'];
  const blocks = [...new Set(css.match(/@font-face\s*\{[^}]*\}/g))]; // 가짜 CDN은 스타일시트마다 같은 글을 줌
  assert.equal(blocks.length, 2);
  const range = (b) => E.parseRange(/unicode-range:([^;}]+)/.exec(b)[1]);
  const inR = (rg, c) => rg.some(([a, b]) => c >= a && c <= b);
  const [full, sub] = blocks.map(range);
  assert.ok(inR(full, 0xbdc1) && inR(full, 0xac00), '원본은 글꼴의 글자 전체(참가자가 쓴 새 글자 뷁은 원본이 맡음)');
  assert.ok(inR(sub, 0xac00) && inR(sub, 0xb098) && !inR(sub, 0xbdc1), '줄인 것은 사이트 글자만');
  assert.ok(!inR(full, 0x1f600), '글꼴에 없는 글자(이모지)로 원본을 받지 않음');
  const fileOf = (b) => 'assets/' + /url\(([^)]+)\)/.exec(b)[1];
  assert.ok(files[fileOf(blocks[1])].byteLength < files[fileOf(blocks[0])].byteLength, '줄인 파일이 더 작음');
  assert.equal(blocks[0].includes('font-weight:400') && blocks[1].includes('font-weight:400'), true, '같은 굵기·같은 이름으로 선언(같은 글꼴로 이어짐)');
  // 제목 글꼴(calm-forest는 theme.css의 마루 부리): 줄인 파일을 미리 받기. 원본 woff2를 줄였으므로 alt(woff)는 받지 않음
  assert.ok(!asked.some((u) => /MaruBuri-\w+\.woff$/.test(u)), 'brotli가 되는 곳은 woff2를 그대로 읽음(alt woff를 받지 않음)');
  assert.ok(report.preload.length >= 1 && report.preload.length <= 2);
  for (const p of report.preload) assert.ok(files[p], p);
  assert.match(files['index.html'], new RegExp(`<link rel="preload" href="${report.preload[0]}" as="font" type="font/woff2" crossorigin>\\n<link rel="stylesheet" href="assets/fonts\\.css">`));
  assert.match(files['screen.html'], /<link rel="preload" href="assets\/fonts\/[0-9a-f]{16}\.woff2" as="font"/, '발표 화면도 미리 받기');
  // 캐시: 이름이 내용 해시인 글꼴만 1년(immutable)
  assert.match(files._headers, /\n\/assets\/fonts\/\*\n {2}Cache-Control: public, max-age=31536000, immutable\n/);
  assert.equal((files._headers.match(/\/assets\/fonts\/\*/g) || []).length, 1);
  // 줄이기를 끄면 원본만(예전처럼)
  const plain = await E.bundleFonts(r.files, { fetch: fakeFetch, subset: false });
  assert.equal(plain.report.subset, 0);
  assert.equal(new Set(plain.files['assets/fonts.css'].match(/@font-face\s*\{[^}]*\}/g)).size, 1);
});

test('글꼴 함께 담기(brotli가 없는 브라우저): 우리 글꼴 목록의 alt(같은 글꼴로 확인한 woff)로 줄이고, 원본은 더 작은 woff2 그대로', async () => {
  const r = E.build({ meta: { title: '가나다 연수' }, design: { preset: 'calm-forest' }, sections: [{ type: 'hero' }] }, { runtime: nodeRuntime() });
  assert.doesNotMatch(r.files['assets/theme.css'], /MaruBuri-\w+\.woff'\)/, '쪽에는 woff2만(alt는 담을 때만 씀)');
  for (const f of Object.values(E.FONTS)) for (const x of f.face || []) if (x.alt) assert.match(x.alt, /^https:\/\/hangeul\.pstatic\.net\/.+\.woff$/, '같은 글꼴로 확인한 네이버 woff만');
  const font = tinyFont(['A', ...'가나다뷁똠쀍휅꿻뙠땷쏾쭯']);
  const woff2ish = Uint8Array.from([...[...'wOF2'].map((c) => c.charCodeAt(0)), ...new Array(60).fill(0)]); // 풀 수 없는 woff2
  const asked = [];
  const fakeFetch = async (url) => {
    asked.push(url);
    if (/\.woff2$/.test(url)) return { ok: true, arrayBuffer: async () => woff2ish.slice().buffer };
    if (/\.(woff|ttf)$/.test(url)) return { ok: true, arrayBuffer: async () => font.slice().buffer };
    return { ok: true, text: async () => '' };
  };
  const saved = { D: globalThis.DecompressionStream, C: globalThis.CompressionStream };
  globalThis.DecompressionStream = class extends saved.D { constructor(f) { if (f === 'brotli') throw new TypeError('no brotli'); super(f); } };
  globalThis.CompressionStream = class extends saved.C { constructor(f) { if (f === 'brotli') throw new TypeError('no brotli'); super(f); } };
  try {
    const { files, report } = await E.bundleFonts(r.files, { fetch: fakeFetch });
    assert.ok(report.ok, report.skipped.join());
    assert.ok(asked.some((u) => /MaruBuri-[A-Za-z]+\.woff$/.test(u)), 'alt woff를 받아 줄임');
    const faces = files['assets/theme.css'].match(/@font-face\{font-family:'MaruBuri'[^}]*\}/g);
    assert.equal(faces.length, 2);
    assert.match(faces[0], /\.woff2\) format\('woff2'\)/, '원본은 woff2(alt와 같은 글꼴)');
    assert.match(faces[1], /\.woff\) format\('woff'\)/, '줄인 것은 brotli 없이 쓸 수 있는 woff');
    assert.equal(files['assets/' + /url\(([^)]+)\)/.exec(faces[0])[1]].byteLength, woff2ish.byteLength, '원본 자리는 받은 woff2 그 파일(alt woff는 담지 않음)');
    for (const k of Object.keys(files).filter((x) => x.startsWith('assets/fonts/'))) assert.ok((files['assets/fonts.css'] + files['assets/theme.css']).includes(k.slice(7)), '가리키지 않는 글꼴 파일은 담지 않음: ' + k);
  } finally { globalThis.DecompressionStream = saved.D; globalThis.CompressionStream = saved.C; }
});
