// 교재 글꼴 → 사이트 글꼴: 감지(PPTX 테마·글자 조각), 이름 맞추기, 빌드 반영
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync, zipSync, strFromU8, strToU8 } from '../vendor/fflate.js';
import { ingestFile, materialToDraft } from '../src/ingest/index.js';
import * as E from '../src/index.js';
import { nodeRuntime } from '../node.js';

const FX = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

/** workshop.pptx의 테마 글꼴을 바꾸고, 글자 조각에 직접 적힌 글꼴은 지워 테마 글꼴을 따르게 함 */
function pptxWithThemeFonts(major, minor) {
  const files = unzipSync(new Uint8Array(readFileSync(join(FX, 'workshop.pptx'))));
  const theme = strFromU8(files['ppt/theme/theme1.xml'])
    .replace(/(<a:majorFont>[\s\S]*?<a:font script="Hang" typeface=")[^"]*"/, `$1${major}"`)
    .replace(/(<a:minorFont>[\s\S]*?<a:font script="Hang" typeface=")[^"]*"/, `$1${minor}"`);
  files['ppt/theme/theme1.xml'] = strToU8(theme);
  for (const n of Object.keys(files)) if (/^ppt\/slides\/slide\d+\.xml$/.test(n)) files[n] = strToU8(strFromU8(files[n]).replace(/<a:(latin|ea) typeface="[^"]*"\/>/g, ''));
  return zipSync(files);
}

test('PPTX: 테마 제목·본문 글꼴을 제목/본문 역할로 센다', async () => {
  const m = await ingestFile('deck.pptx', pptxWithThemeFonts('HY헤드라인M', '나눔고딕'));
  assert.deepEqual(m.errors, []);
  const f = m.detected.fonts;
  assert.equal(f.display.name, 'HY헤드라인M');
  assert.equal(f.body.name, '나눔고딕');
  assert.ok(f.body.share > 0.9 && f.all.length >= 2);
});

test('PPTX: 글자 조각에 적힌 글꼴(맑은 고딕)도 센다', async () => {
  const m = await ingestFile('workshop.pptx', readFileSync(join(FX, 'workshop.pptx')));
  assert.equal(m.detected.fonts.body.name, '맑은 고딕');
  assert.equal(m.files[0].fonts.body[0].name, '맑은 고딕');
});

test('글꼴 이름 맞추기: 같은 글꼴·비슷한 무료 글꼴·기본 글꼴', () => {
  const cases = [
    ['ABCDEF+NanumGothicBold', 'body', 'nanumGothic', true],
    ['Pretendard-SemiBold', 'display', 'pretendard', true],
    ['NanumSquareOTF_acEB', 'display', 'nanumSquare', true],
    ['G마켓 산스 TTF Bold', 'display', 'gmarket', true],
    ['Noto Sans CJK KR', 'body', 'notoSans', true],
    ['본명조', 'display', 'notoSerif', true],
    ['배달의민족 도현', 'display', 'doHyeon', true],
    ['HY헤드라인M', 'display', 'blackHan', false],
    ['HY헤드라인M', 'body', 'pretendard', false],
    ['HY신명조', 'body', 'notoSerif', false],
    ['함초롬돋움', 'body', 'notoSans', false],
    ['나눔손글씨 펜', 'body', 'gowunDodum', false],
    ['어떤 붓글씨체', 'display', 'gaegu', false],
  ];
  for (const [name, role, id, exact] of cases) {
    const m = E.matchFont(name, role);
    assert.equal(m.id, id, name);
    assert.equal(m.exact, exact, name + ' exact');
    assert.ok(E.FONTS[m.id], m.id + ' 글꼴 목록에 있어야 함');
  }
  assert.equal(E.matchFont('맑은 고딕').system, true);
  assert.equal(E.matchFont('함초롬바탕').system, true);
  assert.equal(E.matchFont(''), null);
});

test('빌드: 교재 글꼴이 사이트 글꼴이 되고, 기본 글꼴은 프리셋을 지킨다', async () => {
  const m = await ingestFile('deck.pptx', pptxWithThemeFonts('HY헤드라인M', '나눔고딕'));
  const draft = materialToDraft(m, { title: '글꼴 연수' });
  assert.equal(draft.design.sourceFonts.display.name, 'HY헤드라인M');
  const bp = { ...draft, design: { ...draft.design, preset: 'calm-forest' } };
  const css = E.build(bp, { runtime: nodeRuntime() }).files['assets/theme.css'];
  assert.match(css, /--font-display:'Black Han Sans'/);
  assert.match(css, /--font-sans:'Nanum Gothic'/);
  assert.match(css, /--display-weight:400/, '한 굵기뿐인 글꼴은 가짜 굵게를 쓰지 않음');
  // 선생님이 프리셋 글꼴을 고르면 교재 글꼴을 쓰지 않음
  const css2 = E.build({ ...bp, design: { ...bp.design, fontFrom: 'preset' } }, { runtime: nodeRuntime() }).files['assets/theme.css'];
  assert.match(css2, /--font-display:'MaruBuri'/);
  // 맑은 고딕(프로그램 기본)은 '고른 글꼴'이 아니므로 프리셋 제목 글꼴 유지
  const css3 = E.build({ meta: { title: 'x' }, design: { preset: 'calm-forest', sourceFonts: { display: { name: '맑은 고딕', share: 1 }, body: { name: '맑은 고딕', share: 1 } } }, sections: [{ type: 'hero' }] }, { runtime: nodeRuntime() }).files['assets/theme.css'];
  assert.match(css3, /--font-display:'MaruBuri'/);
  // 글꼴 파일은 무료 웹 글꼴 주소만(버전 고정 CDN·구글·네이버)
  const r = E.build(bp, { runtime: nodeRuntime() });
  for (const u of r.files['index.html'].match(/<link rel="stylesheet" href="https:[^"]+"/g) || []) assert.match(u, /fonts\.googleapis\.com|cdn\.jsdelivr\.net\/(gh|npm)\/[^/]+@|hangeul\.pstatic\.net/, u);
});
