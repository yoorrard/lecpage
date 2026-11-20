// .lecpage 파일(앱 [파일로 저장]·[저장한 파일 열기]와 skill `app` 명령이 함께 쓰는 형식)의 규칙
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedAsset, unpackProject, readStoredZip, srcKey, projectFileName } from '../src/project-file.js';
import { SITE_FILE } from '../src/kit/paths.js';
import { zipFiles } from '../src/zip-write.js';

test('받는 자료: 쪽 그림·교재 그림·자료실 파일·교재 원본만, 스크립트·SVG·HTML·하위 폴더·.. 는 거절', () => {
  for (const ok of ['assets/slides/slide-001.webp', 'slides/slide-002.png', 'assets/media/img3.jpg', 'assets/files/활동지 (최종).pdf', 'assets/files/명단.xlsx', 'src/교재_1.pptx', 'src/plan.hwpx'])
    assert.ok(isAllowedAsset(ok), ok);
  for (const no of ['assets/lecpage.js', 'index.html', 'assets/media/x.svg', 'assets/media/x.html', 'assets/slides/deck1/slide-001.webp', 'assets/files/a/b.pdf', 'src/run.js', 'src/a.html', 'assets/media/..x.png', 'project.json', 'assets/files/x.exe'])
    assert.ok(!isAllowedAsset(no), no);
  // 자료실 파일은 조립이 받는 사이트 파일 규칙(kit/paths.js SITE_FILE: files/…)을 넘지 않음
  for (const k of ['assets/files/a.csv', 'assets/files/b.key', 'assets/files/c d.docx']) assert.ok(isAllowedAsset(k) && SITE_FILE.test(k.slice(7)), k);
});

test('ZIP 읽기: 압축된 ZIP·밖으로 나가는 경로·lecpage 연수가 아닌 파일은 쉬운 말로 거절', () => {
  const z = zipFiles({ 'project.json': '{}' });
  const dv = new DataView(z.buffer, z.byteOffset); dv.setUint16(8, 8, true); // 압축 방식 표시만 바꿈
  assert.throws(() => readStoredZip(z), (e) => e.friendly && /lecpage에서 저장한/.test(e.message));
  assert.throws(() => readStoredZip(zipFiles({ '../x.json': '{}' })), (e) => e.friendly && /경로/.test(e.message));
  assert.throws(() => unpackProject(readStoredZip(zipFiles({ 'project.json': '{"format":"other"}' }))), (e) => e.friendly);
  assert.throws(() => unpackProject({}), (e) => e.friendly && /project\.json/.test(e.message));
});

test('이름 규칙: 교재 원본 보관 이름·내려받는 파일 이름은 앱과 같음', () => {
  assert.equal(srcKey('2026 연수 교재(최종).pptx'), 'src/2026_연수_교재_최종_.pptx');
  assert.equal(projectFileName('수업에 바로 쓰는 AI: 실습'), '수업에_바로_쓰는_AI_실습.lecpage');
  assert.equal(projectFileName(''), 'lecpage.lecpage');
});
