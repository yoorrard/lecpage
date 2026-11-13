// 팝업 공지(글자만, https 링크 하나)와 하루 숫자 세기(앱 익명 이용 합계·묶어 보내기·유료 전환 한 줄)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkNotice, safeLink, cleanText, publicNotice, noticeBandHtml, NOTICE_LIMITS } from '../src/notice.js';
import { Tally, MinuteLimiter, appStatKey, paidAdvice, APP_KEYS } from '../src/tally.js';

const NOW = Date.UTC(2026, 10, 13, 3);
const base = { title: '점검 안내', body: '11월 20일 밤 10시에 잠깐 멈춰요.', targets: ['app'] };

test('공지: 글자만 받고 다듬음', () => {
  const { value } = checkNotice({ ...base, title: '  <b>점검</b>\u202E 안내\u200B ', body: 'a\r\n\r\n\r\n\r\nb\u0000c\n  d  ' }, { now: NOW });
  assert.equal(value.title, '<b>점검</b> 안내', '꺾쇠는 글자 그대로(그릴 때 글자로), 방향 바꿈·보이지 않는 글자는 뺌');
  assert.equal(value.body, 'a\n\nb c\nd', '줄바꿈은 두 줄까지, 제어 문자는 빈칸');
  assert.deepEqual(value.targets, ['app']);
  assert.equal(value.starts, NOW); assert.equal(value.ends, NOW + 7 * 864e5, '기본 7일');
  assert.equal(value.link, ''); assert.equal(value.linkLabel, '');
  assert.equal(value.active, true);
});

test('공지: 틀린 값은 까닭과 함께 거절', () => {
  const err = (b) => checkNotice({ ...base, ...b }, { now: NOW }).error;
  assert.match(err({ title: '' }), /제목/);
  assert.match(err({ title: 'x'.repeat(NOTICE_LIMITS.title + 1) }), /60자/);
  assert.match(err({ body: ' \n ' }), /본문/);
  assert.match(err({ body: 'x'.repeat(NOTICE_LIMITS.body + 1) }), /400자/);
  assert.match(err({ body: Array(10).fill('줄').join('\n') }), /8줄/);
  assert.match(err({ targets: [] }), /보여 줄 곳/);
  assert.match(err({ targets: ['admin', 'x'] }), /보여 줄 곳/);
  assert.match(err({ starts: NOW, ends: NOW - 1 }), /뒤여야/);
  assert.match(err({ starts: NOW, ends: NOW + 91 * 864e5 }), /90일/);
  assert.match(err({ starts: NOW - 10 * 864e5, ends: NOW - 864e5 }), /지났/);
  assert.equal(checkNotice(null).error, '공지 내용을 보내 주세요.');
});

test('공지 링크: https만, 피싱에 쓰이는 모양은 거절', () => {
  assert.equal(safeLink('https://github.com/yoorrard/lecpage/discussions'), 'https://github.com/yoorrard/lecpage/discussions');
  assert.match(safeLink('https://예시.한국/안내'), /^https:\/\/xn--[a-z0-9-]+\.xn--3e0b707e\/%EC%95%88%EB%82%B4$/, '한글 도메인은 퓨니코드로');
  for (const bad of ['http://example.com', 'javascript:alert(1)', 'data:text/html,<script>', 'https://user:pw@example.com', 'https://example.com:8443/', 'https://127.0.0.1/', 'https://[::1]/', 'https://localhost/', 'https://intranet/', 'https://a.local/', ' https://example.com/a b', 'https://exa\u202Emple.com', 'https://example.com/\u200B', 'https:\\\\example.com', `https://example.com/${'a'.repeat(300)}`, '//example.com', 'example.com']) {
    assert.equal(safeLink(bad), '', bad);
  }
  // 허용 호스트를 정하면 그곳(과 하위 도메인)만
  assert.equal(safeLink('https://docs.github.com/x', ['github.com']), 'https://docs.github.com/x');
  assert.equal(safeLink('https://github.com.evil.example/x', ['github.com']), '');
  assert.equal(safeLink('https://evilgithub.com/x', ['github.com']), '');
  const r = checkNotice({ ...base, link: 'https://evil.example/login', linkLabel: '' }, { now: NOW, allowHosts: ['github.com'] });
  assert.match(r.error, /허용한 곳/);
  const ok = checkNotice({ ...base, link: 'https://github.com/x', linkLabel: '<자세히>' + 'x'.repeat(30) }, { now: NOW });
  assert.equal(ok.value.linkLabel, ('<자세히>' + 'x'.repeat(30)).slice(0, 20));
});

