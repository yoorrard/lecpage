import { useEffect, useRef, useState } from 'preact/hooks';
import { useInView, useReduced } from './motion.js';
import { useInk, useTween } from './motion-more.js';
import { shot, shotSize } from './facts.js';
import { BENCH, benchItems, fmt, Bench } from './Bench.jsx';

/**
 * 왜 lecpage(스크롤텔링 한 구간): 문제 한 줄 → 단계마다 '그냥 AI 에이전트'와 lecpage를 견주는 장부 → 결론 한 줄과 잰 값(Bench.jsx).
 * 장부: 단계 다섯(교재 옮기기·디자인·배포·질문·투표 준비·연수 당일과 연수 후)을 내려가면, 화면 아래에 붙은 합계 줄에서
 *   그냥 맡길 때는 강사가 할 일 칸이 차고 AI 비용 막대가 자라고, lecpage 쪽 칸은 비어 있어요. 장부 끝에서 합계 줄이 제자리에 내려앉아요.
 * 할 일 열두 가지는 측정 기록의 실제 목록이고, 수치는 모두 src/data/benchmark.json(재는 방법: docs/research/benchmark-2026-11.md)에서 읽어요.
 * 움직임: 제목 잉크·형광펜은 CSS 스크롤 타임라인(지원하지 않는 브라우저는 화면에 들어올 때 한 번, motion-more.js useInk),
 *   단계·합계 줄은 읽는 자리(화면 70%)를 지난 단계로 정함(IntersectionObserver). 글은 움직이지 않고 칸·줄·막대·체크만 움직여요.
 *   동작 줄이기: 모든 단계를 지난 완성된 모습.
 */
// copy-ok: 운영자가 정한 카피(글자 그대로 씀). 해요체 예외
export const ASK = '누구나 만들 수 있지만, 잘 만들어 나누려면 노하우가 필요합니다';
// copy-ok: 운영자가 정한 카피(글자 그대로 씀). 해요체 예외
export const SAVE = '바쁜 강사님의 시간과 토큰을 아껴드립니다';

// AI 에이전트에 그냥 맡겼을 때 강사가 직접 한 일(측정 기록의 순서 목록, 배포 여섯 + 질문·투표 여섯 = benchmark.json의 setup 12)
const DEPLOY = ['ZIP 압축 풀기', '배포할 곳에 로그인', '폴더 끌어 놓기', '사이트 이름 바꾸기', 'QR 페이지 열기', '주소가 열리는지 확인'];
const VOTE = ['투표 서비스 가입', '행사 만들기', '투표 문항 넣기', '링크 넣고 다시 배포', '발표 모드 켜기', '투표 시작하기'];
// 단계마다: 그냥 맡길 때(base)와 lecpage(lp). AI는 그냥 맡길 때 단계마다 다시 부르고, lecpage는 내용을 짤 때 한 번만 불러요
const ROWS = [
  { k: '교재 옮기기', base: 'AI가 교재로 내용을 짜요. 옮겨 쓴 프롬프트가 교재와 같은지는 강사가 맞춰 봐요.', lp: 'AI는 여기서 한 번만 불러요. 바뀌거나 빠진 프롬프트는 교재 지킴이가 교재 원문대로 되돌려요.', lpAi: true },
  { k: '디자인', base: '디자인은 AI가 그때그때 정해요. 바꾸려면 다시 요청해요.', lp: '컨셉을 먼저 세우고, 교재 주제와 분위기에 맞는 디자인을 골라요.', vs: true, note: '두 쪽이 같은 요청으로 만든 첫 화면이에요.' },
  { k: '배포', tasks: DEPLOY, done: '앱이 해요' },
  { k: '질문·투표 준비', tasks: VOTE, base: '참가자는 사이트 밖 서비스에서 투표해요.', done: '사이트에 들어 있어요' },
  { k: '연수 당일·연수 후', base: '고칠 때마다 다시 요청하고 다시 배포해요. 명단은 설문을 새로 만들어 받아요.', lp: '연수가 끝나면 강사 화면에서 명단을 CSV로 받아요.' },
];
const TASK_N = ROWS.reduce((a, r) => a + (r.tasks?.length || 0), 0);
const AI_ON = 'AI 요청', AI_OFF = 'AI 없이';

