// 한글 PDF 읽기 회귀 시험: 글꼴을 담지 않은 한글 PDF(공문·예전 PDF)는 한국어 CMap이 있어야 글자가 나옴. 그림으로 된 PDF(스캔본)는 실패로 알리지 않음.
// pdf.js: 맨 위 node_modules(CI) 또는 앱 node_modules에서 찾음. 둘 다 없으면 건너뜀
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ingestFile } from '../src/ingest/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../../..');
const FX = join(HERE, 'fixtures');
const read = (f) => new Uint8Array(readFileSync(join(FX, f)));
const dist = [join(ROOT, 'node_modules/pdfjs-dist'), join(ROOT, 'app/node_modules/pdfjs-dist'), process.env.PDFJS_DIST].filter(Boolean).find((d) => existsSync(join(d, 'legacy/build/pdf.mjs')));
const pdfjsLib = dist ? await import(pathToFileURL(join(dist, 'legacy/build/pdf.mjs')).href) : null;
const assets = dist ? { cMapUrl: join(dist, 'cmaps/'), standardFontDataUrl: join(dist, 'standard_fonts/') } : {};
const textOf = (m) => (m.pages || []).map((p) => [p.title, ...(p.paragraphs || []).map((x) => x.text)].join(' ')).join(' ');

test('글꼴을 담지 않은 한글 PDF: CMap으로 글자를 읽음(경고 없음)', { skip: !pdfjsLib && 'pdf.js 없음' }, async () => {
  const m = await ingestFile('ko-cid.pdf', read('ko-cid.pdf'), { pdfjsLib, ...assets });
  assert.equal(m.errors.length, 0);
  assert.equal(m.pages.length, 3);
  assert.match(textOf(m), /오늘의 순서/);
  assert.match(textOf(m), /좋은 질문 만들기/);
  assert.ok(!m.warnings.some((w) => w.code === 'no-text'), JSON.stringify(m.warnings));
});

test('CMap 자리를 주지 않으면 같은 PDF에서 글자가 나오지 않음(앱이 CMap을 꼭 줘야 하는 까닭)', { skip: !pdfjsLib && 'pdf.js 없음' }, async () => {
  const m = await ingestFile('ko-cid.pdf', read('ko-cid.pdf'), { pdfjsLib });
  assert.doesNotMatch(textOf(m), /오늘의 순서/);
});

test('앱: pdf.js에 CMap·표준 글꼴 자리를 주고, 빌드가 이 PDF에 필요한 한국어 CMap을 같은 출처로 냄', () => {
  const ingest = readFileSync(join(ROOT, 'app/src/lib/ingest.js'), 'utf8');
  assert.match(ingest, /cMapUrl: base \+ 'cmaps\/', cMapPacked: true, standardFontDataUrl/);
  assert.match(ingest, /ingestFile\(name, bytes, \{ pdfjsLib, withImages: false, .*\.\.\.PDF_ASSETS \}\)/); // 사이에 읽기 한도(readLimits)가 올 수 있음
  assert.match(ingest, /renderPdfPages\(bytes, \{[^}]*\.\.\.PDF_ASSETS \}\)/);
  const vite = readFileSync(join(ROOT, 'app/vite.config.js'), 'utf8');
  const re = new RegExp(/const KO_CMAP = \/(.+)\/;/.exec(vite)[1]);
  for (const f of ['UniKS-UCS2-H.bcmap', 'Adobe-Korea1-UCS2.bcmap', 'KSCms-UHC-H.bcmap', 'UniKS-UTF16-H.bcmap']) assert.ok(re.test(f), f);
});

test('그림으로 된 PDF(스캔본): 쪽은 그대로 읽고, 알림은 실패처럼 들리지 않게', { skip: !pdfjsLib && 'pdf.js 없음' }, async () => {
  const m = await ingestFile('scan.pdf', read('scan.pdf'), { pdfjsLib, ...assets });
  assert.equal(m.errors.length, 0);
  assert.equal(m.pages.length, 2);
  const w = m.warnings.find((x) => x.code === 'no-text');
  assert.ok(w, '그림 PDF 표시(앱은 이 알림을 숨김)');
  assert.doesNotMatch(w.message_ko, /읽을 수 없|직접 적어/);
  assert.match(w.message_ko, /AI가 쪽 그림을 보고 읽어요/);
});

test('앱: 그림으로 된 PDF 알림(no-text)은 교재 줄에 띄우지 않음', () => {
  const start = readFileSync(join(ROOT, 'app/src/pages/steps/Start.jsx'), 'utf8');
  assert.match(start, /w\.code === 'no-text'/);
  assert.doesNotMatch(start, /글자를 거의 읽지 못했어요/);
});

test('글자 코드표가 없는 PDF에서 기호로 바뀐 제목은 비움(교재 슬라이드 검색·강사 화면 쪽 목록)', async () => {
  const { tangledTitle } = await import('../src/kit/meta.js');
  for (const t of [',-', ':0;<=', 'AI >?/@', './0']) assert.equal(tangledTitle(t), true, t);
  for (const t of ['실습 1. 제미나이로 영상 요약하기', 'C++ <iostream> 기초', 'Q&A', '#해시태그 수업', 'PART 1', '"인공지능" 이해하기']) assert.equal(tangledTitle(t), false, t);
});
