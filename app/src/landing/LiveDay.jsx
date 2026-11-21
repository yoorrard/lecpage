import { useEffect, useRef, useState } from 'preact/hooks';
import { isReduced } from './motion.js';
import { SLIDES, shot } from './showcases.js';
import { QR, qrPath } from './qr.js';

// 강의 당일 장면(대표 사례 '질문이 먼저, AI는 그다음'의 교재 쪽·투표·확인 문제·일정 그대로). pg: SLIDES 순번, ov: 발표 화면에 겹칠 것
const SCENES = [{ pg: 0, ov: 'qr', att: 6 }, { pg: 1, ov: '', att: 21 }, { pg: 2, ov: 'poll', att: 27 }, { pg: 3, ov: 'timer', att: 28 }, { pg: 5, ov: 'quiz', att: 28 }, { pg: 6, ov: 'notice', att: 28 }];
const OVS = [['qr', '출석 QR'], ['poll', '투표 결과'], ['timer', '타이머'], ['quiz', '퀴즈 정답'], ['notice', '공지']];
const POLL = [['거의 안 써요', 18], ['가끔, 자료 만들 때', 43], ['매주 한두 번', 25], ['거의 매일', 14]];
const ROSTER = [['김○린', '13:52'], ['박○우', '13:55'], ['이○서', '13:58'], ['정○호', '14:01']];
const TOTAL = 17;

/** 출석 QR(lecpage.com, qr.js에 미리 계산한 칸) */
export function Qr({ cls = 'ld-qr' }) {
  const n = QR.length;
  return <svg class={cls} viewBox={`-2 -2 ${n + 4} ${n + 4}`} aria-hidden="true"><rect x="-2" y="-2" width={n + 4} height={n + 4} fill="#fff" /><path d={qrPath()} fill="#111" /></svg>;
}

/**
 * 강의 당일: 발표 화면 · 강사 화면 · 참가자 휴대폰이 같은 쪽을 함께 넘기는 장면. 화면에 보이면 장면이 저절로 넘어가고(3.6초),
 * 강사 화면의 [이전]·[다음]이나 겹치기 버튼을 누르면 그때부터는 누른 대로만 움직여요. 동작 줄이기면 저절로 넘기지 않아요.
 * 화면 속 이름·수는 보여 주기용 예시예요(이름은 가림).
 */
