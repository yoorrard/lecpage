// AI 연결을 한 곳에서: PC 프로그램 상태(켜짐·꺼짐·브라우저가 막음) + 지금 쓸 연결(ChatGPT 계정 · Claude 계정 · Codex · API 키).
// [만들기]·[AI로 수정]·검수의 [AI로 수정]이 모두 여기서 고른 연결을 씀. 화면 위의 한 줄 표시("ChatGPT 계정 연결됨 · PC 프로그램 켜짐")도 여기서.
import { useEffect, useState } from 'preact/hooks';
import { pcStatus, bridgeAvailable, bridgeSameOrigin, pairing } from './gen/local.js';
import { getActiveAI, PROVIDERS } from './ai.js';

const PREF = 'lecpage:conn'; // 'chatgpt' | 'claude' | 'codex' | 'key'
export const DOWNLOAD = {
  win: 'https://github.com/yoorrard/lecpage/releases/download/studio-latest/lecpage-studio.cmd',
  mac: 'curl -fsSL https://github.com/yoorrard/lecpage/releases/download/studio-latest/lecpage-studio.sh | bash',
  page: 'https://github.com/yoorrard/lecpage/releases/tag/studio-latest',
};
export function preferred() { try { return localStorage.getItem(PREF) || ''; } catch { return ''; } }
export function setPreferred(v) { try { if (v) localStorage.setItem(PREF, v); else localStorage.removeItem(PREF); } catch { /* 저장 못 해도 이번엔 고른 대로 */ } notify(); }

// ── PC 프로그램 상태(탭 하나에 하나, 여러 화면이 같이 봄) ──
let pc = { state: bridgeAvailable() ? 'unknown' : 'none' };
let at = 0; let inflight = null;
const subs = new Set();
function notify() { for (const f of subs) f(pc); }
export function pcNow() { return pc; }
/** 다시 확인(fresh: 에이전트 설치·로그인을 새로 살핌) */
export function refreshPc({ fresh = false } = {}) {
  if (inflight && !fresh) return inflight;
  const run = pcStatus({ fresh }).catch(() => ({ state: 'off' })).then((v) => { pc = v; at = Date.now(); notify(); return v; });
  inflight = run;
  run.finally(() => { if (inflight === run) inflight = null; });
  return run;
}
/** 화면이 그릴 PC 프로그램 상태. 그릴 때·창으로 돌아올 때 확인(5초 안에 본 것은 그대로) */
export function usePc() {
  const [v, setV] = useState(pc);
  useEffect(() => {
    subs.add(setV);
    if (bridgeAvailable() && Date.now() - at > 5000) refreshPc();
    const onFocus = () => { if (bridgeAvailable() && document.visibilityState === 'visible' && Date.now() - at > 3000) refreshPc(); };
    addEventListener('focus', onFocus); document.addEventListener('visibilitychange', onFocus);
    return () => { subs.delete(setV); removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); };
  }, []);
  return v;
}

/** 지금 쓸 수 있는 연결들 */
export function available(p = pc, keyAi = null) {
  const s = p.state === 'on' ? p.status || {} : {};
  const ag = Object.fromEntries((s.agents || []).map((a) => [a.id, a]));
  const out = [];
  if (s.chatgpt?.connected && s.chatgpt.plan) out.push({ id: 'chatgpt', way: 'chatgpt', provider: 'chatgpt', label: 'ChatGPT 계정', ro: 'ChatGPT 계정으로', who: s.chatgpt.email || '' });
  if (ag.claude?.installed && ag.claude.ready !== false) out.push({ id: 'claude', way: 'local', agent: 'claude', label: 'Claude 계정', ro: 'Claude 계정으로', who: 'Claude Code', apiKey: ag.claude.auth === 'api-key' });
  if (keyAi) out.push({ id: 'key', way: 'key', provider: keyAi.provider, model: keyAi.model, label: `${PROVIDERS[keyAi.provider]?.short || 'AI'} API 키`, ro: `${PROVIDERS[keyAi.provider]?.short || 'AI'} API 키로` });
  if (ag.codex?.installed && ag.codex.ready !== false) out.push({ id: 'codex', way: 'local', agent: 'codex', label: 'Codex', ro: 'Codex로', who: 'Codex' });
  return out;
}
/** 고른 연결(없으면 쓸 수 있는 첫째) → startGeneration·editSite에 넘길 { way, provider, model, agent } */
export function pickConnection(list) {
  const want = preferred();
  return list.find((c) => c.id === want) || list[0] || null;
}
export const jobOpts = (c) => (c ? (c.way === 'local' ? { way: 'local', agent: c.agent } : c.way === 'chatgpt' ? { way: 'chatgpt', provider: 'chatgpt' } : { way: 'key', provider: c.provider, model: c.model || '' }) : null);

