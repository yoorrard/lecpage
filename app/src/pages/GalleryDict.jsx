import { createContext } from 'preact';
import { useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { CATEGORIES, ITEMS, catOf, searchItems, srcdocOf } from '../data/design-dict/index.js';
import { useCart, toggleCart, removeFromCart, clearCart, inCart, CART_MAX } from '../lib/design-cart.js';
import { newProject } from '../lib/project.js';
import { toast } from '../lib/util.js';
import '../styles/gallery.css'; // 교재 넣기 화면의 시트에서도 쓰므로 여기서도 불러와요

// 디자인 사전(참고 디자인 화면 아래): 실제로 돌아가는 미리보기 + 검색·분류 + 크게 보기 + 담기(lib/design-cart.js).
// 미리보기는 화면에 들어올 때만 iframe을 만들고(나가면 없앰), 카드에서는 누를 수 없게(손가락 스크롤을 막지 않게) 해 두고 크게 보기에서 직접 만져 봐요.
// 400×300보다 좁은 칸은 400×300으로 그린 뒤 줄여 보여 줌(작은 글자가 브라우저 최소 크기에 걸려 깨지지 않게).

const BASE_W = 400;
const docs = new Map();
const docOf = (it) => { if (!docs.has(it.id)) docs.set(it.id, srcdocOf(it)); return docs.get(it.id); };

// 화면에 들어온 카드만 미리보기를 만듦(하나의 IntersectionObserver). 빨리 훑고 지나가는 카드는 만들지 않게 잠깐 기다림
// 시트(components/DesignSheet.jsx)처럼 따로 스크롤하는 칸 안에서는 그 칸을 root로 삼음(root마다 하나)
const subs = new Map();
const ios = new Map();
function watch(el, cb, root = null) {
  if (!('IntersectionObserver' in window)) { cb(true); return () => {}; }
  let io = ios.get(root);
  if (!io) { io = new IntersectionObserver((es) => es.forEach((e) => subs.get(e.target)?.(e.isIntersecting)), { root, rootMargin: '240px 0px' }); ios.set(root, io); }
  subs.set(el, cb); io.observe(el);
  return () => { io.unobserve(el); subs.delete(el); };
}
/** 쓰는 곳이 알려 주는 것: root(스크롤 칸을 돌려주는 함수), notify(꽉 찼을 때 안내를 어디에 띄울지) */
const Ctx = createContext({ root: null, notify: (m) => toast(m) });

/** 미리보기 틀: 칸 크기를 재서 400보다 좁으면 줄여 그림 */
function Frame({ it, live = false, title }) {
  const box = useRef(null);
  const [sz, setSz] = useState(null);
  useEffect(() => {
    const el = box.current; if (!el) return undefined;
    const set = () => { const r = el.getBoundingClientRect(); if (r.width > 0) setSz({ w: r.width, h: r.height }); };
    set();
    if (!('ResizeObserver' in window)) return undefined;
    const ro = new ResizeObserver(set); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const s = sz ? Math.min(1, sz.w / BASE_W) : 1;
  return (
    <div class="dd-box" ref={box}>
      {sz && <iframe class="dd-if" srcDoc={docOf(it)} sandbox="allow-scripts" allow="clipboard-write" title={title || `${it.ko} 미리보기`}
        tabIndex={live ? 0 : -1} aria-hidden={live ? undefined : 'true'}
        style={{ width: `${sz.w / s}px`, height: `${sz.h / s}px`, transform: s < 1 ? `scale(${s})` : undefined }} />}
    </div>
  );
}

/** 카드의 미리보기: 화면 근처에 오면 만들고, 멀어지면 없앰 */
function LazyFrame({ it }) {
  const ref = useRef(null);
  const [on, setOn] = useState(false);
  const { root } = useContext(Ctx);
  useEffect(() => {
    let t = 0;
    const off = watch(ref.current, (vis) => { clearTimeout(t); if (vis) t = setTimeout(() => setOn(true), 90); else setOn(false); }, root ? root() : null);
    return () => { clearTimeout(t); off(); };
  }, []);
  return <div class="dd-lazy" ref={ref}>{on ? <Frame it={it} /> : <span class="dd-ph" aria-hidden="true">{it.en}</span>}</div>;
}

function AddBtn({ it, cart, big = false }) {
  const { notify } = useContext(Ctx);
  const on = inCart(it.id, cart);
  return (
    <button type="button" class={`btn ${big ? '' : 'btn-sm '}dd-add${on ? ' is-on' : ''}${big && !on ? ' btn-primary' : ''}`} aria-pressed={String(on)}
      aria-label={`${it.ko} 담기`}
      onClick={() => { if (!toggleCart(it)) notify(`${CART_MAX}개까지 담을 수 있어요. 담은 디자인에서 하나를 삭제해 주세요.`); }}>
      {on ? '✓ 담음' : '＋ 담기'}
    </button>
  );
}

function Card({ it, cart, onOpen }) {
  return (
    <article class="dd-card">
      <div class="dd-pv"><LazyFrame it={it} /><button type="button" class="dd-hit" onClick={() => onOpen(it.id)} aria-label={`${it.ko} 크게 보기`} /></div>
      <div class="dd-meta">
        <h3>{it.ko}</h3>
        <p class="dd-en">{it.en}</p>
        <p class="dd-desc">{it.desc}</p>
        <AddBtn it={it} cart={cart} />
      </div>
    </article>
  );
}

/** 크게 보기: 직접 만져 보는 미리보기 + 설명 + 코드 */
function Detail({ id, list, cart, onClose, onMove }) {
  const ref = useRef(null);
  const it = ITEMS.find((x) => x.id === id);
  const i = list.findIndex((x) => x.id === id);
  useEffect(() => { const d = ref.current; if (d && !d.open) { d.showModal?.(); d.querySelector('[data-autofocus]')?.focus(); } }, []);
  useEffect(() => {
    const k = (e) => {
      if (e.target.closest?.('input,textarea,summary,pre')) return;
      if (e.key === 'ArrowRight' && i < list.length - 1) { e.preventDefault(); onMove(list[i + 1].id); }
      if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); onMove(list[i - 1].id); }
    };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, [i, list]);
  if (!it) return null;
  const c = catOf(it.cat);
  let still = false; try { still = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* 옛 브라우저 */ }
  const code = [it.html && ['HTML', it.html], it.css && ['CSS', it.css], it.js && ['JS', it.js]].filter(Boolean);
  return (
    <dialog ref={ref} class="dlg dd-dlg" aria-label={`${it.ko} 크게 보기`} onClose={onClose} onCancel={onClose}>
      <div class="dd-dlg-in">
        <div class="dd-stage"><Frame key={it.id} it={it} live title={`${it.ko} 미리보기(직접 눌러 보거나 움직여 볼 수 있어요)`} /></div>
        <div class="dd-info">
          <p class="dd-cat">{c.ko} · {i + 1}/{list.length}</p>
          <h2>{it.ko}</h2>
          <p class="dd-en">{it.en}</p>
          <p>{it.desc}</p>
          <dl class="dd-dl">
            <dt>강의 사이트에 어울릴 때</dt><dd>{it.fit}</dd>
            <dt>핵심 기법</dt><dd class="dd-tech">{it.tech}</dd>
          </dl>
          {it.tags?.length > 0 && <p class="dd-tags">{it.tags.map((t) => <span>#{t}</span>)}</p>}
          {still && <p class="small muted">기기에서 움직임 줄이기를 켜 두어 멈춘 모습으로 보여요.</p>}
          <div class="btn-row dd-acts">
            <AddBtn it={it} cart={cart} big />
            <span class="dd-nav">
              <button type="button" class="btn btn-sm btn-quiet" disabled={i <= 0} onClick={() => onMove(list[i - 1].id)}>← 이전</button>
              <button type="button" class="btn btn-sm btn-quiet" disabled={i >= list.length - 1} onClick={() => onMove(list[i + 1].id)}>다음 →</button>
            </span>
          </div>
          {code.length > 0 && <details class="dd-code"><summary>코드 보기</summary>{code.map(([k, v]) => <><b>{k}</b><pre><code>{v.trim()}</code></pre></>)}</details>}
        </div>
        <button type="button" class="icon-btn dlg-x" onClick={() => ref.current?.close()} aria-label="닫기" data-autofocus>✕</button>
      </div>
    </dialog>
  );
}

/** 담은 디자인(목록·삭제·모두 삭제 → 만들기) */
function CartPanel({ cart, onClose, onOpen }) {
  const ref = useRef(null);
  useEffect(() => { const d = ref.current; if (d && !d.open) { d.showModal?.(); d.querySelector('[data-autofocus]')?.focus(); } }, []);
  async function make() {
    const p = await newProject({});
    toast('담은 디자인을 참고해 만들어요. 교재를 넣고 AI를 선택해 주세요.');
    ref.current?.close(); location.hash = `#/p/${p.id}/1`;
  }
  return (
    <dialog ref={ref} class="dlg dd-cart" aria-labelledby="dd-cart-h" onClose={onClose} onCancel={onClose}>
      <div class="dlg-in">
        <h2 id="dd-cart-h">담은 디자인 <span class="muted">{cart.length}/{CART_MAX}</span></h2>
        <p class="small muted">강의 사이트를 만들 때 AI에게 이름·한 줄 설명·핵심 기법을 함께 건네요. AI가 교재에 맞게 녹여 써요. 이 브라우저에만 저장돼요.</p>
        {cart.length ? (
          <ul class="dd-cart-list">
            {cart.map((x) => (
              <li>
                <button type="button" class="dd-cart-name" onClick={() => { ref.current?.close(); onOpen(x.id); }}><b>{x.ko}</b> <span class="muted">{x.en}</span><span class="small muted">{x.desc}</span></button>
                <button type="button" class="btn btn-sm btn-quiet" onClick={() => removeFromCart(x.id)} aria-label={`${x.ko} 삭제`}>삭제</button>
              </li>
            ))}
          </ul>
        ) : <p class="dd-empty">아직 담은 디자인이 없어요. 마음에 드는 디자인에서 [＋ 담기]를 눌러요.</p>}
        <div class="btn-row dd-cart-acts">
          {cart.length > 0 && <button type="button" class="btn btn-sm btn-quiet" onClick={clearCart}>모두 삭제</button>}
          <button type="button" class="btn btn-primary" disabled={!cart.length} onClick={make}>담은 디자인으로 만들기</button>
        </div>
        <button type="button" class="icon-btn dlg-x" onClick={() => ref.current?.close()} aria-label="닫기" data-autofocus>✕</button>
      </div>
    </dialog>
  );
}

/** compact: 시트 안(제목·담은 디자인 버튼 없음, 찾기 줄은 시트 스크롤 칸 맨 위에 붙음). root·notify는 시트가 건네요. */
export function GalleryDict({ open: first = '', compact = false, root = null, notify = null }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [openId, setOpenId] = useState(() => (ITEMS.some((x) => x.id === first) ? first : ''));
  const [cartOpen, setCartOpen] = useState(false);
  const cart = useCart();
  const list = useMemo(() => searchItems(q, cat), [q, cat]);
  const counts = useMemo(() => Object.fromEntries(CATEGORIES.map((c) => [c.id, searchItems(q, c.id).length])), [q]);
  const total = CATEGORIES.reduce((n, c) => n + counts[c.id], 0);
  const ctx = useMemo(() => ({ root, notify: notify || ((m) => toast(m)) }), [root, notify]);
  return (
    <Ctx.Provider value={ctx}>
    <section class={`dd${compact ? ' dd-compact' : ''}`} aria-labelledby={compact ? undefined : 'dd-h'} aria-label={compact ? '디자인 사전' : undefined}>
      {!compact && <div class="section-title"><h2 id="dd-h">디자인 사전</h2><p>웹 디자인 용어·형식·움직임·글꼴·색 {ITEMS.length}가지를 실제로 움직이는 미리보기로 모았어요. 눌러서 크게 보고, 마음에 들면 담아 두세요. 강의 사이트를 만들 때 AI가 참고해요.</p></div>}
      <div class="dd-bar">
        <div class="dd-bar-in">
          <input class="input dd-q" type="search" value={q} onInput={(e) => setQ(e.currentTarget.value)} placeholder="찾기: 유리, 스크롤, 명조, 타이머…" aria-label="디자인 찾기" />
          {!compact && <button type="button" class={`btn dd-cart-btn${cart.length ? ' has' : ''}`} onClick={() => setCartOpen(true)} aria-label={`담은 디자인 ${cart.length}개 보기`}>담은 디자인 <b class="dd-n">{cart.length}</b></button>}
        </div>
        <div class="dd-cats" role="group" aria-label="분류">
          <button type="button" aria-pressed={String(!cat)} onClick={() => setCat('')}>전체 <span>{total}</span></button>
          {CATEGORIES.map((c) => <button type="button" aria-pressed={String(cat === c.id)} onClick={() => setCat(cat === c.id ? '' : c.id)} disabled={!counts[c.id] && cat !== c.id}>{c.ko} <span>{counts[c.id]}</span></button>)}
        </div>
      </div>
      {list.length ? (
        <div class="dd-grid">{list.map((it) => <Card key={it.id} it={it} cart={cart} onOpen={setOpenId} />)}</div>
      ) : <p class="dd-empty">찾는 디자인이 없어요. 다른 낱말로 찾아보세요.</p>}
      {openId && <Detail key="detail" id={openId} list={list.some((x) => x.id === openId) ? list : ITEMS} cart={cart} onClose={() => setOpenId('')} onMove={setOpenId} />}
      {cartOpen && <CartPanel cart={cart} onClose={() => setCartOpen(false)} onOpen={(id) => { setCartOpen(false); setQ(''); setCat(''); setOpenId(id); }} />}
    </section>
    </Ctx.Provider>
  );
}
