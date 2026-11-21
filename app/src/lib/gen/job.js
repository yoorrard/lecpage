// AI 작업 실행기: 단계마다 저장해, 끊겨도 그 자리부터 이어 합니다(docs/plan-ai-first.md §6, 약속 D).
// 단계: build(교재 원본 + 짧은 요청 하나 → AI가 사이트 전체를 한 답으로) → assemble(조립 + 검수) → 끝.
// lecpage는 AI의 디자인·구성에 끼어들지 않음: 검수 결과는 강사에게 참고로만 보이고, 고치기는 강사가 [AI에게 고쳐 달라기]를 누를 때만(fix).
// 고치기(edit·fix): 지금 사이트 전체 + 요청 → AI가 바뀐 파일만
// - 망·5xx·감시 끊김: 그 단계만 다시(받은 글이 넉넉하면 '이어서'로). OpenAI는 서버에서 계속 도는 답을 이어 받음(starting_after)
// - 한도(429): 알려 준 시간만큼 기다렸다 그 단계만 다시. 잘림: 같은 단계 안에서 '이어서'(세 번까지)
// - 받는 중인 글은 몇 초마다 기록에 저장 → 새로 고쳐도 그 글부터 이어 감(OpenAI는 응답 id·순번으로)
// - 같은 연수를 두 탭에서 동시에 돌리지 않음(Web Locks, 없으면 기록의 심장 박동)
// - 탭이 가려진 동안 끊기면 횟수를 쓰지 않고 기다렸다가, 탭이 돌아오면(또는 망이 돌아오면) 이어 함
import { getActiveAI, loadKey, explainError, checkKey, models as listModels, rememberWorkingModel, PROVIDERS } from '../ai.js';
import { projects, blobs } from '../db.js';
import { uid } from '../util.js';
import { reach } from '../netcheck.js';
import { jobsDb } from './store.js';
import { markBusy } from './busy.js';
import { adapter } from './providers/index.js';
import { AiError, BASES, baseFor } from './providers/common.js';
import * as oa from './oa-trash.js';
import { preparePageImages, packMaterial, sourceFiles } from './material.js';
import * as P from './prompts.js';
import { extractSections, replaceSections, stitch, balance, trimCss, cssCut, parseSiteAnswer } from './parse.js';
import { inspect, readMeta, themeFromCss, issuesForAi, siteFileOk } from './kit.js';
import { extraIssues } from './checks.js';
import { assembleSite } from './preview.js';
import { renderIssues } from './render-check.js';
import { runBridgeJob, cancelBridgeJob, bridgeFiles, bridgeSite, decodeBinary, chatgptModels } from './local.js';
import { carryLegacy, recordVersion, aiVersionLabel, addChat, aiReply } from '../site-meta.js';
import { ensureIds } from '../site-doc.js';

const TAB = uid(8);
const live = new Map(); // pid → { ctrl, rec, wait, elsewhere }
// 붐벼서(503) 바꾼 모델: 15분 동안은 다음 작업(수정·검수 고치기)도 처음부터 되는 모델로 → 같은 붐빔을 다시 기다리지 않음(실제 시험: 고칠 때마다 요청 4번·40초 낭비)
let busyDetour = null; // { provider, from: Set, to, at }
const subs = new Set();
const emit = (pid) => subs.forEach((f) => f(pid));
export const onJobChange = (f) => { subs.add(f); return () => subs.delete(f); };

let bc = null;
try { bc = typeof BroadcastChannel === 'function' ? new BroadcastChannel('lecpage-gen') : null; } catch { bc = null; }
const remote = new Map(); // 다른 탭이 알려 온 기록(pid → rec)
if (bc) {
  bc.onmessage = async (e) => {
    const m = e.data; if (!m?.pid) return;
    if (m.cmd === 'stop') { if (live.get(m.pid)?.ctrl) stopJob(m.pid); return; } // 다른 탭에서 [멈추기]를 누름 → 돌리는 이 탭이 멈춤
    const rec = await jobsDb.get(m.pid).catch(() => null); if (rec) remote.set(m.pid, rec); else remote.delete(m.pid); emit(m.pid);
  };
}

const hook = () => (typeof globalThis !== 'undefined' && globalThis.__lpGenTest) || {};
const sleep = (ms, signal) => new Promise((res, rej) => {
  if (signal?.aborted) return rej(new DOMException('aborted', 'AbortError'));
  const t = setTimeout(res, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('aborted', 'AbortError')); }, { once: true });
});
const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';
const whenVisible = (signal) => new Promise((res, rej) => {
  if (!hidden()) return res();
  const on = () => { if (!hidden()) { document.removeEventListener('visibilitychange', on); res(); } };
  document.addEventListener('visibilitychange', on);
  signal?.addEventListener('abort', () => { document.removeEventListener('visibilitychange', on); rej(new DOMException('aborted', 'AbortError')); }, { once: true });
});

// ── 기록 저장 ──
let lastBeat = 0;
async function save(rec, { quiet = false } = {}) {
  rec.updatedAt = Date.now(); rec.owner = TAB; rec.beat = Date.now(); lastBeat = rec.beat;
  const L = live.get(rec.pid); if (L) L.rec = rec;
  await jobsDb.put(JSON.parse(JSON.stringify(rec)));
  if (!quiet) { try { bc?.postMessage({ pid: rec.pid, id: rec.id, at: rec.updatedAt }); } catch { /* 알림만 못 함 */ } }
  emit(rec.pid);
}
/** 받는 중 글 저장은 3초에 한 번(빈번한 쓰기 방지) */
function saveSoon(rec) {
  const L = live.get(rec.pid); if (!L) return;
  if (L.saveT) return;
  L.saveT = setTimeout(() => { L.saveT = 0; save(rec, { quiet: true }).catch(() => { }); }, hook().saveMs || 3000);
}


// ── 같은 연수를 두 탭에서 동시에 돌리지 않기 ──
const lockName = (pid) => 'lecpage-gen:' + pid;
const hasLocks = () => typeof navigator !== 'undefined' && !!navigator.locks?.request;
/** 다른 탭이 이 연수의 작업을 돌리는 중인지 */
export async function heldElsewhere(pid) {
  if (live.get(pid)?.ctrl) return false;
  if (hasLocks()) { try { const q = await navigator.locks.query(); return (q.held || []).some((l) => l.name === lockName(pid)); } catch { /* 아래로 */ } }
  const rec = await jobsDb.get(pid).catch(() => null);
  return !!rec && rec.status === 'running' && rec.owner !== TAB && Date.now() - (rec.beat || 0) < 20e3;
}
/** 잠금을 잡고 fn을 돌림. 못 잡으면(다른 탭이 도는 중) null을 바로 돌려줌. started(): fn이 시작됐을 때 */
function withLock(pid, fn) {
  if (hasLocks()) {
    return new Promise((resolve, reject) => {
      navigator.locks.request(lockName(pid), { ifAvailable: true }, async (lock) => {
        if (!lock) { resolve(null); return; }
        let run;
        try { run = fn(); resolve({ run }); await run; } catch (e) { reject(e); }
      }).catch(reject);
    });
  }
  return heldElsewhere(pid).then((busy) => (busy ? null : { run: fn() }));
}

