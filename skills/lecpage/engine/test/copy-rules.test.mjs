// 문구 규칙(copy-rules.js)의 새 규칙: 말투·높임·수동·명사 나열·오류문·문장부호·용어, 정해진 용어 예외, 고친 안
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { lintText, suggestFix, maskFixed, FIXED_TERMS, TERM_RULES, copyRulesPrompt } from '../src/prompt/copy-rules.js';

const ids = (t, k, o) => lintText(t, k, o).map((f) => f.id);
const has = (t, id, k, o) => ids(t, k, o).includes(id);

describe('문구 규칙: 말투', () => {
  test('합니다체 섞임은 살핌, 굳은 인사·자기소개·동의 문장·문서는 통과', () => {
    assert.ok(has('기록을 저장합니다.', 'formal'));
    assert.ok(has('없는 글입니다.', 'formal', 'error'));
    assert.ok(has('여기를 누르십시오.', 'formal'));
    assert.equal(lintText('기록을 저장합니다.').find((f) => f.id === 'formal').level, 'warn');
    for (const ok of ['참여해 주셔서 감사합니다.', '안녕하세요, 아침마다 마음 날씨를 묻는 유영재입니다.', '저장했어요.']) assert.ok(!has(ok, 'formal'), ok);
    assert.ok(!has('이름을 출석 확인에만 쓰는 데 동의합니다.', 'formal', 'label'), '참가자가 직접 하는 동의 문장');
    assert.deepEqual(lintText('참여 기능을 쓰지 않으면 질문을 쓸 수 없습니다.', 'doc'), [], '개인정보 안내·문서는 말투를 보지 않음');
  });
  test('과한 높임', () => {
    for (const s of ['지우시겠어요?', '확인하시기 바랍니다.', '양식을 작성해 주십시오.', '선생님께서 계신가요?']) assert.ok(has(s, 'honor'), s);
    for (const s of ['지울까요?', '도움이 되셨나요?', '확인해 주세요.']) assert.ok(!has(s, 'honor'), s);
  });
  test('수동 표현은 살핌, 이중 피동은 고침, 상태 알림은 통과', () => {
    assert.ok(has('설정이 변경되었습니다.', 'passive'));
    assert.ok(has('구글 시트와 연결됐어요.', 'passive'));
    assert.equal(lintText('잘 보여지지 않아요.').find((f) => f.id === 'passive').level, 'error');
    for (const s of ['연수 기간이 끝났어요.', '공개 기간이 만료됐어요.', '열어 둔 설문이 닫혔어요.']) assert.ok(!has(s, 'passive'), s);
  });
});

describe('문구 규칙: 명사 나열과 정해진 용어', () => {
  test('알림·오류의 명사 나열은 살핌. 상태 표시·범례는 명사로 써도 됨', () => {
    assert.ok(has('설정 변경 완료', 'noun', 'toast'));
    assert.ok(has('파일 업로드 실패', 'noun', 'error'));
    assert.ok(has('설정을 바꿨어요. 저장 완료.', 'noun', 'text'), '화면 글도 마침표로 끝낸 문장이면 봄');
    for (const s of ['답변 완료', '확인 필요', '초록 완료 · 주황 하는 중']) assert.ok(!has(s, 'noun', 'text'), s);
  });
  test('정해진 용어(교육 행정·화면 이름)는 한 낱말로 보고 풀어쓰기를 요구하지 않음', () => {
    assert.equal(maskFixed('직무연수 이수 기준과 출석 확인'), '□ □과 □');
    assert.ok(FIXED_TERMS.includes('이수 기준') && FIXED_TERMS.includes('참여 기능'));
    for (const s of ['이수 기준', '출석 확인', '직무연수 이수 기준을 확인해요.', '만족도 조사', '특수분야 직무연수 교육청 승인']) {
      assert.deepEqual(lintText(s, 'text').filter((f) => f.id === 'noun' || f.id === 'trans'), [], s);
    }
    assert.ok(!has('특수분야 직무연수 교육청 승인 완료', 'noun', 'title'), '제목은 명사로 끝나도 됨');
    // 공문투 "~시"는 정해진 용어를 가리고 봄: "접속 확인 시" 같은 용어 속 글자로 잘못 걸리지 않음
    assert.ok(has('입력 시 주의해요.', 'trans'));
  });
  test('번역투·공문투', () => {
    for (const s of ['오류로 인해 열지 못했어요.', '확인을 진행해 주세요.', '금일 연수는 3시에 끝나요.', '자료를 필히 받아 두세요.']) assert.ok(has(s, 'trans'), s);
    assert.ok(!has('오늘 연수는 3시에 끝나요.', 'trans'));
  });
});

