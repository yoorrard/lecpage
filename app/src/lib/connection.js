// AI 연결을 한 곳에서: lecpage 커넥트 상태(켜짐·꺼짐·브라우저가 막음) + 지금 쓸 연결(ChatGPT 계정 · Claude 계정 · Codex · API 키).
// [만들기]·[AI로 수정]·검수의 [AI로 수정]이 모두 여기서 고른 연결을 씀. 화면 위의 한 줄 표시("ChatGPT 계정 연결됨 · lecpage 커넥트 켜짐")도 여기서.
import { useEffect, useState } from 'preact/hooks';
import { pcStatus, bridgeAvailable, bridgeSameOrigin, pairing, updateStart, checkPairing } from './gen/local.js';
import { getActiveAI, PROVIDERS } from './ai.js';

const PREF = 'lecpage:conn'; // 'chatgpt' | 'claude' | 'codex' | 'key'
/** lecpage 커넥트(이 PC에서 ChatGPT·Claude 계정을 lecpage.com에 이어 주는 작은 프로그램) 받는 곳 한 곳. 예전 이름(lecpage-studio.*)도 그대로 받아짐 */
const REL = 'https://github.com/yoorrard/lecpage/releases';
export const DOWNLOAD = {
  win: `${REL}/download/studio-latest/lecpage-connect.cmd`, // Windows: 받아서 두 번 누름
  sh: `curl -fsSL ${REL}/download/studio-latest/lecpage-connect.sh | bash`, // Mac·Linux: 터미널에 한 줄
  page: `${REL}/tag/studio-latest`,
};
DOWNLOAD.mac = DOWNLOAD.sh; DOWNLOAD.linux = DOWNLOAD.sh;
/** 지금 기기의 운영체제: 'win' | 'mac' | 'linux' | 'mobile'(휴대폰·태블릿: 커넥트를 깔 수 없음) */
export function osName() {
  try {
    const n = navigator; const ua = n.userAgent || ''; const pf = String(n.userAgentData?.platform || n.platform || '');
    if (n.userAgentData?.mobile || /Android|iPhone|iPad|iPod/i.test(ua) || (/Mac/i.test(pf + ua) && n.maxTouchPoints > 1)) return 'mobile';
    if (/Win/i.test(pf) || /Windows/i.test(ua)) return 'win';
    if (/Mac/i.test(pf) || /Macintosh|Mac OS X/i.test(ua)) return 'mac';
    if (/Linux|X11|CrOS|Chrome OS/i.test(pf + ua)) return 'linux';
  } catch { /* 모름 */ }
  return 'win';
}
export function preferred() { try { return localStorage.getItem(PREF) || ''; } catch { return ''; } }
export function setPreferred(v) { try { if (v) localStorage.setItem(PREF, v); else localStorage.removeItem(PREF); } catch { /* 저장 못 해도 이번엔 고른 대로 */ } notify(); }

// ── lecpage 커넥트 상태(탭 하나에 하나, 여러 화면이 같이 봄) ──
let pc = { state: bridgeAvailable() ? 'unknown' : 'none' };
let at = 0; let inflight = null; let seq = 0;
const subs = new Set();
function notify() { for (const f of subs) f(pc); }
export function pcNow() { return pc; }
/** 다시 확인(fresh: 에이전트 설치·로그인을 새로 살핌) */
export function refreshPc({ fresh = false } = {}) {
  if (inflight && !fresh) return inflight;
  const my = ++seq;
  const run = pcStatus({ fresh }).catch(() => ({ state: 'off' })).then((v) => {
    if (my !== seq) return pc; // 뒤에 시작한 확인이 있음(짝을 바꾼 뒤 등): 예전 짝으로 본 결과는 그리지 않음
    if (upd.state === 'run' && v.state !== 'on') return pc; // 새 판으로 다시 켜지는 동안 잠깐 꺼진 것은 그리지 않음
    pc = v; at = Date.now(); notify(); return v;
  });
  inflight = run;
  run.finally(() => { if (inflight === run) inflight = null; });
  return run;
}
/** 화면이 그릴 lecpage 커넥트 상태. 그릴 때·창으로 돌아올 때 확인(5초 안에 본 것은 그대로) */
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