export function LiveDay() {
  const box = useRef();
  const [i, setI] = useState(0);
  const [ov, setOv] = useState(SCENES[0].ov);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    const el = box.current; if (!el || isReduced()) return undefined;
    let t = 0, on = false;
    const tick = () => { clearTimeout(t); if (on && !document.hidden) t = setTimeout(() => { setI((k) => { const n = (k + 1) % SCENES.length; setOv(SCENES[n].ov); return n; }); tick(); }, 3600); };
    const io = new IntersectionObserver(([e]) => { on = e.isIntersecting; if (on) tick(); else clearTimeout(t); }, { threshold: 0.35 });
    if (auto) { io.observe(el); document.addEventListener('visibilitychange', tick); }
    return () => { clearTimeout(t); io.disconnect(); document.removeEventListener('visibilitychange', tick); };
  }, [auto]);
  const s = SCENES[i];
  const n = SLIDES[s.pg];
  const slide = shot(`slide-${n}`);
  const go = (d) => { setAuto(false); const k = (i + d + SCENES.length) % SCENES.length; setI(k); setOv(SCENES[k].ov); };
  const toggle = (x) => { setAuto(false); setOv(ov === x ? '' : x); };
  const img = (cls) => <img class={cls} key={n} src={slide.src} width={slide.w} height={slide.h} alt="" loading="lazy" decoding="async" />;
  return (
    <section class="ld-day" aria-labelledby="ld-day-h">
      <div class="ld-day-in">
        <header class="ld-day-head">
          <p class="ld-kicker">강의 당일</p>
          <h2 id="ld-day-h">세 화면이 한 쪽씩 함께 넘어가요</h2>
          <p>강사가 강사 화면에서 쪽을 넘기면 발표 화면과 참가자 휴대폰이 함께 넘어가요. 출석 QR·투표 결과·타이머·공지는 발표 화면 위에 바로 띄워요.</p>
        </header>
        <div class="ld-day-stage" ref={box} role="group" aria-label="강의 당일 화면 예시">
          <figure class="ld-proj">
            <figcaption>발표 화면</figcaption>
            <div class="ld-proj-scr">
              {img('ld-slide')}
              <div class={`ld-ov ld-ov-qr${ov === 'qr' ? ' is-on' : ''}`}><Qr /><b>출석은 여기로</b><small>휴대폰 카메라로 찍어요</small></div>
              <div class={`ld-ov ld-ov-poll${ov === 'poll' ? ' is-on' : ''}`}><b>요즘 수업 준비에 AI를 얼마나 쓰나요?</b>{POLL.map(([t, v]) => <p style={{ '--v': v }}><span>{t}</span><i /><em>{v}%</em></p>)}</div>
              <div class={`ld-ov ld-ov-timer${ov === 'timer' ? ' is-on' : ''}`}><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" /><circle class="ld-ring" cx="20" cy="20" r="17" pathLength="1" /></svg><b>10:00</b><small>실습 1 · 핵심 질문 만들기</small></div>
              <div class={`ld-ov ld-ov-quiz${ov === 'quiz' ? ' is-on' : ''}`}><small>확인 문제 1 정답</small><b>② 질문</b></div>
              <div class={`ld-ov ld-ov-notice${ov === 'notice' ? ' is-on' : ''}`}><b>쉬는 시간 10분</b><span>15:35에 실습 2를 시작해요</span></div>
            </div>
          </figure>
          <figure class="ld-cons">
            <figcaption>강사 화면</figcaption>
            <div class="ld-cons-scr">
              <div class="ld-cons-top"><b>질문이 먼저, AI는 그다음</b><span class="ld-live">연결됨</span></div>
              <div class="ld-cons-deck">
                {img('ld-thumb')}
                <div class="ld-cons-ctl">
                  <span class="ld-pgno"><b>{n}</b> / {TOTAL}</span>
                  <div><button type="button" onClick={() => go(-1)}>이전</button><button type="button" class="is-main" onClick={() => go(1)}>다음</button></div>
                </div>
              </div>
              <div class="ld-cons-ovs" role="group" aria-label="발표 화면에 띄우기">{OVS.map(([k, t]) => <button type="button" aria-pressed={ov === k ? 'true' : 'false'} onClick={() => toggle(k)}>{t}</button>)}</div>
              <div class="ld-roster"><p><b>출석 {s.att}명</b><span>명단은 CSV로 받아요</span></p><ul>{ROSTER.slice(0, Math.min(4, 1 + Math.floor(s.att / 7))).map(([nm, at]) => <li><span>{nm}</span><time>{at}</time></li>)}</ul></div>
            </div>
          </figure>
          <figure class="ld-part">
            <figcaption>참가자 휴대폰</figcaption>
            <div class="ld-part-scr">
              <p class="ld-part-top">질문이 먼저</p>
              <div class="ld-part-deck">{img('ld-mini')}<p><span>강사 따라 넘기기</span><b>{n} / {TOTAL}</b></p></div>
              <div class="ld-part-act">
                {ov === 'poll' ? <div class="ld-vote">{POLL.map(([t], k) => <span class={k === 1 ? 'is-me' : ''}>{t}</span>)}</div>
                  : ov === 'quiz' ? <p class="ld-part-ok">정답이에요 · ② 질문</p>
                    : ov === 'timer' ? <p class="ld-part-t">실습 1 · 10:00</p>
                      : ov === 'notice' ? <p class="ld-part-t">쉬는 시간 10분</p>
                        : <p class="ld-part-ok">출석했어요 · 13:58</p>}
                <p class="ld-ask">강사에게 질문하기…</p>
              </div>
            </div>
          </figure>
        </div>
        <ul class="ld-day-list">
          <li><h3>발표 화면</h3><p>교재 쪽을 크게 띄우고 강사 화면과 함께 넘겨요. 출석 QR·투표 결과·타이머·공지를 그 위에 띄워요.</p></li>
          <li><h3>강사 화면</h3><p>출석 명단을 실시간으로 보고, 퀴즈 정답을 띄우고, 실습 타이머를 돌려요.</p></li>
          <li><h3>참가자 휴대폰</h3><p>교재를 따라 넘기며 출석·질문·투표·퀴즈·나눔 보드에 바로 참여해요.</p></li>
          <li><h3>노트북 한 대로도</h3><p>노트북 한 대로 교실 Wi-Fi에서 질문·투표·출석을 받을 수 있어요.</p></li>
        </ul>
      </div>
    </section>
  );
}
