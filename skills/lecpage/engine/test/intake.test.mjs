// 연수 정보 → 설계도(engine/src/intake.js): 앱과 skill CLI가 함께 쓰는 규칙
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyInfo, syncInfo, applyFeatures, sanitizeImported, draftInfo, archetypeFor, applyTeacherValues, validate, requestHints, buildPrompt } from '../src/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const EX = () => JSON.parse(readFileSync(join(HERE, '..', '..', 'examples', 'data-lab.blueprint.json'), 'utf8'));
const INFO = { title: '데이터 연수', subtitle: '', organizer: '', date: '2026-12-01', start: '15:00', end: '16:30', venue: '본관 시청각실', mode: 'offline', size: 25, format: 'workshop', features: [], devices: ['laptop'], network: 'good', minor: false, admin: 'school', completionRate: 80, surveyUrl: '', instructorName: '', instructorOrg: '', instructorBio: '', instructorEmail: '' };
const types = (bp) => bp.sections.map((s) => s.type);

test('applyInfo: AI·가져온 설계도의 주소·키·코드는 버리고 강사 값(prev·info)만', () => {
  const ai = { ...EX(), meta: { ...EX().meta, siteUrl: 'https://evil.example', shortUrl: 'https://evil.example/s', joinUrl: 'https://evil.example/j' }, live: { provider: 'supabase', url: 'https://evil.example', anonKey: 'k', code: 'EVIL01' }, access: { mode: 'public' } };
  const prev = { live: { provider: 'sheets', url: 'https://script.google.com/teacher', anonKey: '', code: 'TEACH12345' }, access: { mode: 'password' }, design: { preset: 'calm-forest' } };
  const bp = applyInfo(ai, { ...INFO, features: ['qa'] }, null, prev);
  assert.ok(!bp.meta.siteUrl && !bp.meta.shortUrl && !bp.meta.joinUrl);
  assert.equal(bp.live.url, 'https://script.google.com/teacher');
  assert.equal(bp.live.code, 'TEACH12345');
  assert.equal(bp.live.provider, 'sheets');
  assert.deepEqual(bp.access, { mode: 'password' });
  assert.equal(bp.design.preset, 'calm-forest', '강사가 고른 디자인 유지');
  const online = applyInfo(ai, { ...INFO, mode: 'online', joinUrl: 'https://zoom.us/j/123' }, null, null);
  assert.equal(online.meta.joinUrl, 'https://zoom.us/j/123', '온라인 접속 주소는 강사 info.joinUrl만');
  assert.equal(online.meta.mode, 'online');
  assert.equal(online.live.url, '');
});

test('applyInfo: 빈 info 값은 초안 값을 지우지 않고, 교재 글꼴(sourceFonts)은 지킴', () => {
  const draft = { ...EX(), design: { sourceFonts: { display: { name: '나눔스퀘어', share: 0.8 } } } };
  const bp = applyInfo(draft, { ...INFO, venue: '', contact: '연수 담당 02-000-0000' }, null, null);
  assert.equal(bp.meta.venue, EX().meta.venue);
  assert.equal(bp.meta.contact, '연수 담당 02-000-0000');
  assert.equal(bp.design.sourceFonts.display.name, '나눔스퀘어');
  assert.ok(bp.design.preset && bp._presetAuto, '프리셋 자동 추천');
  const keep = applyInfo({ ...EX(), design: {} }, INFO, null, { design: { sourceFonts: { body: { name: 'Pretendard' } } }, _presetAuto: true });
  assert.equal(keep.design.sourceFonts.body.name, 'Pretendard', 'AI 답에 없으면 이전 값');
});

test('applyFeatures: 기본 제목(질문·참여 보드·투표·만족도 조사), 설문은 마무리 앞', () => {
  const base = { sections: [{ type: 'hero' }, { type: 'stations', items: [{ title: 'x' }] }, { type: 'closing' }], live: {} };
  const bp = applyFeatures(structuredClone(base), { features: ['qa', 'board', 'poll', 'attendance', 'help+progress'] });
  const t = Object.fromEntries(bp.sections.map((s) => [s.type, s.title]));
  assert.equal(t.qa, '질문'); assert.equal(t.board, '나눔 보드'); assert.equal(t.poll, '투표'); assert.equal(t.survey, '만족도 조사');
  assert.deepEqual(types(bp).slice(-2), ['survey', 'closing']);
  assert.ok(types(bp).indexOf('attendance') < types(bp).indexOf('stations'));
  assert.equal(bp.live.provider, 'local');
  assert.deepEqual(bp.live.features.sort(), ['attendance', 'board', 'help', 'poll', 'progress', 'qa']);
  assert.deepEqual(bp.privacy.collect, ['nickname', 'name', 'school']);
  assert.ok(bp.sections.find((s) => s.type === 'survey').questions.length >= 3, '실시간이면 사이트 안 설문');
  const off = applyFeatures(structuredClone(bp), { features: [] });
  assert.ok(!['qa', 'board', 'attendance'].some((x) => types(off).includes(x)), '끈 기능의 칸은 뺌');
  assert.equal(off.live.provider, 'none');
  const minor = applyFeatures(structuredClone(base), { features: ['board'], minor: true });
  assert.equal(minor.sections.find((s) => s.type === 'board').allowFiles, false);
  assert.deepEqual(minor.privacy.collect, ['nickname']);
  assert.deepEqual(applyFeatures(structuredClone(base), {}), base, 'features가 없으면 그대로(CLI 부분 정보)');
  const url = applyFeatures(structuredClone(base), { features: [], surveyUrl: 'https://forms.gle/x' });
  assert.equal(url.sections.find((s) => s.type === 'survey').url, 'https://forms.gle/x');
});

