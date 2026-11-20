// 먼저 해보기: 별도 화면 없이 '같은 연수 화면'(Project)을 체험 연수로 엶. 예시 교재 PDF가 미리 들어가 있고,
// AI 단계는 녹화(data/demo-run.js)를 진행 단계와 함께 다시 보여 줌(키 없이, 어디로도 보내지 않음). 그 밖의 화면은 실제와 같음.
// 체험 연수는 이 브라우저에 하나만 두고(p.demo), '내 연수' 목록에는 보이지 않음. 다시 체험하면 새로 만듦.
import { useEffect, useState } from 'preact/hooks';
import { projects, blobs } from './db.js';
import { uid } from './util.js';
import { DEFAULT_INFO } from '@engine/src/project-file.js';
import { copyPages } from './site-meta.js';
import { readMeta } from '@engine/src/kit/index.js';

const subs = new Map(); const runs = new Map();
const IDLE = { status: 'idle', steps: [], step: null, startedAt: 0, error: null };
const SPEED = 14; // 실제 시간보다 몇 배 빨리 보여 줄지
const emit = (pid) => (subs.get(pid) || new Set()).forEach((f) => f(runs.get(pid) || IDLE));

/** 체험 연수를 새로 만들어 엶(예전 체험 연수는 지움) */
export async function openDemo() {
  const { DEMO_FILE } = await import('../data/demo-run.js');
  for (const p of await projects.all()) if (p.demo) await projects.remove(p.id).catch(() => { });
  const r = await fetch(DEMO_FILE.url); if (!r.ok) throw new Error('demo file');
  const bytes = new Uint8Array(await r.arrayBuffer());
  const id = uid(10); const key = 'src/demo.pdf';
  await blobs.put(id, key, bytes);
  await projects.put({ id, demo: true, title: '체험 연수', step: 1, stage: 1, createdAt: Date.now(), info: { ...DEFAULT_INFO }, deploy: {},
    files: [{ name: DEMO_FILE.name, key, size: bytes.length, ext: 'pdf', pages: 0, errors: [], pending: true }] });
  return id;
}

/** 체험 끝내기: 체험 연수를 지움 */
export async function endDemo(pid) { runs.delete(pid); await projects.remove(pid).catch(() => { }); }

/** 녹화 다시 보기 시작(생성 API의 startGeneration 자리) */
export async function startReplay(pid, { provider = '', way = 'key' } = {}) {
  const { DEMO_STEPS, demoResult } = await import('../data/demo-run.js');
  const id = uid(8); const t0 = Date.now();
  const total = DEMO_STEPS.reduce((n, s) => n + s.sec, 0);
  const set = (patch) => { const j = { ...(runs.get(pid) || IDLE), ...patch }; const i = j.steps.findIndex((s) => s.status !== 'done'); j.step = i < 0 ? null : { ...j.steps[i], index: i, total: j.steps.length }; runs.set(pid, j); emit(pid); };
  set({ id, kind: 'make', way, provider, model: '', status: 'running', startedAt: t0, replay: { speed: SPEED, took: total }, error: null, steps: DEMO_STEPS.map((s) => ({ name: s.name, label_ko: s.label_ko, status: 'waiting', attempts: 0 })) });
  for (let i = 0; i < DEMO_STEPS.length; i++) {
    const j = runs.get(pid); if (!j || j.id !== id) return;
    set({ steps: j.steps.map((s, k) => (k === i ? { ...s, status: 'running', attempts: 1 } : s)) });
    await new Promise((r) => setTimeout(r, (DEMO_STEPS[i].sec * 1000) / SPEED));
    const k = runs.get(pid); if (!k || k.id !== id) return;
    set({ steps: k.steps.map((s, n) => (n === i ? { ...s, status: 'done' } : s)) });
  }
  await copyPages(pid); // 체험 교재의 쪽 그림을 사이트 자리(material/p-NNN)로(녹화한 사이트가 교재 쪽 그림을 씀)
  const made = await demoResult();
  const site = {};
  for (const [k, v] of Object.entries(made.site)) { if (typeof v === 'string') site[k] = v; else await blobs.put(pid, 'site/' + k, v); }
  const cur = await projects.get(pid); if (!cur) return;
  // AI 답의 강사 칸(실시간 주소·공개 범위)은 버림(엔진 readMeta 규칙)
  const meta = readMeta(made.meta, { prev: { access: cur.meta?.access || 'link', ...(cur.meta?.live ? { live: cur.meta.live } : {}) } }).meta;
  await projects.put({ ...cur, v: 2, site, meta, gen: { jobId: id, status: 'done', way, provider, model: '' }, versions: [{ id: uid(8), at: Date.now(), label: 'AI가 만든 판', site, meta }] });
  set({ status: 'done', doneAt: Date.now() });
}
export function stopReplay(pid) { const j = runs.get(pid); if (j?.status === 'running') { runs.delete(pid); emit(pid); } }

export function useReplay(pid) {
  const [s, setS] = useState(() => runs.get(pid) || IDLE);
  useEffect(() => {
    if (!subs.has(pid)) subs.set(pid, new Set());
    const f = (v) => setS(v); subs.get(pid).add(f); setS(runs.get(pid) || IDLE);
    return () => subs.get(pid)?.delete(f);
  }, [pid]);
  return s;
}
