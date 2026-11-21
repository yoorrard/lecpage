import { useEffect, useRef, useState } from 'preact/hooks';
import { useCart, removeFromCart, CART_MAX } from '../lib/design-cart.js';
import './design-picks.css';

// 교재 넣기 화면에서 여는 디자인 기법 시트(데스크톱은 오른쪽 서랍, 폰은 아래에서 올라오는 전체 높이 시트).
// 안은 참고 디자인 화면의 디자인 사전(pages/GalleryDict.jsx)을 그대로 쓰고, 열 때만 받음(미리보기 묶음이 커서).
// 대화상자는 <dialog>.showModal(): 포커스 가둠·Esc 닫기·닫으면 누른 버튼으로 돌아가기를 브라우저가 해 줌.
export function DesignSheet({ onClose }) {
  const ref = useRef(null);
  const body = useRef(null);
  const [C, setC] = useState(null);
  const [err, setErr] = useState(false);
  const [note, setNote] = useState('');
  const cart = useCart();
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal?.(); }, []);
  useEffect(() => { let on = true; import('../pages/GalleryDict.jsx').then((m) => on && setC(() => m.GalleryDict), () => on && setErr(true)); return () => { on = false; }; }, []);
  useEffect(() => { if (!note) return undefined; const t = setTimeout(() => setNote(''), 4000); return () => clearTimeout(t); }, [note]);
  const close = () => ref.current?.close();
  const full = cart.length >= CART_MAX;
  return (
    <dialog ref={ref} class="dlg dd-sheet" aria-labelledby="dd-sheet-h" onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) close(); }}>
      <header class="dd-sheet-head">
        <div><h2 id="dd-sheet-h">디자인 기법 둘러보기</h2><p class="small muted">마음에 드는 기법을 담아 두면 AI가 내 교재에 맞게 녹여 써요.</p></div>
        <button type="button" class="icon-btn" onClick={close} aria-label="닫기">✕</button>
      </header>
      <div class="dd-sheet-body" ref={body}>
        {err ? <p class="muted">디자인 사전을 불러오지 못했어요. 닫았다가 다시 열어 주세요.</p>
          : C ? <C compact root={() => body.current} notify={setNote} /> : <p class="muted" aria-live="polite">디자인 사전을 불러오는 중…</p>}
      </div>
      <footer class="dd-sheet-foot">
        <div class="dd-sheet-sel">
          <p class="small"><b>담은 디자인 <span class="dd-count">{cart.length}/{CART_MAX}</span></b>{' '}
            <span class="muted" role="status">{note || (full ? `${CART_MAX}개까지 담을 수 있어요.` : cart.length ? '' : '아직 없어요. 담지 않아도 만들 수 있어요.')}</span></p>
          {cart.length > 0 && (
            <ul class="sheet-picks" aria-label="담은 디자인">
              {cart.map((x) => <li title={x.desc}>{x.ko}<button type="button" onClick={() => removeFromCart(x.id)} aria-label={`${x.ko} 삭제`}>✕</button></li>)}
            </ul>
          )}
        </div>
        <button type="button" class="btn btn-primary" onClick={close}>다 골랐어요</button>
      </footer>
    </dialog>
  );
}
