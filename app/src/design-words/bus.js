// 디자인 칸과 미리보기 사이의 작은 연락 통로(같은 탭 안, 연수마다).
//   try: 고칠 안을 미리보기에 '바꾸면'으로 띄움 { bp, label, focus, apply }
//   labels: 미리보기의 섹션마다 배치 이름 붙이기
//   focus: 미리보기를 이 섹션으로 옮기기(바꾼 칸을 바로 보이게)
import { useEffect, useState } from 'preact/hooks';

const state = new Map();
const subs = new Set();
const get = (pid) => { let s = state.get(pid); if (!s) { s = { try: null, labels: false, focus: null }; state.set(pid, s); } return s; };
const emit = () => subs.forEach((f) => f());

export function setTry(pid, t) { get(pid).try = t || null; emit(); }
export function setLabels(pid, on) { get(pid).labels = !!on; emit(); }
let n = 0;
export function focusSection(pid, id) { get(pid).focus = id ? { id, n: ++n } : null; emit(); }
export const busOf = (pid) => get(pid);

/** 이 연수의 연락 상태(바뀌면 다시 그림) */
export function useBus(pid) {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force((x) => x + 1); subs.add(f); return () => subs.delete(f); }, []);
  return get(pid);
}
