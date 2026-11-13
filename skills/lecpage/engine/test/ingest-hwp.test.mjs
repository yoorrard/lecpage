// 예전 한글 파일(HWP 5.0) 읽기 시험: 같은 교재의 HWPX와 같은 Material이 나오는지, 암호·배포용 안내, 망가진 파일·압축 폭탄에 안전한지.
// 시험 파일은 fixtures/make_hwp.mjs가 HWPX를 HWP 5.0으로 바꿔 만듭니다(한글 프로그램 없이, 공개 형식 문서대로).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync, strToU8, deflateSync } from '../vendor/fflate.js';
import { ingestFile, ingestPaths } from '../src/ingest/index.js';
import { Cfb } from '../src/ingest/cfb.js';
import { hyperlinkUrl, readRecords, buildTree, inflateLimited } from '../src/ingest/hwp.js';
import { hwpxToHwp, writeCfb, record } from './fixtures/make_hwp.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FX = join(HERE, 'fixtures');
const read = (f) => new Uint8Array(readFileSync(join(FX, f)));
const TODAY = '2026-11-09';
// 비교: 파일 안 경로·이름·바이트는 형식마다 다르므로 빼고 쪽 모양만
const shape = (m) => JSON.parse(JSON.stringify(m.pages, (k, v) => (['path', 'name', 'bytes', 'mime', 'file'].includes(k) ? undefined : v)));

const NS = 'xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head"';
let pid = 0;
const hp = (inner, para = 0, extra = '') => `<hp:p id="${++pid}" paraPrIDRef="${para}" styleIDRef="0"${extra}>${inner.startsWith('<') ? inner : `<hp:run charPrIDRef="0"><hp:t>${inner}</hp:t></hp:run>`}</hp:p>`;
const hpTable = (rows) => `<hp:run charPrIDRef="0"><hp:tbl rowCnt="${rows.length}" colCnt="${rows[0].length}">${rows.map((r, ri) => `<hp:tr>${r.map((c, ci) => `<hp:tc><hp:subList>${hp(c)}</hp:subList><hp:cellAddr colAddr="${ci}" rowAddr="${ri}"/><hp:cellSpan colSpan="1" rowSpan="1"/></hp:tc>`).join('')}</hp:tr>`).join('')}</hp:tbl></hp:run>`;
const HEADER = `<hh:head ${NS}><hh:refList><hh:fontfaces><hh:fontface lang="HANGUL"><hh:font id="0" face="함초롬바탕"/><hh:font id="1" face="나눔고딕"/></hh:fontface><hh:fontface lang="LATIN"><hh:font id="0" face="함초롬바탕"/><hh:font id="1" face="나눔고딕"/></hh:fontface></hh:fontfaces>`
  + '<hh:charProperties><hh:charPr id="0" height="1000"><hh:fontRef hangul="0" latin="0"/></hh:charPr><hh:charPr id="1" height="1800"><hh:fontRef hangul="1" latin="1"/><hh:bold/></hh:charPr></hh:charProperties>'
  + '<hh:paraProperties><hh:paraPr id="0"><hh:heading type="NONE" idRef="0" level="0"/></hh:paraPr><hh:paraPr id="1"><hh:heading type="NUMBER" idRef="1" level="0"/></hh:paraPr><hh:paraPr id="2"><hh:heading type="OUTLINE" idRef="0" level="0"/></hh:paraPr><hh:paraPr id="3"><hh:heading type="BULLET" idRef="0" level="1"/></hh:paraPr></hh:paraProperties>'
  + '<hh:styles><hh:style id="0" type="PARA" name="바탕글" engName="Normal" paraPrIDRef="0" charPrIDRef="0"/></hh:styles></hh:refList></hh:head>';
