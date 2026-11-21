// 교재 해석(ingest) 테스트: node --test skills/lecpage/engine/test
// 견본 교재는 test/fixtures/make_fixtures.py로 다시 만들 수 있습니다.
// PDF를 JS(pdf.js)로도 확인하려면 PDFJS_DIST=<pdfjs-dist 폴더> 를 주세요(없으면 파이썬 대체 경로만 확인).
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { zipSync, strToU8 } from '../vendor/fflate.js';
import {
  ingestFile, mergeMaterials, ingestText, ingestUrl, ingestPaths, materialToAIContext, materialToJSON,
  normText, exportUrlFor, imageFileName,
} from '../src/ingest/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FX = join(HERE, 'fixtures');
const SCRIPTS = join(HERE, '..', '..', 'scripts');
const read = (f) => readFileSync(join(FX, f));
const TODAY = '2026-11-09';
const key = (s) => String(s).replace(/\s+/g, '');
const hasPython = spawnSync('python3', ['-c', 'import pymupdf'], { encoding: 'utf8' }).status === 0
  || spawnSync('python3', ['-c', 'import fitz'], { encoding: 'utf8' }).status === 0;
const HANGUL_ERR = /[가-힣]/;

let pdfjsLib = null;
if (process.env.PDFJS_DIST) {
  try { pdfjsLib = await import(join(process.env.PDFJS_DIST, 'legacy/build/pdf.mjs')); } catch { pdfjsLib = null; }
}

// ── PPTX ──────────────────────────────────────────────
describe('PPTX', () => {
  let m;
  before(async () => { m = await ingestFile('workshop.pptx', read('workshop.pptx'), { today: TODAY, withImages: true }); });

  test('슬라이드 순서·제목·레이아웃', () => {
    assert.deepEqual(m.errors, []);
    assert.equal(m.files[0].type, 'pptx');
    assert.equal(m.files[0].id, 'deck1');
    assert.equal(m.pages.length, 13);
    assert.equal(m.files[0].pages, 13);
    assert.equal(m.pages[0].title, '생성형 AI로 여는 우리 반 수업');
    assert.equal(m.pages[0].layout, 'title');
    assert.equal(m.pages[3].layout, 'section');
    assert.equal(m.pages[7].title, '실습 1. 제미나이로 영상 요약하기');
    assert.equal(m.pages[11].title, '확인 퀴즈');
    assert.deepEqual(m.pages.map((p) => p.page), Array.from({ length: 13 }, (_, i) => i + 1));
  });

  test('문단 수준·자동 번호·노트·링크', () => {
    const p8 = m.pages[7];
    const nums = p8.paragraphs.filter((x) => x.num).map((x) => x.num);
    assert.deepEqual(nums, [1, 2, 3, 4]);
    assert.ok(p8.paragraphs.some((x) => x.text === '프롬프트: 이 영상을 한국어로 요약해줘'));
    assert.match(p8.notes, /3분 이내/);
    assert.deepEqual(p8.links.map((l) => [l.url, l.label]), [['https://gemini.google.com/', '제미나이 바로가기']]); // 글 속 주소와 중복 제거
    assert.equal(m.pages[10].links[0].label, 'NotebookLM 열기');
    assert.ok(m.pages[2].paragraphs.every((x) => x.bullet), '본문 자리표시자는 글머리표 상속');
  });

  test('그림(바이트)·표·반복 문구', () => {
    const im = m.pages[7].images[0];
    assert.equal(im.id, 'deck1-p8-1');
    assert.equal(im.mime, 'image/png');
    assert.ok(im.bytes instanceof Uint8Array && im.bytes[0] === 0x89 && im.bytes[1] === 0x50, 'PNG 바이트');
    assert.ok(im.width > 100 && im.share > 0);
    assert.equal(m.pages[4].tables[0].rows.length, 4);
    assert.deepEqual(m.pages[4].tables[0].rows[1], ['Gemini', '검색·요약', 'Google 계정']);
    assert.deepEqual(m.boilerplate.map((b) => b.text), ['○○교육지원청 AI 연수']);
    assert.ok(!m.pages.some((p) => p.paragraphs.some((x) => x.text === '○○교육지원청 AI 연수')));
  });

  test('디자인: 테마 색·글꼴·쪽 비율', () => {
    assert.equal(m.design.colors.accent1, '#4F81BD');
    assert.equal(m.design.fonts.major.latin, 'Calibri');
    assert.equal(m.design.fonts.major.ea, '맑은 고딕');
    assert.equal(m.design.fontsUsed[0].name, '맑은 고딕');
    assert.equal(m.design.slideSize.ratio, '16:9');
  });

  test('JSON으로 바꾸면 바이트가 빠짐', () => {
    const j = materialToJSON(m, { imageSrc: (im) => 'media/' + imageFileName(im) });
    const s = JSON.stringify(j);
    assert.ok(!s.includes('"bytes"'));
    assert.equal(j.pages[7].images[0].src, 'media/deck1-p8-1.png');
    assert.ok(s.length < 200000);
  });
});

