// 가짜 생성 API — docs/plan-ai-first.md §15의 이름·꼴 그대로. 실제 AI를 부르지 않고, 단계를 시간차로 진행한 뒤 임시 사이트(data/temp-site.js)를 돌려줍니다.
// 화면은 lib/studio.js 한 곳에서만 이 파일을 부름 → gen 작업자의 진짜 구현(app/src/lib/gen/index.js)이 오면 그 한 줄만 바꾸고 이 파일은 지움.
// 시험용: localStorage 'lecpage:mock-speed'(빠르기 배수), 요청에 '#실패'를 넣으면 셋째 단계에서 한 번 멈춤(오류 안내 화면 확인용).
import { useEffect, useState } from 'preact/hooks';
import { projects, blobs } from '../db.js';
import { assemble, inspect } from '../kit-mock.js';
import { tempSite } from '../../data/temp-site.js';
import { copyPages } from '../site-meta.js';

const jobs = new Map();
const subs = new Map();
const partial = new Map(); // 쓰던 AI 창의 끊긴 답(이어 붙이기)
const KEY = (pid) => 'lecpage:mock-job:' + pid;
const speed = () => { try { return Math.max(0.1, Number(localStorage.getItem('lecpage:mock-speed')) || 1); } catch { return 1; } };
const uid = () => Math.random().toString(36).slice(2, 10);
const IDLE = { status: 'idle', steps: [], step: null, startedAt: 0, error: null };

const PLANS = {
  make: [['plan', '교재 읽고 설계하기'], ['design', '디자인 정하기'], ['sections:1', '섹션 만들기 1/2'], ['sections:2', '섹션 만들기 2/2'], ['check', '조립하고 검수하기']],
  edit: [['read', '고칠 곳 읽기'], ['write', '고쳐 쓰기'], ['check', '조립하고 검수하기']],
  fix: [['fix', '검수 결과 고치기'], ['check', '다시 검수하기']],
};

function emit(pid) { const s = jobs.get(pid) || IDLE; (subs.get(pid) || new Set()).forEach((f) => f(s)); }
function save(pid) {
  const j = jobs.get(pid);
  try { if (j && (j.status === 'running' || j.status === 'paused')) localStorage.setItem(KEY(pid), JSON.stringify({ ...j, timer: undefined })); else localStorage.removeItem(KEY(pid)); } catch { /* 저장 못 해도 이번에는 됨 */ }
}
function set(pid, patch) {
  const j = { ...(jobs.get(pid) || IDLE), ...patch };
  const i = j.steps.findIndex((s) => s.status !== 'done');
  j.step = i < 0 ? (j.steps.length ? { ...j.steps[j.steps.length - 1], index: j.steps.length - 1, total: j.steps.length } : null) : { ...j.steps[i], index: i, total: j.steps.length };
  jobs.set(pid, j); save(pid); emit(pid);
  return j;
}

async function write(pid, fn) {
  const cur = await projects.get(pid);
  if (!cur) return null;
  const patch = await fn(cur);
  await projects.put({ ...cur, ...patch });
  return patch;
}

const later = (ms) => new Promise((r) => setTimeout(r, ms / speed()));

/** 단계를 차례로 진행. 멈추면(stopGeneration) 그 단계에서 기다림 */
async function run(pid, id) {
  for (;;) {
    const j = jobs.get(pid);
    if (!j || j.id !== id || j.status !== 'running') return;
    const i = j.steps.findIndex((s) => s.status !== 'done');
    if (i < 0) break;
    set(pid, { steps: j.steps.map((s, k) => (k === i ? { ...s, status: 'running', attempts: (s.attempts || 0) + 1 } : s)) });
    await later(i === 0 ? 1400 : 1100);
    const k = jobs.get(pid);
    if (!k || k.id !== id || k.status !== 'running') return;
    if (/#실패/.test(k.opts?.request || '') && i === 2 && !k.failedOnce) {
      set(pid, { status: 'error', failedOnce: true, steps: k.steps.map((s, n) => (n === i ? { ...s, status: 'error', error: 'busy' } : s)),
        error: { title: 'AI 회사가 바빠 잠깐 멈췄어요.', body: '앞 단계까지 만든 것은 남아 있어요. [이어서 하기]를 누르면 멈춘 단계부터 해요.', actions: ['resume', 'chat'] } });
      return;
    }
    set(pid, { steps: k.steps.map((s, n) => (n === i ? { ...s, status: 'done', output: 'ok' } : s)) });
  }
  const j = jobs.get(pid);
  try {
    await finish(pid, j);
    set(pid, { status: 'done', doneAt: Date.now() });
  } catch (e) {
    console.error(e);
    set(pid, { status: 'error', error: { title: '저장하지 못했어요.', body: '이 브라우저의 저장 공간을 확인한 뒤 [이어서 하기]를 눌러 주세요.', actions: ['resume'] } });
  }
}

