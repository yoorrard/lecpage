// .lecpage 파일(앱 [파일로 저장]·[저장한 파일 열기]와 skill `app` 명령이 함께 쓰는 형식)의 규칙
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALLOWED_ASSET, isAllowedAsset, slideRenames, appInfoFrom, workInfoFrom, packProject, unpackProject, readStoredZip, srcKey, projectFileName, PROJECT_FORMAT, DEFAULT_INFO } from '../src/project-file.js';
import { USER_ASSET } from '../src/build.js';
import { zipFiles } from '../src/zip-write.js';
import { sanitizeImported } from '../src/intake.js';
import { validate } from '../src/validate.js';
import { readFileSync } from 'node:fs';

const example = () => JSON.parse(readFileSync(new URL('../../examples/data-lab.blueprint.json', import.meta.url), 'utf8'));

test('받는 자료: 쪽 그림·교재 그림·자료실 파일·교재 원본만, 스크립트·SVG·HTML·하위 폴더·.. 는 거절', () => {
  for (const ok of ['assets/slides/slide-001.webp', 'slides/slide-002.png', 'assets/media/img3.jpg', 'assets/files/활동지 (최종).pdf', 'assets/files/명단.xlsx', 'src/교재_1.pptx', 'src/plan.hwpx'])
    assert.ok(isAllowedAsset(ok), ok);
  for (const no of ['assets/lecpage.js', 'index.html', 'assets/media/x.svg', 'assets/media/x.html', 'assets/slides/deck1/slide-001.webp', 'assets/files/a/b.pdf', 'src/run.js', 'src/a.html', 'assets/media/..x.png', 'project.json', 'assets/files/x.exe'])
    assert.ok(!isAllowedAsset(no), no);
  // 자료실 파일은 사이트 빌드 규칙(USER_ASSET)을 넘지 않음
  for (const k of ['assets/files/a.csv', 'assets/files/b.key', 'assets/files/c d.docx']) assert.ok(ALLOWED_ASSET.test(k) && USER_ASSET.test(k), k);
});

test('쪽 그림 이름을 앱과 같게(쪽 번호 그대로·한 폴더), 숨긴 쪽을 건너뛴 번호를 바로잡음', () => {
  const one = { pages: [1, 2, 3].map((n) => ({ file: 'deck1', page: n, image: n === 2 ? undefined : `assets/slides/slide-00${n === 3 ? 2 : 1}.webp` })) };
  const m1 = slideRenames(one);
  assert.equal(m1.get('assets/slides/slide-001.webp'), 'assets/slides/slide-001.webp');
  assert.equal(m1.get('assets/slides/slide-002.webp'), 'assets/slides/slide-003.webp'); // 3쪽 그림(숨긴 2쪽을 건너뛰어 002였음)
  // 교재가 둘이면 하위 폴더 대신 파일 id를 이름 앞에
  const two = { pages: [{ file: 'deck1', page: 1, image: 'assets/slides/deck1/slide-001.webp' }, { file: 'deck2', page: 1, image: 'assets/slides/deck2/slide-001.webp' }] };
  const m2 = slideRenames(two);
  assert.deepEqual([...m2.values()], ['assets/slides/deck1-slide-001.webp', 'assets/slides/deck2-slide-001.webp']);
  for (const v of m2.values()) assert.ok(isAllowedAsset(v));
});

test('연수 정보는 설계도와 같은 값으로(앱이 고칠 때 빈 칸으로 설계도를 지우지 않게), 접속 주소는 비움', () => {
  const bp = example(); bp.meta.joinUrl = 'https://zoom.us/j/1'; bp.meta.mode = 'hybrid';
  const info = appInfoFrom(bp, { format: 'practice', request: '차분하게', joinUrl: 'https://evil.example' });
  for (const k of ['title', 'date', 'start', 'end', 'venue', 'organizer']) assert.equal(info[k], bp.meta[k] || '', k);
  assert.equal(info.mode, 'hybrid');
  assert.equal(info.joinUrl, '');
  assert.equal(info.format, 'practice');
  assert.equal(info.request, '차분하게');
  assert.deepEqual(info.features, bp.live.features);
  assert.equal(info.instructorName, bp.instructors[0].name);
  for (const k of Object.keys(DEFAULT_INFO)) assert.ok(k in info, k);
  // 앱 → 스킬: 빈 값과 접속 주소는 info.json에 쓰지 않음
  const w = workInfoFrom({ ...info, joinUrl: 'https://zoom.us/j/1', subtitle: '' });
  assert.ok(!('joinUrl' in w) && !('subtitle' in w));
  assert.equal(w.title, info.title);
});

