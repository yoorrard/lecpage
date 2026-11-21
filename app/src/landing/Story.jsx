import { useEffect, useRef, useState } from 'preact/hooks';
import { useInView, useReduced } from './motion.js';
import { EX, shot, shotSize } from './facts.js';

/**
 * 붙박이 장면: 왼쪽 글(단계 넷)을 읽어 내려가는 동안 오른쪽 그림이 그 단계로 바뀌어요. 단계 번호를 잇는 선은 스크롤한 만큼 차올라요(CSS 스크롤 타임라인).
 * 넣어요(파일이 들어옴) → 읽어요(AI가 교재 쪽에서 찾은 것이 떠오름) → 만들어요(교재 원본과 목표 한 문장을 한 번에 건네면 AI가 사이트 전체를) → 살펴봐요(참여 기능을 끼우고 교재와 맞춰 본 사이트).
 * lecpage는 AI의 디자인·구성에 끼어들지 않아요(만들기 흐름: docs/plan-ai-first.md).
 * 그림의 사이트는 대표 레퍼런스(AI가 이 교재로 만든 사이트)를 찍은 것. 글은 늘 제자리(겹치지 않음), 움직이는 것은 그림뿐.
 * 휴대폰은 그림이 위에 붙고 글이 아래로 지나가요. 동작 줄이기: 붙박이 없이 완성된 그림 한 장 + 글.
 */
const STEPS = [
  { k: '넣어요', h: '교재 파일을 놓아요', p: ['PPT·PDF·한글(HWP·HWPX)·워드를 놓아요. 여러 파일을 함께 넣어도 돼요.', '쪽 그림은 이 브라우저에서 그려요. 교재 원본은 고른 AI로만 가고, lecpage 서버는 거치지 않아요.'] },
  { k: '읽어요', h: 'AI가 교재를 직접 읽어요', p: ['AI가 교재의 내용과 흐름, 색과 모양까지 처음부터 끝까지 읽어요.', '연수명·날짜·장소 같은 연수 정보도 AI가 교재에서 찾아 돌려줘요.'] },
  { k: '만들어요', h: 'AI가 사이트 전체를 만들어요', p: ['교재 원본과 목표 한 문장을 한 번에 건네요. 참가자가 곁에 두고 쓰는 사이트, 주제를 그린 첫 화면을 바란다는 짧은 요청이에요.', 'lecpage는 디자인과 구성에 끼어들지 않아요. 같은 AI의 실력이 그대로 나와요.'] },
  { k: '살펴봐요', h: '강의 기능을 끼우고 교재와 맞춰 봐요', p: ['질문·투표·출석 같은 참여 기능을 끼우고, 사이트의 날짜·숫자·주소와 복사할 문구를 교재와 맞춰 봐요. 휴대폰과 PC 화면의 낱말 갈림·넘침도 알려 줘요.', '알림은 참고용이에요. 고칠지는 강사가 정하고, 미리보기에서 글자를 눌러 바로 고쳐요.'] },
];
const TAGS = [['연수명', EX.title], ['날짜', EX.when], ['장소', EX.venue], ['강사', EX.instructor], ['실습', '5개'], ['찾은 곳', '교재 1쪽']];
const MAKING = ['교재 원본 건네기', '목표 한 문장 추가', 'AI가 사이트 전체 쓰기', 'lecpage가 참여 기능 끼우기', '교재와 맞춰 보기', '화면 그려 살펴보기'];

export function Story() {
  const root = useRef(); const stage = useRef();
  const [step, setStep] = useState(0);
  const reduced = useReduced();
  const on = useInView(stage, { margin: '-10% 0px' });
  useEffect(() => {
    if (reduced) return;
    const steps = [...root.current.querySelectorAll('.ld-step')];
    // 화면의 가로 띠(PC: 가운데, 휴대폰: 그림 아래 글이 보이는 곳)를 지나는 단계가 지금 단계
    const narrow = matchMedia('(max-width: 899px)').matches;
    const io = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) setStep(steps.indexOf(e.target));
    }, { rootMargin: narrow ? '-72% 0px -26% 0px' : '-50% 0px -49% 0px' });
    steps.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [reduced]);
  const cur = reduced ? 3 : step;
  const sz = shotSize('site-data-lab');
  return (
    <section class={`ld-story${reduced ? ' is-still' : ''}`} ref={root} aria-labelledby="ld-story-h">
      <header class="ld-head">
        <h2 id="ld-story-h">교재가 연수 사이트가<br />되기까지</h2>
      </header>
      <div class="ld-story-grid">
        <div class="ld-story-vis">
          <div class={`ld-stage${on ? ' is-on' : ''}`} data-step={cur + 1} ref={stage} aria-hidden="true">
            <div class="ld-tray"><span>여기에 놓기</span></div>
            <div class="ld-file"><b>PDF</b><span><em>{EX.file}</em><small>{EX.pages}쪽</small></span></div>
            <div class="ld-sheet ld-page">
              <small>교재 5쪽</small>
              {/* copy-ok: 교재 쪽 제목 원문(교재 인용) */}
              <b><mark>1부 · 한 줄에 한 번의 기록</mark></b>
              <i class="ld-page-table">{['날짜', '번호', '활동', '점수', '제출'].map((x) => <u>{x}</u>)}{Array.from({ length: 10 }, () => <u />)}</i>
            </div>
            <ul class="ld-tags">{TAGS.map(([a, b], i) => <li style={{ '--i': i }}><small>{a}</small><b>{b}</b></li>)}</ul>
            <div class="ld-concept">
              <small>AI에게는 한 번에</small>
              <ol class="ld-mk">{MAKING.map((t, i) => <li style={{ '--i': i }}><i />{t}</li>)}</ol>
              <span class="ld-concept-foot"><i>디자인은 AI가</i><i>lecpage는 끼어들지 않아요</i></span>
            </div>
            <figure class="ld-site">
              <i class="ld-bar"><b /><b /><b /></i>
              <img src={shot('site-data-lab')} alt="" width={sz.w} height={sz.h} loading="lazy" decoding="async" />
            </figure>
            <ol class="ld-toc">{EX.stations.map(([t, pg], i) => <li style={{ '--i': i }}><span>실습 {i + 1}</span><b>{t}</b><small>교재 {pg}</small></li>)}</ol>
          </div>
        </div>
        <ol class="ld-steps">
          {STEPS.map((s, i) => (
            <li class={`ld-step${cur === i ? ' is-cur' : ''}`}>
              <div class="ld-step-in">
                <p class="ld-step-k"><span aria-hidden="true">{i + 1}</span>{s.k}</p>
                <h3>{s.h}</h3>
                {s.p.map((t) => <p>{t}</p>)}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
