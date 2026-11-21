import { useRef } from 'preact/hooks';
import { useInView, useProgress } from './motion.js';

// copy-ok: 운영자가 정한 카피(글자 그대로 씀). 해요체 예외
export const ASK = '누구나 만들 수 있지만, 잘 만들어 나누려면 노하우가 필요합니다';
// copy-ok: 운영자가 정한 카피(글자 그대로 씀). 해요체 예외
export const SAVE = '바쁜 강사님의 시간과 토큰을 아껴드립니다';

// 디자인 라이브러리의 결 16가지(skills/lecpage/references/design-library.md 1절 표 그대로)
const LOOKS = ['편집·잡지', '스위스 격자', '리소그래프·인쇄', '손그림 공책', '설계도·기술 도면', '데이터 시각화', '포스터·글자', '콜라주·스크랩북',
  '레트로 아케이드·픽셀', '네온·유리(밤)', '따뜻한 미니멀', '공문·기관', '칠판·교실', '자연·계절', '어두운 키노트', '지도·답사'];
// 강의 엔진이 사이트에 끼우는 것(engine/src/kit)과 함께 만드는 화면
const MODS = [['넘', '교재 넘기기'], ['출', '출석'], ['질', '질문'], ['투', '투표'], ['퀴', '퀴즈'], ['보', '나눔 보드'],
  ['실', '실습 단계'], ['복', '프롬프트 복사'], ['자', '자료실'], ['만', '만족도 조사'], ['발', '발표 화면'], ['강', '강사 화면']];

/** 낱말마다 span(띄어쓰기는 글 노드로 남겨 글자 그대로). 스크롤로 읽히는 만큼 진해져요(--p × 낱말 수 > 순번) */
function Words({ text }) {
  const w = text.split(' ');
  return w.map((x, i) => <>{i ? ' ' : ''}<span class="ld-w" style={{ '--i': i }}>{x}</span></>);
}

/**
 * 노하우: 운영자 문장 → lecpage가 AI에게 함께 건네는 세 가지(요청 설계 · 디자인 라이브러리 · 강의 엔진) → 시간과 토큰.
 * 크기가 다른 세 칸(요청서 · 흐르는 결 이름 · 원소표처럼 놓인 강의 기능). 동작 줄이기면 다 켜진 글과 멈춘 줄.
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
            <div class="ld-marq" aria-hidden="true">
              {[LOOKS.slice(0, 8), LOOKS.slice(8)].map((row, r) => <div class={`ld-marq-row${r ? ' is-rev' : ''}`}><span>{row.map((x) => <i>{x}</i>)}</span><span>{row.map((x) => <i>{x}</i>)}</span></div>)}
            </div>
            <p class="ld-sr">결 16가지: {LOOKS.join(', ')}</p>
          </article>
          <article class="ld-k ld-k-engine">
            <h3><span aria-hidden="true">03</span>강의 엔진</h3>
            <p>강의에 쓰는 기능을 사이트에 끼우고, 발표 화면·강사 화면·QR 안내문도 만들어요.</p>
            <ul class="ld-mods">{MODS.map(([k, t], i) => <li style={{ '--i': i }}><b aria-hidden="true">{k}</b>{t}</li>)}</ul>
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