const hasFile = (p) => (p.files || []).some((f) => !f.errors?.length && !f.photos);
function fakeContent(p) {
  const f = (p.files || []).find((x) => !x.photos) || {};
  const title = (p.meta?.title || String(f.name || '새 연수').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')).trim();
  const d = new Date(Date.now() + 21 * 864e5); const date = d.toISOString().slice(0, 10);
  return { title, date, start: '14:00', end: '17:00', venue: '연수원 2층 세미나실', pages: f.pages || 6,
    facts: [{ label: '연수명', value: title, page: 1 }, { label: '날짜', value: date, page: 2 }, { label: '시간', value: '14:00~17:00', page: 2 }, { label: '장소', value: '연수원 2층 세미나실', page: 2 }] };
}

async function finish(pid, j) {
  const pages = j.kind === 'make' ? await copyPages(pid) : [];
  await write(pid, (cur) => {
    const keep = { live: cur.meta?.live || null, siteUrl: cur.meta?.siteUrl || '', joinUrl: cur.meta?.joinUrl || '', shortUrl: cur.meta?.shortUrl || '', access: cur.meta?.access || 'link', privacy: cur.meta?.privacy || null };
    const versions = cur.versions || [];
    if (j.kind === 'make') {
      const t = tempSite({ ...fakeContent(cur), figure: pages[0]?.path || '' });
      const meta = { ...t.meta, ...keep };
      return { v: 2, site: t.site, meta, gen: { jobId: j.id, status: 'done', way: j.way, provider: j.provider, model: j.model }, versions: [{ id: uid(), at: Date.now(), label: 'AI가 만든 판', site: t.site, meta }, ...versions].slice(0, 10) };
    }
    const site = { ...cur.site };
    const doc = new DOMParser().parseFromString(site['index.html'] || '', 'text/html');
    if (j.kind === 'edit') {
      const sec = j.opts.target && j.opts.target !== 'all' ? doc.getElementById(j.opts.target) : doc.querySelector('main section');
      const box = sec?.querySelector('.wrap') || sec;
      if (box) { const note = doc.createElement('p'); note.className = 'sub'; note.textContent = `요청을 반영했어요: ${String(j.opts.request || '').slice(0, 80)}`; box.appendChild(note); }
    } else if (j.kind === 'fix') {
      doc.querySelectorAll('img:not([alt])').forEach((img) => img.setAttribute('alt', '연수 자료 그림'));
      doc.querySelectorAll('main section[id]').forEach((s) => { if ((s.textContent || '').replace(/\s+/g, '').length < 6 && !s.querySelector('img,[data-lp]')) s.remove(); });
    }
    site['index.html'] = '<!doctype html>\n' + doc.documentElement.outerHTML;
    return { site, gen: { jobId: j.id, status: 'done', way: j.way, provider: j.provider, model: j.model }, versions: [{ id: uid(), at: Date.now(), label: j.kind === 'fix' ? '검수 고치기 전' : '수정 요청 전', site: cur.site, meta: cur.meta }, ...versions].slice(0, 10) };
  });
}

function begin(pid, kind, opts) {
  const id = uid();
  set(pid, { id, kind, opts, way: opts.way || 'key', provider: opts.provider || '', model: opts.model || '', status: 'running', startedAt: Date.now(), error: null,
    steps: PLANS[kind].map(([name, label_ko]) => ({ name, label_ko, status: 'waiting', attempts: 0 })) });
  run(pid, id);
  return id;
}

export function startGeneration(pid, opts = {}) { return begin(pid, 'make', opts); }
export function resumeGeneration(pid) {
  const j = jobs.get(pid); if (!j || j.status === 'done') return null;
  set(pid, { status: 'running', error: null, steps: j.steps.map((s) => (s.status === 'error' || s.status === 'running' ? { ...s, status: 'waiting' } : s)) });
  run(pid, j.id);
  return j.id;
}
export function stopGeneration(pid) {
  const j = jobs.get(pid); if (!j || j.status !== 'running') return;
  set(pid, { status: 'paused', steps: j.steps.map((s) => (s.status === 'running' ? { ...s, status: 'waiting' } : s)) });
}
/** 끝난 작업 기록을 지움(화면이 결과를 받은 뒤) — 진짜 구현에 없으면 화면은 부르지 않아도 됨 */
export function clearGeneration(pid) { jobs.delete(pid); save(pid); emit(pid); }

export function useGeneration(pid) {
  const [s, setS] = useState(() => jobs.get(pid) || IDLE);
  useEffect(() => {
    if (!subs.has(pid)) subs.set(pid, new Set());
    const f = (v) => setS(v); subs.get(pid).add(f);
    // 새로 고침 뒤: 돌던 작업이면 그 단계부터 저절로 이어 함
    if (!jobs.has(pid)) {
      let saved = null; try { saved = JSON.parse(localStorage.getItem(KEY(pid)) || 'null'); } catch { }
      if (saved?.id) { jobs.set(pid, saved); if (saved.status === 'running') resumeGeneration(pid); else emit(pid); }
    }
    setS(jobs.get(pid) || IDLE);
    return () => subs.get(pid)?.delete(f);
  }, [pid]);
  return s;
}

/** 쓰던 AI 창에 붙일 글(교재 원본을 첨부하라는 안내 포함) */
export async function chatPrompt(pid, { request = '', reference = '' } = {}) {
  const p = await projects.get(pid);
  const names = (p?.files || []).filter((f) => !f.photos).map((f) => f.name).join(', ');
  return [
    '너는 한국의 강의·연수 사이트를 설계하고 직접 만드는 디자이너 겸 개발자야.',
    `첨부한 교재 파일(${names || '교재'})을 직접 읽고, 연수 참가자가 휴대폰과 PC로 볼 강의 사이트를 만들어 줘.`,
    '- 결과는 index.html 한 파일(<style> 안에 CSS). 섹션마다 <section id="…" data-title="…">를 써.',
    '- 참여 기능 자리: 질문 <div data-lp="qa"></div>, 투표 <div data-lp="poll" data-question="…" data-options=\'["…","…"]\'></div>, 실습 단계 <section data-lp-step="s1" data-title="1단계: …">.',
    '- 색은 :root의 --lp-accent --lp-ink --lp-paper --lp-font로 정해.',
    '- 맨 끝에 ```json 코드 블록으로 lecpage.json(제목·날짜·시간·장소·강사·facts에 찾은 쪽 번호)을 붙여.',
    request ? `- 강사의 요청: ${request}` : '',
    reference ? `- 참고 디자인(따를 필요는 없음): ${reference}` : '',
    '교재에 없는 날짜·이름은 지어내지 말고 비워 둬.',
  ].filter(Boolean).join('\n');
}

const ASK_MORE = '끊긴 곳 바로 다음부터 이어서 써 주세요. 앞부분은 다시 쓰지 말고 코드 블록 하나로 주세요.';
/** 붙여 넣은 답(또는 내려받은 .html) → 사이트. 끊겼으면 continuePrompt */
export async function acceptChatAnswer(pid, input, { target = '' } = {}) {
  let text = typeof input === 'string' ? input : await input.text();
  text = String(text || '');
  const key = pid + ':' + (target || 'all');
  if (partial.has(key)) { text = partial.get(key) + '\n' + text.replace(/^\s*```(?:html)?\s*/i, ''); }
  const fence = /```html\s*([\s\S]*?)(```|$)/i.exec(text);
  let html = fence ? fence[1] : text;
  const cur = await projects.get(pid);
  if (target) {
    const m = /<section[\s\S]*<\/section>/i.exec(html);
    if (!m) {
      if (/<section/i.test(html)) { partial.set(key, text); return { ok: false, site: null, meta: null, problems: ['답이 중간에 끊겼어요.'], continuePrompt: ASK_MORE }; }
      return { ok: false, site: null, meta: null, problems: ['붙여 넣은 글에 고친 섹션(HTML)이 없어요. AI 답의 코드 블록을 복사해 주세요.'] };
    }
    partial.delete(key);
    const doc = new DOMParser().parseFromString(cur.site['index.html'], 'text/html');
    const old = doc.getElementById(target);
    if (!old) return { ok: false, site: null, meta: null, problems: ['고칠 섹션을 사이트에서 찾지 못했어요.'] };
    const box = doc.createElement('div'); box.innerHTML = m[0]; const neu = box.querySelector('section');
    if (neu && !neu.id) neu.id = target;
    old.replaceWith(neu || old);
    return { ok: true, site: { ...cur.site, 'index.html': '<!doctype html>\n' + doc.documentElement.outerHTML }, meta: cur.meta, problems: [] };
  }
  const start = html.search(/<!doctype html|<html[\s>]/i);
  if (start < 0) { partial.delete(key); return { ok: false, site: null, meta: null, problems: ['붙여 넣은 글에 사이트(HTML)가 없어요. AI 답의 코드 블록이나 내려받은 .html 파일을 넣어 주세요.'] }; }
  html = html.slice(start);
  const end = html.search(/<\/html>/i);
  if (end < 0) { partial.set(key, text); return { ok: false, site: null, meta: null, problems: ['답이 중간에 끊겼어요.'], continuePrompt: ASK_MORE }; }
  partial.delete(key);
  html = html.slice(0, end + 7);
  const j = /```json\s*([\s\S]*?)```/i.exec(text);
  let meta = {}; try { meta = j ? JSON.parse(j[1]) : {}; } catch { meta = {}; }
  const keep = { live: cur?.meta?.live || null, siteUrl: cur?.meta?.siteUrl || '', joinUrl: cur?.meta?.joinUrl || '', shortUrl: cur?.meta?.shortUrl || '', access: cur?.meta?.access || 'link' };
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const title = meta.title || doc.title || '';
  const full = { v: 2, title, subtitle: '', sessions: [], venue: '', mode: 'offline', audience: 'teachers', instructors: [], features: ['qa', 'poll'], theme: {}, facts: [], ...meta, ...keep };
  const problems = full.sessions?.length ? [] : ['답에 연수 날짜가 없어요. 연수 정보에서 넣어 주세요.'];
  return { ok: true, site: { 'index.html': html }, meta: full, problems };
}

export function editSite(pid, { target = 'all', request = '', way = 'key', provider = '', model = '' } = {}) { return begin(pid, 'edit', { target, request, way, provider, model }); }

export async function chatEditPrompt(pid, { target = 'all', request = '' } = {}) {
  const p = await projects.get(pid);
  const html = p?.site?.['index.html'] || '';
  let part = html;
  if (target && target !== 'all') { const doc = new DOMParser().parseFromString(html, 'text/html'); part = doc.getElementById(target)?.outerHTML || ''; }
  return [
    target && target !== 'all' ? '아래 강의 사이트 섹션을 고쳐 줘. 고친 <section> 하나만 ```html 코드 블록으로 돌려줘. id는 그대로 둬.' : '아래 강의 사이트를 고쳐 줘. 고친 index.html 전체를 ```html 코드 블록으로 돌려줘.',
    `고칠 점: ${request}`,
    'data-lp 자리 표시와 data-lp-step은 지우지 마.',
    '```html', part, '```',
  ].join('\n');
}

export async function runInspect(pid) {
  const p = await projects.get(pid);
  if (!p?.site) return [];
  const all = await blobs.all(pid).catch(() => ({}));
  const site = { ...p.site };
  for (const [k, v] of Object.entries(all)) if (k.startsWith('site/')) site[k.slice(5)] = v;
  const { files } = await assemble(site, p.meta || {}, { preview: true });
  return inspect(files, p.meta || {});
}

export function fixIssues(pid, issueIds = []) { return begin(pid, 'fix', { issueIds, way: 'key' }); }

export { hasFile };
