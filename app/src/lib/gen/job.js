// AI 작업 실행기: 나눠 만들고, 단계마다 저장해, 끊겨도 그 자리부터 이어 합니다(docs/plan-ai-first.md §6, 약속 D).
// 단계: plan → design → sections:1..n → assemble(조립+검수) → fix(문제가 있으면 한 번) → 끝
// - 망·5xx·감시 끊김: 그 단계만 다시(받은 글이 넉넉하면 '이어서'로). OpenAI는 서버에서 계속 도는 답을 이어 받음(starting_after)
// - 한도(429): 알려 준 시간만큼 기다렸다 그 단계만 다시. 잘림: 같은 단계 안에서 '이어서'(세 번까지)
// - 받는 중인 글은 몇 초마다 기록에 저장 → 새로 고쳐도 그 글부터 이어 감(OpenAI는 응답 id·순번으로)
// - 같은 연수를 두 탭에서 동시에 돌리지 않음(Web Locks, 없으면 기록의 심장 박동)
// - 탭이 가려진 동안 끊기면 횟수를 쓰지 않고 기다렸다가, 탭이 돌아오면(또는 망이 돌아오면) 이어 함
import { getActiveAI, loadKey, explainError, checkKey, models as listModels, PROVIDERS } from '../ai.js';
import { projects, blobs } from '../db.js';
import { uid } from '../util.js';
import { reach } from '../netcheck.js';
import { jobsDb } from './store.js';
import { markBusy } from './busy.js';
import { adapter } from './providers/index.js';
import { AiError, BASES, baseFor } from './providers/common.js';
import { discard as openaiDiscard } from './providers/openai.js';
import { preparePageImages, packMaterial, sourceFiles } from './material.js';
import * as P from './prompts.js';
import { extractJson, extractCss, extractHtml, extractSections, mergeSections, replaceSections, stitch, balance, trimCss, cssCut, skeleton, SECTIONS_MARK } from './parse.js';
import { inspect, readMeta, themeFromCss, issuesForAi } from './kit.js';
import { assembleSite } from './preview.js';
import { renderIssues } from './render-check.js';
import { runBridgeJob, cancelBridgeJob, bridgeFiles, bridgeSite, decodeBinary } from './local.js';
import { pushVersion, carryLegacy } from '../site-meta.js';
import { ensureIds } from '../site-doc.js';

const TAB = uid(8);
const live = new Map(); // pid → { ctrl, rec, wait, elsewhere }
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
  if (kind === 'make') return [STEP('plan'), STEP('design'), STEP('assemble')];
  if (kind === 'edit') return [STEP('edit'), STEP('assemble')];
  if (kind === 'fix') return [STEP('fix'), STEP('assemble')];
  return [];
}
const sectionSteps = (rec) => rec.steps.filter((s) => s.name.startsWith('sections:')).length;

