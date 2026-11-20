// 가짜 생성 API — docs/plan-ai-first.md §15의 이름·꼴 그대로. 실제 AI를 부르지 않고, 단계를 시간차로 진행한 뒤
// kit 작업자가 만든 사이트(data/mock-sites.js)를 돌려줍니다. 조립·검수는 진짜 엔진(E.kit)을 씀.
// 화면은 lib/studio.js 한 곳에서만 이 파일을 부름 → gen 작업자의 진짜 구현(app/src/lib/gen/index.js)이 오면 그 한 줄만 바꾸고 이 파일은 지움.
// 시험용: localStorage 'lecpage:mock-speed'(빠르기 배수), 요청에 '#실패'를 넣으면 셋째 단계에서 한 번 멈춤(오류 안내 화면 확인용).
import { useEffect, useState } from 'preact/hooks';
import { projects, blobs } from '../db.js';
import { loadRuntime } from '../engine.js';
import { assemble, inspect, previewHtml, inspectRenderedScript, readMeta } from '@engine/src/kit/index.js';
import { mockSite } from '../../data/mock-sites.js';
import { copyPages, siteFiles } from '../site-meta.js';

const jobs = new Map();
const subs = new Map();
const partial = new Map(); // 쓰던 AI 창의 끊긴 답(이어 붙이기)
const KEY = (pid) => 'lecpage:mock-job:' + pid;
const speed = () => { try { return Math.max(0.1, Number(localStorage.getItem('lecpage:mock-speed')) || 1); } catch { return 1; } };
const uid = () => Math.random().toString(36).slice(2, 10);
const IDLE = { status: 'idle', steps: [], step: null, startedAt: 0, error: null };
const TEACHER = ['live', 'siteUrl', 'joinUrl', 'shortUrl', 'access', 'surveyUrl', 'privacy', 'keepUntil'];
const teacherOf = (m = {}) => Object.fromEntries(TEACHER.filter((k) => m?.[k] !== undefined && m?.[k] !== null).map((k) => [k, m[k]]));

const PLANS = {
  make: [['plan', '교재 읽고 설계하기'], ['design', '디자인 정하기'], ['sections:1', '섹션 만들기 1/2'], ['sections:2', '섹션 만들기 2/2'], ['check', '조립하고 검수하기']],
  edit: [['read', '고칠 곳 읽기'], ['write', '고쳐 쓰기'], ['check', '조립하고 검수하기']],
  fix: [['fix', '검수 결과 고치기'], ['check', '다시 검수하기']],
};

