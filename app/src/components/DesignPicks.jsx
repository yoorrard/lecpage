import { useEffect, useRef, useState } from 'preact/hooks';
import { DesignSheet } from './DesignSheet.jsx';
import { useCart, removeFromCart } from '../lib/design-cart.js';
import './design-picks.css';

// 교재 넣기 화면의 참고 디자인 줄: 고른 완성 견본(p.reference.name) + 참고 디자인에서 담은 디자인(lib/design-cart.js).
// 담은 디자인은 이 연수의 p.reference.picks로 옮겨 둠 → AI에게 주는 글(lib/gen/prompts.js askOf, studio.mjs taskText)이
// 이름·한 줄·핵심 기법만 짧게 넣음. 만들기 시작은 모두 p.reference를 건네므로 따로 손댈 곳이 없음.
const same = (a = [], b = []) => a.length === b.length && a.every((x, i) => x.id === b[i]?.id);

export function DesignPicks({ p, update }) {
  const cart = useCart();
  const ref = p.reference;
  const base = typeof ref === 'string' ? (ref ? { name: ref, mood: ref } : {}) : (ref || {});
  useEffect(() => {
    if (p.demo || same(base.picks, cart)) return;
    const next = { ...base }; delete next.picks;
    if (cart.length) next.picks = cart;
    update({ reference: Object.keys(next).length ? next : '' });
  }, [cart, p.id]);
  const [open, setOpen] = useState(false);
  const btn = useRef(null);
  return (
    <>
      {base.name && <p class="small ref-line">참고 디자인: <b>{base.name}</b> <span class="muted">(이 분위기를 내 교재에 맞게 살려요)</span> <button type="button" class="btn btn-sm btn-quiet" onClick={() => { const { picks } = base; update({ reference: picks?.length ? { picks } : '' }); }}>삭제</button></p>}
      {!p.demo && (
        <div class="picks-line">
          <p class="small picks-head">
            <button type="button" class="btn btn-sm" ref={btn} onClick={() => setOpen(true)} aria-haspopup="dialog">디자인 기법 둘러보기</button>
            <span class="muted">{cart.length ? <><b>담은 디자인 {cart.length}개</b> · AI가 이 연수에 맞게 녹여 써요.</> : '(선택) 마음에 드는 기법을 담아 두면 AI가 참고해요.'}</span>
          </p>
          {cart.length > 0 && (
            <ul class="picks" aria-label="담은 디자인">
              {cart.map((x) => <li title={x.desc}>{x.ko}<button type="button" onClick={() => removeFromCart(x.id)} aria-label={`${x.ko} 삭제`}>✕</button></li>)}
            </ul>
          )}
        </div>
      )}
      {open && <DesignSheet onClose={() => { setOpen(false); btn.current?.focus(); }} />}
    </>
  );
}
