// 담은 디자인(참고 디자인 > 디자인 사전에서 [담기]). 이 브라우저에만(localStorage) 둠.
// 강의 사이트를 만들 때 교재 넣기 화면(components/DesignPicks.jsx)이 새 연수의 참고 디자인(p.reference.picks)으로 옮기고,
// AI에게 주는 글(lib/gen/prompts.js askOf · skills/lecpage/scripts/studio.mjs taskText)이 이름·한 줄·핵심 기법만 짧게 넣음.
// 첫 화면 묶음(main.jsx 머리의 개수 표시)에 들어가므로 작게 유지.
import { useEffect, useState } from 'preact/hooks';

const KEY = 'lecpage:design-cart';
export const CART_MAX = 10; // AI에게 주는 글이 길어지지 않게
const EV = 'lp-design-cart';
const cut = (s, n) => String(s || '').trim().slice(0, n);

/** 담을 때 남기는 것(사전 데이터 없이도 교재 넣기 화면·AI 글이 쓸 수 있게) */
export const pickOf = (it) => ({ id: cut(it.id, 40), ko: cut(it.ko, 30), en: cut(it.en, 40), desc: cut(it.desc, 70), tech: cut(it.tech, 70) });

let mem = null; // 저장소를 못 쓰는 창에서는 이 탭 동안만
export function cartItems() {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v.filter((x) => x && x.id).slice(0, CART_MAX) : []; } catch { return mem || []; }
}
function save(list) {
  mem = list;
  try { if (list.length) localStorage.setItem(KEY, JSON.stringify(list)); else localStorage.removeItem(KEY); } catch { /* 이 탭 동안만 */ }
  dispatchEvent(new Event(EV));
}
export const inCart = (id, list = cartItems()) => list.some((x) => x.id === id);
/** 담기/담기 취소. 꽉 찼으면 false */
export function toggleCart(it) {
  const list = cartItems();
  if (inCart(it.id, list)) { save(list.filter((x) => x.id !== it.id)); return true; }
  if (list.length >= CART_MAX) return false;
  save([...list, pickOf(it)]); return true;
}
export const removeFromCart = (id) => save(cartItems().filter((x) => x.id !== id));
export const clearCart = () => save([]);

/** 담은 디자인 목록(다른 탭에서 바꿔도 따라옴) */
export function useCart() {
  const [list, setList] = useState(cartItems);
  useEffect(() => {
    const f = () => setList(cartItems());
    const s = (e) => { if (!e.key || e.key === KEY) f(); };
    addEventListener(EV, f); addEventListener('storage', s);
    return () => { removeEventListener(EV, f); removeEventListener('storage', s); };
  }, []);
  return list;
}