const hwpx = (...sections) => zipSync({
  mimetype: strToU8('application/hwp+zip'),
  'Contents/header.xml': strToU8(HEADER),
  ...Object.fromEntries(sections.map((body, i) => [`Contents/section${i}.xml`, strToU8(`<hs:sec ${NS}>${body.join('')}</hs:sec>`)])),
});
const footNote = (text) => `<hp:run charPrIDRef="0"><hp:ctrl><hp:footNote number="1"><hp:subList>${hp(`<hp:run charPrIDRef="0"><hp:ctrl><hp:autoNum num="1" numType="FOOTNOTE"/></hp:ctrl><hp:t> ${text}</hp:t></hp:run>`)}</hp:subList></hp:footNote></hp:ctrl></hp:run>`;
const header = (text) => `<hp:run charPrIDRef="0"><hp:ctrl><hp:header id="1"><hp:subList>${hp(text)}</hp:subList></hp:header></hp:ctrl></hp:run>`;
const link = (label, url) => `<hp:run charPrIDRef="0"><hp:ctrl><hp:fieldBegin type="HYPERLINK"><hp:parameters><hp:stringParam name="Path">${url}</hp:stringParam></hp:parameters></hp:fieldBegin></hp:ctrl><hp:t>${label}</hp:t><hp:ctrl><hp:fieldEnd/></hp:ctrl></hp:run>`;
const textBox = (lines) => `<hp:run charPrIDRef="0"><hp:rect><hp:sz width="20000" height="5000"/><hp:drawText><hp:subList>${lines.map((t) => hp(t)).join('')}</hp:subList></hp:drawText></hp:rect></hp:run>`;
const big = (t) => `<hp:run charPrIDRef="1"><hp:t>${t}</hp:t></hp:run>`;

const SAFETY = [
  hp(header('가온중학교 안전부') + hpTable([['2026학년도 안전사고 대응 연수 자료']])),
  hp('□ 일시: 2026. 12. 10.(목) 15:30~17:00'), hp('□ 장소: 가온중학교 시청각실'), hp('□ 강사: 나도담(가온중학교 안전부장)'),
  hp(big('Ⅰ. 연수 목적'), 2), hp('가. 사고가 났을 때 무엇을 먼저 하는지 같은 순서로 안다.'),
  hp(big('Ⅱ. 대응 절차'), 2),
  hp('현장 안전을 확보한다.', 1),
  hp(`<hp:run charPrIDRef="0"><hp:t>중대사고</hp:t></hp:run>${footNote('중대사고: 3주 이상 입원한 경우(가상 기준).')}<hp:run charPrIDRef="0"><hp:t>는 1시간 이내에 보고한다.</hp:t></hp:run>`, 1),
  hp('사고 경위서를 당일 작성한다.', 1),
  hp('보건실 위치를 확인한다.', 3),
  hp(big('Ⅲ. 자료와 문의'), 2),
  hp(`<hp:run charPrIDRef="0"><hp:t>서식 받기: </hp:t></hp:run>${link('안전 서식 모음', 'https://example.org/forms?a=1;b=2')}`),
  hp(hpTable([['구분', '보고 기한'], ['중대사고', '1시간 이내'], ['일반 사고', '당일']])),
  hp(textBox(['예시: "3층 계단에서 넘어져 무릎을 다침"', '목격자: 담임'])),
  hp('<hp:run charPrIDRef="0"><hp:t>줄 바꿈<hp:lineBreak/>다음 줄</hp:t><hp:t>과<hp:tab/>탭</hp:t></hp:run>'),
];

