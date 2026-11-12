// 담은 낱말: 디자인 둘러보기(낱말 사전)에서 담은 낱말을 이 브라우저에 잠깐 두고, 연수의 디자인 칸에서 꺼내 씁니다.
import { useEffect, useState } from 'preact/hooks';
import { wordById } from './words.js';

const KEY = 'lecpage:words';
const subs = new Set();
export function readBasket() {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v.filter((id) => typeof id === 'string' && wordById(id)).slice(0, 20) : []; } catch { return []; }
}
export function writeBasket(ids) {
  try { if (ids.length) localStorage.setItem(KEY, JSON.stringify(ids.slice(0, 20))); else localStorage.removeItem(KEY); } catch { /* 저장소를 못 쓰면 이 화면에서만 */ }
  mem = ids; subs.forEach((f) => f(ids));
}
let mem = null;
/** 담은 낱말(다른 탭에서 바꿔도 따라옴) */
export function useBasket() {
  const [ids, setIds] = useState(() => mem || (mem = readBasket()));
  useEffect(() => {
    const f = (v) => setIds(v);
    const st = (e) => { if (e.key === KEY) { mem = readBasket(); setIds(mem); } };
    subs.add(f); addEventListener('storage', st);
    return () => { subs.delete(f); removeEventListener('storage', st); };
  }, []);
  return [ids, writeBasket];
}
