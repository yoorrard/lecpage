import { useRef } from 'preact/hooks';
import { useProgress } from './motion.js';
import { SLIDES, shot } from './showcases.js';

// 다섯 단계(대표 사례 '질문이 먼저, AI는 그다음'의 실제 교재 쪽과 사이트 그림으로)
const STEPS = [
  { k: '교재 넣기', h: '쓰던 교재를 그대로 넣어요', p: 'PPT·PDF·한글·워드 파일을 놓으면 쪽 그림을 이 브라우저에서 바로 만들어요.' },
  { k: 'AI가 읽기', h: 'AI가 교재 원본을 직접 읽어요', p: '날짜·장소·정답 같은 사실은 원문 그대로 옮기고, 찾은 쪽 번호를 함께 보여 줘요.' },
  { k: '디자인', h: '이 강의만의 디자인이 나와요', p: '교재에서는 주제와 분위기만 읽고, 웹에 맞는 디자인을 새로 만들어요. WebGL 첫 화면, SVG 애니메이션, 스크롤 연출까지 강의마다 달라요.' },
  { k: '강의 기능', h: '강의 기능이 제자리에 들어가요', p: '교재 넘기기·출석·질문·투표·퀴즈·실습 단계·자료실·만족도 조사를 강의 흐름에 맞춰 끼워요.' },
  { k: '미리보기·수정', h: '보면서 바로 고쳐요', p: '휴대폰·태블릿·PC 화면으로 미리 보고 글자를 눌러 바로 고쳐요. 넘치거나 낱말이 갈리는 곳은 lecpage가 그려 보고 알려 줘요.' },
];
// 교재에서 찾은 사실(그 사례 lecpage.json facts의 값과 쪽)
const FACTS = [['일시', '2026. 12. 9.(수) 14:00', 1], ['장소', '누리솔교육연수원 2층', 1], ['확인 문제 정답', '② 질문', 15]];
const DESIGN = ['WebGL 신경망', '접혀 오르는 제목', '유리 띠'];
const KIT = ['출석', '교재 넘기기', '질문', '투표', '퀴즈', '실습 단계'];
// 슬라이드 다섯 장: 처음엔 부채처럼 겹침(x0·y0·r0) → 읽을 때 펼침(x1·y1·r1). 단위는 무대 폭·높이의 %(cqw·cqh)
const FAN = [[-6, 4, -8, -27, -18, -4], [-3, 2, -4, 0, -22, 2], [0, 0, 0, 27, -17, 5], [3, -2, 4, -14, 20, 3], [6, -4, 8, 14, 22, -3]];

/**
 * 교재가 사이트가 되기까지(스크롤에 묶인 한 장면): 왼쪽(휴대폰은 위)에 붙은 무대가 --t(0~4)를 따라 바뀌어요.
 * 0 교재 쪽이 부채처럼 → 1 펼쳐 읽고 사실을 뽑음 → 2 노트북 화면으로 빨려 들어가 사이트가 됨 → 3 휴대폰과 강의 기능 → 4 글 수정.
 * 값 하나(--t)만 바꾸고 나머지는 CSS가 계산해요. 동작 줄이기면 붙지 않고 끝 모습(--t:4) + 단계 글 목록.
 */
export function Story() {
  const sec = useRef();
  useProgress(sec, '--t', { scale: 4 });
  const pc = shot('pc-neo-teach'), m = shot('m-neo-teach');
  return (
    <section class="ld-story" aria-labelledby="ld-story-h">
      <header class="ld-story-head">
        <p class="ld-kicker">교재에서 사이트까지</p>
        <h2 id="ld-story-h">교재 한 부가 강의 사이트가 되기까지</h2>
      </header>
      <div class="ld-story-body" ref={sec}>
        <div class="ld-st-pin">
          <div class="ld-st-vis" aria-hidden="true">
            <div class="ld-st-slides">
              {SLIDES.slice(0, 5).map((n, k) => { const s = shot(`slide-${n}`); const f = FAN[k]; return <img src={s.src} width={s.w} height={s.h} alt="" loading="lazy" decoding="async" style={{ '--x0': f[0], '--y0': f[1], '--r0': f[2], '--x1': f[3], '--y1': f[4], '--r1': f[5], '--k': k }} />; })}
              <i class="ld-st-scan" />
            </div>
            <ul class="ld-st-facts">{FACTS.map(([k, v, pg], i) => <li style={{ '--k': i }}><small>{k}</small><b>{v}</b><em>교재 {pg}쪽</em></li>)}</ul>
            <div class="ld-st-pc"><img src={pc.src} width={pc.w} height={pc.h} alt="" loading="lazy" decoding="async" /></div>
            <ul class="ld-st-tags">{DESIGN.map((t, i) => <li style={{ '--k': i }}>{t}</li>)}</ul>
            <div class="ld-st-m"><img src={m.src} width={m.w} height={m.h} alt="" loading="lazy" decoding="async" /><i class="ld-st-edit"><span>글 수정</span></i></div>
            <ul class="ld-st-kit">{KIT.map((t, i) => <li style={{ '--k': i }}>{t}</li>)}</ul>
            <ul class="ld-st-dev"><li>휴대폰</li><li>태블릿</li><li>PC</li></ul>
          </div>
        </div>
        <ol class="ld-st-steps">
          {STEPS.map((s, i) => <li style={{ '--k': i }}><span class="ld-st-n" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span><small>{s.k}</small><h3>{s.h}</h3><p>{s.p}</p></li>)}
        </ol>
      </div>
    </section>
  );
}