/** 문장을 낱말 조각으로(띄어쓰기는 글 노드로 남겨 글자 그대로). keys: 형광펜을 긋는 낱말 */
function Words({ text, keys = [], from = 0 }) {
  return text.split(' ').map((w, i) => <>{i ? ' ' : ''}<span class={`ld-w${keys.includes(w) ? ' is-k' : ''}`} style={{ '--i': from + i }}>{w}</span></>);
}

/** 그냥 맡길 때와 lecpage가 같은 교재·같은 요청으로 만든 첫 화면(휴대폰 너비는 휴대폰 그림, 그보다 넓으면 PC 그림) */
function Shot({ name, near }) {
  if (!shot(name)) return null;
  const d = shotSize(name), m = shotSize(`${name}-m`), ms = shot(`${name}-m`);
  return (
    <figure class="ld-shot" aria-hidden="true">
      {near && <picture>{ms && <source media="(max-width: 599.98px)" srcset={ms} width={m.w} height={m.h} />}<img src={shot(name)} alt="" width={d.w} height={d.h} decoding="async" /></picture>}
    </figure>
  );
}

function Row({ r, i, on, near, base }) {
  return (
    <li class={`ld-row${on ? ' is-in' : ''}${r.vs ? ' is-vs' : ''}`} data-row={i}>
      <div class="ld-row-k">
        <h3><span aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>{r.k}</h3>
        {r.note && <p>{r.note}</p>}
      </div>
      <div class="ld-cell is-base">
        <p class="ld-lane">{base}</p>
        {r.vs && <Shot name="vs-base" near={near} />}
        {r.base && <p>{r.base}</p>}
        {r.tasks && <ul class="ld-tasks" aria-label="강사가 직접 할 일">{r.tasks.map((t, n) => <li style={{ '--i': n }}>{t}</li>)}</ul>}
        <span class="ld-ai is-on">{AI_ON}</span>
      </div>
      <div class="ld-cell is-lp">
        <p class="ld-lane">lecpage</p>
        {r.vs && <Shot name="vs-lp" near={near} />}
        {r.lp && <p>{r.lp}</p>}
        {r.tasks && <>
          <p class="ld-done">{r.done}</p>
          <ul class="ld-tasks" aria-label="앱이 하는 일">{r.tasks.map((t, n) => <li style={{ '--i': n }}>{t}</li>)}</ul>
        </>}
        <span class={`ld-ai${r.lpAi ? ' is-on' : ''}`}>{r.lpAi ? AI_ON : AI_OFF}</span>
      </div>
    </li>
  );
}

/**
 * 합계 줄: 장부를 내려가는 동안 화면 아래에 붙어 있다가 장부 끝에 내려앉아요. 할 일 칸·AI 비용 막대는 지난 단계만큼.
 * 막대의 끝 비율은 잰 AI 비용(benchmark.json cost), 할 일 수는 setup. 그림은 꾸밈이고 같은 내용을 화면 낭독기용 글로 둬요.
 */
