// 강사 화면 관리자 키를 고르는 규칙(app/src/lib/console-key.js): 배포 완료 카드와 '내 연수' 목록의 [강사 화면]이 같은 규칙을 씀.
//  - 지금 사이트가 쓰는 방의 키만 복사함. 바로 배포 방을 쓰다가 내 서버로 바꾼 연수에는 예전 방의 키(deploy.lecpage.adminKey)가 남아 있음
//  - AI가 만든 연수의 연결은 meta.live에 있음(예전 설계도 방식은 blueprint.live) — 목록이 blueprint만 읽어 내 서버 방의 키를 못 찾던 것
//  - 어느 키인지 알 수 없으면 null(키 없이 강사 화면만 엶: 틀린 키를 '복사했어요'라고 하지 않음)
import test from 'node:test';
import assert from 'node:assert/strict';

const { consoleKeySource, liveOf, adminSlot, adminKeyFrom, lecOnlyLive } = await import(new URL('../../../../app/src/lib/console-key.js', import.meta.url).href);

const API = 'https://publish.example';
const SHEET = 'https://script.google.com/macros/s/AKfy/exec';
const opts = { api: API };
// 이 기기의 키 보관함(lib/ai.js loadKey와 같은 답 모양)
const store = (m) => (slot) => Promise.resolve({ key: m[slot] || '' });
/** AI가 만든 연수(v2): 연결은 meta.live */
const v2 = (live, deploy, more = {}) => ({ id: 'p1', v: 2, site: { 'index.html': '<html>' }, meta: { title: '연수', live }, deploy, ...more });

test('바로 배포가 함께 켠 방: 연수에 있는 키', () => {
  const p = v2({ provider: 'http', url: `${API}/live`, code: 'abc123' }, { target: 'lecpage', lastUrl: 'https://s-1.example/', lecpage: { id: 's1', adminKey: 'K-LEC' }, sites: { lecpage: { url: 'https://s-1.example/', live: true } } }, { liveOk: true });
  assert.equal(lecOnlyLive(liveOf(p), '', API), true);
  assert.deepEqual(consoleKeySource(p, liveOf(p), opts), { key: 'K-LEC' });
});

test('AI가 만든 연수 + 구글 시트·내 서버(다른 곳에 배포): meta.live의 서버로 키 보관함에서 찾음', async () => {
  const p = v2({ provider: 'sheets', url: SHEET, code: 'abc123' }, { target: 'netlify', lastUrl: 'https://x.netlify.app/', sites: { netlify: { url: 'https://x.netlify.app/', live: true } } }, { liveOk: true });
  assert.equal(p.blueprint, undefined, 'AI가 만든 연수에는 blueprint가 없음');
  const src = consoleKeySource(p, liveOf(p), opts);
  assert.deepEqual(src, { url: SHEET, code: 'abc123' });
  // 연수 코드로 기억한 키 먼저, 없으면 주소로만 기억한 예전 자리
  assert.equal(await adminKeyFrom(store({ [adminSlot(SHEET, 'abc123')]: 'K-CODE', [adminSlot(SHEET)]: 'K-URL' }), src.url, src.code), 'K-CODE');
  assert.equal(await adminKeyFrom(store({ [adminSlot(SHEET)]: 'K-URL' }), src.url, src.code), 'K-URL');
  assert.equal(await adminKeyFrom(store({}), src.url, src.code), '', '보관함에 없으면 빈 값(복사하지 않음)');
  assert.equal(adminSlot(SHEET + '/', 'abc123'), 'live-admin:' + SHEET + '#abc123', '자리 이름은 끝 빗금을 떼고 코드를 붙임(LiveSetup이 저장하는 자리와 같음)');
});

