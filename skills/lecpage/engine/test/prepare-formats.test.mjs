// 받는 교재 형식마다(PDF·PPTX·PPSX·DOCX·HWP·HWPX·글·예전 PPT) lecpage 커넥트 묶음만 있는 PC에서 prepare가 무엇을 내놓는지.
// 그 PC에는 Node와 묶음뿐: LibreOffice·poppler(pdftoppm)·파이썬·오피스·한글이 없음 → PATH를 빈 폴더로 두고 --no-python으로 흉내 냄.
// 보는 것: 형식마다 읽히는지, 에이전트가 볼 수 없는 것(글자·단추에 걸린 링크 주소)이 links.md에 남는지, 읽지 못한 교재를 말없이 빼지 않는지,
// 앱이 그려 보낸 쪽 그림(LECPAGE_GIVEN_IMAGES)을 쪽에 맞출 때 틀린 짝을 알리지 않는지(숨긴 슬라이드·한글/워드의 '부분'·교재 여럿).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { unzipSync, zipSync, strFromU8, strToU8 } from '../vendor/fflate.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, '..', '..', 'scripts', 'lecpage.mjs');
const FX = join(HERE, 'fixtures');
const T = mkdtempSync(join(tmpdir(), 'lp-formats-'));
const BARE = join(T, 'no-programs'); mkdirSync(BARE);
after(() => rmSync(T, { recursive: true, force: true }));
// PDF는 pdf.js가 있어야 읽음(묶음에는 들어 있고, 저장소에서는 CI처럼 npm install --no-save pdfjs-dist)
const hasPdfjs = (() => { try { createRequire(import.meta.url).resolve('pdfjs-dist/legacy/build/pdf.mjs'); return true; } catch { return false; } })();
const noPdf = !hasPdfjs && 'pdfjs-dist 없음';
const WEBP = Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64');
const fx = (n) => join(FX, n);
const pad3 = (n) => String(n).padStart(3, '0');

/** 묶음만 있는 PC처럼 prepare. given: 미리 놓아 둘 쪽 그림 장수(앱이 그려 보낸 것), of: 그 교재 이름 */
function prepare(files, { given = 0, of = '', env = {} } = {}) {
  const work = mkdtempSync(join(T, 'w-'));
  if (given) { mkdirSync(join(work, 'site', 'material'), { recursive: true }); for (let i = 1; i <= given; i++) writeFileSync(join(work, 'site', 'material', `p-${pad3(i)}.webp`), WEBP); }
  const base = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(path|node_path|lecpage_.*)$/i.test(k)));
  const r = spawnSync(process.execPath, [CLI, 'prepare', ...files, '-o', work, '--json', '--no-python'], { encoding: 'utf8', env: { ...base, PATH: BARE, NODE_USE_ENV_PROXY: '1', ...(given ? { LECPAGE_GIVEN_IMAGES: '1', LECPAGE_GIVEN_IMAGES_OF: of } : {}), ...env } });
  let j = null; try { j = JSON.parse(String(r.stdout).trim().split('\n').pop()); } catch { /* 아래에서 실패로 */ }
  assert.ok(j, `prepare가 JSON을 내지 않았어요: ${String(r.stdout).slice(-300)} ${String(r.stderr).slice(-300)}`);
  const read = (n) => (existsSync(join(work, n)) ? readFileSync(join(work, n), 'utf8') : null);
  return { j, status: r.status, work, md: read('material.md'), links: read('links.md'), readme: read('README.md'), pages: JSON.parse(read('.lecpage/pages.json') || '[]') };
}
const heads = (md) => String(md || '').split('\n').filter((l) => l.startsWith('## '));
/** workshop.pptx의 4번째 슬라이드를 숨긴 것(13장 가운데 보이는 것 12장) */
function hiddenPptx() {
  const z = unzipSync(new Uint8Array(readFileSync(fx('workshop.pptx'))));
  const t = strFromU8(z['ppt/slides/slide4.xml']);
  assert.ok(t.includes('<p:sld '));
  z['ppt/slides/slide4.xml'] = strToU8(t.replace('<p:sld ', '<p:sld show="0" '));
  const f = join(T, '숨김.pptx'); writeFileSync(f, zipSync(z));
  return f;
}
/** 예전 파워포인트(.ppt)처럼 보이는 파일: OLE 그릇 머리만 */
function legacyPpt(name = '옛날.ppt') { const f = join(T, name); writeFileSync(f, Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(1200)])); return f; }

