// 설계도 패치(engine/src/patch.js): 앱 검토 대화와 CLI patch가 함께 쓰는 형식
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyBlueprintPatch, diffSummary, withSectionIds } from '../src/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const EX = () => JSON.parse(readFileSync(join(HERE, '..', '..', 'examples', 'data-lab.blueprint.json'), 'utf8'));

test('패치: meta·design은 깊게 병합, 칸은 id로 얕게 병합(배열은 통째로)', () => {
  const bp = EX();
  const r = applyBlueprintPatch(bp, { meta: { venue: '본관 3층' }, design: { preset: 'paper-workbook' }, sections: { stations: { title: '다섯 정거장' }, glossary: { items: [{ term: 'AI', desc: '인공지능' }] } } });
  assert.deepEqual(r.errors, []);
  assert.equal(r.raw.meta.venue, '본관 3층');
  assert.equal(r.raw.meta.title, bp.meta.title, '다른 meta 값은 그대로');
  assert.equal(r.raw.design.preset, 'paper-workbook');
  assert.deepEqual(r.raw.design.mood, bp.design.mood);
  const st = r.raw.sections.find((s) => s.id === 'stations');
  assert.equal(st.title, '다섯 정거장');
  assert.equal(st.items.length, bp.sections.find((s) => s.id === 'stations').items.length, '바꾸지 않은 필드는 유지');
  assert.equal(r.raw.sections.find((s) => s.id === 'glossary').items.length, 1, '배열은 통째로 바뀜');
  assert.equal(r.blueprint.design.preset, 'paper-workbook', '검증본도 돌려줌');
  assert.equal(r.applied, 4); // meta·design·칸 2개
});

test('패치: null로 칸 삭제, add로 칸 추가(after), order로 순서', () => {
  const bp = EX();
  const r1 = applyBlueprintPatch(bp, {
    sections: { quiz: null },
    add: [{ after: 'stations', section: { type: 'faq', items: [{ q: '노트북이 없어도 되나요?', a: '휴대폰으로도 돼요.' }] } }, { after: null, section: { type: 'text', md: '끝' } }],
    note: '퀴즈 빼고 FAQ 넣음',
  });
  const ids1 = r1.raw.sections.map((s) => s.id);
  assert.ok(!ids1.includes('quiz'));
  assert.equal(ids1[ids1.indexOf('stations') + 1], 'faq');
  assert.equal(ids1.at(-1), 'text');
  assert.equal(r1.note, '퀴즈 빼고 FAQ 넣음');
  const r = applyBlueprintPatch(r1.raw, { order: ['hero', 'faq', 'stations'] });
  const ids = r.raw.sections.map((s) => s.id);
  assert.deepEqual(ids.slice(0, 3), ['hero', 'faq', 'stations']);
  assert.deepEqual(ids.slice(3), ids1.filter((id) => !['hero', 'faq', 'stations'].includes(id)), '나머지는 원래 순서');
  const d = diffSummary(bp, r.raw);
  assert.ok(d.some((l) => /칸 삭제/.test(l)) && d.some((l) => /칸 추가/.test(l)) && d.some((l) => /순서/.test(l)), d.join('\n'));
});

test('패치: 모르는 id·종류는 경고만, 예외 없음', () => {
  const bp = EX();
  const r = applyBlueprintPatch(bp, { sections: { nope: { title: 'x' } }, add: [{ after: 'nope', section: { type: 'zzz' } }, { after: 'nope', section: { type: 'faq', items: [{ q: 'a', a: 'b' }] } }], order: ['ghost'], weird: 1 });
  const pw = r.warnings.filter((w) => w.kind === 'patch').map((w) => w.path);
  for (const p of ['sections.nope', 'add[0]', 'add[1].after', 'order', 'weird']) assert.ok(pw.includes(p), `${p} 경고 없음: ${pw}`);
  assert.equal(r.raw.sections.at(-1).type, 'faq', '없는 after는 맨 끝');
  assert.deepEqual(r.errors, []);
  assert.doesNotThrow(() => applyBlueprintPatch(null, 'x'));
  assert.ok(applyBlueprintPatch(bp, 'x').warnings.some((w) => w.kind === 'patch'));
});