describe('문구 규칙: 오류문·문장부호·버튼', () => {
  test('무슨 일인지·다음 할 일이 없는 오류문', () => {
    assert.ok(has('오류가 발생했습니다.', 'error'));
    assert.ok(has('알 수 없는 오류', 'error', 'error'));
    assert.ok(has('그림을 읽지 못했어요.', 'error', 'toast'));
    for (const s of ['오류가 발생했어요. 다시 눌러 주세요.', '그림을 읽지 못했어요. PNG나 JPG로 다시 넣어 주세요.', '저장하지 못했어요. 저장 공간을 확인해 주세요.']) assert.ok(!has(s, 'error', 'toast'), s);
    assert.ok(!has('그림을 읽지 못했어요.', 'error', 'text'), '안내 글 속 한 문장은 보지 않음(앞뒤에 할 일이 있을 수 있음)');
  });
  test('느낌표·이모지·줄임표·조사 병기', () => {
    assert.ok(has('공개했어요!', 'mark'));
    assert.equal(lintText('공개했어요!!').find((f) => f.id === 'mark').level, 'error');
    assert.ok(has('저장(💾)해요', 'deco'));
    assert.ok(!has('완료 ✓', 'deco'), '체크 표시는 장식이 아님');
    assert.ok(has('불러오는 중...', 'mark'));
    assert.ok(has('교재을(를) 뺐어요.', 'mark'));
    assert.ok(!has('> [!NOTE] 참고해요.', 'mark'), '문서 표기');
  });
  test('뜻이 흐린 버튼 이름과 "취소"', () => {
    assert.ok(has('확인', 'cta', 'button'));
    assert.ok(has('취소', 'cta', 'button'));
    for (const s of ['지우기', '닫기', '멈추기', '설문 열기']) assert.ok(!has(s, 'cta', 'button'), s);
    assert.ok(!has('확인', 'cta', 'text'), '버튼이 아니면 보지 않음');
  });
  test('칸별 길이', () => {
    assert.ok(lintText('지금은 이 컴퓨터에서만 시험할게요', 'button').some((f) => f.id === 'len'));
    assert.ok(lintText('되돌렸어요. 그 뒤에 고친 내용도 함께 돌아갔어요. 위 [되돌리기]로 다시 살릴 수 있어요.', 'toast').some((f) => f.id === 'len'));
    assert.ok(!lintText('공개했어요.', 'toast').some((f) => f.id === 'len'));
  });
});

describe('문구 규칙: 용어 통일', () => {
  test('참가자 화면에도 쓰는 용어는 기본으로, 앱 용어는 terms: all일 때만', () => {
    assert.ok(has('참여자 30명', 'term'));
    assert.ok(has('실시간 기능이 꺼져 있어요.', 'term'));
    assert.ok(!has('실시간 연결됨', 'term'), '연결 상태 표시는 그대로');
    assert.ok(has('링크를 클릭하세요.', 'term'));
    assert.ok(!has('단추를 눌러 주세요.', 'term'), '앱 용어(버튼)는 기본으로 보지 않음');
    assert.ok(has('단추를 눌러 주세요.', 'term', 'text', { terms: 'all' }));
    assert.ok(!has('QR 코드 크게 보기', 'term', 'aria', { terms: 'all' }), '화면 읽기 이름표의 "QR 코드"는 됨');
    assert.ok(has('Supabase 새 프로젝트를 만들어요.', 'term', 'text', { terms: 'all', group: 'app' }) === false, '다른 서비스의 프로젝트');
    assert.ok(has('프로젝트 파일을 저장했어요.', 'term', 'toast', { terms: 'all', group: 'app' }));
    assert.ok(!has('프로젝트 파일을 저장했어요.', 'term', 'toast', { terms: 'all', group: 'page' }), '앱에만 있는 규칙');
    assert.ok(!has('순서를 바꾸거나 더하고 빼요.', 'term', 'text', { terms: 'all' }), '문장 속 "더하다"는 그대로');
    assert.ok(TERM_RULES.every((t) => t.re && t.why && t.fix));
  });
});

