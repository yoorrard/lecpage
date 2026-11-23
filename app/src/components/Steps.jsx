import { useEffect, useRef } from 'preact/hooks';

/**
 * 한 번에 한 단계만 펼쳐 보이는 순서(올릴 곳 연결·참여 기능 연결에 씀).
 * 지난 단계는 ✓, 다음 단계는 제목만. 제목을 누르면 그 단계로 가요.
 * steps: [{ t: '짧은 제목', body: 내용, next?: false(다음 버튼 숨김) | '버튼 글' }]
 */
export function Steps({ steps, at, onAt, label }) {
  // 다음 단계로 넘어가면 그 단계가 화면 밖이어도 보이게(새 창에서 돌아와 누를 곳을 찾지 않게). 처음 그릴 때는 그대로
  const box = useRef(null); const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const b = box.current?.querySelector('.walk-b'); if (!b) return;
    const r = b.getBoundingClientRect(); if (r.top < 0 || r.bottom > innerHeight) b.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    // 누른 버튼·링크가 접힌 단계와 함께 사라져 초점을 잃었으면 새 단계의 제목으로(키보드·화면 읽기 프로그램이 이어서 읽게)
    const a = document.activeElement;
    if (!a || a === document.body || !a.isConnected) box.current?.querySelector('li.on > .walk-h')?.focus({ preventScroll: true });
  }, [at]);
  return (
    <ol class="walk" role="list" aria-label={label} ref={box}>
      {steps.map((s, i) => {
        const on = i === at;
        return (
          <li class={on ? 'on' : i < at ? 'done' : ''} key={i}>
            <button type="button" class="walk-h" aria-expanded={String(on)} onClick={() => onAt(i)}>
              <span class="walk-n" aria-hidden="true">{i < at ? '✓' : i + 1}</span><span>{s.t}</span>
            </button>
            {on && <div class="walk-b">{s.body}
              {s.next !== false && i < steps.length - 1 && <div><button type="button" class="btn btn-sm" onClick={() => onAt(i + 1)}>{s.next || '다음'}</button></div>}
            </div>}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * 어디를 누르는지 보여 주는 작은 그림: 그 사이트 화면의 칸과 버튼 모양만 흉내 낸 것(글은 화면에 나오는 영문 그대로).
 * rows: [[칸 이름, 넣을 값]], btn: 마지막에 누를 버튼, pre: 그 전에 차례로 누를 버튼(하나 또는 여럿)
 */
export function ClickShot({ rows = [], btn, pre }) {
  return (
    <div class="clk" aria-hidden="true">
      {[].concat(pre || []).map((x) => <span class="clk-btn pre" key={x}>{x}</span>)}
      {rows.map(([k, v]) => <span class="clk-row" key={k}><span class="clk-k">{k}</span><span class="clk-v">{v}</span></span>)}
      <span class="clk-btn">{btn}
        <svg class="clk-cur" viewBox="0 0 24 24" width="20" height="20"><path d="M6 3l13 8.2-5.6 1.5L11 18.5z" fill="currentColor" stroke="var(--paper)" stroke-width="1.6" stroke-linejoin="round" /></svg>
      </span>
    </div>
  );
}