// ── 감지 ──────────────────────────────────────────────

// ── 설계도 초안·AI 요약 ───────────────────────────────────
describe('AI에게 건넬 보조 글자(outline)', () => {
  let m;
  before(async () => { m = await ingestFile('workshop.pptx', read('workshop.pptx'), { today: TODAY }); });

  test('보조 글자: 쪽 번호·원문 그대로·노트·반복 문구는 한 번·길이 예산', () => {
    const full = materialToAIContext(m);
    assert.match(full, /## p\.8 실습 1\. 제미나이로 영상 요약하기/);
    assert.ok(full.includes('프롬프트: 이 영상을 한국어로 요약해줘'));
    assert.ok(full.includes('목표: [단원명] 수업에 쓸 활동지를 만들어 줘.'));
    assert.ok(full.includes('> 노트: 영상은 3분 이내'));
    assert.equal(full.split('○○교육지원청 AI 연수').length - 1, 1, '반복 문구는 머리말에 한 번만');
    for (const budget of [3000, 1500, 600]) {
      const small = materialToAIContext(m, { maxChars: budget });
      assert.ok(small.length <= budget, `${budget} 이하: ${small.length}`);
    }
  });
});

// ── DOCX·HWPX·MD·TXT ───────────────────────────────────
describe('문서형 자료', () => {
  test('DOCX: 제목 스타일로 나누기·목록·링크·표·그림', async () => {
    const m = await ingestFile('guide.docx', read('guide.docx'), { today: TODAY });
    assert.deepEqual(m.errors, []);
    assert.equal(m.files[0].type, 'docx');
    assert.equal(m.files[0].unit, 'section');
    assert.deepEqual(m.pages.map((p) => p.title), ['AI 연수 운영 안내서', '1. 연수 개요', '2. 실습 준비', '3. 실습 순서', '4. 도구 정리']);
    assert.ok(m.pages[2].paragraphs.every((x) => x.bullet));
    assert.deepEqual(m.pages[3].paragraphs.filter((x) => x.num).map((x) => x.num), [1, 2, 3]);
    assert.deepEqual(m.pages[3].links, [{ url: 'https://padlet.com/example/ai-training', label: '우리 연수 보드' }]);
    assert.equal(m.pages[4].tables[0].rows[2][0], 'Padlet');
    assert.equal(m.pages[4].images[0].path, 'word/media/image1.png');
  });

  test('HWPX: 본문·개요 제목·하이퍼링크 필드·표·그림·쪽 나눔', async () => {
    const m = await ingestFile('plan.hwpx', read('plan.hwpx'), { today: TODAY, withImages: true });
    assert.deepEqual(m.errors, []);
    assert.equal(m.files[0].type, 'hwpx');
    assert.equal(m.files[0].title, '교사 AI 연수 계획');
    assert.equal(m.files[0].author, '김하늘');
    assert.deepEqual(m.pages.map((p) => p.title), ['교사 AI 연수 계획', '실습 안내', '마무리']);
    assert.deepEqual(m.pages[0].links, [{ url: 'https://gemini.google.com/', label: '제미나이' }]);
    assert.deepEqual(m.pages[0].tables[0].rows, [['시간', '내용'], ['15:10~15:40', '패들렛으로 의견 모으기']]);
    assert.equal(m.pages[0].images[0].alt, '연수 장소 사진');
    assert.ok(m.pages[0].images[0].bytes.length > 100);
    assert.equal(m.pages[2].paragraphs[0].text, '배운 점을 한 줄로 남겨 주세요.\n감사합니다.', '줄바꿈 유지');
    assert.equal(m.design.fonts.major.ea, '함초롬바탕');
  });

  test('Markdown: 제목·코드 블록 프롬프트·링크', async () => {
    const m = await ingestFile('notes.md', read('notes.md'));
    assert.deepEqual(m.pages.map((p) => p.title), ['실습 메모', '프롬프트 모음', '링크']);
    assert.equal(m.pages[1].paragraphs[0].role, 'code');
    assert.match(m.pages[1].paragraphs[0].text, /^역할: 너는 중학교 국어 교사야\.\n목표: \[작품명\]/);
    assert.deepEqual(m.pages[2].links, [{ url: 'https://padlet.com/example/board', label: '패들렛 보드' }]);
  });

  test('TXT(EUC-KR)도 읽기', async () => {
    let bytes;
    try { bytes = new Uint8Array(Buffer.from('7JWI64WV', 'base64')); } catch { bytes = null; }
    // "안녕"을 CP949로: BE C8 B3 E7
    const cp949 = new Uint8Array([0xBE, 0xC8, 0xB3, 0xE7, 0x0A, 0xC7, 0xC1, 0xB7, 0xD2, 0xC7, 0xC1, 0xC6, 0xAE, 0x3A, 0x20, 0xBF, 0xE4, 0xBE, 0xE0, 0xC7, 0xD8, 0xC1, 0xE0]);
    const m = await ingestFile('memo.txt', cp949);
    assert.deepEqual(m.errors, []);
    assert.equal(m.pages[0].title, '안녕');
    assert.equal(m.pages[0].paragraphs[0].text, '프롬프트: 요약해줘');
    assert.ok(bytes);
  });

  test('붙여 넣은 글(ingestText)', () => {
    const m = ingestText('# AI 연수\n일시: 11월 4일(수) 15:10~16:40\n\n## 실습\n1. 패들렛 접속\n2. "학급 규칙을 정리해줘"라고 입력', { markdown: true, today: TODAY });
    assert.equal(m.files[0].type, 'md');
    assert.deepEqual(m.pages.map((p) => p.title), ['AI 연수', '실습']);
  });
});

// ── PDF ───────────────────────────────────────────────
describe('PDF', () => {
  test('Node에 pdf.js가 없으면 needs-pdfjs(파이썬 대체 신호)', { skip: !!pdfjsLib && 'pdf.js 있음' }, async () => {
    const m = await ingestFile('workshop.pdf', read('workshop.pdf'));
    if (m.pages.length) return; // pdfjs-dist가 설치된 환경
    assert.equal(m.errors[0].code, 'needs-pdfjs');
    assert.equal(m.errors[0].fallback, 'python');
    assert.ok(HANGUL_ERR.test(m.errors[0].message_ko));
  });

  test('pdf.js로 읽기(PDFJS_DIST 지정 시)', { skip: !pdfjsLib && 'PDFJS_DIST 없음' }, async () => {
    const base = process.env.PDFJS_DIST;
    const m = await ingestFile('workshop.pdf', read('workshop.pdf'), { today: TODAY, pdfjsLib, cMapUrl: join(base, 'cmaps/'), standardFontDataUrl: join(base, 'standard_fonts/') });
    assert.deepEqual(m.errors, []);
    assert.equal(m.pages.length, 13);
    assert.equal(key(m.pages[7].title), key('실습 1. 제미나이로 영상 요약하기'));
    assert.equal(m.pages[7].links[0].label, '제미나이 바로가기');
  });

  test('파이썬 보조 스크립트(ingest.py)로 같은 모양', { skip: !hasPython && 'PyMuPDF 없음' }, async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'lecpage-test-'));
    try {
      const out = join(tmp, 'm.json');
      const r = spawnSync('python3', ['-I', join(SCRIPTS, 'ingest.py'), join(FX, 'workshop.pdf'), '-o', out, '--images', join(tmp, 'img')], { encoding: 'utf8' });
      assert.equal(r.status, 0, r.stderr);
      const m = JSON.parse(readFileSync(out, 'utf8'));
      assert.equal(m.kind, 'lecpage-material');
      assert.equal(m.version, 1);
      assert.equal(m.files[0].type, 'pdf');
      assert.equal(m.pages.length, 13);
      for (const k of ['file', 'page', 'kind', 'title', 'paragraphs', 'notes', 'links', 'images', 'tables']) assert.ok(k in m.pages[0], k);
      assert.equal(m.pages[1].images[0].src, 'img/deck1-p2-1.png');
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  });

  test('ingestPaths: PDF는 파이썬으로 대신 읽고, PPTX와 짝지음(renderOf)', { skip: !hasPython && !pdfjsLib && 'PDF 도구 없음' }, async () => {
    const m = await ingestPaths([join(FX, 'workshop.pptx'), join(FX, 'workshop.pdf')], { today: TODAY, pdfjsLib: pdfjsLib || undefined, withImages: true });
    assert.deepEqual(m.errors, []);
    assert.deepEqual(m.files.map((f) => f.id), ['deck1', 'deck2']);
    assert.equal(m.files[1].renderOf, 'deck1');
    assert.equal(m.files[0].renderSource, 'deck2');
    assert.ok(!materialToAIContext(m).includes('deck2 p.'), 'PDF본(쪽 그림용)은 보조 글자에서 제외');
    const ids = m.pages.flatMap((p) => p.images.map((im) => im.id));
    assert.equal(new Set(ids).size, ids.length, '그림 id 중복 없음');
  });
});