// ── 단계 목록 ──
const STEP = (name) => ({ name, status: 'todo', attempts: 0, output: null, error: null });
function stepsFor(kind, way) {
  if (way === 'local') return [STEP('agent'), STEP('assemble')]; // 내 PC의 에이전트가 사이트 전체를 파일로 씀 → 앱은 조립·검수만
  // way 'demo'(먼저 해보기)는 'key'와 같은 단계(어댑터만 미리 만든 답을 흘려보냄)
  if (kind === 'make') return [STEP('build'), STEP('assemble')];
  if (kind === 'edit') return [STEP('edit'), STEP('assemble')];
  if (kind === 'fix') return [STEP('fix'), STEP('assemble')];
  return [];
}

/** 화면에 보일 상태(약속 §15 useGeneration 꼴) */
export function viewOf(rec, { elsewhere = false } = {}) {
  if (!rec) return { status: 'idle', step: null, steps: [], startedAt: 0, error: null };
  const total = rec.steps.length;
  const i = Math.max(0, rec.steps.findIndex((s) => s.status !== 'done'));
  const cur = rec.status === 'done' ? rec.steps[total - 1] : rec.steps[i];
  const status = rec.status === 'running' ? 'running' : rec.status === 'done' ? 'done' : rec.status === 'error' ? 'error' : 'paused';
  const L = live.get(rec.pid);
  return {
    status, jobId: rec.id, kind: rec.kind, way: rec.way, provider: rec.provider, model: rec.model, agent: rec.agent || '',
    // index: 지금 단계 번호(1부터, 다 끝나면 total)
    step: cur ? { name: cur.name, label_ko: cur.label || P.stepLabel(cur.name), index: rec.status === 'done' ? total : i + 1, total, received: (cur.acc?.length || 0) + (cur.piece?.length || 0) } : null,
    steps: rec.steps.map((s) => ({ name: s.name, label_ko: s.label || P.stepLabel(s.name), status: s.status, attempts: s.attempts })),
    startedAt: rec.startedAt, updatedAt: rec.updatedAt, endedAt: status === 'running' ? 0 : rec.updatedAt || 0,
    error: status === 'error' || status === 'paused' ? rec.error || null : null,
    wait: L?.wait || null, // { reason: 'quota'|'retry'|'hidden'|'offline', until }
    notes: rec.notes || [], elsewhere,
    preview: rec.status === 'done' && rec.site ? { site: rec.site } : undefined,
  };
}

// ── 오류 → 안내 ──
const RETRY = ['network', 'busy', 'stall', 'empty'];
const QUOTA = ['quota'];
// 이 모델만 안 되는 오류: 같은 키의 다른 모델로 이어서(앞 단계 결과는 그대로). 결제·권한·지역 같은 계정 오류는 모델을 바꿔도 같아 바꾸지 않음
const SWAP = ['no-access', 'model', 'quota-day'];
const ACCOUNT = ['billing', 'forbidden', 'region'];
const USAGE_URL = 'https://chatgpt.com/settings/usage';
function errorView(e, provider) {
  const k = e?.off && (e?.kind === 'network' || e?.kind === 'local') ? 'pc-off' : e?.kind;
  // 구독 연결(PC 프로그램): 꺼짐·ChatGPT 계정
  if (k === 'pc-off') return { kind: k, title: 'lecpage 커넥트가 꺼져 있어요.', body: 'lecpage 커넥트를 켜고 [계속 만들기]를 눌러 주세요. 받은 글은 그대로 이어서 써요.', actions: ['resume'] };
  if (k === 'chatgpt-login') return { kind: k, title: 'ChatGPT 계정 연결이 풀렸어요.', body: 'AI 선택에서 [ChatGPT 계정으로 로그인]을 다시 누르면 하던 단계부터 이어서 만들어요.', actions: ['connect', 'resume'] };
  if (k === 'chatgpt-plan') return { kind: k, title: '이 ChatGPT 계정으로는 쓸 수 없어요.', body: 'ChatGPT Plus·Pro 요금제에서 쓸 수 있어요. 다른 AI를 고르거나 요금제를 바꾼 뒤 다시 로그인해 주세요.', actions: ['connect'] };
  if (k === 'chatgpt-limit') return { kind: k, title: 'ChatGPT 사용 한도에 닿았어요.', body: '한도가 다시 차면 [계속 만들기]를 눌러 주세요. 받은 글은 그대로 이어서 써요. 사용량은 ChatGPT 설정에서 볼 수 있어요.', actions: ['link', 'resume'], link: { href: USAGE_URL, label: 'ChatGPT 사용량 보기' } };
  if (k === 'stall') return { kind: k, title: 'AI 답이 오래 멈췄어요.', body: '몇 번 다시 해 봤지만 이어지지 않았어요. 인터넷 연결을 확인하고 [계속 만들기]를 눌러 주세요.', actions: ['resume', 'connect'] };
  if (k === 'format') return { kind: k, title: 'AI 답에서 사이트를 꺼내지 못했어요.', body: '다시 해 보거나 다른 모델을 골라 주세요.', actions: ['resume', 'connect'] };
  if (k === 'thinking') return { kind: k, title: 'AI가 생각하다가 답을 쓸 한도를 다 썼어요.', body: '같은 요청을 다시 보내면 비용만 들어서 멈췄어요. 다른 모델이나 다른 AI를 골라 주세요.', actions: ['connect', 'resume'] };
  if (k === 'no-ai') return { kind: k, title: 'AI가 연결되어 있지 않아요.', body: 'AI를 연결한 뒤 [계속 만들기]를 눌러 주세요.', actions: ['connect'] };
  if (k === 'no-key') return { kind: k, title: '키를 다시 넣어 주세요.', body: '새로 고침하면 이 기기에 저장하지 않은 키는 지워져요. 키를 다시 넣으면 하던 단계부터 이어서 만들어요.', actions: ['connect'] };
  if (k === 'no-material') return { kind: k, title: '교재가 없어요.', body: '교재 파일을 넣거나 만들 사이트를 글로 적어 주세요.', actions: [] };
  if (k === 'no-site') return { kind: k, title: '고칠 사이트가 없어요.', body: '먼저 사이트를 만들어 주세요.', actions: [] };
  if (k === 'local') return { kind: k, title: '내 PC의 lecpage 커넥트에 닿지 못했어요.', body: 'lecpage 커넥트가 켜져 있는지, lecpage 커넥트가 연 주소(127.0.0.1)에서 앱을 열었는지 확인해 주세요. API 키로도 만들 수 있어요.', actions: ['resume', 'connect'] };
  if (k === 'gone') return { kind: k, title: '내 PC에서 하던 일을 찾지 못했어요.', body: 'lecpage 커넥트를 다시 켰다면 처음부터 다시 만들어 주세요.', actions: ['connect'] };
  if (k === 'too-long') return { kind: k, title: '교재가 길어 한 번에 보내지 못했어요.', body: '쪽 그림을 줄여 다시 보내 봤지만 넘쳤어요. 교재를 나눠 넣거나 다른 AI로 만들어 주세요.', actions: ['connect'] };
  const x = explainError(e, provider);
  // 다시 눌러도 같은 답이 오는 오류(키·결제·권한·지역·한도·모델·차단)는 [이어서 만들기]를 맨 뒤로: 주 단추가 같은 실패를 되풀이하지 않게.
  const acts = x.actions.filter((a) => a !== 'pay' && a !== 'light');
  return { kind: x.kind, title: x.title, body: x.body, actions: SAME_AGAIN.includes(x.kind) ? [...acts, 'resume'] : ['resume', ...acts], link: x.link || null };
}
const SAME_AGAIN = ['bad-key', 'billing', 'verify', 'forbidden', 'no-browser', 'workspace', 'region', 'cap', 'quota-day', 'no-access', 'model', 'blocked'];

