import { useEffect, useRef, useState } from 'preact/hooks';
import { useInView, useReduced } from './motion.js';
import { shot, shotSize } from './facts.js';
import { Bench } from './Bench.jsx';

/**
 * 왜 lecpage: 한 문장(스크롤하면 낱말마다 잉크가 차오름) → 같은 교재·같은 요청으로 만든 두 사이트(밀어서 견주기) → 다른 점 넷(잰 값을 그림으로) → 잰 값과 조건.
 * 수치는 모두 잰 값이고 조건을 함께 적어요. 재는 방법: docs/research/benchmark-2026-11.md
 * 움직임: 문장·칸 채우기·줄 긋기는 CSS 스크롤 타임라인(지원하지 않거나 동작 줄이기면 완성된 모습). 견주기 손잡이는 처음 보일 때 한 번 오가요.
 */
const LINE = [['내용은'], ['쓰던', 'k'], ['AI가', 'k'], ['짜고,'], ['나머지는'], ['lecpage가', 'k'], ['해요']];

// AI 에이전트에 그냥 맡겼을 때 강사가 직접 한 일(측정 기록의 순서 목록). 같은 기기 두 번째 연수부터 lecpage는 0가지
const TASKS = [
  ['공개', ['ZIP 압축 풀기', '올릴 곳에 로그인', '폴더 끌어 놓기', '사이트 이름 바꾸기', 'QR 페이지 열기', '주소가 열리는지 확인']],
  ['질문·투표', ['투표 서비스 가입', '행사 만들기', '투표 문항 넣기', '링크 넣고 다시 올리기', '발표 모드 켜기', '투표 시작하기']],
];
const CHANGED = [1, 4, 7]; // 시험 답에서 AI가 바꿔 쓴 프롬프트(9개 중 3개)

