// AI 작업이 이 탭에서 도는 중인지(의존성 없는 작은 표시). 앱 새 판 자동 새로 고침(lib/fresh.jsx)이 이것을 보고 미룸.
// 작업 기록은 단계마다 저장돼 새로 고쳐도 이어 하지만, 받는 중인 답을 끊지 않으려고.
const running = new Set();
const subs = new Set();
export function markBusy(pid, on) {
  const had = running.size > 0;
  if (on) running.add(pid); else running.delete(pid);
  if (had !== running.size > 0) subs.forEach((f) => f(running.size > 0));
}
/** 이 탭에서 AI 작업이 도는 중이면 true */
export const isGenerating = () => running.size > 0;
/** 도는 중↔멈춤이 바뀔 때 */
export function onBusyChange(f) { subs.add(f); return () => subs.delete(f); }
if (typeof globalThis !== 'undefined') globalThis.lecpageGenBusy = isGenerating;