// ── AI 한 번 부르기(이어서·이어 받기·다시 하기 포함) ──
/**
 * 한 단계의 AI 답 받기. step에 받는 중 글(acc·piece·cont·token)을 저장해 새로 고침 뒤에도 이어 감.
 * isCut(text): 끝이 덜 됐는지(단계마다 다름). 돌려줌: 다 받은 글
 */
async function askStep(ctx, step, { prompt, maxTokens, json = false, isCut = () => false }) {
  const { rec, signal } = ctx;
  const A = adapter(rec.provider);
  let acc = step.acc || ''; let piece = step.piece || ''; let cont = !!step.cont; let token = step.token || null;
  // 새로 고침 뒤: OpenAI는 이어 받기, 그 밖은 받은 글이 넉넉하면 '이어서'
  if (!token && piece) { acc = cont ? stitch(acc, piece) : piece; piece = ''; cont = false; }
  let continues = step.continues || 0; let waits = 0; let resumes = 0; let swaps = 0; let bigger = 0;
  const persist = () => { Object.assign(step, { acc, piece, cont, token, continues }); saveSoon(rec); };
  const d = busyDetour;
  if (d && d.provider === rec.provider && d.from.has(rec.model) && Date.now() - d.at < 15 * 60e3 && d.to !== rec.model) {
    rec.notes = [...(rec.notes || []), `${rec.model} 모델이 붐벼서 ${d.to} 모델로 했어요.`]; rec.model = d.to; await save(rec, { quiet: true });
  }
  for (;;) {
    // 받은 글에 이어서: 한도에 닿아 잘렸으면 늘, 끊겼으면 받은 글이 넉넉할 때만(짧으면 처음부터가 더 깔끔)
    const continueFrom = !token && acc && (step.wantCont || acc.length >= (hook().minContinue || 1200)) ? acc : '';
    if (!token && !continueFrom) acc = '';
    if (!token) cont = !!continueFrom; // 이어 받는 중이면 그 답이 '이어서' 요청이었는지 그대로
    const key = ctx.key;
    try {
      const res = await A.stream({
        step: { name: step.name, batch: step.batch }, // 먼저 해보기 어댑터만 씀(어느 단계의 답인지)
        key, model: rec.model, system: P.SYSTEM_GEN, parts: [...ctx.pack.parts, { kind: 'text', text: prompt }], maxTokens: bigger ? maxTokens * 2 : maxTokens, signal, json,
        continueFrom, resumeToken: token, prefix: token ? piece : '',
        onText: (t, all) => { piece = all; persist(); },
        onToken: (tk) => { token = { id: tk.id, seq: tk.seq }; piece = tk.text; oa.track(rec, tk.id); persist(); },
      });
      // 바꾼 모델로 답을 받음 → 이 키는 무료 키(안 된 모델은 '유료 키 필요'로): 다음 만들기는 되는 모델로 바로 시작하고 고르는 칸도 맞게
      if (ctx.swapped) {
        ctx.swapped = ''; ctx.swapFrom = '';
        const perm = ctx.permFailed || []; const busy = ctx.busyFailed || [];
        // 이 키로 아예 못 쓰는 모델(무료 키에 유료 전용 등)은 기억 → 다음 만들기는 되는 모델로 시작. 붐빈 모델은 잠깐 피하기만(기본 모델로는 붐볐던 그 모델을 둠: 이 키로 되는 모델이라서)
        if (perm.length) rememberWorkingModel(rec.provider, busy[0] || rec.model, perm).catch(() => { });
        if (busy.length) busyDetour = { provider: rec.provider, from: new Set(busy), to: rec.model, at: Date.now() };
        ctx.permFailed = []; ctx.busyFailed = [];
      }
      // 보이는 글 없이 한도에 닿음(생각하는 데 한도를 다 씀): '이어서'할 글이 없어 같은 요청을 되풀이하게 되고, 그러면 비용만 듦
      // (예전: 같은 요청 4번 + 형식 오류로 단계 다시 4번 = 8번). → 한도를 두 배로 한 번만 다시, 그래도 비면 멈추고 다른 모델·AI 창을 권함
      if (res.stop === 'max_tokens' && !String(res.text || '').trim()) {
        piece = ''; token = null;
        if (bigger) throw new AiError('thinking', 'max tokens with no visible text', { provider: rec.provider });
        bigger = 1; step.attempts++; persist(); continue;
      }
      oa.settled(rec, res.resumeToken?.id); // 다 받은 답은 어댑터가 OpenAI 쪽에서 지움
      const got = res.text; const before = acc.length;
      acc = cont ? stitch(acc, got) : got; piece = ''; token = null; cont = false;
      step.usage = res.usage || step.usage;
      // 잘림: 한도에 닿았으면(max_tokens) 세 번까지 '이어서'. 스스로 끝냈는데 덜 돼 보이면 한 번만(늘어났을 때)
      const grew = acc.length > before;
      if ((res.stop === 'max_tokens' && continues < 3) || (res.stop !== 'max_tokens' && isCut(acc) && grew && !step.cutTry)) {
        if (res.stop !== 'max_tokens') step.cutTry = true;
        step.wantCont = true; continues++; persist(); await save(rec, { quiet: true }); continue;
      }
      step.cutTry = false; step.wantCont = false;
      Object.assign(step, { acc: '', piece: '', cont: false, token: null, continues: 0 });
      return acc;
    } catch (e) {
      if (e?.name === 'AbortError' || signal?.aborted) { persist(); throw e; }
      if (!(e instanceof AiError)) throw e;
      // OpenAI: 서버에서 계속 도는 답을 이어 받음(횟수 넉넉히, 기다림 짧게)
      if (e.resumeToken && !e.resumeFailed && RETRY.includes(e.kind) && resumes < 8) {
        token = e.resumeToken; piece = e.partial || piece; resumes++; persist();
        if (hidden()) await waitVisible(ctx);
        else await pause(ctx, Math.min(8000, 1000 * resumes), 'retry');
        continue;
      }
      oa.failed(rec, e); // OpenAI: 끝난 답(실패·거절)·이어 받기를 포기한 답은 OpenAI 쪽 저장에서 지움(gen/oa-trash.js)
      if (e.resumeFailed) token = null; // 이어 받을 답이 없음(지워졌거나 만료) → 받은 글로 '이어서'나 처음부터
      // 이번에 받은 글(이어서·처음)을 쌓아 둠 → 다음 요청은 '이어서'
      if (e.partial && !token) { acc = cont ? stitch(acc, e.partial) : e.partial; piece = ''; cont = false; }
      if (e.resumeFailed) { step.attempts++; persist(); if (step.attempts > (hook().maxAttempts || 4)) throw e; continue; }
      if (RETRY.includes(e.kind)) {
        if (hidden()) { persist(); await waitVisible(ctx); continue; } // 가려진 탭에서 끊김: 횟수를 쓰지 않음
        step.attempts++; persist();
        // 모델이 몇 분씩 붐빌 때(503·529)가 있음 → 두 번 붐비면 같은 키의 다른 모델로(앞 단계 결과는 그대로)
        if (e.kind === 'busy' && step.attempts >= 2 && swaps < 2) {
          const next = await nextModel(ctx).catch(() => null);
          if (next) { swaps++; ctx.swapFrom = ctx.swapFrom || rec.model; ctx.swapped = 'busy'; ctx.busyFailed = [...(ctx.busyFailed || []), rec.model]; rec.notes = [...(rec.notes || []), `${rec.model} 모델이 붐벼서 ${next} 모델로 이어서 했어요.`]; rec.model = next; await save(rec); continue; }
        }
        if (step.attempts > (hook().maxAttempts || 4)) throw e;
        await pause(ctx, [2000, 6000, 15000, 30000][Math.min(3, step.attempts - 1)] * (hook().backoff ?? 1), 'retry');
        continue;
      }
      if (QUOTA.includes(e.kind) && waits < 4) {
        waits++; step.attempts++;
        const sec = Math.min(120, Math.max(3, e.retryAfter || [10, 30, 60, 90][waits - 1]));
        persist(); await pause(ctx, sec * 1000 * (hook().backoff ?? 1), 'quota');
        continue;
      }
      if (e.kind === 'too-long' && ctx.level < 2) { ctx.level++; rec.level = ctx.level; await repack(ctx); acc = ''; piece = ''; token = null; continue; }
      // 이 모델만 안 됨(없어진 모델·이 키로 못 쓰는 모델·오늘 이 모델의 한도): 같은 키의 다른 모델로(앞 단계 결과는 그대로). 오류 답은 돈이 들지 않음
      // 바꾼 모델에서 계정 오류(결제·권한·지역)가 오면 모델 탓이 아님 → 처음 모델로 되돌리고 그 안내를 보임
      if (ctx.swapFrom && ACCOUNT.includes(e.kind)) {
        rec.model = ctx.swapFrom; rec.notes = (rec.notes || []).filter((n) => !n.startsWith('이 키로 쓸 수 없는 모델')); ctx.swapFrom = ''; ctx.swapped = ''; await save(rec);
        throw e;
      }
      if (SWAP.includes(e.kind)) {
        const next = swaps < 2 ? await nextModel(ctx).catch(() => null) : null;
        if (next) { swaps++; ctx.swapFrom = ctx.swapFrom || rec.model; ctx.swapped = e.kind; if (e.kind !== 'model' && e.kind !== 'quota-day') ctx.permFailed = [...(ctx.permFailed || []), rec.model]; rec.notes = [...(rec.notes || []), `이 키로 쓸 수 없는 모델(${rec.model})이라 ${next} 모델로 이어서 했어요.`]; rec.model = next; await save(rec); continue; }
      }
      throw e;
    }
  }
}
async function pause(ctx, ms, reason) {
  const L = live.get(ctx.rec.pid); if (L) { L.wait = { reason, until: Date.now() + ms }; emit(ctx.rec.pid); }
  try { await sleep(ms, ctx.signal); } finally { if (L) { L.wait = null; emit(ctx.rec.pid); } }
}
async function waitVisible(ctx) {
  const L = live.get(ctx.rec.pid); if (L) { L.wait = { reason: 'hidden', until: 0 }; emit(ctx.rec.pid); }
  try { await whenVisible(ctx.signal); } finally { if (L) { L.wait = null; emit(ctx.rec.pid); } }
}
async function nextModel(ctx) {
  const tried = new Set([...(ctx.tried || []), ctx.rec.model]); ctx.tried = tried;
  const list = ctx.rec.provider === 'chatgpt' ? await chatgptModels() : await listModels(ctx.rec.provider, ctx.key, {});
  return (list.find((m) => !m.locked && !tried.has(m.id)) || {}).id || null;
}
async function repack(ctx) {
  ctx.pack = await packMaterial(ctx.rec.pid, ctx.project, { provider: ctx.rec.provider, model: ctx.rec.model, level: ctx.level, siteImages: ctx.images.list, siteImagesFrom: ctx.images.from, intro: P.buildMaterialPrompt });
  if (ctx.pack.notes.length) rec2notes(ctx.rec, ctx.pack.notes);
}
function rec2notes(rec, notes) { rec.notes = [...new Set([...(rec.notes || []), ...notes])].slice(-12); }