// ── 예전 판 lecpage 커넥트: 이 화면이 쓰는 기능(caps)이 없으면 새 판으로 바꾸게(바꿀 수 있으면 버튼 하나, 아니면 다시 켜는 법) ──
/** 켜진 lecpage 커넥트가 이 기능을 아는지(caps가 없는 판은 모름) */
export const pcCan = (p, cap) => p.state === 'on' && (p.status?.caps || []).includes(cap);
/** 스스로 새 판으로 바꿀 수 있는 판인지(받은 실행 파일로 켰을 때) */
export const pcCanUpdate = (p) => pcCan(p, 'update') && !!p.status?.update?.can;
let upd = { state: '' }; // '' | 'run'(받아서 바꾸고 다시 켜는 중) | 'error' | 'manual'(다시 켜는 법을 보여 줌)
const updSubs = new Set();
function setUpd(v) { upd = v; for (const f of updSubs) f(upd); return v; }
export function usePcUpdate() {
  const [v, setV] = useState(upd);
  useEffect(() => { updSubs.add(setV); setV(upd); return () => { updSubs.delete(setV); }; }, []);
  return v;
}
/** [새 버전으로 바꾸기]: 커넥트가 받아 바꾸고 같은 포트·토큰으로 다시 켤 때까지(보통 10초 안, 길어도 2분) → 'done' | 'error' | 'manual' */
export async function updatePc() {
  if (upd.state === 'run') return 'run';
  if (!pcCanUpdate(pc)) return setUpd({ state: 'manual' }).state;
  const before = pc.status?.build || '';
  setUpd({ state: 'run' });
  try {
    const r = await updateStart();
    if (r.upToDate) return setUpd({ state: 'error', error: '새 버전을 준비하는 중이에요. 잠시 뒤 다시 눌러 주세요.' }).state;
  } catch (e) { return setUpd({ state: 'error', error: e?.message || 'lecpage 커넥트에 닿지 못했어요.' }).state; }
  for (const end = Date.now() + 120e3; Date.now() < end;) {
    await new Promise((r) => setTimeout(r, 1500));
    const v = await pcStatus().catch(() => ({ state: 'off' }));
    if (v.state !== 'on') continue;
    const u = v.status?.update || {};
    if (u.state === 'error') { pc = v; notify(); return setUpd({ state: 'error', error: u.error_ko || '' }).state; }
    if (v.status?.build && v.status.build !== before && u.state !== 'restart') { setUpd({ state: '' }); await refreshPc({ fresh: true }); return 'done'; }
  }
  return setUpd({ state: 'manual' }).state;
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

/** 연결 하나 + lecpage 커넥트 상태(화면용 훅). keyAi는 API 키로 연결한 AI(있으면) */
export function useConnection({ demo = false } = {}) {
  const p = usePc();
  const [keyAi, setKeyAi] = useState(undefined);
  useEffect(() => { if (demo) { setKeyAi(null); return; } getActiveAI().then((a) => setKeyAi(a || null), () => setKeyAi(null)); }, [demo]);
  const list = demo ? [] : available(p, keyAi || null);
  return { pc: p, list, conn: pickConnection(list), loading: keyAi === undefined || p.state === 'unknown' };
}

// ── 짝 맞추기: lecpage 커넥트가 새 탭으로 lecpage.com#pair=…를 엶 → 기다리던 탭(받기 안내를 연 탭)이 있으면 그 탭에서 이어 하고 새 탭은 닫음 ──
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
/**
 * main.jsx가 주소의 #pair=…를 읽은 뒤(capturePairing의 답 kind): 'saved'는 바로, 'check'(쓰던 짝과 다른 토큰)는 커넥트가 새 토큰에 답할 때만 짝을 바꾸고 알림.
 * 바뀐 짝만 다른 탭에 알림(announcePairing). → 'paired'(이 탭에서 이어 함) | 'moved'(기다리던 탭이 이어 받고 이 탭은 닫힘) | 'kept'(확인하지 못해 쓰던 짝 그대로) | 'denied'(브라우저가 로컬 네트워크 접근을 막음)
 */
export async function finishPairing(kind) {
  if (kind === 'check') {
    const r = await checkPairing();
    if (r !== 'ok') return r === 'denied' ? 'denied' : 'kept';
    refreshPc({ fresh: true });
  }
  return (await announcePairing()) ? 'moved' : 'paired';
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

// ── 연결 동의: 길(ChatGPT 계정·Claude 계정·Codex·API 키)마다 처음 연결할 때 한 번. 이 브라우저에 기억하고, 안내 글이 바뀌면 다시 물음 ──
const CONSENT = 'lecpage:consent';
const WAYS = {
  chatgpt: { title: 'ChatGPT 계정 연결', to: 'OpenAI로', from: '이 PC의 lecpage 커넥트', at: '이 PC', bill: '사용량은 내 ChatGPT 요금제에서 차감돼요.', login: '로그인 정보' },
  claude: { title: 'Claude 계정 연결', to: 'Anthropic으로', from: '이 PC의 lecpage 커넥트', at: '이 PC', bill: '사용량은 Claude Code에 로그인한 내 계정에서 차감돼요.', login: '로그인 정보' },
  codex: { title: 'Codex 연결', to: 'OpenAI로', from: '이 PC의 lecpage 커넥트', at: '이 PC', bill: '사용량은 Codex에 로그인한 내 계정에서 차감돼요.', login: '로그인 정보' },
  'key:openai': { title: 'GPT API 키 연결', to: 'OpenAI로', from: '이 브라우저', at: '이 브라우저', bill: '쓴 만큼 내 API 키로 요금이 청구돼요.', login: 'API 키' },
  'key:anthropic': { title: 'Claude API 키 연결', to: 'Anthropic으로', from: '이 브라우저', at: '이 브라우저', bill: '쓴 만큼 내 API 키로 요금이 청구돼요.', login: 'API 키' },
};
/** 연결 → 동의 길 이름('key'는 회사별) */
export const consentId = (c) => (!c ? '' : c.id === 'key' || c.way === 'key' ? `key:${c.provider}` : c.id);
/** 동의 창에 보일 제목과 세 줄(무엇을·언제 / 어디로·비용 / 로그인 정보) */
export function consentText(id) {
  const w = WAYS[id]; if (!w) return null;
  return { title: w.title, lines: [
    '[만들기]나 [AI로 수정]을 누를 때만 교재·사이트와 프롬프트를 보내요.',
    `${w.from}에서 ${w.to} 바로 가요. ${w.bill}`,
    `${w.login}는 ${w.at}에만 있고, lecpage 운영자에게는 가지 않아요.`,
  ] };
}
const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const sig = (id, old = false) => { const t = consentText(id); return t ? hash(t.title + t.lines.join('\n').replace(old ? '프롬프트를' : '\0', '요청 글을')) : ''; };
function consents() { try { return JSON.parse(localStorage.getItem(CONSENT) || '{}') || {}; } catch { return {}; } }
/** 이 길에 지금 안내 글로 동의했는지. 낱말만 표준 용어로 바꾼 예전 글('요청 글' → '프롬프트', 뜻은 같음)에 한 동의도 그대로 받음(다시 묻지 않게) */
export function hasConsent(id) { return !WAYS[id] || [sig(id), sig(id, true)].includes(consents()[id]); }
let asking = null; const askSubs = new Set();
/** 처음이면 동의 창을 띄우고 답을 기다림(동의 → true). 이미 동의했으면 바로 true. 창은 ConsentHost가 그림 */
export function askConsent(id) {
  if (hasConsent(id)) return Promise.resolve(true);
  return new Promise((ok) => { asking?.ok(false); asking = { id, ok }; for (const f of askSubs) f(asking); });
}
export function answerConsent(yes) {
  const a = asking; if (!a) return; asking = null;
  if (yes) { try { localStorage.setItem(CONSENT, JSON.stringify({ ...consents(), [a.id]: sig(a.id) })); } catch { /* 저장 못 해도 이번엔 동의한 대로 */ } }
  for (const f of askSubs) f(null);
  a.ok(!!yes);
}
export function useConsentAsk() {
  const [v, setV] = useState(asking);
  useEffect(() => { askSubs.add(setV); setV(asking); return () => { askSubs.delete(setV); }; }, []);
  return v;
}
export function forgetConsents() { try { localStorage.removeItem(CONSENT); } catch { /* 없음 */ } }

/** 한 줄 표시 글 */
export function connLine(p, conn) {
  const pcText = p.state === 'on' ? 'lecpage 커넥트 켜짐' : p.state === 'off' ? 'lecpage 커넥트 꺼짐' : p.state === 'blocked' ? '이 브라우저는 lecpage 커넥트에 닿지 못해요' : '';
  const c = conn ? `${conn.label} 연결됨` : p.state === 'on' ? '계정 연결 전' : 'AI 연결 안 됨';
  return [pcText, c].filter(Boolean).join(' · ');
}
export { bridgeAvailable, bridgeSameOrigin, pairing };