// ── 합치기·링크 ───────────────────────────────────────────
describe('합치기·링크', () => {
  test('mergeMaterials: id 겹침 해결·그림 id 바꿈', async () => {
    const a = await ingestFile('a.pptx', read('workshop.pptx'));
    const b = await ingestFile('b.pptx', read('workshop.pptx'));
    const c = await ingestFile('guide.docx', read('guide.docx'));
    const m = mergeMaterials([c, a, b]);
    assert.deepEqual(m.files.map((f) => f.id), ['deck1', 'deck2', 'doc1'], '슬라이드 자료가 앞으로');
    assert.equal(m.pages.length, 13 + 13 + 5);
    assert.ok(m.pages.filter((p) => p.file === 'deck2').every((p) => p.images.every((im) => im.id.startsWith('deck2-'))));
  });

  test('구글 슬라이드 링크 → PPTX 내보내기 주소, 받기 실패 시 링크만', async () => {
    const url = 'https://docs.google.com/presentation/d/1AbCdEfGhIjKlMnOp/edit#slide=id.p';
    assert.equal(exportUrlFor(url).url, 'https://docs.google.com/presentation/d/1AbCdEfGhIjKlMnOp/export/pptx');
    const bytes = read('workshop.pptx');
    const ok = await ingestUrl(url, { fetch: async () => ({ ok: true, headers: new Map(), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }), today: TODAY });
    assert.equal(ok.pages.length, 13);
    assert.equal(ok.files[0].url, url);
    const fail = await ingestUrl(url, { fetch: async () => { throw new TypeError('Failed to fetch'); } });
    assert.equal(fail.files[0].type, 'link');
    assert.equal(fail.warnings[0].code, 'link-fetch-failed');
    const padlet = await ingestUrl('https://padlet.com/example/board', { fetch: null });
    assert.equal(padlet.pages[0].title, 'padlet.com', '링크만 받으면 주소의 이름');
    assert.equal(padlet.warnings[0].code, 'link-only');
    const bad = await ingestUrl('javascript:alert(1)');
    assert.equal(bad.errors[0].code, 'bad-url');
  });
});