// ── 단계 실행 ──
const formatError = () => new AiError('format', 'format');

function infoOf(p) {
  const i = p.info || {}; const keep = {};
  for (const k of ['title', 'subtitle', 'date', 'start', 'end', 'venue', 'organizer']) if (i[k] && !(p.autoFilled && p.autoFilled[k] === i[k])) keep[k] = i[k];
  return keep; // 교재에서 저절로 채운 값(코드 추측)은 빼고 강사가 직접 적은 값만
}
/** 사이트의 CSS 전부(CSS 파일 + 쪽 안 <style>): 강의 기능 색(--lp-*)을 읽을 때 */
export function allCss(site = {}) {
  const parts = [];
  for (const [k, v] of Object.entries(site)) {
    if (typeof v !== 'string') continue;
    if (/\.css$/i.test(k)) parts.push(v);
    else if (/\.html?$/i.test(k)) for (const m of v.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) parts.push(m[1]);
  }
  return parts.join('\n');
}
/** AI가 답 끝에 준 연수 정보(교재에서 찾은 것) → 연수 정보. 제목이 없으면 <title> */
function metaOf(raw, site, prev) {
  const r = raw && typeof raw === 'object' ? { ...raw } : {};
  if (!r.title) r.title = ((/<title>([^<]*)<\/title>/i.exec(site['index.html'] || '') || [])[1] || '').trim();
  return readMeta({ v: 2, ...r, theme: { ...(r.theme || {}), ...themeFromCss(allCss(site)) } }, { prev }).meta;
}
/** 다 받지 못한 파일 살리기(이어서도 끝나지 않았을 때): HTML은 덜 닫힌 태그를 닫고, CSS는 마지막 온전한 규칙까지 */
const salvage = (path, v) => (/\.html?$/i.test(path) ? balance(v) : /\.css$/i.test(path) && cssCut(v) ? trimCss(v) : v);
/** 답의 파일 중 사이트에 넣을 수 있는 것만(엔진 kit/paths.js 규칙: SVG 파일·엔진 파일 이름·숨김 파일 빼기) */
function siteFiles(a, rec) {
  const out = {}; const dropped = [];
  for (const [k, v] of Object.entries(a.files)) { if (siteFileOk(k)) out[k] = a.cut ? salvage(k, v) : v; else dropped.push(k); }
  if (dropped.length) rec2notes(rec, [`사이트에 넣을 수 없는 파일을 뺐어요: ${dropped.slice(0, 6).join(', ')}`]);
  if (a.cut) rec2notes(rec, ['AI 답이 끝까지 오지 않아 받은 데까지 썼어요. 미리보기로 확인해 주세요.']);
  return out;
}