/** 같은 교재·같은 요청으로 만든 두 사이트를 손잡이로 견줘요. 넓은 화면은 PC 그림, 좁은 화면은 휴대폰 그림 */
function Compare() {
  const box = useRef(); const frame = useRef(); const touched = useRef(false);
  const [v, setV] = useState(50);
  const reduced = useReduced();
  const near = useInView(box, { margin: '700px 0px', once: true });
  const seen = useInView(frame, { margin: '-30% 0px', once: true });
  // 처음 보일 때 손잡이가 한 번 오가며 밀 수 있다는 것을 알려 줌(손대면 멈춤)
  useEffect(() => {
    if (!seen || reduced || touched.current) return;
    const keys = [[0, 50], [600, 70], [1350, 32], [1900, 50]], t0 = performance.now(); let raf = 0;
    const ease = (x) => 0.5 - Math.cos(Math.PI * x) / 2;
    const step = (now) => {
      if (touched.current) return;
      const t = now - t0; const k = keys.findIndex(([at]) => at > t);
      if (k < 0) { setV(50); return; }
      const [a, va] = keys[k - 1], [b, vb] = keys[k];
      setV(Math.round((va + (vb - va) * ease((t - a) / (b - a))) * 10) / 10);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [seen, reduced]);
  const at = (e) => { const r = frame.current.getBoundingClientRect(); setV(Math.max(0, Math.min(100, Math.round(((e.clientX - r.left) / r.width) * 1000) / 10))); };
  const down = (e) => { if (e.button > 0) return; touched.current = true; frame.current.setPointerCapture?.(e.pointerId); at(e); };
  const move = (e) => { if (frame.current.hasPointerCapture?.(e.pointerId)) at(e); };
  const pc = (name) => ({ src: near ? shot(name) : undefined, ...shotSize(name) });
  const [a, b, am, bm] = [pc('vs-base'), pc('vs-lp'), pc('vs-base-m'), pc('vs-lp-m')];
  if (!shot('vs-base') || !shot('vs-lp')) return null;
  const img = (d, m) => <picture>{m.src && <source media="(max-width: 699.98px)" srcset={m.src} width={m.w} height={m.h} />}<img src={d.src} alt="" width={d.w} height={d.h} decoding="async" draggable={false} /></picture>;
  return (
    <div class="ld-vs" ref={box}>
      <h3 class="ld-h3">같은 교재, 같은 요청으로 만든 두 사이트</h3>
      <p class="ld-vs-lead">실습형 연수 PPT 21장으로 만들었어요. 손잡이를 옆으로 밀어 견줘 보세요.</p>
      {/* 키보드·화면 낭독기용 손잡이(보이지 않음, 초점이 오면 그림의 손잡이에 테두리) */}
      <input class="ld-vs-range" type="range" min="0" max="100" step="1" value={Math.round(v)} aria-label="두 사이트 견주기"
        aria-valuetext={`그냥 맡긴 사이트 ${Math.round(v)}%, lecpage 사이트 ${100 - Math.round(v)}% 보임`}
        onInput={(e) => { touched.current = true; setV(+e.currentTarget.value); }} />
      <div class="ld-vs-frame" ref={frame} style={{ '--v': `${v}%` }} onPointerDown={down} onPointerMove={move} role="img" aria-label="왼쪽은 AI 에이전트에 그냥 맡겨 만든 사이트의 첫 화면, 오른쪽은 lecpage로 만든 사이트의 첫 화면">
        <div class="ld-vs-a">{img(a, am)}</div>
        <div class="ld-vs-b" aria-hidden="true">{img(b, bm)}</div>
        <span class={`ld-vs-tag is-a${v < 18 ? ' is-off' : ''}`} aria-hidden="true">그냥 맡긴 사이트</span>
        <span class={`ld-vs-tag is-b${v > 82 ? ' is-off' : ''}`} aria-hidden="true">lecpage</span>
        <i class="ld-vs-handle" aria-hidden="true"><b /></i>
      </div>
      <p class="ld-vs-note">2026-11-13 측정 · 왼쪽은 AI 에이전트(코딩 도구)에 lecpage 없이 맡긴 결과, 오른쪽은 lecpage 설계도를 지금 엔진으로 그린 것</p>
    </div>
  );
}

/** 다른 점 넷: 잰 값을 그림으로(칸·줄·카드). 그림은 꾸밈이고 같은 내용이 글로 있어요 */
function Proof() {
  const box = useRef();
  const on = useInView(box, { margin: '-15% 0px', once: true });
  return (
    <div class={`ld-proof${on ? ' is-on' : ''}`} ref={box}>
      <h3 class="ld-h3">그냥 AI에 맡길 때와 다른 점</h3>
      <div class="ld-bento">
        <article class="ld-tile ld-t-cost">
          <h4>AI 비용</h4>
          <p class="ld-big"><b>1/127</b></p>
          <div class="ld-waf-wrap" aria-hidden="true">
            <div class="ld-waf">{Array.from({ length: 127 }, (_, i) => <i style={{ '--p': Math.round((i / 126) * 100) }} />)}</div>
            <div class="ld-waf-one"><i /></div>
            <small class="ld-waf-k">그냥 맡길 때 127</small><small class="ld-waf-k is-lp">lecpage 1</small>
          </div>
          <p>AI는 교재로 내용을 짤 때 한 번만 불러요. 디자인·공개·참여 기능·안내물·CSV에는 AI를 쓰지 않아요.</p>
          <p class="ld-foot">입력 약 2,630만 → 6,643토큰 · 출력 약 22만 → 약 6,000토큰. 같은 교재·같은 요청으로 만들기부터 연수 후 CSV까지, 토큰 단가로 환산</p>
        </article>
        <article class="ld-tile ld-t-todo">
          <h4>강사가 직접 할 일</h4>
          <p class="ld-big"><b>12</b><span class="ld-to" aria-label="에서">→</span><b class="is-lp">0</b><span class="ld-u">가지</span></p>
          <div class="ld-todo" aria-hidden="true">
            {TASKS.map(([g, list], k) => <div><small>{g}</small><ol style={{ '--k': k }}>{list.map((t, i) => <li style={{ '--i': k * 6 + i }}>{t}</li>)}</ol></div>)}
          </div>
          <p>공개와 질문·투표 준비는 앱이 해요. 첫 연수에 앱 안내대로 한 번 연결하면, 같은 기기의 두 번째 연수부터는 할 일이 없어요.</p>
          <p class="ld-foot">줄 그은 목록은 AI 에이전트에 그냥 맡겼을 때 강사가 직접 한 일이에요.</p>
        </article>
        <article class="ld-tile ld-t-keep">
          <h4>교재 원문</h4>
          <p class="ld-big"><b>9/9</b></p>
          <ol class="ld-keep" aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => <li class={CHANGED.includes(i) ? 'is-ch' : ''} style={{ '--i': CHANGED.indexOf(i) }}><u>프롬프트 {i + 1}</u><i /><i /></li>)}
          </ol>
          <p>AI 답이 교재 글을 바꾸거나 빠뜨려도 교재 지킴이가 교재대로 되돌려요.</p>
          <p class="ld-foot">교재 글을 일부러 바꾼 답으로 시험했을 때 프롬프트 원문이 9개 중 6개 → 9개 모두 교재대로</p>
        </article>
        <article class="ld-tile ld-t-live">
          <h4>질문·투표·출석은 사이트 안에서</h4>
          <div class="ld-mini" aria-hidden="true">
            <p><span>질문</span><b>공감 순으로 3개</b></p>
            <p><span>투표</span><b>24명 응답</b></p>
            <p><span>출석</span><b>입실 28명</b></p>
            <span class="ld-mini-btn">명단 CSV 받기</span>
          </div>
          <p>참가자는 다른 서비스에 가입하지 않아요. 연수가 끝나면 강사 화면에서 버튼 하나로 명단을 CSV로 받아요.</p>
        </article>
      </div>
      <details class="ld-bench-box">
        <summary>잰 값과 조건 보기</summary>
        <Bench />
      </details>
    </div>
  );
}

export function Why() {
  return (
    <section class="ld-why" aria-labelledby="ld-why-h">
      <header class="ld-head ld-why-head">
        <p class="ld-kicker">왜 lecpage인가요</p>
        <h2 id="ld-why-h" class="ld-ink">{LINE.map(([w, k], i) => <>{i ? ' ' : ''}<span class={k ? 'is-k' : ''} style={{ '--i': i }}>{w}</span></>)}</h2>
        <p class="ld-sub">ChatGPT·Claude·Gemini 창, API 키, AI 에이전트 무엇으로 내용을 짜도 돼요. 디자인·공개·진행·마무리는 lecpage가 이어서 해요.</p>
      </header>
      <Compare />
      <Proof />
    </section>
  );
}
