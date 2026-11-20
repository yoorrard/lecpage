// 되돌리기: 프로젝트마다 최근 20개(이 탭 안에서만). 고치기 화면과 AI 작업이 함께 씁니다.
// AI가 사이트를 바꾸기 직전 판(가장 최근 하나)만은 이 브라우저 저장소(kv 'undo:<id>')에도 둠 → 새로 고친 뒤에도 [되돌리기]가 'AI로 만들기 전'으로.
// 새 단추는 없음. 연수를 지우면 함께 지움(db.js projects.remove)
import { kv } from './db.js';

const stacks = new Map();
const subs = new Set();
const KEEP = /^AI로 /; // 저장소에도 남기는 큰 바꿈('AI로 만들기 전'·'AI로 다듬기')
const keyOf = (pid) => 'undo:' + pid;
const emit = () => subs.forEach((f) => f());
/** 스택에서 가장 최근의 큰 바꿈 판을 저장소에(없으면 지움) */
function persist(pid) {
  const last = [...undoStack(pid)].reverse().find((x) => KEEP.test(x.label));
  (last ? kv.set(keyOf(pid), { v: 1, at: last.at || Date.now(), label: last.label, blueprint: last.blueprint, info: last.info }) : kv.del(keyOf(pid))).catch(() => { });
}
export function undoStack(pid) { let s = stacks.get(pid); if (!s) { s = []; stacks.set(pid, s); } return s; }
export function pushUndoFor(pid, label, p) {
  if (!p?.blueprint) return;
  const s = undoStack(pid);
  s.push({ label, at: Date.now(), blueprint: JSON.parse(JSON.stringify(p.blueprint)), info: { ...p.info } });
  if (s.length > 20) s.shift();
  if (KEEP.test(label)) persist(pid);
  emit();
}
export function popUndo(pid) {
  const v = undoStack(pid).pop();
  if (v && KEEP.test(v.label)) persist(pid);
  emit(); return v;
}
export function onUndoChange(f) { subs.add(f); return () => subs.delete(f); }
/** 이 탭의 스택이 비어 있으면(새로 고친 뒤) 저장해 둔 'AI로 … 전' 판을 맨 밑에 넣음 */
export async function loadSavedUndo(pid) {
  const v = await kv.get(keyOf(pid)).catch(() => null);
  const s = undoStack(pid);
  if (!v?.blueprint || s.some((x) => x.saved || x.at === v.at)) return;
  s.unshift({ label: v.label || 'AI로 만들기 전', at: v.at, blueprint: v.blueprint, info: v.info || {}, saved: true });
  emit();
}
