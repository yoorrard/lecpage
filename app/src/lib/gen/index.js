// AI 생성 API(docs/plan-ai-first.md §15). 화면은 lib/studio.js를 거쳐 이 파일만 부르고, 생성 쪽은 화면을 모릅니다.
//   startGeneration · resumeGeneration · stopGeneration · useGeneration
//   editSite · runInspect · fixIssues · bridgeStatus
// 사이트를 바꾸면(작업 끝) 연수(projects)에 { v:2, site, meta, gen, versions, inspect, notes? }를 저장하고
// 창에 'lecpage:gen-saved'({ pid, at }) 이벤트를 보냄 → 같은 탭의 연수 화면은 다시 읽고 자동 저장의 기준 판을 맞춤(Project.jsx).
// 다른 탭은 db.js onProjectChange로 알게 됨. 검수(runInspect)는 연수를 바꾸지 않음(결과만 돌려주고 이 탭에 기억).
import { useEffect, useState } from 'preact/hooks';
import { projects } from '../db.js';
import { startJob, resumeJob, stopJob, forgetJob, currentView, liveView, onJobChange, resumeIfOrphaned, inspectSite } from './job.js';

export { bridgeStatus } from './local.js';
export { assembleProject } from './preview.js';
export { pageTitles } from './kit.js';

/**
 * AI로 사이트 만들기 시작. 앞 단계는 저장되며 끊겨도 resumeGeneration으로 이어 함.
 * @param {string} pid
 * @param {{ way?: 'key'|'local'|'demo', provider?: string, model?: string, agent?: 'claude'|'codex', request?: string, reference?: string|{ name, mood } }} o
 *   way 'key': provider를 비우면 지금 연결된 AI. 'local': 연결 프로그램(§10)의 에이전트(agent, 기본 claude). 'demo': 먼저 해보기(어디로도 보내지 않음)
 *   reference는 분위기 설명만 AI에게 붙음(따를 의무 없음)
 * @returns {Promise<string>} jobId (다른 탭이 이미 만드는 중이면 그 작업의 id — useGeneration의 elsewhere가 true)
 */
export async function startGeneration(pid, o = {}) {
  const r = await startJob(pid, 'make', { way: o.way || 'key', provider: o.provider, model: o.model, agent: o.agent, request: o.request, reference: o.reference });
  return r.jobId;
}
/** 멈춘 작업 이어 하기(새로 고침 뒤 useGeneration이 저절로도 부름). change: { provider, model }로 바꿔 이어 할 수 있음(앞 단계 결과 유지) */
export async function resumeGeneration(pid, change = {}) { return (await resumeJob(pid, change)).jobId; }
/** 멈추기 → status 'paused'. resumeGeneration으로 멈춘 단계부터 */
export function stopGeneration(pid) { return stopJob(pid); }
/** 멈추거나 실패한 작업을 그만둠(기록을 지움 → status 'idle'). 도는 중이면 하지 않음 */
export function forgetGeneration(pid) { return forgetJob(pid); }

/**
 * 진행 상태(Preact 훅). 도는 동안 1초마다 now를 넣어 다시 그림(걸린 시간).
 * → { status: 'idle'|'running'|'paused'|'done'|'error', jobId, kind: 'make'|'edit'|'fix', way, provider, model, agent,
 *     step: { name, label_ko, index(1부터), total, received(받은 글자 수) }, steps[{ name, label_ko, status: 'todo'|'running'|'done'|'error', attempts }],
 *     startedAt, updatedAt, endedAt, error: { kind, title, body, actions[], link? } | null, wait: { reason: 'quota'|'retry'|'hidden', until } | null,
 *     notes[], elsewhere(다른 탭이 만드는 중), now }
 * error.actions: 'resume'(이어서 만들기) · 'connect'(다른 AI 고르기) · 'key'(키 페이지) · 'billing'(결제 페이지) · 'link'(error.link)
 * 처음 그릴 때 새로 고침으로 끊긴 작업이 있으면 저절로 이어 함
 */
export function useGeneration(pid) {
  const [v, setV] = useState(() => liveView(pid) || { status: 'idle', step: null, steps: [], startedAt: 0, error: null });
  useEffect(() => {
    if (!pid) return undefined;
    let on = true;
    let last = null; let n = 0;
    const refresh = () => currentView(pid).then((x) => { last = x; if (on) setV({ ...x, now: Date.now() }); }).catch(() => { });
    refresh();
    resumeIfOrphaned(pid).then(refresh).catch(() => { });
    const off = onJobChange((id) => { if (id === pid) refresh(); });
    const t = setInterval(() => {
      if (!on) return;
      // 다른 탭이 만들던 작업: 그 탭을 닫았으면(잠금이 풀림) 5초마다 확인해 이 탭이 이어 함
      if (last?.status === 'running' && last.elsewhere && ++n % 5 === 0) resumeIfOrphaned(pid).then(refresh).catch(() => { });
      setV((x) => (x.status === 'running' ? { ...x, now: Date.now() } : x));
    }, 1000);
    return () => { on = false; off(); clearInterval(t); };
  }, [pid]);
  return v;
}

// ── 고치기 ──
/**
 * 수정 요청(키·내 PC). target: 'all' 또는 섹션 id. way 'local'이면 agent('claude'|'codex')에게
 * @returns {Promise<string>} jobId
 */
export async function editSite(pid, { target = 'all', request = '', way = 'key', provider, model, agent } = {}) {
  const r = await startJob(pid, 'edit', { target, request, way, provider, model, agent });
  return r.jobId;
}
// 마지막 검수 결과(이 탭): fixIssues가 key로 찾음
const lastIssues = new Map();
const remember = (pid, issues) => { lastIssues.set(pid, issues); return issues; };
/** 조립 + 정적 검사 + 숨은 틀에서 그려서 검사(390·1280) → issues[](key 붙음). 연수는 바꾸지 않음 */
export async function runInspect(pid) {
  const p = await projects.get(pid);
  if (!p?.site?.['index.html']) return [];
  const { issues } = await inspectSite(pid, p.site, p.meta || {}, p);
  return remember(pid, issues);
}

/**
 * 검수 문제를 AI에게([AI에게 고쳐 달라기]를 누를 때만). ids: issue.key(하나) 또는 issue.id(그 종류 전부), 비우면 꼭 고칠 곳 전부.
 * AI가 지금 사이트 전체와 문제 목록을 보고 바뀐 파일만 돌려줌(키·내 PC 모두)
 * @returns {Promise<string>} jobId 또는 ''
 */
export async function fixIssues(pid, ids = [], { way = 'key', provider, model, agent } = {}) {
  const p = await projects.get(pid);
  const all = lastIssues.get(pid) || p?.inspect?.issues || [];
  const picked = ids.length ? all.filter((i) => ids.includes(i.key) || ids.includes(i.id)) : all.filter((i) => i.level === 'error');
  const issues = picked;
  if (!issues.length) return '';
  const r = await startJob(pid, 'fix', { issues, way, provider, model, agent });
  return r.jobId;
}
