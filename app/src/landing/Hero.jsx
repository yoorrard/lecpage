import { useEffect, useRef, useState } from 'preact/hooks';
import { SHOWCASES, shot, siteUrl } from './showcases.js';
import { isFine, isReduced } from './motion.js';
import { lightBar, StatusIcons } from './devices.jsx';

/**
 * 첫 화면 무대: AI가 교재로 만든 실제 사이트 셋을 노트북·휴대폰 틀에 띄워 번갈아 보여 줘요(그림은 실제 사이트를 찍은 것).
 * - 넘기기: 고르기 단추의 막대(CSS 애니메이션)가 다 차면 다음 사례로. 단추를 누르면 그 사례에 멈추고, [재생]으로 다시 돌아요.
 *   화면 밖이거나 탭이 숨으면 막대도 멈춤. 동작 줄이기면 자동으로 넘기지 않고 바로 바뀜.
 * - 뒤 빛은 사례의 대표색 둘(--c1·--c2, @property로 부드럽게 바뀜). 섬세한 포인터에서는 틀이 마우스 쪽으로 조금 기울어요.
 * - 첫 사례 그림만 먼저 받고(가장 큰 그림), 나머지는 첫 그림을 그린 뒤 틈에 받아요.
 * - 틀은 CSS로만 그려요(기기 그림·상표 모양 없음). 노트북 = 뚜껑(얇은 검은 테·카메라) + 알루미늄 바닥판,
 *   휴대폰 = 금속 띠 + 얇은 검은 테 + 화면(19.5:9). 휴대폰 화면 위 상태 표시줄은 사이트 맨 윗줄 색(shots.json의 bar)으로 이어 칠하고,
 *   사이트 그림은 그 아래(390×795)에 그대로 놓아 카메라 구멍이 사이트 내용을 가리지 않게 해요.
 * 틀과 그림은 꾸밈(aria-hidden)이고, 같은 내용을 아래 한 줄(사이트 이름·교재 쪽수·사이트 열기)로 읽어 줘요.
 */
export function HeroStage() {
  const box = useRef();
  const [i, setI] = useState(0);
  const [all, setAll] = useState(false);
  const [play, setPlay] = useState(() => !isReduced());
  const [seen, setSeen] = useState(true); // 화면에 보이고 탭이 앞에 있을 때만 막대가 참
  useEffect(() => {
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 1200));
    const go = () => idle(() => setAll(true), { timeout: 2500 });
    if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
    const el = box.current; if (!el) return undefined;
    let vis = true;
    const sync = () => setSeen(vis && !document.hidden);
    const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver(([e]) => { vis = e.isIntersecting; sync(); }) : null;
    io?.observe(el);
    document.addEventListener('visibilitychange', sync);
    // 마우스 쪽으로 기울기(섬세한 포인터·동작 줄이기 아님)
    let raf = 0, rx = 0, ry = 0;
    const tilt = () => { raf = 0; el.style.setProperty('--rx', `${rx.toFixed(2)}deg`); el.style.setProperty('--ry', `${ry.toFixed(2)}deg`); };
    const move = (e) => { const r = el.getBoundingClientRect(); ry = ((e.clientX - r.left) / r.width - 0.5) * 7; rx = -((e.clientY - r.top) / r.height - 0.5) * 5; if (!raf) raf = requestAnimationFrame(tilt); };
    const leave = () => { rx = 0; ry = 0; if (!raf) raf = requestAnimationFrame(tilt); };
    const fine = isFine() && !isReduced();
    if (fine) { el.addEventListener('pointermove', move); el.addEventListener('pointerleave', leave); }
    return () => {
      removeEventListener('load', go); io?.disconnect(); document.removeEventListener('visibilitychange', sync); cancelAnimationFrame(raf);
      if (fine) { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); }
    };
  }, []);
  const s = SHOWCASES[i];
  const bar = shot(`ph-${s.id}`).bar || '#0b0d14';
  const next = () => setI((k) => (k + 1) % SHOWCASES.length);
  const pick = (k) => { setI(k); setPlay(false); };
  const running = play && all && seen;
  return (
    <div class={`ld-stage${running ? ' is-run' : ''}`} ref={box} style={{ '--c1': s.c1, '--c2': s.c2 }}>
      <div class="ld-glow" aria-hidden="true" />
      <div class="ld-devices" aria-hidden="true">
        <div class="ld-laptop">
          <div class="ld-lid">
            <div class="ld-screen">
              {SHOWCASES.map((x, k) => {
                if (k && !all) return null;
                const big = shot(`pc-${x.id}`), small = shot(`pc-${x.id}-s`);
                return (
                  <picture class={k === i ? 'is-on' : ''} key={x.id}>
                    <source media="(max-width: 759.98px)" srcset={small.src} width={small.w} height={small.h} />
                    <img src={big.src} width={big.w} height={big.h} alt="" decoding="async" fetchpriority={k ? undefined : 'high'} />
                  </picture>
                );
              })}
            </div>
          </div>
          <div class="ld-base" />
        </div>
        <div class={`ld-phone${lightBar(bar) ? ' is-light' : ''}`} style={{ '--bar': bar }}>
          <div class="ld-phone-screen">
            <div class="ld-phone-bar">
              <span>13:50</span>
              <i class="ld-phone-cam" />
              <StatusIcons />
            </div>
            <div class="ld-phone-view">
              {SHOWCASES.map((x, k) => {
                if (k && !all) return null;
                const m = shot(`ph-${x.id}`);
                return <img class={k === i ? 'is-on' : ''} key={x.id} src={m.src} width={m.w} height={m.h} alt="" decoding="async" loading={k ? 'lazy' : undefined} />;
              })}
            </div>
          </div>
        </div>
      </div>
      <div class="ld-stage-foot">
        <div class="ld-picks" role="group" aria-label="사례 선택">
          {SHOWCASES.map((x, k) => (
            <button type="button" class="ld-pick" aria-pressed={k === i ? 'true' : 'false'} onClick={() => pick(k)} key={x.id}>
              <span>{x.short}</span>
              {k === i && <i class="ld-fill" onAnimationEnd={next} aria-hidden="true" />}
            </button>
          ))}
          <button type="button" class="ld-play" aria-pressed={play ? 'true' : 'false'} aria-label="사례 자동 넘기기" onClick={() => setPlay(!play)}>
            <svg viewBox="0 0 16 16" aria-hidden="true">{play ? <path d="M5 3.5v9M11 3.5v9" /> : <path d="M5.5 3.2 12.5 8l-7 4.8z" />}</svg>
          </button>
        </div>
        <p class="ld-cap" aria-live="polite"><b>{s.name}</b><span>AI가 교재 {s.pages}쪽을 읽고 만든 {s.kind} 사이트</span><a href={siteUrl(s.id)} target="_blank" rel="noopener">사이트 열기<span class="ld-sr"> (새 창)</span><span aria-hidden="true"> ↗</span></a></p>
      </div>
    </div>
  );
}
