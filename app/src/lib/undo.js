// 되돌리기: 프로젝트마다 최근 20개(이 탭 안에서만). 고치기 화면과 AI 작업이 함께 씁니다.
const stacks = new Map();
const subs = new Set();
export function undoStack(pid) { let s = stacks.get(pid); if (!s) { s = []; stacks.set(pid, s); } return s; }
export function pushUndoFor(pid, label, p) {
  if (!p?.blueprint) return;
  const s = undoStack(pid);
  s.push({ label, blueprint: JSON.parse(JSON.stringify(p.blueprint)), info: { ...p.info } });
  if (s.length > 20) s.shift();
  subs.forEach((f) => f());
}
export function popUndo(pid) { const v = undoStack(pid).pop(); subs.forEach((f) => f()); return v; }
export function onUndoChange(f) { subs.add(f); return () => subs.delete(f); }
