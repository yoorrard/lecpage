// 꼭 고칠 곳의 한 줄 요약(app/src/lib/plain-issue.js): 검수 문구에서 개발자용 정보(CSS 선택자·픽셀 수)를 빼고, 강사가 알아볼 파일 이름은 둠.
// 선택자는 엔진 inspect-rendered.js의 sel()이 적는 꼴 그대로 넣어 봄 — 괄호가 한 겹 더 든 것(:nth-of-type(2)), 요소 이름만, [data-lp="…"]가 요약에 남던 것
import test from 'node:test';
import assert from 'node:assert/strict';

const { plainIssue } = await import(new URL('../../../../app/src/lib/plain-issue.js', import.meta.url).href);
const { inspectRendered } = await import(new URL('../src/kit/inspect-rendered.js', import.meta.url).href);

const OVER = '화면이 가로로 넘쳐 옆으로 밀려요.';
test('가로 넘침: 어떤 꼴의 선택자도 요약에 남지 않음', () => {
  for (const sel of [
    'section#hero > div.wrap > img',
    'section#hero > div.wrap > img, div.card:nth-of-type(2)',
    'main > section:nth-of-type(3) > img',
    'img:nth-of-type(2)',
    'img', 'body', 'a', 'iframe',
    'img, body',
    '[data-lp="deck"]',
    '[data-lp="deck"], div.card.is-wide',
    'div.grid.cols-3',
    'table#schedule',
  ]) assert.equal(plainIssue(`화면이 가로로 1114px 넘쳐 옆으로 밀려요(${sel}).`), OVER, sel);
  assert.equal(plainIssue('화면이 가로로 24px 넘쳐 옆으로 밀려요.'), OVER);
});

test('엔진이 선택자를 적는 꼴이 그대로인지(바뀌면 위 목록에 새 꼴을 더할 것) + 그 꼴을 한 문구에 섞은 것', () => {
  // 검수 함수는 문서 전체를 재므로 여기서 돌리지 않고, sel()이 붙이는 조각과 가로 넘침 문구가 소스에 그대로 있는지만 봄
  const src = inspectRendered.toString();
  assert.match(src, /':nth-of-type\('/, 'sel()은 클래스가 없는 같은 요소에 :nth-of-type(n)을 붙임');
  assert.match(src, /'\[data-lp="'/, 'sel()은 키트 자리를 [data-lp="…"]로 적음');
  assert.match(src, /넘쳐 옆으로 밀려요/, '가로 넘침 문구');
  assert.equal(plainIssue('화면이 가로로 300px 넘쳐 옆으로 밀려요(section#hero > div.wrap > img:nth-of-type(2), [data-lp="deck"], img).'), OVER);
});

test('파일 이름·강사가 알아볼 말은 그대로 둠', () => {
  for (const m of [
    '그림이 열리지 않아요(material/p-001.webp).',
    '그림이 열리지 않아요(assets/img/사진 (1).png).',
    '그림이 열리지 않아요(assets/img/logo.svg).',
    '링크 files/canvas.pdf가 가리키는 파일이 없어요.',
    'index.html: 그림 material/p-140.webp가 사이트에 없어요.',
    'index.html의 끝이 잘린 것 같아요(</body>·</html>이 없음).',
    '비밀번호 칸(type=password)은 강의 사이트에 넣을 수 없어요(바로 배포가 거절해요).',
    '투표에 질문(data-question)이 없어요.',
    '투표 보기는 2~6개여야 해요(지금 7개).',
    '교재 쪽 그림(material/p-NNN.webp)이 없어 교재 슬라이드를 채울 수 없어요.',
    '"자세히" 글이 바탕과 거의 같은 색이라 안 보여요(1.20:1).',
  ]) assert.equal(plainIssue(m), m, m);
});

test('빈 값·끝 글자 정리', () => {
  assert.equal(plainIssue(''), ''); assert.equal(plainIssue(null), ''); assert.equal(plainIssue(undefined), '');
  assert.equal(plainIssue('  화면이 가로로 12.5px 넘쳐 옆으로 밀려요 (div.wrap) .'), OVER);
});