/** 새로 만들기: 교재 원본 + 짧은 요청 하나 → AI가 사이트 전체(파일마다 코드 블록)와 끝의 연수 정보를 한 답으로 */
async function runBuild(ctx, step) {
  const { rec, project } = ctx;
  const text = await askStep(ctx, step, {
    prompt: P.buildBuildPrompt({ request: rec.opts.request, reference: rec.opts.reference, info: infoOf(project) }),
    maxTokens: 64000, isCut: (t) => parseSiteAnswer(t).cut,
  });
  const a = parseSiteAnswer(text);
  const site = siteFiles(a, rec);
  if (!site['index.html']) throw formatError();
  rec.site = site;
  rec.meta = metaOf(a.meta, site, project.meta);
  step.output = { files: Object.keys(site), cut: a.cut, meta: !!a.meta };
}

/**
 * 조립(엔진 키트, 미리보기·연습 모드) + 정적 검수(AI가 쓴 폴더 기준) + 숨은 틀에서 그려서 검수(1280·390).
 * issue마다 key(같은 종류가 여럿일 때 하나를 가리킴: id|파일|선택자|섹션|폭)를 붙임
 */
export async function inspectSite(pid, site, meta, project = null) {
  const a = await assembleSite(pid, site, meta, { project });
  const issues = inspect({ ...a.material, ...(site || {}) }, meta);
  for (const w of [...(a.errors || []), ...(a.warnings || [])]) if (!issues.some((x) => x.id === w.code)) issues.push({ id: 'assemble-' + w.code, level: (a.errors || []).includes(w) ? 'error' : 'warn', where: { file: '', selector: '', section: '' }, message_ko: w.message_ko, fix_hint_ko: '' });
  issues.push(...await extraIssues(pid, a.files, site, meta, project)); // 바로 배포 거절 규칙 미리 보기(gen/checks.js)
  let rendered = [];
  if (!hook().noRender && a.files && a.files['index.html']) { try { rendered = await renderIssues(a.files); } catch { rendered = []; } }
  const seen = new Set(); const out = [];
  for (const i of [...issues, ...rendered]) {
    const key = [i.id, i.where?.file || '', i.where?.selector || '', i.where?.section || '', i.where?.width || ''].join('|');
    if (seen.has(key) || out.some((x) => x.message_ko === i.message_ko && !i.where?.width)) continue;
    seen.add(key); out.push({ ...i, key });
  }
  return { issues: out, warnings: a.warnings || [], collected: a.collected || null };
}

/** 조립 + 검수. 결과는 강사에게 참고로만 보임(고치기는 강사가 고를 때만) */
async function runAssemble(ctx, step) {
  const rec = ctx.rec;
  if (!rec.site) { rec.site = ctx.project.site || null; rec.meta = rec.meta || ctx.project.meta || null; }
  if (!rec.site?.['index.html']) throw new AiError('no-site', 'no site');
  const { issues } = await inspectSite(rec.pid, rec.site, rec.meta, ctx.project);
  step.output = { issues };
}

/**
 * 고친 파일 하나 받기. 문서였던 쪽에 문서가 아닌 조각(<section …>)만 오면 그 섹션만 갈아 끼움,
 * 긴 CSS 대신 아주 짧은 CSS가 오면(바뀐 규칙만 보낸 것) 뒤에 덧붙임
 */
export function mergeFile(path, cur, next) {
  if (typeof cur !== 'string' || !cur) return next;
  if (/\.html?$/i.test(path) && /<!doctype|<html[\s>]/i.test(cur) && !/<!doctype|<html[\s>]/i.test(next)) {
    const secs = extractSections(next).filter((s) => s.id && s.complete);
    return secs.length ? replaceSections(cur, secs).html : cur;
  }
  if (/\.css$/i.test(path) && cur.length > 3000 && next.length < cur.length * 0.4) return `${cur}\n\n/* 고친 규칙 */\n${next}`;
  return next;
}

/** 고치기(수정 요청·[AI에게 고쳐 달라기]): 지금 사이트 전체 + 요청 → AI가 바뀐 파일만(파일 전체) */
async function runEdit(ctx, step) {
  const rec = ctx.rec;
  const site = rec.site || ctx.project.site;
  if (!site?.['index.html']) throw new AiError('no-site', 'no site');
  const fix = rec.kind === 'fix';
  const request = fix ? P.fixRequest(issuesForAi(step.issues || [])) : rec.opts.request;
  const text = await askStep(ctx, step, {
    prompt: P.buildEditPrompt({ request, target: fix ? '' : rec.opts.target, site, meta: rec.meta || ctx.project.meta }),
    maxTokens: 64000, isCut: (t) => parseSiteAnswer(t).cut,
  });
  const a = parseSiteAnswer(text);
  const got = siteFiles(a, rec);
  const files = {};
  for (const [k, v] of Object.entries(got)) files[k] = mergeFile(k, site[k], v);
  if (!Object.keys(files).length && !a.meta) throw formatError();
  rec.site = { ...site, ...files };
  const metaPatch = a.meta && typeof a.meta === 'object' ? a.meta : null;
  rec.delta = { files, metaPatch };
  const prev = rec.meta || ctx.project.meta || {};
  const theme = { ...(prev.theme || {}), ...themeFromCss(allCss(rec.site)) };
  rec.meta = metaPatch ? readMeta({ ...prev, ...metaPatch, theme: { ...theme, ...(metaPatch.theme || {}) } }, { prev }).meta : { ...prev, theme };
  step.output = { changed: Object.keys(files), meta: !!metaPatch };
}