test('묶기 → 풀기: 비밀 값·내 컴퓨터 경로 없이, 자료는 받는 것만, 같은 설계도로 돌아옴', () => {
  const raw = example();
  raw.live = { provider: 'supabase', url: 'https://x.supabase.co', anonKey: 'sb_publishable_x', code: 'ABCDEFGH', features: ['qa'] };
  raw.meta.siteUrl = 'https://site.example'; raw.meta.shortUrl = 'https://is.gd/x';
  raw.sections = raw.sections.filter((s) => s.type !== 'deck');
  raw.sections.push({ id: 'deck', type: 'deck', slides: [{ src: 'assets/slides/slide-001.webp', page: 1 }, { src: 'assets/slides/slide-002.webp', page: 3 }] });
  const material = { kind: 'lecpage-material', files: [{ id: 'deck1', name: '교재.pptx', type: 'pptx', size: 10, pages: 3, path: '/home/교사/바탕화면/교재.pptx' }, { id: 'link1', name: '도구', type: 'link' }],
    pages: [{ file: 'deck1', page: 1, image: 'assets/slides/slide-001.webp' }, { file: 'deck1', page: 2 }, { file: 'deck1', page: 3, image: 'assets/slides/slide-002.webp' }] };
  const assets = { 'assets/slides/slide-001.webp': new Uint8Array([1]), 'assets/slides/slide-002.webp': new Uint8Array([3]), 'assets/media/a.emf': new Uint8Array([9]), 'assets/media/b.png': new Uint8Array([2]) };
  const r = packProject({ blueprint: sanitizeImported(raw), material, info: { format: 'practice' }, assets, originals: [{ name: '교재.pptx', bytes: new Uint8Array([7]) }], summary: '교재.pptx(3장)', now: 1 });
  const text = r.files['project.json'];
  for (const secret of ['x.supabase.co', 'sb_publishable_x', 'site.example', 'is.gd/x', '/home/교사']) assert.ok(!text.includes(secret), secret);
  assert.deepEqual(Object.keys(r.files).sort(), ['assets/media/b.png', 'assets/slides/slide-001.webp', 'assets/slides/slide-003.webp', 'project.json', 'src/교재.pptx']);
  assert.deepEqual(r.dropped, ['assets/media/a.emf']);
  const p = JSON.parse(text).project;
  assert.equal(JSON.parse(text).format, PROJECT_FORMAT);
  assert.equal(p.origin, 'skill'); assert.equal(p.stage, 2); assert.equal(p.slidesMade, 2);
  assert.deepEqual(p.files, [{ name: '교재.pptx', key: 'src/교재.pptx', size: 10, ext: 'pptx', pages: 3, errors: [] }]);
  assert.deepEqual(p.blueprint.sections.find((s) => s.type === 'deck').slides.map((s) => s.src), ['assets/slides/slide-001.webp', 'assets/slides/slide-003.webp']);
  assert.equal(p.material.pages[2].image, 'assets/slides/slide-003.webp');
  assert.equal(validate(p.blueprint).errors.length, 0);
  // ZIP으로 쓰고 다시 읽어 풀기
  const u = unpackProject(readStoredZip(zipFiles(r.files)));
  assert.deepEqual(Object.keys(u.assets).sort(), ['assets/media/b.png', 'assets/slides/slide-001.webp', 'assets/slides/slide-003.webp']);
  assert.deepEqual(u.originals.map((o) => [o.file, o.name, [...o.bytes]]), [['교재.pptx', '교재.pptx', [7]]]);
  assert.equal(u.info.format, 'practice');
  assert.deepEqual(sanitizeImported(u.blueprint).sections, p.blueprint.sections);
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