/** 화면에 보일 상태(약속 §15 useGeneration 꼴) */
export function viewOf(rec, { elsewhere = false } = {}) {
  if (!rec) return { status: 'idle', step: null, steps: [], startedAt: 0, error: null };
  const total = rec.steps.length;
  const i = Math.max(0, rec.steps.findIndex((s) => s.status !== 'done'));
  const cur = rec.status === 'done' ? rec.steps[total - 1] : rec.steps[i];
  const secTotal = sectionSteps(rec);
  const status = rec.status === 'running' ? 'running' : rec.status === 'done' ? 'done' : rec.status === 'error' ? 'error' : 'paused';
  const L = live.get(rec.pid);
  return {
    status, jobId: rec.id, kind: rec.kind, way: rec.way, provider: rec.provider, model: rec.model, agent: rec.agent || '',
    // index: 지금 단계 번호(1부터, 다 끝나면 total)
    step: cur ? { name: cur.name, label_ko: cur.label || P.stepLabel(cur.name, secTotal), index: rec.status === 'done' ? total : i + 1, total, received: (cur.acc?.length || 0) + (cur.piece?.length || 0) } : null,
    steps: rec.steps.map((s) => ({ name: s.name, label_ko: s.label || P.stepLabel(s.name, secTotal), status: s.status, attempts: s.attempts })),
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
function errorView(e, provider) {
  const k = e?.kind;
  if (k === 'stall') return { kind: k, title: 'AI 답이 오래 멈췄어요.', body: '몇 번 다시 해 봤지만 이어지지 않았어요. 인터넷 연결을 확인하고 [이어서 만들기]를 눌러 주세요.', actions: ['resume', 'paste'] };
  if (k === 'format') return { kind: k, title: 'AI 답에서 사이트를 꺼내지 못했어요.', body: '다시 해 보거나 다른 모델을 골라 주세요.', actions: ['resume', 'connect', 'paste'] };
  if (k === 'no-ai') return { kind: k, title: 'AI가 연결되어 있지 않아요.', body: '키를 연결한 뒤 [이어서 만들기]를 눌러 주세요.', actions: ['connect', 'paste'] };
  if (k === 'no-key') return { kind: k, title: '키를 다시 넣어 주세요.', body: '새로 고침하면 이 기기에 저장하지 않은 키는 지워져요. 키를 다시 넣으면 하던 단계부터 이어서 만들어요.', actions: ['connect', 'paste'] };
  if (k === 'no-material') return { kind: k, title: '교재가 없어요.', body: '교재 파일을 넣거나 만들 사이트를 글로 적어 주세요.', actions: [] };
  if (k === 'no-site') return { kind: k, title: '고칠 사이트가 없어요.', body: '먼저 사이트를 만들어 주세요.', actions: [] };
  if (k === 'local') return { kind: k, title: '내 PC의 연결 프로그램에 닿지 못했어요.', body: '연결 프로그램이 연 주소(127.0.0.1)에서 앱을 열었는지 확인해 주세요. API 키나 쓰던 AI 창으로도 만들 수 있어요.', actions: ['resume', 'connect', 'paste'] };
  if (k === 'gone') return { kind: k, title: '내 PC에서 하던 일을 찾지 못했어요.', body: '연결 프로그램을 다시 켰다면 처음부터 다시 만들어 주세요.', actions: ['connect', 'paste'] };
  if (k === 'too-long') return { kind: k, title: '교재가 길어 한 번에 보내지 못했어요.', body: '쪽 그림을 줄여 다시 보내 봤지만 넘쳤어요. 교재를 나눠 넣거나, 쓰던 AI 창에 교재를 첨부해 만들어 주세요.', actions: ['paste', 'connect'] };
  const x = explainError(e, provider);
  return { kind: x.kind, title: x.title, body: x.body, actions: ['resume', ...x.actions.filter((a) => a !== 'pay' && a !== 'light')], link: x.link || null };
}

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
  let continues = step.continues || 0; let waits = 0; let resumes = 0; let swaps = 0;
  const persist = () => { Object.assign(step, { acc, piece, cont, token, continues }); saveSoon(rec); };
  for (;;) {
    // 받은 글에 이어서: 한도에 닿아 잘렸으면 늘, 끊겼으면 받은 글이 넉넉할 때만(짧으면 처음부터가 더 깔끔)
    const continueFrom = !token && acc && (step.wantCont || acc.length >= (hook().minContinue || 1200)) ? acc : '';
    if (!token && !continueFrom) acc = '';
    if (!token) cont = !!continueFrom; // 이어 받는 중이면 그 답이 '이어서' 요청이었는지 그대로
    const key = ctx.key;
    try {
      const res = await A.stream({
        step: { name: step.name, batch: step.batch }, // 먼저 해보기 어댑터만 씀(어느 단계의 답인지)
        key, model: rec.model, system: P.SYSTEM_GEN, parts: [...ctx.pack.parts, { kind: 'text', text: prompt }], maxTokens, signal, json,
        continueFrom, resumeToken: token, prefix: token ? piece : '',
        onText: (t, all) => { piece = all; persist(); },
        onToken: (tk) => { token = { id: tk.id, seq: tk.seq }; piece = tk.text; persist(); },
      });
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
      if (e.resumeFailed) token = null; // 이어 받을 답이 없음(지워졌거나 만료) → 받은 글로 '이어서'나 처음부터
      // 이번에 받은 글(이어서·처음)을 쌓아 둠 → 다음 요청은 '이어서'
      if (e.partial && !token) { acc = cont ? stitch(acc, e.partial) : e.partial; piece = ''; cont = false; }
      if (e.resumeFailed) { step.attempts++; persist(); if (step.attempts > (hook().maxAttempts || 4)) throw e; continue; }
      if (RETRY.includes(e.kind)) {
        if (hidden()) { persist(); await waitVisible(ctx); continue; } // 가려진 탭에서 끊김: 횟수를 쓰지 않음
        step.attempts++; persist();
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
      // Gemini 무료 키: 이 모델을 못 쓰거나 오늘 한도를 다 썼으면 같은 키의 다른 모델로(앞 단계 결과는 그대로)
      if (rec.provider === 'gemini' && ['no-access', 'model', 'quota-day'].includes(e.kind) && swaps < 2) {
        const next = await nextModel(ctx).catch(() => null);
        if (next) { swaps++; rec.notes = [...(rec.notes || []), `이 키로 쓸 수 없는 모델(${rec.model})이라 ${next} 모델로 이어서 했어요.`]; rec.model = next; await save(rec); continue; }
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
  const list = await listModels('gemini', ctx.key, { freeTier: true });
  return (list.find((m) => !m.locked && !tried.has(m.id)) || {}).id || null;
}
async function repack(ctx) {
  ctx.pack = await packMaterial(ctx.rec.pid, ctx.project, { provider: ctx.rec.provider, model: ctx.rec.model, level: ctx.level, siteImages: ctx.images.list, siteImagesFrom: ctx.images.from, intro: P.buildMaterialPrompt });
  if (ctx.pack.notes.length) rec2notes(ctx.rec, ctx.pack.notes);
}
function rec2notes(rec, notes) { rec.notes = [...new Set([...(rec.notes || []), ...notes])].slice(-12); }

// ── 단계 실행 ──
const formatError = () => new AiError('format', 'format');
const planOf = (rec) => rec.steps.find((s) => s.name === 'plan')?.output || null;
const designOf = (rec) => rec.steps.find((s) => s.name === 'design')?.output || null;

function cleanPlan(v) {
  if (!v || typeof v !== 'object' || !Array.isArray(v.sections) || !v.sections.length) return null;
  const seen = new Set();
  v.sections = v.sections.filter((s) => s && typeof s === 'object').slice(0, 16).map((s, i) => {
    let id = String(s.id || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || `s${i + 1}`;
    if (/^\d/.test(id)) id = 's-' + id;
    while (seen.has(id)) id += '-2';
    seen.add(id);
    return { ...s, id, title: String(s.title || id).slice(0, 80) };
  });
  return v;
}
/** 섹션 묶음: 2~3개씩(첫 화면은 한 묶음에 둘까지) */
export function batchSections(sections) {
  const out = []; let i = 0;
  if (sections.length) { out.push(sections.slice(0, 2)); i = 2; }
  while (i < sections.length) { const left = sections.length - i; const n = left === 4 ? 2 : Math.min(3, left); out.push(sections.slice(i, i + n)); i += n; }
  return out;
}

async function runPlan(ctx, step) {
  const project = ctx.project;
  const text = await askStep(ctx, step, {
    prompt: P.buildPlanPrompt({ request: ctx.rec.opts.request, reference: ctx.rec.opts.reference, info: infoOf(project), prevMeta: project.meta }),
    maxTokens: 24000, json: ctx.rec.provider !== 'anthropic',
    isCut: (t) => { const r = extractJson(t, { prefer: 'sections' }); return !r.value && r.cut; },
  });
  const plan = cleanPlan(extractJson(text, { prefer: 'sections' }).value);
  if (!plan) throw formatError();
  step.output = plan;
  // 섹션 단계 끼워 넣기(조립 앞)
  ctx.rec.steps = ctx.rec.steps.filter((s) => !s.name.startsWith('sections:'));
  const at = ctx.rec.steps.findIndex((s) => s.name === 'assemble');
  const batches = batchSections(plan.sections);
  ctx.rec.steps.splice(at, 0, ...batches.map((_, i) => ({ ...STEP(`sections:${i + 1}`), batch: batches[i].map((s) => s.id) })));
}
function infoOf(p) {
  const i = p.info || {}; const keep = {};
  for (const k of ['title', 'subtitle', 'date', 'start', 'end', 'venue', 'organizer']) if (i[k] && !(p.autoFilled && p.autoFilled[k] === i[k])) keep[k] = i[k];
  return keep; // 교재에서 저절로 채운 값(코드 추측)은 빼고 강사가 직접 적은 값만
}

async function runDesign(ctx, step) {
  const plan = planOf(ctx.rec);
  const isCut = (t) => { const c = extractCss(t); const h = extractHtml(t.slice(Math.max(0, t.search(/```html/i)))); return !c.css || c.cut || (/```html/i.test(t) && h.cut); };
  const text = await askStep(ctx, step, { prompt: P.buildDesignPrompt({ plan }), maxTokens: 32000, isCut });
  let { css, cut } = extractCss(text);
  if (cut) css = trimCss(css);
  if (!css || css.length < 200) throw formatError();
  const blocks = text.split(/```css[\s\S]*?```/i).join('\n');
  let { html: shell, doc, cut: hcut } = extractHtml(blocks);
  if (!doc) shell = skeleton(plan.title);
  if (hcut) shell = balance(shell);
  if (!shell.includes(SECTIONS_MARK)) shell = /<main[\s>][\s\S]*?<\/main>/i.test(shell) ? shell.replace(/(<main[^>]*>)([\s\S]*?)(<\/main>)/i, `$1\n${SECTIONS_MARK}\n$3`) : mergeSections(shell, SECTIONS_MARK);
  step.output = { css, shell };
}

async function runSections(ctx, step) {
  const plan = planOf(ctx.rec); const design = designOf(ctx.rec);
  const ids = step.batch || [];
  const specs = ids.map((id) => plan.sections.find((s) => s.id === id)).filter(Boolean);
  const k = +step.name.split(':')[1]; const total = sectionSteps(ctx.rec);
  const doneIds = ctx.rec.steps.filter((s) => s.name.startsWith('sections:') && s.status === 'done').flatMap((s) => (s.output?.sections || []).map((x) => x.id));
  const classes = P.cssClasses(design.css);
  const got = new Map(); let extra = '';
  let want = specs;
  for (let round = 0; round < 2 && want.length; round++) {
    const text = await askStep(ctx, step, {
      prompt: P.buildSectionsPrompt({ plan, classes, batch: want, index: k, total, done: doneIds }), maxTokens: 48000,
      isCut: (t) => { const secs = extractSections(extractHtml(t).html); return secs.length > 0 && !secs[secs.length - 1].complete; },
    });
    const { html } = extractHtml(text);
    const secs = extractSections(html);
    secs.forEach((s, i) => {
      const id = s.id && want.some((w) => w.id === s.id) ? s.id : (want[i] && !got.has(want[i].id) ? want[i].id : s.id);
      if (!id) return;
      let h = s.complete ? s.html : balance(s.html);
      if (!s.id) h = h.replace(/<section\b/i, `<section id="${id}"`);
      else if (s.id !== id) h = h.replace(/(<section\b[^>]*\bid\s*=\s*)(["'])[^"']*\2/i, `$1$2${id}$2`);
      if (!/data-title=/.test(h.slice(0, 300))) { const sp = want.find((w) => w.id === id); if (sp) h = h.replace(/<section\b/i, `<section data-title="${String(sp.title).replace(/"/g, '&quot;')}"`); }
      got.set(id, h);
    });
    const c = extractCss(text.replace(/```html[\s\S]*?(```|$)/gi, ''));
    if (c.css && !/<[a-zA-Z]/.test(c.css)) extra += '\n' + (c.cut ? trimCss(c.css) : c.css);
    want = specs.filter((s) => !got.has(s.id));
  }
  if (!got.size) throw formatError();
  step.output = { sections: specs.filter((s) => got.has(s.id)).map((s) => ({ id: s.id, html: got.get(s.id) })), css: extra.trim(), missing: specs.filter((s) => !got.has(s.id)).map((s) => s.id) };
  if (step.output.missing.length) rec2notes(ctx.rec, [`AI가 만들지 않은 섹션을 뺐어요: ${step.output.missing.join(', ')}`]);
}

/** 지금까지의 단계 결과로 사이트(조립 전 AI 파일)와 연수 정보 */
function siteFromSteps(ctx) {
  const plan = planOf(ctx.rec); const design = designOf(ctx.rec);
  const secs = ctx.rec.steps.filter((s) => s.name.startsWith('sections:')).flatMap((s) => s.output?.sections || []);
  const extra = ctx.rec.steps.filter((s) => s.name.startsWith('sections:')).map((s) => s.output?.css || '').filter(Boolean);
  const order = plan.sections.map((s) => s.id);
  secs.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  let html = mergeSections(design.shell, secs.map((s) => s.html));
  if (plan.title && /<title>\s*<\/title>/i.test(html)) html = html.replace(/<title>\s*<\/title>/i, `<title>${plan.title.replace(/</g, '&lt;')}</title>`);
  const css = [design.css, ...extra.map((c) => `/* 섹션 덧붙임 */\n${c}`)].join('\n\n');
  return { 'index.html': html, 'assets/style.css': css };
}
function metaFrom(plan, css, prev) {
  const theme = { ...(plan.theme || {}), ...themeFromCss(css) };
  return readMeta({ v: 2, title: plan.title, subtitle: plan.subtitle, organizer: plan.organizer, sessions: plan.sessions, venue: plan.venue, mode: plan.mode, audience: plan.audience, instructors: plan.instructors, features: plan.features, theme, facts: plan.facts, pages: plan.pages }, { prev }).meta;
}

/**
 * 조립(엔진 키트, 미리보기·연습 모드) + 정적 검수(AI가 쓴 폴더 기준) + 숨은 틀에서 그려서 검수(1280·390).
 * issue마다 key(같은 종류가 여럿일 때 하나를 가리킴: id|파일|선택자|섹션|폭)를 붙임
 */
export async function inspectSite(pid, site, meta, project = null) {
  const a = await assembleSite(pid, site, meta, { project });
  const issues = inspect({ ...a.material, ...(site || {}) }, meta);
  for (const w of [...(a.errors || []), ...(a.warnings || [])]) if (!issues.some((x) => x.id === w.code)) issues.push({ id: 'assemble-' + w.code, level: (a.errors || []).includes(w) ? 'error' : 'warn', where: { file: '', selector: '', section: '' }, message_ko: w.message_ko, fix_hint_ko: '' });
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

async function runAssemble(ctx, step) {
  const rec = ctx.rec;
  let site; let meta;
  if (rec.kind === 'make' && rec.way !== 'local' && !rec.steps.some((s) => s.name === 'fix' && s.status === 'done')) {
    site = siteFromSteps(ctx);
    meta = metaFrom(planOf(rec), site['assets/style.css'], ctx.project.meta);
  } else { site = rec.site; meta = rec.meta; }
  const { issues } = await inspectSite(rec.pid, site, meta, ctx.project);
  rec.site = site; rec.meta = meta;
  step.output = { issues };
  // 고칠 수 있는 문제(섹션이 정해진 오류)가 있으면 그 섹션만 한 번 고치기
  const fixable = issues.filter((i) => i.level === 'error' && i.where?.section);
  if (rec.kind === 'make' && rec.way === 'key' && fixable.length && !rec.steps.some((s) => s.name === 'fix') && !hook().noFix) {
    rec.steps.push({ ...STEP('fix'), issues: fixable.slice(0, 12) }, STEP('assemble'));
  }
}

async function runFix(ctx, step) {
  const rec = ctx.rec;
  const issues = step.issues || [];
  const site = rec.site || ctx.project.site;
  if (!site?.['index.html']) throw new AiError('no-site', 'no site');
  const all = extractSections(site['index.html']);
  const ids = [...new Set(issues.map((i) => i.where?.section).filter(Boolean))].slice(0, 4);
  const targets = all.filter((s) => ids.includes(s.id));
  if (!targets.length) { step.output = { skipped: true }; return; }
  const text = await askStep(ctx, step, {
    prompt: P.buildFixPrompt({ issuesText: issuesForAi(issues.filter((i) => ids.includes(i.where?.section))), sections: targets, classes: P.cssClasses(site['assets/style.css']) }), maxTokens: 32000,
    isCut: (t) => { const s = extractSections(extractHtml(t).html); return s.length > 0 && !s[s.length - 1].complete; },
  });
  const secs = extractSections(extractHtml(text).html).filter((s) => s.id && ids.includes(s.id)).map((s) => ({ id: s.id, html: s.complete ? s.html : balance(s.html) }));
  const c = extractCss(text.replace(/```html[\s\S]*?(```|$)/gi, ''));
  const { html } = replaceSections(site['index.html'], secs);
  const cssAdd = c.css && !/<[a-zA-Z]/.test(c.css) ? `/* 검수 고침 */\n${c.cut ? trimCss(c.css) : c.css}` : '';
  rec.site = { ...site, 'index.html': html, ...(cssAdd ? { 'assets/style.css': `${site['assets/style.css'] || ''}\n\n${cssAdd}` } : {}) };
  rec.delta = { sections: secs, cssAdd: [rec.delta?.cssAdd, cssAdd].filter(Boolean).join('\n\n'), metaPatch: rec.delta?.metaPatch || null };
  step.output = { fixed: secs.map((s) => s.id) };
}

async function runEdit(ctx, step) {
  const rec = ctx.rec;
  const site = rec.site || ctx.project.site;
  if (!site?.['index.html']) throw new AiError('no-site', 'no site');
  const target = rec.opts.target || 'all';
  const all = extractSections(site['index.html']);
  const sections = target === 'all' ? all : all.filter((s) => s.id === target);
  if (!sections.length) throw new AiError('no-site', 'no section');
  const text = await askStep(ctx, step, {
    prompt: P.buildEditPrompt({ request: rec.opts.request, target, sections, css: site['assets/style.css'], meta: rec.meta || ctx.project.meta }), maxTokens: 48000,
    isCut: (t) => { const s = extractSections(extractHtml(t).html); return s.length > 0 && !s[s.length - 1].complete; },
  });
  let got = extractSections(extractHtml(text).html).map((s) => ({ id: s.id, html: s.complete ? s.html : balance(s.html) }));
  // 섹션 하나를 고칠 때는 그 섹션만 바꿈(다른 섹션을 같이 돌려줘도 버림). id가 다르거나 없는 섹션 하나만 오면 그 섹션으로 봄
  if (target !== 'all') {
    const same = got.filter((s) => s.id === target);
    got = same.length ? same.slice(0, 1) : got.length === 1 ? [{ id: target, html: got[0].id ? got[0].html.replace(/(<section\b[^>]*\bid\s*=\s*)(["'])[^"']*\2/i, `$1$2${target}$2`) : got[0].html.replace(/<section\b/i, `<section id="${target}"`) }] : [];
  }
  const secs = got.filter((s) => s.id);
  const c = extractCss(text.replace(/```html[\s\S]*?(```|$)/gi, '').replace(/```json[\s\S]*?(```|$)/gi, ''));
  const metaPatch = extractJson((/```json([\s\S]*?)(```|$)/i.exec(text) || [])[1] || '').value;
  if (!secs.length && !c.css && !metaPatch) throw formatError();
  const { html } = replaceSections(site['index.html'], secs);
  const cssAdd = c.css && !/<[a-zA-Z]/.test(c.css) ? `/* 수정 요청 */\n${cssCut(c.css) ? trimCss(c.css) : c.css}` : '';
  const css = cssAdd ? `${site['assets/style.css'] || ''}\n\n${cssAdd}` : site['assets/style.css'];
  rec.site = { ...site, 'index.html': html, 'assets/style.css': css };
  rec.delta = { sections: secs, cssAdd, metaPatch: metaPatch && typeof metaPatch === 'object' ? metaPatch : null };
  const prev = rec.meta || ctx.project.meta || {};
  // 색: 덧붙인 규칙이 앞 규칙을 덮으므로(뒤가 이김) 새 CSS의 값을 먼저
  const theme = { ...(prev.theme || {}), ...themeFromCss(css), ...(c.css ? themeFromCss(c.css) : {}) };
  rec.meta = metaPatch && typeof metaPatch === 'object' ? readMeta({ ...prev, ...metaPatch, theme: { ...theme, ...(metaPatch.theme || {}) } }, { prev }).meta : { ...prev, theme };
  step.output = { changed: secs.map((s) => s.id), css: !!c.css, meta: !!metaPatch };
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

const RUN = { plan: runPlan, design: runDesign, assemble: runAssemble, fix: runFix, edit: runEdit, agent: runAgent };

/** 끝: 연수에 site·meta·versions·gen 저장 */
async function finish(ctx) {
  const rec = ctx.rec;
  const at = Date.now();
  const issues = rec.steps.filter((s) => s.name === 'assemble').pop()?.output?.issues || [];
  // 수정·고치기: 그동안 강사가 다른 섹션을 고쳤을 수 있어 지금 사이트에 바뀐 섹션·덧붙인 CSS만 얹음
  const merged = (cur) => {
    if (rec.kind === 'make' || !rec.delta || !cur.site?.['index.html']) return { site: rec.site, meta: rec.meta };
    const d = rec.delta;
    const site = { ...cur.site, 'index.html': replaceSections(cur.site['index.html'], d.sections || []).html, ...(d.cssAdd ? { 'assets/style.css': `${cur.site['assets/style.css'] || ''}\n\n${d.cssAdd}` } : {}) };
    const prev = cur.meta || {};
    const theme = { ...(prev.theme || {}), ...themeFromCss(site['assets/style.css'] || ''), ...(d.cssAdd ? themeFromCss(d.cssAdd) : {}) };
    const meta = d.metaPatch ? readMeta({ ...prev, ...d.metaPatch, theme: { ...theme, ...(d.metaPatch.theme || {}) } }, { prev }).meta : { ...prev, theme };
    return { site, meta };
  };
  let out = null;
  const saved = await projects.patch(rec.pid, (cur) => { out = settle(cur, merged(cur)); return {
    v: 2, site: out.site, meta: out.meta,
    gen: { jobId: rec.id, status: 'done', way: rec.way, provider: rec.provider, model: rec.model, agent: rec.agent || '', at, kind: rec.kind },
    versions: versionsAfter(cur, rec.kind, out, rec.way === 'chat'),
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
 * 판 기록(최근 10판, 새것이 앞): 새로 만들면 '다시 만들기 전'(있으면)과 'AI가 만든 판', 고치면 고치기 전 판.
 * 직접 고친 것은 화면이 [되돌리기]로, 판 기록은 AI가 바꾸는 큰 걸음만
 */
export function versionsAfter(cur, kind, next, chat = false) {
  if (kind === 'make') {
    const before = cur.site ? pushVersion(cur, '다시 만들기 전') : cur.versions || [];
    return pushVersion({ site: next.site, meta: next.meta, versions: before }, chat ? '쓰던 AI가 만든 판' : 'AI가 만든 판');
  }
  return pushVersion(cur, kind === 'fix' ? '검수 고치기 전' : chat ? '쓰던 AI로 고치기 전' : 'AI가 고치기 전');
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
      if (!rec.model) { rec.model = (await checkKey(rec.provider, key, { signal })).model; await save(rec); }
    }
    // 학교망이 AI 회사를 막았으면 오래 기다리지 않게(처음 시작할 때만, 시험 주소면 건너뜀)
    if (rec.way === 'key' && !rec.steps.some((s) => s.status === 'done') && baseFor(rec.provider) === BASES[rec.provider] && await reach('ai:' + rec.provider) === 'blocked') throw new AiError('blocked', 'blocked', { provider: rec.provider });
    // 교재도 요청 글도 없으면 AI가 지어낼 것밖에 없음 → 교재를 먼저
    if (rec.kind === 'make' && !sourceFiles(project).length && !project.material && !String(rec.opts.request || '').trim()) throw new AiError('no-material', 'no material');
    // 새로 만들기의 첫 단계에서만 지금 교재의 쪽 그림으로 다시 옮김(이어 하기·고치기는 있던 것 그대로)
    ctx.images = await preparePageImages(pid, project, { signal, refresh: rec.kind === 'make' && !rec.steps.some((s) => s.status === 'done') });
    if (rec.way === 'key') await repack(ctx);
    else ctx.pack = { parts: [] }; // 내 PC 에이전트는 교재 파일을 따로 받고, 먼저 해보기는 어디로도 보내지 않음
    for (;;) {
      const step = rec.steps.find((s) => s.status !== 'done');
      if (!step) break;
      step.status = 'running'; step.startedAt = step.startedAt || Date.now(); step.error = null; await save(rec);
      const fn = step.name.startsWith('sections:') ? runSections : RUN[step.name];
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
      rec.status = 'paused'; rec.error = L.stopReason === 'user' ? { kind: 'stopped', title: '멈췄어요.', body: '[이어서 만들기]를 누르면 멈춘 단계부터 이어서 만들어요.', actions: ['resume'] } : null;
      const step = rec.steps.find((s) => s.status === 'running'); if (step) step.status = 'todo';
      // 멈추기: OpenAI는 서버에서 도는 답을 취소하고 지움(받은 글은 남겨 이어서 만들기에서 '이어서'로 씀)
      if (L.stopReason === 'user' && rec.provider === 'openai' && step?.token) { openaiDiscard(ctx.key, step.token.id, { cancel: true }); step.token = null; }
      if (L.stopReason === 'user' && step?.bridgeJob) { cancelBridgeJob(step.bridgeJob); step.bridgeJob = ''; }
      await save(rec).catch(() => { });
      return;
    }
    console.error('[gen]', e);
    const step = rec.steps.find((s) => s.status === 'running');
    if (step) { step.status = 'error'; step.error = { kind: e?.kind || 'other', message: String(e?.message || '').slice(0, 300) }; }
    rec.status = 'error'; rec.error = errorView(e, rec.provider);
    await save(rec).catch(() => { });
    // 망이 끊겨 멈췄으면 망이 돌아올 때 저절로 이어 함
    if (['network', 'stall', 'blocked'].includes(e?.kind)) autoResume.add(pid);
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
  const way = ['local', 'demo'].includes(opts.way) ? opts.way : 'key';
  // 내 PC의 에이전트(agent: 'claude'|'codex')·먼저 해보기는 회사 자리에 그 길 이름
  let provider = way === 'key' ? opts.provider : way; let model = way === 'key' ? opts.model || '' : '';
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