/** 내 PC의 Claude Code·Codex(연결 프로그램)에게 맡김: 사이트 파일 전체를 받아 옴(그림은 blobs 'site/…') */
async function runAgent(ctx, step) {
  const { rec, project } = ctx;
  const request = rec.kind === 'fix' ? `lecpage 검수에서 나온 문제를 고쳐 주세요.\n${issuesForAi(step.issues || [])}` : rec.opts.request;
  // 교재 원본은 files로, 사이트 폴더(새로 만들 때는 교재 쪽 그림, 고칠 때는 지금 사이트 전체)는 site로(연결 프로그램이 work/site/에 그대로 둠)
  const pack = async () => ({
    files: await bridgeFiles(blobs, rec.pid, project),
    site: { ...(await bridgeSite(blobs, rec.pid, rec.kind === 'make' ? (ctx.images?.list || []) : null)), ...(rec.kind !== 'make' ? rec.site || project.site || {} : {}) },
  });
  const payload = {
    agent: rec.agent || 'claude', kind: rec.kind === 'make' ? 'make' : 'edit', request, meta: project.meta || {}, reference: rec.opts.reference || null,
    ...(rec.kind === 'edit' && rec.opts.target && rec.opts.target !== 'all' ? { target: rec.opts.target } : {}),
    ...(step.bridgeJob ? { files: [] } : await pack()),
  };
  const run = (jobId) => runBridgeJob({
    payload, jobId, signal: ctx.signal,
    onJobId: (id) => { step.bridgeJob = id; save(rec).catch(() => { }); },
    onStep: (label) => { step.label = label; save(rec, { quiet: true }).catch(() => { }); },
    onLog: (t) => { step.log = String(t).slice(-300); saveSoon(rec); },
  });
  let res;
  try { res = await run(step.bridgeJob || ''); } catch (e) {
    // 연결 프로그램을 다시 켜서 하던 일이 없어짐 → 처음부터 한 번 더
    if (e?.kind !== 'gone' || !step.bridgeJob) throw e;
    step.bridgeJob = ''; Object.assign(payload, await pack());
    res = await run('');
  }
  // 글 파일은 사이트(p.site)로, 그림·PDF 같은 바이트 파일은 저장소 'site/…'로(교재 쪽 그림은 이미 있음)
  const site = {};
  for (const [k, v] of Object.entries(res.site || {})) {
    const path = String(k).replace(/^\.?\/+/, '').replace(/^site\//, '');
    if (typeof v === 'string' && !/\.(png|jpe?g|webp|gif|avif|pdf)$/i.test(path)) site[path] = v;
    else if (!path.startsWith('material/') || !(ctx.images?.list || []).includes(path)) await blobs.put(rec.pid, 'site/' + path, decodeBinary(v));
  }
  if (!site['index.html']) throw new AiError('format', 'no index');
  rec.site = site;
  rec.meta = readMeta({ ...(res.meta || {}), theme: { ...(res.meta?.theme || {}), ...themeFromCss(site['assets/style.css'] || '') } }, { prev: project.meta || null }).meta;
  step.output = { agentIssues: res.issues.length };
  step.bridgeJob = '';
}

const RUN = { build: runBuild, assemble: runAssemble, fix: runEdit, edit: runEdit, agent: runAgent };

/** 끝: 연수에 site·meta·versions·gen 저장 */
async function finish(ctx) {
  const rec = ctx.rec;
  const at = Date.now();
  const issues = rec.steps.filter((s) => s.name === 'assemble').pop()?.output?.issues || [];
  // 수정·고치기: 그동안 강사가 다른 파일을 고쳤을 수 있어 지금 사이트에 AI가 바꾼 파일만 얹음
  const merged = (cur) => {
    if (rec.kind === 'make' || !rec.delta || !cur.site?.['index.html']) return { site: rec.site, meta: rec.meta };
    const d = rec.delta;
    const site = { ...cur.site, ...(d.files || {}) };
    const prev = cur.meta || {};
    const theme = { ...(prev.theme || {}), ...themeFromCss(allCss(site)) };
    const meta = d.metaPatch ? readMeta({ ...prev, ...d.metaPatch, theme: { ...theme, ...(d.metaPatch.theme || {}) } }, { prev }).meta : { ...prev, theme };
    return { site, meta };
  };
  let out = null;
  const saved = await projects.patch(rec.pid, (cur) => { out = settle(cur, merged(cur)); const versions = versionsAfter(cur, rec.kind, out, rec.opts?.request); return {
    v: 2, site: out.site, meta: out.meta,
    gen: { jobId: rec.id, status: 'done', way: rec.way, provider: rec.provider, model: rec.model, agent: rec.agent || '', at, kind: rec.kind },
    versions,
    ...(rec.kind !== 'make' ? { chat: replyChat(cur, rec.kind, rec.way, out, versions) } : {}),
    inspect: { at, issues },
    ...(rec.kind === 'make' ? { notes: rec.notes?.length ? rec.notes : undefined, metaChecked: false } : {}),
    ...(cur.stage === 1 || !cur.stage ? { stage: 2 } : {}),
  }; });
  if (out) { rec.site = out.site; rec.meta = out.meta; }
  if (!saved) throw new AiError('other', '연수를 찾지 못했어요. 처음 화면에서 연수를 다시 열어 주세요.');
  notifySaved(rec.pid, saved.updatedAt);
}
/**
 * 저장하기 직전 마무리: 이름표(id) 없는 섹션에 붙이고(목록·수정 요청이 가리킬 수 있게),
 * 예전 방식(설계도) 연수였으면 그 배포 연결(참여 기능 방·공개 범위·짧은 주소)을 새 연수 정보로 옮김
 */
export function settle(cur, { site, meta }) {
  const html = ensureIds(site?.['index.html'] || '');
  const s = html && html !== site['index.html'] ? { ...site, 'index.html': html } : site;
  return { site: s, meta: cur.blueprint ? carryLegacy({ ...cur, meta }).meta || meta : meta };
}
/**
 * 버전 기록(lib/versions.js, 최근 20개, 새것이 앞): AI가 만들거나 고친 뒤의 사이트를 맨 위에. 지금 사이트가 기록에 없으면 먼저 '이전 상태'로 남김.
 * 직접 수정·연수 정보 수정·복원은 화면(Studio)이 같은 함수로 남김
 */
export function versionsAfter(cur, kind, next, request = '') {
  return recordVersion(cur, next, { kind: kind === 'make' ? 'make' : kind === 'fix' ? 'fix' : 'ai', label: aiVersionLabel(kind, { request }) });
}
/** 고친 뒤 바뀐 곳: 섹션(id·이름) + 다른 쪽(.html) 파일 */
export function changedSections(a = {}, b = {}) {
  const before = new Map(extractSections(a['index.html'] || '').map((s) => [s.id || s.title, s.html]));
  const out = [];
  for (const s of extractSections(b['index.html'] || '')) { const k = s.id || s.title; if (before.get(k) !== s.html) out.push({ id: s.id || '', name: String(s.title || s.id || '').slice(0, 40) }); }
  for (const k of Object.keys(b)) if (k !== 'index.html' && /\.html?$/i.test(k) && a[k] !== b[k]) out.push({ id: '', name: k });
  return out.filter((x) => x.name);
}
/** AI가 고친 뒤 대화에 붙일 답(무엇을 했고 어디가 바뀌었는지, 그 결과 버전) */
export function replyChat(cur, kind, way, next, versions) {
  const css = (site) => Object.keys(site || {}).filter((k) => /\.css$/i.test(k)).map((k) => site[k]).join('\n');
  return addChat(cur, aiReply({ kind, way, versionId: versions?.[0]?.id || '', changed: changedSections(cur.site || {}, next.site || {}), design: css(cur.site) !== css(next.site), meta: JSON.stringify(cur.meta?.sessions || null) !== JSON.stringify(next.meta?.sessions || null) || (cur.meta?.title || '') !== (next.meta?.title || '') }));
}
export function notifySaved(pid, at) {
  try { if (typeof dispatchEvent === 'function') dispatchEvent(new CustomEvent('lecpage:gen-saved', { detail: { pid, at } })); } catch { /* 알림만 못 함 */ }
}

/** 작업을 끝까지(또는 멈출 때까지) 돌림. 잠금 안에서 부름 */
async function drive(pid) {
  const L = live.get(pid);
  const rec = L.rec; const signal = L.ctrl.signal;
  markBusy(pid, true);
  const ctx = { rec, signal, level: rec.level || 0 };
  // Web Locks가 없는 브라우저: 기록의 심장 박동으로 다른 탭에 '도는 중'을 알림(기다리는 동안에도)
  const beat = hasLocks() ? 0 : setInterval(() => { if (Date.now() - lastBeat > 4000) save(rec, { quiet: true }).catch(() => { }); }, 5000);
  try {
    rec.status = 'running'; rec.error = null; await save(rec);
    const project = await projects.get(pid);
    if (!project) throw new AiError('other', '연수를 찾지 못했어요. 처음 화면에서 연수를 다시 열어 주세요.');
    ctx.project = project;
    if (rec.way === 'key') {
      const { key } = await loadKey(rec.provider);
      if (!key) throw new AiError('no-key', 'no key', { provider: rec.provider });
      ctx.key = key;
      if (rec.provider === 'openai') oa.flush(key).catch(() => { }); // 지난번에 지우지 못한 답(키가 없었을 때)을 지움
      if (!rec.model) { rec.model = (await checkKey(rec.provider, key, { signal })).model; await save(rec); }
    }
    if (rec.way === 'chatgpt') { // ChatGPT 계정: 토큰은 PC 프로그램에. 모델은 그 계정의 목록 첫째(서버 순서)
      ctx.key = '';
      if (!rec.model) { const list = await chatgptModels(); if (!list.length) throw new AiError('chatgpt-login', 'no models', { provider: 'chatgpt' }); rec.model = list[0].id; await save(rec); }
    }
    // 학교망이 AI 회사를 막았으면 오래 기다리지 않게(처음 시작할 때만, 시험 주소면 건너뜀)
    if (rec.way === 'key' && !rec.steps.some((s) => s.status === 'done') && baseFor(rec.provider) === BASES[rec.provider] && await reach('ai:' + rec.provider) === 'blocked') throw new AiError('blocked', 'blocked', { provider: rec.provider });
    // 교재도 요청 글도 없으면 AI가 지어낼 것밖에 없음 → 교재를 먼저
    if (rec.kind === 'make' && !sourceFiles(project).length && !project.material && !String(rec.opts.request || '').trim()) throw new AiError('no-material', 'no material');
    // 새로 만들기의 첫 단계에서만 지금 교재의 쪽 그림으로 다시 옮김(이어 하기·고치기는 있던 것 그대로)
    ctx.images = await preparePageImages(pid, project, { signal, refresh: rec.kind === 'make' && !rec.steps.some((s) => s.status === 'done') });
    if (rec.way === 'key' || rec.way === 'chatgpt') await repack(ctx);
    else ctx.pack = { parts: [] }; // 내 PC 에이전트는 교재 파일을 따로 받고, 먼저 해보기는 어디로도 보내지 않음
    for (;;) {
      const step = rec.steps.find((s) => s.status !== 'done');
      if (!step) break;
      step.status = 'running'; step.startedAt = step.startedAt || Date.now(); step.error = null; await save(rec);
      const fn = RUN[step.name];
      try { await fn(ctx, step); } catch (e) {
        if (e?.name === 'AbortError' || signal.aborted) throw e;
        // 형식 오류는 그 단계를 한 번 더(처음부터)
        if (e?.kind === 'format' && !step.formatRetry) { step.formatRetry = true; step.acc = ''; step.piece = ''; step.status = 'todo'; await save(rec); continue; }
        throw e;
      }
      step.status = 'done'; step.endedAt = Date.now(); await save(rec);
    }
    await finish(ctx);
    rec.status = 'done'; await save(rec);
  } catch (e) {
    if (e?.name === 'AbortError' || signal.aborted) {
      rec.status = 'paused'; rec.error = L.stopReason === 'user' ? { kind: 'stopped', title: '멈췄어요.', body: '[계속 만들기]를 누르면 멈춘 단계부터 이어서 만들어요.', actions: ['resume'] } : null;
      const step = rec.steps.find((s) => s.status === 'running'); if (step) step.status = 'todo';
      // 멈추기: OpenAI는 서버에서 도는 답을 취소하고 지움(받은 글은 남겨 이어서 만들기에서 '이어서'로 씀)
      if (L.stopReason === 'user') oa.release(rec, ctx.key);
      if (L.stopReason === 'user' && step?.bridgeJob) { cancelBridgeJob(step.bridgeJob); step.bridgeJob = ''; }
      await save(rec).catch(() => { });
      return;
    }
    console.error('[gen]', e);
    const step = rec.steps.find((s) => s.status === 'running');
    if (step) { step.status = 'error'; step.error = { kind: e?.kind || 'other', message: String(e?.message || '').slice(0, 300) }; }
    rec.status = 'error'; rec.error = errorView(e, rec.provider);
    // 실패로 멈춤: OpenAI에서 돌던 답은 취소하고 지움(받은 글은 기록에 남아 [이어서 만들기]가 '이어서'로 씀). 망 끊김은 돌아오면 그 답을 이어 받으므로 남김
    if (!['network', 'stall', 'blocked'].includes(e?.kind)) oa.release(rec);
    await save(rec).catch(() => { });
    // 망이 끊겨 멈췄으면 망이 돌아올 때 저절로 이어 함
    // (구독 연결인 ChatGPT 계정은 사람이 누를 때만 부름: 저절로 이어 하지 않음)
    if (['network', 'stall', 'blocked'].includes(e?.kind) && rec.way !== 'chatgpt') autoResume.add(pid);
  } finally {
    if (beat) clearInterval(beat);
    const cur = live.get(pid); if (cur?.saveT) { clearTimeout(cur.saveT); cur.saveT = 0; }
    if (cur) { cur.ctrl = null; cur.wait = null; }
    markBusy(pid, false);
    emit(pid);
  }
}

/** 작업 시작/이어 하기(잠금을 잡고 돌림). 다른 탭이 도는 중이면 { elsewhere: true } */
async function launch(pid, rec) {
  const ctrl = new AbortController();
  const prev = live.get(pid);
  if (prev?.ctrl) return { jobId: prev.rec.id, already: true };
  live.set(pid, { rec, ctrl, wait: null, saveT: 0, stopReason: '' });
  const got = await withLock(pid, () => drive(pid));
  if (!got) { live.delete(pid); remote.set(pid, await jobsDb.get(pid).catch(() => null)); emit(pid); return { jobId: (await jobsDb.get(pid).catch(() => null))?.id || '', elsewhere: true }; }
  return { jobId: rec.id, run: got.run };
}

const autoResume = new Set();
if (typeof addEventListener === 'function') {
  addEventListener('online', () => { for (const pid of [...autoResume]) { autoResume.delete(pid); resumeJob(pid).catch(() => { }); } });
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (hidden()) return; for (const pid of [...autoResume]) { autoResume.delete(pid); resumeJob(pid).catch(() => { }); } });
}