test('바로 배포 방에서 내 서버로 옮긴 연수: 남아 있는 예전 방의 키를 쓰지 않음', async () => {
  const deploy = { target: 'lecpage', lastUrl: 'https://s-1.example/', lecpage: { id: 's1', adminKey: 'K-OLD-ROOM' }, sites: { lecpage: { url: 'https://s-1.example/', live: true } } };
  const moved = v2({ provider: 'sheets', url: SHEET, code: 'abc123' }, deploy, { liveOk: true });
  const src = consoleKeySource(moved, liveOf(moved), opts);
  assert.deepEqual(src, { url: SHEET, code: 'abc123' });
  assert.equal(await adminKeyFrom(store({ [adminSlot(SHEET, 'abc123')]: 'K-SHEET' }), src.url, src.code), 'K-SHEET');
  // 내 서버를 골랐지만 아직 연결을 확인하지 못함(liveOk 아님): 사이트는 여전히 바로 배포 방을 씀 → 그 방의 키(완료 카드와 같은 규칙)
  assert.deepEqual(consoleKeySource({ ...moved, liveOk: false }, liveOf(moved), opts), { key: 'K-OLD-ROOM' });
  // 대표 주소가 다른 곳(Netlify + 구글 시트)이고 바로 배포한 적도 있는 연수: 바로 배포 방의 키가 아니라 시트의 키
  const elsewhere = v2({ provider: 'sheets', url: SHEET, code: 'abc123' }, { ...deploy, target: 'netlify', lastUrl: 'https://x.netlify.app/', sites: { ...deploy.sites, netlify: { url: 'https://x.netlify.app/', live: true } } }, { liveOk: true });
  assert.deepEqual(consoleKeySource(elsewhere, liveOf(elsewhere), opts), { url: SHEET, code: 'abc123' });
});

test('알 수 없으면 null: 키를 복사하지 않고 강사 화면만 엶', () => {
  const notOk = v2({ provider: 'sheets', url: SHEET, code: 'abc123' }, { target: 'netlify', lastUrl: 'https://x.netlify.app/', sites: { netlify: { url: 'https://x.netlify.app/', live: true } } }, { liveOk: false });
  assert.equal(consoleKeySource(notOk, liveOf(notOk), opts), null, '연결을 확인하지 못한 서버');
  const noUrl = v2({ provider: 'local', url: '', code: 'abc123' }, { target: 'netlify', lastUrl: 'https://x.netlify.app/' }, { liveOk: true });
  assert.equal(consoleKeySource(noUrl, liveOf(noUrl), opts), null, '연결한 서버가 없음');
  const off = v2({ provider: 'sheets', url: SHEET, code: 'abc123' }, { target: 'netlify', lastUrl: 'https://x.netlify.app/' }, { liveOk: true });
  assert.equal(consoleKeySource(off, liveOf(off), { ...opts, liveOn: false }), null, '대표 주소의 사이트에 참여 기능이 없음');
  assert.equal(consoleKeySource({ id: 'x' }, {}, opts), null);
});

test('liveOf: AI가 만든 연수는 meta.live, 예전 설계도 방식은 blueprint.live', () => {
  assert.deepEqual(liveOf(v2({ provider: 'supabase', url: 'https://a.supabase.co', code: 'c1' }, {})), { provider: 'supabase', url: 'https://a.supabase.co', code: 'c1' });
  assert.deepEqual(liveOf({ id: 'old', blueprint: { live: { provider: 'http', url: 'https://live.example', code: 'c2' } } }), { provider: 'http', url: 'https://live.example', code: 'c2' });
  assert.deepEqual(liveOf({ id: 'none' }), {});
  assert.deepEqual(liveOf(null), {});
  // 예전 설계도 방식도 같은 규칙으로 키를 찾음
  const old = { id: 'old', blueprint: { live: { provider: 'http', url: 'https://live.example', code: 'c2', features: ['qa'] } }, liveOk: true, deploy: { target: 'vercel', lastUrl: 'https://v.vercel.app/' } };
  assert.deepEqual(consoleKeySource(old, liveOf(old), opts), { url: 'https://live.example', code: 'c2' });
});
