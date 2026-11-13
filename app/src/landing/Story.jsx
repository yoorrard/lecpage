import { useEffect, useRef, useState } from 'preact/hooks';
import { useInView, useReduced } from './motion.js';
import { EX, shot, shotSize } from './facts.js';

/**
 * 붙박이 장면: 왼쪽 글(단계 넷)을 읽어 내려가는 동안 오른쪽 그림이 그 단계로 바뀌어요. 단계 번호를 잇는 선은 스크롤한 만큼 차올라요(CSS 스크롤 타임라인).
 * 넣어요(파일이 들어옴) → 읽어요(교재 쪽에서 찾은 것이 떠오름) → 정해요(컨셉 한 줄과 점 그림) → 엮어요(쪽이 넘어가며 사이트).
 * 글은 늘 제자리(겹치지 않음), 움직이는 것은 그림뿐. 휴대폰은 그림이 위에 붙고 글이 아래로 지나가요.
 * 동작 줄이기: 붙박이 없이 완성된 그림 한 장 + 글.
 */
const STEPS = [
  { k: '넣어요', h: '교재 파일을 놓아요', p: ['PPT·PDF·한글(HWP·HWPX)·워드를 놓아요. 여러 파일을 함께 넣어도 돼요.', '교재는 이 브라우저 안에서 읽어요. AI 회사로는 AI를 쓸 때만 보내요.'] },
  { k: '읽어요', h: '교재에서 필요한 것을 찾아요', p: ['연수명·날짜·장소로 빈칸을 채우고, 실습·프롬프트·일정·퀴즈를 골라 둬요.', '교재에 쓴 글꼴과 대표 색도 디자인에 가져와요.'] },
  { k: '정해요', h: '컨셉을 먼저 세워요', p: ['참가자가 겪을 경험을 한 줄로 정하고, 그 한 줄에 맞춰 디자인과 첫 화면 그림을 골라요.'], quote: true },
  { k: '엮어요', h: '연수 사이트로 엮어요', p: ['일정·준비물·교재 보기·실습·질문·투표를 교재 내용대로 엮어요.', '실습마다 ‘교재 n쪽’이 붙어 있어 어디서 왔는지 바로 보여요.'] },
];
const TAGS = [['연수명', EX.title], ['날짜', EX.when], ['장소', EX.venue], ['실습', '5개'], ['프롬프트', '3개'], ['퀴즈', '3문제'], ['교재 글꼴', 'Aa 가']];

/** 3시간을 1분 = 점 하나로(한 줄 30분). 예시 사이트의 첫 화면 그림과 같은 규칙 */
function MinuteDots() {
  const dots = []; let i = 0;
  for (const [n, c] of EX.minutes) for (let k = 0; k < n; k++, i++) dots.push(<circle cx={(i % 30) * 10 + 5} cy={Math.floor(i / 30) * 12 + 5} r="3.2" class={c ? `d-${c}` : 'd-rest'} style={{ '--i': i }} />);
  return <svg class="ld-dots" viewBox="0 0 300 70" role="presentation">{dots}</svg>;
}

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
  const chars = [...EX.concept];
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
              <small>교재 4쪽</small>
              <b><mark>PART 01 한 줄에 한 번의 기록</mark></b>
              {/* copy-ok: 교재 쪽 그림 속 원문(교재 인용) */}
              <span>날짜 · 번호 · 활동 · 점수 · 제출 여부. 이름 대신 번호를 씁니다.</span>
              <i class="ld-page-table">{['날짜', '번호', '활동', '점수', '제출'].map((x) => <u>{x}</u>)}{Array.from({ length: 10 }, () => <u />)}</i>
              <i class="ld-page-prompt"><u>프롬프트</u> 중학교 2학년 한 반(30명)의 4주 학습 기록 예시를 표로 만들어 줘.</i>
            </div>
            <ul class="ld-tags">{TAGS.map(([a, b], i) => <li style={{ '--i': i }}><small>{a}</small><b>{b}</b></li>)}</ul>
            <div class="ld-concept">
              <small>컨셉</small>
              <p>{chars.map((c, i) => <span style={{ '--i': i }}>{c}</span>)}</p>
              <MinuteDots />
              <span class="ld-concept-foot"><i>점 하나 = 1분</i><i>디자인 · {EX.design}</i></span>
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
                {s.quote && <blockquote class="ld-quote"><p>“{EX.concept}”</p><footer>예시 연수 ‘{EX.title}’의 컨셉이에요. 첫 화면 그림은 ‘{EX.motif}’, 디자인은 ‘{EX.design}’를 골랐어요.</footer></blockquote>}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