/**
 * 새 작업. kind: 'make'|'edit'|'fix'. opts: { way, provider, model, request, reference, target, issues }
 * @returns {Promise<{ jobId, elsewhere?, run? }>}
 */
export async function startJob(pid, kind, opts = {}) {
  if (live.get(pid)?.ctrl) return { jobId: live.get(pid).rec.id, already: true };
  if (await heldElsewhere(pid)) return { jobId: (await jobsDb.get(pid).catch(() => null))?.id || '', elsewhere: true };
  const way = ['local', 'demo', 'chatgpt'].includes(opts.way) ? opts.way : 'key';
  // 내 PC의 에이전트(agent: 'claude'|'codex')·먼저 해보기는 회사 자리에 그 길 이름
  let provider = way === 'key' ? opts.provider : way; let model = way === 'key' || way === 'chatgpt' ? opts.model || '' : '';
  const agent = way === 'local' ? (['claude', 'codex'].includes(opts.agent) ? opts.agent : 'claude') : '';
  // 고치기·수정 요청은 따로 고르지 않았으면 이 사이트를 만든 AI·모델로(키가 있을 때)
  if (!provider && kind !== 'make') {
    const g = (await projects.get(pid).catch(() => null))?.gen;
    if (g?.provider && g.way === 'key' && (await loadKey(g.provider)).key) { provider = g.provider; model = model || g.model || ''; }
  }
  if (!provider) {
    const ai = await getActiveAI();
    if (!ai) {
      const rec0 = newRec(pid, kind, { ...opts, provider: '', model: '' });
      rec0.status = 'error'; rec0.error = errorView({ kind: 'no-ai' }); await save(rec0); return { jobId: rec0.id };
    }
    provider = ai.provider; model = model || ai.model;
  }
  oa.release(await jobsDb.get(pid).catch(() => null)); // 새 작업이 기록을 덮어씀: 지난 작업의 OpenAI 답은 지움
  const rec = newRec(pid, kind, { ...opts, way, provider, model, agent });
  if (kind === 'fix') rec.steps[0].issues = opts.issues || [];
  if (kind !== 'make') { const p = await projects.get(pid); rec.site = p?.site || null; rec.meta = p?.meta || null; }
  autoResume.delete(pid);
  return launch(pid, rec);
}
function newRec(pid, kind, o) {
  return { pid, id: uid(10), kind, provider: o.provider || '', model: o.model || '', agent: o.agent || '', way: o.way || 'key', startedAt: Date.now(), status: 'running', level: 0, notes: [],
    opts: { request: o.request || '', reference: o.reference || null, target: o.target || 'all' }, steps: stepsFor(kind, o.way), site: null, meta: null, error: null };
}

