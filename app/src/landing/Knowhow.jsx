import { useEffect, useRef, useState } from 'preact/hooks';
import { isReduced, useInView, useProgress } from './motion.js';
import { shot } from './showcases.js';
import { Ic } from './icons.jsx';

// copy-ok: 운영자가 정한 카피(글자 그대로 씀). 해요체 예외
export const ASK = '누구나 만들 수 있지만, 잘 만들어 나누려면 노하우가 필요합니다';
// copy-ok: 운영자가 정한 카피(글자 그대로 씀). 해요체 예외
export const SAVE = '바쁜 강사님의 시간과 토큰을 아껴드립니다';

// 디자인 라이브러리의 결 16가지(skills/lecpage/references/design-library.md 1절 '결' 목록 그대로)
const LOOKS = ['편집·잡지', '스위스 격자', '포스터·움직이는 글자', '리소그래프', '셰이더 빛·유체', '네온·유리', '3D 공간', '생성 예술',
  '손그림 공책', '설계도', '데이터 시각화', '콜라주', '픽셀 아케이드', '칠판', '지도·답사', '따뜻한 미니멀'];
// 강의 엔진이 사이트에 끼우는 것(engine/src/kit)과 함께 만드는 화면. 아이콘은 icons.jsx
const MODS = [['deck', '교재 넘기기'], ['check', '출석'], ['chat', '질문'], ['bars', '투표'], ['quiz', '퀴즈'], ['board', '나눔 보드'],
  ['steps', '실습 단계'], ['copy', '프롬프트 복사'], ['folder', '자료실'], ['heart', '만족도 조사'], ['monitor', '발표 화면'], ['console', '강사 화면']];
// 미리보기 칸의 예시(대표 사례 '질문이 먼저, AI는 그다음'의 교재 쪽·투표 그대로, 질문 글과 수는 보여 주기용 예시)
const DECK = [1, 3, 5]; // 넘겨 보일 교재 쪽(showcases.js SLIDES 안의 쪽)
const POLL = [['거의 안 써요', 18], ['가끔, 자료 만들 때', 43], ['매주 한두 번', 25], ['거의 매일', 14]];
const ASKS = [['AI가 만든 루브릭, 그대로 써도 되나요?', 12], ['실습 2 프롬프트는 어디서 복사해요?', 7]];

/** 낱말마다 span(띄어쓰기는 글 노드로 남겨 글자 그대로). 스크롤로 읽히는 만큼 진해져요(--p × 낱말 수 > 순번) */
function Words({ text }) {
  const w = text.split(' ');
  return w.map((x, i) => <>{i ? ' ' : ''}<span class="ld-w" style={{ '--i': i }}>{x}</span></>);
}

/**
 * 강의 엔진 미리보기(꾸밈, aria-hidden): 실제 사이트에 들어가는 기능 넷을 작게 — 교재 넘기기 · 투표 · 질문 · 출석.
 * 화면에 들어오면 막대·고리·수가 한 번 차오르고(is-in), 보이는 동안만 교재 쪽이 3초마다 넘어가요. 동작 줄이기면 끝 모습으로 멈춤.
 */
function EngineDemo() {
  const box = useRef();
  const [k, setK] = useState(0);
  const [on, setOn] = useState(false);
  useInView(box, { onChange: setOn });
  useEffect(() => {
    if (!on || isReduced()) return undefined;
    const t = setInterval(() => { if (!document.hidden) setK((x) => (x + 1) % DECK.length); }, 3000);
    return () => clearInterval(t);
  }, [on]);
  const pg = DECK[k];
  return (
    <div class="ld-eng" ref={box} aria-hidden="true">
      <div class="ld-eng-col">
        <div class="ld-ui ld-ui-deck">
          <p class="ld-ui-h"><Ic n="deck" />교재 넘기기<span class="ld-ui-live">강사 따라</span></p>
          <div class="ld-ui-slides">{DECK.map((n, j) => { const s = shot(`slide-${n}`); return <img class={j === k ? 'is-on' : ''} src={s.src} width={s.w} height={s.h} alt="" loading="lazy" decoding="async" key={n} />; })}</div>
          <p class="ld-ui-pg"><i style={{ '--v': pg / 17 }} /><b>{pg}</b> / 17</p>
        </div>
        <div class="ld-ui ld-ui-ask">
          <p class="ld-ui-h"><Ic n="chat" />질문</p>
          <ul>{ASKS.map(([t, v], j) => <li><span>{t}</span><em class={j ? '' : 'is-up'}><Ic n="up" /><b class="ld-cnt" style={{ '--from': j ? v : v - 1, '--to': v }} /></em></li>)}</ul>
        </div>
      </div>
      <div class="ld-eng-col">
        <div class="ld-ui ld-ui-poll">
          <p class="ld-ui-h"><Ic n="bars" />투표<span>31명 참여</span></p>
          <b class="ld-ui-q">요즘 수업 준비에 AI를 얼마나 쓰나요?</b>
          <ul>{POLL.map(([t, v], j) => <li class={j === 1 ? 'is-me' : ''} style={{ '--v': v, '--j': j }}><span>{t}</span><em>{v}%</em></li>)}</ul>
        </div>
        <div class="ld-ui ld-ui-att">
          <p class="ld-ui-h"><Ic n="check" />출석</p>
          <div class="ld-att">
            <svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" /><circle class="ld-att-ring" cx="22" cy="22" r="19" pathLength="1" /></svg>
            <p><b class="ld-cnt" style={{ '--to': 27 }} /><small>/ 30명</small></p>
          </div>
          <p class="ld-ui-ok"><Ic n="check" />출석했어요 · 13:58</p>
        </div>
      </div>
    </div>
  );
}