// ── 오류·안전 ─────────────────────────────────────────────
describe('오류는 던지지 않고 한국어 안내로', () => {
  const cfb = new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1, ...new Array(600).fill(0)]);
  const cases = [
    ['빈 파일', 'a.pptx', new Uint8Array(0), 'empty'],
    ['망가진 한글(OLE 그릇만 있고 한글 문서가 아님)', '계획.hwp', cfb, 'corrupt'],
    ['예전 한글 3.0', '옛날.hwp', strToU8('HWP Document File V3.00 \x1a\x01\x02\x03\x04\x05'), 'legacy-hwp'],
    ['예전 파워포인트', '교재.ppt', cfb, 'legacy-ppt'],
    ['예전 워드', '안내.doc', cfb, 'legacy-doc'],
    ['암호 걸린 PPTX', '교재.pptx', cfb, 'encrypted'],
    ['DRM(소프트캠프)', '교재.pptx', strToU8('SCDSA002\x00\x00\x00' + 'x'.repeat(100)), 'drm'],
    ['DRM(알 수 없는 바이너리)', '교재.pptx', new Uint8Array(2000).map((_, i) => (i * 37) % 256), 'drm'],
    ['손상된 ZIP', '교재.pptx', read('workshop.pptx').subarray(0, 4000), 'corrupt'],
    ['엑셀', '명단.xlsx', zipSync({ 'xl/workbook.xml': strToU8('<workbook/>'), '[Content_Types].xml': strToU8('<Types/>') }), 'spreadsheet'],
    ['알 수 없는 ZIP', '묶음.zip', zipSync({ 'a.txt': strToU8('hello') }), 'unsupported'],
    ['알 수 없는 바이너리', 'x.bin', new Uint8Array(3000).map((_, i) => (i * 91) % 256), 'unsupported'],
  ];
  for (const [label, name, bytes, code] of cases) {
    test(label, async () => {
      const m = await ingestFile(name, bytes);
      assert.equal(m.errors.length, 1, JSON.stringify(m.errors));
      assert.equal(m.errors[0].code, code);
      assert.ok(HANGUL_ERR.test(m.errors[0].message_ko));
      assert.equal(m.pages.length, 0);
    });
  }

  test('크기 제한(maxBytes)', async () => {
    const m = await ingestFile('교재.pptx', read('workshop.pptx'), { maxBytes: 10_000 });
    assert.equal(m.errors[0].code, 'too-large');
    assert.match(m.errors[0].message_ko, /MB/);
  });

  test('압축 폭탄 방지(선언된 압축 해제 크기 합계)', async () => {
    const big = new Uint8Array(30 * 1024 * 1024); // 0으로 가득: 압축하면 매우 작음
    const bomb = zipSync({ 'ppt/presentation.xml': strToU8('<p:presentation/>'), 'ppt/media/big.bin': big }, { level: 9 });
    assert.ok(bomb.length < 200_000);
    const m = await ingestFile('bomb.pptx', bomb, { limits: { maxUncompressed: 5 * 1024 * 1024 } });
    assert.equal(m.errors[0].code, 'zip-bomb');
  });

  test('깨진 XML이 있어도 읽을 수 있는 만큼', async () => {
    const zip = zipSync({
      '[Content_Types].xml': strToU8('<Types/>'),
      'ppt/presentation.xml': strToU8('<p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst>'),
      'ppt/_rels/presentation.xml.rels': strToU8('<Relationships><Relationship Id="rId1" Type="http://x/slide" Target="slides/slide1.xml"/></Relationships>'),
      'ppt/slides/slide1.xml': strToU8('<p:sld xmlns:p="p" xmlns:a="a"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="t"/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>깨진 &amp; 제목</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:txBody><a:p><a:r><a:t>닫히지 않은 글'),
    });
    const m = await ingestFile('broken.pptx', zip);
    assert.deepEqual(m.errors, []);
    assert.equal(m.pages[0].title, '깨진 & 제목');
    assert.equal(m.pages[0].paragraphs[0].text, '닫히지 않은 글');
  });
});