describe('HWP 5.0: 같은 교재의 HWPX와 같은 결과', () => {
  test('견본 plan.hwp(plan.hwpx를 바꾼 것): 제목·하이퍼링크·표·그림·쪽 나눔·메타·글꼴', async () => {
    const x = await ingestFile('plan.hwpx', read('plan.hwpx'), { today: TODAY, withImages: true });
    const m = await ingestFile('plan.hwp', read('plan.hwp'), { today: TODAY, withImages: true });
    assert.deepEqual(m.errors, []);
    assert.equal(m.files[0].type, 'hwp');
    assert.equal(m.files[0].id, 'doc1');
    assert.equal(m.files[0].title, '교사 AI 연수 계획');
    assert.equal(m.files[0].author, '김하늘');
    assert.deepEqual(m.pages.map((p) => p.title), ['교사 AI 연수 계획', '실습 안내', '마무리']);
    assert.deepEqual(m.pages[0].links, [{ url: 'https://gemini.google.com/', label: '제미나이' }]);
    assert.deepEqual(m.pages[0].tables[0].rows, [['시간', '내용'], ['15:10~15:40', '패들렛으로 의견 모으기']]);
    assert.equal(m.pages[0].images[0].alt, '연수 장소 사진');
    assert.equal(m.pages[0].images[0].path, 'BinData/BIN0001.png');
    assert.deepEqual([...m.pages[0].images[0].bytes.subarray(0, 4)], [0x89, 0x50, 0x4E, 0x47], '압축을 푼 PNG');
    assert.deepEqual(m.pages[0].images[0].bytes, x.pages[0].images[0].bytes);
    assert.equal(m.pages[2].paragraphs[0].text, '배운 점을 한 줄로 남겨 주세요.\n감사합니다.', '줄바꿈 유지');
    assert.equal(m.design.fonts.major.ea, '함초롬바탕');
    assert.deepEqual(shape(m), shape(x));
    assert.deepEqual(m.files[0].fonts, x.files[0].fonts, '교재 글꼴(제목·본문)도 같음');
    assert.deepEqual(m.detected.prompts, x.detected.prompts);
    assert.equal(m.detected.event.venue, '한빛초등학교 시청각실');
  });

  test('번호·글머리표·개요 제목·각주·머리말·한 칸 표·글상자·링크 필드·줄바꿈과 탭·여러 구역', async () => {
    const src = hwpx(SAFETY, [hp(big('Ⅳ. 붙임'), 2), hp('둘째 구역 첫 문단')]);
    const x = await ingestFile('safety.hwpx', src, { today: TODAY });
    for (const opts of [{}, { compress: false }]) {
      const m = await ingestFile('safety.hwp', hwpxToHwp(src, opts), { today: TODAY });
      assert.deepEqual(m.errors, [], JSON.stringify(opts));
      assert.deepEqual(shape(m), shape(x), JSON.stringify(opts));
      assert.deepEqual(m.files[0].fonts, x.files[0].fonts);
    }
    const m = await ingestFile('safety.hwp', hwpxToHwp(src), { today: TODAY });
    assert.equal(m.pages[0].title, '2026학년도 안전사고 대응 연수 자료', '맨 앞 한 칸 표 = 문서 제목');
    const p2 = m.pages.find((p) => p.title === 'Ⅱ. 대응 절차');
    assert.deepEqual(p2.paragraphs.filter((x) => x.num).map((x) => x.num), [1, 2, 3]);
    assert.ok(p2.paragraphs.some((x) => x.text === '(각주) 중대사고: 3주 이상 입원한 경우(가상 기준).'));
    assert.ok(p2.paragraphs.some((x) => x.text === '중대사고는 1시간 이내에 보고한다.'));
    assert.ok(p2.paragraphs.some((x) => x.bullet && x.level === 1 && x.text === '보건실 위치를 확인한다.'));
    assert.ok(!JSON.stringify(m.pages).includes('가온중학교 안전부"'), '머리말은 본문이 아님');
    const p3 = m.pages.find((p) => p.title === 'Ⅲ. 자료와 문의');
    assert.deepEqual(p3.links, [{ url: 'https://example.org/forms?a=1;b=2', label: '안전 서식 모음' }], '주소 속 ;도 그대로');
    assert.deepEqual(p3.tables[0].rows[1], ['중대사고', '1시간 이내']);
    assert.ok(p3.paragraphs.some((x) => x.role === 'text' && x.text.startsWith('예시: "3층 계단에서')), '글상자 글');
    assert.ok(p3.paragraphs.some((x) => x.text === '줄 바꿈\n다음 줄과 탭'));
    assert.equal(m.pages[m.pages.length - 1].title, 'Ⅳ. 붙임');
    assert.deepEqual(m.files[0].fonts.display[0], { name: '나눔고딕', n: m.files[0].fonts.display[0].n }, '큰 제목 글꼴 = 제목 글꼴');
    assert.equal(m.detected.instructor?.name, '나도담');
  });

  test('4095바이트가 넘는 문단(긴 레코드 크기)', async () => {
    const long = '가나다라마바사아자차 '.repeat(300).trim();
    const src = hwpx([hp(big('긴 문단 시험'), 2), hp(long), hp('끝')]);
    const m = await ingestFile('long.hwp', hwpxToHwp(src));
    assert.deepEqual(m.errors, []);
    assert.equal(m.pages[0].paragraphs[0].text, long);
    assert.equal(m.pages[0].paragraphs[1].text, '끝');
  });

  test('CLI 경로(ingestPaths)도 .hwp를 엔진으로 읽음', async () => {
    const m = await ingestPaths([join(FX, 'plan.hwp')], { withImages: false });
    assert.deepEqual(m.errors, []);
    assert.equal(m.files[0].type, 'hwp');
    assert.equal(m.pages.length, 3);
  });
});

