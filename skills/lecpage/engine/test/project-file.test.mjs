// .lecpage 파일(앱 [파일로 저장]·[저장한 파일 열기]와 skill `app` 명령이 함께 쓰는 형식)의 규칙
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedAsset, isSiteAsset, unpackProject, readStoredZip, srcKey, projectFileName } from '../src/project-file.js';
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

test('받는 자료: 앱이 넣을 수 있는 것은 모두 왕복 — 교재 원본의 형식, 사이트 폴더의 쪽 그림·사진·자료실 파일(띄어쓰기·괄호·엑셀·ZIP·소리·영상)', () => {
  // 교재 원본: 앱 '교재 넣기'가 읽거나 PDF로 바꾸는 형식 모두(예전에는 pptm·potx·docm·key 등이 열 때 말없이 빠졌음)
  for (const ext of ['pptx', 'ppsx', 'pptm', 'potx', 'ppt', 'pps', 'odp', 'key', 'pdf', 'hwpx', 'hwp', 'docx', 'docm', 'doc', 'odt', 'rtf', 'txt', 'md'])
    assert.ok(isAllowedAsset(srcKey(`2026 연수 교재(최종).${ext}`)), ext);
  for (const no of ['src/run.js', 'src/a.html', 'src/a.svg', 'src/a.exe', 'src/a/b.pdf', 'src/..pdf', 'src/a\\b.pdf', 'src/a\u0000.pdf', 'src/a\n.pdf']) assert.ok(!isAllowedAsset(no), JSON.stringify(no));
  // 사이트 폴더(앱 저장소 'site/…'): 자료실 파일 이름은 앱(Files.jsx fileName)이 만드는 그대로 — 띄어쓰기·괄호·대괄호, 같은 이름에는 ' (2)'
  for (const ok of [
    'site/material/p-001.webp', 'site/material/p-0123.png', 'site/material/p-014.jpg',
    'site/assets/img/photo-ab12cd.png', 'site/assets/img/내 사진 (1).jpg', 'site/assets/hero.webp', 'site/assets/img/deep/x.gif', 'site/assets/media/intro.mp4', 'site/assets/fonts/a.woff2',
    'site/files/활동지.hwp', 'site/files/실습 자료.xlsx', 'site/files/자료 (2).pdf', 'site/files/명단[최종].csv', 'site/files/data.zip', 'site/files/song.mp3', 'site/files/clip.mp4',
    'site/files/읽어 보기.txt', 'site/files/notes.md', 'site/files/발표.key', 'site/files/표.ods', 'site/assets/files/옛 자리.pdf',
    'site/material/cover.png', 'site/assets/img/doc.pdf', // 예전 규칙이 받던 것은 그대로
  ]) assert.ok(isSiteAsset(ok), ok);
  // 받지 않는 것: 글로 된 코드(사이트 글은 project.json에)·SVG·엔진 파일·숨김 파일·밖으로 나가는 경로·제어 문자·모르는 형식·다른 자리
  for (const no of [
    'site/index.html', 'site/sub.html', 'site/assets/site.js', 'site/assets/app.mjs', 'site/assets/style.css', 'site/assets/data.json', 'site/assets/lecpage.js', 'site/assets/kit.css',
    'site/assets/img/x.svg', 'site/files/x.exe', 'site/files/a/b.pdf', 'site/assets/.hidden/x.png', 'site/../x.png', 'site/files/..x.pdf', 'site//files/a.pdf', 'site/files/a\\b.pdf',
    'site/files/a\u0000.pdf', 'site/files/a\tb.pdf', '/site/files/a.pdf', 'files/a.pdf', 'site/console.html', 'site/_headers', 'site/robots.txt', 'site/other/a.png', 'site/files/', 'project.json', 42, null,
  ]) assert.ok(!isSiteAsset(no), JSON.stringify(no));
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