// ── 도구 목록·날짜·글자 ──────────────────────────────────────
describe('글자 정리', () => {
  test('글자 정리: NFC·보이지 않는 글자·공백·줄바꿈', () => {
    const nfd = '한글'.normalize('NFD');
    assert.equal(normText(nfd), '한글');
    assert.equal(normText('  안녕  하세요​\r\n\n\n\n다음\t줄  '), '안녕 하세요\n\n다음 줄');
  });
});

// ── CLI ───────────────────────────────────────────────
describe('CLI', () => {
  test('render-slides.mjs(셸 없이): PDF → slide-001.*', { skip: spawnSync('pdftoppm', ['-v'], { encoding: 'utf8' }).error && 'pdftoppm 없음' }, () => {
    const tmp = mkdtempSync(join(tmpdir(), 'lecpage-render-'));
    try {
      const r = spawnSync(process.execPath, [join(SCRIPTS, 'render-slides.mjs'), join(FX, 'workshop.pdf'), tmp, '40'], { encoding: 'utf8' });
      assert.equal(r.status, 0, r.stderr);
      const files = readdirSync(tmp).sort();
      assert.equal(files.length, 13);
      assert.match(files[0], /^slide-001\.(webp|png)$/);
      assert.match(files[12], /^slide-013\./);
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  });
});