describe('HWP 5.0: 읽을 수 없는 문서는 알기 쉬운 안내로', () => {
  const src = hwpx([hp('내용')]);
  const cases = [
    ['암호 걸린 문서', { password: true }, 'encrypted'],
    ['배포용 문서', { distribution: true }, 'hwp-distribution'],
    ['DRM 문서', { drm: true }, 'drm'],
  ];
  for (const [label, opts, code] of cases) {
    test(label, async () => {
      const m = await ingestFile('계획.hwp', hwpxToHwp(src, opts));
      assert.equal(m.errors.length, 1);
      assert.equal(m.errors[0].code, code);
      assert.match(m.errors[0].message_ko, /[가-힣]/);
      assert.equal(m.pages.length, 0);
    });
  }
  test('배포용 안내 문구: 원본이나 PDF를 올리라고', async () => {
    const m = await ingestFile('계획.hwp', hwpxToHwp(src, { distribution: true }));
    assert.match(m.errors[0].message_ko, /배포용/);
    assert.match(m.errors[0].message_ko, /PDF/);
  });
  test('한글 97 이전(HWP 3.0)은 다시 저장 안내', async () => {
    const m = await ingestFile('옛날.hwp', strToU8('HWP Document File V3.00 \x1a\x01\x02\x03\x04\x05' + 'x'.repeat(200)));
    assert.equal(m.errors[0].code, 'legacy-hwp');
    assert.match(m.errors[0].message_ko, /한글 97/);
  });
  test('이름만 .hwp인 HWPX·워드도 내용대로 읽음', async () => {
    const m = await ingestFile('계획.hwp', read('plan.hwpx'));
    assert.equal(m.files[0].type, 'hwpx');
    assert.deepEqual(m.errors, []);
  });
  test('한글이 아닌 OLE 파일(.ppt)은 지금처럼 PPTX로 저장 안내', async () => {
    const ole = writeCfb([['PowerPoint Document', new Uint8Array(100)], ['Current User', new Uint8Array(20)]]);
    assert.equal((await ingestFile('교재.ppt', ole)).errors[0].code, 'legacy-ppt');
    assert.equal((await ingestFile('교재.hwp', ole)).errors[0].code, 'corrupt');
  });
});

// ── 안전: 망가진 파일·폭탄·이상한 길이 ───────────────────
/** CFB 안 디렉터리 항목의 바이트 위치(이름으로 찾기) */
function entryOffset(bytes, name) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dirStart = dv.getUint32(48, true);
  const base = (dirStart + 1) * 512;
  for (let o = base; o + 128 <= bytes.length; o += 128) {
    let s = '';
    for (let i = 0; i < 31; i++) { const c = dv.getUint16(o + i * 2, true); if (!c) break; s += String.fromCharCode(c); }
    if (s === name) return o;
  }
  return -1;
}
const fileHeader = (flags = 1) => { const b = new Uint8Array(256); b.set(strToU8('HWP Document File')); new DataView(b.buffer).setUint32(32, 0x05000107, true); new DataView(b.buffer).setUint32(36, flags, true); return b; };
const docInfoBytes = () => deflateSync(new Uint8Array(0));

