import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as E from '../src/index.js';
import { nodeRuntime } from '../node.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const EX = (id) => JSON.parse(readFileSync(join(HERE, '..', '..', 'examples', `${id}.blueprint.json`), 'utf8'));

test('검증: 위험한 링크·HTML을 걸러 낸다', () => {
  const { blueprint, warnings } = E.validate({
    meta: { title: '<img src=x onerror=alert(1)> 연수' },
    sections: [
      { type: 'hero', ctas: [{ label: '나쁜 링크', href: 'javascript:alert(1)' }, { label: '좋은 링크', href: 'gemini.google.com' }] },
      { type: 'tools', items: [{ name: 'x', url: 'data:text/html,<script>' }] },
      { type: 'nope' },
    ],
  });
  assert.equal(blueprint.sections[0].ctas.find((c) => c.label === '나쁜 링크').href, '#main');
  assert.match(blueprint.sections[0].ctas.find((c) => c.label === '좋은 링크').href, /^https:\/\/gemini\.google\.com\/?$/);
  assert.equal(blueprint.sections[1].items[0].url, '');
  assert.ok(warnings.some((w) => /알 수 없는 섹션/.test(w.message_ko)));
});

test('렌더: 내용 속 HTML은 이스케이프된다', () => {
  const r = E.build({ meta: { title: '<script>alert(1)</script>' }, sections: [{ type: 'hero' }, { type: 'text', md: '**굵게** <b>x</b> [링크](javascript:alert(1))' }] }, { runtime: nodeRuntime() });
  const html = r.files['index.html'];
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!/href="javascript:/i.test(html));
  assert.ok(html.includes('<strong>굵게</strong>'));
});

for (const id of ['sel-story', 'ai-lab']) {
  test(`견본 빌드: ${id}`, () => {
    const r = E.build(EX(id), { runtime: nodeRuntime() });
    assert.deepEqual(r.errors, []);
    for (const f of ['index.html', 'console.html', 'screen.html', 'check.html', 'privacy.html', 'assets/theme.css', 'assets/lecpage.js', 'assets/live.js', 'assets/fx.js', 'DESIGN.md', '운영안내.md']) assert.ok(r.files[f], f + ' 없음');
    assert.ok(r.report.effects.length > 3);
    assert.equal((r.files['index.html'].match(/<h1/g) || []).length, 1);
    const data = /<script type="application\/json" id="lp-data">([\s\S]*?)<\/script>/.exec(r.files['index.html'])[1];
    assert.ok(JSON.parse(data).live.code.length === 6);
  });
}

test('프리셋: 모든 글자 대비 4.5:1 이상', () => {
  for (const p of E.PRESETS) for (const t of ['light', 'dark']) {
    const k = E.themeTokens(p, t);
    assert.ok(E.contrast(k['--foreground'], k['--background']) >= 4.5, p.id + t + ' fg');
    assert.ok(E.contrast(k['--muted-foreground'], k['--background']) >= 4.5, p.id + t + ' muted');
    assert.ok(E.contrast(k['--primary-foreground'], k['--primary']) >= 4.5, p.id + t + ' primary');
  }
});

test('프리셋 효과는 모두 카탈로그에 있다', () => {
  const ids = new Set(E.FX.map((f) => f.id));
  for (const p of E.PRESETS) {
    for (const v of [...Object.values(p.effects), p.graphic, p.closingGraphic, p.signature].filter(Boolean)) assert.ok(ids.has(v), `${p.id}: ${v}`);
  }
});

test('디자인 결정: 네트워크 제한이면 외부 라이브러리 효과를 쓰지 않는다', () => {
  const bp = E.validate({ meta: { title: 'AI 연수' }, audience: { network: 'restricted' }, design: { preset: 'night-story', motion: 3 }, sections: [{ type: 'hero' }] }).blueprint;
  const d = E.resolveDesign(bp);
  for (const id of Object.values(d.effects)) assert.ok(!(E.fxInfo(id)?.libs || []).length, id);
  assert.ok(d.motion <= 2);
});

test('운영 결정 규칙', () => {
  assert.equal(E.decideInfra({ size: 25, features: [] }).backend, 'none');
  assert.equal(E.decideInfra({ size: 25, features: ['attendance'] }).backend, 'sheets');
  assert.equal(E.decideInfra({ size: 60, features: ['qa', 'progress'] }).backend, 'supabase');
  assert.equal(E.decideInfra({ size: 500, features: ['qa', 'poll'] }).backend, 'cloudflare');
  assert.equal(E.decideInfra({ size: 30, features: ['qa'], network: 'offline' }).backend, 'lan');
  assert.equal(E.decideInfra({ size: 80, features: ['qa'], infra: ['nas'], skill: 'set' }).backend, 'server');
  assert.ok(!E.decideInfra({ size: 30, features: ['qa'], commercial: true }).hosts.includes('vercel'));
});

test('유형 결정', () => {
  assert.equal(E.decideArchetype({ format: 'course' }).primary, 'course');
  assert.equal(E.decideArchetype({ size: 400 }).primary, 'live');
  assert.equal(E.decideArchetype({ practiceRatio: 0.6, durationMin: 120 }).primary, 'lab');
});

test('AI 답에서 JSON 꺼내기', () => {
  assert.equal(E.extractJson('설명입니다\n```json\n{"a":1,}\n```\n끝').a, 1);
  assert.equal(E.extractJson('앞말 {"meta":{"title":"연수"}} 뒷말').meta.title, '연수');
  assert.throws(() => E.extractJson('JSON 없음'));
});

test('프롬프트에 규칙·스키마·교재가 들어간다', () => {
  const p = E.buildPrompt({ context: '[쪽 1] 교재', info: { title: '연수' } });
  assert.ok(p.includes('JSON 하나만'));
  assert.ok(p.includes('stations'));
  assert.ok(p.includes('[쪽 1] 교재'));
});

test('ZIP 쓰기: 서명과 파일 수', () => {
  const z = E.zipFiles({ 'a.txt': '가나다', 'b/c.bin': new Uint8Array([1, 2, 3]) });
  const dv = new DataView(z.buffer);
  assert.equal(dv.getUint32(0, true), 0x04034b50);
  assert.equal(dv.getUint16(z.length - 22 + 10, true), 2);
});