function Tally({ rows, reduced, base }) {
  const setup = benchItems().find((x) => x.id === 'setup');
  const cost = benchItems().find((x) => x.id === 'cost');
  const done = rows.reduce((a, on, i) => a + (on ? ROWS[i].tasks?.length || 0 : 0), 0);
  const n = useTween(done, reduced);
  const p = rows.filter(Boolean).length / ROWS.length; // 지난 단계 비율(그냥 맡길 때는 단계마다 AI를 다시 부름)
  const lp = rows[0] ? (cost ? cost.lecpage / Math.max(cost.baseline, 1e-9) : 0) : 0; // lecpage는 첫 단계에서 한 번
  const sq = (fill) => <i class="ld-sq">{Array.from({ length: TASK_N }, (_, k) => <b class={k < fill ? 'is-on' : ''} />)}</i>;
  const unit = setup?.unit || '가지';
  return (
    <div class="ld-tally">
      {setup && <p class="ld-sr">{setup.name}: {base} {fmt(setup.baseline, setup)}{unit}, lecpage {fmt(setup.lecpage, setup)}{unit}{setup.conditions ? `(${setup.conditions})` : ''}</p>}
      <div class="ld-tally-in" aria-hidden="true">
        <p class="ld-tally-k">합계</p>
        <div class="ld-t-lane is-base">
          <p class="ld-lane">{base}</p>
          <p class="ld-t-row"><span>할 일</span>{sq(Math.round(n))}{setup && <em>{Math.round(n)}{unit}</em>}</p>
          <p class="ld-t-row"><span>AI 비용</span><i class="ld-meter"><b style={{ '--p': p }} /></i></p>
        </div>
        <div class="ld-t-lane is-lp">
          <p class="ld-lane">lecpage</p>
          <p class="ld-t-row"><span>할 일</span>{sq(0)}{setup && <em>{fmt(setup.lecpage, setup)}{unit}{setup.conditions && <sup>*</sup>}</em>}</p>
          <p class="ld-t-row"><span>AI 비용</span><i class="ld-meter"><b style={{ '--p': lp }} class={lp ? 'is-on' : ''} /></i></p>
        </div>
      </div>
    </div>
  );
}

export function Why() {
  const head = useRef(); const led = useRef(); const saveH = useRef();
  const reduced = useReduced();
  const near = useInView(led, { margin: '700px 0px', once: true });
  const [rows, setRows] = useState(() => ROWS.map(() => false));
  useInk(head); useInk(saveH);
  // 읽는 자리(화면 위에서 70%)를 지난 단계: 위로 지나간 단계도 지난 것으로(되돌아 올라가면 다시 줄어듦)
  useEffect(() => {
    const els = [...led.current.querySelectorAll('.ld-row')];
    if (reduced || typeof IntersectionObserver !== 'function') { setRows(ROWS.map(() => true)); return; }
    const io = new IntersectionObserver((es) => {
      setRows((prev) => {
        const next = [...prev];
        for (const e of es) {
          const line = e.rootBounds ? e.rootBounds.bottom : innerHeight * 0.7;
          next[+e.target.dataset.row] = e.boundingClientRect.top < line;
        }
        return next.some((v, i) => v !== prev[i]) ? next : prev;
      });
    }, { rootMargin: '0px 0px -30% 0px', threshold: [0, 1] });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [reduced]);
  const base = BENCH.baseline || 'AI 에이전트에 그냥 맡길 때';
  const [l1, l2] = ASK.split(', ');
  return (
    <section class="ld-why" aria-labelledby="ld-why-h">
      <header class="ld-head ld-why-head">
        <p class="ld-kicker">왜 lecpage인가요</p>
        <h2 id="ld-why-h" class="ld-ink" ref={head}><span class="ld-ink-l"><Words text={`${l1},`} /></span>{' '}<span class="ld-ink-l"><Words text={l2} keys={['노하우가']} from={l1.split(' ').length} /></span></h2>
        <p class="ld-sub">AI 에이전트에 맡겨도 사이트는 나와요. 그다음 단계마다 강사가 할 일과 드는 토큰이 달라요.</p>
      </header>
      <div class="ld-led" ref={led}>
        <p class="ld-led-head" aria-hidden="true"><span /><span class="is-base">{base}</span><span class="is-lp">lecpage</span></p>
        <ol class="ld-rows">{ROWS.map((r, i) => <Row r={r} i={i} on={rows[i]} near={near} base={base} />)}</ol>
        <Tally rows={rows} reduced={reduced} base={base} />
      </div>
      <div class="ld-save">
        <h3 class="ld-ink" ref={saveH}><Words text={SAVE} keys={['시간과', '토큰을']} /></h3>
        <Bench />
      </div>
    </section>
  );
}