test('보안: 패치는 참가자 QR·관리자 키가 향하는 값을 바꾸지 못함', () => {
  const bp = EX();
  const before = JSON.stringify({ meta: bp.meta, live: bp.live, access: bp.access });
  const r = applyBlueprintPatch(bp, {
    meta: { siteUrl: 'https://evil.example', joinUrl: 'https://evil.example/j', shortUrl: 'https://evil.example/s', venue: '강당' },
    live: { url: 'https://evil.example', code: 'AAAA', anonKey: 'k', features: ['qa'] },
    access: { mode: 'public' },
  });
  assert.equal(r.raw.meta.siteUrl, bp.meta.siteUrl);
  assert.equal(r.raw.meta.joinUrl, bp.meta.joinUrl);
  assert.equal(r.raw.live.url, bp.live.url);
  assert.equal(r.raw.live.code, bp.live.code);
  assert.deepEqual(r.raw.access, bp.access);
  assert.equal(r.raw.meta.venue, '강당', '나머지는 적용');
  assert.deepEqual(r.raw.live.features, ['qa']);
  for (const p of ['meta.siteUrl', 'meta.joinUrl', 'meta.shortUrl', 'live.url', 'live.code', 'live.anonKey', 'access']) assert.ok(r.warnings.some((w) => w.path === p), p);
  assert.equal(JSON.stringify({ meta: bp.meta, live: bp.live, access: bp.access }), before, '입력은 바꾸지 않음');
  // 프로토타입 오염 시도
  applyBlueprintPatch(bp, JSON.parse('{"meta":{"__proto__":{"polluted":1}},"sections":{"hero":{"__proto__":{"polluted":1}}}}'));
  assert.equal({}.polluted, undefined);
});

test('패치: 숨긴 칸은 raw에 남고, 패치로 다시 켤 수 있음', () => {
  const bp = EX();
  const r1 = applyBlueprintPatch(bp, { sections: { quiz: { hidden: true } } });
  assert.ok(r1.raw.sections.find((s) => s.id === 'quiz').hidden);
  assert.ok(!r1.blueprint.sections.some((s) => s.id === 'quiz'), '검증본에서는 빠짐');
  const r2 = applyBlueprintPatch(r1.raw, { sections: { quiz: { hidden: null } } });
  assert.ok(r2.blueprint.sections.some((s) => s.id === 'quiz'));
  assert.ok(diffSummary(r1.raw, r2.raw).some((l) => /다시 보임/.test(l)));
});

test('diffSummary: 짧은 한국어 줄, 같은 개수 배열은 몇 번째 항목인지', () => {
  const bp = EX();
  const items = structuredClone(bp.sections.find((s) => s.id === 'stations').items);
  items[1].title = '새 제목';
  const r = applyBlueprintPatch(bp, { meta: { title: '새 연수명' }, sections: { stations: { items } } });
  const d = diffSummary(bp, r.raw);
  assert.ok(d.some((l) => l.startsWith('연수명:')), d.join('\n'));
  assert.ok(d.some((l) => /칸 .*2번째 항목 제목 바뀜/.test(l)), d.join('\n'));
  assert.deepEqual(diffSummary(bp, bp), []);
  assert.ok(diffSummary({}, { meta: Object.fromEntries('title subtitle organizer date start end venue mode description'.split(' ').map((k) => [k, 'x'])), design: { preset: 'a', motion: 1, accent: '#000000', theme: 'dark' } }, 5).length === 5);
});

test('withSectionIds: validate와 같은 id 규칙', () => {
  const s = withSectionIds([{ type: 'hero' }, { type: 'faq' }, { type: 'faq' }, { type: 'text', id: 'My Note' }]);
  assert.deepEqual(s.map((x) => x.id), ['hero', 'faq', 'faq-3', 'my-note']);
});