/**
 * 노하우: 운영자 문장 → lecpage가 AI에게 함께 건네는 세 가지(요청 설계 · 디자인 라이브러리 · 강의 엔진) → 시간과 토큰.
 * 크기가 다른 세 칸(요청서 · 흐르는 결 이름 · 넓은 강의 엔진: 기능 목록 + 실제 기능 미리보기). 동작 줄이기면 다 켜진 글과 멈춘 줄.
 */
export function Knowhow() {
  const say = useRef(); const grid = useRef(); const save = useRef();
  useProgress(say, '--p', { mode: 'read' });
  useInView(grid); useInView(save);
  const n = ASK.split(' ').length;
  return (
    <>
      <section class="ld-know" aria-labelledby="ld-know-h">
        <h2 id="ld-know-h" class="ld-say" ref={say} style={{ '--n': n }}><Words text={ASK} /></h2>
        <p class="ld-know-lead">lecpage는 그 노하우를 세 가지로 담아 AI에게 함께 건네요. 같은 AI라도 결과가 달라지는 이유예요.</p>
        <div class="ld-know-grid" ref={grid}>
          <article class="ld-k ld-k-brief">
            <h3><span aria-hidden="true">01</span>요청 설계</h3>
            <p>목적은 ‘강의를 운영하는 사이트’예요. 당일 할 일과 디자인 기준을 담아 교재 원본과 한 번에 건네요.</p>
            <dl class="ld-brief" aria-label="요청 설계에 담기는 것">
              <div><dt>목적</dt><dd>참가자가 강의 당일 휴대폰에 열어 두는 사이트</dd></div>
              <div><dt>할 일</dt><dd>지금 순서 · 출석 · 교재 보기 · 실습 원문 · 질문과 투표</dd></div>
              <div><dt>교재</dt><dd>원본 파일 그대로, 사실은 원문 그대로</dd></div>
              <div><dt>디자인</dt><dd>주제를 상징하는 직접 그린 그래픽과 절제된 움직임</dd></div>
            </dl>
          </article>
          <article class="ld-k ld-k-lib">
            <h3><span aria-hidden="true">02</span>디자인 라이브러리</h3>
            <p>결 16가지와 한글 글꼴 짝, 움직임 기법, 강의 사이트 구성법, ‘AI 티’ 점검표로 템플릿 같지 않은 디자인을 끌어내요.</p>
            {/* 넓은 칸은 두 줄(줄마다 8개), 좁은 칸(넓은 화면의 오른쪽 칸)은 세 줄: 한 줄 안에서 같은 이름이 한꺼번에 보이지 않게 */}
            {[[LOOKS.slice(0, 8), LOOKS.slice(8)], [LOOKS.slice(0, 6), LOOKS.slice(6, 11), LOOKS.slice(11)]].map((rows) => (
              <div class={`ld-marq ld-marq-${rows.length}`} aria-hidden="true">
                {rows.map((row, r) => <div class={`ld-marq-row${r % 2 ? ' is-rev' : ''}`}><span>{row.map((x) => <i>{x}</i>)}</span><span>{row.map((x) => <i>{x}</i>)}</span></div>)}
              </div>
            ))}
            <p class="ld-sr">결 16가지: {LOOKS.join(', ')}</p>
          </article>
          <article class="ld-k ld-k-engine">
            <div class="ld-eng-t">
              <h3><span aria-hidden="true">03</span>강의 엔진</h3>
              <p>강의에 쓰는 기능을 사이트에 끼우고, 발표 화면·강사 화면·QR 안내문도 만들어요.</p>
              <ul class="ld-mods">{MODS.map(([k, t], i) => <li class={i > 9 ? 'is-screen' : ''} style={{ '--i': i }}><Ic n={k} />{t}</li>)}</ul>
            </div>
            <EngineDemo />
          </article>
        </div>
        <p class="ld-know-end">요청 설계와 디자인 라이브러리, 강의 엔진이 함께 가서 <b>최신 AI의 디자인 실력을 끝까지 끌어내요.</b></p>
      </section>

      <section class="ld-save" ref={save} aria-labelledby="ld-save-h">
        <h2 id="ld-save-h">{SAVE}</h2>
        <ul class="ld-save-list">
          <li><b>한 번의 요청</b><span>교재 원본과 요청을 한 번에 보내면 AI가 사이트 전체를 만들어요. 수정을 요청하면 바뀐 파일만 받아요.</span></li>
          <li><b>준비는 lecpage가</b><span>쪽 그림과 참여 기능, 배포, QR 안내문은 lecpage가 만들어요. 강사는 내용만 확인해요.</span></li>
        </ul>
      </section>
    </>
  );
}