describe('HWP 5.0: 망가진 파일·폭탄에도 멈추지 않고 안내', () => {
  test('압축 폭탄: 본문이 상한(maxXmlBytes)보다 크게 풀리면 멈춤', async () => {
    const bomb = deflateSync(new Uint8Array(8 * 1024 * 1024)); // 8MB 0 → 수 KB
    assert.ok(bomb.length < 20000);
    const f = writeCfb([['FileHeader', fileHeader()], ['DocInfo', docInfoBytes()], ['BodyText/Section0', bomb]]);
    const t0 = Date.now();
    const m = await ingestFile('폭탄.hwp', f, { limits: { maxXmlBytes: 1024 * 1024 } });
    assert.equal(m.errors[0].code, 'zip-bomb');
    assert.ok(Date.now() - t0 < 3000);
    assert.throws(() => inflateLimited(bomb, 1000), (e) => e.code === 'zip-bomb');
  });

  test('디렉터리의 스트림 크기가 엄청 크면 읽지 않음', async () => {
    const f = hwpxToHwp(hwpx([hp('내용')]));
    const o = entryOffset(f, 'DocInfo');
    new DataView(f.buffer, f.byteOffset).setUint32(o + 120, 0x7FFFFFFF, true);
    const m = await ingestFile('큰값.hwp', f);
    assert.equal(m.errors[0].code, 'zip-bomb');
  });

  test('섹터 사슬이 제자리로 돌아와도(FAT 순환) 멈춤', () => {
    const f = writeCfb([['Big', new Uint8Array(6000).fill(7)], ['Small', new Uint8Array(10)]]);
    const c0 = new Cfb(f);
    const start = c0.entry('Big').start;
    const dv = new DataView(f.buffer, f.byteOffset);
    const fatSec = dv.getUint32(76, true);
    dv.setUint32((fatSec + 1) * 512 + (start + 1) * 4, start, true); // 둘째 섹터가 첫 섹터를 가리킴
    const c = new Cfb(f);
    assert.equal(c.get('Big').length, 1024, '되돌아오는 곳에서 끊김');
  });

  test('디렉터리 형제가 서로를 가리켜도(순환) 멈춤', () => {
    const f = writeCfb([['A', new Uint8Array(10)], ['B', new Uint8Array(10)], ['C', new Uint8Array(10)]]);
    const dv = new DataView(f.buffer, f.byteOffset);
    for (const n of ['A', 'B', 'C']) { const o = entryOffset(f, n); dv.setUint32(o + 68, 1, true); dv.setUint32(o + 72, 2, true); }
    const c = new Cfb(f);
    assert.ok(c.paths.size <= 3);
  });

  test('레코드 크기가 남은 길이보다 크면 거기까지만, 레코드 수 상한', () => {
    const recs = readRecords(new Uint8Array([...record(66, 0, new Uint8Array(22)), 0x42, 0x00, 0xF0, 0xFF, 0xFF, 0xFF, 0xFF, 0x7F, 1, 2, 3]), { records: 0, max: 100 });
    assert.equal(recs.length, 1);
    const many = new Uint8Array(4 * 1000); // 크기 0 레코드 1000개
    assert.throws(() => readRecords(many, { records: 0, max: 500 }), (e) => e.code === 'zip-bomb');
  });

  test('수준이 끝없이 깊어져도 나무 깊이 상한', () => {
    const recs = Array.from({ length: 5000 }, (_, i) => ({ tag: 66, level: Math.min(i, 1023), data: new Uint8Array(22), children: [] }));
    const root = buildTree(recs, 64);
    let depth = 0;
    for (let n = root; n.children.length; n = n.children[n.children.length - 1]) depth++;
    assert.ok(depth <= 64);
  });

  test('표 속 표가 아주 깊어도(재귀) 멈춤', async () => {
    let cell = '깊은 칸';
    for (let i = 0; i < 40; i++) cell = hpTable([[cell, `칸${i}`]]).replace(/^/, '');
    // 가장 바깥 표만 문단으로
    const body = [hp(big('깊은 표'), 2), `<hp:p id="9999" paraPrIDRef="0" styleIDRef="0">${cell}</hp:p>`];
    const m = await ingestFile('깊은표.hwp', hwpxToHwp(hwpx(body)));
    assert.deepEqual(m.errors, []);
    assert.equal(m.pages[0].title, '깊은 표');
  });

  test('반쯤 잘린 파일·바이트가 뒤섞인 파일도 예외 없이 끝남', async () => {
    const good = read('plan.hwp');
    for (const cut of [600, 1500, 3000, good.length - 100]) {
      const m = await ingestFile('잘림.hwp', good.subarray(0, cut));
      assert.ok(m.errors.length || m.pages.length >= 0);
    }
    let seed = 12345;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF; return seed; };
    const t0 = Date.now();
    for (let k = 0; k < 150; k++) {
      const b = good.slice();
      for (let j = 0; j < 12; j++) b[512 + (rnd() % (b.length - 512))] = rnd() & 255;
      const m = await ingestFile('섞임.hwp', b);
      assert.ok(Array.isArray(m.errors) && Array.isArray(m.pages));
    }
    assert.ok(Date.now() - t0 < 15000, '섞인 파일 150개를 15초 안에');
  });

  test('하이퍼링크 명령의 \\ 풀기', () => {
    assert.equal(hyperlinkUrl('https\\://gemini.google.com;1;0;0;'), 'https://gemini.google.com');
    assert.equal(hyperlinkUrl('https\\://a.kr/x\\;y;1;0;0;'), 'https://a.kr/x;y');
    assert.equal(hyperlinkUrl(''), '');
  });
});