test('공지 내보내기: 정한 칸만, 가는 곳 호스트를 함께', () => {
  const row = { id: 3, rev: 2, title: '제목', body: '본문', link: 'https://github.com/x', link_label: '보기', targets: '["app"]', starts: 1, ends: 2, active: 1, created: 1, updated: 1 };
  assert.deepEqual(publicNotice(row), { id: 'n3-2', title: '제목', body: '본문', ends: 2, link: 'https://github.com/x', linkLabel: '보기', linkHost: 'github.com' });
  assert.deepEqual(publicNotice({ ...row, link: '' }), { id: 'n3-2', title: '제목', body: '본문', ends: 2 });
});

test('강사 화면 공지 띠: 모든 글을 이스케이프, 스크립트 없음', () => {
  const html = noticeBandHtml([publicNotice({ id: 1, rev: 1, title: '<img src=x onerror=alert(1)>', body: '"줄1"\n</details><script>alert(2)</script>', link: safeLink('https://github.com/a?b=1&c="2"'), link_label: '<b>보기</b>', ends: 9 })]);
  assert.ok(!/<img|<script|<b>/i.test(html), html);
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;') && html.includes('&lt;/details&gt;&lt;script&gt;') && html.includes('&lt;b&gt;보기&lt;/b&gt;'));
  assert.ok(html.includes('href="https://github.com/a?b=1&amp;c=%222%22"') && html.includes('rel="noopener noreferrer"') && html.includes('(github.com)'));
  assert.equal(noticeBandHtml([]), '');
  assert.equal(cleanText('a\tb\nc'), 'a b c');
});

test('앱 익명 이용 합계: 표에 있는 항목만', () => {
  assert.equal(appStatKey('{"e":"open"}'), 'a:open');
  assert.equal(appStatKey('{"e":"make","k":"key"}'), 'a:make:key');
  assert.equal(appStatKey('{"e":"make","k":"chat"}'), 'a:make:chat');
  assert.equal(appStatKey('{"e":"publish","k":"instant"}'), 'a:pub:instant');
  for (const bad of ['', 'x', '[]', 'null', '{"e":"open","k":"x"}', '{"e":"make"}', '{"e":"make","k":"gpt"}', '{"e":"__proto__"}', '{"e":"constructor","k":""}', '{"e":"publish","k":"toString"}', `{"e":"open","pad":"${'x'.repeat(300)}"}`, '{"e":"open","uid":"abc"}'.repeat(10)]) assert.equal(appStatKey(bad), '', bad);
  assert.equal(appStatKey('{"e":"open","uid":"abc"}'), 'a:open', '다른 칸(식별자 등)은 읽지 않고 버림');
  assert.ok(APP_KEYS.has('a:pub:github') && !APP_KEYS.has('a:pub:evil'));
});

test('묶어 보내기: 50건이나 30초마다', () => {
  const t = new Tally({ every: 3, ms: 1000 });
  t.hit('site'); t.hit('api'); t.stat('a:open'); t.stat('a:nope');
  assert.equal(t.take(0), null);
  t.hit('site'); t.mark('edge');
  assert.deepEqual(t.take(0), { n: 3, c: { site: 2, api: 1, edge: 1 }, s: { 'a:open': 1 } });
  assert.equal(t.take(0), null, '비웠음');
  t.hit('live');
  assert.equal(t.take(t.at + 500), null);
  assert.deepEqual(t.take(t.at + 1000), { n: 1, c: { live: 1 }, s: {} }, '시간이 지나면');
  const l = new MinuteLimiter(2);
  assert.ok(l.ok('a', 0) && l.ok('a', 1)); assert.ok(!l.ok('a', 2)); assert.ok(l.ok('b', 3)); assert.ok(l.ok('a', 60001), '1분 뒤 다시');
});

test('유료 전환 한 줄: 최근 7일 중 예산 50%를 넘은 날', () => {
  const days = (arr) => arr.map((req) => ({ req }));
  const a = paidAdvice(days([70000, 10, 20, 30, 40, 10, 20, 30]), 100000);
  assert.equal(a.over, 0, '7일 밖은 세지 않음'); assert.equal(a.recommend, false); assert.equal(a.of, 7);
  const b = paidAdvice(days([0, 0, 0, 0, 0, 55000, 61000]), 100000);
  assert.deepEqual([b.over, b.recommend, b.peakPct], [2, true, 61]); assert.match(b.text, /Workers Paid/);
  const c = paidAdvice(days([0, 0, 0, 0, 0, 0, 51000]), 100000);
  assert.deepEqual([c.over, c.recommend], [1, false]); assert.match(c.text, /1일/);
  assert.match(paidAdvice(days([5]), 0).text, /유료 요금제/);
});