/** 멈춘(새로 고침·오류·멈추기) 작업 이어 하기. change: { provider, model }로 모델을 바꿔도 앞 단계 결과는 그대로 */
export async function resumeJob(pid, change = {}) {
  if (live.get(pid)?.ctrl) return { jobId: live.get(pid).rec.id, already: true };
  const rec = await jobsDb.get(pid).catch(() => null);
  if (!rec || rec.status === 'done') return { jobId: rec?.id || '' };
  if (await heldElsewhere(pid)) return { jobId: rec.id, elsewhere: true };
  if (change.provider && change.provider !== rec.provider) {
    // 다른 회사로: 받는 중이던 글(이어 받기 지점)은 그 회사 것이라 버림
    for (const s of rec.steps) { s.token = null; s.piece = ''; if (s.status !== 'done') { s.acc = ''; s.continues = 0; } }
    rec.provider = change.provider; rec.model = change.model || '';
  } else if (change.model) rec.model = change.model;
  for (const s of rec.steps) if (s.status === 'error' || s.status === 'running') { s.status = 'todo'; s.attempts = 0; }
  autoResume.delete(pid);
  return launch(pid, rec);
}

/** 멈추기(받는 중인 글은 기록에 남아 이어서 만들기에 씀) */
export function stopJob(pid) {
  const L = live.get(pid);
  if (!L?.ctrl) { try { bc?.postMessage({ pid, cmd: 'stop' }); } catch { /* 알림만 못 함 */ } return false; }
  L.stopReason = 'user'; L.ctrl.abort(); autoResume.delete(pid);
  return true;
}

/** 멈춘·실패한 작업 기록을 지움(그만두기: 받은 글·이어 할 자리도 버림). 도는 중이면 하지 않음 */
export async function forgetJob(pid) {
  if (live.get(pid)?.ctrl) return false;
  const rec = await jobsDb.get(pid).catch(() => null);
  if (rec?.status === 'running' && await heldElsewhere(pid)) return false;
  oa.release(rec); // 그만두기: OpenAI 쪽에 남은 답도 지움
  await jobsDb.del(pid).catch(() => { });
  live.delete(pid); remote.delete(pid); autoResume.delete(pid);
  try { bc?.postMessage({ pid, id: rec?.id || '', at: Date.now() }); } catch { /* 알림만 못 함 */ }
  emit(pid);
  return true;
}

/** 새로 고침 뒤: 'running'인데 아무 탭도 돌리지 않는 작업이면(끊긴 것) 이어 함 */
export async function resumeIfOrphaned(pid) {
  if (live.get(pid)?.ctrl) return false;
  const rec = await jobsDb.get(pid).catch(() => null);
  if (!rec || rec.status !== 'running') return false;
  if (await heldElsewhere(pid)) { remote.set(pid, rec); emit(pid); return false; }
  // ChatGPT 계정(구독): 새로 고침 뒤 저절로 다시 부르지 않음 → 멈춘 상태로 두고 [계속 만들기]를 기다림(받은 글은 기록에 있음)
  if (rec.way === 'chatgpt') {
    for (const s of rec.steps) if (s.status === 'running') s.status = 'todo';
    rec.status = 'paused'; rec.error = { kind: 'stopped', title: '새로 고침해서 멈췄어요.', body: '[계속 만들기]를 누르면 받은 데부터 이어서 만들어요.', actions: ['resume'] };
    await save(rec).catch(() => { }); emit(pid); return false;
  }
  const r = await resumeJob(pid);
  return !!r.run;
}

/** useGeneration에서 쓰는 지금 상태 */
export async function currentView(pid) {
  const L = live.get(pid);
  if (L) return viewOf(L.rec);
  const rec = remote.get(pid) || await jobsDb.get(pid).catch(() => null);
  if (!rec) return viewOf(null);
  const elsewhere = rec.status === 'running' && await heldElsewhere(pid);
  return viewOf(rec, { elsewhere });
}
export function liveView(pid) { const L = live.get(pid); return L ? viewOf(L.rec) : null; }
export { PROVIDERS, TAB };