function emit(pid) { const s = jobs.get(pid) || IDLE; (subs.get(pid) || new Set()).forEach((f) => f(s)); }
function save(pid) {
  const j = jobs.get(pid);
  try { if (j && (j.status === 'running' || j.status === 'paused')) localStorage.setItem(KEY(pid), JSON.stringify(j)); else localStorage.removeItem(KEY(pid)); } catch { /* 저장 못 해도 이번에는 됨 */ }
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

/** 넣은 교재 원본(PDF)을 사이트 자료실 자리(site/files/)에도 둠(가짜 사이트 lab이 files/workshop.pdf를 씀) */
async function copySources(pid) {
  const keys = await blobs.keys(pid).catch(() => []);
  for (const k of keys) {
    const m = /^src\/(.+\.pdf)$/i.exec(k); if (!m) continue;
    const to = 'site/files/' + m[1].toLowerCase();
    if (!keys.includes(to)) await blobs.put(pid, to, await blobs.get(pid, k));
  }
}

/** 사이트 글(p.site)과 그림(저장소 site/…)을 나눠 넣음 */
async function putSite(pid, site) {
  const text = {};
  for (const [k, v] of Object.entries(site)) { if (typeof v === 'string') text[k] = v; else await blobs.put(pid, 'site/' + k, v); }
  return text;
}

async function finish(pid, j) {
  let made = null;
  if (j.kind === 'make') {
    const kind = ['anthropic', 'codex'].includes(j.provider) ? 'lab' : 'mag';
    await copyPages(pid); if (kind === 'lab') await copySources(pid); // lab은 자료실에 교재 PDF를 올려 둔 사이트
    made = await mockSite(kind);
    made.text = await putSite(pid, made.site);
  }
  await write(pid, (cur) => {
    const versions = cur.versions || [];
    const gen = { jobId: j.id, status: 'done', way: j.way, provider: j.provider, model: j.model };
    if (j.kind === 'make') {
      // AI 답의 강사 칸(실시간 주소 등)은 버리고 지금 값을 지킴(엔진 readMeta와 같은 규칙)
      const meta = readMeta(made.meta, { prev: teacherOf(cur.meta) }).meta;
      return { v: 2, site: made.text, meta, gen, versions: [{ id: uid(), at: Date.now(), label: 'AI가 만든 판', site: made.text, meta }, ...(cur.site ? [{ id: uid(), at: Date.now() - 1, label: '다시 만들기 전', site: cur.site, meta: cur.meta }] : []), ...versions].slice(0, 10) };
    }
    const site = { ...cur.site };
    const doc = new DOMParser().parseFromString(site['index.html'] || '', 'text/html');
    if (j.kind === 'edit') {
      const sec = j.opts.target && j.opts.target !== 'all' ? doc.getElementById(j.opts.target) : doc.querySelector('main section, section');
      if (sec) { const note = doc.createElement('p'); note.textContent = `요청을 반영했어요: ${String(j.opts.request || '').slice(0, 80)}`; sec.appendChild(note); }
    } else if (j.kind === 'fix') {
      doc.querySelectorAll('img:not([alt])').forEach((img) => img.setAttribute('alt', '연수 자료 그림'));
    }
    site['index.html'] = '<!doctype html>\n' + doc.documentElement.outerHTML;
    return { site, gen, versions: [{ id: uid(), at: Date.now(), label: j.kind === 'fix' ? '검수 고치기 전' : '수정 요청 전', site: cur.site, meta: cur.meta }, ...versions].slice(0, 10) };
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
export async function chatPrompt(pid, o = {}) { return makeChatPrompt(await projects.get(pid), o); }
function makeChatPrompt(p, { request = '', reference = '' } = {}) {
  const names = (p?.files || []).filter((f) => !f.photos).map((f) => f.name).join(', ');
  return [
    '너는 한국의 강의·연수 사이트를 설계하고 직접 만드는 디자이너 겸 개발자야.',
    `첨부한 교재 파일(${names || '교재'})을 직접 읽고, 연수 참가자가 휴대폰과 PC로 볼 강의 사이트를 만들어 줘.`,
    '- 결과는 index.html 한 파일(<style> 안에 CSS). 섹션마다 <section id="…" data-title="…">를 써.',
    '- 참여 기능 자리: 질문 <div data-lp="qa"></div>, 투표 <div data-lp="poll" data-question="…" data-options=\'["…","…"]\'></div>, 실습 단계 <section data-lp-step="s1" data-title="1단계: …">.',
    '- 색은 :root의 --lp-accent --lp-ink --lp-paper --lp-font로 정해.',
    '- 맨 끝에 ```json 코드 블록으로 lecpage.json을 붙여. 제목·날짜·시간·장소·강사와 facts(찾은 쪽 번호)를 담아.',
    request ? `- 강사의 요청: ${request}` : '',
    reference ? `- 참고 디자인(따를 필요는 없음): ${reference}` : '',
    '교재에 없는 날짜·이름은 지어내지 말고 비워 둬.',
  ].filter(Boolean).join('\n');
}

const ASK_MORE = '끊긴 곳 바로 다음부터 이어서 써 주세요. 앞부분은 다시 쓰지 말고 코드 블록 하나로 주세요.';
/** 붙여 넣은 답(또는 내려받은 .html) → 사이트. 끊겼으면 continuePrompt. target: 고칠 섹션 id(그 섹션만 갈아 끼움) */
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
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const r = readMeta(j ? j[1] : { v: 2, title: doc.title || '' }, { prev: teacherOf(cur?.meta) });
  const meta = { ...r.meta, title: r.meta.title || doc.title || '' };
  const problems = [...(meta.sessions?.length ? [] : ['답에 연수 날짜가 없어요. 연수 정보에서 넣어 주세요.']), ...r.warnings.filter((w) => w.code !== 'teacher-value' && w.code !== 'title-empty').slice(0, 3).map((w) => w.message_ko)];
  return { ok: true, site: { 'index.html': html }, meta, problems };
}

export function editSite(pid, { target = 'all', request = '', way = 'key', provider = '', model = '' } = {}) { return begin(pid, 'edit', { target, request, way, provider, model }); }

export async function chatEditPrompt(pid, o = {}) { return makeEditPrompt(await projects.get(pid), o); }
function makeEditPrompt(p, { target = 'all', request = '' } = {}) {
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

/** 숨은 틀에 그려서 검수(엔진 inspectRenderedScript → { type:'lp-inspect', id, width, issues }) */
function rendered(files, width) {
  return new Promise((res) => {
    const id = uid();
    const f = document.createElement('iframe');
    f.setAttribute('sandbox', 'allow-scripts'); f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1; f.title = '검수';
    f.style.cssText = `position:fixed;left:-20000px;top:0;width:${width}px;height:900px;border:0;pointer-events:none`;
    const t = setTimeout(() => done([]), 10000);
    function on(e) { if (e.source === f.contentWindow && e.data?.type === 'lp-inspect' && e.data.id === id) done(Array.isArray(e.data.issues) ? e.data.issues : []); }
    function done(v) { clearTimeout(t); removeEventListener('message', on); f.remove(); res(v.map((x) => ({ ...x, where: { ...(x.where || {}), width } }))); }
    addEventListener('message', on);
    f.srcdoc = previewHtml(files, 'index.html', { extraBody: inspectRenderedScript({ id }) });
    document.body.appendChild(f);
  });
}

/** 조립 + 정적 검수(AI가 쓴 사이트) + 숨은 틀에서 390·1280 그려서 검수 */
export async function runInspect(pid) {
  const p = await projects.get(pid);
  if (!p?.site) return [];
  const site = await siteFiles(p);
  const issues = inspect(site, p.meta || {});
  const r = assemble(site, p.meta || {}, { runtime: await loadRuntime(), preview: true, target: 'preview', prev: { ...teacherOf(p.meta), live: { provider: 'local', url: '', code: p.meta?.live?.code || 'PREVIEW1' } } });
  const seen = new Set(issues.map((x) => x.id + x.message_ko));
  if (typeof document !== 'undefined' && r.files['index.html']) for (const w of [390, 1280]) for (const x of await rendered(r.files, w)) { const k = x.id + x.message_ko; if (!seen.has(k)) { seen.add(k); issues.push(x); } }
  return issues;
}

export function fixIssues(pid, issueIds = []) { return begin(pid, 'fix', { issueIds, way: 'key' }); }