/** 연결 하나 + PC 프로그램 상태(화면용 훅). keyAi는 API 키로 연결한 AI(있으면) */
export function useConnection({ demo = false } = {}) {
  const p = usePc();
  const [keyAi, setKeyAi] = useState(undefined);
  useEffect(() => { if (demo) { setKeyAi(null); return; } getActiveAI().then((a) => setKeyAi(a || null), () => setKeyAi(null)); }, [demo]);
  const list = demo ? [] : available(p, keyAi || null);
  return { pc: p, list, conn: pickConnection(list), loading: keyAi === undefined || p.state === 'unknown' };
}

// ── 짝 맞추기: PC 프로그램이 새 탭으로 lecpage.com#pair=…를 엶 → 기다리던 탭(받기 안내를 연 탭)이 있으면 그 탭에서 이어 하고 새 탭은 닫음 ──
const CH = 'lecpage-pc';
let waiting = 0;
/** 받기 안내를 보는 동안 켜 둠(새 탭이 짝을 맞추면 이 탭이 받음) */
export function waitForPairing(on) { waiting = Math.max(0, waiting + (on ? 1 : -1)); }
if (typeof BroadcastChannel !== 'undefined') {
  try {
    const bc = new BroadcastChannel(CH);
    bc.onmessage = (e) => {
      if (e.data?.type !== 'paired') return;
      refreshPc({ fresh: true });
      if (waiting > 0) { bc.postMessage({ type: 'here' }); try { window.focus(); } catch { /* 브라우저가 막음 */ } }
    };
  } catch { /* 없음 */ }
}
/** 방금 짝을 맞춘 새 탭: 기다리던 탭이 있으면 닫힘(기록이 한 쪽뿐인 탭이라 스크립트로 닫을 수 있음). 없으면 이 탭에서 이어 함 */
export function announcePairing() {
  if (typeof BroadcastChannel === 'undefined') return Promise.resolve(false);
  return new Promise((ok) => {
    let bc; try { bc = new BroadcastChannel(CH); } catch { ok(false); return; }
    let here = false;
    bc.onmessage = (e) => { if (e.data?.type === 'here') here = true; };
    bc.postMessage({ type: 'paired' });
    setTimeout(() => { bc.close(); if (here) { try { window.close(); } catch { /* 못 닫음 */ } } ok(here); }, 800);
  });
}

/** 한 줄 표시 글 */
export function connLine(p, conn) {
  const pcText = p.state === 'on' ? 'PC 프로그램 켜짐' : p.state === 'off' ? 'PC 프로그램 꺼짐' : p.state === 'blocked' ? '이 브라우저는 PC 프로그램에 닿지 못해요' : '';
  const c = conn ? `${conn.label} 연결됨` : p.state === 'on' ? '계정 연결 전' : 'AI 연결 안 됨';
  return [c, pcText].filter(Boolean).join(' · ');
}
export { bridgeAvailable, bridgeSameOrigin, pairing };