test('PPTX·PPSX·DOCX·HWP·HWPX·글: 변환·그리기 도구 없이 읽음(쪽·부분 수, 표·발표자 노트는 material.md, 걸린 링크 주소는 links.md)', () => {
  const p = prepare([fx('workshop.pptx')]);
  assert.equal(p.j.ok, true); assert.equal(p.j.pages, 13); assert.equal(p.j.images, 0);
  assert.deepEqual(p.j.files, [{ name: 'workshop.pptx', type: 'pptx', unit: 'slide', pages: 13, images: 0 }]);
  assert.deepEqual(p.j.unread, []);
  assert.equal(heads(p.md).length, 13);
  assert.match(heads(p.md)[0], /^## p-001 · workshop\.pptx 1쪽 · .+ \(쪽 그림 없음\)$/, '그리지 못했으면 없다고 적음');
  assert.match(p.md, /Gemini \| 검색·요약 \| Google 계정/, '표');
  assert.match(p.md, /> 발표자 노트: 영상은 3분 이내로/, '발표자 노트');
  // 글자에 걸린 링크: 쪽 그림에는 '제미나이 바로가기'만 보이고 주소는 교재 파일 안에만 있음
  assert.match(p.links, /^- workshop\.pptx 8쪽: 제미나이 바로가기 → https:\/\/gemini\.google\.com\/$/m);
  assert.match(p.links, /^- workshop\.pptx 11쪽: NotebookLM 열기 → https:\/\/notebooklm\.google\.com\/$/m);
  assert.ok(!/forms\.gle/.test(p.links), '쪽 글에 주소가 보이는 링크는 다시 적지 않음');
  assert.match(p.readme, /links\.md/);

  const ppsx = join(T, '쇼.ppsx'); copyFileSync(fx('workshop.pptx'), ppsx);
  const s = prepare([ppsx]);
  assert.equal(s.j.ok, true); assert.equal(s.j.pages, 13); assert.equal(s.j.files[0].type, 'pptx');

  const d = prepare([fx('guide.docx')]);
  assert.equal(d.j.ok, true); assert.deepEqual(d.j.files, [{ name: 'guide.docx', type: 'docx', unit: 'section', pages: 5, images: 0 }]);
  assert.match(heads(d.md)[0], /^## p-001 · guide\.docx 1번째 부분 · /, "워드·한글은 쪽이 아니라 제목으로 나눈 '부분'");
  assert.match(d.md, /Gemini \| 글쓰기와 요약/);
  assert.match(d.links, /^- guide\.docx 4번째 부분: 우리 연수 보드 → https:\/\/padlet\.com\/example\/ai-training$/m);

  for (const n of ['plan.hwp', 'plan.hwpx']) {
    const h = prepare([fx(n)]);
    assert.equal(h.j.ok, true, n); assert.equal(h.j.pages, 3, n); assert.equal(h.j.files[0].unit, 'section', n);
    assert.match(h.md, /15:10~15:40 \| 패들렛으로 의견 모으기/, n + ' 표');
    assert.match(h.links, /1번째 부분: 제미나이 → https:\/\/gemini\.google\.com\//, n + ' 걸린 링크');
  }
  const t = prepare([fx('notes.md')]);
  assert.equal(t.j.ok, true); assert.equal(t.j.pages, 3); assert.ok(t.md);
});

test('PDF: 보조 글자는 두지 않고(원본을 읽음) 원본을 읽어도 안 나오는 걸린 링크 주소만 links.md에 · 스캔본도 쪽 수는 셈', { skip: noPdf }, () => {
  const p = prepare([fx('workshop.pdf')]);
  assert.equal(p.j.ok, true); assert.equal(p.j.pages, 13);
  assert.equal(p.md, null, 'PDF만이면 material.md 없음');
  assert.match(p.links, /^- workshop\.pdf 8쪽: 제미나이 바로가기 → https:\/\/gemini\.google\.com\/$/m);
  assert.match(p.links, /^- workshop\.pdf 11쪽: NotebookLM 열기 → https:\/\/notebooklm\.google\.com\/$/m);
  assert.ok(!/forms\.gle/.test(p.links));
  const k = prepare([fx('ko-cid.pdf')]);
  assert.equal(k.j.ok, true); assert.equal(k.j.pages, 3); assert.equal(k.links, null); assert.equal(k.md, null);
  const s = prepare([fx('scan.pdf')]);
  assert.equal(s.j.ok, true); assert.equal(s.j.pages, 2); assert.equal(s.md, null);
});

test('큰 PDF(LECPAGE_PDF_TEXT_MB를 넘는 것)만 글을 material.md에: 그 PC의 에이전트가 원본을 열지 못할 때 커넥트가 정함', { skip: noPdf }, () => {
  const p = prepare([fx('workshop.pdf'), fx('ko-cid.pdf')], { env: { LECPAGE_PDF_TEXT_MB: '0.05' } }); // workshop.pdf 90KB > 50KB > ko-cid.pdf 4KB
  assert.equal(p.j.ok, true);
  assert.deepEqual(p.j.files.map((f) => [f.name, !!f.text]), [['workshop.pdf', true], ['ko-cid.pdf', false]]);
  assert.match(p.md, /0\.05MB가 넘는 PDF\(workshop\.pdf\)는 글을 함께 넣었어요/);
  assert.equal(heads(p.md).length, 13); assert.ok(heads(p.md).every((h) => /workshop\.pdf/.test(h)), '작은 PDF의 글은 넣지 않음');
});

test('읽지 못한 교재: 하나뿐이면 실패(까닭을 unread로) · 다른 교재와 함께면 말없이 빼지 않고 알림', () => {
  const only = prepare([legacyPpt()]);
  assert.equal(only.j.ok, false); assert.notEqual(only.status, 0);
  assert.deepEqual(only.j.unread.map((u) => [u.name, u.code]), [['옛날.ppt', 'legacy-ppt']]);
  assert.match(only.j.unread[0].message_ko, /\.pptx.*PDF/);
  const broken = join(T, '깨짐.pptx'); writeFileSync(broken, zipSync({ 'ppt/presentation.xml': strToU8('<p:presentation') }));
  const both = prepare([fx('workshop.pptx'), legacyPpt('함께.ppt'), broken]);
  assert.equal(both.j.ok, true); assert.equal(both.j.pages, 13);
  assert.deepEqual(both.j.unread.map((u) => [u.name, u.code]).sort(), [['깨짐.pptx', 'no-pages'], ['함께.ppt', 'legacy-ppt']].sort(), '오류 없이 쪽이 0인 파일(속이 깨짐)도 읽지 못한 교재로');
  assert.deepEqual(both.j.files.map((f) => f.name), ['workshop.pptx'], '읽은 교재만');
  assert.match(both.readme, /읽지 못한 교재: .*함께\.ppt/);
});

test('받은 쪽 그림(앱이 그려 보낸 것) — 슬라이드: 쪽마다 번호를 맞추고 다시 그리지 않음 · 숨긴 슬라이드는 건너뜀', () => {
  const p = prepare([fx('workshop.pptx')], { given: 13 });
  assert.equal(p.j.ok, true); assert.equal(p.j.images, 13);
  assert.deepEqual(p.j.given, { owner: 'workshop.pptx', mapped: 13 });
  assert.equal(p.j.files[0].images, 13);
  assert.ok(heads(p.md).every((h, i) => h.startsWith(`## p-${pad3(i + 1)} · workshop.pptx ${i + 1}쪽`)), heads(p.md).join('\n'));
  assert.ok(!/쪽 그림 없음/.test(p.md), "앱이 보낸 쪽 그림이 있는데 '쪽 그림 없음'이라고 적지 않음");
  assert.equal(p.pages.length, 13);

  const h = prepare([hiddenPptx()], { given: 12 });
  assert.deepEqual(h.j.given, { owner: '숨김.pptx', mapped: 12 });
  const hs = heads(h.md);
  assert.match(hs[2], /^## p-003 · 숨김\.pptx 3쪽/);
  assert.match(hs[3], /^## 숨김\.pptx 4쪽 · PART 1 \(숨긴 슬라이드\)$/, '숨긴 슬라이드에는 쪽 그림 번호가 없음');
  assert.match(hs[4], /^## p-004 · 숨김\.pptx 5쪽 · 생성형 AI란\?$/, '그 뒤는 번호가 하나씩 당겨짐');
  assert.equal(h.pages.length, 12); assert.equal(h.pages[3].title, '생성형 AI란?', '교재 슬라이드의 쪽 제목도 그림 번호대로');

  // 그림이 슬라이드보다 많으면(짝을 알 수 없음) 번호를 붙이지 않음
  const m = prepare([fx('workshop.pptx')], { given: 20 });
  assert.deepEqual(m.j.given, { owner: 'workshop.pptx', mapped: 0 });
  assert.ok(heads(m.md).every((x) => !/^## p-/.test(x)));
  assert.deepEqual(m.pages, []);
});

test("받은 쪽 그림 — 한글·워드: 쪽 그림(실제 쪽)과 '부분'은 차례가 달라 짝을 알리지 않음 · 교재가 여럿이면 앱이 알려 준 교재만", () => {
  const d = prepare([fx('guide.docx')], { given: 2 });
  assert.deepEqual(d.j.given, { owner: 'guide.docx', mapped: 0 });
  assert.equal(d.j.files[0].images, 2);
  assert.ok(heads(d.md).every((h) => /^## guide\.docx \d번째 부분/.test(h)), heads(d.md).join('\n'));
  assert.match(d.md, /guide\.docx를 쪽마다 그린 것이라 아래 번호와는 차례가 달라요/);
  assert.ok(!/쪽 그림 없음/.test(d.md));
  assert.deepEqual(d.pages, [], '부분 제목을 쪽 그림 번호에 붙이지 않음');

  // 교재 둘 + 누구의 쪽 그림인지 모름: 모른다고 적음
  const u = prepare([fx('workshop.pptx'), fx('guide.docx')], { given: 2 });
  assert.deepEqual(u.j.given, { owner: '', mapped: 0 });
  assert.match(u.md, /쪽 그림이 어느 교재의 몇 쪽인지는 여기 적혀 있지 않아요/);
  assert.ok(heads(u.md).every((h) => !/^## p-/.test(h)) && !/쪽 그림 없음/.test(u.md));

  // 앱이 알려 줌(워드의 쪽 그림): 슬라이드에는 번호를 붙이지 않음
  const w = prepare([fx('workshop.pptx'), fx('guide.docx')], { given: 2, of: 'guide.docx' });
  assert.deepEqual(w.j.given, { owner: 'guide.docx', mapped: 0 });
  assert.deepEqual(w.j.files.map((f) => [f.name, f.images]), [['workshop.pptx', 0], ['guide.docx', 2]]);
  // 앱이 알려 줌(슬라이드의 쪽 그림): 슬라이드에만 번호
  const s = prepare([fx('workshop.pptx'), fx('guide.docx')], { given: 13, of: 'workshop.pptx' });
  assert.deepEqual(s.j.given, { owner: 'workshop.pptx', mapped: 13 });
  assert.equal(heads(s.md).filter((h) => /^## p-\d{3} · workshop\.pptx/.test(h)).length, 13);
  assert.equal(heads(s.md).filter((h) => /^## guide\.docx/.test(h)).length, 5);
  assert.deepEqual(s.j.files.map((f) => [f.name, f.images]), [['workshop.pptx', 13], ['guide.docx', 0]]);
});

test('받은 쪽 그림 — 같은 이름의 PDF 짝(이 PC의 프로그램으로 만든 PDF·함께 넣은 PDF)에서 그린 것: 슬라이드 쪽에 맞춤', { skip: noPdf }, () => {
  const p = prepare([fx('workshop.pptx'), fx('workshop.pdf')], { given: 13 });
  assert.deepEqual(p.j.given, { owner: 'workshop.pptx', mapped: 13 });
  assert.deepEqual(p.j.files.map((f) => [f.name, f.pages, f.images, !!f.twin]), [['workshop.pptx', 13, 13, false], ['workshop.pdf', 0, 0, true]]);
  assert.equal(heads(p.md).length, 13);
  // PDF 하나: 보조 글자는 없고 쪽 제목만 그림 번호대로
  const q = prepare([fx('workshop.pdf')], { given: 13 });
  assert.deepEqual(q.j.given, { owner: 'workshop.pdf', mapped: 13 });
  assert.equal(q.md, null); assert.equal(q.pages.length, 13);
});

// ── prepare가 직접 그린 쪽 그림(Skill CLI: LibreOffice·pdftoppm이 있는 컴퓨터) ──
const hasOffice = process.platform !== 'win32' && ['soffice', 'pdftoppm'].every((c) => spawnSync('sh', ['-c', `command -v ${c}`]).status === 0);
test("그린 쪽 그림 — 워드(문서형): LibreOffice가 그린 실제 쪽 그림을 버리지 않고 씀('부분'과는 차례가 달라 짝은 알리지 않음) · 다른 교재와 함께면 교재마다 이어서 번호", { skip: !hasOffice && 'LibreOffice·pdftoppm이 있는 컴퓨터에서만', timeout: 180000 }, () => {
  const tools = { PATH: process.env.PATH, HOME: process.env.HOME || T };
  const img = (work, n) => ['webp', 'png', 'jpg'].some((e) => existsSync(join(work, 'site', 'material', `p-${pad3(n)}.${e}`)));
  const a = prepare([fx('guide.docx')], { env: tools });
  assert.equal(a.status, 0, JSON.stringify(a.j)); assert.ok(a.j.images >= 1, '그린 쪽 그림이 site/material에 남음');
  assert.ok(img(a.work, 1) && !img(a.work, a.j.images + 1));
  assert.deepEqual(a.j.given, { owner: 'guide.docx', mapped: 0 });
  assert.deepEqual(a.j.files, [{ name: 'guide.docx', type: 'docx', unit: 'section', pages: 5, images: a.j.images }]);
  assert.deepEqual(a.pages, [], '부분에는 쪽 번호를 붙이지 않음(그림 번호와 다름)');
  assert.match(a.md, /쪽 그림은 guide\.docx를 쪽마다 그린 것이라 아래 번호와는 차례가 달라요/);
  assert.ok(heads(a.md).length === 5 && heads(a.md).every((h) => !/p-\d{3}/.test(h) && !/쪽 그림 없음/.test(h)), heads(a.md).join('|'));
  assert.match(a.readme, new RegExp(`p-001 ~ p-${pad3(a.j.images)}`));
  assert.ok(!existsSync(join(a.work, '.lecpage', 'slides')), '임시 그림 폴더는 지움');
  if (noPdf) return;
  // PDF(쪽마다 그림) + 워드: PDF 쪽은 번호를 맞추고, 워드의 쪽 그림은 그 뒤에 이어서
  const b = prepare([fx('guide.docx'), fx('scan.pdf')], { env: tools });
  assert.equal(b.status, 0, JSON.stringify(b.j));
  const sets = b.j.given.sets; assert.equal(sets.length, 2, JSON.stringify(b.j.given));
  const pdf = sets.find((x) => x.owner === 'scan.pdf'); const doc = sets.find((x) => x.owner === 'guide.docx');
  assert.deepEqual([pdf.count, pdf.mapped], [2, 2]); assert.equal(doc.mapped, 0); assert.ok(doc.count >= 1);
  assert.equal(new Set([...Array(pdf.count).keys()].map((i) => pdf.first + i).concat([...Array(doc.count).keys()].map((i) => doc.first + i))).size, pdf.count + doc.count, '번호가 겹치지 않음');
  assert.equal(b.j.images, pdf.count + doc.count); for (let n = 1; n <= b.j.images; n++) assert.ok(img(b.work, n), `p-${pad3(n)}`);
  assert.deepEqual(b.pages.map((p) => p.page), [pdf.first, pdf.first + 1], 'PDF 쪽만 그림 번호와 맞춤');
  assert.match(b.md, /쪽 그림은 교재마다 이어서 번호를 매겼어요/);
});