test('syncInfo: 바뀐 정보만 반영하고 내용·디자인은 그대로', () => {
  const cur = applyInfo(EX(), { ...INFO, features: ['qa'] }, null, null);
  const preset = cur.design.preset;
  const bp = syncInfo(cur, { ...INFO, venue: '강당', mode: 'hybrid', joinUrl: 'https://meet.google.com/abc', features: ['qa'], instructorName: '김하늘' });
  assert.equal(bp.meta.venue, '강당');
  assert.equal(bp.meta.joinUrl, 'https://meet.google.com/abc');
  assert.equal(bp.design.preset, preset);
  assert.equal(bp.instructors[0].name, '김하늘');
  const t = types(bp);
  assert.ok(t.indexOf('instructor') < t.indexOf('survey') && t.indexOf('survey') < t.indexOf('closing'));
  const partial = syncInfo(cur, { mood: ['밝고 경쾌하게'], motion: 1 }); // CLI patch -i: 일부 키만
  assert.equal(partial.meta.venue, cur.meta.venue);
  assert.equal(partial.design.motion, 1);
  assert.deepEqual(types(partial), types(cur), 'features가 없으면 칸을 건드리지 않음');
  assert.deepEqual(validate(bp).errors, []);
});

test('sanitizeImported·applyTeacherValues: 가져온 파일은 비우고, 강사 값은 info로만', () => {
  const imp = sanitizeImported({ meta: { title: 'x', siteUrl: 'https://evil', joinUrl: 'https://evil' }, live: { url: 'https://evil', code: 'AAAA', anonKey: 'k', features: ['qa'] } });
  assert.ok(!imp.meta.siteUrl && !imp.meta.joinUrl && !imp.live.url && !imp.live.anonKey);
  assert.notEqual(imp.live.code, 'AAAA');
  assert.equal(imp.live.provider, 'local');
  const bp = applyTeacherValues({ meta: {}, live: { provider: 'local' } }, { access: 'public', siteUrl: 'https://teacher.example/', live: { provider: 'sheets', url: 'https://script.google.com/x' } });
  assert.deepEqual(bp.access, { mode: 'public' });
  assert.equal(bp.meta.siteUrl, 'https://teacher.example/');
  assert.equal(bp.live.provider, 'sheets');
  assert.deepEqual(applyTeacherValues({}, {}, { password: 'x' }).access, { mode: 'password' });
});

test('draftInfo·archetypeFor: 앱 정보와 info.json 모두 초안 입력으로', () => {
  const d = draftInfo({ ...INFO, instructorName: '박서연', instructorOrg: '새빛중', network: 'offline', joinUrl: '' }, true);
  assert.equal(d.instructor.name, '박서연');
  assert.equal(d.slidesBase, 'assets/slides/');
  assert.equal(d.audience.network, 'restricted');
  assert.equal(d.joinUrl, '');
  assert.equal(d.adminKind, 'school');
  assert.equal(draftInfo({ instructor: { name: '김' } }).instructor.name, '김', 'info.json의 instructor 객체');
  assert.equal(archetypeFor({ format: 'course' }), 'course');
  assert.equal(archetypeFor({ format: 'practice' }), 'lab');
  assert.equal(archetypeFor({}), '');
});

test('요청 사항: 분위기·색·밝기·움직임·형식을 읽어 초안에 반영하고, AI 프롬프트에는 따로 적음', () => {
  const h = requestHints('실습 위주로, 차분한 남색 계열에 어둡게 해 주세요');
  assert.deepEqual(h.mood, ['calm']); assert.equal(h.accent, '#1E3A8A'); assert.equal(h.theme, 'dark'); assert.equal(h.motion, 1); assert.equal(h.format, 'practice');
  assert.equal(requestHints('스크롤 연출이 있는 화려한 페이지').motion, 3);
  assert.equal(requestHints('움직임 없이 깔끔하게').motion, 0);
  assert.deepEqual(requestHints(''), { mood: [] });
  // 초안: 요청의 색·분위기가 들어가고, 강사가 따로 고른 값이 있으면 그 값이 먼저
  const base = { _presetAuto: true, meta: { title: '연수' }, design: { mood: [], theme: 'preset' }, sections: [{ type: 'hero', title: '연수' }] };
  const a = applyInfo(structuredClone(base), { title: '연수', request: '따뜻한 분홍 계열로' });
  assert.equal(a.design.accent, '#DB2777'); assert.ok(a.design.mood.includes('warm'));
  const b = applyInfo(structuredClone(base), { title: '연수', request: '따뜻한 분홍 계열로', accent: '#123456', mood: ['공식'] });
  assert.equal(b.design.accent, '#123456'); assert.deepEqual(b.design.mood, ['formal']);
  assert.equal(archetypeFor({ request: '실습 위주로 구성' }), 'lab');
  // 프롬프트: 요청은 '강사의 요청 사항' 아래에만, 연수 정보 JSON에는 넣지 않음
  const p = buildPrompt({ context: '교재', info: { title: '연수', request: '초등 저학년 담임 대상으로 쉽게' } });
  assert.match(p, /## 강사의 요청 사항\n초등 저학년 담임 대상으로 쉽게/);
  assert.ok(!/"request"/.test(p));
  assert.ok(!/강사의 요청 사항\n/.test(buildPrompt({ context: '교재', info: { title: '연수' } })));
});