describe('고친 안(suggestFix)', () => {
  test('어미·피동·조사·문장부호·용어를 기계적으로 고침', () => {
    assert.equal(suggestFix('저장되었습니다.', 'toast'), '저장했어요.');
    assert.equal(suggestFix('실시간 기능이 꺼져 있습니다.', 'error'), '참여 기능이 꺼져 있어요.');
    assert.equal(suggestFix('없는 글입니다.'), '없는 글이에요.');
    assert.equal(suggestFix('내보낼 수 없는 종류입니다.'), '내보낼 수 없는 종류예요.');
    assert.equal(suggestFix('참여 응답이 올바르지 않습니다.'), '참여 응답이 올바르지 않아요.');
    assert.equal(suggestFix('동의해야 합니다.'), '동의해야 해요.');
    assert.equal(suggestFix('공개했어요! 주소를 보내세요.'), '공개했어요. 주소를 보내세요.');
    assert.equal(suggestFix('교재을(를) 뺐어요.'), '교재를 뺐어요.');
    assert.equal(suggestFix('불러오는 중...'), '불러오는 중…');
    assert.equal(suggestFix('단추를 눌러 주세요.', 'text', { terms: 'all' }), '버튼을 눌러 주세요.', '용어를 바꾸면 뒤 조사도 맞춤');
    assert.equal(suggestFix('이미지가 없어요.', 'text', { terms: 'all' }), '그림이 없어요.');
  });
  test('뜻이 달라질 수 있는 것은 고치지 않음', () => {
    assert.equal(suggestFix('기록은 그 서버에 쌓입니다.'), '', '쌓이다(움직씨)를 "쌓이에요"로 바꾸지 않음');
    assert.equal(suggestFix('자료를 받습니다.'), '', '불규칙이 섞일 수 있는 줄기는 사람이 고침');
    assert.equal(suggestFix('안녕하세요, 유영재입니다.'), '', '자기소개');
    assert.equal(suggestFix('개인정보를 처리합니다.', 'doc'), '', '문서');
    assert.equal(suggestFix('저장했어요.'), '');
  });
});

test('AI 프롬프트에 해요체·능동·가벼운 높임·정해진 용어 안내가 들어감', () => {
  const p = copyRulesPrompt();
  for (const w of ['해요체', '저장했어요', '할까요', '직무연수', '이수 기준', '다음 할 일']) assert.ok(p.includes(w), w);
});

// 앱 화면 글 검사(app/scripts/copy-lint.mjs). JSX를 읽는 @babel/parser가 app/node_modules에 있을 때만
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const hasParser = existsSync(join(ROOT, 'app', 'node_modules', '@babel', 'parser'));
test('앱 문구 검사: JSX 글·속성·알림·오류·HTML 조각을 뽑고 문서·AI 지시문은 가림', { skip: !hasParser && 'app/node_modules 없음' }, async () => {
  const { extract, lintUnits } = await import(pathToFileURL(join(ROOT, 'app', 'scripts', 'copy-lint.mjs')).href);
  const src = `
    import { toast } from './util.js';
    const RULES = ['- 번역투("~를 통해")를 쓰지 않는다.'];
    export function A({ n }) {
      if (n) toast('저장되었습니다!');
      if (!n) throw new Error('오류가 발생했습니다.');
      return <div><h2>연수 지우기</h2><p>이 연수를 <b>지울까요</b>? 지운 뒤에는 되돌릴 수 없어요.</p>
        <input placeholder="예: 3모둠" aria-label="자리" /><button class="btn">확인</button></div>;
    }
    function renderPrivacy() { return '<p>개인정보를 처리합니다. 쓸 수 있습니다.</p>'; }
    const html = '<div><button class="lp-btn">' + label + '</button><p>참여자 ' + n + '명이 들어왔습니다.</p></div>';
    const form = '<label><span>소속(학교)</span><input name="school"></label><label class="lp-consent"><input type="checkbox" name="consent"><span>이름·소속을 출석 확인에만 쓰는 데 동의합니다.</span></label>';`;
  const units = extract(src, 'x.jsx');
  const get = (t) => units.find((u) => u.text.includes(t));
  assert.equal(get('저장되었습니다').kind, 'toast');
  assert.equal(get('오류가 발생').kind, 'error');
  assert.equal(get('연수 지우기').kind, 'title');
  assert.equal(get('이 연수를 지울까요').text, '이 연수를 지울까요? 지운 뒤에는 되돌릴 수 없어요.', '문장 속 태그는 한 문구로');
  assert.equal(get('3모둠').kind, 'placeholder');
  assert.equal(get('확인').kind, 'button');
  assert.equal(get('개인정보를').kind, 'doc');
  assert.ok(!get('번역투'), 'AI 지시문은 뽑지 않음');
  assert.equal(get('명이 들어왔습니다').text, '참여자 {…}명이 들어왔습니다.', '이어 붙인 HTML도 태그 단위로');
  assert.equal(get('소속(학교)').kind, 'label');
  assert.equal(get('출석 확인에만').kind, 'text', '체크 칸을 감싼 label은 문장(동의 문장)');
  const f = lintUnits(units.map((u) => ({ ...u, group: 'page' })));
  const rules = (t) => f.filter((x) => x.text.includes(t)).map((x) => x.rule);
  assert.ok(rules('저장되었습니다').includes('passive') && rules('저장되었습니다').includes('mark'));
  assert.equal(f.find((x) => x.text.includes('저장되었습니다')).fixed, '저장했어요.');
  assert.ok(rules('오류가 발생').includes('error'));
  assert.ok(rules('확인').includes('cta'));
  assert.ok(rules('참여자').includes('term'));
  assert.deepEqual(rules('개인정보를'), [], '문서는 말투를 보지 않음');
});
